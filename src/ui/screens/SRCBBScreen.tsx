import React, { useEffect, useMemo, useRef, useState } from 'react';
import { LMS_CYCLES, getCycleById, normalizeCycleDirection } from '../../data/lms-cycles/lms-cycle-index';
import { rankCycles, selectBestCycle, explainSelection, modeMismatchWarning, type LMSSelectorInput } from '../../engines/lms/lms-selector.engine';
import { buildLMSPlan, extractExercises, getPLWeakPointRecommendations, getPLWeakGroupExerciseCandidates, originalCycleWeeks, appendPLTaperWeeks, refreshMeetAttempts, type LMSBuildOutput, type LMSBuildInput } from '../../engines/lms/lms-builder.engine';
import { WEAK_POINTS_BY_LIFT, diagnoseWeakPoint, type Lift, type WeakPoint } from '../../engines/lms/weakpoint-pl';
import { mesocyclePhaseForWeek } from '../../engines/rir-matrix.engine';
import { autoRegulate, shouldTrainToday, type AutoRegOutput } from '../../engines/pro/autoregulation-pro.engine';
import { acuteChronicRatio, toDailyLoads } from '../../engines/pro/training-load.engine';
import { loadSRPESessions } from '../../engines/pro/srpe-store';
import { SPLIT_PATTERNS } from '../../engines/bb/bb-split-patterns';
import { rankBBSplits, selectBestBBSplit, explainBBSelection, type BBSelectorInput } from '../../engines/bb/bb-selector.engine';
import { buildBBPlan, applyMacrocycleToBBPlan, type BBPlan } from '../../engines/bb/bb-builder.engine';
import { calcBBPlanMetrics, explainBBMetrics } from '../../engines/bb/bb-metrics.engine';
import { adaptForPEDs, type PED } from '../../engines/bb/bb-ped-adaptation.engine';
import { getAllVolumeLandmarks } from '../../engines/volume-landmarks.engine';
import { PlateCalcTab } from './TrainingScreen_parts/PlateCalcTab';
import { SessionPlayer, type PlayerDay } from './SRCBBScreen_parts/SessionPlayer';
import { DayCard, type PlanDayView, type PlanExerciseView, type PhaseKey } from './TrainingScreen_parts/PlanOutput';
import { PedInputPanel, PedAdaptationCard } from './TrainingScreen_parts/PedCoursePanel';

import { AutoregPanel } from './SRCBBScreen_parts/AutoregPanel';
import { PeakingPanel } from './SRCBBScreen_parts/PeakingPanel';
import { RecoveryPanel } from './SRCBBScreen_parts/RecoveryPanel';
import { ExerciseSafetyPanel } from './SRCBBScreen_parts/ExerciseSafetyPanel';
import { TrainingMetricsChart, type LMSWeekMetric, type BBMuscleMetric } from './SRCBBScreen_parts/TrainingMetricsChart';
import { ExerciseDemoPanel } from './SRCBBScreen_parts/ExerciseDemoPanel';
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
import { PopupNumber, PopupSelect, ExpandableCard, MetricCard, SaveButton } from './SRCBBScreen_parts/TrainingPopups';
import { TrainingScoreCard } from '../components/TrainingScoreCard';
import { ReadinessForecastCard } from './TrainingScreen_parts/ReadinessForecastCard';
import { lmsPlanToSessions, bbPlanToSessions, autoregPlan as autoregPlanBridge, progressFromSessions, planVsFact } from '../../engines/training-integration.engine';
import type { BridgeSession, ReadinessInput, ProgressSnapshot } from '../../engines/training-integration.engine';
import { generateRepTempo, type RepTempoOutput } from '../../engines/rep-tempo-engine';
import { MesocycleProgressionCard, SOURCE_PHASE_LABEL, SOURCE_PHASE_ORIGIN_LABEL, sourceWeekColor, summarizeSourceCycleWeeks } from './TrainingScreen_parts/MesocycleProgressionCard';
import { DeloadProtocolCard } from './TrainingScreen_parts/DeloadProtocolCard';
import { MacrocyclePanel } from './SRCBBScreen_parts/MacrocyclePanel';
import { deserializeMacro, deserializeBbMacro, buildBbMacrocycle, type Macrocycle, type BBMacrocycle } from '../../engines/lms/macrocycle.engine';
import { macroPhaseToLmsPhase, bbMacroPhaseToUserPhase, isDeloadLikeBbMacroPhase } from '../../engines/periodization/phase-bridge';
import { calcCycleMetrics, type SRExercise } from '../../engines/lms/lms-metrics.engine';
import { buildDiaryAutoreg, type AutoRegMode, type DiaryAutoregResult } from '../../engines/pro/diary-autoreg.engine';
import { competitionAttempts, MEET_STRATEGY_LABEL, MEET_STRATEGY_PCT_LABEL, MEET_WARMUP_STEPS, type MeetStrategy } from '../../engines/lms/competition-attempts';
import { recommendWeightCut } from '../../engines/gym-competition.engine';
import { updateSection } from '../../core/profile-manager';
import { LAST_HEAVY_DAYS, warmupSequence } from '../../engines/pro/taper.engine';
import { PlannerToolsPanel } from './TrainingScreen_parts/PlannerToolsPanel';
import { PlDeadpointsBarPathCard } from './TrainingScreen_parts/PlDeadpointsBarPathCard';
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
const SMALL: React.CSSProperties = { color: 'rgba(255,255,255,0.55)', fontSize: 11, lineHeight: 1.4 };
const cardBg = CARD;
const ACCENT = 'var(--accent)';
const BTN: React.CSSProperties = { background: ACCENT, color: '#0a0a0a', border: 'none', borderRadius: 8, padding: '10px 14px', fontWeight: 600, fontSize: 12, minHeight: 40, cursor: 'pointer' };
const BTN_GHOST: React.CSSProperties = { ...BTN, background: 'transparent', color: ACCENT, border: '1px solid var(--accent-dim)' };
const PILL = (active: boolean) => ({ padding:'7px 12px', borderRadius:20, fontSize:11, fontWeight: active ? 700 : 500, cursor:'pointer', border: active ? '1px solid var(--accent)' : '1px solid rgba(255,255,255,0.06)', background: active ? 'linear-gradient(135deg,var(--accent),#00c8a0)' : '#18181b', color: active ? '#000' : '#fff', flexShrink:0 } as React.CSSProperties);
const SEL: React.CSSProperties = { background: '#18181b', color: '#fff', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '8px', minHeight: 40, width: '100%', outline: 'none', boxSizing: 'border-box' };
const IN: React.CSSProperties = { ...SEL, padding: '10px' };
const LABEL: React.CSSProperties = { color: 'rgba(255,255,255,0.6)', fontSize: 11, margin: '6px 0 3px' };
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

