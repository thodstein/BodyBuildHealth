/**
 * ProgramEditorComponents.tsx — extracted sub-components for BB/PL program editing.
 * Extracted from ProgramManagerPanel.tsx.
 *
 * Components: BBEditor, SessionList, BlockList, SetEditor, PLEditor,
 *             WeakPointChips, Chip, BBConstraintsPanel
 * Constants: WEAK_OPTS, EQUIPMENT_OPTS, LOAD_STRATEGY_OPTS, DELOAD_PROTOCOL_OPTS, INTENSITY_TECHNIQUE_OPTS
 */
import React, { useMemo, useState } from 'react';
import { SET_TEMPLATES, GROUP_RU, ALL_GROUPS } from './program-types';
import { ACCENT, ACCENT_LINE, BTN, BTN_GHOST, CARD, DIM, DIM_STRONG, IN, SMALL, panelStyle, UI_METRICS } from './training-ui';
import { useConfirmDialog } from './ConfirmDialog';
import { createBlank, getReferencedCycle, userWeekToBBPlan } from '../../../engines/user-program/program-store';
import type {
  UserProgram, BBProgramBody, PLProgramBody, UserWeek, UserSession, UserBlock, UserSet,
  ProgramConstraints, ProgramProgression, LoadStrategy, DeloadProtocol,
  PLWeek, PLDay, PLExercise, PLSet,
} from '../../../engines/user-program/user-program.types';
import { newId } from '../../../engines/user-program/user-program.types';
import {
  muscleAwareSets,
  makeSetsFromTemplate,
  suggestExercisesForGroup,
  computePlanQualityFor,
} from '../../../engines/manual-constructor';
import { loadTrainingProfile } from './training-profile';
import { addWeakToWeekLogic, calcW as calcWLogic, firstFreeTrainingDay, resizeTrainingSessions, sessionDayOfWeek, trainingDayForIndex } from './program-editor-logic';
import { calcBBPlanMetrics } from '../../../engines/bb/bb-metrics.engine';
import { findSubstitutions } from '../../../engines/exercise-substitution.engine';
import { activeRampRows } from '../../../engines/warmup-ramp.engine';
import { ExerciseLabPicker } from './ExerciseLabPicker';
import { VolumeBudgetCard } from './VolumeBudgetCard';
import { EditorPopupSelect, EditorPopupNumber } from './EditorPopup';
import { INTENSITY_TECHNIQUES, type IntensityTechnique } from '../../../engines/bb/bb-autocoach.engine';
import { diagnoseWeakPoint, WEAK_POINTS_BY_LIFT, type Lift, type WeakPoint } from '../../../engines/lms/weakpoint-pl';
import { tempoFor, TEMPO_BY_CHARACTER, REST_BY_CHARACTER, tutForSet } from '../../../engines/bb/bb-tempo-rest';
import { RIR_MATRIX } from '../../../engines/rir-matrix.engine';
import { periodLabelRu } from '../../../data/lms-cycles/period-labels';
import { EXERCISE_CATALOG } from '../../../core/exercise-catalog';
import { VolumeMiniBar, ScoreBadge, Badge, ProgressBar, CARD_BTN, CARD_BTN_ACTIVE, CARD_BTN_GRID, CARD_ACTION, ICON_CARD_BTN, MethodHint } from './ManualUI';
import { getVolumeLandmarks } from '../../../engines/volume-landmarks.engine';
import { MesoHeatmap } from './MesoHeatmap';
import { MANUAL_STORAGE_KEYS } from '../../../engines/manual-constructor/manual-storage';

export const TRAINING_DAY_NAMES = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'] as const;
const DAY_COLORS = ['#f59e0b', '#3b82f6', '#22c55e', '#a78bfa', '#ef4444', '#06b6d4', '#ec4899'];

/* ─── Попап-выбор в редакторе: DayOfWeekPicker и PhasePicker теперь используют
   единый EditorPopupSelect (один портал, единый стиль, нет вложенных overlay). */

/** Попап-выбор дня недели (через EditorPopupSelect, занятые дни исключаются). */
const DayOfWeekPicker: React.FC<{
  value: number;
  occupied?: number[];
  onChange: (d: number) => void;
  ariaLabel?: string;
}> = ({ value, occupied = [], onChange, ariaLabel }) => {
  const opts = TRAINING_DAY_NAMES
    .map((d, i) => ({ id: String(i), label: d + (occupied.includes(i) ? ' · занято' : '') }))
    .filter(o => !occupied.includes(Number(o.id)));
  return (
    <EditorPopupSelect
      value={String(value)}
      options={opts}
      onChange={v => onChange(Number(v))}
      title="День недели"
      ariaLabel={ariaLabel}
      placeholder={TRAINING_DAY_NAMES[value] ?? '—'}
      buttonStyle={{ flex: '0 0 74px' }}
    />
  );
};

/** Попап-выбор фазы недели (через EditorPopupSelect). */
const PhasePicker: React.FC<{
  value: string;
  options: Array<{ id: string; label: string }>;
  onChange: (v: string) => void;
  ariaLabel?: string;
}> = ({ value, options, onChange, ariaLabel }) => (
  <EditorPopupSelect
    value={value}
    options={options}
    onChange={onChange}
    title="Фаза недели"
    ariaLabel={ariaLabel}
    placeholder={options.find(o => o.id === value)?.label ?? '—'}
  />
);

/** Быстрые шаблоны тренировочных дней — день с готовыми упражнениями из каталога (10×, покрывают Upper/Lower/Push/Pull/FullBody + специализации). */
export const DAY_TEMPLATES: Array<{
  label: string; icon: string; name: string; focus: string;
  blocks: Array<{ exerciseName: string; muscle: string; type: UserBlock['type']; sets: Array<{ reps: number; rir: number; restSec: number }> }>;
}> = [
  {
    label: 'Грудь / Трицепс', icon: '💪', name: 'Грудь / Трицепс', focus: 'грудь, трицепс',
    blocks: [
      { exerciseName: 'Жим штанги лёжа', muscle: 'chest', type: 'compound', sets: [{ reps: 8, rir: 2, restSec: 120 }, { reps: 8, rir: 2, restSec: 120 }, { reps: 6, rir: 1, restSec: 120 }] },
      { exerciseName: 'Жим гантелей лёжа', muscle: 'chest', type: 'compound', sets: [{ reps: 10, rir: 2, restSec: 90 }, { reps: 10, rir: 2, restSec: 90 }, { reps: 8, rir: 1, restSec: 90 }] },
      { exerciseName: 'Разгибания на трицепс в блоке', muscle: 'arms', type: 'isolation', sets: [{ reps: 12, rir: 2, restSec: 60 }, { reps: 12, rir: 2, restSec: 60 }] },
    ],
  },
  {
    label: 'Спина / Бицепс', icon: '🏋️', name: 'Спина / Бицепс', focus: 'спина, бицепс',
    blocks: [
      { exerciseName: 'Тяга верхнего блока (прямой)', muscle: 'back', type: 'compound', sets: [{ reps: 10, rir: 2, restSec: 90 }, { reps: 10, rir: 2, restSec: 90 }, { reps: 8, rir: 1, restSec: 90 }] },
      { exerciseName: 'Тяга штанги в наклоне (прямой хват)', muscle: 'back', type: 'compound', sets: [{ reps: 8, rir: 2, restSec: 120 }, { reps: 8, rir: 2, restSec: 120 }, { reps: 6, rir: 1, restSec: 120 }] },
      { exerciseName: 'Подъём штанги на бицепс стоя', muscle: 'arms', type: 'isolation', sets: [{ reps: 10, rir: 2, restSec: 60 }, { reps: 10, rir: 2, restSec: 60 }, { reps: 8, rir: 1, restSec: 60 }] },
    ],
  },
  {
    label: 'Ноги / Плечи', icon: '🦵', name: 'Ноги / Плечи', focus: 'ноги, плечи',
    blocks: [
      { exerciseName: 'Приседания со штангой', muscle: 'legs', type: 'compound', sets: [{ reps: 8, rir: 2, restSec: 150 }, { reps: 8, rir: 2, restSec: 150 }, { reps: 6, rir: 1, restSec: 150 }] },
      { exerciseName: 'Жим ногами', muscle: 'legs', type: 'compound', sets: [{ reps: 10, rir: 2, restSec: 120 }, { reps: 10, rir: 2, restSec: 120 }, { reps: 8, rir: 1, restSec: 120 }] },
      { exerciseName: 'Сгибания ног в тренажёре лёжа', muscle: 'legs', type: 'isolation', sets: [{ reps: 12, rir: 2, restSec: 60 }, { reps: 12, rir: 2, restSec: 60 }, { reps: 10, rir: 1, restSec: 60 }] },
      { exerciseName: 'Жим гантелей сидя', muscle: 'shoulders', type: 'compound', sets: [{ reps: 10, rir: 2, restSec: 90 }, { reps: 10, rir: 2, restSec: 90 }, { reps: 8, rir: 1, restSec: 90 }] },
    ],
  },
  {
    label: 'Верх (Upper)', icon: '🔝', name: 'Верх', focus: 'грудь, спина, плечи',
    blocks: [
      { exerciseName: 'Жим штанги лёжа', muscle: 'chest', type: 'compound', sets: [{ reps: 6, rir: 2, restSec: 120 }, { reps: 6, rir: 2, restSec: 120 }] },
      { exerciseName: 'Тяга штанги в наклоне', muscle: 'back', type: 'compound', sets: [{ reps: 8, rir: 2, restSec: 120 }, { reps: 8, rir: 2, restSec: 120 }] },
      { exerciseName: 'Жим гантелей сидя', muscle: 'shoulders', type: 'compound', sets: [{ reps: 10, rir: 2, restSec: 90 }] },
      { exerciseName: 'Тяга к лицу (face pull)', muscle: 'shoulders', type: 'isolation', sets: [{ reps: 15, rir: 2, restSec: 60 }] },
    ],
  },
  {
    label: 'Низ (Lower)', icon: '🦶', name: 'Низ', focus: 'ноги, ягодицы',
    blocks: [
      { exerciseName: 'Приседания со штангой', muscle: 'legs', type: 'compound', sets: [{ reps: 6, rir: 2, restSec: 150 }, { reps: 6, rir: 2, restSec: 150 }] },
      { exerciseName: 'Румынская тяга', muscle: 'legs', type: 'compound', sets: [{ reps: 8, rir: 2, restSec: 120 }, { reps: 8, rir: 2, restSec: 120 }] },
      { exerciseName: 'Ягодичный мост со штангой', muscle: 'legs', type: 'compound', sets: [{ reps: 10, rir: 2, restSec: 90 }] },
      { exerciseName: 'Подъёмы на носки стоя', muscle: 'legs', type: 'isolation', sets: [{ reps: 15, rir: 2, restSec: 60 }] },
    ],
  },
  {
    label: 'Толкай (Push)', icon: '🚀', name: 'Толкай', focus: 'грудь, плечи, трицепс',
    blocks: [
      { exerciseName: 'Жим штанги лёжа', muscle: 'chest', type: 'compound', sets: [{ reps: 6, rir: 2, restSec: 120 }] },
      { exerciseName: 'Жим штанги на наклонной (30°)', muscle: 'chest', type: 'compound', sets: [{ reps: 8, rir: 2, restSec: 90 }] },
      { exerciseName: 'Армейский жим стоя', muscle: 'shoulders', type: 'compound', sets: [{ reps: 8, rir: 2, restSec: 90 }] },
      { exerciseName: 'Разгибания на трицепс в блоке', muscle: 'arms', type: 'isolation', sets: [{ reps: 12, rir: 2, restSec: 60 }] },
    ],
  },
  {
    label: 'Тяни (Pull)', icon: '🪢', name: 'Тяни', focus: 'спина, бицепс, задняя дельта',
    blocks: [
      { exerciseName: 'Подтягивания (прямой хват)', muscle: 'back', type: 'compound', sets: [{ reps: 6, rir: 2, restSec: 120 }] },
      { exerciseName: 'Тяга горизонтального блока', muscle: 'back', type: 'compound', sets: [{ reps: 10, rir: 2, restSec: 90 }] },
      { exerciseName: 'Махи в наклоне на заднюю дельту', muscle: 'shoulders', type: 'isolation', sets: [{ reps: 15, rir: 2, restSec: 60 }] },
      { exerciseName: 'Подъём штанги на бицепс стоя', muscle: 'arms', type: 'isolation', sets: [{ reps: 10, rir: 2, restSec: 60 }] },
    ],
  },
  {
    label: 'FullBody', icon: '⚡', name: 'FullBody', focus: 'грудь, спина, ноги',
    blocks: [
      { exerciseName: 'Приседания со штангой', muscle: 'legs', type: 'compound', sets: [{ reps: 6, rir: 2, restSec: 120 }] },
      { exerciseName: 'Жим штанги лёжа', muscle: 'chest', type: 'compound', sets: [{ reps: 8, rir: 2, restSec: 90 }] },
      { exerciseName: 'Тяга штанги в наклоне', muscle: 'back', type: 'compound', sets: [{ reps: 8, rir: 2, restSec: 90 }] },
    ],
  },
  {
    label: 'Руки (Arms)', icon: '💥', name: 'Руки', focus: 'бицепс, трицепс',
    blocks: [
      { exerciseName: 'Подъём штанги на бицепс стоя', muscle: 'arms', type: 'isolation', sets: [{ reps: 10, rir: 2, restSec: 60 }, { reps: 10, rir: 2, restSec: 60 }] },
      { exerciseName: 'Молотки (нейтральный хват)', muscle: 'arms', type: 'isolation', sets: [{ reps: 12, rir: 2, restSec: 60 }] },
      { exerciseName: 'Жим узким хватом', muscle: 'arms', type: 'compound', sets: [{ reps: 8, rir: 2, restSec: 90 }] },
      { exerciseName: 'Разгибания на трицепс в блоке', muscle: 'arms', type: 'isolation', sets: [{ reps: 12, rir: 2, restSec: 60 }] },
    ],
  },
  {
    label: 'Кор + Пресс', icon: '🧱', name: 'Кор', focus: 'пресс, кор',
    blocks: [
      { exerciseName: 'Скручивания на полу', muscle: 'core', type: 'isolation', sets: [{ reps: 15, rir: 2, restSec: 60 }, { reps: 15, rir: 2, restSec: 60 }] },
      { exerciseName: 'Планка', muscle: 'core', type: 'isolation', sets: [{ reps: 1, rir: 3, restSec: 60 }] },
      { exerciseName: 'Подъём ног в висе', muscle: 'core', type: 'isolation', sets: [{ reps: 12, rir: 2, restSec: 60 }] },
    ],
  },
];

/** ПЛ-шаблоны дней: быстрый старт для своего цикла (3 базовых движения) — Qualität через 1 клик. */
const PL_DAY_TEMPLATES: Array<{ label: string; icon: string; name: string; lift: PLExercise['lift']; muscle: string; exercises: Array<{ name: string; lift: PLExercise['lift']; sets: PLSet[] }> }> = [
  { label: 'Присед-день', icon: '🦵', name: 'Присед', lift: 'squat', muscle: 'legs', exercises: [{ name: 'Присед', lift: 'squat', sets: [{ pct: 0.75, reps: 5, sets: 3, rir: 2 }] }, { name: 'Фронтальный присед', lift: 'squat', sets: [{ pct: 0.65, reps: 6, sets: 3, rir: 2 }] }, { name: 'Румынская тяга', lift: 'accessory', sets: [{ pct: 0.6, reps: 8, sets: 3, rir: 2 }] }] },
  { label: 'Жим-день', icon: '💪', name: 'Жим', lift: 'bench', muscle: 'chest', exercises: [{ name: 'Жим лёжа', lift: 'bench', sets: [{ pct: 0.75, reps: 5, sets: 3, rir: 2 }] }, { name: 'Жим узким хватом', lift: 'bench', sets: [{ pct: 0.68, reps: 6, sets: 3, rir: 2 }] }, { name: 'Тяга штанги в наклоне', lift: 'accessory', sets: [{ pct: 0.65, reps: 8, sets: 3, rir: 2 }] }] },
  { label: 'Тяга-день', icon: '🏋️', name: 'Тяга', lift: 'dead', muscle: 'back', exercises: [{ name: 'Становая тяга', lift: 'dead', sets: [{ pct: 0.75, reps: 3, sets: 3, rir: 2 }] }, { name: 'Тяга штанги в наклоне', lift: 'accessory', sets: [{ pct: 0.65, reps: 8, sets: 3, rir: 2 }] }, { name: 'Подтягивания', lift: 'accessory', sets: [{ pct: 0.6, reps: 6, sets: 3, rir: 2 }] }] },
];

export function isUserBlockClipboardShape(value: unknown): value is UserBlock {
  if (!value || typeof value !== 'object') return false;
  const block = value as Partial<UserBlock>;
  const sets = block.sets;
  return typeof block.id === 'string'
    && typeof block.type === 'string'
    && typeof block.exerciseName === 'string'
    && typeof block.muscle === 'string'
    && (block.role === 'primary' || block.role === 'accessory')
    && Array.isArray(sets)
    && sets.every(set => !!set
      && (typeof set.reps === 'number' || typeof set.reps === 'string')
      && Number.isFinite(set.rir)
      && set.rir >= 0
      && set.rir <= 5
      && (set.weight == null || (Number.isFinite(set.weight) && set.weight >= 0)));
}

export function normalizeProgramDayOfWeek(value: number, fallback = 0): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(6, Math.round(value))) : fallback;
}

/* ─── ББ-редактор: недели → сессии → блоки ─── */

