import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { EXERCISE_CATALOG, getExercisesByGroup, getSubstitutes, canReplace, getExerciseById } from '../../core/exercise-catalog';
import { calcTraining, calcExercisePrescription, EXERCISE_DB, TRAINING_SPLITS, TRAINING_LEVEL_CONFIGS, LEVEL_VOLUMES } from '../../engines/training.engine';
import { generateMacrocycle, generateBlockPlan, getCurrentWeekPlan, BLOCK_SEQUENCES, type MacrocyclePlan, type Microcycle, type MacrocycleInput } from '../../engines/training-periodization.engine';
import { selectSplit, getSplitOptions, type SplitCandidate } from '../../engines/split-selector.engine';
import { selectProgressionRule } from '../../engines/progression.engine';
import { RIR_MATRIX, generateWeeklyPlan } from '../../engines/rir-matrix.engine';
import { StrengthDiary, type StrengthStats, type WeeklyProgress, type ProgressionAlert } from '../../engines/strength-diary.engine';
import type { WorkoutLog } from '../../core/types';
import { generateWarmup } from '../../engines/warmup.engine';
import { generateCooldown } from '../../engines/cooldown.engine';
import { selectSetScheme } from '../../engines/set-scheme.engine';
import { selectTempo, formatTempo } from '../../engines/tempo.engine';
import { generateRepTempo } from '../../engines/rep-tempo-engine';
import { useDataLink } from '../../core/data-link';
import type { TrainingInput, TrainingOutput, Exercise, MovementPattern } from '../../core/types';
import { computeAnalytics, type AnalyticsSnapshot, type WeeklyBreakdown } from '../../engines/analytics-engine';
import { computeConstraints } from '../../engines/training-constraints.engine';
import { generatePeriodization, getPhaseParams, type GoalType } from '../../engines/cycle-periodization.engine';
import { getTrainingMethods, getMethodsByCategory, getVolumeReferences, getVolumeByMuscle, getSplitVisuals, type TrainingMethod } from '../../engines/training-methodology.engine';
import { buildVisualDashboard, computeWeeklyChart, computeMuscleVolume, computeProgression, type VizSessionData } from '../../engines/training-visualization.engine';
import { getProgramById, getProgramsByGoal, FULL_PROGRAM_LIBRARY, type FullProgram, type ProgramDay } from '../../engines/complete-program-library.engine';
import { generateWeeklyReport, analyzeMeasurements, loadMeasurements, saveMeasurement, type BodyMeasurement } from '../../engines/log-analytics-progression.engine';
import { getExerciseBio } from '../../data/exercise-biomechanics-db';
import { getStrengthLevel, getNextLevelTarget } from '../../engines/performance-analytics.engine';
import { computeStructuredAnalytics } from '../../engines/structured-analytics.engine';
import { SRCBBScreen } from './SRCBBScreen';
import { DiaryAndAnalyticsTab } from './TrainingScreen_parts/DiaryAndAnalyticsTab';
import { VBTCalculator } from './SRCBBScreen_parts/VBTCalculator';
import { MRVEstimator } from './SRCBBScreen_parts/MRVEstimator';
import { PlateCalculator } from './SRCBBScreen_parts/PlateCalculator';

import {
  WARMUP_LABELS, GOALS, LEVELS, MUSCLE_GROUPS, GROUP_LABELS, EQUIP_LABELS, JOINT_LABELS,
  PHASE_LABELS, PHASE_HINTS, TAB_GROUPS, TAB_LABELS,
  type TrainingTab, type TrainingPage, type TrainingGroup,
  type PlanningTrack, getPlanningTrack, setPlanningTrack, planningTabsFor,
} from './TrainingScreen_parts/shared';
import { hapticImpact } from '../../core/telegram';
import { InfoErrorBoundary } from './SupportScreen_parts/SupportScreenData';

