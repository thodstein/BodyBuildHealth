/**
 * ProgramEditorView.tsx - extracted from ProgramManagerPanel.tsx.
 * ProgramEditor component: inline editor for a single UserProgram (BB/PL/Hybrid).
 *
 * Extracted to enable isolated testing and reduce ProgramManagerPanel size.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getAllPrograms } from '../../../engines/complete-program-library.engine';
import { expandProgramWeeks } from '../../../engines/program-progression.engine';
import { cycleTemplateToFullProgram } from '../../../engines/bb/cycle-to-plan';
import { newId } from '../../../engines/user-program/user-program.types';
import type { UserProgram, UserWeek, UserBlock, ProgramProgression } from '../../../engines/user-program/user-program.types';
import { HybridPlanPanel } from './HybridPlanPanel';
import { MacrocyclePanel } from '../SRCBBScreen_parts/MacrocyclePanel';
import { MethodologyEncyclopedia } from './MethodologyEncyclopedia';
import { BbContextPanel } from './program-editor-context-panels';
import { BBEditor, PLEditor, BBConstraintsPanel } from './ProgramEditorComponents';
import { PlanDiagnosticsPanel, InteractiveVolumePanel, ExerciseInfoPanel, ProgressionCoach, SplitConsultant, PlanSummaryTable, AutoPeriodizationPanel, SubstitutionPanel } from './editor-panels';
import { LoadGuardPanel, RealMRVPanel, RIRCalibrationPanel, TonnageEstimatePanel, StickingPointPanel, PlateAutoPanel, WhatIfGuardPanel, ReadinessForecastPanel, CheckinGuardPanel, BiomechanicsPanel } from './ProGuardPanels';
import { ProPanelSection, ProPanelsGroup, ThemeToggle } from './ProPanelSection';
import { MesoHeatmap } from './MesoHeatmap';
import { ProgramNotes, ProgramMetricsCSV, RecoveryBadge, ProgramStrengthScore } from './ProgramExtras';
import { ProgramRevisionsDiff } from './ProgramRevisions';
import { StrengthDiaryPanel } from './StrengthDiaryPanel';
import { tempoFor } from '../../../engines/bb/bb-tempo-rest';
import { INTENSITY_TECHNIQUES, type IntensityTechnique } from '../../../engines/bb/bb-autocoach.engine';
import { loadTrainingProfile, saveTrainingProfile, useTrainingProfile, type TrainingProfile } from './training-profile';
import { TrainingProfileCard } from './TrainingProfileCard';
import { subscribePlannerApply, clearPlannerApply, type PlannerApply } from './planner-bridge';
import { applyBridgePayloadDispatch, type BridgeCtx } from './planner-bridge-handlers';
import { autoFillDraftDispatch, type AutoFillCtx } from './auto-fill-draft';
import { calcBBPlanMetrics } from '../../../engines/bb/bb-metrics.engine';
import { designerToUserWeeks, applyDesignPhasesToWeeks } from '../../../engines/periodization/designer-to-program';
import { macrocycleToBBProgram } from '../../../engines/lms/macrocycle-to-bb';
import { deserializeMacro } from '../../../engines/lms/macrocycle.engine';
import type { MacrocycleDesign } from '../../../engines/periodization-designer.engine';
import type { Macrocycle } from '../../../engines/lms/macrocycle.engine';
import { ACCENT, ACCENT_LINE, CARD, BTN, BTN_GHOST, SMALL, DIM, DIM_STRONG, IN, panelStyle, UI_METRICS } from './training-ui';
import { labTrainingAdjust } from './lab-training-adjust';
import { suggestFeeders } from '../../../engines/bb/bb-autocoach.engine';
import { useDataLink } from '../../../core/data-link';
import { detectLift } from '../../../engines/lms/lms-to-pl';
import { WOMENS_PROGRAMS, CUSTOM_PROGRAMS } from './programs-data';
import { LMS_CYCLES } from '../../../data/lms-cycles/lms-cycle-index';
import { getReferencedCycle, userWeekToBBPlan, validateProgram, cloneFromCycle, cloneFromLibrary, createBlank, createFromBuild, deleteRevision } from '../../../engines/user-program/program-store';
import { autodraftBBPlan, applyPhaseModulation, plLmsScheduleDays, computePlanQualityFor } from '../../../engines/manual-constructor';
import { GROUP_RU } from './program-types';
import { BulkApplyCard } from './BulkApplyCard';
import { useEditorToast } from './EditorToast';
import { useConfirmDialog } from './ConfirmDialog';
import { ProgramTimeline } from './ProgramTimeline';
import { RirWaveChart, QualityScorePanel, PlanStatsPanel } from './ProgramEditorPanels2';
import type { ManualMode } from './ProgramManagerPanel';

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

export interface ProgramEditorProps {
  program: UserProgram;
  onChange: (p: UserProgram) => void;
  onSave: (note?: string) => void;
  onBack: () => void;
  mode: ManualMode;
  onMode: (m: ManualMode) => void;
  autoFillOnMount?: boolean;
}

export const ProgramEditor: React.FC<ProgramEditorProps> = ({ program, onChange, onSave, onBack, mode, onMode, autoFillOnMount = false }) => {
  const dir = program.meta.direction;
  const isPro = mode === 'pro';
  const update = (patch: Partial<UserProgram>) => onChange({ ...program, ...patch });
  const updateMeta = (patch: Partial<UserProgram['meta']>) => onChange({ ...program, meta: { ...program.meta, ...patch } });
  const linked = useDataLink();
  const labAdjust = useMemo(() => labTrainingAdjust(linked.labAnalysis ?? null), [linked.labAnalysis]);
  const [tprofile, updateTProfile] = useTrainingProfile();
  const [isAutoFilling, setIsAutoFilling] = useState(false);

  // V6: Toast with variants — replaces plain editorToast div
  const { showToast: showToastRaw, ToastNode } = useEditorToast();
  const showToast = (m: string, variant?: import('./EditorToast').ToastVariant) => showToastRaw(m, variant);

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
    const ctx: BridgeCtx = { program, dir, update, onChange, showToast, tprofile };
    applyBridgePayloadDispatch(payload, ctx);
    clearPlannerApply();
    setBridgeApply(null);
  }, [program, dir, onChange, update, showToast, tprofile]);


  // Библиотека внутри редактора
  const [editorLibOpen, setEditorLibOpen] = useState<'bb' | 'pl' | 'methods' | 'macro' | null>(null);
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
  const libraryPrograms = useMemo(() => [...getAllPrograms(), ...WOMENS_PROGRAMS, ...CUSTOM_PROGRAMS], []);
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

  const revisions = program.meta.revisions ?? [];
  const removeRev = (revIdx: number) => {
    const updated = deleteRevision(program.meta.id, revIdx);
    if (updated) onChange(updated);
  };

  // U5: автосохранение каждые 30 секунд + индикатор «● изменено»
  const [isDirty, setIsDirty] = useState(false);
  const lastSavedRef = useRef<string>(JSON.stringify(program));
  useEffect(() => {
    const current = JSON.stringify(program);
    setIsDirty(current !== lastSavedRef.current);
  }, [program]);
  useEffect(() => {
    const timer = setInterval(() => {
      const current = JSON.stringify(program);
      if (current !== lastSavedRef.current) {
        onSave('Автосохранение');
        lastSavedRef.current = current;
        setIsDirty(false);
      }
    }, UI_METRICS.autosaveMs);
    return () => clearInterval(timer);
  }, [program, onSave]);
  // F4: ConfirmDialog replaces window.confirm
  const { confirm } = useConfirmDialog();
  // U4: подтверждение выхода без сохранения
  const safeBack = async () => {
    if (!isDirty) { onBack(); return; }
    const ok = await confirm({ title: 'Несохранённые изменения', message: 'Есть несохранённые изменения. Выйти без сохранения?', confirmLabel: 'Выйти', cancelLabel: 'Сохранить', danger: true });
    if (ok) {
      onBack();
    } else {
      onSave('Ручная правка');
      onBack();
    }
  };
  // U5: при ручном сохранении — обновляем baseline
  const handleSave = (note?: string) => {
    onSave(note);
    lastSavedRef.current = JSON.stringify(program);
    setIsDirty(false);
  };

  // P5: «⚡ Заполнить автоматически» — реальная интеллектуальная сборка через
  // buildBBPlan (BB) + LMS-cycles (PL). Пользователь получает рабочую программу
  // с реальными упражнениями и весами, а не пустую заготовку.
  // Читает единый профиль тренированности (equipment, weakPoints, avoidAxialLoad,
  // workMax, onCourse, favoriteExercises, excludedExercises) + лаб. коррекцию.
  const autoFillDraft = () => {
    // P0-4: extracted to auto-fill-draft.ts for per-direction testability
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
  };


 // «🚚 К выполнению» — поддерживает BB и PL.
  const [execWeek, setExecWeek] = useState(1);
  const sendToExecution = () => {
    let days: { label: string; exercises: { name: string; muscleGroup: string; targetSets: { weight: number; reps: number; rir: number }[] }[] }[] = [];

    if (dir === 'bb' && program.bb) {
      const wi = Math.max(0, Math.min(execWeek - 1, program.bb.weeks.length - 1));
      const week = program.bb.weeks[wi];
      if (!week) { alert('Сначала добавьте хотя бы одну сессию.'); return; }
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
        alert('Добавьте хотя бы одно упражнение, прежде чем отправлять к выполнению.');
        return;
      }
    } else if (dir === 'pl' && program.pl) {
      // P0-2: custom PL — конвертируем customWeeks в PlayerDay[]
      if (program.pl.sourceCycleId === null && program.pl.customWeeks && program.pl.customWeeks.length > 0) {
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
          alert('Свой ПЛ-цикл пуст — добавьте дни и упражнения.');
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
          alert('ПЛ-цикл пустой. Укажите ПМ (приседа/жима/тяги) и проверьте подключение LMS-цикла.');
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
      alert('Сначала выберите ББ или ПЛ программу.');
      return;
    }
    try {
      localStorage.setItem('he_pl_runtime', JSON.stringify({ days, focus: program.meta.title || 'Моя программа', week: execWeek, track: dir }));
    } catch {}
    showToast('🚚 Отправлено к выполнению — откройте зону «▶ Тренировка»');
  };

  /** 🖨 PDF-печать программы — print-friendly окно с таблицами */
  const printProgram = () => {
    const w = window.open('', '_blank', 'width=800,height=900');
    if (!w) { showToast('⚠ Разрешите всплывающие окна'); return; }
    const safeTitle = (program.meta.title || '').replace(/</g, '&lt;');
    const html: string[] = [];
    html.push(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${safeTitle}</title><style>`);
    html.push('body{font-family:Arial,sans-serif;margin:20px;color:#1a1a1a;background:#fff}');
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
      html.push(`<div style="white-space:pre-wrap;background:#f5f5f5;padding:10px;border-left:3px solid #60a5fa;margin:10px 0;font-size:11px;color:#333;">📝 <b>Заметки тренера:</b><br>${program.meta.notes.replace(/</g, '&lt;')}</div>`);
    }
    if (program.bb?.weeks) {
      for (const w of program.bb.weeks) {
        html.push(`<h2>Неделя ${w.week} <span class="phase" style="background:${w.deload?'#f59e0b20':'#00e68a20'};color:${w.deload?'#f59e0b':'#00e68a'}">${w.phase}${w.deload?' · делод':''}</span></h2>`);
        for (const s of w.sessions) {
          html.push(`<table><thead><tr><th colspan="5">${s.name || 'День'} ${s.focus ? '· ' + s.focus : ''}</th></tr><tr><th>Упражнение</th><th>Группа</th><th>Сеты</th><th>RIR</th><th>Вес</th></tr></thead><tbody>`);
          for (const b of s.blocks) {
            if (!b.exerciseName) continue;
            const setsStr = b.sets.map(st => `${st.reps}×`).join(', ');
            const rir = b.sets[0]?.rir ?? '-';
            const wt = b.sets[0]?.weight ?? 0;
            html.push(`<tr><td>${b.exerciseName}</td><td>${GROUP_RU[b.muscle] ?? b.muscle}</td><td>${setsStr}</td><td>${rir}</td><td>${wt} кг</td></tr>`);
          }
          html.push('</tbody></table>');
        }
      }
    } else if (program.pl) {
      // P4-4: PL в PDF — customWeeks (таблицы) или LMS-расписание
      if (program.pl.sourceCycleId === null && program.pl.customWeeks) {
        // Свой PL-цикл — таблицы как BB
        for (const w of program.pl.customWeeks) {
          html.push(`<h2>Неделя ${w.week} <span class="phase" style="background:${w.deload?'#f59e0b20':'#a78bfa20'};color:${w.deload?'#f59e0b':'#a78bfa'}">${w.phase}${w.deload?' · делод':''}</span></h2>`);
          for (const d of w.days) {
            html.push(`<table><thead><tr><th colspan="5">${d.name}</th></tr><tr><th>Упражнение</th><th>Группа</th><th>%1RM</th><th>Повт</th><th>Сетов</th></tr></thead><tbody>`);
            for (const ex of d.exercises) {
              if (!ex.name) continue;
              html.push(`<tr><td>${ex.name}</td><td>${ex.muscle || ex.lift || ''}</td><td>${Math.round((ex.sets[0]?.pct ?? 0) * 100)}%</td><td>${ex.sets[0]?.reps ?? '-'}</td><td>${ex.sets.length}</td></tr>`);
            }
            html.push('</tbody></table>');
          }
        }
      } else {
        // LMS-цикл — расписание через plLmsScheduleDays
        const plDays = plLmsScheduleDays(program);
        html.push(`<h2>ПЛ-цикл: ${program.pl.sourceCycleId}</h2>`);
        html.push(`<div class="meta">ПМ: присед ${program.pl.workMax?.squat ?? '-'} · жим ${program.pl.workMax?.bench ?? '-'} · тяга ${program.pl.workMax?.dead ?? '-'} кг</div>`);
        for (const pd of plDays) {
          html.push(`<table><thead><tr><th colspan="4">${pd.label}</th></tr><tr><th>Упражнение</th><th>Группа</th><th>Повт</th><th>Вес</th></tr></thead><tbody>`);
          for (const ex of (pd.exercises as any[])) {
            html.push(`<tr><td>${ex.name}</td><td>${ex.muscleGroup || ''}</td><td>${(ex.sets ?? []).map((s:any) => s.reps).join(', ')}</td><td>${(ex.sets ?? []).map((s:any) => s.weight ?? 0).join(', ')} кг</td></tr>`);
          }
          html.push('</tbody></table>');
        }
      }
      if (program.pl.notes) html.push(`<p>${program.pl.notes}</p>`);
    }
    html.push('</body></html>');
    w.document.write(html.join(''));
    w.document.close();
    setTimeout(() => { w.print(); }, 300);
  };

  return (
    <div className="manual-constructor" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* V2: Sticky header — always visible during scroll */}
      <div className="manual-constructor__sticky-header" style={{ position: 'sticky', top: 0, zIndex: 100, background: 'rgba(15,17,22,0.92)', backdropFilter: 'blur(12px) saturate(140%)', WebkitBackdropFilter: 'blur(12px) saturate(140%)', borderRadius: 12, padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', border: '1px solid rgba(255,255,255,0.06)', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}>
        <button style={{ ...BTN_GHOST, padding: '8px 14px', fontSize: 11, minHeight: 38 }} onClick={safeBack}>← К списку</button>
        <span style={{ fontSize: 11, fontWeight: 800, color: DIR_COLOR[dir] }}>{DIR_LABEL[dir]} · {SOURCE_LABEL[program.meta.source] ?? program.meta.source}</span>
        {isPro && <RecoveryBadge onApplyAutoDeload={autoFillDraft} />}
        <ProgramMetricsCSV program={program} dir={dir} onToast={showToast} />
        {program.meta.updatedAt && (
          <span style={{ fontSize: 11, color: DIM, fontWeight: 500 }} title={`Создано: ${new Date(program.meta.createdAt).toLocaleString('ru-RU')}\nОбновлено: ${new Date(program.meta.updatedAt).toLocaleString('ru-RU')}`}>
            · {(() => {
              const diff = Date.now() - new Date(program.meta.updatedAt).getTime();
              if (diff < 0 || diff < 60000) return 'только что';
              const min = Math.floor(diff / 60000);
              if (min < 60) return `${min} мин назад`;
              const hr = Math.floor(min / 60);
              if (hr < 24) return `${hr} ч назад`;
              const day = Math.floor(hr / 24);
              if (day < 30) return `${day} дн назад`;
              return `${Math.floor(day / 30)} мес назад`;
            })()}
          </span>
        )}
        {isDirty && <span style={{ fontSize: 11, fontWeight: 800, color: '#f59e0b' }} title="Несохранённые изменения">●</span>}

      {/* P5.2 — Inline-валидация: критические ошибки сразу бросаются в глаза. */}
      {(() => {
        const issues = validateProgram(program);
        const errs = issues.filter((i) => i.level === 'error');
        const warns = issues.filter((i) => i.level === 'warning');
        if (errs.length === 0 && warns.length === 0) return null;
        return (
          <div style={{ background: errs.length > 0 ? 'rgba(239,68,68,0.10)' : 'rgba(245,158,11,0.10)', borderRadius: 8, padding: '8px 10px', borderLeft: '3px solid ' + (errs.length > 0 ? '#ef4444' : '#f59e0b') }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: errs.length > 0 ? '#ef4444' : '#f59e0b', marginBottom: 4 }}>
              {errs.length > 0 ? `🚫 ${errs.length} ошибк${errs.length === 1 ? 'а' : 'и'} валидации` : `⚠ ${warns.length} предупреждений`}
            </div>
            <div style={{ fontSize: 10, lineHeight: 1.45, color: 'rgba(255,255,255,0.85)' }}>
              {errs.slice(0, 4).map((i, ix) => <div key={'e' + ix}>• <b>{i.code}</b>: {i.message}</div>)}
              {warns.slice(0, 3).map((i, ix) => <div key={'w' + ix}>• <b>{i.code}</b>: {i.message}</div>)}
              {(errs.length + warns.length) > 7 && <div style={{ color: DIM, marginTop: 4 }}>…и ещё {(errs.length + warns.length) - 7}</div>}
            </div>
          </div>
        );
      })()}

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {/* P2-5: основной ряд (всегда виден) */}
          <button style={{ ...BTN_GHOST, padding: '6px 12px', fontSize: 11, minHeight: 38, borderColor: showTableView ? 'rgba(0,230,138,0.6)' : 'rgba(255,255,255,0.15)', color: showTableView ? '#00e68a' : DIM }} onClick={() => setShowTableView(v => !v)} title={showTableView ? 'Редактор' : 'Таблица плана'}>{showTableView ? '✏️ Редактор' : '📋 Таблица'}</button>
          {(dir === 'bb' || dir === 'pl') && (
            <label style={{ fontSize: 11, color: DIM, display: 'flex', alignItems: 'center', gap: 4, marginRight: 4 }}>
              Нед
              <input type="number" style={{ ...IN, padding: '3px 4px', fontSize: 11, width: 38, minHeight: 34, textAlign: 'center' }} value={execWeek} min={1} max={program.meta.weeks} onChange={e => setExecWeek(Math.max(1, Math.min(parseInt(e.target.value) || 1, program.meta.weeks)))} />
            </label>
          )}
          {dir === 'bb' && (
            <button style={{ ...BTN_GHOST, padding: '6px 12px', fontSize: 11, minHeight: 38, borderColor: 'rgba(96,165,250,0.4)', color: '#60a5fa' }} onClick={sendToExecution} title="Отправить к выполнению (he_pl_runtime)">🚚 К выполнению</button>
          )}
          {dir === 'pl' && program.pl && (
            <button style={{ ...BTN_GHOST, padding: '6px 12px', fontSize: 11, minHeight: 38, borderColor: 'rgba(167,139,250,0.4)', color: '#a78bfa' }} onClick={sendToExecution} title="Отправить ПЛ-цикл к выполнению (he_pl_runtime)">🚚 К выполнению</button>
          )}
          <button style={{ ...BTN, padding: '8px 16px', fontSize: 11, minHeight: 38 }} onClick={() => handleSave('Ручная правка')}>💾 Сохранить</button>
          <button style={{ ...BTN_GHOST, padding: '6px 12px', fontSize: 11, minHeight: 38, borderColor: 'rgba(167,139,250,0.4)', color: '#a78bfa' }} onClick={printProgram} title="Печать / сохранить в PDF">🖨 PDF</button>
          {/* P2-5: secondary ряд (сворачиваемый «⋯ Ещё») */}
          <button style={{ ...BTN_GHOST, padding: '6px 12px', fontSize: 11, minHeight: 38 }} onClick={() => setShowMore(v => !v)} title="Дополнительные инструменты">⋯ Ещё</button>
        </div>
        {showMore && (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', paddingTop: 4 }}>
            {isPro && (
              <button disabled={isAutoFilling} style={{ ...BTN_GHOST, padding: '6px 12px', fontSize: 11, minHeight: 38, borderColor: 'rgba(0,230,138,0.4)', color: '#00e68a', opacity: isAutoFilling ? 0.65 : 1 }} onClick={autoFillDraft} title="Заполнить черновик на основе цели/уровня/дней (требует профиль тренированности)">{isAutoFilling ? '⏳ Создание...' : '⚡ Авто-черновик'}</button>
            )}
            <button style={{ ...BTN_GHOST, padding: '6px 12px', fontSize: 11, minHeight: 38, borderColor: 'rgba(245,158,11,0.4)', color: '#f59e0b' }}
              onClick={() => {
                if (dir === 'bb') setEditorLibOpen('bb');
                else if (dir === 'pl') setEditorLibOpen('pl');
              }}
              title="Загрузить программу или цикл из библиотеки для редактирования"
            >📥 Загрузить</button>
            {isPro && dir === 'bb' && program.bb && (program.bb.weeks?.length ?? 0) >= 4 && (
              <button style={{ ...BTN_GHOST, padding: '6px 12px', fontSize: 11, minHeight: 38, borderColor: 'rgba(96,165,250,0.4)', color: '#60a5fa' }}
                onClick={() => {
                  const updated = { ...program.bb!, weeks: applyPhaseModulation(program.bb!.weeks!, { goal: program.meta.goal, level: program.meta.level, weeksTotal: program.meta.weeks || 4 }) };
                  update({ bb: updated });
                  showToast('📈 Фазовая периодизация применена: RIR/фазы/повторения по неделям');
                }}
                title="Применить фазовую периодизацию (RIR/объём/повторения по неделям)"
              >📈 Применить фазы</button>
            )}
            {/* 🗓 Годовой план — MacrocyclePanel (для всех направлений: BB/PL/Hybrid) */}
            {isPro && (
              <button style={{ ...BTN_GHOST, padding: '6px 12px', fontSize: 11, minHeight: 38, borderColor: 'rgba(245,158,11,0.5)', color: '#f59e0b' }}
                onClick={() => {
                  setMacroLevel(program.meta.level);
                  setMacroGoal(mapGoalToMacro(program.meta.goal));
                  setEditorLibOpen('macro');
                }}
                title="Годовое планирование: построить макроцикл (5 фаз) и применить к программе"
              >🗓 Годовой план</button>
            )}
            {isPro && (
              <button style={{ ...BTN_GHOST, padding: '6px 12px', fontSize: 11, minHeight: 38, borderColor: 'rgba(167,139,250,0.4)', color: '#a78bfa' }}
                onClick={() => setEditorLibOpen('methods')}
                title="Справочник тренировочных методик"
              >📚 Методики</button>
            )}
          </div>
        )}
      </div>

      {/* P2-1/F5: подсказка при пустой программе в standard-режиме — прямая CTA авто-черновика */}
      {!isPro && program.bb && (program.bb.weeks ?? []).every(w => w.sessions.every(s => s.blocks.length === 0)) && (
        <div style={{ ...CARD, padding: 14, borderLeft: '3px solid #00e68a' }}>
          <div style={{ fontSize: 12, color: DIM_STRONG, lineHeight: 1.5, marginBottom: 8 }}>
            💡 Пустая программа. Заполните автоматически на основе вашего профиля или возьмите готовую из библиотеки.
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button style={{ ...BTN, padding: '8px 16px', fontSize: 12, minHeight: 40 }} onClick={() => autoFillDraft()} title="Автоматическая сборка на основе цели/уровня/дней">
              {isAutoFilling ? '⏳ Создание...' : '⚡ Создать автоматически'}
            </button>
            <button style={{ ...BTN_GHOST, padding: '8px 16px', fontSize: 12, minHeight: 40, color: '#a78bfa', borderColor: 'rgba(167,139,250,0.3)' }} onClick={() => setEditorLibOpen('bb')}>
              📥 Загрузить из библиотеки
            </button>
          </div>
        </div>
      )}

      {/* P1-1: planner-bridge баннер — рекомендация от калькулятора */}
      {bridgeApply && (
        <div style={{ ...CARD, padding: 10, borderLeft: '3px solid #f59e0b', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#f59e0b', flex: 1, minWidth: 100 }}>🔗 Калькулятор рекомендует: {bridgeApply.label}</span>
          <button style={{ ...BTN, padding: '6px 14px', fontSize: 11, minHeight: 38 }} onClick={() => applyBridgePayload(bridgeApply)}>Применить</button>
          <button style={{ ...BTN_GHOST, padding: '6px 14px', fontSize: 11, minHeight: 38 }} onClick={() => { clearPlannerApply(); setBridgeApply(null); }}>✕</button>
        </div>
      )}

      {/* ═════════ ПРОФЕССИОНАЛЬНЫЙ РЕЖИМ: контекстные панели, профиль, лаб-коррекция, диагностика, объём, периодизация, рекомендации, тренер ═════════ */}
      {isPro && (
      <>
      {/* P4 — контекстная панель ББ (ПЛ дубль PLEditor удалён — F4.5) */}
      {dir === 'bb' && program.bb && <BbContextPanel program={program} level={program.meta.level} />}
      {dir === 'bb' && program.bb && <MesoHeatmap program={program} dir={dir} onToast={showToast} />}

      {/* Единый профиль тренированности: ПМ, workMax, weakPoints, оборудование, курс —
          авто-черновик и SMART-рекомендации читают эти данные. */}
      <TrainingProfileCard profile={tprofile} update={updateTProfile} compact />

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
            <ProgressionCoach program={program} dir={dir} onChange={onChange} showToast={showToast} labMrvMult={labAdjust.mrvMultiplier} onCourse={tprofile.onCourse ?? false} courseIntensity={tprofile.courseIntensity ?? 'moderate'} />
            <TonnageEstimatePanel program={program} dir={dir} />
          </>,
        },
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
          </>,
        },
        {
          id: 'technique',
          title: '🦴 Техника и биомеханика',
          hint: 'Срывы, bar-path, блины, инфо об упражнениях, прогресс из дневника',
          color: '#06b6d4',
          content: <>
            <StickingPointPanel program={program} dir={dir} onChange={onChange} showToast={showToast} />
            <BiomechanicsPanel program={program} dir={dir} />
            <PlateAutoPanel program={program} dir={dir} />
            <ExerciseInfoPanel program={program} dir={dir} />
            <StrengthDiaryPanel program={program} dir={dir} />
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
        <div style={{ ...CARD, padding: 12, borderLeft: '3px solid #f59e0b' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: '#f59e0b' }}>🗓 Годовое планирование</span>
            <button style={{ ...BTN_GHOST, padding: '6px 12px', fontSize: 11, minHeight: 38 }} onClick={() => setEditorLibOpen(null)}>✕ Закрыть</button>
          </div>
          <div style={{ fontSize: 11, color: DIM, marginBottom: 8 }}>
            Постройте макроцикл (5 фаз: выносливость → сила → пик → соревнования → переход).
            Клик по блоку → применить как активный цикл/программу. Текущее направление: <b style={{ color: DIR_COLOR[dir] }}>{DIR_LABEL[dir]}</b>.
          </div>
          <MacrocyclePanel
            level={macroLevel}
            goal={macroGoal}
            onLevelChange={setMacroLevel}
            onGoalChange={setMacroGoal}
            onApplyCycle={(cycleId, weeks) => {
              if (dir === 'pl') {
                // PL: загрузить LMS-цикл + установить weeks
                loadCycleIntoEditor(cycleId);
                updateMeta({ weeks });
                setEditorLibOpen(null);
                showToast('🗓 ПЛ-цикл применён: ' + cycleId + ' (' + weeks + ' нед)');
              } else if (dir === 'bb') {
                // BB: применить макроцикл как ББ-программу (macrocycleToBBProgram)
                try {
                  const raw = localStorage.getItem('he_pl_macro');
                  if (!raw) {
                    showToast('⚠ Годовой план не найден — постройте макроцикл сначала');
                  } else {
                    const macro = deserializeMacro(raw);
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
                      showToast('🗓 Годовой план ББ создан: ' + macro.totalWeeks + ' нед, 5 фаз');
                    }
                  }
                } catch (e) {
                  showToast('⚠ Не удалось создать ББ-план: ' + (e as Error)?.message);
                }
              } else if (dir === 'hybrid') {
                // Hybrid: применить макроцикл для bb-части, pl-часть не трогается
                try {
                  const raw = localStorage.getItem('he_pl_macro');
                  if (!raw) {
                    showToast('⚠ Годовой план не найден — постройте макроцикл сначала');
                  } else {
                    const macro = deserializeMacro(raw);
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
          />
        </div>
      )}

      {/* 📚 Методики — справочник тренера (открывается из шапки, только в про-режиме) */}
      {isPro && editorLibOpen === 'methods' && (
        <div style={{ ...CARD, padding: 12, borderLeft: '3px solid #a78bfa' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: '#a78bfa' }}>📚 Справочник методик</span>
            <button style={{ ...BTN_GHOST, padding: '6px 12px', fontSize: 11, minHeight: 38 }} onClick={() => setEditorLibOpen(null)}>✕ Закрыть</button>
          </div>
          <div style={{ fontSize: 11, color: DIM, marginBottom: 8 }}>
            Энциклопедия тренировочных методик по категориям. Клик «Применить» → отправляет методику в planning-bridge (loadStrategy/intensityTechniques). Двойной клик по карточке разворачивает детали.
          </div>
          <MethodologyEncyclopedia />
        </div>
      )}

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
        let dayLabels: Array<{ idx: number; label: string; muscles: string[] }> = [];
        if (dir === 'bb' && program.bb) {
          dayLabels = (program.bb.weeks[0]?.sessions ?? []).map((s, i) => ({
            idx: i,
            label: s.name || `День ${i + 1}`,
            muscles: Array.from(new Set((s.blocks ?? []).map((b) => b.muscle).filter(Boolean))),
          }));
        } else if (dir === 'pl' && program.pl) {
          dayLabels = (program.pl.schedule ?? []).map((s, i) => ({
            idx: i,
            label: (s.sessionIdx != null ? `Сессия ${s.sessionIdx + 1}` : `День ${i + 1}`),
            muscles: ['—'],
          }));
        }
        const dayByDow: Record<number, { idx: number; label: string; muscles: string[] }> = {};
        dayLabels.forEach((d) => { dayByDow[d.idx % 7] = d; });
        return (
          <div style={{ ...CARD, padding: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: ACCENT, marginBottom: 6 }}>
              🗓 Неделя — расписание
              <span style={{ fontSize: 11, color: DIM, marginLeft: 6, fontWeight: 500 }}>
                (по плану текущей редактируемой программы)
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(52px, 1fr))', gap: 4 }}>
              {WEEKDAYS.map((day, wi) => {
                const d = dayByDow[wi];
                const fill = d ? 'rgba(0,230,138,0.06)' : 'rgba(255,255,255,0.02)';
                return (
                  <div key={wi} style={{
                    minHeight: 64, borderRadius: 6, padding: '6px 4px',
                    background: fill,
                    border: d ? '1px solid rgba(0,230,138,0.25)' : '1px solid rgba(255,255,255,0.05)',
                    textAlign: 'center',
                  }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: d ? '#00e68a' : DIM }}>{day}</div>
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
                  </div>
                );
              })}
            </div>
            <div style={{ fontSize: 10, color: DIM, marginTop: 6, fontStyle: 'italic' }}>
              Шаблон недели повторяется для всех мезоциклов. Делод-недели должны быть явно отмечены флагом «deload» в структуре.
            </div>
          </div>
        );
      })()}

      </> )}

      {/* V3: compact dashboard keeps the key signals together and tied to execWeek. */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 8 }}>
        <RirWaveChart program={program} />
        {dir === 'bb' && program.bb && program.bb.weeks.length > 0 && (
          <ProgramTimeline program={program} selectedWeek={execWeek - 1} onSelectWeek={(wi) => setExecWeek(wi + 1)} />
        )}
        {isPro && <QualityScorePanel program={program} level={program.meta.level} tprofile={tprofile} labMrvMult={labAdjust.mrvMultiplier} />}
        {dir === 'bb' && <PlanStatsPanel program={program} execWeek={execWeek} onCourse={tprofile.onCourse ?? false} />}
      </div>


      {/* P3.2 — Bulk-apply методик ко всем блокам (инструмент тренера) */}
      {/* P2-3: extracted to BulkApplyCard with week-range selector */}
      {isPro && dir === 'bb' && program.bb && program.bb.weeks.length > 0 && (
        <BulkApplyCard program={program} onChange={onChange} showToast={showToast} />
      )}


      {/* Meta */}
      <div style={{ ...CARD, padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <input style={IN} value={program.meta.title} onChange={e => updateMeta({ title: e.target.value })} placeholder="Название программы" />
        <div style={{ display: 'flex', gap: 6 }}>
          <select style={IN} value={program.meta.goal} onChange={e => updateMeta({ goal: e.target.value })}>
            {GOAL_OPTS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
          <select style={IN} value={program.meta.level} onChange={e => updateMeta({ level: e.target.value })}>
            {LEVEL_OPTS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
          <label style={{ ...SMALL, display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
            Дней/нед
            {/* U3: meta.daysPerWeek каскад — при изменении добавляет/удаляет сессии в bb.weeks */}
            <input type="number" style={IN} value={program.meta.daysPerWeek} min={1} max={7}
              onChange={e => {
                const v = parseInt(e.target.value) || 1;
                updateMeta({ daysPerWeek: v });
                // Каскад на bb.weeks: выровнять кол-во сессий
                if (program.bb) {
                  const weeks = program.bb.weeks;
                  const updated = weeks.map(w => {
                    const target = v;
                    const sessions = [...w.sessions];
                    while (sessions.length < target) {
                      // P1-3: в deload-неделю добавляем разгрузочную сессию, не копию базовой
                      if (w.deload) {
                        sessions.push({ id: newId('ses'), name: 'Разгрузка ' + (sessions.length + 1), focus: 'deload', blocks: [
                          { id: newId('blk'), type: 'accessory' as const, exerciseName: '', muscle: '', role: 'accessory' as const, sets: [{ reps: 15, rir: 4, weight: 0, restSec: 60 }] }
                        ] });
                      } else {
                        sessions.push({ id: newId('ses'), name: 'День ' + (sessions.length + 1), focus: '', blocks: [] });
                      }
                    }
                    while (sessions.length > target) sessions.pop();
                    return { ...w, sessions };
                  });
                  onChange({ ...program, meta: { ...program.meta, daysPerWeek: v }, bb: { ...program.bb, weeks: updated } });
                }
              }} />
          </label>
          <label style={{ ...SMALL, display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
            Недель
            {/* U3: meta.weeks каскад — при изменении добавляет/удаляет недели в bb.weeks */}
            <input type="number" style={IN} value={program.meta.weeks} min={1} max={24}
              onChange={e => {
                const v = parseInt(e.target.value) || 1;
                updateMeta({ weeks: v });
                if (program.bb) {
                  const weeks = [...program.bb.weeks];
                  while (weeks.length < v) {
                    const n = weeks.length + 1;
                    const template = weeks[0]?.sessions ?? [];
                    const progression = 1 + (n - 1) * 0.025; // +2.5% за каждую неделю
                    weeks.push({ week: n, phase: 'accumulation', deload: n % 4 === 0, sessions: template.map(s => ({ ...s, id: newId('ses'), blocks: s.blocks.map(b => ({ ...b, id: newId('blk'), sets: b.sets.map(st => ({ ...st, weight: st.weight ? Math.round(st.weight * progression / 2.5) * 2.5 : st.weight })) })) })) });
                  }
                  while (weeks.length > v) weeks.pop();
                  onChange({ ...program, meta: { ...program.meta, weeks: v }, bb: { ...program.bb, weeks } });
                }
              }} />
          </label>
        </div>
      </div>

      {/* F2.5: тренерские заметки (отображаются в PDF) */}
      <ProgramNotes program={program} onChange={onChange} />

      {/* Локальный toast для сообщений внутри редактора (авто-черновик, к выполнению и т.п.) */}
      {ToastNode}

      {/* Библиотека — модальное окно внутри редактора (только bb/pl; methods/macro имеют отдельные модалы) */}
      {editorLibOpen && editorLibOpen !== 'macro' && editorLibOpen !== 'methods' && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12 }}>
          <div style={{ background: '#18181b', borderRadius: 16, border: '1px solid rgba(255,255,255,0.1)', maxWidth: 700, width: '100%', maxHeight: '85vh', overflow: 'auto', padding: 16, boxShadow: '0 20px 60px rgba(0,0,0,0.8)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: ACCENT }}>📚 {editorLibOpen === 'bb' ? 'Библиотека программ' : editorLibOpen === 'pl' ? 'Проф. ПЛ-циклы' : 'Справочник методик'}</span>
              <button style={{ ...BTN_GHOST, padding: '6px 12px', fontSize: 11, minHeight: 38 }} onClick={() => setEditorLibOpen(null)}>✕ Закрыть</button>
            </div>
            {editorLibOpen === 'bb' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: '60vh', overflow: 'auto' }}>
                {libraryPrograms.map(pr => (
                  <button key={pr.id ?? pr.name} onClick={() => loadIntoEditor(cloneFromLibrary(expandProgramWeeks(pr)))}
                    style={{ textAlign: 'left', padding: '10px 12px', borderRadius: 10, background: 'rgba(0,230,138,0.06)', border: '1px solid rgba(0,230,138,0.18)', color: DIM_STRONG, cursor: 'pointer', fontSize: 11 }}>
                    <div style={{ fontWeight: 700 }}>{pr.name}</div>
                    <div style={{ fontSize: 11, color: DIM }}>{pr.author} · {pr.goal} · {pr.daysPerWeek}д/нед · {pr.durationWeeks}нед</div>
                  </button>
                ))}
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
          </div>
        </div>
      )}

      {/* P2.11: редактирование constraints (оборудование, травмы, avoidAxialLoad, любимые/исключённые) + progression — pro-only */}
      {isPro && !showTableView && dir === 'bb' && program.bb && (
        <BBConstraintsPanel
          constraints={program.bb.constraints ?? { equipment: [] }}
          progression={program.bb.progression ?? { loadStrategy: 'double_progression', deloadProtocol: 'pump', intensityTechniques: ['none'] }}
          onChangeConstraints={(constraints) => onChange({ ...program, bb: { ...program.bb!, constraints } })}
          onChangeProgression={(progression) => onChange({ ...program, bb: { ...program.bb!, progression } })}
        />
      )}

      {!showTableView && dir === 'bb' && program.bb && <BBEditor body={program.bb} level={program.meta.level} onChange={(bb) => update({ bb })} />}
      {!showTableView && dir === 'pl' && program.pl && <PLEditor body={program.pl} onChange={(pl) => update({ pl })} />}
      {!showTableView && dir === 'hybrid' && program.hybrid && (
        <>
          <div style={{ ...CARD, padding: 10, borderLeft: '3px solid #3b82f6', background: 'rgba(59,130,246,0.06)' }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#3b82f6' }}>⚡ Powerbuilder (Hybrid)</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 4 }}>Гибрид ПЛ+ББ в активной разработке. Редактируйте ПЛ и ББ части независимо.</div>
          </div>
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
          <div style={{ ...CARD, padding: 10, marginTop: 4, borderLeft: `3px solid ${color}` }}>
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

      {/* История правок (revisions): дешёвая версия — без полных снапшотов, только timestamp+note */}
      {revisions.length > 0 && (
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
                  <button style={{ ...BTN_GHOST, padding: '2px 6px', fontSize: 11, minHeight: 38, color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)' }} onClick={() => removeRev(realIdx)} title="Удалить запись">✕</button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