const BBEditor: React.FC<{ body: BBProgramBody; onChange: (b: BBProgramBody) => void; level: string }> = ({ body, onChange, level }) => {
  const [volWeekIdx, setVolWeekIdx] = useState<number | null>(null);
  const [expandedWeekIdx, setExpandedWeekIdx] = useState(0);
  const [noteWeekIdx, setNoteWeekIdx] = useState<number | null>(null);
  const [howCollapsed, setHowCollapsed] = useState<boolean>(() => { try { return localStorage.getItem(MANUAL_STORAGE_KEYS.BB_HOW_COLLAPSED) === '1'; } catch { return false; } });
  const [showAllWeeks, setShowAllWeeks] = useState(false);
  const [boardMode, setBoardMode] = useState<boolean>(() => { try { return localStorage.getItem(MANUAL_STORAGE_KEYS.BB_BOARD_MODE) === '1'; } catch { return false; } });
  const [showHeatmap, setShowHeatmap] = useState(false);
  const { confirm } = useConfirmDialog();
  React.useEffect(() => {
    setExpandedWeekIdx(current => body.weeks.length === 0 ? -1 : Math.min(Math.max(current, 0), body.weeks.length - 1));
    setVolWeekIdx(current => current != null && current < body.weeks.length ? current : null);
  }, [body.weeks.length]);
  const bodyRef = React.useRef(body);
  bodyRef.current = body;
  const weekDays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
  const setWeeks = (weeks: UserWeek[]) => onChange({ ...bodyRef.current, weeks });
  const addWeek = () => {
    const current = bodyRef.current;
    const n = current.weeks.length + 1;
    setWeeks([...current.weeks, { week: n, phase: 'accumulation', deload: false, sessions: [] }]);
    setExpandedWeekIdx(n - 1);
  };
  const updateWeek = (wi: number, patch: Partial<UserWeek>) => {
    const w2 = bodyRef.current.weeks.map((w, i) => i === wi ? { ...w, ...patch } : w);
    setWeeks(w2);
  };
  const resizeWeek = async (wi: number, count: number) => {
    const current = bodyRef.current;
    const week = current.weeks[wi];
    if (!week) return;
    if (count < week.sessions.length) {
      const willDelete = week.sessions.slice(count);
      const hasContent = willDelete.some(s => s.blocks.some(b => b.exerciseName && b.exerciseName.trim()));
      if (hasContent) {
        const ok = await confirm({ title: `Уменьшить до ${count} тренировок?`, message: `Последние ${week.sessions.length - count} дней с упражнениями будут удалены из недели ${week.week}. Продолжить?`, confirmLabel: 'Удалить', danger: true });
        if (!ok) return;
      }
    }
    const sessions = resizeTrainingSessions(week.sessions, count, week.deload);
    setWeeks(current.weeks.map((w, index) => index === wi ? { ...w, sessions } : w));
  };
  // U4/F4: confirm-диалог при удалении недели — ConfirmDialog вместо window.confirm
  const removeWeek = async (wi: number) => {
    const wk = bodyRef.current.weeks[wi];
    const sessCount = wk?.sessions?.length ?? 0;
    const ok = await confirm({ title: `Удалить неделю ${wk?.week}?`, message: `Будет потеряно ${sessCount} сессий. Это нельзя отменить.`, confirmLabel: 'Удалить', danger: true });
    if (!ok) return;
    const remaining = bodyRef.current.weeks.filter((_, i) => i !== wi).map((w, i) => ({ ...w, week: i + 1 }));
    setWeeks(remaining);
    setExpandedWeekIdx(remaining.length === 0 ? -1 : Math.min(wi, remaining.length - 1));
  };
  // U12: клонировать неделю с прогрессией весов +2.5%
  const cloneWeek = (wi: number) => {
    const current = bodyRef.current;
    const src = current.weeks[wi];
    if (!src) return;
    const progression = 1.025; // +2.5% к весу
    const cloned: UserWeek = {
      week: current.weeks.length + 1,
      phase: src.phase,
      deload: src.deload,
      sessions: src.sessions.map(s => ({
        id: newId('ses'),
        name: s.name,
        dayOfWeek: s.dayOfWeek,
        focus: s.focus,
        blocks: s.blocks.map(b => ({ ...b, id: newId('blk'), sets: b.sets.map(st => ({ ...st, weight: st.weight ? Math.round(st.weight * progression / 2.5) * 2.5 : st.weight })) })),
        warmup: s.warmup,
        cooldown: s.cooldown,
      })),
    };
    setWeeks([...current.weeks, cloned]);
    setExpandedWeekIdx(current.weeks.length);
  };
  // F2.3: swap two weeks (drag-and-drop lite — кнопка переставляет соседние недели)
  const swapWeek = (a: number, b: number) => {
    const current = bodyRef.current;
    if (a < 0 || b < 0 || a >= current.weeks.length || b >= current.weeks.length || a === b) return;
    const arr = [...current.weeks];
    [arr[a], arr[b]] = [arr[b], arr[a]];
    // Сохраняем week-номера (переставляем только содержимое)
    arr[a] = { ...arr[a], week: current.weeks[a].week };
    arr[b] = { ...arr[b], week: current.weeks[b].week };
    setWeeks(arr);
  };
  // F3: reorder full weeks with desktop drag-and-drop; preserves week numbers.
  const weekDragRef = React.useRef<number | null>(null);
  const moveWeek = (from: number, to: number) => {
    const current = bodyRef.current;
    if (from === to || from < 0 || to < 0 || from >= current.weeks.length || to >= current.weeks.length) return;
    const arr = [...current.weeks];
    const [moved] = arr.splice(from, 1);
    arr.splice(to, 0, moved);
    setWeeks(arr.map((w, i) => ({ ...w, week: i + 1 })));
  };

  /** Метрики для выбранной недели — мемоизированы по хэшу выбранной недели (не всей программы). */
  const selectedWeek = volWeekIdx != null ? body.weeks[volWeekIdx] : null;
  const selectedWeekHash = selectedWeek ? JSON.stringify(selectedWeek) : '';
  const volMetrics = useMemo(() => {
    if (selectedWeek == null) return null;
    if ((selectedWeek.sessions ?? []).length === 0) return null;
    try { return calcBBPlanMetrics(userWeekToBBPlan(selectedWeek, level)); } catch { return null; }
  }, [selectedWeekHash, level]);

  const liveQuality = useMemo(() => {
    if (body.weeks.length === 0) return null;
    try {
      const tmpProg = { meta: { id:'tmp', title:'tmp', author:'', goal:'hypertrophy', level, daysPerWeek: body.weeks[0]?.sessions.length ?? 3, weeks: body.weeks.length, direction:'bb' as const, createdAt:'', updatedAt:'', source:'custom' as const }, bb: body } as any;
      return computePlanQualityFor(tmpProg, level);
    } catch { return null; }
  }, [JSON.stringify(body.weeks), level]);

  // Keyboard shortcuts for week navigation (проф-удобство)
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        if (expandedWeekIdx >= 0 && expandedWeekIdx < body.weeks.length) {
          e.preventDefault();
          cloneWeek(expandedWeekIdx);
        }
      } else if (e.key === 'Delete' && expandedWeekIdx >= 0 && body.weeks.length > 1) {
        // Delete — удалить раскрытую неделю (с подтверждением внутри removeWeek)
        if (!e.ctrlKey && !e.metaKey && !e.altKey) {
          e.preventDefault();
          removeWeek(expandedWeekIdx);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [expandedWeekIdx, body.weeks.length]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div className="constructor-surface constructor-surface--info" style={{ ...CARD, padding: howCollapsed ? '8px 10px' : 10, borderLeft: '3px solid #60a5fa' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#60a5fa', flex: 1 }}>Как собрать программу</div>
          <button aria-expanded={!howCollapsed} aria-label={howCollapsed ? 'Показать подсказку' : 'Скрыть подсказку'} onClick={() => { const v = !howCollapsed; setHowCollapsed(v); try { localStorage.setItem(MANUAL_STORAGE_KEYS.BB_HOW_COLLAPSED, v ? '1' : '0'); } catch {} }} style={{ ...BTN_GHOST, padding: '4px 8px', fontSize: 10, minHeight: 28 }}>{howCollapsed ? 'Показать' : 'Скрыть'}</button>
        </div>
        {!howCollapsed && (
          <>
            <div style={{ fontSize: 11, color: DIM_STRONG, lineHeight: 1.5, marginTop: 4 }}>
              1. В каждой неделе добавьте тренировочные дни. 2. Назначьте каждому дню Пн–Вс и задайте фокус. 3. Внутри дня добавьте упражнения, затем настройте подходы, повторы, RIR и вес.
            </div>
            <div style={{ fontSize: 10, color: DIM, marginTop: 5 }}>Неделя = период прогрессии · день = отдельная тренировка · упражнение = движение · сет = один подход.</div>
          </>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: ACCENT }}>Структура: {body.weeks.length} нед. · тренировочные дни внутри каждой недели</span>
        <span style={{ fontSize: 10, color: DIM }}>{body.weeks.length > 0 ? '— редактируйте расписание и упражнения ниже' : '— добавьте первую неделю'}</span>
        {body.weeks.length > 0 && (
          <button aria-pressed={boardMode} aria-label={boardMode ? 'Переключить в список' : 'Переключить в доску'} onClick={() => { const v = !boardMode; setBoardMode(v); try { localStorage.setItem(MANUAL_STORAGE_KEYS.BB_BOARD_MODE, v ? '1' : '0'); } catch {} }} style={{ ...BTN_GHOST, padding: '4px 10px', fontSize: 10, minHeight: 28, marginLeft: 'auto', borderColor: boardMode ? 'rgba(0,230,138,0.4)' : 'rgba(255,255,255,0.12)', color: boardMode ? '#00e68a' : DIM }}>
            {boardMode ? '📋 Список' : '🗂 Доска'}
          </button>
        )}
      </div>
      {body.weeks.length > 0 && (
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.50)', background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:8, padding:'5px 8px', lineHeight:1.4 }}>
          <span style={{ fontWeight: 700, color: 'rgba(255,255,255,0.65)' }}>Канон расписания:</span> 3д → Пн·Ср·Пт · 4д → Пн·Вт·Чт·Пт · 5д → Пн·Вт·Ср·Пт·Сб · 6д → Пн-Сб · <span style={{ color:'#f59e0b' }}>⭐</span> — рекомендовано, можно любой день 0-6.
        </div>
      )}
      {/* Live качество — score + баланс, мемоизировано (liveQuality) */}
      {liveQuality && (() => {
          const q = liveQuality;
          const low = q.perMuscle.filter(m => m.status === 'low');
          const over = q.perMuscle.filter(m => m.status === 'over');
          const col = q.score >=75 ? '#22c55e' : q.score >=50 ? '#f59e0b' : '#ef4444';
          return (
            <div aria-live="polite" aria-atomic="true" style={{ ...CARD, padding: 10, borderLeft: `3px solid ${col}`, display:'flex', flexDirection:'column', gap:6 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                <span style={{ fontSize:11, fontWeight:800, color: col }}>📊 Качество</span>
                <ScoreBadge score={q.score} grade={q.grade} />
                <span style={{ fontSize:10, color:DIM }}>{q.perMuscle.length} групп · {low.length} недобор · {over.length} перегруз</span>
                <span style={{ marginLeft:'auto', fontSize:10, color:DIM }}>Live при правке</span>
              </div>
              <ProgressBar value={q.score} max={100} color={col} height={6} />
              <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                {q.perMuscle.map(pm => {
                  const c = pm.status === 'over' ? '#ef4444' : pm.status === 'low' ? '#3b82f6' : pm.status === 'high' ? '#f59e0b' : '#22c55e';
                  const icon = pm.status === 'over' ? '⚠' : pm.status === 'low' ? '⬇' : pm.status === 'high' ? '↗' : '✓';
                  return <span key={pm.muscle} style={{ fontSize:10, fontWeight:700, color:c, background:c+'14', border:`1px solid ${c}30`, borderRadius:6, padding:'2px 6px' }}>{icon} {GROUP_RU[pm.muscle] ?? pm.muscle} {pm.peakSets}/{pm.mrv}</span>;
                })}
              </div>
              {low.length >0 && (
                <div style={{ display:'flex', gap:4, flexWrap:'wrap', alignItems:'center' }}>
                  <span style={{ fontSize:10, color:'#3b82f6', fontWeight:700 }}>+ Быстро:</span>
                  {low.slice(0,3).map(w => (
                    <button key={w.muscle} onClick={() => {
                      const prof = loadTrainingProfile();
                      const upd = addWeakToWeekLogic({ weeks: body.weeks, muscle: w.muscle, level, profile: prof, maxExercisesPerWeek: 2, sessionIndex: 0 });
                      setWeeks(upd);
                    }} style={{ padding:'4px 8px', borderRadius:6, fontSize:10, cursor:'pointer', background:'rgba(59,130,246,0.10)', border:'1px solid rgba(59,130,246,0.25)', color:'#3b82f6', fontWeight:700 }}>+ {GROUP_RU[w.muscle] ?? w.muscle}</button>
                  ))}
                </div>
              )}
            </div>
          );
        })()}
      {body.weeks.length > 1 && (
        <div style={{ ...CARD, padding: 8, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: ACCENT }}>🗺 Тепловая карта объёма</span>
          <span style={{ fontSize: 10, color: DIM }}>Live по неделям · MEV/MAV/MRV</span>
          <button onClick={() => setShowHeatmap(v => !v)} style={{ ...BTN_GHOST, padding: '4px 10px', fontSize: 10, minHeight: 28, marginLeft: 'auto', borderColor: showHeatmap ? 'rgba(0,230,138,0.35)' : 'rgba(255,255,255,0.12)', color: showHeatmap ? '#00e68a' : DIM }}>{showHeatmap ? 'Скрыть' : 'Показать'}</button>
        </div>
      )}
      {showHeatmap && body.weeks.length > 1 && (() => {
        try {
          const tmpProg = { meta: { id: 'tmp', title: 'tmp', author: '', goal: 'hypertrophy', level, daysPerWeek: body.weeks[0]?.sessions.length ?? 3, weeks: body.weeks.length, direction: 'bb' as const, createdAt: '', updatedAt: '', source: 'custom' as const }, bb: body } as any;
          return <div role="img" aria-label={`Тепловая карта объёма: ${body.weeks.length} недель`}><MesoHeatmap program={tmpProg} dir="bb" /></div>;
        } catch { return null; }
      })()}
      {body.weeks.length > 1 && (
        <>
          {/* WeekStrip — липкая лента пилюль недель с цветами фаз, скроллом и MesoHeatmap-мини */}
          <div style={{ display: 'flex', gap: 4, overflowX: 'auto', padding: '6px 2px', scrollbarWidth: 'thin', alignItems: 'center' }} role="tablist" aria-label="Навигация по неделям">
            {body.weeks.map((w, wi) => {
              const col: Record<string,string> = { accumulation: '#22c55e', intensification: '#f59e0b', deload: '#ef4444', peaking: '#a78bfa' };
              const c = col[w.phase] ?? '#666';
              const active = !showAllWeeks && expandedWeekIdx === wi;
              const sets = w.sessions.reduce((s,ses)=> s+ses.blocks.reduce((b,blk)=> b+blk.sets.length,0),0);
              return (
                <button key={wi} id={`week-tab-${wi}`} role="tab" aria-selected={active} aria-controls={`week-panel-${wi}`} tabIndex={active ? 0 : -1} onClick={() => { setShowAllWeeks(false); setExpandedWeekIdx(wi); }} onKeyDown={(e) => {
                  if (e.key === 'ArrowRight') { e.preventDefault(); const n=(wi+1)%body.weeks.length; setShowAllWeeks(false); setExpandedWeekIdx(n); setTimeout(()=>document.getElementById(`week-tab-${n}`)?.focus(),0); }
                  else if (e.key === 'ArrowLeft') { e.preventDefault(); const p=(wi-1+body.weeks.length)%body.weeks.length; setShowAllWeeks(false); setExpandedWeekIdx(p); setTimeout(()=>document.getElementById(`week-tab-${p}`)?.focus(),0); }
                  else if (e.key === 'Home') { e.preventDefault(); setShowAllWeeks(false); setExpandedWeekIdx(0); setTimeout(()=>document.getElementById('week-tab-0')?.focus(),0); }
                  else if (e.key === 'End') { e.preventDefault(); const last=body.weeks.length-1; setShowAllWeeks(false); setExpandedWeekIdx(last); setTimeout(()=>document.getElementById(`week-tab-${last}`)?.focus(),0); }
                }} style={{ flex:'0 0 auto', minWidth: 64, padding: '6px 10px', borderRadius: 10, fontSize: 11, fontWeight: 700, cursor:'pointer', background: active ? c+'20' : 'rgba(255,255,255,0.04)', border: active ? `1px solid ${c}` : '1px solid rgba(255,255,255,0.08)', color: active ? c : 'rgba(255,255,255,0.7)', display:'flex', flexDirection:'column', alignItems:'center', gap: 2 }}>
                  <span>Н{w.week}{w.deload ? ' · deload' : ''}</span>
                  <span style={{ fontSize: 10, fontWeight:400, color: active ? c : 'rgba(255,255,255,0.45)' }}>{w.phase} · {sets}с</span>
                  <span style={{ width: '100%', height: 3, borderRadius: 2, background: c, opacity: active ? 1 : 0.6 }} />
                </button>
              );
            })}
          </div>
          {/* PhaseBar — мини-полоска периодизации по всем неделям */}
          <div style={{ display:'flex', height: 6, borderRadius: 4, overflow:'hidden', margin:'0 2px' }} title="Периодизация: накопление→интенсификация→пик→делоад">
            {body.weeks.map((w,wi)=> {
              const col: Record<string,string> = { accumulation:'#22c55e', intensification:'#f59e0b', deload:'#ef4444', peaking:'#a78bfa' };
              const c = col[w.phase]||'#666';
              return <div key={wi} style={{ flex:1, background:c, opacity: w.deload?0.55:1 }} title={`Н${w.week} ${w.phase}${w.deload?' · deload':''}`} />;
            })}
          </div>
          <div className="editor-week-bulk-actions">
            <span>Навигация по неделям:</span>
            <label className="editor-week-jump">Перейти к
              <EditorPopupSelect
                value={expandedWeekIdx < 0 ? '' : String(expandedWeekIdx)}
                options={[{ id: '', label: 'Выбрать' }, ...body.weeks.map((week, index) => ({ id: String(index), label: `Неделя ${week.week}` }))]}
                onChange={v => { setShowAllWeeks(false); setExpandedWeekIdx(v === '' ? -1 : Number(v)); }}
                ariaLabel="Перейти к неделе"
                title="Неделя для редактирования"
                placeholder="Выбрать"
              />
            </label>
            <button type="button" onClick={() => { setShowAllWeeks(false); setExpandedWeekIdx(current => Math.max(0, current - 1)); }} disabled={expandedWeekIdx <= 0}>← Предыдущая</button>
            <button type="button" onClick={() => { setShowAllWeeks(false); setExpandedWeekIdx(current => Math.min(body.weeks.length - 1, Math.max(0, current + 1))); }} disabled={expandedWeekIdx < 0 || expandedWeekIdx >= body.weeks.length - 1}>Следующая →</button>
            <button type="button" onClick={() => { setShowAllWeeks(false); setExpandedWeekIdx(0); }}>Открыть первую</button>
            <button type="button" onClick={() => { setShowAllWeeks(showAllWeeks ? false : true); if (!showAllWeeks) setExpandedWeekIdx(-1); }}>{showAllWeeks ? 'Свернуть все' : 'Развернуть все'}</button>
          </div>
        </>
      )}
      {/* 🎯 Быстрое добавление упражнений для слабых групп из профиля */}
      {(() => {
        const prof = loadTrainingProfile();
        const wp = (prof.weakPoints ?? []) as string[];
        if (wp.length === 0) return null;
        const addWeakToWeek = (muscle: string) => {
          const updated = addWeakToWeekLogic({
            weeks: body.weeks,
            muscle,
            level,
            profile: prof,
            maxExercisesPerWeek: 2,
            sessionIndex: 0,
          });
          setWeeks(updated);
        };
        return (
          <div style={{ ...CARD, padding: 10, borderLeft: '3px solid #a78bfa' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#a78bfa', marginBottom: 4 }}>🎯 Слабые группы — быстрое добавление</div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {wp.map((m) => (
                <button
                  key={m}
                  onClick={() => addWeakToWeek(m)}
                  style={{ padding: '8px 14px', borderRadius: 8, fontSize: 11, cursor: 'pointer', background: 'rgba(167,139,250,0.10)', border: '1px solid rgba(167,139,250,0.25)', color: '#a78bfa', fontWeight: 700, minHeight: 44 }}
                >
                  + {GROUP_RU[m] ?? m}
                </button>
              ))}
            </div>
          </div>
        );
      })()}
      {/* ⚡ Пустые тренировки — 1-клик заполнение качественными упражнениями (ловит и пустые имена) */}
      {(() => {
        const isEmptySession = (s: UserSession) => !(s.blocks ?? []).some(b => b.exerciseName && b.exerciseName.trim());
        const hasEmpty = body.weeks.some(w => w.sessions.some(isEmptySession));
        if (!hasEmpty) return null;
        const fillEmpty = () => {
          const prof = loadTrainingProfile();
          const updated = body.weeks.map(w => ({
            ...w,
            sessions: w.sessions.map(s => {
              if (!isEmptySession(s)) return s;
              const focusMuscles = (s.focus || '').toLowerCase().split(/[,/+&]/).map(x => x.trim()).filter(Boolean);
              // маппим фокус-строку к ключам GROUP_RU
              const focusToKey = (txt: string): string | null => {
                const t = txt.toLowerCase();
                if (t.includes('грудь') || t === 'chest') return 'chest';
                if (t.includes('спин') || t === 'back') return 'back';
                if (t.includes('ног') || t === 'legs' || t === 'quads' || t.includes('бедр')) return 'legs';
                if (t.includes('плеч') || t === 'shoulders') return 'shoulders';
                if (t.includes('рук') || t === 'arms' || t.includes('биц') || t.includes('триц')) return 'arms';
                if (t.includes('кор') || t === 'core') return 'core';
                return null;
              };
              let targetMuscles = focusMuscles.map(focusToKey).filter(Boolean) as string[];
              if (targetMuscles.length === 0) {
                const n = (s.name || '').toLowerCase();
                if (n.includes('грудь')) targetMuscles = ['chest','triceps'];
                else if (n.includes('спин')) targetMuscles = ['back','biceps'];
                else if (n.includes('ног')) targetMuscles = ['legs','shoulders'];
                else if (n.includes('плеч')) targetMuscles = ['shoulders','arms'];
                else if (n.includes('рук')) targetMuscles = ['arms','shoulders'];
                else targetMuscles = ['chest','back'];
              }
              const newBlocks = targetMuscles.slice(0, 2).map(m => {
                const exs = suggestExercisesForGroup(m, prof.level || level, 1, prof.equipment ?? [], prof.weakPoints ?? [], (prof.injuries ?? []).filter(i=>i.exclude).map(i=>i.muscle), prof.avoidAxialLoad ?? false, prof.favoriteExercises ?? [], prof.excludedExercises ?? []);
                const ex = exs[0];
                if (!ex) return null;
                const tmpl = muscleAwareSets(m, prof.level || level);
                const wgt = (prof.workMax ?? {})[m] ?? (prof.workMax ?? {})[m.toLowerCase()] ?? 40;
                const sets = makeSetsFromTemplate(tmpl as any, wgt);
                return { id: newId('blk'), type: (ex.type === 'compound' ? 'compound' : 'accessory') as 'compound' | 'accessory', exerciseName: ex.name, muscle: m, role: (ex.type === 'compound' ? 'primary' : 'accessory') as 'primary' | 'accessory', sets: sets.length ? sets : [{ reps: 10, rir: 2 }] };
              }).filter(Boolean) as UserBlock[];
              return newBlocks.length ? { ...s, blocks: newBlocks } : s;
            }),
          }));
          setWeeks(updated);
        };
        return (
          <div style={{ ...CARD, padding: 10, borderLeft: '3px solid #00e68a', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#00e68a' }}>⚡ Пустые тренировки — 1 клик до качества</span>
            <span style={{ fontSize: 10, color: DIM, flex: '1 1 200px' }}>Добавит по 2 базовых упражнения в каждый пустой день (по фокусу, с учётом уровня/оборудования/весов)</span>
            <button style={{ ...BTN, padding: '6px 14px', fontSize: 11, minHeight: 36, marginLeft: 'auto' }} onClick={fillEmpty}>⚡ Заполнить пустые</button>
          </div>
        );
      })()}
      {body.weeks.map((w, wi) => {
        const isOpen = showAllWeeks || expandedWeekIdx === wi;
        return (
        <div className={`editor-week-card${isOpen ? ' is-open' : ''}`}
          key={wi}
          draggable
          onDragStart={e => { weekDragRef.current = wi; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(wi)); }}
          onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
          onDrop={e => { e.preventDefault(); const from = weekDragRef.current; weekDragRef.current = null; if (from != null) moveWeek(from, wi); }}
          onDragEnd={() => { weekDragRef.current = null; }}
          style={{ ...CARD, padding: 0, overflow: 'hidden', borderLeft: `4px solid ${{ accumulation: '#22c55e', intensification: '#f59e0b', deload: '#ef4444', peaking: '#a78bfa' }[w.phase] ?? '#22c55e'}`, background: 'linear-gradient(180deg, rgba(26,28,38,0.72), rgba(20,22,32,0.52))' }}
        >
          {/* Header row — заголовок недели */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 10px 8px', borderBottom: isOpen ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
            <span title="Перетащите для изменения порядка недель" style={{ cursor: 'grab', fontSize: 12, color: 'rgba(255,255,255,0.35)', userSelect: 'none', padding: '4px', touchAction: 'none', minWidth: 24, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>☰</span>
            <button className="editor-week-toggle" type="button" aria-expanded={isOpen} aria-label={`${isOpen ? 'Свернуть' : 'Открыть'} неделю ${w.week}`} onClick={() => { if (showAllWeeks) { setShowAllWeeks(false); setExpandedWeekIdx(wi); } else setExpandedWeekIdx(expandedWeekIdx === wi ? -1 : wi); }} style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid rgba(255,255,255,0.10)', background: isOpen ? 'rgba(0,230,138,0.12)' : 'rgba(255,255,255,0.04)', color: isOpen ? '#00e68a' : 'rgba(255,255,255,0.65)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>{isOpen ? '▼' : '▶'}</button>
            {(() => {
              const pc = { accumulation: '#22c55e', intensification: '#f59e0b', deload: '#ef4444', peaking: '#a78bfa' }[w.phase];
              const prog = wi > 0 ? Math.round(((1.025 ** wi) - 1) * 100) : 0;
              const totalExercises = w.sessions.reduce((s, ses) => s + ses.blocks.filter(block => block.exerciseName).length, 0);
              const totalSets = w.sessions.reduce((s, ses) => s + ses.blocks.reduce((b, blk) => b + blk.sets.length, 0), 0);
              return (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                  <div style={{ width: 3, height: 22, borderRadius: 2, background: pc, flexShrink: 0 }} />
                  <span style={{ fontSize: 13, fontWeight: 850, color: '#fff', letterSpacing: -0.15 }}>Неделя {w.week}</span>
                  {prog > 0 && <span style={{ fontSize: 10, fontWeight: 800, color: '#22c55e', background: 'rgba(34,197,94,0.14)', border: '1px solid rgba(34,197,94,0.24)', borderRadius: 6, padding: '1px 6px' }}>+{prog}%</span>}
                  <span className="editor-week-summary" style={{ fontSize: 11, color: 'rgba(255,255,255,0.52)', fontWeight: 500 }}>{w.sessions.length} дн. · {totalExercises} упр. · {totalSets} подх.</span>
                  {w.deload && <span style={{ fontSize: 10, fontWeight: 800, color: '#ef4444', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.28)', borderRadius: 6, padding: '1px 6px' }}>deload</span>}
                </div>
              );
            })()}
            <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <button aria-label={`Копировать неделю ${w.week}`} style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.65)', cursor: 'pointer', fontSize: 12 }} onClick={() => cloneWeek(wi)} title="Клонировать — +2.5% к весу">⧉</button>
              <button aria-label={`Заметка недели ${w.week}`} style={{ width: 32, height: 32, borderRadius: 8, border: noteWeekIdx === wi ? '1px solid rgba(0,230,138,0.35)' : '1px solid rgba(255,255,255,0.08)', background: noteWeekIdx === wi ? 'rgba(0,230,138,0.12)' : 'rgba(255,255,255,0.04)', color: noteWeekIdx === wi ? '#00e68a' : 'rgba(255,255,255,0.65)', cursor: 'pointer', fontSize: 12 }} onClick={() => setNoteWeekIdx(noteWeekIdx === wi ? null : wi)} title="Заметка">💬</button>
              <button aria-label={`Удалить неделю ${w.week}`} style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid rgba(239,68,68,0.18)', background: 'rgba(239,68,68,0.08)', color: '#ef4444', cursor: 'pointer', fontSize: 12 }} onClick={() => removeWeek(wi)}>✕</button>
            </span>
          </div>
          {/* Meta row — фаза / RIR / deload / кол-во тренировок / объём */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 10px', flexWrap: 'wrap', background: 'rgba(0,0,0,0.16)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
            <PhasePicker value={w.phase} options={[{ id: 'accumulation', label: 'Накопление' }, { id: 'intensification', label: 'Интенсификация' }, { id: 'deload', label: 'Разгрузка' }, { id: 'peaking', label: 'Пик' }]} onChange={v => updateWeek(wi, { phase: v as UserWeek['phase'] })} ariaLabel={`Фаза недели ${w.week}`} />
            {(() => {
              const phaseRir: Record<string, string> = { accumulation: '3→1', intensification: '2→0', deload: '4', peaking: '1→0' };
              const avgRir = w.sessions.reduce((s, ses) => s + ses.blocks.reduce((b, blk) => b + blk.sets.reduce((st, set) => st + (set.rir ?? 2), 0), 0), 0);
              const totalSets = w.sessions.reduce((s, ses) => s + ses.blocks.reduce((b, blk) => b + blk.sets.length, 0), 0);
              const actual = totalSets > 0 ? Math.round((avgRir / totalSets) * 10) / 10 : null;
              const targetLo = { accumulation: 3, intensification: 2, deload: 4, peaking: 1 }[w.phase] ?? 2;
              const ok = actual !== null && actual >= targetLo - 1 && actual <= targetLo + 1;
              return <span style={{ fontSize: 10, fontWeight: 700, color: ok ? '#22c55e' : '#f59e0b', background: ok ? 'rgba(34,197,94,0.10)' : 'rgba(245,158,11,0.10)', border: `1px solid ${ok ? 'rgba(34,197,94,0.20)' : 'rgba(245,158,11,0.20)'}`, borderRadius: 8, padding: '3px 7px' }}>🎯 RIR {phaseRir[w.phase] ?? '—'}{actual !== null && <span style={{ color: ok ? '#86efac' : '#fcd34d', fontWeight: 500 }}> · {actual}</span>}</span>;
            })()}
            <label style={{ fontSize: 11, color: w.deload ? '#ef4444' : 'rgba(255,255,255,0.55)', display: 'flex', alignItems: 'center', gap: 4, background: w.deload ? 'rgba(239,68,68,0.10)' : 'rgba(255,255,255,0.04)', border: `1px solid ${w.deload ? 'rgba(239,68,68,0.20)' : 'rgba(255,255,255,0.06)'}`, borderRadius: 8, padding: '3px 8px', cursor: 'pointer' }}><input type="checkbox" checked={w.deload} onChange={e => updateWeek(wi, { deload: e.target.checked })} style={{ accentColor: '#ef4444' }} /> deload</label>
            <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: '3px 8px' }}>Тренировок<EditorPopupNumber value={w.sessions.length} min={1} max={7} onChange={v => resizeWeek(wi, v)} ariaLabel={`Количество тренировок в неделе ${w.week}`} title="Тренировок в неделе" format={v => `${v}`} /></label>
            <button style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 8, border: volWeekIdx === wi ? '1px solid rgba(0,230,138,0.32)' : '1px solid rgba(255,255,255,0.08)', background: volWeekIdx === wi ? 'rgba(0,230,138,0.14)' : 'rgba(255,255,255,0.04)', color: volWeekIdx === wi ? '#00e68a' : 'rgba(255,255,255,0.65)', cursor: 'pointer', marginLeft: 'auto' }} onClick={() => { setExpandedWeekIdx(wi); setVolWeekIdx(volWeekIdx === wi ? null : wi); }}>{volWeekIdx === wi ? 'Скрыть объём' : '📊 Объём'}</button>
          </div>
          {/* Actions row — перемещение недели */}
          <div style={{ display: 'flex', gap: 4, padding: '6px 10px', alignItems: 'center', background: 'rgba(255,255,255,0.01)' }}>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', fontWeight: 600 }}>Порядок:</span>
            {wi > 0 ? <button aria-label={`Переместить неделю ${w.week} выше`} style={{ fontSize: 11, padding: '4px 8px', borderRadius: 8, border: '1px solid rgba(167,139,250,0.22)', background: 'rgba(167,139,250,0.08)', color: '#a78bfa', cursor: 'pointer' }} onClick={() => swapWeek(wi, wi - 1)}>▲ выше</button> : <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.22)' }}>— начало</span>}
            {wi < body.weeks.length - 1 ? <button aria-label={`Переместить неделю ${w.week} ниже`} style={{ fontSize: 11, padding: '4px 8px', borderRadius: 8, border: '1px solid rgba(167,139,250,0.22)', background: 'rgba(167,139,250,0.08)', color: '#a78bfa', cursor: 'pointer' }} onClick={() => swapWeek(wi, wi + 1)}>▼ ниже</button> : <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.22)' }}>— конец</span>}
            <span style={{ marginLeft: 'auto', fontSize: 10, color: 'rgba(255,255,255,0.30)' }}>перетащите ☰ для порядка · клик ▼/▶ для деталей</span>
          </div>
          {noteWeekIdx === wi && (
            <div style={{ marginBottom: 8 }}>
              <textarea
                value={w.note ?? ''}
                onChange={e => updateWeek(wi, { note: e.target.value })}
                placeholder="Заметка к неделе (для тренера) — попадёт в экспорт и PDF"
                rows={2}
                style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: `1px solid ${ACCENT_LINE}`, borderRadius: 8, padding: '8px 10px', color: '#fff', fontSize: 11, resize: 'vertical', minHeight: 44 }}
              />
            </div>
          )}
          {isOpen && volWeekIdx === wi && (
            <div style={{ marginBottom: 8 }}>
              {volMetrics
                ? <VolumeBudgetCard metrics={volMetrics} />
                : <div style={{ fontSize: 11, color: DIM, padding: 8, background: 'rgba(255,255,255,0.02)', borderRadius: 8 }}>
                    Недостаточно данных — добавьте хотя бы одну сессию с упражнениями, чтобы увидеть бюджет объёма.
                  </div>
              }
            </div>
          )}
          {isOpen && (
            <div style={{ marginTop: 4 }}>
              <div style={{ fontSize: 10, color: DIM, marginBottom: 4 }}>{boardMode ? '🗂 Доска — дни рядом, скролль вбок' : 'Шаг 2: тренировочные дни этой недели'}</div>
              <SessionList sessions={w.sessions} phase={w.phase} boardMode={boardMode} level={level} onChange={(sessions) => updateWeek(wi, { sessions })} />
            </div>
          )}
        </div>
        ); })}
      {/* P0-1: Ротация — упражнения старше 4 недель */}
      {body.weeks.length >= 4 && (() => {
        const exAge: Record<string, { weeks: number; muscle: string }> = {};
        for (const w of body.weeks) {
          for (const s of w.sessions) {
            for (const b of s.blocks) {
              if (!b.exerciseName) continue;
              const key = b.exerciseName;
              if (!exAge[key]) exAge[key] = { weeks: 0, muscle: b.muscle };
              exAge[key].weeks++;
            }
          }
        }
        const stale = Object.entries(exAge).filter(([, v]) => v.weeks >= 4).slice(0, 5);
        if (stale.length === 0) return null;
        return (
          <div style={{ ...CARD, padding: 10, borderLeft: '2px solid #f59e0b' }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#f59e0b', marginBottom: 6 }}>🔄 Ротация — упражнения старше 4 недель</div>
            {stale.map(([name, { weeks: age, muscle }]) => {
              const subs = findSubstitutions(name, muscle, new Set()).slice(0, 2);
              return (
                <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0', fontSize: 10, flexWrap: 'wrap' }}>
                  <span style={{ color: DIM_STRONG, fontWeight: 700 }}>{name}</span>
                  <span style={{ color: '#f59e0b', fontSize: 11 }}>{age} нед</span>
                  {subs.length > 0 ? subs.map((sub, si) => (
                    <button key={si}
                      onClick={() => {
                        const newWeeks = body.weeks.map(w => ({
                          ...w, sessions: w.sessions.map(s => ({
                            ...s, blocks: s.blocks.map(b => b.exerciseName === name ? { ...b, exerciseName: sub.exercise.name, muscle: sub.exercise.group || b.muscle } : b)
                          }))
                        }));
                        setWeeks(newWeeks);
                      }}
                      title={sub.reason + ' · confidence: ' + sub.confidence}
                      style={{ padding: '3px 8px', borderRadius: 6, fontSize: 10, cursor: 'pointer', background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.25)', color: '#f59e0b', fontWeight: 700, minHeight: 44 }}
                    >→ {sub.exercise.name}</button>
                  )) : <span style={{ color: DIM, fontSize: 11 }}>нет замен</span>}
                </div>
              );
            })}
          </div>
        );
      })()}
       <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8 }}>
          <button className="editor-add-week editor-action-card" style={{ ...CARD_ACTION, borderColor: 'rgba(96,165,250,0.30)', background: 'linear-gradient(180deg, rgba(96,165,250,0.10), rgba(255,255,255,0.02))' }} onClick={addWeek}>
            <span style={{ fontSize: 18, color: '#60a5fa' }}>＋</span>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1 }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: '#60a5fa' }}>Пустая неделя</span>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)' }}>accumulation · 1 клик</span>
            </div>
          </button>
          <button className="editor-action-card" style={{ ...CARD_ACTION, borderColor: 'rgba(0,230,138,0.28)', background: 'linear-gradient(180deg, rgba(0,230,138,0.10), rgba(255,255,255,0.02))' }} onClick={() => cloneWeek(body.weeks.length - 1)} disabled={body.weeks.length === 0}>
            <span style={{ fontSize: 18, color: '#00e68a' }}>⧉</span>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1 }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: '#00e68a' }}>Копия +2.5%</span>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)' }}>прогрессия веса · умно</span>
            </div>
          </button>
        </div>
        <MethodHint icon="📈" title="Прогрессия без калькулятора" text="Копия +2.5% — double progression: вес растёт каждую неделю, на 4-й — делод −30%. Так без плато, использует интеллектуальный движок." color="#60a5fa" />
    </div>
  );
};

