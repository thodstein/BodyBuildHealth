import React, { useEffect, useMemo, useRef, useState } from 'react';
import { LMS_CYCLES, getCycleById, normalizeCycleDirection } from '../../data/lms-cycles/lms-cycle-index';
import { rankCycles, selectBestCycle, explainSelection, modeMismatchWarning, type LMSSelectorInput } from '../../engines/lms/lms-selector.engine';
import { buildLMSPlan, extractExercises, getPLWeakPointRecommendations, getPLWeakGroupExerciseCandidates, originalCycleWeeks, appendPLTaperWeeks, refreshMeetAttempts, computeMeetAttemptsFromPmRow, type LMSBuildOutput, type LMSBuildInput } from '../../engines/lms/lms-builder.engine';
import { applyMacroTaperToPLWeeks, type MacroTaperOpts } from '../../engines/lms/lms-macro-taper.engine';
import { recommendTaperConfig, coachPLPeakPlan, pmFeasibility, projectPmToMeet, compareTaperScenarios, evaluateMeetAttemptsFromDiary, type TaperCoachCtx } from '../../engines/lms/lms-taper-coach.engine';
import { TAPER_MODE_LABELS, TAPER_WEIGHT_GOAL_LABELS, type PeakWeekLayout, type TaperMode, type TaperWeightGoal } from '../../engines/lms/lms-taper.engine';
import { WEAK_POINTS_BY_LIFT, diagnoseWeakPoint, type Lift, type WeakPoint } from '../../engines/lms/weakpoint-pl';
import { detectLift } from '../../engines/lms/lms-to-pl';
import { mesocyclePhaseForWeek, type MesocyclePhase } from '../../engines/rir-matrix.engine';
import { autoRegulate, shouldTrainToday, type AutoRegOutput } from '../../engines/pro/autoregulation-pro.engine';
import { acuteChronicRatio, toDailyLoads } from '../../engines/pro/training-load.engine';
import { loadSRPESessions } from '../../engines/pro/srpe-store';
import { SPLIT_PATTERNS } from '../../engines/bb/bb-split-patterns';
import { rankBBSplits, selectBestBBSplit, explainBBSelection, type BBSelectorInput } from '../../engines/bb/bb-selector.engine';
import { buildBBPlan, applyMacrocycleToBBPlan, type BBPlan } from '../../engines/bb/bb-builder.engine';
import { applyTrainingTaperToBBPlan, deserializeBBPrepConfig, legacyConfigFromProfile, buildBBContestPrep, isoAddDays, isoToday, PEAK_PHASE_COLORS, PHASE_LABELS_RU, type BBContestPrepConfig } from '../../engines/bb/bb-contest-prep.engine';
import { calcBBPlanMetrics, explainBBMetrics } from '../../engines/bb/bb-metrics.engine';
import { adaptForPEDs, type PED } from '../../engines/bb/bb-ped-adaptation.engine';
import { getAllVolumeLandmarks } from '../../engines/volume-landmarks.engine';
import { SessionPlayer, type PlayerDay } from './SRCBBScreen_parts/SessionPlayer';
import { DayCard, type PlanDayView, type PlanExerciseView, type PhaseKey } from './TrainingScreen_parts/PlanOutput';
import { PedInputPanel, PedAdaptationCard } from './TrainingScreen_parts/PedCoursePanel';

import { PeakingPanel } from './SRCBBScreen_parts/PeakingPanel';
import { TaperCoachCard } from './SRCBBScreen_parts/TaperCoachCard';
import { PLCompetitionTab } from './SRCBBScreen_parts/PLCompetitionTab';
import { PLPlanView } from './SRCBBScreen_parts/PLPlanView';
import { PLTaperProvider, usePLTaper } from './SRCBBScreen_parts/taper-state';
import { TrainingMetricsChart, type LMSWeekMetric, type BBMuscleMetric } from './SRCBBScreen_parts/TrainingMetricsChart';
import { MethodsTab } from './TrainingScreen_parts/MethodsTab';
import { useDataLink } from '../../core/data-link';
import { EXERCISE_CATALOG, getExercisesByGroup } from '../../core/exercise-catalog';
import { TRAINING_SPLITS } from '../../engines/training.engine';
import { loadTrainingProfile, saveTrainingProfile } from './TrainingScreen_parts/training-profile';
import { subscribePlannerApply, getPlannerApply, clearPlannerApply, type PlannerApply } from './TrainingScreen_parts/planner-bridge';
import { StrengthDiary } from '../../engines/strength-diary.engine';
import type { WorkoutLog } from '../../core/types';
import { AnalyticsTab } from './TrainingScreen_parts/AnalyticsTab';
import { VisualTab } from './TrainingScreen_parts/VisualTab';
import { ProMetricsPanel } from './SRCBBScreen_parts/ProMetricsPanel';
import { PopupNumber, PopupSelect, PopupMultiSelect, ExpandableCard, MetricCard, SaveButton } from './SRCBBScreen_parts/TrainingPopups';
import { lmsPlanToSessions, bbPlanToSessions, autoregPlan as autoregPlanBridge, progressFromSessions, planVsFact } from '../../engines/training-integration.engine';
import type { BridgeSession, ReadinessInput, ProgressSnapshot } from '../../engines/training-integration.engine';
import { generateRepTempo, type RepTempoOutput } from '../../engines/rep-tempo-engine';
import { MesocycleProgressionCard, SOURCE_PHASE_LABEL, SOURCE_PHASE_ORIGIN_LABEL, sourceWeekColor, summarizeSourceCycleWeeks } from './TrainingScreen_parts/MesocycleProgressionCard';
import { parseProgressionRationale, progressionTiles, splitDescriptionPoints } from './TrainingScreen_parts/plan-card-helpers';
import { DeloadProtocolCard } from './TrainingScreen_parts/DeloadProtocolCard';
import { MacrocyclePanel } from './SRCBBScreen_parts/MacrocyclePanel';
import { CardioLinkCard } from './TrainingScreen_parts/CardioLinkCard';
import { deserializeMacro, deserializeBbMacro, buildBbMacrocycle, serializeMacro, serializeBbMacro, rebalanceMacrocycle, rebalanceBbMacrocycle, type Macrocycle, type BBMacrocycle } from '../../engines/lms/macrocycle.engine';
import { macroPhaseToLmsPhase, bbMacroPhaseToUserPhase, isDeloadLikeBbMacroPhase } from '../../engines/periodization/phase-bridge';
import { calcCycleMetrics, type SRExercise } from '../../engines/lms/lms-metrics.engine';
import { buildDiaryAutoreg, type AutoRegMode, type DiaryAutoregResult } from '../../engines/pro/diary-autoreg.engine';
import { pmDiaryMultiplier, type PMAutoRegMode } from '../../engines/lms/pm-autoreg.engine';
import { competitionAttempts, MEET_STRATEGY_LABEL, MEET_STRATEGY_PCT_LABEL, MEET_WARMUP_STEPS, type MeetStrategy } from '../../engines/lms/competition-attempts';
import { recommendWeightCut } from '../../engines/gym-competition.engine';
import { getProfile } from '../../core/profile-manager';
import { LAST_HEAVY_DAYS, warmupSequence } from '../../engines/pro/taper.engine';
import { PlannerToolsPanel } from './TrainingScreen_parts/PlannerToolsPanel';
import { saveCompetitionPlan, type CompetitionPlanRecord } from './TrainingScreen_parts/CompetitionPlansView';
import { PlDeadpointsBarPathCard } from './TrainingScreen_parts/PlDeadpointsBarPathCard';
import { LiftMasterCard } from './TrainingScreen_parts/LiftMasterCard';
import { LimiterCalculatorCard } from './TrainingScreen_parts/LimiterCalculatorCard';
import { PLSeasonBuilder, type SeasonBuildInfo } from './SRCBBScreen_parts/PLSeasonBuilder';
import { buildPLPrintHtml, printPLHtml, buildPLExcelWorkbook, downloadPLExcel, plExportRows } from './SRCBBScreen_parts/pl-export';
import { periodLabelRu, directionLabelRu } from '../../data/lms-cycles/period-labels';
import { loadSessions } from '../../engines/workout-logger.engine';

const getTempo = (exerciseName: string, goal: string, isMainLift: boolean): RepTempoOutput => {
  const isCompound = !exerciseName.toLowerCase().includes('сгибан') &&
    !exerciseName.toLowerCase().includes('разгибан') &&
    !exerciseName.toLowerCase().includes('подъём') &&
    !exerciseName.toLowerCase().includes('махи');
  return generateRepTempo({
    goal: goal === 'strength' ? 'strength' : goal === 'mass' || goal === 'bulk' ? 'hypertrophy' : 'hypertrophy',
    riskLevel: 'low',
    difficultyLevel: 'medium',
    techniqueIssues: [],
    isMainLift,
  });
};

type Mode = 'pl' | 'bb' | 'manual';

const CARD: React.CSSProperties = { background: 'rgba(24,24,27,0.6)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.04)', padding: '12px', margin: '6px 0' };
const SMALL: React.CSSProperties = { color: '#fff', fontSize: 11, lineHeight: 1.4 };
const cardBg = CARD;
const ACCENT = 'var(--accent)';
const BTN: React.CSSProperties = { background: ACCENT, color: '#0a0a0a', border: 'none', borderRadius: 8, padding: '10px 14px', fontWeight: 600, fontSize: 12, minHeight: 40, cursor: 'pointer' };
const BTN_GHOST: React.CSSProperties = { ...BTN, background: 'transparent', color: ACCENT, border: '1px solid var(--accent-dim)' };
const PILL = (active: boolean) => ({ padding:'7px 12px', borderRadius:20, fontSize:11, fontWeight: active ? 700 : 500, cursor:'pointer', border: active ? '1px solid var(--accent)' : '1px solid rgba(255,255,255,0.06)', background: active ? 'linear-gradient(135deg,var(--accent),#00c8a0)' : '#18181b', color: active ? '#000' : '#fff', flexShrink:0 } as React.CSSProperties);
const SEL: React.CSSProperties = { background: '#18181b', color: '#fff', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '8px', minHeight: 40, width: '100%', outline: 'none', boxSizing: 'border-box' };
const IN: React.CSSProperties = { ...SEL, padding: '10px' };
const LABEL: React.CSSProperties = { color: '#fff', fontSize: 11, margin: '6px 0 3px' };
const H: React.CSSProperties = { fontSize: 14, fontWeight: 700, color: 'var(--accent)', marginBottom: 8 };

function getRecoveryMetrics(linked: any): Pick<LMSBuildInput, 'bodyFat' | 'leanMass' | 'hrvMs' | 'sleepHours' | 'stressLevel'> {
  const settings = linked.profile?.settings as Record<string, any> | undefined;
  const weight = settings?.personal?.weight;
  const bodyFat = settings?.personal?.bodyFat;
  return {
    bodyFat,
    leanMass: weight && bodyFat != null ? Math.round(weight * (1 - bodyFat / 100)) : undefined,
    hrvMs: settings?.lifestyle?.morningHRV,
    sleepHours: settings?.lifestyle?.sleepHours,
    stressLevel: settings?.lifestyle?.stressLevel,
  };
}

export const SRCBBScreen: React.FC<{ track?: 'pl' | 'bb' | 'auto' }> = (props) => {
  // Обёртка: предоставляет тапер-state (сезон/параметры/прикиды) через контекст —
  // SRCBBScreen и вкладка «🏁 Соревнования» читают его без пропс-дриллинга.
  const _saved: any = (() => { try { return JSON.parse(localStorage.getItem('he_pl_session') || 'null'); } catch { return null; } })();
  const _prof = (() => { try { return loadTrainingProfile(); } catch { return {} as ReturnType<typeof loadTrainingProfile>; } })();
  return (
    <PLTaperProvider saved={_saved} profBodyWeight={_prof.bodyWeight}>
      <SRCBBScreenInner {...props} />
    </PLTaperProvider>
  );
};

