/**
 * ProgramEditorView.tsx - extracted from ProgramManagerPanel.tsx.
 * ProgramEditor component: inline editor for a single UserProgram (BB/PL/Hybrid).
 *
 * Extracted to enable isolated testing and reduce ProgramManagerPanel size.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getAllPrograms } from '../../../engines/complete-program-library.engine';
import { cycleTemplateToFullProgram } from '../../../engines/bb/cycle-to-plan';
import { newId } from '../../../engines/user-program/user-program.types';
import type { UserProgram, UserWeek, UserBlock, ProgramProgression } from '../../../engines/user-program/user-program.types';
import { HybridPlanPanel } from './HybridPlanPanel';
import { MacrocyclePanel } from '../SRCBBScreen_parts/MacrocyclePanel';
import { MethodologyEncyclopedia } from './MethodologyEncyclopedia';
import { BbContextPanel } from './program-editor-context-panels';
import { BBEditor, PLEditor, BBConstraintsPanel, TRAINING_DAY_NAMES } from './ProgramEditorComponents';
import { PlanDiagnosticsPanel, InteractiveVolumePanel, ExerciseInfoPanel, ProgressionCoach, SplitConsultant, PlanSummaryTable, AutoPeriodizationPanel, SubstitutionPanel } from './editor-panels';
import { LoadGuardPanel, RealMRVPanel, RIRCalibrationPanel, TonnageEstimatePanel, StickingPointPanel, PlateAutoPanel, WhatIfGuardPanel, ReadinessForecastPanel, CheckinGuardPanel, BiomechanicsPanel } from './ProGuardPanels';
import { ProPanelSection, ProPanelsGroup, ThemeToggle } from './ProPanelSection';
import { MesoHeatmap } from './MesoHeatmap';
import { ProgramNotes, ProgramStrengthScore } from './ProgramExtras';
import { ProgramRevisionsDiff } from './ProgramRevisions';
import { StrengthDiaryPanel } from './StrengthDiaryPanel';
import { CardioLinkCard } from './CardioLinkCard';
import { CardioConstructor } from './CardioConstructor';
import { EditorPopupSelect } from './EditorPopup';
import { tempoFor } from '../../../engines/bb/bb-tempo-rest';
import { INTENSITY_TECHNIQUES, type IntensityTechnique } from '../../../engines/bb/bb-autocoach.engine';
import { loadTrainingProfile, useTrainingProfile, type TrainingProfile } from './training-profile';
import { TrainingProfileCard } from './TrainingProfileCard';
import { subscribePlannerApply, clearPlannerApply, type PlannerApply } from './planner-bridge';
import { applyBridgePayloadDispatch, type BridgeCtx } from './planner-bridge-handlers';
import { autoFillDraftDispatch, type AutoFillCtx } from './auto-fill-draft';
import { calcBBPlanMetrics } from '../../../engines/bb/bb-metrics.engine';
import { designerToUserWeeks, applyDesignPhasesToWeeks, linkDesignToProgram, isProgramDesignStale, reapplyDesignToProgram, unlinkDesignFromProgram } from '../../../engines/periodization/designer-to-program';
import { macrocycleToBBProgram } from '../../../engines/lms/macrocycle-to-bb';
import { deserializeMacro, deserializeBbMacro } from '../../../engines/lms/macrocycle.engine';
import { loadDesigns } from '../../../engines/periodization-designer.engine';
import type { MacrocycleDesign } from '../../../engines/periodization-designer.engine';
import type { Macrocycle, BBMacrocycle } from '../../../engines/lms/macrocycle.engine';
import { ACCENT, ACCENT_LINE, CARD, BTN, BTN_GHOST, SMALL, DIM, DIM_STRONG, IN, panelStyle, STEP_PILL, UI_METRICS } from './training-ui';
import { labTrainingAdjust } from './lab-training-adjust';
import { suggestFeeders } from '../../../engines/bb/bb-autocoach.engine';
import { useDataLink } from '../../../core/data-link';
import { detectLift } from '../../../engines/lms/lms-to-pl';
import { WOMENS_PROGRAMS, CUSTOM_PROGRAMS } from './programs-data';
import { useOriginalPrograms } from './useOriginalPrograms';
import { LMS_CYCLES } from '../../../data/lms-cycles/lms-cycle-index';
import { getReferencedCycle, userWeekToBBPlan, validateProgram, cloneFromCycle, cloneFromLibrary, createBlank, createFromBuild, deleteRevision } from '../../../engines/user-program/program-store';
import { autodraftBBPlan, applyPhaseModulation, plLmsScheduleDays, computePlanQualityFor, muscleAwareSets, makeSetsFromTemplate, suggestExercisesForGroup } from '../../../engines/manual-constructor';
import { GROUP_RU } from './program-types';
import { SPLIT_PATTERNS } from '../../../engines/bb/bb-split-patterns';
import { resizeTrainingSessions, sessionDayOfWeek, trainingDayForIndex, moveWeekScheduleDay, resetScheduleToRecommended, sessionUsesRecommendedDay } from './program-editor-logic';
import { BulkApplyCard } from './BulkApplyCard';
import { useEditorToast } from './EditorToast';
import { TrainingModal } from './TrainingModal';
import { useProgramUndo } from './hooks/useProgramUndo';
import { useConfirmDialog } from './ConfirmDialog';
import { ProgramTimeline } from './ProgramTimeline';
import { RirWaveChart, QualityScorePanel, PlanStatsPanel } from './ProgramEditorPanels2';
import type { ManualMode } from './ProgramManagerPanel';
import { CycleTemplatesPanel } from './CycleTemplatesPanel';
import { QualityChecklistCard } from './QualityChecklistCard';
import { PlannerToolsPanel } from './PlannerToolsPanel';
import { PlDeadpointsBarPathCard } from './PlDeadpointsBarPathCard';

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

/** Внутренние шаги редактора (внутри шага «2 Редактор» родителя).
 *  Standard: Параметры → Недели. Pro: Профиль → Параметры → Недели → Анализ → Обратная связь → Инструменты. */
type EditorStep = 'profile' | 'params' | 'weeks' | 'analysis' | 'feedback' | 'tools';
const STANDARD_EDITOR_STEPS: EditorStep[] = ['params', 'weeks'];
const PRO_EDITOR_STEPS: EditorStep[] = ['profile', 'params', 'weeks', 'analysis', 'feedback', 'tools'];
const EDITOR_STEP_LABELS: Record<EditorStep, string> = {
  profile: '👤 Профиль',
  params: '🎛 Параметры',
  weeks: '🗓 Недели',
  analysis: '📊 Анализ',
  feedback: '🔄 Обратная связь',
  tools: '🔧 Инструменты',
};
const EDITOR_STEP_BTN_LABELS: Record<EditorStep, string> = {
  profile: 'Профиль', params: 'Параметры', weeks: 'Недели', analysis: 'Анализ', feedback: 'Обратная связь', tools: 'Инструменты',
};
const EDITOR_STEP_INFO: Record<EditorStep, { title: string; hint: string }> = {
  profile: { title: 'Данные атлета', hint: 'ПМ, workMax, оборудование и ограничения — основа авто-сборки' },
  params: { title: 'Параметры программы', hint: 'Название, цель, уровень, дни и недели + заметки тренера' },
  weeks: { title: 'Недели и упражнения', hint: 'Расписание недели, упражнения, сеты, веса и RIR' },
  analysis: { title: 'Метрики и периодизация', hint: 'Score, MRV, объём, прогрессия и лаб-коррекция' },
  feedback: { title: 'Обратная связь', hint: 'sRPE, RIR-калибровка, готовность, чек-ин и what-if' },
  tools: { title: 'Инструменты и история', hint: 'Подбор сплита, замены, ПЛ-диагностика и ревизии' },
};

export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Попап карточки «🗓 Неделя — расписание»: перенос существующей сессии или назначение на свободный день. */
type SchedulePick =
  | { kind: 'move'; sessionIdx: number; day: number }
  | { kind: 'assign'; day: number };

export interface ProgramEditorProps {
  program: UserProgram;
  onChange: (p: UserProgram) => void;
  onSave: (note?: string) => boolean | void;
  onBack: () => void;
  onNext?: () => void;
  mode: ManualMode;
  onMode: (m: ManualMode) => void;
  autoFillOnMount?: boolean;
}