const SessionList: React.FC<{ sessions: UserSession[]; phase?: UserWeek['phase']; boardMode?: boolean; level?: string; onChange: (s: UserSession[]) => void }> = ({ sessions, phase, boardMode, level: levelProp, onChange }) => {
  const { confirm } = useConfirmDialog();
  const [noteOpenIdx, setNoteOpenIdx] = useState<number | null>(null);
  const addSession = () => onChange([...sessions, { id: newId('ses'), name: 'День ' + (sessions.length + 1), dayOfWeek: firstFreeTrainingDay(sessions), focus: '', blocks: [] }]);
  // Быстрый день из шаблона — с готовыми упражнениями из каталога
  const addSessionFromTemplate = (tmpl: typeof DAY_TEMPLATES[0]) => {
    onChange([...sessions, {
      id: newId('ses'),
      name: tmpl.name,
      dayOfWeek: firstFreeTrainingDay(sessions),
      focus: tmpl.focus,
      blocks: tmpl.blocks.map(b => ({
        id: newId('blk'),
        type: b.type,
        exerciseName: b.exerciseName,
        muscle: b.muscle,
        role: b.type === 'compound' ? 'primary' : 'accessory',
        sets: b.sets.map(s => ({ ...s })),
      })),
    }]);
  };
  const updateSession = (si: number, patch: Partial<UserSession>) => onChange(sessions.map((s, i) => i === si ? { ...s, ...patch } : s));
  // U4/F4: confirm-диалог при удалении сессии — ConfirmDialog
  const removeSession = async (si: number) => {
    const s = sessions[si];
    const ok = await confirm({ title: `Удалить "${s.name}"?`, message: `Будет потеряно ${s.blocks.length} упражнений. Это нельзя отменить.`, confirmLabel: 'Удалить', danger: true });
    if (!ok) return;
    onChange(sessions.filter((_, i) => i !== si));
  };
  // U12: клонировать сессию
  const cloneSession = (si: number) => {
    const src = sessions[si];
    if (!src) return;
    onChange([
      ...sessions,
      {
        id: newId('ses'),
        name: src.name + ' (копия)',
        dayOfWeek: firstFreeTrainingDay(sessions),
        focus: src.focus,
        blocks: src.blocks.map(b => ({ ...b, id: newId('blk'), sets: b.sets.map(st => ({ ...st })) })),
        warmup: src.warmup,
        cooldown: src.cooldown,
      },
    ]);
  };
  const moveSession = (si: number, dir: -1 | 1) => {
    const j = si + dir;
    if (j < 0 || j >= sessions.length) return;
    const arr = [...sessions];
    const tmp = arr[si];
    arr[si] = arr[j];
    arr[j] = tmp;
    onChange(arr);
  };
  const moveBlockToSession = (fromSi: number, bi: number, toSi: number) => {
    if (fromSi === toSi || fromSi < 0 || toSi < 0 || fromSi >= sessions.length || toSi >= sessions.length) return;
    const fromBlocks = sessions[fromSi].blocks;
    const block = fromBlocks[bi];
    if (!block) return;
    const newFrom = fromBlocks.filter((_, i) => i !== bi);
    const toBlocks = [...sessions[toSi].blocks, { ...block, id: newId('blk') }];
    onChange(sessions.map((s, idx) => idx === fromSi ? { ...s, blocks: newFrom } : idx === toSi ? { ...s, blocks: toBlocks } : s));
  };

  return (
    <div style={{ display: 'flex', flexDirection: boardMode ? 'row' : 'column', gap: 6, overflowX: boardMode ? 'auto' : undefined, paddingBottom: boardMode ? 4 : undefined }}>
       {sessions.length === 0 && (
        <div style={{ padding: 14, borderRadius: 14, background: 'linear-gradient(180deg, rgba(26,28,38,0.72), rgba(18,20,30,0.52))', border: '1px dashed rgba(0,230,138,0.35)', display: 'flex', flexDirection: 'column', gap: 10, textAlign: 'center', minWidth: boardMode ? 260 : undefined }}>
          <div style={{ width: 36, height: 36, borderRadius: 18, background: 'rgba(0,230,138,0.12)', border: '1px solid rgba(0,230,138,0.18)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, margin: '0 auto' }}>🗓</div>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#fff' }}>Неделя пуста — 1 клик до старта</div>
          <div style={{ fontSize: 10, color: DIM, lineHeight: 1.5 }}>Выберите шаблон — интеллект уже учёл слабые группы и оборудование. Фиолетовые — приоритет +10%.</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8, width: '100%' }}>
            {(() => {
              let weak: string[] = [];
              try { weak = (loadTrainingProfile().weakPoints ?? []) as string[]; } catch {}
              const scored = DAY_TEMPLATES.map(t => {
                const muscles = t.blocks.map(b => b.muscle);
                const hit = muscles.filter(m => weak.includes(m)).length;
                return { t, hit };
              }).sort((a,b) => b.hit - a.hit);
              return scored.map(({t, hit}) => (
                <button key={t.label} onClick={() => addSessionFromTemplate(t)} className="editor-action-card" style={{ ...(hit>0 ? { ...CARD_BTN, border: '1px solid rgba(167,139,250,0.30)', background: 'linear-gradient(180deg, rgba(167,139,250,0.12), rgba(255,255,255,0.02))' } : CARD_BTN) }}>
                  <span style={{ fontSize: 16 }}>{t.icon}</span>
                  <span style={{ fontSize: 11, fontWeight: 800, color: hit>0 ? '#a78bfa' : '#fff', display: 'flex', alignItems: 'center', gap: 4 }}>{t.label}{hit>0 && <span style={{ fontSize: 9, fontWeight: 800, color: '#a78bfa', background: 'rgba(167,139,250,0.14)', border: '1px solid rgba(167,139,250,0.22)', borderRadius: 6, padding: '1px 5px' }}>слабое</span>}</span>
                  <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)' }}>{t.blocks.length} упр. · готово{hit>0 ? ' · рекомендовано' : ''}</span>
                </button>
              ));
            })()}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}><div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} /><span style={{ fontSize: 10, color: DIM }}>или</span><div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} /></div>
          <button style={{ ...BTN_GHOST, padding: '7px 14px', fontSize: 11, minHeight: 38, borderColor: 'rgba(255,255,255,0.10)', background: 'rgba(255,255,255,0.04)' }} onClick={addSession}>＋ Пустой день — настроить вручную</button>
        </div>
      )}
      {sessions.map((s, si) => {
        const dow = sessionDayOfWeek(s, si);
        const dc = DAY_COLORS[dow % 7] ?? '#f59e0b';
        return (
        <div key={s.id} className="editor-session-card" style={{ padding: 0, overflow: 'hidden', borderRadius: 12, background: 'linear-gradient(180deg, rgba(26,28,38,0.56), rgba(18,20,30,0.42))', border: '1px solid rgba(255,255,255,0.07)', borderLeft: `3px solid ${dc}`, boxShadow: '0 4px 16px rgba(0,0,0,0.18)', ...(boardMode ? { minWidth: 324, maxWidth: 364, flex: '0 0 324px' } : {}) }}>
          <div className="editor-session-heading" style={{ alignItems: 'center', padding: '10px 10px 8px', borderBottom: '1px solid rgba(255,255,255,0.05)', background: dc + '08' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
              <span style={{ width: 30, height: 30, borderRadius: 9, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 850, background: dc + '22', color: dc, border: '1px solid ' + dc + '55' }}>{TRAINING_DAY_NAMES[dow]}</span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="editor-kicker" style={{ fontSize: 9, letterSpacing: 0.35, color: dc, fontWeight: 800 }}>ДЕНЬ {si + 1} · {TRAINING_DAY_NAMES[dow]}</div>
                <div className="editor-session-day" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12, fontWeight: 700, color: '#fff' }}>{s.name || 'Без названия'} <span style={{ fontWeight: 400, color: 'rgba(255,255,255,0.45)' }}>· {s.blocks.length} упр.</span></div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 3, marginLeft: 8, flexShrink: 0, alignItems: 'center' }}>
              <button aria-label={`Вверх тренировка ${si + 1}`} disabled={si === 0} onClick={() => moveSession(si, -1)} title="Вверх" style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)', color: si===0 ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.70)', cursor: si===0 ? 'not-allowed' : 'pointer', fontSize: 10 }}>▲</button>
              <button aria-label={`Вниз тренировка ${si + 1}`} disabled={si === sessions.length - 1} onClick={() => moveSession(si, 1)} title="Вниз" style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)', color: si===sessions.length-1 ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.70)', cursor: si===sessions.length-1 ? 'not-allowed' : 'pointer', fontSize: 10 }}>▼</button>
              <button aria-label={`Заметка тренировки ${si + 1}`} style={{ width: 28, height: 28, borderRadius: 8, border: noteOpenIdx === si ? '1px solid rgba(0,230,138,0.35)' : '1px solid rgba(255,255,255,0.08)', background: noteOpenIdx === si ? 'rgba(0,230,138,0.14)' : 'rgba(255,255,255,0.04)', color: noteOpenIdx === si ? '#00e68a' : 'rgba(255,255,255,0.60)', cursor: 'pointer', fontSize: 11 }} onClick={() => setNoteOpenIdx(noteOpenIdx === si ? null : si)} title="Заметка">💬</button>
              <button aria-label={`Клонировать тренировку ${si + 1}`} style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.60)', cursor: 'pointer', fontSize: 11 }} onClick={() => cloneSession(si)} title="Клонировать">⧉</button>
              <button aria-label={`Удалить тренировку ${si + 1}`} style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid rgba(239,68,68,0.20)', background: 'rgba(239,68,68,0.08)', color: '#ef4444', cursor: 'pointer', fontSize: 11 }} onClick={() => removeSession(si)}>✕</button>
            </div>
          </div>
          <div style={{ padding: '10px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <input style={{ ...IN, padding: '7px 10px', fontSize: 11, flex: '1 1 120px', minHeight: 38, background: 'rgba(0,0,0,0.22)', borderColor: 'rgba(255,255,255,0.08)' }} value={s.name} onChange={e => updateSession(si, { name: e.target.value })} placeholder="Название дня (например: Грудь / Трицепс)" aria-label={`Название тренировки ${si + 1}`} />
            <DayOfWeekPicker value={dow} occupied={sessions.flatMap((other, oi) => oi === si ? [] : [sessionDayOfWeek(other, oi)])} onChange={d => updateSession(si, { dayOfWeek: normalizeProgramDayOfWeek(d, trainingDayForIndex(si)) })} ariaLabel={`День недели тренировки ${si + 1}`} />
            <input style={{ ...IN, padding: '7px 10px', fontSize: 11, flex: '1 1 120px', minHeight: 38, background: 'rgba(0,0,0,0.22)', borderColor: 'rgba(255,255,255,0.08)' }} value={s.focus} onChange={e => updateSession(si, { focus: e.target.value })} placeholder="Фокус: грудь / трицепс" aria-label={`Фокус тренировки ${si + 1}`} />
          </div>
          {noteOpenIdx === si && <textarea value={s.note ?? ''} onChange={e => updateSession(si, { note: e.target.value })} placeholder="Заметка к тренировке — попадёт в экспорт и PDF" rows={2} style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: `1px solid ${ACCENT_LINE}`, borderRadius: 8, padding: '8px 10px', color: '#fff', fontSize: 11, resize: 'vertical', minHeight: 44 }} />}
          {/* Живой баланс объёма сессии — MEV/MAV/MRV полоски, компакт */}
          {s.blocks.length > 0 && (() => {
            const effLevel = levelProp || (() => { try { return loadTrainingProfile().level; } catch { return 'intermediate'; } })();
            const byMuscle: Record<string, number> = {};
            for (const b of s.blocks) { const mu = (b.muscle || '').toLowerCase(); if (!mu) continue; byMuscle[mu] = (byMuscle[mu] || 0) + (b.sets?.length || 0); }
            const entries = Object.entries(byMuscle).slice(0, 3);
            if (entries.length === 0) return null;
            return <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '6px 8px', borderRadius: 8, background: 'rgba(0,0,0,0.18)', border: '1px solid rgba(255,255,255,0.05)' }}>{entries.map(([mu, cur]) => { const lm = getVolumeLandmarks(effLevel, mu); if (!lm) return null; return <VolumeMiniBar key={mu} cur={cur} mrv={lm.mrv} mev={lm.mev} label={GROUP_RU[mu] ?? mu} compact />; })}</div>;
          })()}
          <BlockList blocks={s.blocks} phase={phase} sessionFocus={s.focus} sessionName={s.name} otherSessions={sessions.map((os, oi) => ({ idx: oi, name: os.name || `День ${oi + 1}` })).filter((_, oi) => oi !== si)} onMoveBlock={(bi, targetSi) => moveBlockToSession(si, bi, targetSi)} onChange={(blocks) => updateSession(si, { blocks })} />
          </div>
        </div>
        );
       })}
       <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 6 }}>
         <button className="editor-add-session editor-action-card" style={{ ...CARD_ACTION, width: '100%', borderColor: 'rgba(0,230,138,0.25)', background: 'linear-gradient(180deg, rgba(0,230,138,0.10), rgba(255,255,255,0.02))' }} onClick={addSession}>
           <span style={{ fontSize: 18 }}>＋</span>
           <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1 }}>
             <span style={{ fontSize: 12, fontWeight: 800, color: '#00e68a' }}>Добавить тренировочный день</span>
             <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)' }}>пустой день — назначьте Пн–Вс и фокус</span>
           </div>
         </button>
         <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
           <span style={{ fontSize: 10, color: DIM, fontWeight: 700 }}>или шаблоном:</span>
           <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>1 клик — готовый день</span>
         </div>
         <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(148px, 1fr))', gap: 8 }}>
           {DAY_TEMPLATES.map(t => (
             <button key={t.label} onClick={() => addSessionFromTemplate(t)} title={`Добавить день «${t.name}» с упражнениями из каталога`}
               className="editor-action-card" style={CARD_BTN}>
               <span style={{ fontSize: 16 }}>{t.icon}</span>
               <span style={{ fontSize: 11, fontWeight: 800, color: '#fff' }}>{t.label}</span>
               <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)' }}>{t.blocks.length} упр. · готово</span>
             </button>
           ))}
         </div>
       </div>
    </div>
  );
};

