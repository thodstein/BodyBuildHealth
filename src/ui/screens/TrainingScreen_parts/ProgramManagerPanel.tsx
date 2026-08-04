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
import { expandProgramWeeks } from '../../../engines/program-progression.engine';
import type { FullProgram } from '../../../engines/complete-program-library.engine';
import { cycleTemplateToFullProgram } from '../../../engines/bb/cycle-to-plan';
import { WOMENS_PROGRAMS, CUSTOM_PROGRAMS } from './programs-data';
import { LMS_CYCLES } from '../../../data/lms-cycles/lms-cycle-index';
import { getReferencedCycle } from '../../../engines/user-program/program-store';
import {
  loadUserPrograms, saveUserProgram, deleteUserProgram, deleteRevision,
  cloneFromLibrary, cloneFromCycle, createBlank, userWeekToBBPlan, validateProgram,
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
import { BBEditor, PLEditor, BBConstraintsPanel } from './ProgramEditorComponents';
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
import { calcBBPlanMetrics } from '../../../engines/bb/bb-metrics.engine';
import { designerToUserWeeks, applyDesignPhasesToWeeks } from '../../../engines/periodization/designer-to-program';
import { macrocycleToBBProgram } from '../../../engines/lms/macrocycle-to-bb';
import { deserializeMacro } from '../../../engines/lms/macrocycle.engine';
import type { MacrocycleDesign } from '../../../engines/periodization-designer.engine';
import type { Macrocycle } from '../../../engines/lms/macrocycle.engine';
import { ACCENT, ACCENT_LINE, CARD, BTN, BTN_GHOST, SMALL, DIM, DIM_STRONG, IN, panelStyle } from './training-ui';
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

const GOAL_OPTS = [
  { id: 'hypertrophy', label: 'Масса' }, { id: 'powerlifting', label: 'Сила (ПЛ)' },
  { id: 'peaking', label: 'Пик/сушка' }, { id: 'recomp', label: 'Рекомпозиция' }, { id: 'rehab', label: 'Реабилитация' },
];
const LEVEL_OPTS = [
  { id: 'beginner', label: 'Новичок' }, { id: 'intermediate', label: 'Средний' },
  { id: 'advanced', label: 'Опытный' }, { id: 'enhanced', label: 'Enhanced' },
];

const DIR_COLOR: Record<string, string> = { bb: '#00e68a', pl: '#a78bfa', hybrid: '#3b82f6' };
const DIR_LABEL: Record<string, string> = { bb: 'ББ', pl: 'ПЛ', hybrid: 'Hybrid' };
const SOURCE_LABEL: Record<string, string> = {
  custom: 'своя', cloned_library: 'из библиотеки', cloned_cycle: 'клон цикла', from_build: 'из сборки',
};

const btn: React.CSSProperties = { ...BTN, flex: 1, minWidth: 0 };
const ghostBtn: React.CSSProperties = { ...BTN_GHOST, flex: 1, minWidth: 0 };

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
            color: active ? '#ffffff' : 'var(--text-dim)',
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

  // P2.1: визард создания ББ-программы (5 шагов: направление → цель → уровень → дни/нед → preview → save)
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState<WizardStep>(1);
  const [wizardDir, setWizardDir] = useState<WizardDirection>('bb');
  const [wizardGoal, setWizardGoal] = useState('hypertrophy');
  const [wizardLevel, setWizardLevel] = useState('intermediate');
  const [wizardDays, setWizardDays] = useState(4);
  const [wizardWeeks, setWizardWeeks] = useState(8);
  const startCreate = (dir: 'bb' | 'pl' | 'hybrid') => {
    // Быстрые CTA и визард используют один auto-fill путь. Это не даёт
    // стандартному режиму терять trainingFocus и recovery-метрики профиля.
    const p = createBlank(dir);
    p.meta.title = dir === 'bb' ? 'Новая ББ-программа' : dir === 'pl' ? 'Новая ПЛ-программа' : 'Новый Powerbuilder-план';
    p.meta.goal = dir === 'pl' ? 'powerlifting' : dir === 'hybrid' ? 'strength_mass' : 'hypertrophy';
    p.meta.level = 'intermediate';
    p.meta.daysPerWeek = 4;
    p.meta.weeks = 8;
    setPendingAutoFill(true);
    setEditing(p);
    flash('🆕 Создаём программу из профиля…');
  };
  const finishWizard = (autoFill = false) => {
    const p = createBlank(wizardDir);
    p.meta.title = wizardDir === 'bb' ? 'Моя ББ-программа' : wizardDir === 'pl' ? 'Моя ПЛ-программа' : 'Мой Powerbuilder-план';
    p.meta.goal = wizardDir === 'pl' ? 'powerlifting' : wizardGoal;
    p.meta.level = wizardLevel;
    p.meta.daysPerWeek = wizardDays;
    p.meta.weeks = wizardWeeks;
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
        w.sessions.forEach((s, si) => {
          lines.push(`\n### День ${s.dayOfWeek || si + 1}: ${s.name} (${s.focus})`);
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
        for (const s of w.sessions ?? []) {
          lines.push(`\n### ${s.name}`);
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
    const expanded = expandProgramWeeks(program);
    const p = cloneFromLibrary(expanded);
    setEditing(p);
    setPickerOpen(null);
    flash('🔗 Программа клонирована (' + expanded.weeks.length + ' нед)');
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

  const commit = (note?: string) => {
    if (!editing) return;
    saveUserProgram(editing, note);
    refresh();
    flash('✅ Сохранено');
  };

  // Полный каталог программ: библиотека + женские + авторские. Используется в обоих ветках UI.
  const allLibraryPrograms = useMemo(() => [
    ...getAllPrograms(),
    ...WOMENS_PROGRAMS,
    ...CUSTOM_PROGRAMS,
  ], []);
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

  if (editing) {
    return (
      <ProgramEditor
        program={editing}
        onChange={onEditChange}
        onSave={commit}
          onBack={() => { setEditing(null); setPendingAutoFill(false); refresh(); }}
          mode={manualMode}
          onMode={setManualMode}
          autoFillOnMount={pendingAutoFill}
      />
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
        <div style={{ padding: '14px 12px', borderRadius: 14, background: 'linear-gradient(135deg, rgba(0,230,138,0.10), rgba(96,165,250,0.10))', border: '1px solid rgba(0,230,138,0.25)' }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>✋ Ручной конструктор программ</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)', marginTop: 4, lineHeight: 1.45 }}>
            Здесь вы сами собираете программу: выбираете упражнения, ставите сеты,
            RIR, вес, отдых. Можно создать с нуля, загрузить готовую для правки или
            подключить LMS-цикл и поверх него сделать свой оверлей.
          </div>
        </div>

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

        {/* P15: Шаблоны быстрого старта — только в стандартном режиме */}
        {manualMode === 'standard' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontSize: 10, color: DIM, textTransform: 'uppercase', letterSpacing: 0.3, fontWeight: 700 }}>🚀 Быстрый старт (шаблоны)</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 6 }}>
              {QUICK_TEMPLATES.map(tpl => (
                <button key={tpl.id} onClick={() => applyQuickTemplate(tpl)} style={{ padding: '10px 8px', borderRadius: 10, cursor: 'pointer', textAlign: 'left', background: tpl.color + '08', border: '1px solid ' + tpl.color + '25', color: DIM_STRONG, display: 'flex', flexDirection: 'column', gap: 3, minHeight: 70 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 16 }}>{tpl.icon}</span>
                    <span style={{ fontSize: 12, fontWeight: 800, color: tpl.color }}>{tpl.title}</span>
                  </div>
                  <div style={{ fontSize: 10, color: DIM }}>{tpl.desc}</div>
                </button>
              ))}
            </div>
          </div>
        )}

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

        {/* Пикеры: Библиотека ББ / LMS-цикл (модалы для пустого состояния) */}
        {pickerOpen === 'bb' && (
          <TrainingModal title="📚 Библиотека программ" onClose={() => setPickerOpen(null)}>
            <BbProgramLibraryPicker value={null} label="Выбрать программу" programs={allLibraryPrograms} onSelect={startCloneLibrary} />
          </TrainingModal>
        )}

        {pickerOpen === 'pl' && (
          <TrainingModal title="🟣 Проф. LMS-циклы (immutable)" onClose={() => setPickerOpen(null)}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 360, overflowY: 'auto' }}>
              {plCycles.map(c => (
                <button key={c.meta.id} onClick={() => startCloneCycle(c.meta.id)} style={{ textAlign: 'left', padding: '8px 10px', borderRadius: 8, background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.18)', color: DIM_STRONG, cursor: 'pointer', minHeight: 44 }}>
                  <div style={{ fontSize: 12, fontWeight: 700 }}>{c.meta.title}</div>
                  <div style={{ fontSize: 10, color: DIM }}>{c.meta.sessionsPerWeek}д/нед · {c.meta.weeks} нед · {c.meta.level} · {c.meta.period}</div>
                </button>
              ))}
            </div>
          </TrainingModal>
        )}
      </div>
    );
  }

  return (
    <div className="manual-constructor" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: ACCENT }}>✋ Ручной конструктор — Мои программы ({programs.length})</div>
      <div style={{ fontSize: 11, color: DIM }}>
        Создавайте программы с нуля, клонируйте готовые из библиотеки или подключайте LMS-циклы (без изменения их процентовок).
      </div>

      {/* Выбор режима: «Стандартный» / «Профессиональный» */}
      <ManualModeToggle mode={manualMode} onMode={setManualMode} />

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
          {/* P1-6: JSON экспорт/импорт */}
          <button style={{ ...BTN_GHOST, padding: '3px 8px', fontSize: 10, minHeight: 44 }} onClick={() => {
            const json = JSON.stringify(programs, null, 2);
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url; a.download = 'bodybuildhealth-programs-' + new Date().toISOString().slice(0,10) + '.json';
            a.click(); URL.revokeObjectURL(url);
            flash('📥 Экспортировано ' + programs.length + ' программ');
          }} title="Экспорт всех программ в JSON">📥 JSON</button>
          <label style={{ ...BTN_GHOST, padding: '3px 8px', fontSize: 10, minHeight: 44, cursor: 'pointer', position: 'relative' }}>
            📤 JSON
            <input type="file" accept=".json" style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} onChange={e => {
              const file = e.target.files?.[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = () => {
                try {
                  const imported = JSON.parse(reader.result as string);
                  if (!Array.isArray(imported)) throw new Error('Not an array');
                  let added = 0;
                  for (const p of imported) {
                    if (!p.meta?.id || !p.meta?.direction) continue;
                    const exists = programs.find(x => x.meta.id === p.meta.id);
                    if (exists) continue;
                    saveUserProgram(p as UserProgram, 'Импорт JSON');
                    added++;
                  }
                  refresh();
                  flash('📤 Импортировано: ' + added + ' новых программ');
                } catch { flash('⚠ Ошибка: неверный формат JSON'); }
              };
              reader.readAsText(file);
              e.target.value = '';
            }} />
          </label>
        </div>
        {/* P2.6: поиск + фильтр по direction + сортировка */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 8, flexWrap: 'wrap' }}>
          <input
            type="text" placeholder="🔍 Поиск..." value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ ...IN, flex: 2, minWidth: 100, fontSize: 11, padding: '6px 8px' }}
          />
          <select value={filterDir} onChange={e => setFilterDir(e.target.value as 'all' | 'bb' | 'pl' | 'hybrid')} style={{ ...IN, flex: 1, minWidth: 70, fontSize: 11, padding: '6px 4px' }}>
            <option value="all">Все</option>
            <option value="bb">ББ</option>
            <option value="pl">ПЛ</option>
            <option value="hybrid">⚡</option>
          </select>
          <select value={sortBy} onChange={e => setSortBy(e.target.value as 'updated' | 'title' | 'days')} style={{ ...IN, flex: 1, minWidth: 70, fontSize: 11, padding: '6px 4px' }}>
            <option value="updated">По дате</option>
            <option value="title">По имени</option>
            <option value="days">По дням</option>
          </select>
        </div>
        {programs.length === 0 && (
          <div style={{ padding: '24px 12px', textAlign: 'center' }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>📋</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: DIM_STRONG, marginBottom: 4 }}>Пока нет сохранённых программ</div>
            <div style={{ fontSize: 11, color: DIM }}>Создайте программу с нуля или клонируйте из библиотеки.</div>
          </div>
        )}
        {filteredPrograms().length === 0 && programs.length > 0 && <div style={{ fontSize: 11, color: DIM, padding: '12px 0' }}>Ничего не найдено по фильтру.</div>}
        {filteredPrograms().map(p => (
          <div key={p.meta.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: DIR_COLOR[p.meta.direction], minWidth: 28 }}>{DIR_LABEL[p.meta.direction]}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: DIM_STRONG, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.meta.title}</div>
              <div style={{ fontSize: 10, color: DIM }}>
                {p.meta.daysPerWeek}д/нед · {p.meta.weeks} нед · {SOURCE_LABEL[p.meta.source] ?? p.meta.source}
                {p.meta.updatedAt && ' · ' + new Date(p.meta.updatedAt).toLocaleDateString()}
              </div>
            </div>
            <button style={{ ...BTN_GHOST, padding: '4px 8px', fontSize: 11, minHeight: 44 }} onClick={() => openExisting(p.meta.id)}>Открыть</button>
            <button style={{ ...BTN_GHOST, padding: '4px 8px', fontSize: 11, minHeight: 44 }} onClick={() => {
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
            <button style={{ ...BTN_GHOST, padding: '4px 8px', fontSize: 11, minHeight: 44 }} onClick={() => { setCompareIds(prev => prev.includes(p.meta.id) ? prev.filter(x => x !== p.meta.id) : prev.length < 2 ? [...prev, p.meta.id] : [prev[1], p.meta.id]); }} title="Сравнить">⚖</button>
            <button style={{ ...BTN_GHOST, padding: '4px 8px', fontSize: 11, minHeight: 44 }} onClick={() => copyProgramToClipboard(p)} title="Скопировать в буфер">📋</button>
            <button style={{ ...BTN_GHOST, padding: '4px 8px', fontSize: 11, minHeight: 44, color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)' }} onClick={() => removeProgram(p.meta.id)}>✕</button>
          </div>
        ))}
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
      {pickerOpen === 'bb' && (
        <TrainingModal title="📚 Библиотека программ" onClose={() => setPickerOpen(null)}>
          <BbProgramLibraryPicker value={null} label="Выбрать программу" programs={allLibraryPrograms} onSelect={startCloneLibrary} />
        </TrainingModal>
      )}

      {pickerOpen === 'pl' && (
        <TrainingModal title="🟣 Проф. ПЛ-циклы (immutable)" onClose={() => setPickerOpen(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 360, overflowY: 'auto' }}>
            {plCycles.map(c => (
              <button key={c.meta.id} onClick={() => startCloneCycle(c.meta.id)} style={{ textAlign: 'left', padding: '8px 10px', borderRadius: 8, background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.18)', color: DIM_STRONG, cursor: 'pointer', minHeight: 44 }}>
                <div style={{ fontSize: 12, fontWeight: 700 }}>{c.meta.title}</div>
                <div style={{ fontSize: 10, color: DIM }}>{c.meta.sessionsPerWeek}д/нед · {c.meta.weeks} нед · {c.meta.level} · {c.meta.period}</div>
              </button>
            ))}
          </div>
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