export const ProgramEditor: React.FC<ProgramEditorProps> = ({ program, onChange, onSave, onBack, onNext, mode, onMode, autoFillOnMount = false }) => {
  const dir = program.meta.direction;
  const isPro = mode === 'pro';
  // P4: Undo/Redo — snapshot перед каждым onChange, чтобы Ctrl+Z работал из редактора
  const { pushSnapshot, undo, redo } = useProgramUndo(program, (p) => { if (p) onChange(p); });
  const onChangeWithUndo = useCallback((p: UserProgram) => {
    pushSnapshot(p);
    onChange(p);
  }, [onChange, pushSnapshot]);
  const update = useCallback((patch: Partial<UserProgram>) => onChangeWithUndo({ ...program, ...patch }), [program, onChangeWithUndo]);
  const updateMeta = useCallback((patch: Partial<UserProgram['meta']>) => onChangeWithUndo({ ...program, meta: { ...program.meta, ...patch } }), [program, onChangeWithUndo]);
  const linked = useDataLink();
  const labAdjust = useMemo(() => labTrainingAdjust(linked.labAnalysis ?? null), [linked.labAnalysis]);
  const [tprofile, updateTProfile] = useTrainingProfile();
  const [isAutoFilling, setIsAutoFilling] = useState(false);

  // V6: Toast with variants — replaces plain editorToast div
  const { showToast: showToastRaw, ToastNode } = useEditorToast();
  const showToast = (m: string, variant?: import('./EditorToast').ToastVariant) => showToastRaw(m, variant);

  // Карточка «🗓 Неделя — расписание» (BB): попап смены/назначения дня недели
  const [schedulePick, setSchedulePick] = useState<SchedulePick | null>(null);
  const setWeekSessionDay = useCallback((sessionIdx: number, day: number) => {
    if (!program.bb) return;
    update({ bb: { ...program.bb, weeks: moveWeekScheduleDay(program.bb.weeks, sessionIdx, day) } });
    showToast(`📅 День ${sessionIdx + 1} → ${TRAINING_DAY_NAMES[day]}`);
  }, [program, update, showToast]);
  const resetScheduleRecommended = useCallback(() => {
    if (!program.bb) return;
    update({ bb: { ...program.bb, weeks: resetScheduleToRecommended(program.bb.weeks) } });
    showToast('⭐ Расписание возвращено к рекомендованным дням (Пн·Ср·Пт…)');
  }, [program, update, showToast]);

  // P0-1: связь «программа ↔ дизайн периодизации» — список сохранённых дизайнов для карточки в шаге «Недели»
  const [designLinkId, setDesignLinkId] = useState('');
  const savedDesigns = useMemo(() => {
    try {
      const list = loadDesigns();
      return program.meta.designRef ? list.filter(d => d.id === program.meta.designRef!.id) : list;
    } catch { return []; }
  }, [program.meta.designRef]);
  const linkedDesign = useMemo(() => {
    if (!program.meta.designRef) return null;
    try { return loadDesigns().find(d => d.id === program.meta.designRef!.id) || null; } catch { return null; }
  }, [program.meta.designRef]);
  const handleLinkDesign = useCallback((design: MacrocycleDesign) => {
    const linked = linkDesignToProgram(program, design);
    updateMeta({ designRef: linked.meta.designRef });
    showToast(`🎨 Дизайн «${design.name}» привязан — фазы недель отмечены`);
  }, [program, updateMeta, showToast]);
  const handleUnlinkDesign = useCallback(() => {
    const linked = unlinkDesignFromProgram(program);
    updateMeta({ designRef: linked.meta.designRef });
    setDesignLinkId('');
    showToast('✕ Связь с дизайном удалена');
  }, [program, updateMeta, showToast]);
  const handleReapplyDesign = useCallback((design: MacrocycleDesign) => {
    const reapplied = reapplyDesignToProgram(program, design);
    update({ bb: reapplied.bb, pl: reapplied.pl, hybrid: reapplied.hybrid, meta: reapplied.meta });
    showToast('↻ Фазы недель переразмечены из дизайна');
  }, [program, update, showToast]);

  // P1-1: planner-bridge — приём рекомендаций из калькуляторов (split/pri/weakpoints/pm/tempo/rir/mrv/deload/volume/peak/methodology/program)
  const [bridgeApply, setBridgeApply] = useState<PlannerApply | null>(null);
  useEffect(() => {
    const unsub = subscribePlannerApply((payload) => { setBridgeApply(payload); });
    return unsub;
  }, []);
  // A3: wizard auto-fill is requested through a typed prop, not a window event.
  useEffect(() => {
    if (!autoFillOnMount) return;
    const timer = window.setTimeout(() => autoFillDraft(), 0);
    return () => window.clearTimeout(timer);
  }, [autoFillOnMount]);
  const applyBridgePayload = useCallback((payload: PlannerApply) => {
    // P0-3: dispatch table replaces 14-branch if/else chain
    const personal = linked.profile?.settings?.personal;
    const lifestyle = linked.profile?.settings?.lifestyle;
    const bodyFat = personal?.bodyFat;
    const recovery = {
      bodyFat,
      leanMass: personal?.weight && bodyFat != null ? Math.round(personal.weight * (1 - bodyFat / 100)) : undefined,
      hrvMs: lifestyle?.morningHRV,
      sleepHours: lifestyle?.sleepHours,
      stressLevel: lifestyle?.stressLevel,
      labMrvMultiplier: labAdjust.mrvMultiplier,
    };
    const ctx: BridgeCtx = { program, dir, update, onChange, showToast, tprofile, recovery };
    applyBridgePayloadDispatch(payload, ctx);
    clearPlannerApply();
    setBridgeApply(null);
  }, [program, dir, onChange, update, showToast, tprofile, linked.profile, labAdjust.mrvMultiplier]);


  // Библиотека внутри редактора
  const [editorLibOpen, setEditorLibOpen] = useState<'bb' | 'pl' | 'methods' | 'macro' | null>(null);
  // Кардио внутри редактора: 'card' — интеграционная карточка, 'constructor' — конструктор в модале
  const [cardioView, setCardioView] = useState<'card' | 'constructor' | null>(null);
  // ⭐ Избранные программы (he_program_fav)
  const [progFavs, setProgFavs] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('he_program_fav') || '[]'); } catch { return []; }
  });
  const [progFavOnly, setProgFavOnly] = useState(false);
  useEffect(() => {
    try { localStorage.setItem('he_program_fav', JSON.stringify(progFavs)); } catch { /* ignore */ }
  }, [progFavs]);
  const toggleProgFav = (id: string) => setProgFavs(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  // State для MacrocyclePanel (редактируемые level/goal макроцикла)
  const [macroLevel, setMacroLevel] = useState<string>(program.meta.level);
  const [macroGoal, setMacroGoal] = useState<'powerlifting' | 'bodybuilding' | 'general'>(
    program.meta.goal === 'powerlifting' ? 'powerlifting'
    : program.meta.goal === 'hypertrophy' || program.meta.goal === 'bodybuilding' ? 'bodybuilding'
    : 'general'
  );

  /** Маппинг goal UserProgram → goal MacrocyclePanel. */
  const mapGoalToMacro = (g: string): 'powerlifting' | 'bodybuilding' | 'general' => {
    if (g === 'powerlifting' || g === 'peaking' || g === 'strength') return 'powerlifting';
    if (g === 'hypertrophy' || g === 'bodybuilding' || g === 'mass' || g === 'cut' || g === 'recomp') return 'bodybuilding';
    return 'general';
  };
  const [showMore, setShowMore] = useState(false);
  const [showTableView, setShowTableView] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  // Внутренний шаг редактора: standard = [Параметры, Недели], pro = [Профиль, Параметры, Недели, Анализ, Обратная связь, Инструменты]
  const editorSteps = isPro ? PRO_EDITOR_STEPS : STANDARD_EDITOR_STEPS;
  // Шаг восстанавливается из sessionStorage (he_editor_step) — возврат из «Итога» не сбрасывает позицию
  const [estep, setEstep] = useState<EditorStep>(() => {
    try {
      const raw = sessionStorage.getItem('he_editor_step');
      if (raw) {
        const stored = JSON.parse(raw) as { id?: string; step?: EditorStep };
        // Валидируем шаг по ТЕКУЩЕМУ режиму (pro/standard) — иначе пилюля не подсветится и контент не отрисуется
        if (stored.id === program.meta.id && stored.step && editorSteps.includes(stored.step)) {
          return stored.step;
        }
      }
    } catch { /* ignore */ }
    return isPro ? 'profile' : 'params';
  });
  const estepResetFirst = useRef(true);
  useEffect(() => {
    // Первый рендер пропускаем (инициализатор уже восстановил/выбрал шаг),
    // дальше — сброс к первому шагу при смене программы или режима.
    if (estepResetFirst.current) { estepResetFirst.current = false; return; }
    setEstep(isPro ? 'profile' : 'params');
  }, [program.meta.id, isPro]);
  useEffect(() => {
    try { sessionStorage.setItem('he_editor_step', JSON.stringify({ id: program.meta.id, step: estep })); } catch { /* ignore */ }
  }, [estep, program.meta.id]);
  const estepIdx = editorSteps.indexOf(estep);
  const isLastEditorStep = estepIdx >= editorSteps.length - 1;
  // При переключении внутреннего шага — скролл контента наверх (липкая шапка остаётся сверху)
  const editorRootRef = useRef<HTMLDivElement | null>(null);
  const scrollEditorTop = useCallback(() => {
    const root = editorRootRef.current;
    if (!root) return;
    try {
      const scroller = root.closest('.screen.training-screen') as HTMLElement | null;
      if (scroller && typeof scroller.scrollTo === 'function') scroller.scrollTo({ top: 0, behavior: 'smooth' });
      else if (typeof root.scrollIntoView === 'function') root.scrollIntoView({ block: 'start', behavior: 'smooth' });
    } catch { /* jsdom и т.п. — scroll API может отсутствовать */ }
  }, []);
  const goNextStep = useCallback(() => {
    if (isLastEditorStep) onNext?.();
    else { setEstep(editorSteps[estepIdx + 1]); scrollEditorTop(); }
  }, [onNext, editorSteps, estepIdx, isLastEditorStep, scrollEditorTop]);
  const goPrevStep = useCallback(() => {
    if (estepIdx > 0) { setEstep(editorSteps[estepIdx - 1]); scrollEditorTop(); }
  }, [editorSteps, estepIdx, scrollEditorTop]);
  // Клавиатурная навигация по внутренним шагам (←/→); не перехватывает ввод в полях
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); goNextStep(); }
      else if (e.key === 'ArrowLeft' && estepIdx > 0) { e.preventDefault(); goPrevStep(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goNextStep, goPrevStep, estepIdx]);
  // Шапка редактора — обычная статичная панель (не липкая): без пиннинга
  // position:fixed/sticky, чтобы не перекрывать селекты дней недели и фаз.
  const originalPrograms = useOriginalPrograms();
  const libraryPrograms = useMemo(() => [...getAllPrograms(), ...WOMENS_PROGRAMS, ...CUSTOM_PROGRAMS, ...originalPrograms], [originalPrograms]);
  const plCycleList = useMemo(() => LMS_CYCLES, []);
  const loadIntoEditor = (p: UserProgram) => {
    onChange(p);
    setEditorLibOpen(null);
    showToast('📥 Загружено: ' + p.meta.title);
  };
  const loadCycleIntoEditor = (cycleId: string) => {
    const p = cloneFromCycle(cycleId);
    if (!p) { showToast('⚠ Цикл не найден'); return; }
    onChange(p);
    setEditorLibOpen(null);
    showToast('📥 Загружен ПЛ-цикл: ' + (p.meta?.title ?? cycleId));
  };

  const applyWholeMacrocycle = (source: Macrocycle | BBMacrocycle) => {
    try {
      const personal = linked.profile?.settings?.personal;
      const lifestyle = linked.profile?.settings?.lifestyle;
      const bodyFat = personal?.bodyFat;
      const options = {
        level: macroLevel,
        goal: dir === 'hybrid' ? 'hypertrophy' : program.meta.goal,
        daysPerWeek: dir === 'hybrid' ? Math.max(1, program.meta.daysPerWeek - 3) : program.meta.daysPerWeek,
        weakPoints: (tprofile.weakPoints ?? []) as string[],
        equipment: program.bb?.constraints?.equipment ?? [],
        trainingFocus: program.meta.trainingFocus,
        bodyFat,
        leanMass: personal?.weight && bodyFat != null ? Math.round(personal.weight * (1 - bodyFat / 100)) : undefined,
        hrvMs: lifestyle?.morningHRV,
        sleepHours: lifestyle?.sleepHours,
        stressLevel: lifestyle?.stressLevel,
        labMrvMultiplier: labAdjust.mrvMultiplier,
      };
      const generated = macrocycleToBBProgram(source, options);
      if (dir === 'hybrid' && program.hybrid && generated.bb) {
        update({ hybrid: { ...program.hybrid, bbWeeks: generated.bb.weeks } });
      } else {
        onChange(generated);
      }
      setEditorLibOpen(null);
      showToast(`🗓 Макроцикл применён: ${source.totalWeeks} нед.`);
    } catch (error) {
      showToast('⚠ Не удалось применить макроцикл: ' + (error as Error)?.message, 'error');
    }
  };

  const revisions = program.meta.revisions ?? [];
  const removeRev = (revIdx: number) => {
    const updated = deleteRevision(program.meta.id, revIdx);
    if (updated) onChange(updated);
  };

  // U5: автосохранение каждые 30 секунд + индикатор «● изменено»
  // P0: programRef гарантирует что interval читает актуальное значение program,
  // исключая race condition между onSave и обновлением lastSavedRef.
  const [isDirty, setIsDirty] = useState(false);
  const lastSavedRef = useRef<string>(JSON.stringify(program));
  const programRef = useRef(program);
  programRef.current = program;
  useEffect(() => {
    const current = JSON.stringify(program);
    setIsDirty(current !== lastSavedRef.current);
  }, [program]);
  useEffect(() => {
    const timer = setInterval(() => {
      const current = JSON.stringify(programRef.current);
      if (current !== lastSavedRef.current) {
        const saved = onSave('Автосохранение');
        if (saved !== false) {
          // onSave может синхронно вызвать обновление родительского состояния.
          // Не помечаем более новую правку сохранённой.
          const latest = JSON.stringify(programRef.current);
          if (latest === current) {
            lastSavedRef.current = current;
            setIsDirty(false);
          }
        }
      }
    }, UI_METRICS.autosaveMs);
    return () => clearInterval(timer);
  }, [onSave]);
  // F4: ConfirmDialog replaces window.confirm
  const { confirm } = useConfirmDialog();
  // U4: подтверждение выхода без сохранения
  const safeBack = async () => {
    if (!isDirty) { onBack(); return; }
    const ok = await confirm({ title: 'Несохранённые изменения', message: 'Есть несохранённые изменения. Выйти без сохранения?', confirmLabel: 'Выйти', cancelLabel: 'Сохранить', danger: true });
    if (ok) {
      onBack();
    } else {
      if (handleSave('Ручная правка')) onBack();
    }
  };
  // U5: при ручном сохранении — обновляем baseline
  const handleSave = useCallback((note?: string): boolean => {
    if (onSave(note) !== false) {
      lastSavedRef.current = JSON.stringify(program);
      setIsDirty(false);
      return true;
    }
    return false;
  }, [program, onSave]);
  // Ctrl+S — быстрое сохранение (как в BB-авто)
  useEffect(() => {
    const onSaveKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        if (handleSave('Ручная правка (Ctrl+S)')) { setSavedFlash(true); window.setTimeout(() => setSavedFlash(false), 1600); }
      }
    };
    window.addEventListener('keydown', onSaveKey);
    return () => window.removeEventListener('keydown', onSaveKey);
  }, [handleSave]);

  // P5: «⚡ Заполнить автоматически» — реальная интеллектуальная сборка через
  // buildBBPlan (BB) + LMS-cycles (PL). Пользователь получает рабочую программу
  // с реальными упражнениями и весами, а не пустую заготовку.
   // Читает единый профиль тренированности (equipment, weakPoints, avoidAxialLoad,
   // workMax, onCourse, favoriteExercises, excludedExercises) + лаб. коррекцию.
    const hasProgramContent = useCallback(() => {
      if (program.bb?.weeks?.some(w => w.sessions.some(s => s.blocks.some(b => b.exerciseName && b.exerciseName.trim())))) return true;
      if (program.pl?.customWeeks?.some(w => w.days.some(d => d.exercises.some(e => e.name && e.name.trim())))) return true;
      if (program.hybrid?.bbWeeks?.some(w => w.sessions?.some(s => (s.blocks ?? []).some(b => b.exerciseName && b.exerciseName.trim())))) return true;
      return false;
    }, [program]);
    const autoFillDraft = useCallback(async () => {
      // Защита от случайной потери данных: если программа уже заполнена — спросить подтверждение
      if (hasProgramContent()) {
        const ok = await confirm({ title: 'Перезаписать программу?', message: 'Авто-сборка заменит текущие недели и упражнения. Несохранённые правки будут потеряны. Продолжить?', confirmLabel: 'Перезаписать', cancelLabel: 'Отмена', danger: true });
        if (!ok) return;
      }
      const prof = tprofile;
      const days = Math.max(2, Math.min(7, program.meta.daysPerWeek || 4));
      updateMeta({ title: '[Черновик] ' + (program.meta.title || 'Моя программа') });
      const profData = linked.profile?.settings?.personal;
      const lifeData = linked.profile?.settings?.lifestyle;
      const ctx: AutoFillCtx = {
        program, prof, days,
        bodyFat: profData?.bodyFat,
        leanMass: (profData?.weight && profData?.bodyFat != null) ? Math.round(profData.weight * (1 - profData.bodyFat / 100)) : undefined,
        hrvMs: lifeData?.morningHRV,
        sleepHours: lifeData?.sleepHours,
        stressLevel: lifeData?.stressLevel,
        labMrvMultiplier: labAdjust.mrvMultiplier,
        update, showToast,
      };
      setIsAutoFilling(true);
      window.setTimeout(() => {
        try { autoFillDraftDispatch(ctx); }
        finally { setIsAutoFilling(false); }
      }, 0);
    }, [program, tprofile, linked.profile, labAdjust.mrvMultiplier, update, showToast, hasProgramContent, confirm]);


  // «🚚 К выполнению» — поддерживает BB и PL.
    const [execWeek, setExecWeek] = useState(1);
    const sendToExecution = useCallback(() => {
     let days: { label: string; exercises: { name: string; muscleGroup: string; targetSets: { weight: number; reps: number; rir: number }[] }[] }[] = [];

    if (dir === 'bb' && program.bb) {
      const wi = Math.max(0, Math.min(execWeek - 1, program.bb.weeks.length - 1));
      const week = program.bb.weeks[wi];
       if (!week) { showToast('Сначала добавьте хотя бы одну сессию.', 'warning'); return; }
      for (const s of week.sessions) {
        days.push({
          label: s.name || 'День',
          exercises: s.blocks
            .filter((b) => b.exerciseName)
            .map((b) => ({
              name: b.exerciseName,
              muscleGroup: b.muscle,
              targetSets: b.sets.map((set) => ({
                weight: set.weight ?? 0,
                reps: typeof set.reps === 'number' ? set.reps : parseInt(String(set.reps).replace(/[^0-9]/g, '')) || 8,
                rir: set.rir ?? 2,
              })),
            })),
        });
      }
      if (days.length === 0 || days.every((d) => d.exercises.length === 0)) {
         showToast('Добавьте хотя бы одно упражнение, прежде чем отправлять к выполнению.', 'warning');
        return;
      }
    } else if (dir === 'pl' && program.pl) {
      // P0-2: custom PL — конвертируем customWeeks в PlayerDay[]
       if (program.pl.sourceCycleId == null && program.pl.customWeeks && program.pl.customWeeks.length > 0) {
        const wm = program.pl.workMax || {};
        const wmFor = (lift: string): number => {
          if (lift === 'bench') return wm.bench ?? 0;
          if (lift === 'dead') return wm.dead ?? 0;
          if (lift === 'squat') return wm.squat ?? 0;
          // Accessories do not have a competition-lift work max; keep their
          // stored/manual weight rather than deriving one from squat PM.
          return 0;
        };
        const wiPL = Math.max(0, Math.min(execWeek - 1, program.pl.customWeeks!.length - 1));
        const wk0 = program.pl.customWeeks[wiPL];
        if (!wk0 || wk0.days.length === 0) {
           showToast('Свой ПЛ-цикл пуст — добавьте дни и упражнения.', 'warning');
          return;
        }
        days = wk0.days.map((d, di) => ({
          label: d.name || `День ${di + 1}`,
          exercises: d.exercises.map((ex) => ({
            name: ex.name,
            muscleGroup: ex.muscle || ex.lift,
            targetSets: ex.sets.map((st) => ({
              weight: Math.round((wmFor(ex.lift) * st.pct) / 2.5) * 2.5,
              reps: st.reps,
              rir: st.rir ?? 2,
            })),
          })),
        }));
      } else {
        // PL: использовать plLmsScheduleDays из manual-constructor.engine — превращает LMS-cycle в PlayerDay[].
        const plDays = plLmsScheduleDays(program);
        if (!plDays || plDays.length === 0) {
           showToast('ПЛ-цикл пустой. Укажите ПМ (приседа/жима/тяги) и проверьте подключение LMS-цикла.', 'warning');
          return;
        }
        const wm = program.pl.workMax || {};
        // Используем detectLift (lms-to-pl.ts) для надёжного определения лифта по имени/группе,
        // вместо regex по русским названиям (хрупко к вариациям имён).
        // P1-5: accessory (null lift) не имеет 1ПМ — вес вводится вручную, не от squat PM.
        const wmVal = (liftStr: string, group: string): number => {
          const lift = detectLift(liftStr, group);
          if (lift === 'bench') return wm.bench ?? 0;
          if (lift === 'dead') return wm.dead ?? 0;
          if (lift === 'squat') return wm.squat ?? 0;
          return 0; // accessory: нет 1ПМ, вес не вычисляется из процентов
        };
        days = plDays.map((pd) => ({
          label: pd.label,
          exercises: (pd.exercises as Array<{ name: string; group: string; sets: Array<{ pct: number; reps: number; weight: number }> }>).map((ex) => {
            const pmBase = wmVal(ex.name, ex.group || '');
            return {
              name: ex.name,
              muscleGroup: ex.group || '',
              targetSets: ex.sets.map((st) => {
                const w = (st as { weight?: number }).weight;
                const pct = (st as { pct?: number }).pct ?? ex.sets[0]?.pct ?? 0.7;
                const computed = (typeof w === 'number' && w > 0)
                  ? w
                  : (pmBase > 0 ? Math.round((pmBase * pct) / 2.5) * 2.5 : 0);
                const rir = (st as { rir?: number }).rir ?? 2;
                return { weight: computed, reps: st.reps ?? 5, rir };
              }),
            };
          }),
        }));
      }
    } else {
      showToast('Сначала выберите ББ или ПЛ программу.', 'warning');
      return;
    }
    try {
      localStorage.setItem('he_pl_runtime', JSON.stringify({ days, focus: program.meta.title || 'Моя программа', week: execWeek, track: dir }));
    } catch (err) {
      // P0: QuotaExceededError — очищаем старые данные и пробуем снова
      if (err instanceof DOMException && err.name === 'QuotaExceededError') {
        try {
          localStorage.removeItem('he_pl_runtime');
          localStorage.setItem('he_pl_runtime', JSON.stringify({ days, focus: program.meta.title || 'Моя программа', week: execWeek, track: dir }));
        } catch {
          showToast('⚠ Недостаточно места в localStorage для сохранения данных тренировки', 'warning');
          return;
        }
      } else {
        showToast('⚠ Ошибка сохранения данных тренировки', 'warning');
        return;
      }
    }
    showToast('🚚 Отправлено к выполнению — откройте зону «▶ Тренировка»');
    }, [program, dir, showToast, execWeek]);

  /** 🖨 PDF-печать программы — print-friendly окно с таблицами */
  const printProgram = useCallback(() => {
    const w = window.open('', '_blank', 'width=800,height=900');
    if (!w) { showToast('⚠ Разрешите всплывающие окна'); return; }
    const safeTitle = escapeHtml(program.meta.title);
    const html: string[] = [];
    html.push(`<!DOCTYPE html><html lang="ru"><head><meta charset="UTF-8"><meta http-equiv="Content-Type" content="text/html; charset=UTF-8"><title>${safeTitle}</title><style>`);
    html.push('body{font-family:"Segoe UI",Arial,"Noto Sans",sans-serif;margin:20px;color:#1a1a1a;background:#fff}');
    html.push('h1{font-size:20px;margin:0 0 6px}h2{font-size:14px;margin:16px 0 6px;color:#333}');
    html.push('table{border-collapse:collapse;width:100%;margin:6px 0;font-size:12px}');
    html.push('th,td{border:1px solid #ccc;padding:4px 8px;text-align:left}th{background:#f0f0f0}');
    html.push('.meta{color:#666;font-size:11px;margin-bottom:12px}');
    html.push('.phase{display:inline-block;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:700;margin-left:6px}');
    html.push('</style></head><body>');
    html.push(`<h1>${safeTitle}</h1>`);
    html.push(`<div class="meta">Цель: ${GOAL_OPTS.find(g=>g.id===program.meta.goal)?.label ?? program.meta.goal} · Уровень: ${LEVEL_OPTS.find(l=>l.id===program.meta.level)?.label ?? program.meta.level} · ${program.meta.daysPerWeek} дн/нед × ${program.meta.weeks} нед</div>`);
    // F2.5: тренерские заметки в PDF
    if (program.meta.notes) {
       html.push(`<div style="white-space:pre-wrap;background:#f5f5f5;padding:10px;border-left:3px solid #60a5fa;margin:10px 0;font-size:11px;color:#333;">📝 <b>Заметки тренера:</b><br>${escapeHtml(program.meta.notes)}</div>`);
    }
    if (program.bb?.weeks) {
      for (const w of program.bb.weeks) {
        html.push(`<h2>Неделя ${w.week} <span class="phase" style="background:${w.deload?'#f59e0b20':'#00e68a20'};color:${w.deload?'#f59e0b':'#00e68a'}">${w.phase}${w.deload?' · делод':''}</span></h2>`);
        if (w.note) html.push(`<p style="margin:2px 0 8px;padding:6px 10px;background:#f0fdf4;border-left:3px solid #00e68a;font-size:11px;color:#166534;white-space:pre-wrap">🗓 Неделя: ${escapeHtml(w.note)}</p>`);
        for (const s of w.sessions) {
           html.push(`<table><thead><tr><th colspan="5">${escapeHtml(s.name || 'День')} ${s.focus ? '· ' + escapeHtml(s.focus) : ''}</th></tr><tr><th>Упражнение</th><th>Группа</th><th>Сеты</th><th>RIR</th><th>Вес</th></tr></thead><tbody>`);
          for (const b of s.blocks) {
            if (!b.exerciseName) continue;
            const setsStr = b.sets.map(st => `${st.reps}×`).join(', ');
            const rir = b.sets[0]?.rir ?? '-';
            const wt = b.sets[0]?.weight ?? 0;
             html.push(`<tr><td>${escapeHtml(b.exerciseName)}</td><td>${escapeHtml(GROUP_RU[b.muscle] ?? b.muscle)}</td><td>${escapeHtml(setsStr)}</td><td>${escapeHtml(rir)}</td><td>${escapeHtml(wt)} кг</td></tr>`);
          }
          html.push('</tbody></table>');
          if (s.note) html.push(`<p style="margin:2px 0 8px;padding:6px 10px;background:#f0fdf4;border-left:3px solid #00e68a;font-size:11px;color:#166534;white-space:pre-wrap">💬 ${escapeHtml(s.note)}</p>`);
        }
      }
     } else if (program.pl) {
      // P4-4: PL в PDF — customWeeks (таблицы) или LMS-расписание
       if (program.pl.sourceCycleId == null && program.pl.customWeeks) {
        // Свой PL-цикл — таблицы как BB
        for (const w of program.pl.customWeeks) {
          html.push(`<h2>Неделя ${w.week} <span class="phase" style="background:${w.deload?'#f59e0b20':'#a78bfa20'};color:${w.deload?'#f59e0b':'#a78bfa'}">${w.phase}${w.deload?' · делод':''}</span></h2>`);
          for (const d of w.days) {
             html.push(`<table><thead><tr><th colspan="5">${escapeHtml(d.name)}</th></tr><tr><th>Упражнение</th><th>Группа</th><th>%1RM</th><th>Повт</th><th>Сетов</th></tr></thead><tbody>`);
            for (const ex of d.exercises) {
              if (!ex.name) continue;
               html.push(`<tr><td>${escapeHtml(ex.name)}</td><td>${escapeHtml(ex.muscle || ex.lift || '')}</td><td>${Math.round((ex.sets[0]?.pct ?? 0) * 100)}%</td><td>${escapeHtml(ex.sets[0]?.reps ?? '-')}</td><td>${ex.sets.length}</td></tr>`);
            }
            html.push('</tbody></table>');
          }
        }
      } else {
        // LMS-цикл — расписание через plLmsScheduleDays
        const plDays = plLmsScheduleDays(program);
         html.push(`<h2>ПЛ-цикл: ${escapeHtml(program.pl.sourceCycleId)}</h2>`);
        html.push(`<div class="meta">ПМ: присед ${program.pl.workMax?.squat ?? '-'} · жим ${program.pl.workMax?.bench ?? '-'} · тяга ${program.pl.workMax?.dead ?? '-'} кг</div>`);
        for (const pd of plDays) {
           html.push(`<table><thead><tr><th colspan="4">${escapeHtml(pd.label)}</th></tr><tr><th>Упражнение</th><th>Группа</th><th>Повт</th><th>Вес</th></tr></thead><tbody>`);
          for (const ex of (pd.exercises as any[])) {
             html.push(`<tr><td>${escapeHtml(ex.name)}</td><td>${escapeHtml(ex.muscleGroup || '')}</td><td>${escapeHtml((ex.sets ?? []).map((s:any) => s.reps).join(', '))}</td><td>${escapeHtml((ex.sets ?? []).map((s:any) => s.weight ?? 0).join(', '))} кг</td></tr>`);
          }
          html.push('</tbody></table>');
        }
      }
       if (program.pl.notes) html.push(`<p>${escapeHtml(program.pl.notes)}</p>`);
     } else if (program.hybrid) {
       html.push(`<h2>Hybrid: ПЛ + ББ</h2>`);
       html.push(`<div class="meta">ПЛ-цикл: ${escapeHtml(program.hybrid.plRef?.sourceCycleId || 'не выбран')} · ББ-недель: ${program.hybrid.bbWeeks?.length ?? 0}</div>`);
for (const w of program.hybrid.bbWeeks ?? []) {
        html.push(`<h2>Неделя ${w.week} <span class="phase" style="background:${w.deload ? '#f59e0b20' : '#3b82f620'};color:${w.deload ? '#f59e0b' : '#3b82f6'}">${escapeHtml(w.phase)}${w.deload ? ' · делод' : ''}</span></h2>`);
        if (w.note) html.push(`<p style="margin:2px 0 8px;padding:6px 10px;background:#eff6ff;border-left:3px solid #3b82f6;font-size:11px;color:#1e40af;white-space:pre-wrap">🗓 Неделя: ${escapeHtml(w.note)}</p>`);
        for (const s of w.sessions ?? []) {
          html.push(`<table><thead><tr><th colspan="5">${escapeHtml(s.name || 'День')} ${s.focus ? '· ' + escapeHtml(s.focus) : ''}</th></tr><tr><th>Упражнение</th><th>Группа</th><th>Сеты</th><th>RIR</th><th>Вес</th></tr></thead><tbody>`);
          for (const b of s.blocks ?? []) {
            if (!b.exerciseName) continue;
            const sets = b.sets ?? [];
            html.push(`<tr><td>${escapeHtml(b.exerciseName)}</td><td>${escapeHtml(GROUP_RU[b.muscle] ?? b.muscle)}</td><td>${escapeHtml(sets.map(st => `${st.reps}×`).join(', '))}</td><td>${escapeHtml(sets[0]?.rir ?? '-')}</td><td>${escapeHtml(sets[0]?.weight ?? 0)} кг</td></tr>`);
          }
          html.push('</tbody></table>');
          if (s.note) html.push(`<p style="margin:2px 0 8px;padding:6px 10px;background:#eff6ff;border-left:3px solid #3b82f6;font-size:11px;color:#1e40af;white-space:pre-wrap">💬 ${escapeHtml(s.note)}</p>`);
        }
      }
       if (program.hybrid.notes) html.push(`<p>${escapeHtml(program.hybrid.notes)}</p>`);
     }
    html.push('</body></html>');
    w.document.write(html.join(''));
    w.document.close();
    setTimeout(() => { w.print(); }, 300);
    }, [program, dir, showToast]);

