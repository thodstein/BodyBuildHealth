/**
 * ProgramManagerPanel.tsx — менеджер и редактор программ пользователя (зона «Планировщик», режим «Мои программы»).
 *
 * Три действия:
 *  - 🆕 Создать с нуля (ББ / ПЛ)
 *  - 🔍 Взять из библиотеки (клон FullProgram → редактируемая ББ; клон LMS-цикла → ПЛ-ссылка, цикл immutable)
 *  - 📂 Загрузить свою (список сохранённых UserProgram: открыть / удалить)
 *
 * Редактор:
 *  - Мета (название, цель, уровень, дни/нед).
 *  - ББ: недели → сессии → блоки (упражнение + схема подходов). Добавить/удалить блок, добавить неделю.
 *  - ПЛ: ссылка на immutable LMS-цикл (только просмотр) + пользовательский оверлей
 *    (расписание, заметки, рабочие максимумы, слабые группы). Процентки цикла НЕ редактируются.
 *
 * Сохранение → ProgramStore (localStorage, версионирование через revisions).
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { getAllPrograms } from '../../../engines/complete-program-library.engine';
import type { FullProgram } from '../../../engines/complete-program-library.engine';
import { cycleTemplateToFullProgram } from '../../../engines/bb/cycle-to-plan';
import { SPLIT_PATTERNS } from '../../../engines/bb/bb-split-patterns';
import { WOMENS_PROGRAMS, CUSTOM_PROGRAMS } from './programs-data';
import { useOriginalPrograms } from './useOriginalPrograms';
import { LMS_CYCLES } from '../../../data/lms-cycles/lms-cycle-index';
import { getReferencedCycle } from '../../../engines/user-program/program-store';
import {
  loadUserPrograms, saveUserProgram, deleteUserProgram, deleteRevision,
  cloneFromLibrary, cloneFromCycle, createBlank, userWeekToBBPlan, validateProgram, getProgramBlockingIssue, isUserProgramShape,
} from '../../../engines/user-program/program-store';
import type {
  UserProgram, BBProgramBody, PLProgramBody, UserWeek, UserSession, UserBlock, UserSet,
  ProgramConstraints, ProgramProgression,
} from '../../../engines/user-program/user-program.types';
import { newId } from '../../../engines/user-program/user-program.types';
import { HybridPlanPanel } from './HybridPlanPanel';
import { MacrocyclePanel } from '../SRCBBScreen_parts/MacrocyclePanel';
import { MethodologyEncyclopedia } from './MethodologyEncyclopedia';
import { ExerciseLabPicker } from './ExerciseLabPicker';
import { BbProgramLibraryPicker } from './BbProgramLibraryPicker';
import { BbContextPanel } from './program-editor-context-panels';
import { BBEditor, PLEditor, BBConstraintsPanel, TRAINING_DAY_NAMES } from './ProgramEditorComponents';
import { ProgramEditor } from './ProgramEditorView';
import { ConfirmDialogProvider, useConfirmDialog } from './ConfirmDialog';
import { TrainingModal } from './TrainingModal';
import { useProgramUndo } from './hooks/useProgramUndo';
import { PlanDiagnosticsPanel, InteractiveVolumePanel, ExerciseInfoPanel, ProgressionCoach, SplitConsultant, PlanSummaryTable, AutoPeriodizationPanel, SubstitutionPanel } from './editor-panels';
import { LoadGuardPanel, RealMRVPanel, RIRCalibrationPanel, TonnageEstimatePanel, StickingPointPanel, PlateAutoPanel, WhatIfGuardPanel, ReadinessForecastPanel, CheckinGuardPanel, BiomechanicsPanel } from './ProGuardPanels';
import { QuickTemplate, QuickTemplatesGrid } from './ProgramQuickTemplates';
import { ProPanelSection, ProPanelsGroup, ThemeToggle } from './ProPanelSection';
import { MesoHeatmap } from './MesoHeatmap';
import { ProgramNotes, ProgramMetricsCSV, RecoveryBadge, ProgramStrengthScore } from './ProgramExtras';
import { ProgramRevisionsDiff } from './ProgramRevisions';
import { StrengthDiaryPanel } from './StrengthDiaryPanel';
import { SET_TEMPLATES } from './program-types';
import {
  plLmsScheduleDays,
  suggestExercisesForGroup,
} from '../../../engines/manual-constructor';
import { tempoFor } from '../../../engines/bb/bb-tempo-rest';
import { INTENSITY_TECHNIQUES, type IntensityTechnique } from '../../../engines/bb/bb-autocoach.engine';
import { RIR_MATRIX } from '../../../engines/rir-matrix.engine';
import { loadTrainingProfile } from './training-profile';
import { TrainingProfileCard } from './TrainingProfileCard';
import { subscribePlannerApply, clearPlannerApply, type PlannerApply } from './planner-bridge';
import { completeAnnualBlockImport } from './planner-bridge-handlers';
import { calcBBPlanMetrics } from '../../../engines/bb/bb-metrics.engine';
import { computePlanQualityFor } from '../../../engines/manual-constructor';
import type { BBPlan } from '../../../engines/bb/bb-builder.engine';
import { designerToUserWeeks, applyDesignPhasesToWeeks } from '../../../engines/periodization/designer-to-program';
import { macrocycleToBBProgram } from '../../../engines/lms/macrocycle-to-bb';
import { deserializeMacro } from '../../../engines/lms/macrocycle.engine';
import type { MacrocycleDesign } from '../../../engines/periodization-designer.engine';
import type { Macrocycle } from '../../../engines/lms/macrocycle.engine';
import { ACCENT, ACCENT_LINE, CARD, BTN, BTN_GHOST, SMALL, DIM, DIM_STRONG, IN, panelStyle, STEP_PILL } from './training-ui';
import { ManualHeader, ManualStepper, InfoBanner, SectionCard, Badge, ProgressBar } from './ManualUI';
import { ManualLibraryGallery } from './ManualLibraryGallery';
import { EditorPopupSelect } from './EditorPopup';
import { GROUP_RU } from './program-types';
import { labTrainingAdjust } from './lab-training-adjust';
import { distributePhases, PHASE_CONFIGS } from './phase-periodization';
import { suggestFeeders } from '../../../engines/bb/bb-autocoach.engine';
import { useDataLink } from '../../../core/data-link';
import { findSubstitutions } from '../../../engines/exercise-substitution.engine';
import { getVolumeLandmarks } from '../../../engines/volume-landmarks.engine';
import { EXERCISE_CATALOG } from '../../../core/exercise-catalog';
import type { Exercise } from '../../../core/types';
import { detectLift } from '../../../engines/lms/lms-to-pl';
import { ManualProgramWizard, type WizardStep, type WizardDirection } from './ManualProgramWizard';
import { buildBBUserProgramFromProfile } from './auto-fill-draft';
import { sessionDayOfWeek } from './program-editor-logic';
import { periodLabelRu } from '../../../data/lms-cycles/period-labels';

const GOAL_OPTS = [
  { id: 'hypertrophy', label: 'Масса' }, { id: 'powerlifting', label: 'Сила (ПЛ)' },
  { id: 'peaking', label: 'Пик/сушка' }, { id: 'recomp', label: 'Рекомпозиция' }, { id: 'rehab', label: 'Реабилитация' },
];
const LEVEL_OPTS = [
  { id: 'beginner', label: 'Новичок' }, { id: 'intermediate', label: 'Средний' },
  { id: 'advanced', label: 'Опытный' }, { id: 'enhanced', label: 'Enhanced' },
];

/** P2: относительное время обновления программы («3 дн назад») вместо голой даты. */
function timeAgo(iso?: string): string {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const diff = Date.now() - t;
  if (diff < 60000) return 'только что';
  const min = Math.floor(diff / 60000);
  if (min < 60) return `${min} мин назад`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} ч назад`;
  const d = Math.floor(h / 24);
  if (d < 31) return `${d} дн назад`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo} мес назад`;
  return `${Math.floor(mo / 12)} г назад`;
}

const DIR_COLOR: Record<string, string> = { bb: '#00e68a', pl: '#a78bfa', hybrid: '#3b82f6' };
const DIR_LABEL: Record<string, string> = { bb: 'ББ', pl: 'ПЛ', hybrid: 'Hybrid' };
const SOURCE_LABEL: Record<string, string> = {
  custom: 'своя', cloned_library: 'из библиотеки', cloned_cycle: 'клон цикла', from_build: 'из сборки',
};

const btn: React.CSSProperties = { ...BTN, flex: 1, minWidth: 0 };
const ghostBtn: React.CSSProperties = { ...BTN_GHOST, flex: 1, minWidth: 0 };
/** Цветной бейдж-метрика для сводки на шаге «Итог». */
const finalBadge = (bg: string, bd: string, fg: string): React.CSSProperties => ({
  padding: '4px 10px', borderRadius: 999, fontSize: 10, fontWeight: 700,
  background: bg, border: `1px solid ${bd}`, color: fg, whiteSpace: 'nowrap',
});

/** Последовательные шаги ручного конструктора (как в BB-авто):
 * 1 «Выбор» — создать/клонировать/открыть программу (ББ/ПЛ/БВ);
 * 2 «Редактор» — правка недель/сессий/подходов;
 * 3 «Итог» — валидация, метрики, экспорт и сохранение. */
type MStep = 'choose' | 'editor' | 'final';
const MSTEP_LIST: MStep[] = ['choose', 'editor', 'final'];
const MSTEP_LABELS: Record<MStep, string> = {
  choose: '1 Выбор',
  editor: '2 Редактор',
  final: '3 Итог',
};

/** Режим конструктора: «Стандартный» (базовая сборка/загрузка/отчёт, без профиля)
 *  или «Профессиональный» (все инструменты тренера). */
export type ManualMode = 'standard' | 'pro';