const BlockList: React.FC<{ blocks: UserBlock[]; phase?: UserWeek['phase']; sessionFocus?: string; sessionName?: string; otherSessions?: Array<{ idx: number; name: string }>; onMoveBlock?: (bi: number, targetSi: number) => void; onChange: (b: UserBlock[]) => void }> = ({ blocks, phase, sessionFocus, sessionName, otherSessions, onMoveBlock, onChange }) => {
  const { confirm } = useConfirmDialog();
  const inferMuscleFromSession = (focus?: string, name?: string): string => {
    const txt = (focus || name || '').toLowerCase();
    if (txt.includes('грудь') || txt.includes('груд')) return 'chest';
    if (txt.includes('спин')) return 'back';
    if (txt.includes('ног') || txt.includes('бедр') || txt.includes('квадр')) return 'legs';
    if (txt.includes('плеч') || txt.includes('дельт')) return 'shoulders';
    if (txt.includes('рук') || txt.includes('биц') || txt.includes('триц')) return 'arms';
    if (txt.includes('кор') || txt.includes('пресс')) return 'core';
    return '';
  };
  const addBlock = () => {
    const inferred = inferMuscleFromSession(sessionFocus, sessionName);
    if (inferred) {
      try {
        const prof = loadTrainingProfile();
        const tmpl = muscleAwareSets(inferred, prof.level || 'intermediate');
        const w = (prof.workMax ?? {} as any)[inferred] ?? 40;
        const sets = makeSetsFromTemplate(tmpl as any, w);
        onChange([...blocks, { id: newId('blk'), type: 'accessory', exerciseName: '', muscle: inferred, role: 'accessory', sets: sets.length ? sets : [{ reps: 10, rir: 2, weight: w, restSec: 90 } as any] }]);
        return;
      } catch {}
    }
    onChange([...blocks, { id: newId('blk'), type: 'accessory', exerciseName: '', muscle: '', role: 'accessory', sets: [{ reps: 10, rir: 2 }] }]);
  };
  const updateBlock = (bi: number, patch: Partial<UserBlock>) => onChange(blocks.map((b, i) => i === bi ? { ...b, ...patch } : b));
  // P0-3: быстрый старт — группа мышц → упражнения из движка подбора + поиск
  const [quickGroup, setQuickGroup] = useState<string | null>(null);
  const [quickSearch, setQuickSearch] = useState('');
  const quickExercises = useMemo(() => {
    if (!quickGroup) return [] as Array<{ id: string; name: string; group?: string; type?: string; equipment?: string; isFavorite?: boolean; isWeak?: boolean }>;
    try {
      const prof = loadTrainingProfile();
      const favSet = new Set(prof.favoriteExercises ?? []);
      const weakSet = new Set(prof.weakPoints ?? []);
      const list = suggestExercisesForGroup(
        quickGroup,
        prof.level || 'intermediate',
        12,
        prof.equipment ?? [],
        prof.weakPoints ?? [],
        (prof.injuries ?? []).filter(i => i.exclude).map(i => i.muscle),
        prof.avoidAxialLoad ?? false,
        prof.favoriteExercises ?? [],
        prof.excludedExercises ?? [],
      ).map(ex => {
        const cat = (EXERCISE_CATALOG as unknown as Array<{ id: string; name: string; equipment?: string; type?: string; group?: string }>).find(c => c.id === ex.id || c.name === ex.name);
        return { id: ex.id, name: ex.name, group: ex.group || cat?.group, type: ex.type || cat?.type, equipment: (cat as any)?.equipment || '—', isFavorite: favSet.has(ex.id), isWeak: weakSet.has(ex.group || cat?.group || quickGroup) };
      });
      // Сортировка: избранное → слабые → остальные, уже отсортировано движком, но усиливаем
      const sorted = [...list].sort((a,b) => (Number(b.isFavorite) - Number(a.isFavorite)) || (Number(b.isWeak) - Number(a.isWeak)));
      if (!quickSearch.trim()) return sorted.slice(0, 6);
      const q = quickSearch.toLowerCase().trim();
      return sorted.filter(e => e.name.toLowerCase().includes(q)).slice(0, 6);
    } catch {
      return [];
    }
  }, [quickGroup, quickSearch]);
  const addQuickBlock = (ex: { name: string; group?: string; type?: string }) => {
    const prof = (() => { try { return loadTrainingProfile(); } catch { return { level: 'intermediate', workMax: {} } as any; } })();
    const muscle = ex.group || quickGroup || '';
    const tmpl = muscleAwareSets(muscle, prof.level || 'intermediate');
    const w = (prof.workMax ?? {})[muscle] ?? (prof.workMax ?? {})[muscle.toLowerCase()] ?? 40;
    const sets = makeSetsFromTemplate(tmpl as any, w);
    onChange([...blocks, {
      id: newId('blk'),
      type: ex.type === 'compound' ? 'compound' : 'accessory',
      exerciseName: ex.name,
      muscle,
      role: ex.type === 'compound' ? 'primary' : 'accessory',
      sets: sets.length ? sets : [{ reps: 10, rir: 2 }],
    }]);
  };
  // F2.2: clipboard для копирования блоков между сессиями/неделями.
  // P2-4: sessionStorage instead of localStorage — clipboard clears on tab close, not persisted across sessions.
  const COPY_KEY = 'he_bb_block_clipboard';
  const copyBlock = (bi: number) => {
    try { sessionStorage.setItem(COPY_KEY, JSON.stringify(blocks[bi])); } catch {}
  };
  const pasteBlock = () => {
    try {
      const raw = sessionStorage.getItem(COPY_KEY);
      if (!raw) return;
       const src: unknown = JSON.parse(raw);
       if (!isUserBlockClipboardShape(src)) return;
       const newBlock: UserBlock = {
         ...src,
         id: newId('blk'),
         sets: src.sets.map(set => ({ ...set })),
       };
      onChange([...blocks, newBlock]);
    } catch {}
  };
  // U4/F4: confirm-диалог при удалении блока — ConfirmDialog
  const removeBlock = async (bi: number) => {
    const b = blocks[bi];
    const ok = await confirm({ title: `Удалить "${b.exerciseName || 'упражнение'}"?`, message: `Будет потеряно ${b.sets.length} сетов. Это нельзя отменить.`, confirmLabel: 'Удалить', danger: true });
    if (!ok) return;
    onChange(blocks.filter((_, i) => i !== bi));
  };
  // U12: клонировать блок
  const cloneBlock = (bi: number) => {
    const src = blocks[bi];
    if (!src) return;
    onChange([
      ...blocks,
      { ...src, id: newId('blk'), sets: src.sets.map(s => ({ ...s })) },
    ]);
  };
  // U11: назначить/снять superset-партнёра (следующий/предыдущий блок)
  const linkSuperset = (bi: number) => {
    const current = blocks[bi];
    if (!current) return;
    // Ищем ближайший блок вверх/вниз, у которого ещё нет supersetWith или текущий — не его партнёр
    const partnerIdx = bi > 0 ? bi - 1 : bi + 1;
    if (partnerIdx < 0 || partnerIdx >= blocks.length) return;
    const partner = blocks[partnerIdx];
    onChange(blocks.map((b, i) => {
      if (i === bi) return { ...b, supersetWith: partner.id };
      if (i === partnerIdx) return { ...b, supersetWith: current.id };
      return b;
    }));
  };
  const unlinkSuperset = (bi: number) => {
    onChange(blocks.map((b, i) => {
      if (i === bi) return { ...b, supersetWith: undefined };
      if (b.supersetWith === blocks[bi]?.id) return { ...b, supersetWith: undefined };
      return b;
    }));
  };
  // 🔄 Замена упражнения: findSubstitutions подбирает альтернативы
  const [substFor, setSubstFor] = useState<number | null>(null);
  const [expandedBlock, setExpandedBlock] = useState<number | null>(null);
  const [movePicker, setMovePicker] = useState<number | null>(null);
  const substResults = useMemo(() => {
    if (substFor == null) return [];
    const b = blocks[substFor];
    if (!b || !b.exerciseName) return [];
    const prof = loadTrainingProfile();
    const injured = new Set((prof.injuries ?? []).filter((i) => i.exclude).map((i) => i.muscle));
    return findSubstitutions(b.exerciseName, b.muscle, injured).slice(0, 4);
  }, [substFor, blocks]);
  const applySubst = (bi: number, name: string, muscle: string) => {
    updateBlock(bi, { exerciseName: name, muscle: muscle || blocks[bi].muscle });
    setSubstFor(null);
  };
  const moveBlock = (bi: number, dir: -1 | 1) => { const j = bi + dir; if (j < 0 || j >= blocks.length) return; const arr = [...blocks]; const tmp = arr[bi]; arr[bi] = arr[j]; arr[j] = tmp; onChange(arr); };
  const moveTo = (from: number, to: number) => {
    if (from === to || from < 0 || from >= blocks.length || to < 0 || to >= blocks.length) return;
    const arr = [...blocks];
    const [moved] = arr.splice(from, 1);
    arr.splice(to, 0, moved);
    onChange(arr);
  };

  // Keyboard: Ctrl+C/V — копировать/вставить блок, Delete — удалить раскрытый, Enter — свернуть/развернуть
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      if (expandedBlock == null) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        copyBlock(expandedBlock);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        pasteBlock();
      } else if (e.key === 'Delete') {
        e.preventDefault();
        removeBlock(expandedBlock);
      } else if (e.key === 'Enter' && expandedBlock != null) {
        // Enter на раскрытом — ничего, уже раскрыт; на закрытом — раскрыть (обрабатывается в другом месте)
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [expandedBlock, blocks]);

  // HTML5 drag-and-drop: desktop работает «из коробки», мобильный (iOS 13+/Chrome) — через draggable.
  // Touch fallback (long-press → перетаскивание через touch events) для старых мобильных WebView.
  const dragSrcRef = React.useRef<number | null>(null);
  const touchSrcRef = React.useRef<number | null>(null);
  const touchArmedRef = React.useRef<number | null>(null);
  const longPressTimer = React.useRef<number | null>(null);
  const touchStartPosRef = React.useRef<{ x: number; y: number } | null>(null);
  const rowRefs = React.useRef<(HTMLDivElement | null)[]>([]);
  const [overIdx, setOverIdx] = useState<number | null>(null);

  const onTouchStart = (bi: number) => (e: React.TouchEvent) => {
    touchSrcRef.current = bi;
    const t = e.touches[0];
    touchStartPosRef.current = { x: t.clientX, y: t.clientY };
    if (longPressTimer.current) window.clearTimeout(longPressTimer.current);
    longPressTimer.current = window.setTimeout(() => {
      touchArmedRef.current = bi;
      setOverIdx(bi);
      try { navigator.vibrate?.(15); } catch { /* ignore */ }
    }, 350);
  };
  const onTouchMove = (e: React.TouchEvent) => {
    // P2-2: cancel long-press if user scrolled >10px (vertical or horizontal) — distinguishes scroll from drag
    if (touchArmedRef.current == null && touchStartPosRef.current) {
      const t = e.touches[0];
      const dx = Math.abs(t.clientX - touchStartPosRef.current.x);
      const dy = Math.abs(t.clientY - touchStartPosRef.current.y);
      if (dx > UI_METRICS.touchMoveCancelPx || dy > UI_METRICS.touchMoveCancelPx) {
        if (longPressTimer.current) { window.clearTimeout(longPressTimer.current); longPressTimer.current = null; }
        touchSrcRef.current = null;
        touchStartPosRef.current = null;
      }
      return;
    }
    if (touchArmedRef.current == null) return;
    e.preventDefault();
    const t = e.touches[0];
    const y = t.clientY;
    let nearest = touchArmedRef.current;
    let nearestDist = Infinity;
    rowRefs.current.forEach((el, i) => {
      if (!el) return;
      const r = el.getBoundingClientRect();
      const mid = r.top + r.height / 2;
      const d = Math.abs(mid - y);
      if (d < nearestDist) { nearestDist = d; nearest = i; }
    });
    setOverIdx(nearest);
  };
  const onTouchEnd = () => {
    if (longPressTimer.current) { window.clearTimeout(longPressTimer.current); longPressTimer.current = null; }
    if (touchArmedRef.current != null && overIdx != null) {
      moveTo(touchArmedRef.current, overIdx);
    }
    touchSrcRef.current = null;
    touchArmedRef.current = null;
    touchStartPosRef.current = null;
    setOverIdx(null);
  };
  const onTouchCancel = () => {
    if (longPressTimer.current) { window.clearTimeout(longPressTimer.current); longPressTimer.current = null; }
    touchSrcRef.current = null;
    touchArmedRef.current = null;
    touchStartPosRef.current = null;
    setOverIdx(null);
  };

  return (
    <div className="bb-block-list" style={{ display: 'flex', flexDirection: 'column', gap: 8 }} onTouchEnd={onTouchEnd} onTouchCancel={onTouchCancel}>
      <style>{`/* FIX vertical text: override aggressive global word-break for exercise cards */
      .manual-constructor--editor .bb-block-list { gap: 8px !important; }
      .manual-constructor--editor .editor-exercise-card,
      .manual-constructor--editor .editor-exercise-title,
      .manual-constructor--editor .bb-block-row button { word-break: normal !important; overflow-wrap: anywhere !important; white-space: normal !important; }
      .manual-constructor--editor .editor-exercise-title { white-space: nowrap !important; overflow: hidden !important; text-overflow: ellipsis !important; overflow-wrap: normal !important; word-break: normal !important; }
      @media (max-width: 480px) {
        .manual-constructor--editor .editor-exercise-title { white-space: normal !important; overflow: visible !important; text-overflow: clip !important; word-break: normal !important; overflow-wrap: anywhere !important; }
        .manual-constructor--editor .bb-block-list .bb-block-row { word-break: normal !important; }
      }
      .bb-block-list .editor-card-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(128px, 1fr)); gap: 8px; }
      @media (max-width: 380px) { .bb-block-list .editor-card-grid { grid-template-columns: repeat(2, 1fr); } }
      @media (max-width: 640px) {
        .bb-block-list > div { overflow: hidden; }
        .bb-block-list input, .bb-block-list select { max-width: 100%; }
        .bb-block-list .bb-set-editor { width: 100%; overflow-x: auto; -webkit-overflow-scrolling: touch; }
        .bb-block-list .bb-set-editor > div > div { flex-wrap: wrap; gap: 6px !important; }
        .bb-block-row { padding: 10px 0 !important; }
        .bb-block-row > div:first-of-type { width: 100%; }
        .bb-block-expand { display: inline-flex; }
        .bb-block-row:not(.is-expanded) .bb-set-editor { display: none; }
        .bb-block-row:not(.is-expanded) > div:not(:first-of-type) { display: none; }
        .editor-exercise-card { border-radius: 12px !important; }
      }
      @media (max-width: 380px) {
        .bb-set-editor input[type="number"] { width: 38px !important; }
        .editor-exercise-card .editor-exercise-heading { flex-direction: column; align-items: flex-start !important; gap: 4px !important; }
      }
      .bb-block-expand {
        display: none;
        margin-left: auto; padding: 5px 8px; border-radius: 6px;
        border: 1px solid var(--accent-line, rgba(0,230,138,0.45));
        background: transparent; color: var(--accent, #00e68a);
        font-size: 10px; cursor: pointer; min-height: 30px;
      }
      .editor-action-card { transition: transform 0.12s ease, border-color 0.12s ease, box-shadow 0.12s ease; }
      @media (hover: hover) { .editor-action-card:hover { transform: translateY(-2px); border-color: rgba(0,230,138,0.35) !important; box-shadow: 0 4px 14px rgba(0,0,0,0.22); } }
      `}</style>
      {blocks.length === 0 && (
        <div className="editor-empty-exercises" style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.08)', borderRadius: 12, padding: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ width: 24, height: 24, borderRadius: 12, background: '#00e68a', color: '#06281c', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 900 }}>1</span><span className="editor-empty-exercises__title" style={{ fontSize: 12, fontWeight: 800, color: '#fff' }}>Шаг 1 — выберите группу мышц</span><span style={{ marginLeft: 'auto', fontSize: 10, color: 'rgba(255,255,255,0.45)', background: 'rgba(255,255,255,0.05)', borderRadius: 6, padding: '2px 6px' }}>1 клик</span></div>
          <div className="editor-empty-exercises__text" style={{ fontSize: 10, color: 'rgba(255,255,255,0.60)', lineHeight: 1.5, marginTop: 6 }}>Выберите карточку — покажем 6 упражнений под ваш зал, уровень и травмы. <span style={{ color: '#a78bfa', fontWeight: 700 }}>Фиолетовые — слабые (+10%).</span> Далее: <span style={{ color: '#fff', fontWeight: 700 }}>Шаг 2</span> — выберите упражнение, <span style={{ color: '#fff', fontWeight: 700 }}>Шаг 3</span> — настройте подходы. Или «⚡ Заполнить пустые» — весь день за 1 клик.</div>
          <div className="editor-card-grid">
            {(() => {
              let weak: string[] = [];
              try { weak = (loadTrainingProfile().weakPoints ?? []) as string[]; } catch {}
              const entries = Object.entries(GROUP_RU).sort((a,b) => {
                const aw = weak.includes(a[0]) ? 0 : 1;
                const bw = weak.includes(b[0]) ? 0 : 1;
                return aw - bw;
              });
              return entries.map(([key, label]) => {
              const active = quickGroup === key;
              const isWeak = weak.includes(key);
              const iconMap: Record<string, string> = { chest: '💪', back: '🦍', legs: '🦵', shoulders: '🏋️', arms: '💥', core: '🧱', quads: '🦵', hamstrings: '🦵', glutes: '🍑', calves: '🦶', biceps: '💪', triceps: '💪', abs: '🧱', traps: '🏔️', forearms: '🤝' };
              const hintMap: Record<string, string> = { chest: 'жим + разведения', back: 'тяги верт./гориз.', legs: 'присед + тяга', shoulders: 'жимы + махи', arms: 'бицепс/трицепс', core: 'планки/скручивания' };
              return (
              <button
                key={key}
                onClick={() => { const nxt = quickGroup === key ? null : key; setQuickGroup(nxt); setQuickSearch(''); }}
                aria-label={`Быстрое добавление: ${label}`}
                aria-pressed={active}
                className="editor-action-card"
                style={active ? CARD_BTN_ACTIVE : isWeak ? { ...CARD_BTN, border: '1px solid rgba(167,139,250,0.30)', background: 'linear-gradient(180deg, rgba(167,139,250,0.12), rgba(255,255,255,0.02))' } : CARD_BTN}
              >
                <span style={{ fontSize: 16 }}>{iconMap[key] ?? '🎯'}</span>
                <span style={{ fontSize: 12, fontWeight: 800, color: active ? '#00e68a' : isWeak ? '#a78bfa' : '#fff', display: 'flex', alignItems: 'center', gap: 4 }}>{label}{isWeak && <span style={{ fontSize: 9, fontWeight: 800, color: '#a78bfa', background: 'rgba(167,139,250,0.14)', border: '1px solid rgba(167,139,250,0.22)', borderRadius: 6, padding: '1px 5px' }}>слабое</span>}</span>
                <span style={{ fontSize: 10, color: active ? 'rgba(0,230,138,0.85)' : 'rgba(255,255,255,0.55)', lineHeight: 1.2 }}>{hintMap[key] ?? 'изоляция + база'}</span>
              </button>
            ); });
            })()}
          </div>
          {quickGroup && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6, padding: 8, borderRadius: 10, background: 'rgba(0,230,138,0.06)', border: '1px solid rgba(0,230,138,0.15)', alignItems: 'stretch' }}>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: '#00e68a' }}>{GROUP_RU[quickGroup] ?? quickGroup}</span>
                {(() => { try { const p=loadTrainingProfile(); return <span style={{ fontSize: 10, color: DIM }}>{(p.equipment?.length ?? 0)>0 ? `· зал: ${(p.equipment as string[]).slice(0,3).join(', ')}` : '· зал: весь'} · {(p.weakPoints?.length ?? 0)>0 ? `слабые: ${(p.weakPoints as string[]).slice(0,2).map((w:string)=>GROUP_RU[w]??w).join(', ')}` : 'слабых нет'}</span>; } catch { return null; }})()}
                <input value={quickSearch} onChange={e => setQuickSearch(e.target.value)} placeholder="🔍 Фильтр по названию…" style={{ flex: 1, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '6px 8px', color: '#fff', fontSize: 11, minHeight: 32 }} />
                <button onClick={() => { setQuickGroup(null); setQuickSearch(''); }} style={{ padding: '4px 8px', borderRadius: 6, fontSize: 10, border: 'none', background: 'rgba(255,255,255,0.06)', color: DIM, cursor: 'pointer' }}>✕</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 6 }}>
                {quickExercises.length === 0 && <span style={{ gridColumn: '1/-1', fontSize: 10, color: DIM, textAlign: 'center', padding: 6 }}>Не нашлось — попробуйте другой фильтр или добавьте вручную через каталог</span>}
                {quickExercises.map(ex => (
                  <button
                    key={ex.id}
                    onClick={() => addQuickBlock(ex)}
                    title={`Добавить «${ex.name}» · ${ex.type ?? ''} · ${ex.equipment ?? ''}${ex.isFavorite ? ' · ★ избранное' : ''}${ex.isWeak ? ' · слабая группа' : ''}`}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2, padding: '8px 10px', borderRadius: 8, cursor: 'pointer', minHeight: 56, textAlign: 'left', background: ex.isFavorite ? 'rgba(245,158,11,0.10)' : ex.isWeak ? 'rgba(167,139,250,0.08)' : 'rgba(59,130,246,0.08)', border: ex.isFavorite ? '1px solid rgba(245,158,11,0.28)' : ex.isWeak ? '1px solid rgba(167,139,250,0.22)' : '1px solid rgba(59,130,246,0.25)', color: '#fff' }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: ex.isFavorite ? '#f59e0b' : ex.isWeak ? '#a78bfa' : '#60a5fa', display: 'flex', alignItems: 'center', gap: 4 }}>+ {ex.name} {ex.isFavorite && <span style={{ fontSize: 9, background: 'rgba(245,158,11,0.18)', border: '1px solid rgba(245,158,11,0.28)', borderRadius: 6, padding: '1px 4px' }}>★</span>}{ex.isWeak && <span style={{ fontSize: 9, background: 'rgba(167,139,250,0.14)', border: '1px solid rgba(167,139,250,0.20)', borderRadius: 6, padding: '1px 4px', color: '#a78bfa' }}>слабая</span>}</span>
                    <span style={{ fontSize: 10, color: DIM }}>{ex.type === 'compound' ? '🏋️ База' : ex.type === 'isolation' ? '🎯 Изоляция' : '🔧 Доп.'} · {typeof ex.equipment === 'string' ? ex.equipment : Array.isArray(ex.equipment) ? (ex.equipment as string[]).join('/') : '—'}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      {blocks.length > 0 && (
        <>
          <div className="editor-exercise-list-heading"><span>УПРАЖНЕНИЯ</span><span>{blocks.length} шт.</span></div>
          {/* Быстрое добавление — карточки групп вместо мелких чипов */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '6px 0', borderBottom: '1px dashed rgba(255,255,255,0.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 10, color: DIM, fontWeight: 700 }}>+ Быстро по группе:</span>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>нажмите карточку — покажем упражнения</span>
            </div>
            <div className="editor-card-grid">
              {(() => {
                let weak: string[] = [];
                try { weak = (loadTrainingProfile().weakPoints ?? []) as string[]; } catch {}
                const entries = Object.entries(GROUP_RU).sort((a,b) => (weak.includes(a[0])?0:1) - (weak.includes(b[0])?0:1));
                return entries.map(([key, label]) => {
                const active = quickGroup === key;
                const isWeak = weak.includes(key);
                const iconMap: Record<string, string> = { chest: '💪', back: '🦍', legs: '🦵', shoulders: '🏋️', arms: '💥', core: '🧱', quads: '🦵', hamstrings: '🦵', glutes: '🍑', calves: '🦶', biceps: '💪', triceps: '💪', abs: '🧱', traps: '🏔️', forearms: '🤝' };
                return (
                <button
                  key={key}
                  onClick={() => { const nxt = quickGroup === key ? null : key; setQuickGroup(nxt); setQuickSearch(''); }}
                  aria-label={`Быстрое добавление: ${label}`}
                  aria-pressed={active}
                  title={`Показать упражнения для ${label}${isWeak ? ' · слабая группа — приоритет +10% объёма' : ''}`}
                  className="editor-action-card"
                  style={active ? { ...CARD_BTN_ACTIVE, minHeight: 48, padding: '8px 10px', flexDirection: 'row', gap: 8 } : isWeak ? { ...CARD_BTN, minHeight: 48, padding: '8px 10px', flexDirection: 'row', gap: 8, border: '1px solid rgba(167,139,250,0.28)', background: 'linear-gradient(180deg, rgba(167,139,250,0.10), rgba(255,255,255,0.02))' } : { ...CARD_BTN, minHeight: 48, padding: '8px 10px', flexDirection: 'row', gap: 8 }}>
                  <span style={{ fontSize: 14, flexShrink: 0 }}>{iconMap[key] ?? '🎯'}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: active ? '#00e68a' : isWeak ? '#a78bfa' : '#fff', whiteSpace: 'normal', overflowWrap: 'anywhere' }}>{label}{isWeak ? ' · ★' : ''}</span>
                </button>
              ); }); })()}
            </div>
          </div>
          {quickGroup && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '6px 8px', borderRadius: 10, background: 'rgba(0,230,138,0.06)', border: '1px solid rgba(0,230,138,0.15)' }}>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: '#00e68a' }}>{GROUP_RU[quickGroup] ?? quickGroup}</span>
                <input value={quickSearch} onChange={e => setQuickSearch(e.target.value)} placeholder="🔍 Фильтр…" style={{ flex: 1, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '5px 8px', color: '#fff', fontSize: 10, minHeight: 30 }} />
                <button onClick={() => { setQuickGroup(null); setQuickSearch(''); }} style={{ padding: '4px 8px', borderRadius: 6, fontSize: 10, border: 'none', background: 'rgba(255,255,255,0.06)', color: DIM, cursor: 'pointer' }}>✕</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 6 }}>
                {quickExercises.length === 0 && <span style={{ gridColumn: '1/-1', fontSize: 10, color: DIM, textAlign: 'center', padding: 4 }}>нет — попробуйте другой фильтр</span>}
                {quickExercises.map(ex => (
                  <button
                    key={ex.id}
                    onClick={() => addQuickBlock(ex)}
                    title={`Добавить «${ex.name}» · ${ex.type ?? ''} · ${ex.equipment ?? ''}`}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2, padding: '6px 8px', borderRadius: 8, cursor: 'pointer', textAlign: 'left', background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.22)', color: '#fff' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#60a5fa' }}>+ {ex.name}</span>
                    <span style={{ fontSize: 10, color: DIM }}>{ex.type === 'compound' ? '🏋️ База' : ex.type === 'isolation' ? '🎯 Изоляция' : '🔧 Доп.'} · {typeof ex.equipment === 'string' ? ex.equipment : Array.isArray(ex.equipment) ? (ex.equipment as string[]).join('/') : '—'}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}
      {blocks.map((b, bi) => (
        <div
          key={b.id}
          ref={el => { rowRefs.current[bi] = el; }}
          draggable
          onDragStart={e => { dragSrcRef.current = bi; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(bi)); setOverIdx(bi); }}
          onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (overIdx !== bi) setOverIdx(bi); }}
          onDragLeave={() => { if (overIdx === bi) setOverIdx(null); }}
          onDrop={e => {
            e.preventDefault();
            const src = dragSrcRef.current;
            dragSrcRef.current = null;
            setOverIdx(null);
            if (src != null) moveTo(src, bi);
          }}
          onDragEnd={() => { dragSrcRef.current = null; setOverIdx(null); }}
          onTouchStart={onTouchStart(bi)}
          onTouchMove={onTouchMove}
           className={`bb-block-row editor-exercise-card${expandedBlock === bi ? ' is-expanded' : ''}${!b.exerciseName ? ' is-empty' : ''}${b.supersetWith ? ' is-superset' : ''}`}
           style={{
            display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 10px',
            borderTop: overIdx === bi ? '2px solid #00e68a' : (!b.exerciseName ? '2px solid rgba(245,158,11,0.35)' : b.supersetWith ? '2px solid rgba(167,139,250,0.35)' : '2px solid transparent'),
            borderLeft: !b.exerciseName ? '2px solid rgba(245,158,11,0.25)' : b.supersetWith ? '3px solid #a78bfa' : '2px solid transparent',
            transition: 'border-color 0.1s',
            background: !b.exerciseName ? 'rgba(245,158,11,0.04)' : b.supersetWith ? 'rgba(167,139,250,0.06)' : touchArmedRef.current === bi ? 'rgba(0,230,138,0.06)' : 'transparent',
            borderRadius: 8,
          }}
        >
          <div className="editor-exercise-heading">
            <div>
              <div className="editor-kicker">УПРАЖНЕНИЕ {bi + 1}</div>
              <div className="editor-exercise-title">{b.exerciseName || 'Упражнение не выбрано'}</div>
            </div>
            <div className={`editor-exercise-status${b.exerciseName && b.sets.length > 0 ? ' is-ready' : ''}`}>
              {b.exerciseName && b.sets.length > 0 ? `${b.sets.length} подход${b.sets.length === 1 ? '' : 'а'}` : 'Нужно заполнить'}
            </div>
          </div>
          {b.supersetWith && (
            <div style={{ fontSize:10, color:'#a78bfa', background:'rgba(167,139,250,0.10)', border:'1px solid rgba(167,139,250,0.22)', borderRadius:6, padding:'2px 6px', display:'inline-flex', gap:4, alignItems:'center', alignSelf:'flex-start' }}>
              <span>⊕ Суперсет</span><span style={{ color:'rgba(255,255,255,0.65)' }}>с {blocks.find(bl=>bl.id===b.supersetWith)?.exerciseName || '—'}</span><span style={{ fontSize:9, color:'rgba(255,255,255,0.45)' }}>без отдыха</span>
            </div>
          )}
          {/* Ряд 1: drag + тип + упражнение + мышца + сеты */}
          <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
          <span
            title={`Перетащите для изменения порядка — ${bi+1} из ${blocks.length}. Стрелки ↑↓ — переместить, Home/End — в начало/конец.`}
            style={{ cursor: 'grab', fontSize: 13, color: '#64748b', userSelect: 'none', padding: '4px 6px', touchAction: 'none', minWidth: 44, minHeight: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', outline: 'none' }}
            role="button" tabIndex={0} aria-label={`Перетащить упражнение ${bi+1} из ${blocks.length}: ${b.exerciseName || 'без названия'}`} aria-grabbed={overIdx===bi ? 'true' : 'false'} aria-describedby={`block-pos-${bi}`}
            onKeyDown={event => {
              if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
                event.preventDefault();
                moveBlock(bi, event.key === 'ArrowUp' ? -1 : 1);
              } else if (event.key === 'Home') { event.preventDefault(); if (bi!==0) moveTo(bi,0); }
              else if (event.key === 'End') { event.preventDefault(); if (bi!==blocks.length-1) moveTo(bi,blocks.length-1); }
            }}
            onFocus={(e)=>{ (e.target as HTMLElement).style.outline='2px solid #00e68a'; (e.target as HTMLElement).style.outlineOffset='2px'; }}
            onBlur={(e)=>{ (e.target as HTMLElement).style.outline='none'; }}
          >☰<span id={`block-pos-${bi}`} style={{ position:'absolute', width:1, height:1, overflow:'hidden', clip:'rect(0,0,0,0)' }}>{bi+1} из {blocks.length}</span></span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginLeft: 2 }}>
            <button onClick={() => moveBlock(bi, -1)} disabled={bi === 0} aria-label={`Переместить упражнение ${bi + 1} выше`} title="Вверх" style={{ ...BTN_GHOST, minWidth: 28, minHeight: 22, padding: '2px 4px', fontSize: 9, lineHeight: 1, opacity: bi === 0 ? 0.35 : 1, borderColor: 'rgba(255,255,255,0.12)' }}>▲</button>
            <button onClick={() => moveBlock(bi, 1)} disabled={bi === blocks.length - 1} aria-label={`Переместить упражнение ${bi + 1} ниже`} title="Вниз" style={{ ...BTN_GHOST, minWidth: 28, minHeight: 22, padding: '2px 4px', fontSize: 9, lineHeight: 1, opacity: bi === blocks.length - 1 ? 0.35 : 1, borderColor: 'rgba(255,255,255,0.12)' }}>▼</button>
          </div>
          {otherSessions && otherSessions.length > 0 && onMoveBlock && (
            <button onClick={() => setMovePicker(movePicker === bi ? null : bi)} title="Переместить в другой день" aria-label={`Переместить упражнение ${bi + 1} в другой день`} style={{ ...BTN_GHOST, minWidth: 32, minHeight: 32, padding: '4px 6px', fontSize: 12, borderColor: movePicker === bi ? 'rgba(0,230,138,0.4)' : 'rgba(255,255,255,0.12)', color: movePicker === bi ? '#00e68a' : DIM }}>↗</button>
          )}
          <EditorPopupSelect
            value={b.type}
            options={[
              { id: 'compound', label: 'Базовое', desc: 'Многосуставное, основной стимул' },
              { id: 'accessory', label: 'Доп.', desc: 'Вспомогательное движение' },
              { id: 'isolation', label: 'Изоляция', desc: 'Одна мышца, добивка' },
              { id: 'finisher', label: 'Финишь', desc: 'Короткая добивка в конце' },
            ]}
            onChange={v => updateBlock(bi, { type: v as UserBlock['type'], role: v === 'compound' ? 'primary' : 'accessory' })}
            ariaLabel="Тип упражнения"
            title="Тип упражнения"
          />
          <ExerciseLabPicker value={b.exerciseName} muscle={b.muscle} onSelect={ex => updateBlock(bi, { exerciseName: ex.name, muscle: ex.group || b.muscle, type: (ex.type === 'compound' ? 'compound' : ex.type === 'isolation' ? 'isolation' : 'accessory') as UserBlock['type'], role: ex.type === 'compound' ? 'primary' : 'accessory' })} />
          <EditorPopupSelect
            value={b.muscle ?? ''}
            options={[
              ...ALL_GROUPS.map(g => ({ id: g, label: GROUP_RU[g] ?? g })),
              ...(b.muscle && !ALL_GROUPS.includes(b.muscle) ? [{ id: b.muscle, label: b.muscle }] : []),
            ]}
            onChange={v => updateBlock(bi, { muscle: v })}
            ariaLabel="Мышца упражнения"
            title="Мышца (группа)"
            placeholder="Мышца"
            buttonStyle={{ width: 90, minWidth: 90 }}
          />
           <button
             className="bb-block-expand"
             type="button"
             onClick={() => setExpandedBlock(expandedBlock === bi ? null : bi)}
             aria-expanded={expandedBlock === bi}
           >{expandedBlock === bi ? '▲ Детали' : '▼ Детали'}</button>
          </div>
          {movePicker === bi && otherSessions && otherSessions.length > 0 && onMoveBlock && (
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', padding: '6px 8px', borderRadius: 8, background: 'rgba(0,230,138,0.08)', border: '1px solid rgba(0,230,138,0.2)', alignItems: 'center' }}>
              <span style={{ fontSize: 10, color: '#00e68a', fontWeight: 700 }}>↗ Переместить в:</span>
              {otherSessions.map(os => (
                <button key={os.idx} onClick={() => { onMoveBlock(bi, os.idx); setMovePicker(null); }} style={{ ...BTN_GHOST, padding: '4px 8px', fontSize: 10, minHeight: 32, borderColor: 'rgba(0,230,138,0.25)', color: '#00e68a' }}>{os.name}</button>
              ))}
              <button onClick={() => setMovePicker(null)} style={{ padding: '3px 8px', borderRadius: 6, fontSize: 10, border: 'none', background: 'transparent', color: DIM, cursor: 'pointer' }}>✕</button>
            </div>
          )}

          {/* Схема подходов — отдельной строкой, чтобы ряд с упражнением не был перегружен */}
          <SetEditor sets={b.sets} onChange={(sets) => updateBlock(bi, { sets })} muscle={b.muscle} workMax={(loadTrainingProfile().workMax ?? {}) as Record<string, number>} />
          
          {/* Авто-разминка для compound с заданным весом — единый канон warmup-ramp.engine */}
          {b.type === 'compound' && b.sets[0]?.weight && b.sets[0].weight > 0 && (() => {
            const w = b.sets[0].weight;
            const warmup = activeRampRows(w);
            return (
              <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap', padding: '4px 0', borderTop: '1px dashed rgba(255,255,255,0.06)' }}>
                <span style={{ fontSize: 10, color: '#f59e0b', fontWeight: 700 }}>🔥 Разминка:</span>
                {warmup.map((wu, i) => (
                  <span key={i} style={{ fontSize: 10, color: DIM }}>
                    {wu.bar ? `гриф ${wu.load}кг×${wu.reps}` : `${wu.load}кг×${wu.reps}`}
                    {i < warmup.length - 1 ? ' → ' : ''}
                  </span>
                ))}
                <button
                  style={{ marginLeft: 4, fontSize: 11, color: DIM, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                  onClick={() => {
                    const warmupSets = warmup.map(wu => ({ load: wu.load, reps: wu.reps }));
                    updateBlock(bi, { warmupSets });
                  }}
                >сохранить</button>
              </div>
            );
          })()}
          
          {/* Гид по темпу и отдыху — свернут в подсказку, не отдельный ряд */}
          {b.type === 'compound' || b.type === 'accessory' ? (() => {
            const ch = b.character || (b.type === 'compound' ? 'тяж' : 'памп');
             const spec = tempoFor(ch as 'тяж' | 'памп' | 'лёг', undefined, phase);
            const rest = REST_BY_CHARACTER[ch as 'тяж' | 'памп' | 'лёг'] ?? 90;
            const reps = typeof b.sets[0]?.reps === 'number' ? b.sets[0].reps as number : 10;
            const tut = spec.tutPerRep * reps;
            return (
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', padding: '4px 8px', borderRadius: 8, background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.12)', marginTop: 2 }}>
                <span style={{ fontSize: 10, color: '#22c55e', fontWeight: 750 }}>⏱</span>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.65)' }}>темп <b style={{ color: '#fff' }}>{spec.notation}</b> · отдых <b style={{ color: '#fff' }}>{rest}s</b> · TUT <b style={{ color: '#fff' }}>~{tut}s</b></span>
                <button style={{ fontSize: 10, color: '#22c55e', background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.22)', borderRadius: 6, padding: '2px 7px', cursor: 'pointer', fontWeight: 700 }} onClick={() => updateBlock(bi, { sets: b.sets.map(st => ({ ...st, tempo: spec.notation, restSec: rest })), tempoSpec: spec.notation })}
                >применить</button>
              </div>
            );
          })() : null}
          
          {/* Ряд 2: комментарий + кнопки управления */}
          <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
          <input 
            style={{ ...IN, padding: '6px 10px', fontSize: 11, flex: '1 1 180px', minWidth: 120, minHeight: 44 }}
            value={b.note || ''} 
            onChange={e => updateBlock(bi, { note: e.target.value })} 
            placeholder="💬 Комментарий к упражнению (техника, цель, примечания)" 
          />
          {b.rationale && (
            <span style={{ fontSize: 10, color: DIM, flex: '0 0 auto', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={b.rationale}>📝</span>
          )}
          {/* Выбор второго упражнения для суперсета */}
          {b.supersetWith && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 6px', background: 'rgba(167,139,250,0.08)', borderRadius: 6, border: '1px solid rgba(167,139,250,0.2)' }}>
              <span style={{ fontSize: 11, color: '#a78bfa', fontWeight: 700 }}>⊕ Суперсет с:</span>
              <ExerciseLabPicker 
                value={blocks.find(bl => bl.id === b.supersetWith)?.exerciseName || ''} 
                muscle={b.muscle}
                onSelect={ex => {
                  // Найти индекс партнёра и обновить его название
                  const partnerIdx = blocks.findIndex(bl => bl.id === b.supersetWith);
                  if (partnerIdx >= 0) {
                    updateBlock(partnerIdx, { exerciseName: ex.name, muscle: ex.group || b.muscle });
                  }
                }} 
              />
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <button aria-label="Переместить упражнение вверх" onClick={() => moveBlock(bi, -1)} disabled={bi===0} title="Вверх" style={{ ...ICON_CARD_BTN, opacity: bi===0 ? 0.35 : 1, width: 36, height: 36, minWidth: 36, minHeight: 36, fontSize: 11 }}>▲</button>
            <button aria-label="Переместить упражнение вниз" onClick={() => moveBlock(bi, 1)} disabled={bi===blocks.length-1} title="Вниз" style={{ ...ICON_CARD_BTN, opacity: bi===blocks.length-1 ? 0.35 : 1, width: 36, height: 36, minWidth: 36, minHeight: 36, fontSize: 11 }}>▼</button>
          </div>
          <button
            style={{ ...ICON_CARD_BTN, color: b.supersetWith ? '#a78bfa' : 'rgba(255,255,255,0.65)', borderColor: b.supersetWith ? 'rgba(167,139,250,0.35)' : 'rgba(255,255,255,0.10)', background: b.supersetWith ? 'rgba(167,139,250,0.12)' : 'rgba(255,255,255,0.04)' }}
            onClick={() => b.supersetWith ? unlinkSuperset(bi) : linkSuperset(bi)}
            title={b.supersetWith ? 'Снять суперсет — антагонисты экономят время, но снижают макс. силу в подходе' : 'Суперсет с соседним — делайте без отдыха, подходит для памп-дня'}
          >⊕</button>
          <button aria-label="Клонировать упражнение" style={ICON_CARD_BTN} onClick={() => cloneBlock(bi)} title="Клонировать — копия с теми же сетами, удобно для второй недели">⧉</button>
          {b.exerciseName && (
            <button
              style={{ ...ICON_CARD_BTN, color: substFor === bi ? '#f59e0b' : 'rgba(255,255,255,0.65)', borderColor: substFor === bi ? 'rgba(245,158,11,0.35)' : 'rgba(255,255,255,0.08)', background: substFor === bi ? 'rgba(245,158,11,0.12)' : 'rgba(255,255,255,0.04)' }}
              onClick={() => setSubstFor(substFor === bi ? null : bi)}
              title="Подобрать замену — учтёт оборудование и травмы, не меняя объём"
            >🔄</button>
          )}
           <button aria-label="Скопировать упражнение" style={{ ...ICON_CARD_BTN, color: '#06b6d4', borderColor: 'rgba(6,182,212,0.22)', background: 'rgba(6,182,212,0.08)' }} onClick={() => copyBlock(bi)} title="Скопировать в буфер — вставите в другой день">📋</button>
           <button aria-label="Удалить упражнение" style={{ ...ICON_CARD_BTN, color: '#ef4444', borderColor: 'rgba(239,68,68,0.22)', background: 'rgba(239,68,68,0.08)' }} onClick={() => removeBlock(bi)}>✕</button>
          {substFor === bi && substResults.length > 0 && (
            <div style={{ padding: '4px 8px', marginTop: 4, background: 'rgba(245,158,11,0.06)', borderRadius: 6, border: '1px solid rgba(245,158,11,0.18)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#f59e0b', marginBottom: 4 }}>🔄 Замены для «{b.exerciseName}»:</div>
              {substResults.map((r, ri) => (
                <button
                  key={ri}
                  onClick={() => applySubst(bi, r.exercise.name, r.exercise.group || b.muscle)}
                  style={{ display: 'block', width: '100%', textAlign: 'left', padding: '4px 6px', marginBottom: 2, borderRadius: 4, fontSize: 10, cursor: 'pointer', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: DIM_STRONG }}
                >
                  <b>{r.exercise.name}</b> <span style={{ color: DIM, fontSize: 11 }}>({r.confidence})</span>
                  <div style={{ fontSize: 11, color: DIM }}>{r.reason}</div>
                </button>
              ))}
            </div>
          )}
        </div>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button style={{ ...CARD_ACTION, flex: 1, minWidth: 140, borderColor: 'rgba(0,230,138,0.22)' }} onClick={addBlock}>
          <span style={{ fontSize: 16 }}>＋</span>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1.1 }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: '#00e68a' }}>Упражнение</span>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)' }}>база/изоляция + сеты</span>
          </div>
        </button>
        <button style={{ ...CARD_ACTION, flex: 1, minWidth: 140, borderColor: 'rgba(6,182,212,0.22)', background: 'rgba(6,182,212,0.06)' }} onClick={pasteBlock} title="Вставить из буфера (скопированное ранее)">
          <span style={{ fontSize: 16 }}>📥</span>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1.1 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#06b6d4' }}>Вставить</span>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)' }}>из буфера</span>
          </div>
        </button>
      </div>
      <MethodHint icon="💡" title="Как выбрать" text="База — тяжёлые 5-8 повт, RIR 1-2. Изоляция — памп 10-15, RIR 2-3. Для 2×/нед: тяжёлый день + памп день = рост без плато." color="#22c55e" />
    </div>
  );
};