export const SRCBBScreen: React.FC<{ track?: 'pl' | 'bb' | 'auto' }> = ({ track = 'auto' }) => {
  const [mainTab, setMainTab] = useState<Mode>(track === 'bb' ? 'bb' : track === 'pl' ? 'pl' : 'manual');
  const subViewList: Record<Mode, { key: string; label: string }[]> = {
    pl: [['plan', '📋 План цикла'], ['tools', '🔧 Инструменты'], ['macro', '🗓 Годовой план'], ['bridge', '🔗 Мост план→сессия'], ['plates', '🧮 Калькулятор блинов'], ['autoreg', '🧠 Авторегуляция'], ['peak', '🏁 Пик/Соревнования'], ['recovery', '🔋 Восстановление'], ['safety', '🛡 Безопасность'], ['demo', '🎬 Демонстрация']].map(([k, l]) => ({ key: k, label: l })),
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
    dir === 'bodybuilding' ? 'bodybuilding' : 'powerlifting'
  );
  // Keep the annual planner aligned with the active PL level when it changes
  // outside the annual-planning view (profile/session restore).
  useEffect(() => {
    setMacroLevel(level);
  }, [level]);
  useEffect(() => {
    setMacroGoal(dir === 'bodybuilding' ? 'bodybuilding' : 'powerlifting');
  }, [dir]);
  const [bw, setBw] = useState<number>(_plSaved?.plBw ?? _profPL.bodyWeight ?? 85);
  const [days, setDays] = useState<number>(_plSaved?.plDays ?? 3);
  const [pmSquat, setPmSquat] = useState<number>(_plSaved?.pmSquat ?? _profPL.pmSquat ?? 120);
  const [pmBench, setPmBench] = useState<number>(_plSaved?.pmBench ?? _profPL.pmBench ?? 100);
  const [pmDead, setPmDead] = useState<number>(_plSaved?.pmDead ?? _profPL.pmDead ?? 140);
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
  // 🏁 Соревнование + тапер: целевой вес (категория), недель до соревнования, тапер-недель к активному циклу.
  const [targetBw, setTargetBw] = useState<number>(_plSaved?.plTargetBw ?? bw);
  const [weeksToMeet, setWeeksToMeet] = useState<number>(_plSaved?.plWeeksToMeet ?? 8);
  const [taperWeeksToAdd, setTaperWeeksToAdd] = useState<number>(_plSaved?.plTaperWeeksToAdd ?? 2);
  const [taperNote, setTaperNote] = useState<string>(_plSaved?.plTaperNote ?? '');
  // Стратегия прикидов соревновательного дня (выход на пик: агрессивная — 93/97/105%).
  const [attemptStrategy, setAttemptStrategy] = useState<MeetStrategy>(_plSaved?.plAttemptStrategy ?? 'balanced');
  // Имитация соревнований (mock meet) — прикиды-синглы за 10-14 дней до старта.
  const [mockMeetOn, setMockMeetOn] = useState<boolean>(_plSaved?.plMockMeet ?? false);
  // Неделя соревнований в конце тапера — прикиды как подходы дня старта (по умолчанию ВКЛ: план готов полностью).
  const [meetWeekOn, setMeetWeekOn] = useState<boolean>(_plSaved?.plMeetWeek ?? true);
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
  useEffect(() => { try { localStorage.setItem('he_pl_session', JSON.stringify({ selectedCycleId, cycleWeeks, srcWeek, builtSrc, srcAdditions, plLevel: level, plGoal: goal, plDir: dir, plBw: bw, plDays: days, pmSquat, pmBench, pmDead, exercisePMs, plTargetBw: targetBw, plWeeksToMeet: weeksToMeet, plTaperWeeksToAdd: taperWeeksToAdd, plTaperNote: taperNote, plAttemptStrategy: attemptStrategy, plMockMeet: mockMeetOn, plMeetWeek: meetWeekOn })); } catch { /* ignore */ } }, [selectedCycleId, cycleWeeks, srcWeek, builtSrc, srcAdditions, level, goal, dir, bw, days, pmSquat, pmBench, pmDead, exercisePMs, targetBw, weeksToMeet, taperWeeksToAdd, taperNote, attemptStrategy, mockMeetOn, meetWeekOn]);
  useEffect(() => {
    const cycle = getCycleById(selectedCycleId);
    if (cycle) setCycleWeeks(originalCycleWeeks(cycle));
  }, [selectedCycleId]);
  useEffect(() => { initExercisePMs(selectedCycleId); }, [selectedCycleId]);
  useEffect(() => { try { saveTrainingProfile({ ...loadTrainingProfile(), pmSquat, pmBench, pmDead, bodyWeight: bw }); } catch { /* ignore */ } }, [pmSquat, pmBench, pmDead, bw]);
  // U4: ручная правка поверх сгенерированного плана (оверлей правок по позиции сета)
  const [editMode, setEditMode] = useState<boolean>(false);
  const [srcEdits, setSrcEdits] = useState<Record<string, { weight?: number; reps?: number; sets?: number; tempo?: string }>>({});
  const setKey = (w: number, di: number, ei: number, si: number) => `${w}_${di}_${ei}_${si}`;
  const effSet = (w: number, di: number, ei: number, si: number, ws: { sets: number; reps: number; weight: number; pct: number }) => {
    const ed = srcEdits[setKey(w, di, ei, si)];
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
  const buildSrc = (cycleId = selectedCycleId, weeks = cycleWeeks) => {
    const tpl = getCycleById(cycleId);
    if (!tpl) return;
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
      peds: peds.length ? peds : undefined,
      pedDoses,
      acwr: acwrData.zone !== 'optimal' ? acwrData : undefined,
      autoReg: autoRegMode === 'auto' ? { topSetPctMultiplier: autoRegResult.topSetPctMultiplier, volumeMultiplier: autoRegResult.volumeMultiplier, rirShift: autoRegResult.rirShift, deload: autoRegResult.deload } : undefined,
      // Original SRC cycles are self-calculating: preserve their source layout
      // and apply the cycle's own PM correction between weeks.
      progressionEnabled: true,
      faithful: true,
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
          peds: peds.length ? peds : undefined,
          pedDoses,
          acwr: acwrData.zone !== 'optimal' ? acwrData : undefined,
           autoReg: autoRegMode === 'auto' ? { topSetPctMultiplier: autoRegResult.topSetPctMultiplier, volumeMultiplier: autoRegResult.volumeMultiplier, rirShift: autoRegResult.rirShift, deload: autoRegResult.deload } : undefined,
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
    const sessions = weeks.flatMap(week => week.days.map(day => day.exercises.map(exercise => ({
      name: exercise.name, group: exercise.group, coef: exercise.coef, mnosz: exercise.mnosz, pm: exercise.pm,
      sets: exercise.workSets.map(set => ({ weight: set.weight, reps: set.reps, sets: set.sets })),
    } as SRExercise))));
    const first = outputs[0].output;
    const combined: LMSBuildOutput = {
      ...first,
      template: first.template,
      weeks,
      cycleMetrics: calcCycleMetrics(sessions),
      progressionRationale: `Макроцикл: ${outputs.length} СРЦ-блок(ов), ${weeks.length} недель. ` + outputs.map(({ block, output }) => `${block.phase} ${block.weekOffset}-${block.weekOffset + block.weeks - 1}: ${output.template.meta.title}`).join('; '),
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
  const ranked = useMemo(() => rankCycles({
    goal: goal as any,
    level: level as any,
    bodyWeight: bw,
    daysPerWeek: days,
    direction: dir as any,
    mode: pedAuto && peds.length > 0 ? 'on_course' : 'natural',
  }).filter(r => normalizeCycleDirection(r.cycle.meta.direction) !== 'bodybuilding'), [goal, level, bw, days, dir, pedAuto, peds.length]);
  const best = ranked[0];
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
  // 🎯 Слабые точки СРЦ-движений (профи-диагностика weakpoint-pl)
  const [plWeakPoints, setPlWeakPoints] = useState<{ lift: Lift; weakPoint: WeakPoint }[]>([]);
  const togglePlWeak = (lift: Lift, weakPoint: WeakPoint) => setPlWeakPoints(p => {
    const idx = p.findIndex(x => x.lift === lift && x.weakPoint === weakPoint);
    if (idx >= 0) return p.filter((_, i) => i !== idx);
    return [...p, { lift, weakPoint }];
  });
  // 📅 Ручной выбор дней недели для слабых групп и слабых точек (1-based)
  const [weakGroupDayMap, setWeakGroupDayMap] = useState<Record<string, number[]>>({});
  const [plWeakPointDayMap, setPlWeakPointDayMap] = useState<Record<string, number[]>>({});
  const [weakGroupExerciseMap, setWeakGroupExerciseMap] = useState<Record<string, string[]>>({});
   const [plWeakPointExerciseMap, setPlWeakPointExerciseMap] = useState<Record<string, string[]>>({});
   const [orthopedicBlockedPatterns, setOrthopedicBlockedPatterns] = useState<string[]>([]);
   const [diagnosticExerciseMap, setDiagnosticExerciseMap] = useState<Record<string, string[]>>({});
   const [diagnosticDayMap, setDiagnosticDayMap] = useState<Record<string, number[]>>({});
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
    off_chest: 'Сход с груди', mid: 'Середина', lockout: 'Дожим', start: 'Старт', bottom: 'Низ', sticking_mid: 'Застревание',
    ohp_start: 'Старт с плеч', ohp_mid: 'Середина', ohp_lockout: 'Дожим',
    row_start: 'Старт (съём)', row_mid: 'Середина', row_squeeze: 'Сведение лопаток',
    pd_top: 'Верх (старт)', pd_mid: 'Середина', pd_squeeze: 'Сведение к груди',
    inc_off: 'Сход с груди (верх)', inc_mid: 'Середина', inc_lockout: 'Дожим',
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
    const plan = buildBBPlan({
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
    setBbWeeks(macro.totalWeeks);
    setBuiltBb(phased);
    setBbWeekSel(1);
    try { saveBridgeSessions(bbPlanToSessions(phased)); } catch { /* ignore */ }
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
      label: `Д${i + 1} ${sess.character}`,
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
  const workingWeight = useMemo(() => {
    if (mainTab === 'pl' && builtSrc) return builtSrc.weeks[0]?.days[0]?.exercises[0]?.workSets[0]?.weight || 100;
    if (mainTab === 'bb' && builtBb) return builtBb.weeks[0]?.sessions[0]?.exercises[0]?.workSets[0]?.weight || 100;
    return 100;
  }, [mainTab, builtSrc, builtBb]);
  const runFocus = mainTab === 'pl' ? (getCycleById(selectedCycleId)?.meta.title || 'Силовой цикл') : 'BB';
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
    const LIFT_KW: Record<string, string[]> = { squat: ['присед'], bench: ['жим лёжа', 'жим лёж'], deadlift: ['становая'] };
    const byLift: Record<string, Map<string, number>> = { squat: new Map(), bench: new Map(), deadlift: new Map() };
    for (const log of strengthLogs) {
      for (const ex of (log.exercises || [])) {
        const nm = (ex.exerciseName || '').toLowerCase();
        for (const [lift, kws] of Object.entries(LIFT_KW)) {
          if (!kws.some(k => nm.includes(k))) continue;
          let best = 0;
          for (const st of (ex.sets || [])) {
            const w = +st.weight || 0, r = +st.reps || 0;
            if (w > 0) { const e1 = r <= 1 ? w : Math.round(w * (1 + r / 30) * 10) / 10; if (e1 > best) best = e1; }
          }
          if (best > 0) { const cur = byLift[lift].get(log.date) || 0; if (best > cur) byLift[lift].set(log.date, best); }
          break;
        }
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
    const keywords: Record<typeof lift, string[]> = {
      squat: ['присед'], bench: ['жим лёжа', 'жим лежа'], deadlift: ['становая'],
    };
    const series = e1rmSeries.find(s => keywords[lift].some(k => s.label.toLowerCase().includes(k) || s.lift === lift));
    const last = series?.pts.at(-1)?.val;
    if (last == null) return;
    if (lift === 'squat') setPmSquat(last);
    else if (lift === 'bench') setPmBench(last);
    else setPmDead(last);
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

  return (
    <div key={mainTab} className="pl-auto-screen" style={{ padding: '12px 0', color: '#fff', width: '100%', maxWidth: '100%', margin: 0, minWidth: 0, boxSizing: 'border-box', overflowX: 'hidden' }}>
      {/* Заголовок текущего режима планирования (выбор режима — в навигации блока) */}
      <div style={{ marginBottom: 10, padding: '8px 12px', borderRadius: 12, background: 'var(--accent-dim)', border: '1px solid var(--accent-glow)', textAlign: 'center' }}>
        <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--accent)' }}>{mainTab === 'pl' ? '🏆 Силовой цикл (ПЛ)' : mainTab === 'bb' ? '💪 Бодибилдинг (ББ)' : '🛠 Ручной конструктор'}</span>
      </div>
      {applyPayload && (
        <div style={{ padding: '10px 12px', borderRadius: 10, background: 'var(--accent-dim)', border: '1px solid rgba(0,230,138,0.25)', marginBottom: 10, fontSize: 11, color: 'var(--accent)', fontWeight: 700, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>✓ Применено: {applyPayload.label}</span>
          <button onClick={() => { clearPlannerApply(); setApplyPayload(null); }} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'rgba(255,255,255,0.5)', fontSize: 10, cursor: 'pointer', flexShrink: 0 }}>✕</button>
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

      {mainTab === 'pl' && subView === 'plan' && (
        <div style={{ minWidth: 0, maxWidth: '100%' }}>
          <div style={H}>🏆 Авто-подбор силового цикла</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8, minWidth: 0 }}>
            <PopupSelect label="Уровень спортсмена" value={level} onChange={setLevel} options={[['novice','Новичок'],['II-KMS','II разряд — КМС'],['KMS-MS','КМС — МС'],['MS-MSMK','МС — МСМК'],['II-MS','II разряд — МС'],['intermediate','Средний']].map(([id,label]) => ({ id, label }))} />
            <PopupSelect label="Цель тренировок" value={goal} onChange={setGoal} options={[['strength','Сила'],['mass','Мышечная масса'],['endurance','Выносливость'],['peak','Выход на пик'],['mixed','Смешанная']].map(([id,label]) => ({ id, label }))} />
            <PopupSelect label="Направление" value={dir} onChange={setDir} options={[['powerlifting','Троеборье'],['bench','Жим лёжа'],['deadlift_bench','Тяга + Жим'],['armwrestling','Армрестлинг']].map(([id,label]) => ({ id, label }))} />
            <PopupNumber label="Дней в неделю" value={days} min={2} max={7} suffix="" onChange={v => setDays(v)} />
            <PopupNumber label="Вес тела" value={bw} min={40} max={200} suffix=" кг" onChange={v => setBw(v)} />
          </div>
           {best && <ExpandableCard title={`🏆 Рекомендован: ${best.cycle.meta.title}`} icon="🏆" short={best.cycle.meta.description} full={<><div style={{ marginBottom: 8 }}><b>Почему этот цикл:</b> {explainSelection(best)}</div><div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)" }}>{best.cycle.meta.howItWorks}</div><button onClick={() => { try { setSelectedCycleId(best.cycle.meta.id); buildSrc(best.cycle.meta.id); } catch (error) { setMethodNote(`⚠ План не собран: ${(error as Error).message}`); } }} style={{ marginTop: 10, width: "100%", padding: 10, borderRadius: 8, border: "none", cursor: "pointer", background: "linear-gradient(135deg,var(--accent),#00c853)", color: "#000", fontWeight: 700, fontSize: 12 }}>✅ Применить цикл и собрать план</button></>} />}
          <div style={H}>📂 Каталог силовых циклов ({plCycles.length})</div>
          <PopupSelect label="Выбор цикла из каталога" value={selectedCycleId} onChange={setSelectedCycleId} hint="Полный каталог силовых циклов, блоков и встроенных программ. Нажмите, чтобы открыть." options={plCycles.map(c => ({ id: c.meta.id, label: c.meta.title, desc: `${({ powerlifting: 'Троеборье', bench: 'Жим лёжа', deadlift_bench: 'Тяга+Жим', armwrestling: 'Армрестлинг' } as Record<string,string>)[c.meta.direction] || c.meta.direction} · ${c.meta.period} · ${c.meta.level} · ${c.meta.weeks} нед` }))} />
          {(() => { const c = getCycleById(selectedCycleId); if (!c) return null; return <ExpandableCard title={c.meta.title} icon="📖" short={<><b>Кратко:</b> {c.meta.description}</>} full={<><div style={{ marginBottom: 8 }}><b>Как работает цикл:</b> {c.meta.howItWorks}</div>{c.meta.conditions.length > 0 && <div><b>Условия применения:</b><ul style={{ margin: '4px 0 0 16px', padding: 0 }}>{c.meta.conditions.map((cond, i) => <li key={i} style={{ marginBottom: 3 }}>{cond}</li>)}</ul></div>}</>} />; })()}
          <div style={H}>💪 Предельные максимумы (ПМ) по упражнениям цикла</div>
          {(() => {
            const tpl = getCycleById(selectedCycleId);
            if (!tpl) return null;
            const exs = extractExercises(tpl);
            const isArmCycle = exs.some(e => e.includes('Кисть') || e.includes('Натяжка') || e.includes('Боковой') || e.includes('Приведение'));
            const mainCount = exs.filter(e => e.includes('Присед') || e.includes('Жим') || e.includes('Становая') || e.includes('Тяга')).length;
            const cols = exs.length <= 3 ? exs.length : exs.length <= 6 ? 3 : 4;
            if (mainCount <= 3 && !isArmCycle) {
              return (
                <>
                  <div role="group" aria-label="Предельные максимумы основных упражнений" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: 8 }}>
                    <div><PopupNumber label="Присед" value={pmSquat} min={20} max={500} suffix=" кг" onChange={v => setPmSquat(v)} />{exerciseE1rm.some(e => /присед/i.test(e.name)) && <button onClick={() => calibratePmFromDiary('squat')} style={{ ...BTN_GHOST, width: '100%', padding: '4px 6px', minHeight: 30, fontSize: 10 }}>📈 Из дневника</button>}</div>
                    <div><PopupNumber label="Жим лёжа" value={pmBench} min={20} max={400} suffix=" кг" onChange={v => setPmBench(v)} />{exerciseE1rm.some(e => /жим лёж/i.test(e.name)) && <button onClick={() => calibratePmFromDiary('bench')} style={{ ...BTN_GHOST, width: '100%', padding: '4px 6px', minHeight: 30, fontSize: 10 }}>📈 Из дневника</button>}</div>
                    <div><PopupNumber label="Становая тяга" value={pmDead} min={20} max={500} suffix=" кг" onChange={v => setPmDead(v)} />{exerciseE1rm.some(e => /становая/i.test(e.name)) && <button onClick={() => calibratePmFromDiary('deadlift')} style={{ ...BTN_GHOST, width: '100%', padding: '4px 6px', minHeight: 30, fontSize: 10 }}>📈 Из дневника</button>}</div>
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
                <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 6 }}>
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
            return <div style={{ marginTop: 8, padding: '8px 10px', borderRadius: 8, background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.18)', fontSize: 11, color: 'rgba(255,255,255,0.75)' }}>
              📅 Оригинальная длина цикла: <b style={{ color: '#60a5fa' }}>{sourceWeeks} нед.</b> · календарь берётся из исходной раскладки СРЦ.
            </div>;
          })()}
          <div style={{ marginTop: 8, fontSize: 11, fontWeight: 700, color: ACCENT }}>🎯 Слабые группы мышц (ПЛ + ББ-акцент, сохраняются в профиль)</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2, marginBottom: 4 }}>
            💪 PL-ассистенты добавляются по раскладке самого цикла: %ПМ/повторы/подходы — как у аксессуара этой недели, RIR — из матрицы по фазе. Основные жим/присед/становая и их дубли исключены; для каждой группы свой PL-пул.
          </div>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 4, marginBottom: 6, minWidth: 0, maxWidth: '100%' }}>{WEAK_GROUPS.map(([id, l]) => { const on = weakPoints.includes(id); return <button key={id} onClick={() => toggleWeak(id)} style={{ padding: "5px 10px", borderRadius: 14, fontSize: 11, fontWeight: 700, cursor: "pointer", border: on ? "1px solid var(--accent)" : "1px solid rgba(255,255,255,0.08)", background: on ? "rgba(0,230,138,0.15)" : "rgba(255,255,255,0.02)", color: on ? "var(--accent)" : "rgba(255,255,255,0.6)", minWidth: 0, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l}{on ? " ✓" : ""}</button>; })}</div>
          {/* 📅 Выбор дней для слабых групп — авто-распределение если не выбрано */}
          {weakPoints.length > 0 && (() => {
            const tpl = getCycleById(selectedCycleId);
            const dayCount = tpl?.week1?.length || 3;
            const WEAK_GROUP_LABELS_RU: Record<string,string> = { chest:'Грудь', back:'Спина', legs:'Ноги', shoulders:'Плечи', arms:'Руки', core:'Кор' };
            return (
              <div style={{ marginTop:6, padding:'8px 10px', borderRadius:10, background:'rgba(0,230,138,0.05)', border:'1px solid rgba(0,230,138,0.15)' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: ACCENT, marginBottom: 6 }}>📅 Выбор дней недели для слабых групп (если не выбрать — авто)</div>
                {weakPoints.map(wg => {
                  const days = weakGroupDayMap[wg] || [];
                  return (
                    <div key={wg} style={{ marginBottom: 6 }}>
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', marginBottom: 3, minWidth: 0, overflowWrap: 'anywhere' }}>{WEAK_GROUP_LABELS_RU[wg] || wg}{days.length > 0 ? ` → день ${days.join(', ')}` : ' → авто (малые: 2 дня, крупные: 1 день)'}</div>
          <div role="group" aria-label="Дни недели для слабых групп мышц" style={{ display: 'flex', gap: 4, flexWrap: 'wrap', minWidth: 0, maxWidth: '100%' }}>
                       {Array.from({ length: dayCount }, (_, i) => i + 1).map(d => {
                          const on = days.includes(d);
                          return <button key={d} aria-label={`День ${d} для ${WEAK_GROUP_LABELS_RU[wg] || wg}${on ? ' (выбран)' : ''}`} onClick={() => toggleDayInMap(wg, d, 'wg')} style={{ padding:'4px 10px', borderRadius:10, fontSize:10, fontWeight:700, cursor:'pointer', border: on ? '1px solid var(--accent)' : '1px solid rgba(255,255,255,0.08)', background: on ? 'rgba(0,230,138,0.15)' : 'rgba(255,255,255,0.02)', color: on ? 'var(--accent)' : 'rgba(255,255,255,0.6)' }}>{'Д' + d}{on ? ' ✓' : ''}</button>;
                         })}
                       </div>
                       <div style={{ marginTop: 4, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            {(tpl ? getPLWeakGroupExerciseCandidates(tpl, wg) : []).map(ex => {
                           const selected = (weakGroupExerciseMap[wg] || []).includes(ex.name);
                           return <button key={ex.id} onClick={() => toggleExerciseInMap(wg, ex.name, 'wg')} style={{ padding: '3px 7px', borderRadius: 8, fontSize: 9, cursor: 'pointer', border: selected ? '1px solid var(--accent)' : '1px solid rgba(255,255,255,0.08)', background: selected ? 'rgba(0,230,138,0.15)' : 'rgba(255,255,255,0.02)', color: selected ? 'var(--accent)' : 'rgba(255,255,255,0.6)' }}>{ex.name}{selected ? ' ✓' : ''}</button>;
                         })}
                       </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
          <div style={{ marginTop: 8, fontSize: 11, fontWeight: 700, color: '#8b5cf6' }}>🏋️ Слабые точки СРЦ-движений (ПЛ-диагностика: проценты уклонений в амплитуде)</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2, marginBottom: 4 }}>
            📐 Каждая слабая точка добавляется в 2 дня: тяжёлый (3×8 RIR 2) + памп-день (3×12 @ 60% RIR 3).
          </div>
          {(() => {
            const WP_LABELS: Record<string, string> = {
              off_chest: 'Сход со груди', mid: 'Середина', lockout: 'Дожим',
              bottom: 'Низ (яма)', start: 'Старт (с пола)',
              ohp_start: 'Старт с плеч', ohp_mid: 'Середина', ohp_lockout: 'Дожим вверх',
              row_start: 'Старт (съём)', row_mid: 'Середина', row_squeeze: 'Сведение лопаток',
              pd_top: 'Верх (старт)', pd_mid: 'Середина', pd_squeeze: 'Сведение к груди',
              inc_off: 'Сход с груди (верх)', inc_mid: 'Середина', inc_lockout: 'Дожим',
            };
            const PL_WEAKPOINT_OPTIONS = Object.entries(WEAK_POINTS_BY_LIFT).map(([lift, wps]) => ({
              lift,
              weakPoints: (wps as string[]).map((wp: string) => ({ id: wp, label: WP_LABELS[wp] || wp })),
            }));
            return PL_WEAKPOINT_OPTIONS.map((opt) => (
            <div key={opt.lift} style={{ marginTop: 4 }}>
               <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginBottom: 2, minWidth: 0, overflowWrap: 'anywhere' }}>{opt.lift === 'bench' ? 'Жим лёжа' : opt.lift === 'squat' ? 'Присед' : opt.lift === 'deadlift' ? 'Становая' : opt.lift === 'ohp' ? 'Жим стоя' : opt.lift === 'row' ? 'Тяга в наклоне' : opt.lift === 'pulldown' ? 'Тяга верхн. блока' : opt.lift === 'incline_press' ? 'Жим на наклонной' : opt.lift}</div>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap", minWidth: 0, maxWidth: '100%' }}>
                {opt.weakPoints.map((wp) => {
                  const on = plWeakPoints.some(x => x.lift === opt.lift && x.weakPoint === wp.id);
                  return <button key={wp.id} onClick={() => togglePlWeak(opt.lift as Lift, wp.id as WeakPoint)} style={{ padding: "5px 9px", borderRadius: 12, fontSize: 11, fontWeight: 700, cursor: "pointer", border: on ? "1px solid #8b5cf6" : "1px solid rgba(255,255,255,0.08)", background: on ? "rgba(139,92,246,0.15)" : "rgba(255,255,255,0.02)", color: on ? "#8b5cf6" : "rgba(255,255,255,0.6)", minWidth: 0, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{wp.label}{on ? " ✓" : ""}</button>;
                })}
              </div>
            </div>
            ));
          })()}
          {/* 📅 Выбор дней недели для каждой выбранной слабой точки СРЦ */}
          {plWeakPoints.length > 0 && (() => {
            const tpl = getCycleById(selectedCycleId);
            const dayCount = tpl?.week1?.length || 3;
            const liftLabelMap: Record<string, string> = { bench: 'Жим лёжа', squat: 'Присед', deadlift: 'Становая', ohp: 'Жим стоя', row: 'Тяга в наклоне', pulldown: 'Тяга верхнего блока', incline_press: 'Жим на наклонной' };
            return (
              <div style={{ marginTop:6, padding:'8px 10px', borderRadius:10, background:'rgba(139,92,246,0.05)', border:'1px solid rgba(139,92,246,0.15)' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#8b5cf6', marginBottom: 6 }}>📅 Дни недели для слабых точек СРЦ (если пусто — авто: тяжёлый+памп-день)</div>
                {plWeakPoints.map(wp => {
                  const mapKey = `${wp.lift}|${wp.weakPoint}`;
                  const days = plWeakPointDayMap[mapKey] || [];
                  return (
                    <div key={mapKey} style={{ marginBottom: 6, minWidth: 0, maxWidth: '100%' }}>
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis' }}>{liftLabelMap[wp.lift] || wp.lift} · {wp.weakPoint}{days.length > 0 ? ` → день ${days.join(', ')}` : ' → авто (2 дня: тяжёлый + памп)'}</div>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', minWidth: 0, maxWidth: '100%' }}>
                         {Array.from({ length: dayCount }, (_, i) => i + 1).map(d => {
                          const on = days.includes(d);
                          return <button key={d} onClick={() => toggleDayInMap(mapKey, d, 'pw')} style={{ padding:'4px 10px', borderRadius:10, fontSize:10, fontWeight:700, cursor:'pointer', border: on ? '1px solid #8b5cf6' : '1px solid rgba(255,255,255,0.08)', background: on ? 'rgba(139,92,246,0.15)' : 'rgba(255,255,255,0.02)', color: on ? '#8b5cf6' : 'rgba(255,255,255,0.6)' }}>{'Д' + d}{on ? ' ✓' : ''}</button>;
                         })}
                       </div>
                       <div style={{ marginTop: 4, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                         {diagnoseWeakPoint(wp.lift as Lift, wp.weakPoint as WeakPoint).assistance.map(name => {
                           const selected = (plWeakPointExerciseMap[mapKey] || []).includes(name);
                           return <button key={name} onClick={() => toggleExerciseInMap(mapKey, name, 'pw')} style={{ padding: '3px 7px', borderRadius: 8, fontSize: 9, cursor: 'pointer', border: selected ? '1px solid #8b5cf6' : '1px solid rgba(255,255,255,0.08)', background: selected ? 'rgba(139,92,246,0.15)' : 'rgba(255,255,255,0.02)', color: selected ? '#8b5cf6' : 'rgba(255,255,255,0.6)' }}>{name}{selected ? ' ✓' : ''}</button>;
                         })}
                       </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
          <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid rgba(168,85,247,0.2)' }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#c084fc', marginBottom: 4 }}>🎯 Мёртвые точки → Слабые точки → Движение штанги</div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>
              Выберите фазу, отклонения траектории, упражнения из диагностики и дни добавления. Исходный цикл не изменяется. Протокол упражнений — из раскладки этого цикла.
            </div>
            <PlDeadpointsBarPathCard dayCount={getCycleById(selectedCycleId)?.week1?.length || 3} template={getCycleById(selectedCycleId) ?? null} sessions={diarySessions} />
          </div>
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
                <button onClick={() => setPedAuto(a => !a)} style={{ padding:'5px 12px', borderRadius:8, fontSize:10, fontWeight:800, cursor:'pointer', border:'none', background: pedAuto ? '#00e68a' : 'rgba(255,255,255,0.1)', color: pedAuto ? '#000' : 'var(--text-dim)', flexShrink: 0, minHeight: 32 }}>
                  АВТО {pedAuto ? 'ON' : 'OFF'}
                </button>
              }
            />
            {pedAuto && peds.length > 0 && <div style={{ marginTop:6, fontSize:10, color:'rgba(255,255,255,0.5)' }}>⚡ Авто-прогрессия ПМ включена: {courseIntensity === 'heavy' ? 'Тяжёлая' : courseIntensity === 'moderate' ? 'Умеренная' : 'Лёгкая'} интенсивность → {courseIntensity === 'heavy' ? '+2.5%' : courseIntensity === 'moderate' ? '+2%' : '+1.5%'}/нед</div>}
            {!pedAuto && peds.length > 0 && <div style={{ marginTop:6, fontSize:10, color:'rgba(255,255,255,0.5)' }}>⏸ Авто-прогрессия выключена → базовая progression цикла</div>}
            <PedAdaptationCard adaptation={pedAdapt} />
          </div>

           <button style={{ ...BTN, width: '100%', marginTop: 10, minHeight:44, fontSize:13 }} onClick={() => { try { buildSrc(); } catch (error) { setMethodNote(`Ошибка генерации плана: ${(error as Error).message}`); } }}>Сгенерировать план ({cycleWeeks} нед)</button>
          {/* 🏁 Соревнование + тапер: вес → рекомендации по сбросу, тапер-недели к активному циклу, новый цикл на выбор */}
          {(() => {
            const rec = recommendWeightCut(bw, targetBw, weeksToMeet);
            return (
              <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: 12, background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.18)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 8, flexWrap: 'wrap' }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: '#f59e0b' }}>🏁 Соревнование + тапер</div>
                  {builtSrc && <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)' }}>план: {builtSrc.weeks.length} нед · тапер добавлен: {taperNote ? 'да' : 'нет'}</span>}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 6 }}>
                  <PopupNumber label="Вес сейчас" value={bw} min={40} max={250} suffix=" кг" onChange={v => setBw(v)} />
                  <PopupNumber label="Целевой вес (категория)" value={targetBw} min={40} max={250} suffix=" кг" onChange={v => setTargetBw(v)} />
                  <PopupNumber label="Недель до старта" value={weeksToMeet} min={1} max={26} suffix=" нед" onChange={v => setWeeksToMeet(v)} />
                  <PopupNumber label="Тапер-недель к циклу" value={taperWeeksToAdd} min={1} max={4} suffix="" hint="Сколько недель снижения объёма добавить в конец активного плана" onChange={v => setTaperWeeksToAdd(v)} />
                </div>
                <div style={{ marginTop: 6, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 6 }}>
                  <PopupSelect
                    label="Стратегия прикидов (выход на пик)"
                    value={attemptStrategy}
                    onChange={v => setAttemptStrategy(v as MeetStrategy)}
                    hint="Прикиды дня соревнований на финальной тапер-неделе: консервативная 90/95.5/100%, сбалансированная 92/96/102%, агрессивная 93/97/105% от ПМ"
                    options={[
                      { id: 'conservative', label: MEET_STRATEGY_LABEL.conservative, desc: 'Опенер 90%, 2nd 95.5%, 3rd 100%' },
                      { id: 'balanced', label: MEET_STRATEGY_LABEL.balanced, desc: 'Опенер 92%, 2nd 96%, 3rd 102%' },
                      { id: 'aggressive', label: MEET_STRATEGY_LABEL.aggressive, desc: 'Опенер 93%, 2nd 97%, 3rd 105%' },
                    ]}
                  />
                  <button
                    onClick={() => setMockMeetOn(v => !v)}
                    style={{ alignSelf: 'flex-end', minHeight: 44, borderRadius: 8, border: mockMeetOn ? '1px solid #a78bfa' : '1px solid rgba(255,255,255,0.08)', background: mockMeetOn ? 'rgba(139,92,246,0.15)' : 'rgba(255,255,255,0.02)', color: mockMeetOn ? '#a78bfa' : 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: 700, cursor: 'pointer', padding: '8px 12px' }}
                    title="Имитация соревнований за 10-14 дней до старта: неделя перед тапером с прикидами-синглами (опенер RIR2 → вторая RIR1 → третья RIR0)"
                  >🎯 Имитация соревнований (mock meet){mockMeetOn ? ' ✓' : ''}</button>
                  <button
                    onClick={() => setMeetWeekOn(v => !v)}
                    style={{ alignSelf: 'flex-end', minHeight: 44, borderRadius: 8, border: meetWeekOn ? '1px solid #eab308' : '1px solid rgba(255,255,255,0.08)', background: meetWeekOn ? 'rgba(234,179,8,0.15)' : 'rgba(255,255,255,0.02)', color: meetWeekOn ? '#eab308' : 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: 700, cursor: 'pointer', padding: '8px 12px' }}
                    title="Неделя соревнований В КОНЦЕ плана: прикиды (опенер/вторая/третья ×1) как подходы дня старта — план готов полностью"
                  >🏁 Неделя соревнований в конце{meetWeekOn ? ' ✓' : ''}</button>
                  <button
                    disabled={!builtSrc || !taperNote}
                    onClick={() => {
                      if (!builtSrc) return;
                      setBuiltSrc(refreshMeetAttempts(builtSrc, attemptStrategy));
                      setMethodNote(`🔄 Прикиды пересчитаны: ${MEET_STRATEGY_PCT_LABEL[attemptStrategy]} (${MEET_STRATEGY_LABEL[attemptStrategy]}) — без повторного добавления тапера.`);
                    }}
                    style={{ ...BTN_GHOST, alignSelf: 'flex-end', minHeight: 44, fontSize: 11, border: builtSrc && taperNote ? '1px solid rgba(139,92,246,0.4)' : '1px solid rgba(255,255,255,0.08)', color: builtSrc && taperNote ? '#a78bfa' : 'rgba(255,255,255,0.3)', background: builtSrc && taperNote ? 'rgba(139,92,246,0.1)' : 'transparent' }}
                    title="Пересчитать прикиды на финальной тапер-неделе (и mock meet) под выбранную стратегию"
                  >🔄 Обновить прикиды</button>
                </div>
                {/* Рекомендации по сбросу ИЛИ набору (текущий вес ниже целевого — переход в более тяжёлую категорию) */}
                <div style={{ marginTop: 8, padding: 8, borderRadius: 8, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#f59e0b', marginBottom: 4 }}>
                    {rec.toCut > 0
                      ? `⚖️ Сброс: ${rec.toCut.toFixed(1)} кг · темп ${(rec.toCut / Math.max(1, weeksToMeet)).toFixed(2)} кг/нед · дефицит ≈${rec.dailyDeficitKcal} ккал/день`
                      : rec.toGain > 0
                        ? `📈 Набор: +${rec.toGain.toFixed(1)} кг · темп ${(rec.toGain / Math.max(1, weeksToMeet)).toFixed(2)} кг/нед · профицит ≈${rec.dailySurplusKcal} ккал/день`
                        : 'уже в категории'}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 6 }}>
                    {(rec.toCut > 0 ? rec.recommendations : rec.toGain > 0 ? rec.gainRecommendations : rec.recommendations).map((r, i) => (
                      <div key={i} style={{ fontSize: 10, color: r.startsWith('❌') ? '#f87171' : r.startsWith('⚠') ? '#fbbf24' : r.startsWith('✅') ? '#4ade80' : 'rgba(255,255,255,0.7)', lineHeight: 1.4 }}>{r}</div>
                    ))}
                  </div>
                  {(rec.toCut > 0 ? rec.timeline : rec.toGain > 0 ? rec.gainTimeline : rec.timeline).length > 0 && (
                    <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                      {(rec.toCut > 0 ? rec.timeline : rec.toGain > 0 ? rec.gainTimeline : rec.timeline).map(t => (
                        <div key={t.week} title={t.note} style={{ padding: '3px 6px', borderRadius: 6, fontSize: 9, background: t.week === weeksToMeet ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.04)', border: `1px solid ${t.week === weeksToMeet ? 'rgba(245,158,11,0.4)' : 'rgba(255,255,255,0.08)'}` }}>
                          <b style={{ color: t.week === weeksToMeet ? '#f59e0b' : 'rgba(255,255,255,0.8)' }}>Н{t.week}</b> {t.weight.toFixed(1)} кг
                        </div>
                      ))}
                    </div>
                  )}
                  {rec.toGain > 0 && (
                    <button
                      onClick={() => {
                        try {
                          // Профицит → питание: цель «Набор» + целевой вес + % суперкомпенсации (5-15%).
                          const estTdee = Math.max(1500, bw * 30);
                          const surplusPct = Math.max(5, Math.min(15, Math.round((rec.dailySurplusKcal / estTdee) * 100)));
                          updateSection('goals', { primaryGoal: 'bulk', targetWeight: targetBw, goalTimelineWeeks: weeksToMeet });
                          updateSection('nutrition', { surplusPct });
                          setMethodNote(`🍽 Набор записан в профиль: цель «Набор массы» до ${targetBw} кг, профицит ≈${rec.dailySurplusKcal} ккал/день (~${surplusPct}%). Планировщик питания учтёт при генерации рациона.`);
                        } catch (error) { setMethodNote(`⚠ Не удалось записать в профиль: ${(error as Error).message}`); }
                      }}
                      style={{ ...BTN_GHOST, marginTop: 6, minHeight: 40, fontSize: 11, border: '1px solid rgba(0,230,138,0.35)', color: '#00e68a', background: 'rgba(0,230,138,0.08)' }}
                      title="Записать цель «Набор» + профицит в единый профиль (UnifiedSettings) — планировщик питания учтёт при генерации"
                    >🍽 Применить к питанию: набор (+{rec.dailySurplusKcal} ккал/день)</button>
                  )}
                </div>
                {/* Действия: тапер к активному циклу + авто-новый цикл */}
                <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                  <button
                    disabled={!builtSrc}
                    onClick={() => {
                      if (!builtSrc) return;
                      const next = appendPLTaperWeeks(builtSrc, taperWeeksToAdd, {
                        peds: peds.length ? peds : undefined,
                        pedDoses,
                        courseIntensity,
                        mode: pedAuto && peds.length > 0 ? 'on_course' : 'natural',
                        peakExit: { strategy: attemptStrategy },
                        mockMeet: mockMeetOn ? { strategy: attemptStrategy } : undefined,
                        meetWeek: meetWeekOn ? { strategy: attemptStrategy } : undefined,
                      });
                      setBuiltSrc(next);
                      const addCount = (mockMeetOn ? 1 : 0) + taperWeeksToAdd + (meetWeekOn ? 1 : 0);
                      setTaperNote(`+${addCount} нед${mockMeetOn ? ' · 🎯 mock meet' : ''}${meetWeekOn ? ' · 🏁 соревнования' : ''}${pedAuto && peds.length > 0 ? ' · 💉 PED-адаптация как в цикле' : ''} · 🏁 пик ${MEET_STRATEGY_PCT_LABEL[attemptStrategy]}`);
                      setMethodNote(`📉 Тапер применён к активному циклу: +${taperWeeksToAdd} нед(и) — объём ×0.65/×0.45, RIR +1/+2 (Bosquet 2005).${mockMeetOn ? ' 🎯 Имитация соревнований (mock meet) добавлена перед тапером — прикиды-синглы.' : ''}${meetWeekOn ? ' 🏁 Неделя соревнований добавлена в конец — прикиды как подходы дня старта.' : ''} 🏁 Выход на пик: прикиды дня соревнований (${MEET_STRATEGY_LABEL[attemptStrategy]}, ${MEET_STRATEGY_PCT_LABEL[attemptStrategy]}) на финальной тапер-неделе.${pedAuto && peds.length > 0 ? ' 💉 PED-адаптация та же, что в цикле: прогрессия ПМ продолжена по курсу, adaptForPEDs (MRV/восст).' : ''}`);
                    }}
                    style={{ ...BTN_GHOST, flex: 1, minHeight: 44, border: builtSrc ? '1px solid rgba(245,158,11,0.4)' : '1px solid rgba(255,255,255,0.08)', color: builtSrc ? '#f59e0b' : 'rgba(255,255,255,0.3)', fontSize: 11, fontWeight: 700, background: builtSrc ? 'rgba(245,158,11,0.1)' : 'transparent' }}
                    title={builtSrc ? `Добавить ${taperWeeksToAdd} тапер-недели в конец плана${pedAuto && peds.length > 0 ? ' (с учётом PED-курса)' : ''}` : 'Сначала сгенерируйте план'}
                  >📉 Добавить тапер к плану ({taperWeeksToAdd} нед){pedAuto && peds.length > 0 ? ' · 💉' : ''}</button>
                  <button
                    disabled={!builtSrc}
                    onClick={() => {
                      if (!builtSrc) return;
                      if (taperNote) {
                        setBuiltSrc(builtSrc);
                        setTaperNote('');
                        setMethodNote('↺ Тапер уже в плане — сгенерируйте план заново, чтобы убрать.');
                      }
                    }}
                    style={{ ...BTN_GHOST, minHeight: 44, fontSize: 11, border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)', display: taperNote ? 'inline-flex' : 'none' }}
                    title="Тапер уже добавлен — пересоберите план, чтобы начать заново"
                  >ℹ️ в плане</button>
                </div>
                <div style={{ marginTop: 10, padding: 12, borderRadius: 12, background: 'rgba(96,165,250,0.05)', border: '1px solid rgba(96,165,250,0.16)' }}>
                  {/* Шапка */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 800, color: '#60a5fa' }}>🔄 Авто-генерация нового цикла</div>
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', marginTop: 1 }}>Собрать план из каталога СРЦ-циклов с вашими ПМ и параметрами</div>
                    </div>
                    {(() => { const c = getCycleById(selectedCycleId); return c ? (
                      <div style={{ textAlign: 'center', flexShrink: 0 }}>
                        <div style={{ fontSize: 16, fontWeight: 900, color: '#60a5fa', lineHeight: 1.1 }}>{c.meta.weeks} нед</div>
                        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>длина цикла</div>
                      </div>
                    ) : null; })()}
                  </div>
                  {/* Карточка выбранного цикла */}
                  {(() => { const c = getCycleById(selectedCycleId); if (!c) return null; return (
                    <div style={{ padding: '8px 10px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', marginBottom: 8 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.9)' }}>{c.meta.title}</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                        <span style={{ padding: '2px 7px', borderRadius: 6, fontSize: 9, background: 'rgba(96,165,250,0.12)', color: '#93c5fd' }}>{(({ powerlifting: 'Троеборье', bench: 'Жим лёжа', deadlift_bench: 'Тяга+Жим', armwrestling: 'Армрестлинг' } as Record<string, string>)[c.meta.direction] || c.meta.direction)}</span>
                        <span style={{ padding: '2px 7px', borderRadius: 6, fontSize: 9, background: 'rgba(96,165,250,0.12)', color: '#93c5fd' }}>период: {c.meta.period}</span>
                        <span style={{ padding: '2px 7px', borderRadius: 6, fontSize: 9, background: 'rgba(96,165,250,0.12)', color: '#93c5fd' }}>уровень: {c.meta.level}</span>
                        <span style={{ padding: '2px 7px', borderRadius: 6, fontSize: 9, background: 'rgba(96,165,250,0.12)', color: '#93c5fd' }}>{c.meta.sessionsPerWeek} дн/нед</span>
                      </div>
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', marginTop: 4, lineHeight: 1.4 }}>{c.meta.description}</div>
                    </div>
                  ); })()}
                  {/* Селектор + кнопка */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 6 }}>
                    <PopupSelect
                      label="Новый цикл" value={selectedCycleId}
                      options={plCycles.map(c => ({ id: c.meta.id, label: c.meta.title, desc: `${({ powerlifting: 'Троеборье', bench: 'Жим лёжа', deadlift_bench: 'Тяга+Жим', armwrestling: 'Армрестлинг' } as Record<string, string>)[c.meta.direction] || c.meta.direction} · ${c.meta.period} · ${c.meta.weeks} нед` }))}
                      onChange={v => setSelectedCycleId(v)}
                    />
                    <button
                      onClick={() => {
                        try {
                          buildSrc(selectedCycleId);
                          setSrcWeek(1);
                          setMethodNote(`🔄 Новый цикл собран: ${getCycleById(selectedCycleId)?.meta.title ?? selectedCycleId} (${originalCycleWeeks(getCycleById(selectedCycleId)!)} нед)${taperWeeksToAdd > 0 ? `. Тапер: нажмите «Добавить тапер к плану» для +${taperWeeksToAdd} нед` : ''}`);
                        } catch (error) { setMethodNote(`⚠ Не удалось собрать цикл: ${(error as Error).message}`); }
                      }}
                      style={{ ...BTN, minHeight: 44, fontSize: 12, background: 'linear-gradient(135deg,#60a5fa,#3b82f6)', color: '#fff' }}
                    >🔄 Собрать новый цикл</button>
                  </div>
                  {taperWeeksToAdd > 0 && (
                    <div style={{ marginTop: 6, fontSize: 9, color: 'rgba(255,255,255,0.4)', lineHeight: 1.4 }}>
                      💡 После сборки добавьте тапер: кнопка «📉 Добавить тапер к плану ({taperWeeksToAdd} нед)» выше — {mockMeetOn ? '🎯 mock meet, ' : ''}{meetWeekOn ? '🏁 неделя соревнований, ' : ''}прикиды {MEET_STRATEGY_PCT_LABEL[attemptStrategy] ?? MEET_STRATEGY_PCT_LABEL.balanced}.
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
          {builtSrc && (() => {
             const W = builtSrc.weeks;
             const wk = W[Math.min(srcWeek, W.length) - 1] || W[0];
             const totalW = W.length;
             const phase = displayPhaseForWeek(wk, totalW);
             const PH_RU: Record<string,string> = { base: 'База (накопление)', build: 'Накопление (рост объёма)', peak: 'Пик (интенсификация)', deload: 'Разгрузка' };
             const PH_COLOR: Record<string,string> = { base: '#22c55e', build: '#eab308', peak: '#ef4444', deload: '#60a5fa' };
             const PH_DESC: Record<string,string> = {
               base: 'Фаза базы: акклиматизация, наращивание объёма при контроле техники. RIR 2-3, вес = PM_нед × %ПМ.',
               build: 'Фаза накопления: пик объёма (MAV), прогрессия весов, RIR 1-2. КПШ и тоннаж максимальны.',
               peak: 'Пиковая фаза: интенсификация — %ПМ растёт, объём снижается, RIR 0-1. Готовность к тесту/соревнованию.',
               deload: 'Разгрузка: 50-60% объёма, RIR 4, восстановление перед следующим мезоциклом.',
             };
             const sourceCycle = getCycleById(selectedCycleId);
             // Тапер-неделя: добавленная (taperWeek) или legacy-разметка peak/competition
             // (mock meet исключается — это отдельная неделя имитации соревнований).
             // ВАЖНО: проверяем ТОЛЬКО оригинальные недели — иначе добавление тапера
             // «перекрашивает» весь цикл (sourceCalendar обнуляется, все недели теряют свои цвета).
             const isTaperWeek = (w: LMSBuildOutput['weeks'][number]): boolean => w.taperWeek === true || (!w.mockMeet && !w.meetWeek && w.macroPhase === 'competition' && w.sourcePhase === 'peak');
             const isMockWeek = (w: LMSBuildOutput['weeks'][number]): boolean => w.mockMeet === true;
             const isMeetWeek = (w: LMSBuildOutput['weeks'][number]): boolean => w.meetWeek === true;
             const sourceCalendar = sourceCycle && !W.filter(w => !isTaperWeek(w) && !isMockWeek(w) && !isMeetWeek(w)).some(w => w.macroPhase)
                 ? summarizeSourceCycleWeeks(sourceCycle.weeks && sourceCycle.weeks.length > 0
                 ? sourceCycle.weeks
                 : Array.from({ length: originalCycleWeeks(sourceCycle) }, () => sourceCycle.week1), sourceCycle.meta.period, sourceCycle.meta.sourcePhases, sourceCycle.meta.sourcePhaseSource ?? 'original')
               : undefined;
             const TAPER_COLOR = '#f59e0b';
             const MOCK_COLOR = '#a78bfa';
             const MEET_COLOR = '#eab308';
             const sourceWeek = sourceCalendar?.[wk.week - 1];
             const mockPctLabel = wk.meetAttempts ? (MEET_STRATEGY_PCT_LABEL[wk.meetAttempts.strategy] ?? MEET_STRATEGY_PCT_LABEL.balanced) : 'прикиды-синглы';
             const calendarColor = sourceWeek && sourceCalendar ? sourceWeekColor(sourceWeek, sourceCalendar) : isMeetWeek(wk) ? MEET_COLOR : isMockWeek(wk) ? MOCK_COLOR : isTaperWeek(wk) ? TAPER_COLOR : PH_COLOR[phase];
             const calendarTint = sourceWeek ? `color-mix(in srgb, ${calendarColor} 14%, transparent)` : (isMeetWeek(wk) ? MEET_COLOR : isMockWeek(wk) ? MOCK_COLOR : isTaperWeek(wk) ? TAPER_COLOR : PH_COLOR[phase]) + '14';
             const calendarBorderTint = sourceWeek ? `color-mix(in srgb, ${calendarColor} 30%, transparent)` : (isMeetWeek(wk) ? MEET_COLOR : isMockWeek(wk) ? MOCK_COLOR : isTaperWeek(wk) ? TAPER_COLOR : PH_COLOR[phase]) + '30';
             const calendarBadgeTint = sourceWeek ? `color-mix(in srgb, ${calendarColor} 13%, transparent)` : (isMeetWeek(wk) ? MEET_COLOR : isMockWeek(wk) ? MOCK_COLOR : isTaperWeek(wk) ? TAPER_COLOR : PH_COLOR[phase]) + '22';
             const calendarLabel = isMeetWeek(wk)
               ? `🏁 Соревнования · прикиды ${mockPctLabel}`
               : isMockWeek(wk)
               ? `🎯 Имитация соревнований (mock meet) · ${mockPctLabel}`
               : isTaperWeek(wk)
               ? `📉 Тапер · ${Math.round(weekVolumeOf(wk) / Math.max(1, weekVolumeOf(W[W.length - taperWeeksToAdd - 1] ?? W[0]))) * 100}% объёма`
               : sourceWeek
               ? `${SOURCE_PHASE_ORIGIN_LABEL[sourceWeek.phaseOrigin]} · ${SOURCE_PHASE_LABEL[sourceWeek.phase]} · ${Math.round(sourceWeek.intensityPct * 100)}% · ${sourceWeek.volumeSets} сетов`
               : PH_RU[phase];
             const calendarDescription = isMeetWeek(wk)
               ? `Неделя соревнований (день старта): прикиды как подходы — опенер RIR2 → вторая RIR1 → третья RIR0 (${mockPctLabel} от ПМ недели). План полностью готов: разгрузка (тапер) → попытки.`
               : isMockWeek(wk)
               ? `Имитация соревнований за 10-14 дней до старта: основные движения — прикиды-синглы (опенер RIR2 → вторая RIR1 → третья RIR0, ${mockPctLabel} от ПМ), аксессуары — 50% объёма. Проверка стратегии прикидов перед реальным соревнованием.`
               : isTaperWeek(wk)
               ? `Тапер-неделя: объём снижен (×0.65/×0.45), RIR +1/+2, интенсивность сохранена (Bosquet 2005). Разгрузка перед соревнованием.`
               : sourceWeek
               ? `${SOURCE_PHASE_ORIGIN_LABEL[sourceWeek.phaseOrigin]}: ${SOURCE_PHASE_LABEL[sourceWeek.phase]}. ${sourceWeek.volumeSets} рабочих сетов, средняя интенсивность ${Math.round(sourceWeek.intensityPct * 100)}% 1ПМ, средний RIR ${sourceWeek.rir.toFixed(1)}.`
               : PH_DESC[phase];
            return <div style={{ ...CARD, overflow:'hidden', boxSizing:'border-box', maxWidth:'100%' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', gap:8 }}>
                   <div style={{ ...H, margin:0, minWidth:0, overflowWrap:'break-word' }}>План: {builtSrc.template.meta.title}</div>
                 <span style={{ fontSize:11, fontWeight:700, color: calendarColor, background: calendarBadgeTint, padding:'3px 8px', borderRadius:10, flexShrink:0 }}>{calendarLabel}</span>
              </div>
               <div style={{ ...SMALL, marginTop:4, wordBreak:'break-word' }}>{builtSrc.progressionRationale}</div>
               {autoRegMode === 'off' && best && modeMismatchWarning({ goal: goal as any, level: level as any, mode: peds.length > 0 ? 'on_course' : 'natural' }, best.cycle) && (
                 <div role="alert" style={{ marginTop:6, padding:'6px 8px', borderRadius:7, color:'#f59e0b', background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.25)', fontSize:11 }}>
                   ⚠ {modeMismatchWarning({ goal: goal as any, level: level as any, mode: peds.length > 0 ? 'on_course' : 'natural' }, best.cycle)}
                 </div>
               )}
               <div style={{ marginTop:8, padding:'8px 10px', borderRadius:10, background: calendarTint, border:'1px solid '+calendarBorderTint }}>
                <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:4 }}>
                   <span style={{ width:8, height:8, borderRadius:'50%', background: calendarColor, flexShrink:0 }} />
                   <span style={{ fontSize:12, fontWeight:800, color: calendarColor }}>{calendarLabel}</span>
                  <span style={{ fontSize:10, color:'rgba(255,255,255,0.5)', marginLeft:'auto' }}>Неделя {wk.week} из {totalW}</span>
                </div>
                 <div style={{ fontSize:11, color:'rgba(255,255,255,0.7)', lineHeight:1.4, wordBreak:'break-word' }}>{calendarDescription}</div>
              </div>
              {methodHints.label && <div style={{ marginTop:4, fontSize:11, color:'var(--accent)', background:'var(--accent-dim)', border:'1px solid rgba(0,230,138,0.2)', padding:'3px 8px', borderRadius:8, display:'inline-block' }}>🧩 {methodHints.label}{methodHints.volumeMult !== 1 ? ' · объём×' + methodHints.volumeMult : ''}{methodHints.technique ? ' · ' + methodHints.technique : ''}</div>}
              {plWeakPoints.length > 0 && (
                <div style={{ marginTop:8, fontSize:11, color:'#c4b5fd', background:'rgba(139,92,246,0.08)', border:'1px solid rgba(139,92,246,0.25)', padding:'6px 8px', borderRadius:8 }}>
                  <div style={{ fontWeight:700, marginBottom:4 }}>🎯 Слабые точки СРЦ (добавлены ассистенты в план):</div>
                  {plWeakPoints.map((wp, i) => {
                    const rec = getPLWeakPointRecommendations(wp.lift, wp.weakPoint);
                    const liftLabelMap: Record<string, string> = { bench: 'Жим лёжа', squat: 'Присед', deadlift: 'Становая тяга', ohp: 'Жим стоя', row: 'Тяга в наклоне', pulldown: 'Тяга верхнего блока', incline_press: 'Жим на наклонной' };
                    const liftLabel = liftLabelMap[wp.lift] || wp.lift;
                    const assists = rec.corrections.length ? rec.corrections : ['—'];
                    return <div key={i} style={{ marginBottom:2, overflowWrap:'break-word' }}>• <b>{PL_WEAKPOINT_LABELS[wp.weakPoint]}</b> ({liftLabel}): + {assists.join(', ')} — {rec.rationale}</div>;
                  })}
                </div>
              )}
              <div style={{ display:'flex', gap:6, marginTop:8, alignItems:'center', flexWrap:'wrap' }}>
                <button onClick={() => setEditMode(m => !m)} style={{ ...BTN_GHOST, padding:'6px 10px', minHeight:34, fontSize:11 }}>{editMode ? '✓ Готово' : '✏️ Правка плана'}</button>
                {editMode && <button onClick={() => setSrcEdits({})} disabled={Object.keys(srcEdits).length===0} style={{ ...BTN_GHOST, padding:'6px 10px', minHeight:34, fontSize:11, opacity: Object.keys(srcEdits).length===0?0.4:1 }}>↺ Сбросить</button>}
                {editMode && <span style={{ ...SMALL }}>правка недели 1 применяется к «Выполнение»</span>}
              </div>
              {/* P12-wire #2: проф-авторегуляция плана — 3 режима (off/auto/diary) */}
              {(() => {
                const stt = shouldTrainToday({ readiness: linked.readiness?.recovery ?? 80, acwr: autoRegResult.deload ? { ratio: 1.8, zone: 'dangerous' } : { ratio: 1.0, zone: 'optimal' }, fatigue: linked.readiness?.fatigue ?? 30, hrvRatio: linked.profile?.settings?.baselineHrvRatio ?? 1.0, combinedRirShift: autoRegMode === 'auto' ? autoRegResult.rirShift + bridgeRir : bridgeRir });
                const modeColor = autoRegMode === 'auto' ? '#60a5fa' : autoRegMode === 'diary' ? '#22c55e' : '#71717a';
                const segBtn = (m: AutoRegMode, label: string) => (
                  <button onClick={() => setAutoRegMode(m)} style={{ padding:'5px 10px', borderRadius:6, fontSize:11, fontWeight:700, cursor:'pointer', border:'none', background: autoRegMode === m ? modeColor : 'rgba(255,255,255,0.08)', color: autoRegMode === m ? '#000' : 'rgba(255,255,255,0.6)' }}>{label}</button>
                );
                return (
                  <div style={{ marginTop:8, padding:'8px 10px', borderRadius:10, background: autoRegMode === 'off' ? 'rgba(255,255,255,0.02)' : autoRegResult.deload ? 'rgba(239,68,68,0.08)' : autoRegMode === 'diary' ? 'rgba(34,197,94,0.06)' : 'rgba(96,165,250,0.06)', border: '1px solid ' + (autoRegMode === 'off' ? 'rgba(255,255,255,0.06)' : autoRegResult.deload ? 'rgba(239,68,68,0.25)' : autoRegMode === 'diary' ? 'rgba(34,197,94,0.2)' : 'rgba(96,165,250,0.2)') }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:4 }}>
                      <div>
                        <span style={{ fontSize:11, fontWeight:700, color: stt.train ? (autoRegResult.deload && autoRegMode !== 'off' ? '#ef4444' : modeColor) : '#ef4444' }}>
                          {stt.train ? '✅' : '⚠️'} {stt.reason}
                        </span>
                        {autoRegMode !== 'off' && autoRegResult.intensityNote && <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: autoRegResult.intensityNote === 'силовая' ? 'rgba(239,68,68,0.15)' : autoRegResult.intensityNote === 'восстановительная' ? 'rgba(34,197,94,0.15)' : 'rgba(245,158,11,0.15)', color: autoRegResult.intensityNote === 'силовая' ? '#ef4444' : autoRegResult.intensityNote === 'восстановительная' ? '#22c55e' : '#f59e0b' }}>{autoRegResult.intensityNote === 'силовая' ? 'СИЛОВАЯ' : autoRegResult.intensityNote === 'восстановительная' ? 'ВОССТАНОВИТ.' : autoRegResult.intensityNote === 'лёгкая' ? 'ЛЁГКАЯ' : ''}</span>}
                      </div>
                      <div style={{ display:'flex', gap:3, alignItems:'center' }}>
                        <span style={{ fontSize:10, fontWeight:700, color: modeColor, marginRight: 4 }}>Авторегуляция:</span>
                        {segBtn('off', 'ВЫКЛ')}
                        {segBtn('auto', 'АВТО')}
                        {segBtn('diary', 'ДНЕВНИК')}
                      </div>
                    </div>
                    {autoRegMode === 'auto' && <div style={{ marginTop:6, fontSize:11, color:'rgba(255,255,255,0.7)' }}>
                      <div>Топ-сет ×{autoRegResult.topSetPctMultiplier} · объём ×{autoRegResult.volumeMultiplier} · RIR +{autoRegResult.rirShift}{autoRegResult.deload ? ' · 🔴 DELOAD' : ''}</div>
                      {autoRegResult.decisions.slice(0,3).map((d, i) => <div key={i} style={{ marginTop:2, color:'rgba(255,255,255,0.55)' }}>• {d}</div>)}
                    </div>}
                    {autoRegMode === 'diary' && diaryAutoreg && <div style={{ marginTop:6, fontSize:11, color:'rgba(255,255,255,0.7)' }}>
                      <div style={{ fontWeight:700, color: '#22c55e' }}>✓ {diaryAutoreg.summary.adjusted} скорректировано · {diaryAutoreg.summary.unchanged} в норме · {diaryAutoreg.summary.noData} без данных</div>
                      {diaryAutoreg.summary.noData > 0 && <div style={{ marginTop:2, color:'#f59e0b' }}>⚠ {diaryAutoreg.summary.noData} упражнений без данных дневника — плановые веса</div>}
                      {[...diaryAutoreg.perExercise.entries()].filter(([,v]) => v.source === 'diary').slice(0,4).map(([name, adj], i) => <div key={i} style={{ marginTop:2, color:'rgba(255,255,255,0.55)' }}>• {name}: {adj.factWeight}кг→{adj.adjustedWeight}кг (RPE {adj.factRPE}) {adj.note}</div>)}
                      {diaryAutoreg.plateauWarnings.map((w, i) => <div key={'pw'+i} style={{ marginTop:2, color:'#ef4444' }}>🔴 {w}</div>)}
                    </div>}
                    {autoRegMode === 'diary' && !diaryAutoreg && <div style={{ marginTop:6, fontSize:11, color:'#f59e0b' }}>⚠ Постройте план и выберите неделю — дневниковая авторегуляция применится к весам.</div>}
                  </div>
                );
              })()}
              {/* Exercise picker popup */}
              {pickerDay && (
                <div style={{ position:'fixed', inset:0, zIndex:200, display:'flex', background:'rgba(0,0,0,0.9)' }} onClick={() => setPickerDay(null)}>
                  <div onClick={e => e.stopPropagation()} style={{ width:'100%', maxWidth:480, margin:'0 auto', background:'#18181b', display:'flex', flexDirection:'column' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 12px 0' }}>
                      <span style={{ fontSize:14, fontWeight:700, color:'var(--accent)' }}>＋ Упражнение в день</span>
                      <button onClick={() => setPickerDay(null)} style={{ fontSize:11, color:'#ef4444', border:'none', background:'transparent', cursor:'pointer', padding:'4px 8px' }}>✕</button>
                    </div>
                    <div style={{ flex:1, overflowY:'auto', padding:'8px 12px 80px' }}>
                      <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginBottom:8 }}>{CAT_GROUPS.map(g => <button key={g} onClick={() => { setPickerGroup(g); setPickerExName(''); }} style={{ padding:'5px 10px', borderRadius:16, fontSize:11, cursor:'pointer', border: pickerGroup===g?'1px solid var(--accent)':'1px solid rgba(255,255,255,0.08)', background: pickerGroup===g?'rgba(0,230,138,0.15)':'rgba(255,255,255,0.03)', color: pickerGroup===g?'var(--accent)':'rgba(255,255,255,0.7)' }}>{GRP_RU[g]||g}</button>)}</div>
                      <select value={pickerExName} onChange={e => setPickerExName(e.target.value)} style={{ ...SEL, marginBottom:8 }}>
                        <option value=''>— выберите упражнение —</option>
                        {getExercisesByGroup(pickerGroup).map(ex => <option key={ex.id} value={ex.name}>{ex.name}</option>)}
                      </select>
                      <div style={{ display:'flex', flexWrap:'wrap', gap:6, alignItems:'center', marginBottom:8 }}>
                        <span style={{ fontSize:11, color:'rgba(255,255,255,0.6)' }}>Подходы</span>
                        <input type='number' value={pickerScheme.sets} onChange={e => setPickerScheme(s => ({ ...s, sets: +e.target.value }))} style={{ width:48, ...IN, padding:'4px', fontSize:11 }} />
                        <span style={{ fontSize:11 }}>×</span>
                        <input type='number' value={pickerScheme.reps} onChange={e => setPickerScheme(s => ({ ...s, reps: +e.target.value }))} style={{ width:48, ...IN, padding:'4px', fontSize:11 }} />
                        <span style={{ fontSize:11 }}>×</span>
                        <input type='number' value={pickerScheme.weight} onChange={e => setPickerScheme(s => ({ ...s, weight: +e.target.value }))} style={{ width:56, ...IN, padding:'4px', fontSize:11 }} />
                        <span style={{ fontSize:11, color:'rgba(255,255,255,0.5)' }}>кг</span>
                      </div>
                      <button onClick={() => addExToDay(pickerDay)} disabled={!pickerExName} style={{ width:'100%', padding:'10px', borderRadius:8, border:'none', cursor:'pointer', fontWeight:700, fontSize:11, background: pickerExName ? 'linear-gradient(135deg,var(--accent),#00c8a0)' : 'rgba(255,255,255,0.1)', color: pickerExName ? '#000' : 'rgba(255,255,255,0.3)' }}>Добавить в день</button>
                    </div>
                  </div>
                </div>
              )}
              <div style={{ marginTop:10 }}>
                <div style={{ fontSize:12, color:'rgba(255,255,255,0.7)', marginBottom:6, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <span style={{ fontWeight:700, color:'#fff' }}>Неделя {wk.week} из {totalW}</span>
                  <span style={{ fontSize:11, fontWeight:700, color:calendarColor, background:calendarBadgeTint, padding:'2px 10px', borderRadius:8 }}>{calendarLabel}</span>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(36px, 1fr))', gap:4 }}>
                   {W.map(w => { const ph = displayPhaseForWeek(w, totalW); const original = sourceCalendar?.[w.week - 1]; const taper = isTaperWeek(w); const mock = isMockWeek(w); const meet = isMeetWeek(w); const color = original && sourceCalendar ? sourceWeekColor(original, sourceCalendar) : meet ? MEET_COLOR : mock ? MOCK_COLOR : taper ? TAPER_COLOR : PH_COLOR[ph]; const tint = original ? `color-mix(in srgb, ${color} 13%, transparent)` : color + '1a'; const label = original ? `${SOURCE_PHASE_ORIGIN_LABEL[original.phaseOrigin]} · ${SOURCE_PHASE_LABEL[original.phase]} ${Math.round(original.intensityPct * 100)}% · ${original.volumeSets} сетов` : meet ? `🏁 Соревнования · прикиды ${MEET_STRATEGY_PCT_LABEL[w.meetAttempts?.strategy ?? attemptStrategy] ?? MEET_STRATEGY_PCT_LABEL.balanced}` : mock ? `🎯 Имитация соревнований (mock meet) · прикиды-синглы` : taper ? `📉 Тапер · ${Math.round(weekVolumeOf(w) / Math.max(1, weekVolumeOf(W[W.length - taperWeeksToAdd - 1] ?? W[0]))) * 100}% объёма` : PH_RU[ph]; const active = w.week===wk.week; return <button key={w.week} onClick={() => setSrcWeek(w.week)} title={'Неделя '+w.week+': '+label} style={{ padding:'6px 0', borderRadius:8, border: active ? '1px solid var(--accent)' : '1px solid rgba(255,255,255,0.08)', background: active ? color : tint, color: active ? '#000' : '#fff', fontSize:11, fontWeight:700, cursor:'pointer', minHeight:36, minWidth:0 }}>{meet ? '🏁' : mock ? '🎯' : taper ? '📉' : w.week}</button>; })}
                </div>
              </div>
              {/* Визуальный календарь мезоцикла: недели × дни с тоннажём и фазой */}
              <div style={{ marginTop: 8, padding: 8, borderRadius: 10, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.6)', marginBottom: 6 }}>📅 Календарь мезоцикла (нед × дни, тоннаж)</div>
                {(W.some(isTaperWeek) || W.some(isMockWeek) || W.some(isMeetWeek)) && (
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 6, fontSize: 9, color: 'rgba(255,255,255,0.55)' }}>
                    {W.some(isTaperWeek) && <span><span style={{ color: TAPER_COLOR }}>📉</span> тапер · разгрузка</span>}
                    {W.some(isMockWeek) && <span><span style={{ color: MOCK_COLOR }}>🎯</span> mock meet · прикиды-синглы</span>}
                    {W.some(isMeetWeek) && <span><span style={{ color: MEET_COLOR }}>🏁</span> соревнования · прикиды</span>}
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {W.map(w => { const ph = displayPhaseForWeek(w, totalW); const original = sourceCalendar?.[w.week - 1]; const taper = isTaperWeek(w); const mock = isMockWeek(w); const meet = isMeetWeek(w); const color = original && sourceCalendar ? sourceWeekColor(original, sourceCalendar) : meet ? MEET_COLOR : mock ? MOCK_COLOR : taper ? TAPER_COLOR : PH_COLOR[ph]; const colorFade = original ? `color-mix(in srgb, ${color} 55%, transparent)` : color + '88'; const active = w.week === wk.week; const maxT = Math.max(1, ...W.map(ww => ww.days.reduce((s, d) => s + d.metrics.tonnage, 0))); const wTotal = w.days.reduce((s, d) => s + d.metrics.tonnage, 0); return (
                    <div key={w.week} onClick={() => setSrcWeek(w.week)} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 6px', borderRadius: 6, cursor: 'pointer', background: active ? (meet ? 'rgba(234,179,8,0.12)' : mock ? 'rgba(167,139,250,0.12)' : taper ? 'rgba(245,158,11,0.1)' : 'var(--accent-dim)') : 'transparent', border: active ? (meet ? '1px solid rgba(234,179,8,0.45)' : mock ? '1px solid rgba(167,139,250,0.45)' : taper ? '1px solid rgba(245,158,11,0.4)' : '1px solid rgba(0,230,138,0.3)') : '1px solid transparent' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: active ? (meet ? '#eab308' : mock ? '#a78bfa' : taper ? '#f59e0b' : 'var(--accent)') : 'rgba(255,255,255,0.7)', minWidth: 26 }}>{meet ? '🏁' : mock ? '🎯' : taper ? '📉' : 'Н' + w.week}</span>
                       <span style={{ width: 4, height: 14, borderRadius: 2, background: color, flexShrink: 0 }} title={original ? `${SOURCE_PHASE_ORIGIN_LABEL[original.phaseOrigin]} · ${SOURCE_PHASE_LABEL[original.phase]}: ${Math.round(original.intensityPct * 100)}% · ${original.volumeSets} сетов` : meet ? '🏁 Соревнования: прикиды как подходы' : mock ? '🎯 Имитация соревнований: прикиды-синглы' : taper ? '📉 Тапер: объём снижен, RIR +1/+2, интенсивность сохранена' : PH_RU[ph]} />
                      <div style={{ flex: 1, display: 'flex', gap: 2 }}>
                          {w.days.map((d, di) => { const t = d.metrics.tonnage; return <div key={di} title={'Д' + (di+1) + ': ' + t.toFixed(0) + ' кг·пов'} style={{ flex: 1, height: 14, borderRadius: 3, background: t > 0 ? `linear-gradient(180deg, ${color}, ${colorFade})` : 'rgba(255,255,255,0.04)', opacity: 0.4 + 0.6 * (t / maxT) }} />; })}
                      </div>
                      <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', minWidth: 38, textAlign: 'right' }}>{wTotal.toFixed(0)}</span>
                    </div>
                  ); })}
                </div>
              </div>
              <div style={{ ...SMALL, marginTop:6, color:'rgba(255,255,255,0.7)' }}>{calendarDescription}</div>
              <MetricCard title={'ПМ на неделю '+wk.week+' (прогрессия)'} icon="📈" accent="#60a5fa">
                <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>{Object.entries(wk.pmRow).map(([n, pm]) => <span key={n} style={{ ...SMALL, color:'#fff', background:'rgba(96,165,250,0.08)', padding:'3px 8px', borderRadius:6, border:'1px solid rgba(96,165,250,0.15)' }}><b>{n}:</b> {pm.toFixed(1)} кг</span>)}</div>
              </MetricCard>
              {/* График прогрессии ПМ по неделям */}
              {builtSrc && Array.isArray(builtSrc.weeks) && builtSrc.weeks.length > 0 && (() => {
                const exNames = Object.keys(builtSrc.weeks[0]?.pmRow || {}).slice(0, 3);
                if (exNames.length === 0) return null;
                const allVals = builtSrc.weeks.flatMap(w => exNames.map(n => w.pmRow[n] || 0));
                const minV = Math.min(...allVals), maxV = Math.max(...allVals);
                const W2 = builtSrc.weeks.length;
                const colors = ['var(--accent)', '#60a5fa', '#a855f7'];
                const px = (i: number) => 24 + (i / Math.max(1, W2 - 1)) * 280;
                const py = (v: number) => 70 - ((v - minV) / Math.max(1, maxV - minV)) * 56;
                return <div style={{ marginTop: 8, padding: 10, borderRadius: 10, background: 'rgba(96,165,250,0.05)', border: '1px solid rgba(96,165,250,0.15)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#60a5fa', marginBottom: 6 }}>📈 Прогрессия ПМ по неделям</div>
                  <svg width="100%" viewBox="0 0 320 80" style={{ maxWidth: 360, margin: '0 auto', display: 'block' }}>
                    {[0,1,2,3].map(g => <line key={g} x1={24} x2={304} y1={14 + g * 18} y2={14 + g * 18} stroke="rgba(255,255,255,0.06)" strokeWidth={0.5} />)}
                    {exNames.map((n, ei) => { const pts = builtSrc.weeks.map((w, i) => `${px(i)},${py(w.pmRow[n] || 0)}`).join(' '); return <polyline key={n} points={pts} fill="none" stroke={colors[ei]} strokeWidth={1.6} />; })}
                    {exNames.map((n, ei) => builtSrc.weeks.map((w, i) => <circle key={n + i} cx={px(i)} cy={py(w.pmRow[n] || 0)} r={2} fill={colors[ei]} />))}
                  </svg>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center', marginTop: 4 }}>{exNames.map((n, ei) => <span key={n} style={{ fontSize: 10, color: colors[ei] }}>● {n}</span>)}</div>
                </div>;
              })()}
              {(goal === 'peak' || W.some(isTaperWeek) || W.some(isMeetWeek) || W.some(isMockWeek)) && (() => {
                const hasDiary = e1rmSeries.length > 0;
                const diaryLast = (lift: 'squat' | 'bench' | 'deadlift'): number | null => {
                  const keywords: Record<typeof lift, string[]> = { squat: ['присед'], bench: ['жим лёжа', 'жим лежа'], deadlift: ['становая'] };
                  const series = e1rmSeries.find(s => keywords[lift].some(k => s.label.toLowerCase().includes(k) || s.lift === lift));
                  return series?.pts.at(-1)?.val ?? null;
                };
                const diaryVals = { squat: diaryLast('squat'), bench: diaryLast('bench'), deadlift: diaryLast('deadlift') };
                const diaryApplied = Object.values(diaryVals).some(v => v != null);
                return (
                <MetricCard title={`🏁 Попытки на соревнования${W.some(isTaperWeek) ? ` · ${MEET_STRATEGY_PCT_LABEL[attemptStrategy] ?? MEET_STRATEGY_PCT_LABEL.balanced}` : ''}`} icon="🏁" accent="#f59e0b">
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                    {([['Присед', pmSquat], ['Жим', pmBench], ['Становая', pmDead]] as const).map(([name, value]) => {
                      const a = competitionAttempts(value);
                      return <div key={name} style={{ padding: 6, borderRadius: 6, background: 'rgba(245,158,11,0.08)', fontSize: 10 }}><b>{name}</b><div>1: {a.openerRange[0]}–{a.openerRange[1]} кг</div><div>2: {a.secondRange[0]}–{a.secondRange[1]} кг</div><div>3: {a.thirdRange[0]}–{a.thirdRange[1]} кг</div><div style={{ color: '#f59e0b', marginTop: 3 }}>рекоменд.: {a.opener}/{a.second}/{a.third}</div></div>;
                    })}
                  </div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    <button
                      disabled={!hasDiary}
                      onClick={() => {
                        calibratePmFromDiary('squat'); calibratePmFromDiary('bench'); calibratePmFromDiary('deadlift');
                        setMethodNote('📈 ПМ обновлены из дневника — попытки на соревнования пересчитаны автоматически.');
                      }}
                      style={{ ...BTN_GHOST, minHeight: 36, fontSize: 10, border: hasDiary ? '1px solid rgba(0,230,138,0.35)' : '1px solid rgba(255,255,255,0.08)', color: hasDiary ? '#00e68a' : 'rgba(255,255,255,0.3)', background: hasDiary ? 'rgba(0,230,138,0.08)' : 'transparent' }}
                      title="Заполнить ПМ из последних 1ПМ дневника тренировок (как в полях ПМ) — попытки пересчитаются"
                    >📈 Из дневника{diaryApplied ? ` (присед ${diaryVals.squat ?? '—'} · жим ${diaryVals.bench ?? '—'} · тяга ${diaryVals.deadlift ?? '—'})` : ''}</button>
                    {!hasDiary && <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>нет записей в дневнике — попытки от введённых ПМ</span>}
                  </div>
                </MetricCard>
                );
              })()}
              {(wk.meetAttempts && wk.meetAttempts.lifts.length > 0) && (
                <MetricCard title={`${wk.meetWeek ? '🏁 Неделя соревнований' : wk.mockMeet ? '🎯 Имитация соревнований (mock meet)' : '🏁 Соревновательный день'} · прикиды ${MEET_STRATEGY_PCT_LABEL[wk.meetAttempts.strategy] ?? MEET_STRATEGY_PCT_LABEL.balanced} (неделя ${wk.week})`} icon={wk.meetWeek ? '🏁' : wk.mockMeet ? '🎯' : '🏁'} accent={wk.meetWeek ? '#eab308' : wk.mockMeet ? '#a78bfa' : '#f59e0b'}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 6 }}>
                    {wk.meetAttempts.lifts.map(l => (
                      <div key={l.name} style={{ padding: 6, borderRadius: 6, background: wk.meetWeek ? 'rgba(234,179,8,0.08)' : wk.mockMeet ? 'rgba(167,139,250,0.08)' : 'rgba(245,158,11,0.08)', border: `1px solid ${wk.meetWeek ? 'rgba(234,179,8,0.3)' : wk.mockMeet ? 'rgba(167,139,250,0.25)' : 'rgba(245,158,11,0.2)'}`, fontSize: 10 }}>
                        <b style={{ color: wk.meetWeek ? '#eab308' : wk.mockMeet ? '#a78bfa' : '#f59e0b' }}>{l.name}</b>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4, marginTop: 4 }}>
                          <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.04)', borderRadius: 6, padding: '4px 2px' }}><div style={{ color: 'rgba(255,255,255,0.5)' }}>1-я</div><b style={{ fontSize: 12 }}>{l.opener}</b></div>
                          <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.04)', borderRadius: 6, padding: '4px 2px' }}><div style={{ color: 'rgba(255,255,255,0.5)' }}>2-я</div><b style={{ fontSize: 12 }}>{l.second}</b></div>
                          <div style={{ textAlign: 'center', background: wk.meetWeek ? 'rgba(234,179,8,0.14)' : wk.mockMeet ? 'rgba(167,139,250,0.14)' : 'rgba(245,158,11,0.12)', borderRadius: 6, padding: '4px 2px', border: `1px solid ${wk.meetWeek ? 'rgba(234,179,8,0.4)' : wk.mockMeet ? 'rgba(167,139,250,0.35)' : 'rgba(245,158,11,0.3)'}` }}><div style={{ color: 'rgba(255,255,255,0.5)' }}>3-я</div><b style={{ fontSize: 12, color: wk.meetWeek ? '#eab308' : wk.mockMeet ? '#a78bfa' : '#f59e0b' }}>{l.third}</b></div>
                        </div>
                      </div>
                    ))}
                  </div>
                  {/* Разминка по опенеру (как в тапер-калькуляторе) */}
                  {(() => {
                    const opener = wk.meetAttempts!.lifts[0]?.opener;
                    if (!opener) return null;
                    const steps = MEET_WARMUP_STEPS.map(p => ({ pct: p, weight: Math.round(opener * p * 2) / 2, reps: p < 0.7 ? 5 : p < 0.85 ? 3 : 1 }));
                    return (
                      <div style={{ marginTop: 6, fontSize: 10, color: 'rgba(255,255,255,0.6)', lineHeight: 1.5 }}>
                        🔥 Разминка под опенер {opener} кг ({wk.meetAttempts!.lifts[0]?.name}): {steps.map(s => `${Math.round(s.pct * 100)}%×${s.reps}`).join(' → ')} ({steps.map(s => s.weight).join('/')} кг)
                      </div>
                    );
                  })()}
                  {/* Последние тяжёлые движения (тайминг разгрузки) */}
                  <div style={{ marginTop: 4, fontSize: 10, color: 'rgba(255,255,255,0.6)', lineHeight: 1.5 }}>
                    ⏱ Последние тяжёлые: {([['Присед', LAST_HEAVY_DAYS.squat], ['Жим', LAST_HEAVY_DAYS.bench], ['Тяга', LAST_HEAVY_DAYS.deadlift]] as const).map(([n, d]) => `${n} — за ${d} дн.`).join(' · ')} до старта.
                  </div>
                  <div style={{ marginTop: 6, fontSize: 10, color: 'rgba(255,255,255,0.55)', lineHeight: 1.45 }}>
                    {wk.meetWeek
                      ? '🏁 День старта: прикиды — реальные попытки на соревнованиях (опенер RIR2 → вторая RIR1 → третья RIR0). Разгрузка выполнена тапер-неделями — план полностью готов.'
                      : wk.mockMeet
                      ? '🎯 Это ТРЕНИРОВОЧНАЯ неделя за 10-14 дней до старта: прикиды-синглы на 100% усилия (опенер RIR2 → вторая RIR1 → третья RIR0) — проверка стратегии. После неё — тапер-разгрузка, а затем реальные прикиды на соревнованиях.'
                      : '📉 Разгрузка уже выполнена тапер-неделями (объём ×0.65/×0.45, RIR +1/+2, интенсивность сохранена — Bosquet 2005). Прикиды — план дня соревнований, не тренировочная нагрузка: разминка по опенеру, подходы строго по стратегии, между попытками 10-20 мин.'}
                  </div>
                </MetricCard>
              )}
              {e1rmSeries.length > 0 && (() => {
                const W = 300, H = 120, PADX = 26, PADY = 16;
                const allVals = e1rmSeries.flatMap(s => s.pts.map(p => p.val));
                const minV = Math.min(...allVals, pmSquat, pmBench, pmDead);
                const maxV = Math.max(...allVals, pmSquat, pmBench, pmDead);
                const maxPts = Math.max(...e1rmSeries.map(s => s.pts.length), 1);
                const px = (i: number) => PADX + (maxPts <= 1 ? 0 : (i / (maxPts - 1)) * (W - PADX - 8));
                const py = (v: number) => H - PADY - ((v - minV) / ((maxV - minV) || 1)) * (H - PADY - 14);
                return (
                  <MetricCard title={'Прогресс 1ПМ (дневник тренировок)'} icon="📈">
                    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }}>
                      {[0, 1, 2, 3].map(g => <line key={g} x1={PADX} x2={W - 8} y1={14 + g * ((H - PADY - 14) / 3)} y2={14 + g * ((H - PADY - 14) / 3)} stroke="rgba(255,255,255,0.06)" strokeWidth={0.5} />)}
                      {e1rmSeries.map(s => <polyline key={s.lift} points={s.pts.map((p, i) => `${px(i)},${py(p.val)}`).join(' ')} fill="none" stroke={s.color} strokeWidth={1.6} />)}
                      {e1rmSeries.map(s => s.pts.map((p, i) => <circle key={s.lift + i} cx={px(i)} cy={py(p.val)} r={2} fill={s.color} />))}
                    </svg>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center', marginTop: 4 }}>{e1rmSeries.map(s => <span key={s.lift} style={{ fontSize: 11, color: s.color }}>● {s.label} {s.pts[s.pts.length - 1].val} кг</span>)}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4, textAlign: 'center' }}>PM0 плана: присед {pmSquat} · жим {pmBench} · становая {pmDead} кг</div>
                    {exerciseE1rm.length > 0 && (
                      <div style={{ marginTop: 10, borderTop: '1px solid var(--accent-dim)', paddingTop: 8 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', marginBottom: 4 }}>Личные 1ПМ по упражнениям (из дневника):</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto auto', gap: '3px 8px', fontSize: 11, alignItems: 'center' }}>
                          <div style={{ color: 'var(--text-dim)', fontWeight: 600 }}>Упражнение</div>
                          <div style={{ color: 'var(--text-dim)', fontWeight: 600, textAlign: 'right' }}>1ПМ</div>
                          <div style={{ color: 'var(--text-dim)', fontWeight: 600, textAlign: 'right' }}>подход</div>
                          {exerciseE1rm.slice(0, 15).map((e) => (
                            <React.Fragment key={e.name}>
                              <div style={{ color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{e.name}</div>
                              <div style={{ color: 'var(--accent)', fontWeight: 700, textAlign: 'right' }}>{e.e1}</div>
                              <div style={{ color: 'rgba(255,255,255,0.5)', textAlign: 'right' }}>{e.w}×{e.r}</div>
                            </React.Fragment>
                          ))}
                        </div>
                        {exerciseE1rm.length > 15 && <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 4, textAlign: 'center' }}>показано 15 из {exerciseE1rm.length}</div>}
                      </div>
                    )}
                    {exerciseE1rm.length > 0 && (
                      <div style={{ marginTop: 10, borderTop: '1px solid var(--accent-dim)', paddingTop: 8 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', marginBottom: 4 }}>Тренд 1ПМ по упражнению (график во времени):</div>
                        <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginBottom: 6 }}>
                          {exerciseE1rm.slice(0, 10).map((e) => (
                            <button key={e.name} onClick={() => setSelectedTrendEx(s => s === e.name ? null : e.name)}
                              style={{ padding: '2px 7px', borderRadius: 10, fontSize: 10, fontWeight: 600, cursor: 'pointer',
                                border: selectedTrendEx === e.name ? '1px solid var(--accent)' : '1px solid rgba(255,255,255,0.08)',
                                background: selectedTrendEx === e.name ? 'var(--accent-dim)' : 'rgba(255,255,255,0.03)',
                                color: selectedTrendEx === e.name ? 'var(--accent)' : 'rgba(255,255,255,0.6)' }}>
                              {e.name} ({e.e1}кг)
                            </button>
                          ))}
                        </div>
                        {selectedTrendEx && exTrendSeries.length >= 2 && (() => {
                          const W = 300, H = 100, PADX = 28, PADY = 16;
                          const vals = exTrendSeries.map(p => p.e1);
                          const minV = Math.min(...vals) - 5;
                          const maxV = Math.max(...vals) + 5;
                          const n = exTrendSeries.length;
                          const px = (i: number) => PADX + (i / Math.max(n - 1, 1)) * (W - PADX - 8);
                          const py = (v: number) => H - PADY - ((v - minV) / ((maxV - minV) || 1)) * (H - PADY - 12);
                          return (
                            <div>
                              <div style={{ fontSize: 10, color: 'var(--accent)', fontWeight: 700, marginBottom: 2 }}>{selectedTrendEx}</div>
                              <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }}>
                                {[0, 1, 2].map(g => <line key={g} x1={PADX} x2={W - 8} y1={12 + g * ((H - PADY - 12) / 2)} y2={12 + g * ((H - PADY - 12) / 2)} stroke="rgba(255,255,255,0.05)" strokeWidth={0.5} />)}
                                <polyline points={exTrendSeries.map((p, i) => `${px(i)},${py(p.e1)}`).join(' ')} fill="none" stroke="var(--accent)" strokeWidth={1.8} />
                                {exTrendSeries.map((p, i) => <circle key={i} cx={px(i)} cy={py(p.e1)} r={2.5} fill="var(--accent)" />)}
                              </svg>
                              <div style={{ display: 'flex', gap: 8, marginTop: 2, flexWrap: 'wrap' }}>
                                <span style={{ fontSize: 10, color: 'var(--accent)' }}>посл: {exTrendSeries[exTrendSeries.length - 1].e1}кг</span>
                                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>макс: {maxV.toFixed(0)}кг</span>
                                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>тренировок: {n}</span>
                              </div>
                            </div>
                          );
                        })()}
                        {selectedTrendEx && exTrendSeries.length < 2 && (
                          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>нужно ≥2 тренировок для графика (найдено {exTrendSeries.length})</div>
                        )}
                      </div>
                    )}
                  </MetricCard>
                );
              })()}
              <div style={{ marginTop:8, display:'flex', gap:6, flexWrap:'wrap' }}>
                <SaveButton label="💾 Сохранить программу" savedLabel="✓ Программа сохранена" onSave={() => {
                  try {
                    const cycle = LMS_CYCLES.find(c => c.meta.id === selectedCycleId);
                    // Полный формат «Моих тренировок»: id + exercises (иначе вкладка «Планы» крашится на plan.exercises.length).
                    const week1 = builtSrc.weeks[0];
                    const exercises = week1 ? week1.days.flatMap(d => d.exercises.map(e => ({
                      name: e.name,
                      sets: e.workSets.reduce((s, ws) => s + ws.sets, 0),
                      reps: e.workSets[0]?.reps ?? 5,
                      rir: e.workSets[0]?.rir ?? e.rir ?? 2,
                    }))) : [];
                    const plan = { id: 'plplan_' + Date.now(), name: `PL ${cycle?.meta.title || selectedCycleId || 'цикл'}`, date: new Date().toISOString(), exercises, weekCount: totalW, cycleWeeks };
                    const existing = JSON.parse(localStorage.getItem('myTrainingPlans') || '[]');
                    // Отбрасываем битые записи старых версий (без exercises) — они ломали рендер «Планы».
                    const updated = [...(Array.isArray(existing) ? existing : []).filter((p: any) => p && typeof p === 'object' && Array.isArray(p.exercises)), plan].slice(-30);
                    localStorage.setItem('myTrainingPlans', JSON.stringify(updated));
                    setMethodNote(`✓ Программа сохранена в «Мои тренировки»: ${plan.name} — ${exercises.length} упр. · ${totalW} нед`);
                  } catch (e) { setMethodNote(`⚠ Ошибка сохранения: ${(e as Error).message}`); }
                }} />
                <button
                  onClick={() => {
                    if (!builtSrc || playerDays.length === 0) { setMethodNote('⚠ Сначала сгенерируйте план'); return; }
                    try {
                      // План уже пишется в he_pl_runtime эффектом выше; фиксируем выбранную неделю явно.
                      localStorage.setItem('he_pl_runtime', JSON.stringify({ days: playerDays, focus: runFocus, week: srcWeek, track: 'pl' }));
                      localStorage.setItem('he_training_tab', 'runtime');
                      if (typeof (window as any).__navigateToTrainingTab === 'function') {
                        (window as any).__navigateToTrainingTab('runtime');
                      } else {
                        setMethodNote('▶ План готов к выполнению: откройте «Тренировки → Проведение тренировки».');
                      }
                    } catch (e) { setMethodNote(`⚠ Не удалось запустить: ${(e as Error).message}`); }
                  }}
                  style={{ flex: 1, padding: '12px', borderRadius: 10, border: 'none', cursor: 'pointer', minHeight: 44,
                    background: 'linear-gradient(135deg,#3b82f6,#2563eb)', color: '#fff', fontWeight: 800, fontSize: 12 }}
                  title="Записать план в «Проведение тренировки» и открыть выполнение (SessionPlayer)"
                >▶ Начать работу по циклу</button>
              </div>
              {wk.days.map((d, di) => {
                const sourcePhase = sourceWeek?.phase || phase;
                const dayPhase: PhaseKey = ({ base: 'accumulation', build: 'intensification', peak: 'peaking', deload: 'deload' } as Record<string, PhaseKey>)[sourcePhase] || 'accumulation';
                const loadStr = d.exercises[0]?.load ? ' · ' + d.exercises[0].load : '';
                const volumeTag = `${d.metrics.tonnage.toFixed(0)}т · ${d.metrics.kpsh}КПШ · УОИ ${d.metrics.uoi.toFixed(2)}`;
                const roleOf = (load?: string) => (load === 'main' ? 'main' : load === 'additional' ? 'additional' : 'accessory');
                const dk = dayKey(wk.week, di);
                if (editMode) {
                  return (
                    <DayCard key={di} day={{
                      key: 'day-' + di,
                      title: `🏋️ День ${di + 1}${loadStr}`,
                      phase: dayPhase,
                      volumeTag,
                      renderBody: (
                        <>
                           {d.exercises.map((e, ei) => (
                              <div key={ei} style={{ background:'rgba(255,255,255,0.02)', borderRadius:8, padding:'6px 8px', marginBottom:4, border:'1px solid rgba(255,255,255,0.04)', overflow:'hidden', boxSizing:'border-box' }}>
                               <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8, marginBottom:2 }}>
                                 <span style={{ fontSize:11, fontWeight:600, color:'#fff', flex:1, minWidth:0, overflowWrap:'break-word' }}>{e.name}</span>
                                  <span style={{ fontSize:11, color:e.load === 'main' ? 'var(--accent)' : e.load === 'additional' ? '#f59e0b' : 'rgba(255,255,255,0.4)', fontWeight:600, padding:'1px 6px', borderRadius:4, flexShrink:0, background: e.load === 'main' ? 'var(--accent-dim)' : e.load === 'additional' ? 'rgba(245,158,11,0.1)' : 'transparent' }}>
                                   {e.load === 'main' ? 'ОСН' : e.load === 'additional' ? 'ДОП' : 'АКС'}
                                 </span>
                               </div>
                              <div style={{ display:'flex', flexDirection:'column', gap:4, marginTop:6 }}>
                                {(() => {
                                  const allSets: { ws: typeof e.workSets[number]; blockIdx: number; setIdx: number }[] = [];
                                  e.workSets.forEach((ws, bi) => { for (let r=0; r<ws.sets; r++) allSets.push({ ws, blockIdx: bi, setIdx: allSets.length }); });
                                  const INM: React.CSSProperties = { background:'#18181b', color:'#fff', border:'1px solid rgba(255,255,255,0.1)', borderRadius:4, padding:'5px 4px', fontSize:12, textAlign:'center', minWidth:0 };
                                  const IN_LBL: React.CSSProperties = { fontSize:9, color:'rgba(255,255,255,0.4)', textTransform:'uppercase' as const, letterSpacing:0.5, textAlign:'center' as const };
                                  return allSets.map(({ ws, blockIdx, setIdx }) => {
                                    const k = setKey(wk.week, di, ei, setIdx);
                                    const es = effSet(wk.week, di, ei, setIdx, ws);
                                    return (
                                      <div key={setIdx} style={{ background:'rgba(255,255,255,0.025)', borderRadius:6, padding:'4px 6px' }}>
                                        <div style={{ fontSize:10, color:'rgba(255,255,255,0.5)', marginBottom:2, fontWeight:600, display:'flex', justifyContent:'space-between' }}><span>Сет {setIdx+1}</span><span style={{ color:'#60a5fa', fontWeight:700 }}>{Math.round(ws.pct*100)}%</span></div>
                                        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:4 }}>
                                          <div><div style={IN_LBL}>Вес, кг</div><input type='number' value={es.weight} onChange={ev => setSrcEdits(prev => ({ ...prev, [k]: { ...prev[k], weight: +ev.target.value } }))} style={{ ...INM, width:'100%' }} /></div>
                                          <div><div style={IN_LBL}>Повторы</div><input type='number' value={es.reps} onChange={ev => setSrcEdits(prev => ({ ...prev, [k]: { ...prev[k], reps: +ev.target.value } }))} style={{ ...INM, width:'100%' }} /></div>
                                        </div>
                                      </div>
                                    );
                                  });
                                })()}
                              </div>
                            </div>
                          ))}
                          {(srcAdditions[dk] || []).map(a => (
                             <div key={a.uid} style={{ display:'flex', flexDirection:'column', gap:4, padding:'5px 0', borderBottom:'1px solid var(--accent-dim)' }}>
                               <div style={{ display:'flex', alignItems:'center', gap:4, minWidth:0 }}>
                                 <div style={{ fontSize:11, color:'var(--accent)', fontWeight:600, flex:1, minWidth:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{a.name}</div>
                                 <span style={{ fontSize:10, color:'rgba(255,255,255,0.4)', flexShrink:0 }}>＋ добавлено</span>
                                 <button onClick={() => setSrcAdditions(prev => { return { ...prev, [dk]: (prev[dk]||[]).filter(x => x.uid !== a.uid) }; })} style={{ fontSize:11, color:'#ef4444', border:'none', background:'transparent', cursor:'pointer', flexShrink:0 }}>✕</button>
                               </div>
                               <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:3 }}>
                                 <input type='number' value={a.sets} onChange={ev => setSrcAdditions(prev => { return { ...prev, [dk]: (prev[dk]||[]).map(x => x.uid===a.uid ? { ...x, sets: +ev.target.value } : x) }; })} style={{ background:'#18181b', color:'#fff', border:'1px solid rgba(255,255,255,0.1)', borderRadius:5, padding:'6px 2px', fontSize:11, textAlign:'center', minWidth:0, width:'100%' }} aria-label='подходы' title='подходы'/>
                                 <input type='number' value={a.reps} onChange={ev => setSrcAdditions(prev => { return { ...prev, [dk]: (prev[dk]||[]).map(x => x.uid===a.uid ? { ...x, reps: +ev.target.value } : x) }; })} style={{ background:'#18181b', color:'#fff', border:'1px solid rgba(255,255,255,0.1)', borderRadius:5, padding:'6px 2px', fontSize:11, textAlign:'center', minWidth:0, width:'100%' }} aria-label='повт' title='повторы'/>
                                 <input type='number' value={a.weight} onChange={ev => setSrcAdditions(prev => { return { ...prev, [dk]: (prev[dk]||[]).map(x => x.uid===a.uid ? { ...x, weight: +ev.target.value } : x) }; })} style={{ background:'#18181b', color:'#fff', border:'1px solid rgba(255,255,255,0.1)', borderRadius:5, padding:'6px 2px', fontSize:11, textAlign:'center', minWidth:0, width:'100%' }} aria-label='вес' title='вес, кг'/>
                               </div>
                             </div>
                           ))}
                          <button onClick={() => { setPickerDay(dk); setPickerExName(''); }} style={{ marginTop:6, padding:'5px 10px', borderRadius:6, fontSize:11, fontWeight:600, border:'1px dashed rgba(0,230,138,0.4)', background:'var(--accent-dim)', color:'var(--accent)', cursor:'pointer' }}>＋ Добавить упражнение из каталога</button>
                        </>
                      ),
                    }} />
                  );
                }
                return (
                  <DayCard key={di} day={{
                    key: 'day-' + di,
                    title: `🏋️ День ${di + 1}${loadStr}`,
                    phase: dayPhase,
                    volumeTag,
                    renderBody: (
                      <>
                        {d.exercises.map((e, ei) => {
                          const tmpo = getTempo(e.name, goal, e.load === 'main');
                          const isCompound = !e.name.toLowerCase().includes('сгибан') && !e.name.toLowerCase().includes('разгибан') && !e.name.toLowerCase().includes('подъём') && !e.name.toLowerCase().includes('махи');
                          const roleColor = e.load === 'main' ? '#00e68a' : e.load === 'additional' ? '#f59e0b' : 'rgba(255,255,255,0.55)';
                          const charColor = e.load === 'main' ? '#60a5fa' : e.load === 'additional' ? '#a855f7' : 'rgba(255,255,255,0.5)';
                          const charLabel = e.load === 'main' ? '💪 Тяж' : e.load === 'additional' ? '🩸 Памп' : '🌿 Лёг';
                          const roleLabel = e.load === 'main' ? '🎯 Основное' : e.load === 'additional' ? '📌 Добивка' : '⚙️ Аксессуар';
                           const rawFirstWs = e.workSets[0] ? effSet(wk.week, di, ei, 0, e.workSets[0]) : null;
                           const diaryAdj = autoRegMode === 'diary' && diaryAutoreg ? diaryAutoreg.perExercise.get(e.name) : undefined;
                            const firstWs = rawFirstWs ? {
                              ...rawFirstWs,
                              sets: diaryAdj ? diaryAdj.adjustedSets : rawFirstWs.sets,
                              weight: diaryAdj ? diaryAdj.adjustedWeight : rawFirstWs.weight,
                              rir: diaryAdj ? diaryAdj.adjustedRir : (e.workSets[0]?.rir ?? e.rir),
                            } : null;
                            const adjustedMark = diaryAdj ? ' 📓' : '';
                            const adjustDisplaySet = (ws: typeof e.workSets[number], si: number) => {
                               const raw = { ...effSet(wk.week, di, ei, si, ws), rir: ws.rir };
                              const adjusted = diaryAdj
                                ? { ...raw, sets: diaryAdj.adjustedSets, weight: diaryAdj.adjustedWeight, rir: diaryAdj.adjustedRir }
                                : raw;
                              return adjusted;
                            };
                           const firstRir = firstWs?.rir;
                          const setSummary = firstWs ? (firstWs.sets + '×' + firstWs.reps + ' @ ' + Math.round(firstWs.pct*100) + '%') : '';
                          const tempo = tempoStr || tmpo.tempo.toString;
                          return (
                            <div key={ei} style={{ padding:'8px 10px', marginBottom:6, background:'rgba(255,255,255,0.025)', borderRadius:10, border:'0.5px solid rgba(255,255,255,0.04)', overflow:'hidden' }}>
                              <div style={{ display:'flex', alignItems:'baseline', gap:8, marginBottom:5, minWidth:0 }}>
                                <span style={{ minWidth:20, height:20, borderRadius:'50%', background:'rgba(0,230,138,0.15)', color:'#00e68a', fontSize:11, fontWeight:800, display:'inline-flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>{ei+1}</span>
                                <span style={{ fontSize:13, fontWeight:800, color:'#fff', lineHeight:1.2, flex:1, minWidth:0, overflowWrap:'break-word' }}>{e.name}</span>
                              </div>
                              <div style={{ display:'flex', gap:5, flexWrap:'wrap', marginBottom:6 }}>
                                <span style={{ fontSize:10, fontWeight:700, padding:'2px 6px', borderRadius:5, background:(isCompound?'#00e68a':'#f59e0b')+'20', color:isCompound?'#00e68a':'#f59e0b', border:'0.5px solid '+(isCompound?'#00e68a':'#f59e0b')+'30' }}>{isCompound?'База':'Изо'}</span>
                                <span style={{ fontSize:10, fontWeight:700, padding:'2px 6px', borderRadius:5, background:roleColor+'20', color:roleColor, border:'0.5px solid '+roleColor+'30' }}>{roleLabel}</span>
                                <span style={{ fontSize:10, fontWeight:700, padding:'2px 6px', borderRadius:5, background:charColor+'20', color:charColor, border:'0.5px solid '+charColor+'30' }}>{charLabel}</span>
                              </div>
                              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(80px, 1fr))', gap:5 }}>
                                 {firstWs && <span style={{ fontSize:10, color:'rgba(255,255,255,0.55)', padding:'3px 6px', borderRadius:6, background:'rgba(34,197,94,0.1)', border:'0.5px solid rgba(34,197,94,0.2)', display:'flex', justifyContent:'space-between' }}><span style={{ color:'rgba(34,197,94,0.8)' }}>Сеты</span><b style={{color:'#fff'}}>{e.workSets.reduce((n,ws)=>n+ws.sets,0)}×{firstWs.reps}{adjustedMark}</b></span>}
                                <span style={{ fontSize:10, color:'rgba(255,255,255,0.55)', padding:'3px 6px', borderRadius:6, background:'rgba(245,158,11,0.1)', border:'0.5px solid rgba(245,158,11,0.2)', display:'flex', justifyContent:'space-between' }}><span style={{ color:'rgba(245,158,11,0.8)' }}>RIR</span><b style={{color:'#fff'}}>{firstRir ?? e.rir}</b></span>
                                 {firstWs && <span style={{ fontSize:10, color:'rgba(255,255,255,0.55)', padding:'3px 6px', borderRadius:6, background:'rgba(96,165,250,0.1)', border:'0.5px solid rgba(96,165,250,0.2)', display:'flex', justifyContent:'space-between' }}><span style={{ color:'rgba(96,165,250,0.8)' }}>Вес</span><b style={{color:'#fff'}}>{firstWs.weight}кг{adjustedMark}</b></span>}
                                 {tempo && <span style={{ fontSize:10, color:'rgba(255,255,255,0.55)', padding:'3px 6px', borderRadius:6, background:'rgba(168,85,247,0.1)', border:'0.5px solid rgba(168,85,247,0.2)', display:'flex', justifyContent:'space-between' }}><span style={{ color:'rgba(168,85,247,0.8)' }}>Темп</span><b style={{color:'#fff'}}>{tempo}</b></span>}
                                <span style={{ fontSize:10, color:'rgba(255,255,255,0.55)', padding:'3px 6px', borderRadius:6, background:'rgba(255,255,255,0.05)', border:'0.5px solid rgba(255,255,255,0.1)', display:'flex', justifyContent:'space-between' }}><span style={{ color:'rgba(255,255,255,0.6)' }}>Группа</span><b style={{color:'#fff'}}>{e.group}</b></span>
                              </div>
                              <div style={{ marginTop:5, display:'flex', flexDirection:'column', gap:3 }}>
                                {(() => {
                                  const allSets: { ws: typeof e.workSets[number]; si: number; blockIdx: number; repIdx: number }[] = [];
                                  e.workSets.forEach((ws, blockIdx) => {
                                    for (let r = 0; r < ws.sets; r++) {
                                      allSets.push({ ws, si: allSets.length, blockIdx, repIdx: r });
                                    }
                                  });
                                  return allSets.map(({ ws, si, blockIdx }) => {
                                    const es = adjustDisplaySet(ws, blockIdx);
                                    return (
                                      <div key={si} style={{ fontSize:11, color:'rgba(255,255,255,0.8)', padding:'4px 8px', borderRadius:6, background:'rgba(255,255,255,0.03)', border:'0.5px solid rgba(255,255,255,0.06)', display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                                        <span style={{ fontSize:9, fontWeight:700, color:'rgba(0,230,138,0.7)', minWidth:40 }}>Сет {si+1}</span>
                                        <span style={{ fontWeight:700, color:'#fff' }}>{es.reps} повт</span>
                                        <span style={{ color:'#60a5fa', fontWeight:700 }}>{Math.round(es.pct*100)}%</span>
                                        <span style={{ color:'rgba(255,255,255,0.6)' }}>{es.weight}кг</span>
                                        {typeof es.rir === 'number' && <span style={{ color:'#f59e0b' }}>RIR {es.rir}</span>}
                                        {adjustedMark && <span style={{ fontSize:9 }}>{adjustedMark}</span>}
                                      </div>
                                    );
                                  });
                                })()}
                              </div>
                            </div>
                          );
                        })}
                        {(srcAdditions[dk] || []).map(a => (
                          <div key={a.uid} style={{ padding:'6px 10px', marginBottom:6, background:'rgba(0,230,138,0.05)', borderRadius:10, border:'0.5px solid rgba(0,230,138,0.2)', display:'flex', alignItems:'center', justifyContent:'space-between', gap:6 }}>
                            <div style={{ minWidth:0, flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                              <span style={{ fontSize:13, fontWeight:800, color:'#00e68a' }}>＋ {a.name}</span>
                              <span style={{ fontSize:11, color:'rgba(255,255,255,0.6)', marginLeft:6 }}>{a.sets}×{a.reps}×{a.weight}кг</span>
                            </div>
                            <button onClick={() => setSrcAdditions(prev => { return { ...prev, [dk]: (prev[dk]||[]).filter(x => x.uid !== a.uid) }; })} style={{ fontSize:11, color:'#ef4444', border:'1px solid rgba(239,68,68,0.3)', background:'rgba(239,68,68,0.08)', borderRadius:5, padding:'4px 8px', cursor:'pointer', flexShrink:0 }}>✕</button>
                          </div>
                        ))}
                      </>
                    ),
                  }} />
                );
              })}
              <MetricCard title={'Итоги мезоцикла ('+totalW+' нед)'} icon="📊">
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
                  <div style={{ ...SMALL, background:'var(--accent-dim)', padding:'6px 8px', borderRadius:8 }}>Тоннаж: <b style={{color:'#fff'}}>{builtSrc.cycleMetrics.tonnage.toFixed(0)}</b> кг·пов</div>
                  <div style={{ ...SMALL, background:'var(--accent-dim)', padding:'6px 8px', borderRadius:8 }}>КПШ: <b style={{color:'#fff'}}>{builtSrc.cycleMetrics.kpsh}</b></div>
                  <div style={{ ...SMALL, background:'var(--accent-dim)', padding:'6px 8px', borderRadius:8 }}>Инт. отн: <b style={{color:'#fff'}}>{builtSrc.cycleMetrics.relIntensity.toFixed(3)}</b></div>
                  <div style={{ ...SMALL, background:'var(--accent-dim)', padding:'6px 8px', borderRadius:8 }}>УОИ: <b style={{color:'#fff'}}>{builtSrc.cycleMetrics.uoi.toFixed(3)}</b></div>
                </div>
              </MetricCard>
              {builtSrc && builtSrc.plVolumeLandmarks && builtSrc.plVolumeLandmarks.length > 0 && (
                <MetricCard title={'Объём vs MRV (volume-landmarks)'} icon="📊">
                  <div style={{ color:'rgba(255,255,255,0.55)', fontSize:11, marginBottom:8 }}>
                    Пиковая неделя: {builtSrc.plVolumeLandmarks[0].peakWeek}{W.some(w => w.macroPhase === 'competition') ? ` · 📉 +${W.filter(w => w.macroPhase === 'competition').length} тапер-нед` : ''}{pedAuto && peds.length > 0 ? ` · 💉 MRV ×${Math.max(1, (() => { try { const lm = Object.fromEntries(Object.entries(getAllVolumeLandmarks(level)).map(([k, v]) => [k, v.mrv])); return adaptForPEDs(peds, lm, pedDoses, courseIntensity).combinedMrvMultiplier; } catch { return 1; } })()).toFixed(2)} (PED)` : ''}
                  </div>
                  {builtSrc.plVolumeLandmarks.map((lm) => {
                    const c = lm.status === 'over' ? '#ff5252' : lm.status === 'high' ? '#ffb74d' : lm.status === 'optimal' ? '#4caf50' : '#90caf9';
                    const lbl = lm.status === 'over' ? 'ПЕРЕБОР' : lm.status === 'high' ? 'высоко' : lm.status === 'optimal' ? 'оптимум' : 'низко';
                    return (
                      <div key={lm.group} style={{ marginBottom: 6, minWidth: 0 }}>
                        <div style={{ display:'flex', justifyContent:'space-between', gap: 6, flexWrap: 'wrap' }}>
                          <span style={{ color:'#fff', fontSize:12, minWidth: 0, overflowWrap: 'break-word' }}>{lm.muscle}</span>
                          <span style={{ color: c, fontSize:11, fontWeight:700, whiteSpace: 'nowrap' }}>{lm.sets} сет · MRV {lm.mrv} · {lbl}</span>
                        </div>
                        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>MAV {lm.mav} · MEV {lm.mev}</div>
                        <div style={{ height:6, background:'rgba(255,255,255,0.1)', borderRadius:3, marginTop:3, overflow:'hidden' }}>
                          <div style={{ width: `${Math.min(100, (lm.sets / lm.mrv) * 100)}%`, height:'100%', background:c, borderRadius:3 }} />
                        </div>
                      </div>
                    );
                  })}
                  {builtSrc.plVolumeLandmarks.some(l => l.status === 'over') && (
                    <div style={{ color:'#ff5252', fontSize:11, marginTop:4 }}>⚠ Объём выше MRV — риск перетренированности. Снизьте подходы или добавьте разгрузку.</div>
                  )}
                </MetricCard>
              )}
              <MesocycleProgressionCard
                weeks={totalW}
                sourceWeeks={(() => {
                  const sourceCycle = getCycleById(selectedCycleId);
                  // Только оригинальные недели решают про исходный календарь: добавленные
                  // тапер-недели (macroPhase/taperWeek) не должны «перекрашивать» цикл.
                  if (!sourceCycle || W.filter(w => !isTaperWeek(w) && !isMockWeek(w)).some(week => week.macroPhase)) return undefined;
                  const layouts = sourceCycle.weeks && sourceCycle.weeks.length > 0
                    ? sourceCycle.weeks
                    : Array.from({ length: originalCycleWeeks(sourceCycle) }, () => sourceCycle.week1);
                   return summarizeSourceCycleWeeks(layouts, sourceCycle.meta.period, sourceCycle.meta.sourcePhases, sourceCycle.meta.sourcePhaseSource ?? 'original');
                })()}
                startVolumeSets={Math.round(W.reduce((s, w) => s + w.days.reduce((ss, d) => ss + d.exercises.reduce((sss, e) => sss + e.workSets.reduce((a, ws) => a + ws.sets, 0), 0), 0), 0) / totalW / (days || 3))}
                startIntensityPct={0.72}
                startRIR={3}
                goal="strength"
                title="Календарь оригинального цикла (ПЛ)"
              />
              {/* ── ПРОФЕССИОНАЛЬНЫЕ ПЛ-РЕКОМЕНДАЦИИ для слабых групп ── */}
              {weakPoints.length > 0 && (() => {
                const GRP_RU: Record<string,string> = { chest:'Грудь', back:'Спина', legs:'Ноги', shoulders:'Плечи', arms:'Руки', core:'Кор' };
                // какой день недели соответствует какой группе мышц (по главному упражнению дня)
const FIND_DAY_FOR_GROUP = (group: string): number => {
                  const keywords: Record<string,string[]> = {
                    chest: ['жим'],
                    shoulders: ['жим стоя', 'overhead', 'army press', 'army-press', 'overhead press', 'army press'],
                    arms: ['жим узким', 'close grip', 'французский', 'разгибание', 'скотт', 'бицепс', 'curl'],
                    legs: ['присед', 'жим ногами', 'лег пресс', 'разгибание ног', 'сгибание ног', 'румынская', 'рум', 'выступ', 'болгар', 'гоблет', 'гакк', 'сгиб'],
                    back: ['становая', 'тяга', 'подтягив', 'пуло'],
                    core: ['пресс', 'кор', 'скручиван', 'подъём', 'планк', 'флекс'],
                  };
                  const kws = keywords[group] || [];
                  for (let di = 0; di < wk.days.length; di++) {
                    const firstEx = wk.days[di].exercises[0]?.name.toLowerCase() || '';
                    const allEx = wk.days[di].exercises.map(e => e.name.toLowerCase()).join(' ');
                    if (kws.some(k => firstEx.includes(k) || allEx.includes(k))) return di;
                  }
                  return 0;
                };
                // схемы подходов по фазе цикла
                const PHASE_SCHEMES: Record<string,{reps:number;pct:number;label:string}> = {
                  base: { reps:10, pct:0.67, label:'гипертрофия (10П)' },
                  build: { reps:8, pct:0.73, label:'силовая выносливость (8П)' },
                  peak: { reps:5, pct:0.80, label:'специфическая сила (5П)' },
                  deload: { reps:12, pct:0.50, label:'восстановление (12П)' },
                };
                 const scheme = PHASE_SCHEMES[sourceWeek?.phase || phase] || PHASE_SCHEMES.base;
                // ПЛ-специфичные ассистентные упражнения (вариации соревновательных движений)
                const PL_EXERCISES: Record<string,{name:string;note:string}[]> = {
                  chest: [
                    { name:'Жим с паузой 2 секунды', note:'убивает инерцию, усиливает старт' },
                    { name:'Жим на наклонной скамье', note:'верх груди, помощь в средней фазе' },
                    { name:'Дожим с 5 см', note:'трицепс + локдаун' },
                    { name:'Французский жим', note:'изоляция длинной головки трицепса' },
                    { name:'Жим гантелей лёжа', note:'дефицит стабильности → грудные+стабилизаторы' },
                  ],
                  shoulders: [
                    { name:'Армейский жим', note:'передняя/средняя дельта, локдаун' },
                    { name:'Жим штанги за голову', note:'плечевой пояс + трапеции' },
                    { name:'Жим гантелей сидя', note:'стабильность плечевого пояса' },
                    { name:'Махи гантелями в стороны', note:'средняя дельта, ширина' },
                    { name:'Тяга к подбородку', note:'передняя дельта + трапеции' },
                  ],
arms: [
                     { name:'Французский жим лёжа', note:'длинная головка трицепса' },
                     { name:'Разгибание на блоке', note:'латеральная головка трицепса' },
                     { name:'Скотт-бенч', note:'бицепс, пик' },
                     { name:'Молотки', note:'брахиалис + предплечья' },
                     { name:'Жим узким хватом', note:'трицепс + локдаун' },
                   ],
legs: [
                       { name:'Присед на груди', note:'акцент квадрицепсов, улучшает старт' },
                       { name:'Жим ногами', note:'объём квадрицепсов без нагрузки на позвоночник' },
                       { name:'Болгарские сплит-приседания', note:'изолированная работа каждой ноги' },
                       { name:'Разгибание ног в тренажере', note:'изоляция квадрицепсов' },
                       { name:'Румынская тяга', note:'бицепс бедра + ягодичные, posterior chain' },
                     ],
                     back: [
                       { name:'Тяга штанги в наклоне', note:'центр спины, фиксация лопаток' },
                       { name:'Подтягивания (прямой хват)', note:'широчайшие, тянущая сила верха' },
                       { name:'Тяга из ямы', note:'дефицит старта, работа с пола ниже обычного' },
                     ],
                     core: [
                      { name:'Наклоны со штангой', note:'разгибатели спины, жёсткость корпуса в приседе' },
                      { name:'Пресс в тренажере (скручивания)', note:'внутрибрюшное давление, защита поясницы' },
                      { name:'Гиперэкстензия', note:'поясница + ягодицы, фиксация таза в тяге' },
                    ],
                };
                const eq = loadTrainingProfile().equipment;
                const eqOk = (ex: {name:string;note:string}): boolean => {
                  if (eq.length === 0) return true;
                  // допускаем штангу и вес тела всегда (подтягивания, наклоны со штангой)
                  const nameLow = ex.name.toLowerCase();
                  const hasBar = nameLow.includes('штанг') || nameLow.includes('гриф');
                  const hasCable = nameLow.includes('блок') || nameLow.includes('кроссовер') || nameLow.includes('к лицу');
                  const hasBW = nameLow.includes('подтягив') || nameLow.includes('гиперэкстенз');
                  const hasDB = nameLow.includes('гантел') || nameLow.includes('разводк');
                  // проверяем логически: если есть доступное оборудование, подходящее под упражнение
                  if (hasBar && (eq.includes('barbell')||eq.includes('rack'))) return true;
                  if (hasCable && eq.includes('cable')) return true;
                  if (hasBW) return true;
                  if (hasDB && eq.includes('dumbbell')) return true;
                  // fallback: если ни одно упражнение не проходит — пускаем все (лучше показать, чем скрыть)
                  return true;
                };
                return <MetricCard title='🎯 Рекомендации тренера: ПЛ-ассистенты по слабым группам' icon='🎯' accent='#ff9100'>
                  <div style={{ fontSize:11, color:'rgba(255,255,255,0.5)', marginBottom:6 }}>
                    Фаза: <b style={{color:'#ff9100'}}>{PH_RU[phase]}</b> · схема: <b style={{color:'#ff9100'}}>{scheme.label}</b> (вес ≈ {Math.round(scheme.pct*100)}% workMax)
                   </div>
                   {weakPoints.map(g => {
                     const autoDi = FIND_DAY_FOR_GROUP(g);
                     const selectedDayNumbers = (weakGroupDayMap[g] || [])
                       .filter(day => day >= 1 && day <= wk.days.length);
                     const targetDayIndices = selectedDayNumbers.length > 0
                       ? selectedDayNumbers.map(day => day - 1)
                       : [autoDi];
                     const targetDayKeys = targetDayIndices.map(dayIndex => dayKey(wk.week, dayIndex));
                     const pool = (PL_EXERCISES[g] || PL_EXERCISES.chest).filter(eqOk).slice(0, 3);
                     const dayLabel = selectedDayNumbers.length > 0
                       ? `выбрано: ${selectedDayNumbers.map(day => `Д${day}`).join(', ')}`
                       : `авто → День ${autoDi + 1}`;
                     return <div key={g} style={{ marginBottom: 8, padding:8, borderRadius:8, background:'rgba(255,145,0,0.04)', border:'1px solid rgba(255,145,0,0.1)' }}>
                       <div style={{ fontSize:11, fontWeight:700, color:'#ff9100', marginBottom:3, display:'flex', justifyContent:'space-between' }}>
                         <span>{GRP_RU[g] || g}</span>
                         <span style={{ fontSize:10, fontWeight:400, color:'rgba(255,255,255,0.45)' }}>→ {dayLabel}</span>
                       </div>
                       <div style={{ display:'flex', gap:3, flexWrap:'wrap', alignItems:'center', marginBottom:5 }}>
                         <span style={{ fontSize:9, color:'rgba(255,255,255,0.45)' }}>Куда добавлять:</span>
                         <button onClick={() => setWeakGroupDayMap(current => {
                           if (!(g in current)) return current;
                           const next = { ...current };
                           delete next[g];
                           return next;
                         })} style={{ padding:'3px 7px', borderRadius:6, fontSize:9, cursor:'pointer', border:selectedDayNumbers.length === 0 ? '1px solid #ff9100' : '1px solid rgba(255,255,255,0.1)', background:selectedDayNumbers.length === 0 ? 'rgba(255,145,0,0.15)' : 'transparent', color:selectedDayNumbers.length === 0 ? '#ff9100' : 'rgba(255,255,255,0.55)' }}>Авто</button>
                         {wk.days.map((_, dayIndex) => {
                           const dayNumber = dayIndex + 1;
                           const selected = selectedDayNumbers.includes(dayNumber);
                           return <button key={dayNumber} onClick={() => toggleDayInMap(g, dayNumber, 'wg')} style={{ padding:'3px 7px', borderRadius:6, fontSize:9, cursor:'pointer', border:selected ? '1px solid #ff9100' : '1px solid rgba(255,255,255,0.1)', background:selected ? 'rgba(255,145,0,0.15)' : 'transparent', color:selected ? '#ff9100' : 'rgba(255,255,255,0.55)' }}>Д{dayNumber}</button>;
                         })}
                       </div>
                       {pool.map(ex => (
                         <button key={ex.name} onClick={() => addAccessory(targetDayKeys, ex.name, g)}
                           style={{ display:'block', width:'100%', marginBottom:3, padding:'5px 8px', borderRadius:6, fontSize:11, cursor:'pointer', textAlign:'left',
                             border:'1px solid rgba(255,145,0,0.25)', background:'rgba(255,145,0,0.06)', color:'#ff9100', transition:'all 0.15s' }}>
                          <span style={{fontWeight:700}}>＋ {ex.name}</span>
                          <span style={{fontSize:10, color:'rgba(255,255,255,0.45)', marginLeft:6}}>— {ex.note}</span>
                        </button>
                      ))}
                    </div>;
                  })}
                   <div style={{ ...SMALL, color: 'rgba(255,255,255,0.5)' }}>
                     Ассистент добавляется в авто-день или все выбранные дни текущей недели: {scheme.reps}П × 3 подхода, вес {Math.round(scheme.pct*100)}% workMax (фазовая схема). Можно отредактировать в режиме правки.
                  </div>
                  <div style={{ fontSize:10, color:'rgba(255,145,0,0.5)', marginTop:4 }}>
                    💡 Совет тренера: не ставьте изоляцию — для ПЛ слабая точка лечится вариациями соревновательного движения, а не махами гантелей. Каждое упражнение — это устранение конкретной фазы.
                  </div>
                </MetricCard>;
              })()}
              <div style={{ marginTop:8, padding:10, borderRadius:10, background:'rgba(96,165,250,0.06)', border:'1px solid rgba(96,165,250,0.15)' }}>
                <div style={{ ...LABEL, color:'#60a5fa', margin:'0 0 4px' }}>➡️ Что дальше</div>
                <div style={SMALL}>{phase === 'peak'
                  ? 'Цикл завершается пиковой фазой. После теста ПМ — неделя разгрузки (deload: 60% объёма, RIR 4), затем новый мезоцикл с пересчитанным PM0 (новый PM = результат теста). Система пересчитает прогрессию автоматически при вводе нового PM.'
                  : phase === 'deload'
                  ? 'Разгрузка — восстановление перед следующим мезо. После неё начните новый цикл: PM0 = текущий расчётный PM (он вырос за мезо по формуле PM0×(1+k)^нед).'
                  : 'Система считает дальнейшие недели сама: вес = PM_нед × %ПМ, где PM_нед = PM0×(1+k)^нед (k=0.5% натурал / 1.5-2.5% на курсе). Переходите по неделям ◀▶ — фазы Base→Build→Peak чередуются автоматически.'}</div>
              </div>
            </div>;
          })()}
        </div>
      )}

      {mainTab === 'pl' && subView === 'tools' && (
        <PlannerToolsPanel mode="pl" />
      )}

      {mainTab === 'bb' && subView === 'plan' && (
        <div>
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
             <button onClick={() => setPedAuto(a => !a)} style={{ padding:'4px 10px', borderRadius:6, fontSize:10, fontWeight:700, cursor:'pointer', border:'none', background: pedAuto ? '#00e68a' : 'rgba(255,255,255,0.1)', color: pedAuto ? '#000' : 'var(--text-dim)', marginLeft: 'auto' }}>АВТО {pedAuto ? 'ON' : 'OFF'}</button>
           </div>
           {pedAuto && peds.length > 0 && <div style={{ marginTop:6, fontSize:10, color:'rgba(255,255,255,0.5)' }}>⚡ Авто-прогрессия ПМ: {courseIntensity === 'heavy' ? 'Тяжёлая' : courseIntensity === 'moderate' ? 'Умеренная' : 'Лёгкая'} → {courseIntensity === 'heavy' ? '+2.5%' : courseIntensity === 'moderate' ? '+2%' : '+1.5%'}/нед</div>}
           {!pedAuto && peds.length > 0 && <div style={{ marginTop:6, fontSize:10, color:'rgba(255,255,255,0.5)' }}>⏸ Авто-прогрессия выключена → базовая progression цикла</div>}
           <PedAdaptationCard adaptation={pedAdapt} />
          <div style={{ ...H, marginTop: 10 }}>💪 Рабочие максимумы (кг) — для расчёта весов</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 6, boxSizing: 'border-box' }}>
            {BB_WM_KEYS.map(k => <PopupNumber key={k} label={BB_WM_RU[k]} value={bbWorkMax[k] || 80} min={10} max={400} suffix=' кг' onChange={v => setBbWm(k, v)} />)}
          </div>
          <div style={{ marginTop: 8, fontSize: 11, fontWeight: 700, color: ACCENT }}>🎯 Слабые группы мышц (ББ-акцент, сохраняются в профиль)</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2, marginBottom: 4 }}>
            💪 ББ: pump-finisher (3×15 @ RIR 4) для каждой слабой группы; +accessoryCompound-первым.
          </div>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 4, marginBottom: 6, minWidth: 0, maxWidth: '100%' }}>{WEAK_GROUPS.map(([id, l]) => { const on = weakPoints.includes(id); return <button key={id} onClick={() => toggleWeak(id)} style={{ padding: "5px 10px", borderRadius: 14, fontSize: 11, fontWeight: 700, cursor: "pointer", border: on ? "1px solid var(--accent)" : "1px solid rgba(255,255,255,0.08)", background: on ? "rgba(0,230,138,0.15)" : "rgba(255,255,255,0.02)", color: on ? "var(--accent)" : "rgba(255,255,255,0.6)", minWidth: 0, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l}{on ? " ✓" : ""}</button>; })}</div>
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
                  <button onClick={() => setAutoRegMode(m)} style={{ padding:'4px 8px', borderRadius:5, fontSize:10, fontWeight:700, cursor:'pointer', border:'none', background: autoRegMode === m ? modeColor : 'rgba(255,255,255,0.08)', color: autoRegMode === m ? '#000' : 'rgba(255,255,255,0.6)' }}>{label}</button>
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
                      <div style={{ marginTop: 6, fontSize: 10, color: 'rgba(255,255,255,0.7)' }}>
                        <div>Топ-сет ×{autoRegResult.topSetPctMultiplier} · объём ×{autoRegResult.volumeMultiplier} · RIR +{autoRegResult.rirShift}{autoRegResult.deload ? ' · 🔴 DELOAD' : ''}</div>
                        {autoRegResult.decisions.slice(0, 3).map((d, i) => <div key={i} style={{ marginTop: 2, color: 'rgba(255,255,255,0.55)' }}>• {d}</div>)}
                      </div>
                    )}
                    {autoRegMode === 'diary' && diaryAutoreg && (
                      <div style={{ marginTop: 6, fontSize: 10, color: 'rgba(255,255,255,0.7)' }}>
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
                <div style={{ fontSize:11, color:'rgba(255,255,255,0.65)', marginBottom:6, fontWeight:700 }}>Неделя {wk.week} из {W.length}</div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(36px, 1fr))', gap:4 }}>
                  {W.map(w => { const active = w.week === wk.week; return <button key={w.week} onClick={() => setBbWeekSel(w.week)} style={{ padding:'7px 0', borderRadius:7, border: active ? '1px solid var(--accent)' : '1px solid rgba(255,255,255,0.08)', background: active ? 'linear-gradient(135deg,var(--accent),#00c853)' : 'rgba(255,255,255,0.02)', color: active ? '#000' : '#fff', fontSize:10, fontWeight:700, cursor:'pointer' }}>{w.week}</button>; })}
                </div>
              </div>
              {/* Визуальный календарь ББ: недели × дни (объём по сетам) */}
              <div style={{ marginTop: 8, padding: 8, borderRadius: 10, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.6)', marginBottom: 6 }}>📅 Календарь мезоцикла (нед × дни, объём сетов)</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {W.map(w => { const active = w.week === wk.week; const daySets = w.sessions.map(s => s.exercises.reduce((ss, e) => ss + e.sets, 0)); const maxD = Math.max(1, ...W.flatMap(ww => ww.sessions.map(s => s.exercises.reduce((ss, e) => ss + e.sets, 0)))); return (
                    <div key={w.week} onClick={() => setBbWeekSel(w.week)} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 6px', borderRadius: 6, cursor: 'pointer', background: active ? 'var(--accent-dim)' : 'transparent', border: active ? '1px solid rgba(0,230,138,0.3)' : '1px solid transparent' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: active ? 'var(--accent)' : 'rgba(255,255,255,0.7)', minWidth: 26 }}>Н{w.week}</span>
                      <div style={{ flex: 1, display: 'flex', gap: 2 }}>
                        {daySets.map((ds, di) => <div key={di} title={'Д' + (di+1) + ': ' + ds + ' сетов'} style={{ flex: 1, height: 14, borderRadius: 3, background: ds > 0 ? 'linear-gradient(180deg,var(--accent),#00c853)' : 'rgba(255,255,255,0.04)', opacity: 0.35 + 0.65 * (ds / maxD) }} />)}
                      </div>
                      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', minWidth: 30, textAlign: 'right' }}>{daySets.reduce((a, b) => a + b, 0)}</span>
                    </div>
                  ); })}
                </div>
              </div>
              {/* Дни выбранной недели — таблицы-карточки */}
              <div style={{ marginTop: 10, display:'flex', flexDirection:'column', gap: 8 }}>
                {wk.sessions.map((s, si) => (
                  <div key={si} style={{ background:'rgba(255,255,255,0.02)', borderRadius:10, border:'1px solid rgba(255,255,255,0.06)', overflow:'hidden' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 10px', background:'var(--accent-dim)', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
                      <span style={{ fontSize:12, fontWeight:700, color:'#fff' }}>🏋️ День {si + 1} · {s.character}</span>
                      <span style={{ fontSize:10, color:ACCENT, fontWeight:700 }}>{s.sessionTag}</span>
                    </div>
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
                        <div key={ei} style={{ display:'grid', gridTemplateColumns:'minmax(0,1.4fr) minmax(0,0.7fr) minmax(0,0.6fr) minmax(0,0.6fr) minmax(0,0.6fr) minmax(0,0.6fr)', gap:2, padding:'5px 10px', fontSize:10, color:'rgba(255,255,255,0.85)', borderTop:'1px solid rgba(255,255,255,0.04)' }}>
                          <span style={{ fontWeight:600, whiteSpace:'normal', overflowWrap:'anywhere' }}>{e.muscle}</span>
                          <span style={{ color:'rgba(255,255,255,0.6)' }}>{e.character}</span>
                          <span>{adjSets}×{e.workSets[0].reps}</span>
                          <span style={{ color:'#f59e0b' }}>{peakRirTarget != null ? peakRirTarget : Math.max(0, e.rir + bridgeRir + diaryRirAdd)}{autoRegMode === 'auto' && autoRegResult?.rirShift ? `+${autoRegResult.rirShift}` : ''}</span>
                          <span style={{ color: adjW !== rawW ? '#f59e0b' : ACCENT, fontWeight:700 }}>{adjW} кг{adjW !== rawW ? (autoRegMode === 'diary' ? ' 📒' : ' ⚡') : ''}</span>
                          <span style={{ fontSize:10, color:'#a855f7', fontWeight:700, background:'rgba(168,85,247,0.1)', padding:'2px 6px', borderRadius:4, textAlign:'center' }}>{tempoStr || tmpo.tempo.toString}</span>
                        </div>
                        );
                      })}
                    </div>
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
                  <div key={mm.muscle} style={{ display:'grid', gridTemplateColumns:'minmax(0,1.4fr) minmax(0,0.5fr) minmax(0,0.5fr) minmax(0,0.5fr) minmax(0,0.5fr)', gap:2, fontSize:10, color:'rgba(255,255,255,0.85)', padding:'3px 0', borderTop:'1px solid rgba(255,255,255,0.04)' }}>
                    <span style={{ fontWeight:600 }}>{mm.muscle}{over ? ' ⚠' : ''}</span>
                    <span style={{ color: over ? '#ef4444' : ACCENT, fontWeight:700 }}>{mm.totalSets}</span>
                    <span style={{ color:'#ef4444' }}>{mm.тяжSets}</span>
                    <span style={{ color:'#60a5fa' }}>{mm.пампSets}</span>
                    <span style={{ color:'rgba(255,255,255,0.5)' }}>{mm.mrv}</span>
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
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginBottom: 16, lineHeight: 1.6 }}>
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
                      const hasTaper = weekSessions.some(s => s.taperWeek && !s.mockMeet && !s.meetWeek);
                      const PH_COLOR_B: Record<string,string> = { base: '#22c55e', build: '#eab308', peak: '#ef4444', deload: '#60a5fa' };
                      const PH_RU_B: Record<string,string> = { base: 'База', build: 'Накопление', peak: 'Пик', deload: 'Разгрузка' };
                      const wkColor = hasMeet ? '#eab308' : hasMock ? '#a78bfa' : hasTaper ? '#f59e0b' : PH_COLOR_B[ph];
                      const wkLabel = hasMeet ? '🏁 Соревнования (прикиды)' : hasMock ? '🎯 Имитация соревнований (mock meet)' : hasTaper ? '📉 Тапер' : PH_RU_B[ph];
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
                        >{hasMeet ? '🏁' : hasMock ? '🎯' : hasTaper ? '📉' : w}</button>
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
                  title={`${s.focus} · ${s.exercises.length} упр.${s.meetWeek ? ' · 🏁 Соревнования' : s.mockMeet ? ' · 🎯 Mock meet' : s.taperWeek ? ' · 📉 Тапер' : ''}`}
                  icon={s.source === 'SRC' ? '🏋️' : '💪'}
                  short={`${s.totalSets} сетов · ${Math.round(s.totalVolume)} кг·пов${s.planned ? ' · запланировано' : ''}${s.meetWeek ? ' · 🏁 прикиды' : s.mockMeet ? ' · 🎯 прикиды-синглы' : s.taperWeek ? ' · 📉 разгрузка' : ''}`}
                  full={
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', lineHeight: 1.8 }}>
                      {s.exercises.map((e, ei) => (
                        <div key={ei} style={{
                          marginBottom: 6, padding: '6px 8px', borderRadius: 6,
                          background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)'
                        }}>
                          <div style={{ fontWeight: 700, color: '#fff', marginBottom: 2 }}>
                            {e.exerciseName}
                            <span style={{ fontWeight: 400, color: 'rgba(255,255,255,0.5)', marginLeft: 6 }}>
                              ({e.muscleGroup}) · ПМ {e.best1RM}кг
                            </span>
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                            {e.sets.map((set, si) => (
                              <span key={si} style={{
                                display: 'inline-block', padding: '2px 6px', borderRadius: 4, fontSize: 11,
                                background: 'var(--accent-dim)', border: '1px solid rgba(0,230,138,0.12)',
                                color: 'rgba(255,255,255,0.8)'
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
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)' }}>
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
                    <div key={i} style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', marginBottom: 2 }}>{p.exercise}: {p.lastWeight}кг×{p.lastReps} → e1RM {p.estimated1RM.toFixed(1)}кг</div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {subView === 'macro' && <MacrocyclePanel level={macroLevel} goal={macroGoal} onLevelChange={setMacroLevel} onGoalChange={setMacroGoal} onApplyMacrocycle={(macro) => {
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
           setSelectedCycleId(cycleId);
           setCycleWeeks(weeks);
           buildSrc(cycleId, weeks);
          setSubView('plan');
        }
      }} />}
      {subView === 'plates' && <PlateCalcTab initialWeight={workingWeight} onApply={() => {}} />}
      {subView === 'autoreg' && <AutoregPanel />}
      {subView === 'peak' && <PeakingPanel />}
      {subView === 'peak_bb' && <PeakingPanel defaultKind="bb" />}
      {subView === 'recovery' && (<><RecoveryPanel /><div style={{ marginTop: 10 }}><div style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)', margin: '10px 0 6px' }}>🧮 Training Score Engine</div><TrainingScoreCard workoutsPerWeek={mainTab === 'pl' ? days : bbDays} avgMinutes={75} intensity={autoRegResult.deload ? 'low' : 'moderate'} goal={mainTab === 'pl' ? 'strength' : 'hypertrophy'} experience={(mainTab === 'pl' ? (level === 'novice' ? 'beginner' : level === 'intermediate' ? 'intermediate' : 'advanced') : (bbLevel === 'beginner' ? 'beginner' : bbLevel === 'intermediate' ? 'intermediate' : 'advanced')) as 'beginner' | 'intermediate' | 'advanced'} sleepHours={(linked.readiness?.sleep ?? 7) as number} stressLevel={Math.round((linked.readiness?.stress ?? 3) as number)} jointPain={[]} deloadWeeksAgo={autoRegResult.deload ? 0 : 99} weight={mainTab === 'pl' ? bw : 80} age={30} sex={'male'} /></div><ReadinessForecastCard /></>)}
      {subView === 'safety' && <ExerciseSafetyPanel />}
      {subView === 'demo' && <ExerciseDemoPanel />}
      {subView === 'methods' && (<>
        <MethodsTab linked={linked} trainingOutput={null} diaryStats={[] as any} historyWorkouts={[] as any} goal={mainTab === 'pl' ? goal : bbGoal} level={mainTab === 'pl' ? level : bbLevel} daysPerWeek={mainTab === 'pl' ? days : bbDays} recovery={linked.readiness?.recovery ?? 80} fatigue={linked.readiness?.fatigue ?? 30} appliedMethods={appliedMethods} onToggleMethod={(name, cat) => setAppliedMethods(prev => { const n = { ...prev }; if (n[cat] === name) delete n[cat]; else n[cat] = name; return n; })} onApplyComposition={() => { const keys = Object.keys(appliedMethods); if (keys.length > 0) { const h = deriveHints(appliedMethods); setMethodHints(h); setMethodNote(`✓ Применена методология: ${h.label}${h.volumeMult !== 1 ? ' · объём×' + h.volumeMult : ''}${h.technique ? ' · техн: ' + h.technique : ''}`); } else { setMethodHints({ volumeMult: 1, technique: null, label: '' }); setMethodNote('Выберите методики (по одной из категории)'); } }} />
      </>)}
      {subView === 'analytics' && (<><AnalyticsTab sessions={historyWorkouts} /><VisualTab sessions={historyWorkouts} /></>)}
      {subView === 'prometrics' && <ProMetricsPanel />}
      {subView === 'charts' && <TrainingMetricsChart lms={lmsChart} bb={bbChart} />}
    </div>
  );
};

export default SRCBBScreen;