const MODE_META: Record<ManualMode, { label: string; icon: string; hint: string; color: string }> = {
  standard: {
    label: 'Стандартный',
    icon: '✋',
    hint: 'Базовая ручная сборка программы, загрузка и редактирование, отчёт по кнопке',
    color: '#00e68a',
  },
  pro: {
    label: 'Профессиональный',
    icon: '🎓',
    hint: 'Полный инструментарий тренера: профиль, лаб-коррекция, периодизация, методики, качества, замены, фидер-сеты и др.',
    color: '#a78bfa',
  },
};

const ManualModeToggle: React.FC<{ mode: ManualMode; onMode: (m: ManualMode) => void }> = ({ mode, onMode }) => (
  <div role="radiogroup" aria-label="Режим ручного конструктора" style={{ display: 'flex', gap: 4, padding: 4, borderRadius: 12, background: 'rgba(24,24,27,0.15)', border: '1px solid rgba(255,255,255,0.04)', flexWrap: 'wrap' }}>
    {(['standard', 'pro'] as ManualMode[]).map((m) => {
      const meta = MODE_META[m];
      const active = mode === m;
      return (
        <button
           key={m}
           role="radio"
           aria-checked={active}
          onClick={() => { hapticImpact('medium'); onMode(m); }}
          style={{
            flex: '0 0 auto',
            minWidth: 120,
            padding: '8px 12px',
            borderRadius: 9,
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 2,
            whiteSpace: 'nowrap',
            border: active ? `2px solid ${meta.color}` : '1px solid rgba(255,255,255,0.06)',
            background: active ? `${meta.color}20` : 'rgba(255,255,255,0.02)',
            color: active ? '#ffffff' : '#fff',
            boxShadow: active ? `0 0 0 1px ${meta.color}40, 0 2px 10px rgba(0,0,0,0.25)` : 'none',
          }}
        >
          <span style={{ fontSize: 16 }}>{meta.icon}</span>
          <span>{meta.label}</span>
          <span style={{ fontSize: 11, fontWeight: 400, opacity: 0.8, lineHeight: 1.2, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis' }}>{meta.hint}</span>
        </button>
      );
    })}
  </div>
);

import { hapticImpact } from '../../../core/telegram';

export const ProgramManagerPanel: React.FC = () => {
  const { confirm } = useConfirmDialog();
  const [programs, setPrograms] = useState<UserProgram[]>(() => loadUserPrograms());
  const [editing, setEditing] = useState<UserProgram | null>(null);
  const [pendingAutoFill, setPendingAutoFill] = useState(false);
  const [pickerOpen, setPickerOpen] = useState<'bb' | 'pl' | null>(null);
  const [toast, setToast] = useState('');
  // Режим конструктора: «Стандартный» (базовая сборка/загрузка/отчёт) vs «Профессиональный» (все инструменты).
  // Персистится в localStorage 'he_manual_mode', чтобы выбор пользователя сохранялся между сессиями.
  const [manualMode, setManualMode] = useState<ManualMode>(() => {
    try { return (localStorage.getItem('he_manual_mode') as ManualMode) || 'standard'; } catch { return 'standard'; }
  });
  useEffect(() => { try { localStorage.setItem('he_manual_mode', manualMode); } catch {} }, [manualMode]);
  // Онбординг конструктора — показывается при первом запуске, скрывается кнопкой
  const [onboardingOpen, setOnboardingOpen] = useState<boolean>(() => {
    try { return localStorage.getItem('he_manual_onboarding_done') !== '1'; } catch { return true; }
  });
  const [quickTplCollapsed, setQuickTplCollapsed] = useState<boolean>(() => {
    try {
      const v = localStorage.getItem('he_manual_quick_collapsed');
      if (v === '1') return true;
      if (v === '0') return false;
      // По умолчанию свёрнут в списке с программами, развёрнут в пустом
      const hasStoredPrograms = (() => { try { const raw = localStorage.getItem('he_user_programs'); const arr = raw ? JSON.parse(raw) : []; return Array.isArray(arr) && arr.length > 0; } catch { return false; } })();
      return hasStoredPrograms;
    } catch { return false; }
  });
  useEffect(() => { try { localStorage.setItem('he_manual_quick_collapsed', quickTplCollapsed ? '1' : '0'); } catch {} }, [quickTplCollapsed]);

  // Последовательные шаги конструктора. Создание/открытие программы
  // автоматически переводит на шаг «Редактор», сохранение на «Итог» — обратно в выбор.
  const [mstep, setMstep] = useState<MStep>('choose');
  useEffect(() => {
    if (editing && mstep === 'choose') setMstep('editor');
  }, [editing, mstep]);
  useEffect(() => {
    if (!editing) setMstep('choose');
  }, [editing]);

  const renderMstepNav = () => (
    <ManualStepper
      steps={MSTEP_LIST.map(s => ({ id: s, label: MSTEP_LABELS[s] }))}
      active={mstep}
      onChange={(id) => {
        if ((id === 'editor' || id === 'final') && !editing) return;
        setMstep(id as MStep);
      }}
      disabledIds={!editing ? new Set(['editor', 'final']) : undefined}
    />
  );

  // F3.1: Undo/Redo history через useProgramUndo hook (извлечено из inline-кода)
  const { pushSnapshot, undo, redo } = useProgramUndo(editing, setEditing);
  const onEditChange = useCallback((next: UserProgram) => {
    pushSnapshot(next);
    setEditing(next);
  }, [pushSnapshot]);

  useEffect(() => {
    if (!editing) setCompareIds([]);
  }, [editing]);

  // P2.6: поиск/сортировка/фильтр
  const [search, setSearch] = useState('');
  const [filterDir, setFilterDir] = useState<'all' | 'bb' | 'pl' | 'hybrid'>('all');
  const [sortBy, setSortBy] = useState<'updated' | 'title' | 'days'>('updated');
  // P2-5: сравнение двух программ
  const [compareIds, setCompareIds] = useState<string[]>([]);

  const refresh = useCallback(() => setPrograms(loadUserPrograms()), []);
  const flash = useCallback((m: string) => { setToast(m); setTimeout(() => setToast(''), 2200); }, []);

  const closeEditor = useCallback(() => {
    setEditing(null);
    setPendingAutoFill(false);
    setMstep('choose');
    refresh();
  }, [refresh]);

  // P2.1: визард создания ББ-программы (5 шагов: направление → цель → уровень → дни/нед → preview → save)
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState<WizardStep>(1);
  const [wizardDir, setWizardDir] = useState<WizardDirection>('bb');
  const [wizardGoal, setWizardGoal] = useState('hypertrophy');
  const [wizardLevel, setWizardLevel] = useState('intermediate');
  const [wizardDays, setWizardDays] = useState(4);
  const [wizardWeeks, setWizardWeeks] = useState(8);
  // P0-2: заготовка со структурой из SPLIT_PATTERNS — вместо пустой программы.
  // Дни недели и фокусы берутся из расписания сплита (тяж/памп), блоки пустые — заполняются вручную.
  const buildBBSkeleton = (days: number, weeks: number): UserWeek[] => {
    const pattern =
      SPLIT_PATTERNS.find(pp => pp.sessionsPerRotation === days && pp.schedule.some(d => d.kind === 'тренировка'))
      ?? [...SPLIT_PATTERNS].sort((a, b) => Math.abs(a.sessionsPerRotation - days) - Math.abs(b.sessionsPerRotation - days))[0]
      ?? SPLIT_PATTERNS[0];
    if (!pattern) return [];
    const sessions: UserSession[] = pattern.schedule
      .map((d, di) => ({ d, di }))
      .filter(x => x.d.kind === 'тренировка')
      .map((x, si) => ({
        id: newId('ses'),
        name: 'День ' + (si + 1),
        dayOfWeek: x.di,
        focus: x.d.sessionTag ?? '',
        blocks: [],
      }));
    return Array.from({ length: weeks }, (_, wi) => ({
      week: wi + 1,
      phase: 'accumulation' as const,
      deload: false,
      sessions: sessions.map(s => ({ ...s, id: newId('ses') })),
    }));
  };
  const startCreate = (dir: 'bb' | 'pl' | 'hybrid') => {
    // Быстрые CTA и визард используют один auto-fill путь. Это не даёт
    // стандартному режиму терять trainingFocus и recovery-метрики профиля.
    const p = createBlank(dir);
    p.meta.title = dir === 'bb' ? 'Новая ББ-программа' : dir === 'pl' ? 'Новая ПЛ-программа' : 'Новый Powerbuilder-план';
    p.meta.goal = dir === 'pl' ? 'powerlifting' : dir === 'hybrid' ? 'strength_mass' : 'hypertrophy';
    p.meta.level = 'intermediate';
    p.meta.daysPerWeek = 4;
    p.meta.weeks = 8;
    // P0: forward trainingFocus из профиля (если есть) или из goal
    const prof = loadTrainingProfile();
    if (dir === 'bb' || dir === 'hybrid') {
      const focusFromProfile = prof.trainingFocus;
      p.meta.trainingFocus = focusFromProfile || (p.meta.goal === 'strength_mass' ? 'strength' : 'hypertrophy');
    }
    if (dir === 'bb' && p.bb) {
      // P0-2: стартуем со структурой сплита, авто-сборка не перетирает заготовку
      p.bb.weeks = buildBBSkeleton(p.meta.daysPerWeek, p.meta.weeks);
      setPendingAutoFill(false);
      flash('🆕 Новая программа: дни из сплита, заполните упражнения');
    } else {
      setPendingAutoFill(true);
      flash('🆕 Создаём программу из профиля…');
    }
    setEditing(p);
  };
  const finishWizard = (autoFill = false) => {
    const p = createBlank(wizardDir);
    p.meta.title = wizardDir === 'bb' ? 'Моя ББ-программа' : wizardDir === 'pl' ? 'Моя ПЛ-программа' : 'Мой Powerbuilder-план';
    p.meta.goal = wizardDir === 'pl' ? 'powerlifting' : wizardGoal;
    p.meta.level = wizardLevel;
    p.meta.daysPerWeek = wizardDays;
    p.meta.weeks = wizardWeeks;
    // Быстрый скелет без авто-сборки: заполняем структуру по выбранным дням/неделям, чтобы не было рассинхрона meta ↔ weeks
    if (!autoFill) {
      if (wizardDir === 'bb' && p.bb) {
        p.bb.weeks = buildBBSkeleton(wizardDays, wizardWeeks);
      } else if (wizardDir === 'pl' && p.pl) {
        // PL-скелет: wizardWeeks недель, каждая с wizardDays днями (присед/жим/тяга по очереди)
        const lifts: Array<'squat'|'bench'|'dead'> = ['squat','bench','dead'];
        const dayNames = ['Присед','Жим','Тяга','Подсобка','Подсобка 2','Подсобка 3','Подсобка 4'];
        p.pl.customWeeks = Array.from({ length: wizardWeeks }, (_, wi) => ({
          week: wi + 1,
          phase: (wi % 4 === 3 ? 'deload' : 'accumulation') as 'deload' | 'accumulation',
          deload: wi % 4 === 3,
          days: Array.from({ length: wizardDays }, (_, di) => ({
            name: dayNames[di % dayNames.length] + (wizardDays > 3 && di >= 3 ? ` ${di+1}` : ''),
            dayOfWeek: di % 7,
            exercises: [{ name: '', lift: lifts[di % lifts.length], muscle: lifts[di % lifts.length] === 'squat' ? 'legs' : lifts[di % lifts.length] === 'bench' ? 'chest' : 'back', sets: [{ pct: 0.7, reps: 5, sets: 3, rir: 2 }] }],
          })),
        }));
        p.pl.schedule = Array.from({ length: wizardDays }, (_, i) => ({ sessionIdx: i, dayOfWeek: i % 7 }));
      } else if (wizardDir === 'hybrid' && p.hybrid) {
        p.hybrid.bbWeeks = buildBBSkeleton(Math.max(1, wizardDays - 2), wizardWeeks);
        p.hybrid.weeksOverride = wizardWeeks;
      }
    }
    setWizardOpen(false);
    setPendingAutoFill(autoFill);
    setEditing(p);
  };
  const setWizardDirection = (direction: WizardDirection, defaultGoal: string) => { setWizardDir(direction); setWizardGoal(defaultGoal); };

  // P2.4: экспорт программы в текст (для копирования)
  const exportProgram = (p: UserProgram) => {
    const lines: string[] = [];
    lines.push(`# ${p.meta.title}`);
    lines.push(`Направление: ${p.meta.direction} | Цель: ${p.meta.goal} | Уровень: ${p.meta.level}`);
    lines.push(`${p.meta.daysPerWeek} дн/нед × ${p.meta.weeks} нед`);
    lines.push('');
    if (p.bb?.weeks) {
      p.bb.weeks.forEach((w, wi) => {
        lines.push(`## Неделя ${w.week} (${w.phase}${w.deload ? ', делод' : ''})`);
        if (w.note) lines.push(`  > Заметка недели: ${w.note}`);
        w.sessions.forEach((s, si) => {
          lines.push(`\n### День ${s.dayOfWeek || si + 1}: ${s.name} (${s.focus})`);
          if (s.note) lines.push(`  > Заметка: ${s.note}`);
          s.blocks.forEach((b) => {
            const setsStr = b.sets.map((set) => {
              const r = set.reps === 'AMRAP' ? 'AMRAP' : `${set.reps}×`;
              const w = set.weight ? ` @${set.weight}кг` : '';
              return `${r}${w}`;
            }).join(', ');
            lines.push(`  - ${b.exerciseName} (${GROUP_RU[b.muscle] || b.muscle}) — ${setsStr} RIR${b.sets[0]?.rir ?? '-'}${b.note ? ' (' + b.note + ')' : ''}`);
          });
        });
      });
    } else if (p.pl) {
      lines.push(`ПЛ-цикл: ${p.pl.sourceCycleId}`);
      lines.push(`Сессии: ${p.pl.schedule.length}, рабочие ПМ: ${JSON.stringify(p.pl.workMax)}`);
      if (p.pl.notes) lines.push(`\nЗаметки: ${p.pl.notes}`);
    } else if (p.hybrid) {
      lines.push('Hybrid: ПЛ + ББ');
      lines.push(`ПЛ-цикл: ${p.hybrid.plRef?.sourceCycleId || 'не выбран'}`);
      lines.push(`ББ-недель: ${p.hybrid.bbWeeks?.length ?? 0}`);
      for (const w of p.hybrid.bbWeeks ?? []) {
        lines.push(`\n## Неделя ${w.week} (${w.phase}${w.deload ? ', делод' : ''})`);
        if (w.note) lines.push(`  > Заметка недели: ${w.note}`);
        for (const s of w.sessions ?? []) {
          lines.push(`\n### ${s.name}`);
          if (s.note) lines.push(`  > Заметка: ${s.note}`);
          for (const b of s.blocks ?? []) lines.push(`  - ${b.exerciseName} (${GROUP_RU[b.muscle] || b.muscle}) — ${b.sets.map(set => `${set.reps}×${set.weight ? ` @${set.weight}кг` : ''}`).join(', ')}`);
        }
      }
    }
    return lines.join('\n');
  };
  const copyProgramToClipboard = (p: UserProgram) => {
    const text = exportProgram(p);
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(
        () => flash('📋 Скопировано в буфер обмена'),
        () => flash('⚠ Не удалось скопировать')
      );
    } else {
      // Fallback: textarea + execCommand
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); flash('📋 Скопировано'); }
      catch { flash('⚠ Не удалось скопировать'); }
      document.body.removeChild(ta);
    }
  };

  const startCloneLibrary = (program: FullProgram) => {
    const p = cloneFromLibrary(program);
    setEditing(p);
    setPickerOpen(null);
    flash('🔗 Программа клонирована (' + program.weeks.length + ' нед)');
  };

  const startCloneCycle = (cycleId: string) => {
    const p = cloneFromCycle(cycleId);
    if (!p) { flash('⚠ Цикл не найден'); return; }
    setEditing(p);
    setPickerOpen(null);
    flash('🔗 ПЛ-цикл подключён (immutable, оверлей редактируем)');
  };

  const openExisting = (id: string) => {
    const p = programs.find(x => x.meta.id === id) ?? null;
    setEditing(p);
  };

  const removeProgram = async (id: string) => {
    // F4: ConfirmDialog вместо window.confirm
    const ok = await confirm({ title: 'Удалить программу безвозвратно?', message: 'Это действие нельзя отменить.', confirmLabel: 'Удалить', danger: true });
    if (!ok) return;
    deleteUserProgram(id);
    refresh();
    if (editing?.meta.id === id) setEditing(null);
    flash('🗑 Удалено');
  };

  const commit = (note?: string): boolean => {
    if (!editing) return false;
    const blockingIssue = getProgramBlockingIssue(editing);
    if (blockingIssue) {
      flash('⚠ Не сохранено: ' + blockingIssue.message);
      return false;
    }
    saveUserProgram(editing, note);
    refresh();
    // Годовой план: если программа открыта из блока (he_annual_block_pending) —
    // вернуть изменения в блок годового плана.
    if (completeAnnualBlockImport(editing)) {
      flash('✅ Сохранено · ↩ Блок годового плана обновлён');
    } else {
      flash('✅ Сохранено');
    }
    return true;
  };

  // Полный каталог программ: библиотека + женские + авторские. Используется в обоих ветках UI.
  const originalPrograms = useOriginalPrograms();
  const allLibraryPrograms = useMemo(() => [
    ...getAllPrograms(),
    ...WOMENS_PROGRAMS,
    ...CUSTOM_PROGRAMS,
    ...originalPrograms,
  ], [originalPrograms]);
  const plCycles = useMemo(() => LMS_CYCLES, []);

  // P2.6: фильтрация + сортировка
  const filteredPrograms = useCallback(() => {
    let result = programs;
    // Поиск по title
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      result = result.filter(p => p.meta.title.toLowerCase().includes(q));
    }
    // Фильтр по direction
    if (filterDir !== 'all') {
      result = result.filter(p => p.meta.direction === filterDir);
    }
    // Сортировка
    const sorted = [...result];
    if (sortBy === 'updated') sorted.sort((a, b) => (b.meta.updatedAt || '').localeCompare(a.meta.updatedAt || ''));
    else if (sortBy === 'title') sorted.sort((a, b) => a.meta.title.localeCompare(b.meta.title, 'ru'));
    else if (sortBy === 'days') sorted.sort((a, b) => a.meta.daysPerWeek - b.meta.daysPerWeek);
    return sorted;
  }, [programs, search, filterDir, sortBy]);

  // ── Шаг 3 «Итог»: сводка, валидация, метрики и финальное сохранение ──
  const renderFinalStep = () => {
    if (!editing) return null;
    const p = editing;
    const dir = p.meta.direction;
    const issues = validateProgram(p);
    const errCount = issues.filter(i => i.level === 'error').length;
    const warnCount = issues.filter(i => i.level === 'warning').length;
    // Метрики BB-плана (пиковая неделя): объём/тяж-памп/RIR/перегруз по MRV.
    const bbMetrics = dir === 'bb' && p.bb?.weeks?.length ? (() => {
      try {
        const single = p.bb!.weeks!.map(w => userWeekToBBPlan(w, p.meta.level));
        const first = single[0];
        const merged: BBPlan = {
          pattern: first.pattern,
          weeks: single.map(pl => pl.weeks[0]),
          rotationMuscleVolume: first.rotationMuscleVolume,
          rationale: first.rationale,
          level: p.meta.level,
        };
        return calcBBPlanMetrics(merged);
      } catch { return null; }
    })() : null;
    const totalExercises = dir === 'bb' && p.bb?.weeks
      ? p.bb.weeks.reduce((s, w) => s + w.sessions.reduce((ss, sess) => ss + sess.blocks.length, 0), 0)
      : dir === 'pl' && p.pl
        ? p.pl.schedule.length
        : (p.hybrid?.bbWeeks ?? []).reduce((s, w) => s + (w.sessions ?? []).reduce((ss, sess) => ss + (sess.blocks ?? []).length, 0), 0);
    const overMrv = (bbMetrics?.perMuscle ?? []).filter(m => m.status === 'exceeding_mrv').length;
    const belowMev = (bbMetrics?.perMuscle ?? []).filter(m => m.status === 'below_mev').length;
    return (
      <div className="manual-constructor" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* Сводка программы */}
        <div style={{ ...CARD, padding: 12, borderLeft: `3px solid ${DIR_COLOR[dir]}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>{p.meta.title}</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: DIR_COLOR[dir] }}>
              {dir === 'bb' ? '💪 ' : dir === 'pl' ? '🏆 ' : '⚡ '}{DIR_LABEL[dir]} · {SOURCE_LABEL[p.meta.source] ?? p.meta.source}
            </span>
          </div>
          <div style={{ fontSize: 11, color: DIM, marginTop: 4, lineHeight: 1.5 }}>
            🎯 {GOAL_OPTS.find(g => g.id === p.meta.goal)?.label ?? p.meta.goal} · 📶 {LEVEL_OPTS.find(l => l.id === p.meta.level)?.label ?? p.meta.level} · 🗓 {p.meta.daysPerWeek} дн/нед × {p.meta.weeks} нед
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
            {dir === 'bb' && bbMetrics && (
              <>
                <span style={finalBadge('rgba(0,230,138,0.12)', 'rgba(0,230,138,0.3)', '#00e68a')}>📦 Сетов: {bbMetrics.totalSets}</span>
                <span style={finalBadge('rgba(96,165,250,0.12)', 'rgba(96,165,250,0.3)', '#93c5fd')}>🏋️ Тяж {Math.round(bbMetrics.тяжPct * 100)}% · 💧 Памп {Math.round(bbMetrics.пампPct * 100)}%</span>
                <span style={finalBadge('rgba(167,139,250,0.12)', 'rgba(167,139,250,0.3)', '#c4b5fd')}>RIR {bbMetrics.avgRir.toFixed(1)}</span>
                {overMrv > 0 && <span style={finalBadge('rgba(239,68,68,0.12)', 'rgba(239,68,68,0.35)', '#ef4444')}>⚠ {overMrv} выше MRV</span>}
                {belowMev > 0 && <span style={finalBadge('rgba(59,130,246,0.12)', 'rgba(59,130,246,0.35)', '#60a5fa')}>{belowMev} ниже MEV</span>}
              </>
            )}
            <span style={finalBadge('rgba(255,255,255,0.06)', 'rgba(255,255,255,0.12)', '#fff')}>📝 Упражнений: {totalExercises}</span>
          </div>
          {dir === 'bb' && p.bb?.weeks?.[0] && (() => {
            const w1 = p.bb.weeks[0];
            const days = w1.sessions.map((s, i) => `${TRAINING_DAY_NAMES[sessionDayOfWeek(s, i)]} ${s.name || 'День ' + (i + 1)} (${s.blocks.filter(b => b.exerciseName).length} упр.)`);
            if (days.length === 0) return null;
            return (
              <div style={{ fontSize: 10, color: DIM, marginTop: 8, lineHeight: 1.5, display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'baseline' }}>
                <b style={{ color: DIM_STRONG }}>🗓 Неделя 1:</b>
                {days.map((d, i) => <span key={i} style={finalBadge('rgba(255,255,255,0.05)', 'rgba(255,255,255,0.1)', '#fff')}>{d}</span>)}
              </div>
            );
          })()}
          {dir === 'pl' && p.pl && (() => {
            const isCustom = !p.pl!.sourceCycleId && !!p.pl!.customWeeks?.length;
            if (isCustom) {
              const w1 = p.pl!.customWeeks![0];
              const days = (w1?.days ?? []).map((d, i) => `${d.name || 'День ' + (i+1)} (${(d.exercises ?? []).filter(e=> e.name).length} упр.)`);
              if (days.length===0) return null;
              return (<div style={{ fontSize: 10, color: DIM, marginTop: 8, lineHeight: 1.5, display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'baseline' }}><b style={{ color: DIM_STRONG }}>🗓 Неделя 1 (PL):</b>{days.map((d,i)=><span key={i} style={finalBadge('rgba(167,139,250,0.08)','rgba(167,139,250,0.15)','rgba(167,139,250,0.9)')}>{d}</span>)}</div>);
            }
            const cyc = p.pl!.sourceCycleId ? `Цикл ${p.pl!.sourceCycleId}` : 'Цикл не выбран';
            const wm = p.pl!.workMax;
            return (<div style={{ fontSize: 10, color: DIM, marginTop: 8, lineHeight: 1.5 }}><b style={{ color: DIM_STRONG }}>🏆 {cyc}</b> · ПМ {wm.squat ?? '—'}/{wm.bench ?? '—'}/{wm.dead ?? '—'} кг · {p.pl!.schedule.length} сессий</div>);
          })()}
          {dir === 'hybrid' && p.hybrid && (() => {
            const bb = p.hybrid!.bbWeeks?.[0];
            const pl = p.hybrid!.plRef?.sourceCycleId ? `ПЛ ${p.hybrid!.plRef.sourceCycleId}` : 'ПЛ —';
            if (!bb) return (<div style={{ fontSize: 10, color: DIM, marginTop: 8 }}><b style={{ color: DIM_STRONG }}>⚡ Hybrid:</b> {pl} · ББ недель {p.hybrid!.bbWeeks?.length ?? 0}</div>);
            const days = bb.sessions.map((s,i)=> `${s.name || 'День '+(i+1)} (${(s.blocks??[]).filter(b=> b.exerciseName).length} упр.)`);
            return (<div style={{ fontSize: 10, color: DIM, marginTop: 8, lineHeight: 1.5, display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'baseline' }}><b style={{ color: DIM_STRONG }}>⚡ Hybrid Неделя 1:</b> {pl} · {days.map((d,i)=><span key={i} style={finalBadge('rgba(59,130,246,0.08)','rgba(59,130,246,0.15)','rgba(59,130,246,0.9)')}>{d}</span>)}</div>);
          })()}
        </div>

        {/* Валидация */}
        {(() => {
          if (issues.length === 0) {
            return (
              <div style={{ ...CARD, padding: 10, borderLeft: '3px solid #22c55e', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 16 }}>✅</span>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#22c55e' }}>Программа валидна</div>
                  <div style={{ fontSize: 10, color: DIM }}>Ошибок и предупреждений нет — можно сохранять.</div>
                </div>
              </div>
            );
          }
          const color = errCount > 0 ? '#ef4444' : '#f59e0b';
          const icon = errCount > 0 ? '🚫' : '⚠️';
          return (
            <div role="alert" style={{ ...CARD, padding: 10, borderLeft: `3px solid ${color}` }}>
              <div style={{ fontSize: 11, fontWeight: 800, color, marginBottom: 6 }}>
                {icon} {errCount > 0 ? `${errCount} ошибк${errCount === 1 ? 'а' : 'и'}` : `${warnCount} предупреждени${warnCount === 1 ? 'е' : 'я'}`} валидации
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {issues.slice(0, 8).map((iss, i) => (
                  <div key={i} style={{ fontSize: 10, color: iss.level === 'error' ? '#fca5a5' : '#fbbf24', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontWeight: 800 }}>{iss.level === 'error' ? '✕' : '!'}</span>
                    <span style={{ flex: 1 }}>{iss.message}</span>
                    <span style={{ color: DIM }}>{iss.code}</span>
                  </div>
                ))}
              </div>
              {issues.length > 8 && <div style={{ fontSize: 10, color: DIM, marginTop: 4 }}>…и ещё {issues.length - 8}</div>}
            </div>
          );
        })()}

        {/* Чек-лист качества — что нужно для качественного итога (видно всем, 1 клик — вернуться в Редактор) */}
        {(() => {
          try {
            const q = computePlanQualityFor(p, p.meta.level);
            const hasTitle = !!(p.meta.title && p.meta.title.trim().length >= 3);
            const hasWeeks = (p.bb?.weeks.length ?? 0) >= 1 || (p.pl?.customWeeks?.length ?? 0) >= 1 || !!p.pl?.sourceCycleId || (p.hybrid?.bbWeeks?.length ?? 0) >= 1;
            const hasEmpty = (() => { if (p.bb) return p.bb.weeks.some(w=> w.sessions.some(s=> !(s.blocks??[]).some(b=> b.exerciseName?.trim()))); if (p.pl?.customWeeks) return p.pl.customWeeks.some(w=> w.days.some(d=> !(d.exercises??[]).some(e=> e.name?.trim()))); return false; })();
            const hasDeload = p.meta.weeks < 6 || (p.bb?.weeks.some(w=> w.deload) ?? false) || (p.pl?.customWeeks?.some(w=> w.deload) ?? false);
            const daysOk = !p.bb || (p.bb.weeks[0]?.sessions.length ?? 0) === p.meta.daysPerWeek;
            const volumeOk = q ? q.perMuscle.every(m=> m.status==='ok' || m.status==='high') : true;
            const checks = [
              { ok: hasTitle, label: 'Название', hint: hasTitle ? '✓' : 'Укажите название' },
              { ok: hasWeeks && !hasEmpty, warn: hasEmpty, label: 'Наполнение', hint: !hasWeeks ? 'Нет недель' : hasEmpty ? 'Есть пустые тренировки' : 'Все тренировки заполнены' },
              { ok: volumeOk, label: 'Объём', hint: q ? `${q.score}/100 ${q.grade}` : 'Нет данных' },
              { ok: hasDeload, label: 'Делод', hint: hasDeload ? 'Есть' : 'Рекомендуется для '+p.meta.weeks+' нед' },
              { ok: daysOk, label: 'Дни', hint: daysOk ? '✓ ' + p.meta.daysPerWeek + 'д/нед' : '⚠ ' + p.meta.daysPerWeek + 'д/нед ↔ ' + (p.bb?.weeks[0]?.sessions.length ?? 0) },
            ];
            const okCnt = checks.filter(c=> (c as any).ok).length;
            const pct = Math.round(okCnt/checks.length*100);
            const col = pct>=80 ? '#22c55e' : pct>=50 ? '#f59e0b' : '#ef4444';
            return (
              <div style={{ ...CARD, padding: 10, borderLeft: `3px solid ${col}`, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ fontSize: 11, fontWeight: 800, color: col }}>✅ Чек-лист качества — {okCnt}/{checks.length} · {pct}%</span><span style={{ fontSize: 10, color: DIM }}>{pct>=80 ? 'готово' : 'вернитесь в Редактор чтобы исправить'}</span></div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>{checks.map(c=> (<div key={(c as any).label} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 6px', borderRadius: 6, background: (c as any).ok ? 'rgba(34,197,94,0.06)' : 'rgba(239,68,68,0.06)', border: `1px solid ${(c as any).ok ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)'}`}}><span style={{ width: 16, height: 16, borderRadius: 8, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, background: (c as any).ok ? '#22c55e' : '#ef4444', color: '#fff' }}>{(c as any).ok ? '✓' : '✕'}</span><span style={{ fontSize: 11, fontWeight: 700, color: (c as any).ok ? '#22c55e' : '#ef4444', minWidth: 70 }}>{(c as any).label}</span><span style={{ fontSize: 11, color: DIM_STRONG, flex: 1 }}>{(c as any).hint}</span></div>))}</div>
              </div>
            );
          } catch { return null; }
        })()}

        {/* Действия */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <button style={{ ...BTN, width: '100%', minHeight: 48 }} onClick={() => { if (commit('Сборка завершена')) closeEditor(); }}>
            💾 Сохранить и завершить
          </button>
          <div style={{ display: 'flex', gap: 6 }}>
            <button style={ghostBtn} onClick={() => setMstep('editor')}>← Назад к редактору</button>
            <button style={ghostBtn} onClick={() => copyProgramToClipboard(p)}>📋 В буфер</button>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button style={ghostBtn} onClick={() => {
              const json = JSON.stringify(p, null, 2);
              const blob = new Blob([json], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a'); a.href = url; a.download = (p.meta.title || 'program').replace(/[^\wа-яА-ЯёЁ -]/g, '') + '.json';
              a.click(); URL.revokeObjectURL(url);
              flash('📤 Экспортировано');
            }}>📤 JSON</button>
            <button style={ghostBtn} onClick={() => setEditing(null)}>✕ К списку</button>
          </div>
        </div>
      </div>
    );
  };

  if (editing) {
    const _mstepIdx = MSTEP_LIST.indexOf(mstep);
    const _mstepLabel = MSTEP_LABELS[mstep];
    if (mstep === 'final') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <ManualHeader
            title={`✋ Ручной конструктор — ${editing.meta.title || 'Программа'}`}
            subtitle={`${DIR_LABEL[editing.meta.direction] ?? editing.meta.direction} · ${GOAL_OPTS.find(g=>g.id===editing.meta.goal)?.label ?? editing.meta.goal} · ${LEVEL_OPTS.find(l=>l.id===editing.meta.level)?.label ?? editing.meta.level} · ${editing.meta.daysPerWeek} дн/нед × ${editing.meta.weeks} нед`}
            progress={{ current: _mstepIdx + 1, total: MSTEP_LIST.length, label: _mstepLabel }}
            chips={[
              { label: DIR_LABEL[editing.meta.direction] ?? editing.meta.direction, color: DIR_COLOR[editing.meta.direction] },
              { label: editing.meta.level, color: '#fff' },
            ]}
          />
          {renderMstepNav()}
          {renderFinalStep()}
        </div>
      );
    }
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <ManualHeader
          title={`✋ Ручной конструктор — ${editing.meta.title || 'Программа'}`}
          subtitle={`${DIR_LABEL[editing.meta.direction] ?? editing.meta.direction} · ${GOAL_OPTS.find(g=>g.id===editing.meta.goal)?.label ?? editing.meta.goal} · ${LEVEL_OPTS.find(l=>l.id===editing.meta.level)?.label ?? editing.meta.level} · ${editing.meta.daysPerWeek} дн/нед × ${editing.meta.weeks} нед`}
          progress={{ current: _mstepIdx + 1, total: MSTEP_LIST.length, label: _mstepLabel }}
          chips={[
            { label: DIR_LABEL[editing.meta.direction] ?? editing.meta.direction, color: DIR_COLOR[editing.meta.direction] },
            { label: editing.meta.level, color: '#fff' },
          ]}
        />
        {renderMstepNav()}
        <ProgramEditor
          program={editing}
          onChange={onEditChange}
          onSave={commit}
          onBack={closeEditor}
          onNext={() => setMstep('final')}
          mode={manualMode}
          onMode={setManualMode}
          autoFillOnMount={pendingAutoFill}
        />
      </div>
    );
  }

  // P3 — Empty-state: если ни одной программы, показать яркий CTA (5 крупных кнопок)
  // P15: Шаблоны быстрого старта для стандартного режима (без профиля/движков)
  const QUICK_TEMPLATES: Array<{ id: string; title: string; icon: string; desc: string; dir: 'bb' | 'pl' | 'hybrid'; goal: string; level: string; days: number; weeks: number; color: string }> = [
    { id: 'mass3', title: 'Масса 3д/нед', icon: '💪', desc: 'Full Body, 8 нед, новичок', dir: 'bb', goal: 'hypertrophy', level: 'beginner', days: 3, weeks: 8, color: '#22c55e' },
    { id: 'mass4', title: 'Масса 4д/нед', icon: '🏋️', desc: 'Upper/Lower, 12 нед, средний', dir: 'bb', goal: 'hypertrophy', level: 'intermediate', days: 4, weeks: 12, color: '#00e68a' },
    { id: 'strength4', title: 'Сила 4д/нед', icon: '🏆', desc: 'ПЛ-база, 12 нед, средний', dir: 'pl', goal: 'powerlifting', level: 'intermediate', days: 4, weeks: 12, color: '#a78bfa' },
    { id: 'mass5', title: 'Масса 5д/нед', icon: '🔥', desc: 'Bro split, 16 нед, опытный', dir: 'bb', goal: 'hypertrophy', level: 'advanced', days: 5, weeks: 16, color: '#f59e0b' },
    { id: 'cut4', title: 'Сушка 4д/нед', icon: '✂️', desc: 'Upper/Lower, 8 нед, средний', dir: 'bb', goal: 'cut', level: 'intermediate', days: 4, weeks: 8, color: '#3b82f6' },
    { id: 'powerbuilding4', title: 'Powerbuilder 4д/нед', icon: '⚡', desc: 'ПЛ+ББ гибрид, 12 нед', dir: 'hybrid', goal: 'strength_mass', level: 'intermediate', days: 4, weeks: 12, color: '#ec4899' },
  ];
  // Применить быстрый шаблон: создать UserProgram с реальным контентом (не пустышку).
  // Для ББ — autodraftBBPlan генерирует недели/сессии/блоки/упражнения с весами.
  // Для ПЛ — подбирается LMS-цикл под уровень/дни, заполняется customWeeks.
  // Для Powerbuilder — и то и другое.
  const applyQuickTemplate = (tpl: typeof QUICK_TEMPLATES[0]) => {
    const prof = loadTrainingProfile();
    try {
      if (tpl.dir === 'bb') {
        const userProg = buildBBUserProgramFromProfile({ title: tpl.title, goal: tpl.goal, level: tpl.level, days: tpl.days, weeks: tpl.weeks, prof });
        setEditing(userProg);
        const totalEx = userProg.bb?.weeks?.reduce((s, w) => s + w.sessions.reduce((ss, sess) => ss + sess.blocks.length, 0), 0) ?? 0;
        flash('🚀 ' + tpl.title + ' — готово: ' + userProg.bb?.weeks.length + ' нед, ' + totalEx + ' упр');
        return;
      }
      if (tpl.dir === 'pl') {
        const sessCount = tpl.days;
        let foundCycle = LMS_CYCLES.find(c => c.meta.level === tpl.level && Math.abs(c.meta.sessionsPerWeek - sessCount) <= 1);
        if (!foundCycle) foundCycle = LMS_CYCLES.find(c => Math.abs(c.meta.sessionsPerWeek - sessCount) <= 1);
        const p = createBlank('pl');
        p.meta.title = tpl.title;
        p.meta.goal = 'powerlifting';
        p.meta.level = tpl.level;
        p.meta.daysPerWeek = tpl.days;
        p.meta.weeks = tpl.weeks;
        if (p.pl && foundCycle) {
          p.pl.sourceCycleId = foundCycle.meta.id;
          p.pl.schedule = Array.from({ length: sessCount }, (_, i) => ({ sessionIdx: i, dayOfWeek: i }));
          p.pl.workMax = { squat: prof.pmSquat, bench: prof.pmBench, dead: prof.pmDead };
          p.pl.notes = 'Цикл: ' + foundCycle.meta.title + ' (' + foundCycle.meta.weeks + ' нед, ' + foundCycle.meta.sessionsPerWeek + 'д/нед). Процентки неизменны — ваш оверлей.';
        }
        setEditing(p);
        flash('🏆 ' + tpl.title + (foundCycle ? ' — цикл «' + foundCycle.meta.title + '»' : ' — цикл не подобран'));
        return;
      }
      if (tpl.dir === 'hybrid') {
        const p = createBlank('hybrid');
        p.meta.title = tpl.title;
        p.meta.goal = 'strength_mass';
        p.meta.level = tpl.level;
        p.meta.daysPerWeek = tpl.days;
        p.meta.weeks = tpl.weeks;
        const sessCount = Math.max(2, Math.min(4, tpl.days));
        const bbDays = Math.max(1, tpl.days - sessCount);
        const foundCycle = LMS_CYCLES.find(c => c.meta.level === tpl.level && Math.abs(c.meta.sessionsPerWeek - sessCount) <= 1)
          ?? LMS_CYCLES.find(c => Math.abs(c.meta.sessionsPerWeek - sessCount) <= 1);
        try {
          const bbUserProg = buildBBUserProgramFromProfile({ title: 'hybrid-bb', goal: 'hypertrophy', level: tpl.level, days: bbDays, weeks: tpl.weeks, prof });
          if (p.hybrid) {
            p.hybrid.plRef = { sourceCycleId: foundCycle?.meta.id ?? '', sessionIndices: foundCycle ? Array.from({ length: foundCycle.meta.sessionsPerWeek }, (_, i) => i) : [] };
            p.hybrid.bbWeeks = bbUserProg.bb?.weeks ?? [];
            p.hybrid.workMax = { squat: prof.pmSquat ?? 120, bench: prof.pmBench ?? 100, deadlift: prof.pmDead ?? 140 };
          }
        } catch { /* ignore, останется пустой hybrid скелет */ }
        setEditing(p);
        flash('⚡ ' + tpl.title + (foundCycle ? ' — ПЛ «' + foundCycle.meta.title + '» + ББ ' + bbDays + 'д/нед' : ' — цикл не подобран'));
        return;
      }
    } catch (err) {
      // Fallback: пустой скелет с тем же мета
      const p = createBlank(tpl.dir);
      p.meta.title = tpl.title;
      p.meta.goal = tpl.goal;
      p.meta.level = tpl.level;
      p.meta.daysPerWeek = tpl.days;
      p.meta.weeks = tpl.weeks;
      setEditing(p);
      flash('⚠ ' + tpl.title + ' — заполните упражнения в редакторе (авто-сборка не удалась)');
    }
  };

  if (programs.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <ManualHeader
          title="✋ Ручной конструктор программ"
          subtitle="Соберите программу с нуля, клонируйте из библиотеки 29 шаблонов или подключите LMS-цикл 66 — сеты, RIR, вес и отдых настраиваются вручную или в 1 клик из профиля."
          progress={{ current: 1, total: 3, label: 'Выбор' }}
          chips={[{ label: '29 шаблонов', color: '#00e68a' }, { label: '66 циклов', color: '#a78bfa' }]}
        />
        {renderMstepNav()}

        {/* Онбординг при первом запуске: как работает конструктор */}
        {onboardingOpen && (
          <div className="constructor-surface constructor-surface--accent" style={{ ...CARD, padding: 12, borderLeft: '3px solid #00e68a', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#fff' }}>👋 Как работает ручной конструктор</div>
            <div style={{ fontSize: 11, color: DIM_STRONG, lineHeight: 1.55 }}>
              1. <b>Выбор</b> — создайте программу, склонируйте из библиотеки или подключите ПЛ-цикл.<br />
              2. <b>Редактор</b> — заполните параметры, недели и упражнения (в PRO-режиме добавятся анализ и инструменты тренера).<br />
              3. <b>Итог</b> — проверьте метрики и сохраните.
            </div>
            <button style={{ ...BTN, padding: '8px 16px', fontSize: 12, minHeight: 44, alignSelf: 'flex-start' }} onClick={() => { setOnboardingOpen(false); try { localStorage.setItem('he_manual_onboarding_done', '1'); } catch { /* ignore */ } }}>Понятно, поехали →</button>
          </div>
        )}

        {/* Выбор режима: «Стандартный» / «Профессиональный» */}
        <ManualModeToggle mode={manualMode} onMode={setManualMode} />


        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 10, color: DIM, textTransform: 'uppercase', letterSpacing: 0.3, fontWeight: 700 }}>🆕 Создать новую</div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button style={{ ...BTN, flex: 1, minHeight: 56, flexDirection: 'column', gap: 2 }} onClick={() => startCreate('bb')}>
              <span style={{ fontSize: 16 }}>💪</span>
              <span>ББ</span>
            </button>
            <button style={{ ...BTN, flex: 1, minHeight: 56, flexDirection: 'column', gap: 2, color: '#a78bfa', borderColor: 'rgba(167,139,250,0.3)' }} onClick={() => startCreate('pl')}>
              <span style={{ fontSize: 16 }}>🏆</span>
              <span>ПЛ</span>
            </button>
            <button style={{ ...BTN, flex: 1, minHeight: 56, flexDirection: 'column', gap: 2, color: '#3b82f6', borderColor: 'rgba(59,130,246,0.3)' }} onClick={() => startCreate('hybrid')}>
              <span style={{ fontSize: 16 }}>⚡</span>
              <span>БВ</span>
            </button>
          </div>
          {/* P2-3: Wizard как альтернатива прямому созданию */}
          <button style={{ ...BTN_GHOST, minHeight: 44, color: '#a78bfa', borderColor: 'rgba(167,139,250,0.3)' }} onClick={() => { setWizardOpen(true); setWizardStep(1); }}>🪄 Визард (пошагово)</button>
        </div>

        {/* P15: Шаблоны быстрого старта — в обоих режимах + подсветка по профилю */}
        {(manualMode === 'standard' || manualMode === 'pro') && (() => {
          const prof = (() => { try { return loadTrainingProfile(); } catch { return { level: 'intermediate', daysPerWeek: 4 } as any; } })();
          const isRecommended = (tpl: typeof QUICK_TEMPLATES[0]) => tpl.days === prof.daysPerWeek && tpl.level === prof.level;
          return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontSize: 10, color: DIM, textTransform: 'uppercase', letterSpacing: 0.3, fontWeight: 700 }}>🚀 Быстрый старт (шаблоны) <span style={{ fontSize: 10, fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>— 1 клик до качественной программы</span></div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 6 }}>
              {QUICK_TEMPLATES.map(tpl => {
                const rec = isRecommended(tpl);
                return (
                <button key={tpl.id} className="editor-chip" onClick={() => applyQuickTemplate(tpl)} style={{ padding: '10px 8px', borderRadius: 10, cursor: 'pointer', textAlign: 'left', background: rec ? tpl.color + '18' : tpl.color + '08', border: rec ? '2px solid ' + tpl.color : '1px solid ' + tpl.color + '25', color: DIM_STRONG, display: 'flex', flexDirection: 'column', gap: 3, minHeight: 70, boxShadow: rec ? '0 0 0 1px ' + tpl.color + '30' : 'none', position: 'relative' }}>
                  {rec && <span style={{ position: 'absolute', top: 6, right: 6, fontSize: 9, fontWeight: 800, color: tpl.color, background: 'rgba(0,0,0,0.3)', padding: '2px 6px', borderRadius: 6 }}>★ Рекомендуем</span>}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 16 }}>{tpl.icon}</span>
                    <span style={{ fontSize: 12, fontWeight: 800, color: tpl.color }}>{tpl.title}</span>
                  </div>
                  <div style={{ fontSize: 10, color: DIM }}>{tpl.desc}</div>
                </button>
                );
              })}
            </div>
          </div>
          );
        })()}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 10, color: DIM, textTransform: 'uppercase', letterSpacing: 0.3, fontWeight: 700 }}>📥 Загрузить для правки</div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button style={{ ...BTN_GHOST, flex: 1, minHeight: 48 }} onClick={() => setPickerOpen('bb')}>
              <span style={{ fontSize: 13 }}>🔍 Библиотека</span>
            </button>
            <button style={{ ...BTN_GHOST, flex: 1, minHeight: 48, color: '#a78bfa', borderColor: 'rgba(167,139,250,0.2)' }} onClick={() => setPickerOpen('pl')}>
              <span style={{ fontSize: 13 }}>📥 LMS-цикл</span>
            </button>
          </div>
        </div>

        {toast && <div style={{ fontSize: 11, fontWeight: 700, color: ACCENT, padding: '4px 0' }}>{toast}</div>}

        {/* P2.1: Визард создания программы (модал для пустого состояния) */}
        <ManualProgramWizard open={wizardOpen} step={wizardStep} direction={wizardDir} goal={wizardGoal} level={wizardLevel} days={wizardDays} weeks={wizardWeeks} pro={manualMode === 'pro'} onClose={() => setWizardOpen(false)} onStep={setWizardStep} onDirection={setWizardDirection} onGoal={setWizardGoal} onLevel={setWizardLevel} onDays={setWizardDays} onWeeks={setWizardWeeks} onCreate={finishWizard} />

        {/* Пикеры: Библиотека ББ / LMS-цикл — единая галерея */}
        {pickerOpen === 'bb' && (
          <TrainingModal title="📚 Библиотека + 🟣 ПЛ-циклы — галерея" onClose={() => setPickerOpen(null)}>
            <ManualLibraryGallery bbPrograms={allLibraryPrograms} plCycles={plCycles as any} onSelectBB={(p) => { startCloneLibrary(p); setPickerOpen(null); }} onSelectPL={(id) => { startCloneCycle(id); setPickerOpen(null); }} />
          </TrainingModal>
        )}

        {pickerOpen === 'pl' && (
          <TrainingModal title="📚 Библиотека + 🟣 ПЛ-циклы — галерея" onClose={() => setPickerOpen(null)}>
            <ManualLibraryGallery bbPrograms={allLibraryPrograms} plCycles={plCycles as any} onSelectBB={(p) => { startCloneLibrary(p); setPickerOpen(null); }} onSelectPL={(id) => { startCloneCycle(id); setPickerOpen(null); }} />
          </TrainingModal>
        )}
      </div>
    );
  }

  return (
    <div className="manual-constructor" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <ManualHeader
        title={`✋ Ручной конструктор — Мои программы (${programs.length})`}
        subtitle="Создавайте с нуля, клонируйте из библиотеки или подключайте LMS-циклы — процентовки цикла не меняются, ваш оверлей сверху."
        progress={{ current: 1, total: 3, label: 'Выбор' }}
        chips={[{ label: `${programs.length} сохранено`, color: '#00e68a' }, { label: 'Выбор', color: '#fff' }]}
      />
      {renderMstepNav()}

      {/* Онбординг при первом запуске: как работает конструктор */}
      {onboardingOpen && (
        <div className="constructor-surface constructor-surface--accent" style={{ ...CARD, padding: 12, borderLeft: '3px solid #00e68a', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#fff' }}>👋 Как работает ручной конструктор</div>
          <div style={{ fontSize: 11, color: DIM_STRONG, lineHeight: 1.55 }}>
            1. <b>Выбор</b> — создайте программу, склонируйте из библиотеки или подключите ПЛ-цикл.<br />
            2. <b>Редактор</b> — заполните параметры, недели и упражнения (в PRO-режиме добавятся анализ и инструменты тренера).<br />
            3. <b>Итог</b> — проверьте метрики и сохраните.
          </div>
          <button style={{ ...BTN, padding: '8px 16px', fontSize: 12, minHeight: 44, alignSelf: 'flex-start' }} onClick={() => { setOnboardingOpen(false); try { localStorage.setItem('he_manual_onboarding_done', '1'); } catch { /* ignore */ } }}>Понятно, поехали →</button>
        </div>
      )}

      {/* Выбор режима: «Стандартный» / «Профессиональный» */}
      <ManualModeToggle mode={manualMode} onMode={setManualMode} />

      {/* 🚀 Быстрый старт — всегда видим и в непустом списке, свёртываемый (1 клик до качества) */}
      <div style={{ ...CARD, padding: quickTplCollapsed ? '8px 10px' : 10, borderLeft: '3px solid #00e68a' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: '#00e68a', flex: 1 }}>🚀 Быстрый старт — 1 клик до качественной программы</span>
          <span style={{ fontSize: 10, color: DIM, display: quickTplCollapsed ? 'none' : 'inline' }}>{QUICK_TEMPLATES.length} шаблонов</span>
          <button onClick={() => setQuickTplCollapsed(v => !v)} style={{ ...BTN_GHOST, padding: '4px 8px', fontSize: 10, minHeight: 28 }}>{quickTplCollapsed ? 'Показать' : 'Скрыть'}</button>
        </div>
        {!quickTplCollapsed && (() => {
          const prof = (() => { try { return loadTrainingProfile(); } catch { return { level: 'intermediate', daysPerWeek: 4 } as any; } })();
          const isRecommended = (tpl: typeof QUICK_TEMPLATES[0]) => tpl.days === prof.daysPerWeek && tpl.level === prof.level;
          return (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 6, marginTop: 8 }}>
              {QUICK_TEMPLATES.map(tpl => {
                const rec = isRecommended(tpl);
                return (
                  <button key={tpl.id} className="editor-chip" onClick={() => applyQuickTemplate(tpl)} style={{ padding: '10px 8px', borderRadius: 10, cursor: 'pointer', textAlign: 'left', background: rec ? tpl.color + '18' : tpl.color + '08', border: rec ? '2px solid ' + tpl.color : '1px solid ' + tpl.color + '25', color: DIM_STRONG, display: 'flex', flexDirection: 'column', gap: 3, minHeight: 70, boxShadow: rec ? '0 0 0 1px ' + tpl.color + '30' : 'none', position: 'relative' }}>
                    {rec && <span style={{ position: 'absolute', top: 6, right: 6, fontSize: 9, fontWeight: 800, color: tpl.color, background: 'rgba(0,0,0,0.3)', padding: '2px 6px', borderRadius: 6 }}>★ Рекомендуем</span>}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ fontSize: 16 }}>{tpl.icon}</span>
                      <span style={{ fontSize: 12, fontWeight: 800, color: tpl.color }}>{tpl.title}</span>
                    </div>
                    <div style={{ fontSize: 10, color: DIM }}>{tpl.desc}</div>
                  </button>
                );
              })}
            </div>
          );
        })()}
      </div>

      {/* Actions — P2.9: иерархия кнопок (Создать / Загрузить) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <button style={{ ...BTN, flex: 1, minHeight: 44 }} onClick={() => startCreate('bb')}>🆕 ББ</button>
          <button style={{ ...BTN, flex: 1, minHeight: 44 }} onClick={() => startCreate('pl')}>🆕 ПЛ</button>
          <button style={{ ...BTN, flex: 1, minHeight: 44, color: '#3b82f6', borderColor: 'rgba(59,130,246,0.3)' }} onClick={() => startCreate('hybrid')}>⚡ Powerbuilder</button>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button style={{ ...BTN_GHOST, flex: 1, minHeight: 44 }} onClick={() => setPickerOpen('bb')}>🔍 Библиотека</button>
          <button style={{ ...BTN_GHOST, flex: 1, minHeight: 44 }} onClick={() => setPickerOpen('pl')}>🔍 ПЛ-циклы</button>
        </div>
      </div>

      {/* Saved list */}
      <div className="constructor-surface" style={{ ...CARD, padding: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 0.3, color: DIM_STRONG, textTransform: 'uppercase', flex: 1 }}>
            Сохранённые ({filteredPrograms().length}{filteredPrograms().length !== programs.length ? ` из ${programs.length}` : ''})
          </span>
          {/* P1-6: JSON экспорт/импорт — иконки исправлены: 📤 экспорт, 📥 импорт */}
          <button style={{ ...BTN_GHOST, padding: '3px 8px', fontSize: 10, minHeight: 44 }} onClick={() => {
            const json = JSON.stringify(programs, null, 2);
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url; a.download = 'bodybuildhealth-programs-' + new Date().toISOString().slice(0,10) + '.json';
            a.click(); URL.revokeObjectURL(url);
            flash('📤 Экспортировано ' + programs.length + ' программ');
          }} title="Экспорт всех программ в JSON">📤 Экспорт</button>
          <label style={{ ...BTN_GHOST, padding: '3px 8px', fontSize: 10, minHeight: 44, cursor: 'pointer', position: 'relative' }}>
            📥 Импорт
            <input type="file" accept=".json" style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} onChange={e => {
              const file = e.target.files?.[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = () => {
                try {
                  const imported = JSON.parse(reader.result as string);
                  if (!Array.isArray(imported)) throw new Error('Not an array');
                   let added = 0;
                   const importedIds = new Set(programs.map(program => program.meta.id));
                   for (const p of imported) {
                    if (!isUserProgramShape(p)) continue;
                    if (importedIds.has(p.meta.id)) continue;
                    saveUserProgram(p, 'Импорт JSON');
                    importedIds.add(p.meta.id);
                    added++;
                  }
                  refresh();
                  flash('📥 Импортировано: ' + added + ' новых программ');
                } catch { flash('⚠ Ошибка: неверный формат JSON'); }
              };
              reader.readAsText(file);
              e.target.value = '';
            }} />
          </label>
        </div>
        {/* P2.6: поиск + фильтр по direction + сортировка — добавлена кнопка сброса */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 2, minWidth: 100, display: 'flex', alignItems: 'center' }}>
            <input
              type="text" placeholder="🔍 Поиск по названию..." value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ ...IN, flex: 1, fontSize: 11, padding: '6px 28px 6px 8px' }}
              aria-label="Поиск программ по названию"
            />
            {search && (
              <button onClick={() => setSearch('')} aria-label="Очистить поиск" style={{ position: 'absolute', right: 4, width: 24, height: 24, borderRadius: 12, border: 'none', background: 'rgba(255,255,255,0.08)', color: DIM, cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
            )}
          </div>
          <EditorPopupSelect
            value={filterDir}
            options={[
              { id: 'all', label: 'Все' }, { id: 'bb', label: 'ББ' },
              { id: 'pl', label: 'ПЛ' }, { id: 'hybrid', label: '⚡ Powerbuilder' },
            ]}
            onChange={v => setFilterDir(v as 'all' | 'bb' | 'pl' | 'hybrid')}
            ariaLabel="Фильтр по типу"
            title="Фильтр по типу программы"
            buttonStyle={{ flex: 1, minWidth: 70 }}
          />
          <EditorPopupSelect
            value={sortBy}
            options={[
              { id: 'updated', label: 'По дате' }, { id: 'title', label: 'По имени' }, { id: 'days', label: 'По дням' },
            ]}
            onChange={v => setSortBy(v as 'updated' | 'title' | 'days')}
            ariaLabel="Сортировка"
            title="Сортировка программ"
            buttonStyle={{ flex: 1, minWidth: 70 }}
          />
        </div>
        {programs.length === 0 && (
          <div style={{ padding: '24px 12px', textAlign: 'center' }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>📋</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: DIM_STRONG, marginBottom: 4 }}>Пока нет сохранённых программ</div>
            <div style={{ fontSize: 11, color: DIM }}>Создайте программу с нуля или клонируйте из библиотеки.</div>
          </div>
        )}
        {filteredPrograms().length === 0 && programs.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 0' }}>
            <span style={{ fontSize: 11, color: DIM }}>Ничего не найдено по фильтру.</span>
            <button style={{ ...BTN_GHOST, padding: '4px 10px', fontSize: 10, minHeight: 32 }} onClick={() => { setSearch(''); setFilterDir('all'); setSortBy('updated'); }}>Сбросить фильтры</button>
          </div>
        )}
        {filteredPrograms().map(p => {
          const dc = DIR_COLOR[p.meta.direction];
          const goalLabel = GOAL_OPTS.find(g => g.id === p.meta.goal)?.label ?? p.meta.goal;
          const levelLabel = LEVEL_OPTS.find(l => l.id === p.meta.level)?.label ?? p.meta.level;
          const chip: React.CSSProperties = { padding: '3px 8px', borderRadius: 999, fontSize: 10, fontWeight: 600, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.09)', color: '#fff', whiteSpace: 'nowrap' };
          const iconBtn: React.CSSProperties = { ...BTN_GHOST, padding: '3px 6px', fontSize: 10, minWidth: 36, minHeight: 36, lineHeight: 1 };
          return (
            <div key={p.meta.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', marginBottom: 8, borderRadius: 14, background: `linear-gradient(135deg, ${dc}14, rgba(24,24,27,0.6))`, border: `1px solid ${dc}30`, boxShadow: '0 2px 10px rgba(0,0,0,0.15)' }}>
              <div style={{ width: 42, height: 42, borderRadius: 12, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19, background: dc + '1a', border: '1px solid ' + dc + '45', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08)' }}>
                {p.meta.direction === 'bb' ? '💪' : p.meta.direction === 'pl' ? '🏆' : '⚡'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.meta.title}</div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 5 }}>
                  <span style={chip}>🎯 {goalLabel}</span>
                  <span style={chip}>📶 {levelLabel}</span>
                  <span style={chip}>🗓 {p.meta.daysPerWeek}д × {p.meta.weeks}н</span>
                  {p.meta.updatedAt && <span style={chip} title={new Date(p.meta.updatedAt).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}>🕒 {timeAgo(p.meta.updatedAt)}</span>}
                  {(() => {
                    const issues = validateProgram(p);
                    const errs = issues.filter(i => i.level === 'error').length;
                    const warns = issues.filter(i => i.level === 'warning').length;
                    if (errs === 0 && warns === 0) return null;
                    return (
                      <span style={{ ...chip, color: errs > 0 ? '#ef4444' : '#f59e0b', borderColor: errs > 0 ? 'rgba(239,68,68,0.4)' : 'rgba(245,158,11,0.4)', background: errs > 0 ? 'rgba(239,68,68,0.14)' : 'rgba(245,158,11,0.14)' }} title={issues.filter(i => i.level === 'error' || i.level === 'warning').slice(0, 5).map(i => i.message).join('\n')}>
                        {errs > 0 ? `🚫 ${errs} ошиб.` : `⚠ ${warns} предупр.`}
                      </span>
                    );
                  })()}
                </div>
                {(() => {
                  let total = 0, filled = 0;
                  if (p.bb?.weeks?.length) {
                    total = p.bb.weeks.reduce((s, w) => s + w.sessions.length, 0);
                    filled = p.bb.weeks.reduce((s, w) => s + w.sessions.filter(se => (se.blocks ?? []).some(b => b.exerciseName)).length, 0);
                  } else if (p.pl?.customWeeks?.length) {
                    total = p.pl.customWeeks.reduce((s, w) => s + w.days.length, 0);
                    filled = p.pl.customWeeks.reduce((s, w) => s + w.days.filter(d => (d.exercises ?? []).some(e => e.name)).length, 0);
                  } else if (p.hybrid?.bbWeeks?.length) {
                    total = p.hybrid.bbWeeks.reduce((s, w) => s + (w.sessions ?? []).length, 0);
                    filled = p.hybrid.bbWeeks.reduce((s, w) => s + (w.sessions ?? []).filter(se => (se.blocks ?? []).some(b => b.exerciseName)).length, 0);
                  }
                  if (total <= 0) return null;
                  const pct = Math.round((filled / total) * 100);
                  const full = filled >= total;
                  const color = full ? '#00e68a' : filled > 0 ? '#f59e0b' : '#ef4444';
                  return (
                    <div style={{ marginTop: 6 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: DIM, marginBottom: 3 }}>
                        <span>Заполнено: {filled} из {total} дн.</span>
                        <span style={{ color, fontWeight: 700 }}>{full ? '✓ готово' : pct + '%'}</span>
                      </div>
                      <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', borderRadius: 2, background: color, width: pct + '%' }} />
                      </div>
                    </div>
                  );
                })()}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, flexShrink: 0, alignItems: 'flex-end' }}>
                <button style={{ ...BTN, padding: '6px 16px', fontSize: 12, minHeight: 40 }} onClick={() => openExisting(p.meta.id)}>Открыть</button>
                <div style={{ display: 'flex', gap: 3 }}>
                  <button style={iconBtn} onClick={() => {
                    const clone = JSON.parse(JSON.stringify(p));
                    clone.meta.id = newId('prog');
                    clone.meta.title = p.meta.title + ' (копия)';
                    clone.meta.source = 'custom';
                    clone.meta.createdAt = new Date().toISOString();
                    clone.meta.updatedAt = new Date().toISOString();
                    clone.meta.revisions = [{ ts: new Date().toISOString(), note: 'Клон «' + p.meta.title + '»' }];
                    saveUserProgram(clone, 'Клонирование');
                    refresh();
                    flash('📋 Клонировано: ' + clone.meta.title);
                  }} title="Клонировать">⧉</button>
                  <button style={{ ...iconBtn, background: compareIds.includes(p.meta.id) ? 'rgba(245,158,11,0.18)' : iconBtn.background, borderColor: compareIds.includes(p.meta.id) ? 'rgba(245,158,11,0.4)' : (iconBtn as any).borderColor, color: compareIds.includes(p.meta.id) ? '#f59e0b' : (iconBtn as any).color }} onClick={() => { setCompareIds(prev => prev.includes(p.meta.id) ? prev.filter(x => x !== p.meta.id) : prev.length < 2 ? [...prev, p.meta.id] : [prev[1], p.meta.id]); }} title={compareIds.includes(p.meta.id) ? 'Убрать из сравнения' : 'Сравнить'}>⚖</button>
                  <button style={iconBtn} onClick={() => copyProgramToClipboard(p)} title="Скопировать в буфер">📋</button>
                  <button style={{ ...iconBtn, color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)' }} onClick={() => removeProgram(p.meta.id)} title="Удалить">✕</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* P2-5: панель сравнения двух программ */}
      {compareIds.length === 2 && (() => {
        const [a, b] = [programs.find(p => p.meta.id === compareIds[0]), programs.find(p => p.meta.id === compareIds[1])];
        if (!a || !b) return null;
        const stats = (p: UserProgram) => {
          const s: Record<string, number> = {};
          if (p.bb?.weeks) {
            for (const w of p.bb.weeks) {
              for (const ses of w.sessions ?? []) {
                for (const blk of ses.blocks ?? []) {
                  const m = (blk.muscle || '').toLowerCase();
                  if (m) s[m] = (s[m] || 0) + (blk.sets?.length ?? 0);
                }
              }
            }
          }
          if (p.pl?.customWeeks) {
            for (const week of p.pl.customWeeks) {
              for (const day of week.days ?? []) {
                for (const exercise of day.exercises ?? []) {
                  const muscle = (exercise.muscle || exercise.lift || '').toLowerCase();
                  if (muscle) s[muscle] = (s[muscle] || 0) + (exercise.sets?.reduce((sum, set) => sum + (set.sets || 0), 0) ?? 0);
                }
              }
            }
          }
          return s;
        };
        const sa = stats(a);
        const sb = stats(b);
        const allMuscles = Array.from(new Set([...Object.keys(sa), ...Object.keys(sb)])).slice(0, 10);
        return (
          <div className="constructor-surface constructor-surface--warning" style={{ ...CARD, padding: 10, borderLeft: '3px solid #f59e0b' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: '#f59e0b' }}>⚖ Сравнение</span>
              <button style={{ ...BTN_GHOST, padding: '6px 10px', fontSize: 11, minHeight: 44 }} onClick={() => setCompareIds([])}>✕ Закрыть</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 4, fontSize: 11, marginBottom: 4 }}>
              <div style={{ fontWeight: 700, color: DIR_COLOR[a.meta.direction] }}>{a.meta.title}</div>
              <div style={{ color: DIM }}></div>
              <div style={{ fontWeight: 700, color: DIR_COLOR[b.meta.direction] }}>{b.meta.title}</div>
              <div style={{ color: DIM }}>{a.meta.daysPerWeek}д/нед · {a.meta.weeks}нед</div>
              <div style={{ color: DIM }}>vs</div>
              <div style={{ color: DIM }}>{b.meta.daysPerWeek}д/нед · {b.meta.weeks}нед</div>
            </div>
            <div style={{ fontSize: 11, fontWeight: 700, color: DIM_STRONG, marginBottom: 4, marginTop: 6 }}>Объём по мышцам (сетов/программу):</div>
            {allMuscles.map(m => {
              const va = sa[m] || 0;
              const vb = sb[m] || 0;
              const delta = vb - va;
              return (
                <div key={m} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '2px 0', fontSize: 11 }}>
                  <span style={{ color: DIM_STRONG, minWidth: 50 }}>{GROUP_RU[m] ?? m}</span>
                  <span style={{ color: '#00e68a', fontWeight: 700, minWidth: 28, textAlign: 'right' }}>{va}</span>
                  <span style={{ color: delta > 0 ? '#22c55e' : delta < 0 ? '#ef4444' : DIM, fontWeight: 700, minWidth: 36, textAlign: 'center' }}>{delta > 0 ? '+' + delta : delta === 0 ? '0' : delta}</span>
                  <span style={{ color: '#a78bfa', fontWeight: 700, minWidth: 28, textAlign: 'right' }}>{vb}</span>
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* P2.1: Визард создания программы (5 шагов) */}
      {wizardOpen && (
        <ManualProgramWizard embedded open={wizardOpen} step={wizardStep} direction={wizardDir} goal={wizardGoal} level={wizardLevel} days={wizardDays} weeks={wizardWeeks} pro={manualMode === 'pro'} onClose={() => setWizardOpen(false)} onStep={setWizardStep} onDirection={setWizardDirection} onGoal={setWizardGoal} onLevel={setWizardLevel} onDays={setWizardDays} onWeeks={setWizardWeeks} onCreate={finishWizard} />
      )}
      {pickerOpen && (
        <TrainingModal title={pickerOpen === 'pl' ? '🟣 ПЛ-циклы + 📚 Библиотека — галерея' : '📚 Библиотека + 🟣 ПЛ-циклы — галерея'} onClose={() => setPickerOpen(null)}>
          <ManualLibraryGallery bbPrograms={allLibraryPrograms} plCycles={plCycles as any} onSelectBB={(p) => { startCloneLibrary(p); setPickerOpen(null); }} onSelectPL={(id) => { startCloneCycle(id); setPickerOpen(null); }} />
        </TrainingModal>
      )}

      {toast && <div style={{ fontSize: 11, fontWeight: 700, color: ACCENT, padding: '4px 0' }}>{toast}</div>}
    </div>
  );
};

// F4: Wrap in ConfirmDialogProvider for all confirm dialogs
export const ProgramManagerPanelWithProvider: React.FC = () => (
  <ConfirmDialogProvider>
    <ProgramManagerPanel />
  </ConfirmDialogProvider>
);

/* ───────────────────────── Редактор ───────────────────────── */
/* P0-1: ProgramEditor extracted to ProgramEditorView.tsx for isolated testing and reuse. */