const SetEditor: React.FC<{ sets: UserSet[]; onChange: (s: UserSet[]) => void; muscle?: string; workMax?: Record<string, number> }> = ({ sets, onChange, muscle, workMax }) => {
  const { confirm } = useConfirmDialog();
  const add = () => onChange([...sets, { reps: 10, rir: 2, weight: 0, restSec: 90 }]);
  const upd = (i: number, patch: Partial<UserSet>) => onChange(sets.map((s, j) => j === i ? { ...s, ...patch } : s));
  const del = (i: number) => onChange(sets.filter((_, j) => j !== i));
  const confirmDelete = async (i: number) => {
    if (sets.length === 1) {
      const ok = await confirm({ title: 'Удалить последний сет?', message: 'Блок останется без сетов (можно добавить заново).', confirmLabel: 'Удалить', danger: true });
      if (!ok) return;
    }
    del(i);
  };
  const [weightMode, setWeightMode] = useState<'kg' | 'pct'>('kg');
  const wmKey = (muscle || '').toLowerCase();
  const wm = workMax?.[wmKey] ?? workMax?.[muscle || ''] ?? 0;
  const autoCalcWeight = (setIdx: number, rir: number, reps: number) => {
    const s = sets[setIdx];
    if (!s || wm <= 0) return;
    const pctForRir = [1.0, 0.96, 0.92, 0.88, 0.84, 0.80][Math.min(rir, 5)] ?? 0.85;
    const repFactor = typeof reps === 'number' ? (reps > 10 ? 0.95 : reps > 6 ? 1.0 : 1.02) : 1.0;
    const pct = pctForRir * (typeof reps === 'number' && reps <= 1 ? 1.0 : repFactor);
    const wt = Math.round((wm * pct) / 2.5) * 2.5;
    upd(setIdx, { weight: wt });
  };
  const toggleTechnique = (i: number, tech: IntensityTechnique) => {
    const s = sets[i];
    const current = s.techniques || [];
    const updated = current.includes(tech)
      ? current.filter(t => t !== tech)
      : [...current, tech];
    upd(i, { techniques: updated });
  };
  const hasTechnique = (s: UserSet, tech: IntensityTechnique) => (s.techniques || []).includes(tech);
  // Enter → next input (Excel-like)
  const handleEnterNext = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const form = (e.target as HTMLElement).closest('.bb-set-editor');
      if (!form) return;
      const inputs = Array.from(form.querySelectorAll('input, button')) as HTMLElement[];
      const idx = inputs.indexOf(e.target as HTMLElement);
      if (idx >= 0 && idx + 1 < inputs.length) inputs[idx + 1].focus();
    }
  };
  return (
    <div className="bb-set-editor" style={{ display: 'flex', flexDirection: 'column', gap: 5, flex: '0 0 auto' }}>
      <div className="editor-sets-heading" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ flex: 1 }}>
          <div className="editor-kicker">СХЕМА ПОДХОДОВ</div>
          <div className="editor-sets-help">Повторы × RIR @ вес · отдых · техники</div>
        </div>
        {wm > 0 && <button type="button" onClick={() => setWeightMode(m => m === 'kg' ? 'pct' : 'kg')} style={{ fontSize: 10, fontWeight: 700, padding: '4px 8px', borderRadius: 8, border: weightMode === 'pct' ? '1px solid rgba(0,230,138,0.35)' : '1px solid rgba(255,255,255,0.10)', background: weightMode === 'pct' ? 'rgba(0,230,138,0.14)' : 'rgba(255,255,255,0.04)', color: weightMode === 'pct' ? '#00e68a' : 'rgba(255,255,255,0.60)', cursor: 'pointer' }}>{weightMode === 'kg' ? 'кг · показать %' : '% · показать кг'}</button>}
        <span style={{ fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,0.55)', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: '2px 8px' }}>{sets.length} шт.</span>
      </div>
      {/* Header таблицы подходов — Excel-like */}
      {sets.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '4px 8px', fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.45)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <span style={{ width: 22, textAlign: 'center' }}>#</span>
          <span style={{ width: 56, textAlign: 'center' }}>Повт</span>
          <span style={{ width: 50, textAlign: 'center' }}>RIR</span>
          <span style={{ width: 60, textAlign: 'center' }}>Вес кг</span>
          <span style={{ width: 46, textAlign: 'center' }}>Отдых</span>
          <span style={{ width: 56, textAlign: 'center' }}>Темп</span>
          <span style={{ flex: 1 }} />
        </div>
      )}
      {sets.length > 1 && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          <button type="button" onClick={() => { const f=sets[0]; if(f) onChange(sets.map(s=> ({ ...s, tempo: f.tempo, restSec: f.restSec })) ); }} style={{ fontSize: 10, padding: '3px 8px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.60)', cursor: 'pointer' }}>↕ Копировать RIR/темп/отдых с 1-го</button>
          <button type="button" onClick={() => { const f=sets[0]; if(f?.weight!=null) onChange(sets.map(s=> ({ ...s, weight: f.weight })) ); }} style={{ fontSize: 10, padding: '3px 8px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.60)', cursor: 'pointer' }}>↕ Вес с 1-го</button>
        </div>
      )}
      {sets.map((s, i) => (
        <div key={i} style={{ background: 'rgba(0,230,138,0.05)', border: '1px solid rgba(0,230,138,0.14)', borderRadius: 8, padding: '6px 8px' }}>
          <div onKeyDown={handleEnterNext} style={{ display: 'flex', alignItems: 'center', gap: 3, flexWrap: 'wrap' }}>
             <span className="editor-set-index" style={{ minWidth: 18, textAlign: 'center', fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,0.55)' }}>{i + 1}</span>
             <div style={{ display:'flex', alignItems:'center', gap: 2 }}>
               <input type="number" style={{ ...IN, padding: '4px 6px', fontSize: 11, width: 42, minHeight: 44, textAlign:'center' }} value={typeof s.reps === 'number' ? s.reps : 0} onChange={e => { const v = Number(e.target.value); if (Number.isFinite(v)) upd(i, { reps: Math.max(0, Math.round(v)) }); }} title="повторения" placeholder="повт" aria-label={`Повторения подхода ${i + 1}`} inputMode="numeric" />
               <div style={{ display:'flex', flexDirection:'column', gap:1 }}>
                 <button type="button" onClick={() => { const cur = typeof s.reps==='number'?s.reps:10; upd(i,{ reps: cur+1 }); }} style={{ width:18, height:14, fontSize:8, lineHeight:1, padding:0, borderRadius:3, border:'1px solid rgba(255,255,255,0.12)', background:'rgba(255,255,255,0.06)', color:'#fff', cursor:'pointer' }}>▲</button>
                 <button type="button" onClick={() => { const cur = typeof s.reps==='number'?s.reps:10; upd(i,{ reps: Math.max(1, cur-1) }); }} style={{ width:18, height:14, fontSize:8, lineHeight:1, padding:0, borderRadius:3, border:'1px solid rgba(255,255,255,0.12)', background:'rgba(255,255,255,0.06)', color:'#fff', cursor:'pointer' }}>▼</button>
               </div>
             </div>
            <span style={{ fontSize: 11, color: DIM }}>×</span>
             <div style={{ display:'flex', alignItems:'center', gap: 2 }}>
               <input type="number" style={{ ...IN, padding: '4px 6px', fontSize: 11, width: 38, minHeight: 44, textAlign:'center' }} value={s.rir} min={0} max={5} onChange={e => { const v = Number(e.target.value); if (Number.isFinite(v)) upd(i, { rir: Math.max(0, Math.min(5, Math.round(v))) }); }} title="RIR: повторения в запасе" placeholder="RIR" aria-label={`RIR подхода ${i + 1}`} inputMode="numeric" />
               <div style={{ display:'flex', flexDirection:'column', gap:1 }}>
                 <button type="button" onClick={() => upd(i,{ rir: Math.min(5,(s.rir??2)+1) })} style={{ width:16, height:14, fontSize:8, lineHeight:1, padding:0, borderRadius:3, border:'1px solid rgba(255,255,255,0.12)', background:'rgba(255,255,255,0.06)', color:'#fff', cursor:'pointer' }}>▲</button>
                 <button type="button" onClick={() => upd(i,{ rir: Math.max(0,(s.rir??2)-1) })} style={{ width:16, height:14, fontSize:8, lineHeight:1, padding:0, borderRadius:3, border:'1px solid rgba(255,255,255,0.12)', background:'rgba(255,255,255,0.06)', color:'#fff', cursor:'pointer' }}>▼</button>
               </div>
             </div>
            <span style={{ fontSize: 11, color: DIM }}>@</span>
            {weightMode === 'pct' ? (
              <>
                <input type="number" style={{ ...IN, padding: '3px 4px', fontSize: 11, width: 38, minHeight: 44, textAlign:'center' }} value={s.pctOf1RM != null ? Math.round(s.pctOf1RM * 100) : ''} onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v)) upd(i, { pctOf1RM: v / 100, weight: Math.round((wm * v / 100) / 2.5) * 2.5 }); }} title="% от 1ПМ" placeholder="%" />
                <span style={{ fontSize: 11, color: DIM }}>%→</span>
              </>
            ) : null}
             <div style={{ display:'flex', alignItems:'center', gap: 2 }}>
               <input type="number" style={{ ...IN, padding: '4px 6px', fontSize: 11, width: 46, minHeight: 44, textAlign:'center' }} value={s.weight ?? 0} onChange={e => upd(i, { weight: parseFloat(e.target.value) || 0 })} title="вес (кг)" aria-label={`Вес подхода ${i + 1} в килограммах`} placeholder="кг" />
               <div style={{ display:'flex', flexDirection:'column', gap:1 }}>
                 <button type="button" onClick={() => upd(i,{ weight: Math.round(((s.weight??0)+2.5)/2.5)*2.5 })} style={{ width:16, height:14, fontSize:7, lineHeight:1, padding:0, borderRadius:3, border:'1px solid rgba(255,255,255,0.12)', background:'rgba(255,255,255,0.06)', color:'#fff', cursor:'pointer' }}>+2.5</button>
                 <button type="button" onClick={() => upd(i,{ weight: Math.max(0, Math.round(((s.weight??0)-2.5)/2.5)*2.5) })} style={{ width:16, height:14, fontSize:8, lineHeight:1, padding:0, borderRadius:3, border:'1px solid rgba(255,255,255,0.12)', background:'rgba(255,255,255,0.06)', color:'#fff', cursor:'pointer' }}>−2.5</button>
               </div>
             </div>
            {wm > 0 && typeof s.reps === 'number' && (
              <button style={{ border: 'none', background: 'rgba(0,230,138,0.12)', color: ACCENT, cursor: 'pointer', fontSize: 11, padding: '4px 6px', borderRadius: 4, fontWeight: 700, minHeight: 44 }} onClick={() => autoCalcWeight(i, s.rir, s.reps as number)} title="Рассчитать вес из %1RM" aria-label="calc">🧮</button>
            )}
            <div style={{ display:'flex', alignItems:'center', gap: 2 }}>
              <input type="number" style={{ ...IN, padding: '4px 6px', fontSize: 11, width: 36, minHeight: 44, textAlign:'center' }} value={Math.floor((s.restSec ?? 90) / 60)} min={0} max={20} onChange={e => { const v = Number(e.target.value); if (Number.isFinite(v)) upd(i, { restSec: Math.max(0, Math.round(v)) * 60 }); }} title="отдых (мин)" placeholder="отд" aria-label="Отдых в минутах" inputMode="numeric" />
              <span style={{ fontSize: 11, color: DIM }}>м</span>
            </div>
            <input type="text" style={{ ...IN, padding: '4px 6px', fontSize: 11, width: 56, minHeight: 44 }} value={s.tempo || ''} onChange={e => upd(i, { tempo: e.target.value })} placeholder="2-1-1-0" title="Темп (2-1-1-0)" />
            <button style={{ border: 'none', background: 'rgba(239,68,68,0.08)', color: '#ef4444', cursor: 'pointer', fontSize: 11, padding: '4px 8px', minHeight: 32, borderRadius: 6, borderWidth: 0 }} onClick={() => confirmDelete(i)} title="Удалить подход">✕</button>
           </div>
       <div className="editor-techniques" style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap', padding: '6px 8px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
             <span className="editor-techniques-label" style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.45)' }}>Техники:</span>
            {(['drop_set', 'myo_reps', 'pause_rep', 'rest_pause', 'mechanical_drop'] as IntensityTechnique[]).map(tech => {
              const active = hasTechnique(s, tech);
              const lbl: Record<string, string> = { drop_set: '↓DRP', myo_reps: 'MYO', pause_rep: 'PRS', rest_pause: 'RP', mechanical_drop: 'MD' };
              const titleMap: Record<string, string> = { drop_set: 'Дроп-сет: досет со сниженным весом', myo_reps: 'Мио-репсы: мини-сеты после отказа', pause_rep: 'Пауза-повтор: пауза в растянутой позиции', rest_pause: 'Отдых-пауза: короткие паузы внутри подхода', mechanical_drop: 'Механический дроп: смена положения/упражнения' };
              const clr: Record<string, string> = { drop_set: '#f59e0b', myo_reps: '#a78bfa', pause_rep: '#22c55e', rest_pause: '#3b82f6', mechanical_drop: '#ef4444' };
              return <button key={tech} type="button" title={titleMap[tech]} onClick={() => toggleTechnique(i, tech)} style={{ padding: '4px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700, cursor: 'pointer', border: active ? `1px solid ${clr[tech]}` : '1px solid rgba(255,255,255,0.08)', background: active ? `${clr[tech]}20` : 'transparent', color: active ? clr[tech] : DIM, minHeight: 44 }}>{lbl[tech]}</button>;
            })}
          </div>
          {hasTechnique(s, 'drop_set') && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginTop: 4, paddingTop: 4, borderTop: '1px dashed rgba(255,255,255,0.1)' }}>
              <span style={{ fontSize: 11, color: '#f59e0b', fontWeight: 700 }}>↓ Дроп:</span>
              <input type="number" style={{ ...IN, padding: '3px 4px', fontSize: 11, width: 40, minHeight: 44 }} value={s.dropWeight ?? 0} onChange={e => upd(i, { dropWeight: parseFloat(e.target.value) || 0 })} placeholder="вес" />
              <span style={{ fontSize: 11, color: DIM }}>×</span>
              <input type="number" style={{ ...IN, padding: '3px 4px', fontSize: 11, width: 34, minHeight: 44 }} value={s.dropReps ?? 0} onChange={e => { const v = Number(e.target.value); if (Number.isFinite(v)) upd(i, { dropReps: Math.max(0, Math.round(v)) }); }} placeholder="повт" aria-label="Drop повторения" inputMode="numeric" />
            </div>
          )}
          {hasTechnique(s, 'myo_reps') && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginTop: 4, paddingTop: 4, borderTop: '1px dashed rgba(255,255,255,0.1)' }}>
              <span style={{ fontSize: 11, color: '#a78bfa', fontWeight: 700 }}>Мини:</span>
              <input type="number" style={{ ...IN, padding: '3px 4px', fontSize: 11, width: 34, minHeight: 44 }} value={s.miniReps ?? 0} onChange={e => { const v = Number(e.target.value); if (Number.isFinite(v)) upd(i, { miniReps: Math.max(0, Math.round(v)) }); }} placeholder="повт" aria-label="Mini повторения" inputMode="numeric" />
              <span style={{ fontSize: 11, color: DIM }}>отд</span>
              <input type="number" style={{ ...IN, padding: '3px 4px', fontSize: 11, width: 36, minHeight: 44 }} value={Math.floor((s.miniRestSec ?? 15) / 60)} onChange={e => { const v = Number(e.target.value); if (Number.isFinite(v)) upd(i, { miniRestSec: Math.max(0, Math.round(v)) * 60 }); }} placeholder="м" aria-label="Mini отдых минуты" inputMode="numeric" />
            </div>
          )}
          {hasTechnique(s, 'pause_rep') && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginTop: 4, paddingTop: 4, borderTop: '1px dashed rgba(255,255,255,0.1)' }}>
              <span style={{ fontSize: 11, color: '#22c55e', fontWeight: 700 }}>Пауза:</span>
              <input type="number" style={{ ...IN, padding: '3px 4px', fontSize: 11, width: 36, minHeight: 44 }} value={s.pauseSec ?? 2} onChange={e => { const v = Number(e.target.value); if (Number.isFinite(v)) upd(i, { pauseSec: Math.max(0, Math.round(v)) }); }} placeholder="сек" aria-label="Паза секунды" inputMode="numeric" />
            </div>
          )}
        </div>
      ))}
      <button style={{ ...CARD_ACTION, alignSelf: 'flex-start', borderColor: 'rgba(0,230,138,0.22)', padding: '8px 12px', minHeight: 44 }} onClick={add}>
        <span style={{ fontSize: 14, color: '#00e68a' }}>＋</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#00e68a' }}>Добавить подход</span>
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)' }}>RIR/вес/отдых</span>
      </button>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6, paddingTop: 6, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ fontSize: 11, fontWeight: 700, color: '#a78bfa' }}>📋 Шаблоны сетов</span><span style={{ fontSize: 10, color: DIM }}>карточки — 1 клик применит</span></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 6 }}>
        {Object.entries(SET_TEMPLATES).slice(0, 5).map(([key, tmpl]) => (
          <button key={key} title={'Применить: ' + key + ` — ${tmpl.sets}×${tmpl.reps} RIR${tmpl.rir} отдых ${tmpl.rest}с`} style={{ ...CARD_BTN, minHeight: 56, padding: '8px 10px', borderColor: 'rgba(167,139,250,0.18)', background: 'rgba(167,139,250,0.06)' }}
            onClick={() => onChange(Array.from({ length: tmpl.sets }, () => ({ reps: tmpl.reps, rir: tmpl.rir, restSec: tmpl.rest, weight: sets[0]?.weight ?? 0 })))}
           >
            <span style={{ fontSize: 11, fontWeight: 800, color: '#a78bfa' }}>{key}</span>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.65)' }}>{tmpl.sets}×{tmpl.reps} · RIR{tmpl.rir}</span>
           </button>
        ))}
        </div>
      </div>
    </div>
  );
};