return (
      <div className="manual-constructor manual-constructor--editor" ref={editorRootRef} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
       {/* Панель действий — обычная (не липкая) */}
        <div className="editor-topbar-shell" style={{ display: 'flex', flexDirection: 'column', gap: 6, background: 'rgba(15,17,22,0.95)', borderRadius: 12, padding: '8px 10px', border: '1px solid rgba(255,255,255,0.06)', boxShadow: '0 6px 18px rgba(0,0,0,0.35)' }}>
        <div className="manual-constructor__header editor-topbar" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <button style={{ ...BTN_GHOST, padding: '8px 12px', fontSize: 11, minHeight: 40 }} onClick={safeBack}>← К списку</button>
          <span style={{ fontSize: 11, fontWeight: 800, color: DIR_COLOR[dir] }}>{DIR_LABEL[dir]} · {SOURCE_LABEL[program.meta.source] ?? program.meta.source}</span>
          <span style={{ fontSize: 10, color: DIM, fontWeight: 600, whiteSpace: 'nowrap' }}>
            🎯 {GOAL_OPTS.find(g => g.id === program.meta.goal)?.label ?? program.meta.goal} · 📶 {LEVEL_OPTS.find(l => l.id === program.meta.level)?.label ?? program.meta.level} · {program.meta.daysPerWeek}д × {program.meta.weeks}н
          </span>
          {isDirty && <span style={{ fontSize: 11, fontWeight: 800, color: '#f59e0b' }} title="Несохранённые изменения">●</span>}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <button style={{ ...BTN, padding: '8px 14px', fontSize: 11, minHeight: 40 }} onClick={() => { if (handleSave('Ручная правка')) { setSavedFlash(true); window.setTimeout(() => setSavedFlash(false), 1600); } }} title="Сохранить программу (Ctrl+S)">
              {savedFlash ? '💾 Сохранено ✓' : '💾 Сохранить'}
            </button>
            <button style={{ ...BTN_GHOST, padding: '6px 12px', fontSize: 11, minHeight: 40 }} onClick={() => setShowMore(v => !v)} title="Дополнительные инструменты" aria-expanded={showMore}>⋯ Ещё</button>
          </div>
        </div>
        {/* Быстрые действия — всегда видны (undo/redo/таблица/PDF/выполнение) */}
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', paddingTop: 4, alignItems: 'center' }}>
          <button style={{ ...BTN_GHOST, padding: '6px 10px', fontSize: 11, minHeight: 36, borderColor: showTableView ? 'rgba(0,230,138,0.6)' : 'rgba(255,255,255,0.15)', color: showTableView ? '#00e68a' : DIM }} onClick={() => setShowTableView(v => !v)} title={showTableView ? 'Переключить в редактор' : 'Показать таблицу плана'}>{showTableView ? '✏️ Редактор' : '📋 Таблица'}</button>
          <button style={{ ...BTN_GHOST, padding: '6px 10px', fontSize: 11, minHeight: 36 }} onClick={undo} title="Отменить (Ctrl+Z)">↩</button>
          <button style={{ ...BTN_GHOST, padding: '6px 10px', fontSize: 11, minHeight: 36 }} onClick={redo} title="Повторить (Ctrl+Shift+Z)">↪</button>
          <button style={{ ...BTN_GHOST, padding: '6px 10px', fontSize: 11, minHeight: 36, borderColor: 'rgba(167,139,250,0.4)', color: '#a78bfa' }} onClick={printProgram} title="Печать / PDF">🖨 PDF</button>
          {(dir === 'bb' || dir === 'pl') && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 3, marginLeft: 2 }}>
              <label style={{ fontSize: 10, color: DIM, display: 'flex', alignItems: 'center', gap: 3 }}>
                Нед
                <input type="number" style={{ ...IN, padding: '3px 4px', fontSize: 11, width: 44, minHeight: 32, textAlign: 'center' }} value={execWeek} min={1} max={program.meta.weeks} onChange={e => { const v = Number(e.target.value); if (Number.isFinite(v)) setExecWeek(Math.max(1, Math.min(program.meta.weeks, Math.round(v)))); }} aria-label="Неделя для выполнения" inputMode="numeric" />
              </label>
              {dir === 'bb' && <button style={{ ...BTN_GHOST, padding: '6px 10px', fontSize: 11, minHeight: 36, borderColor: 'rgba(96,165,250,0.4)', color: '#60a5fa' }} onClick={sendToExecution} title="Отправить неделю к выполнению">🚚 К вып.</button>}
              {dir === 'pl' && program.pl && <button style={{ ...BTN_GHOST, padding: '6px 10px', fontSize: 11, minHeight: 36, borderColor: 'rgba(167,139,250,0.4)', color: '#a78bfa' }} onClick={sendToExecution} title="Отправить ПЛ-неделю к выполнению">🚚 К вып.</button>}
            </span>
          )}
          <span style={{ fontSize: 10, color: DIM, marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
            {isDirty ? <span style={{ color: '#f59e0b', fontWeight: 700 }}>● не сохранено</span> : <span style={{ color: '#22c55e' }}>✓ сохранено</span>}
            <span style={{ opacity: 0.6 }}>| Ctrl+Z отмена</span>
          </span>
        </div>
        {showMore && (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', paddingTop: 6, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            {/* Авто-сборка — доступна в обоих режимах, в standard с подсказкой про профиль */}
            <button disabled={isAutoFilling} style={{ ...BTN_GHOST, padding: '6px 10px', fontSize: 11, minHeight: 40, borderColor: 'rgba(0,230,138,0.4)', color: '#00e68a', opacity: isAutoFilling ? 0.65 : 1 }} onClick={autoFillDraft} title={isPro ? "Заполнить черновик на основе цели/уровня/дней и профиля тренированности" : "⚡ Быстро собрать качественную программу — 1 клик (использует ваш профиль: уровень, оборудование, слабые группы)"}>{isAutoFilling ? '⏳ Создание...' : isPro ? '⚡ Авто-черновик' : '⚡ Собрать качественно — 1 клик'}</button>
            <button style={{ ...BTN_GHOST, padding: '6px 10px', fontSize: 11, minHeight: 40, borderColor: 'rgba(245,158,11,0.4)', color: '#f59e0b' }}
              onClick={() => { if (dir === 'bb') setEditorLibOpen('bb'); else if (dir === 'pl') setEditorLibOpen('pl'); }}
              title="Загрузить программу или цикл из библиотеки для редактирования"
            >📥 Загрузить</button>
            {isPro && dir === 'bb' && program.bb && (program.bb.weeks?.length ?? 0) >= 4 && (
              <button style={{ ...BTN_GHOST, padding: '6px 10px', fontSize: 11, minHeight: 40, borderColor: 'rgba(96,165,250,0.4)', color: '#60a5fa' }}
                onClick={() => { const updated = { ...program.bb!, weeks: applyPhaseModulation(program.bb!.weeks!, { goal: program.meta.goal, level: program.meta.level, weeksTotal: program.meta.weeks || 4 }) }; update({ bb: updated }); showToast('📈 Фазовая периодизация применена: RIR/фазы/повторения по неделям'); }}
                title="Применить фазовую периодизацию (RIR/объём/повторения по неделям)"
              >📈 Применить фазы</button>
            )}
            {isPro && (
              <button style={{ ...BTN_GHOST, padding: '6px 10px', fontSize: 11, minHeight: 40, borderColor: 'rgba(245,158,11,0.5)', color: '#f59e0b' }}
                onClick={() => { setMacroLevel(program.meta.level); setMacroGoal(mapGoalToMacro(program.meta.goal)); setEditorLibOpen('macro'); }}
                title="Годовое планирование: построить макроцикл (5 фаз) и применить к программе"
              >🗓 Годовой план</button>
            )}
            {isPro && (
              <button style={{ ...BTN_GHOST, padding: '6px 10px', fontSize: 11, minHeight: 40, borderColor: 'rgba(167,139,250,0.4)', color: '#a78bfa' }}
                onClick={() => setEditorLibOpen('methods')}
                title="Справочник тренировочных методик"
              >📚 Методики</button>
            )}
            <button style={{ ...BTN_GHOST, padding: '6px 10px', fontSize: 11, minHeight: 40, borderColor: 'rgba(0,230,138,0.4)', color: '#00e68a' }} onClick={() => setCardioView('card')} title="Кардио: подключённый цикл, «Сегодня», пересчёт под ACWR и конструктор">❤️ Кардио</button>
          </div>
        )}
        </div>

      {/* Пилюли шагов + заголовок активного шага — обычный контент (не липкие) */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        {editorSteps.map((s, si) => (
          <button key={s} onClick={() => setEstep(s)} style={STEP_PILL(estep === s)} aria-current={estep === s ? 'step' : undefined} title={EDITOR_STEP_INFO[s].hint}>
            {si < estepIdx ? '✓ ' : ''}{EDITOR_STEP_LABELS[s]}
          </button>
        ))}
        <span style={{ fontSize: 10, color: DIM, fontWeight: 600, marginLeft: 'auto' }}>шаг {estepIdx + 1} из {editorSteps.length}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 14, fontWeight: 800, color: '#fff', letterSpacing: -0.2 }}>{EDITOR_STEP_INFO[estep].title}</span>
        <span style={{ fontSize: 11, color: DIM, lineHeight: 1.3 }}>{EDITOR_STEP_INFO[estep].hint}</span>
      </div>
      <div style={{ height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
        <div style={{ height: '100%', borderRadius: 2, background: 'linear-gradient(90deg,#00e68a,#00c8a0)', width: `${Math.round(((estepIdx + 1) / editorSteps.length) * 100)}%`, transition: 'width .3s ease' }} />
      </div>

      {/* P2-1/F5: подсказка при пустой программе — прямая CTA авто-черновика (шаг «🎛 Параметры») */}
      {estep === 'params' && (() => {
        const bbEmpty = !!program.bb && (program.bb.weeks ?? []).every(w => w.sessions.every(s => s.blocks.length === 0));
        const plEmpty = !!program.pl && !program.pl.schedule.length && !(program.pl.customWeeks ?? []).length;
        if (!bbEmpty && !plEmpty) return null;
        const emptyDir: 'bb' | 'pl' = bbEmpty ? 'bb' : 'pl';
        return (
        <div className="constructor-surface constructor-surface--accent" style={{ ...CARD, padding: 14, borderLeft: '3px solid #00e68a' }}>
          <div style={{ fontSize: 12, color: DIM_STRONG, lineHeight: 1.5, marginBottom: 8 }}>
            💡 Пустая программа. Заполните автоматически на основе вашего профиля или возьмите готовую из библиотеки.
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button style={{ ...BTN, padding: '8px 16px', fontSize: 12, minHeight: 44 }} onClick={() => autoFillDraft()} title="Автоматическая сборка на основе цели/уровня/дней">
              {isAutoFilling ? '⏳ Создание...' : '⚡ Создать автоматически'}
            </button>
            <button style={{ ...BTN_GHOST, padding: '8px 16px', fontSize: 12, minHeight: 44, color: '#a78bfa', borderColor: 'rgba(167,139,250,0.3)' }} onClick={() => setEditorLibOpen(emptyDir)}>
              📥 Загрузить из библиотеки
            </button>
          </div>
        </div>
        );
      })()}

      {/* P1-1: planner-bridge баннер — рекомендация от калькулятора */}
      {bridgeApply && (
        <div className="constructor-surface constructor-surface--warning" style={{ ...CARD, padding: 10, borderLeft: '3px solid #f59e0b', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#f59e0b', flex: 1, minWidth: 100 }}>🔗 Калькулятор рекомендует: {bridgeApply.label}</span>
          <button style={{ ...BTN, padding: '6px 14px', fontSize: 11, minHeight: 44 }} onClick={() => applyBridgePayload(bridgeApply)}>Применить</button>
          <button style={{ ...BTN_GHOST, padding: '6px 14px', fontSize: 11, minHeight: 44 }} onClick={() => { clearPlannerApply(); setBridgeApply(null); }}>✕</button>
        </div>
      )}

      {/* Пустой-state для про-шагов анализа/обратной связи/инструментов при несобранной программе */}
      {isPro && (estep === 'analysis' || estep === 'feedback' || estep === 'tools') && (() => {
        const bbEmpty = !!program.bb && (program.bb.weeks ?? []).every(w => w.sessions.every(s => s.blocks.length === 0));
        const plEmpty = !!program.pl && !program.pl.schedule.length && !(program.pl.customWeeks ?? []).length;
        if (!bbEmpty && !plEmpty) return null;
        return (
          <div className="constructor-surface" style={{ ...CARD, padding: 12, borderLeft: '3px solid #60a5fa' }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#60a5fa', marginBottom: 4 }}>📊 Сначала соберите программу</div>
            <div style={{ fontSize: 11, color: DIM_STRONG, lineHeight: 1.45 }}>
              Авто-сборка (⚡ Создать автоматически) или загрузка из библиотеки на шаге «🎛 Параметры» — затем здесь появятся анализ, обратная связь и инструменты.
            </div>
          </div>
        );
      })()}

      {/* ═════════ ПРОФЕССИОНАЛЬНЫЙ РЕЖИМ: пошаговые секции (профиль / анализ / обратная связь / инструменты) ═════════ */}
      {isPro && estep === 'profile' && (
      <>
      <TrainingProfileCard profile={tprofile} update={updateTProfile} compact />
      </>
      )}
      {isPro && estep === 'analysis' && (
      <>
      {/* P4 — контекстная панель ББ (ПЛ дубль PLEditor удалён — F4.5) */}
      {dir === 'bb' && program.bb && <BbContextPanel program={program} level={program.meta.level} />}
      {dir === 'bb' && program.bb && <MesoHeatmap program={program} dir={dir} onToast={showToast} />}

      {/* Лабораторная коррекция плана: MRV× + предупреждения по анализам */}
      {labAdjust.mrvMultiplier < 1 && (() => {
        const feeders = suggestFeeders((tprofile.weakPoints ?? []) as string[], (tprofile.equipment ?? []) as string[]);
        return (
          <div style={{ ...panelStyle('#f59e0b'), padding: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#f59e0b', marginBottom: 4 }}>
              🧪 Лабораторная коррекция плана (MRV ×{labAdjust.mrvMultiplier.toFixed(2)})
            </div>
            {labAdjust.intensityNote && <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.85)', marginBottom: 4 }}>{labAdjust.intensityNote}</div>}
            {labAdjust.warnings.length > 0 && (
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.85)', lineHeight: 1.45 }}>
                {labAdjust.warnings.map((w, i) => <div key={i}>• {w}</div>)}
              </div>
            )}
            {labAdjust.deloadRecommended && (
              <div style={{ fontSize: 10, fontWeight: 700, color: '#ef4444', marginTop: 4 }}>⚠ Рекомендуется разгрузочная неделя</div>
            )}
            {feeders.length > 0 && (
              <div style={{ fontSize: 10, color: '#a78bfa', marginTop: 6, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 6 }}>
                🔥 Фидер-сеты для слабых групп: {feeders.map((f) => `${f.exercise} ${f.sets}×${f.reps}`).join(' · ')}
              </div>
            )}
          </div>
        );
      })()}

<ProPanelsGroup sections={[
        {
          id: 'plan-analysis',
          title: '📊 Анализ плана',
          hint: 'Score, MRV, объём, периодизация, прогрессия',
          color: '#22c55e',
          content: <>
            <ProgramStrengthScore program={program} dir={dir} />
            <PlanDiagnosticsPanel program={program} dir={dir} onChange={onChange} showToast={showToast} labMrvMult={labAdjust.mrvMultiplier} />
            <InteractiveVolumePanel program={program} dir={dir} onChange={onChange} showToast={showToast} labMrvMult={labAdjust.mrvMultiplier} />
            <ProgressionCoach program={program} dir={dir} onChange={onChange} showToast={showToast} labMrvMult={labAdjust.mrvMultiplier} onCourse={tprofile.onCourse ?? false} courseIntensity={tprofile.courseIntensity ?? 'moderate'} />
            <TonnageEstimatePanel program={program} dir={dir} />
          </>,
        },
      ]} />
      </>
      )}
      {isPro && estep === 'feedback' && (
      <>
      <ProPanelsGroup sections={[
        {
          id: 'feedback',
          title: '🔄 Обратная связь (sRPE / RIR / чек-ин)',
          hint: 'ACWR, RIR-bias, готовность, чек-ин, what-if',
          color: '#3b82f6',
          content: <>
            <LoadGuardPanel program={program} dir={dir} />
            <RIRCalibrationPanel program={program} dir={dir} onChange={onChange} showToast={showToast} />
            <RealMRVPanel program={program} dir={dir} labMrvMult={labAdjust.mrvMultiplier} />
            <ReadinessForecastPanel program={program} dir={dir} />
            <CheckinGuardPanel program={program} dir={dir} />
            <WhatIfGuardPanel program={program} dir={dir} />
            <StrengthDiaryPanel program={program} dir={dir} />
          </>,
        },
      ]} />
      </>
      )}
      {isPro && estep === 'tools' && (
      <>
      {dir === 'pl' && (
        <div style={{ ...panelStyle('#a78bfa'), padding: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#c4b5fd', marginBottom: 3 }}>
            🏆 ПЛ PRO: диагностика, мёртвые точки и инструменты
          </div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', marginBottom: 8 }}>
            Анализ применяется только как рекомендация и добавление ассистентов. Исходные упражнения и процентовки ПЛ-цикла не изменяются.
          </div>
          <PlannerToolsPanel mode="pl" />
          <div style={{ marginTop: 10, borderTop: '1px solid rgba(167,139,250,0.2)', paddingTop: 8 }}>
            <PlDeadpointsBarPathCard />
          </div>
        </div>
      )}
      <ProPanelsGroup sections={[
        {
          id: 'technique',
          title: '🦴 Техника и биомеханика',
          hint: 'Срывы, bar-path, блины, инфо об упражнениях',
          color: '#06b6d4',
          content: <>
            <StickingPointPanel program={program} dir={dir} onChange={onChange} showToast={showToast} />
            <BiomechanicsPanel program={program} dir={dir} />
            <PlateAutoPanel program={program} dir={dir} />
            <ExerciseInfoPanel program={program} dir={dir} />
          </>,
        },
        {
          id: 'tools',
          title: '🔧 Инструменты тренера',
          hint: 'Подбор сплита, замены упражнений, история ревизий',
          color: '#a78bfa',
          content: <>
            <SplitConsultant program={program} dir={dir} onChange={onChange} showToast={showToast} labMrvMult={labAdjust.mrvMultiplier} />
            <SubstitutionPanel program={program} dir={dir} onChange={onChange} showToast={showToast} labMrvMult={labAdjust.mrvMultiplier} />
            <ProgramRevisionsDiff program={program} />
          </>,
        },
      ]} />
      </>
      )}

      {/* 🗓 Годовой план — MacrocyclePanel (модал, только в про-режиме) */}
      {isPro && editorLibOpen === 'macro' && (
        <TrainingModal title="🗓 Годовое планирование" onClose={() => setEditorLibOpen(null)} wide>
          <div style={{ fontSize: 11, color: DIM, marginBottom: 8 }}>
            {dir === 'bb'
              ? 'Постройте макроцикл ББ (4 фазы: гипертрофия → сила → contest prep → переход).'
              : 'Постройте макроцикл ПЛ (5 фаз: выносливость → сила → пик → соревнования → переход).'}
            Клик по блоку → применить как активный цикл/программу. Текущее направление: <b style={{ color: DIR_COLOR[dir] }}>{DIR_LABEL[dir]}</b>.
          </div>
          <MacrocyclePanel
            level={macroLevel}
            goal={macroGoal}
            onLevelChange={setMacroLevel}
            onGoalChange={setMacroGoal}
            storageKey={dir === 'bb' ? 'he_bb_macro' : 'he_pl_macro'}
             onApplyCycle={(cycleId, weeks) => {
              if (dir === 'pl') {
                // PL: загрузить LMS-цикл + установить weeks
                loadCycleIntoEditor(cycleId);
                updateMeta({ weeks });
                setEditorLibOpen(null);
                showToast('🗓 ПЛ-цикл применён: ' + cycleId + ' (' + weeks + ' нед)');
              } else if (dir === 'bb') {
                // BB: применить макроцикл как ББ-программу (macrocycleToBBProgram)
                // MC-1 FIX: read both he_bb_macro and he_pl_macro
                try {
                  const rawBB = localStorage.getItem('he_bb_macro');
                  const rawPL = localStorage.getItem('he_pl_macro');
                  const raw = rawBB || rawPL;
                  if (!raw) {
                    showToast('⚠ Годовой план не найден — постройте макроцикл сначала');
                  } else {
                    const macro = rawBB ? deserializeBbMacro(raw) : deserializeMacro(raw);
                    if (!macro) {
                      showToast('⚠ Годовой план повреждён — пересоберите в MacrocyclePanel');
                    } else {
                      const mProfData = linked.profile?.settings?.personal;
                      const mLifeData = linked.profile?.settings?.lifestyle;
                      const mBodyFat = mProfData?.bodyFat;
                      const mLeanMass = (mProfData?.weight && mBodyFat != null) ? Math.round(mProfData.weight * (1 - mBodyFat / 100)) : undefined;
                      const newProg = macrocycleToBBProgram(macro, {
                        level: macroLevel,
                        goal: program.meta.goal,
                        daysPerWeek: program.meta.daysPerWeek,
                        weakPoints: (tprofile.weakPoints ?? []) as string[],
                        equipment: program.bb?.constraints?.equipment ?? [],
                        trainingFocus: program.meta.trainingFocus,
                        bodyFat: mBodyFat, leanMass: mLeanMass, hrvMs: mLifeData?.morningHRV, sleepHours: mLifeData?.sleepHours, stressLevel: mLifeData?.stressLevel, labMrvMultiplier: labAdjust.mrvMultiplier,
                      });
                      onChange(newProg);
                      setEditorLibOpen(null);
                      showToast('🗓 Годовой план ББ создан: ' + macro.totalWeeks + ' нед, 4 фазы');
                    }
                  }
                } catch (e) {
                  showToast('⚠ Не удалось создать ББ-план: ' + (e as Error)?.message);
                }
              } else if (dir === 'hybrid') {
                // Hybrid: применить макроцикл для bb-части, pl-часть не трогается
                // MC-2 FIX: read both he_bb_macro and he_pl_macro
                try {
                  const rawBB = localStorage.getItem('he_bb_macro');
                  const rawPL = localStorage.getItem('he_pl_macro');
                  const raw = rawBB || rawPL;
                  if (!raw) {
                    showToast('⚠ Годовой план не найден — постройте макроцикл сначала');
                  } else {
                    const macro = rawBB ? deserializeBbMacro(raw) : deserializeMacro(raw);
                    if (!macro) {
                      showToast('⚠ Годовой план повреждён — пересоберите в MacrocyclePanel');
                    } else {
                      const mProfData = linked.profile?.settings?.personal;
                      const mLifeData = linked.profile?.settings?.lifestyle;
                      const mBodyFat = mProfData?.bodyFat;
                      const mLeanMass = (mProfData?.weight && mBodyFat != null) ? Math.round(mProfData.weight * (1 - mBodyFat / 100)) : undefined;
                      const bbProg = macrocycleToBBProgram(macro, {
                        level: macroLevel,
                        goal: 'hypertrophy',
                        daysPerWeek: Math.max(2, program.meta.daysPerWeek - 3),
                        weakPoints: (tprofile.weakPoints ?? []) as string[],
                        equipment: program.bb?.constraints?.equipment ?? [],
                        trainingFocus: program.meta.trainingFocus,
                        bodyFat: mBodyFat, leanMass: mLeanMass, hrvMs: mLifeData?.morningHRV, sleepHours: mLifeData?.sleepHours, stressLevel: mLifeData?.stressLevel, labMrvMultiplier: labAdjust.mrvMultiplier,
                      });
                      if (bbProg.bb) {
                        update({ hybrid: { ...program.hybrid!, bbWeeks: bbProg.bb.weeks } });
                        setEditorLibOpen(null);
                        showToast('🗓 Hybrid: ББ-недели обновлены из макроцикла (' + macro.totalWeeks + ' нед)');
                      }
                    }
                  }
                } catch (e) {
                  showToast('⚠ Hybrid: ' + (e as Error)?.message);
                }
               }
             }}
             onApplyMacrocycle={dir === 'pl' ? undefined : applyWholeMacrocycle}
           />
        </TrainingModal>
      )}

      {/* 📚 Методики — справочник тренера (открывается из шапки, только в про-режиме) */}
      {isPro && editorLibOpen === 'methods' && (
        <TrainingModal title="📚 Справочник методик" onClose={() => setEditorLibOpen(null)} wide>
          <div style={{ fontSize: 11, color: DIM, marginBottom: 8 }}>
            Энциклопедия тренировочных методик по категориям. Клик «Применить» → отправляет методику в planning-bridge (loadStrategy/intensityTechniques). Двойной клик по карточке разворачивает детали.
          </div>
          <MethodologyEncyclopedia />
        </TrainingModal>
      )}

      {/* ❤️ Кардио внутри редактора: интеграционная карточка + конструктор в модале
          (внешний трек planning-track-open больше не используется в ручном конструкторе) */}
      {cardioView && (
        <TrainingModal title={cardioView === 'card' ? '❤️ Кардио — интеграция с силовым планом' : '❤️ Кардио-конструктор'} onClose={() => setCardioView(null)} wide>
          {cardioView === 'card' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <CardioLinkCard onOpenCardio={() => setCardioView('constructor')} />
              <button style={{ ...BTN, padding: '10px 14px', fontSize: 12, minHeight: 44 }} onClick={() => setCardioView('constructor')} title="Собрать или редактировать кардио-цикл">
                ⚙️ Перейти к конструктору →
              </button>
            </div>
          ) : (
            <CardioConstructor />
          )}
        </TrainingModal>
      )}

      {/* Шаг «🗓 Недели»: расписание, таблица плана, редактор недель/сессий, статистика */}
      {estep === 'weeks' && (
      <>
      {/* P0-1: карточка связи с дизайном периодизации */}
      {(program.meta.designRef || savedDesigns.length > 0) && (
        <div className="constructor-surface" style={{ ...CARD, padding: 12, borderLeft: `3px solid ${program.meta.designRef ? (linkedDesign && isProgramDesignStale(program, linkedDesign) ? '#f59e0b' : ACCENT) : '#3b82f6'}` }}>
          {program.meta.designRef && !linkedDesign && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, color: DIM_STRONG }}>
                📁 Дизайн «{program.meta.designRef.name}» удалён — связь устарела.
              </span>
              <button style={{ ...BTN_GHOST, padding: '6px 10px', fontSize: 11, minHeight: 44 }} onClick={handleUnlinkDesign}>✕ Отвязать</button>
            </div>
          )}
          {program.meta.designRef && linkedDesign && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, color: DIM_STRONG }}>
                🎨 Дизайн периодизации: <b style={{ color: ACCENT }}>{linkedDesign.name}</b>
                {isProgramDesignStale(program, linkedDesign) && (
                  <span style={{ color: '#f59e0b', fontWeight: 700 }}> · ⚠ дизайн изменён</span>
                )}
              </span>
              <button style={{ ...BTN, padding: '6px 10px', fontSize: 11, minHeight: 44 }} onClick={() => handleReapplyDesign(linkedDesign)}>↻ Переразметить фазы</button>
              <button style={{ ...BTN_GHOST, padding: '6px 10px', fontSize: 11, minHeight: 44 }} onClick={handleUnlinkDesign}>✕ Отвязать</button>
            </div>
          )}
          {!program.meta.designRef && savedDesigns.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, color: DIM_STRONG }}>🎨 Привязать дизайн периодизации:</span>
              <EditorPopupSelect
                value={designLinkId}
                options={[{ id: '', label: '— выберите дизайн —' }, ...savedDesigns.map(d => ({ id: d.id, label: `${d.name} (${d.blocks.length} блоков)` }))]}
                onChange={setDesignLinkId}
                ariaLabel="Дизайн периодизации"
                title="Дизайн периодизации"
                placeholder="— выберите дизайн —"
                buttonStyle={{ maxWidth: 260 }}
              />
              <button style={{ ...BTN, padding: '6px 10px', fontSize: 11, minHeight: 44, opacity: designLinkId ? 1 : 0.4 }}
                disabled={!designLinkId}
                onClick={() => {
                  const d = savedDesigns.find(x => x.id === designLinkId);
                  if (d) handleLinkDesign(d);
                }}>🔗 Привязать</button>
            </div>
          )}
        </div>
      )}
      {(() => {
        const bbEmpty = !!program.bb && (program.bb.weeks ?? []).every(w => w.sessions.every(s => s.blocks.length === 0));
        const plEmpty = !!program.pl && !program.pl.schedule.length && !(program.pl.customWeeks ?? []).length;
        if (!bbEmpty && !plEmpty) return null;
        return (
          <div className="constructor-surface" style={{ ...CARD, padding: 12, borderLeft: '3px solid #f59e0b' }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#f59e0b', marginBottom: 4 }}>🗓 Недели пока пустые</div>
            <div style={{ fontSize: 11, color: DIM_STRONG, lineHeight: 1.45, marginBottom: 8 }}>
              Соберите программу автоматически или загрузите из библиотеки — здесь появятся расписание недели и упражнения.
            </div>
            <button style={{ ...BTN, padding: '8px 16px', fontSize: 12, minHeight: 44 }} onClick={() => autoFillDraft()}>
              {isAutoFilling ? '⏳ Создание...' : '⚡ Создать автоматически'}
            </button>
          </div>
        );
      })()}
      {showTableView && dir === 'bb' && program.bb && (
        <PlanSummaryTable program={program} showWeek={execWeek} onShowWeekChange={setExecWeek} />
      )}

      {!showTableView && (
      <>

      {((dir === 'bb' && program.bb?.weeks?.[0]?.sessions) || (dir === 'pl' && program.pl?.schedule)) && (() => {
        const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
        const groupColors: Record<string, string> = {
          chest: '#22c55e', back: '#3b82f6', legs: '#f59e0b', shoulders: '#a78bfa',
          arms: '#ef4444', core: '#06b6d4',
        };
        let dayLabels: Array<{ idx: number; label: string; muscles: string[]; sessionIdx?: number }> = [];
        if (dir === 'bb' && program.bb) {
          dayLabels = (program.bb.weeks[0]?.sessions ?? []).map((s, i) => ({
            idx: sessionDayOfWeek(s, i),
            label: s.name || `День ${i + 1}`,
            muscles: Array.from(new Set((s.blocks ?? []).map((b) => b.muscle).filter(Boolean))),
            sessionIdx: i,
          }));
        } else if (dir === 'pl' && program.pl) {
          dayLabels = (program.pl.schedule ?? []).map((s, i) => ({
            idx: s.dayOfWeek,
            label: (s.sessionIdx != null ? `Сессия ${s.sessionIdx + 1}` : `День ${i + 1}`),
            muscles: ['—'],
          }));
        }
        const dayByDow: Record<number, { idx: number; label: string; muscles: string[]; sessionIdx?: number }> = {};
        dayLabels.forEach((d) => { dayByDow[d.idx % 7] = d; });
        const todayIdx = (new Date().getDay() + 6) % 7;
        const bbEditable = dir === 'bb' && !!(program.bb?.weeks?.[0]?.sessions ?? []).length;
        const bbSessions = bbEditable ? (program.bb?.weeks?.[0]?.sessions ?? []) : [];
        return (
          <div className="constructor-surface" style={{ ...CARD, padding: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: ACCENT, marginBottom: 6 }}>
              🗓 Неделя — расписание
              <span style={{ fontSize: 11, color: DIM, marginLeft: 6, fontWeight: 500 }}>
                (по плану текущей редактируемой программы)
              </span>
              {bbEditable && (
                <button
                  type="button"
                  aria-label="Вернуть рекомендованные дни недели"
                  title="Вернуть рекомендованные дни недели (Пн·Ср·Пт…) для всех сессий"
                  onClick={resetScheduleRecommended}
                  style={{ ...BTN_GHOST, padding: '4px 8px', fontSize: 10, minHeight: 40, marginLeft: 6, borderColor: 'rgba(0,230,138,0.35)', color: ACCENT }}
                >
                  ⟳ По рекомендации
                </button>
              )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(52px, 1fr))', gap: 4 }}>
              {WEEKDAYS.map((day, wi) => {
                const d = dayByDow[wi];
                const isToday = wi === todayIdx;
                const fill = d ? 'rgba(0,230,138,0.06)' : 'rgba(255,255,255,0.02)';
                const isRec = bbEditable && d?.sessionIdx != null && sessionUsesRecommendedDay(bbSessions[d.sessionIdx], d.sessionIdx);
                const cellStyle: React.CSSProperties = {
                  minHeight: 64, borderRadius: 6, padding: '6px 4px',
                  background: fill,
                  border: isToday ? '2px solid #00e68a' : (d ? '1px solid rgba(0,230,138,0.25)' : '1px solid rgba(255,255,255,0.05)'),
                  textAlign: 'center',
                  boxShadow: isToday ? '0 0 10px rgba(0,230,138,0.25)' : 'none',
                };
                const inner = (
                  <>
                    <div style={{ fontSize: 11, fontWeight: 700, color: d ? '#00e68a' : DIM }}>
                      {day}{isRec ? '⭐' : ''}{isToday ? ' · сегодня' : ''}
                    </div>
                    {d ? (
                      <>
                        <div style={{ fontSize: 10, color: DIM_STRONG, marginTop: 4, fontWeight: 600 }}>{d.label}</div>
                        <div style={{ fontSize: 10, color: DIM, marginTop: 2, lineHeight: 1.2 }}>
                          {d.muscles.filter((m) => m !== '—').slice(0, 2).map((m, mi) => (
                            <span key={mi} style={{
                              display: 'inline-block', padding: '2px 5px', marginRight: 2,
                              borderRadius: 3, fontSize: 10,
                              background: (groupColors[m] ?? '#888') + '20',
                              color: groupColors[m] ?? '#fff',
                            }}>{GROUP_RU[m] ?? m}</span>
                          )) ?? null}
                        </div>
                      </>
                    ) : (
                      <div style={{ fontSize: 10, color: DIM, marginTop: 12, fontStyle: 'italic' }}>отдых</div>
                    )}
                  </>
                );
                if (!bbEditable) {
                  return <div key={wi} style={cellStyle}>{inner}</div>;
                }
                const isFree = !d;
                return (
                  <button
                    key={wi}
                    type="button"
                    className="editor-schedule-cell"
                    aria-label={isFree
                      ? `Назначить тренировку на ${day}`
                      : `Сменить день: ${d!.label}`}
                    title={isFree ? 'Назначить тренировку на этот день' : 'Изменить день этой тренировки'}
                    onClick={() => setSchedulePick(isFree
                      ? { kind: 'assign', day: wi }
                      : { kind: 'move', sessionIdx: d!.sessionIdx!, day: wi })}
                    style={{ ...cellStyle, display: 'block', width: '100%', font: 'inherit', color: 'inherit', cursor: 'pointer', margin: 0 }}
                  >
                    {inner}
                  </button>
                );
              })}
            </div>
            <div style={{ fontSize: 10, color: DIM, marginTop: 6, fontStyle: 'italic' }}>
              {bbEditable
                ? 'Нажмите на день, чтобы перенести тренировку или назначить её на свободный день. ⭐ — рекомендованный день (Пн·Ср·Пт…). Изменение применяется ко всем неделям программы.'
                : 'Шаблон недели повторяется для всех мезоциклов. Делод-недели должны быть явно отмечены флагом «deload» в структуре.'}
            </div>
          </div>
        );
      })()}

      {/* Попап карточки «🗓 Неделя — расписание» (BB): смена/назначение дня недели */}
      {schedulePick && dir === 'bb' && program.bb?.weeks?.[0]?.sessions && (() => {
        const w0 = program.bb!.weeks[0]!;
        const sessions = w0.sessions;
        const { day } = schedulePick;
        const closeBtnStyle: React.CSSProperties = { ...BTN_GHOST, marginTop: 8, width: '100%', fontSize: 11, minHeight: 44 };
        return (
          <TrainingModal
            title={schedulePick.kind === 'move'
              ? `📅 День: ${sessions[schedulePick.sessionIdx]?.name || `День ${schedulePick.sessionIdx + 1}`}`
              : `📅 Назначить на ${TRAINING_DAY_NAMES[day]}`}
            onClose={() => setSchedulePick(null)}
          >
            {schedulePick.kind === 'move' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ fontSize: 10, color: DIM, marginBottom: 2 }}>
                  Выберите день недели. ⭐ — рекомендованный для этой сессии; занятые дни недоступны.
                </div>
                {TRAINING_DAY_NAMES.map((d, di) => {
                  const si = schedulePick.sessionIdx;
                  const isSel = di === day;
                  const isOcc = sessions.some((s, i) => i !== si && sessionDayOfWeek(s, i) === di);
                  const isRec = trainingDayForIndex(si) === di;
                  return (
                    <button
                      key={di}
                      type="button"
                      className="editor-chip"
                      disabled={isOcc}
                      aria-label={`Перенести на ${d}`}
                      onClick={() => { setWeekSessionDay(si, di); setSchedulePick(null); }}
                      style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%',
                        padding: '10px 12px', borderRadius: 10, cursor: isOcc ? 'not-allowed' : 'pointer',
                        textAlign: 'left', fontSize: 11, fontWeight: isSel ? 700 : 400,
                        background: isSel ? 'rgba(0,230,138,0.12)' : 'rgba(255,255,255,0.03)',
                        border: isSel ? '1px solid rgba(0,230,138,0.3)' : '1px solid rgba(255,255,255,0.06)',
                        color: isSel ? ACCENT : isOcc ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.85)',
                        minHeight: 44,
                      }}
                    >
                      <span>{d}{isRec ? ' ⭐ рекомендованный' : ''}{isOcc ? ' · занято' : ''}</span>
                      {isSel && <span style={{ fontSize: 10 }}>✓</span>}
                    </button>
                  );
                })}
                <button type="button" onClick={() => setSchedulePick(null)} style={closeBtnStyle}>Закрыть</button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ fontSize: 10, color: DIM, marginBottom: 2 }}>
                  День {TRAINING_DAY_NAMES[day]} свободен. Выберите, какую тренировку назначить на него:
                </div>
                {sessions.map((s, si) => {
                  const cur = sessionDayOfWeek(s, si);
                  if (cur === day) return null;
                  return (
                    <button
                      key={si}
                      type="button"
                      className="editor-chip"
                      aria-label={`Перенести на ${TRAINING_DAY_NAMES[day]}: ${s.name || `День ${si + 1}`}`}
                      onClick={() => { setWeekSessionDay(si, day); setSchedulePick(null); }}
                      style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%',
                        padding: '10px 12px', borderRadius: 10, cursor: 'pointer', textAlign: 'left', fontSize: 11,
                        background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
                        color: 'rgba(255,255,255,0.85)', minHeight: 44,
                      }}
                    >
                      <span>{si + 1}. {s.name || `День ${si + 1}`}</span>
                      <span style={{ fontSize: 10, color: DIM }}>{TRAINING_DAY_NAMES[cur]} → {TRAINING_DAY_NAMES[day]}</span>
                    </button>
                  );
                })}
                {sessions.length === 0 && (
                  <div style={{ fontSize: 10, color: DIM, fontStyle: 'italic' }}>
                    В неделе нет тренировочных дней — добавьте их в редакторе ниже («Как собрать программу»).
                  </div>
                )}
                {sessions.length > 0 && sessions.every((s, si) => sessionDayOfWeek(s, si) === day) && (
                  <div style={{ fontSize: 10, color: DIM, fontStyle: 'italic' }}>
                    Все тренировки недели уже назначены на этот день.
                  </div>
                )}
                <button type="button" onClick={() => setSchedulePick(null)} style={closeBtnStyle}>Закрыть</button>
              </div>
            )}
          </TrainingModal>
        );
      })()}

      </> )}
      </> )}

      {/* V3: compact dashboard — сигналы плана, привязаны к execWeek (шаг «📊 Анализ» в pro-режиме) */}
      {isPro && estep === 'analysis' && (
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 8 }}>
        <RirWaveChart program={program} />
        {dir === 'bb' && program.bb && program.bb.weeks.length > 0 && (
          <ProgramTimeline program={program} selectedWeek={execWeek - 1} onSelectWeek={(wi) => setExecWeek(wi + 1)} />
        )}
        <QualityScorePanel program={program} level={program.meta.level} tprofile={tprofile} labMrvMult={labAdjust.mrvMultiplier} />
      </div>
      )}
      {estep === 'weeks' && dir === 'bb' && (
        <>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 2 }}>
          <span style={{ fontSize: 12, fontWeight: 800, color: '#fff' }}>📊 Статистика плана</span>
          <span style={{ fontSize: 10, color: DIM }}>Объём, RIR и нагрузка по неделям</span>
        </div>
        <PlanStatsPanel program={program} execWeek={execWeek} onCourse={tprofile.onCourse ?? false} />
        {/* Live-качество — в шаге Недели для всех режимов (раньше только в Анализе pro) */}
        <QualityScorePanel program={program} level={program.meta.level} tprofile={tprofile} labMrvMult={labAdjust.mrvMultiplier} />
        {/* Compact фикс объёма — 1 клик, доступен всем (standard тоже) — недобор и перегруз */}
        {(() => {
          try {
            const q = computePlanQualityFor(program, program.meta.level, { onCourse: tprofile.onCourse ?? false, courseIntensity: tprofile.courseIntensity ?? 'moderate', labMult: labAdjust.mrvMultiplier });
            const lows = q.perMuscle.filter(m => m.status === 'low').slice(0, 2);
            const overs = q.perMuscle.filter(m => m.status === 'over').slice(0, 2);
            if (lows.length === 0 && overs.length === 0) return null;
            const prof = loadTrainingProfile();
            const addFor = (muscle: string) => {
              if (!program.bb?.weeks[0]?.sessions[0]) return;
              const exs = suggestExercisesForGroup(muscle, program.meta.level, 1, (prof.equipment ?? []) as any, [], [], (prof as any).avoidAxialLoad ?? false, (prof.favoriteExercises ?? []) as any, (prof.excludedExercises ?? []) as any);
              const w = (prof.workMax ?? {} as any)[muscle] ?? 40;
              const sets = makeSetsFromTemplate(muscleAwareSets(muscle, program.meta.level) as any, w);
              const nb: any = { id: newId('blk'), type: 'accessory' as const, exerciseName: exs[0]?.name ?? '', muscle, role: 'accessory' as const, sets: sets.length ? sets : [{ reps: 10, rir: 2, weight: w, restSec: 90 }] };
              const updated: any = { ...program, bb: { ...program.bb!, weeks: (program.bb!.weeks as any).map((wk: any, wi: number) => wi === 0 ? { ...wk, sessions: wk.sessions.map((s: any, si: number) => si === 0 ? { ...s, blocks: [...s.blocks, nb] } : s) } : wk) } };
              onChange(updated);
              showToast('➕ ' + (GROUP_RU[muscle] ?? muscle) + ' → ' + (exs[0]?.name ?? 'упражнение'));
            };
            const removeFor = (muscle: string) => {
              if (!program.bb?.weeks[0]?.sessions[0]) return;
              const w0 = program.bb.weeks[0];
              const s0 = w0.sessions[0];
              const idx = [...s0.blocks].map((b, i) => ({ b, i })).filter(x => x.b.muscle === muscle).pop()?.i;
              if (idx == null) return;
              const blk = s0.blocks[idx];
              let newBlocks;
              if (blk.sets.length > 1) newBlocks = s0.blocks.map((b, i) => i === idx ? { ...b, sets: b.sets.slice(0, -1) } : b);
              else newBlocks = s0.blocks.filter((_, i) => i !== idx);
              const updated: any = { ...program, bb: { ...program.bb!, weeks: program.bb!.weeks.map((wk, wi) => wi === 0 ? { ...wk, sessions: wk.sessions.map((s, si) => si === 0 ? { ...s, blocks: newBlocks } : s) } : wk) } };
              onChange(updated);
              showToast('➖ ' + (GROUP_RU[muscle] ?? muscle) + ' −1 сет');
            };
            return (
              <div style={{ ...CARD, padding: 10, borderLeft: `3px solid ${overs.length ? '#ef4444' : '#3b82f6'}`, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: overs.length ? '#ef4444' : '#3b82f6' }}>{overs.length ? '⚠ Быстрый фикс объёма' : '⬇ Быстрый фикс объёма'} — 1 клик</div>
                {lows.length > 0 && <><div style={{ fontSize: 10, color: DIM }}>Недобор до MEV:</div><div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{lows.map(l => (<button key={l.muscle} onClick={() => addFor(l.muscle)} style={{ ...BTN_GHOST, padding: '6px 10px', fontSize: 11, minHeight: 36, borderColor: 'rgba(59,130,246,0.3)', color: '#60a5fa' }}>+ {GROUP_RU[l.muscle] ?? l.muscle} ({l.avgSets}/{l.mev})</button>))}</div></>}
                {overs.length > 0 && <><div style={{ fontSize: 10, color: DIM, marginTop: lows.length ? 4 : 0 }}>Перегруз &gt; MRV:</div><div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{overs.map(o => (<button key={o.muscle} onClick={() => removeFor(o.muscle)} style={{ ...BTN_GHOST, padding: '6px 10px', fontSize: 11, minHeight: 36, borderColor: 'rgba(239,68,68,0.3)', color: '#ef4444' }}>− {GROUP_RU[o.muscle] ?? o.muscle} ({o.peakSets}/{o.mrv})</button>))}</div></>}
                <div style={{ fontSize: 10, color: DIM, fontStyle: 'italic' }}>Оценка: {q.score}/100 {q.grade} · стандарт — без тренеров</div>
              </div>
            );
          } catch { return null; }
        })()}
        {/* Подсказка несовпадения meta.daysPerWeek vs неделя */}
        {(() => {
          const actual = program.bb?.weeks[0]?.sessions.length ?? 0;
          const expected = program.meta.daysPerWeek;
          if (!actual || actual === expected) return null;
          return (
            <div style={{ ...CARD, padding: 10, borderLeft: '3px solid #f59e0b', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#f59e0b' }}>⚠ Дней {expected} ↔ в неделе {actual}</span>
              <span style={{ fontSize: 10, color: DIM, flex: '1 1 200px' }}>Нажмите чтобы выровнять недели под настройку (лишние дни с контентом спросят подтверждение)</span>
              <button style={{ ...BTN, padding: '6px 12px', fontSize: 11, minHeight: 32 }} onClick={async () => {
                const w = program.bb!.weeks;
                const willDelete = expected < actual && w.some(week => week.sessions.slice(expected).some(s=> (s.blocks??[]).some(b=> b.exerciseName && b.exerciseName.trim())));
                if (willDelete) {
                  const ok = await confirm({ title: `Выровнять до ${expected}д/нед?`, message: `Лишние дни с упражнениями будут удалены во всех неделях.`, confirmLabel: 'Выровнять', danger: true });
                  if (!ok) return;
                }
                const updated = w.map(week => ({ ...week, sessions: resizeTrainingSessions(week.sessions, expected, week.deload) }));
                update({ bb: { ...program.bb!, weeks: updated as any }});
                showToast('✓ Выровнено: ' + expected + 'д/нед');
              }}>↔ Выровнять</button>
            </div>
          );
        })()}
        <QualityChecklistCard program={program} onChange={onChange as any} showToast={showToast} tprofile={tprofile} labMrv={labAdjust.mrvMultiplier} />
        </>
      )}
      {estep === 'weeks' && dir === 'pl' && program.pl && (
        <><QualityScorePanel program={program} level={program.meta.level} tprofile={tprofile} labMrvMult={labAdjust.mrvMultiplier} /><QualityChecklistCard program={program} onChange={onChange as any} showToast={showToast} tprofile={tprofile} labMrv={labAdjust.mrvMultiplier} /></>
      )}
      {estep === 'weeks' && dir === 'hybrid' && program.hybrid && (
        <><QualityScorePanel program={program} level={program.meta.level} tprofile={tprofile} labMrvMult={labAdjust.mrvMultiplier} /><QualityChecklistCard program={program} onChange={onChange as any} showToast={showToast} tprofile={tprofile} labMrv={labAdjust.mrvMultiplier} /></>
      )}


      {/* P3.2 — Bulk-apply методик ко всем блокам (инструмент тренера, шаг «🗓 Недели») */}
      {/* P2-3: extracted to BulkApplyCard with week-range selector */}
      {estep === 'weeks' && isPro && dir === 'bb' && program.bb && program.bb.weeks.length > 0 && (
        <>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 2 }}>
          <span style={{ fontSize: 12, fontWeight: 800, color: '#fff' }}>🛠 Методики для всей программы</span>
          <span style={{ fontSize: 10, color: DIM }}>Интенсивные техники и схемы объёма — на диапазон недель</span>
        </div>
        <BulkApplyCard program={program} onChange={onChange} showToast={showToast} />
        </>
      )}


      {/* Шаг «🎛 Параметры»: название/цель/уровень/дни/недели + заметки + авто-периодизация (pro) */}
      {estep === 'params' && (
      <>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 2 }}>
        <span style={{ fontSize: 12, fontWeight: 800, color: '#fff' }}>🎛 Основное</span>
        <span style={{ fontSize: 10, color: DIM }}>Название, цель, уровень и формат недели</span>
      </div>
      {/* Meta — с inline-валидацией для качественного итога */}
      <div className="constructor-surface editor-meta-card" style={{ ...CARD, padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
         <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
           <input aria-label="Название программы" style={IN} value={program.meta.title} onChange={e => updateMeta({ title: e.target.value })} placeholder="Название программы (≥3 символов)" />
           {!(program.meta.title && program.meta.title.trim().length >= 3) && <span style={{ fontSize: 10, color: '#ef4444' }}>⚠ Укажите название — без него Итог не будет качественным</span>}
           {program.meta.title && program.meta.title.trim().length >= 3 && program.meta.title.trim().length < 12 && <span style={{ fontSize: 10, color: '#f59e0b' }}>💡 Более описательное название поможет в списке (напр. «Масса 4д × 8 нед»)</span>}
         </div>
        <div style={{ display: 'flex', gap: 6 }}>
           <EditorPopupSelect
            value={program.meta.goal}
            options={GOAL_OPTS.map(o => ({ id: o.id, label: o.label }))}
            onChange={v => updateMeta({ goal: v })}
            ariaLabel="Цель программы"
            title="Цель программы"
            buttonStyle={{ flex: 1 }}
          />
           <EditorPopupSelect
            value={program.meta.level}
            options={LEVEL_OPTS.map(o => ({ id: o.id, label: o.label }))}
            onChange={v => updateMeta({ level: v })}
            ariaLabel="Уровень подготовки"
            title="Уровень подготовки"
            buttonStyle={{ flex: 1 }}
          />
           <label style={{ ...SMALL, display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
            Дней/нед
            {/* U3: meta.daysPerWeek каскад — при изменении добавляет/удаляет сессии в bb.weeks; при уменьшении с контентом — подтверждение */}
              <input aria-label="Дней тренировок в неделю" type="number" inputMode="numeric" style={IN} value={program.meta.daysPerWeek} min={1} max={7}
                onChange={async e => {
                  const parsed = Number(e.target.value);
                  if (!Number.isFinite(parsed)) return;
                  const v = Math.max(1, Math.min(7, Math.round(parsed)));
                  if (v < program.meta.daysPerWeek && program.bb) {
                    const willDeleteContent = program.bb.weeks.some(w => w.sessions.slice(v).some(s => s.blocks.some(b => b.exerciseName && b.exerciseName.trim())));
                    if (willDeleteContent) {
                      const ok = await confirm({ title: `Уменьшить до ${v} дн/нед?`, message: `Последние ${program.meta.daysPerWeek - v} тренировочных дней с упражнениями будут удалены во всех неделях. Продолжить?`, confirmLabel: 'Удалить', danger: true });
                      if (!ok) { e.target.value = String(program.meta.daysPerWeek); return; }
                    }
                  }
                  const newMeta = { ...program.meta, daysPerWeek: v };
                  let newProgram = { ...program, meta: newMeta };
                  // Каскад на bb.weeks: выровнять кол-во сессий
                   if (program.bb) {
                     const weeks = program.bb.weeks;
                     const updated = weeks.map(w => {
                       const target = v;
                       return { ...w, sessions: resizeTrainingSessions(w.sessions, target, w.deload) };
                    });
                    newProgram = { ...newProgram, bb: { ...program.bb, weeks: updated } };
                  }
                  onChangeWithUndo(newProgram);
                }} />
            <span style={{ fontSize: 9, color: program.meta.daysPerWeek < 2 || program.meta.daysPerWeek > 6 ? '#f59e0b' : DIM }}>{program.meta.daysPerWeek < 3 ? '💡 3д — минимум для прогрессии' : program.meta.daysPerWeek > 5 && program.meta.level !== 'advanced' && program.meta.level !== 'enhanced' ? '⚠ 6д — только для продвинутых' : '✓ ' + program.meta.daysPerWeek + 'д — оптимально'}</span>
           </label>
           <label style={{ ...SMALL, display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
            Недель
            {/* U3: meta.weeks каскад — при изменении добавляет/удаляет недели в bb.weeks; при уменьшении с контентом — подтверждение */}
              <input aria-label="Количество недель программы" type="number" inputMode="numeric" style={IN} value={program.meta.weeks} min={1} max={24}
                onChange={async e => {
                  const parsed = Number(e.target.value);
                  if (!Number.isFinite(parsed)) return;
                  const v = Math.max(1, Math.min(24, Math.round(parsed)));
                  if (v < program.meta.weeks && program.bb) {
                    const willDeleteContent = program.bb.weeks.slice(v).some(w => w.sessions.some(s => s.blocks.some(b => b.exerciseName && b.exerciseName.trim())));
                    if (willDeleteContent) {
                      const ok = await confirm({ title: `Сократить до ${v} нед?`, message: `Последние ${program.meta.weeks - v} недели с упражнениями будут удалены. Продолжить?`, confirmLabel: 'Удалить', danger: true });
                      if (!ok) { e.target.value = String(program.meta.weeks); return; }
                    }
                  }
                  const newMeta = { ...program.meta, weeks: v };
                  let newProgram = { ...program, meta: newMeta };
                  if (program.bb) {
                    const weeks = [...program.bb.weeks];
                    while (weeks.length < v) {
                      const n = weeks.length + 1;
                      const template = weeks[0]?.sessions ?? [];
                      const progression = 1 + (n - 1) * 0.025;
                      weeks.push({ week: n, phase: 'accumulation', deload: n % 4 === 0, sessions: template.map(s => ({ ...s, id: newId('ses'), blocks: s.blocks.map(b => ({ ...b, id: newId('blk'), sets: b.sets.map(st => ({ ...st, weight: st.weight ? Math.round(st.weight * progression / 2.5) * 2.5 : st.weight })) })) })) });
                    }
                    while (weeks.length > v) weeks.pop();
                    newProgram = { ...newProgram, bb: { ...program.bb, weeks } };
                  }
                  onChangeWithUndo(newProgram);
                }} />
            </label>
         </div>
       </div>
       <div style={{ fontSize: 10, color: DIM, display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 2 }}>
        <span style={{ color: program.meta.daysPerWeek <3 || program.meta.daysPerWeek >6 ? '#f59e0b' : DIM }}>{program.meta.daysPerWeek <3 ? '💡 3д — минимум' : program.meta.daysPerWeek >5 && program.meta.level!=='advanced' && program.meta.level!=='enhanced' ? '⚠ 6д — для продвинутых' : '✓ ' + program.meta.daysPerWeek + 'д/нед — ок'}</span>
        <span>·</span>
        <span style={{ color: program.meta.weeks <3 || program.meta.weeks>12 ? '#f59e0b' : DIM }}>{program.meta.weeks <4 ? '💡 4 нед — минимум' : program.meta.weeks >12 ? '⚠ ' + program.meta.weeks + ' нед — длинный' : '✓ ' + program.meta.weeks + ' нед — ок'}</span>
        {program.meta.weeks >=6 && !program.bb?.weeks.some(w=> w.deload) && <span style={{ color: '#f59e0b' }}>· добавьте делод</span>}
      </div>
      <div style={{ ...CARD, padding: 10, borderLeft: '3px solid #60a5fa', display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: '#60a5fa' }}>💡 Цель и уровень — как влияет на цикл</div>
         <div style={{ fontSize: 10, color: DIM_STRONG, lineHeight: 1.5 }}>
           {program.meta.goal === 'hypertrophy' && 'Масса: объём 65–85% MEV→MAV, RIR 2–3 → 1, делод каждую 4 нед.'}
           {program.meta.goal === 'powerlifting' && 'Сила: интенсивность 75–90% 1RM, RIR 3→1, пик + делод перед тестом.'}
           {program.meta.goal === 'cut' && 'Сушка: объём −15%, RIR 3, упор на сохранение силы, делод чаще.'}
           {program.meta.goal === 'recomp' && 'Рекомпозиция: умеренный объём, RIR 2–3, баланс.'}
           {program.meta.goal === 'peaking' && 'Пик: объём ↓, интенсивность ↑, RIR 1→0, тейпер.'}
           {!['hypertrophy','powerlifting','cut','recomp','peaking'].includes(program.meta.goal) && 'Цель влияет на фазы, RIR и объём — выберите ближе к вашей задаче.'}
         </div>
         <div style={{ fontSize: 10, color: DIM }}>
           Уровень <b style={{ color: DIM_STRONG }}>{program.meta.level}</b> · {program.meta.level === 'beginner' ? 'MEV ниже, RIR выше, техника в приоритете' : program.meta.level === 'intermediate' ? 'Стандарт MEV/MAV, RIR 2' : program.meta.level === 'advanced' ? 'MAV выше, RIR 1–2, можно специализацию' : 'Enhanced: MRV +15–30%, RIR 1, объём выше'} · {program.meta.daysPerWeek}д/нед × {program.meta.weeks} нед
         </div>
       </div>

       {/* F2.5: тренерские заметки (отображаются в PDF) */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
        <span style={{ fontSize: 12, fontWeight: 800, color: '#fff' }}>📝 Заметки тренера</span>
        <span style={{ fontSize: 10, color: DIM }}>Видно в PDF и при отправке к выполнению</span>
      </div>
      <ProgramNotes program={program} onChange={onChange} />

      {isPro && (
        <>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
          <span style={{ fontSize: 12, fontWeight: 800, color: '#fff' }}>📈 Авто-периодизация</span>
          <span style={{ fontSize: 10, color: DIM }}>Распределить фазы по неделям в один клик</span>
        </div>
        <AutoPeriodizationPanel weeks={program.meta.weeks} goal={program.meta.goal} level={program.meta.level}
          onApply={(phases) => {
            if (dir !== 'bb' || !program.bb) return;
            const weeks = program.bb.weeks.map((w) => {
              const phase = phases.find(p => Array.isArray(p.weeks) && p.weeks.includes(w.week));
              return { ...w, phase: (phase?.phase || w.phase) as any, deload: phase?.phase === 'deload' ? true : w.deload };
            });
            update({ bb: { ...program.bb!, weeks } });
            showToast('📈 Периодизация применена: ' + phases.map(p => p.phase).join(' → '));
          }}
        />
        </>
      )}
      {/* 📚 Шаблоны циклов — используем существующие SPLIT/LMS + периодизацию */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
        <span style={{ fontSize: 12, fontWeight: 800, color: '#fff' }}>📚 Шаблоны циклов</span>
        <span style={{ fontSize: 10, color: DIM }}>1 клик — сплит ББ или цикл ПЛ из библиотеки</span>
      </div>
      {!isPro && (
        <div style={{ ...CARD, padding: 10, borderLeft: '3px solid #a78bfa', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: '#a78bfa' }}>👤 Профиль для качества</span>
          <span style={{ fontSize: 10, color: DIM, flex: '1 1 200px' }}>Веса, оборудование и травмы влияют на подбор упражнений — заполните в «Профессиональном» режиме → Профиль</span>
          <button style={{ ...BTN_GHOST, padding: '6px 10px', fontSize: 11, minHeight: 32, borderColor: 'rgba(167,139,250,0.3)', color: '#a78bfa' }} onClick={() => onMode('pro')}>🎓 В Pro → Профиль</button>
        </div>
      )}
      <CycleTemplatesPanel program={program} onChange={onChange as any} showToast={showToast} />
      </>
      )}

      {/* Локальный toast для сообщений внутри редактора (авто-черновик, к выполнению и т.п.) */}
      {ToastNode}

      {/* Библиотека — модальное окно внутри редактора (только bb/pl; methods/macro имеют отдельные модалы) */}
      {editorLibOpen && editorLibOpen !== 'macro' && editorLibOpen !== 'methods' && (
        <TrainingModal title={`📚 ${editorLibOpen === 'bb' ? 'Библиотека программ' : 'Проф. ПЛ-циклы'}`} onClose={() => setEditorLibOpen(null)}>
            {editorLibOpen === 'bb' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: '60vh', overflow: 'auto' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button type="button" onClick={() => setProgFavOnly(v => !v)} style={{
                    padding: '5px 10px', borderRadius: 20, fontSize: 10, fontWeight: 600, cursor: 'pointer',
                    background: progFavOnly ? 'var(--accent)' : 'var(--bg-secondary)', color: progFavOnly ? '#000' : 'var(--text-dim)', border: 'none',
                  }}>
                    ⭐ Избранное ({progFavs.length})
                  </button>
                  <span style={{ fontSize: 10, color: DIM }}>{progFavOnly ? 'Показаны избранные программы' : `${libraryPrograms.length} программ`}</span>
                </div>
                {libraryPrograms.filter(pr => !progFavOnly || progFavs.includes(String(pr.id ?? pr.name))).map(pr => {
                  const favId = String(pr.id ?? pr.name);
                  const isFav = progFavs.includes(favId);
                  return (
                    <div key={favId} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <button onClick={() => { loadIntoEditor(cloneFromLibrary(pr)); }}
                        style={{ flex: 1, textAlign: 'left', padding: '10px 12px', borderRadius: 10, background: 'rgba(0,230,138,0.06)', border: '1px solid rgba(0,230,138,0.18)', color: DIM_STRONG, cursor: 'pointer', fontSize: 11 }}>
                        <div style={{ fontWeight: 700 }}>{pr.name}</div>
                        <div style={{ fontSize: 11, color: DIM }}>{pr.author} · {pr.goal} · {pr.daysPerWeek}д/нед · {pr.durationWeeks}нед</div>
                      </button>
                      <button aria-label={isFav ? `Убрать из избранного ${pr.name}` : `В избранное ${pr.name}`} onClick={() => toggleProgFav(favId)}
                        style={{ minWidth: 44, minHeight: 44, border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 15, filter: isFav ? 'none' : 'grayscale(1)', opacity: isFav ? 1 : 0.4 }}
                        title={isFav ? 'Убрать из избранного' : 'В избранное'}>⭐</button>
                    </div>
                  );
                })}
              </div>
            )}
            {editorLibOpen === 'pl' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: '60vh', overflow: 'auto' }}>
                {plCycleList.map(c => (
                  <button key={c.meta.id} onClick={() => loadCycleIntoEditor(c.meta.id)}
                    style={{ textAlign: 'left', padding: '10px 12px', borderRadius: 10, background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.18)', color: DIM_STRONG, cursor: 'pointer', fontSize: 11 }}>
                    <div style={{ fontWeight: 700 }}>{c.meta.title}</div>
                    <div style={{ fontSize: 10, color: DIM }}>{c.meta.sessionsPerWeek}д/нед · {c.meta.weeks} нед · {c.meta.level} · {c.meta.period}</div>
                  </button>
                ))}
              </div>
            )}
        </TrainingModal>
      )}

      {/* P2.11: редактирование constraints (оборудование, травмы, avoidAxialLoad, любимые/исключённые) + progression — pro-only, шаг «👤 Профиль» */}
      {isPro && estep === 'profile' && dir === 'bb' && program.bb && (
        <>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 2 }}>
          <span style={{ fontSize: 12, fontWeight: 800, color: '#fff' }}>⚙️ Ограничения и прогрессия</span>
          <span style={{ fontSize: 10, color: DIM }}>Оборудование, травмы и стратегия нагрузки</span>
        </div>
        <BBConstraintsPanel
          constraints={program.bb.constraints ?? { equipment: [] }}
          progression={program.bb.progression ?? { loadStrategy: 'double_progression', deloadProtocol: 'pump', intensityTechniques: ['none'] }}
          onChangeConstraints={(constraints) => onChange({ ...program, bb: { ...program.bb!, constraints } })}
          onChangeProgression={(progression) => onChange({ ...program, bb: { ...program.bb!, progression } })}
        />
        </>
      )}

      {estep === 'weeks' && !showTableView && (dir === 'bb' || dir === 'pl' || dir === 'hybrid') && (
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 2 }}>
          <span style={{ fontSize: 12, fontWeight: 800, color: '#fff' }}>✏️ Редактор недель и дней</span>
          <span style={{ fontSize: 10, color: DIM }}>Добавляйте дни, упражнения и настраивайте подходы</span>
        </div>
      )}
      {estep === 'weeks' && !showTableView && dir === 'bb' && program.bb && <BBEditor body={program.bb} level={program.meta.level} onChange={(bb) => update({ bb })} />}
      {estep === 'weeks' && !showTableView && dir === 'pl' && program.pl && <PLEditor body={program.pl} onChange={(pl) => update({ pl })} />}
      {estep === 'weeks' && !showTableView && dir === 'hybrid' && program.hybrid && (
        <>
           <div className="constructor-surface constructor-surface--info" style={{ ...CARD, padding: 10, borderLeft: '3px solid #3b82f6', background: 'rgba(59,130,246,0.06)' }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#3b82f6' }}>⚡ Powerbuilder (Hybrid)</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 4 }}>Гибрид ПЛ+ББ — редактируйте ПЛ и ББ части независимо. Баланс дней: {program.hybrid.plRef?.sessionIndices?.length ?? 2} ПЛ + {Math.max(1, program.meta.daysPerWeek - (program.hybrid.plRef?.sessionIndices?.length ?? 2))} ББ = {program.meta.daysPerWeek}д/нед × {program.meta.weeks} нед.</div>
          </div>
          {(() => {
            const isEmptyHybridBb = (bbw: any[]) => bbw.length===0 || bbw.some(w=> (w.sessions??[]).length===0 || w.sessions.some((s:any)=> !(s.blocks??[]).some((b:any)=> b.exerciseName && b.exerciseName.trim())));
            if (!isEmptyHybridBb(program.hybrid.bbWeeks ?? [])) return null;
            const hasNoWeeks = (program.hybrid.bbWeeks?.length ?? 0) === 0;
            return (
            <div style={{ ...CARD, padding: 10, borderLeft: '3px solid #00e68a', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: '#00e68a' }}>{hasNoWeeks ? '⚡ Пустая ББ-часть — 1 клик' : '⚡ Пустые ББ-дни — 1 клик'}</span>
              <span style={{ fontSize: 10, color: DIM, flex: '1 1 200px' }}>{hasNoWeeks ? 'Добавит ББ-недели по сплиту (с учётом дней/нед и уровня)' : 'Заполнит пустые ББ-дни базовыми упражнениями'}</span>
              <button style={{ ...BTN, padding: '6px 12px', fontSize: 11, minHeight: 32 }} onClick={() => {
                if (hasNoWeeks) {
                  const bbDays = Math.max(1, (program.meta.daysPerWeek ?? 4) - (program.hybrid!.plRef?.sessionIndices?.length ?? 2));
                  const weeks = Math.max(1, program.meta.weeks ?? 4);
                  const pattern = SPLIT_PATTERNS.find(pp => pp.sessionsPerRotation === bbDays && pp.schedule.some(d => d.kind === 'тренировка')) ?? [...SPLIT_PATTERNS].sort((a,b)=>Math.abs(a.sessionsPerRotation-bbDays)-Math.abs(b.sessionsPerRotation-bbDays))[0] ?? SPLIT_PATTERNS[0];
                  if (!pattern) { showToast('⚠ Сплит не найден'); return; }
                  const sessions = pattern.schedule.filter(d=>d.kind==='тренировка').map((d,si)=>({ id: newId('ses'), name: 'День '+(si+1), dayOfWeek: si as any, focus: (d as any).sessionTag ?? '', blocks: [] as any }));
                  const bbWeeks = Array.from({ length: weeks }, (_,wi)=>({ week: wi+1, phase: 'accumulation' as const, deload: false, sessions: sessions.map(s=>({ ...s, id: newId('ses') })) }));
                  update({ hybrid: { ...program.hybrid!, bbWeeks } });
                  showToast('⚡ ББ-часть создана: ' + weeks + ' нед × ' + bbDays + 'д — заполните упражнения ниже');
                } else {
                  const prof = loadTrainingProfile();
                  const updated = (program.hybrid!.bbWeeks ?? []).map(w=> ({
                    ...w,
                    sessions: w.sessions.map(s=> {
                      if ((s.blocks??[]).some((b:any)=> b.exerciseName && b.exerciseName.trim())) return s;
                      const focusTxt = (s.focus || s.name || '').toLowerCase();
                      let ms: string[] = [];
                      if (focusTxt.includes('грудь')) ms = ['chest','triceps'];
                      else if (focusTxt.includes('спин')) ms = ['back','biceps'];
                      else if (focusTxt.includes('ног')) ms = ['legs','shoulders'];
                      else if (focusTxt.includes('плеч')) ms = ['shoulders','arms'];
                      else ms = ['chest','back'];
                      const blocks = ms.slice(0,2).map(m=> {
                        const exs = suggestExercisesForGroup(m, program.meta.level, 1, (prof.equipment ?? []) as any, [], [], (prof as any).avoidAxialLoad ?? false, (prof.favoriteExercises ?? []) as any, (prof.excludedExercises ?? []) as any);
                        const wgt = (prof.workMax ?? {} as any)[m] ?? 40;
                        const sets = makeSetsFromTemplate(muscleAwareSets(m, program.meta.level) as any, wgt);
                        return { id: newId('blk'), type: (exs[0]?.type === 'compound' ? 'compound' : 'accessory') as const, exerciseName: exs[0]?.name ?? '', muscle: m, role: (exs[0]?.type === 'compound' ? 'primary' : 'accessory') as const, sets: sets.length ? sets : [{ reps: 10, rir: 2 } as any] };
                      });
                      return { ...s, blocks };
                    }),
                  }));
                  update({ hybrid: { ...program.hybrid!, bbWeeks: updated as any } });
                  showToast('⚡ Пустые ББ-дни заполнены — проверьте упражнения');
                }
              }}>{hasNoWeeks ? '⚡ Заполнить ББ-часть' : '⚡ Заполнить пустые дни'}</button>
            </div>
            );
          })()}
          <HybridPlanPanel program={program} onChange={(hybrid) => update({ hybrid })} onSave={onSave} />
        </>
      )}

      {/* P2.8: Валидация программы */}
      {(() => {
        const issues = validateProgram(program);
        if (issues.length === 0) return null;
        const errCount = issues.filter(i => i.level === 'error').length;
        const warnCount = issues.filter(i => i.level === 'warning').length;
        const infoCount = issues.filter(i => i.level === 'info').length;
        const color = errCount > 0 ? '#ef4444' : warnCount > 0 ? '#f59e0b' : '#3b82f6';
        const icon = errCount > 0 ? '🚫' : warnCount > 0 ? '⚠️' : 'ℹ️';
        return (
           <div className="constructor-surface" role="status" aria-live="polite" style={{ ...CARD, padding: 10, marginTop: 4, borderLeft: `3px solid ${color}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 800, color }}>{icon} Валидация</span>
              <span style={{ fontSize: 10, color: DIM }}>({errCount} ошибок, {warnCount} предупреждений, {infoCount} инфо)</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {issues.map((iss, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 6px', borderRadius: 4, background: iss.level === 'error' ? 'rgba(239,68,68,0.08)' : iss.level === 'warning' ? 'rgba(245,158,11,0.08)' : 'rgba(59,130,246,0.08)' }}>
                  <span style={{ fontSize: 10, color: iss.level === 'error' ? '#ef4444' : iss.level === 'warning' ? '#f59e0b' : '#3b82f6', fontWeight: 800, minWidth: 16 }}>{iss.level === 'error' ? '✕' : iss.level === 'warning' ? '!' : 'i'}</span>
                  <span style={{ fontSize: 10, color: '#fff' }}>{iss.message}</span>
                  <span style={{ fontSize: 11, color: DIM, marginLeft: 'auto' }}>{iss.code}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* История правок (revisions): дешёвая версия — без полных снапшотов, только timestamp+note (шаг «🔧 Инструменты») */}
      {isPro && estep === 'tools' && revisions.length > 0 && (
        <div style={{ ...CARD, padding: 10, marginTop: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: ACCENT }}>📜 История правок</span>
            <span style={{ fontSize: 10, color: DIM }}>({revisions.length} записей, последние 20)</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 160, overflowY: 'auto' }}>
            {revisions.slice().reverse().map((r, i) => {
              const realIdx = revisions.length - 1 - i;
              return (
                <div key={r.ts} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 6px', borderRadius: 6, background: 'rgba(255,255,255,0.02)' }}>
                  <span style={{ fontSize: 10, color: DIM_STRONG, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.note}</span>
                  <span style={{ fontSize: 10, color: DIM }}>{new Date(r.ts).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                  <button style={{ ...BTN_GHOST, padding: '2px 6px', fontSize: 11, minHeight: 44, color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)' }} onClick={() => removeRev(realIdx)} title="Удалить запись">✕</button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    {/* Липкая нижняя навигация шагов — «← Назад» / сохранение / «Далее →» всегда под рукой */}
      <div className="editor-bottomnav" style={{ position: 'sticky', bottom: 0, zIndex: 40, display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(15,17,22,0.97)', borderRadius: 12, padding: '8px 10px', border: '1px solid rgba(255,255,255,0.06)', boxShadow: '0 -6px 18px rgba(0,0,0,0.35)' }}>
        {estepIdx > 0 && (
          <button style={{ ...BTN_GHOST, padding: '10px 16px', fontSize: 12, minHeight: 44 }} onClick={goPrevStep} title="Предыдущий шаг (←)">
            ← Назад: {EDITOR_STEP_BTN_LABELS[editorSteps[estepIdx - 1]]}
          </button>
        )}
        <button style={{ ...BTN_GHOST, padding: '8px 14px', fontSize: 11, minHeight: 40, borderColor: isDirty ? 'rgba(245,158,11,0.4)' : 'rgba(255,255,255,0.08)', color: isDirty ? '#f59e0b' : DIM }} onClick={() => { if (handleSave('Ручная правка')) { setSavedFlash(true); window.setTimeout(() => setSavedFlash(false), 1600); } }} title={isDirty ? 'Сохранить изменения' : 'Все изменения сохранены'}>
          {savedFlash ? '✓ Сохранено' : isDirty ? '💾 Сохранить' : '✓ Сохранено'}
        </button>
        <span style={{ flex: 1 }} />
        {onNext && (
          <button style={{ ...BTN, padding: '10px 20px', fontSize: 12, minHeight: 44 }} onClick={goNextStep} title="Следующий шаг (→)">
            Далее: {isLastEditorStep ? 'Итог' : EDITOR_STEP_BTN_LABELS[editorSteps[estepIdx + 1]]} →
          </button>
        )}
      </div>
    </div>
  );
};