export const TrainingScreen: React.FC = () => {
  const linked = useDataLink();
  const readiness = linked.readiness;
  const labAnalysis = linked.labAnalysis;
  const diary = useMemo(() => new StrengthDiary(), []);
  // Этап R: режим планирования (устраняет дубли программ СРЦ/BB ↔ конструктор, AGENTS.md баг #1)
  const [planningTrack, setPlanningTrackState] = useState<PlanningTrack>(getPlanningTrack());
  const [tab, setTab] = useState<TrainingTab>(getPlanningTrack() === 'manual' ? 'plan' : 'srcbb');
  const [page, setPage] = useState<TrainingPage>('hero');
  const [mainGroup, setMainGroup] = useState<TrainingGroup>(null);
  // Эффективные группы вкладок: «Планирование» зависит от режима (взаимоисключающие наборы — нет дублей)
  const TAB_GROUPS_EFF: typeof TAB_GROUPS = {
    ...TAB_GROUPS,
    planning: { ...TAB_GROUPS.planning, tabs: planningTabsFor(planningTrack) },
  };
  const switchPlanningTrack = (t: PlanningTrack) => {
    setPlanningTrack(t);
    setPlanningTrackState(t);
    const visible = planningTabsFor(t);
    if (mainGroup === 'planning' && !visible.includes(tab)) setTab(visible[0]);
  };

  // Plan state — pre-fill from readiness and labAnalysis
  const [goal, setGoal] = useState('bulk');
  const [level, setLevel] = useState('intermediate');
  const [daysPerWeek, setDaysPerWeek] = useState(4);
  const [splitType, setSplitType] = useState('auto');
  const [splitCandidates, setSplitCandidates] = useState<SplitCandidate[]>([]);
  const [showSplitPicker, setShowSplitPicker] = useState(false);
  const [cycleType, setCycleType] = useState('auto');
  const [periodizationType, setPeriodizationType] = useState<'auto' | 'linear' | 'undulating' | 'block' | 'conjugate'>('auto');
  const [mesoLength, setMesoLength] = useState(12);
  const [recovery, setRecovery] = useState(Math.round((readiness?.recovery ?? 70) / 10));
  const [fatigue, setFatigue] = useState(Math.round((readiness?.fatigue ?? 30) / 10));
  const [weakPoints, setWeakPoints] = useState<string[]>([]);
  const [myCycleMsg, setMyCycleMsg] = useState('');
  const [cyclesError, setCyclesError] = useState<string | null>(null);
  const [bodyWeight, setBodyWeight] = useState(80);
  const [sleepHours, setSleepHours] = useState(linked.profile?.settings?.baselineSleepHours ?? 7);
  const [stressLevel, setStressLevel] = useState(linked.profile?.settings?.baselineStressLevel ?? 5);
  const [tprofile, updateTProfile] = useTrainingProfile();
  // Синхронизируем локальные состояния из единого профиля (профиль — мастер для конструктора)
  useEffect(() => { setGoal(tprofile.goal); setLevel(tprofile.level); setDaysPerWeek(tprofile.daysPerWeek); setRecovery(tprofile.recovery); setFatigue(tprofile.fatigue); setWeakPoints(tprofile.weakPoints); setBodyWeight(tprofile.bodyWeight); setSleepHours(tprofile.sleepHours); setStressLevel(tprofile.stressLevel); }, [tprofile]);
  const [customExercises, setCustomExercises] = useState<{ name: string; sets: number; reps: number; rir: number }[]>(() => { try { return JSON.parse(localStorage.getItem('myTrainingExercises') || '[]'); } catch { return []; } });
  const [lastAddedEx, setLastAddedEx] = useState<string | null>(null);
  const [trainingOutput, setTrainingOutput] = useState<TrainingOutput | null>(null);
  const [macrocycle, setMacrocycle] = useState<MacrocyclePlan | null>(() => { try { return JSON.parse(localStorage.getItem('he_macro_session') || 'null'); } catch { return null; } });
  useEffect(() => { try { localStorage.setItem('he_macro_session', JSON.stringify(macrocycle)); } catch {} }, [macrocycle]);
  const [trainingReportGenerated, setTrainingReportGenerated] = useState(false);
  useEffect(() => { try { if (localStorage.getItem('he_training_report_current')) setTrainingReportGenerated(true); } catch {} }, []);
  const [trainingArchive, setTrainingArchive] = useState<any[]>(() => {
    try { return JSON.parse(localStorage.getItem('he_training_reports') || '[]'); } catch { return []; }
  });
  const [selectedWeek, setSelectedWeek] = useState(1);
  const [currentMicrocycle, setCurrentMicrocycle] = useState<Microcycle | null>(null);
  const [selectedProgram, setSelectedProgram] = useState<string | null>(null);
  const [expandedMeso, setExpandedMeso] = useState<number | null>(null);
  // Этап U: методики — по одной из каждой категории (было: одна строка total)
  const [appliedMethods, setAppliedMethods] = useState<Record<string, string>>({});
  const appliedMethod = Object.values(appliedMethods)[0] || null; // бэкворд-совместимость

  // Exercise DB state
  const [exSearch, setExSearch] = useState('');
  const [exGroup, setExGroup] = useState('all');
  const [exType, setExType] = useState('all');
  const [exEquipment, setExEquipment] = useState('all');
  const [exDifficulty, setExDifficulty] = useState('all');
  const [exVisible, setExVisible] = useState(80);
  const [selectedEx, setSelectedEx] = useState<Exercise | null>(null);

  // Calculator state
  const [calcWeight, setCalcWeight] = useState(100);
  const [calcReps, setCalcReps] = useState(5);
  const [calcRPE, setCalcRPE] = useState(8);
  const [calc1RM, setCalc1RM] = useState(100);
  const [calcPercent, setCalcPercent] = useState(75);
  const [plSquat, setPlSquat] = useState(140);
  const [plBench, setPlBench] = useState(100);
  const [plDeadlift, setPlDeadlift] = useState(180);
  const [plWeight, setPlWeight] = useState(80);
  const [plSex, setPlSex] = useState<'male' | 'female'>('male');
  const [bmiWeight, setBmiWeight] = useState(70);
  const [bmiHeight, setBmiHeight] = useState(175);
  const [bmiResult, setBmiResult] = useState<number | null>(null);
  const [bmrWeight, setBmrWeight] = useState(70);
  const [bmrHeight, setBmrHeight] = useState(175);
  const [bmrAge, setBmrAge] = useState(25);
  const [bmrSex, setBmrSex] = useState<'male' | 'female'>('male');
  const [bmrResult, setBmrResult] = useState<number | null>(null);
  const [bmrKmWeight, setBmrKmWeight] = useState(70);
  const [bmrKmBodyFat, setBmrKmBodyFat] = useState(15);
  const [bmrKmResult, setBmrKmResult] = useState<number | null>(null);
  const [tdeeBmr, setTdeeBmr] = useState(1700);
  const [tdeePal, setTdeePal] = useState(1.55);
  const [tdeeResult, setTdeeResult] = useState<number | null>(null);
  const [gripKg, setGripKg] = useState(45);
  const [gripSex, setGripSex] = useState<'male' | 'female'>('male');
  const [gripAge, setGripAge] = useState(30);
  const [gripResult, setGripResult] = useState<{ percentile: number; level: string } | null>(null);
  const [hrvValue, setHrvValue] = useState(50);
  const [stressResult, setStressResult] = useState<{ stress: number; level: string } | null>(null);

  // Exercise Calculator state
  const [exCalcGroup, setExCalcGroup] = useState('');
  const [exCalcType, setExCalcType] = useState('');
  const [exCalcEquip, setExCalcEquip] = useState('');

  // Unified program builder state
  const [builderStep, setBuilderStep] = useState(1);
  const [manualCfg, setManualCfg] = useState<Record<string, string>>({});
  const [injMuscle, setInjMuscle] = useState<string>('chest');
  const [injFrom, setInjFrom] = useState<string>('');
  const [injTo, setInjTo] = useState<string>('');
  const setManual = (k: string, v: string) => setManualCfg(p => ({ ...p, [k]: v }));
  const [showWizard, setShowWizard] = useState(false);
  const [manualWorkMax, setManualWorkMax] = useState<Record<string, number>>({ chest: 100, back: 110, legs: 140, shoulders: 60, arms: 50, core: 60 });
  const setManualWm = (k: string, v: number) => setManualWorkMax(p => ({ ...p, [k]: v }));
  const PCT_FOR_RIR_MAN: Record<number, number> = { 0: 1.0, 1: 0.96, 2: 0.92, 3: 0.88, 4: 0.84, 5: 0.80 };
  const [manualResult, setManualResult] = useState<{ splitName: string; corrections: string[]; days: { day: number; groups: string[]; exercises: { name: string; sets: number; reps: string; rir: number; rest: number; group: string; weight: number }[] }[] } | null>(() => { try { return JSON.parse(localStorage.getItem('he_manual_session') || 'null'); } catch { return null; } });
  useEffect(() => { try { localStorage.setItem('he_manual_session', JSON.stringify(manualResult)); } catch { /* ignore */ } }, [manualResult]);
  const [manualSavedPlans, setManualSavedPlans] = useState<any[]>(() => { try { return JSON.parse(localStorage.getItem('myTrainingPlans') || '[]'); } catch { return []; } });
  const loadManualPlan = (plan: any) => { if (plan?.cfg) setManualCfg(plan.cfg); if (plan?.days) setManualResult({ splitName: plan.name || 'Загруженный план', corrections: plan.corrections || [], days: plan.days }); };
  const refreshManualSaved = () => { try { setManualSavedPlans(JSON.parse(localStorage.getItem('myTrainingPlans') || '[]')); } catch { setManualSavedPlans([]); } };
const [subModal, setSubModal] = useState<{ dayIdx: number; exIdx: number; options: { id: string; name: string; reason: string }[] } | null>(null);
  const [inlineEdit, setInlineEdit] = useState<{ dayIdx: number; exIdx: number; field: string; value: string } | null>(null);
  const [dragFrom, setDragFrom] = useState<{ dayIdx: number; exIdx: number } | null>(null);
  const [showMacroPreview, setShowMacroPreview] = useState(false);
  const inlineRef = useRef<HTMLInputElement | null>(null);
  const openSubstitute = (dayIdx: number, exIdx: number) => {
    if (!manualResult) return;
    const e = manualResult.days[dayIdx]?.exercises[exIdx];
    if (!e) return;
    const cat = EXERCISE_CATALOG.find(c => c.name === e.name) || getExerciseById(e.name);
    if (!cat) { setSubModal({ dayIdx, exIdx, options: [] }); return; }
    const sub = getSubstitutes(cat.id);
    const opts: { id: string; name: string; reason: string }[] = [];
    if (sub) {
      for (const s of sub.substitutes) {
        if (!canReplace(cat.id, s.id)) continue;
        const rep = getExerciseById(s.id);
        opts.push({ id: s.id, name: rep?.name || s.id, reason: s.reason });
      }
    }
    if (opts.length === 0) {
      EXERCISE_CATALOG.filter(c => c.group === cat.group && c.id !== cat.id && canReplace(cat.id, c.id)).slice(0, 6).forEach(c => opts.push({ id: c.id, name: c.name, reason: 'Альтернатива той же группы' }));
    }
    setSubModal({ dayIdx, exIdx, options: opts });
  };
  const applySubstitute = (newId: string) => {
    if (!subModal || !manualResult) return;
    const rep = getExerciseById(newId);
    if (!rep) { setSubModal(null); return; }
    const dayIdx = subModal.dayIdx, exIdx = subModal.exIdx;
    const old = manualResult.days[dayIdx].exercises[exIdx];
    const reason = subModal.options.find(o => o.id === newId)?.reason || '';
    const wm = (tprofile.workMax[rep.group] || manualWorkMax[rep.group] || 80);
    const pct = PCT_FOR_RIR_MAN[Math.max(0, Math.min(5, old.rir))] ?? 0.9;
    const weight = Math.round(wm * pct);
    const days = manualResult.days.map((d, di) => di === dayIdx ? { ...d, exercises: d.exercises.map((ex, ei) => ei === exIdx ? { ...ex, name: rep.name, group: rep.group, weight } : ex) } : d);
    setManualResult({ ...manualResult, days, corrections: [...manualResult.corrections, `🔄 Замена: «${old.name}» → «${rep.name}» (${reason || 'по выбору'}). Группа: ${rep.group}, вес пересчитан ${weight} кг.`] });
    setSubModal(null);
  };
const [improveModal, setImproveModal] = useState<{ notes: string[]; apply: () => void } | null>(null);
  const improveProgram = () => {
    if (!manualResult) return;
    const GRP_RU: Record<string, string> = { chest: 'Грудь', back: 'Спина', legs: 'Ноги', shoulders: 'Плечи', arms: 'Руки', core: 'Кор' };
    const ru = (g: string) => GRP_RU[g] || g;
    const wk: Record<string, number> = {};
    manualResult.days.forEach(d => d.exercises.forEach(e => { wk[e.group] = (wk[e.group] || 0) + e.sets; }));
    const mrv = ((LEVEL_VOLUMES as Record<string, { mrv: number }>)[level]?.mrv ?? 20) * (tprofile.onCourse ? 1.2 : 1) * labTrainingAdjust(linked.labAnalysis).mrvMultiplier;
    const notes: string[] = [];
    let days = manualResult.days.map(d => ({ ...d, exercises: d.exercises.map(e => ({ ...e })) }));
    Object.entries(wk).forEach(([g, s]) => {
      if (s > mrv) {
        const excess = s - Math.round(mrv);
        let reduced = 0;
        for (const d of days) { for (const e of d.exercises) { if (e.group === g && reduced < excess) { const take = Math.min(Math.max(0, e.sets - 1), excess - reduced); if (take > 0) { e.sets -= take; reduced += take; } } } }
        if (reduced > 0) notes.push(`Снижен объём группы «${ru(g)}»: −${reduced} сетов (было >MRV ${Math.round(mrv)}).`);
      }
    });
    tprofile.weakPoints.forEach(w => {
      if ((wk[w] || 0) === 0) {
        const cat = EXERCISE_CATALOG.find(e => e.group === w && e.type === 'compound' && (tprofile.equipment.length === 0 || tprofile.equipment.includes(e.equipment)));
        if (cat) {
          const dayIdx = days.findIndex(d => d.groups.includes(w)); const target = dayIdx >= 0 ? dayIdx : 0;
          const pr = calcExercisePrescription(cat, goal, level, true, false, 1, 1, mesoLength);
          const wm = tprofile.workMax[w] || manualWorkMax[w] || 80;
          const pct = PCT_FOR_RIR_MAN[Math.max(0, Math.min(5, pr.rir))] ?? 0.9;
          days[target].exercises.push({ name: cat.name, sets: pr.sets, reps: pr.reps, rir: pr.rir, rest: pr.rest, group: w, weight: Math.round(wm * pct) });
          notes.push(`Добавлено упражнение для слабой группы «${ru(w)}»: ${cat.name} (${pr.sets}×${pr.reps}).`);
        } else {
          notes.push(`Слабая группа «${ru(w)}» не покрыта — нет подходящего упражнения в каталоге, добавьте вручную.`);
        }
      }
    });
    Object.entries(wk).forEach(([g, s]) => {
      if (s > 0 && s < Math.max(4, mrv * 0.4)) {
        for (const d of days) { const e = d.exercises.find(ex => ex.group === g); if (e) { e.sets += 1; notes.push(`Группа «${ru(g)}»: низкий объём (${s} сетов) — +1 подход к «${e.name}».`); break; } }
      }
    });
    if (notes.length === 0) { setImproveModal({ notes: ['План уже сбалансирован: нет превышений MRV, слабые группы покрыты, объём в норме.'], apply: () => setImproveModal(null) }); return; }
    setImproveModal({ notes, apply: () => { setManualResult({ ...manualResult, days, corrections: [...manualResult.corrections, '🎯 Улучшение программы применено:', ...notes] }); setImproveModal(null); } });
  };
const [manualTemplates, setManualTemplates] = useState<any[]>(() => { try { return JSON.parse(localStorage.getItem('myTrainingTemplates') || '[]'); } catch { return []; } });
  const refreshManualTemplates = () => { try { setManualTemplates(JSON.parse(localStorage.getItem('myTrainingTemplates') || '[]')); } catch { setManualTemplates([]); } };
  const saveAsTemplate = () => {
    if (!manualResult) return;
    const name = window.prompt('Название шаблона:', manualResult.splitName);
    if (!name) return;
    try { const t = { name, date: new Date().toISOString().slice(0,10), cfg: manualCfg, days: manualResult.days }; const ex = JSON.parse(localStorage.getItem('myTrainingTemplates') || '[]'); ex.unshift(t); localStorage.setItem('myTrainingTemplates', JSON.stringify(ex.slice(0,30))); refreshManualTemplates(); } catch {}
  };
  const deleteTemplate = (i: number) => { try { const ex = JSON.parse(localStorage.getItem('myTrainingTemplates') || '[]'); ex.splice(i,1); localStorage.setItem('myTrainingTemplates', JSON.stringify(ex)); refreshManualTemplates(); } catch {} };
  const recalcWeightsByLevel = () => {
    if (!manualResult) return;
    const days = manualResult.days.map(d => ({ ...d, exercises: d.exercises.map(e => {
      const cat = EXERCISE_CATALOG.find(cc => cc.name === e.name);
      const g = cat?.group || e.group;
      const wm = tprofile.workMax[g] || manualWorkMax[g] || 80;
      const pct = PCT_FOR_RIR_MAN[Math.max(0, Math.min(5, e.rir))] ?? 0.9;
      return { ...e, weight: Math.round(wm * pct) };
    }) }));
    setManualResult({ ...manualResult, days, corrections: [...manualResult.corrections, `🔄 Веса пересчитаны по workMax × %1RM(RIR) для уровня «${level}».`] });
  };
  const [comparePlan, setComparePlan] = useState<any | null>(null);
  const [planCopied, setPlanCopied] = useState(false);
  const applyMethodicToPlan = () => { if (!manualResult) return; const corr: string[] = []; const name = manualCfg.intensity || manualCfg.technique || manualCfg.volume || ''; if (!name) { corr.push('Выберите методику (Интенсивность/Техника/Объём), чтобы применить к плану.'); setManualResult({ ...manualResult, corrections: [...manualResult.corrections, ...corr] }); return; } const days = manualResult.days.map(d => ({ ...d, exercises: d.exercises.map(e => { const wm = tprofile.workMax[e.group] || 80; let ne = { ...e }; if (/10×10|GVT|German Volume/i.test(name)) { ne = { ...e, sets: 10, reps: '10', weight: Math.round(wm * 0.6), rir: 3, rest: 90 }; corr.push(e.name + ': → 10×10 @60% (GVT)'); } else if (/Cluster 5×5|Кластер/i.test(name)) { ne = { ...e, sets: 5, reps: '5', weight: Math.round(wm * 0.85), rir: 1, rest: 180 }; corr.push(e.name + ': → 5×5 кластерами @85% (RIR 1)'); } else if (/Rest-Pause/i.test(name)) { ne = { ...e, sets: 1, reps: 'до отказа +3-5', weight: Math.round(wm * 0.8), rir: 0, rest: 180 }; corr.push(e.name + ': → 1 подход rest-pause @80% до отказа + мини-сеты'); } else if (/Tempo|Темп/i.test(name)) { ne = { ...e, weight: Math.round(wm * 0.7), rir: 2, rest: 60 }; corr.push(e.name + ': → темп 3-1-1-0, вес снижен до 70%, отдых 60с'); } else if (/Drop|Дроп/i.test(name)) { ne = { ...e, rir: 0, rest: 90 }; corr.push(e.name + ': → последний подход до отказа + 2 дропа −20%'); } else { corr.push(e.name + ': методика «' + name + '» применена концептуально (вес/объём без авто-изменения — отредактируйте вручную)'); } return ne; }) })); corr.unshift('Применена методика: «' + name + '» к ' + days.reduce((s, d) => s + d.exercises.length, 0) + ' упражнениям.'); setManualResult({ ...manualResult, days, corrections: [...manualResult.corrections, ...corr] }); };
  const manualToRuntime = () => { if (!manualResult) return; const days: PlayerDay[] = manualResult.days.map(d => ({ label: 'Д' + d.day, exercises: d.exercises.map(e => ({ name: e.name, muscleGroup: e.group, targetSets: Array.from({ length: e.sets }, () => ({ weight: e.weight, reps: parseInt(e.reps) || 10, rir: e.rir })) })) })); try { localStorage.setItem('he_pl_runtime', JSON.stringify({ days, focus: manualResult.splitName, week: 1, track: 'manual' })); } catch {} setTab('runtime'); };
  const exportFullReport = () => { const la = labTrainingAdjust(linked.labAnalysis); const wk: Record<string, number> = {}; const GRP_RU: Record<string,string> = { chest:'Грудь', back:'Спина', legs:'Ноги', shoulders:'Плечи', arms:'Руки', core:'Кор', full:'Общее' }; if (manualResult) manualResult.days.forEach(d => d.exercises.forEach(e => { wk[e.group] = (wk[e.group] || 0) + e.sets; })); const mrv = ((LEVEL_VOLUMES as Record<string, { mrv: number }>)[level]?.mrv ?? 20) * (tprofile.onCourse ? 1.2 : 1) * la.mrvMultiplier; const total = Object.values(wk).reduce((a,b)=>a+b,0); const rh = loadReadinessHistory().slice(-7); const ms = loadMeasurements().slice(-3); const esc = (s: string) => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;'); const planHtml = manualResult ? manualResult.days.map(d => '<h3>День '+d.day+' ('+esc(d.groups.join(', '))+')</h3><table border=1 cellpadding=4 style=border-collapse:collapse;width:100%><tr><th>Упражнение</th><th>Сеты×повт</th><th>RIR</th><th>Вес</th><th>Отдых</th></tr>'+d.exercises.map(e => '<tr><td>'+esc(e.name)+'</td><td>'+e.sets+'×'+esc(e.reps)+'</td><td>'+e.rir+'</td><td>'+e.weight+' кг</td><td>'+e.rest+'с</td></tr>').join('')+'</table>').join('') : '<p>План не построен.</p>'; const corrHtml = manualResult?.corrections?.length ? '<h2>Журнал правок</h2><ul>'+manualResult.corrections.map(c => '<li>'+esc(c)+'</li>').join('')+'</ul>' : ''; const volRows = Object.keys(wk).length ? Object.entries(wk).map(([g,s]) => '<tr><td>'+esc(GRP_RU[g]||g)+'</td><td>'+s+'</td><td>'+(s>mrv?'⚠ >MRV':'ок')+'</td></tr>').join('') : '<tr><td colspan=3>нет данных</td></tr>'; const labHtml = la.warnings.length ? '<h2>Лабораторная коррекция (MRV ×'+la.mrvMultiplier.toFixed(2)+')</h2><ul>'+la.warnings.map(w=>'<li>'+esc(w)+'</li>').join('')+'</ul>' : '<h2>Лабораторная коррекция</h2><p>нет данных / в норме.</p>'; const rhHtml = rh.length ? '<h2>Готовность (последние '+rh.length+' дн)</h2><table border=1 cellpadding=4 style=border-collapse:collapse><tr><th>Дата</th><th>Готовность</th><th>Усталость</th></tr>'+rh.map(p=>'<tr><td>'+p.date+'</td><td>'+p.recovery+'%</td><td>'+p.fatigue+'%</td></tr>').join('')+'</table>' : ''; const msHtml = ms.length ? '<h2>Замеры (последние '+ms.length+')</h2><table border=1 cellpadding=4 style=border-collapse:collapse><tr><th>Дата</th><th>Вес</th><th>Талия</th><th>Грудь</th></tr>'+ms.map((m:any)=>'<tr><td>'+m.date+'</td><td>'+m.weightKg+'кг</td><td>'+m.waistCm+'см</td><td>'+m.chestCm+'см</td></tr>').join('')+'</table>' : ''; const html = '<html><head><meta charset=utf-8><title>Отчёт тренировочного блока</title><style>body{font-family:Arial,sans-serif;padding:20px;color:#111}h1{color:#008}h2{color:#060;margin-top:16px;border-bottom:1px solid #ccc;padding-bottom:2px}h3{margin-top:12px;color:#333}table{font-size:11px}</style></head><body><h1>Отчёт тренировочного блока</h1><h2>Профиль тренированности</h2><p>Цель: '+esc(tprofile.goal)+' · Уровень: '+esc(tprofile.level)+' · Дней/нед: '+tprofile.daysPerWeek+' · Вес: '+tprofile.bodyWeight+'кг<br>ПМ: присед '+tprofile.pmSquat+', жим '+tprofile.pmBench+', тяга '+tprofile.pmDead+' кг<br>Курс: '+(tprofile.onCourse?'да ('+tprofile.courseIntensity+')':'натурал')+' · Слабые группы: '+esc(tprofile.weakPoints.join(', ')||'—')+' · Оборудование: '+esc(tprofile.equipment.join(', ')||'—')+'</p>'+(manualResult?'<h2>План: '+esc(manualResult.splitName)+'</h2>':'') + planHtml + '<h2>Объём по группам (всего '+total+' сетов, MRV '+Math.round(mrv)+')</h2><table border=1 cellpadding=4 style=border-collapse:collapse><tr><th>Группа</th><th>Сетов</th><th>Статус</th></tr>'+volRows+'</table>' + corrHtml + labHtml + rhHtml + msHtml + '<p style=margin-top:20px;color:#888;font-size:10px>Сгенерировано: '+new Date().toLocaleString()+'</p></body></html>'; const w = window.open('', '_blank'); if (w) { w.document.write(html); w.document.close(); w.focus(); setTimeout(() => w.print(), 350); } };
  const printManualPlan = () => { if (!manualResult) return; const rows = manualResult.days.map(d => '<h3>День ' + d.day + ' (' + d.groups.join(', ') + ')</h3><table border=1 cellpadding=4 style=border-collapse:collapse;width:100%><tr><th>Упражнение</th><th>Сеты×повт</th><th>RIR</th><th>Вес</th><th>Отдых</th></tr>' + d.exercises.map(e => '<tr><td>' + e.name + '</td><td>' + e.sets + '×' + e.reps + '</td><td>' + e.rir + '</td><td>' + e.weight + ' кг</td><td>' + e.rest + 'с</td></tr>').join('') + '</table>').join(''); const html = '<html><head><meta charset=utf-8><title>' + manualResult.splitName + '</title><style>body{font-family:Arial,sans-serif;padding:20px;color:#111}h1{color:#008}h3{margin-top:14px;color:#060}table{font-size:12px}</style></head><body><h1>' + manualResult.splitName + '</h1><p>Уровень: ' + level + ' · Цель: ' + goal + ' · ' + daysPerWeek + ' дн/нед · ' + mesoLength + ' нед</p>' + rows + '</body></html>'; const w = window.open('', '_blank'); if (w) { w.document.write(html); w.document.close(); w.focus(); setTimeout(() => w.print(), 300); } };
  const exportManualPlanText = () => { if (!manualResult) return; const lines: string[] = []; lines.push('Тренировочный план: ' + manualResult.splitName); lines.push('Параметры: ' + Object.entries(manualCfg).filter(([,v]) => v).map(([k,v]) => k + '=' + v).join(', ')); lines.push('Уровень: ' + level + ' · Цель: ' + goal + ' · Дней/нед: ' + daysPerWeek + ' · Длина: ' + mesoLength + ' нед'); lines.push(''); if (manualResult.corrections && manualResult.corrections.length) { lines.push('Комментарии к плану:'); manualResult.corrections.forEach(corr => lines.push('  • ' + corr)); lines.push(''); } manualResult.days.forEach(d => { lines.push('День ' + d.day + ' (' + d.groups.join(', ') + ')'); d.exercises.forEach(e => lines.push('  ' + e.name + ' — ' + e.sets + 'x' + e.reps + ' @ RIR' + e.rir + ' · ' + e.weight + ' кг · отдых ' + e.rest + 'с (' + e.group + ')')); lines.push(''); }); const txt = lines.join(String.fromCharCode(10)); try { navigator.clipboard?.writeText(txt); } catch {} setPlanCopied(true); setTimeout(() => setPlanCopied(false), 1800); };
  const detectGroup = (name: string): string => { const n = name.toLowerCase(); if (/squat|присед|leg|quad|ножн|выпад|lunge/.test(n)) return 'legs'; if (/bench|жим|chest|груд|press|плеч|shoulder|delt/.test(n)) return n.includes('shoulder')||/delt|плеч/.test(n) ? 'shoulders' : 'chest'; if (/deadlift|станов|тяга|row|pull|спин|back|chin|lat/.test(n)) return 'back'; if (/curl|бицеп|bicep/.test(n)) return 'arms'; if (/tricep|трицеп|extension|пресс|ab|core/.test(n)) return /пресс|ab|core/.test(n) ? 'core' : 'arms'; return 'full'; };
  const loadProgramToConstructor = (programId: string) => { const lib: FullProgram[] = [...FULL_PROGRAM_LIBRARY, ...WOMENS_PROGRAMS, ...CUSTOM_PROGRAMS]; const prog = lib.find(p => p.id === programId); if (!prog || !prog.weeks?.length) return; const wk = prog.weeks[0]; const days = wk.days.map((d: ProgramDay, di: number) => ({ day: di + 1, groups: Array.from(new Set((d.exercises || []).map((e: ProgramDay['exercises'][number]) => detectGroup(e.name)))), exercises: (d.exercises || []).map((e: ProgramDay['exercises'][number]) => { const g = detectGroup(e.name); const rir = e.rir ?? (e.rpe ? Math.max(0, 10 - e.rpe) : 2); const pct = PCT_FOR_RIR_MAN[Math.max(0, Math.min(5, rir))] ?? 0.9; const reps = parseInt(e.reps) || (parseInt(String(e.reps).replace(/[^0-9]/g,'')) || 8); const weight = Math.round((tprofile.workMax[g] || 80) * pct); return { name: e.name, sets: e.sets, reps: String(e.reps), rir, rest: e.restSec || 120, group: g, weight }; }) })); const corrections: string[] = []; corrections.push('Загружена готовая программа «' + prog.name + '» (' + (prog.author || '') + ', ' + prog.goal + ', ' + prog.level + ') — неделя 1, ' + days.length + ' дн.'); corrections.push('Программа доступна для редактирования, применения методик и выполнения. Веса рассчитаны из workMax×%1RM(RIR); отредактируйте при необходимости.'); if (prog.warnings?.length) corrections.push('Предупреждения программы: ' + prog.warnings.join('; ')); setManualResult({ splitName: prog.name + ' (неделя 1)', corrections, days }); };
  const GRP_RU_M: Record<string, string> = { chest: 'Грудь', back: 'Спина', legs: 'Ноги', shoulders: 'Плечи', arms: 'Руки', core: 'Кор', full: 'Общее' };
  const SET_TEMPLATES: Record<string, { sets: number; reps: string; rir: number; rest: number }> = {
    '5×5': { sets: 5, reps: '5', rir: 1, rest: 180 }, '3×8': { sets: 3, reps: '8', rir: 2, rest: 90 },
    '4×10': { sets: 4, reps: '10', rir: 2, rest: 90 }, '3×12': { sets: 3, reps: '12', rir: 2, rest: 75 },
    'AMRAP': { sets: 1, reps: 'AMRAP', rir: 0, rest: 180 }, 'Myo-rep': { sets: 1, reps: '15 + 5×3', rir: 0, rest: 120 },
    '10×10 GVT': { sets: 10, reps: '10', rir: 3, rest: 60 }, '5/3/1': { sets: 3, reps: '5/3/1+', rir: 1, rest: 180 },
  };
  const startInline = (di: number, ei: number, field: string, val: string | number) => { setInlineEdit({ dayIdx: di, exIdx: ei, field, value: String(val) }); setTimeout(() => inlineRef.current?.focus(), 10); };
  const commitInline = () => {
    if (!inlineEdit || !manualResult) { setInlineEdit(null); return; }
    const { dayIdx, exIdx, field, value } = inlineEdit;
    const old = manualResult.days[dayIdx]?.exercises[exIdx];
    if (!old) { setInlineEdit(null); return; }
    const days = manualResult.days.map((d, di) => di === dayIdx ? { ...d, exercises: d.exercises.map((ex, ei) => {
      if (ei !== exIdx) return ex; const ne = { ...ex };
      if (field === 'sets') ne.sets = parseInt(value) || ex.sets;
      else if (field === 'reps') ne.reps = value;
      else if (field === 'rir') { const v = parseInt(value); if (!isNaN(v)) ne.rir = v; }
      else if (field === 'weight') { const v = parseInt(value); if (!isNaN(v)) ne.weight = v; }
      else if (field === 'rest') { const v = parseInt(value); if (!isNaN(v)) ne.rest = v; }
      return ne;
    }) } : d);
    setManualResult({ ...manualResult, days, corrections: [...manualResult.corrections, `✏️ ${old.name}: ${field}=${value}`] });
    setInlineEdit(null);
  };
  const dragStart = (e: React.DragEvent, di: number, ei: number) => { setDragFrom({ dayIdx: di, exIdx: ei }); e.dataTransfer.effectAllowed = 'move'; };
  const dragOver = (e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; };
  const dropEx = (e: React.DragEvent, tDay: number, tEx: number) => {
    e.preventDefault(); if (!dragFrom || !manualResult) return;
    const { dayIdx: fDay, exIdx: fEx } = dragFrom;
    if (fDay === tDay && fEx === tEx) { setDragFrom(null); return; }
    const days = manualResult.days.map(d => ({ ...d, exercises: [...d.exercises.map(ee => ({ ...ee }))] }));
    const moved = days[fDay].exercises.splice(fEx, 1)[0];
    if (!moved) { setDragFrom(null); return; }
    const insertAt = fDay === tDay && tEx > fEx ? tEx - 1 : tEx;
    days[tDay].exercises.splice(insertAt, 0, moved);
    const msg = fDay === tDay ? `↕️ «${moved.name}» перемещён в Дне ${days[fDay].day}.` : `↕️ «${moved.name}» из Дня ${days[fDay].day} → День ${days[tDay].day}.`;
    setManualResult({ ...manualResult, days, corrections: [...manualResult.corrections, msg] });
    setDragFrom(null);
  };
  const copyDay = (di: number) => {
    if (!manualResult) return;
    const src = manualResult.days[di];
    const newNum = Math.max(...manualResult.days.map(d => d.day)) + 1;
    const days = [...manualResult.days, { ...src, day: newNum, exercises: src.exercises.map(e => ({ ...e })) }];
    setManualResult({ ...manualResult, days, corrections: [...manualResult.corrections, `📋 День ${src.day} скопирован → День ${newNum}.`] });
  };
  const massEditWeight = (pct: number) => {
    if (!manualResult) return;
    const sgn = pct > 0 ? '+' : '';
    const days = manualResult.days.map(d => ({ ...d, exercises: d.exercises.map(e => ({ ...e, weight: Math.round(e.weight * (1 + pct / 100)) })) }));
    setManualResult({ ...manualResult, days, corrections: [...manualResult.corrections, `⚡ Масс-правка: все веса ${sgn}${pct}%.`] });
  };
  const massEditVolume = (pct: number) => {
    if (!manualResult) return;
    const sgn = pct > 0 ? '+' : '';
    const days = manualResult.days.map(d => ({ ...d, exercises: d.exercises.map(e => ({ ...e, sets: Math.max(1, Math.round(e.sets * (1 + pct / 100))) })) }));
    setManualResult({ ...manualResult, days, corrections: [...manualResult.corrections, `⚡ Масс-правка: объём ${sgn}${pct}%.`] });
  };
  const applySetTemplate = (di: number, ei: number, key: string) => {
    if (!manualResult) return;
    const t = SET_TEMPLATES[key]; if (!t) return;
    const e = manualResult.days[di].exercises[ei];
    const pct = PCT_FOR_RIR_MAN[Math.max(0, Math.min(5, t.rir))] ?? 0.9;
    const wm = tprofile.workMax[e.group] || manualWorkMax[e.group] || 80;
    const days = manualResult.days.map((d, di2) => di2 === di ? { ...d, exercises: d.exercises.map((ex, ei2) => ei2 === ei ? { ...ex, sets: t.sets, reps: t.reps, rir: t.rir, rest: t.rest, weight: Math.round(wm * pct) } : ex) } : d);
    setManualResult({ ...manualResult, days, corrections: [...manualResult.corrections, `⚡ Шаблон «${key}» → «${e.name}»: ${t.sets}×${t.reps}, RIR ${t.rir}.`] });
  };
  const buildPlan = usePlanGeneration({ goal, level, mesoLength, weakPoints, equipment: tprofile.equipment, workMax: tprofile.workMax, manualWorkMax, injuries: tprofile.injuries || [], pctForRir: PCT_FOR_RIR_MAN });
  const generateManualPlan = () => {
    const corrections: string[] = [];
    const inp = { goal, level, daysPerWeek, recovery, fatigue, nutrition: 7, weakPoints, sessionDuration: 60, exercises: [] } as TrainingInput;
    const auto = selectSplit(inp);
    const manualSp = manualCfg.split ? TRAINING_SPLITS[manualCfg.split] : null;
    const sp = manualSp ? { id: manualCfg.split!, name: manualSp.name, desc: manualSp.desc, groupsPerDay: manualSp.groupsPerDay, score: 100, rationale: ['Ручной выбор'] } as SplitCandidate : auto[0];
    if (!sp) { setManualResult(null); return; }
    if (manualSp) corrections.push(`Сплит выбран вручную: «${sp.name}» (вместо авто-подбора).`); else corrections.push(`Сплит подобран автоматически: «${sp.name}».`);
    const cycle: string[][] = []; let gi = 0; while (cycle.length < daysPerWeek) { cycle.push(sp.groupsPerDay[gi % sp.groupsPerDay.length]); gi++; }
    const _labAdj = labTrainingAdjust(linked.labAnalysis);
    const courseMult = tprofile.onCourse ? (tprofile.courseIntensity === 'heavy' ? 1.3 : tprofile.courseIntensity === 'mild' ? 1.15 : 1.2) : 1;
    const baseMrv = (LEVEL_VOLUMES as Record<string, { mrv: number }>)[level]?.mrv ?? 20;
    let mrv = baseMrv * courseMult * _labAdj.mrvMultiplier;
    try { const _rh = loadReadinessHistory(); if (_rh.length) { const _last = _rh[_rh.length - 1]; if ((_last?.recovery ?? 100) < 60) { mrv = mrv * 0.85; corrections.push(`🩺 Готовность прошлой недели ${Math.round(_last.recovery)}% (<60) — объём снижен на 15% (авторегуляция, анти-перетрен).`); } } } catch { /* ignore */ }
    if (tprofile.onCourse) corrections.push(`MRV повышен на курсе: база ${baseMrv} × ${courseMult} (интенсивность курса) = ${Math.round(baseMrv * courseMult)}.`);
    if (_labAdj.mrvMultiplier < 1) corrections.push(`MRV снижен по лаборатории ×${_labAdj.mrvMultiplier.toFixed(2)}: ${_labAdj.warnings.join(' ')}`);
    corrections.push(`Допустимый объём (MRV): ${Math.round(mrv)} сетов/нед на группу.`);
    if (weakPoints.length > 0) corrections.push(`Слабые группы (${weakPoints.join(', ')}): приоритет в отборе + RIR ↓ (ближе к отказу) для акцента.`);
    if (tprofile.equipment.length > 0) corrections.push(`Фильтр оборудования: только ${tprofile.equipment.join(', ')}.`);
    const built = buildPlan(cycle, mrv);
    const days = built.days;
    const weeklySets = built.weeklySets;
    corrections.push(...built.groupCorrections);
    
    Object.entries(weeklySets).forEach(([g, s]) => { if (s < Math.max(4, mrv * 0.4) && s > 0) corrections.push(`Группа «${g}»: низкий объём (${s} сетов) — ниже зоны адаптации, рассмотрите добор.`); });
    weakPoints.forEach(w => { if (!weeklySets[w] || weeklySets[w] === 0) corrections.push(`⚠ Слабая группа «${w}» не включена в сплит — добавьте специализированное упражнение для акцента.`); });
    setManualResult({ splitName: sp.name, corrections, days });
  };
  const [builderSplit, setBuilderSplit] = useState<SplitCandidate | null>(null);
  const [builderDayExercises, setBuilderDayExercises] = useState<Record<number, { name: string; sets: number; reps: string; rir: number; rest: number; group: string; type?: string; rpeHint?: string; dropSet?: boolean; backoffSet?: boolean; substitutes?: string[] }[]>>({});
  const [builderMacroResult, setBuilderMacroResult] = useState<any[] | null>(null);
  const [builderShowSubs, setBuilderShowSubs] = useState<string | null>(null);
  const [builderAddExDay, setBuilderAddExDay] = useState<number | null>(null);
  const [generatorSeed, setGeneratorSeed] = useState(Date.now());
  const [builderMesoLength, setBuilderMesoLength] = useState(8);
  const [builderSavedMsg, setBuilderSavedMsg] = useState('');

  // Diary state
  const [diaryStats, setDiaryStats] = useState<StrengthStats[]>([]);
  const [diaryProgress, setDiaryProgress] = useState<WeeklyProgress[]>([]);
  const [logExercise, setLogExercise] = useState('');
  const [logWeight, setLogWeight] = useState(80);
  const [logReps, setLogReps] = useState(8);
  const [logRIR, setLogRIR] = useState(2);
  const [historyWorkouts, setHistoryWorkouts] = useState<WorkoutLog[]>([]);
  const [historyExpanded, setHistoryExpanded] = useState<string | null>(null);

  // Runtime (live workout) state
  const [runtimeDay, setRuntimeDay] = useState<number>(() => { try { const v = JSON.parse(localStorage.getItem('he_runtime_day') || '1'); return typeof v === 'number' ? v : 1; } catch { return 1; } });
  useEffect(() => { try { localStorage.setItem('he_runtime_day', JSON.stringify(runtimeDay)); } catch { /* ignore */ } }, [runtimeDay]);
  const [runtimeExIdx, setRuntimeExIdx] = useState(0);
  const [runtimeLogs, setRuntimeLogs] = useState<Record<string, { sets: { weight: number; reps: number; rpe: number; rir: number }[]; completed: boolean }>>({});
  const [runtimeStarted, setRuntimeStarted] = useState(false);
  const [plRuntime, setPlRuntime] = useState<{ days: PlayerDay[]; focus: string; week: number; track: string } | null>(() => { try { const v = localStorage.getItem('he_pl_runtime'); return v ? JSON.parse(v) : null; } catch { return null; } });
  const [plRunOpen, setPlRunOpen] = useState(false);
  useEffect(() => { if (tab === 'runtime') { try { const v = localStorage.getItem('he_pl_runtime'); setPlRuntime(v ? JSON.parse(v) : null); } catch { /* ignore */ } } }, [tab]);
  useEffect(() => { if (linked.readiness) appendReadinessToday(linked.readiness.recovery ?? 70, linked.readiness.fatigue ?? 30); }, [linked.readiness]);
  const [showWarmup, setShowWarmup] = useState(false);
  const [showCooldown, setShowCooldown] = useState(false);
  const [runtimeSetW, setRuntimeSetW] = useState(80);
  const [runtimeSetR, setRuntimeSetR] = useState(8);
  const [runtimeSetRP, setRuntimeSetRP] = useState(7);
  const [runtimeSetRI, setRuntimeSetRI] = useState(2);

  const generatePlan = useCallback((overrideSplitType?: string) => {
    try {
    // U6: детерминированная генерация — без Math.random-jitter (циклы воспроизводимы при тех же параметрах).
    // recovery/fatigue берём как есть; nutrition — стабильное значение (8/10, питание учитывается отдельно).
    const input: TrainingInput = {
      goal, level, daysPerWeek, recovery: Math.max(0, Math.min(100, recovery)), fatigue: Math.max(0, Math.min(100, fatigue)), nutrition: 8,
      weakPoints, sessionDuration: 60, exercises: [],
      splitType: overrideSplitType || splitType,
      periodizationType,
      cycleType,
    };
    const output = calcTraining(input);
    setTrainingOutput(output);

    const macroInput: MacrocycleInput = {
      goal: goal as MacrocycleInput['goal'],
      level: level as MacrocycleInput['level'],
      daysPerWeek,
      readinessScore: recovery / 10,
      isOnCourse: level === 'enhanced',
      weakPoints,
      injuries: [],
      experience: level as MacrocycleInput['experience'],
      currentWeek: 1,
      periodizationType,
      cycleType,
    };
    const macro = periodizationType === 'block' ? generateBlockPlan(macroInput) : generateMacrocycle(macroInput);
    setMacrocycle(macro);
    setSelectedWeek(1);
    setCurrentMicrocycle(getCurrentWeekPlan(macro, 1));
    setCyclesError(null);
    } catch (e) { setCyclesError('Ошибка генерации: ' + String(e)); }
  }, [goal, level, daysPerWeek, recovery, fatigue, weakPoints, splitType, periodizationType, cycleType]);
  // Мост макроцикл -> выполнение (единый поток через SessionPlayer)
  const applyMacroToRuntime = () => {
    if (!currentMicrocycle) return;
    const days: PlayerDay[] = currentMicrocycle.days.filter((d: any) => d.isTraining).map((d: any, i: number) => ({
      label: 'Д' + (i + 1),
      exercises: (d.exercises || []).map((e: any) => ({
        name: e.name,
        muscleGroup: e.group,
        targetSets: Array.from({ length: e.sets || 3 }, () => ({ weight: Math.round((e.weight || tprofile.workMax[e.group] || 80) * 0.8), reps: parseInt(e.reps) || 10, rir: e.rir ?? 2 })),
      })),
    }));
    try { localStorage.setItem('he_pl_runtime', JSON.stringify({ days, focus: 'Макроцикл ' + (currentMicrocycle.mesocycleType || ''), week: selectedWeek, track: 'macro' })); } catch {}
    setTab('runtime');
  };

  // Auto-regenerate when days/sparse
  const loadDiaryStats = async () => {
    try {
      const progress = await diary.getWeeklyProgress();
      setDiaryProgress(progress);
      const compoundIds = EXERCISE_CATALOG.filter(e => e.type === 'compound').slice(0, 10).map(e => e.id);
      const stats: StrengthStats[] = [];
      for (const id of compoundIds) { const s = await diary.getExerciseStats(id); if (s) stats.push(s); }
      setDiaryStats(stats);
      const wLogs = await diary.getWorkoutLogs();
      setHistoryWorkouts(wLogs.reverse());
    } catch {}
  };

  // Применение композиции методик к плану (одна из каждой категории)
  const applyMethodComposition = () => {
    const pm = appliedMethods['periodization'];
    if (pm) {
      const n = pm.toLowerCase();
      const pt = n.includes('linear') ? 'linear' : n.includes('undulating')||n.includes('dup') ? 'undulating' : n.includes('block') ? 'block' : n.includes('conjugate')||n.includes('westside') ? 'conjugate' : null;
      if (pt) setPeriodizationType(pt);
    }
    setTimeout(() => generatePlan(), 120);
  };
  useEffect(() => {
    if (Object.keys(appliedMethods).length > 0) { const tm = setTimeout(() => generatePlan(), 150); return () => clearTimeout(tm); }
  }, [appliedMethods]);

  const prevDays = useRef(daysPerWeek);
  useEffect(() => { loadDiaryStats(); }, []);
  useEffect(() => { if (prevDays.current !== daysPerWeek) { prevDays.current = daysPerWeek; generatePlan(); } }, [daysPerWeek]);
  useEffect(() => { localStorage.setItem('myTrainingExercises', JSON.stringify(customExercises)); }, [customExercises]);

  // Sync tab/planningTrack with 'storage' events (cross-tab + child-tab navigation via localStorage)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'he_training_planning_track') {
        const val = localStorage.getItem('he_training_planning_track');
        const parsed = val === 'manual' || val === 'bb' ? val : 'pl';
        setPlanningTrack(parsed);
        setPlanningTrackState(parsed);
      }
      if (e.key === 'he_training_tab') {
        const val = localStorage.getItem('he_training_tab');
        const validTabs: TrainingTab[] = ['plan', 'cycles', 'programs', 'mytraining', 'programcalc', 'volume', 'library', 'analytics', 'visual', 'progress', 'excalc', 'methods', 'timers', 'history', 'reports', 'srcbb'];
        if (val && validTabs.includes(val as TrainingTab)) {
          setTab(val as TrainingTab);
        }
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Держим активную вкладку валидной для текущей группы/трассы (иначе — пустой экран)
  useEffect(() => {
    if (!mainGroup) return;
    const visible = mainGroup === 'planning' ? planningTabsFor(planningTrack) : TAB_GROUPS[mainGroup].tabs;
    if (!visible.includes(tab)) setTab(visible[0]);
  }, [mainGroup, planningTrack]);

  useEffect(() => {
    if (macrocycle && selectedWeek > 0) {
      setCurrentMicrocycle(getCurrentWeekPlan(macrocycle, selectedWeek));
    }
  }, [macrocycle, selectedWeek]);

  const filteredExercises = useMemo(() => {
    let list = EXERCISE_CATALOG;
    if (exSearch) {
      const q = exSearch.toLowerCase();
      list = list.filter(e => (e.name||'').toLowerCase().includes(q) || (e.id||'').toLowerCase().includes(q) || (e.targetMuscle || '').toLowerCase().includes(q));
    }
    if (exGroup !== 'all') list = list.filter(e => e.group === exGroup);
    if (exType !== 'all') list = list.filter(e => e.type === exType);
    if (exEquipment !== 'all') list = list.filter(e => e.equipment === exEquipment);
    if (exDifficulty !== 'all') list = list.filter(e => e.difficulty === exDifficulty);
    return list;
  }, [exSearch, exGroup, exType, exEquipment, exDifficulty]);
  useEffect(() => { setExVisible(80); }, [exSearch, exGroup, exType, exEquipment, exDifficulty]);

  const calcResults = useMemo(() => {
    const epley1RM = calcWeight * (1 + calcReps / 30);
    const brzycki1RM = calcWeight * (36 / (37 - calcReps));
    const rpePercent = Math.max(0.3, 1 - (calcRPE - 1) * 0.03 - (calcReps - 1) * 0.025);
    const rpe1RM = calcWeight / rpePercent;
    const percentWeight = calc1RM * (calcPercent / 100);
    return { epley1RM, brzycki1RM, rpe1RM, percentWeight, rpePercent };
  }, [calcWeight, calcReps, calcRPE, calc1RM, calcPercent]);

  const handleLogWorkout = async () => {
    if (!logExercise) return;
    const ex = EXERCISE_CATALOG.find(e => e.id === logExercise);
    await diary.saveStrengthLog({
      id: `log_${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      exerciseId: logExercise,
      exerciseName: ex?.name || logExercise,
      sets: [{ weight: logWeight, reps: logReps, rir: logRIR }],
      totalVolume: logWeight * logReps,
      estimated1RM: logWeight * (1 + logReps / 30),
      isCompound: ex?.type === 'compound',
      weekNumber: selectedWeek,
    });
    // Reload stats
    const compoundIds = EXERCISE_CATALOG.filter(e => e.type === 'compound').slice(0, 10).map(e => e.id);
    const stats: StrengthStats[] = [];
    for (const id of compoundIds) {
      const s = await diary.getExerciseStats(id);
      if (s) stats.push(s);
    }
    setDiaryStats(stats);
    // Also save workout log and reload history
    await diary.saveWorkoutLog({
      id: `workout_${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      duration: 60,
      exercises: [{
        id: `log_${Date.now()}`,
        date: new Date().toISOString().split('T')[0],
        exerciseId: logExercise,
        exerciseName: ex?.name || logExercise,
        sets: [{ weight: logWeight, reps: logReps, rir: logRIR }],
        totalVolume: logWeight * logReps,
        estimated1RM: Math.round(logWeight * (1 + logReps / 30)),
        isCompound: ex?.type === 'compound',
        weekNumber: selectedWeek,
      }],
      overallRPE: 7,
      recoveryBefore: recovery,
      split: trainingOutput?.splitName || 'custom',
      weekNumber: selectedWeek,
    });
    const wLogs = await diary.getWorkoutLogs();
    setHistoryWorkouts(wLogs.reverse());
    setLogExercise('');
    setLogWeight(80);
    setLogReps(8);
    setLogRIR(2);
  };

  const getRIRstr = (g: string, l: string, deload: boolean): string => {
    if (deload) return '3-5';
    try {
      const rir = RIR_MATRIX[g]?.[l]?.base ?? 2;
      return `${rir}-${rir + 2}`;
    } catch { return '2-3'; }
  };

  const formatSplitGroups = (output: TrainingOutput) => {
    if (!output.volumePerGroup) return '';
    return Object.entries(output.volumePerGroup)
      .filter(([_, v]) => v > 0)
      .map(([g, v]) => `${GROUP_LABELS[g] || g}: ${v} подх`)
      .join(' • ');
  };

  const calcBMI = () => {
    const hm = bmiHeight / 100;
    setBmiResult(bmiWeight / (hm * hm));
  };

  const calcBMR = () => {
    if (bmrSex === 'male')
      setBmrResult(10 * bmrWeight + 6.25 * bmrHeight - 5 * bmrAge + 5);
    else setBmrResult(10 * bmrWeight + 6.25 * bmrHeight - 5 * bmrAge - 161);
  };

  const calcBMR_KM = () => {
    const lbm = bmrKmWeight * (100 - bmrKmBodyFat) / 100;
    setBmrKmResult(370 + 21.6 * lbm);
  };

  const calcTDEE = () => setTdeeResult(tdeeBmr * tdeePal);

  const calcGrip = () => {
    let ref: number;
    if (gripSex === 'male') ref = 50 - (gripAge - 30) * 0.3;
    else ref = 30 - (gripAge - 30) * 0.2;
    const pct = Math.min(100, Math.max(0, (gripKg / ref) * 100));
    setGripResult({ percentile: Math.round(pct), level: pct >= 80 ? 'Отлично' : pct >= 60 ? 'Хорошо' : pct >= 40 ? 'Средне' : 'Низкий' });
  };

  const calcStress = () => {
    const stress = Math.max(0, Math.min(100, 100 - (hrvValue - 20) * 2));
    setStressResult({ stress: Math.round(stress), level: stress >= 70 ? 'Высокий' : stress >= 30 ? 'Средний' : 'Низкий' });
  };

  const PAL_OPTIONS = [
    { value: 1.2, label: 'Сидячий (1.2)' },
    { value: 1.375, label: 'Легкий (1.375)' },
    { value: 1.55, label: 'Умеренный (1.55)' },
    { value: 1.725, label: 'Высокий (1.725)' },
    { value: 1.9, label: 'Экстремальный (1.9)' },
  ];

  const bmiCategory = (v: number) => v < 18.5 ? 'Недостаток веса' : v < 25 ? 'Норма' : v < 30 ? 'Избыток' : 'Ожирение';

  const showNonBuilder = tab !== 'programcalc';

  return (
    <div className="screen training-screen" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'auto', padding: 0 }}>

      {/* ─── HERO PAGE ─── */}
      {page === 'hero' && (
        <div style={{ position:'fixed', inset:0, zIndex:100, display:'flex', flexDirection:'column' }}>
          <img src="/training-hero.jpg" alt="" style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover', objectPosition:'center top' }} />
          <div style={{ position:'absolute', inset:0, background:'linear-gradient(transparent 50%, rgba(0,0,0,0.85))' }} />
          <div style={{ position:'relative', zIndex:2, flex:1, display:'flex', flexDirection:'column', justifyContent:'flex-end', padding:'16px 16px 80px' }}>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: '#fff', margin: '0 0 2px', textShadow: '0 2px 14px rgba(0,0,0,0.9)' }}>Тренировки</h1>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.9)', margin: '0 0 16px', lineHeight: 1.3, textShadow: '0 1px 8px rgba(0,0,0,0.8)' }}>
              План, дневник, упражнения, калькуляторы и аналитика
            </p>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {(Object.entries(TAB_GROUPS_EFF) as [TrainingGroup & string, typeof TAB_GROUPS_EFF[string]][]).map(([key, group]) => (
                <button key={key} onClick={() => { setPage('tabs'); setMainGroup(key as TrainingGroup); setTab(key === 'planning' ? planningTabsFor(planningTrack)[0] : group.tabs[0]); }} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 14, cursor: 'pointer', textAlign: 'left', width: '100%',
                  background: 'rgba(20,22,30,0.35)', border: '1px solid var(--glass-border)', color: 'var(--text)',
                  transition: 'all 0.2s',
                }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    background: group.color + '18', fontSize: 20,
                  }}>
                    {group.icon}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2, color: group.color }}>{group.title}</div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.85)', lineHeight: 1.3 }}>
                      {key === 'training' ? 'Проведение тренировки, таймеры отдыха, учёт подходов' : key === 'planning' ? (planningTrack === 'manual' ? 'Ручной сбор: план, циклы, программы, методики, калькулятор' : planningTrack === 'bb' ? 'Бодибилдинг: авто-подбор сплита, объём/тяж-памп, PED, метрики' : 'ПЛ (сила): авто-подбор циклов СРЦ, PM-прогрессия, блины, пик, метрики') : 'Аналитика, графики, прогресс, дневник, калькуляторы, история'}
                    </div>
                  </div>
                  <span style={{ color: group.color, fontSize: 16, opacity: 0.6 }}>→</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB VIEW (when not on hero) ─── */}
      {page !== 'hero' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', flexShrink: 0, borderBottom: '1px solid var(--border)' }}>
          <button onClick={() => { setPage('hero'); setMainGroup(null); }} style={{
            padding: '6px 8px', cursor: 'pointer', fontSize: 14,
            color: 'var(--text-dim)', border: 'none', background: 'transparent',
            display: 'flex', alignItems: 'center', gap: 4,
            fontWeight: 600, transition: 'all 0.2s',
          }}>← На главную</button>
          {mainGroup && (
            <button onClick={() => { setPage('hero'); setMainGroup(null); }} style={{
              padding: '6px 8px', cursor: 'pointer', fontSize: 12,
              color: 'var(--accent)', border: 'none', background: 'transparent',
              display: 'flex', alignItems: 'center', gap: 4,
              fontWeight: 600, transition: 'all 0.2s',
            }}>← Назад</button>
          )}
        </div>
      )}

      {page !== 'hero' && (
      <div style={{ padding: '0 4px' }}>
      {mainGroup && (
        <h2 style={{ margin: '0 0 8px', fontSize: 16, color: TAB_GROUPS_EFF[mainGroup].color }}>{TAB_GROUPS_EFF[mainGroup].title}</h2>
      )}

      <div style={{ display: 'flex', gap: 3, marginBottom: 10, flexWrap: 'wrap' }}>
        {(mainGroup ? TAB_GROUPS_EFF[mainGroup].tabs : Object.keys(TAB_LABELS) as TrainingTab[]).map(k => (
          <button key={k} onClick={() => { hapticImpact('light'); setTab(k); }} style={{
            padding: '7px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap',
            background: tab === k ? 'var(--accent)' : 'var(--bg-secondary)',
            color: tab === k ? '#000' : 'var(--text-dim)', border: 'none', cursor: 'pointer',
            transition: 'all 0.2s',
          }}>{TAB_LABELS[k]}</button>
        ))}
      </div>

      {/* Этап R: переключатель режима планирования — только в группе «Планирование».
           Разделяет авто-подбор (СРЦ/BB, единственный источник программ) и ручной конструктор,
           устраняя дублирование информации (AGENTS.md критич.баг #1). */}
      {mainGroup === 'planning' && (
        <div style={{ display:'flex', gap:4, marginBottom:10, padding:'6px', borderRadius:12, background:'rgba(24,24,27,0.15)', border:'1px solid rgba(255,255,255,0.04)' }}>
          <button onClick={() => { hapticImpact('medium'); switchPlanningTrack('pl'); }} style={{ flex:1, padding:'9px 6px', borderRadius:9, fontSize:11, fontWeight:700, cursor:'pointer', border: planningTrack === 'pl' ? '1px solid var(--accent)' : '1px solid rgba(255,255,255,0.06)', background: planningTrack === 'pl' ? 'rgba(0,230,138,0.14)' : 'rgba(255,255,255,0.02)', color: planningTrack === 'pl' ? 'var(--accent)' : 'var(--text-dim)' }}>🏆 ПЛ (сила)</button>
          <button onClick={() => { hapticImpact('medium'); switchPlanningTrack('bb'); }} style={{ flex:1, padding:'9px 6px', borderRadius:9, fontSize:11, fontWeight:700, cursor:'pointer', border: planningTrack === 'bb' ? '1px solid #00e68a' : '1px solid rgba(255,255,255,0.06)', background: planningTrack === 'bb' ? 'rgba(0,230,138,0.14)' : 'rgba(255,255,255,0.02)', color: planningTrack === 'bb' ? '#00e68a' : 'var(--text-dim)' }}>💪 ББ</button>
          <button onClick={() => { hapticImpact('medium'); switchPlanningTrack('manual'); }} style={{ flex:1, padding:'9px 6px', borderRadius:9, fontSize:11, fontWeight:700, cursor:'pointer', border: planningTrack === 'manual' ? '1px solid #00e68a' : '1px solid rgba(255,255,255,0.06)', background: planningTrack === 'manual' ? 'rgba(0,230,138,0.14)' : 'rgba(255,255,255,0.02)', color: planningTrack === 'manual' ? '#00e68a' : 'var(--text-dim)' }}>🛠 Ручной сбор</button>
        </div>
      )}

      {/* Readiness card — only on training tabs */}
      {readiness && mainGroup === 'training' && (
        <div className="card" style={{ marginBottom: 8, padding: '10px 12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <h4 style={{ margin: 0, fontSize: 12 }}>📊 Готовность к тренировке</h4>
            <span style={{ fontSize: 11, color: readiness.recovery >= 70 ? '#22c55e' : readiness.recovery >= 40 ? '#eab308' : '#ef4444', fontWeight: 700 }}>
              {Math.round(readiness.recovery)}%
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {[
              { label: 'Восст.', value: readiness.recovery, color: readiness.recovery >= 70 ? '#22c55e' : '#eab308' },
              { label: 'Питание', value: readiness.nutrition ?? 50, color: (readiness.nutrition ?? 50) >= 70 ? '#22c55e' : '#eab308' },
              { label: 'Сон', value: readiness.sleep ?? 50, color: (readiness.sleep ?? 50) >= 70 ? '#22c55e' : '#eab308' },
              { label: 'Поддержка', value: readiness.support ?? 50, color: (readiness.support ?? 50) >= 70 ? '#22c55e' : '#eab308' },
              { label: 'Усталость', value: 100 - (readiness.fatigue ?? 50), color: (readiness.fatigue ?? 50) < 40 ? '#22c55e' : '#ef4444' },
            ].map(item => (
              <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 10, color: 'var(--text-dim)', minWidth: 44 }}>{item.label}</span>
                <div style={{ flex: 1, background: 'var(--bg-secondary)', borderRadius: 4, height: 5, overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min(100, Math.max(0, item.value))}%`, height: '100%', background: item.color, borderRadius: 4 }} />
                </div>
                <span style={{ fontSize: 10, fontWeight: 600, color: item.color, minWidth: 24, textAlign: 'right' }}>{Math.round(item.value)}%</span>
              </div>
            ))}
          </div>
          {(() => { const srpe = loadSRPESessions(); if (srpe.length < 2) return null; const acwr = acuteChronicRatio(toDailyLoads(srpe)); const zoneColor = acwr.ratio > 1.5 ? '#ef4444' : acwr.ratio > 1.3 ? '#eab308' : acwr.ratio < 0.8 ? '#3b82f6' : '#22c55e'; const zoneLabel = acwr.ratio > 1.5 ? 'опасно' : acwr.ratio > 1.3 ? 'осторожно' : acwr.ratio < 0.8 ? 'недотрен' : 'оптимум'; return <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6, fontSize: 10 }}><span style={{ color: 'var(--text-dim)', minWidth: 44 }}>Нагрузка</span><div style={{ flex: 1, background: 'var(--bg-secondary)', borderRadius: 4, height: 5, overflow: 'hidden' }}><div style={{ width: Math.min(100, acwr.ratio * 50) + '%', height: '100%', background: zoneColor, borderRadius: 4 }} /></div><span style={{ fontWeight: 700, color: zoneColor, minWidth: 60, textAlign: 'right' }}>ACWR {acwr.ratio.toFixed(2)} · {zoneLabel}</span></div>; })()}
        </div>
      )}

      {/* Training Score Card перенесён в подвкладку Восстановление тренировочного блока */}

      {/* ═══════════ PLAN TAB ═══════════ */}
      
{tab === 'powerlifting' && <InfoErrorBoundary label="Пауэрлифтинг"><SRCBBScreen track="pl" /></InfoErrorBoundary>}
{tab === 'bodybuilding' && <InfoErrorBoundary label="Бодибилдинг"><SRCBBScreen track="bb" /></InfoErrorBoundary>}
{tab === 'srcbb' && (
  <InfoErrorBoundary label={planningTrack === 'bb' ? 'Бодибилдинг' : 'Пауэрлифтинг'}>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--accent)' }}>{planningTrack === 'bb' ? '💪 Бодибилдинг — авто-планировщик' : '🏆 Пауэрлифтинг — СРЦ-планировщик'}</div>
      <div style={{ fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.5 }}>
        {planningTrack === 'bb'
          ? 'Автоматическое построение бодибилдинг-цикла: сплиты, объём по группам, прогрессия. Режим (ПЛ / ББ / Ручной сбор) переключается вверху.'
          : 'Автоматическое построение пауэрлифтингового цикла (СРЦ): присед, жим лёжа, становая тяга, вариации интенсивности. Режим (ПЛ / ББ / Ручной сбор) переключается вверху.'}
      </div>
      <button onClick={() => setTab(planningTrack === 'bb' ? 'bodybuilding' : 'powerlifting')} style={{ padding: 16, borderRadius: 12, border: '1px solid rgba(0,230,138,0.3)', background: 'rgba(0,230,138,0.06)', color: 'var(--accent)', cursor: 'pointer', textAlign: 'center' }}>
        <div style={{ fontSize: 30 }}>{planningTrack === 'bb' ? '💪' : '🏋️'}</div>
        <div style={{ fontSize: 13, fontWeight: 700, marginTop: 4 }}>{planningTrack === 'bb' ? 'Открыть Бодибилдинг' : 'Открыть Пауэрлифтинг (СРЦ)'}</div>
        <div style={{ fontSize: 9, color: 'var(--text-dim)', marginTop: 2 }}>{planningTrack === 'bb' ? 'Сплиты · объём · прогрессия' : 'Присед · жим · тяга · интенсивность'}</div>
      </button>
      <button onClick={() => setTab('volume')} style={{ padding: '12px 14px', borderRadius: 12, border: '1px solid rgba(59,130,246,0.3)', background: 'rgba(59,130,246,0.06)', color: '#60a5fa', cursor: 'pointer', textAlign: 'left' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span><b>📐 Расчёт объёма и оптимизация</b><div style={{ fontSize: 9, color: 'var(--text-dim)', marginTop: 2 }}>MEV/MAV/MRV, подбор замен, рекомендации</div></span>
          <span style={{ fontSize: 18 }}>→</span>
        </div>
      </button>
    </div>
  </InfoErrorBoundary>
)}
          {tab === 'plan' && (
        <InfoErrorBoundary label="План тренировок">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="card" style={{ padding: '10px 12px' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 13 }}>⚙️ Параметры плана</h3>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
              {GOALS.map(g => (
                <button key={g.value} onClick={() => setGoal(g.value)} style={{
                  padding: '4px 8px', borderRadius: 6, fontSize: 11, fontWeight: goal === g.value ? 700 : 400,
                  cursor: 'pointer', border: goal === g.value ? '1px solid var(--accent)' : '1px solid var(--border)',
                  background: goal === g.value ? 'rgba(0,230,138,0.15)' : 'var(--bg-secondary)', color: 'var(--text)',
                }}>{g.icon} {g.label}</button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
              {LEVELS.map(l => (
                <button key={l.value} onClick={() => setLevel(l.value)} style={{
                  padding: '4px 8px', borderRadius: 6, fontSize: 11, fontWeight: level === l.value ? 700 : 400,
                  cursor: 'pointer', border: level === l.value ? '1px solid var(--accent)' : '1px solid var(--border)',
                  background: level === l.value ? 'rgba(0,230,138,0.15)' : 'var(--bg-secondary)', color: 'var(--text)',
                }}>{l.icon} {l.label}</button>
              ))}
            </div>
            <div style={{ marginBottom: 8 }}>
              <label style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 3, display: 'block' }}>Тип сплита</label>
              <button onClick={() => { setShowSplitPicker(!showSplitPicker); if (!splitCandidates.length) { const opts = getSplitOptions({ goal, level, daysPerWeek, recovery, fatigue, nutrition: 7, weakPoints, sessionDuration: 60, exercises: [] }); setSplitCandidates(opts.slice(0, 12)); } }} style={{
                width: '100%', padding: '6px 10px', borderRadius: 8, textAlign: 'left', cursor: 'pointer',
                background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 11,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <span>{splitType === 'auto' ? 'Авто-выбор сплита' : splitCandidates.find(c => c.id === splitType)?.name || splitType}</span>
                <span style={{ fontSize: 9, color: 'var(--text-dim)' }}>{showSplitPicker ? '▴' : '▾'}</span>
              </button>
              {showSplitPicker && (
                <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 3, maxHeight: 220, overflowY: 'auto', background: 'var(--bg-secondary)', borderRadius: 8, padding: '4px 6px', border: '1px solid var(--border)' }}>
                  <div key="auto" onClick={() => { setSplitType('auto'); setShowSplitPicker(false); setTimeout(() => generatePlan(), 50); }} style={{
                    padding: '5px 8px', borderRadius: 6, cursor: 'pointer', fontSize: 11,
                    background: splitType === 'auto' ? 'rgba(0,230,138,0.1)' : 'transparent',
                    border: splitType === 'auto' ? '1px solid var(--accent)' : '1px solid transparent',
                  }}>
                    <div style={{ fontWeight: 600 }}>🤖 Авто-выбор</div>
                    <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>Движок сам подберёт оптимальный сплит</div>
                  </div>
                   {splitCandidates.map(c => (
                     <div key={c.id || c.name} onClick={() => { const newType = c.id || c.name; setSplitType(newType); setShowSplitPicker(false); setTimeout(() => generatePlan(newType), 50); }} style={{
                      padding: '5px 8px', borderRadius: 6, cursor: 'pointer', fontSize: 11,
                      background: splitType === (c.id || c.name) ? 'rgba(0,230,138,0.1)' : 'transparent',
                      border: splitType === (c.id || c.name) ? '1px solid var(--accent)' : '1px solid transparent',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 600 }}>{c.name}</span>
                        <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 3, background: 'rgba(0,230,138,0.1)', color: 'var(--accent)', fontWeight: 600 }}>{(c.score * 100).toFixed(0)}%</span>
                      </div>
                      <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.85)' }}>{c.desc?.slice(0, 80)}{c.desc && c.desc.length > 80 ? '...' : ''}</div>
                      {c.rationale && <div style={{ fontSize: 8, color: 'var(--accent)', marginTop: 1 }}>{c.rationale.slice(0, 60)}</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div style={{ marginBottom: 8 }}>
              <label style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 2, display: 'block' }}>Тип периодизации</label>
              <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                {[
                  { v: 'auto', l: 'Авто', desc: 'Автоматический выбор по уровню' },
                  { v: 'linear', l: 'Линейная', desc: 'Объём ↓, интенсивность ↑. Классическая.' },
                  { v: 'undulating', l: 'Волновая DUP', desc: 'Смена нагрузки внутри недели. Гибкая.' },
                  { v: 'block', l: 'Блочная', desc: 'Блоки по 3-6 нед с одной целью. Продвинутая.' },
                ].map(p => (
                  <button key={p.v} onClick={() => { setPeriodizationType(p.v as 'auto' | 'linear' | 'undulating' | 'block' | 'conjugate'); setTimeout(generatePlan, 50); }} style={{
                    padding: '3px 7px', borderRadius: 6, fontSize: 9, fontWeight: periodizationType === p.v ? 700 : 400, cursor: 'pointer',
                    border: periodizationType === p.v ? '1px solid var(--accent)' : '1px solid var(--border)',
                    background: periodizationType === p.v ? 'rgba(0,230,138,0.15)' : 'var(--bg-secondary)', color: 'var(--text)',
                    position:'relative',
                  }} title={p.desc}>{p.l}</button>
                ))}
              </div>
              <div style={{ fontSize: 8, color: 'var(--text-dim)', marginTop: 2 }}>
                {periodizationType === 'auto' && 'Автоматический подбор по цели и уровню'}
                {periodizationType === 'linear' && 'Объём снижается, интенсивность растёт от блока к блоку. RIR повышен.'}
                {periodizationType === 'undulating' && 'Объём/интенсивность меняются каждый день/неделю. RIR средний.'}
                {periodizationType === 'block' && 'Блоки по 3-6 нед с одной целью. RIR снижен, объём повышен.'}
              </div>
              {periodizationType === 'block' && (() => {
                const seq = BLOCK_SEQUENCES[level] || BLOCK_SEQUENCES.intermediate;
                const colors: Record<string,string> = { accumulation:'#22c55e', transmutation:'#3b82f6', realization:'#f97316', active_rest:'#eab308' };
                const labels: Record<string,string> = { accumulation:'Акк', transmutation:'Транс', realization:'Реал', active_rest:'Отдых' };
                return <div style={{ marginTop:4, display:'flex', gap:4, flexWrap:'wrap' }}>
                  {seq.map((b, i) => <span key={b.id} style={{ fontSize:8, padding:'2px 6px', borderRadius:4, background:(colors[b.id]||'#888')+'22', color:colors[b.id]||'#888', fontWeight:600, whiteSpace:'nowrap' }}>{labels[b.id]||b.id} {b.weeks}н{i < seq.length-1 ? ' →' : ''}</span>)}
                </div>;
              })()}
            </div>
            <div style={{ marginBottom: 8 }}>
              <label style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 2, display: 'block' }}>Тип цикла</label>
              <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                {[
                  { v: 'auto', l: 'Авто', desc: 'Авто' }, { v: 'pl_strength', l: 'PL Сила', desc: 'Пауэрлифтинг сила' }, { v: 'pl_peaking', l: 'PL Пик', desc: 'Пауэрлифтинг пик' },
                  { v: 'bb_mass', l: 'BB Масса', desc: 'Бодибилдинг масса' }, { v: 'bb_specialization', l: 'BB Спец', desc: 'Бодибилдинг спец' },
                  { v: 'rehab', l: 'Реабилитация', desc: 'Реабилитация' }, { v: 'wl_tech', l: 'WL Техника', desc: 'Тяжелая атлетика техника' },
                ].map(c => (
                  <button key={c.v} onClick={() => { setCycleType(c.v); setTimeout(generatePlan, 50); }} style={{
                    padding: '3px 7px', borderRadius: 6, fontSize: 9, fontWeight: cycleType === c.v ? 700 : 400, cursor: 'pointer',
                    border: cycleType === c.v ? '1px solid var(--accent)' : '1px solid var(--border)',
                    background: cycleType === c.v ? 'rgba(0,230,138,0.15)' : 'var(--bg-secondary)', color: 'var(--text)',
                  }} title={c.desc}>{c.l}</button>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: 8 }}>
              <label style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 2, display: 'block' }}>Длина цикла</label>
              <div style={{ display: 'flex', gap: 3 }}>
                {[4, 8, 12].map(w => (
                  <button key={w} onClick={() => setMesoLength(w)} style={{
                    padding: '3px 10px', borderRadius: 6, fontSize: 10, fontWeight: mesoLength === w ? 700 : 400, cursor: 'pointer',
                    border: mesoLength === w ? '1px solid var(--accent)' : '1px solid var(--border)',
                    background: mesoLength === w ? 'rgba(0,230,138,0.15)' : 'var(--bg-secondary)', color: 'var(--text)',
                  }}>{w} нед</button>
                ))}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 8 }}>
              <div>
                <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Дней/нед</label>
                <input type="range" min={2} max={7} value={daysPerWeek} onChange={e => { setDaysPerWeek(parseFloat(e.target.value) || 0); setTimeout(generatePlan, 50); }}
                  style={{ width: '100%', accentColor: 'var(--accent)' }} />
                <div style={{ textAlign: 'center', fontSize: 10, color: 'var(--text-dim)' }}>{daysPerWeek}</div>
              </div>
              <div>
                <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Восстановление</label>
                <input type="range" min={1} max={10} value={recovery} onChange={e => setRecovery(parseFloat(e.target.value) || 0)}
                  style={{ width: '100%', accentColor: 'var(--accent)' }} />
                <div style={{ textAlign: 'center', fontSize: 10, color: recovery < 4 ? '#ef4444' : recovery < 6 ? '#ff9100' : '#22c55e' }}>
                  <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 4, background: recovery < 4 ? '#ef4444' : recovery < 6 ? '#ff9100' : '#22c55e', marginRight: 4 }} />
                  {recovery}/10 — {recovery < 4 ? 'низкое' : recovery < 6 ? 'умеренное' : recovery < 8 ? 'хорошее' : 'отличное'}
                </div>
                <div style={{ fontSize:8, color:'var(--text-dim)', textAlign:'center', marginTop:1 }}>Низкий → требуется больше отдыха</div>
              </div>
              <div>
                <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Усталость</label>
                <input type="range" min={1} max={10} value={fatigue} onChange={e => setFatigue(parseFloat(e.target.value) || 0)}
                  style={{ width: '100%', accentColor: 'var(--accent)' }} />
                <div style={{ textAlign: 'center', fontSize: 10, color: 'var(--text-dim)' }}>{fatigue}/10</div>
                <div style={{ fontSize:8, color:'var(--text-dim)', textAlign:'center', marginTop:1 }}>
                  {fatigue <= 3 ? 'Свежий' : fatigue <= 6 ? 'Умеренная усталость' : fatigue <= 8 ? 'Высокая нагрузка' : 'Перетренированность'}
                </div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 8 }}>
              <div>
                <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Вес (кг)</label>
                <input type="number" value={bodyWeight} onChange={e => setBodyWeight(parseFloat(e.target.value) || 0)}
                  style={{ width: '100%', padding: '5px 6px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Сон (ч)</label>
                <input type="number" min={0} max={12} value={sleepHours || ''} onChange={e => setSleepHours(parseFloat(e.target.value) || 0)}
                  style={{ width: '100%', padding: '5px 6px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, boxSizing: 'border-box' }} />
                <div style={{ fontSize:8, color: sleepHours < 6 ? '#ef4444' : sleepHours <= 7 ? '#ff9100' : sleepHours <= 9 ? '#22c55e' : '#ff9100', marginTop:1, textAlign:'center' }}>
                  {sleepHours < 6 ? '<6: Недостаточно' : sleepHours <= 7 ? '6-7: Минимум' : sleepHours <= 9 ? '7-9: Оптимум' : '>9: Избыток'}
                </div>
              </div>
              <div>
                <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Стресс (1-10)</label>
                <input type="number" min={1} max={10} value={stressLevel || ''} onChange={e => setStressLevel(parseFloat(e.target.value) || 0)}
                  style={{ width: '100%', padding: '5px 6px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, boxSizing: 'border-box' }} />
                <div style={{ fontSize:8, color: stressLevel <= 3 ? '#22c55e' : stressLevel <= 6 ? '#ff9100' : '#ef4444', marginTop:1, textAlign:'center' }}>
                  {stressLevel <= 3 ? '1-3: Низкий' : stressLevel <= 6 ? '4-6: Средний' : '7-10: Высокий'}
                </div>
              </div>
            </div>
            <div style={{ marginBottom: 8 }}>
              <label style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 2, display: 'block' }}>Слабые зоны</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                {MUSCLE_GROUPS.map(g => {
                  const active = weakPoints.includes(g);
                  return (
                    <button key={g} onClick={() => setWeakPoints(active ? weakPoints.filter(w => w !== g) : [...weakPoints, g])} style={{
                      padding: '3px 8px', borderRadius: 6, fontSize: 10, cursor: 'pointer',
                      border: active ? '1px solid #ff9100' : '1px solid var(--border)',
                      background: active ? 'rgba(255,145,0,0.15)' : 'var(--bg-secondary)',
                      color: active ? '#ff9100' : 'var(--text-dim)', fontWeight: active ? 600 : 400,
                    }}>{GROUP_LABELS[g]}</button>
                  );
                })}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => generatePlan()} style={{
                flex: 1, padding: 10, borderRadius: 8, border: 'none', cursor: 'pointer',
                background: 'linear-gradient(135deg, var(--accent), #00c853)', color: '#000', fontWeight: 700, fontSize: 13,
              }}>▶ Сгенерировать план</button>
              {currentMicrocycle ? <button onClick={applyMacroToRuntime} title="Перенести текущую неделю макроцикла во вкладку Тренировки для выполнения через SessionPlayer" style={{ padding: 10, borderRadius: 8, border: '1px solid var(--accent)', cursor: 'pointer', background: 'rgba(0,230,138,0.08)', color: 'var(--accent)', fontWeight: 600, fontSize: 12, whiteSpace: 'nowrap' }}>▶ К выполнению</button> : null}
              {trainingOutput && (
                <button onClick={() => { generatePlan(); }} style={{
                  padding: 10, borderRadius: 8, border: '1px solid var(--accent)', cursor: 'pointer',
                  background: 'rgba(0,230,138,0.08)', color: 'var(--accent)', fontWeight: 600, fontSize: 12,
                  whiteSpace: 'nowrap',
                }}>🔄 Заново</button>
              )}
            </div>
          </div>

          {trainingOutput && (
            <>
              {/* Training constraints check */}
              {(() => {
                const constraints = computeConstraints({
                  riskSnapshot: {},
                  fatigueLevel: fatigue / 10,
                  recoveryLevel: recovery / 10,
                  priScore: recovery / 10,
                  jointFatigue: {},
                  cumulativeLoad: { weekly: 0, patternLoad: {}, jointLoad: {}, overload: false },
                  equipmentAvailable: ['barbell', 'dumbbell', 'bench'],
                  goal,
                });
                if (constraints.recommendations.length === 0) return null;
                return (
                  <div key="constraints" className="card" style={{
                    marginBottom: 8, padding: '6px 10px',
                    background: 'rgba(249,115,22,0.06)', borderLeft: '3px solid #f97316',
                  }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: '#f97316' }}>⚠ Ограничения тренировки</div>
                    {constraints.recommendations.map((r, i) => (
                      <div key={i} style={{ fontSize: 9, color: 'var(--text-dim)', marginTop: 2 }}>• {r}</div>
                    ))}
                  </div>
                );
              })()}
              {/* Smart Recommendations */}
              {(() => {
                const tips: { icon: string; text: string; color: string }[] = [];
                if (recovery < 5) tips.push({ icon: '⚠️', text: 'Низкое восстановление: сократите объём на 10-20% или держите RIR выше.', color: '#ef4444' });
                if (sleepHours < 7) tips.push({ icon: '😴', text: `Сон ${sleepHours} ч: добавьте 30-60 минут сна перед тяжёлыми днями.`, color: '#ff9100' });
                if (stressLevel > 7) tips.push({ icon: '🧠', text: 'Высокий стресс: избегайте отказных подходов и контролируйте RPE.', color: '#ff9100' });
                if (currentMicrocycle?.mesocycleType === 'deload') tips.push({ icon: '🧊', text: 'Неделя разгрузки: цель — восстановление, а не рекорды.', color: '#3b82f6' });
                else if (currentMicrocycle?.mesocycleType === 'peaking') tips.push({ icon: '🎯', text: 'Пиковая фаза: держите технику стабильной и не добавляйте лишний объём.', color: '#ef4444' });
                else if (currentMicrocycle?.mesocycleType === 'accumulation') tips.push({ icon: '📈', text: 'Фаза накопления: постепенно увеличивайте объём при сохранении качества повторений.', color: '#22c55e' });
                if (weakPoints.length > 0) tips.push({ icon: '🔎', text: `Фокус на слабых зонах: ${weakPoints.map(w => GROUP_LABELS[w] || w).join(', ')}.`, color: '#8b5cf6' });
                if (recovery > 8 && fatigue < 3) tips.push({ icon: '✅', text: 'Готовность высокая: можно добавить один качественный подход в приоритетную группу.', color: '#22c55e' });
                if (tips.length === 0) tips.push({ icon: '✅', text: 'Параметры выглядят сбалансированно: выполняйте план без лишних изменений.', color: 'var(--accent)' });
                return (
                  <div key="recommendations" className="card" style={{ padding: '10px 12px', border: '1px solid rgba(0,230,138,0.2)' }}>
                    <h4 style={{ margin: '0 0 6px', fontSize: 12, color: 'var(--accent)' }}>💡 Рекомендации</h4>
                    {tips.map((t, i) => (
                      <div key={i} style={{ fontSize: 10, color: 'var(--text-dim)', padding: '2px 0', display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                        <span>{t.icon}</span>
                        <span style={{ color: t.color }}>{t.text}</span>
                      </div>
                    ))}
                  </div>
                );
              })()}
              <div className="card" style={{ padding: '10px 12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div>
                    <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--accent)' }}>{trainingOutput.splitName}</span>
                    <span style={{ fontSize: 10, color: 'var(--text-dim)', marginLeft: 6 }}>RIR {getRIRstr(goal, level, trainingOutput.isDeload)}</span>
                  </div>
                  {trainingOutput.isDeload && (
                    <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, background: 'rgba(255,145,0,0.15)', color: '#ff9100', fontWeight: 600 }}>РАЗГРУЗКА</span>
                  )}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 4 }}>{trainingOutput.splitDesc}</div>
                <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{formatSplitGroups(trainingOutput)}</div>
              </div>

              <div className="card" style={{ padding: '8px 10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 10, color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>Нед {selectedWeek}</span>
                  <input type="range" min={1} max={macrocycle?.totalWeeks || 12} value={selectedWeek}
                    onChange={e => setSelectedWeek(parseFloat(e.target.value) || 0)}
                    style={{ flex: 1, accentColor: 'var(--accent)' }} />
                </div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  <button onClick={() => setShowWarmup(!showWarmup)} style={{
                    padding: '3px 8px', borderRadius: 4, fontSize: 9, cursor: 'pointer',
                    background: showWarmup ? 'rgba(255,145,0,0.15)' : 'var(--bg-secondary)',
                    border: showWarmup ? '1px solid #ff9100' : '1px solid var(--border)',
                    color: showWarmup ? '#ff9100' : 'var(--text-dim)',
                  }}>🔥 Разминка</button>
                  <button onClick={() => setShowCooldown(!showCooldown)} style={{
                    padding: '3px 8px', borderRadius: 4, fontSize: 9, cursor: 'pointer',
                    background: showCooldown ? 'rgba(59,130,246,0.15)' : 'var(--bg-secondary)',
                    border: showCooldown ? '1px solid #3b82f6' : '1px solid var(--border)',
                    color: showCooldown ? '#3b82f6' : 'var(--text-dim)',
                  }}>🧊 Заминка</button>
                </div>
              </div>

              {/* Warmup */}
              {showWarmup && currentMicrocycle && currentMicrocycle.days.length > 0 && (() => {
                const wuInput = {
                  sessionFocus: currentMicrocycle.days[0]?.split || 'fullbody',
                  primaryExercises: currentMicrocycle.days[0]?.exercises?.slice(0, 2).map((e: any) => e.name) || [],
                  riskFlags: {} as Record<string, string>,
                  techniqueIssues: [] as string[],
                  fatigueLevel: fatigue / 10,
                  equipmentAvailable: ['barbell', 'dumbbell', 'machine', 'cable', 'bodyweight'],
                };
                const warmup = generateWarmup(wuInput);
                return (
                  <div key="warmup" className="card" style={{ padding: '8px 10px', border: '1px solid rgba(255,145,0,0.2)' }}>
                    <div style={{ fontWeight: 600, fontSize: 12, color: '#ff9100', marginBottom: 4 }}>🔥 Разминка</div>
                    {warmup.map((b, bi) => (
                      <div key={bi} style={{ fontSize: 10, marginBottom: 2, color: 'var(--text-dim)' }}>
                        <span style={{ fontWeight: 600, color: '#ff9100' }}>
                          {b.type === 'general' ? 'Общая' : b.type === 'mobility' ? 'Мобилизация' : b.type === 'activation' ? 'Активация' : 'Разминка'} ({b.durationSec}с)
                        </span>
                        {b.exercises?.map((ex, exi) => (
                          <span key={exi} style={{ marginLeft: 6, color: 'var(--text-dim)' }}>
                            {WARMUP_LABELS[ex.exerciseId] || ex.exerciseId.replace(/_/g, ' ')} {ex.sets ? `×${ex.sets}` : ''}
                          </span>
                        ))}
                      </div>
                    ))}
                  </div>
                );
              })()}

              {currentMicrocycle && (
                <div className="card" style={{ padding: '10px 12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 700 }}>
                      {PHASE_LABELS[currentMicrocycle.mesocycleType] || 'Рабочая фаза'} — Неделя {selectedWeek}
                    </span>
                    <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>
                      Объём ×{currentMicrocycle.volumeMultiplier} | RIR {currentMicrocycle.rirRange[0]}-{currentMicrocycle.rirRange[1]}
                      {currentMicrocycle.mesocycleType !== 'deload' && currentMicrocycle.mesocycleType !== 'peaking' && (
                        <span style={{ color: '#22c55e', fontWeight: 600, marginLeft: 6 }}>
                          ↑+{(currentMicrocycle.mesocycleType === 'accumulation' ? 2.5 : 3.75)}%/нед
                        </span>
                      )}
                      {currentMicrocycle.mesocycleType === 'deload' && (
                        <span style={{ color: '#3b82f6', fontWeight: 600, marginLeft: 6 }}>↓-50%</span>
                      )}
                    </span>
                      </div>
                      {/* Phase training tip */}
                      {currentMicrocycle && (
                        <div style={{ padding: '6px 8px', background: 'rgba(0,230,138,0.04)', borderRadius: 6, fontSize: 10, color: 'var(--accent)', marginBottom: 6, lineHeight: 1.4 }}>
                          {PHASE_HINTS[currentMicrocycle.mesocycleType] || 'Рабочая неделя: сохраняйте заданный объём, интенсивность и RIR.'}
                        </div>
                      )}
                      {/* MRV guardrail — анти-перетрен по объёму недели */}
                      {currentMicrocycle && (() => {
                        const _labAdj = labTrainingAdjust(linked.labAnalysis);
    const mrv = ((LEVEL_VOLUMES as Record<string, { mrv: number }>)[level]?.mrv ?? 20) * (tprofile.onCourse ? (tprofile.courseIntensity === 'heavy' ? 1.3 : tprofile.courseIntensity === 'mild' ? 1.15 : 1.2) : 1) * _labAdj.mrvMultiplier;
                        const wk: Record<string, number> = {};
                        currentMicrocycle.days.filter((d: any) => d.isTraining).forEach((d: any) => (d.exercises || []).forEach((e: any) => { wk[e.group] = (wk[e.group] || 0) + (e.sets || 0); }));
                        const over = Object.entries(wk).filter(([, s]) => s > mrv);
                        if (over.length === 0) return null;
                        const GRP_RU: Record<string,string> = { chest:'Грудь', back:'Спина', legs:'Ноги', shoulders:'Плечи', arms:'Руки', core:'Кор' };
                        return <div style={{ padding: '6px 8px', background: 'rgba(239,68,68,0.08)', borderRadius: 6, fontSize: 10, color: '#ef4444', marginBottom: 6, lineHeight: 1.4, border: '1px solid rgba(239,68,68,0.2)' }}>
                          ⚠ Объём превышает MRV ({mrv} сетов/нед): {over.map(([g, s]) => `${GRP_RU[g] || g} ${s}`).join(' · ')}. Снизьте число подходов или добавьте восстановление.
                        </div>;
                      })()}
                      {currentMicrocycle.days.filter((d: any) => d.isTraining).map((day: any, di: number) => {
                    const dayExCount = day.exercises?.length || 0;
                    const dayCompounds = day.exercises?.filter((e: any) => e.isCompound).length || 0;
                    const difficultyScore = Math.min(10, Math.round((dayCompounds * 2 + dayExCount) * (day.intensity === 'very_high' ? 1.4 : day.intensity === 'high' ? 1.2 : 1)));
                    const diffLabel = difficultyScore <= 3 ? 'лёгко' : difficultyScore <= 5 ? 'умеренно' : difficultyScore <= 7 ? 'тяжело' : 'очень тяжело';
                    const diffColor = difficultyScore <= 3 ? '#22c55e' : difficultyScore <= 5 ? '#84cc16' : difficultyScore <= 7 ? '#ff9100' : '#ef4444';
                    const adjRecovery = recovery / 10;
                    const autoRegNote = adjRecovery < 0.4 ? '⚠ Снизить объём на 20% — низкое восстановление' :
                                       adjRecovery < 0.6 ? '⚡ Умеренная нагрузка — следи за RPE' :
                                       adjRecovery > 0.8 ? '✅ Высокая готовность — можно добавить подход' : '';
                    const labWarnings: string[] = [];
                    if (labAnalysis) {
                      if (labAnalysis.liverStress > 60) labWarnings.push(`⚠ Печень ${labAnalysis.liverStress}% — исключить гепатотоксичные нагрузки`);
                      if (labAnalysis.inflammation > 5) labWarnings.push(`⚠ Воспаление ${labAnalysis.inflammation.toFixed(1)} — рекомендован deload`);
                      if (labAnalysis.kidneyStress > 50) labWarnings.push(`⚠ Почки ${labAnalysis.kidneyStress}% — контроль гидратации`);
                    }
                    return (
                    <div key={di} style={{ marginBottom: 6, background: 'var(--bg-secondary)', borderRadius: 6, padding: '6px 8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <span style={{ fontWeight: 600, fontSize: 11 }}>{day.day}</span>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          {(() => {
                            const hasSquat = day.exercises?.some((e: any) => e.exerciseId?.includes('squat') || e.name?.toLowerCase().includes('присед'));
                            const hasBench = day.exercises?.some((e: any) => e.exerciseId?.includes('bench') || e.name?.toLowerCase().includes('жим'));
                            const hasDead = day.exercises?.some((e: any) => e.exerciseId?.includes('deadlift') || e.name?.toLowerCase().includes('тяга'));
                            const focusTag = hasSquat ? 'Присед' : hasBench ? 'Жим' : hasDead ? 'Тяга' : '';
                            return focusTag ? <span style={{ fontSize: 9, color: 'var(--accent)', fontWeight: 600 }}>{focusTag}</span> : null;
              })()}

              {/* Periodization phase info */}
              {(() => {
                const pp = getPhaseParams({
                  goal: ({ bulk: 'hypertrophy', cut: 'conditioning', strength: 'strength', maintenance: 'hypertrophy', recomp: 'hypertrophy', rehab: 'rehab', powerlifting: 'powerlifting', bodybuilding: 'bodybuilding' } as Record<string, GoalType>)[goal] ?? 'hypertrophy',
                  phase: cycleType === 'peaking' ? 'peaking' : cycleType === 'intensification' ? 'intensification' : cycleType === 'deload' ? 'deload' : 'accumulation',
                  analytics: { fatigue: fatigue / 10, recovery: recovery / 10, risk: 0 },
                });
                return (
                  <div className="card" style={{ marginBottom: 8, padding: '6px 10px', background: 'rgba(139,92,246,0.06)', borderLeft: '3px solid #8b5cf6' }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: '#8b5cf6', marginBottom: 2 }}>
                      🔄 Фаза: {cycleType === 'peaking' ? 'Пик' : cycleType === 'intensification' ? 'Интенсификация' : cycleType === 'deload' ? 'Разгрузка' : 'Накопление'}
                    </div>
                    <div style={{ display: 'flex', gap: 10, fontSize: 9, color: 'var(--text-dim)' }}>
                      <span>Объём: <b>{pp.volumeLevel}</b></span>
                      <span>Интенсивность: <b>{pp.intensityLevel}</b></span>
                      <span>Частота: <b>{pp.frequencyLevel}</b></span>
                      <span>Приоритет: <b>{pp.priority}</b></span>
                    </div>
                  </div>
                );
              })()}
                          <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: `${diffColor}22`, color: diffColor, fontWeight: 600 }}>{diffLabel} {difficultyScore}/10</span>
                          <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{day.duration} мин</span>
                        </div>
                      </div>
                      {autoRegNote && (
                        <div style={{ fontSize: 9, color: adjRecovery < 0.4 ? '#ef4444' : adjRecovery < 0.6 ? '#ff9100' : '#22c55e', marginBottom: 3, background: `${adjRecovery < 0.4 ? '#ef4444' : adjRecovery < 0.6 ? '#ff9100' : '#22c55e'}11`, padding: '2px 6px', borderRadius: 3 }}>
                          {autoRegNote}
                        </div>
                      )}
                      {labWarnings.length > 0 && labWarnings.map((w, wi) => (
                        <div key={wi} style={{ fontSize: 9, color: '#ef4444', marginBottom: 3, background: 'rgba(239,68,68,0.08)', padding: '2px 6px', borderRadius: 3 }}>
                          {w}
                        </div>
                      ))}
                      <div style={{ fontSize: 8, color: 'var(--text-dim)', marginBottom: 3, padding: '1px 4px', background: 'rgba(255,165,2,0.05)', borderRadius: 3 }}>
                        🍎 {goal === 'bulk' ? 'Профицит 5-10%, белок 1.8-2.2 г/кг, углеводы вокруг тренировки.' : goal === 'cut' ? 'Дефицит 10-20%, белок 2.0-2.4 г/кг, углеводы до/после тренировки.' : goal === 'strength' ? 'Поддерживайте калории около TDEE и держите углеводы перед тяжёлыми подходами.' : 'Калории около TDEE, белок 1.8-2.2 г/кг, стабильный режим питания.'}
                      </div>
                      {day.exercises.map((ex: any, ei: number) => {
                        const scheme = selectSetScheme({
                          goal, movementPattern: 'squat' as MovementPattern, difficultyLevel: level === 'beginner' ? 'low' : level === 'intermediate' ? 'medium' : 'high',
                          techniqueIssues: [], riskFlags: {}, fatigueScore: fatigue / 10, repPattern: 'normal', isPrimaryLift: ei === 0,
                        });
                        const tempo = selectTempo(goal, [], {}, ex.isCompound);
                        const exCat = EXERCISE_CATALOG.find(ec => ec.id === ex.exerciseId || ec.name === ex.name);
                        const estMax = ex.weight ? Math.round(ex.weight * (1 + Number(ex.reps) / 30)) : 0;
                        const substitute = exCat?.canReplace?.[0] ? EXERCISE_CATALOG.find(e => e.id === exCat.canReplace![0]) : null;
                        const role = ei === 0 ? 'main' : ei <= 2 ? 'secondary' : 'accessory';
                        const roleColor = role === 'main' ? '#ef4444' : role === 'secondary' ? '#f97316' : '#6b7280';
                        const roleLabel = role === 'main' ? 'ОСН' : role === 'secondary' ? 'ДОП' : 'АКС';
                        const restSec = ei === 0 ? (goal === 'strength' ? 180 : 120) : ei <= 2 ? 90 : 60;
                        return (
                        <div key={ei} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '2px 0', fontSize: 10, borderBottom: ei < day.exercises.length - 1 ? '1px solid var(--border)' : 'none', gap: 2 }}>
                          <span style={{ fontSize: 7, padding: '1px 3px', borderRadius: 2, background: `${roleColor}22`, color: roleColor, fontWeight: 700, minWidth: 22, textAlign: 'center', flexShrink: 0 }}>{roleLabel}</span>
                          <span style={{ flex: 1 }} title={ex.technique || ''}>{ex.name}</span>
                          <span style={{ color: 'var(--accent)', fontWeight: 600, minWidth: 55, textAlign: 'right' }}>{ex.sets}×{ex.reps}</span>
                          {estMax > 0 && <span style={{ fontSize: 8, color: '#00e68a', minWidth: 40, textAlign: 'right' }}>~{estMax}кг</span>}
                          <span style={{ fontSize: 8, color: 'var(--text-dim)', minWidth: 25, textAlign: 'right' }}>RIR{ex.rir}</span>
                          <span style={{ fontSize: 6, padding: '1px 2px', borderRadius: 2, background: 'rgba(0,230,138,0.1)', color: '#00e68a', whiteSpace: 'nowrap' }}>{scheme?.schemeType?.slice(0, 6) || '—'}</span>
                          <span style={{ fontSize: 6, padding: '1px 2px', borderRadius: 2, background: 'rgba(249,115,22,0.1)', color: '#f97316', whiteSpace: 'nowrap' }}>⏱{restSec}с</span>
                          {substitute && <span style={{ fontSize: 6, color: 'var(--text-dim)', maxWidth: 50, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={``}>↔{substitute.name.slice(0, 8)}</span>}
                        </div>
                        );
                      })}
                      {/* Rotation suggestion for main lifts */}
                      {day.exercises?.filter((e: any) => e.isCompound).slice(0, 2).map((ex: any, ei: number) => {
                        const cat = EXERCISE_CATALOG.find(ec => ec.id === ex.exerciseId || ec.name === ex.name);
                        const alts = cat?.canReplace?.filter(r => !day.exercises.some((de: any) => de.exerciseId === r || de.name === r)).slice(0, 2) || [];
                        if (alts.length === 0) return null;
                        return (
                          <div key={`rot-${ei}`} style={{ fontSize: 8, color: 'var(--text-dim)', padding: '1px 0', marginLeft: 26, marginBottom: 1 }}>
                            <span style={{ color: '#8b5cf6' }}>🔄 {ex.name.slice(0, 12)} → </span>
                            {alts.map((a: string, ai: number) => {
                              const altEx = EXERCISE_CATALOG.find(e => e.id === a);
                              return <span key={ai}>{altEx?.name || a}{ai < alts.length - 1 ? ', ' : ''}</span>;
                            })}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
                  <div style={{ marginTop: 4, padding: '4px 8px', background: 'rgba(255,255,255,0.03)', borderRadius: 4, fontSize: 9, color: 'var(--text-dim)' }}>
                      <span style={{ color: 'var(--accent)', fontWeight: 600 }}>
                         {PHASE_HINTS[currentMicrocycle.mesocycleType] || 'Следуйте заданным подходам, повторам и RIR.'}
                      </span>
                    </div>
                </div>
              )}

              {/* Quick week summary */}
              {currentMicrocycle && (
                <div className="card" style={{ padding: '8px 10px' }}>
                  <div style={{ fontWeight: 600, fontSize: 11, color: 'var(--accent)', marginBottom: 4 }}>📋 Сводка недели {selectedWeek}</div>
                  {(() => {
                    const days = currentMicrocycle.days.filter((d: any) => d.isTraining);
                    const totalSets = days.reduce((s: number, d: any) => s + (d.exercises?.reduce((ss: number, e: any) => ss + (e.sets || 0), 0) || 0), 0);
                    const totalReps = days.reduce((s: number, d: any) => s + (d.exercises?.reduce((ss: number, e: any) => ss + (parseInt(String(e.reps)) || 0) * (e.sets || 0), 0) || 0), 0);
                    const totalTonnage = days.reduce((s: number, d: any) => s + (d.exercises?.reduce((ss: number, e: any) => ss + (e.sets || 0) * (parseInt(String(e.reps)) || 0) * (e.weight || 0), 0) || 0), 0);
                    const totalMin = days.reduce((s: number, d: any) => s + (d.duration || 0), 0);
                    const density = totalMin > 0 ? Math.round(totalTonnage / totalMin) : 0;
                    return (
                      <div key="week-summary" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', gap: 4, fontSize: 10 }}>
                        <div style={{ textAlign: 'center', padding: '4px', background: 'rgba(0,230,138,0.05)', borderRadius: 4 }}>
                          <div style={{ color: 'var(--text-dim)' }}>Дней</div>
                          <div style={{ fontWeight: 700, color: 'var(--accent)' }}>{days.length}</div>
                        </div>
                        <div style={{ textAlign: 'center', padding: '4px', background: 'rgba(0,230,138,0.05)', borderRadius: 4 }}>
                          <div style={{ color: 'var(--text-dim)' }}>Подходов</div>
                          <div style={{ fontWeight: 700, color: 'var(--accent)' }}>{totalSets}</div>
                        </div>
                        <div style={{ textAlign: 'center', padding: '4px', background: 'rgba(0,230,138,0.05)', borderRadius: 4 }}>
                          <div style={{ color: 'var(--text-dim)' }}>Повторов</div>
                          <div style={{ fontWeight: 700, color: 'var(--accent)' }}>{totalReps}</div>
                        </div>
                        <div style={{ textAlign: 'center', padding: '4px', background: 'rgba(0,230,138,0.05)', borderRadius: 4 }}>
                          <div style={{ color: 'var(--text-dim)' }}>Тоннаж</div>
                          <div style={{ fontWeight: 700, color: 'var(--accent)' }}>{totalTonnage > 0 ? `${(totalTonnage / 1000).toFixed(1)}т` : '—'}</div>
                        </div>
                        <div style={{ textAlign: 'center', padding: '4px', background: 'rgba(0,230,138,0.05)', borderRadius: 4 }}>
                          <div style={{ color: 'var(--text-dim)' }}>Плотность</div>
                          <div style={{ fontWeight: 700, color: density > 50 ? '#22c55e' : density > 25 ? '#ff9100' : '#ef4444' }}>{density} кг/мин</div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Weekly training calendar (TZ) */}
              {currentMicrocycle && (
                <div className="card" style={{ padding: '10px 12px', marginTop: 8 }}>
                  <h4 style={{ margin: '0 0 6px', fontSize: 12 }}>📅 Календарь недели</h4>
                  <div style={{ display: 'flex', gap: 3 }}>
                    {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((dayName, di) => {
                      const day = currentMicrocycle.days.find((d: any) => d.isTraining && d.day?.includes(dayName));
                      const isTraining = !!day;
                      return (
                        <div key={di} style={{
                          flex: 1, textAlign: 'center', padding: '4px 2px', borderRadius: 6, fontSize: 9,
                          background: isTraining ? 'rgba(0,230,138,0.1)' : 'rgba(255,255,255,0.02)',
                          border: isTraining ? '1px solid rgba(0,230,138,0.2)' : '1px solid var(--border)',
                          color: isTraining ? 'var(--accent)' : 'var(--text-dim)',
                          fontWeight: isTraining ? 600 : 400,
                        }}>
                          <div>{dayName}</div>
                          {isTraining && <div style={{ fontSize: 7, marginTop: 1 }}>{day?.exercises?.length || 0} упр</div>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Cooldown */}
              {showCooldown && currentMicrocycle && currentMicrocycle.days.length > 0 && (() => {
                const cdInput = {
                  muscleGroupsUsed: currentMicrocycle.days[0]?.exercises?.map((e: any) => e.group).filter(Boolean) || [],
                  fatigueScore: fatigue / 10,
                  riskFlags: {} as Record<string, string>,
                  sessionDuration: currentMicrocycle.days[0]?.duration || 60,
                };
                const cooldown = generateCooldown(cdInput);
                return (
                  <div key="cooldown" className="card" style={{ padding: '8px 10px', border: '1px solid rgba(59,130,246,0.2)' }}>
                    <div style={{ fontWeight: 600, fontSize: 12, color: '#3b82f6', marginBottom: 4 }}>🧊 Заминка</div>
                    {cooldown.map((b, bi) => (
                      <div key={bi} style={{ fontSize: 10, marginBottom: 2, color: 'var(--text-dim)' }}>
                        <span style={{ fontWeight: 600, color: '#3b82f6' }}>
                          {b.type === 'breathing' ? 'Дыхание' : b.type === 'stretch' ? 'Растяжка' : 'Заминка'} ({b.durationSec}с)
                        </span>
                        {b.exercises?.map((ex, exi) => (
                          <span key={exi} style={{ marginLeft: 6, color: 'var(--text-dim)' }}>
                            {WARMUP_LABELS[ex.exerciseId] || ex.exerciseId.replace(/_/g, ' ')}
                          </span>
                        ))}
                      </div>
                    ))}
                  </div>
                );
              })(              )}

              {/* Custom added exercises */}
              {customExercises.length > 0 && (
                <div className="card" style={{ padding: '8px 10px', border: '1px dashed rgba(139,92,246,0.3)' }}>
                  <div style={{ fontWeight: 600, fontSize: 11, color: '#8b5cf6', marginBottom: 4 }}>📝 Добавленные ({customExercises.length})</div>
                  {customExercises.map((ce, ci) => (
                    <div key={ci} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 10, padding: '2px 0', borderBottom: ci < customExercises.length - 1 ? '1px solid var(--border)' : 'none' }}>
                      <span>{ce.name}</span>
                      <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{ce.sets}×{ce.reps}</span>
                      <span style={{ color: 'var(--text-dim)', fontSize: 9 }}>RIR {ce.rir}</span>
                      <button onClick={() => setCustomExercises(customExercises.filter((_, i) => i !== ci))} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 12, padding: 0 }}>×</button>
                    </div>
                  ))}
                </div>
              )}

              {/* Intensity zone distribution (TZ) */}
              {currentMicrocycle?.days && (
                <div className="card" style={{ padding: '8px 10px', marginTop: 8 }}>
                  <div style={{ fontWeight: 600, fontSize: 11, color: 'var(--accent)', marginBottom: 4 }}>📊 Зоны интенсивности</div>
                  {(() => {
                    const reps = currentMicrocycle.days.filter((d: any) => d.isTraining)
                      .flatMap((d: any) => d.exercises?.map((e: any) => parseInt(String(e.reps)) || 8) || []) || [];
                    const str = reps.filter(r => r >= 1 && r <= 6).length;
                    const hyp = reps.filter(r => r >= 7 && r <= 12).length;
                    const end = reps.filter(r => r >= 13).length;
                    const total = reps.length || 1;
                    return (
                      <div key="intensity-zones">
                        <div style={{ display: 'flex', gap: 2, height: 18, borderRadius: 6, overflow: 'hidden', marginBottom: 4 }}>
                          <div style={{ flex: str || 0.1, background: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, color: '#fff', fontWeight: 600, minWidth: str > 0 ? 20 : 0 }}>
                            {str > 0 ? `${Math.round((str/total)*100)}%` : ''}
                          </div>
                          <div style={{ flex: hyp || 0.1, background: '#22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, color: '#fff', fontWeight: 600, minWidth: hyp > 0 ? 20 : 0 }}>
                            {hyp > 0 ? `${Math.round((hyp/total)*100)}%` : ''}
                          </div>
                          <div style={{ flex: end || 0.1, background: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, color: '#fff', fontWeight: 600, minWidth: end > 0 ? 20 : 0 }}>
                            {end > 0 ? `${Math.round((end/total)*100)}%` : ''}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 8, fontSize: 9, color: 'var(--text-dim)' }}>
                          <span>🔴 Сила ({str})</span><span>🟢 Гипертрофия ({hyp})</span><span>🔵 Выносливость ({end})</span>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Workout nutrition tips */}
              <div className="card" style={{ padding: '8px 10px', border: '1px solid rgba(255,165,2,0.2)', marginTop: 8 }}>
                <div style={{ fontWeight: 600, fontSize: 11, color: '#ffa502', marginBottom: 4 }}>🍎 Питание вокруг тренировки</div>
                <div style={{ fontSize: 10, color: 'var(--text-dim)', lineHeight: 1.5 }}>
                  {goal === 'bulk' ? 'За 60-120 минут до тренировки: углеводы + белок. После: белок 30-40 г и углеводы по аппетиту.' :
                   goal === 'cut' ? 'Перед тренировкой оставьте часть дневных углеводов. После тренировки держите белок и не превышайте дефицит.' :
                   goal === 'strength' ? 'Перед тяжёлой сессией добавьте быстрые углеводы и соль; после восстановите жидкость и белок.' :
                   'Держите стабильный белок и распределяйте углеводы вокруг самых тяжёлых тренировок.'}
                </div>
              </div>

              {/* Strength balance (TZ 38) */}
              {trainingOutput.volumePerGroup && (() => {
                const groups = trainingOutput.volumePerGroup as Record<string, number>;
                const pushVol = (groups.chest || 0) + (groups.shoulders || 0);
                const pullVol = (groups.back || 0);
                const quadVol = groups.legs || 0;
                const ratio = pullVol > 0 ? (pushVol / pullVol).toFixed(1) : '—';
                const balanced = parseFloat(ratio as string) >= 0.8 && parseFloat(ratio as string) <= 1.2;
                return (
                  <div key="strength-balance" className="card" style={{ padding: '8px 10px', border: '1px solid rgba(139,92,246,0.2)' }}>
                    <div style={{ fontWeight: 600, fontSize: 11, color: '#8b5cf6', marginBottom: 4 }}>⚖️ Баланс нагрузки</div>
                    <div style={{ display: 'flex', gap: 8, fontSize: 10, color: 'var(--text-dim)' }}>
                      <span>Push/Pull: <b style={{ color: balanced ? '#22c55e' : '#ff9100' }}>{ratio}</b> {balanced ? '✓' : '⚠'}</span>
                      <span>Ноги/Верх: <b>{(quadVol / Math.max(1, pushVol + pullVol)).toFixed(1)}</b></span>
                    </div>
                  </div>
                );
              })(                  )}

              {/* Overtraining risk assessment */}
              {currentMicrocycle && (() => {
                const acRatio = currentMicrocycle.volumeMultiplier * 100 / 85;
                const riskScore = (acRatio > 120 ? 3 : acRatio > 100 ? 1 : 0) + (sleepHours < 6 ? 2 : sleepHours < 7 ? 1 : 0) + (stressLevel > 7 ? 2 : stressLevel > 5 ? 1 : 0);
                const riskLabel = riskScore >= 5 ? '🚨 Высокий риск перегрузки' : riskScore >= 3 ? '⚠️ Умеренный риск' : riskScore >= 1 ? '⚡ Повышенная нагрузка' : '';
                if (!riskLabel) return null;
                return (
                  <div key="overtraining-risk" className="card" style={{ padding: '6px 10px', border: `1px solid ${riskScore >= 5 ? 'rgba(239,68,68,0.3)' : 'rgba(255,145,0,0.3)'}`, background: riskScore >= 5 ? 'rgba(239,68,68,0.05)' : 'rgba(255,145,0,0.05)' }}>
                    <div style={{ fontSize: 10, color: riskScore >= 5 ? '#ef4444' : '#ff9100', fontWeight: 600 }}>
                      {riskLabel} — {riskScore >= 5 ? 'снизьте объём и добавьте отдых' : riskScore >= 3 ? 'контролируйте сон, стресс и RPE' : 'следите за восстановлением'}
                    </div>
                  </div>
                );
              })()}

              {trainingOutput.volumePerGroup && (
                <div className="card" style={{ padding: '10px 12px' }}>
                  <h4 style={{ margin: '0 0 6px', fontSize: 12 }}>📊 Объём по группам</h4>
                  {Object.entries(trainingOutput.volumePerGroup).map(([g, v]) => (
                    <div key={g} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 11, minWidth: 50 }}>{GROUP_LABELS[g] || g}</span>
                      <div style={{ flex: 1, background: 'rgba(255,255,255,0.05)', borderRadius: 3, height: 6, overflow: 'hidden' }}>
                        <div style={{ width: `${Math.min(100, v / 2)}%`, height: '100%', background: 'var(--accent)', borderRadius: 3 }} />
                      </div>
                      <span style={{ fontSize: 10, color: 'var(--text-dim)', minWidth: 40, textAlign: 'right' }}>{v} подх</span>
                    </div>
                  ))}
                  {trainingOutput.estimatedProgress !== undefined && (
                    <div style={{ marginTop: 6, padding: '6px 8px', background: 'rgba(0,230,138,0.05)', borderRadius: 6, fontSize: 10 }}>
                      <span style={{ color: 'var(--accent)', fontWeight: 600 }}>📈 Прогресс: +{trainingOutput.estimatedProgress}%/нед</span>
                      <span style={{ color: 'var(--text-dim)', marginLeft: 8 }}>
                        {trainingOutput.progressionModel || '—'} · {cycleType === 'auto' ? 'Автоцикл' : cycleType}
                      </span>
                      <span style={{ color: 'var(--text-dim)', marginLeft: 6, fontSize: 9 }}>
                        {goal} · {periodizationType !== 'auto' ? periodizationType : ''}
                      </span>
                    </div>
                  )}
                  {/* Workload ratio + Monotony/Strain (TZ 71-72) */}
                  {currentMicrocycle && (
                    <div style={{ marginTop: 4, padding: '6px 8px', background: 'rgba(255,255,255,0.03)', borderRadius: 4, fontSize: 9 }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-dim)' }}>🔬 Нагрузка: </span>
                      <span style={{ color: 'var(--accent)' }}>Острая: {Math.round(currentMicrocycle.volumeMultiplier * bodyWeight * daysPerWeek)} кг/нед</span>
                      <span style={{ color: 'var(--text-dim)', marginLeft: 4 }}>
                        Хрон.: {Math.round(currentMicrocycle.volumeMultiplier * bodyWeight * daysPerWeek * 0.85)} кг/нед
                      </span>
                      <span style={{ marginLeft: 4, color: currentMicrocycle.volumeMultiplier > 1.2 ? '#ef4444' : currentMicrocycle.mesocycleType === 'deload' ? '#22c55e' : '#ff9100' }}>
                        A/C: {(currentMicrocycle.volumeMultiplier * 100 / 85).toFixed(0)}%
                      </span>
                      {currentMicrocycle.volumeMultiplier > 1.3 && (
                        <span style={{ marginLeft: 4, color: '#ef4444', fontWeight: 600 }}>⚠ Высокий риск перегрузки</span>
                      )}
                      <span style={{ marginLeft: 4, color: sleepHours < 6 ? '#ef4444' : sleepHours < 7 ? '#ff9100' : '#22c55e' }}>
                        Сон: {sleepHours}ч | Стресс: {stressLevel}/10
                      </span>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
        </InfoErrorBoundary>
      )}

      {/* ═══════════ RUNTIME (Live Workout) ═══════════ */}
      {tab === 'runtime' && (
        <InfoErrorBoundary label="Тренировка">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Запуск построенного плана СРЦ/ББ (перенесено из подвкладки «Выполнение») */}
          {plRuntime && plRuntime.days.length > 0 && !plRunOpen && !runtimeStarted && (
            <div className="card" style={{ padding: '12px', border: '1px solid rgba(0,230,138,0.25)', background: 'rgba(0,230,138,0.06)' }}>
              <h3 style={{ margin: '0 0 4px', fontSize: 13, color: 'var(--accent)' }}>▶ Запустить построенный план ({plRuntime.track === 'bb' ? 'ББ' : 'ПЛ'})</h3>
              <p style={{ fontSize: 11, color: 'var(--text-dim)', margin: '0 0 8px' }}>Неделя {plRuntime.week} · {plRuntime.days.length} дн. · фокус: {plRuntime.focus}. Выполнение записывается в дневник тренировок.</p>
              <button onClick={() => setPlRunOpen(true)} style={{ width: '100%', padding: 12, borderRadius: 8, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg, var(--accent), #00c853)', color: '#000', fontWeight: 700, fontSize: 14 }}>▶ Начать выполнение</button>
            </div>
          )}
          {plRunOpen && plRuntime && plRuntime.days.length > 0 && (
            <div className="card" style={{ padding: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <h3 style={{ margin: 0, fontSize: 13, color: 'var(--accent)' }}>▶ Выполнение плана · {plRuntime.focus}</h3>
                <button onClick={() => setPlRunOpen(false)} style={{ padding: '5px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 11 }}>✕ Закрыть</button>
              </div>
              <SessionPlayer days={plRuntime.days} weekNumber={plRuntime.week} focus={plRuntime.focus} />
            </div>
          )}
          {!runtimeStarted ? (
            <div className="card" style={{ padding: '12px' }}>
              <h3 style={{ margin: '0 0 8px', fontSize: 14 }}>🏃 Начать тренировку</h3>
              <p style={{ fontSize: 11, color: 'var(--text-dim)', margin: '0 0 10px' }}>
                Выберите день из плана для отслеживания подходов в реальном времени.
              </p>
              {macrocycle && currentMicrocycle ? (
                <>
                  <div style={{ display: 'flex', gap: 4, marginBottom: 8, flexWrap: 'wrap' }}>
                    {(() => { const _td = currentMicrocycle.days.filter((d: any) => d.isTraining); const _todayIdx = (((new Date().getDay() + 6) % 7)) % Math.max(1, _td.length); return (
                      <button onClick={() => setRuntimeDay(_todayIdx)} title="Сегодня (по дню недели)" style={{ padding: '6px 12px', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer', background: 'rgba(0,230,138,0.12)', color: 'var(--accent)', border: '1px solid rgba(0,230,138,0.4)' }}>📅 Сегодня</button>
                    ); })()}
                    {currentMicrocycle.days.filter((d: any) => d.isTraining).map((day: any, di: number) => (
                      <button key={di} onClick={() => setRuntimeDay(di)} style={{
                        padding: '6px 12px', borderRadius: 8, fontSize: 11, fontWeight: runtimeDay === di ? 700 : 400, cursor: 'pointer',
                        background: runtimeDay === di ? 'var(--accent)' : 'var(--bg-secondary)',
                        color: runtimeDay === di ? '#000' : 'var(--text)', border: '1px solid ' + (runtimeDay === di ? 'var(--accent)' : 'var(--border)'),
                      }}>{day.day}</button>
                    ))}
                  </div>
            <div style={{ background: 'var(--bg-secondary)', borderRadius: 6, padding: 8, marginBottom: 8 }}>
              <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>
                {currentMicrocycle.days.filter((d: any) => d.isTraining)[runtimeDay]?.exercises?.length || 0} упражнений • {currentMicrocycle.days.filter((d: any) => d.isTraining)[runtimeDay]?.duration || 60} мин
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2 }}>
                Интенсивность: {currentMicrocycle.days.filter((d: any) => d.isTraining)[runtimeDay]?.intensity || 'средняя'} | Схема: {currentMicrocycle.mesocycleType || ''}
              </div>
              <div style={{ fontSize: 10, color: 'var(--accent)', marginTop: 2, fontWeight: 600 }}>
                Расчётный тоннаж: {currentMicrocycle.days.filter((d: any) => d.isTraining)[runtimeDay]?.exercises?.reduce((sum: number, ex: any) => sum + (ex.sets || 0) * (Number(ex.reps) || 0) * (ex.weight || 0), 0) || 0} кг
              </div>
            </div>
                  {/* Session difficulty estimate */}
                  {(() => {
                    const dayExercises = currentMicrocycle.days.filter((d: any) => d.isTraining)[runtimeDay]?.exercises || [];
                    const totalSets = dayExercises.reduce((s: number, e: any) => s + (e.sets || 0), 0);
                    const avgIntensity = dayExercises.length > 0
                      ? dayExercises.reduce((s: number, e: any) => s + (e.intensity || 70), 0) / dayExercises.length
                      : 70;
                    const difficulty = totalSets > 25 ? 'очень тяжёлая' : totalSets > 15 ? 'средняя' : 'лёгкая';
                    const color = totalSets > 25 ? '#ef4444' : totalSets > 15 ? '#f59e0b' : '#22c55e';
                    return (
                      <div style={{ fontSize: 10, margin: '6px 0', padding: '6px 8px', borderRadius: 6, background: 'rgba(255,255,255,0.03)' }}>
                        <span style={{ color: 'var(--text-dim)' }}>Сложность: </span>
                        <span style={{ fontWeight: 600, color }}>{difficulty}</span>
                        <span style={{ color: 'var(--text-dim)', marginLeft: 6 }}>· {totalSets} подходов · ~{avgIntensity.toFixed(0)}% ср.</span>
                        {totalSets > 25 && (
                          <div style={{ color: '#f97316', marginTop: 2 }}>⚠ Высокий объём — отдых ≥ 3 мин между подходами</div>
                        )}
                      </div>
                    );
                  })()}
                  <button onClick={() => { setRuntimeStarted(true); setRuntimeLogs({}); setRuntimeExIdx(0); }} style={{
                    width: '100%', padding: 12, borderRadius: 8, border: 'none', cursor: 'pointer',
                    background: 'linear-gradient(135deg, var(--accent), #00c853)', color: '#000', fontWeight: 700, fontSize: 14,
                  }}>▶ Старт</button>
                </>
              ) : (
                <div style={{ textAlign: 'center', color: 'var(--text-dim)', fontSize: 11 }}>
                  Сначала сгенерируйте план во вкладке 📋 План
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Active workout */}
              {currentMicrocycle && (() => {
                const day = currentMicrocycle.days.filter((d: any) => d.isTraining)[runtimeDay];
                if (!day) return null;
                const exercises = day.exercises || [];
                const ex = exercises[runtimeExIdx];
                if (!ex) return (
                  <div className="card" style={{ textAlign: 'center', padding: 20 }}>
                    <div style={{ fontSize: 28, marginBottom: 8 }}>🏆</div>
                    <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Тренировка завершена!</div>
                    <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 12 }}>
                      {Object.values(runtimeLogs).filter(l => l.completed).length} из {exercises.length} упражнений выполнено
                    </div>
                    {/* Summary stats */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 12, fontSize: 10 }}>
                      {(() => {
                        const totalSets = Object.values(runtimeLogs).reduce((s, l) => s + l.sets.length, 0);
                        const totalVolume = Object.values(runtimeLogs).reduce((s, l) => s + l.sets.reduce((ss, st) => ss + st.weight * st.reps, 0), 0);
                        const max1RM = Object.values(runtimeLogs).reduce((max, l) => {
                          const local = l.sets.reduce((m, st) => Math.max(m, Math.round(st.weight * (1 + st.reps / 30))), 0);
                          return Math.max(max, local);
                        }, 0);
                        return (
                          <>
                            <div style={{ background: 'rgba(0,230,138,0.08)', borderRadius: 6, padding: 6 }}>
                              <div style={{ color: 'var(--text-dim)', fontSize: 8 }}>Подходов</div>
                              <div style={{ fontWeight: 700, color: 'var(--accent)' }}>{totalSets}</div>
                            </div>
                            <div style={{ background: 'rgba(0,230,138,0.08)', borderRadius: 6, padding: 6 }}>
                              <div style={{ color: 'var(--text-dim)', fontSize: 8 }}>Тоннаж</div>
                              <div style={{ fontWeight: 700, color: 'var(--accent)' }}>{totalVolume.toLocaleString()} кг</div>
                            </div>
                            <div style={{ background: 'rgba(0,230,138,0.08)', borderRadius: 6, padding: 6 }}>
                              <div style={{ color: 'var(--text-dim)', fontSize: 8 }}>Макс 1RM</div>
                              <div style={{ fontWeight: 700, color: 'var(--accent)' }}>{max1RM} кг</div>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                      <button onClick={async () => {
                        // Save completed workout to IndexedDB
                        const completedExercises = Object.entries(runtimeLogs)
                          .filter(([_, log]) => log.sets.length > 0)
                          .map(([exId, log]) => ({
                            exerciseId: exId,
                            exerciseName: EXERCISE_CATALOG.find(e => e.id === exId)?.name || exId,
                            sets: log.sets,
                            totalVolume: log.sets.reduce((sum, s) => sum + s.weight * s.reps, 0),
                            maxWeight: Math.max(...log.sets.map(s => s.weight), 0),
                            estimated1RM: log.sets.length > 0
                              ? Math.round(log.sets[log.sets.length - 1].weight * (1 + log.sets[log.sets.length - 1].reps / 30))
                              : 0,
                          }));
                        const totalVolume = completedExercises.reduce((s, e) => s + e.totalVolume, 0);
                        if (completedExercises.length > 0) {
                          const dateStr = new Date().toISOString().split('T')[0];
                          const ts = Date.now();
                          const strengthEntries = completedExercises.map((ex, i) => ({
                            id: `log_${ts}_${i}`,
                            date: dateStr,
                            exerciseId: ex.exerciseId,
                            exerciseName: ex.exerciseName,
                            sets: ex.sets,
                            totalVolume: ex.totalVolume,
                            estimated1RM: ex.estimated1RM,
                            isCompound: EXERCISE_CATALOG.find(e => e.id === ex.exerciseId)?.type === 'compound',
                            weekNumber: selectedWeek,
                          }));
                          await diary.saveWorkoutLog({
                            id: `workout_${ts}`,
                            date: dateStr,
                            duration: Math.round(runtimeExIdx * 5 + completedExercises.reduce((s, e) => s + e.sets.length, 0) * 3),
                            exercises: strengthEntries,
                            overallRPE: 7,
                            recoveryBefore: recovery,
                            split: trainingOutput?.splitName || 'custom',
                            weekNumber: selectedWeek,
                          });
                          for (const se of strengthEntries) {
                            await diary.saveStrengthLog(se);
                          }
                          // Reload stats and history
                          await loadDiaryStats();
                        }
                        setRuntimeStarted(false);
                        setRuntimeLogs({});
                      }} style={{
                        padding: '8px 20px', borderRadius: 8, border: 'none', cursor: 'pointer',
                        background: 'var(--accent)', color: '#000', fontWeight: 600, fontSize: 13,
                      }}>✓ Завершить</button>
                    </div>
                  </div>
                );

                const log = runtimeLogs[ex.exerciseId || ex.name] || { sets: [], completed: false };
                const totalSets = ex.sets || 3;
                const currentSet = log.sets.length + 1;

                const last1RM = log.sets.length > 0
                  ? Math.round(log.sets[log.sets.length - 1].weight * (1 + log.sets[log.sets.length - 1].reps / 30))
                  : 0;

                const estimatedVolume = log.sets.reduce((s, st) => s + st.weight * st.reps, 0);
                const avgRPE = log.sets.length > 0 ? Math.round(log.sets.reduce((s, st) => s + st.rpe, 0) / log.sets.length * 10) / 10 : 0;

                const scheme = selectSetScheme({
                  goal, movementPattern: 'squat' as MovementPattern, difficultyLevel: level === 'beginner' ? 'low' : level === 'intermediate' ? 'medium' : 'high',
                  techniqueIssues: [], riskFlags: {}, fatigueScore: 0.3, repPattern: 'normal', isPrimaryLift: runtimeExIdx === 0,
                });
                const tempo = selectTempo(goal, [], {}, ex.isCompound);

                return (
                  <div className="card" style={{ padding: '10px 12px' }}>
                    {/* Exercise header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <div>
                        <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>Упражнение {runtimeExIdx + 1}/{exercises.length}</span>
                        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)' }}>{ex.name}</div>
                      </div>
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>  
                        <span style={{ fontSize: 9, padding: '2px 5px', borderRadius: 3, background: 'rgba(0,230,138,0.1)', color: '#00e68a' }}>{scheme?.schemeType || 'straight'}</span>
                        <span style={{ fontSize: 9, padding: '2px 5px', borderRadius: 3, background: 'rgba(34,197,94,0.1)', color: '#22c55e' }}>{formatTempo(tempo)}</span>
                      </div>
                    </div>

                    {/* Target */}
                    <div style={{ display: 'flex', gap: 12, marginBottom: 4, fontSize: 10, color: 'var(--text-dim)' }}>
                      <span>Цель: {ex.sets}×{ex.reps}</span>
                      <span>RIR: {ex.rir}</span>
                      {ex.weight && <span>Вес: {ex.weight}кг | ~{Math.round(ex.weight * (1 + Number(ex.reps) / 30))}кг 1RM</span>}
                    </div>

                    {/* Technique note */}
                    {ex.technique && (
                      <div style={{ marginBottom: 6, padding: '5px 8px', background: 'rgba(0,230,138,0.05)', borderRadius: 6, fontSize: 9, color: 'var(--text)', lineHeight: 1.4 }}>
                        <span style={{ fontWeight: 600, color: 'var(--accent)' }}>🎯 </span>{ex.technique}
                      </div>
                    )}

                    {/* Warmup ramp-up (first set only) */}
                    {log.sets.length === 0 && ex.weight && (
                      <div style={{ marginBottom: 6, padding: '5px 8px', background: 'rgba(255,145,0,0.05)', borderRadius: 6, fontSize: 9 }}>
                        <div style={{ fontWeight: 600, color: '#ff9100', marginBottom: 3 }}>🔥 Разминочные подходы</div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 2, color: 'var(--text-dim)' }}>
                          {[{ pct: 20, reps: 10 }, { pct: 40, reps: 5 }, { pct: 60, reps: 3 }, { pct: 75, reps: 1 }].map(wu => (
                            <div key={wu.pct} style={{ textAlign: 'center', padding: '2px 4px', background: 'rgba(255,145,0,0.08)', borderRadius: 3 }}>
                              <div style={{ color: '#ff9100', fontWeight: 600 }}>~{Math.round((ex.weight || 80) * wu.pct / 100)}кг</div>
                              <div style={{ fontSize: 7 }}>{wu.reps} повт</div>
                              <div style={{ fontSize: 7 }}>{wu.pct}%</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Progress bar */}
                    <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 4, height: 6, marginBottom: 8, overflow: 'hidden' }}>
                      <div style={{ width: `${(currentSet / totalSets) * 100}%`, height: '100%', background: 'var(--accent)', borderRadius: 4, transition: 'width 0.3s' }} />
                    </div>

                    {/* Previous sets log */}
                    {log.sets.length > 0 && (
                      <div style={{ marginBottom: 8 }}>
                        <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-dim)', marginBottom: 2 }}>Выполнено:</div>
                        {log.sets.map((s, si) => (
                          <div key={si} style={{ display: 'flex', gap: 8, fontSize: 10, padding: '2px 0' }}>
                            <span style={{ fontWeight: 600, minWidth: 16 }}>#{si + 1}</span>
                            <span>{s.weight}кг × {s.reps}</span>
                            <span style={{ color: 'var(--text-dim)' }}>RPE {s.rpe}</span>
                            <span style={{ color: 'var(--text-dim)' }}>RIR {s.rir}</span>
                            <span style={{ color: 'var(--accent)' }}>1RM ~{Math.round(s.weight * (1 + s.reps / 30))}кг</span>
                          </div>
                        ))}
                        {last1RM > 0 && (
                          <div style={{ fontSize: 9, color: 'var(--accent)', marginTop: 2 }}>1RM последний: {last1RM}кг | Объём: {estimatedVolume}кг | RPE ср: {avgRPE}</div>
                        )}
                        {/* Autoregulation hint */}
                        {log.sets.length >= 1 && (() => {
                          const lastSet = log.sets[log.sets.length - 1];
                          let hint = '';
                          let hintColor = 'var(--text-dim)';
                          if (lastSet.rpe <= 5 && lastSet.rir >= 3) {
                            hint = 'Подход лёгкий: можно добавить 2.5-5 кг или 1-2 повтора в следующем подходе.';
                            hintColor = '#22c55e';
                          } else if (lastSet.rpe >= 9.5 && lastSet.rir <= 0) {
                            hint = 'Подход на пределе: снизьте вес на 5-10% или завершите упражнение.';
                            hintColor = '#ef4444';
                          } else if (lastSet.rpe >= 8.5 && lastSet.rir <= 1) {
                            hint = 'Высокая тяжесть: сохраняйте вес, но не идите в отказ.';
                            hintColor = '#f59e0b';
                          }
                          if (!hint) return null;
                          return <div style={{ fontSize: 9, color: hintColor, marginTop: 2, fontWeight: 600 }}>{hint}</div>;
                        })()}
                      </div>
                    )}

                    {/* Set input form (if not completed) */}
                    {!log.completed && (
                      <div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 6 }}>
                          <div>
                            <label style={{ fontSize: 9, color: 'var(--text-dim)' }}>Вес (кг)</label>
                            <input type="number" value={runtimeSetW} onChange={e => setRuntimeSetW(parseFloat(e.target.value) || 0)}
                              style={{ width: '100%', padding: '6px 8px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 13, boxSizing: 'border-box' }} />
                          </div>
                          <div>
                            <label style={{ fontSize: 9, color: 'var(--text-dim)' }}>Повторения</label>
                            <input type="number" value={runtimeSetR} onChange={e => setRuntimeSetR(parseFloat(e.target.value) || 0)}
                              style={{ width: '100%', padding: '6px 8px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 13, boxSizing: 'border-box' }} />
                          </div>
                          <div>
                            <label style={{ fontSize: 9, color: 'var(--text-dim)' }}>RPE (1-10)</label>
                            <input type="number" min={1} max={10} value={runtimeSetRP} onChange={e => setRuntimeSetRP(parseFloat(e.target.value) || 0)}
                              style={{ width: '100%', padding: '6px 8px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 13, boxSizing: 'border-box' }} />
                          </div>
                          <div>
                            <label style={{ fontSize: 9, color: 'var(--text-dim)' }}>RIR</label>
                            <input type="number" min={0} max={5} value={runtimeSetRI} onChange={e => setRuntimeSetRI(parseFloat(e.target.value) || 0)}
                              style={{ width: '100%', padding: '6px 8px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 13, boxSizing: 'border-box' }} />
                          </div>
                        </div>
                        <button onClick={() => {
                          const newLog = { ...log, sets: [...log.sets, { weight: runtimeSetW, reps: runtimeSetR, rpe: runtimeSetRP, rir: runtimeSetRI }] };
                          setRuntimeLogs({ ...runtimeLogs, [ex.exerciseId || ex.name]: newLog });
                        }} style={{
                          width: '100%', padding: 8, borderRadius: 6, border: 'none', cursor: 'pointer',
                          background: 'var(--accent)', color: '#000', fontWeight: 600, fontSize: 12,
                          marginBottom: 4,
                        }}>✓ Записать подход {currentSet}/{totalSets}</button>
                        <button onClick={() => {
                          const newLog = { ...log, completed: true };
                          setRuntimeLogs({ ...runtimeLogs, [ex.exerciseId || ex.name]: newLog });
                          if (runtimeExIdx < exercises.length - 1) setRuntimeExIdx(runtimeExIdx + 1);
                        }} style={{
                          width: '100%', padding: 6, borderRadius: 6, border: '1px solid var(--border)', cursor: 'pointer',
                          background: 'transparent', color: 'var(--text-dim)', fontSize: 11,
                        }}>Пропустить →</button>
                      </div>
                    )}
                    {log.completed && (
                      <div style={{ textAlign: 'center', padding: 8, background: 'rgba(0,230,138,0.1)', borderRadius: 6 }}>
                        <span style={{ color: '#22c55e', fontWeight: 600 }}>✓ Выполнено — {log.sets.length} подхода(ов)</span>
                        <div style={{ marginTop: 6 }}>
                          <button onClick={() => {
                            if (runtimeExIdx < exercises.length - 1) setRuntimeExIdx(runtimeExIdx + 1);
                          }} style={{
                            padding: '8px 16px', borderRadius: 6, border: 'none', cursor: 'pointer',
                            background: 'var(--accent)', color: '#000', fontWeight: 600, fontSize: 13,
                          }}>Следующее упражнение →</button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </>
          )}
        </div>
        </InfoErrorBoundary>
      )}

      {/* ═══════════ EXERCISES TAB (Apple-style) ═══════════ */}
      {tab === 'exercises' && (
        <InfoErrorBoundary label="Упражнения">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {/* Search + filters */}
          <div style={{ background:'var(--bg-secondary)', borderRadius:14, padding:'8px 10px', border:'1px solid var(--border)' }}>
            <input type="text" value={exSearch} onChange={e => setExSearch(e.target.value)}
              placeholder="🔍 Поиск упражнений..." 
              style={{ width:'100%', padding:'10px 12px', borderRadius:10, background:'rgba(0,0,0,0.2)', border:'1px solid var(--border)', color:'var(--text)', fontSize:13, boxSizing:'border-box', marginBottom:6 }} />
            <div style={{ display:'flex', gap:4 }}>
              {[{ key:'exGroup', val:exGroup, set:(v:string)=>setExGroup(v), opts:[['all','Группа'],...MUSCLE_GROUPS.map(g=>[g,GROUP_LABELS[g]] as [string,string])] },
                { key:'exType', val:exType, set:(v:string)=>setExType(v), opts:[['all','Тип'],['compound','Базовые'],['isolation','Изо']] },
                { key:'exEquipment', val:exEquipment, set:(v:string)=>setExEquipment(v), opts:[['all','Инвентарь'],['barbell','Штанга'],['dumbbell','Гантели'],['machine','Тренажёр'],['cable','Блок'],['bodyweight','Вес']] },
                { key:'exDifficulty', val:exDifficulty, set:(v:string)=>setExDifficulty(v), opts:[['all','Сложность'],['beginner','Начальные'],['intermediate','Средние'],['advanced','Продвинутые']] }
              ].map(f => (
                <select key={f.key} value={f.val} onChange={e => f.set(e.target.value)} style={{ flex:1, padding:'7px 4px', borderRadius:8, background:'rgba(0,0,0,0.2)', border:'1px solid var(--border)', color:'var(--text)', fontSize:10, fontWeight:600, textAlign:'center', minWidth:0 }}>
                  {f.opts.map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              ))}
            </div>
          </div>

          {/* Exercise list */}
          <div style={{ display:'flex', flexDirection:'column', gap:4, maxHeight:'50vh', overflowY:'auto', paddingRight:2 }}>
            {filteredExercises.slice(0, exVisible).map(ex => {
              const isSelected = selectedEx?.id === ex.id;
              const typeIcon = ex.type === 'compound' ? '🔩' : '🎯';
              const equipIcon = { barbell:'🏋️', dumbbell:'💪', machine:'⚙️', cable:'🔗', bodyweight:'🧘' }[ex.equipment] || '📦';
              return (
                <div key={ex.id} onClick={() => setSelectedEx(isSelected ? null : ex)} style={{
                  padding:'8px 10px', borderRadius:12, cursor:'pointer',
                  background: isSelected ? 'linear-gradient(135deg, rgba(0,230,138,0.08), rgba(59,130,246,0.04))' : 'var(--bg-secondary)',
                  border: isSelected ? '1px solid rgba(0,230,138,0.3)' : '1px solid var(--border)',
                  transition:'all 0.15s',
                }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <div style={{ width:32, height:32, borderRadius:10, background:isSelected?'rgba(0,230,138,0.12)':'rgba(255,255,255,0.04)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, flexShrink:0 }}>
                      {typeIcon}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:12, fontWeight:600, color:isSelected?'var(--accent)':'var(--text-light)', lineHeight:1.2 }}>{ex.name}</div>
                      <div style={{ display:'flex', gap:3, marginTop:2, flexWrap:'wrap' }}>
                        <span style={{ fontSize:8, padding:'1px 4px', borderRadius:3, background:'rgba(255,255,255,0.04)', color:'var(--text-dim)' }}>{equipIcon} {EQUIP_LABELS[ex.equipment]||ex.equipment}</span>
                        <span style={{ fontSize:8, padding:'1px 4px', borderRadius:3, background:'rgba(255,255,255,0.04)', color:'var(--text-dim)' }}>{GROUP_LABELS[ex.group]}</span>
                        <span style={{ fontSize:8, padding:'1px 4px', borderRadius:3, background:ex.jointStress==='high'?'rgba(239,68,68,0.08)':'rgba(34,197,94,0.08)', color:ex.jointStress==='high'?'#ef4444':'#22c55e' }}>{JOINT_LABELS[ex.jointStress]||ex.jointStress}</span>
                      </div>
                    </div>
                    <span style={{ fontSize:10, color:isSelected?'var(--accent)':'var(--text-dim)', transition:'transform 0.15s', transform:isSelected?'rotate(180deg)':'none' }}>▼</span>
                  </div>

                  {/* Detail panel inline (Apple bottom-sheet style) */}
                  {isSelected && (
                    <div style={{ marginTop:8, paddingTop:8, borderTop:'1px solid var(--border)' }}>
                      {/* Tags row */}
                      <div style={{ display:'flex', gap:3, flexWrap:'wrap', marginBottom:6 }}>
                        <span style={{ fontSize:8, padding:'2px 6px', borderRadius:4, background:'rgba(0,230,138,0.08)', color:'var(--accent)' }}>{ex.type==='compound'?'Базовое':'Изолирующее'}</span>
                        {ex.difficulty && <span style={{ fontSize:8, padding:'2px 6px', borderRadius:4, background:ex.difficulty==='advanced'?'rgba(239,68,68,0.08)':'rgba(249,115,22,0.08)', color:ex.difficulty==='advanced'?'#ef4444':ex.difficulty==='intermediate'?'#f97316':'#22c55e' }}>{ex.difficulty==='advanced'?'Продвинутое':ex.difficulty==='intermediate'?'Среднее':'Начальное'}</span>}
                        <span style={{ fontSize:8, padding:'2px 6px', borderRadius:4, background:'rgba(139,92,246,0.08)', color:'#8b5cf6' }}>Усталость: {ex.fatigueCost}/10</span>
                        {ex.targetMuscle && <span style={{ fontSize:8, padding:'2px 6px', borderRadius:4, background:'rgba(236,72,153,0.08)', color:'#ec4899' }}>🎯 {ex.targetMuscle}</span>}
                      </div>
                      {/* Technique */}
                      {ex.technique && <div style={{ marginBottom:4, background:'rgba(0,230,138,0.04)', borderRadius:8, padding:'6px 8px', fontSize:10, color:'var(--text)', lineHeight:1.4 }}>🎯 {ex.technique}</div>}
                      {/* Comments */}
                      {ex.comments && <div style={{ marginBottom:4, background:'rgba(255,145,0,0.04)', borderRadius:8, padding:'6px 8px', fontSize:10, color:'var(--text-dim)', lineHeight:1.4 }}>💡 {ex.comments}</div>}
                      {/* Biomechanics */}
                      {(() => { const bio = getExerciseBio(ex.id); if (!bio) return null; const js = bio.jointStress; const strs = Object.entries(js||{}).map(([k,v])=>`${k} ${v}/10`); return <div style={{ marginBottom:4, background:'rgba(59,130,246,0.04)', borderRadius:8, padding:'5px 8px', fontSize:8, color:'var(--text-dim)' }}>
                        🔬 Биомеханика: {strs.join(', ')} | Сложность: {bio.difficulty}/10 | ЦНС: {bio.cnsDemand||5}/10
                      </div>; })()}
                      {/* Replacements */}
                      {ex.canReplace && ex.canReplace.length > 0 && <div style={{ display:'flex', flexWrap:'wrap', gap:3, alignItems:'center', marginBottom:4 }}>
                        <span style={{ fontSize:8, color:'var(--text-dim)' }}>Замена:</span>
                        {ex.canReplace.map(r => { const rep = EXERCISE_CATALOG.find(e => e.id === r); return rep ? <span key={r} style={{ fontSize:8, padding:'1px 5px', borderRadius:3, background:'rgba(0,230,138,0.06)', color:'var(--accent)' }}>{rep.name}</span> : null; })}
                      </div>}
                      {/* Add to plan button */}
                      <button onClick={() => {
                        setCustomExercises([...customExercises, { name: ex.name, sets:3, reps:10, rir:2 }]);
                        setLastAddedEx(ex.id);
                        setTimeout(() => setLastAddedEx(null), 1500);
                        setSelectedEx(null);
                      }} style={{
                        width:'100%', marginTop:4, padding:'8px', borderRadius:8,
                        border: lastAddedEx === ex.id ? '1px solid rgba(0,230,138,0.5)' : '1px solid rgba(0,230,138,0.3)',
                        background: lastAddedEx === ex.id ? 'rgba(0,230,138,0.15)' : 'rgba(0,230,138,0.06)',
                        color: lastAddedEx === ex.id ? 'var(--accent)' : 'var(--accent)', fontWeight:700, fontSize:11, cursor:'pointer',
                        transition:'all 0.3s',
                      }}>{lastAddedEx === ex.id ? '✓ Добавлено!' : '+ Добавить в план'}</button>
                    </div>
                  )}
                </div>
              );
            })}
            {filteredExercises.length === 0 && <div style={{ textAlign:'center', padding:20, color:'var(--text-dim)', fontSize:11 }}>Упражнения не найдены</div>}
            {filteredExercises.length > exVisible && (
              <button onClick={() => setExVisible(v => v + 80)} style={{ width:'100%', padding:10, borderRadius:8, border:'1px solid rgba(0,230,138,0.2)', background:'rgba(0,230,138,0.04)', color:'var(--accent)', cursor:'pointer', fontSize:11, fontWeight:600, marginTop:4 }}>▼ Показать ещё ({filteredExercises.length - exVisible} из {filteredExercises.length})</button>
            )}
          </div>
        </div>
        </InfoErrorBoundary>
      )}

      {/* ═══════════ CALCULATORS TAB (also serves programcalc) ═══════════ */}
      {(tab === 'calculators' || tab === 'programcalc') && (
        <InfoErrorBoundary label="Калькуляторы">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {tab === 'calculators' && <TrainingLoadCalculator />}
          {tab === 'calculators' && <TonnageCalcTab />}
          {tab === 'calculators' && <WhatIfCard baseRisk={linked.risk?.overallNet ?? 5} baseReadiness={linked.readiness?.recovery ?? 70} />}
          {showNonBuilder && (<>
          <div className="card" style={{ padding: '12px 14px', background:'rgba(20,22,30,0.35)', border:'1px solid var(--glass-border)', borderRadius:14 }}>
            <h3 style={{ margin: '0 0 4px', fontSize: 13, color:'var(--accent)' }}>📐 Калькулятор 1RM</h3>
            <div style={{ fontSize:9, color:'var(--text-dim)', marginBottom:10 }}>Вес × Повторения → 1ПМ</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
              <div>
                <label style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom:3, display:'block' }}>Вес (кг)</label>
                <input type="number" value={calcWeight || ''} onChange={e => setCalcWeight(parseFloat(e.target.value) || 0)} style={{ width: '100%', padding: '10px 12px', borderRadius: 12, background: 'rgba(255,255,255,0.06)', border: '1px solid var(--glass-border)', color: 'var(--text)', fontSize: 14, boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom:3, display:'block' }}>Повторения</label>
                <input type="number" value={calcReps || ''} onChange={e => setCalcReps(parseFloat(e.target.value) || 0)} style={{ width: '100%', padding: '10px 12px', borderRadius: 12, background: 'rgba(255,255,255,0.06)', border: '1px solid var(--glass-border)', color: 'var(--text)', fontSize: 14, boxSizing: 'border-box' }} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
              <div style={{ background: 'rgba(0,230,138,0.1)', borderRadius: 12, padding: 10, textAlign: 'center', border:'1px solid rgba(0,230,138,0.15)' }}>
                <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>Epley</div>
                <div style={{ fontSize: 20, fontWeight: 800, background:'linear-gradient(135deg, var(--accent), #00c853)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>{calcResults.epley1RM.toFixed(1)}</div>
                <div style={{ fontSize: 8, color: 'var(--text-dim)' }}>кг</div>
              </div>
              <div style={{ background: 'rgba(59,130,246,0.1)', borderRadius: 12, padding: 10, textAlign: 'center', border:'1px solid rgba(59,130,246,0.15)' }}>
                <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>Brzycki</div>
                <div style={{ fontSize: 20, fontWeight: 800, background:'linear-gradient(135deg, #3b82f6, #60a5fa)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>{calcResults.brzycki1RM.toFixed(1)}</div>
                <div style={{ fontSize: 8, color: 'var(--text-dim)' }}>кг</div>
              </div>
              <div style={{ background: 'rgba(0,230,138,0.08)', borderRadius: 12, padding: 10, textAlign: 'center', border:'1px solid rgba(0,230,138,0.15)' }}>
                <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>Среднее</div>
                <div style={{ fontSize: 20, fontWeight: 800, background:'linear-gradient(135deg, #00e68a, #00cc7a)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>{((calcResults.epley1RM + calcResults.brzycki1RM) / 2).toFixed(1)}</div>
                <div style={{ fontSize: 8, color: 'var(--text-dim)' }}>кг</div>
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: '10px 12px' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 13 }}>📊 RPE ↔ %1RM</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 8 }}>
              <div>
                <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Вес (кг)</label>
                <input type="number" value={calcWeight} onChange={e => setCalcWeight(parseFloat(e.target.value) || 0)} style={{ width: '100%', padding: '6px 8px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Повторения</label>
                <input type="number" value={calcReps} onChange={e => setCalcReps(parseFloat(e.target.value) || 0)} style={{ width: '100%', padding: '6px 8px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>RPE (1-10)</label>
                <input type="number" min={1} max={10} value={calcRPE} onChange={e => setCalcRPE(parseFloat(e.target.value) || 0)} style={{ width: '100%', padding: '6px 8px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, boxSizing: 'border-box' }} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              <div style={{ background: 'rgba(0,230,138,0.08)', borderRadius: 8, padding: 8, textAlign: 'center' }}>
                <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>1RM (через RPE)</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--accent)' }}>{calcResults.rpe1RM.toFixed(1)}</div>
                <div style={{ fontSize: 8, color: 'var(--text-dim)' }}>кг</div>
              </div>
              <div style={{ background: 'rgba(0,230,138,0.08)', borderRadius: 8, padding: 8, textAlign: 'center' }}>
                <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>%1RM при RPE{calcRPE}</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--accent)' }}>{(calcResults.rpePercent * 100).toFixed(1)}%</div>
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: '10px 12px' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 13 }}>🎯 %1RM → Рабочий вес</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
              <div>
                <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>1RM (кг)</label>
                <input type="number" value={calc1RM} onChange={e => setCalc1RM(parseFloat(e.target.value) || 0)} style={{ width: '100%', padding: '6px 8px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>% от 1RM</label>
                <input type="number" min={30} max={100} value={calcPercent} onChange={e => setCalcPercent(parseFloat(e.target.value) || 0)} style={{ width: '100%', padding: '6px 8px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, boxSizing: 'border-box' }} />
              </div>
            </div>
            <div style={{ background: 'rgba(0,230,138,0.08)', borderRadius: 8, padding: 10, textAlign: 'center' }}>
              <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>Рабочий вес ({calcPercent}% от {calc1RM}кг)</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--accent)' }}>{calcResults.percentWeight.toFixed(1)} кг</div>
            </div>
          </div>

          {/* Powerlifting Indexes (TZ 7.12) */}
          <div className="card" style={{ padding: '10px 12px' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 13 }}>🏆 Силовые индексы (Wilks/Dots)</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
              {[
                { k: plSquat, s: setPlSquat, l: 'Присед' },
                { k: plBench, s: setPlBench, l: 'Жим' },
                { k: plDeadlift, s: setPlDeadlift, l: 'Тяга' },
                { k: plWeight, s: setPlWeight, l: 'Вес тела' },
              ].map(f => (
                <div key={f.l}>
                  <label style={{ fontSize: 9, color: 'var(--text-dim)' }}>{f.l}</label>
                  <input type="number" value={f.k} onChange={e => f.s(parseFloat(e.target.value) || 0)}
                    style={{ width: '100%', padding: '6px 8px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, boxSizing: 'border-box' }} />
                </div>
              ))}
              <div>
                <label style={{ fontSize: 9, color: 'var(--text-dim)' }}>Пол</label>
                <div style={{ display: 'flex', gap: 4 }}>
                  {(['male', 'female'] as const).map(s => (
                    <button key={s} onClick={() => setPlSex(s)} style={{
                      flex: 1, padding: '6px 4px', borderRadius: 6, fontSize: 11, cursor: 'pointer',
                      background: plSex === s ? 'rgba(0,230,138,0.15)' : 'var(--bg-secondary)',
                      border: plSex === s ? '1px solid var(--accent)' : '1px solid var(--border)',
                      color: plSex === s ? 'var(--accent)' : 'var(--text-dim)', fontWeight: plSex === s ? 700 : 400,
                    }}>{s === 'male' ? 'Мужской' : 'Женский'}</button>
                  ))}
                </div>
              </div>
            </div>
            {(() => {
              const total = plSquat + plBench + plDeadlift;
              const w = Math.max(plWeight, 30);
              const coef = plSex === 'male'
                ? { a: -216.0475144, b: 16.2606339, c: -0.002388645, d: -0.00113732, e: 7.01863e-6, f: -1.291e-8 }
                : { a: 594.31747775582, b: -27.23842536447, c: 0.82112226871, d: -0.00930733913, e: 4.731582e-5, f: -9.054e-8 };
              const denom = coef.a + coef.b * w + coef.c * w * w + coef.d * w * w * w + coef.e * w * w * w * w + coef.f * w * w * w * w * w;
              const dots = denom > 0 ? total * 500 / denom : 0;
              return (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                  <div style={{ background: 'rgba(0,230,138,0.08)', borderRadius: 8, padding: 8, textAlign: 'center' }}>
                    <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>Сумма</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--accent)' }}>{total} кг</div>
                  </div>
                  <div style={{ background: 'rgba(0,230,138,0.08)', borderRadius: 8, padding: 8, textAlign: 'center' }}>
                    <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>Dots</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: '#00e68a' }}>{dots.toFixed(2)}</div>
                  </div>
                  <div style={{ background: 'rgba(249,115,22,0.08)', borderRadius: 8, padding: 8, textAlign: 'center' }}>
                    <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>Отн. вес</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: '#f97316' }}>{(total / w).toFixed(1)}×</div>
                  </div>
                </div>
              );
            })()}
          </div>
          <StrengthLevelCard />

          {/* ═══ BMI ═══ */}
          <div className="card" style={{ padding: '10px 12px' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 13 }}>⚖️ Индекс массы тела (BMI)</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
              <div>
                <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Вес (кг)</label>
                <input type="number" value={bmiWeight} onChange={e => setBmiWeight(parseFloat(e.target.value) || 0)} style={{ width: '100%', padding: '6px 8px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Рост (см)</label>
                <input type="number" value={bmiHeight} onChange={e => setBmiHeight(parseFloat(e.target.value) || 0)} style={{ width: '100%', padding: '6px 8px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, boxSizing: 'border-box' }} />
              </div>
            </div>
            <button onClick={calcBMI} style={{ width: '100%', padding: 6, borderRadius: 6, border: 'none', cursor: 'pointer', background: 'var(--accent)', color: '#000', fontWeight: 600, fontSize: 11, marginBottom: 8 }}>Рассчитать</button>
            {bmiResult !== null && (
              <div style={{ background: 'rgba(0,230,138,0.08)', borderRadius: 8, padding: 10, textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--accent)' }}>{bmiResult.toFixed(1)}</div>
                <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{bmiCategory(bmiResult)}</div>
              </div>
            )}
          </div>

          {/* ═══ BMR Mifflin-St Jeor ═══ */}
          <div className="card" style={{ padding: '10px 12px' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 13 }}>🔥 BMR (Миффлин-Сан Жеор)</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
              <div>
                <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Вес (кг)</label>
                <input type="number" value={bmrWeight} onChange={e => setBmrWeight(parseFloat(e.target.value) || 0)} style={{ width: '100%', padding: '6px 8px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Рост (см)</label>
                <input type="number" value={bmrHeight} onChange={e => setBmrHeight(parseFloat(e.target.value) || 0)} style={{ width: '100%', padding: '6px 8px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Возраст</label>
                <input type="number" value={bmrAge} onChange={e => setBmrAge(parseFloat(e.target.value) || 0)} style={{ width: '100%', padding: '6px 8px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Пол</label>
                <div style={{ display: 'flex', gap: 4 }}>
                  {(['male', 'female'] as const).map(s => (
                    <button key={s} onClick={() => setBmrSex(s)} style={{
                      flex: 1, padding: '6px 4px', borderRadius: 6, fontSize: 11, cursor: 'pointer',
                      background: bmrSex === s ? 'rgba(0,230,138,0.15)' : 'var(--bg-secondary)',
                      border: bmrSex === s ? '1px solid var(--accent)' : '1px solid var(--border)',
                      color: bmrSex === s ? 'var(--accent)' : 'var(--text-dim)', fontWeight: bmrSex === s ? 700 : 400,
                    }}>{s === 'male' ? 'Мужской' : 'Женский'}</button>
                  ))}
                </div>
              </div>
            </div>
            <button onClick={calcBMR} style={{ width: '100%', padding: 6, borderRadius: 6, border: 'none', cursor: 'pointer', background: 'var(--accent)', color: '#000', fontWeight: 600, fontSize: 11, marginBottom: 8 }}>Рассчитать</button>
            {bmrResult !== null && (
              <div style={{ background: 'rgba(0,230,138,0.08)', borderRadius: 8, padding: 10, textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--accent)' }}>{bmrResult.toFixed(0)}</div>
                <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>ккал/день</div>
              </div>
            )}
          </div>

          {/* ═══ BMR Katch-McArdle ═══ */}
          <div className="card" style={{ padding: '10px 12px' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 13 }}>🔥 BMR (Кэтч-Мкардл)</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
              <div>
                <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Вес (кг)</label>
                <input type="number" value={bmrKmWeight} onChange={e => setBmrKmWeight(parseFloat(e.target.value) || 0)} style={{ width: '100%', padding: '6px 8px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>% жира</label>
                <input type="number" step="0.1" value={bmrKmBodyFat} onChange={e => setBmrKmBodyFat(parseFloat(e.target.value) || 0)} style={{ width: '100%', padding: '6px 8px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, boxSizing: 'border-box' }} />
              </div>
            </div>
            <button onClick={calcBMR_KM} style={{ width: '100%', padding: 6, borderRadius: 6, border: 'none', cursor: 'pointer', background: 'var(--accent)', color: '#000', fontWeight: 600, fontSize: 11, marginBottom: 8 }}>Рассчитать</button>
            {bmrKmResult !== null && (
              <div style={{ background: 'rgba(0,230,138,0.08)', borderRadius: 8, padding: 10, textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--accent)' }}>{bmrKmResult.toFixed(0)}</div>
                <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>ккал/день (LBM: {(bmrKmWeight * (100 - bmrKmBodyFat) / 100).toFixed(1)} кг)</div>
              </div>
            )}
          </div>

          {/* ═══ TDEE ═══ */}
          <div className="card" style={{ padding: '10px 12px' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 13 }}>⚡ TDEE</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
              <div>
                <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>BMR (ккал)</label>
                <input type="number" value={tdeeBmr} onChange={e => setTdeeBmr(parseFloat(e.target.value) || 0)} style={{ width: '100%', padding: '6px 8px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>PAL</label>
                <select value={tdeePal} onChange={e => setTdeePal(parseFloat(e.target.value) || 0)} style={{ width: '100%', padding: '6px 4px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 11, boxSizing: 'border-box' }}>
                  {PAL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>
            <button onClick={calcTDEE} style={{ width: '100%', padding: 6, borderRadius: 6, border: 'none', cursor: 'pointer', background: 'var(--accent)', color: '#000', fontWeight: 600, fontSize: 11, marginBottom: 8 }}>Рассчитать</button>
            {tdeeResult !== null && (
              <div style={{ background: 'rgba(0,230,138,0.08)', borderRadius: 8, padding: 10, textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--accent)' }}>{tdeeResult.toFixed(0)}</div>
                <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>ккал/день</div>
              </div>
            )}
          </div>

          {/* ═══ Grip Strength ═══ */}
          <div className="card" style={{ padding: '10px 12px' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 13 }}>🤚 Сила хвата</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 8 }}>
              <div>
                <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Сила (кг)</label>
                <input type="number" value={gripKg} onChange={e => setGripKg(parseFloat(e.target.value) || 0)} style={{ width: '100%', padding: '6px 8px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Пол</label>
                <div style={{ display: 'flex', gap: 4 }}>
                  {(['male', 'female'] as const).map(s => (
                    <button key={s} onClick={() => setGripSex(s)} style={{
                      flex: 1, padding: '6px 4px', borderRadius: 6, fontSize: 11, cursor: 'pointer',
                      background: gripSex === s ? 'rgba(0,230,138,0.15)' : 'var(--bg-secondary)',
                      border: gripSex === s ? '1px solid var(--accent)' : '1px solid var(--border)',
                      color: gripSex === s ? 'var(--accent)' : 'var(--text-dim)', fontWeight: gripSex === s ? 700 : 400,
                    }}>{s === 'male' ? 'Мужской' : 'Женский'}</button>
                  ))}
                </div>
              </div>
              <div>
                <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Возраст</label>
                <input type="number" value={gripAge} onChange={e => setGripAge(parseFloat(e.target.value) || 0)} style={{ width: '100%', padding: '6px 8px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, boxSizing: 'border-box' }} />
              </div>
            </div>
            <button onClick={calcGrip} style={{ width: '100%', padding: 6, borderRadius: 6, border: 'none', cursor: 'pointer', background: 'var(--accent)', color: '#000', fontWeight: 600, fontSize: 11, marginBottom: 8 }}>Оценить</button>
            {gripResult !== null && (
              <div style={{ background: 'rgba(0,230,138,0.08)', borderRadius: 8, padding: 10, textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--accent)' }}>{gripResult.percentile}%</div>
                <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{gripResult.level}</div>
              </div>
            )}
          </div>

          {/* ═══ Stress (HRV) ═══ */}
          <div className="card" style={{ padding: '10px 12px' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 13 }}>🧠 Стресс (HRV)</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 6, marginBottom: 8 }}>
              <div>
                <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>RMSSD / HRV (мс)</label>
                <input type="number" value={hrvValue} onChange={e => setHrvValue(parseFloat(e.target.value) || 0)} style={{ width: '100%', padding: '6px 8px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, boxSizing: 'border-box' }} />
              </div>
            </div>
            <button onClick={calcStress} style={{ width: '100%', padding: 6, borderRadius: 6, border: 'none', cursor: 'pointer', background: 'var(--accent)', color: '#000', fontWeight: 600, fontSize: 11, marginBottom: 8 }}>Оценить</button>
            {stressResult !== null && (
              <div style={{ background: 'rgba(0,230,138,0.08)', borderRadius: 8, padding: 10, textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--accent)' }}>{stressResult.stress}%</div>
                <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{stressResult.level}</div>
              </div>
            )}
          </div>
          </>)}

          {/* ═══════ EXERCISE GENERATOR + Периодизация (объединено) ═══════ */}
          {showNonBuilder && (
            <div className="card" style={{ padding: '10px 12px' }}>
              <h3 style={{ margin: '0 0 8px', fontSize: 13 }}>🏋️ Генератор упражнений</h3>
              <ExerciseGeneratorContent />
              <div style={{ borderTop:'1px solid var(--border)', marginTop:6, paddingTop:6 }}>
                <h4 style={{ margin: '0 0 6px', fontSize: 11 }}>📐 Тип периодизации</h4>
                <div style={{ display:'flex', gap:4, flexWrap:'wrap', fontSize:10, color:'var(--text-dim)' }}>
                  {[
                    { v:'auto', l:'Авто' }, { v:'linear', l:'Линейная' },
                    { v:'undulating', l:'DUP' }, { v:'block', l:'Блочная' },
                  ].map(p => (
                    <button key={p.v} onClick={() => setPeriodizationType(p.v as 'auto' | 'linear' | 'undulating' | 'block' | 'conjugate')}
                      style={{
                        padding:'4px 10px', borderRadius:6, fontSize:10, fontWeight: periodizationType === p.v ? 700 : 400, cursor:'pointer',
                        border: periodizationType === p.v ? '1px solid var(--accent)' : '1px solid var(--border)',
                        background: periodizationType === p.v ? 'rgba(0,230,138,0.15)' : 'var(--bg-secondary)', color: 'var(--text)',
                      }}>{p.l}</button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ═══════ UNIFIED PROGRAM BUILDER (только в Ручном конструкторе) ═══════ */}
          {tab === 'programcalc' && (<>
          <div className="card" style={{ padding: '10px 12px' }}>
            <TrainingProfileCard profile={tprofile} update={updateTProfile} />
            {(() => { const la = labTrainingAdjust(linked.labAnalysis); if (la.warnings.length === 0 && la.mrvMultiplier >= 1) return null; return <div style={{ marginTop: 8, padding: 10, borderRadius: 10, background: la.deloadRecommended ? 'rgba(239,68,68,0.08)' : 'rgba(245,158,11,0.06)', border: '1px solid ' + (la.deloadRecommended ? 'rgba(239,68,68,0.25)' : 'rgba(245,158,11,0.2)') }}><div style={{ fontSize: 11, fontWeight: 800, color: la.deloadRecommended ? '#ef4444' : '#f59e0b', marginBottom: 4 }}>🧪 Лабораторная коррекция плана (MRV ×{la.mrvMultiplier.toFixed(2)})</div>{la.warnings.map((w, i) => <div key={i} style={{ fontSize: 10, color: 'rgba(255,255,255,0.8)', lineHeight: 1.4, marginBottom: 2 }}>• {w}</div>)}{la.intensityNote && <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', marginTop: 4 }}>{la.intensityNote}</div>}</div>; })()}
            <h3 style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 800, color: 'var(--accent)' }}>🛠 Ручной конструктор программы</h3>
            <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 10 }}>Выберите параметры сверху вниз и нажмите «Собрать программу» — получите готовый план по дням.</div>
            <div style={{ background: 'rgba(24,24,27,0.6)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.04)', padding: 12, marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#fff', marginBottom: 8 }}>⚙️ Базовые параметры</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <PopupSelect label='Цель' value={goal} onChange={setGoal} options={GOALS.map(g => ({ id: g.value, label: g.icon + ' ' + g.label }))} />
                <PopupSelect label='Уровень' value={level} onChange={setLevel} options={LEVELS.map(l => ({ id: l.value, label: l.icon + ' ' + l.label }))} />
                <PopupNumber label='Дней в неделю' value={daysPerWeek} min={2} max={6} onChange={v => setDaysPerWeek(v)} />
                <PopupSelect label='Длина мезоцикла' value={String(mesoLength)} onChange={v => setMesoLength(+v)} options={[['12','12 недель'],['16','16 недель'],['20','20 недель'],['24','24 недели']].map(([id,label]) => ({ id, label }))} />
              </div>
            </div>

            {/* Ручная конфигурация — выбор всех параметров программы */}
            <div style={{ background: 'rgba(0,230,138,0.04)', border: '1px solid rgba(0,230,138,0.15)', borderRadius: 10, padding: 10, marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', marginBottom: 6 }}>⚙️ Ручная конфигурация программы</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                <PopupSelect label="Тип сплита" value={manualCfg.split || ''} onChange={v => setManual('split', v)} options={Object.entries(TRAINING_SPLITS).map(([id, s]) => ({ id, label: s.name, desc: s.desc }))} hint="Все сплиты из библиотеки. Выбор переопределяет авто-подбор на шаге 1." />
                <PopupSelect label="Тип цикла" value={manualCfg.cycle || ''} onChange={v => setManual('cycle', v)} options={LMS_CYCLES.map(c => ({ id: c.meta.id, label: c.meta.title, desc: (c.meta.id.startsWith('block') ? 'Блок' : c.meta.id.startsWith('embed') ? 'Встроенная' : 'СРЦ') + ' · ' + c.meta.level }))} hint="Все циклы (СРЦ, блоки, встроенные) по категориям." />
                <PopupSelect label="Программа тренировок" value={manualCfg.program || ''} onChange={v => setManual('program', v)} options={[...FULL_PROGRAM_LIBRARY, ...WOMENS_PROGRAMS, ...CUSTOM_PROGRAMS].map((p: any) => ({ id: p.id, label: p.name, desc: p.type + ' · ' + p.goal + ' · ' + p.level }))} hint="Готовые программы из библиотеки." />
                <PopupSelect label="Периодизация" value={manualCfg.periodization || ''} onChange={v => setManual('periodization', v)} options={getMethodsByCategory('periodization').map(m => ({ id: m.name, label: m.name, desc: m.bestFor }))} />
                <PopupSelect label="Прогрессия" value={manualCfg.progression || ''} onChange={v => setManual('progression', v)} options={getMethodsByCategory('progression').map(m => ({ id: m.name, label: m.name, desc: m.bestFor }))} />
                <PopupSelect label="Интенсивность" value={manualCfg.intensity || ''} onChange={v => setManual('intensity', v)} options={getMethodsByCategory('intensity').map(m => ({ id: m.name, label: m.name, desc: m.bestFor }))} />
                <PopupSelect label="Техника" value={manualCfg.technique || ''} onChange={v => setManual('technique', v)} options={getMethodsByCategory('technique').map(m => ({ id: m.name, label: m.name, desc: m.bestFor }))} />
                <PopupSelect label="Объём" value={manualCfg.volume || ''} onChange={v => setManual('volume', v)} options={getMethodsByCategory('volume').map(m => ({ id: m.name, label: m.name, desc: m.bestFor }))} />
                <PopupSelect label="Частота" value={manualCfg.frequency || ''} onChange={v => setManual('frequency', v)} options={getMethodsByCategory('frequency').map(m => ({ id: m.name, label: m.name, desc: m.bestFor }))} />
              </div>
              {Object.values(manualCfg).some(Boolean) && <div style={{ marginTop: 8, fontSize: 10, color: 'var(--accent)' }}>✓ Выбрано: {Object.entries(manualCfg).filter(([, v]) => v).map(([k, v]) => k).join(' · ')}</div>}
              {manualCfg.program && <button onClick={() => loadProgramToConstructor(manualCfg.program)} style={{ width: '100%', marginTop: 8, padding: 10, borderRadius: 8, border: '1px solid rgba(168,85,247,0.3)', background: 'rgba(168,85,247,0.08)', color: '#a855f7', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>📥 Загрузить программу в конструктор</button>}
            </div>

            {/* Кнопка генерации по ручной конфигурации + результат */}
            <div style={{ marginTop: 8 }}>

              <button onClick={generateManualPlan} style={{ width: '100%', padding: 12, borderRadius: 10, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#00e68a,#00c853)', color: '#000', fontWeight: 800, fontSize: 13 }}>🔧 Собрать программу по конфигурации</button>
              <div style={{ fontSize: 9, color: 'var(--text-dim)', marginTop: 4, textAlign: 'center' }}>Соберёт план из выбранного сплита (или авто) + цель/уровень/дни/недели с назначением через calcExercisePrescription.</div>
            </div>
            {manualResult && (
              <div style={{ marginTop: 10, padding: 10, borderRadius: 12, border: '1px solid rgba(0,230,138,0.25)', background: 'rgba(0,230,138,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--accent)' }}>📋 Результат: {manualResult.splitName}</div>
                  <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent)', background: 'rgba(0,230,138,0.12)', padding: '3px 8px', borderRadius: 8 }}>{manualResult.days.length} дн/нед · {mesoLength} нед</span>
                </div>
                {Object.values(manualCfg).some(Boolean) && <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', marginTop: 6, lineHeight: 1.6 }}>
                  <b style={{ color: 'var(--accent)' }}>Параметры:</b> {Object.entries(manualCfg).filter(([, v]) => v).map(([k, v]) => { const L: Record<string,string> = { split: 'сплит', cycle: 'цикл', program: 'программа', periodization: 'периодизация', progression: 'прогрессия', intensity: 'интенсивность', technique: 'техника', volume: 'объём', frequency: 'частота' }; return `${L[k] || k}: ${v}`; }).join(' · ')}
                </div>}
                {manualResult.corrections && manualResult.corrections.length > 0 && (
                  <div style={{ marginTop: 6, padding: 10, borderRadius: 10, background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.15)' }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: '#60a5fa', marginBottom: 6 }}>📝 Комментарии к плану (что изменено и почему)</div>
                    {manualResult.corrections.map((corr, i) => <div key={i} style={{ fontSize: 10, color: 'rgba(255,255,255,0.8)', lineHeight: 1.5, marginBottom: 3, paddingLeft: 4, borderLeft: '2px solid rgba(59,130,246,0.4)' }}>{corr}</div>)}
                  </div>
                )}
                {/* Mass editing + macro preview */}
                <div style={{ display: 'flex', gap: 4, marginTop: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.5)', alignSelf: 'center' }}>⚡ Масс-правка:</span>
                  <button onClick={() => massEditWeight(5)} style={{ padding: '3px 8px', borderRadius: 6, border: '1px solid rgba(0,230,138,0.25)', background: 'rgba(0,230,138,0.06)', color: 'var(--accent)', cursor: 'pointer', fontSize: 9, fontWeight: 600 }}>+5% вес</button>
                  <button onClick={() => massEditWeight(-5)} style={{ padding: '3px 8px', borderRadius: 6, border: '1px solid rgba(0,230,138,0.25)', background: 'rgba(0,230,138,0.06)', color: 'var(--accent)', cursor: 'pointer', fontSize: 9, fontWeight: 600 }}>−5% вес</button>
                  <button onClick={() => massEditVolume(-20)} style={{ padding: '3px 8px', borderRadius: 6, border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.06)', color: '#ef4444', cursor: 'pointer', fontSize: 9, fontWeight: 600 }}>−20% объём</button>
                  <button onClick={() => massEditVolume(10)} style={{ padding: '3px 8px', borderRadius: 6, border: '1px solid rgba(0,230,138,0.25)', background: 'rgba(0,230,138,0.06)', color: 'var(--accent)', cursor: 'pointer', fontSize: 9, fontWeight: 600 }}>+10% объём</button>
                  <button onClick={() => setShowMacroPreview(v => !v)} style={{ padding: '3px 8px', borderRadius: 6, border: '1px solid rgba(168,85,247,0.3)', background: 'rgba(168,85,247,0.08)', color: '#a855f7', cursor: 'pointer', fontSize: 9, fontWeight: 600 }}>{showMacroPreview ? '▲ Скрыть макроцикл' : '📅 Макроцикл'}</button>
                </div>
                {showMacroPreview && <div style={{ marginTop: 8, padding: 8, borderRadius: 10, background: 'rgba(168,85,247,0.04)', border: '1px solid rgba(168,85,247,0.15)' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#a855f7', marginBottom: 6 }}>📅 Предпросмотр макроцикла: {mesoLength} нед × {manualResult.days.length} дн</div>
                  <div style={{ overflowX: 'auto' }}><div style={{ display: 'flex', gap: 4, minWidth: 'max-content' }}>
                    {[...Array(Math.ceil(mesoLength))].map((_, wi) => { const heat = Math.min(1, (wi < mesoLength/2 ? 65 + wi : 85 - (wi - mesoLength/2)) / 100); return <div key={wi} style={{ padding: '4px 6px', borderRadius: 8, background: `rgba(168,85,247,${0.04 + heat * 0.1})`, border: `1px solid rgba(168,85,247,${0.1 + heat * 0.2})`, minWidth: 72 }}><div style={{ fontSize: 8, fontWeight: 700, color: '#a855f7', textAlign: 'center', marginBottom: 3 }}>Нед {wi + 1}</div><div style={{ display: 'grid', gridTemplateColumns: `repeat(${manualResult.days.length}, 1fr)`, gap: 2 }}>{manualResult.days.map((_, di2) => <div key={di2} style={{ height: 18, borderRadius: 3, background: `rgba(0,230,138,${0.15 + heat * 0.35})`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ fontSize: 7, color: 'rgba(255,255,255,0.6)' }}>Д{di2 + 1}</span></div>)}</div><div style={{ height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.06)', marginTop: 2, overflow: 'hidden' }}><div style={{ height: '100%', width: Math.round(heat * 100) + '%', borderRadius: 2, background: heat > 0.75 ? '#f59e0b' : '#00e68a' }} /></div><div style={{ fontSize: 6, color: 'rgba(255,255,255,0.4)', textAlign: 'center' }}>{Math.round(65 + heat * 35)}% инт.</div></div>; })}
                  </div></div>
                </div>}
                <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {manualResult.days.map((d, di) => (
                    <div key={d.day} style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: 'rgba(0,230,138,0.06)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>🏋️ День {d.day}</span>
                        <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                          <span style={{ fontSize: 9, color: 'var(--accent)', fontWeight: 700 }}>{d.groups.join(' · ')}</span>
                          <button onClick={() => copyDay(di)} title="Копировать день" style={{ padding: '1px 6px', borderRadius: 4, border: '1px solid rgba(168,85,247,0.3)', background: 'rgba(168,85,247,0.08)', color: '#a855f7', cursor: 'pointer', fontSize: 9, fontWeight: 700 }}>📋</button>
                        </span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '14px 1.8fr 0.7fr 0.7fr 0.5fr 0.5fr 0.5fr 0.7fr', gap: 2, padding: '4px 10px', fontSize: 8, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>
                        <span></span><span>Упражнение</span><span>Сеты×повт</span><span>RIR</span><span>Вес</span><span>Группа</span><span>Отдых</span><span>Действия</span>
                      </div>
                      {d.exercises.map((e, ei) => {
                        const tmpo = generateRepTempo({ goal: goal === 'strength' ? 'strength' : 'hypertrophy', riskLevel: 'low', difficultyLevel: 'medium', techniqueIssues: [], isMainLift: ei === 0 });
                        return (
                        <div key={ei} draggable onDragStart={ev => dragStart(ev, di, ei)} onDragOver={dragOver} onDrop={ev => dropEx(ev, di, ei)} onDragEnd={() => setDragFrom(null)} style={{ display: 'grid', gridTemplateColumns: '14px 1.8fr 0.7fr 0.7fr 0.5fr 0.5fr 0.5fr 0.7fr', gap: 2, padding: '5px 10px', fontSize: 10, color: 'rgba(255,255,255,0.85)', borderTop: '1px solid rgba(255,255,255,0.04)', background: dragFrom?.dayIdx === di && dragFrom?.exIdx === ei ? 'rgba(0,230,138,0.1)' : 'transparent', cursor: 'grab', alignItems: 'center' }}>
                          <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)', cursor: 'grab', userSelect: 'none' }}>⠿</span>
                          <span style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>{e.name}<span style={{ fontSize: 7, color: '#a855f7', fontWeight: 700, background: 'rgba(168,85,247,0.1)', padding: '1px 5px', borderRadius: 4, whiteSpace: 'nowrap' }}>{tmpo.tempo.toString}</span></span>
                          <span onClick={() => startInline(di, ei, 'sets', e.sets)} style={{ cursor: 'text', color: 'var(--accent)', fontWeight: 700 }}>{e.sets}×{e.reps}</span>
                          <span onClick={() => startInline(di, ei, 'rir', e.rir)} style={{ cursor: 'text', color: '#f59e0b' }}>{e.rir}</span>
                          <span onClick={() => startInline(di, ei, 'weight', e.weight)} style={{ cursor: 'text', color: '#60a5fa', fontWeight: 700 }}>{e.weight} кг</span>
                          <span style={{ color: 'rgba(255,255,255,0.6)' }}>{GRP_RU_M[e.group] || e.group}</span>
                          <span onClick={() => startInline(di, ei, 'rest', e.rest)} style={{ cursor: 'text', color: 'rgba(255,255,255,0.6)' }}>{e.rest}с</span>
                          <span style={{ display: 'flex', gap: 2 }}>
                            <button onClick={(ev) => { ev.stopPropagation(); openSubstitute(di, ei); }} title="Замена" style={{ padding: '2px 5px', borderRadius: 4, border: '1px solid rgba(0,230,138,0.3)', background: 'rgba(0,230,138,0.08)', color: 'var(--accent)', cursor: 'pointer', fontSize: 10, fontWeight: 700 }}>🔄</button>
                            <button onClick={(e2) => { e2.stopPropagation(); const k = window.prompt('Шаблон (5×5, 3×8, 4×10, 3×12, AMRAP, Myo-rep, 10×10 GVT, 5/3/1):', '5×5'); if (k && SET_TEMPLATES[k]) applySetTemplate(di, ei, k); }} title="Шаблон" style={{ padding: '2px 5px', borderRadius: 4, border: '1px solid rgba(168,85,247,0.3)', background: 'rgba(168,85,247,0.08)', color: '#a855f7', cursor: 'pointer', fontSize: 10, fontWeight: 700 }}>⚡</button>
                          </span>
                        </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
{subModal && (
                  <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={() => setSubModal(null)}>
                    <div onClick={ev => ev.stopPropagation()} style={{ background: '#18181b', border: '1px solid rgba(0,230,138,0.3)', borderRadius: 14, padding: 16, maxWidth: 460, width: '100%', maxHeight: '80vh', overflowY: 'auto' }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--accent)', marginBottom: 8 }}>🔄 Подобрать замену</div>
                      {subModal.options.length === 0 ? (
                        <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>Нет доступных замен для этого упражнения. Попробуйте выбрать другое упражнение вручную.</div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {subModal.options.map(o => (
                            <button key={o.id} onClick={() => applySubstitute(o.id)} style={{ textAlign: 'left', padding: 10, borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)', cursor: 'pointer' }}>
                              <div style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>{o.name}</div>
                              <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2 }}>{o.reason}</div>
                            </button>
                          ))}
                        </div>
                      )}
                      <button onClick={() => setSubModal(null)} style={{ marginTop: 10, width: '100%', padding: 9, borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'var(--text-dim)', cursor: 'pointer', fontWeight: 700, fontSize: 11 }}>Закрыть</button>
                    </div>
                  </div>
                )}
{improveModal && (
                  <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={() => setImproveModal(null)}>
                    <div onClick={ev => ev.stopPropagation()} style={{ background: '#18181b', border: '1px solid rgba(0,230,138,0.3)', borderRadius: 14, padding: 16, maxWidth: 480, width: '100%', maxHeight: '80vh', overflowY: 'auto' }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--accent)', marginBottom: 8 }}>🎯 Улучшить программу</div>
                      <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 10 }}>Рекомендации по балансу объёма, слабым группам и перетренированности:</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 12 }}>
                        {improveModal.notes.map((n, i) => <div key={i} style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)', lineHeight: 1.5, padding: '6px 8px', borderRadius: 6, background: 'rgba(255,255,255,0.03)', borderLeft: '2px solid var(--accent)' }}>{n}</div>)}
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => setImproveModal(null)} style={{ flex: 1, padding: 10, borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'var(--text-dim)', cursor: 'pointer', fontWeight: 700, fontSize: 11 }}>Отмена</button>
                        <button onClick={improveModal.apply} style={{ flex: 1, padding: 10, borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#00e68a,#00c853)', color: '#000', cursor: 'pointer', fontWeight: 800, fontSize: 11 }}>Применить</button>
                      </div>
                    </div>
                  </div>
                )}
                {inlineEdit && (
                  <div style={{ position: 'fixed', inset: 0, zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)' }} onClick={() => setInlineEdit(null)}>
                    <div onClick={ev => ev.stopPropagation()} style={{ background: '#18181b', border: '1px solid rgba(0,230,138,0.3)', borderRadius: 14, padding: 16, minWidth: 220 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', marginBottom: 8 }}>
                        ✏️ Изменить {inlineEdit.field} — {manualResult.days[inlineEdit.dayIdx]?.exercises[inlineEdit.exIdx]?.name}
                      </div>
                      <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>
                        {inlineEdit.field === 'sets' ? 'Например: 4' : inlineEdit.field === 'reps' ? 'Например: 8-12 или AMRAP' : inlineEdit.field === 'rir' ? '0-5 (0 = отказ)' : inlineEdit.field === 'weight' ? 'кг' : 'секунд'}
                      </div>
                      <input ref={inlineRef} type={inlineEdit.field === 'reps' ? 'text' : 'number'} value={inlineEdit.value}
                        onChange={e2 => setInlineEdit({ ...inlineEdit, value: e2.target.value })}
                        onKeyDown={e2 => { if (e2.key === 'Enter') commitInline(); if (e2.key === 'Escape') setInlineEdit(null); }}
                        style={{ width: '100%', boxSizing: 'border-box', padding: 8, borderRadius: 8, border: '1px solid rgba(0,230,138,0.3)', background: '#222', color: '#fff', fontSize: 13, outline: 'none' }}
                      />
                      <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                        <button onClick={() => setInlineEdit(null)} style={{ flex: 1, padding: 8, borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: 11 }}>Отмена</button>
                        <button onClick={commitInline} style={{ flex: 1, padding: 8, borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#00e68a,#00c853)', color: '#000', cursor: 'pointer', fontWeight: 700, fontSize: 11 }}>✓ Сохранить</button>
                      </div>
                    </div>
                  </div>
                )}
                {/* Сводка качества плана */}
                {(() => {
                  const _labAdj = labTrainingAdjust(linked.labAnalysis);
    const mrv = ((LEVEL_VOLUMES as Record<string, { mrv: number }>)[level]?.mrv ?? 20) * (tprofile.onCourse ? (tprofile.courseIntensity === 'heavy' ? 1.3 : tprofile.courseIntensity === 'mild' ? 1.15 : 1.2) : 1) * _labAdj.mrvMultiplier;
                  const wk: Record<string, number> = {};
                  manualResult.days.forEach(d => d.exercises.forEach(e => { wk[e.group] = (wk[e.group] || 0) + e.sets; }));
                  const groups = Object.keys(wk);
                  const over = groups.filter(g => wk[g] > mrv);
                  const weakCovered = tprofile.weakPoints.filter(w => (wk[w] || 0) > 0);
                  const weakMissed = tprofile.weakPoints.filter(w => (wk[w] || 0) === 0);
                  let score = 100; score -= over.length * 12; score -= weakMissed.length * 10; score -= groups.filter(g => wk[g] > 0 && wk[g] < Math.max(4, mrv * 0.4)).length * 4;
                  score = Math.max(0, Math.min(100, score));
                  const sc = score >= 85 ? '#22c55e' : score >= 65 ? '#eab308' : '#ef4444';
                  const GRP_RU: Record<string,string> = { chest:'Грудь', back:'Спина', legs:'Ноги', shoulders:'Плечи', arms:'Руки', core:'Кор' };
                  return <div style={{ marginTop: 8, padding: 10, borderRadius: 10, background: 'rgba(0,230,138,0.04)', border: '1px solid ' + sc + '33' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontSize: 11, fontWeight: 800, color: sc }}>🎯 Качество плана</span>
                      <span style={{ fontSize: 16, fontWeight: 800, color: sc }}>{score}/100</span>
                    </div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', lineHeight: 1.6 }}>
                      {over.length === 0 ? '✅ Объём в пределах MRV. ' : '⚠ Превышение MRV: ' + over.map(g => (GRP_RU[g] || g) + ' ' + wk[g]).join(', ') + '. '}
                      {tprofile.weakPoints.length === 0 ? '' : (weakMissed.length === 0 ? '✅ Слабые группы покрыты. ' : '⚠ Слабые группы без объёма: ' + weakMissed.map(g => GRP_RU[g] || g).join(', ') + '. ')}
                      Всего сетов/нед: {Object.values(wk).reduce((a, b) => a + b, 0)}.
                      {(() => { const _srpe = loadSRPESessions(); if (_srpe.length < 7) return ''; const mon = weeklyMonotony(toDailyLoads(_srpe)); const warn = mon.monotony > 2 || mon.strain > 1000; if (!warn) return ' ✅ Монотонность/strain в норме.'; return ' ⚠ Перетренированность: монотонность ' + mon.monotony.toFixed(1) + (mon.monotony > 2 ? ' (>2 — однообразие)' : '') + ', strain ' + Math.round(mon.strain) + '. Добавьте вариативность/восстановление.'; })()}
                    </div>
                    {groups.length > 0 && (
                      <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Объём по группам (MEV / MAV / MRV)</div>
                        {groups.map(g => {
                          const v = getVolumeByMuscle(g);
                          const lvlKey = (level === 'enhanced' ? 'advanced' : level) as 'beginner' | 'intermediate' | 'advanced';
                          const ld = v ? v[lvlKey] : undefined;
                          const sets = wk[g];
                          const mev = ld?.mev ?? 0;
                          const mav = ld?.mav ?? 0;
                          const gmrv = ld?.mrv ?? Math.round(mrv);
                          const color = sets === 0 ? '#ef4444' : sets < mev ? '#f59e0b' : sets <= mav ? '#22c55e' : sets <= gmrv ? '#eab308' : '#ef4444';
                          const label = sets === 0 ? 'нет объёма' : sets < mev ? 'ниже MEV' : sets <= mav ? 'зона MAV' : sets <= gmrv ? 'выше MAV' : '>MRV!';
                          const pct = Math.min(100, Math.round((sets / Math.max(gmrv, 1)) * 100));
                          return (
                            <div key={g} style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.4fr 0.7fr 0.6fr 0.8fr', gap: 4, fontSize: 9, color: 'rgba(255,255,255,0.8)', alignItems: 'center' }}>
                              <span style={{ fontWeight: 700 }}>{GRP_RU[g] || g}</span>
                              <span style={{ color: 'rgba(255,255,255,0.5)', textAlign: 'center' }}>{sets}</span>
                              <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 8 }}>{mev}/{mav}/{gmrv}</span>
                              <span style={{ color, fontWeight: 700 }}>{label}</span>
                              <span style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                                <span style={{ display: 'block', height: '100%', width: pct + '%', borderRadius: 3, background: color }} />
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>;
                })()}
                <button onClick={() => { try { const data = { name: `Ручная: ${manualResult.splitName}'`, date: new Date().toISOString().slice(0,10), cfg: manualCfg, days: manualResult.days, generatedAt: Date.now() }; const ex = JSON.parse(localStorage.getItem('myTrainingPlans') || '[]'); ex.unshift(data); localStorage.setItem('myTrainingPlans', JSON.stringify(ex.slice(0,30))); refreshManualSaved(); } catch {} }} style={{ width: '100%', marginTop: 8, padding: 10, borderRadius: 8, border: '1px solid rgba(0,230,138,0.2)', background: 'rgba(0,230,138,0.06)', color: 'var(--accent)', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>💾 Сохранить программу в «Мои тренировки»</button>
                <button onClick={improveProgram} style={{ width: '100%', marginTop: 6, padding: 10, borderRadius: 8, border: '1px solid rgba(245,158,11,0.3)', background: 'rgba(245,158,11,0.08)', color: '#f59e0b', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>🎯 Улучшить программу</button>
                <button onClick={recalcWeightsByLevel} disabled={!manualResult} style={{ width: '100%', marginTop: 6, padding: 10, borderRadius: 8, border: manualResult ? '1px solid rgba(96,165,250,0.3)' : '1px solid rgba(255,255,255,0.08)', background: manualResult ? 'rgba(96,165,250,0.08)' : 'transparent', color: manualResult ? '#60a5fa' : 'var(--text-dim)', cursor: manualResult ? 'pointer' : 'not-allowed', fontSize: 11, fontWeight: 700 }}>🔄 Пересчитать веса по уровню</button>
                <button onClick={saveAsTemplate} style={{ width: '100%', marginTop: 6, padding: 10, borderRadius: 8, border: '1px solid rgba(168,85,247,0.3)', background: 'rgba(168,85,247,0.08)', color: '#a855f7', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>📂 Сохранить как шаблон</button>
                <button onClick={exportManualPlanText} style={{ width: '100%', marginTop: 6, padding: 10, borderRadius: 8, border: '1px solid rgba(59,130,246,0.3)', background: 'rgba(59,130,246,0.08)', color: '#60a5fa', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>{planCopied ? '✓ Скопировано в буфер' : '📋 Копировать план (текст)'}</button>
                <button onClick={printManualPlan} style={{ width: '100%', marginTop: 6, padding: 10, borderRadius: 8, border: '1px solid rgba(168,85,247,0.3)', background: 'rgba(168,85,247,0.08)', color: '#a855f7', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>🖨 Печать / сохранить в PDF</button>
                <button onClick={exportFullReport} style={{ width: '100%', marginTop: 6, padding: 10, borderRadius: 8, border: '1px solid rgba(0,230,138,0.3)', background: 'linear-gradient(135deg,rgba(0,230,138,0.12),rgba(0,200,80,0.06))', color: 'var(--accent)', cursor: 'pointer', fontSize: 11, fontWeight: 800 }}>📄 Отчёт по блоку (PDF: профиль+план+качество+лаб.+прогресс)</button>
                <button onClick={() => { setManualResult(null); setComparePlan(null); }} style={{ width: '100%', marginTop: 6, padding: 10, borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>✕ Сбросить результат</button>
                <button onClick={manualToRuntime} style={{ width: '100%', marginTop: 6, padding: 10, borderRadius: 8, border: '1px solid var(--accent)', background: 'rgba(0,230,138,0.08)', color: 'var(--accent)', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>▶ К выполнению (SessionPlayer)</button>
                {(manualCfg.intensity || manualCfg.technique || manualCfg.volume) && <button onClick={applyMethodicToPlan} style={{ width: '100%', marginTop: 6, padding: 10, borderRadius: 8, border: '1px solid rgba(245,158,11,0.3)', background: 'rgba(245,158,11,0.08)', color: '#f59e0b', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>🔧 Применить методику к плану</button>}
              </div>
            )}

            {/* Загрузить сохранённый план обратно в конструктор */}
            {(() => { const plans = manualSavedPlans.filter((p: any) => p && p.days); if (plans.length === 0) return null; return <div style={{ marginTop: 8, padding: 10, borderRadius: 10, background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.15)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#60a5fa', marginBottom: 6 }}>📁 Сохранённые программы ({plans.length}) — загрузить в конструктор</div>
              {plans.map((p: any, i: number) => <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6, padding: '5px 8px', marginBottom: 4, borderRadius: 6, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <span style={{ fontSize: 10, color: '#fff', fontWeight: 600 }}>{p.name} <span style={{ color: 'rgba(255,255,255,0.4)', fontWeight: 400 }}>· {p.date} · {p.days?.length} дн</span></span>
                <span style={{ display: 'flex', gap: 4 }}>
                  <button onClick={() => loadManualPlan(p)} style={{ padding: '3px 8px', borderRadius: 5, border: '1px solid rgba(0,230,138,0.3)', background: 'rgba(0,230,138,0.08)', color: '#00e68a', cursor: 'pointer', fontSize: 9, fontWeight: 700 }}>↩ Загрузить</button>
                  <button onClick={() => setComparePlan(p)} style={{ padding: '3px 8px', borderRadius: 5, border: '1px solid rgba(168,85,247,0.3)', background: 'rgba(168,85,247,0.08)', color: '#a855f7', cursor: 'pointer', fontSize: 9, fontWeight: 700 }}>⚖ Сравнить</button>
                  <button onClick={() => { try { const ex = JSON.parse(localStorage.getItem('myTrainingPlans') || '[]'); const upd = ex.filter((x: any, j: number) => x !== p); localStorage.setItem('myTrainingPlans', JSON.stringify(upd)); refreshManualSaved(); } catch {} }} style={{ padding: '3px 8px', borderRadius: 5, border: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.08)', color: '#ef4444', cursor: 'pointer', fontSize: 9 }}>✕</button>
                </span>
              </div>)}
            </div>; })()}
            {(() => { const tpls = manualTemplates.filter((p: any) => p && p.days); if (tpls.length === 0) return null; return <div style={{ marginTop: 8, padding: 10, borderRadius: 10, background: 'rgba(168,85,247,0.05)', border: '1px solid rgba(168,85,247,0.15)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#a855f7', marginBottom: 6 }}>📂 Шаблоны ({tpls.length}) — загрузить в конструктор</div>
              {tpls.map((p: any, i: number) => <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6, padding: '5px 8px', marginBottom: 4, borderRadius: 6, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <span style={{ fontSize: 10, color: '#fff', fontWeight: 600 }}>{p.name} <span style={{ color: 'rgba(255,255,255,0.4)', fontWeight: 400 }}>· {p.date} · {p.days?.length} дн</span></span>
                <span style={{ display: 'flex', gap: 4 }}>
                  <button onClick={() => loadManualPlan(p)} style={{ padding: '3px 8px', borderRadius: 5, border: '1px solid rgba(168,85,247,0.3)', background: 'rgba(168,85,247,0.08)', color: '#a855f7', cursor: 'pointer', fontSize: 9, fontWeight: 700 }}>↩ Загрузить</button>
                  <button onClick={() => deleteTemplate(i)} style={{ padding: '3px 8px', borderRadius: 5, border: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.08)', color: '#ef4444', cursor: 'pointer', fontSize: 9 }}>✕</button>
                </span>
              </div>)}
            </div>; })()}
            {comparePlan && manualResult && (() => { const wk = (plan: any): Record<string, number> => { const m: Record<string, number> = {}; (plan.days || []).forEach((d: any) => (d.exercises || []).forEach((e: any) => { m[e.group] = (m[e.group] || 0) + e.sets; })); return m; }; const cur = wk(manualResult); const cmp = wk(comparePlan); const allG = Array.from(new Set([...Object.keys(cur), ...Object.keys(cmp)])); const GRP_RU: Record<string,string> = { chest:'Грудь', back:'Спина', legs:'Ноги', shoulders:'Плечи', arms:'Руки', core:'Кор', full:'Общее' }; const curTotal = Object.values(cur).reduce((a,b)=>a+b,0); const cmpTotal = Object.values(cmp).reduce((a,b)=>a+b,0); return <div style={{ marginTop: 8, padding: 10, borderRadius: 10, background: 'rgba(168,85,247,0.05)', border: '1px solid rgba(168,85,247,0.2)' }}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}><span style={{ fontSize: 11, fontWeight: 800, color: '#a855f7' }}>⚖ Сравнение: текущий vs «{comparePlan.name}»</span><button onClick={() => setComparePlan(null)} style={{ fontSize: 9, border: 'none', background: 'transparent', color: 'var(--text-dim)', cursor: 'pointer' }}>✕</button></div><div style={{ display: 'grid', gridTemplateColumns: '1.4fr 0.6fr 0.6fr', gap: 2, fontSize: 8, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', padding: '2px 0' }}><span>Группа</span><span>Текущий</span><span>Сохранённый</span></div>{allG.map((g: string) => { const a = cur[g]||0, b = cmp[g]||0; const diff = a-b; return <div key={g} style={{ display: 'grid', gridTemplateColumns: '1.4fr 0.6fr 0.6fr', gap: 2, fontSize: 10, color: 'rgba(255,255,255,0.85)', padding: '3px 0', borderTop: '1px solid rgba(255,255,255,0.04)' }}><span style={{ fontWeight: 600 }}>{GRP_RU[g]||g}</span><span style={{ color: '#00e68a' }}>{a} {diff!==0 && <span style={{ fontSize: 7, color: diff>0?'#ef4444':'#3b82f6' }}>({diff>0?'+':''}{diff})</span>}</span><span style={{ color: '#60a5fa' }}>{b}</span></div>; })}<div style={{ marginTop: 6, fontSize: 10, color: 'rgba(255,255,255,0.7)' }}>Всего сетов: текущий <b style={{ color: '#00e68a' }}>{curTotal}</b> · сохранённый <b style={{ color: '#60a5fa' }}>{cmpTotal}</b> ({curTotal-cmpTotal>=0?'+':''}{curTotal-cmpTotal}). Дней: {manualResult.days.length} vs {comparePlan.days?.length ?? '?'}.</div></div>; })()}

            <button onClick={() => setShowWizard(w => !w)} style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px dashed rgba(0,230,138,0.3)', background: 'rgba(0,230,138,0.04)', color: 'var(--accent)', cursor: 'pointer', fontSize: 11, fontWeight: 700, marginBottom: 10 }}>{showWizard ? '▲ Скрыть пошаговый мастер' : '▼ Расширенный пошаговый мастер'}</button>
            {/* Step indicators */}
            {showWizard && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 10 }}>
              {[1,2,3,4].map(s => (
                <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div onClick={() => setBuilderStep(s)} style={{
                    width: 18, height: 18, borderRadius: '50%', cursor: 'pointer',
                    background: builderStep === s ? 'var(--accent)' : 'var(--bg-secondary)',
                    border: builderStep === s ? '2px solid var(--accent)' : '2px solid var(--border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 8, fontWeight: 700, color: builderStep === s ? '#000' : 'var(--text-dim)',
                  }}>{s}</div>
                  <span style={{ fontSize: 9, color: builderStep === s ? 'var(--text-light)' : 'var(--text-dim)', fontWeight: builderStep === s ? 600 : 400 }}>
                    {s === 1 ? 'Параметры' : s === 2 ? 'Сплит' : s === 3 ? 'Упражнения' : 'Цикл'}
                  </span>
                  {s < 4 && <span style={{ color: 'var(--text-dim)', fontSize: 8, marginLeft: 2 }}>→</span>}
                </div>
              ))}
            </div>
            )}

            {/* STEP 1: Параметры */}
            {showWizard && builderStep === 1 && (<>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
                <div>
                  <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Цель</label>
                  <select value={goal} onChange={e => setGoal(e.target.value)} style={{ width: '100%', padding: '6px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 11, boxSizing: 'border-box' }}>
                    {GOALS.map(g => <option key={g.value} value={g.value}>{g.icon} {g.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Уровень</label>
                  <select value={level} onChange={e => setLevel(e.target.value)} style={{ width: '100%', padding: '6px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 11, boxSizing: 'border-box' }}>
                    {LEVELS.map(l => <option key={l.value} value={l.value}>{l.icon} {l.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Дней/нед</label>
                  <select value={daysPerWeek} onChange={e => setDaysPerWeek(parseInt(e.target.value))} style={{ width: '100%', padding: '6px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 11, boxSizing: 'border-box' }}>
                    {[2,3,4,5,6].map(d => <option key={d} value={d}>{d} дн/нед</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Длит. (недель)</label>
                  <input type="number" min={4} max={20} value={mesoLength} onChange={e => setMesoLength(parseInt(e.target.value) || 12)} style={{ width: '100%', padding: '6px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 11, boxSizing: 'border-box' }} />
                </div>
              </div>
              <button onClick={() => {
                const newSeed = Date.now();
                setGeneratorSeed(newSeed);
                const shuffleSeed = (newSeed % 1000) / 1000;
                const inp = { goal, level, daysPerWeek, recovery, fatigue, nutrition: 7, weakPoints, sessionDuration: 60, exercises: [] } as TrainingInput;
                const best = selectSplit(inp);
                const manualSp = manualCfg.split ? TRAINING_SPLITS[manualCfg.split] : null;
                const s = manualSp ? { id: manualCfg.split, name: manualSp.name, desc: manualSp.desc, groupsPerDay: manualSp.groupsPerDay, score: 100, rationale: ['Ручной выбор сплита'] } as SplitCandidate : best[0];
                setBuilderSplit(s || null);
                if (s) {
                  const dayKeys = Object.keys(TRAINING_SPLITS);
                  const matchKey = dayKeys.find(k => TRAINING_SPLITS[k].name === s.name);
                  const sp = matchKey ? TRAINING_SPLITS[matchKey] : null;
                  const exByDay: Record<number, any[]> = {};
                   if (sp) {
                    const totalDays = Math.min(sp.groupsPerDay.length, daysPerWeek);
                    const cycle: string[][] = [];
                    while (cycle.length < daysPerWeek) {
                      for (const g of sp.groupsPerDay) { cycle.push(g); if (cycle.length >= daysPerWeek) break; }
                    }
                    const isWeak = (group: string) => weakPoints.includes(group);
                    const getReps = (ex: any, g: string, roleIdx: number): string => {
                      const rng = Math.random() + shuffleSeed;
                      if (goal === 'strength') {
                        if (ex.type === 'compound') return (rng % 3) < 1 ? '3-5' : '4-6';
                        return (rng % 3) < 1 ? '5-7' : '6-8';
                      }
                      if (goal === 'bulk') {
                        if (ex.type === 'compound') return (rng % 3) < 1 ? '6-10' : '8-12';
                        if (ex.type === 'isolation') return (rng % 3) < 1 ? '8-12' : '10-15';
                        return '8-12';
                      }
                      if (goal === 'cut') return '10-15';
                      if (ex.type === 'compound') return (rng % 3) < 1 ? '6-10' : '8-12';
                      return (rng % 3) < 1 ? '8-12' : '10-15';
                    };
                    const getRIR = (g: string, isFirst: boolean, exIdx: number): number => {
                      const jitter = Math.round((shuffleSeed * (exIdx + 1)) % 1);
                      let base = isFirst ? 1 : 2;
                      if (isWeak(g)) base = 1;
                      if (goal === 'strength') base = isFirst ? 2 : 3;
                      if (goal === 'cut') base = 2;
                      return Math.max(0, base + jitter);
                    };
                    const getSets = (ex: any, g: string, roleIdx: number): number => {
                      const jitter = Math.round((shuffleSeed * (roleIdx + 2)) % 2);
                      if (ex.type === 'compound') {
                        const baseC = level === 'beginner' ? 3 : level === 'enhanced' ? 5 : 4;
                        return Math.max(3, Math.min(5, baseC + jitter * (isWeak(g) ? 1 : 0)));
                      }
                      const baseI = level === 'beginner' ? 2 : 3;
                      return Math.max(2, Math.min(4, baseI + jitter * (isWeak(g) ? 1 : 0)));
                    };
                    cycle.forEach((groups, di) => {
                      const dayExs: any[] = [];
                      groups.forEach(g => {
                        const _allEx = getExercisesByGroup(g);
                        const _eqF = (e: typeof _allEx[number]) => tprofile.equipment.length === 0 || tprofile.equipment.includes(e.equipment);
                        const catalogExs = [...(_allEx.filter(_eqF).length > 0 ? _allEx.filter(_eqF) : _allEx)];
                        const shuffled = catalogExs.sort(() => (Math.random() + shuffleSeed) % 1 - 0.5);
                        const compounds = shuffled.filter(e => e.type === 'compound');
                        const isolations = shuffled.filter(e => e.type === 'isolation');
                        const chosen: typeof shuffled = [];
                        chosen.push(...compounds.slice(0, 2));
                        chosen.push(...isolations.slice(0, Math.max(0, 3 - chosen.length)));
                        if (chosen.length === 0) chosen.push(...shuffled.slice(0, 2));
                        chosen.forEach((ex, i) => {
                          const roleIdx = i;
                          const sets = getSets(ex, g, roleIdx);
                          dayExs.push({
                            name: ex.name, sets, reps: getReps(ex, g, roleIdx),
                            rir: getRIR(g, i === 0, roleIdx),
                            rest: ex.type === 'compound' ? (goal === 'strength' ? 180 : 120) : 60,
                            group: g
                          });
                        });
                      });
                      exByDay[di] = dayExs;
                    });
                  }
                  setBuilderDayExercises(exByDay);
                }
                setBuilderStep(2);
              }} style={{ width: '100%', padding: 8, borderRadius: 8, border: 'none', cursor: 'pointer', background: 'var(--accent)', color: '#000', fontWeight: 600, fontSize: 12 }}>Далее: Подобрать сплит</button>
            </>)}

            {/* STEP 2: Сплит */}
            {showWizard && builderStep === 2 && (<>
              {builderSplit ? (
                <div style={{ background: 'rgba(0,230,138,0.06)', borderRadius: 8, padding: 10, marginBottom: 8, border: '1px solid rgba(0,230,138,0.12)' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>🏆 {builderSplit.name}</div>
                  <div style={{ fontSize: 9, color: 'var(--text-light)', marginTop: 3 }}>{builderSplit.desc}</div>
                  <div style={{ fontSize: 9, color: 'var(--accent)', marginTop: 3 }}>Score: {((builderSplit.score || 0) * 100).toFixed(0)}%</div>
                  {builderSplit.rationale && <div style={{ fontSize: 8, color: 'var(--text-dim)', marginTop: 3 }}>{builderSplit.rationale.join(' · ')}</div>}
                </div>
              ) : (
                <div style={{ fontSize: 10, color: 'var(--text-dim)', textAlign: 'center', padding: 20 }}>Вернитесь на шаг 1 для подбора сплита</div>
              )}
              {(() => {
                const inp = { goal, level, daysPerWeek, recovery, fatigue, nutrition: 7, weakPoints, sessionDuration: 60, exercises: [] } as TrainingInput;
                const topSplits = getSplitOptions(inp);
                const top10 = topSplits.slice(0, 10);
                const rest = topSplits.slice(10);
                return (
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-light)', marginBottom: 4 }}>Топ-10 сплитов</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, maxHeight: 200, overflowY: 'auto', marginBottom: 4 }}>
                      {top10.map((s, i) => (
                        <div key={i} onClick={() => { setBuilderSplit(s); setSplitType(s.id || 'auto'); }} style={{ padding: '4px 8px', borderRadius: 6, cursor: 'pointer', background: builderSplit?.name === s.name ? 'rgba(0,230,138,0.08)' : 'var(--bg-secondary)', border: builderSplit?.name === s.name ? '1px solid var(--accent)' : '1px solid var(--border)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-light)' }}>{s.name}</span>
                            <span style={{ fontSize: 8, fontWeight: 700, color: 'var(--accent)' }}>{(s.score * 100).toFixed(0)}%</span>
                          </div>
                          <div style={{ fontSize: 7, color: 'var(--text-dim)', marginTop: 1 }}>{s.desc}{s.rationale ? ' · ' + s.rationale.slice(0, 3).join(' | ') : ''}</div>
                        </div>
                      ))}
                    </div>
                    {rest.length > 0 && (
                      <details>
                        <summary style={{ fontSize: 9, fontWeight: 600, color: 'var(--accent)', cursor: 'pointer' }}>Показать все сплиты ({topSplits.length})</summary>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 4, maxHeight: 160, overflowY: 'auto' }}>
                          {rest.map((s, i) => (
                            <div key={i} onClick={() => { setBuilderSplit(s); setSplitType(s.id || 'auto'); }} style={{ padding: '4px 8px', borderRadius: 6, cursor: 'pointer', background: builderSplit?.name === s.name ? 'rgba(0,230,138,0.08)' : 'var(--bg-secondary)', border: builderSplit?.name === s.name ? '1px solid var(--accent)' : '1px solid var(--border)' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-light)' }}>{s.name}</span>
                                <span style={{ fontSize: 8, fontWeight: 700, color: 'var(--accent)' }}>{(s.score * 100).toFixed(0)}%</span>
                              </div>
                              <div style={{ fontSize: 7, color: 'var(--text-dim)', marginTop: 1 }}>{s.desc}</div>
                            </div>
                          ))}
                        </div>
                      </details>
                    )}
                  </div>
                );
              })()}
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => setBuilderStep(1)} style={{ flex: 1, padding: 8, borderRadius: 8, border: '1px solid var(--border)', cursor: 'pointer', background: 'var(--bg-secondary)', color: 'var(--text-dim)', fontSize: 12 }}>← Назад</button>
                <button onClick={() => setBuilderStep(3)} style={{ flex: 1, padding: 8, borderRadius: 8, border: 'none', cursor: 'pointer', background: 'var(--accent)', color: '#000', fontWeight: 600, fontSize: 12 }}>Далее: Упражнения</button>
              </div>
            </>)}

            {/* STEP 3: Упражнения */}
            {showWizard && builderStep === 3 && (<>
              <button onClick={() => {
                const s = builderSplit;
                if (s) {
                  const dayKeys = Object.keys(TRAINING_SPLITS);
                  const matchKey = dayKeys.find(k => TRAINING_SPLITS[k].name === s.name);
                  const sp = matchKey ? TRAINING_SPLITS[matchKey] : null;
                  const exByDay: Record<number, any[]> = {};
                  if (sp) {
                    const cycle: string[][] = [];
                    while (cycle.length < daysPerWeek) {
                      for (const g of sp.groupsPerDay) { cycle.push(g); if (cycle.length >= daysPerWeek) break; }
                    }
                    const isWeak = (group: string) => weakPoints.includes(group);
                    cycle.forEach((groups, di) => {
                      const dayExs: any[] = [];
                      groups.forEach(g => {
                        const isWk = isWeak(g);
                        const _allEx = getExercisesByGroup(g);
                        const _eqF = (e: typeof _allEx[number]) => tprofile.equipment.length === 0 || tprofile.equipment.includes(e.equipment);
                        const catalogExs = [...(_allEx.filter(_eqF).length > 0 ? _allEx.filter(_eqF) : _allEx)];
                        // Score exercises by relevance using calcExercisePrescription
                        const scored = catalogExs.map(ex => {
                          const presc = calcExercisePrescription(ex, goal, level, isWk, false, 1.0, 1, mesoLength || 12);
                          let score = 0;
                          if (ex.type === 'compound') score += 10;
                          if (ex.type === 'isolation') score += 3;
                          if (isWk) score += 2;
                          // (bestFor-скоринг убран: в каталоге Exercise нет поля bestFor)
                          return { ex, presc, score };
                        });
                        scored.sort((a, b) => b.score - a.score);
                        const compounds = scored.filter(s => s.ex.type === 'compound');
                        const isolations = scored.filter(s => s.ex.type !== 'compound');
                        const chosen: typeof scored = [];
                        chosen.push(...compounds.slice(0, 2));
                        chosen.push(...isolations.slice(0, Math.max(0, 3 - chosen.length)));
                        if (chosen.length === 0 && scored.length > 0) chosen.push(...scored.slice(0, 2));
                        chosen.forEach(({ ex, presc }, i) => {
                          dayExs.push({
                            name: ex.name,
                            sets: presc.sets,
                            reps: presc.reps,
                            rir: presc.rir,
                            rest: presc.rest,
                            group: g,
                            type: ex.type,
                            rpeHint: (() => {
                              if (ex.type === 'compound') return goal === 'strength' ? '8-9.5' : '7-9';
                              if (ex.type === 'isolation') return goal === 'strength' ? '8-9' : '8-10';
                              return '7-9';
                            })(),
                            dropSet: presc.dropSet,
                            backoffSet: presc.backoffSet,
                            substitutes: getExercisesByGroup(g).filter(e => e.name !== ex.name).slice(0, 3).map(e => e.name),
                          });
                        });
                      });
                      exByDay[di] = dayExs;
                    });
                  }
                  setBuilderDayExercises(exByDay);
                }
              }} style={{
                width: '100%', padding: 8, borderRadius: 8, border: '1px solid var(--accent)', cursor: 'pointer',
                background: 'rgba(0,230,138,0.08)', color: 'var(--accent)', fontWeight: 600, fontSize: 12, marginBottom: 8,
              }}>🔄 Сгенерировать заново</button>
              {/* Add/Remove day controls */}
              <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
                {Object.keys(builderDayExercises).length < 7 && (
                  <button onClick={() => {
                    const keys = Object.keys(builderDayExercises).map(Number);
                    const nextKey = keys.length > 0 ? Math.max(...keys) + 1 : 0;
                    const s = builderSplit;
                    if (s) {
                      const dayKeys = Object.keys(TRAINING_SPLITS);
                      const matchKey = dayKeys.find(k => TRAINING_SPLITS[k].name === s.name);
                      const sp = matchKey ? TRAINING_SPLITS[matchKey] : null;
                      let newGroup: string[] = ['chest', 'back'];
                      if (sp && sp.groupsPerDay.length > 0) {
                        newGroup = sp.groupsPerDay[nextKey % sp.groupsPerDay.length];
                      }
                      const dayExs: any[] = [];
                      newGroup.forEach(g => {
                        const _allEx = getExercisesByGroup(g);
                        const _eqF = (e: typeof _allEx[number]) => tprofile.equipment.length === 0 || tprofile.equipment.includes(e.equipment);
                        const catalogExs = [...(_allEx.filter(_eqF).length > 0 ? _allEx.filter(_eqF) : _allEx)];
                        const shuffled = catalogExs.sort(() => Math.random() - 0.5);
                        shuffled.slice(0, 2).forEach((ex, i) => {
                          dayExs.push({
                            name: ex.name, sets: 3, reps: '8-12', rir: 2,
                            rest: ex.type === 'compound' ? 120 : 60, group: g
                          });
                        });
                      });
                      setBuilderDayExercises({ ...builderDayExercises, [nextKey]: dayExs });
                    }
                  }} style={{
                    padding: '5px 10px', borderRadius: 6, border: '1px dashed rgba(0,230,138,0.3)', cursor: 'pointer',
                    background: 'trasparent', color: 'var(--accent)', fontSize: 10, fontWeight: 600,
                  }}>+ Добавить день</button>
                )}
                {Object.keys(builderDayExercises).length > 3 && (
                  <button onClick={() => {
                    const newExs = { ...builderDayExercises };
                    const keys = Object.keys(newExs).map(Number).sort((a, b) => b - a);
                    if (keys.length > 0) delete newExs[keys[0]];
                    setBuilderDayExercises(newExs);
                  }} style={{
                    padding: '5px 10px', borderRadius: 6, border: '1px solid rgba(239,68,68,0.3)', cursor: 'pointer',
                    background: 'rgba(239,68,68,0.06)', color: '#ef4444', fontSize: 10, fontWeight: 600,
                  }}>— Убрать день</button>
                )}
              </div>
              <div style={{ maxHeight: 380, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
                {Object.entries(builderDayExercises).sort(([a],[b]) => parseInt(a) - parseInt(b)).map(([dayKey, exs]) => (
                  <div key={dayKey} style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: 8, border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-light)', marginBottom: 6 }}>День {parseInt(dayKey) + 1} ({exs.length} упр)</div>
                    {exs.map((ex, ei) => {
                      const repOptions = ['3-5', '4-6', '6-10', '8-12', '10-15', '12-20'];
                      const rirOptions = [0, 1, 2, 3, 4];
                      const setOptions = [2, 3, 4, 5, 6];
                      return (<div key={ei}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '3px 4px', borderRadius: 4, marginBottom: 3, background: 'rgba(255,255,255,0.02)', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 10, fontWeight: 600, flex: 1, minWidth: 80 }}>{ex.name}</span>
                        {/* Sets ▲▼ */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <button onClick={() => {
                            const newExs = { ...builderDayExercises };
                            newExs[parseInt(dayKey)] = newExs[parseInt(dayKey)].map((e, j) => j === ei ? { ...e, sets: Math.max(1, e.sets - 1) } : e);
                            setBuilderDayExercises(newExs);
                          }} style={{ fontSize: 8, padding: '1px 4px', borderRadius: 3, border: '1px solid var(--border)', cursor: 'pointer', background: 'transparent', color: 'var(--text-dim)', lineHeight: 1 }}>▼</button>
                          <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--accent)', minWidth: 12, textAlign: 'center' }}>{ex.sets}</span>
                          <button onClick={() => {
                            const newExs = { ...builderDayExercises };
                            newExs[parseInt(dayKey)] = newExs[parseInt(dayKey)].map((e, j) => j === ei ? { ...e, sets: Math.min(8, e.sets + 1) } : e);
                            setBuilderDayExercises(newExs);
                          }} style={{ fontSize: 8, padding: '1px 4px', borderRadius: 3, border: '1px solid var(--border)', cursor: 'pointer', background: 'transparent', color: 'var(--text-dim)', lineHeight: 1 }}>▲</button>
                          <span style={{ fontSize: 7, color: 'var(--text-dim)' }}>сет</span>
                        </div>
                        {/* Reps dropdown */}
                        <select value={ex.reps} onChange={e => {
                          const newExs = { ...builderDayExercises };
                          newExs[parseInt(dayKey)] = newExs[parseInt(dayKey)].map((e2, j) => j === ei ? { ...e2, reps: e.target.value } : e2);
                          setBuilderDayExercises(newExs);
                        }} style={{ fontSize: 9, padding: '2px 2px', borderRadius: 4, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', maxWidth: 56 }}>
                          {repOptions.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                        {/* RIR dropdown */}
                        <select value={ex.rir} onChange={e => {
                          const newExs = { ...builderDayExercises };
                          newExs[parseInt(dayKey)] = newExs[parseInt(dayKey)].map((e2, j) => j === ei ? { ...e2, rir: parseInt(e.target.value) } : e2);
                          setBuilderDayExercises(newExs);
                        }} style={{ fontSize: 9, padding: '2px 2px', borderRadius: 4, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', maxWidth: 42 }}>
                          {rirOptions.map(r => <option key={r} value={r}>RIR{r}</option>)}
                        </select>
                        {/* RPE hint */}
                        <span style={{ fontSize: 8, color: 'var(--text-dim)', minWidth: 40, textAlign: 'center', padding: '1px 4px', borderRadius: 3, background: 'rgba(168,85,247,0.08)' }} title="Рекомендуемая интенсивность">
                          RPE {ex.rpeHint || '7-9'}
                        </span>
                        {ex.dropSet && <span style={{ fontSize: 7, padding: '1px 3px', borderRadius: 3, background: 'rgba(34,197,94,0.1)', color: '#22c55e' }} title="Дроп-сет">▾</span>}
                        {ex.backoffSet && <span style={{ fontSize: 7, padding: '1px 3px', borderRadius: 3, background: 'rgba(59,130,246,0.1)', color: '#3b82f6' }} title="Обратный сет">◂</span>}
                        {/* Substitute */}
                        <button onClick={() => {
                          setBuilderShowSubs(builderShowSubs === `${dayKey}_${ei}` ? null : `${dayKey}_${ei}`);
                        }} style={{ fontSize: 9, padding: '2px 5px', borderRadius: 4, border: '1px solid var(--border)', cursor: 'pointer', background: 'transparent', color: 'var(--text-dim)' }}>↔</button>
                        {/* Quick swap */}
                        <button onClick={() => {
                          const subs = getExercisesByGroup(ex.group || '');
                          if (subs.length > 0) {
                            const alt = subs[0];
                            const newExs = { ...builderDayExercises };
                            const name = alt.name || alt.id;
                            newExs[parseInt(dayKey)] = newExs[parseInt(dayKey)].map((e, j) => j === ei ? { ...e, name } : e);
                            setBuilderDayExercises(newExs);
                          }
                        }} style={{ fontSize: 9, padding: '2px 5px', borderRadius: 4, border: '1px solid var(--border)', cursor: 'pointer', background: 'transparent', color: 'var(--accent)' }}>↻</button>
                        {/* Delete */}
                        <button onClick={() => {
                          const newExs = { ...builderDayExercises };
                          newExs[parseInt(dayKey)] = newExs[parseInt(dayKey)].filter((_, j) => j !== ei);
                          setBuilderDayExercises(newExs);
                        }} style={{ fontSize: 9, padding: '2px 4px', borderRadius: 4, border: '1px solid rgba(239,68,68,0.3)', cursor: 'pointer', background: 'transparent', color: '#ef4444' }}>✕</button>
                      </div>
                      {builderShowSubs === `${dayKey}_${ei}` && (<>
                        <div style={{ fontSize: 8, color: 'var(--text-dim)', marginLeft: 8, marginBottom: 2 }}>Альтернативы:</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginLeft: 8, marginBottom: 4 }}>
                          {(ex.substitutes && ex.substitutes.length > 0 ? ex.substitutes : getExercisesByGroup(ex.group || '').filter(e => e.name !== ex.name).slice(0, 5).map(e => e.name || e.id)).map((altName: string, ai: number) => (
                              <button key={ai} onClick={() => {
                                const newExs = { ...builderDayExercises };
                                newExs[parseInt(dayKey)] = newExs[parseInt(dayKey)].map((e, j) => j === ei ? { ...e, name: altName } : e);
                                setBuilderDayExercises(newExs);
                                setBuilderShowSubs(null);
                              }} style={{ fontSize: 8, padding: '2px 6px', borderRadius: 4, border: '1px solid var(--border)', cursor: 'pointer', background: 'rgba(0,230,138,0.06)', color: 'var(--text-dim)' }}>
                                {altName}
                              </button>
                            ))}
                        </div>
                      </>)}
                    </div>);
                    })}
                    <button onClick={() => { setBuilderAddExDay(builderAddExDay === parseInt(dayKey) ? null : parseInt(dayKey)); }} style={{ marginTop: 4, fontSize: 9, padding: '3px 8px', borderRadius: 4, border: '1px dashed rgba(0,230,138,0.3)', cursor: 'pointer', background: 'transparent', color: 'var(--accent)' }}>+ Добавить упражнение</button>
                    {builderAddExDay === parseInt(dayKey) && (
                      <div style={{ marginTop: 4, maxHeight: 150, overflowY: 'auto' }}>
                        {[...EXERCISE_CATALOG].sort(() => Math.random() - 0.5).slice(0, 30).map((catEx, ci) => (
                          <div key={ci} onClick={() => {
                            const newExs = { ...builderDayExercises };
                            const presc = calcExercisePrescription(catEx, goal, level, false, false, 1);
                            newExs[parseInt(dayKey)] = [...(newExs[parseInt(dayKey)] || []), { name: catEx.name, sets: presc.sets, reps: presc.reps, rir: presc.rir, rest: presc.rest, group: catEx.group }];
                            setBuilderDayExercises(newExs);
                            setBuilderAddExDay(null);
                          }} style={{ fontSize: 9, padding: '3px 6px', cursor: 'pointer', borderRadius: 4, marginBottom: 1, background: 'rgba(255,255,255,0.02)' }}>
                            {catEx.name} <span style={{ color: 'var(--accent)', fontSize: 7 }}>{catEx.group}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {/* ─── Volume tracking per muscle group ─── */}
              {(() => {
                const lv = LEVEL_VOLUMES[level] || LEVEL_VOLUMES.intermediate;
                const volMap: Record<string, number> = {};
                Object.values(builderDayExercises).forEach((exs: any[]) => {
                  exs.forEach((ex: any) => {
                    const g = ex.group || '';
                    volMap[g] = (volMap[g] || 0) + (ex.sets || 0);
                  });
                });
                if (Object.keys(volMap).length === 0) return null;
                return (
                  <div style={{ background: 'rgba(0,230,138,0.03)', borderRadius: 8, padding: '8px 10px', marginBottom: 8, border: '1px solid rgba(0,230,138,0.08)' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent)', marginBottom: 6 }}>📊 Объём за неделю:</div>
                    {MUSCLE_GROUPS.filter(g => volMap[g]).map(g => {
                      const sets = volMap[g];
                      let status = '✅'; let statusColor = '#22c55e'; let note = '';
                      if (sets < lv.mev) { status = '🔴'; statusColor = '#ef4444'; note = `ниже MEV (${lv.mev})`; }
                      else if (sets >= lv.mrv) { status = '⚠️'; statusColor = '#f59e0b'; note = `близко к MRV (${lv.mrv})`; }
                      else if (sets >= lv.mrv * 0.85) { status = '⚠️'; statusColor = '#f59e0b'; note = `близко к MRV`; }
                      else { note = ''; }
                      return (
                        <div key={g} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '2px 0', fontSize: 10 }}>
                          <span style={{ color: 'var(--text-light)', fontWeight: 600 }}>{GROUP_LABELS[g] || g}:</span>
                          <span style={{ color: statusColor }}>
                            {sets} подходов (MEV: {lv.mev}, MAV: {lv.mav}, MRV: {lv.mrv}) {status} {note}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => setBuilderStep(2)} style={{ flex: 1, padding: 8, borderRadius: 8, border: '1px solid var(--border)', cursor: 'pointer', background: 'var(--bg-secondary)', color: 'var(--text-dim)', fontSize: 12 }}>← Назад</button>
                <button onClick={() => {
                  setBuilderMesoLength(mesoLength);
                  const plan = generateWeeklyPlan({ goal, level, daysPerWeek, recovery, fatigue, nutrition: 7, weakPoints, sessionDuration: 60, exercises: [] } as TrainingInput, mesoLength || 8);
                  setBuilderMacroResult(plan);
                  setBuilderStep(4);
                }} style={{ flex: 1, padding: 8, borderRadius: 8, border: 'none', cursor: 'pointer', background: 'var(--accent)', color: '#000', fontWeight: 600, fontSize: 12 }}>Далее: Цикл</button>
              </div>
            </>)}

            {/* STEP 4: Цикл */}
            {showWizard && builderStep === 4 && (<>
              {/* Mesocycle length control */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>Длина мезоцикла:</span>
                <button onClick={() => { const n = Math.max(4, builderMesoLength - 1); setBuilderMesoLength(n); }} style={{ padding: '2px 8px', borderRadius: 4, border: '1px solid var(--border)', cursor: 'pointer', background: 'var(--bg-secondary)', color: 'var(--text-dim)', fontSize: 10 }}>−</button>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', minWidth: 20, textAlign: 'center' }}>{builderMesoLength}</span>
                <button onClick={() => { const n = Math.min(20, builderMesoLength + 1); setBuilderMesoLength(n); }} style={{ padding: '2px 8px', borderRadius: 4, border: '1px solid var(--border)', cursor: 'pointer', background: 'var(--bg-secondary)', color: 'var(--text-dim)', fontSize: 10 }}>+</button>
                <span style={{ fontSize: 9, color: 'var(--text-dim)' }}>нед</span>
                <button onClick={() => {
                  const plan = generateWeeklyPlan({ goal, level, daysPerWeek, recovery, fatigue, nutrition: 7, weakPoints, sessionDuration: 60, exercises: [] } as TrainingInput, builderMesoLength);
                  setBuilderMacroResult(plan);
                }} style={{ marginLeft: 'auto', padding: '5px 12px', borderRadius: 6, border: '1px solid var(--accent)', cursor: 'pointer', background: 'rgba(0,230,138,0.08)', color: 'var(--accent)', fontWeight: 600, fontSize: 10 }}>
                  🔄 Обновить цикл
                </button>
              </div>

              {builderMacroResult ? (
                <>
                  {/* Total cycle stats */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6, marginBottom: 8 }}>
                    {(() => {
                      const wks = builderMacroResult;
                      const deloadWeeks = wks.filter((w: any) => w.phase === 'deload' || w.deloadWeek).length;
                      const baseWeeks = wks.filter((w: any) => w.phase === 'base').length;
                      const peakWeeks = wks.filter((w: any) => w.phase === 'peak').length;
                      const allVol = wks.map((w: any) => typeof w.volumePerGroup === 'number' ? w.volumePerGroup : 0);
                      const totalVol = allVol.reduce((s: number, v: number) => s + v, 0);
                      const avgVol = allVol.length > 0 ? Math.round(totalVol / allVol.length) : 0;
                      const maxVol = Math.max(...allVol, 0);
                      const avgRIR = wks.reduce((s: number, w: any) => s + (w.rir || 2), 0) / Math.max(1, wks.length);
                      const estProg = selectProgressionRule(level).weeklyWeightIncrement * wks.length;
                      return (<>
                        <div style={{ background: 'var(--bg-secondary)', borderRadius: 6, padding: 6, textAlign: 'center' }}>
                          <div style={{ fontSize: 8, color: 'var(--text-dim)' }}>Недель</div>
                          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--accent)' }}>{wks.length}</div>
                          <div style={{ fontSize: 7, color: 'var(--text-dim)' }}>deload: {deloadWeeks}</div>
                        </div>
                        <div style={{ background: 'var(--bg-secondary)', borderRadius: 6, padding: 6, textAlign: 'center' }}>
                          <div style={{ fontSize: 8, color: 'var(--text-dim)' }}>Ср. объём</div>
                          <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--accent)' }}>{avgVol}</div>
                          <div style={{ fontSize: 7, color: 'var(--text-dim)' }}>макс {maxVol}</div>
                        </div>
                        <div style={{ background: 'var(--bg-secondary)', borderRadius: 6, padding: 6, textAlign: 'center' }}>
                          <div style={{ fontSize: 8, color: 'var(--text-dim)' }}>Ср. RIR</div>
                          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--accent)' }}>{avgRIR.toFixed(1)}</div>
                          <div style={{ fontSize: 7, color: 'var(--text-dim)' }}>интенсивность</div>
                        </div>
                        <div style={{ background: 'var(--bg-secondary)', borderRadius: 6, padding: 6, textAlign: 'center' }}>
                          <div style={{ fontSize: 8, color: 'var(--text-dim)' }}>~1RM прогноз</div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)' }}>+{estProg.toFixed(1)} кг</div>
                          <div style={{ fontSize: 7, color: 'var(--text-dim)' }}>{selectProgressionRule(level).name}</div>
                        </div>
                      </>);
                    })()}
                  </div>

                  {/* Volume progression bar chart */}
                  <div style={{ marginBottom: 8, background: 'var(--bg-secondary)', borderRadius: 8, padding: 8 }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-dim)', marginBottom: 4 }}>📊 Прогрессия объёма по неделям</div>
                    <div style={{ display: 'flex', gap: 1, height: 50, alignItems: 'flex-end' }}>
                      {builderMacroResult.map((w: any, i: number) => {
                        const allVol = builderMacroResult.map((ww: any) => typeof ww.volumePerGroup === 'number' ? ww.volumePerGroup : 0);
                        const vMax = Math.max(...allVol, 1);
                        const v = typeof w.volumePerGroup === 'number' ? w.volumePerGroup : 0;
                        const h = Math.max(6, (v / vMax) * 100);
                        const phaseColors: Record<string, string> = { base: '#3b82f6', build: '#f59e0b', peak: '#ef4444', deload: '#22c55e' };
                        const col = w.deloadWeek ? '#22c55e' : (phaseColors[w.phase] || '#888');
                        return (
                          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                            <div style={{ width: '80%', height: `${h}%`, background: col, borderRadius: '2px 2px 0 0', opacity: w.deloadWeek ? 0.7 : 0.9 }} />
                            <span style={{ fontSize: 6, color: w.deloadWeek ? '#22c55e' : 'var(--text-dim)', fontWeight: 600 }}>{w.weekNumber}</span>
                          </div>
                        );
                      })}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: 10, fontSize: 7, color: 'var(--text-dim)', marginTop: 4 }}>
                      <span><span style={{ color: '#3b82f6' }}>■</span> База</span>
                      <span><span style={{ color: '#f59e0b' }}>■</span> Сборка</span>
                      <span><span style={{ color: '#ef4444' }}>■</span> Пик</span>
                      <span><span style={{ color: '#22c55e' }}>■</span> Разгрузка</span>
                    </div>
                  </div>

                  {/* Week cards */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 320, overflowY: 'auto', marginBottom: 8 }}>
                    {builderMacroResult.map((w: any, i: number) => {
                      const phaseColors: Record<string, string> = { base: '#3b82f6', build: '#f59e0b', peak: '#ef4444', deload: '#22c55e' };
                      const col = w.deloadWeek ? '#22c55e' : (phaseColors[w.phase] || '#3b82f6');
                      const phaseName = w.phaseName || w.phase || 'base';
                      const techniqueName = w.deloadWeek ? 'Восстановление' :
                        w.phase === 'peak' ? 'Кластеры / синглы' :
                        w.phase === 'build' ? 'Rest-pause / Myo-reps' : 'Стандарт';
                      const rpeLo = Math.max(5, Math.round((w.rir || 2) + (w.deloadWeek ? 4 : 5)));
                      const rpeHi = Math.min(10, rpeLo + (w.deloadWeek ? 2 : w.phase === 'peak' ? 2 : 3));
                      return (
                        <div key={i} style={{
                          padding: '6px 8px', borderRadius: 8, border: w.deloadWeek ? '1px solid rgba(34,197,94,0.3)' : '1px solid var(--border)',
                          background: w.deloadWeek ? 'rgba(34,197,94,0.06)' : 'var(--bg-secondary)',
                          borderLeft: `3px solid ${col}`,
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-light)' }}>Н{w.weekNumber}</span>
                              <span style={{ fontSize: 8, padding: '2px 6px', borderRadius: 4, background: col + '22', color: col, fontWeight: 600, textTransform: 'uppercase' }}>
                                {w.deloadWeek ? 'DELOAD' : phaseName}
                              </span>
                              {w.deloadWeek && <span style={{ fontSize: 8, color: '#22c55e', fontWeight: 600 }}>🧊</span>}
                            </div>
                            <span style={{ fontSize: 8, color: 'var(--text-dim)' }}>
                              RPE {rpeLo}-{rpeHi}
                            </span>
                          </div>
                          <div style={{ display: 'flex', gap: 10, fontSize: 9, color: 'var(--text-dim)', flexWrap: 'wrap' }}>
                            <span>RIR: <b style={{ color: 'var(--accent)' }}>{w.rir}</b></span>
                            <span>Vol: <b style={{ color: 'var(--accent)' }}>{typeof w.volumePerGroup === 'number' ? w.volumePerGroup : '—'}</b></span>
                            <span>Техника: <b>{techniqueName}</b></span>
                            {w.note && <span style={{ color: '#ff9100', fontWeight: 600 }}>{w.note}</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Add/Remove week controls */}
                  <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
                    <button onClick={() => {
                      const n = Math.min(20, builderMesoLength + 1);
                      setBuilderMesoLength(n);
                      const plan = generateWeeklyPlan({ goal, level, daysPerWeek, recovery, fatigue, nutrition: 7, weakPoints, sessionDuration: 60, exercises: [] } as TrainingInput, n);
                      setBuilderMacroResult(plan);
                    }} style={{
                      flex: 1, padding: 6, borderRadius: 6, border: '1px dashed rgba(0,230,138,0.3)', cursor: 'pointer',
                      background: 'transparent', color: 'var(--accent)', fontSize: 10, fontWeight: 600,
                    }}>+ Добавить неделю</button>
                    <button onClick={() => {
                      const n = Math.max(4, builderMesoLength - 1);
                      setBuilderMesoLength(n);
                      const plan = generateWeeklyPlan({ goal, level, daysPerWeek, recovery, fatigue, nutrition: 7, weakPoints, sessionDuration: 60, exercises: [] } as TrainingInput, n);
                      setBuilderMacroResult(plan);
                    }} style={{
                      flex: 1, padding: 6, borderRadius: 6, border: '1px solid rgba(239,68,68,0.3)', cursor: 'pointer',
                      background: 'rgba(239,68,68,0.06)', color: '#ef4444', fontSize: 10, fontWeight: 600,
                    }}>— Убрать неделю</button>
                  </div>
                </>
              ) : (
                <div style={{ fontSize: 10, color: 'var(--text-dim)', textAlign: 'center', padding: 20 }}>Цикл не сгенерирован. Вернитесь на шаг 3.</div>
              )}

              <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                <button onClick={() => setBuilderStep(3)} style={{ flex: 1, padding: 8, borderRadius: 8, border: '1px solid var(--border)', cursor: 'pointer', background: 'var(--bg-secondary)', color: 'var(--text-dim)', fontSize: 12 }}>← Назад</button>
              </div>
              {builderSavedMsg && (
                <div style={{ fontSize: 10, color: '#22c55e', fontWeight: 600, textAlign: 'center', marginBottom: 6, padding: '4px 8px', background: 'rgba(34,197,94,0.08)', borderRadius: 6 }}>
                  {builderSavedMsg}
                </div>
              )}
              {/* Save / Export buttons */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <button onClick={() => {
                  try {
                    const prog = {
                      name: builderSplit?.name || 'Моя программа',
                      goal, level, daysPerWeek,
                      split: builderSplit,
                      exercises: builderDayExercises,
                      macrocycle: builderMacroResult,
                      mesoLength: builderMesoLength,
                      createdAt: new Date().toISOString(),
                    };
                    const existing = JSON.parse(localStorage.getItem('customPrograms') || '[]');
                    existing.push(prog);
                    localStorage.setItem('customPrograms', JSON.stringify(existing));
                    localStorage.setItem('activeProgram', JSON.stringify(prog));
                    setBuilderSavedMsg('Программа сохранена в "Мои программы"');
                    setTimeout(() => setBuilderSavedMsg(''), 3000);
                  } catch { setBuilderSavedMsg('Ошибка сохранения'); }
                }} style={{ width: '100%', padding: 10, borderRadius: 8, border: 'none', cursor: 'pointer', background: 'var(--accent)', color: '#000', fontWeight: 600, fontSize: 12 }}>
                  💾 Сохранить в мои программы
                </button>
                <button onClick={() => {
                  try {
                    const prog = {
                      name: builderSplit?.name || 'Моя программа',
                      goal, level, daysPerWeek,
                      split: builderSplit,
                      exercises: builderDayExercises,
                      macrocycle: builderMacroResult,
                      mesoLength: builderMesoLength,
                      createdAt: new Date().toISOString(),
                    };
                    const existing = JSON.parse(localStorage.getItem('myProgramTemplates') || '[]');
                    existing.push({ ...prog, isTemplate: true });
                    localStorage.setItem('myProgramTemplates', JSON.stringify(existing));
                    setBuilderSavedMsg('Шаблон сохранён');
                    setTimeout(() => setBuilderSavedMsg(''), 3000);
                  } catch { setBuilderSavedMsg('Ошибка сохранения шаблона'); }
                }} style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid var(--accent)', cursor: 'pointer', background: 'rgba(0,230,138,0.08)', color: 'var(--accent)', fontWeight: 600, fontSize: 12 }}>
                  📋 Сохранить как шаблон
                </button>
                <button onClick={() => {
                  try {
                    const dayNames = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
                    let text = `🏋️ ${builderSplit?.name || 'Моя программа'}\n`;
                    text += `🎯 Цель: ${GOALS.find(g => g.value === goal)?.icon || ''} ${goal} | Уровень: ${level} | ${daysPerWeek} дн/нед | ${builderMesoLength} нед\n\n`;
                    text += `=== УПРАЖНЕНИЯ ===\n`;
                    Object.entries(builderDayExercises).sort(([a], [b]) => parseInt(a) - parseInt(b)).forEach(([dayKey, exs]) => {
                      text += `\nДень ${parseInt(dayKey) + 1}:\n`;
                      exs.forEach((ex: any) => {
                        text += `  ${ex.name} — ${ex.sets}×${ex.reps} RIR${ex.rir} (отдых ${ex.rest}с)\n`;
                      });
                    });
                    if (builderMacroResult) {
                      text += `\n=== МАКРОЦИКЛ ===\n`;
                      builderMacroResult.forEach((w: any) => {
                        const phaseLabel = w.deloadWeek ? 'DELOAD' : (w.phaseName || w.phase || '');
                        text += `Н${w.weekNumber}: ${phaseLabel} | RIR ${w.rir} | Vol ${typeof w.volumePerGroup === 'number' ? w.volumePerGroup : '—'}\n`;
                      });
                    }
                    navigator.clipboard.writeText(text).then(() => {
                      setBuilderSavedMsg('Программа скопирована в буфер обмена');
                      setTimeout(() => setBuilderSavedMsg(''), 3000);
                    }).catch(() => {
                      setBuilderSavedMsg('Не удалось скопировать (не HTTPS?)');
                    });
                  } catch { setBuilderSavedMsg('Ошибка копирования'); }
                }} style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid var(--border)', cursor: 'pointer', background: 'var(--bg-secondary)', color: 'var(--text-dim)', fontWeight: 600, fontSize: 12 }}>
                  📋 Копировать как текст
                </button>
              </div>
            </>)}
          </div>
        </>)}
        </div>
        </InfoErrorBoundary>
      )}

      {/* ═══════════ DIARY AND ANALYTICS TAB (объединённый дневник+аналитика) ═══════════ */}
      {tab === 'diary' && (
        <InfoErrorBoundary label="Дневник">
          <DiaryAndAnalyticsTab
            diary={diary}
            diaryStats={diaryStats}
            diaryProgress={diaryProgress}
            historyWorkouts={historyWorkouts}
            macrocycle={macrocycle}
            selectedWeek={selectedWeek}
            level={level}
            onRefresh={loadDiaryStats}
          />
        </InfoErrorBoundary>
      )}

      {/* ═══════════ TRAINING MIXES TAB ═══════════ */}
      {tab === 'mixes' && (
        <InfoErrorBoundary label="Тренировочные миксы">
          <TrainingMixTab />
        </InfoErrorBoundary>
      )}

      {/* ═══════════ CYCLES TAB ═══════════ */}
      {tab === 'cycles' && (
        <InfoErrorBoundary label="Циклы">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <MicrocyclePlannerCard />
          <div style={{ padding: 12, borderRadius: 14, background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)', marginBottom: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#ef4444', marginBottom: 2 }}>🩹 Травмы / ограничения</div>
            <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 8 }}>Указанные группы исключаются из генерации плана на активный период. Дата «до» — пусто = травма актуальна.</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr auto', gap: 6, marginBottom: 8, alignItems: 'end' }}>
              <div>
                <label style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)' }}>Группа</label>
                <select value={injMuscle} onChange={e => setInjMuscle(e.target.value)} style={{ width: '100%', background: '#18181b', color: '#fff', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, padding: 6, fontSize: 11 }}>
                  {MUSCLE_GROUPS.map(g => <option key={g} value={g}>{GROUP_LABELS[g]}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)' }}>С</label>
                <input type="date" value={injFrom} onChange={e => setInjFrom(e.target.value)} style={{ width: '100%', background: '#18181b', color: '#fff', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, padding: 6, fontSize: 11 }} />
              </div>
              <div>
                <label style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)' }}>До (опц)</label>
                <input type="date" value={injTo} onChange={e => setInjTo(e.target.value)} style={{ width: '100%', background: '#18181b', color: '#fff', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, padding: 6, fontSize: 11 }} />
              </div>
              <button onClick={() => { if (!injFrom) return; updateTProfile({ injuries: [...(tprofile.injuries || []), { muscle: injMuscle, from: injFrom, to: injTo || undefined }] }); setInjFrom(''); setInjTo(''); }} disabled={!injFrom} style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid rgba(239,68,68,0.3)', background: injFrom ? 'rgba(239,68,68,0.12)' : 'transparent', color: '#ef4444', cursor: injFrom ? 'pointer' : 'not-allowed', fontWeight: 700, fontSize: 11, whiteSpace: 'nowrap' }}>+ Доб</button>
            </div>
            {(tprofile.injuries || []).length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {tprofile.injuries.map((inj, i) => {
                  const today = new Date().toISOString().slice(0, 10);
                  const active = (inj.from || '') <= today && (!inj.to || inj.to >= today);
                  return (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 8px', borderRadius: 6, background: active ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <span style={{ fontSize: 11, color: active ? '#fca5a5' : 'var(--text-dim)' }}>{GROUP_LABELS[inj.muscle] || inj.muscle} · {inj.from}–{inj.to || '…'} {active ? '🔴 активно' : '✅ прошло'}</span>
                      <button onClick={() => updateTProfile({ injuries: (tprofile.injuries || []).filter((_, j) => j !== i) })} style={{ padding: '2px 7px', borderRadius: 5, border: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.08)', color: '#ef4444', cursor: 'pointer', fontSize: 10 }}>✕</button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          {/* Controls - glass card */}
          <div style={{ padding:12, borderRadius:14, background:'rgba(24,24,27,0.12)', border:'1px solid rgba(255,255,255,0.04)' }}>
            <div style={{ fontSize:10, color:'rgba(255,255,255,0.35)', fontWeight:500, letterSpacing:'0.3px', textTransform:'uppercase', marginBottom:8 }}>🔄 Параметры цикла</div>
            {/* Goal */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:4, marginBottom:8 }}>
              {GOALS.map(g => (
                <button key={g.value} onClick={() => { setGoal(g.value); setTimeout(generatePlan, 50); }} style={{
                  padding:'5px 8px', borderRadius:8, fontSize:10, fontWeight: goal === g.value ? 700 : 400,
                  cursor:'pointer', border: goal === g.value ? '1px solid var(--accent)' : '1px solid rgba(255,255,255,0.08)',
                  background: goal === g.value ? 'rgba(0,230,138,0.12)' : 'rgba(255,255,255,0.03)', color: 'var(--text)', textAlign:'left',
                }}>{g.icon} {g.label}</button>
              ))}
            </div>
            {/* Periodization pills */}
            <div style={{ display:'flex', gap:4, flexWrap:'wrap', marginBottom:8, alignItems:'center' }}>
              <span style={{ fontSize:9, color:'rgba(255,255,255,0.35)' }}>Периодизация:</span>
              {[
                { v:'auto', l:'Авто' }, { v:'linear', l:'Линейная' },
                { v:'undulating', l:'DUP' }, { v:'block', l:'Блочная' },
              ].map(p => (
                <button key={p.v} onClick={() => { setPeriodizationType(p.v as 'auto' | 'linear' | 'undulating' | 'block' | 'conjugate'); setTimeout(generatePlan, 50); }} style={{
                  padding:'3px 8px', borderRadius:6, fontSize:9, fontWeight: periodizationType === p.v ? 700 : 400, cursor:'pointer',
                  border: periodizationType === p.v ? '1px solid var(--accent)' : '1px solid rgba(255,255,255,0.08)',
                  background: periodizationType === p.v ? 'rgba(0,230,138,0.12)' : 'rgba(255,255,255,0.03)', color: 'var(--text)',
                }}>{p.l}</button>
              ))}
            </div>
            {/* Cycle type - expanded with descriptions */}
            <div style={{ fontSize:9, color:'rgba(255,255,255,0.35)', marginBottom:4 }}>Тип цикла:</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:3, marginBottom:8 }}>
              {[
                { v:'auto', l:'Авто', d:'Автоматический подбор по цели и уровню' },
                { v:'bb_mass', l:'Масса', d:'Высокий объём, изоляция, wave-кривая' },
                { v:'bb_specialization', l:'Специализация', d:'Акцент на отстающие группы' },
                { v:'pl_peaking', l:'Пауэрлифтинг', d:'Силовой пик, 1ПМ, линейная кривая' },
                { v:'wl_tech', l:'Тяжелоатлет', d:'Технические движения, рывок/толчок' },
                { v:'cf_cond', l:'Кроссфит', d:'Кондиционирование, метконы, круговые' },
                { v:'rehab', l:'Реабилитация', d:'Восстановление, низкий объём' },
              ].map(c => (
                <button key={c.v} onClick={() => { setCycleType(c.v); setTimeout(generatePlan, 50); }} title={c.d} style={{
                  padding:'4px 6px', borderRadius:6, fontSize:8, fontWeight: cycleType === c.v ? 700 : 400, cursor:'pointer',
                  border: cycleType === c.v ? '1px solid #00e68a' : '1px solid rgba(255,255,255,0.06)',
                  background: cycleType === c.v ? 'rgba(0,230,138,0.12)' : 'rgba(255,255,255,0.02)', color: 'var(--text)',
                  textAlign:'center', lineHeight:1.2,
                }}><div style={{fontWeight: cycleType === c.v ? 700 : 500}}>{c.l}</div><div style={{fontSize:6, color:'rgba(255,255,255,0.3)', marginTop:1}}>{c.d}</div></button>
              ))}
            </div>
            {/* Level pills + generate */}
            <div style={{ display:'flex', gap:4, flexWrap:'wrap', alignItems:'center', marginBottom:8 }}>
              <span style={{ fontSize:9, color:'rgba(255,255,255,0.35)' }}>Уровень:</span>
              {LEVELS.map(l => (
                <button key={l.value} onClick={() => setLevel(l.value)} style={{
                  padding:'3px 8px', borderRadius:6, fontSize:9, fontWeight: level === l.value ? 700 : 400, cursor:'pointer',
                  border: level === l.value ? '1px solid var(--accent)' : '1px solid rgba(255,255,255,0.08)',
                  background: level === l.value ? 'rgba(0,230,138,0.12)' : 'rgba(255,255,255,0.03)', color: 'var(--text)',
                }}>{l.icon} {l.label}</button>
              ))}
            </div>
            <button onClick={() => generatePlan()} style={{
              width:'100%', padding:'9px', borderRadius:10, border:'none', cursor:'pointer',
              background:'linear-gradient(135deg,var(--accent),#00cc7a)', color:'#000', fontWeight:700, fontSize:12,
            }}>▶ Сгенерировать макроцикл</button>
            {cyclesError && <div style={{ padding:'6px 10px', borderRadius:6, background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', color:'#ef4444', fontSize:10, marginTop:6, textAlign:'center' }}>{cyclesError}</div>}
          </div>

          {/* Empty state */}
          {!macrocycle && !cyclesError && (
            <div style={{ padding:24, borderRadius:14, background:'rgba(24,24,27,0.08)', border:'1px solid rgba(255,255,255,0.04)', textAlign:'center' }}>
              <div style={{ fontSize:28, marginBottom:6 }}>🔄</div>
              <div style={{ fontSize:12, color:'rgba(255,255,255,0.4)', marginBottom:4 }}>Макроцикл ещё не сгенерирован</div>
              <div style={{ fontSize:10, color:'rgba(255,255,255,0.3)' }}>Выберите параметры выше и нажмите «Сгенерировать макроцикл»</div>
            </div>
          )}

          {macrocycle && (() => {
            const gCard: React.CSSProperties = { padding:12, borderRadius:14, background:'rgba(24,24,27,0.12)', border:'1px solid rgba(255,255,255,0.04)', marginBottom:8 };
            const gLabel: React.CSSProperties = { fontSize:10, color:'rgba(255,255,255,0.35)', fontWeight:500, letterSpacing:'0.3px', textTransform:'uppercase', marginBottom:8 };
            // Determine cycle type name
            const ctName = cycleType === 'auto' ? 'Авто' : ({ bb_mass:'Масса', bb_specialization:'Специализация', pl_peaking:'Пауэрлифтинг', wl_tech:'Тяжелоатлет', cf_cond:'Кроссфит', rehab:'Реабилитация' } as Record<string,string>)[cycleType] || 'Авто';
            const goalName = GOALS.find(g => g.value === macrocycle.goal)?.label || macrocycle.goal;
            const levelName = LEVELS.find(l => l.value === macrocycle.level)?.label || macrocycle.level;
            return (<>
              {/* Volume/intensity chart */}
              <div style={gCard}>
                <div style={gLabel}>📊 Объём и интенсивность по неделям</div>
                <div style={{ display:'flex', gap:1, height:80, alignItems:'flex-end' }}>
                  {(macrocycle.mesocycles || []).flatMap(mc => mc.microcycles || []).map((mc, wi) => {
                    const isCurrent = wi + 1 === selectedWeek;
                    const volH = Math.max(4, (mc?.volumeMultiplier || 1) * 35);
                    const intH = Math.max(4, (mc?.rpeTarget || 7) * 5);
                    const color = mc?.mesocycleType === 'accumulation' ? '#22c55e' :
                                 mc?.mesocycleType === 'intensification' ? '#eab308' :
                                 mc?.mesocycleType === 'peaking' ? '#ef4444' : '#6b7280';
                    return (
                      <div key={wi} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:1, cursor:'pointer' }}
                        onClick={() => { setSelectedWeek(wi + 1); setTab('plan'); }}>
                        <div style={{ width:'70%', height:volH, background:color, borderRadius:'2px 2px 0 0', opacity: isCurrent ? 1 : 0.4, transition:'height 0.2s' }} />
                        <div style={{ width:'40%', height:intH, background:color, borderRadius:'2px 2px 0 0', opacity: isCurrent ? 0.8 : 0.3 }} />
                        <span style={{ fontSize:7, color: isCurrent ? 'var(--accent)' : 'rgba(255,255,255,0.3)', fontWeight: isCurrent ? 700 : 400 }}>{wi + 1}</span>
                      </div>
                    );
                  })}
                </div>
                <div style={{ display:'flex', justifyContent:'center', gap:12, fontSize:8, color:'rgba(255,255,255,0.3)', marginTop:4 }}>
                  <span><span style={{ color:'#22c55e' }}>■</span> Накопление</span>
                  <span><span style={{ color:'#eab308' }}>■</span> Интенсификация</span>
                  <span><span style={{ color:'#ef4444' }}>■</span> Пик</span>
                  <span><span style={{ color:'#6b7280' }}>■</span> Разгрузка</span>
                </div>
              </div>

              {/* Macrocycle header + mesocycles */}
              <div style={gCard}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
                  <span style={gLabel}>📅 {macrocycle.totalWeeks}-недельный макроцикл</span>
                  <span style={{ fontSize:8, padding:'2px 6px', borderRadius:4, background:'rgba(0,230,138,0.1)', color:'#00e68a' }}>{ctName}</span>
                </div>
                <div style={{ fontSize:10, color:'rgba(255,255,255,0.3)', marginBottom:6 }}>
                  {goalName} • {levelName} • Phase curve: {cycleType === 'bb_mass' || goal === 'bulk' ? '🌊 Wave' : goal === 'strength' || cycleType === 'pl_peaking' ? '📈 Linear' : goal === 'rehab' ? '📉 Inverted' : '⚖️ Balanced'}
                  {cycleType !== 'auto' && <span style={{ marginLeft:6, color:'rgba(255,255,255,0.2)' }}>| {({ bb_mass:'Высокий объём, изоляция', bb_specialization:'Акцент на слабые группы', pl_peaking:'Силовой пик, низкий объём', wl_tech:'Технические движения', cf_cond:'Метконы, круговые', rehab:'Восстановление' } as Record<string,string>)[cycleType]}</span>}
                </div>
                {macrocycle.mesocycles.map((mc, mi) => (
                  <div key={mi} style={{ marginBottom:6, borderRadius:10, overflow:'hidden', background:'rgba(255,255,255,0.02)', border: expandedMeso === mi ? '1px solid rgba(0,230,138,0.15)' : '1px solid rgba(255,255,255,0.03)' }}
                    onClick={() => setExpandedMeso(expandedMeso === mi ? null : mi)}>
                    <div style={{ display:'flex', justifyContent:'space-between', padding:'6px 8px', cursor:'pointer' }}>
                      <span style={{ fontWeight:600, fontSize:11, color:'rgba(255,255,255,0.7)' }}>
                        {PHASE_LABELS[mc.type] || 'Рабочая фаза'} <span style={{ fontSize:8, color:'rgba(255,255,255,0.2)' }}>Мезо {mi + 1}</span>
                      </span>
                      <span style={{ fontSize:9, color:'rgba(255,255,255,0.3)' }}>{mc.weeks} нед ({mc.weekStart + 1}–{mc.weekStart + mc.weeks}) {expandedMeso === mi ? '▴' : '▾'}</span>
                    </div>
                    <div style={{ fontSize:8, color:'rgba(255,255,255,0.25)', padding:'0 8px 4px' }}>
                      {PHASE_HINTS[mc.type] || 'Стабильная рабочая фаза с контролем объёма, интенсивности и восстановления.'}
                    </div>
                    {/* Week squares */}
                    <div style={{ display:'flex', gap:3, flexWrap:'wrap', padding:'0 8px 6px' }}>
                      {Array.from({ length: mc.weeks }, (_, wi) => {
                        const weekNum = mc.weekStart + wi + 1;
                        const micro = mc.microcycles?.[wi];
                        const isDeload = micro?.isDeload;
                        return <div key={wi} style={{
                          width:22, height:22, borderRadius:4, display:'flex', alignItems:'center', justifyContent:'center',
                          background: selectedWeek === weekNum ? 'rgba(0,230,138,0.3)' : isDeload ? 'rgba(107,114,128,0.2)' : 'rgba(255,255,255,0.04)',
                          border: selectedWeek === weekNum ? '1px solid var(--accent)' : '1px solid rgba(255,255,255,0.06)',
                          fontSize:8, color: selectedWeek === weekNum ? 'var(--accent)' : 'rgba(255,255,255,0.4)',
                          cursor:'pointer', transition:'all 0.15s',
                        }} onClick={(e) => { e.stopPropagation(); setSelectedWeek(weekNum); setTab('plan'); }}>
                          {weekNum}
                        </div>;
                      })}
                    </div>
                    {/* Expanded detail */}
                    {expandedMeso === mi && (
                      <div style={{ borderTop:'1px solid rgba(255,255,255,0.04)', padding:'6px 8px' }}>
                        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:4, marginBottom:4 }}>
                          {[
                            { label:'Тип', value: mc.type || 'Рабочий', color:'var(--accent)' },
                            { label:'Объём', value: `${(mc.microcycles?.[0]?.volumeMultiplier ?? 1).toFixed(1)}×`, color:'#60a5fa' },
                            { label:'RIR', value: `${mc.microcycles?.[0]?.rirRange?.[0] ?? 1}-${mc.microcycles?.[0]?.rirRange?.[1] ?? 3}`, color:'#f59e0b' },
                          ].map((s,i) => <div key={i} style={{ background:'rgba(255,255,255,0.02)', borderRadius:6, padding:'3px 6px', textAlign:'center' }}>
                            <div style={{ fontSize:7, color:'rgba(255,255,255,0.3)' }}>{s.label}</div>
                            <div style={{ fontSize:10, fontWeight:700, color:s.color }}>{s.value}</div>
                          </div>)}
                        </div>
                        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:4, fontSize:8 }}>
                          {[
                            { label:'RPE', value: `${mc.microcycles?.[0]?.rpeTarget ?? 7}`, color:'var(--accent)' },
                            { label:'Сплит', value: goal === 'bulk' ? 'Гипертрофия' : goal === 'strength' ? 'Сила' : goal === 'cut' ? 'Сушка' : 'Баланс', color:'#a78bfa' },
                            { label:'Дней', value: `${daysPerWeek}`, color:'#f59e0b' },
                          ].map((s,i) => <div key={i} style={{ background:'rgba(255,255,255,0.02)', borderRadius:6, padding:'3px', textAlign:'center' }}>
                            <span style={{ color:'rgba(255,255,255,0.3)' }}>{s.label}: <b style={{ color:s.color }}>{s.value}</b></span>
                          </div>)}
                        </div>
                        {mc.microcycles && mc.microcycles.length > 0 && (
                          <div style={{ fontSize:8, color:'rgba(255,255,255,0.25)', marginTop:4 }}>
                            Микроциклов: {mc.microcycles.length} | Прогрессия: <b style={{ color:'var(--accent)' }}>{mc.type === 'accumulation' ? '+объём' : mc.type === 'intensification' ? '+интенсивность' : mc.type === 'peaking' ? 'пик' : 'разгрузка'}</b>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Projected max-out */}
              {diaryStats.length > 0 && (
                <div style={{ ...gCard, border:'1px solid rgba(0,230,138,0.15)' }}>
                  <div style={gLabel}>🎯 Прогноз к концу макроцикла</div>
                  <div style={{ fontSize:9, color:'rgba(255,255,255,0.3)', marginBottom:4 }}>
                    {macrocycle?.totalWeeks || 12} нед × {(trainingOutput?.estimatedProgress || 2)}%/нед прогресс
                  </div>
                  {diaryStats.slice(0,3).map(s => {
                    const projected = Math.round(s.max1RM * (1 + (trainingOutput?.estimatedProgress || 2) / 100 * (macrocycle?.totalWeeks || 12)));
                    const gain = projected - Math.round(s.max1RM);
                    return <div key={s.exerciseId} style={{ display:'flex', justifyContent:'space-between', fontSize:9, padding:'2px 0' }}>
                      <span style={{ color:'rgba(255,255,255,0.5)' }}>{s.exerciseName}</span>
                      <span style={{ color:'rgba(255,255,255,0.3)' }}>{Math.round(s.max1RM)} → <b style={{ color:'#34d399' }}>{projected}</b> кг <span style={{ color:'#34d399' }}>(+{gain})</span></span>
                    </div>;
                  })}
                </div>
              )}

              {/* Phase params */}
              <div style={gCard}>
                <div style={gLabel}>📊 Параметры фаз</div>
                {macrocycle?.mesocycles?.map((mc, mi) => {
                  const firstMicro = mc.microcycles?.[0];
                  const vol = firstMicro?.volumeMultiplier || 1;
                  const rirLo = firstMicro?.rirRange?.[0] ?? 1;
                  const rirHi = firstMicro?.rirRange?.[1] ?? 3;
                  const rpe = firstMicro?.rpeTarget || 7;
                  return <div key={mi} style={{ marginBottom:3, padding:'4px 6px', borderRadius:6, background:'rgba(255,255,255,0.02)', fontSize:9 }}>
                    <span style={{ fontWeight:600, color:'rgba(255,255,255,0.6)' }}>{PHASE_LABELS[mc.type] || mc.type || 'Фаза'}</span>
                    <span style={{ color:'rgba(255,255,255,0.25)', marginLeft:4 }}>Объём: {vol}× | RIR: {rirLo}-{rirHi} | RPE: {rpe} | {mc.weeks} нед</span>
                  </div>;
                })}
              </div>

              {/* Save to my cycles */}
              <button onClick={() => { try {
                const existing = JSON.parse(localStorage.getItem('myTrainingCycles') || '[]');
                existing.push({ id:'cycle_' + Date.now(), name: (macrocycle?.totalWeeks || 12) + '-нед ' + goalName, date: new Date().toISOString(), weeks: macrocycle?.totalWeeks || 12, goal, level, days: daysPerWeek });
                localStorage.setItem('myTrainingCycles', JSON.stringify(existing));
                setMyCycleMsg('✅ Цикл добавлен в «Мои циклы»!');
                setTimeout(() => setMyCycleMsg(''), 3000);
              } catch {} }} style={{
                width:'100%', padding:9, borderRadius:10, border:'1px solid rgba(0,230,138,0.3)', cursor:'pointer',
                background:'rgba(0,230,138,0.06)', color:'var(--accent)', fontWeight:600, fontSize:11,
              }}>📋 В мои циклы</button>
              {myCycleMsg && <div style={{ padding:'6px 10px', borderRadius:6, background:'rgba(139,92,246,0.08)', border:'1px solid rgba(139,92,246,0.2)', color:'#8b5cf6', fontSize:10, marginTop:4, textAlign:'center' }}>{myCycleMsg}</div>}
            </>);
          })()}
          </div>
          </InfoErrorBoundary>
        )}
      {/* ═══════════ HISTORY TAB ═══════════ */}
      {tab === 'history' && <InfoErrorBoundary label="История">{(() => {
        try {
        const gCard: React.CSSProperties = { padding:12, borderRadius:14, background:'rgba(24,24,27,0.12)', border:'1px solid rgba(255,255,255,0.04)', marginBottom:8 };
        if (diaryProgress.length === 0) return (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            <div style={gCard}>
              <div style={{ textAlign:'center', padding:20 }}>
                <div style={{ fontSize:28, marginBottom:6 }}>📜</div>
                <div style={{ fontSize:11, color:'rgba(255,255,255,0.4)' }}>Нет записей. Начните вести дневник на вкладке «Дневник».</div>
              </div>
            </div>
          </div>
        );
return (<div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            <TrainingRecommendationsCard historyWorkouts={historyWorkouts} level={level} weakPoints={tprofile.weakPoints} readinessHistory={loadReadinessHistory()} acwr={(() => { try { const _s = loadSRPESessions(); if (_s.length < 2) return undefined; return acuteChronicRatio(toDailyLoads(_s)).ratio; } catch { return undefined; } })()} nutrition={{ kcal: linked.avgWeeklyKcal, protein: linked.avgWeeklyProtein, fat: linked.avgWeeklyFat, carbs: linked.avgWeeklyCarbs }} bodyWeight={tprofile.bodyWeight} labAnalysis={linked.labAnalysis ? { liverStress: linked.labAnalysis.liverStress, cardioRisk: linked.labAnalysis.cardioRisk, inflammation: linked.labAnalysis.inflammation, kidneyStress: linked.labAnalysis.kidneyStress, hormoneScore: linked.labAnalysis.hormoneScore, homaIR: linked.labAnalysis.homaIR } : undefined} onCourse={tprofile.onCourse} courseIntensity={tprofile.courseIntensity} supportCoverage={linked.supportCoverage} />
          <div style={gCard}>
            <div style={{ fontSize:10, color:'rgba(255,255,255,0.35)', fontWeight:500, letterSpacing:'0.3px', textTransform:'uppercase', marginBottom:8 }}>📜 История тренировок</div>
            <div style={{ display:'flex', gap:6, marginBottom:8 }}>
              {[
                { label:'Недель', value:diaryProgress.length, color:'#34d399' },
                { label:'Тренировок', value:diaryProgress.reduce((s,w)=>s+w.workoutCount,0), color:'#60a5fa' },
                { label:'Объём', value:diaryProgress.length > 0 ? `${(diaryProgress[diaryProgress.length-1]?.totalVolume/1000).toFixed(1)}т` : '—', color:'#f59e0b' },
              ].map((s,i) => <div key={i} style={{ flex:1, background:'rgba(255,255,255,0.03)', borderRadius:8, padding:'6px 4px', textAlign:'center' }}>
                <div style={{ fontSize:8, color:'rgba(255,255,255,0.35)' }}>{s.label}</div>
                <div style={{ fontSize:16, fontWeight:800, color:s.color }}>{s.value}</div>
              </div>)}
            </div>
            {historyWorkouts.length > 0 && (() => {
              const byDay: Record<string, number> = {};
              historyWorkouts.forEach((w: any) => { byDay[w.date] = (byDay[w.date] || 0) + (w.exercises || []).reduce((s: number, e: any) => s + (e.totalVolume || 0), 0); });
              const cells: { date: string; vol: number }[] = [];
              const today = new Date();
              for (let i = 83; i >= 0; i--) { const d = new Date(today); d.setDate(d.getDate() - i); const ds = d.toISOString().slice(0, 10); cells.push({ date: ds, vol: byDay[ds] || 0 }); }
              const maxVol = Math.max(1, ...cells.map(c => c.vol));
              const col = (v: number) => v === 0 ? 'rgba(255,255,255,0.04)' : v < maxVol * 0.33 ? 'rgba(0,230,138,0.25)' : v < maxVol * 0.66 ? 'rgba(0,230,138,0.5)' : 'rgba(0,230,138,0.85)';
              const weeks: { date: string; vol: number }[][] = [];
              for (let w = 0; w < 12; w++) weeks.push(cells.slice(w * 7, w * 7 + 7));
              return (
                <div style={{ marginBottom: 8, padding: 10, borderRadius: 10, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', fontWeight: 700, marginBottom: 6 }}>🔥 Тепловая карта тренировок (12 нед)</div>
                  <div style={{ display: 'flex', gap: 3 }}>
                    {weeks.map((wk, wi) => (
                      <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1 }}>
                        {wk.map((c, di) => <div key={di} title={c.date + (c.vol > 0 ? ': ' + Math.round(c.vol) + ' кг·повт' : '')} style={{ aspectRatio: '1', borderRadius: 3, background: col(c.vol) }} />)}
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, color: 'rgba(255,255,255,0.35)', marginTop: 4 }}><span>меньше</span><span>больше</span></div>
                </div>
              );
            })()}
            {historyWorkouts.length > 0 && (() => {
              const lvlKey = (level === 'enhanced' ? 'advanced' : level) as 'beginner' | 'intermediate' | 'advanced';
              const mrvBase = (((LEVEL_VOLUMES as Record<string, { mrv: number }>)[level]?.mrv) ?? 20) * (tprofile.onCourse ? 1.2 : 1);
              const ws = (d0: Date) => { const x = new Date(d0); const day = (x.getDay() + 6) % 7; x.setDate(x.getDate() - day); x.setHours(0,0,0,0); return x; };
              const now = new Date();
              const wkSets = (weeksAgo: number) => { const s = ws(now); s.setDate(s.getDate() - weeksAgo * 7); const e = new Date(s); e.setDate(e.getDate() + 6); const ss = s.toISOString().slice(0,10), ee = e.toISOString().slice(0,10); const m: Record<string, number> = {}; historyWorkouts.forEach((w: any) => { if (w.date >= ss && w.date <= ee) (w.exercises || []).forEach((ex: any) => { const cat = EXERCISE_CATALOG.find((c: any) => c.id === ex.exerciseId); if (cat) m[cat.group] = (m[cat.group] || 0) + (ex.sets?.length || 0); }); }); return m; };
              const w1 = wkSets(1), w2 = wkSets(0);
              const groups = Array.from(new Set([...Object.keys(w1), ...Object.keys(w2)]));
              const over2 = groups.filter(g => (w1[g] || 0) > mrvBase && (w2[g] || 0) > mrvBase);
              const over1 = groups.filter(g => ((w1[g] || 0) > mrvBase || (w2[g] || 0) > mrvBase) && !over2.includes(g));
              if (over2.length === 0 && over1.length === 0) return null;
              const GRP_RU: Record<string,string> = { chest:'Грудь', back:'Спина', legs:'Ноги', shoulders:'Плечи', arms:'Руки', core:'Кор' };
              const ru = (g: string) => GRP_RU[g] || g;
              const color = over2.length > 0 ? '#ef4444' : '#f59e0b';
              return (
                <div style={{ marginBottom: 8, padding: 10, borderRadius: 10, background: color + '12', border: '1px solid ' + color + '40' }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color, marginBottom: 4 }}>{over2.length > 0 ? '🔴 Риск перетренированности' : '🟡 Превышение объёма'}</div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.75)', lineHeight: 1.5 }}>
                    {over2.length > 0 ? `Группы выше MRV (${Math.round(mrvBase)} сетов) 2 недели подряд: ${over2.map(ru).join(', ')}. Снизьте объём на 10–15% в следующем микроцикле.` : `Группы выше MRV на прошлой/текущей неделе: ${over1.map(ru).join(', ')}. Следите за восстановлением.`}
                  </div>
                </div>
              );
            })()}
            {[...diaryProgress].sort((a,b)=>b.week-a.week).map((w,wi) => (
              <div key={wi} style={{ borderRadius:10, marginBottom:4, overflow:'hidden', background:'rgba(255,255,255,0.02)', border: historyExpanded===`w${wi}` ? '1px solid rgba(0,230,138,0.2)' : '1px solid rgba(255,255,255,0.03)', transition:'border 0.2s' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 10px', cursor:'pointer' }} onClick={()=>setHistoryExpanded(historyExpanded===`w${wi}`?null:`w${wi}`)}>
                  <div>
                    <span style={{ fontWeight:700, fontSize:12, color:'rgba(255,255,255,0.8)' }}>Неделя {w.week}</span>
                    <span style={{ fontSize:9, color:'rgba(255,255,255,0.3)', marginLeft:6 }}>{w.workoutCount} тр.</span>
                  </div>
                  <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                    {(() => { try { const sorted = [...diaryProgress].sort((a,b)=>b.week-a.week); const prev = sorted[wi+1]; if (!prev) return null; const d = Math.round((w.totalVolume-prev.totalVolume)/Math.max(1,prev.totalVolume)*100); return <span style={{ fontSize:11, fontWeight:700, color:d>5?'#34d399':d<-5?'#f87171':'#6b7280' }}>{d>5?'↑':d<-5?'↓':'→'}</span>; } catch{ return null; } })()}
                    <span style={{ fontSize:11, fontWeight:700, color:'#34d399' }}>{Math.round(w.totalVolume).toLocaleString()} кг</span>
                    <span style={{ fontSize:9, color:'rgba(255,255,255,0.3)' }}>{historyExpanded===`w${wi}`?'▴':'▾'}</span>
                  </div>
                </div>
                {historyExpanded===`w${wi}` && <div style={{ padding:'0 10px 8px', borderTop:'1px solid rgba(255,255,255,0.04)', paddingTop:6 }}>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:4, marginBottom:6 }}>
                    {[
                      { label:'Объём', value:`${Math.round(w.totalVolume)} кг`, color:'#34d399' },
                      { label:'Тренировок', value:w.workoutCount, color:'#60a5fa' },
                      { label:'1RM ср.', value:`${Math.round(w.total1RM)} кг`, color:'#f59e0b' },
                    ].map((s,i) => <div key={i} style={{ background:'rgba(255,255,255,0.02)', borderRadius:6, padding:'4px 6px', textAlign:'center' }}>
                      <div style={{ fontSize:8, color:'rgba(255,255,255,0.3)' }}>{s.label}</div>
                      <div style={{ fontSize:12, fontWeight:700, color:s.color }}>{s.value}</div>
                    </div>)}
                  </div>
                  {(diaryStats.filter(s=>s.workoutCount>0).slice(0,5).length > 0) && <div style={{ fontSize:9, color:'rgba(255,255,255,0.4)' }}>
                    {diaryStats.filter(s=>s.workoutCount>0).slice(0,5).map(s => (
                      <div key={s.exerciseId} style={{ display:'flex', justifyContent:'space-between', padding:'2px 0', borderBottom:'1px solid rgba(255,255,255,0.03)' }}>
                        <span style={{ color:'rgba(255,255,255,0.6)' }}>{s.exerciseName}</span>
                        <span style={{ color:'#34d399', fontWeight:600 }}>{s.maxWeight}×{s.maxReps}</span>
                        <span style={{ color:'rgba(255,255,255,0.3)' }}>1RM {Math.round(s.max1RM)} кг</span>
                      </div>
                    ))}
                  </div>}
                </div>}
              </div>
            ))}
          </div>
        </div>);
        } catch { return <div style={{ padding:20, textAlign:'center', color:'rgba(255,255,255,0.3)', fontSize:11 }}>Ошибка загрузки истории</div>; }
      })()}</InfoErrorBoundary>}
      {/* ═══════════ ANALYTICS TAB ═══════════ */}
      {tab === 'analytics' && <InfoErrorBoundary label="Аналитика"><><div style={{ padding: '6px 10px', borderRadius: 8, background: 'rgba(0,230,138,0.06)', border: '1px solid rgba(0,230,138,0.15)', marginBottom: 8, fontSize: 10, color: 'var(--text-dim)' }}>💡 Аналитика также доступна во вкладке «Дневник тренировок» → режим «Аналитика»</div><MuscleProgressCard sessions={historyWorkouts} level={level} /><VolumeTrendCard sessions={historyWorkouts} /><LoadRadarCard sessions={historyWorkouts} level={level} /><WeekCompareCard sessions={historyWorkouts} /><LiftHistoryCard sessions={historyWorkouts} /><AnalyticsTab sessions={historyWorkouts} onRefresh={loadDiaryStats} /><StructuredAnalyticsCard sessions={historyWorkouts} /></></InfoErrorBoundary>}
      {tab === 'library' && (
  <InfoErrorBoundary label="Каталог циклов">
    <div style={{ maxWidth: 720, margin: '0 auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--accent)', marginBottom: 2 }}>📖 Каталог тренировочных циклов</div>
      <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>Справочник готовых циклов (СРЦ / блочные / встроенные) с описанием, механизмом работы и условиями. Методики и программы — в соответствующих вкладках группы «Библиотека».</div>
      <ExpandableCard title="🔄 Каталог циклов (СРЦ / блоки / встроенные)" icon="📖" short="Все доступные циклы с полным описанием. Нажмите, чтобы развернуть." full={
        <div>
          {LMS_CYCLES.map(c => (
            <ExpandableCard key={c.meta.id} title={c.meta.title} icon="" accent="#00e68a" short={c.meta.description} full={<><div style={{ marginBottom: 6 }}>{c.meta.howItWorks}</div>{c.meta.conditions.length > 0 && <div><b>Условия:</b><ul style={{ margin: '4px 0 0 16px', padding: 0 }}>{c.meta.conditions.map((cond, i) => <li key={i} style={{ marginBottom: 2 }}>{cond}</li>)}</ul></div>}</>} />
          ))}
        </div>
      } />
    </div>
  </InfoErrorBoundary>
)}
{tab === 'methods' && <InfoErrorBoundary label="Методы"><MethodsTab linked={linked} trainingOutput={trainingOutput} diaryStats={diaryStats} historyWorkouts={historyWorkouts} goal={goal} level={level} daysPerWeek={daysPerWeek} recovery={recovery} fatigue={fatigue} appliedMethods={appliedMethods} onToggleMethod={(name, category) => setAppliedMethods(prev => { const next = { ...prev }; if (next[category] === name) delete next[category]; else next[category] = name; return next; })} onApplyComposition={() => { applyMethodComposition(); setTab('plan'); }} /></InfoErrorBoundary>}
      {tab === 'visual' && <InfoErrorBoundary label="Визуализация"><VisualTab sessions={historyWorkouts} /></InfoErrorBoundary>}
      {tab === 'programs' && <InfoErrorBoundary label="Программы"><ProgramsTab selectedProgram={selectedProgram} setSelectedProgram={setSelectedProgram} onAddToMyTraining={(exs) => setCustomExercises(prev => [...prev, ...exs])} /></InfoErrorBoundary>}
      {tab === 'timers' && <InfoErrorBoundary label="Таймеры"><TimersTab /></InfoErrorBoundary>}
      {tab === 'progress' && <InfoErrorBoundary label="Прогресс"><ProgressTab historyWorkouts={historyWorkouts} /></InfoErrorBoundary>}
       {tab === 'excalc' && <InfoErrorBoundary label="Калькулятор упражнений"><ExerciseCalcTab /></InfoErrorBoundary>}
       {tab === 'calc_plates' && <InfoErrorBoundary label="Калькулятор блинов"><PlateCalculator /></InfoErrorBoundary>}
       {tab === 'calc_vbt' && <InfoErrorBoundary label="VBT-калькулятор"><VBTCalculator /></InfoErrorBoundary>}
       {tab === 'calc_mrv' && <InfoErrorBoundary label="Оценщик MRV"><MRVEstimator /></InfoErrorBoundary>}

      {tab === 'calc_1rm' && <InfoErrorBoundary label="Калькулятор 1RM"><OneRmCalcTab /></InfoErrorBoundary>}
      {tab === 'pl_norms' && <InfoErrorBoundary label="Нормативы ПЛ"><PlNormsCalcTab /></InfoErrorBoundary>}
      {tab === 'import_data' && <InfoErrorBoundary label="Импорт CSV"><CsvImportTab onDone={loadDiaryStats} /></InfoErrorBoundary>}
      {tab === 'volume' && <InfoErrorBoundary label="Расчёт объёма"><VolumeOptimizerTab /></InfoErrorBoundary>}
      {tab === 'calc_substitute' && <InfoErrorBoundary label="Замена упражнения"><CalcSubstituteTab /></InfoErrorBoundary>}
      {tab === 'calc_quality' && <InfoErrorBoundary label="Качество программы"><CalcQualityTab plan={manualResult} level={level} onBuildPlan={() => setTab('plan')} /></InfoErrorBoundary>}
      {tab === 'pl_pro' && <InfoErrorBoundary label="Pro ПЛ-инструменты"><ProPlToolsTab /></InfoErrorBoundary>}
      {tab === 'rel_strength' && <InfoErrorBoundary label="Относительная сила"><RelativeStrengthCalcTab /></InfoErrorBoundary>}
      {tab === 'calendar' && <InfoErrorBoundary label="Календарь тренировок"><TrainingCalendarTab /></InfoErrorBoundary>}
      {tab === 'periodization_designer' && <InfoErrorBoundary label="Дизайнер периодизации"><PeriodizationDesignerTab /></InfoErrorBoundary>}
      {tab === 'tech_calc' && <InfoErrorBoundary label="Техника упражнений"><TechniqueCalcTab /></InfoErrorBoundary>}
      {tab === 'target_muscle' && <InfoErrorBoundary label="Целевая мышца"><TargetMuscleCalcTab /></InfoErrorBoundary>}
      {tab === 'deload_scheduler' && <InfoErrorBoundary label="Планировщик делода"><DeloadSchedulerTab /></InfoErrorBoundary>}
      {tab === 'meso_progression' && <InfoErrorBoundary label="Прогрессия мезо"><div style={{ maxWidth: 720, margin: '0 auto', padding: 12 }}><MesocycleProgressionCard weeks={mesoLength} goal={goal === 'strength' ? 'strength' : goal === 'bulk' ? 'hypertrophy' : 'hypertrophy'} /></div></InfoErrorBoundary>}
      {tab === 'calc_taper' && <InfoErrorBoundary label="Тапер-планер"><TaperPlannerTab /></InfoErrorBoundary>}
      {tab === 'calc_plates' && <InfoErrorBoundary label="Калькулятор блинов"><PlateCalcTab /></InfoErrorBoundary>}
      {tab === 'calc_vbt' && <InfoErrorBoundary label="VBT / скорость"><VBTCalcTab /></InfoErrorBoundary>}
      {tab === 'calc_fatigue' && <InfoErrorBoundary label="Индекс усталости"><FatigueIndexTab /></InfoErrorBoundary>}
      {tab === 'calc_mrv' && <InfoErrorBoundary label="Оценщик MRV"><MRVEstimatorTab /></InfoErrorBoundary>}

      {/* ═══════════ MY TRAINING TAB ═══════════ */}
      {tab === 'mytraining' && (
        <InfoErrorBoundary label="Мои тренировки">
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          <MyTrainingTab customExercises={customExercises} setCustomExercises={setCustomExercises} goal={goal} level={level} daysPerWeek={daysPerWeek} mesoLength={mesoLength} />
        </div>
        </InfoErrorBoundary>
      )}

      {/* ═══════════ REPORTS TAB ═══════════ */}
      {tab === 'reports' && (
        <InfoErrorBoundary label="Отчёты">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="card" style={{ padding: '10px 12px' }}>
            <h3 style={{ margin: '0 0 4px', fontSize: 13 }}>📄 Отчёты по тренировкам</h3>
            <p style={{ margin: '0 0 8px', fontSize: 11, color: 'var(--text-dim)' }}>
              Сгенерируйте комплексный отчёт по вашим тренировкам: информация из каталога упражнений, статистика плана (недели, упражнения в неделю), метрики тренировок (объём, интенсивность).
            </p>

            <button onClick={() => {
              const planWeeks = macrocycle?.totalWeeks ?? (trainingOutput?.plan?.length && daysPerWeek > 0 ? Math.ceil(trainingOutput.plan.length / daysPerWeek) : 0);
              const totalVolume = trainingOutput?.weeklyVolume ?? 0;
              const avgIntensity = trainingOutput?.estimatedProgress ? Math.round(50 + trainingOutput.estimatedProgress * 5) : 0;
              const report = {
                id: 'report_' + Date.now(),
                date: new Date().toISOString(),
                exerciseCatalogCount: Object.keys(EXERCISE_CATALOG).length,
                planWeeks,
                exercisesPerWeek: daysPerWeek,
                totalVolume,
                avgIntensity,
                goal, level, daysPerWeek, splitType, periodizationType, mesoLength,
              };
              const updated = [report, ...trainingArchive].slice(0, 20);
              setTrainingArchive(updated);
              try { localStorage.setItem('he_training_reports', JSON.stringify(updated)); } catch {}
              try { localStorage.setItem('he_training_report_current', JSON.stringify(report)); } catch {}
              setTrainingReportGenerated(true);
            }} style={{
              padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600,
              background: 'var(--accent)', color: '#000', border: 'none', cursor: 'pointer',
            }}>Сгенерировать отчёт</button>

            {trainingReportGenerated && (
              <p style={{ margin: '6px 0 0', fontSize: 11, color: '#22c55e' }}>✓ Отчёт сгенерирован и сохранён в архиве</p>
            )}
          </div>

          {/* Archive */}
          <div className="card" style={{ padding: '10px 12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <h4 style={{ margin: 0, fontSize: 12 }}>📦 Архив отчетов ({trainingArchive.length})</h4>
              {trainingArchive.length > 0 && (
                <button onClick={() => {
                  setTrainingArchive([]);
                  localStorage.removeItem('he_training_reports');
                  localStorage.removeItem('he_training_report_current');
                  setTrainingReportGenerated(false);
                }} style={{
                  padding: '4px 10px', borderRadius: 6, fontSize: 10, fontWeight: 600,
                  background: 'rgba(239,68,68,0.2)', color: '#ef4444', border: 'none', cursor: 'pointer',
                }}>Очистить архив</button>
              )}
            </div>
            {trainingArchive.length === 0 ? (
              <p style={{ margin: 0, fontSize: 11, color: 'var(--text-dim)' }}>Архив пуст. Сгенерируйте первый отчёт.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {[...trainingArchive].reverse().map((r: any) => (
                  <div key={r.id} style={{
                    padding: '8px 10px', borderRadius: 6,
                    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontSize: 11, fontWeight: 600 }}>Отчёт {new Date(r.date).toLocaleDateString('ru')}</span>
                      <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{new Date(r.date).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 12px', fontSize: 10, color: 'var(--text-dim)' }}>
                      <span>Упражнений в каталоге: {r.exerciseCatalogCount}</span>
                      <span>Недель в плане: {r.planWeeks}</span>
                      <span>Тренировок/нед: {r.exercisesPerWeek}</span>
                      <span>Общий объём: {r.totalVolume}</span>
                      <span>Ср. интенсивность: {r.avgIntensity}%</span>
                      <span>Цель: {r.goal}, Уровень: {r.level}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        </InfoErrorBoundary>
      )}
    </div>
      )}
    </div>
  );
};

import { MyTrainingTab } from './TrainingScreen_parts/MyTrainingTab';
import { CalcSubstituteTab } from './TrainingScreen_parts/CalcSubstituteTab';
import { CalcQualityTab } from './TrainingScreen_parts/CalcQualityTab';
import { MuscleProgressCard } from './TrainingScreen_parts/MuscleProgressCard';
import { MicrocyclePlannerCard } from './TrainingScreen_parts/MicrocyclePlannerCard';
import { TrainingRecommendationsCard } from './TrainingScreen_parts/TrainingRecommendationsCard';
import { OneRmCalcTab } from './TrainingScreen_parts/OneRmCalcTab';
import { PlNormsCalcTab } from './TrainingScreen_parts/PlNormsCalcTab';
import { LiftHistoryCard } from './TrainingScreen_parts/LiftHistoryCard';
import { VolumeTrendCard } from './TrainingScreen_parts/VolumeTrendCard';
import { LoadRadarCard } from './TrainingScreen_parts/LoadRadarCard';
import { WeekCompareCard } from './TrainingScreen_parts/WeekCompareCard';
import { CsvImportTab } from './TrainingScreen_parts/CsvImportTab';
import { usePlanGeneration } from '../hooks/usePlanGeneration';
import { PowerliftingTab } from './TrainingScreen_parts/PowerliftingTab';
import { BodybuildingTab } from './TrainingScreen_parts/BodybuildingTab';
import { MethodsTab } from './TrainingScreen_parts/MethodsTab';
import { VisualTab } from './TrainingScreen_parts/VisualTab';
import { AnalyticsTab } from './TrainingScreen_parts/AnalyticsTab';
import { ProgramsTab } from './TrainingScreen_parts/ProgramsTab';
import { VolumeOptimizerTab } from './TrainingScreen_parts/VolumeOptimizerTab';
import { ExerciseCalcTab } from './TrainingScreen_parts/ExerciseCalcTab';
import { TrainingLoadCalculator } from './TrainingScreen_parts/TrainingLoadCalculator';
import { TonnageCalcTab } from './TrainingScreen_parts/TonnageCalcTab';
import { WhatIfCard } from './TrainingScreen_parts/WhatIfCard';
import { ReadinessForecastCard } from './TrainingScreen_parts/ReadinessForecastCard';
import { MethodologyEncyclopedia } from './TrainingScreen_parts/MethodologyEncyclopedia';
import { labTrainingAdjust } from './TrainingScreen_parts/lab-training-adjust';
import { appendReadinessToday, loadReadinessHistory } from './TrainingScreen_parts/readiness-history';
import { useTrainingProfile } from './TrainingScreen_parts/training-profile';
import { TrainingProfileCard } from './TrainingScreen_parts/TrainingProfileCard';
import { loadSRPESessions } from '../../engines/pro/srpe-store';
import { acuteChronicRatio, toDailyLoads, weeklyMonotony } from '../../engines/pro/training-load.engine';
import { PopupSelect, PopupNumber, ExpandableCard } from './SRCBBScreen_parts/TrainingPopups';
import { LMS_CYCLES } from '../../data/lms-cycles/lms-cycle-index';
import { WOMENS_PROGRAMS, CUSTOM_PROGRAMS } from './TrainingScreen_parts/programs-data';
import { SessionPlayer, type PlayerDay } from './SRCBBScreen_parts/SessionPlayer';
import { TimersTab } from './TrainingScreen_parts/TimersTab';
import { ProgressTab } from './TrainingScreen_parts/ProgressTab';
import { StrengthLevelCard } from './TrainingScreen_parts/StrengthLevelCard';
import { StructuredAnalyticsCard } from './TrainingScreen_parts/StructuredAnalyticsCard';
import { ExerciseGeneratorContent } from './TrainingScreen_parts/ExerciseGenerator';
import { TrainingMixTab } from './TrainingScreen_parts/TrainingMixTab';
import { ProPlToolsTab } from './TrainingScreen_parts/ProPlToolsTab';
import { RelativeStrengthCalcTab } from './TrainingScreen_parts/RelativeStrengthCalcTab';
import { TrainingCalendarTab } from './TrainingScreen_parts/TrainingCalendarTab';
import { PeriodizationDesignerTab } from './TrainingScreen_parts/PeriodizationDesignerTab';
import { TechniqueCalcTab } from './TrainingScreen_parts/TechniqueCalcTab';
import { DeloadSchedulerTab } from './TrainingScreen_parts/DeloadSchedulerTab';
import { MesocycleProgressionCard } from './TrainingScreen_parts/MesocycleProgressionCard';
import { TargetMuscleCalcTab } from './TrainingScreen_parts/TargetMuscleCalcTab';
import { TaperPlannerTab } from './TrainingScreen_parts/TaperPlannerTab';
import { PlateCalcTab } from './TrainingScreen_parts/PlateCalcTab';
import { VBTCalcTab } from './TrainingScreen_parts/VBTCalcTab';
import { FatigueIndexTab } from './TrainingScreen_parts/FatigueIndexTab';
import { MRVEstimatorTab } from './TrainingScreen_parts/MRVEstimatorTab';