/* ─── ПЛ-редактор: immutable-цикл + оверлей / custom-цикл с полным редактированием ─── */

const LIFT_OPTS: Array<{ id: PLExercise['lift']; label: string }> = [
  { id: 'squat', label: 'Присед' }, { id: 'bench', label: 'Жим' }, { id: 'dead', label: 'Тяга' }, { id: 'accessory', label: 'Подсобка' },
];
const PHASE_OPTS: Array<{ id: PLWeek['phase']; label: string }> = [
  { id: 'accumulation', label: 'Накопление' }, { id: 'intensification', label: 'Интенсификация' },
  { id: 'deload', label: 'Разгрузка' }, { id: 'peaking', label: 'Пик' },
];

const PLSetEditor: React.FC<{ sets: PLSet[]; lift: PLExercise['lift']; workMax: PLProgramBody['workMax']; onChange: (s: PLSet[]) => void }> = ({ sets, lift, workMax, onChange }) => {
  const addSet = () => onChange([...sets, { pct: 0.7, reps: 5, sets: 3, rir: 2 }]);
  const updSet = (i: number, patch: Partial<PLSet>) => onChange(sets.map((s, j) => j === i ? { ...s, ...patch } : s));
  const removeSet = (i: number) => onChange(sets.filter((_, j) => j !== i));
  // Accessory exercises have no competition-lift 1RM; calcWLogic returns null
  // for them and the editor keeps their manually entered weight.
  const calcW = (pct: number) => calcWLogic(pct, lift, workMax);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {sets.map((s, i) => {
        const w = calcW(s.pct);
        return (
          <div key={i} style={{ background: 'rgba(167,139,250,0.10)', borderRadius: 8, padding: '6px 8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 10, color: DIM, fontWeight: 700 }}>%1RM</span>
              <input aria-label="Процент от 1ПМ" type="number" style={{ ...IN, padding: '5px 7px', fontSize: 11, width: 56, minHeight: 44 }}
                value={Math.round(s.pct * 100)} min={30} max={110} onChange={e => {
                  const value = Number(e.target.value);
                  if (Number.isFinite(value)) updSet(i, { pct: Math.max(0.3, Math.min(1.1, value / 100)) });
                }} />
              {w != null && <span style={{ fontSize: 10, color: '#a78bfa', fontWeight: 700 }}>→ {w}кг</span>}
              <span style={{ fontSize: 10, color: DIM }}>×</span>
              <input aria-label="Повторения" type="number" style={{ ...IN, padding: '5px 7px', fontSize: 11, width: 46, minHeight: 44 }}
                value={s.reps} min={1} max={20} onChange={e => updSet(i, { reps: Math.max(1, Number(e.target.value) || 1) })} placeholder="повт" />
              <span style={{ fontSize: 10, color: DIM }}>повт</span>
              <input aria-label="Количество подходов" type="number" style={{ ...IN, padding: '5px 7px', fontSize: 11, width: 48, minHeight: 44 }}
                value={s.sets} min={1} max={12} onChange={e => updSet(i, { sets: Math.max(1, Number(e.target.value) || 1) })} placeholder="сетов" />
              <span style={{ fontSize: 10, color: DIM }}>сетов</span>
              <label style={{ fontSize: 10, color: DIM, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 2 }}>
                RIR <input aria-label="RIR" type="number" style={{ ...IN, padding: '5px 7px', fontSize: 11, width: 42, minHeight: 44 }}
                  value={s.rir ?? 2} min={0} max={5} onChange={e => { const v = Number(e.target.value); if (Number.isFinite(v)) updSet(i, { rir: Math.max(0, Math.min(5, Math.round(v))) }); }} inputMode="numeric" />
              </label>
              <button style={{ border: 'none', background: 'transparent', color: '#ef4444', cursor: 'pointer', fontSize: 11, padding: '4px 8px', minHeight: 44, marginLeft: 'auto' }} onClick={() => removeSet(i)}>✕</button>
            </div>
          </div>
        );
      })}
      <button style={{ ...CARD_ACTION, alignSelf: 'flex-start', borderColor: 'rgba(167,139,250,0.22)', background: 'rgba(167,139,250,0.06)', padding: '8px 12px' }} onClick={addSet}><span style={{ fontSize: 14, color: '#a78bfa' }}>＋</span><span style={{ fontSize: 11, fontWeight: 700, color: '#a78bfa' }}>Сет</span><span style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)' }}>%×повт×RIR</span></button>
    </div>
  );
};