const SRCBBScreenInner: React.FC<{ track?: 'pl' | 'bb' | 'auto' }> = ({ track = 'auto' }) => {
  const [mainTab, setMainTab] = useState<Mode>(track === 'bb' ? 'bb' : track === 'pl' ? 'pl' : 'manual');
  const subViewList: Record<Mode, { key: string; label: string }[]> = {
    pl: [['settings', '1 ⚙️ Настройки'], ['season', '🧩 Сезон'], ['diagnostics', '2 🔧 Корректор движений'], ['plan', '3 📋 План'], ['charts', '4 📊 Графики'], ['reference', '5 📚 Справка и отчёты'], ['competition', '🏁 Соревнования'], ['macro', '🗓 Годовой план'], ['tools', '🔧 Инструменты']].map(([k, l]) => ({ key: k, label: l })),
    bb: [['plan', '📋 План сплита'], ['macro', '🗓 Годовой план'], ['bridge', '🔗 Мост план→сессия'], ['peak_bb', '🏆 Шоу ББ'], ['methods', '🧠 Методики'], ['analytics', '📈 Аналитика'], ['prometrics', '🧮 PRO-метрики'], ['charts', '📊 Графики']].map(([k, l]) => ({ key: k, label: l })),
    manual: [],
  };
  const [subView, setSubView] = useState<string>('plan');

  // ── СРЦ ── (инициализация из сессии PL и единого профиля тренированности)
  const _plSaved: any = (() => { try { return JSON.parse(localStorage.getItem('he_pl_session') || 'null'); } catch { return null; } })();
  const _profPL = loadTrainingProfile();
  const [level, setLevel] = useState<string>(_plSaved?.plLevel || 'II-KMS');
  const [goal, setGoal] = useState<string>(_plSaved?.plGoal || 'strength');
  const [dir, setDir] = useState<string>(_plSaved?.plDir || 'powerlifting');
  // State для MacrocyclePanel (редактируемые level/goal в годовом плане)
  const [macroLevel, setMacroLevel] = useState<string>(level);
  const [macroGoal, setMacroGoal] = useState<'powerlifting' | 'bodybuilding' | 'general'>(
    track === 'bb' || dir === 'bodybuilding' ? 'bodybuilding' : 'powerlifting'
  );
  // 🏁 Тапер/пик в макроцикле ПЛ (применяется к peak/competition блокам)
  const [macroTaperMode, setMacroTaperMode] = useState<TaperMode>('classic');
  const [macroWeightGoal, setMacroWeightGoal] = useState<TaperWeightGoal>('auto');
  const [macroMockMeet, setMacroMockMeet] = useState(true);
  const [macroPostMeet, setMacroPostMeet] = useState(true);
  // Keep the annual planner aligned with the active PL level when it changes
  // outside the annual-planning view (profile/session restore).
  useEffect(() => {
    setMacroLevel(level);
  }, [level]);
  useEffect(() => {
    // Годовой план в ББ-вкладке всегда строит ББ-макроцикл (4 фазы), иначе
    // панель строила ПЛ-макроцикл, а «Применить» не находило цикл в блоке.
    setMacroGoal(mainTab === 'bb' ? 'bodybuilding' : (dir === 'bodybuilding' ? 'bodybuilding' : 'powerlifting'));
  }, [dir, mainTab]);
  const [days, setDays] = useState<number>(_plSaved?.plDays ?? 3);
  const [pmSquat, setPmSquat] = useState<number>(_plSaved?.pmSquat ?? _profPL.pmSquat ?? 120);
  const [pmBench, setPmBench] = useState<number>(_plSaved?.pmBench ?? _profPL.pmBench ?? 100);
  const [pmDead, setPmDead] = useState<number>(_plSaved?.pmDead ?? _profPL.pmDead ?? 140);
  // 🏁 Тапер-state (сезон/параметры/прикиды/mock/meet/пост/тапер-план) — из хука+контекста.
  const {
    bw, setBw, targetBw, setTargetBw, weeksToMeet, setWeeksToMeet,
    taperWeeksToAdd, setTaperWeeksToAdd, attemptStrategy, setAttemptStrategy,
    peakMode, setPeakMode, peakLayout, setPeakLayout, taperWeightGoal, setTaperWeightGoal,
    taperFed, setTaperFed, taperActualPm, setTaperActualPm, taperPlannedPm, setTaperPlannedPm,
    taperAttemptOverride, setTaperAttemptOverride,
    mockMeetOn, setMockMeetOn, meetWeekOn, setMeetWeekOn, postMeetOn, setPostMeetOn,
    taperNote, setTaperNote, taperPlan, setTaperPlan,
    meetList, setMeetList, mainMeetId, setMainMeetId,
    peakCycleId, setPeakCycleId, applyMainMeet, addMeet, removeMeet,
  } = usePLTaper();
  const [exercisePMs, setExercisePMs] = useState<Record<string, number>>(_plSaved?.exercisePMs ?? {});
  const initExercisePMs = (cycleId: string) => {
    const tpl = getCycleById(cycleId);
    if (!tpl) { setExercisePMs({}); return; }
    const exs = extractExercises(tpl);
    const pm: Record<string, number> = {};
    // Реалистичная оценка ПМ для любого упражнения по коэффициентам от основных движений
    // Специфичные паттерны проверяются ДО общих (французский жим → до просто жим)
    const EST: [RegExp, number][] = [
      // ── Приседания ──
      [/присед/i, pmSquat],
      [/гакк/i, pmSquat], [/жим ногами/i, Math.round(pmSquat * 1.3)], // Жим ногами: ~1.3× ПМ приседа (машина, иной диапазон) — не 1.5× (завышение)
      // ── Жимовые ── (специфичные ДО общего жима)
      [/французский жим/i, Math.round(pmBench * 0.45)],
      [/дожим/i, Math.round(pmBench * 1.15)],       // дожим с плинтов — «ПМ» больше жима (частичная амплитуда)
      [/жим.*гантел/i, Math.round(pmBench * 0.70)],
      [/жим.*(наклон|гор)/i, Math.round(pmBench * 0.82)],
      [/жим.*средн/i, Math.round(pmBench * 0.92)],
      [/жим.*стоя/i, Math.round(pmBench * 0.65)],
      [/жим.*блок/i, Math.round(pmBench * 0.30)],
      [/жим лежа/i, pmBench],
      [/жим/i, pmBench],
      // ── Тяговые ──
      [/становая/i, pmDead],
      [/тяга/i, pmDead],
      [/наклон/i, Math.round(pmDead * 0.50)],
      [/гиперэкстенз/i, Math.round(pmDead * 0.35)],
      // ── Спина ──
      [/подтягив/i, Math.round(pmBench * 0.65)],
      [/пуловер/i, Math.round(pmBench * 0.40)],
      // ── Руки (трицепс/бицепс/предплечья) ──
      [/трицепс/i, Math.round(pmBench * 0.35)],
      [/французский/i, Math.round(pmBench * 0.45)],   // самостоятельное имя без «жим»
      [/разгиб/i, Math.round(pmBench * 0.35)],
      [/бицепс/i, Math.round(pmBench * 0.30)],
      [/сгибан/i, Math.round(pmBench * 0.30)],
      [/молотк/i, Math.round(pmBench * 0.35)],
      [/кисть/i, Math.round(pmBench * 0.20)],
      [/концентрир/i, Math.round(pmBench * 0.25)],
      // ── Плечи ──
      [/face.?pull|тяга.*лиц/i, Math.round(pmBench * 0.30)],
      [/отведени/i, Math.round(pmBench * 0.20)],
      [/кроссовер/i, Math.round(pmBench * 0.25)],
      // ── Пресс / кор ──
      [/пресс/i, 0], [/скручив/i, 0],
      // ── Специфические для армрестлинга ──
      [/натяжк/i, Math.round(pmBench * 0.25)],
      [/приведени/i, Math.round(pmBench * 0.20)],
      [/имитаци/i, Math.round(pmBench * 0.25)],
      [/боковой нажим/i, Math.round(pmBench * 0.30)],
      [/отведение сб/i, Math.round(pmBench * 0.20)],
    ];
    for (const name of exs) {
      const n = name.toLowerCase();
      let found = false;
      for (const [re, val] of EST) {
        if (re.test(n)) { pm[name] = val; found = true; break; }
      }
      if (!found) pm[name] = 80; // fallback для неизвестных упражнений
    }
    setExercisePMs(prev => ({ ...pm, ...prev }));
  };
  const setExPM = (name: string, val: number) => {
    setExercisePMs(prev => ({ ...prev, [name]: val }));
  };
  const [selectedCycleId, setSelectedCycleId] = useState<string>(() => {
    const saved = _plSaved?.selectedCycleId;
    const c = saved ? getCycleById(saved) : null;
    if (c && normalizeCycleDirection(c.meta.direction) === 'bodybuilding') return 'cycle-01';
    return saved || 'cycle-01';
  });
  const [cycleWeeks, setCycleWeeks] = useState<number>(_plSaved?.cycleWeeks ?? 12);
  // 📋 Тапер-план: ОТДЕЛЬНАЯ свёрнутая карточка (не встраивается в weeks цикла).
  // (state — в taper-state.tsx через usePLTaper())
  // Календарь мезоцикла: показывать оригинальный цикл или с учётом тапера.
  const [calendarView, setCalendarView] = useState<'original' | 'tapered'>('tapered');
  const validateSavedSrc = (plan: any): LMSBuildOutput | null => {
    if (!plan || !Array.isArray(plan.weeks) || plan.weeks.length === 0) return null;
    if (!plan.weeks.every((week: any) => week && Number.isFinite(week.week) && Array.isArray(week.days))) return null;
    if (!plan.weeks.every((week: any) => week.days.every((day: any) => day && Array.isArray(day.exercises)))) return null;
    return plan as LMSBuildOutput;
  };
  const [builtSrc, setBuiltSrc] = useState<LMSBuildOutput | null>(() => validateSavedSrc(_plSaved?.builtSrc));
  const [srcWeek, setSrcWeek] = useState<number>(_plSaved?.srcWeek ?? 1);
  const [srcAdditions, setSrcAdditions] = useState<Record<string, { uid: string; name: string; group: string; sets: number; reps: number; weight: number }[]>>(_plSaved?.srcAdditions ?? {});
  useEffect(() => {
    if (!builtSrc) return;
    setSrcWeek(current => Math.max(1, Math.min(builtSrc.weeks.length, current)));
  }, [builtSrc]);
  useEffect(() => { try { localStorage.setItem('he_pl_session', JSON.stringify({ selectedCycleId, cycleWeeks, srcWeek, builtSrc, srcAdditions, plLevel: level, plGoal: goal, plDir: dir, plBw: bw, plDays: days, pmSquat, pmBench, pmDead, exercisePMs, plTargetBw: targetBw, plWeeksToMeet: weeksToMeet, plTaperWeeksToAdd: taperWeeksToAdd, plTaperNote: taperNote, plAttemptStrategy: attemptStrategy, plMockMeet: mockMeetOn, plMeetWeek: meetWeekOn, plPostMeetOn: postMeetOn, plTaperFed: taperFed, plTaperActualPm: taperActualPm, plTaperPlannedPm: taperPlannedPm, plPeakMode: peakMode, plTaperWeightGoal: taperWeightGoal, plPeakLayout: peakLayout, plMeetList: meetList, plMainMeetId: mainMeetId, plPeakCycleId: peakCycleId })); } catch { /* ignore */ } }, [selectedCycleId, cycleWeeks, srcWeek, builtSrc, srcAdditions, level, goal, dir, bw, days, pmSquat, pmBench, pmDead, exercisePMs, targetBw, weeksToMeet, taperWeeksToAdd, taperNote, attemptStrategy, mockMeetOn, meetWeekOn, postMeetOn, taperFed, taperActualPm, taperPlannedPm, peakMode, taperWeightGoal, peakLayout, meetList, mainMeetId, peakCycleId]);
  useEffect(() => {
    const cycle = getCycleById(selectedCycleId);
    if (cycle) setCycleWeeks(originalCycleWeeks(cycle));
  }, [selectedCycleId]);
  useEffect(() => { initExercisePMs(selectedCycleId); }, [selectedCycleId]);
  // Deep-link из шаринга «Поделиться в ТГ»: маркер ставит App.tsx (hash #pl-plan-<cycleId>).
  // Выбираем цикл на вкладке ПЛ; если план в сессии от другого цикла — сбрасываем его.
  useEffect(() => {
    try {
      const cid = sessionStorage.getItem('he_pl_deeplink_cycle');
      if (!cid) return;
      sessionStorage.removeItem('he_pl_deeplink_cycle');
      if (!getCycleById(cid)) return;
      setSelectedCycleId(cid);
      setMainTab('pl');
      setSubView('plan');
      if (_plSaved?.selectedCycleId !== cid) setBuiltSrc(null);
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { try { saveTrainingProfile({ ...loadTrainingProfile(), pmSquat, pmBench, pmDead, bodyWeight: bw }); } catch { /* ignore */ } }, [pmSquat, pmBench, pmDead, bw]);
  // U4: ручная правка поверх сгенерированного плана (оверлей правок по позиции сета)
  const [editMode, setEditMode] = useState<boolean>(false);
  const [srcEdits, setSrcEdits] = useState<Record<string, { weight?: number; reps?: number; sets?: number; tempo?: string; pct?: number }>>({});
  const setKey = (w: number, di: number, ei: number, si: number) => `${w}_${di}_${ei}_${si}`;
  const effSet = (w: number, di: number, ei: number, si: number, ws: { sets: number; reps: number; weight: number; pct: number }) => {
    const ed = srcEdits[setKey(w, di, ei, si)];
    if (ed?.pct != null && ed.pct > 0 && ws.pct > 0) {
      // % правка: вес пересчитывается из PM недели (ws.weight / ws.pct = PM_нед).
      return { sets: ed?.sets ?? ws.sets, reps: ed?.reps ?? ws.reps, weight: Math.round((ws.weight / ws.pct) * ed.pct * 10) / 10, pct: ed.pct };
    }
    return { sets: ed?.sets ?? ws.sets, reps: ed?.reps ?? ws.reps, weight: ed?.weight ?? ws.weight, pct: ws.pct };
  };

  // U5: добавление упражнений из каталога (536) в день плана
  const [pickerDay, setPickerDay] = useState<string | null>(null);
  const [pickerGroup, setPickerGroup] = useState<string>('chest');
  const [pickerExName, setPickerExName] = useState<string>('');
  const [pickerScheme, setPickerScheme] = useState<{ sets: number; reps: number; weight: number }>({ sets: 3, reps: 8, weight: 40 });
  // Additions are an overlay and never modify source cycle exercises.
  const CAT_GROUPS = ['chest','back','legs','shoulders','arms','core'];
  const GRP_RU: Record<string,string> = { chest:'Грудь', back:'Спина', legs:'Ноги', shoulders:'Плечи', arms:'Руки', core:'Кор' };
  const dayKey = (w: number, di: number) => `${w}_${di}`;
  const addExToDay = (dk: string) => {
    if (!pickerExName) return;
    setSrcAdditions(prev => ({ ...prev, [dk]: [...(prev[dk]||[]), { uid: 'add_'+Date.now()+'_'+Math.random().toString(36).slice(2,6), name: pickerExName, group: pickerGroup, sets: pickerScheme.sets, reps: pickerScheme.reps, weight: pickerScheme.weight }] }));
    setPickerExName(''); setPickerDay(null);
  };
  const addAccessory = (dayKeys: string[], name: string, group: string, phase?: string) => {
    const PHASE_SCHEMES: Record<string,{reps:number;pct:number}> = { base:{reps:10,pct:0.67}, build:{reps:8,pct:0.73}, peak:{reps:5,pct:0.80}, deload:{reps:12,pct:0.50} };
    const totalW = builtSrc?.weeks.length || 12;
    // расчёт фазы из контекста вызова (сейчас глобальная переменная недоступна в момент вызова)
    const wkNum = Number(dayKeys[0]?.split('_')[0]) || 1;
    const ph = mesocyclePhaseForWeek(wkNum, totalW);
    const sc = PHASE_SCHEMES[ph] || PHASE_SCHEMES.base;
    const profile = loadTrainingProfile();
    setSrcAdditions(prev => {
      const next = { ...prev };
      for (const dk of [...new Set(dayKeys)]) {
        const entries = next[dk] || [];
        if (entries.some(entry => entry.name === name)) continue;
        next[dk] = [...entries, {
          uid: 'acc_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
          name,
          group,
          sets: 3,
          reps: sc.reps,
          weight: Math.round((profile.workMax[group] || 80) * sc.pct),
        }];
      }
      return next;
    });
  };

  // U7: связь композиции методик с планом (оверлей, безопасно — движок не трогаем)
  const [methodHints, setMethodHints] = useState<{ volumeMult: number; technique: string | null; label: string }>({ volumeMult: 1, technique: null, label: '' });
  const deriveHints = (am: Record<string,string>) => {
    const vol = (am['volume']||'').toLowerCase();
    const volumeMult = vol.includes('gvt')||vol.includes('german') ? 1.3 : vol.includes('mev') ? 0.8 : 1;
    const techName = am['intensity'] || am['technique'] || '';
    const t = techName.toLowerCase();
    const technique = t.includes('cluster') ? 'cluster' : t.includes('rest')||t.includes('pause') ? 'rest_pause' : t.includes('tempo')||t.includes('eccentric') ? 'slow_eccentric' : t.includes('myo') ? 'myo_rep' : t.includes('drop') ? 'dropset' : null;
    const label = Object.values(am).join(' · ');
    return { volumeMult, technique, label };
  };

  // ПЛ-авто работает ТОЛЬКО с силовыми циклами (бодибилдинг-циклы имеют свой экран track='bb')
  const plCycles = useMemo(() => LMS_CYCLES.filter(c => normalizeCycleDirection(c.meta.direction) !== 'bodybuilding'), []);
  // ── Фильтры каталога: автор / тип(период) / уровень. [] = все (по умолчанию) ──
  const [filterAuthors, setFilterAuthors] = useState<string[]>([]);
  const [filterTypes, setFilterTypes] = useState<string[]>([]);
  const [filterLevels, setFilterLevels] = useState<string[]>([]);
  const authorOptions = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of plCycles) {
      const tags = c.meta.tags ?? ['lms'];
      const key = tags.find(t => t !== 'bodybuilding' && t !== 'hypertrophy') ?? 'lms';
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    const AUTHOR_LABELS: Record<string, string> = { lms: 'LMS', surovetsky: 'Суровецкий', sheiko: 'Шейко', solovyov: 'Соловьёв', muravyov: 'Муравьёв', coan: 'Коан', butenko: 'Бутенко', hatfield: 'Хэтфилд', mccullough: 'МакКаллоу', petrushin: 'Петрушин', verkhoshansky: 'Верхошанский', washington: 'Washington', muravjev: 'Муравьёв' };
    return [...map.entries()].sort((a, b) => (AUTHOR_LABELS[a[0]] ?? a[0]).localeCompare(AUTHOR_LABELS[b[0]] ?? b[0], 'ru')).map(([id, count]) => ({ id, label: AUTHOR_LABELS[id] ?? id, count }));
  }, [plCycles]);
  const typeOptions = useMemo(() => {
    const order: string[] = ['strength', 'endurance', 'peak', 'mass', 'mixed'];
    const counts = new Map<string, number>();
    for (const c of plCycles) counts.set(c.meta.period, (counts.get(c.meta.period) ?? 0) + 1);
    return [...counts.keys()].sort((a, b) => order.indexOf(a) - order.indexOf(b)).map(id => ({ id, label: periodLabelRu(id), count: counts.get(id) }));
  }, [plCycles]);
  const levelOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of plCycles) counts.set(c.meta.level, (counts.get(c.meta.level) ?? 0) + 1);
    return [...counts.keys()].sort().map(id => ({ id, label: id, count: counts.get(id) }));
  }, [plCycles]);
  const filteredPlCycles = useMemo(() => {
    return plCycles.filter(c => {
      if (filterAuthors.length > 0) {
        const tags = c.meta.tags ?? ['lms'];
        const author = tags.find(t => t !== 'bodybuilding' && t !== 'hypertrophy') ?? 'lms';
        if (!filterAuthors.includes(author)) return false;
      }
      if (filterTypes.length > 0 && !filterTypes.includes(c.meta.period)) return false;
      if (filterLevels.length > 0 && !filterLevels.includes(c.meta.level)) return false;
      return true;
    });
  }, [plCycles, filterAuthors, filterTypes, filterLevels]);
  const hasActiveFilters = filterAuthors.length > 0 || filterTypes.length > 0 || filterLevels.length > 0;
  const resetAllFilters = () => { setFilterAuthors([]); setFilterTypes([]); setFilterLevels([]); };
  const buildSrc = (cycleId = selectedCycleId, weeks = cycleWeeks) => {
    const tpl = getCycleById(cycleId);
    if (!tpl) {
      // Раньше — тихий return: кнопка «Применить как активный цикл» молча
      // ничего не делала, если cycleId блока не найден в каталоге.
      setMethodNote(`⚠ Цикл «${cycleId}» не найден в каталоге — перестройте макроцикл`);
      return;
    }
    // The source cycle, not a generic UI mesocycle length, defines the calendar.
    const safeWeeks = originalCycleWeeks(tpl);
    const pmMap: Record<string, number> = { ...exercisePMs };
    if (!pmMap['Присед']) pmMap['Присед'] = pmSquat;
    if (!pmMap['Жим лежа']) pmMap['Жим лежа'] = pmBench;
    if (!pmMap['Становая тяга']) pmMap['Становая тяга'] = pmDead;
    const rec = getRecoveryMetrics(linked);
    const plan = buildLMSPlan({
       template: tpl, pmMap, fallbackPm: 80, mode: pedAuto && peds.length > 0 ? 'on_course' : 'natural', courseIntensity, weeksOverride: safeWeeks,
      volumeGoal: (linked.profile?.settings as Record<string, any> | undefined)?.volumeGoal || 'mav',
      focusLift: (linked.profile?.settings as Record<string, any> | undefined)?.focusLift,
      currentReadiness: linked.readiness?.recovery,
      equipment: (linked.profile?.settings as Record<string, any> | undefined)?.equipment,
      weakPoints: weakPoints,
      plWeakPoints: plWeakPoints,
      weakGroupDayMap,
      plWeakPointDayMap,
       weakGroupExerciseMap,
            plWeakPointExerciseMap,
            orthopedicBlockedPatterns,
       diagnosticExerciseMap,
       diagnosticDayMap,
       limiterExerciseMap,
       limiterProtocolMap,
       limiterDayMap,
      peds: peds.length ? peds : undefined,
      pedDoses,
      nutrition: { calorieSurplus: plCalorieSurplus, proteinPerKg: plProteinPerKg },
      acwr: acwrData.zone !== 'optimal' ? acwrData : undefined,
      autoReg: autoRegMode === 'auto' ? { topSetPctMultiplier: autoRegResult.topSetPctMultiplier, volumeMultiplier: autoRegResult.volumeMultiplier, rirShift: autoRegResult.rirShift, deload: autoRegResult.deload } : undefined,
      pmAutoReg: pmAutoRegMode === 'off' ? undefined : { mode: pmAutoRegMode, diaryMultiplier: pmDiary?.multiplier },
      // Original SRC cycles are self-calculating: preserve their source layout
      // and apply the cycle's own PM correction between weeks.
      progressionEnabled: true,
      faithful: true,
      peakCycleId: peakCycleId ?? undefined,
      taperWeeks: taperWeeksToAdd,
      peakMode: peakMode,
      ...rec,
    });
    setBuiltSrc(plan); setSrcWeek(1); setSrcEdits({}); setEditMode(false); setPickerDay(null);
    // TRAINING INTEGRATION: конвертировать PL план в сессии
    try { const sessions = lmsPlanToSessions(plan); saveBridgeSessions(sessions); } catch { /* ignore */ }
  };

  const buildSrcMacrocycle = (macro: Macrocycle) => {
    const unsupported = macro.blocks.find(block => block.kind !== 'SRC');
    if (unsupported) {
      throw new Error(`Фаза «${unsupported.phase}» не содержит доступного СРЦ-цикла для PL-плана`);
    }
    const rec = getRecoveryMetrics(linked);
    const outputs = macro.blocks
      .map(block => {
        const cycle = getCycleById(block.cycleId!);
        if (!cycle) return null;
        const output = buildLMSPlan({
          template: cycle,
          pmMap: { ...exercisePMs, 'Присед': exercisePMs['Присед'] || pmSquat, 'Жим лежа': exercisePMs['Жим лежа'] || pmBench, 'Становая тяга': exercisePMs['Становая тяга'] || pmDead },
          fallbackPm: 80,
           mode: pedAuto && peds.length > 0 ? 'on_course' : 'natural',
           courseIntensity,
           weeksOverride: block.weeks,
           progressionEnabled: true,
          volumeGoal: (linked.profile?.settings as Record<string, any> | undefined)?.volumeGoal || 'mav',
          focusLift: (linked.profile?.settings as Record<string, any> | undefined)?.focusLift,
          currentReadiness: linked.readiness?.recovery,
          equipment: (linked.profile?.settings as Record<string, any> | undefined)?.equipment,
          weakPoints,
          plWeakPoints,
          weakGroupDayMap,
          plWeakPointDayMap,
           weakGroupExerciseMap,
            plWeakPointExerciseMap,
            orthopedicBlockedPatterns,
            diagnosticExerciseMap,
            diagnosticDayMap,
            limiterExerciseMap,
            limiterProtocolMap,
            limiterDayMap,
           peds: peds.length ? peds : undefined,
           pedDoses,
           nutrition: { calorieSurplus: plCalorieSurplus, proteinPerKg: plProteinPerKg },
           acwr: acwrData.zone !== 'optimal' ? acwrData : undefined,
           autoReg: autoRegMode === 'auto' ? { topSetPctMultiplier: autoRegResult.topSetPctMultiplier, volumeMultiplier: autoRegResult.volumeMultiplier, rirShift: autoRegResult.rirShift, deload: autoRegResult.deload } : undefined,
            pmAutoReg: pmAutoRegMode === 'off' ? undefined : { mode: pmAutoRegMode, diaryMultiplier: pmDiary?.multiplier },
            faithful: true,
            ...rec,
        });
        const blockWeeks = Array.from({ length: block.weeks }, (_, index) => {
          const source = output.weeks[index % output.weeks.length];
          return { ...source, week: index + 1 };
        });
        return { block, output: { ...output, weeks: blockWeeks } };
      })
      .filter((item): item is { block: Macrocycle['blocks'][number]; output: LMSBuildOutput } => item !== null);
    if (outputs.length === 0) throw new Error('В макроцикле нет доступных СРЦ-циклов');
    const outputByBlock = new Map(outputs.map(item => [item.block, item.output]));
    const weeks = Array.from({ length: macro.totalWeeks }, (_, index) => {
      const weekNumber = index + 1;
      const block = macro.blocks.find(candidate => weekNumber >= candidate.weekOffset && weekNumber < candidate.weekOffset + candidate.weeks);
      if (!block) throw new Error(`Неделя ${weekNumber} не покрыта макроциклом`);
      const output = outputByBlock.get(block);
      // Competition blocks intentionally have no cycleId. Reuse the nearest
      // training week so the annual result still contains a runnable week.
      const sourceOutput = output ?? outputs.reduce((best, item) =>
        Math.abs(item.block.weekOffset - weekNumber) < Math.abs(best.block.weekOffset - weekNumber) ? item : best,
      outputs[0]).output;
      const source = sourceOutput.weeks[(weekNumber - (output ? block.weekOffset : sourceOutput.weeks[0]?.week ?? 1)) % sourceOutput.weeks.length] ?? sourceOutput.weeks[0];
      return { ...source, week: weekNumber, macroPhase: block.phase };
    });
    if (weeks.length !== macro.totalWeeks || weeks.some((week, index) => week.week !== index + 1)) {
      throw new Error('Блоки макроцикла не покрывают все недели последовательно');
    }
    // 🏁 Тапер/пик в макроцикле ПЛ: реальные тапер-недели в peak-блоках,
    // meet-неделя (прикиды + разминка) в competition-блоках, mock meet до
    // и пост-соревновательное восстановление после каждого старта.
    const taperRes = applyMacroTaperToPLWeeks(weeks, {
      mode: macroTaperMode,
      weightGoal: macroWeightGoal,
      strategy: attemptStrategy,
      mockMeet: macroMockMeet,
      postMeet: macroPostMeet,
      peakCycleId: peakCycleId ?? undefined,
    });
    const finalWeeks = taperRes.weeks;
    const sessions = finalWeeks.flatMap(week => week.days.map(day => day.exercises.map(exercise => ({
      name: exercise.name, group: exercise.group, coef: exercise.coef, mnosz: exercise.mnosz, pm: exercise.pm,
      sets: exercise.workSets.map(set => ({ weight: set.weight, reps: set.reps, sets: set.sets })),
    } as SRExercise))));
    const first = outputs[0].output;
    const combined: LMSBuildOutput = {
      ...first,
      template: first.template,
      weeks: finalWeeks,
      cycleMetrics: calcCycleMetrics(sessions),
      progressionRationale: `Макроцикл: ${outputs.length} СРЦ-блок(ов), ${weeks.length} недель. ` + outputs.map(({ block, output }) => `${block.phase} ${block.weekOffset}-${block.weekOffset + block.weeks - 1}: ${output.template.meta.title}`).join('; ') + (taperRes.notes.length > 0 ? ' 🏁 ' + taperRes.notes.join(' ') : ''),
    };
    setBuiltSrc(combined);
    setCycleWeeks(macro.totalWeeks);
    setSrcWeek(1);
    setSrcEdits({});
    setEditMode(false);
    setSubView('plan');
    try { saveBridgeSessions(lmsPlanToSessions(combined)); }
    catch (error) { setMethodNote(`Мост план→сессия: ${(error as Error).message}`); }
  };

  // ── 🧠 Тренерский слой (lms-taper-coach.engine): контекст спортсмена + подбор ──
  /** MC-5: контекст правки микроцикла блока годового плана (записан MacrocyclePanel). */
  const getMacroEditCtx = (): { isBB: boolean; cycleId: string; weeks: number; phase: string; blockIdx: number } | null => {
    try {
      const raw = JSON.parse(localStorage.getItem('he_macro_edit_ctx') || 'null');
      if (!raw || typeof raw !== 'object') return null;
      return { isBB: !!raw.isBB, cycleId: String(raw.cycleId ?? ''), weeks: Number(raw.weeks ?? 0), phase: String(raw.phase ?? ''), blockIdx: Number(raw.blockIdx ?? -1) };
    } catch { return null; }
  };

  const saveMacroEdit = () => {
    try {
      const ctx = getMacroEditCtx();
      if (!ctx) { setMethodNote('⚠ Контекст правки не найден — нажмите «✏️ Редактировать микроцикл» в блоке'); return; }
      // Сохраняем фактическую длительность, выбранную в текущем конструкторе,
      // а не исходное значение блока из he_macro_edit_ctx.
      // P2-8 (Aug 18 2026): единый кламп 1-52 для ПЛ и ББ (раньше ББ 4-24, ПЛ 1-∞ —
      // нельзя было сохранить короткий блок из ББ-конструктора).
      const weeks = Math.max(1, Math.min(52, Math.round(ctx.isBB ? bbWeeks : cycleWeeks)));
      const blockIdx = ctx.blockIdx;
      if (ctx.isBB) {
        const raw = localStorage.getItem('he_bb_macro');
        if (!raw) { setMethodNote('⚠ BB-макроцикл не найден'); return; }
        const macro = deserializeBbMacro(raw);
        if (!macro) { setMethodNote('⚠ BB-макроцикл повреждён'); return; }
        const target = (blockIdx >= 0 && blockIdx < macro.blocks.length) ? macro.blocks[blockIdx] : macro.blocks.find(b => b.phase === ctx.phase);
        if (!target) { setMethodNote('⚠ Блок BB-макроцикла не найден'); return; }
        if (weeks === target.weeks) { setMethodNote('⚠ Недель не изменилось — задайте другую длительность в конструкторе'); return; }
        const phaseTotal = macro.blocks.filter(b => b.phase === target.phase).reduce((s, b) => s + b.weeks, 0);
        const next = rebalanceBbMacrocycle(macro, { [target.phase]: Math.max(1, phaseTotal + (weeks - target.weeks)) });
        localStorage.setItem('he_bb_macro', serializeBbMacro(next));
      } else {
        const raw = localStorage.getItem('he_pl_macro');
        if (!raw) { setMethodNote('⚠ ПЛ-макроцикл не найден'); return; }
        const macro = deserializeMacro(raw);
        if (!macro) { setMethodNote('⚠ ПЛ-макроцикл повреждён'); return; }
        const target = (blockIdx >= 0 && blockIdx < macro.blocks.length) ? macro.blocks[blockIdx] : macro.blocks.find(b => b.phase === ctx.phase);
        if (!target) { setMethodNote('⚠ Блок ПЛ-макроцикла не найден'); return; }
        if (weeks === target.weeks) { setMethodNote('⚠ Недель не изменилось — задайте другую длительность в конструкторе'); return; }
        const phaseTotal = macro.blocks.filter(b => b.phase === target.phase).reduce((s, b) => s + b.weeks, 0);
        const next = rebalanceMacrocycle(macro, [{ phase: target.phase, weeks: Math.max(1, phaseTotal + (weeks - target.weeks)) }]);
        localStorage.setItem('he_pl_macro', serializeMacro(next));
      }
      try { localStorage.removeItem('he_macro_edit_ctx'); } catch { /* ignore */ }
      window.dispatchEvent(new CustomEvent('he-pl-macrocycle-updated'));
      window.dispatchEvent(new CustomEvent('he-bb-macrocycle-updated'));
      window.dispatchEvent(new CustomEvent('he-annual-training-plan-updated'));
      setSubView('macro');
      setMethodNote('✅ Правка сохранена в годовой план');
    } catch (error) {
      setMethodNote(`⚠ Ошибка сохранения правки: ${(error as Error).message}`);
    }
  };

  const renderMacroEditBanner = () => {
    const ctx = getMacroEditCtx();
    if (!ctx || (mainTab === 'bb') !== ctx.isBB) return null;
    return (
      <div style={{ marginBottom: 10, padding: '10px 12px', borderRadius: 12, background: 'rgba(0,230,138,0.06)', border: '1px solid rgba(0,230,138,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 11, color: '#fff', lineHeight: 1.5, minWidth: 0 }}>
          ✏️ Правка блока годового плана: {ctx.weeks} нед · фаза «{ctx.phase}»{!ctx.isBB && ctx.cycleId ? ` · цикл «${getCycleById(ctx.cycleId)?.meta.title ?? ctx.cycleId}»` : ''}
          <div style={{ fontSize: 10, color: '#fff' }}>Соберите план с нужным числом недель и нажмите «💾 Сохранить в годовой план».</div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <button type="button" onClick={saveMacroEdit} style={{ ...BTN, minHeight: 36, fontSize: 10, padding: '6px 12px' }}>💾 Сохранить в годовой план</button>
          <button type="button" onClick={() => { try { localStorage.removeItem('he_macro_edit_ctx'); } catch { /* ignore */ } setSubView('macro'); }} style={{ ...BTN_GHOST, minHeight: 36, fontSize: 10, padding: '6px 12px' }}>✕ Отменить</button>
        </div>
      </div>
    );
  };

  const buildCoachCtx = (): TaperCoachCtx => {
    const lastWk = builtSrc?.weeks[builtSrc.weeks.length - 1];
    return {
      fatigue: linked.readiness?.fatigue ?? 30,
      acwr: acwrData,
      recentSessions: loadSRPESessions(),
      meetDate: isoAddDays(isoToday(), Math.max(0, weeksToMeet * 7)),
      currentWeight: bw,
      targetWeight: targetBw,
      actualPm: Object.fromEntries(Object.entries(taperActualPm).filter(([, v]) => v > 0)),
      plannedPm: Object.fromEntries(Object.entries(taperPlannedPm).filter(([, v]) => v > 0)),
      forecastPm: lastWk?.pmRow ?? undefined,
      weeksToMeet,
      weeklyK: builtSrc?.template?.meta?.correctionPct ?? 0.005,
    };
  };
  const applyTaperRecommendation = (r: ReturnType<typeof recommendTaperConfig>) => {
    setPeakMode(r.mode);
    setTaperWeeksToAdd(r.taperWeeks);
    setTaperWeightGoal(r.weightGoal);
    setMockMeetOn(r.mockMeet);
    setPostMeetOn(r.postMeet);
    setAttemptStrategy(r.strategy);
    setMethodNote(`🤖 Тренер подобрал тапер: ${r.rationale.join(' ')}`);
  };

  // ── BB ──
  const _bbSaved: any = (() => { try { return JSON.parse(localStorage.getItem('he_bb_session') || 'null'); } catch { return null; } })();
  const [bbLevel, setBbLevel] = useState<string>(_bbSaved?.bbLevel || 'intermediate');
  const [bbGoal, setBbGoal] = useState<string>(_bbSaved?.bbGoal || 'mass');
  const [bbDays, setBbDays] = useState<number>(_bbSaved?.bbDays ?? 4);
  const [bbWeeks, setBbWeeks] = useState<number>(_bbSaved?.bbWeeks ?? 4);
  const [bbVolGoal, setBbVolGoal] = useState<string>(_bbSaved?.bbVolGoal || 'mav');
  const [bbFocus, setBbFocus] = useState<string>(_bbSaved?.bbFocus || '');
  const [bbTrainingFocus, setBbTrainingFocus] = useState<'strength' | 'hypertrophy' | 'endurance'>(_bbSaved?.bbTrainingFocus || 'hypertrophy');
  const [peds, setPeds] = useState<PED[]>(_bbSaved?.peds ?? (_profPL.onCourse ? (['AAS'] as PED[]) : []));
  const [pedAuto, setPedAuto] = useState(_profPL.onCourse);
  const [pedDoses, setPedDoses] = useState<Record<string, number>>(_plSaved?.pedDoses ?? _bbSaved?.pedDoses ?? { AAS: 500, insulin: 10, MGF: 200, IGF1: 50, GH: 4 });
  const [courseIntensity, setCourseIntensity] = useState<'mild' | 'moderate' | 'heavy'>(_plSaved?.courseIntensity ?? _profPL.courseIntensity ?? 'moderate');
  // 🥗 Питание (как в ББ-авто): профицит калорий и белок г/кг → MRV soft-cap (Helms 2022).
  const [plCalorieSurplus, setPlCalorieSurplus] = useState<number>(() => Number((getProfile()?.settings?.nutrition as any)?.calorieSurplus ?? 0));
  const [plProteinPerKg, setPlProteinPerKg] = useState<number>(() => Number((getProfile()?.settings?.nutrition as any)?.proteinPerKg ?? 1.8));
  const ranked = useMemo(() => rankCycles({
    goal: goal as any,
    level: level as any,
    bodyWeight: bw,
    daysPerWeek: days,
    direction: dir as any,
    mode: pedAuto && peds.length > 0 ? 'on_course' : 'natural',
  }).filter(r => normalizeCycleDirection(r.cycle.meta.direction) !== 'bodybuilding'), [goal, level, bw, days, dir, pedAuto, peds.length]);
  const best = ranked[0];
  const [seasonNotes, setSeasonNotes] = useState<string[]>([]);
  const [seasonSegments, setSeasonSegments] = useState<SeasonBuildInfo[]>([]);
  const [plSeasonMode, setPlSeasonMode] = useState<'single' | 'season'>(() => {
    try {
      const s = JSON.parse(localStorage.getItem('he_pl_session') || '{}').season;
      return s && s.mode === 'season' ? 'season' : 'single';
    } catch { return 'single'; }
  });
  useEffect(() => { try { const cur = JSON.parse(localStorage.getItem('he_pl_session') || '{}'); localStorage.setItem('he_pl_session', JSON.stringify({ ...cur, peds, pedDoses, courseIntensity })); } catch { /* ignore */ } }, [peds, pedDoses, courseIntensity]);
  const _validateBBPlan = (plan: any): BBPlan | null => {
    if (!plan || !Array.isArray(plan.weeks) || !plan.weeks.length) return null;
    return plan;
  };
  const [builtBb, setBuiltBb] = useState<BBPlan | null>(_validateBBPlan(_bbSaved?.builtBb));
  const [bbWeekSel, setBbWeekSel] = useState<number>(_bbSaved?.bbWeekSel ?? 1);
  const WEAK_GROUPS = [['chest','Грудь'],['back','Спина'],['legs','Ноги'],['shoulders','Плечи'],['arms','Руки'],['core','Кор']] as const;
  const [weakPoints, setWeakPoints] = useState<string[]>(_profPL.weakPoints || []);
  const toggleWeak = (g: string) => setWeakPoints(p => p.includes(g) ? p.filter(x => x !== g) : [...p, g]);
  useEffect(() => { try { saveTrainingProfile({ ...loadTrainingProfile(), weakPoints }); } catch {} }, [weakPoints]);
  // 🎯 Слабые точки СРЦ-движений (профи-диагностика weakpoint-pl) — заполняются из единого калькулятора движения (PlDeadpointsBarPathCard, weakpoints-событие)
  const [plWeakPoints, setPlWeakPoints] = useState<{ lift: Lift; weakPoint: WeakPoint }[]>([]);
  // 📅 Ручной выбор дней недели для слабых групп и слабых точек (1-based)
  const [weakGroupDayMap, setWeakGroupDayMap] = useState<Record<string, number[]>>({});
  const [plWeakPointDayMap, setPlWeakPointDayMap] = useState<Record<string, number[]>>({});
  const [weakGroupExerciseMap, setWeakGroupExerciseMap] = useState<Record<string, string[]>>({});
   const [plWeakPointExerciseMap, setPlWeakPointExerciseMap] = useState<Record<string, string[]>>({});
   const [orthopedicBlockedPatterns, setOrthopedicBlockedPatterns] = useState<string[]>([]);
   const [diagnosticExerciseMap, setDiagnosticExerciseMap] = useState<Record<string, string[]>>({});
   const [diagnosticDayMap, setDiagnosticDayMap] = useState<Record<string, number[]>>({});
   // 🧩 Калькулятор «Лимитирующие факторы движения» (limiter-событие): выбранные упражнения + категорийные протоколы.
   const [limiterExerciseMap, setLimiterExerciseMap] = useState<Record<string, string[]>>({});
   const [limiterProtocolMap, setLimiterProtocolMap] = useState<Record<string, { protocol: { sets: number; reps: number; pct: number; rir: number; tempo?: string; rest?: string; holdSec?: number; note?: string }; category: string }>>({});
   const [limiterDayMap, setLimiterDayMap] = useState<Record<string, number[]>>({});
  // Clear stale day selections when cycle changes (old cycle may have had different day count)
  useEffect(() => {
    setWeakGroupDayMap({});
    setPlWeakPointDayMap({});
    setWeakGroupExerciseMap({});
    setPlWeakPointExerciseMap({});
  }, [selectedCycleId]);
  const toggleDayInMap = (mapKey: string, day: number, which: 'wg' | 'pw') => {
    const upd = (prev: Record<string, number[]>) => {
      const s = new Set(prev[mapKey] || []);
      if (s.has(day)) s.delete(day); else s.add(day);
      return { ...prev, [mapKey]: [...s].sort((a, b) => a - b) };
    };
    if (which === 'wg') setWeakGroupDayMap(upd);
    else setPlWeakPointDayMap(upd);
  };
  const toggleExerciseInMap = (mapKey: string, name: string, kind: 'wg' | 'pw') => {
    const update = (prev: Record<string, string[]>) => {
      const selected = new Set(prev[mapKey] || []);
      if (selected.has(name)) selected.delete(name); else selected.add(name);
      return { ...prev, [mapKey]: [...selected] };
    };
    if (kind === 'wg') setWeakGroupExerciseMap(update);
    else setPlWeakPointExerciseMap(update);
  };
  // V7 расширение: тренд 1ПМ по выбранному упражнению
  const [selectedTrendEx, setSelectedTrendEx] = useState<string | null>(null);
  const PL_WEAKPOINT_LABELS: Record<WeakPoint, string> = {
    off_chest: 'Сход с груди', mid: 'Середина', lockout: 'Дожим', start: 'Старт', bottom: 'Низ',
    sumo_start: 'Сумо: старт', sumo_lockout: 'Сумо: дожим',
    ohp_start: 'Старт с плеч', ohp_mid: 'Середина', ohp_lockout: 'Дожим',
    row_start: 'Старт (съём)', row_mid: 'Середина', row_squeeze: 'Сведение лопаток',
    pd_top: 'Верх (старт)', pd_mid: 'Середина', pd_squeeze: 'Сведение к груди',
    inc_off: 'Сход с груди (верх)', inc_mid: 'Середина', inc_lockout: 'Дожим',
    sumo_mid: 'Сумо: середина',
    biceps_start: 'Сгибание: старт', biceps_mid: 'Сгибание: середина', biceps_top: 'Сгибание: пик',
  };
  const PL_WP_OPTIONS = (Object.keys(WEAK_POINTS_BY_LIFT) as Lift[]).map(lift => ({
    lift, weakPoints: WEAK_POINTS_BY_LIFT[lift].map(wp => ({ id: wp, label: PL_WEAKPOINT_LABELS[wp] || wp })),
  }));
  // 🔗 planner-bridge: приём корректировок от калькуляторов (ПМ/слабые точки/PRI/сплит)
  const [applyPayload, setApplyPayload] = useState<PlannerApply | null>(() => getPlannerApply());
  const [priAdjust, setPriAdjust] = useState<{ volumeMult: number; rirShift: number } | null>(null);
  const [tempoAdjust, setTempoAdjust] = useState<{ eccentric: number; bottomPause: number; concentric: number; topPause: number; label?: string } | null>(null);
  const [rirShiftAdjust, setRirShiftAdjust] = useState<number>(0);
  const [mrvOverride, setMrvOverride] = useState<number | null>(null);
  const [deloadAdjust, setDeloadAdjust] = useState<{ volumeMult: number; rirShift: number; weeks: number[] } | null>(null);
  const [peakAdjust, setPeakAdjust] = useState<{ volumeMult: number; rirTarget: number } | null>(null);
  const [volumeTarget, setVolumeTarget] = useState<Record<string, number> | null>(null);
  const pendingApplyRef = useRef<PlannerApply | null>(null);
  useEffect(() => subscribePlannerApply(p => setApplyPayload(p)), []);
  // Авто-применение bridge: только НОВЫЕ события (не stale данные при монтировании)
  const mountedRef = useRef(false);
  useEffect(() => {
    if (!mountedRef.current) { mountedRef.current = true; clearPlannerApply(); setApplyPayload(null); return; }
    if (applyPayload) applyExternal();
  }, [applyPayload]);
  // производные от bridge-корректировок (видны в таблице плана ПЛ/ББ и в runtime)
  const tempoStr = tempoAdjust ? `${tempoAdjust.eccentric}-${tempoAdjust.bottomPause}-${tempoAdjust.concentric}-${tempoAdjust.topPause}` : '';
  const bridgeMult = (priAdjust ? priAdjust.volumeMult : 1) * (deloadAdjust ? deloadAdjust.volumeMult : 1) * (peakAdjust ? peakAdjust.volumeMult : 1);
  const bridgeRir = (priAdjust ? priAdjust.rirShift : 0) + rirShiftAdjust + (deloadAdjust ? deloadAdjust.rirShift : 0);
  const peakRirTarget = peakAdjust ? peakAdjust.rirTarget : null;
  const BB_WM_KEYS = ['chest','back','quads','hamstrings','shoulders','biceps','triceps','glutes','calves','abs'] as const;
  const BB_WM_RU: Record<string,string> = { chest:'Грудь', back:'Спина', quads:'Квадрицепсы', hamstrings:'Бицепс бедра', shoulders:'Плечи', biceps:'Бицепс', triceps:'Трицепс', glutes:'Ягодичные', calves:'Икры', abs:'Пресс' };
  const [bbWorkMax, setBbWorkMax] = useState<Record<string, number>>({ chest: 100, back: 110, quads: 140, hamstrings: 90, shoulders: 60, biceps: 50, triceps: 60, glutes: 160, calves: 120, abs: 60, ...(_profPL?.workMax || {}), ...(_bbSaved?.bbWorkMax || {}) });
  const setBbWm = (k: string, v: number) => setBbWorkMax(p => ({ ...p, [k]: v }));
  useEffect(() => { try { localStorage.setItem('he_bb_session', JSON.stringify({ bbLevel, bbGoal, bbDays, bbWeeks, peds, builtBb, bbWeekSel, bbWorkMax, bbTrainingFocus })); } catch { /* ignore */ } }, [bbLevel, bbGoal, bbDays, bbWeeks, peds, builtBb, bbWeekSel, bbTrainingFocus]);
  useEffect(() => { try { saveTrainingProfile({ ...loadTrainingProfile(), workMax: bbWorkMax }); } catch { /* ignore */ } }, [bbWorkMax]);
  useEffect(() => { try { saveTrainingProfile({ ...loadTrainingProfile(), onCourse: peds.length > 0 }); } catch {} }, [peds]);
  const [appliedMethods, setAppliedMethods] = useState<Record<string, string>>({});
  const [methodNote, setMethodNote] = useState<string | null>(null);
  const linked = useDataLink();
  const diarySessions = useMemo(() => loadSessions(), []);
  // P12-wire #2: проф-авторегуляция плана — 3 режима (off/auto/diary)
  const [autoRegMode, setAutoRegMode] = useState<AutoRegMode>('off');
  const autoRegOn = autoRegMode !== 'off';
  // Авторегуляция ПРОГРЕССИИ ПМ (только ПМ) — независимый переключатель от авторегуляции весов/объёма/RIR.
  const [pmAutoRegMode, setPmAutoRegMode] = useState<PMAutoRegMode>('off');
  const acwrData = useMemo(() => {
    const srpe = loadSRPESessions();
    if (srpe.length < 2) return { ratio: 1.0, zone: 'optimal' as const };
    const r = acuteChronicRatio(toDailyLoads(srpe));
    return { ratio: r.ratio, zone: r.zone };
  }, [linked.readiness]);
  const autoRegResult: AutoRegOutput = useMemo(() => {
    const rec = linked.readiness?.recovery ?? 80;
    const fat = linked.readiness?.fatigue ?? 30;
    const sleep = linked.readiness?.sleep ?? 70;
    const hrv = linked.profile?.settings?.baselineHrvRatio ?? 1.0;
    return autoRegulate({ readiness: rec, acwr: { ratio: acwrData.ratio, zone: acwrData.zone }, fatigue: fat, hrvRatio: hrv, sleepScore: sleep, plannedTopSetPct: 0.85, plannedRIR: 2 });
  }, [linked.readiness, linked.profile?.settings, acwrData]);
  const diary = useMemo(() => new StrengthDiary(), []);
  const [historyWorkouts, setHistoryWorkouts] = useState<WorkoutLog[]>([]);
  useEffect(() => { (async () => { try { const w = await diary.getWorkoutLogs(); setHistoryWorkouts(w.reverse()); } catch { /* ignore */ } })(); }, [diary]);

  // Diary-авторегуляция: per-exercise корректировка весов из последней сессии дневника
  const diaryAutoreg: DiaryAutoregResult | null = useMemo(() => {
    if (autoRegMode !== 'diary' || !builtSrc) return null;
    const wk = builtSrc.weeks[srcWeek - 1];
    if (!wk) return null;
    const planned = wk.days.flatMap(d => d.exercises.map(e => {
      // P1-fix: pick the highest-weight (working) work set, not workSets[0] which may be warmup.
      const mainSet = e.workSets.reduce((best, ws) => (ws.weight ?? 0) > (best.weight ?? 0) ? ws : best, e.workSets[0] ?? ({} as typeof e.workSets[number]));
      return {
        name: e.name,
        plannedWeight: mainSet?.weight ?? 0,
        plannedReps: mainSet?.reps ?? 8,
        plannedSets: mainSet?.sets ?? 3,
        plannedRir: mainSet?.rir ?? 2,
        isMain: e.load === 'Тяжелая',
      };
    }));
    return buildDiaryAutoreg({ historyWorkouts, plannedExercises: planned });
  }, [autoRegMode, builtSrc, srcWeek, historyWorkouts]);

  // Авторегуляция ПМ по дневнику: множитель кривой ПМ по e1RM vs плановый ПМ0.
  const pmDiary = useMemo(() => {
    if (pmAutoRegMode !== 'diary') return null;
    const pm0Map: Record<string, number> = { ...exercisePMs };
    if (!pm0Map['Присед']) pm0Map['Присед'] = pmSquat;
    if (!pm0Map['Жим лежа']) pm0Map['Жим лежа'] = pmBench;
    if (!pm0Map['Становая тяга']) pm0Map['Становая тяга'] = pmDead;
    return pmDiaryMultiplier({ historyWorkouts, pm0Map });
  }, [pmAutoRegMode, exercisePMs, pmSquat, pmBench, pmDead, historyWorkouts]);

  // ── TRAINING INTEGRATION: мост план→сессия ──
  const [bridgeSessions, setBridgeSessions] = useState<BridgeSession[]>([]);
  const [progressSnap, setProgressSnap] = useState<ProgressSnapshot[]>([]);
  const [bridgeWeek, setBridgeWeek] = useState<number>(1);
  // сохраняем bridge-сессии при построении плана
  const saveBridgeSessions = (sessions: BridgeSession[]) => {
    setBridgeSessions(sessions);
    try { localStorage.setItem('he_bridge_sessions', JSON.stringify(sessions)); } catch { /* ignore */ }
    // рассчитываем прогресс
    const snap = progressFromSessions(sessions);
    setProgressSnap(snap);
    try { localStorage.setItem('he_bridge_progress', JSON.stringify(snap)); } catch { /* ignore */ }
  };
  // восстанавливаем при монтировании
  useEffect(() => {
    try {
      const saved = localStorage.getItem('he_bridge_sessions');
      if (saved) { const s = JSON.parse(saved); setBridgeSessions(s); setBridgeWeek(1); }
      const savedProgress = localStorage.getItem('he_bridge_progress');
      if (savedProgress) setProgressSnap(JSON.parse(savedProgress));
    } catch { /* ignore */ }
  }, []);

  // autoregPlan через training-integration (параллельно существующему autoreg)
  const bridgeAutoreg = useMemo(() => {
    if (!builtSrc && !builtBb) return null;
    const rec = linked.readiness?.recovery ?? 80;
    const fat = linked.readiness?.fatigue ?? 30;
    const r: ReadinessInput = {
      priScore: rec / 100,
      fatigueScore: fat / 100,
      recoveryScore: rec / 100,
      riskLevel: level === 'novice' ? 'high' : level === 'intermediate' ? 'medium' : 'low',
      goal: mainTab === 'pl' ? goal : bbGoal,
      plannedIntensity: mainTab === 'pl' ? 85 : 75,
      plannedSets: mainTab === 'pl' ? 15 : 20,
      plannedReps: mainTab === 'pl' ? 5 : 10,
      plannedFrequency: mainTab === 'pl' ? days : bbDays,
    };
    return autoregPlanBridge(r);
  }, [builtSrc, builtBb, linked.readiness, mainTab, goal, bbGoal, level, days, bbDays]);

  // группировка bridge-сессий по неделям
  const bridgeWeeks = useMemo(() => {
    const uniq = [...new Set(bridgeSessions.map(s => s.weekNumber))].sort((a, b) => a - b);
    return uniq;
  }, [bridgeSessions]);
  const bridgeWeekSessions = useMemo(() => {
    return bridgeSessions.filter(s => s.weekNumber === bridgeWeek);
  }, [bridgeSessions, bridgeWeek]);
  const bridgeWeekPhase = useMemo(() => {
    const explicit = bridgeWeekSessions.find(session => session.macroPhase)?.macroPhase;
    if (explicit) return explicit;
    const totalW = bridgeWeeks.length || 12;
    return mesocyclePhaseForWeek(bridgeWeek, Math.max(totalW, bridgeWeek));
  }, [bridgeWeek, bridgeWeeks, bridgeWeekSessions]);
  const displayPhaseForWeek = (week: LMSBuildOutput['weeks'][number], totalWeeks: number): string => {
    return week.macroPhase
      ? macroPhaseToLmsPhase(week.macroPhase as Macrocycle['blocks'][number]['phase'])
      : (week.sourcePhase || mesocyclePhaseForWeek(week.week, totalWeeks));
  };
  /** Суммарный объём (сеты) недели плана — для отображения taper-процентов. */
  const weekVolumeOf = (week: LMSBuildOutput['weeks'][number]): number => {
    let v = 0;
    for (const d of week.days) for (const e of d.exercises) for (const ws of e.workSets) v += ws.sets;
    return v;
  };

  const bbRanked = useMemo(() => rankBBSplits({ level: bbLevel, goal: bbGoal as any, daysPerWeek: bbDays }), [bbLevel, bbGoal, bbDays]);
  const bbBest = bbRanked[0];

  const buildBb = () => {
    if (!bbBest) return;
    const profData = linked.profile?.settings?.personal;
    const lifeData = linked.profile?.settings?.lifestyle;
    const nutrData = linked.profile?.settings?.nutrition as (Record<string, any> | undefined);
    const bodyFat = profData?.bodyFat;
    const leanMass = (profData?.weight && bodyFat != null) ? Math.round(profData.weight * (1 - bodyFat / 100)) : undefined;
    // BB-2+BB-5 FIX: pass all available parameters to buildBBPlan
    let plan: BBPlan = buildBBPlan({
      patternId: bbBest.pattern.id, level: bbLevel, goal: bbGoal as any, weeks: bbWeeks,
      workMax: bbWorkMax, weakPoints, focusGroup: bbFocus, volumeGoal: bbVolGoal as any,
      trainingFocus: bbTrainingFocus,
      bodyFat, leanMass, hrvMs: lifeData?.morningHRV, sleepHours: lifeData?.sleepHours, stressLevel: lifeData?.stressLevel,
      // BB-4 FIX: pass PED parameters
      pedDoses, courseIntensity,
      // Profile parameters
      sex: profData?.sex,
      proteinPerKg: nutrData?.proteinPerKg,
      calorieSurplus: nutrData?.calorieSurplus ?? 0,
    }, pedAdapt);
    // 🏁 Единая система тапера ББ: оверлей на собранный план из профиля
    // (goals.bbPeakConfig с legacy-fallback) — накладывается СВЕРХУ цикла.
    try {
      const goals = (linked.profile?.settings as any)?.goals;
      const rawCfg = goals?.bbPeakConfig;
      const prepCfg = rawCfg ? deserializeBBPrepConfig(rawCfg) : legacyConfigFromProfile(goals, profData);
      if (prepCfg) plan = applyTrainingTaperToBBPlan(plan, prepCfg);
    } catch { /* оверлей не блокирует сборку */ }
    setBuiltBb(plan); setBbWeekSel(1);
    // TRAINING INTEGRATION: конвертировать BB план в сессии
    try { const sessions = bbPlanToSessions(plan); saveBridgeSessions(sessions); } catch { /* ignore */ }
  };

  const applyBBMacrocycle = (macro: Macrocycle | BBMacrocycle) => {
    if (!bbBest) throw new Error('Не найден подходящий ББ-сплит');
    const profData = linked.profile?.settings?.personal;
    const lifeData = linked.profile?.settings?.lifestyle;
    const nutrData = linked.profile?.settings?.nutrition as (Record<string, any> | undefined);
    const bodyFat = profData?.bodyFat;
    const leanMass = (profData?.weight && bodyFat != null)
      ? Math.round(profData.weight * (1 - bodyFat / 100))
      : undefined;
    // BB-2+BB-5 FIX: pass all available parameters to buildBBPlan
    const plan = buildBBPlan({
      patternId: bbBest.pattern.id,
      level: bbLevel,
      goal: bbGoal as any,
      weeks: macro.totalWeeks,
      workMax: bbWorkMax,
      weakPoints,
      focusGroup: bbFocus,
      volumeGoal: bbVolGoal as any,
      trainingFocus: 'trainingFocus' in macro ? macro.trainingFocus : bbTrainingFocus,
      bodyFat,
      leanMass,
      hrvMs: lifeData?.morningHRV,
      sleepHours: lifeData?.sleepHours,
      stressLevel: lifeData?.stressLevel,
      // BB-4 FIX: pass PED parameters
      pedDoses, courseIntensity,
      // Profile parameters
      sex: profData?.sex,
      proteinPerKg: nutrData?.proteinPerKg,
      calorieSurplus: nutrData?.calorieSurplus ?? 0,
    }, pedAdapt);
    const phased = applyMacrocycleToBBPlan(plan, macro);
    // 🏁 Тапер ББ: оверлей на макроцикл-план из профиля (goals.bbPeakConfig).
    // Мульти-соревнования: тапер + пик-неделя накладываются на КАЖДЫЙ блок
    // contest_prep (неделя шоу = последняя неделя блока), недель тапера —
    // не больше длины блока (не залезаем в соседнюю фазу).
    let finalPlan: BBPlan = phased;
    try {
      const goals = (linked.profile?.settings as any)?.goals;
      const rawCfg = goals?.bbPeakConfig;
      const prepCfg = rawCfg ? deserializeBBPrepConfig(rawCfg) : legacyConfigFromProfile(goals, profData);
      if (prepCfg) {
        const blocks = Array.isArray((macro as any)?.blocks) ? (macro as any).blocks : [];
        const prepBlocks = blocks.filter((b: any) => b.phase === 'contest_prep');
        const macroEvents = Array.isArray((macro as any)?.competitions) ? (macro as any).competitions : [];
        if (prepBlocks.length > 0) {
          for (const b of prepBlocks) {
            const lastWeek = (b.weekOffset ?? 0) + (b.weeks ?? 0) - 1;
            if (lastWeek < 1) continue;
            const event = b.competitionId ? macroEvents.find((c: any) => c.id === b.competitionId) : undefined;
            const eventCfg: BBContestPrepConfig = {
              ...prepCfg,
              showDate: event?.date ?? isoAddDays(isoToday(), Math.max(0, lastWeek - 1) * 7),
              weeksOut: Math.min(prepCfg.weeksOut, b.weeks ?? prepCfg.weeksOut),
            };
            finalPlan = applyTrainingTaperToBBPlan(finalPlan, eventCfg, { weekNumber: lastWeek });
          }
        } else {
          finalPlan = applyTrainingTaperToBBPlan(phased, prepCfg);
        }
      }
    } catch { /* оверлей не блокирует сборку */ }
    setBbWeeks(macro.totalWeeks);
    setBuiltBb(finalPlan);
    setBbWeekSel(1);
    try { saveBridgeSessions(bbPlanToSessions(finalPlan)); } catch { /* ignore */ }
    setSubView('plan');
  };
  // 🔗 применение корректировок из калькуляторов к активному плану (ПЛ/ББ)
  const applyExternal = () => {
    const p = getPlannerApply();
    if (!p) return;
    if (p.kind === 'pm') {
      const pm = p.data || {};
      if (pm.lift && pm.value) {
        // одиночный 1RM (из калькулятора 1RM)
        if (mainTab === 'pl') {
          if (pm.lift === 'squat') setPmSquat(pm.value);
          else if (pm.lift === 'bench') setPmBench(pm.value);
          else if (pm.lift === 'dead') setPmDead(pm.value);
          pendingApplyRef.current = p;
        } else if (mainTab === 'bb') {
          setBbWorkMax(w => ({ ...w, quads: pm.lift === 'squat' ? pm.value : w.quads, chest: pm.lift === 'bench' ? pm.value : w.chest, hamstrings: pm.lift === 'dead' ? pm.value : w.hamstrings }));
          pendingApplyRef.current = p;
        }
      } else {
        if (mainTab === 'pl') { setPmSquat(pm.squat || pmSquat); setPmBench(pm.bench || pmBench); setPmDead(pm.dead || pmDead); pendingApplyRef.current = p; }
        else if (mainTab === 'bb') { setBbWorkMax(w => ({ ...w, quads: pm.squat || w.quads, chest: pm.bench || w.chest, hamstrings: pm.dead || w.hamstrings })); pendingApplyRef.current = p; }
      }
      } else if (p.kind === 'weakpoints') {
       setWeakPoints(p.data?.groups || []);
        if (Array.isArray(p.data?.orthopedic?.blockedPatterns)) setOrthopedicBlockedPatterns(p.data.orthopedic.blockedPatterns);
        if (p.data?.diagnosticExerciseMap) setDiagnosticExerciseMap(p.data.diagnosticExerciseMap);
        if (p.data?.diagnosticDayMap) setDiagnosticDayMap(p.data.diagnosticDayMap);
        if (Array.isArray(p.data?.plWeakPoints)) {
          setPlWeakPoints(p.data.plWeakPoints.map((x: any) => ({ lift: x.lift, weakPoint: x.weakPoint })));
          const dm: Record<string, number[]> = {};
          for (const x of p.data.plWeakPoints) {
            if (Array.isArray(x.days) && x.days.length > 0) dm[`${x.lift}|${x.weakPoint}`] = x.days;
          }
          setPlWeakPointDayMap(dm);
        }
        if (p.data?.weakGroupExerciseMap) setWeakGroupExerciseMap(p.data.weakGroupExerciseMap);
        if (p.data?.weakGroupDayMap) setWeakGroupDayMap(p.data.weakGroupDayMap);
       pendingApplyRef.current = p;
    } else if (p.kind === 'limiter') {
       // 🧩 Калькулятор «Лимитирующие факторы движения» — категорийные протоколы.
       setLimiterExerciseMap(p.data?.limiterExerciseMap ?? {});
       setLimiterProtocolMap(p.data?.limiterProtocolMap ?? {});
       setLimiterDayMap(p.data?.limiterDayMap ?? {});
       pendingApplyRef.current = p;
    } else if (p.kind === 'pri') {
      setPriAdjust({ volumeMult: (p.data?.volumeMult ?? 1) as number, rirShift: (p.data?.rirShift ?? 0) as number });
    } else if (p.kind === 'split') {
      if (mainTab === 'bb') { setBbDays(p.data?.cycle?.length || bbDays); pendingApplyRef.current = p; }
    } else if (p.kind === 'tempo') {
      setTempoAdjust(p.data ? { ...p.data } : null);
    } else if (p.kind === 'rir') {
      // объединить со существующим priAdjust: добавка к RIR
      setRirShiftAdjust((p.data?.rirShift ?? 0) as number);
    } else if (p.kind === 'mrv') {
      if (mainTab === 'bb') { setMrvOverride((p.data?.mrv ?? null) as number | null); pendingApplyRef.current = p; }
      else { pendingApplyRef.current = p; }
    } else if (p.kind === 'deload') {
      setDeloadAdjust({ volumeMult: (p.data?.volumeMult ?? 0.5) as number, rirShift: (p.data?.rirShift ?? 3) as number, weeks: (p.data?.weeks || []) as number[] });
    } else if (p.kind === 'peak') {
      setPeakAdjust({ volumeMult: (p.data?.volumeMult ?? 0.5) as number, rirTarget: (p.data?.rirTarget ?? 0) as number });
      if (p.data?.peakCycleId) setPeakCycleId(p.data.peakCycleId as string);
    } else if (p.kind === 'volume') {
      setVolumeTarget((p.data?.sets || null) as Record<string, number> | null);
    }
    clearPlannerApply(); setApplyPayload(null);
    setSubView('plan'); // показать обновлённый план
  };
  useEffect(() => {
    const p = pendingApplyRef.current;
    if (!p) return;
    pendingApplyRef.current = null;
    if (mainTab === 'pl') { try { buildSrc(); } catch { /* ignore */ } }
    else if (mainTab === 'bb') { try { buildBb(); } catch { /* ignore */ } }
    setSubView('plan'); // показать пересобранный план
  }, [pmSquat, pmBench, pmDead, weakPoints, bbDays, bbWorkMax, mrvOverride, mainTab]);
  const baseMrv = useMemo(() => Object.fromEntries(Object.entries(getAllVolumeLandmarks(bbLevel)).map(([k, v]) => [k, mrvOverride != null ? mrvOverride : v.mrv])), [bbLevel, mrvOverride]);
  const pedAdapt = useMemo(() => adaptForPEDs(peds, baseMrv, pedDoses, courseIntensity), [peds, baseMrv, pedDoses, courseIntensity]);

  const togglePed = (p: PED) => setPeds(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);
  const srcDays: PlayerDay[] = useMemo(() => {
    if (!builtSrc || !Array.isArray(builtSrc.weeks) || !builtSrc.weeks.length) return [];
     const wk0 = builtSrc.weeks[Math.min(Math.max(srcWeek - 1, 0), builtSrc.weeks.length - 1)]; const w0 = wk0.week;
    return wk0.days.map((d, i) => ({
      label: `Д${i + 1}`,
      exercises: [
        ...d.exercises.map((e, ei) => ({
          name: e.name, muscleGroup: e.group,
           targetSets: e.workSets.flatMap((ws, si) => { let es = effSet(w0, i, ei, si, ws); if (autoRegMode === 'diary' && diaryAutoreg) { const adj = diaryAutoreg.perExercise.get(e.name); if (adj) { es = { ...es, weight: adj.adjustedWeight, sets: adj.adjustedSets }; } } const priMult = (priAdjust ? priAdjust.volumeMult : 1) * (deloadAdjust ? deloadAdjust.volumeMult : 1) * (peakAdjust ? peakAdjust.volumeMult : 1); const priRir = peakAdjust ? peakAdjust.rirTarget : ((priAdjust ? priAdjust.rirShift : 0) + rirShiftAdjust + (deloadAdjust ? deloadAdjust.rirShift : 0)); let diaryRir = 0; if (autoRegMode === 'diary' && diaryAutoreg) { const adj = diaryAutoreg.perExercise.get(e.name); if (adj) diaryRir = adj.adjustedRir - (ws.rir ?? 2); } es = { ...es, sets: Math.max(1, Math.round(es.sets * priMult)) }; return Array.from({ length: es.sets }, () => ({ weight: es.weight, reps: es.reps, rir: Math.max(0, priRir + diaryRir), tempo: tempoAdjust ? tempoAdjust : undefined })); }),
          pm: e.pm, coef: e.coef, mnosz: e.mnosz, group: e.group,
        })),
        ...(srcAdditions[dayKey(w0, i)] || []).map(a => ({
          name: a.name, muscleGroup: a.group,
          targetSets: Array.from({ length: a.sets }, () => ({ weight: a.weight, reps: a.reps, rir: 0 })),
          pm: Math.max(a.weight * 1.4, 1), coef: 1, mnosz: 1, group: a.group,
        })),
      ],
    }));
  }, [builtSrc, srcWeek, srcEdits, srcAdditions, autoRegOn, autoRegMode, autoRegResult, diaryAutoreg, priAdjust, tempoAdjust, rirShiftAdjust, deloadAdjust, peakAdjust]);

  const bbDaysArr: PlayerDay[] = useMemo(() => {
    if (!builtBb || !Array.isArray(builtBb.weeks) || !builtBb.weeks.length) return [];
     const wk = builtBb.weeks[Math.min(Math.max(bbWeekSel - 1, 0), builtBb.weeks.length - 1)];
    return wk.sessions.map((sess, i) => ({
      label: `Д${i + 1} ${sess.character}${(sess as any).peakWeekTraining ? ' 🎭' : ''}${sess.exercises.length === 0 ? ' 😴 отдых' : ''}`,
      exercises: sess.exercises.map(e => {
        const sourceSets = e.workSets.length > 0
          ? e.workSets
          : [{ weight: 0, reps: 0, rir: e.rir }];
        const exName = e.name || e.exerciseName || e.muscle;
        const diaryAdj = autoRegMode === 'diary' && diaryAutoreg
          ? diaryAutoreg.perExercise.get(exName)
          : undefined;
        let volumeMult = 1;
        let weightMult = 1;
        if (autoRegMode === 'auto' && autoRegResult) {
          volumeMult = autoRegResult.volumeMultiplier;
          weightMult = autoRegResult.topSetPctMultiplier;
        }
        const sets = Math.max(1, Math.round((diaryAdj?.adjustedSets ?? e.sets) * volumeMult));
        const priMult = (priAdjust ? priAdjust.volumeMult : 1) * (deloadAdjust ? deloadAdjust.volumeMult : 1) * (peakAdjust ? peakAdjust.volumeMult : 1);
        const priRir = peakAdjust ? peakAdjust.rirTarget : ((priAdjust ? priAdjust.rirShift : 0) + rirShiftAdjust + (deloadAdjust ? deloadAdjust.rirShift : 0));
        const outputSets = Math.max(1, Math.round(sets * priMult));
        let diaryRir = 0;
        if (diaryAdj) diaryRir = diaryAdj.adjustedRir - e.rir;
        const rirOut = Math.max(0, peakAdjust ? peakAdjust.rirTarget : (e.rir + priRir + diaryRir));
        const targetSets = Array.from({ length: outputSets }, (_, index) => {
          const source = sourceSets[index % sourceSets.length];
          return {
            weight: diaryAdj ? diaryAdj.adjustedWeight : Math.round(source.weight * weightMult * 10) / 10,
            reps: source.reps,
            rir: rirOut,
            tempo: tempoAdjust ? tempoAdjust : source.tempo,
          };
        });
        return {
          name: exName, muscleGroup: e.muscle,
          targetSets,
        };
      }),
    }));
  }, [builtBb, bbWeekSel, autoRegOn, autoRegMode, autoRegResult, diaryAutoreg, priAdjust, tempoAdjust, rirShiftAdjust, deloadAdjust, peakAdjust]);

  const playerDays: PlayerDay[] = mainTab === 'pl' ? srcDays : bbDaysArr;
  const runFocus = mainTab === 'pl'
    ? (plSeasonMode === 'season' ? '🧩 Сезон по микроциклам' : (getCycleById(selectedCycleId)?.meta.title || 'Силовой цикл'))
    : 'BB';
  const lmsChart: LMSWeekMetric[] = useMemo(() => {
    if (!builtSrc || !Array.isArray(builtSrc.weeks) || !builtSrc.weeks.length) return [];
    return builtSrc.weeks.map(wk => {
      const t = wk.days.reduce((s, d) => s + d.metrics.tonnage, 0);
      const k = wk.days.reduce((s, d) => s + d.metrics.kpsh, 0);
      const uoi = k > 0 ? wk.days.reduce((s, d) => s + d.metrics.uoi * d.metrics.kpsh, 0) / k : 0;
      const relInt = k > 0 ? wk.days.reduce((s, d) => s + d.metrics.relIntensity * d.metrics.kpsh, 0) / k : 0;
      const intFB = k > 0 ? wk.days.reduce((s, d) => s + d.metrics.intFB * d.metrics.kpsh, 0) / k : 0;
      return { week: wk.week, tonnage: Math.round(t), kpsh: k, relInt: Math.round(relInt * 1000) / 1000, uoi: Math.round(uoi * 100) / 100, intFB: Math.round(intFB) };
    });
  }, [builtSrc]);
  const bbChart: BBMuscleMetric[] = useMemo(() => {
    if (!builtBb || !Array.isArray(builtBb.weeks) || !builtBb.weeks.length) return [];
    const mult = methodHints.volumeMult;
    return calcBBPlanMetrics(builtBb, pedAdapt.combinedMrvMultiplier).perMuscle.map(p => ({ muscle: p.muscle, sets: Math.round(p.totalSets * mult), тяж: Math.round(p.тяжSets * mult), памп: Math.round(p.пампSets * mult), mrv: p.mrv }));
  }, [builtBb]);

  // Сохраняем построенный план (дни + фокус + неделя) в localStorage, чтобы
  // вкладка «Тренировки» (runtime) могла запустить его выполнение.
  useEffect(() => {
    if (playerDays.length > 0) {
       try { localStorage.setItem('he_pl_runtime', JSON.stringify({ days: playerDays, focus: runFocus, week: mainTab === 'bb' ? bbWeekSel : srcWeek, track: mainTab })); } catch { /* ignore */ }
    }
  }, [playerDays, runFocus, srcWeek, mainTab]);

  // V7: прогресс 1ПМ из дневника тренировок (StrengthDiary), Epley-оценка из реальных подходов
  const [strengthLogs, setStrengthLogs] = useState<any[]>([]);
  useEffect(() => {
    let m = true;
    try { new StrengthDiary().getWorkoutLogs().then((l: any) => { if (m) setStrengthLogs(l || []); }); } catch { /* ignore */ }
    return () => { m = false; };
  }, []);
  const e1rmSeries = useMemo(() => {
    if (!strengthLogs.length) return [];
    const byLift: Record<string, Map<string, number>> = { squat: new Map(), bench: new Map(), deadlift: new Map() };
    for (const log of strengthLogs) {
      for (const ex of (log.exercises || [])) {
        const lift = detectLift(ex.exerciseName || '', ex.group || '');
        if (!lift) continue;
        const key = lift === 'dead' ? 'deadlift' : lift;
        let best = 0;
        for (const st of (ex.sets || [])) {
          const w = +st.weight || 0, r = +st.reps || 0;
          if (w > 0) { const e1 = r <= 1 ? w : Math.round(w * (1 + r / 30) * 10) / 10; if (e1 > best) best = e1; }
        }
        if (best > 0) { const cur = byLift[key].get(log.date) || 0; if (best > cur) byLift[key].set(log.date, best); }
      }
    }
    const COL: Record<string, string> = { squat: 'var(--accent)', bench: '#60a5fa', deadlift: '#f59e0b' };
    const LBL: Record<string, string> = { squat: 'Присед', bench: 'Жим', deadlift: 'Становая' };
    return Object.keys(byLift).map(lift => {
      const pts = [...byLift[lift].entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([date, val]) => ({ date, val }));
      return { lift, color: COL[lift], label: LBL[lift], pts };
    }).filter(s => s.pts.length > 0);
  }, [strengthLogs]);

  // V7 (расширение): личные 1ПМ по КАЖДОМУ упражнению из дневника (Epley из реальных подходов)
  const exerciseE1rm = useMemo(() => {
    if (!strengthLogs.length) return [];
    const best = new Map<string, { e1: number; w: number; r: number }>();
    for (const log of strengthLogs) {
      for (const ex of (log.exercises || [])) {
        const nm = ex.exerciseName || '';
        if (!nm) continue;
        let be1 = 0, bw = 0, br = 0;
        for (const st of (ex.sets || [])) {
          const w = +st.weight || 0, r = +st.reps || 0;
          if (w > 0) { const e1 = r <= 1 ? w : Math.round(w * (1 + r / 30) * 10) / 10; if (e1 > be1) { be1 = e1; bw = w; br = r; } }
        }
        const cur = best.get(nm);
        if (!cur || be1 > cur.e1) best.set(nm, { e1: be1, w: bw, r: br });
      }
    }
    return [...best.entries()].filter(([, v]) => v.e1 > 0).sort((a, b) => b[1].e1 - a[1].e1).map(([name, v]) => ({ name, ...v }));
  }, [strengthLogs]);

  const calibratePmFromDiary = (lift: 'squat' | 'bench' | 'deadlift') => {
    const series = e1rmSeries.find(s => s.lift === lift);
    const last = series?.pts.at(-1)?.val;
    if (last == null) return;
    if (lift === 'squat') setPmSquat(last);
    else if (lift === 'bench') setPmBench(last);
    else setPmDead(last);
  };

  const applyPmFromCycle = (pm: { squat: number; bench: number; deadlift: number }) => {
    if (pm.squat > 0) setPmSquat(pm.squat);
    if (pm.bench > 0) setPmBench(pm.bench);
    if (pm.deadlift > 0) setPmDead(pm.deadlift);
  };

  // V7 расширение: тренд 1ПМ по выбранному упражнению во времени
  const exTrendSeries = useMemo(() => {
    if (!selectedTrendEx || !strengthLogs.length) return [] as { date: string; e1: number; w: number; r: number }[];
    const byDate = new Map<string, { e1: number; w: number; r: number }>();
    for (const log of strengthLogs) {
      const date = log.date?.slice(0, 10) || '';
      if (!date) continue;
      let be1 = 0, bw = 0, br = 0;
      for (const ex of (log.exercises || [])) {
        if ((ex.exerciseName || '') !== selectedTrendEx) continue;
        for (const st of (ex.sets || [])) {
          const w = +st.weight || 0, r = +st.reps || 0;
          if (w > 0) { const e1 = r <= 1 ? w : Math.round(w * (1 + r / 30) * 10) / 10; if (e1 > be1) { be1 = e1; bw = w; br = r; } }
        }
      }
      if (be1 > 0) {
        const cur = byDate.get(date);
        if (!cur || be1 > cur.e1) byDate.set(date, { e1: be1, w: bw, r: br });
      }
    }
    return [...byDate.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([d, v]) => ({ date: d, ...v }));
  }, [strengthLogs, selectedTrendEx]);

  // 🔄 «Начать заново»: подтверждение сброса сборки (ПЛ-план и ББ-план + все оверлеи).
  const [resetAsk, setResetAsk] = useState(false);
  const resetBuild = () => {
    setResetAsk(false);
    // ПЛ-план: собранный цикл, добавления, правки, тапер-план.
    setBuiltSrc(null);
    setSrcWeek(1);
    setSrcAdditions({});
    setSrcEdits({});
    setEditMode(false);
    setPickerDay(null);
    setTaperPlan(null);
    // ББ-план (вкладка ББ этого экрана).
    setBuiltBb(null);
    setBbWeekSel(1);
    setSubView('plan');
    setMethodNote('🔄 Сборка сброшена — начинаем заново');
  };

  const seasonBuildOpts = useMemo(() => ({
    pmMap: { ...exercisePMs, 'Присед': exercisePMs['Присед'] || pmSquat, 'Жим лежа': exercisePMs['Жим лежа'] || pmBench, 'Становая тяга': exercisePMs['Становая тяга'] || pmDead },
    fallbackPm: 80,
    progressionMode: (pedAuto && peds.length > 0 ? 'on_course' : 'natural') as LMSBuildInput['mode'],
    courseIntensity,
    peds: peds.length ? peds : undefined,
    pedDoses,
    nutrition: { calorieSurplus: plCalorieSurplus, proteinPerKg: plProteinPerKg },
    acwr: acwrData.zone !== 'optimal' ? acwrData : undefined,
    autoReg: autoRegMode === 'auto' ? { topSetPctMultiplier: autoRegResult.topSetPctMultiplier, volumeMultiplier: autoRegResult.volumeMultiplier, rirShift: autoRegResult.rirShift, deload: autoRegResult.deload } : undefined,
    pmAutoReg: pmAutoRegMode === 'off' ? undefined : { mode: pmAutoRegMode, diaryMultiplier: pmDiary?.multiplier },
    volumeGoal: (linked.profile?.settings as Record<string, any> | undefined)?.volumeGoal || 'mav',
    focusLift: (linked.profile?.settings as Record<string, any> | undefined)?.focusLift,
    currentReadiness: linked.readiness?.recovery,
    equipment: (linked.profile?.settings as Record<string, any> | undefined)?.equipment,
    weakPoints,
    plWeakPoints,
    weakGroupDayMap,
    plWeakPointDayMap,
    weakGroupExerciseMap,
    plWeakPointExerciseMap,
    orthopedicBlockedPatterns,
    diagnosticExerciseMap,
    diagnosticDayMap,
    limiterExerciseMap,
    limiterProtocolMap,
    limiterDayMap,
    recovery: getRecoveryMetrics(linked),
  }), [exercisePMs, pmSquat, pmBench, pmDead, pedAuto, peds, courseIntensity, pedDoses, plCalorieSurplus, plProteinPerKg, acwrData, autoRegMode, autoRegResult, pmAutoRegMode, pmDiary, linked, weakPoints, plWeakPoints, weakGroupDayMap, plWeakPointDayMap, weakGroupExerciseMap, plWeakPointExerciseMap, orthopedicBlockedPatterns, diagnosticExerciseMap, diagnosticDayMap, limiterExerciseMap, limiterProtocolMap, limiterDayMap]);

  // Сводка для печати/экспорта: базовые метрики + циклы сезона (с «ужатиями»).
  const plPrintSummary = (): { label: string; value: string }[] => {
    const rows: { label: string; value: string }[] = [
      { label: 'Недель', value: `${builtSrc?.weeks.length ?? 0}` },
      { label: 'Дней/нед', value: `${days}` },
      { label: 'Присед ПМ', value: `${pmSquat} кг` },
      { label: 'Жим ПМ', value: `${pmBench} кг` },
      { label: 'Тяга ПМ', value: `${pmDead} кг` },
    ];
    if (plSeasonMode === 'season' && seasonSegments.length > 0) {
      seasonSegments.forEach(s => {
        if (s.fitMode === 'shrink') rows.push({ label: `${s.periodLabel ?? 'Сезон'} · ${s.cycleTitle}`, value: `⬇ сжат ${s.cycleWeeks}→${s.weeks} нед` });
        else if (s.fitMode === 'extend') rows.push({ label: `${s.periodLabel ?? 'Сезон'} · ${s.cycleTitle}`, value: `⬆ растянут → ${s.weeks} нед` });
        else rows.push({ label: `${s.periodLabel ?? 'Сезон'} · ${s.cycleTitle}`, value: `${s.weeks} нед` });
      });
    }
    return rows;
  };

  return (
    <div key={mainTab} className="pl-auto-screen" style={{ padding: '12px 0', color: '#fff', width: '100%', maxWidth: '100%', margin: 0, minWidth: 0, boxSizing: 'border-box', overflowX: 'hidden' }}>
      {/* Заголовок текущего режима планирования (выбор режима — в навигации блока) */}
      <div style={{ marginBottom: 10, padding: '8px 12px', borderRadius: 12, background: 'var(--accent-dim)', border: '1px solid var(--accent-glow)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--accent)' }}>{mainTab === 'pl' ? '🏆 Силовой цикл (ПЛ)' : mainTab === 'bb' ? '💪 Бодибилдинг (ББ)' : '🛠 Ручной конструктор'}</span>
        <button onClick={() => setResetAsk(true)} title="Сбросить сборку и начать заново" aria-label="Начать заново" style={{ padding: '5px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer', border: '1px solid rgba(244,63,94,0.35)', background: 'rgba(244,63,94,0.08)', color: '#fb7185', minHeight: 30, flexShrink: 0 }}>🔄 Начать заново</button>
      </div>
      {applyPayload && (
        <div style={{ padding: '10px 12px', borderRadius: 10, background: 'var(--accent-dim)', border: '1px solid rgba(0,230,138,0.25)', marginBottom: 10, fontSize: 11, color: 'var(--accent)', fontWeight: 700, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>✓ Применено: {applyPayload.label}</span>
          <button onClick={() => { clearPlannerApply(); setApplyPayload(null); }} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#fff', fontSize: 10, cursor: 'pointer', flexShrink: 0 }}>✕</button>
        </div>
      )}
      {methodNote && (
        <div role="alert" aria-live="polite" style={{ ...CARD, borderColor: 'rgba(0,230,138,0.3)', background: 'var(--accent-dim)', color: 'var(--accent)', fontSize: 11 }}>
          {methodNote}
        </div>
      )}
      {/* sub-view pill nav for PL/BB */}
      {mainTab !== 'manual' && subViewList[mainTab].length > 0 && (
        <div style={{ display: 'flex', gap: 4, marginBottom: 10, overflowX: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: 4, scrollbarWidth: 'none' }}>
          {subViewList[mainTab].map(({ key, label }) => (
            <button key={key} style={PILL(subView === key)} onClick={() => setSubView(key)}>{label}</button>
          ))}
        </div>
      )}

      {mainTab === 'pl' && subView === 'settings' && (
        <div style={{ minWidth: 0, maxWidth: '100%' }}>
          {renderMacroEditBanner()}
          <div style={H}>1 ⚙️ Настройки (+💉 ПЕД + 🥗 питание)</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8, minWidth: 0 }}>
            <PopupSelect label="Уровень спортсмена" value={level} onChange={setLevel} options={[['novice','Новичок'],['II-KMS','II разряд — КМС'],['KMS-MS','КМС — МС'],['MS-MSMK','МС — МСМК'],['II-MS','II разряд — МС'],['intermediate','Средний']].map(([id,label]) => ({ id, label }))} />
            <PopupSelect label="Цель тренировок" value={goal} onChange={setGoal} options={[['strength','Сила'],['mass','Мышечная масса'],['endurance','Выносливость'],['peak','Выход на пик'],['mixed','Смешанная']].map(([id,label]) => ({ id, label }))} />
            <PopupSelect label="Направление" value={dir} onChange={setDir} options={[['powerlifting','Троеборье'],['bench','Жим лёжа'],['deadlift_bench','Тяга + Жим'],['armwrestling','Армрестлинг']].map(([id,label]) => ({ id, label }))} />
            <PopupNumber label="Дней в неделю" value={days} min={2} max={7} suffix="" onChange={v => setDays(v)} />
            <PopupNumber label="Вес тела" value={bw} min={40} max={200} suffix=" кг" onChange={v => setBw(v)} />
          </div>
          <div style={H}>💪 Предельные максимумы (ПМ) по упражнениям цикла</div>
          {(() => {
            const tpl = getCycleById(selectedCycleId);
            if (!tpl) return null;
            const exs = extractExercises(tpl);
            const isArmCycle = exs.some(e => e.includes('Кисть') || e.includes('Натяжка') || e.includes('Боковой') || e.includes('Приведение'));
            const mainCount = exs.filter(e => e.includes('Присед') || e.includes('Жим') || e.includes('Становая') || e.includes('Тяга')).length;
            if (mainCount <= 3 && !isArmCycle) {
              return (
                <>
                  <div role="group" aria-label="Предельные максимумы основных упражнений" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: 8 }}>
                    <div><PopupNumber label="Присед" value={pmSquat} min={20} max={500} suffix=" кг" onChange={v => setPmSquat(v)} />{exerciseE1rm.some(e => detectLift(e.name, '') === 'squat') && <button onClick={() => calibratePmFromDiary('squat')} style={{ ...BTN_GHOST, width: '100%', padding: '4px 6px', minHeight: 30, fontSize: 10 }}>📈 Из дневника</button>}</div>
                    <div><PopupNumber label="Жим лёжа" value={pmBench} min={20} max={400} suffix=" кг" onChange={v => setPmBench(v)} />{exerciseE1rm.some(e => detectLift(e.name, '') === 'bench') && <button onClick={() => calibratePmFromDiary('bench')} style={{ ...BTN_GHOST, width: '100%', padding: '4px 6px', minHeight: 30, fontSize: 10 }}>📈 Из дневника</button>}</div>
                    <div><PopupNumber label="Становая тяга" value={pmDead} min={20} max={500} suffix=" кг" onChange={v => setPmDead(v)} />{exerciseE1rm.some(e => detectLift(e.name, '') === 'dead') && <button onClick={() => calibratePmFromDiary('deadlift')} style={{ ...BTN_GHOST, width: '100%', padding: '4px 6px', minHeight: 30, fontSize: 10 }}>📈 Из дневника</button>}</div>
                  </div>
                  {exs.length > 3 && (
                    <div style={{ marginTop: 10, padding: '8px 10px', borderRadius: 8, background: 'rgba(0,230,138,0.04)', border: '1px solid var(--accent-dim)' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: ACCENT, marginBottom: 6 }}>🔧 Дополнительные ПМ по упражнениям цикла</div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 6, boxSizing: 'border-box' }}>
                        {exs.filter(e => {
                          const n = e.toLowerCase();
                          return !n.includes('присед') && !n.includes('жим') && !n.includes('становая');
                        }).map(e => (
                          <PopupNumber key={e} label={e} value={exercisePMs[e] ?? 80} min={0} max={500} suffix=" кг" onChange={v => setExPM(e, v)} />
                        ))}
                      </div>
                    </div>
                  )}
                </>
              );
            }
            return (
              <>
                <div style={{ fontSize: 11, color: '#fff', marginBottom: 6 }}>
                  Цикл использует {exs.length} упражнений. Укажите ПМ для каждого:
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 6, boxSizing: 'border-box' }}>
                  {exs.map(e => {
                    const n = e.toLowerCase();
                    const isMain = n.includes('присед') || n.includes('жим') || n.includes('становая') || n.includes('тяга');
                    return (
                      <div key={e} style={isMain ? { gridColumn: 'span 1' } : {}}>
                        <PopupNumber label={e} value={exercisePMs[e] ?? (isMain ? 80 : 0)} min={0} max={500} suffix=" кг" onChange={v => setExPM(e, v)} />
                      </div>
                    );
                  })}
                </div>
              </>
            );
          })()}
          {(() => {
            const sourceCycle = getCycleById(selectedCycleId);
            const sourceWeeks = sourceCycle ? originalCycleWeeks(sourceCycle) : cycleWeeks;
            return <div style={{ marginTop: 8, padding: '8px 10px', borderRadius: 8, background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.18)', fontSize: 11, color: '#fff' }}>
              📅 Оригинальная длина цикла: <b style={{ color: '#60a5fa' }}>{sourceWeeks} нед.</b> · календарь берётся из исходной раскладки СРЦ.
            </div>;
          })()}
          {/* 💉 PED-адаптация объёмов (как в ББ-авто) */}
          <div style={{ marginTop: 10 }}>
            <PedInputPanel
              peds={peds}
              onToggle={togglePed}
              pedDoses={pedDoses}
              onDose={(p, v) => setPedDoses(d => ({ ...d, [p]: v }))}
              courseIntensity={courseIntensity}
              onIntensity={setCourseIntensity}
              headerExtra={
                <button onClick={() => setPedAuto(a => !a)} style={{ padding:'5px 12px', borderRadius:8, fontSize:10, fontWeight:800, cursor:'pointer', border:'none', background: pedAuto ? '#00e68a' : 'rgba(255,255,255,0.1)', color: pedAuto ? '#000' : '#fff', flexShrink: 0, minHeight: 32 }}>
                  АВТО {pedAuto ? 'ON' : 'OFF'}
                </button>
              }
            />
            {pedAuto && peds.length > 0 && <div style={{ marginTop:6, fontSize:10, color:'#fff' }}>⚡ Авто-прогрессия ПМ включена: {courseIntensity === 'heavy' ? 'Тяжёлая' : courseIntensity === 'moderate' ? 'Умеренная' : 'Лёгкая'} интенсивность → {courseIntensity === 'heavy' ? '+2.5%' : courseIntensity === 'moderate' ? '+2%' : '+1.5%'}/нед</div>}
            {!pedAuto && peds.length > 0 && <div style={{ marginTop:6, fontSize:10, color:'#fff' }}>⏸ Авто-прогрессия выключена → базовая progression цикла</div>}
            <PedAdaptationCard adaptation={pedAdapt} />
            {/* 🥗 Питание (как в ББ-авто): профицит калорий + белок → MRV soft-cap (Helms 2022) */}
            <div style={{ marginTop: 8, padding: '10px 12px', borderRadius: 12, background: 'rgba(34,197,94,0.04)', border: '1px solid rgba(34,197,94,0.15)' }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#22c55e', marginBottom: 6 }}>🥗 Питание</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                <PopupNumber label="Профицит калорий (ккал/день)" value={plCalorieSurplus} onChange={v => setPlCalorieSurplus(Math.round(v))} step={50} min={-500} max={1000} hint="Профицит >100 → +5% MRV, >300 → +10%. Дефицит <-200 → -20% MRV (Helms 2022)" />
                <PopupNumber label="Белок (г/кг)" value={plProteinPerKg} onChange={v => setPlProteinPerKg(v)} step={0.1} min={0.5} max={3} hint="≥2.0 → +10% MRV, ≥1.6 → +5%, <1.0 → -15% MRV" />
              </div>
              {(() => {
                const nut: Record<string, { cal: string; pro: string; tip: string }> = {
                  strength: { cal: 'Профицит 300-500 ккал/день', pro: '1.8-2.2 г/кг (≥160 г/день)', tip: 'Углеводы 5-7 г/кг для силовой производительности. 4-6 приёмов пищи.' },
                  mass: { cal: 'Профицит 300-500 ккал/день', pro: '1.8-2.2 г/кг (≥160 г/день)', tip: 'Углеводы вокруг тренировки. 4-6 приёмов пищи.' },
                  cut: { cal: 'Дефицит 300-500 ккал/день', pro: '2.2-2.8 г/кг (≥180 г/день)', tip: 'Белок повышен для сохранения мышц. Клетчатка 30+ г/день.' },
                  recomp: { cal: 'Поддержание ±100 ккал', pro: '2.0-2.4 г/кг', tip: 'Циклирование углеводов: высокие в дни тренировок, низкие в дни отдыха.' },
                  maintenance: { cal: 'Поддержание (TDEE)', pro: '1.6-2.0 г/кг', tip: 'Стабильное питание, контроль веса 1 раз/нед.' },
                };
                const n = nut[goal] || nut.strength;
                const calMult = (pedAdapt.combinedMrvMultiplier - 1) * 3 + 1;
                const adjCal = n.cal.replace(/\d+/, m => String(Math.round(Number(m) * calMult)));
                return (
                  <div style={{ marginTop: 6, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 11 }}>
                    <div><span style={{ color: '#fff' }}>Рекомендация: </span><span style={{ fontWeight: 700, color: '#f59e0b' }}>{adjCal}</span></div>
                    <div><span style={{ color: '#fff' }}>Белок: </span><span style={{ fontWeight: 700, color: '#22c55e' }}>{n.pro}</span></div>
                    <div style={{ gridColumn: '1/-1' }}><span style={{ color: '#fff' }}>💡 </span><span style={{ color: '#fff' }}>{n.tip}</span></div>
                    {pedAdapt.combinedMrvMultiplier > 1 && (
                      <div style={{ gridColumn: '1/-1', marginTop: 4, fontSize: 10, color: '#f59e0b' }}>
                        💉 PED увеличивают потребность в калориях и белке — значения скорректированы.
                      </div>
                    )}
                  </div>
                );
              })()}
              {/* 🏁 Тапер/соревнование: питание по фазе (сброс веса или набор к старту) */}
              {(taperNote || mockMeetOn || meetWeekOn) && (() => {
                const losing = bw > targetBw + 0.5;
                return (
                  <div style={{ marginTop: 8, padding: 8, borderRadius: 10, background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#f59e0b', marginBottom: 4 }}>
                      🏁 Тапер{taperNote ? ' применён' : ' включён'}{mockMeetOn ? ' · 🎯 mock meet' : ''}{meetWeekOn ? ' · 🏁 соревнования' : ''} — питание по фазе
                    </div>
                    {losing ? (
                      <div style={{ fontSize: 10, color: '#fff', lineHeight: 1.5 }}>
                        <b style={{ color: '#f59e0b' }}>Сброс веса к старту</b> ({bw} → {targetBw} кг): дефицит 300-500 ккал, белок 2.2-2.8 г/кг (сохранить мышцы), клетчатка 30+ г. За 48-24ч — сгонка воды: вода+натрий → вода-натрий, взвешивание утром. MRV ниже при дефиците — объём ассистентов уже скорректирован.
                      </div>
                    ) : (
                      <div style={{ fontSize: 10, color: '#fff', lineHeight: 1.5 }}>
                        <b style={{ color: '#f59e0b' }}>Набор к старту</b> (вес в категории): профицит 200-400 ккал, белок 1.8-2.2 г/кг. За 48-72ч до прикидок — углеводная нагрузка 4-7 г/кг (гликоген к попыткам), соль по плану. Тапер = разгрузка, питание = заправка.
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
          <button style={{ ...BTN, width: '100%', marginTop: 10, minHeight:44, fontSize:13 }} onClick={() => { try { buildSrc(); setSubView('plan'); } catch (error) { setMethodNote(`Ошибка генерации плана: ${(error as Error).message}`); } }}>Сгенерировать план ({cycleWeeks} нед)</button>
          <div style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between', gap: 4, flexWrap: 'wrap' }}>
            <button style={{ ...BTN_GHOST, minHeight: 36, fontSize: 10 }} onClick={() => setSubView('diagnostics')}>← 2 Слабые точки + 10 калькуляторов</button>
            <button style={{ ...BTN_GHOST, minHeight: 36, fontSize: 10 }} onClick={() => setSubView('season')}>🧩 Сезон →</button>
          </div>
        </div>
      )}

      {mainTab === 'pl' && subView === 'season' && (
        <div style={{ minWidth: 0, maxWidth: '100%' }}>
          {renderMacroEditBanner()}
          <div style={H}>🧩 Сезон по микроциклам</div>
          <div style={{ fontSize: 11, color: '#fff', marginBottom: 8, lineHeight: 1.5 }}>
            Постройте сезон из периодов-микроциклов (выносливость 6–20 / сила 6–12 / скорость+координация 6–10 / пик 8–10 нед) — авто-подбор или ручной выбор каждого цикла из базы; задайте соревнования, чтобы между стартами циклы ужимались под окно и у каждого старта был пик/тапер.
          </div>
          <PLSeasonBuilder
            mode={plSeasonMode}
            onModeChange={setPlSeasonMode}
            selector={{ goal: goal as never, level: level as never, bodyWeight: bw, daysPerWeek: days, direction: dir as never, mode: pedAuto && peds.length > 0 ? 'on_course' : 'natural' }}
            meets={meetList.map(m => ({ id: m.id, name: m.name, weeksToStart: m.weeksToStart }))}
            taper={{
              mode: peakMode,
              weightGoal: taperWeightGoal,
              strategy: attemptStrategy,
              mockMeet: mockMeetOn,
              postMeet: postMeetOn,
              windowWeeks: weeksToMeet,
            }}
            buildOpts={seasonBuildOpts}
            onBuilt={(out, notes, segments) => { setBuiltSrc(out); setSrcWeek(1); setSeasonNotes(notes); setSeasonSegments(segments || []); if (notes && notes.length > 0) setMethodNote(notes[notes.length - 1]); }}
            onNavigatePlan={() => setSubView('plan')}
          />
          {seasonNotes.length > 0 && (
            <div role="alert" style={{ marginTop: 8, padding: 8, borderRadius: 8, background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)', color: '#c4b5fd', fontSize: 11, lineHeight: 1.5 }}>
              {seasonNotes.map((n, i) => <div key={i}>{n}</div>)}
            </div>
          )}
          <div style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between', gap: 4, flexWrap: 'wrap' }}>
            <button style={{ ...BTN_GHOST, minHeight: 36, fontSize: 10 }} onClick={() => setSubView('settings')}>← 1 Настройки</button>
            <button style={{ ...BTN_GHOST, minHeight: 36, fontSize: 10 }} onClick={() => setSubView('plan')}>3 План →</button>
          </div>
        </div>
      )}

      {mainTab === 'pl' && subView === 'plan' && (
        <div style={{ minWidth: 0, maxWidth: '100%' }}>
          {renderMacroEditBanner()}
          {plSeasonMode !== 'season' && best && <ExpandableCard title={`🏆 Рекомендован: ${best.cycle.meta.title}`} icon="🏆" short={best.cycle.meta.description} full={<><div style={{ marginBottom: 8 }}><b>Почему этот цикл:</b> {explainSelection(best)}</div><div style={{ fontSize: 11, color: "#fff" }}>{best.cycle.meta.howItWorks}</div><button onClick={() => { try { setSelectedCycleId(best.cycle.meta.id); buildSrc(best.cycle.meta.id); } catch (error) { setMethodNote(`⚠ План не собран: ${(error as Error).message}`); } }} style={{ marginTop: 10, width: "100%", padding: 10, borderRadius: 8, border: "none", cursor: "pointer", background: "linear-gradient(135deg,var(--accent),#00c853)", color: "#000", fontWeight: 700, fontSize: 12 }}>✅ Применить цикл и собрать план</button></>} />}
          {plSeasonMode !== 'season' && (
            <>
              <div style={H}>📂 Каталог силовых циклов ({filteredPlCycles.length})</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 6, marginBottom: 6 }}>
                <PopupMultiSelect label="👤 Автор" options={authorOptions} selected={filterAuthors} onChange={setFilterAuthors} hint="Фильтр по автору цикла (LMS, Суровецкий, Шейко и др.)" />
                <PopupMultiSelect label="🎯 Тип" options={typeOptions} selected={filterTypes} onChange={setFilterTypes} hint="Тип/период цикла: сила, выносливость, выход на пик, масса, смешанный" />
                <PopupMultiSelect label="📶 Уровень" options={levelOptions} selected={filterLevels} onChange={setFilterLevels} hint="Уровень спортсмена (новичок, II-КМС, КМС-МС и т.д.)" />
              </div>
              {hasActiveFilters && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginBottom: 6, fontSize: 10, color: '#fff' }}>
                  <span>Фильтр активен · найдено {filteredPlCycles.length}</span>
                  <button onClick={resetAllFilters} style={{ padding: '4px 10px', borderRadius: 8, fontSize: 10, fontWeight: 700, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)', color: '#fff', cursor: 'pointer' }}>↺ Сбросить фильтры</button>
                </div>
              )}
              <PopupSelect label="Выбор цикла из каталога" value={selectedCycleId} onChange={setSelectedCycleId} hint="Полный каталог силовых циклов, блоков и встроенных программ. Нажмите, чтобы открыть." options={filteredPlCycles.map(c => ({ id: c.meta.id, label: c.meta.title, desc: `${directionLabelRu(c.meta.direction)} · ${periodLabelRu(c.meta.period)} · ${c.meta.level} · ${c.meta.weeks} нед` }))} />
              {(() => { const c = getCycleById(selectedCycleId); if (!c) return null; return <ExpandableCard title={c.meta.title} icon="📖" short={<><b>Кратко:</b> {c.meta.description}</>} full={<><div style={{ marginBottom: 8 }}><b>Как работает цикл:</b> {c.meta.howItWorks}</div>{c.meta.conditions.length > 0 && <div><b>Условия применения:</b><ul style={{ margin: '4px 0 0 16px', padding: 0 }}>{c.meta.conditions.map((cond, i) => <li key={i} style={{ marginBottom: 3 }}>{cond}</li>)}</ul></div>}</>} />; })()}
            </>
          )}
          {/* 🏁 Компактный статус соревнований + переход в мастерскую тапера (отдельная вкладка) */}
          <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 12, background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.18)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#f59e0b' }}>
              🏁 Соревнования сезона ({meetList.length}){taperNote ? ` · 📉 тапер в плане (+${taperWeeksToAdd} нед)` : ''}{mockMeetOn ? ' · 🎯 mock' : ''}{meetWeekOn ? ' · 🏁 старт' : ''}{postMeetOn ? ' · 🔄 пост' : ''}
            </div>
            <button
              onClick={() => setSubView('competition')}
              style={{ ...BTN_GHOST, minHeight: 36, fontSize: 10, border: '1px solid rgba(245,158,11,0.4)', color: '#f59e0b', background: 'rgba(245,158,11,0.1)' }}
              title="Открыть мастерскую тапера: сезон, параметры, тренер, генерация тапер-плана"
            >⚙️ Открыть мастерскую тапера →</button>
          </div>
          <PLPlanView api={{
            builtSrc: builtSrc!,
            setBuiltSrc: p => setBuiltSrc(p),
            srcWeek, setSrcWeek, srcEdits, setSrcEdits, srcAdditions, setSrcAdditions,
            editMode, setEditMode, setKey, effSet, dayKey, addExToDay,
            pickerDay, setPickerDay, pickerGroup, setPickerGroup, pickerExName, setPickerExName,
            pickerScheme, setPickerScheme, days, calendarView, setCalendarView,
            bridgeSessions, setBridgeWeek, bridgeWeek,
            onNote: setMethodNote,
            buildSrc: () => buildSrc(),
            selectedCycleId, cycleWeeks, goal, level, peds, pedDoses, pedAuto, courseIntensity,
            autoRegMode, setAutoRegMode, autoRegResult, bridgeRir, pmSquat, pmBench, pmDead,
            pmAutoRegMode, setPmAutoRegMode, pmDiary,
            best: ranked[0] as never,
            plWeakPoints,
            linked, runFocus, diaryAutoreg, calibratePmFromDiary, applyPmFromCycle,
            e1rmSeries, exerciseE1rm, exTrendSeries, playerDays, selectedTrendEx, setSelectedTrendEx,
            tempoStr, getTempo, methodHints,
          }} />
          {plSeasonMode === 'season' && (
            <div role="status" style={{ marginTop: 10, padding: '8px 12px', borderRadius: 10, background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.2)', fontSize: 11, color: '#c4b5fd', lineHeight: 1.5 }}>
              {seasonNotes.length > 0 ? (
                <>
                  <div style={{ fontWeight: 800, marginBottom: 4 }}>🧩 Сезон по микроциклам</div>
                  {seasonSegments.length > 0 && (
                    <div style={{ display: 'grid', gap: 4, marginBottom: 6 }}>
                      {seasonSegments.map((s, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <span style={{ color: 'rgba(196,181,253,0.85)' }}>{s.periodLabel ? `${s.periodLabel}: ` : ''}{s.cycleTitle} · {s.weeks} нед</span>
                          {s.fitMode === 'shrink' && <span style={{ color: '#fb923c', fontWeight: 700, fontSize: 10 }}>⬇ сжат {s.cycleWeeks}→{s.weeks}</span>}
                          {s.fitMode === 'extend' && <span style={{ color: '#60a5fa', fontWeight: 700, fontSize: 10 }}>⬆ растянут</span>}
                          {s.fitMode === 'skip' && <span style={{ color: '#f59e0b', fontWeight: 700, fontSize: 10 }}>только старт</span>}
                        </div>
                      ))}
                    </div>
                  )}
                  {seasonNotes.slice(0, 8).map((n, i) => <div key={i} style={{ color: 'rgba(196,181,253,0.6)', fontSize: 10 }}>{n}</div>)}
                </>
              ) : (
                <>
                  🧩 Сезон по микроциклам активен, но сезон ещё не собран — выберите циклы/периоды и нажмите «🧩 Собрать сезон» на вкладке «Сезон». Здесь будет итоговый план (включая пик/тапер под соревнования).
                  <button style={{ ...BTN_GHOST, minHeight: 32, fontSize: 10, marginLeft: 6, border: '1px solid rgba(168,85,247,0.4)', color: '#c4b5fd' }} onClick={() => setSubView('season')}>→ 🧩 Сезон</button>
                </>
              )}
            </div>
          )}
          <div style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between', gap: 4, flexWrap: 'wrap' }}>
            <button style={{ ...BTN_GHOST, minHeight: 36, fontSize: 10 }} onClick={() => setSubView('diagnostics')}>← 2 Слабые точки + 10 калькуляторов</button>
            <button style={{ ...BTN_GHOST, minHeight: 36, fontSize: 10 }} onClick={() => setSubView('charts')}>4 Графики →</button>
          </div>
        </div>
      )}

      {mainTab === 'pl' && subView === 'charts' && (
        <div style={{ minWidth: 0, maxWidth: '100%' }}>
          <div style={H}>4 📊 Графики</div>
          {builtSrc && builtSrc.weeks.length > 0 && (() => {
            const W = builtSrc.weeks;
            const weekData = W.map(wk => ({
              week: wk.week,
              sets: wk.days.reduce((s, d) => s + d.exercises.reduce((ss, e) => ss + (e.workSets || []).reduce((s2, ws) => s2 + (ws.sets || 0), 0), 0), 0),
              tonnage: wk.days.reduce((s, d) => s + (d.metrics?.tonnage || 0), 0),
            }));
            const maxT = Math.max(1, ...weekData.map(w => w.tonnage));
            return (
              <div style={{ marginTop: 8, padding: '10px 12px', borderRadius: 12, background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.15)' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#fb7185', marginBottom: 6 }}>🔥 Объём по неделям (heatmap)</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(34px, 1fr))', gap: 4 }}>
                  {weekData.map(w => {
                    const intensity = w.tonnage / maxT;
                    const bg = intensity > 0.85 ? '#ef4444' : intensity > 0.6 ? '#f59e0b' : intensity > 0.35 ? '#eab308' : intensity > 0.15 ? '#22c55e' : '#14532d';
                    return (
                      <div key={w.week} title={`Неделя ${w.week}: ${w.sets} сетов · ${Math.round(w.tonnage).toLocaleString('ru-RU')} кг`} style={{ textAlign: 'center', padding: '6px 2px', borderRadius: 6, background: bg, color: intensity > 0.6 ? '#000' : '#fff', fontSize: 10, fontWeight: 800, cursor: 'default' }}>{w.week}</div>
                    );
                  })}
                </div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', marginTop: 6 }}>Цвет = относительный тонаж недели (зелёный → красный). Наведите на ячейку для сетов/кг. Светло-зелёные — разгрузки/тапер.</div>
              </div>
            );
          })()}
          <TrainingMetricsChart lms={lmsChart} bb={undefined} />
          {/* 📈 Тренды e1RM из дневника (план: шаг 4 — графики) */}
          <div style={{ marginTop: 8, padding: '10px 12px', borderRadius: 12, background: 'rgba(96,165,250,0.04)', border: '1px solid rgba(96,165,250,0.15)' }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#60a5fa', marginBottom: 6 }}>📈 Тренды e1RM (из дневника тренировок)</div>
            {e1rmSeries.length === 0 ? (
              <div style={{ fontSize: 11, color: '#fff' }}>Нет данных дневника — выполняйте тренировки, и здесь появятся графики приседа/жима/тяги.</div>
            ) : (
              <div style={{ marginBottom: 8 }}>
                {e1rmSeries.map(s => {
                  const W = 100, H = 34;
                  const pts = s.pts.map(p => p.val);
                  const min = Math.min(...pts), max = Math.max(...pts);
                  const range = Math.max(1, max - min);
                  const px = (i: number) => (i / Math.max(1, pts.length - 1)) * W;
                  const py = (v: number) => H - 3 - ((v - min) / range) * (H - 6);
                  const trend = pts.length >= 2 ? ((pts[pts.length - 1] - pts[0]) / Math.max(1, pts[0]) * 100) : 0;
                  const dirColor = trend <= -5 ? '#ef4444' : trend <= 1 ? '#eab308' : '#22c55e';
                  return (
                    <div key={s.lift} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: s.color, width: 84, flexShrink: 0 }}>{s.label} {pts[pts.length - 1]} кг</div>
                      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ flex: 1, maxWidth: 180 }}>
                        <polyline points={s.pts.map((p, i) => `${px(i)},${py(p.val)}`).join(' ')} fill="none" stroke={s.color} strokeWidth={1.6} />
                        {s.pts.map((p, i) => <circle key={i} cx={px(i)} cy={py(p.val)} r={2} fill={s.color} />)}
                      </svg>
                      <span style={{ fontSize: 10, fontWeight: 700, color: dirColor, flexShrink: 0 }}>{trend > 0 ? '▲' : trend < 0 ? '▼' : '→'} {Math.abs(trend).toFixed(1)}%</span>
                    </div>
                  );
                })}
              </div>
            )}
            {exerciseE1rm.length > 0 && (
              <>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#fff', marginBottom: 4 }}>Тренд по упражнению:</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
                  {exerciseE1rm.slice(0, 15).map(e => (
                    <button key={e.name} onClick={() => setSelectedTrendEx(selectedTrendEx === e.name ? null : e.name)} style={{
                      padding: '4px 9px', borderRadius: 14, cursor: 'pointer', fontWeight: 600, fontSize: 10,
                      border: selectedTrendEx === e.name ? '1px solid var(--accent)' : '1px solid rgba(255,255,255,0.1)',
                      background: selectedTrendEx === e.name ? 'var(--accent-dim)' : 'rgba(255,255,255,0.03)',
                      color: selectedTrendEx === e.name ? 'var(--accent)' : '#fff',
                    }}>{e.name} · {e.e1} кг</button>
                  ))}
                </div>
                {selectedTrendEx && (() => {
                  if (exTrendSeries.length < 2) {
                    return <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>нужно ≥2 тренировок с «{selectedTrendEx}» для графика (найдено {exTrendSeries.length})</div>;
                  }
                  const vals = exTrendSeries.map(p => p.e1);
                  const W = 100, H = 40;
                  const min = Math.min(...vals), max = Math.max(...vals);
                  const range = Math.max(1, max - min);
                  const px = (i: number) => (i / Math.max(1, vals.length - 1)) * W;
                  const py = (v: number) => H - 3 - ((v - min) / range) * (H - 6);
                  return (
                    <div>
                      <div style={{ fontSize: 10, color: 'var(--accent)', fontWeight: 700, marginBottom: 2 }}>{selectedTrendEx} · посл: {vals[vals.length - 1]} кг</div>
                      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ maxWidth: 200 }}>
                        <polyline points={exTrendSeries.map((p, i) => `${px(i)},${py(p.e1)}`).join(' ')} fill="none" stroke="var(--accent)" strokeWidth={1.8} />
                        {exTrendSeries.map((p, i) => <circle key={i} cx={px(i)} cy={py(p.e1)} r={2.5} fill="var(--accent)" />)}
                      </svg>
                    </div>
                  );
                })()}
              </>
            )}
          </div>
          <div style={{ marginTop: 8 }}><ProMetricsPanel /></div>
          <div style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between', gap: 4, flexWrap: 'wrap' }}>
            <button style={{ ...BTN_GHOST, minHeight: 36, fontSize: 10 }} onClick={() => setSubView('plan')}>← 3 План</button>
            <button style={{ ...BTN_GHOST, minHeight: 36, fontSize: 10 }} onClick={() => setSubView('reference')}>5 Справка и отчёты →</button>
          </div>
        </div>
      )}

      {mainTab === 'pl' && subView === 'reference' && (
        <div style={{ minWidth: 0, maxWidth: '100%' }}>
          <div style={H}>5 📚 Справка и отчёты</div>
          {builtSrc && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
              <button
                onClick={() => {
                  try {
                    const cycle = getCycleById(selectedCycleId);
                    const scope = plSeasonMode === 'season'
                      ? `Сезон по микроциклам · ${seasonSegments.map(s => s.cycleTitle).join(' → ')}`
                      : (cycle ? `${cycle.meta.title} · ${cycle.meta.level} · ${cycle.meta.weeks} нед` : 'Силовой цикл ПЛ');
                    const html = buildPLPrintHtml('Силовой цикл ПЛ', scope, builtSrc!.weeks, {
                      summary: plPrintSummary(),
                    });
                    printPLHtml(html, { title: 'ПЛ-план', text: 'Печать / PDF плана силового цикла' });
                  } catch (e) { setMethodNote('⚠ Ошибка печати: ' + (e as Error).message); }
                }}
                style={{ ...BTN_GHOST, minHeight: 36, fontSize: 11, border: '1px solid rgba(0,230,138,0.3)', color: '#00e68a' }}
              >🖨 Печать / PDF</button>
              <button
                onClick={() => {
                  try {
                    const wb = buildPLExcelWorkbook('Силовой цикл ПЛ', plExportRows(builtSrc!.weeks), plPrintSummary());
                    downloadPLExcel(wb, 'pl-plan.xlsx');
                  } catch (e) { setMethodNote('⚠ Ошибка экспорта: ' + (e as Error).message); }
                }}
                style={{ ...BTN_GHOST, minHeight: 36, fontSize: 11, border: '1px solid rgba(96,165,250,0.3)', color: '#60a5fa' }}
              >📥 Excel (.xlsx)</button>
            </div>
          )}
           {(() => { const c = getCycleById(selectedCycleId); if (!c) return null; return <ExpandableCard title={c.meta.title} icon="📖" short={<><b>Кратко:</b> {c.meta.description}</>} full={<><div style={{ marginBottom: 8 }}><b>Как работает цикл:</b> {c.meta.howItWorks}</div>{c.meta.conditions.length > 0 && <div><b>Условия применения:</b><ul style={{ margin: '4px 0 0 16px', padding: 0 }}>{c.meta.conditions.map((cond, i) => <li key={i} style={{ marginBottom: 3 }}>{cond}</li>)}</ul></div>}</>} />; })()}
           <div style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between', gap: 4, flexWrap: 'wrap' }}>
            <button style={{ ...BTN_GHOST, minHeight: 36, fontSize: 10 }} onClick={() => setSubView('charts')}>← 4 Графики</button>
            <button style={{ ...BTN_GHOST, minHeight: 36, fontSize: 10 }} onClick={() => setSubView('competition')}>🏁 Соревнования →</button>
          </div>
        </div>
      )}

      {/* 🔧 Корректор движений — единый готовый инструмент 9 лифтов + видео (вместо легаси 4 слоя) */}
      {mainTab === 'pl' && subView === 'diagnostics' && (
        <div style={{ minWidth: 0, maxWidth: '100%' }}>
          <LiftMasterCard dayCount={getCycleById(selectedCycleId)?.week1?.length || 3} template={getCycleById(selectedCycleId) ?? null} sessions={diarySessions} />
          <div style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between', gap: 4, flexWrap: 'wrap' }}>
            <button style={{ ...BTN_GHOST, minHeight: 36, fontSize: 10 }} onClick={() => setSubView('settings')}>← 1 Настройки</button>
            <button style={{ ...BTN_GHOST, minHeight: 36, fontSize: 10 }} onClick={() => setSubView('plan')}>3 План →</button>
          </div>
        </div>
      )}

      {mainTab === 'bb' && subView === 'plan' && (
        <div>
          {renderMacroEditBanner()}
          <div style={H}>💪 Авто-подбор бодибилдинг-сплита</div>
           <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
             <PopupSelect label="Уровень спортсмена" value={bbLevel} onChange={setBbLevel} options={[['beginner','Новичок'],['intermediate','Средний'],['advanced','Опытный'],['enhanced','Enhanced (на курсе)']].map(([id,label]) => ({ id, label }))} />
             <PopupSelect label="Цель" value={bbGoal} onChange={setBbGoal} options={[['mass','Мышечная масса'],['cut','Сушка'],['recomp','Рекомпозиция'],['maintenance','Поддержание'],['strength_mass','Сила + Масса']].map(([id,label]) => ({ id, label }))} />
             <PopupNumber label="Дней в неделю" value={bbDays} min={3} max={6} onChange={v => setBbDays(v)} />
             <PopupNumber label="Недель мезоцикла" value={bbWeeks} min={4} max={24} suffix=" нед" onChange={v => setBbWeeks(v)} />
             <PopupSelect label="Цель по объёму" value={bbVolGoal} onChange={setBbVolGoal} options={[['mev','Минимум (MEV)'],['mav','Оптимум (MAV)'],['mrv','Максимум (MRV)']].map(([id,label]) => ({ id, label }))} />
              <PopupSelect label="Группа фокуса" value={bbFocus} onChange={setBbFocus} options={[{ id: '', label: 'Нет' }, ...WEAK_GROUPS.map(([id,l]) => ({ id, label: l }))]} />
              <PopupSelect label="Training focus (RIR)" value={bbTrainingFocus} onChange={(v) => setBbTrainingFocus(v as 'strength' | 'hypertrophy' | 'endurance')} options={[['strength','Сила (RIR 1-2)'],['hypertrophy','Гипертрофия (RIR 2-3)'],['endurance','Выносливость (RIR 3-4)']].map(([id,label]) => ({ id, label }))} />
           </div>

          {bbBest && <ExpandableCard title={'🏆 Рекомендован: ' + bbBest.pattern.name} icon='🏆' short={bbBest.pattern.description} full={<><div style={{ marginBottom: 8 }}><b>Почему этот сплит:</b> {explainBBSelection(bbBest)}</div><button onClick={buildBb} style={{ width: '100%', padding: 10, borderRadius: 8, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,var(--accent),#00c853)', color: '#000', fontWeight: 700, fontSize: 12 }}>✅ Применить сплит и собрать план</button></>} />}
           <div style={H}>💉 Фармакология (PED-адаптация объёмов)</div>
           <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
             {(['AAS','insulin','MGF','IGF1','GH'] as PED[]).map(p => <button key={p} style={peds.includes(p) ? BTN : BTN_GHOST} onClick={() => togglePed(p)}>{p}{peds.includes(p) ? ' ✓' : ''}</button>)}
             <button onClick={() => setPedAuto(a => !a)} style={{ padding:'4px 10px', borderRadius:6, fontSize:10, fontWeight:700, cursor:'pointer', border:'none', background: pedAuto ? '#00e68a' : 'rgba(255,255,255,0.1)', color: pedAuto ? '#000' : '#fff', marginLeft: 'auto' }}>АВТО {pedAuto ? 'ON' : 'OFF'}</button>
           </div>
           {pedAuto && peds.length > 0 && <div style={{ marginTop:6, fontSize:10, color:'#fff' }}>⚡ Авто-прогрессия ПМ: {courseIntensity === 'heavy' ? 'Тяжёлая' : courseIntensity === 'moderate' ? 'Умеренная' : 'Лёгкая'} → {courseIntensity === 'heavy' ? '+2.5%' : courseIntensity === 'moderate' ? '+2%' : '+1.5%'}/нед</div>}
           {!pedAuto && peds.length > 0 && <div style={{ marginTop:6, fontSize:10, color:'#fff' }}>⏸ Авто-прогрессия выключена → базовая progression цикла</div>}
           <PedAdaptationCard adaptation={pedAdapt} />
          <div style={{ ...H, marginTop: 10 }}>💪 Рабочие максимумы (кг) — для расчёта весов</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 6, boxSizing: 'border-box' }}>
            {BB_WM_KEYS.map(k => <PopupNumber key={k} label={BB_WM_RU[k]} value={bbWorkMax[k] || 80} min={10} max={400} suffix=' кг' onChange={v => setBbWm(k, v)} />)}
          </div>
          <div style={{ marginTop: 8, fontSize: 11, fontWeight: 700, color: ACCENT }}>🎯 Слабые группы мышц (ББ-акцент, сохраняются в профиль)</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2, marginBottom: 4 }}>
            💪 ББ: pump-finisher (3×15 @ RIR 4) для каждой слабой группы; +accessoryCompound-первым.
          </div>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 4, marginBottom: 6, minWidth: 0, maxWidth: '100%' }}>{WEAK_GROUPS.map(([id, l]) => { const on = weakPoints.includes(id); return <button key={id} onClick={() => toggleWeak(id)} style={{ padding: "5px 10px", borderRadius: 14, fontSize: 11, fontWeight: 700, cursor: "pointer", border: on ? "1px solid var(--accent)" : "1px solid rgba(255,255,255,0.08)", background: on ? "rgba(0,230,138,0.15)" : "rgba(255,255,255,0.02)", color: on ? "var(--accent)" : '#fff', minWidth: 0, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l}{on ? " ✓" : ""}</button>; })}</div>
          <button style={{ ...BTN, width: '100%', marginTop: 10 }} onClick={buildBb}>Сгенерировать BB-план ({bbWeeks} нед)</button>
          {builtBb && Array.isArray(builtBb.weeks) && builtBb.weeks.length > 0 && (() => {
            const W = builtBb.weeks;
            const wk = W[Math.min(bbWeekSel, W.length) - 1] || W[0];
            const m = calcBBPlanMetrics(builtBb, pedAdapt.combinedMrvMultiplier);
            return <div style={{ ...CARD, borderLeft: `3px solid ${ACCENT}`, boxShadow: '0 0 0 1px var(--accent-dim)' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', gap:8 }}>
                <div style={{ ...H, margin:0 }}>📋 План: {builtBb.pattern.name}</div>
                <span style={{ fontSize:10, fontWeight:700, color: ACCENT, background:'rgba(0,230,138,0.12)', padding:'3px 8px', borderRadius:8 }}>{W.length} нед</span>
              </div>
              {/* P12 auto-reg toggle + shouldTrainToday для BB — 3 режима */}
              {(() => {
                 const stt = shouldTrainToday({ readiness: linked.readiness?.recovery ?? 80, acwr: autoRegResult.deload ? { ratio: 1.8, zone: 'dangerous' } : { ratio: 1.0, zone: 'optimal' }, fatigue: linked.readiness?.fatigue ?? 30, hrvRatio: linked.profile?.settings?.baselineHrvRatio ?? 1.0, combinedRirShift: autoRegMode === 'auto' ? autoRegResult.rirShift + bridgeRir : bridgeRir });
                const modeColor = autoRegMode === 'auto' ? '#60a5fa' : autoRegMode === 'diary' ? '#22c55e' : '#71717a';
                const segBtn = (m: AutoRegMode, label: string) => (
                  <button onClick={() => setAutoRegMode(m)} style={{ padding:'4px 8px', borderRadius:5, fontSize:10, fontWeight:700, cursor:'pointer', border:'none', background: autoRegMode === m ? modeColor : 'rgba(255,255,255,0.08)', color: autoRegMode === m ? '#000' : '#fff' }}>{label}</button>
                );
                return (
                  <div style={{ marginTop: 6, padding: '8px 10px', borderRadius: 10, background: autoRegMode === 'off' ? 'rgba(255,255,255,0.02)' : autoRegResult.deload ? 'rgba(239,68,68,0.08)' : autoRegMode === 'diary' ? 'rgba(34,197,94,0.06)' : 'rgba(96,165,250,0.06)', border: '1px solid ' + (autoRegMode === 'off' ? 'rgba(255,255,255,0.06)' : autoRegResult.deload ? 'rgba(239,68,68,0.25)' : autoRegMode === 'diary' ? 'rgba(34,197,94,0.2)' : 'rgba(96,165,250,0.2)') }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
                      <div>
                        <span style={{ fontSize: 11, fontWeight: 700, color: stt.train ? (autoRegResult.deload && autoRegMode !== 'off' ? '#ef4444' : modeColor) : '#ef4444' }}>
                          {stt.train ? '✅' : '⚠️'} {stt.reason}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: 3 }}>{segBtn('off', 'ВЫКЛ')}{segBtn('auto', 'АВТО')}{segBtn('diary', 'ДНЕВНИК')}</div>
                    </div>
                    {autoRegMode === 'auto' && (
                      <div style={{ marginTop: 6, fontSize: 10, color: '#fff' }}>
                        <div>Топ-сет ×{autoRegResult.topSetPctMultiplier} · объём ×{autoRegResult.volumeMultiplier} · RIR +{autoRegResult.rirShift}{autoRegResult.deload ? ' · 🔴 DELOAD' : ''}</div>
                        {autoRegResult.decisions.slice(0, 3).map((d, i) => <div key={i} style={{ marginTop: 2, color: '#fff' }}>• {d}</div>)}
                      </div>
                    )}
                    {autoRegMode === 'diary' && diaryAutoreg && (
                      <div style={{ marginTop: 6, fontSize: 10, color: '#fff' }}>
                        <div style={{ fontWeight: 700, color: '#22c55e' }}>✓ {diaryAutoreg.summary.adjusted} скорректировано · {diaryAutoreg.summary.unchanged} в норме · {diaryAutoreg.summary.noData} без данных</div>
                        {diaryAutoreg.summary.noData > 0 && <div style={{ marginTop: 2, color: '#f59e0b' }}>⚠ {diaryAutoreg.summary.noData} упражнений без данных — плановые веса</div>}
                        {diaryAutoreg.plateauWarnings.slice(0, 2).map((w, i) => <div key={'pw'+i} style={{ marginTop: 2, color: '#ef4444' }}>🔴 {w}</div>)}
                      </div>
                    )}
                    {autoRegMode === 'diary' && !diaryAutoreg && <div style={{ marginTop: 6, fontSize: 10, color: '#f59e0b' }}>⚠ Постройте план — дневниковая авторегуляция применится к весам.</div>}
                  </div>
                );
              })()}
              {(() => { const srpe = loadSRPESessions(); if (srpe.length < 2) return null; const acwr = acuteChronicRatio(toDailyLoads(srpe)); if (acwr.ratio <= 1.5) return null; const srpeList = loadSRPESessions(); const loads = toDailyLoads(srpeList); const ratio = acuteChronicRatio(loads); return <div style={{ marginTop: 6, padding: 8, borderRadius: 8, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}><div style={{ color: '#ef4444', fontSize: 10, fontWeight: 600, marginBottom: 6 }}>🚨 ACWR {ratio.ratio.toFixed(2)} — опасная зона. Рекомендуется разгрузка.</div><DeloadProtocolCard ctx={{ acwr: ratio.ratio, weeksSinceDeload: 0, fatigue: 6, recovery: 50, hasCompetitionSoon: false, jointPain: false, cnsFatigue: false, goal: 'hypertrophy' }} /></div>; })()}
              {builtBb.rationale.map((r, i) => <div key={i} style={{ ...SMALL, marginTop: 4 }}>{r}</div>)}
              {/* Выбор недели */}
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize:11, color:'#fff', marginBottom:6, fontWeight:700 }}>Неделя {wk.week} из {W.length}{(wk as any).peakWeek ? ' · 🎭 пик-неделя' : ''}</div>
                {(wk as any).peakWeek && (
                  <div style={{ marginBottom: 6, padding: '8px 10px', borderRadius: 8, background: 'rgba(236,72,153,0.08)', border: '1px solid rgba(236,72,153,0.3)', fontSize: 10, color: '#fff', lineHeight: 1.5 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
                      <span>🎭 <b style={{ color: '#ec4899' }}>Пик-неделя (тапер ББ)</b>{(builtBb as any)?.contestPrep?.showDate ? ` · шоу ${(builtBb as any).contestPrep.showDate}` : ''}</span>
                      {(() => {
                        try {
                          const goals = (linked.profile?.settings as any)?.goals;
                          const rawCfg = goals?.bbPeakConfig;
                          const prepCfg = rawCfg ? deserializeBBPrepConfig(rawCfg) : legacyConfigFromProfile(goals, linked.profile?.settings?.personal);
                          if (!prepCfg) return null;
                          const days = buildBBContestPrep(prepCfg).peakWeek;
                          return (
                            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }} title="Фазы пик-недели: деплеция → загрузка → пик → шоу">
                              {days.map(d => (
                                <span key={d.day} title={`D-${7 - d.day}: ${PHASE_LABELS_RU[d.phase]}`} style={{
                                  width: 12, height: 12, borderRadius: 4,
                                  background: PEAK_PHASE_COLORS[d.phase],
                                  boxShadow: d.day === 7 ? `0 0 8px ${PEAK_PHASE_COLORS[d.phase]}` : 'none',
                                  opacity: 0.9,
                                }} />
                              ))}
                            </div>
                          );
                        } catch { return null; }
                      })()}
                    </div>
                    {(wk as any).prepProtocol ? <div style={{ color: '#fff' }}>{(wk as any).prepProtocol}</div> : null}
                    <div style={{ color: '#fff' }}>День 1–2: памп-деплеция (верх/низ) · день 3: лёгкий full-body · далее отдых и позы. Питание по дням (карбс/вода/натрий) — блок «Питание → 🏁 Тапер ББ».</div>
                  </div>
                )}
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(36px, 1fr))', gap:4 }}>
                  {W.map(w => { const active = w.week === wk.week; const isPeak = (w as any).peakWeek === true; return <button key={w.week} onClick={() => setBbWeekSel(w.week)} title={isPeak ? ((w as any).prepProtocol || 'Пик-неделя') : `Неделя ${w.week}`} style={{ padding:'7px 0', borderRadius:7, border: active ? '1px solid var(--accent)' : '1px solid rgba(255,255,255,0.08)', background: active ? 'linear-gradient(135deg,var(--accent),#00c853)' : isPeak ? 'rgba(236,72,153,0.15)' : 'rgba(255,255,255,0.02)', color: active ? '#000' : '#fff', fontSize:10, fontWeight:700, cursor:'pointer' }}>{isPeak ? '🎭' : ''}{w.week}</button>; })}
                </div>
              </div>
              {/* Визуальный календарь ББ: недели × дни (объём по сетам) */}
              <div style={{ marginTop: 8, padding: 8, borderRadius: 10, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#fff', marginBottom: 6 }}>📅 Календарь мезоцикла (нед × дни, объём сетов)</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {W.map(w => { const active = w.week === wk.week; const daySets = w.sessions.map(s => s.exercises.reduce((ss, e) => ss + e.sets, 0)); const maxD = Math.max(1, ...W.flatMap(ww => ww.sessions.map(s => s.exercises.reduce((ss, e) => ss + e.sets, 0)))); return (
                    <div key={w.week} onClick={() => setBbWeekSel(w.week)} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 6px', borderRadius: 6, cursor: 'pointer', background: active ? 'var(--accent-dim)' : 'transparent', border: active ? '1px solid rgba(0,230,138,0.3)' : '1px solid transparent' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: active ? 'var(--accent)' : '#fff', minWidth: 26 }}>Н{w.week}</span>
                      <div style={{ flex: 1, display: 'flex', gap: 2 }}>
                        {daySets.map((ds, di) => <div key={di} title={'Д' + (di+1) + ': ' + ds + ' сетов'} style={{ flex: 1, height: 14, borderRadius: 3, background: ds > 0 ? 'linear-gradient(180deg,var(--accent),#00c853)' : 'rgba(255,255,255,0.04)', opacity: 0.35 + 0.65 * (ds / maxD) }} />)}
                      </div>
                      <span style={{ fontSize: 11, color: '#fff', minWidth: 30, textAlign: 'right' }}>{daySets.reduce((a, b) => a + b, 0)}</span>
                    </div>
                  ); })}
                </div>
              </div>
              {/* Дни выбранной недели — таблицы-карточки */}
              <div style={{ marginTop: 10, display:'flex', flexDirection:'column', gap: 8 }}>
                {wk.sessions.map((s, si) => (
                  <div key={si} style={{ background:'rgba(255,255,255,0.02)', borderRadius:10, border:'1px solid rgba(255,255,255,0.06)', overflow:'hidden' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 10px', background:'var(--accent-dim)', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
                      <span style={{ fontSize:12, fontWeight:700, color:'#fff' }}>🏋️ День {si + 1} · {s.character}{(s as any).peakWeekTraining ? ' · 🎭 памп' : ''}{(s as any).peakWeekRest ? ' · 😴 отдых' : ''}</span>
                      <span style={{ fontSize:10, color:ACCENT, fontWeight:700 }}>{s.sessionTag}</span>
                    </div>
                    {s.exercises.length === 0 ? (
                      <div style={{ padding: '10px 12px', fontSize: 10, color: '#fff', lineHeight: 1.5 }}>
                        😴 Полный отдых — позирование {(s as any).peakWeekRest ? '60 мин' : '—'}, растяжка, сон 8–9 ч.{(s as any).comment ? ` ${(s as any).comment}` : ''}
                      </div>
                    ) : (
                    <div style={{ padding: '4px 0', overflowX:'auto', WebkitOverflowScrolling:'touch', scrollbarWidth:'none' }}>
                      <div style={{ display:'grid', gridTemplateColumns:'minmax(0,1.4fr) minmax(0,0.7fr) minmax(0,0.6fr) minmax(0,0.6fr) minmax(0,0.6fr) minmax(0,0.6fr)', gap:2, padding:'4px 10px', fontSize:10, fontWeight:700, color:'rgba(255,255,255,0.4)', textTransform:'uppercase' }}>
                        <span>Мышца</span><span>Характер</span><span>Сеты×повт</span><span>RIR</span><span>Вес</span><span>Темп</span>
                      </div>
                      {s.exercises.map((e, ei) => {
                        const rawW = e.workSets[0].weight;
                        let adjW = rawW; let adjSets0 = e.sets; let diaryRirAdd = 0;
                        if (autoRegMode === 'auto' && autoRegResult) { adjW = Math.round(rawW * autoRegResult.topSetPctMultiplier * 10) / 10; adjSets0 = Math.max(1, Math.round(e.sets * autoRegResult.volumeMultiplier)); }
                        else if (autoRegMode === 'diary' && diaryAutoreg) { const adj = diaryAutoreg.perExercise.get(e.name || e.exerciseName || e.muscle); if (adj) { adjW = adj.adjustedWeight; adjSets0 = adj.adjustedSets; diaryRirAdd = adj.adjustedRir - e.rir; } }
                        const adjSets = Math.max(1, Math.round(adjSets0 * bridgeMult));
                        const tmpo = getTempo(e.muscle, bbGoal, e.character === 'тяж');
                        return (
                        <div key={ei} style={{ display:'grid', gridTemplateColumns:'minmax(0,1.4fr) minmax(0,0.7fr) minmax(0,0.6fr) minmax(0,0.6fr) minmax(0,0.6fr) minmax(0,0.6fr)', gap:2, padding:'5px 10px', fontSize:10, color:'#fff', borderTop:'1px solid rgba(255,255,255,0.04)' }}>
                          <span style={{ fontWeight:600, whiteSpace:'normal', overflowWrap:'anywhere' }}>{e.muscle}</span>
                          <span style={{ color:'#fff' }}>{e.character}</span>
                          <span>{adjSets}×{e.workSets[0].reps}</span>
                          <span style={{ color:'#f59e0b' }}>{peakRirTarget != null ? peakRirTarget : Math.max(0, e.rir + bridgeRir + diaryRirAdd)}{autoRegMode === 'auto' && autoRegResult?.rirShift ? `+${autoRegResult.rirShift}` : ''}</span>
                          <span style={{ color: adjW !== rawW ? '#f59e0b' : ACCENT, fontWeight:700 }}>{adjW} кг{adjW !== rawW ? (autoRegMode === 'diary' ? ' 📒' : ' ⚡') : ''}</span>
                          <span style={{ fontSize:10, color:'#a855f7', fontWeight:700, background:'rgba(168,85,247,0.1)', padding:'2px 6px', borderRadius:4, textAlign:'center' }}>{tempoStr || tmpo.tempo.toString}</span>
                        </div>
                        );
                      })}
                    </div>
                    )}
                  </div>
                ))}
              </div>
              {/* Итоги мезоцикла */}
              <MetricCard title={`Итоги мезоцикла (${W.length} нед)`} icon="📊">
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
                  <div style={{ ...SMALL, background:'var(--accent-dim)', padding:'6px 8px', borderRadius:8 }}>Всего сетов/ротация: <b style={{ color:'#fff' }}>{m.totalSets}</b></div>
                  <div style={{ ...SMALL, background:'var(--accent-dim)', padding:'6px 8px', borderRadius:8 }}>Тяжёлых: <b style={{ color:'#fff' }}>{(m.тяжPct * 100).toFixed(0)}%</b></div>
                  <div style={{ ...SMALL, background:'var(--accent-dim)', padding:'6px 8px', borderRadius:8 }}>Памп: <b style={{ color:'#fff' }}>{(m.пампPct * 100).toFixed(0)}%</b></div>
                  <div style={{ ...SMALL, background:'var(--accent-dim)', padding:'6px 8px', borderRadius:8 }}>Средний RIR: <b style={{ color:'#fff' }}>{m.avgRir.toFixed(1)}</b></div>
                </div>
              </MetricCard>
              {/* Объём по мышцам */}
              <MetricCard title="Объём по мышцам (сетов/нед)" icon="🏋️" accent="#a855f7">
              <div style={{ overflowX:'auto', WebkitOverflowScrolling:'touch', scrollbarWidth:'none' }}>
                <div style={{ display:'grid', gridTemplateColumns:'minmax(0,1.4fr) minmax(0,0.5fr) minmax(0,0.5fr) minmax(0,0.5fr) minmax(0,0.5fr)', gap:2, fontSize:10, fontWeight:700, color:'rgba(255,255,255,0.4)', textTransform:'uppercase', padding:'2px 0' }}>
                  <span>Мышца</span><span>Сетов</span><span>Тяж</span><span>Памп</span><span>MRV</span>
                </div>
                {m.perMuscle.map(mm => { const over = mm.totalSets > (mm.mrv || 999); return (
                  <div key={mm.muscle} style={{ display:'grid', gridTemplateColumns:'minmax(0,1.4fr) minmax(0,0.5fr) minmax(0,0.5fr) minmax(0,0.5fr) minmax(0,0.5fr)', gap:2, fontSize:10, color:'#fff', padding:'3px 0', borderTop:'1px solid rgba(255,255,255,0.04)' }}>
                    <span style={{ fontWeight:600 }}>{mm.muscle}{over ? ' ⚠' : ''}</span>
                    <span style={{ color: over ? '#ef4444' : ACCENT, fontWeight:700 }}>{mm.totalSets}</span>
                    <span style={{ color:'#ef4444' }}>{mm.тяжSets}</span>
                    <span style={{ color:'#60a5fa' }}>{mm.пампSets}</span>
                    <span style={{ color:'#fff' }}>{mm.mrv}</span>
                  </div>
                ); })}
              </div>
              </MetricCard>
              {(() => { const wkStats = W.map(w => { const exs = w.sessions.flatMap(s => s.exercises); const sets = exs.reduce((s, e) => s + e.sets, 0); const rir = sets > 0 ? exs.reduce((s, e) => s + e.rir * e.sets, 0) / sets : 0; return { week: w.week, sets, rir }; }); const maxS = Math.max(1, ...wkStats.map(x => x.sets)); const px = (i: number) => 24 + (i / Math.max(1, W.length - 1)) * 280; const py = (v: number) => 60 - (v / 5) * 44; return <div style={{ marginTop: 8, padding: 10, borderRadius: 10, background: 'rgba(168,85,247,0.05)', border: '1px solid rgba(168,85,247,0.15)' }}><div style={{ fontSize: 10, fontWeight: 700, color: '#a855f7', marginBottom: 6 }}>📈 Прогрессия объёма и RIR по неделям</div><svg width='100%' viewBox='0 0 320 70' style={{ maxWidth: 360, margin: '0 auto', display: 'block' }}>{wkStats.map(x => <rect key={'b'+x.week} x={px(x.week-1)-8} y={60 - (x.sets / maxS) * 44} width={16} height={(x.sets / maxS) * 44} rx={3} fill='rgba(0,230,138,0.4)' />)}<polyline points={wkStats.map(x => px(x.week-1) + ',' + py(x.rir)).join(' ')} fill='none' stroke='#a855f7' strokeWidth={1.6} />{wkStats.map(x => <circle key={'r'+x.week} cx={px(x.week-1)} cy={py(x.rir)} r={2} fill='#a855f7' />)}</svg><div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 4 }}><span style={{ fontSize: 11, color: 'rgba(0,230,138,0.8)' }}>▮ Сеты/нед</span><span style={{ fontSize: 11, color: '#a855f7' }}>● RIR</span></div></div>; })()}
              <MesocycleProgressionCard weeks={W.length} startVolumeSets={Math.round(W.reduce((s, w) => s + w.sessions.reduce((ss, sess) => ss + sess.exercises.reduce((sss, e) => sss + e.sets, 0), 0), 0) / W.length)} startIntensityPct={0.7} startRIR={2} goal="hypertrophy" title="Прогрессия мезоцикла (ББ)" />
              <div style={{ ...SMALL, marginTop: 8, padding: 8, background:'rgba(96,165,250,0.06)', borderRadius:8, border:'1px solid rgba(96,165,250,0.15)' }}>{explainBBMetrics(m)}</div>
            </div>;
          })()}
        </div>
      )}

      {/* ── Ручной сбор (перенаправлен в полный конструктор) ── */}
      {mainTab === 'manual' && (
        <div style={{ ...CARD, padding: 20, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🛠️</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--accent)', marginBottom: 8 }}>Ручной конструктор переехал</div>
          <div style={{ fontSize: 11, color: '#fff', marginBottom: 16, lineHeight: 1.6 }}>
            Полный ручной конструктор теперь доступен в разделе <b style={{ color: 'var(--accent)' }}>📐 Планирование → 🛠️ Ручной конструктор</b>.<br />
            Там вас ждёт: авто-подбор сплита, генерация плана, оценка качества, MRV-guardrails,<br />
            применение методик, экспорт в PDF, выполнение через SessionPlayer и многое другое.
          </div>
          <button onClick={() => {
            try { localStorage.setItem('he_training_planning_track', 'manual'); } catch {}
            if (typeof (window as any).__navigateToTrainingTab === 'function') {
              (window as any).__navigateToTrainingTab('programcalc');
            }
          }} style={{
            padding: '12px 24px', borderRadius: 10, border: 'none', cursor: 'pointer',
            background: 'linear-gradient(135deg,var(--accent),#00c853)', color: '#000',
            fontWeight: 800, fontSize: 13,
          }}>
            🚀 Открыть полный конструктор
          </button>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 12 }}>
            Также доступен на вкладке «Ручной конструктор» в разделе Планирование
          </div>
        </div>
      )}

      {subView === 'bridge' && (
        <div style={CARD}>
          <div style={H}>🔗 Мост план→сессия (training-integration)</div>
          {bridgeSessions.length === 0 ? (
            <div style={{ ...SMALL, padding: 12, textAlign: 'center' }}>Постройте план (ПЛ или ББ) — сессии появятся здесь.</div>
          ) : (
            <>
              <div style={{ ...SMALL, marginBottom: 8 }}>Сгенерировано {bridgeSessions.length} сессий · {bridgeWeeks.length} недель</div>
              {/* селектор недель */}
              {bridgeWeeks.length > 1 && (
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#fff', marginBottom: 6 }}>Выберите неделю:</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(36px, 1fr))', gap: 4 }}>
                    {bridgeWeeks.map(w => {
                      const totalW = bridgeWeeks.length;
                      const ph = mesocyclePhaseForWeek(w, Math.max(totalW, w));
                      const active = w === bridgeWeek;
                      const weekSessions = bridgeSessions.filter(s => s.weekNumber === w);
                      const hasMeet = weekSessions.some(s => s.meetWeek);
                      const hasMock = weekSessions.some(s => s.mockMeet);
                      const hasPost = weekSessions.some(s => s.postMeet);
                      const hasTaper = weekSessions.some(s => s.taperWeek && !s.mockMeet && !s.meetWeek && !s.postMeet);
                      const PH_COLOR_B: Record<string,string> = { base: '#22c55e', build: '#eab308', peak: '#ef4444', deload: '#60a5fa' };
                      const PH_RU_B: Record<string,string> = { base: 'База', build: 'Накопление', peak: 'Пик', deload: 'Разгрузка' };
                      const wkColor = hasMeet ? '#eab308' : hasMock ? '#a78bfa' : hasPost ? '#34d399' : hasTaper ? '#f59e0b' : PH_COLOR_B[ph];
                      const wkLabel = hasMeet ? '🏁 Соревнования (прикиды)' : hasMock ? '🎯 Имитация соревнований (mock meet)' : hasPost ? '🔄 Пост-старт (восстановление)' : hasTaper ? '📉 Тапер' : PH_RU_B[ph];
                      return (
                        <button key={w} onClick={() => setBridgeWeek(w)}
                          title={`Неделя ${w}: ${wkLabel}`}
                          style={{
                            padding: '7px 0', borderRadius: 7,
                            border: active ? '1px solid var(--accent)' : '1px solid rgba(255,255,255,0.08)',
                            background: active ? wkColor : (wkColor || '#22c55e') + '1a',
                            color: active ? '#000' : '#fff',
                            fontSize: 10, fontWeight: 700, cursor: 'pointer'
                          }}
                        >{hasMeet ? '🏁' : hasMock ? '🎯' : hasPost ? '🔄' : hasTaper ? '📉' : w}</button>
                      );
                    })}
                  </div>
                </div>
              )}
              {/* сессии выбранной недели */}
              <div style={{ ...SMALL, marginBottom: 6 }}>
                Неделя {bridgeWeek} · {bridgeWeekSessions.length} {bridgeWeekSessions.length === 1 ? 'тренировка' : 'тренировок'}
              </div>
              {bridgeWeekSessions.map((s, i) => (
                <ExpandableCard key={i}
                  title={`${s.focus} · ${s.exercises.length} упр.${s.meetWeek ? ' · 🏁 Соревнования' : s.mockMeet ? ' · 🎯 Mock meet' : s.postMeet ? ' · 🔄 Пост-старт' : s.taperWeek ? ' · 📉 Тапер' : ''}`}
                  icon={s.source === 'SRC' ? '🏋️' : '💪'}
                  short={`${s.totalSets} сетов · ${Math.round(s.totalVolume)} кг·пов${s.planned ? ' · запланировано' : ''}${s.meetWeek ? ' · 🏁 прикиды' : s.mockMeet ? ' · 🎯 прикиды-синглы' : s.postMeet ? ' · 🔄 восстановление' : s.taperWeek ? ' · 📉 разгрузка' : ''}`}
                  full={
                    <div style={{ fontSize: 10, color: '#fff', lineHeight: 1.8 }}>
                      {s.exercises.map((e, ei) => (
                        <div key={ei} style={{
                          marginBottom: 6, padding: '6px 8px', borderRadius: 6,
                          background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)'
                        }}>
                          <div style={{ fontWeight: 700, color: '#fff', marginBottom: 2 }}>
                            {e.exerciseName}
                            <span style={{ fontWeight: 400, color: '#fff', marginLeft: 6 }}>
                              ({e.muscleGroup}) · ПМ {e.best1RM}кг
                            </span>
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                            {e.sets.map((set, si) => (
                              <span key={si} style={{
                                display: 'inline-block', padding: '2px 6px', borderRadius: 4, fontSize: 11,
                                background: 'var(--accent-dim)', border: '1px solid rgba(0,230,138,0.12)',
                                color: '#fff'
                              }}>
                                {set.reps}×{set.weightKg}кг
                                {set.rir > 0 ? ` · RIR ${set.rir}` : ''}
                              </span>
                            ))}
                          </div>
                          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>
                            Объём: {e.totalVolume.toFixed(0)} кг·пов · {e.sets.length} подходов
                            {e.avgRPE > 0 ? ` · ср.RPE ${e.avgRPE.toFixed(1)}` : ''}
                          </div>
                        </div>
                      ))}
                    </div>
                  }
                />
              ))}
              {bridgeAutoreg && (
                <div style={{ marginTop: 8, padding: 8, borderRadius: 8, background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.2)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#60a5fa', marginBottom: 4 }}>🧠 Авторегуляция (мост)</div>
                  <div style={{ fontSize: 10, color: '#fff' }}>
                    {bridgeAutoreg.summary}
                    {bridgeAutoreg.sessionDowngraded && ' · ⬇ понижение нагрузки'}
                    {bridgeAutoreg.sessionCancelled && ' · ⛔ отмена сессии'}
                  </div>
                </div>
              )}
              {progressSnap.length > 0 && (
                <div style={{ marginTop: 8, padding: 8, borderRadius: 8, background: 'rgba(168,85,247,0.06)', border: '1px solid rgba(168,85,247,0.2)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#a855f7', marginBottom: 4 }}>📈 Прогресс (лучшие подходы)</div>
                  {progressSnap.slice(0, 5).map((p, i) => (
                    <div key={i} style={{ fontSize: 10, color: '#fff', marginBottom: 2 }}>{p.exercise}: {p.lastWeight}кг×{p.lastReps} → e1RM {p.estimated1RM.toFixed(1)}кг</div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {subView === 'macro' && mainTab === 'pl' && (
        <div style={{ margin: '0 0 10px', padding: '10px 12px', borderRadius: 12, background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.18)' }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#f59e0b', marginBottom: 8 }}>🏁 Тапер/пик в макроцикле (ПЛ)</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            <PopupSelect label="Раскладка тапера" value={macroTaperMode} onChange={v => setMacroTaperMode(v as TaperMode)} hint="Как снижается объём к старту: классика (Bosquet, разгрузка), ПЛ-пик-протокол (интенсификация к 100%), про-кривая по усталости или Classic WF (перегрузка → суперкомпенсация)" options={(['classic', 'pl', 'pro', 'wf'] as TaperMode[]).map(m => ({ id: m, label: TAPER_MODE_LABELS[m], desc: '' }))} />
            <PopupSelect label="Весовая цель тапера" value={macroWeightGoal} onChange={v => setMacroWeightGoal(v as TaperWeightGoal)} hint="Сгонка к категории режет объём тапера ×0.9 (дефицит → MRV ниже); набор/стабильный — полный объём" options={(['auto', 'lose', 'gain', 'maintain'] as TaperWeightGoal[]).map(g => ({ id: g, label: TAPER_WEIGHT_GOAL_LABELS[g], desc: '' }))} />
            <button
              onClick={() => { try { const r = recommendTaperConfig(buildCoachCtx()); setMacroTaperMode(r.mode); setMacroWeightGoal(r.weightGoal); setMacroMockMeet(r.mockMeet); setMacroPostMeet(r.postMeet); setMethodNote(`🤖 Тренер подобрал тапер макроцикла: ${r.rationale.join(' ')}`); } catch (error) { setMethodNote(`⚠ Ошибка подбора: ${(error as Error).message}`); } }}
              style={{ minHeight: 40, borderRadius: 8, fontSize: 10, fontWeight: 700, cursor: 'pointer', padding: '8px 12px', border: '1px solid rgba(167,139,250,0.4)', color: '#a78bfa', background: 'rgba(139,92,246,0.1)' }}
              title="Подобрать схему/весовую цель тапера макроцикла под усталость, ACWR, вес и план ПМ"
            >🤖 Подобрать</button>
            <button onClick={() => setMacroMockMeet(v => !v)} style={{ ...BTN_GHOST, minHeight: 40, fontSize: 10, border: macroMockMeet ? '1px solid #a78bfa' : '1px solid rgba(255,255,255,0.08)', background: macroMockMeet ? 'rgba(139,92,246,0.15)' : 'rgba(255,255,255,0.02)', color: macroMockMeet ? '#a78bfa' : '#fff' }}>🎯 Mock meet перед стартом{macroMockMeet ? ' ✓' : ''}</button>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
            <button onClick={() => setMacroPostMeet(v => !v)} style={{ ...BTN_GHOST, minHeight: 36, fontSize: 10, flex: 1, minWidth: 180, border: macroPostMeet ? '1px solid #34d399' : '1px solid rgba(255,255,255,0.08)', background: macroPostMeet ? 'rgba(52,211,153,0.12)' : 'rgba(255,255,255,0.02)', color: macroPostMeet ? '#34d399' : '#fff' }}>🔄 Пост-старт восстановление{macroPostMeet ? ' ✓' : ''}</button>
            <span style={{ alignSelf: 'center', fontSize: 10, color: 'rgba(255,255,255,0.45)', flex: 2, minWidth: 200 }}>Применяется при «✓ Применить макроцикл»: тапер к peak-блокам, прикиды на неделях соревнований, mock meet и пост-разгрузка — для КАЖДОГО старта.</span>
          </div>
        </div>
      )}
      {subView === 'macro' && <MacrocyclePanel taperMode={macroTaperMode} level={macroLevel} goal={macroGoal} onLevelChange={setMacroLevel} onGoalChange={setMacroGoal} onApplyMacrocycle={(macro) => {
        try {
          if (mainTab === 'pl') buildSrcMacrocycle(macro as Macrocycle);
          else applyBBMacrocycle(macro as Macrocycle | BBMacrocycle);
        } catch (error) {
          setMethodNote(`⚠ Макроцикл не применён: ${(error as Error).message}`);
          setSubView('plan');
        }
      }} onApplyCycle={(cycleId, weeks) => {
        if (mainTab === 'bb') {
          // ББ-авто: legacy-кнопка блока, применяем сохранённый BB-макроцикл целиком.
          try {
            const raw = localStorage.getItem('he_bb_macro');
            if (raw) {
              const bbMacro = deserializeBbMacro(raw);
              if (bbMacro) { applyBBMacrocycle(bbMacro); return; }
            }
            // Fallback на PL-макроцикл
            const rawPl = localStorage.getItem('he_pl_macro');
            if (!rawPl) { setSubView('plan'); return; }
            const macro = deserializeMacro(rawPl);
            if (!macro) { setSubView('plan'); return; }
            applyBBMacrocycle(macro);
           } catch (error) {
              setMethodNote(`⚠ Макроцикл ББ не применён: ${(error as Error).message}`);
              setSubView('plan');
            }
        } else {
          // ПЛ-авто: загрузить выбранный СРЦ-цикл
          try {
            setSelectedCycleId(cycleId);
            setCycleWeeks(weeks);
            buildSrc(cycleId, weeks);
          } catch (error) {
            setMethodNote(`⚠ Цикл не применён: ${(error as Error).message}`);
          }
          setSubView('plan');
        }
      }} onEditMicrocycle={(cycleId, weeks, phase, isBB, blockIdx) => {
        // MC-5: сохраняем контекст правки блока и открываем конструктор с его данными.
        try {
          localStorage.setItem('he_macro_edit_ctx', JSON.stringify({ isBB, cycleId, weeks, phase, blockIdx }));
        } catch { /* ignore */ }
        if (isBB) {
          // ББ-авто: недели блока уже в параметрах плана.
          setBbWeeks(Math.min(24, Math.max(4, weeks)));
        } else if (cycleId) {
          // ПЛ-авто: предзагружаем цикл блока.
          setSelectedCycleId(cycleId);
          setCycleWeeks(weeks);
        }
        setSubView('plan');
      }} />}
      {subView === 'macro' && <div style={{ marginTop: 8 }}><CardioLinkCard /></div>}
      {mainTab === 'pl' && subView === 'tools' && (
        <div style={{ minWidth: 0, maxWidth: '100%' }}>
          <div style={H}>🔧 Инструменты планирования</div>
          <PlannerToolsPanel mode="pl" />
          <div style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between', gap: 4, flexWrap: 'wrap' }}>
            <button style={{ ...BTN_GHOST, minHeight: 36, fontSize: 10 }} onClick={() => setSubView('macro')}>← 🗓 Годовой план</button>
            <button style={{ ...BTN_GHOST, minHeight: 36, fontSize: 10 }} onClick={() => setSubView('competition')}>🏁 Соревнования →</button>
          </div>
        </div>
      )}
      {subView === 'competition' && <PLCompetitionTab api={{
        builtSrc,
        setBuiltSrc: p => setBuiltSrc(p),
        onNote: setMethodNote,
        cycle: {
          peds, pedDoses, courseIntensity, pedAuto, autoRegMode, autoRegResult,
          plCalorieSurplus, plProteinPerKg, selectedCycleId, pmSquat, pmBench, pmDead,
        },
        coach: {
          buildCtx: buildCoachCtx,
          applyRecommendation: applyTaperRecommendation,
          diarySessions,
        },
        autoRegMode,
        setAutoRegMode: (mode: AutoRegMode) => setAutoRegMode(mode),
      }} />}
      {subView === 'peak_bb' && <PeakingPanel defaultKind="bb" />}
      {subView === 'methods' && (<>
        <MethodsTab linked={linked} trainingOutput={null} diaryStats={[] as any} historyWorkouts={[] as any} goal={mainTab === 'pl' ? goal : bbGoal} level={mainTab === 'pl' ? level : bbLevel} daysPerWeek={mainTab === 'pl' ? days : bbDays} recovery={linked.readiness?.recovery ?? 80} fatigue={linked.readiness?.fatigue ?? 30} appliedMethods={appliedMethods} onToggleMethod={(name, cat) => setAppliedMethods(prev => { const n = { ...prev }; if (n[cat] === name) delete n[cat]; else n[cat] = name; return n; })} onApplyComposition={() => { const keys = Object.keys(appliedMethods); if (keys.length > 0) { const h = deriveHints(appliedMethods); setMethodHints(h); setMethodNote(`✓ Применена методология: ${h.label}${h.volumeMult !== 1 ? ' · объём×' + h.volumeMult : ''}${h.technique ? ' · техн: ' + h.technique : ''}`); } else { setMethodHints({ volumeMult: 1, technique: null, label: '' }); setMethodNote('Выберите методики (по одной из категории)'); } }} />
      </>)}
      {subView === 'analytics' && (<><AnalyticsTab sessions={historyWorkouts} /><VisualTab sessions={historyWorkouts} /></>)}
      {subView === 'prometrics' && <ProMetricsPanel />}
      {subView === 'charts' && <TrainingMetricsChart lms={lmsChart} bb={bbChart} />}
      {/* Модалка подтверждения «Начать заново» */}
      {resetAsk && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.85)', padding: 16 }}
          onClick={() => setResetAsk(false)}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 400, borderRadius: 16, background: '#18181b', border: '1px solid rgba(255,255,255,0.12)', padding: 16, boxSizing: 'border-box', boxShadow: '0 20px 60px rgba(0,0,0,0.6)' }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#fb7185', marginBottom: 8 }}>🔄 Начать заново?</div>
            <div style={{ fontSize: 12, color: '#fff', lineHeight: 1.5, marginBottom: 12 }}>
              Собранный план и все правки будут сброшены. Параметры останутся на месте — можно собрать план заново.
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setResetAsk(false)} style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer', minHeight: 44 }}>Отмена</button>
              <button onClick={resetBuild} style={{ flex: 1, padding: '10px', borderRadius: 10, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#f43f5e,#e11d48)', color: '#fff', fontWeight: 800, fontSize: 12, minHeight: 44 }}>🔄 Сбросить</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SRCBBScreen;