const PLEditor: React.FC<{ body: PLProgramBody; onChange: (b: PLProgramBody) => void }> = ({ body, onChange }) => {
  const { confirm } = useConfirmDialog();
  const bodyRef = React.useRef(body);
  bodyRef.current = body;
  const weekDays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
  const cycle = useMemo(() => getReferencedCycle({ ...createBlank('pl'), pl: body }), [body.sourceCycleId]);
  const set = (patch: Partial<PLProgramBody>) => onChange({ ...bodyRef.current, ...patch });
  const isCustom = !body.sourceCycleId;

  // ── Custom PL: fully editable weeks/days/exercises ──
  const [expandedWeek, setExpandedWeek] = useState<number | null>(null);

  const addWeek = () => {
    const weeks = [...(bodyRef.current.customWeeks ?? [])];
    const n = weeks.length + 1;
    weeks.push({ week: n, phase: 'accumulation', deload: false, days: [{ name: 'День 1', dayOfWeek: 0, exercises: [] }] });
    set({ customWeeks: weeks, schedule: weeks.flatMap((w, wi) => w.days.map((d, di) => ({ sessionIdx: weeks.slice(0, wi).reduce((a, ww) => a + ww.days.length, 0) + di, dayOfWeek: d.dayOfWeek ?? di }))) });
    setExpandedWeek(n - 1);
  };
  const removeWeek = (wi: number) => {
    const weeks = bodyRef.current.customWeeks?.filter((_, i) => i !== wi).map((w, i) => ({ ...w, week: i + 1 })) ?? [];
    set({ customWeeks: weeks, schedule: weeks.flatMap((w, wwi) => w.days.map((d, di) => ({ sessionIdx: weeks.slice(0, wwi).reduce((a, ww) => a + ww.days.length, 0) + di, dayOfWeek: d.dayOfWeek ?? di }))) });
    setExpandedWeek(weeks.length === 0 ? null : Math.min(wi, weeks.length - 1));
  };
  const cloneWeek = (wi: number) => {
    const current = bodyRef.current;
    const src = current.customWeeks?.[wi];
    if (!src) return;
    const weeks = [...(current.customWeeks ?? [])];
    const cloned: PLWeek = { week: weeks.length + 1, phase: src.phase, deload: src.deload, days: src.days.map(d => ({ name: d.name, dayOfWeek: d.dayOfWeek, exercises: d.exercises.map(e => ({ ...e, sets: e.sets.map(s => ({ ...s })) })) })) };
    set({ customWeeks: [...weeks, cloned], schedule: [...weeks, cloned].flatMap((w, wwi) => w.days.map((d, di) => ({ sessionIdx: [...weeks, cloned].slice(0, wwi).reduce((a, ww) => a + ww.days.length, 0) + di, dayOfWeek: d.dayOfWeek ?? di }))) });
    setExpandedWeek(weeks.length);
  };
  const updateWeek = (wi: number, patch: Partial<PLWeek>) => {
    const weeks = (bodyRef.current.customWeeks ?? []).map((w, i) => i === wi ? { ...w, ...patch } : w);
    set({ customWeeks: weeks });
  };
  const updateDay = (wi: number, di: number, patch: Partial<PLDay>) => {
    const weeks = (bodyRef.current.customWeeks ?? []).map((w, i) => i === wi ? { ...w, days: w.days.map((d, j) => j === di ? { ...d, ...patch } : d) } : w);
    set({ customWeeks: weeks, schedule: weeks.flatMap((w, wwi) => w.days.map((d, dayIndex) => ({ sessionIdx: weeks.slice(0, wwi).reduce((a, ww) => a + ww.days.length, 0) + dayIndex, dayOfWeek: d.dayOfWeek ?? dayIndex }))) });
  };
  const addDay = (wi: number) => {
    const weeks = (bodyRef.current.customWeeks ?? []).map((w, i) => i === wi ? { ...w, days: [...w.days, { name: 'День ' + (w.days.length + 1), dayOfWeek: firstFreeTrainingDay(w.days), exercises: [] }] } : w);
    set({ customWeeks: weeks, schedule: weeks.flatMap((w, wwi) => w.days.map((d, di) => ({ sessionIdx: weeks.slice(0, wwi).reduce((a, ww) => a + ww.days.length, 0) + di, dayOfWeek: d.dayOfWeek ?? di }))) });
  };
  const removeDay = (wi: number, di: number) => {
    const weeks = (bodyRef.current.customWeeks ?? []).map((w, i) => i === wi ? { ...w, days: w.days.filter((_, j) => j !== di) } : w);
    set({ customWeeks: weeks, schedule: weeks.flatMap((w, wwi) => w.days.map((d, di) => ({ sessionIdx: weeks.slice(0, wwi).reduce((a, ww) => a + ww.days.length, 0) + di, dayOfWeek: d.dayOfWeek ?? di }))) });
  };
  const updateExercise = (wi: number, di: number, ei: number, patch: Partial<PLExercise>) => {
    const weeks = (bodyRef.current.customWeeks ?? []).map((w, i) => i === wi ? { ...w, days: w.days.map((d, j) => j === di ? { ...d, exercises: d.exercises.map((e, k) => k === ei ? { ...e, ...patch } : e) } : d) } : w);
    set({ customWeeks: weeks });
  };
  const addExercise = (wi: number, di: number) => {
    const weeks = (bodyRef.current.customWeeks ?? []).map((w, i) => i === wi ? { ...w, days: w.days.map((d, j) => j === di ? { ...d, exercises: [...d.exercises, { name: '', lift: 'accessory' as const, muscle: '', sets: [{ pct: 0.7, reps: 5, sets: 3, rir: 2 }] }] } : d) } : w);
    set({ customWeeks: weeks });
  };
  const removeExercise = (wi: number, di: number, ei: number) => {
    const weeks = (bodyRef.current.customWeeks ?? []).map((w, i) => i === wi ? { ...w, days: w.days.map((d, j) => j === di ? { ...d, exercises: d.exercises.filter((_, k) => k !== ei) } : d) } : w);
    set({ customWeeks: weeks });
  };

  // ── Immutable cycle: current overlay-only behavior ──
  if (!isCustom) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ ...panelStyle('#a78bfa'), padding: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#a78bfa', marginBottom: 4 }}>📋 Проф. ПЛ-цикл (immutable)</div>
          {cycle ? (
            <div style={{ fontSize: 11, color: DIM_STRONG }}>
              <div style={{ fontWeight: 700 }}>{cycle.meta.title}</div>
              <div style={{ fontSize: 10, color: DIM }}>{cycle.meta.sessionsPerWeek}д/нед · {cycle.meta.weeks} нед · {cycle.meta.level} · {periodLabelRu(cycle.meta.period)} · корректировка {((cycle.meta.correctionPct || 0) * 100).toFixed(1)}%/нед</div>
              <div style={{ fontSize: 10, color: DIM, marginTop: 4 }}>Процентки/сеты/повторения цикла не редактируются — это профессиональная методика. Ниже — ваш оверлей.</div>
              <button
                style={{ ...BTN_GHOST, padding: '6px 10px', fontSize: 11, marginTop: 6, minHeight: 44, color: '#f59e0b', borderColor: 'rgba(245,158,11,0.3)' }}
                onClick={async () => {
                  const ok = await confirm({ title: 'Переключиться на свой ПЛ-цикл?', message: 'Процентки LMS-цикла будут отсоединены — вы сможете редактировать недели/дни/упражнения/процентки самостоятельно. Это нельзя отменить.', confirmLabel: 'Переключить', danger: true });
                  if (!ok) return;
                  set({ sourceCycleId: null, customWeeks: [{ week: 1, phase: 'accumulation', deload: false, days: [{ name: 'День 1', dayOfWeek: 0, exercises: [{ name: 'Присед', lift: 'squat', muscle: 'legs', sets: [{ pct: 0.7, reps: 5, sets: 3, rir: 2 }] }] }] }] });
                }}
              >✏ Переключить на свой цикл</button>
            </div>
          ) : (
            <div style={{ fontSize: 11, color: DIM_STRONG }}>
              {/* P3-3: явный выбор — подключить LMS или создать свой */}
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>ПЛ-программа пустая. Выберите:</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button
                  style={{ ...BTN_GHOST, padding: '8px 12px', fontSize: 11, minHeight: 44, color: '#a78bfa', borderColor: 'rgba(167,139,250,0.3)' }}
                  onClick={() => {
                    set({ sourceCycleId: null, customWeeks: [{ week: 1, phase: 'accumulation', deload: false, days: [{ name: 'День 1', dayOfWeek: 0, exercises: [{ name: 'Присед', lift: 'squat', muscle: 'legs', sets: [{ pct: 0.7, reps: 5, sets: 3, rir: 2 }] }] }] }] });
                  }}
                >✏ Создать свой цикл с нуля</button>
              </div>
              <div style={{ fontSize: 10, color: DIM, marginTop: 4 }}>Или вернитесь и подключите LMS-цикл через «🔍 ПЛ-циклы».</div>
            </div>
          )}
        </div>

        <div style={{ ...CARD, padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: ACCENT }}>Оверлей пользователя</div>

          <label style={{ ...SMALL, display: 'flex', flexDirection: 'column', gap: 4 }}>
            Рабочие максимумы (кг) — для расчёта весов из % цикла
            <div style={{ display: 'flex', gap: 6 }}>
              {(['squat', 'bench', 'dead'] as const).map(k => (
                <label key={k} style={{ flex: 1, fontSize: 10, color: DIM }}>
                  {k === 'squat' ? 'Присед' : k === 'bench' ? 'Жим' : 'Тяга'}
                  <input type="number" style={IN} value={body.workMax[k] ?? ''} onChange={e => set({ workMax: { ...body.workMax, [k]: parseFloat(e.target.value) || undefined } })} />
                </label>
              ))}
            </div>
          </label>

          <label style={{ ...SMALL, display: 'flex', flexDirection: 'column', gap: 4 }}>
            Заметки к циклу
            <textarea style={{ ...IN, minHeight: 60, resize: 'vertical' }} value={body.notes} onChange={e => set({ notes: e.target.value })} placeholder="Например: акцент на слабые группы, адаптации под восстановление" />
          </label>

          <div>
            <div style={{ fontSize: 10, color: DIM, marginBottom: 4 }}>Слабые группы (приоритет акцента)</div>
            <WeakPointChips value={body.weakPoints} onChange={(weakPoints) => set({ weakPoints })} />
          </div>

          <div>
            <div style={{ fontSize: 10, color: DIM, marginBottom: 4 }}>Расписание: сессия → день недели</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {body.schedule.map((s, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
                  <span style={{ color: DIM, minWidth: 70 }}>Сессия {s.sessionIdx + 1}</span>
                  <DayOfWeekPicker
                    value={s.dayOfWeek}
                    onChange={d => { const sc = [...body.schedule]; sc[i] = { ...sc[i], dayOfWeek: normalizeProgramDayOfWeek(d, s.dayOfWeek) }; set({ schedule: sc }); }}
                    ariaLabel={`День недели сессии ${s.sessionIdx + 1}`}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Custom PL: full editable structure ──
  const weeks = body.customWeeks ?? [];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ ...panelStyle('#a78bfa'), padding: 10 }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: '#a78bfa', marginBottom: 4 }}>
          ✏ Свой ПЛ-цикл — полное редактирование ({weeks.length} нед)
        </div>
        <div style={{ fontSize: 10, color: DIM }}>
          Все процентки, сеты, повторения и структура цикла полностью редактируемы.
        </div>
        <div style={{ fontSize: 10, color: DIM_STRONG, lineHeight: 1.45, marginTop: 5 }}>
          Начните с недели, раскройте её стрелкой, добавьте дни и выберите день недели. Затем добавьте упражнения и настройте подходы.
        </div>
      </div>
      {weeks.length > 1 && (
        <div className="editor-week-bulk-actions">
          <span>Навигация по неделям:</span>
          <label className="editor-week-jump">Перейти к
            <EditorPopupSelect
              value={expandedWeek == null ? '' : String(expandedWeek)}
              options={[{ id: '', label: 'Выбрать' }, ...weeks.map((week, index) => ({ id: String(index), label: `Неделя ${week.week}` }))]}
              onChange={v => setExpandedWeek(v === '' ? null : Number(v))}
              ariaLabel="Перейти к неделе PL"
              title="Неделя для редактирования"
              placeholder="Выбрать"
            />
          </label>
          <button type="button" onClick={() => setExpandedWeek(current => current == null ? 0 : Math.max(0, current - 1))} disabled={expandedWeek == null || expandedWeek <= 0}>← Предыдущая</button>
          <button type="button" onClick={() => setExpandedWeek(current => current == null ? 0 : Math.min(weeks.length - 1, current + 1))} disabled={expandedWeek == null || expandedWeek >= weeks.length - 1}>Следующая →</button>
          <button type="button" onClick={() => setExpandedWeek(0)}>Открыть первую</button>
          <button type="button" onClick={() => setExpandedWeek(null)}>Свернуть все</button>
        </div>
      )}

      {/* WorkMax */}
      <div style={{ ...CARD, padding: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: ACCENT, marginBottom: 6 }}>🎯 Рабочие максимумы (кг)</div>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['squat', 'bench', 'dead'] as const).map(k => (
            <label key={k} style={{ flex: 1, fontSize: 11, color: DIM, display: 'flex', flexDirection: 'column', gap: 3 }}>
              {k === 'squat' ? 'Присед' : k === 'bench' ? 'Жим' : 'Тяга'}
              <input type="number" style={{ ...IN, minHeight: 44 }} value={body.workMax[k] ?? ''} onChange={e => set({ workMax: { ...body.workMax, [k]: parseFloat(e.target.value) || undefined } })} placeholder="кг" />
            </label>
          ))}
        </div>
      </div>

      {/* ПЛ — быстрые шаблоны дней + 1-клик заполнение пустых */}
      <div style={{ ...CARD, padding: 10, borderLeft: '3px solid #a78bfa', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: '#a78bfa' }}>⚡ Быстрый старт ПЛ — шаблоны дней</div>
        <div style={{ fontSize: 10, color: DIM }}>Добавьте день из шаблона в первую неделю (или заполните пустые дни 1 кликом).</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {PL_DAY_TEMPLATES.map(t => (
            <button key={t.label} onClick={() => {
              const w0 = (bodyRef.current.customWeeks?.[0]) ?? null;
              if (!w0) return;
              const newDay = { name: t.name, dayOfWeek: firstFreeTrainingDay(w0.days as any), exercises: t.exercises.map(e => ({ ...e, sets: e.sets.map(s => ({ ...s })) })) };
              const weeks = (bodyRef.current.customWeeks ?? []).map((w, wi) => wi === 0 ? { ...w, days: [...w.days, newDay as any] } : w);
              set({ customWeeks: weeks, schedule: weeks.flatMap((w, wwi) => w.days.map((d, di) => ({ sessionIdx: weeks.slice(0, wwi).reduce((a, ww) => a + ww.days.length, 0) + di, dayOfWeek: d.dayOfWeek ?? di }))) });
            }} style={{ ...BTN_GHOST, padding: '6px 10px', fontSize: 11, minHeight: 36, borderColor: 'rgba(167,139,250,0.25)', color: '#a78bfa' }}>{t.icon} {t.label}</button>
          ))}
        </div>
        {(() => {
          const isEmptyDay = (d: PLDay) => !(d.exercises ?? []).some(e => e.name && e.name.trim());
          const hasEmpty = (body.customWeeks ?? []).some(w => w.days.some(isEmptyDay));
          if (!hasEmpty) return null;
          const fillEmptyPL = () => {
            const weeks = (bodyRef.current.customWeeks ?? []).map(w => ({
              ...w,
              days: w.days.map(d => {
                if (!isEmptyDay(d)) return d;
                const name = (d.name || '').toLowerCase();
                let tpl = PL_DAY_TEMPLATES[0];
                if (name.includes('жим')) tpl = PL_DAY_TEMPLATES[1];
                else if (name.includes('тяг')) tpl = PL_DAY_TEMPLATES[2];
                else if (d.dayOfWeek === 1) tpl = PL_DAY_TEMPLATES[1];
                else if ((d.dayOfWeek ?? 0) >= 2) tpl = PL_DAY_TEMPLATES[2];
                return { ...d, exercises: tpl.exercises.map(e => ({ ...e, sets: e.sets.map(s => ({ ...s })) })) };
              }),
            }));
            set({ customWeeks: weeks });
          };
          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', background: 'rgba(167,139,250,0.06)', borderRadius: 8, padding: '6px 8px', border: '1px dashed rgba(167,139,250,0.3)' }}>
              <span style={{ fontSize: 10, color: '#a78bfa', fontWeight: 700 }}>⚡ Пустые дни — 1 клик</span>
              <span style={{ fontSize: 10, color: DIM, flex: '1 1 180px' }}>Заполнит каждый пустой день базовым шаблоном (Присед/Жим/Тяга)</span>
              <button style={{ ...BTN, padding: '6px 12px', fontSize: 11, minHeight: 32, background: 'linear-gradient(135deg,#a78bfa,#7c3aed)', color: '#fff' }} onClick={fillEmptyPL}>⚡ Заполнить пустые</button>
            </div>
          );
        })()}
      </div>

      {/* Слабые точки ПЛ — диагностика по движениям */}
      <div style={{ ...CARD, padding: 10, borderLeft: '2px solid #ef4444' }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: '#ef4444', marginBottom: 6 }}>🎯 Слабые точки ПЛ-движений</div>
        {(['bench', 'squat', 'deadlift', 'ohp', 'row', 'pulldown', 'incline_press'] as Lift[]).map(lift => {
          const liftLabel: Record<string, string> = { bench: 'Жим лёжа', squat: 'Присед', deadlift: 'Тяга', ohp: 'Жим стоя', row: 'Тяга в наклоне', pulldown: 'Тяга блока', incline_press: 'Жим наклон' };
          const weakPoints = WEAK_POINTS_BY_LIFT[lift] ?? [];
          if (weakPoints.length === 0) return null;
          return (
            <div key={lift} style={{ marginBottom: 6 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: DIM_STRONG, marginBottom: 3 }}>{liftLabel[lift] ?? lift}:</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                {weakPoints.map((wp: WeakPoint) => {
                  const diag = diagnoseWeakPoint(lift, wp);
                  return (
                    <button
                      key={wp}
                      onClick={() => {
                        if (!weeks[0]?.days[0]) return;
                        const d0 = weeks[0].days[0];
                        const newExercises = diag.assistance.slice(0, 2).map(name => ({
                          name, lift: 'accessory' as const, muscle: lift === 'bench' || lift === 'incline_press' ? 'chest' : lift === 'squat' ? 'legs' : lift === 'deadlift' ? 'back' : lift === 'ohp' ? 'shoulders' : lift === 'row' || lift === 'pulldown' ? 'back' : 'back',
                          sets: [{ pct: diag.intensityPct, reps: 6, sets: 3, rir: 2 }],
                        }));
                        updateDay(0, 0, { exercises: [...d0.exercises, ...newExercises] });
                      }}
                      title={diag.description + '\n' + diag.rationale + '\nУпр: ' + diag.assistance.join(', ')}
                      style={{ padding: '5px 10px', borderRadius: 6, fontSize: 11, cursor: 'pointer', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.20)', color: '#ef4444', fontWeight: 700, minHeight: 44, textAlign: 'left', lineHeight: 1.3 }}
                      className="editor-chip"
                    >
                      <div>{diag.label}</div>
                      <div style={{ fontSize: 11, fontWeight: 400, opacity: 0.7 }}>{diag.assistance.slice(0, 2).join(' · ')}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Weeks */}
      <div style={{ fontSize: 11, fontWeight: 800, color: ACCENT }}>🗓 Шаг 1: недели ({weeks.length})</div>
      {weeks.map((w, wi) => {
        const isExp = expandedWeek === wi;
        const phaseColor = { accumulation: '#22c55e', intensification: '#f59e0b', deload: '#ef4444', peaking: '#a78bfa' }[w.phase];
        const exerciseCount = w.days.reduce((total, day) => total + day.exercises.length, 0);
        const setCount = w.days.reduce((total, day) => total + day.exercises.reduce((sets, exercise) => sets + exercise.sets.length, 0), 0);
        return (
          <div key={wi} className={`editor-week-card${isExp ? ' is-open' : ''}`} style={{ ...CARD, padding: 10, borderLeft: `3px solid ${phaseColor}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <button
                onClick={() => setExpandedWeek(isExp ? null : wi)}
                style={{ padding: '6px 10px', borderRadius: 8, fontSize: 12, fontWeight: 800, cursor: 'pointer', background: 'rgba(167,139,250,0.10)', border: `1px solid ${phaseColor}44`, color: DIM_STRONG, minHeight: 44 }}
              >{isExp ? '▼' : '▶'} Неделя {w.week}</button>
              <PhasePicker value={w.phase} options={PHASE_OPTS} onChange={v => updateWeek(wi, { phase: v as PLWeek['phase'] })} ariaLabel={`Фаза недели ${w.week}`} />
              <label style={{ fontSize: 11, color: DIM, display: 'flex', alignItems: 'center', gap: 4 }}>
                <input type="checkbox" checked={w.deload} onChange={e => updateWeek(wi, { deload: e.target.checked })} /> deload
              </label>
              <span className="editor-week-summary">{w.days.length} дн. · {exerciseCount} упр. · {setCount} подх.</span>
              <button aria-label={`Копировать неделю ${w.week}`} style={{ ...ICON_CARD_BTN, width: 'auto', minWidth: 44, padding: '6px 10px', fontSize: 10 }} onClick={() => cloneWeek(wi)} title="Клонировать — копия недели">⧉ Копировать</button>
              <button aria-label={`Удалить неделю ${w.week}`} style={{ ...ICON_CARD_BTN, width: 'auto', minWidth: 44, marginLeft: 'auto', color: '#ef4444', borderColor: 'rgba(239,68,68,0.22)', background: 'rgba(239,68,68,0.08)', padding: '6px 10px', fontSize: 10 }} onClick={() => removeWeek(wi)}>✕ Удалить</button>
            </div>

            {isExp && (
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {w.days.map((d, di) => (
                    <div key={di} className="editor-session-card" style={{ padding: 8, borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                      <input style={{ ...IN, padding: '5px 8px', fontSize: 11, flex: 1, minHeight: 44 }} value={d.name} onChange={e => updateDay(wi, di, { name: e.target.value })} placeholder="Название дня" />
                      <DayOfWeekPicker
                        value={d.dayOfWeek ?? trainingDayForIndex(di)}
                        occupied={w.days.flatMap((other, otherIndex) => otherIndex === di ? [] : [other.dayOfWeek ?? trainingDayForIndex(otherIndex)])}
                        onChange={nd => updateDay(wi, di, { dayOfWeek: normalizeProgramDayOfWeek(nd, trainingDayForIndex(di)) })}
                        ariaLabel={`День недели ${d.name}`}
                      />
                      <span style={{ fontSize: 10, color: DIM }}>{d.exercises.length} упр. · {TRAINING_DAY_NAMES[d.dayOfWeek ?? di % 7]}</span>
                      <button style={{ ...ICON_CARD_BTN, width: 'auto', minWidth: 44, color: '#ef4444', borderColor: 'rgba(239,68,68,0.22)', background: 'rgba(239,68,68,0.08)', padding: '6px 10px', fontSize: 10 }} onClick={() => removeDay(wi, di)}>✕ день</button>
                    </div>
                    {d.exercises.map((ex, ei) => (
                      <div key={ei} className="editor-exercise-card" style={{ marginBottom: 6, padding: '8px 10px', borderRadius: 10, background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.14)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: DIM }}>Упр {ei + 1}</span>
                          <ExerciseLabPicker
                            value={ex.name}
                            muscle={ex.muscle ?? ''}
                            onSelect={selected => updateExercise(wi, di, ei, { name: selected.name, muscle: selected.group || ex.muscle, lift: ex.lift })}
                          />
                          <EditorPopupSelect
                            value={ex.lift}
                            options={LIFT_OPTS.map(o => ({ id: o.id, label: o.label }))}
                            onChange={v => updateExercise(wi, di, ei, { lift: v as PLExercise['lift'] })}
                            ariaLabel="Дисциплина упражнения"
                            title="Дисциплина (лифт)"
                            buttonStyle={{ flex: '0 0 100px' }}
                          />
                          <EditorPopupSelect
                            value={ex.muscle ?? ''}
                            options={[
                              ...ALL_GROUPS.map(g => ({ id: g, label: GROUP_RU[g] ?? g })),
                              ...(ex.muscle && !ALL_GROUPS.includes(ex.muscle) ? [{ id: ex.muscle, label: ex.muscle }] : []),
                            ]}
                            onChange={v => updateExercise(wi, di, ei, { muscle: v })}
                            ariaLabel="Мышца упражнения"
                            title="Мышца (группа)"
                            placeholder="Мышца"
                            buttonStyle={{ flex: '0 0 110px' }}
                          />
                          <button style={{ ...ICON_CARD_BTN, width: 36, minWidth: 36, height: 36, color: '#ef4444', borderColor: 'rgba(239,68,68,0.22)', background: 'rgba(239,68,68,0.08)', fontSize: 11 }} onClick={() => removeExercise(wi, di, ei)}>✕</button>
                        </div>
                        <PLSetEditor sets={ex.sets} lift={ex.lift} workMax={body.workMax} onChange={(sets) => updateExercise(wi, di, ei, { sets })} />
                        <input style={{ ...IN, padding: '5px 8px', fontSize: 11, width: '100%', minHeight: 44, marginTop: 4 }} value={ex.note ?? ''} onChange={e => updateExercise(wi, di, ei, { note: e.target.value })} placeholder="💬 Комментарий к упражнению (техника, цель, примечания)" />
                      </div>
                    ))}
                    <button style={{ ...CARD_ACTION, borderColor: 'rgba(0,230,138,0.18)', background: 'rgba(0,230,138,0.06)', padding: '8px 12px' }} onClick={() => addExercise(wi, di)}><span style={{ fontSize: 14, color: '#00e68a' }}>＋</span><span style={{ fontSize: 11, fontWeight: 700, color: '#00e68a' }}>Упражнение</span></button>
                  </div>
                ))}
                <button style={{ ...CARD_ACTION, borderColor: 'rgba(167,139,250,0.18)', background: 'rgba(167,139,250,0.06)', padding: '8px 12px' }} onClick={() => addDay(wi)}><span style={{ fontSize: 14, color: '#a78bfa' }}>＋</span><span style={{ fontSize: 11, fontWeight: 700, color: '#a78bfa' }}>День</span><span style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)' }}>Пн–Вс + фокус</span></button>
              </div>
            )}
          </div>
        );
      })}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button style={{ ...CARD_ACTION, flex: 1, minWidth: 140, borderColor: 'rgba(96,165,250,0.22)', background: 'linear-gradient(180deg, rgba(96,165,250,0.10), rgba(255,255,255,0.02))' }} onClick={addWeek}><span style={{ fontSize: 16, color: '#60a5fa' }}>＋</span><div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1.1 }}><span style={{ fontSize: 11, fontWeight: 800, color: '#60a5fa' }}>Неделя</span><span style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)' }}>фаза + делод</span></div></button>
        <div style={{ flex: 1, minWidth: 160, padding: '8px 10px', borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: '#60a5fa' }}>💡 Подсказка</span>
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.65)', lineHeight: 1.3 }}>Каждая 4-я неделя — делод (−30%). Ротация упражнения каждые 4 недели — защита суставов.</span>
        </div>
      </div>

      {/* PL ротация — упражнения старше 4 недель (с кнопками замены через findSubstitutions) */}
      {(body.customWeeks?.length ?? 0) >= 4 && (() => {
        const exAge: Record<string, { weeks: number }> = {};
        for (const w of body.customWeeks ?? []) {
          for (const d of w.days) {
            for (const e of d.exercises) {
              if (!e.name) continue;
              if (!exAge[e.name]) exAge[e.name] = { weeks: 0 };
              exAge[e.name].weeks++;
            }
          }
        }
        const stale = Object.entries(exAge).filter(([, v]) => v.weeks >= 4).slice(0, 5);
        if (stale.length === 0) return null;
        return (
          <div style={{ ...CARD, padding: 10, borderLeft: '2px solid #f59e0b' }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#f59e0b', marginBottom: 6 }}>🔄 Ротация ПЛ — устаревшие упражнения ({stale.length})</div>
            <div style={{ fontSize: 10, color: DIM, marginBottom: 6 }}>Клик — заменить на аналог из каталога.</div>
            {stale.map(([name, { weeks: age }]) => {
              let subs: any[] = [];
              try { subs = (findSubstitutions(name, '', new Set<string>()) || []).filter((s: any) => s?.name && s.name !== name).slice(0, 4); } catch { subs = []; }
              return (
                <div key={name} style={{ marginBottom: 4, padding: 6, borderRadius: 6, background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, flexWrap: 'wrap' }}>
                    <span style={{ color: DIM_STRONG, fontWeight: 700 }}>{name}</span>
                    <span style={{ color: '#f59e0b', fontSize: 11 }}>{age} нед</span>
                  </div>
                  {subs.length > 0 ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 4 }}>
                      {subs.map((s, si) => (
                        <button key={si} onClick={() => {
                          const updatedCustomWeeks = (bodyRef.current.customWeeks ?? []).map((w: any) => ({
                            ...w,
                            days: w.days.map((d: any) => ({
                              ...d,
                              exercises: d.exercises.map((e: any) => (e.name === name ? { ...e, name: s.name } : e)),
                            })),
                          }));
                          onChange({ ...bodyRef.current, customWeeks: updatedCustomWeeks });
                        }} style={{ padding: '4px 8px', borderRadius: 6, fontSize: 10, cursor: 'pointer', background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.25)', color: '#f59e0b', fontWeight: 600, minHeight: 32 }}>
                          {s.name}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div style={{ fontSize: 10, color: DIM, marginTop: 4, fontStyle: 'italic' }}>Аналоги не найдены — замените вручную через 🔬 лабораторию упражнений</div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* Оверлей для custom: заметки + слабые группы + расписание */}
      <div style={{ ...CARD, padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: ACCENT }}>Оверлей пользователя</div>
        <label style={{ ...SMALL, display: 'flex', flexDirection: 'column', gap: 4 }}>
          Заметки к циклу
          <textarea style={{ ...IN, minHeight: 60, resize: 'vertical' }} value={body.notes} onChange={e => set({ notes: e.target.value })} placeholder="Например: акцент на слабые группы, адаптации под восстановление" />
        </label>
        <div>
          <div style={{ fontSize: 10, color: DIM, marginBottom: 4 }}>Слабые группы (приоритет акцента)</div>
          <WeakPointChips value={body.weakPoints} onChange={(weakPoints) => set({ weakPoints })} />
        </div>
        <div>
          <div style={{ fontSize: 10, color: DIM, marginBottom: 4 }}>Расписание цикла</div>
          <div className="editor-schedule-summary">
            {body.customWeeks?.[0]?.days.map((day, index) => (
              <span key={index} className="editor-schedule-chip">
                {TRAINING_DAY_NAMES[day.dayOfWeek ?? trainingDayForIndex(index)]} · {day.name || `День ${index + 1}`}
              </span>
            ))}
            {(body.customWeeks?.[0]?.days.length ?? 0) === 0 && <span style={{ color: DIM, fontSize: 10 }}>Добавьте тренировочный день выше.</span>}
          </div>
          <div style={{ fontSize: 10, color: DIM, marginTop: 4 }}>День недели редактируется в карточке каждого тренировочного дня выше.</div>
        </div>
      </div>
    </div>
  );
};

const WEAK_OPTS = ['chest', 'back', 'quads', 'hamstrings', 'glutes', 'shoulders', 'biceps', 'triceps', 'calves', 'traps', 'forearms', 'core', 'arms'];
const WeakPointChips: React.FC<{ value: string[]; onChange: (v: string[]) => void }> = ({ value, onChange }) => {
  const toggle = (m: string) => onChange(value.includes(m) ? value.filter(x => x !== m) : [...value, m]);
  const iconFor = (m: string) => ({ chest: '💪', back: '🦍', quads: '🦵', hamstrings: '🦵', glutes: '🍑', shoulders: '🏋️', biceps: '💥', triceps: '💥', calves: '🦶', traps: '🏔️', forearms: '🤝', core: '🧱', arms: '💪' } as Record<string, string>)[m] ?? '🎯';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(124px, 1fr))', gap: 6 }}>
        {WEAK_OPTS.map(m => {
          const on = value.includes(m);
          return (
            <button key={m} onClick={() => toggle(m)} aria-pressed={on} className="editor-action-card" style={on ? { ...CARD_BTN_ACTIVE, minHeight: 54, padding: '8px 10px' } : { ...CARD_BTN, minHeight: 54, padding: '8px 10px' }}>
              <span style={{ fontSize: 13 }}>{iconFor(m)}</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: on ? '#00e68a' : '#fff', lineHeight: 1.1 }}>{GROUP_RU[m] ?? m}</span>
              <span style={{ fontSize: 9, color: on ? 'rgba(0,230,138,0.70)' : 'rgba(255,255,255,0.45)' }}>{on ? '✓ в приоритете' : 'нажмите → приоритет'}</span>
            </button>
          );
        })}
      </div>
      <MethodHint icon="🎯" title="Как работает специализация без калькулятора" text="Выберите 1-2 отстающие → им +30% сетов 6 недель за счёт других, не сверху. Через 6 недель — баланс. Так же делает BB-авто." color="#ec4899" />
    </div>
  );
};

/* ─── P2.11: BBConstraintsPanel — редактирование constraints (оборудование, травмы, avoidAxial, любимые/исключённые) + progression ─── */

const EQUIPMENT_OPTS = [
  { id: 'barbell', label: 'Штанга' }, { id: 'dumbbell', label: 'Гантели' }, { id: 'cable', label: 'Блок' },
  { id: 'machine', label: 'Тренажёр' }, { id: 'bodyweight', label: 'Свой вес' }, { id: 'suspension', label: 'TRX/петли' },
  { id: 'kettlebell', label: 'Гиря' }, { id: 'band', label: 'Резина' }, { id: 'smith', label: 'Смит' }, { id: 'plate', label: 'Блин' },
];
const LOAD_STRATEGY_OPTS = [
  { id: 'double_progression', label: 'Двойная прогрессия' }, { id: 'linear', label: 'Линейная' },
  { id: 'wave', label: 'Волновая' }, { id: 'rpe_based', label: 'По RPE' },
];
const DELOAD_PROTOCOL_OPTS = [
  { id: 'pump', label: 'Памп' }, { id: 'neural', label: 'Нейральная' },
  { id: 'full_rest', label: 'Полный отдых' }, { id: 'mini', label: 'Микро-делод' },
];
const INTENSITY_TECHNIQUE_OPTS = [
  { id: 'none', label: 'Нет' }, { id: 'rest_pause', label: 'Рест-пауза' }, { id: 'drop_set', label: 'Дроп-сет' },
  { id: 'myo_reps', label: 'Мио-репс' }, { id: 'pause_rep', label: 'Пауза' }, { id: 'mechanical_drop', label: 'Мех. дроп' },
];

const Chip: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode; color?: string }> = ({ active, onClick, children, color }) => (
  <button className="editor-chip" aria-pressed={active} onClick={onClick} style={{ padding: '8px 14px', borderRadius: 8, fontSize: 11, cursor: 'pointer', border: active ? '1px solid ' + (color || '#00e68a') : '1px solid rgba(255,255,255,0.08)', background: active ? (color || '#00e68a') + '20' : 'rgba(255,255,255,0.02)', color: active ? '#fff' : DIM, minHeight: 44 }}>{children}</button>
);

const BBConstraintsPanel: React.FC<{
  constraints: ProgramConstraints;
  progression: ProgramProgression;
  onChangeConstraints: (c: ProgramConstraints) => void;
  onChangeProgression: (p: ProgramProgression) => void;
}> = ({ constraints, progression, onChangeConstraints, onChangeProgression }) => {
  const toggleEq = (eq: string) => {
    const arr = constraints.equipment ?? [];
    onChangeConstraints({ ...constraints, equipment: arr.includes(eq) ? arr.filter(x => x !== eq) : [...arr, eq] });
  };
  const toggleIntensity = (it: IntensityTechnique) => {
    const arr = progression.intensityTechniques ?? ['none'];
    if (it === 'none') onChangeProgression({ ...progression, intensityTechniques: ['none'] });
    else onChangeProgression({ ...progression, intensityTechniques: arr.includes(it) ? arr.filter(x => x !== it && x !== 'none') : [...arr.filter(x => x !== 'none'), it] });
  };
  return (
    <div style={{ ...CARD, padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: ACCENT }}>⚙️ Параметры ББ-программы — карточки</div>
      <div>
        <div style={{ fontSize: 10, color: DIM, marginBottom: 4 }}>Оборудование (доступное) — карточка = есть в зале</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 6 }}>
          {EQUIPMENT_OPTS.map(o => {
            const on = (constraints.equipment ?? []).includes(o.id);
            return (
              <button key={o.id} onClick={() => toggleEq(o.id)} aria-pressed={on} className="editor-action-card" style={on ? { ...CARD_BTN_ACTIVE, minHeight: 48, padding: '8px 10px', flexDirection: 'row', gap: 8 } : { ...CARD_BTN, minHeight: 48, padding: '8px 10px', flexDirection: 'row', gap: 8 }}>
                <span style={{ fontSize: 12 }}>{on ? '✓' : '○'}</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: on ? '#00e68a' : '#fff' }}>{o.label}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div>
        <div style={{ fontSize: 10, color: DIM, marginBottom: 4 }}>Прогрессия весов — без калькулятора</div>
        <EditorPopupSelect
          value={progression.loadStrategy || 'double_progression'}
          options={LOAD_STRATEGY_OPTS.map(o => ({ id: o.id, label: o.label }))}
          onChange={v => onChangeProgression({ ...progression, loadStrategy: v as LoadStrategy })}
          ariaLabel="Прогрессия весов"
          title="Стратегия прогрессии"
        />
        <div style={{ marginTop: 4 }}><MethodHint icon="📈" title="Двойная прогрессия" text="Сначала расти повторами (8→12), затем +2.5 кг и снова 8. Без расчётов — просто следи за диапазоном." color="#22c55e" /></div>
      </div>
      <div>
        <div style={{ fontSize: 10, color: DIM, marginBottom: 4 }}>Протокол делода — без калькулятора</div>
        <EditorPopupSelect
          value={progression.deloadProtocol || 'pump'}
          options={DELOAD_PROTOCOL_OPTS.map(o => ({ id: o.id, label: o.label }))}
          onChange={v => onChangeProgression({ ...progression, deloadProtocol: v as DeloadProtocol })}
          ariaLabel="Протокол делода"
          title="Протокол разгрузки"
        />
        <div style={{ marginTop: 4 }}><MethodHint icon="🔄" title="Делод" text="Каждая 4-я неделя — −30% объёма, вес тот же, RIR +2. Лёгкая неделя спасает суставы лучше полного отдыха." color="#f59e0b" /></div>
      </div>
      <div>
        <div style={{ fontSize: 10, color: DIM, marginBottom: 4 }}>Интенсив-техники — карточка = приём на памп-дне</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 6 }}>
          {INTENSITY_TECHNIQUE_OPTS.map(o => {
            const on = (progression.intensityTechniques ?? ['none']).includes(o.id as IntensityTechnique);
            const hint: Record<string, string> = { none: 'без добивок', rest_pause: '15-20с пауза', drop_set: '−20% вес', myo_reps: 'мини-сеты', pause_rep: 'пауза 1с', mechanical_drop: 'смена угла' };
            return (
              <button key={o.id} onClick={() => toggleIntensity(o.id as IntensityTechnique)} aria-pressed={on} className="editor-action-card" style={on ? { ...CARD_BTN_ACTIVE, minHeight: 48, padding: '8px 10px' } : { ...CARD_BTN, minHeight: 48, padding: '8px 10px' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: on ? '#00e68a' : '#fff' }}>{o.label}</span>
                <span style={{ fontSize: 9, color: on ? 'rgba(0,230,138,0.70)' : 'rgba(255,255,255,0.45)' }}>{hint[o.id] ?? ''}</span>
              </button>
            );
          })}
        </div>
        <div style={{ marginTop: 4 }}><MethodHint icon="🔥" title="Когда применять" text="Дроп/мио — только на последнем подходе изоляции, не на базе. 1-2 приёма на неделю достаточно." color="#ef4444" /></div>
      </div>
      <label style={{ ...SMALL, display: 'flex', alignItems: 'center', gap: 6 }}>
        <input type="checkbox" checked={constraints.avoidAxialLoad ?? false} onChange={e => onChangeConstraints({ ...constraints, avoidAxialLoad: e.target.checked })} />
        🦴 Убрать осевую нагрузку (присед/становая/жим стоя)
      </label>
    </div>
  );
};

export { BBEditor, SessionList, BlockList, SetEditor, PLEditor, WeakPointChips, BBConstraintsPanel };
