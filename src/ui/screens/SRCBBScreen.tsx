import React, { useEffect, useMemo, useRef, useState } from 'react';
import { LMS_CYCLES, getCycleById, normalizeCycleDirection } from '../../data/lms-cycles/lms-cycle-index';
import { rankCycles, selectBestCycle, explainSelection, type LMSSelectorInput } from '../../engines/lms/lms-selector.engine';
import { buildLMSPlan, extractExercises, type LMSBuildOutput } from '../../engines/lms/lms-builder.engine';
import { WEAK_POINTS_BY_LIFT, type Lift, type WeakPoint } from '../../engines/lms/weakpoint-pl';
import { mesocyclePhaseForWeek } from '../../engines/rir-matrix.engine';
import { autoRegulate, shouldTrainToday, type AutoRegOutput } from '../../engines/pro/autoregulation-pro.engine';
import { acuteChronicRatio, toDailyLoads } from '../../engines/pro/training-load.engine';
import { loadSRPESessions } from '../../engines/pro/srpe-store';
import { SPLIT_PATTERNS } from '../../engines/bb/bb-split-patterns';
import { rankBBSplits, selectBestBBSplit, explainBBSelection, type BBSelectorInput } from '../../engines/bb/bb-selector.engine';
import { buildBBPlan, type BBPlan } from '../../engines/bb/bb-builder.engine';
import { calcBBPlanMetrics, explainBBMetrics } from '../../engines/bb/bb-metrics.engine';
import { adaptForPEDs, explainPEDAdaptation, type PED } from '../../engines/bb/bb-ped-adaptation.engine';
import { getAllVolumeLandmarks } from '../../engines/volume-landmarks.engine';
import { PlateCalcTab } from './TrainingScreen_parts/PlateCalcTab';
import { SessionPlayer, type PlayerDay } from './SRCBBScreen_parts/SessionPlayer';

import { AutoregPanel } from './SRCBBScreen_parts/AutoregPanel';
import { PeakingPanel } from './SRCBBScreen_parts/PeakingPanel';
import { RecoveryPanel } from './SRCBBScreen_parts/RecoveryPanel';
import { ExerciseSafetyPanel } from './SRCBBScreen_parts/ExerciseSafetyPanel';
import { TrainingMetricsChart, type LMSWeekMetric, type BBMuscleMetric } from './SRCBBScreen_parts/TrainingMetricsChart';
import { ExerciseDemoPanel } from './SRCBBScreen_parts/ExerciseDemoPanel';
import { ProgramsTab } from './TrainingScreen_parts/ProgramsTab';
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
import { MesocycleProgressionCard } from './TrainingScreen_parts/MesocycleProgressionCard';
import { DeloadProtocolCard } from './TrainingScreen_parts/DeloadProtocolCard';

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
const SMALL: React.CSSProperties = { color: 'rgba(255,255,255,0.55)', fontSize: 10, lineHeight: 1.4 };
const cardBg = CARD;
const ACCENT = '#00e68a';
const BTN: React.CSSProperties = { background: ACCENT, color: '#0a0a0a', border: 'none', borderRadius: 8, padding: '10px 14px', fontWeight: 600, fontSize: 12, minHeight: 40, cursor: 'pointer' };
const BTN_GHOST: React.CSSProperties = { ...BTN, background: 'transparent', color: ACCENT, border: `1px solid ${ACCENT}20` };
const PILL = (active: boolean) => ({ padding:'6px 14px', borderRadius:20, fontSize:10, fontWeight: active ? 700 : 500, cursor:'pointer', border: active ? '1px solid #00e68a' : '1px solid rgba(255,255,255,0.06)', background: active ? 'linear-gradient(135deg,#00e68a,#00c8a0)' : '#18181b', color: active ? '#000' : '#fff', flexShrink:0 } as React.CSSProperties);
const SEL: React.CSSProperties = { background: '#18181b', color: '#fff', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '8px', minHeight: 40, width: '100%', outline: 'none', boxSizing: 'border-box' };
const IN: React.CSSProperties = { ...SEL, padding: '10px' };
const LABEL: React.CSSProperties = { color: 'rgba(255,255,255,0.6)', fontSize: 10, margin: '6px 0 3px' };
const H: React.CSSProperties = { fontSize: 14, fontWeight: 700, color: '#00e68a', marginBottom: 8 };

export const SRCBBScreen: React.FC<{ track?: 'pl' | 'bb' | 'auto' }> = ({ track = 'auto' }) => {
  const [mainTab, setMainTab] = useState<Mode>(track === 'bb' ? 'bb' : track === 'pl' ? 'pl' : 'manual');
  const subViewList: Record<Mode, { key: string; label: string }[]> = {
    pl: [['plan', '📋 План цикла'], ['bridge', '🔗 Мост план→сессия'], ['plates', '🧮 Калькулятор блинов'], ['autoreg', '🧠 Авторегуляция'], ['peak', '🏁 Пик/Соревнования'], ['recovery', '🔋 Восстановление'], ['safety', '🛡 Безопасность'], ['demo', '🎬 Демонстрация']].map(([k, l]) => ({ key: k, label: l })),
    bb: [['plan', '📋 План сплита'], ['bridge', '🔗 Мост план→сессия'], ['peak_bb', '🏆 Шоу ББ'], ['methods', '🧠 Методики'], ['analytics', '📈 Аналитика'], ['prometrics', '🧮 PRO-метрики'], ['charts', '📊 Графики']].map(([k, l]) => ({ key: k, label: l })),
    manual: [],
  };
  const [subView, setSubView] = useState<string>('plan');

  // ── СРЦ ── (инициализация из сессии PL и единого профиля тренированности)
  const _plSaved: any = (() => { try { return JSON.parse(localStorage.getItem('he_pl_session') || 'null'); } catch { return null; } })();
  const _profPL = loadTrainingProfile();
  const [level, setLevel] = useState<string>(_plSaved?.plLevel || 'II-KMS');
  const [goal, setGoal] = useState<string>(_plSaved?.plGoal || 'strength');
  const [dir, setDir] = useState<string>(_plSaved?.plDir || 'powerlifting');
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
      [/гакк/i, pmSquat], [/жим ногами/i, Math.round(pmSquat * 1.5)],
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
  const [builtSrc, setBuiltSrc] = useState<LMSBuildOutput | null>(_plSaved?.builtSrc ?? null);
  const [srcWeek, setSrcWeek] = useState<number>(_plSaved?.srcWeek ?? 1);
  useEffect(() => { try { localStorage.setItem('he_pl_session', JSON.stringify({ selectedCycleId, cycleWeeks, srcWeek, builtSrc, plLevel: level, plGoal: goal, plDir: dir, plBw: bw, plDays: days, pmSquat, pmBench, pmDead, exercisePMs })); } catch { /* ignore */ } }, [selectedCycleId, cycleWeeks, srcWeek, builtSrc, level, goal, dir, bw, days, pmSquat, pmBench, pmDead, exercisePMs]);
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
  const [srcAdditions, setSrcAdditions] = useState<Record<string, { uid: string; name: string; group: string; sets: number; reps: number; weight: number }[]>>({});
  const CAT_GROUPS = ['chest','back','legs','shoulders','arms','core'];
  const GRP_RU: Record<string,string> = { chest:'Грудь', back:'Спина', legs:'Ноги', shoulders:'Плечи', arms:'Руки', core:'Кор' };
  const dayKey = (w: number, di: number) => `${w}_${di}`;
  const addExToDay = (dk: string) => {
    if (!pickerExName) return;
    setSrcAdditions(prev => ({ ...prev, [dk]: [...(prev[dk]||[]), { uid: 'add_'+Date.now()+'_'+Math.random().toString(36).slice(2,6), name: pickerExName, group: pickerGroup, sets: pickerScheme.sets, reps: pickerScheme.reps, weight: pickerScheme.weight }] }));
    setPickerExName(''); setPickerDay(null);
  };
  const addAccessory = (dk: string, name: string, group: string, phase?: string) => {
    const PHASE_SCHEMES: Record<string,{reps:number;pct:number}> = { base:{reps:10,pct:0.67}, build:{reps:8,pct:0.73}, peak:{reps:5,pct:0.80}, deload:{reps:12,pct:0.50} };
    const p = (phase && PHASE_SCHEMES[phase]) ? phase : 'base';
    const s = PHASE_SCHEMES[p] || PHASE_SCHEMES.base;
    const totalW = builtSrc?.weeks.length || 12;
    // расчёт фазы из контекста вызова (сейчас глобальная переменная недоступна в момент вызова)
    const wkNum = Number(dk.split('_')[0]) || 1;
    const ph = mesocyclePhaseForWeek(wkNum, totalW);
    const sc = PHASE_SCHEMES[ph] || PHASE_SCHEMES.base;
    setSrcAdditions(prev => ({ ...prev, [dk]: [...(prev[dk]||[]), { uid: 'acc_'+Date.now()+'_'+Math.random().toString(36).slice(2,6), name, group, sets: 3, reps: sc.reps, weight: Math.round((loadTrainingProfile().workMax[group] || 80) * sc.pct) }] }));
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
  const ranked = useMemo(() => rankCycles({ goal: goal as any, level: level as any, bodyWeight: bw, daysPerWeek: days, direction: dir as any, mode: 'natural' }).filter(r => normalizeCycleDirection(r.cycle.meta.direction) !== 'bodybuilding'), [goal, level, bw, days, dir]);
  const best = ranked[0];

  const buildSrc = () => {
    const tpl = getCycleById(selectedCycleId);
    if (!tpl) return;
    const pmMap: Record<string, number> = { ...exercisePMs };
    if (!pmMap['Присед']) pmMap['Присед'] = pmSquat;
    if (!pmMap['Жим лежа']) pmMap['Жим лежа'] = pmBench;
    if (!pmMap['Становая тяга']) pmMap['Становая тяга'] = pmDead;
    const plan = buildLMSPlan({ 
      template: tpl, pmMap, fallbackPm: 80, mode: 'natural', weeksOverride: cycleWeeks,
      volumeGoal: (linked.profile?.settings?.volumeGoal as any) || 'mav',
      focusLift: (linked.profile?.settings?.focusLift as any),
      currentReadiness: linked.readiness?.recovery,
      equipment: linked.profile?.settings?.equipment,
      weakPoints: weakPoints,
      plWeakPoints: plWeakPoints,
    });
    setBuiltSrc(plan); setSrcWeek(1); setSrcEdits({}); setEditMode(false); setSrcAdditions({}); setPickerDay(null);
    // TRAINING INTEGRATION: конвертировать PL план в сессии
    try { const sessions = lmsPlanToSessions(plan); saveBridgeSessions(sessions); } catch { /* ignore */ }
  };

  // ── BB ──
  const _bbSaved: any = (() => { try { return JSON.parse(localStorage.getItem('he_bb_session') || 'null'); } catch { return null; } })();
  const [bbLevel, setBbLevel] = useState<string>(_bbSaved?.bbLevel || 'intermediate');
  const [bbGoal, setBbGoal] = useState<string>(_bbSaved?.bbGoal || 'mass');
  const [bbDays, setBbDays] = useState<number>(_bbSaved?.bbDays ?? 4);
  const [bbWeeks, setBbWeeks] = useState<number>(_bbSaved?.bbWeeks ?? 4);
  const [bbVolGoal, setBbVolGoal] = useState<string>(_bbSaved?.bbVolGoal || 'mav');
  const [bbFocus, setBbFocus] = useState<string>(_bbSaved?.bbFocus || '');
  const [peds, setPeds] = useState<PED[]>(_bbSaved?.peds ?? (_profPL.onCourse ? (['AAS'] as PED[]) : []));
  const [builtBb, setBuiltBb] = useState<BBPlan | null>(_bbSaved?.builtBb ?? null);
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
  const PL_WEAKPOINT_LABELS: Record<WeakPoint, string> = {
    off_chest: 'Сход с груди', mid: 'Середина', lockout: 'Дожим', start: 'Старт', bottom: 'Низ', sticking_mid: 'Застревание',
  };
  const PL_WP_OPTIONS = (['bench', 'squat', 'deadlift'] as Lift[]).map(lift => ({
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
  useEffect(() => { try { localStorage.setItem('he_bb_session', JSON.stringify({ bbLevel, bbGoal, bbDays, bbWeeks, peds, builtBb, bbWeekSel, bbWorkMax })); } catch { /* ignore */ } }, [bbLevel, bbGoal, bbDays, bbWeeks, peds, builtBb, bbWeekSel]);
  useEffect(() => { try { saveTrainingProfile({ ...loadTrainingProfile(), workMax: bbWorkMax }); } catch { /* ignore */ } }, [bbWorkMax]);
  useEffect(() => { try { saveTrainingProfile({ ...loadTrainingProfile(), onCourse: peds.length > 0 }); } catch {} }, [peds]);
  const [selectedProgram, setSelectedProgram] = useState<string | null>(null);
  const [appliedMethods, setAppliedMethods] = useState<Record<string, string>>({});
  const [methodNote, setMethodNote] = useState<string | null>(null);
  const linked = useDataLink();
  // P12-wire #2: проф-авторегуляция плана (readiness + HRV + ACWR из sRPE-дневника)
  const [autoRegOn, setAutoRegOn] = useState<boolean>(false);
  const autoRegResult: AutoRegOutput = useMemo(() => {
    const rec = linked.readiness?.recovery ?? 80;
    const fat = linked.readiness?.fatigue ?? 30;
    const sleep = linked.readiness?.sleep ?? 70;
    const hrv = linked.profile?.settings?.baselineHrvRatio ?? 1.0;
    const srpe = loadSRPESessions();
    const acwr = srpe.length >= 2 ? acuteChronicRatio(toDailyLoads(srpe)) : { ratio: 1.0, zone: 'optimal' as const };
    return autoRegulate({ readiness: rec, acwr: { ratio: acwr.ratio, zone: acwr.zone }, fatigue: fat, hrvRatio: hrv, sleepScore: sleep, plannedTopSetPct: 0.85, plannedRIR: 2 });
  }, [linked.readiness, linked.profile?.settings]);
  const diary = useMemo(() => new StrengthDiary(), []);
  const [historyWorkouts, setHistoryWorkouts] = useState<WorkoutLog[]>([]);
  useEffect(() => { (async () => { try { const w = await diary.getWorkoutLogs(); setHistoryWorkouts(w.reverse()); } catch { /* ignore */ } })(); }, [diary]);

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
    const totalW = bridgeWeeks.length || 12;
    return mesocyclePhaseForWeek(bridgeWeek, Math.max(totalW, bridgeWeek));
  }, [bridgeWeek, bridgeWeeks]);

  const bbRanked = useMemo(() => rankBBSplits({ level: bbLevel, goal: bbGoal as any, daysPerWeek: bbDays }), [bbLevel, bbGoal, bbDays]);
  const bbBest = bbRanked[0];

  const buildBb = () => {
    if (!bbBest) return;
    const plan = buildBBPlan({ 
      patternId: bbBest.pattern.id, level: bbLevel, goal: bbGoal as any, weeks: bbWeeks, 
      workMax: bbWorkMax, weakPoints, focusGroup: bbFocus, volumeGoal: bbVolGoal as any 
    }, pedAdapt);
    setBuiltBb(plan); setBbWeekSel(1);
    // TRAINING INTEGRATION: конвертировать BB план в сессии
    try { const sessions = bbPlanToSessions(plan); saveBridgeSessions(sessions); } catch { /* ignore */ }
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
      setWeakPoints(p.data?.groups || []); pendingApplyRef.current = p;
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
  const pedAdapt = useMemo(() => adaptForPEDs(peds, baseMrv), [peds, baseMrv]);

  const togglePed = (p: PED) => setPeds(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);
  const srcDays: PlayerDay[] = useMemo(() => {
    if (!builtSrc) return [];
    const wk0 = builtSrc.weeks[0]; const w0 = wk0.week;
    return wk0.days.map((d, i) => ({
      label: `Д${i + 1}`,
      exercises: [
        ...d.exercises.map((e, ei) => ({
          name: e.name, muscleGroup: e.group,
          targetSets: e.workSets.flatMap((ws, si) => { let es = effSet(w0, i, ei, si, ws); if (autoRegOn && autoRegResult) { es = { ...es, sets: Math.round(es.sets * autoRegResult.volumeMultiplier), weight: Math.round(es.weight * autoRegResult.topSetPctMultiplier * 10) / 10 }; } const priMult = (priAdjust ? priAdjust.volumeMult : 1) * (deloadAdjust ? deloadAdjust.volumeMult : 1) * (peakAdjust ? peakAdjust.volumeMult : 1); const priRir = peakAdjust ? peakAdjust.rirTarget : ((priAdjust ? priAdjust.rirShift : 0) + rirShiftAdjust + (deloadAdjust ? deloadAdjust.rirShift : 0)); es = { ...es, sets: Math.max(1, Math.round(es.sets * priMult)) }; return Array.from({ length: es.sets }, () => ({ weight: es.weight, reps: es.reps, rir: Math.max(0, priRir), tempo: tempoAdjust ? tempoAdjust : undefined })); }),
          pm: e.pm, coef: e.coef, mnosz: e.mnosz, group: e.group,
        })),
        ...(srcAdditions[dayKey(w0, i)] || []).map(a => ({
          name: a.name, muscleGroup: a.group,
          targetSets: Array.from({ length: a.sets }, () => ({ weight: a.weight, reps: a.reps, rir: 0 })),
          pm: Math.max(a.weight * 1.4, 1), coef: 1, mnosz: 1, group: a.group,
        })),
      ],
    }));
  }, [builtSrc, srcEdits, srcAdditions, autoRegOn, autoRegResult, priAdjust, tempoAdjust, rirShiftAdjust, deloadAdjust, peakAdjust]);

  const bbDaysArr: PlayerDay[] = useMemo(() => {
    if (!builtBb) return [];
    const wk = builtBb.weeks[0];
    return wk.sessions.map((sess, i) => ({
      label: `Д${i + 1} ${sess.character}`,
      exercises: sess.exercises.map(e => {
        let w = e.workSets[0].weight;
        let reps = e.workSets[0].reps;
        let sets = e.sets;
        if (autoRegOn && autoRegResult) {
          w = Math.round(w * autoRegResult.topSetPctMultiplier * 10) / 10;
          sets = Math.max(1, Math.round(sets * autoRegResult.volumeMultiplier));
        }
        const priMult = (priAdjust ? priAdjust.volumeMult : 1) * (deloadAdjust ? deloadAdjust.volumeMult : 1) * (peakAdjust ? peakAdjust.volumeMult : 1);
        const priRir = peakAdjust ? peakAdjust.rirTarget : ((priAdjust ? priAdjust.rirShift : 0) + rirShiftAdjust + (deloadAdjust ? deloadAdjust.rirShift : 0));
        sets = Math.max(1, Math.round(sets * priMult));
        const rirOut = Math.max(0, peakAdjust ? peakAdjust.rirTarget : (e.rir + priRir));
        return {
          name: e.muscle, muscleGroup: e.muscle,
          targetSets: Array.from({ length: sets }, () => ({ weight: w, reps, rir: rirOut, tempo: tempoAdjust ? tempoAdjust : undefined })),
        };
      }),
    }));
  }, [builtBb, autoRegOn, autoRegResult, priAdjust, tempoAdjust, rirShiftAdjust, deloadAdjust, peakAdjust]);

  const playerDays: PlayerDay[] = mainTab === 'pl' ? srcDays : bbDaysArr;
  const workingWeight = useMemo(() => {
    if (mainTab === 'pl' && builtSrc) return builtSrc.weeks[0]?.days[0]?.exercises[0]?.workSets[0]?.weight || 100;
    if (mainTab === 'bb' && builtBb) return builtBb.weeks[0]?.sessions[0]?.exercises[0]?.workSets[0]?.weight || 100;
    return 100;
  }, [mainTab, builtSrc, builtBb]);
  const runFocus = mainTab === 'pl' ? (getCycleById(selectedCycleId)?.meta.title || 'Силовой цикл') : 'BB';
  const lmsChart: LMSWeekMetric[] = useMemo(() => {
    if (!builtSrc) return [];
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
    if (!builtBb) return [];
    const mult = methodHints.volumeMult;
    return calcBBPlanMetrics(builtBb, pedAdapt.combinedMrvMultiplier).perMuscle.map(p => ({ muscle: p.muscle, sets: Math.round(p.totalSets * mult), тяж: Math.round(p.тяжSets * mult), памп: Math.round(p.пампSets * mult), mrv: p.mrv }));
  }, [builtBb]);

  // Сохраняем построенный план (дни + фокус + неделя) в localStorage, чтобы
  // вкладка «Тренировки» (runtime) могла запустить его выполнение.
  useEffect(() => {
    if (playerDays.length > 0) {
      try { localStorage.setItem('he_pl_runtime', JSON.stringify({ days: playerDays, focus: runFocus, week: srcWeek, track: mainTab })); } catch { /* ignore */ }
    }
  }, [playerDays, runFocus, srcWeek, mainTab]);
  return (
    <div key={mainTab} style={{ padding: 12, color: '#fff', maxWidth: 720, margin: '0 auto' }}>
      {/* Заголовок текущего режима планирования (выбор режима — в навигации блока) */}
      <div style={{ marginBottom: 10, padding: '8px 12px', borderRadius: 12, background: 'rgba(0,230,138,0.06)', border: '1px solid rgba(0,230,138,0.18)', textAlign: 'center' }}>
        <span style={{ fontSize: 13, fontWeight: 800, color: '#00e68a' }}>{mainTab === 'pl' ? '🏆 Силовой цикл (ПЛ)' : mainTab === 'bb' ? '💪 Бодибилдинг (ББ)' : '🛠 Ручной конструктор'}</span>
      </div>
      {applyPayload && (
        <div style={{ padding: '10px 12px', borderRadius: 10, background: 'rgba(0,230,138,0.1)', border: '1px solid rgba(0,230,138,0.25)', marginBottom: 10, fontSize: 11, color: '#00e68a', fontWeight: 700, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>✓ Применено: {applyPayload.label}</span>
          <button onClick={() => { clearPlannerApply(); setApplyPayload(null); }} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'rgba(255,255,255,0.5)', fontSize: 10, cursor: 'pointer' }}>✕</button>
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
        <div>
          <div style={H}>🏆 Авто-подбор силового цикла</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <PopupSelect label="Уровень спортсмена" value={level} onChange={setLevel} options={[['novice','Новичок'],['II-KMS','II разряд — КМС'],['KMS-MS','КМС — МС'],['MS-MSMK','МС — МСМК'],['II-MS','II разряд — МС'],['intermediate','Средний']].map(([id,label]) => ({ id, label }))} />
            <PopupSelect label="Цель тренировок" value={goal} onChange={setGoal} options={[['strength','Сила'],['mass','Мышечная масса'],['endurance','Выносливость'],['peak','Выход на пик'],['mixed','Смешанная']].map(([id,label]) => ({ id, label }))} />
            <PopupSelect label="Направление" value={dir} onChange={setDir} options={[['powerlifting','Троеборье'],['bench','Жим лёжа'],['deadlift_bench','Тяга + Жим'],['armwrestling','Армрестлинг']].map(([id,label]) => ({ id, label }))} />
            <PopupNumber label="Дней в неделю" value={days} min={2} max={7} suffix="" onChange={v => setDays(v)} />
            <PopupNumber label="Вес тела" value={bw} min={40} max={200} suffix=" кг" onChange={v => setBw(v)} />
          </div>
          {best && <ExpandableCard title={`🏆 Рекомендован: ${best.cycle.meta.title}`} icon="🏆" short={best.cycle.meta.description} full={<><div style={{ marginBottom: 8 }}><b>Почему этот цикл:</b> {explainSelection(best)}</div><div style={{ fontSize: 10, color: "rgba(255,255,255,0.55)" }}>{best.cycle.meta.howItWorks}</div><button onClick={() => { setSelectedCycleId(best.cycle.meta.id); setTimeout(buildSrc, 0); }} style={{ marginTop: 10, width: "100%", padding: 10, borderRadius: 8, border: "none", cursor: "pointer", background: "linear-gradient(135deg,#00e68a,#00c853)", color: "#000", fontWeight: 700, fontSize: 12 }}>✅ Применить цикл и собрать план</button></>} />}
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
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                    <PopupNumber label="Присед" value={pmSquat} min={20} max={500} suffix=" кг" onChange={v => setPmSquat(v)} />
                    <PopupNumber label="Жим лёжа" value={pmBench} min={20} max={400} suffix=" кг" onChange={v => setPmBench(v)} />
                    <PopupNumber label="Становая тяга" value={pmDead} min={20} max={500} suffix=" кг" onChange={v => setPmDead(v)} />
                  </div>
                  {exs.length > 3 && (
                    <div style={{ marginTop: 10, padding: '8px 10px', borderRadius: 8, background: 'rgba(0,230,138,0.04)', border: '1px solid rgba(0,230,138,0.1)' }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: ACCENT, marginBottom: 6 }}>🔧 Дополнительные ПМ по упражнениям цикла</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr ' + (cols > 3 ? '1fr' : ''), gap: 6 }}>
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
                <div style={{ fontSize: 9, color: 'var(--text-dim)', marginBottom: 6 }}>
                  Цикл использует {exs.length} упражнений. Укажите ПМ для каждого:
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr ' + (cols > 3 ? '1fr' : ''), gap: 6 }}>
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
            <PopupSelect label="Длина мезоцикла" value={String(cycleWeeks)} onChange={v => setCycleWeeks(+v)} options={[['12','12 недель'],['16','16 недель'],['20','20 недель'],['24','24 недели']].map(([id,label]) => ({ id, label }))} />
          </div>
          <div style={{ marginTop: 8, fontSize: 11, fontWeight: 700, color: ACCENT }}>🎯 Слабые группы (акцент, сохраняются в профиль)</div>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 4, marginBottom: 6 }}>{WEAK_GROUPS.map(([id, l]) => { const on = weakPoints.includes(id); return <button key={id} onClick={() => toggleWeak(id)} style={{ padding: "5px 10px", borderRadius: 14, fontSize: 10, fontWeight: 700, cursor: "pointer", border: on ? "1px solid #00e68a" : "1px solid rgba(255,255,255,0.08)", background: on ? "rgba(0,230,138,0.15)" : "rgba(255,255,255,0.02)", color: on ? "#00e68a" : "rgba(255,255,255,0.6)" }}>{l}{on ? " ✓" : ""}</button>; })}</div>
          <div style={{ marginTop: 8, fontSize: 11, fontWeight: 700, color: '#8b5cf6' }}>🎯 Слабые точки СРЦ-движений (диагностика weakpoint-pl)</div>
          {PL_WEAKPOINT_OPTIONS.map((opt) => (
            <div key={opt.lift} style={{ marginTop: 4 }}>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', marginBottom: 2 }}>{opt.lift === 'bench' ? 'Жим лёжа' : opt.lift === 'squat' ? 'Присед' : 'Становая'}</div>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {opt.weakPoints.map((wp) => {
                  const on = plWeakPoints.some(x => x.lift === opt.lift && x.weakPoint === wp.id);
                  return <button key={wp.id} onClick={() => togglePlWeak(opt.lift, wp.id)} style={{ padding: "4px 8px", borderRadius: 12, fontSize: 9, fontWeight: 700, cursor: "pointer", border: on ? "1px solid #8b5cf6" : "1px solid rgba(255,255,255,0.08)", background: on ? "rgba(139,92,246,0.15)" : "rgba(255,255,255,0.02)", color: on ? "#8b5cf6" : "rgba(255,255,255,0.6)" }}>{wp.label}{on ? " ✓" : ""}</button>;
                })}
              </div>
            </div>
          ))}
          <button style={{ ...BTN, width: '100%', marginTop: 10, minHeight:44, fontSize:13 }} onClick={buildSrc}>Сгенерировать план ({cycleWeeks} нед)</button>
          {builtSrc && (() => {
            const W = builtSrc.weeks;
            const wk = W[Math.min(srcWeek, W.length) - 1] || W[0];
            const totalW = W.length;
            const phase = mesocyclePhaseForWeek(wk.week, totalW);
            const PH_RU: Record<string,string> = { base: 'База (накопление)', build: 'Накопление (рост объёма)', peak: 'Пик (интенсификация)', deload: 'Разгрузка' };
            const PH_COLOR: Record<string,string> = { base: '#22c55e', build: '#eab308', peak: '#ef4444', deload: '#60a5fa' };
            const PH_DESC: Record<string,string> = {
              base: 'Фаза базы: акклиматизация, наращивание объёма при контроле техники. RIR 2-3, вес = PM_нед × %ПМ.',
              build: 'Фаза накопления: пик объёма (MAV), прогрессия весов, RIR 1-2. КПШ и тоннаж максимальны.',
              peak: 'Пиковая фаза: интенсификация — %ПМ растёт, объём снижается, RIR 0-1. Готовность к тесту/соревнованию.',
              deload: 'Разгрузка: 50-60% объёма, RIR 4, восстановление перед следующим мезоциклом.',
            };
            const setStr = (s: { sets: number; reps: number; weight: number; pct: number }) => {
              let sets = s.sets, weight = s.weight;
              if (autoRegOn && autoRegResult) { sets = Math.round(sets * autoRegResult.volumeMultiplier); weight = Math.round(weight * autoRegResult.topSetPctMultiplier * 10) / 10; }
              sets = Math.max(1, Math.round(sets * bridgeMult));
              return sets + 'x' + s.reps + 'x' + weight + 'кг (' + Math.round(s.pct*100) + '%)' + (autoRegOn && autoRegResult && (autoRegResult.topSetPctMultiplier !== 1 || autoRegResult.volumeMultiplier !== 1) ? ' ⚡' : '') + (bridgeMult !== 1 || bridgeRir !== 0 ? ' 🔗' : '');
            };
            return <div style={CARD}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', gap:8 }}>
                <div style={{ ...H, margin:0 }}>План: {builtSrc.template.meta.title}</div>
                <span style={{ fontSize:10, fontWeight:700, color: PH_COLOR[phase], background: PH_COLOR[phase]+'22', padding:'3px 8px', borderRadius:10 }}>{PH_RU[phase]}</span>
              </div>
              <div style={{ ...SMALL, marginTop:4 }}>{builtSrc.progressionRationale}</div>
              {methodHints.label && <div style={{ marginTop:4, fontSize:10, color:'#00e68a', background:'rgba(0,230,138,0.08)', border:'1px solid rgba(0,230,138,0.2)', padding:'3px 8px', borderRadius:8, display:'inline-block' }}>🧩 {methodHints.label}{methodHints.volumeMult !== 1 ? ' · объём×' + methodHints.volumeMult : ''}{methodHints.technique ? ' · ' + methodHints.technique : ''}</div>}
              <div style={{ display:'flex', gap:6, marginTop:8, alignItems:'center', flexWrap:'wrap' }}>
                <button onClick={() => setEditMode(m => !m)} style={{ ...BTN_GHOST, padding:'6px 10px', minHeight:34, fontSize:11 }}>{editMode ? '✓ Готово' : '✏️ Правка плана'}</button>
                {editMode && <button onClick={() => setSrcEdits({})} disabled={Object.keys(srcEdits).length===0} style={{ ...BTN_GHOST, padding:'6px 10px', minHeight:34, fontSize:11, opacity: Object.keys(srcEdits).length===0?0.4:1 }}>↺ Сбросить</button>}
                {editMode && <span style={{ ...SMALL }}>правка недели 1 применяется к «Выполнение»</span>}
              </div>
              {/* P12-wire #2: проф-авторегуляция плана */}
              {(() => {
                const stt = shouldTrainToday({ readiness: linked.readiness?.recovery ?? 80, acwr: autoRegResult.deload ? { ratio: 1.8, zone: 'dangerous' } : { ratio: 1.0, zone: 'optimal' }, fatigue: linked.readiness?.fatigue ?? 30, hrvRatio: linked.profile?.settings?.baselineHrvRatio ?? 1.0 });
                return (
                  <div style={{ marginTop:8, padding:'8px 10px', borderRadius:10, background: autoRegResult.deload ? 'rgba(239,68,68,0.08)' : 'rgba(96,165,250,0.06)', border: '1px solid ' + (autoRegResult.deload ? 'rgba(239,68,68,0.25)' : 'rgba(96,165,250,0.2)') }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <div>
                        <span style={{ fontSize:11, fontWeight:700, color: stt.train ? (autoRegResult.deload ? '#ef4444' : '#60a5fa') : '#ef4444' }}>
                          {stt.train ? '✅' : '⚠️'} {stt.reason}
                        </span>
                        {autoRegResult.intensityNote && <span style={{ marginLeft: 8, fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: autoRegResult.intensityNote === 'силовая' ? 'rgba(239,68,68,0.15)' : autoRegResult.intensityNote === 'восстановительная' ? 'rgba(34,197,94,0.15)' : 'rgba(245,158,11,0.15)', color: autoRegResult.intensityNote === 'силовая' ? '#ef4444' : autoRegResult.intensityNote === 'восстановительная' ? '#22c55e' : '#f59e0b' }}>{autoRegResult.intensityNote === 'силовая' ? 'СИЛОВАЯ' : autoRegResult.intensityNote === 'восстановительная' ? 'ВОССТАНОВИТ.' : autoRegResult.intensityNote === 'лёгкая' ? 'ЛЁГКАЯ' : ''}</span>}
                      </div>
                      <span style={{ marginRight: 8, fontSize: 10, fontWeight: 700, color: autoRegResult.deload ? '#ef4444' : '#60a5fa' }}>Авторегуляция {autoRegOn ? 'ВКЛ' : 'ВЫКЛ'}</span>
                      <button onClick={() => setAutoRegOn(a => !a)} style={{ padding:'5px 10px', borderRadius:6, fontSize:10, fontWeight:700, cursor:'pointer', border:'none', background: autoRegOn ? '#60a5fa' : 'rgba(255,255,255,0.1)', color: autoRegOn ? '#000' : 'var(--text-dim)' }}>{autoRegOn ? 'Отключить' : 'Применить'}</button>
                    </div>
                    {autoRegOn && <div style={{ marginTop:6, fontSize:10, color:'rgba(255,255,255,0.7)' }}>
                      <div>Топ-сет ×{autoRegResult.topSetPctMultiplier} · объём ×{autoRegResult.volumeMultiplier} · RIR +{autoRegResult.rirShift}{autoRegResult.deload ? ' · 🔴 DELOAD' : ''}</div>
                      {autoRegResult.decisions.slice(0,3).map((d, i) => <div key={i} style={{ marginTop:2, color:'rgba(255,255,255,0.55)' }}>• {d}</div>)}
                    </div>}
                  </div>
                );
              })()}
              {/* Exercise picker popup */}
              {pickerDay && (
                <div style={{ position:'fixed', inset:0, zIndex:200, display:'flex', background:'rgba(0,0,0,0.9)' }} onClick={() => setPickerDay(null)}>
                  <div onClick={e => e.stopPropagation()} style={{ width:'100%', maxWidth:480, margin:'0 auto', background:'#18181b', display:'flex', flexDirection:'column' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 12px 0' }}>
                      <span style={{ fontSize:14, fontWeight:700, color:'#00e68a' }}>＋ Упражнение в день</span>
                      <button onClick={() => setPickerDay(null)} style={{ fontSize:10, color:'#ef4444', border:'none', background:'transparent', cursor:'pointer', padding:'4px 8px' }}>✕</button>
                    </div>
                    <div style={{ flex:1, overflowY:'auto', padding:'8px 12px 80px' }}>
                      <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginBottom:8 }}>{CAT_GROUPS.map(g => <button key={g} onClick={() => { setPickerGroup(g); setPickerExName(''); }} style={{ padding:'5px 10px', borderRadius:16, fontSize:9, cursor:'pointer', border: pickerGroup===g?'1px solid #00e68a':'1px solid rgba(255,255,255,0.08)', background: pickerGroup===g?'rgba(0,230,138,0.15)':'rgba(255,255,255,0.03)', color: pickerGroup===g?'#00e68a':'rgba(255,255,255,0.7)' }}>{GRP_RU[g]||g}</button>)}</div>
                      <select value={pickerExName} onChange={e => setPickerExName(e.target.value)} style={{ ...SEL, marginBottom:8 }}>
                        <option value=''>— выберите упражнение —</option>
                        {getExercisesByGroup(pickerGroup).map(ex => <option key={ex.id} value={ex.name}>{ex.name}</option>)}
                      </select>
                      <div style={{ display:'flex', gap:6, alignItems:'center', marginBottom:8 }}>
                        <span style={{ fontSize:9, color:'rgba(255,255,255,0.6)' }}>Подходы</span>
                        <input type='number' value={pickerScheme.sets} onChange={e => setPickerScheme(s => ({ ...s, sets: +e.target.value }))} style={{ width:48, ...IN, padding:'4px', fontSize:10 }} />
                        <span style={{ fontSize:9 }}>×</span>
                        <input type='number' value={pickerScheme.reps} onChange={e => setPickerScheme(s => ({ ...s, reps: +e.target.value }))} style={{ width:48, ...IN, padding:'4px', fontSize:10 }} />
                        <span style={{ fontSize:9 }}>×</span>
                        <input type='number' value={pickerScheme.weight} onChange={e => setPickerScheme(s => ({ ...s, weight: +e.target.value }))} style={{ width:56, ...IN, padding:'4px', fontSize:10 }} />
                        <span style={{ fontSize:9, color:'rgba(255,255,255,0.5)' }}>кг</span>
                      </div>
                      <button onClick={() => addExToDay(pickerDay)} disabled={!pickerExName} style={{ width:'100%', padding:'10px', borderRadius:8, border:'none', cursor:'pointer', fontWeight:700, fontSize:11, background: pickerExName ? 'linear-gradient(135deg,#00e68a,#00c8a0)' : 'rgba(255,255,255,0.1)', color: pickerExName ? '#000' : 'rgba(255,255,255,0.3)' }}>Добавить в день</button>
                    </div>
                  </div>
                </div>
              )}
              <div style={{ marginTop:10 }}>
                <div style={{ fontSize:12, color:'rgba(255,255,255,0.7)', marginBottom:6, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <span style={{ fontWeight:700, color:'#fff' }}>Неделя {wk.week} из {totalW}</span>
                  <span style={{ fontSize:11, fontWeight:700, color:PH_COLOR[phase], background:PH_COLOR[phase]+'22', padding:'2px 10px', borderRadius:8 }}>{PH_RU[phase]}</span>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(40px, 1fr))', gap:4 }}>
                  {W.map(w => { const ph = mesocyclePhaseForWeek(w.week, totalW); const active = w.week===wk.week; return <button key={w.week} onClick={() => setSrcWeek(w.week)} title={'Неделя '+w.week+': '+PH_RU[ph]} style={{ padding:'8px 0', borderRadius:8, border: active ? '1px solid #00e68a' : '1px solid rgba(255,255,255,0.08)', background: active ? PH_COLOR[ph] : PH_COLOR[ph]+'1a', color: active ? '#000' : '#fff', fontSize:11, fontWeight:700, cursor:'pointer', minHeight:38 }}>{w.week}</button>; })}
                </div>
              </div>
              {/* Визуальный календарь мезоцикла: недели × дни с тоннажём и фазой */}
              <div style={{ marginTop: 8, padding: 8, borderRadius: 10, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.6)', marginBottom: 6 }}>📅 Календарь мезоцикла (нед × дни, тоннаж)</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {W.map(w => { const ph = mesocyclePhaseForWeek(w.week, totalW); const active = w.week === wk.week; const maxT = Math.max(1, ...W.map(ww => ww.days.reduce((s, d) => s + d.metrics.tonnage, 0))); const wTotal = w.days.reduce((s, d) => s + d.metrics.tonnage, 0); return (
                    <div key={w.week} onClick={() => setSrcWeek(w.week)} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 6px', borderRadius: 6, cursor: 'pointer', background: active ? 'rgba(0,230,138,0.08)' : 'transparent', border: active ? '1px solid rgba(0,230,138,0.3)' : '1px solid transparent' }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: active ? '#00e68a' : 'rgba(255,255,255,0.7)', minWidth: 26 }}>Н{w.week}</span>
                      <span style={{ width: 4, height: 14, borderRadius: 2, background: PH_COLOR[ph], flexShrink: 0 }} title={PH_RU[ph]} />
                      <div style={{ flex: 1, display: 'flex', gap: 2 }}>
                        {w.days.map((d, di) => { const t = d.metrics.tonnage; return <div key={di} title={'Д' + (di+1) + ': ' + t.toFixed(0) + ' кг·пов'} style={{ flex: 1, height: 14, borderRadius: 3, background: t > 0 ? `linear-gradient(180deg, ${PH_COLOR[ph]}, ${PH_COLOR[ph]}88)` : 'rgba(255,255,255,0.04)', opacity: 0.4 + 0.6 * (t / maxT) }} />; })}
                      </div>
                      <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.5)', minWidth: 38, textAlign: 'right' }}>{wTotal.toFixed(0)}</span>
                    </div>
                  ); })}
                </div>
              </div>
              <div style={{ ...SMALL, marginTop:6, color:'rgba(255,255,255,0.7)' }}>{PH_DESC[phase]}</div>
              <MetricCard title={'ПМ на неделю '+wk.week+' (прогрессия)'} icon="📈" accent="#60a5fa">
                <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>{Object.entries(wk.pmRow).map(([n, pm]) => <span key={n} style={{ ...SMALL, color:'#fff', background:'rgba(96,165,250,0.08)', padding:'3px 8px', borderRadius:6, border:'1px solid rgba(96,165,250,0.15)' }}><b>{n}:</b> {pm.toFixed(1)} кг</span>)}</div>
              </MetricCard>
              {/* График прогрессии ПМ по неделям */}
              {(() => {
                const exNames = Object.keys(builtSrc.weeks[0]?.pmRow || {}).slice(0, 3);
                if (exNames.length === 0) return null;
                const allVals = builtSrc.weeks.flatMap(w => exNames.map(n => w.pmRow[n] || 0));
                const minV = Math.min(...allVals), maxV = Math.max(...allVals);
                const W2 = builtSrc.weeks.length;
                const colors = ['#00e68a', '#60a5fa', '#a855f7'];
                const px = (i: number) => 24 + (i / Math.max(1, W2 - 1)) * 280;
                const py = (v: number) => 70 - ((v - minV) / Math.max(1, maxV - minV)) * 56;
                return <div style={{ marginTop: 8, padding: 10, borderRadius: 10, background: 'rgba(96,165,250,0.05)', border: '1px solid rgba(96,165,250,0.15)' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#60a5fa', marginBottom: 6 }}>📈 Прогрессия ПМ по неделям</div>
                  <svg width="100%" viewBox="0 0 320 80" style={{ maxWidth: 360, margin: '0 auto', display: 'block' }}>
                    {[0,1,2,3].map(g => <line key={g} x1={24} x2={304} y1={14 + g * 18} y2={14 + g * 18} stroke="rgba(255,255,255,0.06)" strokeWidth={0.5} />)}
                    {exNames.map((n, ei) => { const pts = builtSrc.weeks.map((w, i) => `${px(i)},${py(w.pmRow[n] || 0)}`).join(' '); return <polyline key={n} points={pts} fill="none" stroke={colors[ei]} strokeWidth={1.6} />; })}
                    {exNames.map((n, ei) => builtSrc.weeks.map((w, i) => <circle key={n + i} cx={px(i)} cy={py(w.pmRow[n] || 0)} r={2} fill={colors[ei]} />))}
                  </svg>
                  <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 4 }}>{exNames.map((n, ei) => <span key={n} style={{ fontSize: 9, color: colors[ei] }}>● {n}</span>)}</div>
                </div>;
              })()}
              <div style={{ marginTop:8 }}>
                <SaveButton label="💾 Сохранить программу" savedLabel="✓ Программа сохранена" onSave={() => { try { const cycle = LMS_CYCLES.find(c => c.meta.id === selectedCycleId); const data = { name: `PL ${cycle?.meta.title || selectedCycleId || 'цикл'}`, date: new Date().toISOString().slice(0,10), goal: level, weekCount: totalW, cycleWeeks, generatedAt: Date.now() }; const existing = JSON.parse(localStorage.getItem('myTrainingPlans') || '[]'); existing.unshift(data); localStorage.setItem('myTrainingPlans', JSON.stringify(existing.slice(0,30))); } catch {} }} />
              </div>
              {wk.days.map((d, di) => (
                <div key={di} style={{ ...CARD, marginTop:10, borderLeft:`3px solid ${ACCENT}` }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8, gap:6 }}>
                    <span style={{ fontSize:13, fontWeight:700, color:'#fff' }}>🏋️ День {di+1}{d.exercises[0]?.load ? ' · '+d.exercises[0].load : ''}</span>
                    <span style={{ fontSize:8, color:'rgba(255,255,255,0.4)', textAlign:'right' }}>{d.metrics.tonnage.toFixed(0)}т · {d.metrics.kpsh}КПШ · УОИ {d.metrics.uoi.toFixed(2)}</span>
                  </div>
                  {!editMode && (
                    <div style={{ background:'rgba(255,255,255,0.02)', borderRadius:8, overflowX:'auto', overflowY:'hidden', WebkitOverflowScrolling:'touch', border:'1px solid rgba(255,255,255,0.06)', scrollbarWidth:'none', msOverflowStyle:'none' }}>
                      <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 0.6fr 0.7fr', gap:2, padding:'5px 6px', fontSize:10, fontWeight:700, color:'rgba(255,255,255,0.45)', textTransform:'uppercase', background:'rgba(0,230,138,0.05)' }}>
                        <span>Упражнение</span><span>Подходы</span><span>Хар-р</span><span>Темп</span>
                      </div>
                       {d.exercises.map((e, ei) => {
                         const tmpo = getTempo(e.name, goal, e.load === 'main');
                         const currentT = e.workSets.map((ws, si) => {
                           const k = setKey(wk.week, di, ei, si);
                           return tempoStr || srcEdits[k]?.tempo || tmpo.tempo.toString;
                         });
                         return (
                          <div key={ei} style={{ display:'grid', gridTemplateColumns:'2fr 1fr 0.6fr 0.7fr', gap:2, padding:'6px 6px', fontSize:11, color:'rgba(255,255,255,0.9)', borderTop:'1px solid rgba(255,255,255,0.05)', alignItems:'center' }}>
                           <span style={{ fontWeight:600, whiteSpace:'normal', overflowWrap:'anywhere' }}>{e.name}</span>
                           <span style={{ color:'rgba(255,255,255,0.85)' }}>{e.workSets.map((ws, si) => setStr(effSet(wk.week, di, ei, si, ws))).join('  ·  ')}</span>
                           <span style={{ fontSize:9, fontWeight:700, color:e.load === 'main' ? '#00e68a' : e.load === 'additional' ? '#f59e0b' : 'rgba(255,255,255,0.4)' }}>{e.load === 'main' ? 'ОСН' : e.load === 'additional' ? 'ДОП' : 'АКС'}</span>
                           <span style={{ fontSize:9, color:'#a855f7', fontWeight:700, background:'rgba(168,85,247,0.1)', padding:'2px 6px', borderRadius:4, textAlign:'center' }}>{tempoStr || currentT[0]}</span>
                         </div>
                         );
                       })}

                    </div>
                  )}
                  {editMode && d.exercises.map((e, ei) => (
                    <div key={ei} style={{ background:'rgba(255,255,255,0.02)', borderRadius:8, padding:'6px 8px', marginBottom:4, border:'1px solid rgba(255,255,255,0.04)' }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:2 }}>
                        <span style={{ fontSize:11, fontWeight:600, color:'#fff' }}>{e.name}</span>
                        <span style={{ fontSize:9, color:e.load === 'main' ? '#00e68a' : e.load === 'additional' ? '#f59e0b' : 'rgba(255,255,255,0.4)', fontWeight:600, padding:'1px 6px', borderRadius:4, background: e.load === 'main' ? 'rgba(0,230,138,0.1)' : e.load === 'additional' ? 'rgba(245,158,11,0.1)' : 'transparent' }}>
                          {e.load === 'main' ? 'ОСН' : e.load === 'additional' ? 'ДОП' : 'АКС'}
                        </span>
                      </div>
                      <div style={{ fontSize:9, color:'rgba(255,255,255,0.7)' }}>
                        {editMode ? (
                          <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
                            {e.workSets.map((ws, si) => { const k = setKey(wk.week, di, ei, si); const es = effSet(wk.week, di, ei, si, ws); const INM: React.CSSProperties = { background:'#18181b', color:'#fff', border:'1px solid rgba(255,255,255,0.1)', borderRadius:4, padding:'2px 4px', fontSize:9, textAlign:'center' }; return (
                               <div key={si} style={{ display:'flex', gap:3, alignItems:'center' }}>
                                 <span style={{ fontSize:9, color:'rgba(255,255,255,0.3)' }}>С{si+1}</span>
                                 <input type='number' value={es.weight} onChange={ev => setSrcEdits(prev => ({ ...prev, [k]: { ...prev[k], weight: +ev.target.value } }))} style={{ ...INM, width:44 }} />
                                 <span style={{ fontSize:9 }}>×</span>
                                 <input type='number' value={es.reps} onChange={ev => setSrcEdits(prev => ({ ...prev, [k]: { ...prev[k], reps: +ev.target.value } }))} style={{ ...INM, width:32 }} />
                                 <span style={{ fontSize:9 }}>×</span>
                                 <input type='number' value={es.sets} onChange={ev => setSrcEdits(prev => ({ ...prev, [k]: { ...prev[k], sets: +ev.target.value } }))} style={{ ...INM, width:28 }} />
                                 <input type='text' value={srcEdits[k]?.tempo || ''} onChange={ev => setSrcEdits(prev => ({ ...prev, [k]: { ...prev[k], tempo: ev.target.value } }))} style={{ ...INM, width:56, textAlign:'center', color:'#a855f7', fontWeight:700 }} placeholder='3-1-1-0' />
                               </div>

                            ); })}
                          </div>
                        ) : e.workSets.map((ws, si) => (
                          <span key={si} style={{ marginRight:6 }}>{setStr(effSet(wk.week, di, ei, si, ws))}</span>
                        ))}
                      </div>
                    </div>
                  ))}
                  {(srcAdditions[dayKey(wk.week, di)] || []).map(a => (
                    <div key={a.uid} style={{ display:'grid', gridTemplateColumns:'1fr auto', gap:4, padding:'5px 0', borderBottom:'1px solid rgba(0,230,138,0.1)' }}>
                      <div style={{ fontSize:11, color:'#00e68a', fontWeight:600 }}>{a.name} <span style={{ fontSize:8, color:'rgba(255,255,255,0.4)' }}>＋ добавлено</span> <button onClick={() => setSrcAdditions(prev => { const k = dayKey(wk.week, di); return { ...prev, [k]: (prev[k]||[]).filter(x => x.uid !== a.uid) }; })} style={{ fontSize:9, color:'#ef4444', border:'none', background:'transparent', cursor:'pointer', marginLeft:4 }}>✕</button></div>
                      <div style={{ fontSize:10, color:'rgba(255,255,255,0.75)', textAlign:'right' }}>{editMode ? (
                        <div style={{ display:'flex', gap:3, alignItems:'center' }}>
                          <input type='number' value={a.sets} onChange={ev => setSrcAdditions(prev => { const k=dayKey(wk.week, di); return { ...prev, [k]: (prev[k]||[]).map(x => x.uid===a.uid ? { ...x, sets: +ev.target.value } : x) }; })} style={{ width:30, background:'#18181b', color:'#fff', border:'1px solid rgba(255,255,255,0.1)', borderRadius:5, padding:'3px', fontSize:10, textAlign:'center' }} aria-label='подходы'/>
                          <span style={{ fontSize:8 }}>×</span>
                          <input type='number' value={a.reps} onChange={ev => setSrcAdditions(prev => { const k=dayKey(wk.week, di); return { ...prev, [k]: (prev[k]||[]).map(x => x.uid===a.uid ? { ...x, reps: +ev.target.value } : x) }; })} style={{ width:36, background:'#18181b', color:'#fff', border:'1px solid rgba(255,255,255,0.1)', borderRadius:5, padding:'3px', fontSize:10, textAlign:'center' }} aria-label='повт'/>
                          <span style={{ fontSize:8 }}>×</span>
                          <input type='number' value={a.weight} onChange={ev => setSrcAdditions(prev => { const k=dayKey(wk.week, di); return { ...prev, [k]: (prev[k]||[]).map(x => x.uid===a.uid ? { ...x, weight: +ev.target.value } : x) }; })} style={{ width:50, background:'#18181b', color:'#fff', border:'1px solid rgba(255,255,255,0.1)', borderRadius:5, padding:'3px', fontSize:10, textAlign:'center' }} aria-label='вес'/>
                        </div>
                      ) : a.sets + 'x' + a.reps + 'x' + a.weight + 'кг'}</div>
                    </div>
                  ))}
                  {editMode && <button onClick={() => { setPickerDay(dayKey(wk.week, di)); setPickerExName(''); }} style={{ marginTop:6, padding:'5px 10px', borderRadius:6, fontSize:10, fontWeight:600, border:'1px dashed rgba(0,230,138,0.4)', background:'rgba(0,230,138,0.06)', color:'#00e68a', cursor:'pointer' }}>＋ Добавить упражнение из каталога</button>}
                </div>
              ))}
              <MetricCard title={'Итоги мезоцикла ('+totalW+' нед)'} icon="📊">
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
                  <div style={{ ...SMALL, background:'rgba(0,230,138,0.06)', padding:'6px 8px', borderRadius:8 }}>Тоннаж: <b style={{color:'#fff'}}>{builtSrc.cycleMetrics.tonnage.toFixed(0)}</b> кг·пов</div>
                  <div style={{ ...SMALL, background:'rgba(0,230,138,0.06)', padding:'6px 8px', borderRadius:8 }}>КПШ: <b style={{color:'#fff'}}>{builtSrc.cycleMetrics.kpsh}</b></div>
                  <div style={{ ...SMALL, background:'rgba(0,230,138,0.06)', padding:'6px 8px', borderRadius:8 }}>Инт. отн: <b style={{color:'#fff'}}>{builtSrc.cycleMetrics.relIntensity.toFixed(3)}</b></div>
                  <div style={{ ...SMALL, background:'rgba(0,230,138,0.06)', padding:'6px 8px', borderRadius:8 }}>УОИ: <b style={{color:'#fff'}}>{builtSrc.cycleMetrics.uoi.toFixed(3)}</b></div>
                </div>
              </MetricCard>
              {builtSrc && builtSrc.plVolumeLandmarks && builtSrc.plVolumeLandmarks.length > 0 && (
                <MetricCard title={'Объём vs MRV (volume-landmarks)'} icon="📊">
                  <div style={{ color:'rgba(255,255,255,0.55)', fontSize:11, marginBottom:8 }}>Пиковая неделя: {builtSrc.plVolumeLandmarks[0].peakWeek}</div>
                  {builtSrc.plVolumeLandmarks.map((lm) => {
                    const c = lm.status === 'over' ? '#ff5252' : lm.status === 'high' ? '#ffb74d' : lm.status === 'optimal' ? '#4caf50' : '#90caf9';
                    const lbl = lm.status === 'over' ? 'ПЕРЕБОР' : lm.status === 'high' ? 'высоко' : lm.status === 'optimal' ? 'оптимум' : 'низко';
                    return (
                      <div key={lm.group} style={{ marginBottom: 6 }}>
                        <div style={{ display:'flex', justifyContent:'space-between' }}>
                          <span style={{ color:'#fff', fontSize:12 }}>{lm.muscle}</span>
                          <span style={{ color: c, fontSize:12, fontWeight:700 }}>{lm.sets} / MRV {lm.mrv} · {lbl}</span>
                        </div>
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
              <MesocycleProgressionCard weeks={totalW} startVolumeSets={Math.round(W.reduce((s, w) => s + w.days.reduce((ss, d) => ss + d.exercises.reduce((sss, e) => sss + e.workSets.reduce((a, ws) => a + ws.sets, 0), 0), 0), 0) / totalW / (days || 3))} startIntensityPct={0.72} startRIR={3} goal="strength" title="Прогрессия мезоцикла (ПЛ)" />
              {/* ── ПРОФЕССИОНАЛЬНЫЕ ПЛ-РЕКОМЕНДАЦИИ для слабых групп ── */}
              {weakPoints.length > 0 && (() => {
                const GRP_RU: Record<string,string> = { chest:'Грудь', back:'Спина', legs:'Ноги', shoulders:'Плечи', arms:'Руки', core:'Кор' };
                const GROUP_TO_LIFT: Record<string,string> = { chest:'bench', legs:'squat', back:'deadlift', shoulders:'bench', arms:'bench', core:'deadlift' };
                // какой день недели соответствует какому движению:
                const FIND_DAY = (mainName: string): number => {
                  const kw: Record<string,string[]> = { bench:['жим'], squat:['присед'], deadlift:['становая','тяга'] };
                  for (const [lift,kws] of Object.entries(kw)) {
                    if (!kws.some(k => mainName.toLowerCase().includes(k))) continue;
                    for (let di=0;di<wk.days.length;di++) {
                      const first = wk.days[di].exercises[0]?.name.toLowerCase()||'';
                      if (kws.some(k => first.includes(k))) return di;
                    }
                  }
                  return 0;
                };
                const DAY_INDEX_FOR_LIFT: Record<string,number> = {};
                for (const [g,l] of Object.entries(GROUP_TO_LIFT)) {
                  if (DAY_INDEX_FOR_LIFT[l] === undefined) DAY_INDEX_FOR_LIFT[l] = FIND_DAY(l);
                }
                // схемы подходов по фазе цикла
                const PHASE_SCHEMES: Record<string,{reps:number;pct:number;label:string}> = {
                  base: { reps:10, pct:0.67, label:'гипертрофия (10П)' },
                  build: { reps:8, pct:0.73, label:'силовая выносливость (8П)' },
                  peak: { reps:5, pct:0.80, label:'специфическая сила (5П)' },
                  deload: { reps:12, pct:0.50, label:'восстановление (12П)' },
                };
                const scheme = PHASE_SCHEMES[phase] || PHASE_SCHEMES.base;
                // ПЛ-специфичные ассистентные упражнения (не изоляция — вариации соревновательных движений)
                const PL_EXERCISES: Record<string,{name:string;note:string}[]> = {
                  chest: [
                    { name:'Жим с паузой 2 секунды', note:'убивает инерцию, усиливает старт' },
                    { name:'Жим на наклонной скамье', note:'верх груди, помощь в средней фазе' },
                    { name:'Дожим с 5 см', note:'трицепс + локдаун' },
                    { name:'Французский жим', note:'изоляция длинной головки трицепса' },
                    { name:'Жим гантелей лёжа', note:'дефицит стабильности → грудные+стабилизаторы' },
                  ],
                  legs: [
                    { name:'Присед на груди', note:'квадрицепсы, выход из ямы' },
                    { name:'Присед в широкой постановке', note:'приводящие + ягодицы, дожим' },
                    { name:'Приседания со штангой', note:'общий объём квадрицепсов' },
                    { name:'Наклоны со штангой', note:'разгибатели спины, фиксация корпуса' },
                    { name:'Гакк-приседания', note:'латеральная головка квадрицепса' },
                  ],
                  back: [
                    { name:'Становая тяга с плинтов', note:'дожим, работа выше колен' },
                    { name:'Тяга на прямых ногах', note:'бицепс бедра + разгибатели, старт' },
                    { name:'Тяга штанги в наклоне', note:'центр спины, фиксация лопаток' },
                    { name:'Подтягивания (прямой хват)', note:'широчайшие, тянущая сила верха' },
                    { name:'Тяга из ямы', note:'дефицит старта, работа с пола ниже обычного' },
                  ],
                  shoulders: [
                    { name:'Жим стоя', note:'передняя+средняя дельта, жимовая стабильность' },
                    { name:'Тяга к лицу (face pull)', note:'здоровье плеч, задняя дельта, ротаторная манжета' },
                    { name:'Разводка гантелей в стороны', note:'средняя дельта — объём плечевого пояса' },
                  ],
                  arms: [
                    { name:'Французский жим', note:'длинная головка трицепса — жимовой дожим' },
                    { name:'Бицепс стоя', note:'сгибатели — стабильность в становой/подтягиваниях' },
                    { name:'Молотковые сгибания', note:'брахиалис, объём рук, предплечья' },
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
                  <div style={{ fontSize:9, color:'rgba(255,255,255,0.5)', marginBottom:6 }}>
                    Фаза: <b style={{color:'#ff9100'}}>{PH_RU[phase]}</b> · схема: <b style={{color:'#ff9100'}}>{scheme.label}</b> (вес ≈ {Math.round(scheme.pct*100)}% workMax)
                  </div>
                  {weakPoints.map(g => {
                    const lift = GROUP_TO_LIFT[g] || 'bench';
                    const di = DAY_INDEX_FOR_LIFT[lift] ?? 0;
                    const dk = dayKey(wk.week, di);
                    const pool = (PL_EXERCISES[g] || PL_EXERCISES.chest).filter(eqOk).slice(0, 3);
                    const dayLabel = `День ${di+1}`;
                    return <div key={g} style={{ marginBottom: 8, padding:8, borderRadius:8, background:'rgba(255,145,0,0.04)', border:'1px solid rgba(255,145,0,0.1)' }}>
                      <div style={{ fontSize:10, fontWeight:700, color:'#ff9100', marginBottom:3, display:'flex', justifyContent:'space-between' }}>
                        <span>{GRP_RU[g] || g}</span>
                        <span style={{ fontSize:8, fontWeight:400, color:'rgba(255,255,255,0.45)' }}>→ {dayLabel} ({lift === 'bench' ? 'жимовой' : lift === 'squat' ? 'приседательный' : 'тяговый'} день)</span>
                      </div>
                      {pool.map(ex => (
                        <button key={ex.name} onClick={() => addAccessory(dk, ex.name, g)}
                          style={{ display:'block', width:'100%', marginBottom:3, padding:'5px 8px', borderRadius:6, fontSize:9, cursor:'pointer', textAlign:'left',
                            border:'1px solid rgba(255,145,0,0.25)', background:'rgba(255,145,0,0.06)', color:'#ff9100', transition:'all 0.15s' }}>
                          <span style={{fontWeight:700}}>＋ {ex.name}</span>
                          <span style={{fontSize:8, color:'rgba(255,255,255,0.45)', marginLeft:6}}>— {ex.note}</span>
                        </button>
                      ))}
                    </div>;
                  })}
                  <div style={{ ...SMALL, color: 'rgba(255,255,255,0.5)' }}>
                    Добавляется в {phase === 'base' ? 'базовый' : phase === 'build' ? 'накопительный' : phase === 'peak' ? 'пиковый' : 'восстановительный'} день цикла: {scheme.reps}П × 3 подхода, вес {Math.round(scheme.pct*100)}% workMax (фазовая схема). Можно отредактировать в режиме правки.
                  </div>
                  <div style={{ fontSize:8, color:'rgba(255,145,0,0.5)', marginTop:4 }}>
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
           </div>

          {bbBest && <ExpandableCard title={'🏆 Рекомендован: ' + bbBest.pattern.name} icon='🏆' short={bbBest.pattern.description} full={<><div style={{ marginBottom: 8 }}><b>Почему этот сплит:</b> {explainBBSelection(bbBest)}</div><button onClick={buildBb} style={{ width: '100%', padding: 10, borderRadius: 8, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#00e68a,#00c853)', color: '#000', fontWeight: 700, fontSize: 12 }}>✅ Применить сплит и собрать план</button></>} />}
          <div style={H}>💉 Фармакология (PED-адаптация объёмов)</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {(['AAS','insulin','MGF','IGF1','GH'] as PED[]).map(p => <button key={p} style={peds.includes(p) ? BTN : BTN_GHOST} onClick={() => togglePed(p)}>{p}{peds.includes(p) ? ' ✓' : ''}</button>)}
          </div>
          {peds.length > 0 && <ExpandableCard title="Адаптация объёмов под PED" icon="💉" short={explainPEDAdaptation(pedAdapt)} full={null} />}
          <div style={{ ...H, marginTop: 10 }}>💪 Рабочие максимумы (кг) — для расчёта весов</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
            {BB_WM_KEYS.map(k => <PopupNumber key={k} label={BB_WM_RU[k]} value={bbWorkMax[k] || 80} min={10} max={400} suffix=' кг' onChange={v => setBbWm(k, v)} />)}
          </div>
          <div style={{ marginTop: 8, fontSize: 11, fontWeight: 700, color: ACCENT }}>🎯 Слабые группы (акцент, сохраняются в профиль)</div>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 4, marginBottom: 6 }}>{WEAK_GROUPS.map(([id, l]) => { const on = weakPoints.includes(id); return <button key={id} onClick={() => toggleWeak(id)} style={{ padding: "5px 10px", borderRadius: 14, fontSize: 10, fontWeight: 700, cursor: "pointer", border: on ? "1px solid #00e68a" : "1px solid rgba(255,255,255,0.08)", background: on ? "rgba(0,230,138,0.15)" : "rgba(255,255,255,0.02)", color: on ? "#00e68a" : "rgba(255,255,255,0.6)" }}>{l}{on ? " ✓" : ""}</button>; })}</div>
          <button style={{ ...BTN, width: '100%', marginTop: 10 }} onClick={buildBb}>Сгенерировать BB-план ({bbWeeks} нед)</button>
          {builtBb && (() => {
            const W = builtBb.weeks;
            const wk = W[Math.min(bbWeekSel, W.length) - 1] || W[0];
            const m = calcBBPlanMetrics(builtBb, pedAdapt.combinedMrvMultiplier);
            return <div style={{ ...CARD, borderLeft: `3px solid ${ACCENT}`, boxShadow: '0 0 0 1px rgba(0,230,138,0.08)' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', gap:8 }}>
                <div style={{ ...H, margin:0 }}>📋 План: {builtBb.pattern.name}</div>
                <span style={{ fontSize:10, fontWeight:700, color: ACCENT, background:'rgba(0,230,138,0.12)', padding:'3px 8px', borderRadius:8 }}>{W.length} нед</span>
              </div>
              {/* P12 auto-reg toggle + shouldTrainToday для BB */}
              {(() => {
                const stt = shouldTrainToday({ readiness: linked.readiness?.recovery ?? 80, acwr: autoRegResult.deload ? { ratio: 1.8, zone: 'dangerous' } : { ratio: 1.0, zone: 'optimal' }, fatigue: linked.readiness?.fatigue ?? 30, hrvRatio: linked.profile?.settings?.baselineHrvRatio ?? 1.0 });
                return (
                  <div style={{ marginTop: 6, padding: '8px 10px', borderRadius: 10, background: autoRegResult.deload ? 'rgba(239,68,68,0.08)' : 'rgba(96,165,250,0.06)', border: '1px solid ' + (autoRegResult.deload ? 'rgba(239,68,68,0.25)' : 'rgba(96,165,250,0.2)') }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <span style={{ fontSize: 11, fontWeight: 700, color: stt.train ? (autoRegResult.deload ? '#ef4444' : '#60a5fa') : '#ef4444' }}>
                          {stt.train ? '✅' : '⚠️'} {stt.reason}
                        </span>
                      </div>
                      <button onClick={() => setAutoRegOn(a => !a)} style={{ padding: '5px 10px', borderRadius: 6, fontSize: 10, fontWeight: 700, cursor: 'pointer', border: 'none', background: autoRegOn ? '#60a5fa' : 'rgba(255,255,255,0.1)', color: autoRegOn ? '#000' : 'var(--text-dim)' }}>
                        {autoRegOn ? 'Авторег ON' : 'Включить авторег'}
                      </button>
                    </div>
                    {autoRegOn && (
                      <div style={{ marginTop: 6, fontSize: 10, color: 'rgba(255,255,255,0.7)' }}>
                        <div>Топ-сет ×{autoRegResult.topSetPctMultiplier} · объём ×{autoRegResult.volumeMultiplier} · RIR +{autoRegResult.rirShift}{autoRegResult.deload ? ' · 🔴 DELOAD' : ''}</div>
                        {autoRegResult.decisions.slice(0, 3).map((d, i) => <div key={i} style={{ marginTop: 2, color: 'rgba(255,255,255,0.55)' }}>• {d}</div>)}
                      </div>
                    )}
                  </div>
                );
              })()}
              {(() => { const srpe = loadSRPESessions(); if (srpe.length < 2) return null; const acwr = acuteChronicRatio(toDailyLoads(srpe)); if (acwr.ratio <= 1.5) return null; const srpeList = loadSRPESessions(); const loads = toDailyLoads(srpeList); const ratio = acuteChronicRatio(loads); return <div style={{ marginTop: 6, padding: 8, borderRadius: 8, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}><div style={{ color: '#ef4444', fontSize: 10, fontWeight: 600, marginBottom: 6 }}>🚨 ACWR {ratio.ratio.toFixed(2)} — опасная зона. Рекомендуется разгрузка.</div><DeloadProtocolCard ctx={{ acwr: ratio.ratio, weeksSinceDeload: 0, fatigue: 6, recovery: 50, hasCompetitionSoon: false, jointPain: false, cnsFatigue: false, goal: 'hypertrophy' }} /></div>; })()}
              {builtBb.rationale.map((r, i) => <div key={i} style={{ ...SMALL, marginTop: 4 }}>{r}</div>)}
              {/* Выбор недели */}
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize:11, color:'rgba(255,255,255,0.65)', marginBottom:6, fontWeight:700 }}>Неделя {wk.week} из {W.length}</div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(36px, 1fr))', gap:4 }}>
                  {W.map(w => { const active = w.week === wk.week; return <button key={w.week} onClick={() => setBbWeekSel(w.week)} style={{ padding:'7px 0', borderRadius:7, border: active ? '1px solid #00e68a' : '1px solid rgba(255,255,255,0.08)', background: active ? 'linear-gradient(135deg,#00e68a,#00c853)' : 'rgba(255,255,255,0.02)', color: active ? '#000' : '#fff', fontSize:10, fontWeight:700, cursor:'pointer' }}>{w.week}</button>; })}
                </div>
              </div>
              {/* Визуальный календарь ББ: недели × дни (объём по сетам) */}
              <div style={{ marginTop: 8, padding: 8, borderRadius: 10, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.6)', marginBottom: 6 }}>📅 Календарь мезоцикла (нед × дни, объём сетов)</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {W.map(w => { const active = w.week === wk.week; const daySets = w.sessions.map(s => s.exercises.reduce((ss, e) => ss + e.sets, 0)); const maxD = Math.max(1, ...W.flatMap(ww => ww.sessions.map(s => s.exercises.reduce((ss, e) => ss + e.sets, 0)))); return (
                    <div key={w.week} onClick={() => setBbWeekSel(w.week)} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 6px', borderRadius: 6, cursor: 'pointer', background: active ? 'rgba(0,230,138,0.08)' : 'transparent', border: active ? '1px solid rgba(0,230,138,0.3)' : '1px solid transparent' }}>
                      <span style={{ fontSize: 9, fontWeight: 700, color: active ? '#00e68a' : 'rgba(255,255,255,0.7)', minWidth: 26 }}>Н{w.week}</span>
                      <div style={{ flex: 1, display: 'flex', gap: 2 }}>
                        {daySets.map((ds, di) => <div key={di} title={'Д' + (di+1) + ': ' + ds + ' сетов'} style={{ flex: 1, height: 14, borderRadius: 3, background: ds > 0 ? 'linear-gradient(180deg,#00e68a,#00c853)' : 'rgba(255,255,255,0.04)', opacity: 0.35 + 0.65 * (ds / maxD) }} />)}
                      </div>
                      <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.5)', minWidth: 30, textAlign: 'right' }}>{daySets.reduce((a, b) => a + b, 0)}</span>
                    </div>
                  ); })}
                </div>
              </div>
              {/* Дни выбранной недели — таблицы-карточки */}
              <div style={{ marginTop: 10, display:'flex', flexDirection:'column', gap: 8 }}>
                {wk.sessions.map((s, si) => (
                  <div key={si} style={{ background:'rgba(255,255,255,0.02)', borderRadius:10, border:'1px solid rgba(255,255,255,0.06)', overflow:'hidden' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 10px', background:'rgba(0,230,138,0.06)', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
                      <span style={{ fontSize:12, fontWeight:700, color:'#fff' }}>🏋️ День {si + 1} · {s.character}</span>
                      <span style={{ fontSize:9, color:ACCENT, fontWeight:700 }}>{s.sessionTag}</span>
                    </div>
                    <div style={{ padding: '4px 0', overflowX:'auto', WebkitOverflowScrolling:'touch', scrollbarWidth:'none' }}>
                      <div style={{ display:'grid', gridTemplateColumns:'1.4fr 0.7fr 0.6fr 0.6fr 0.6fr 0.6fr', gap:2, padding:'4px 10px', fontSize:9, fontWeight:700, color:'rgba(255,255,255,0.4)', textTransform:'uppercase', minWidth:340 }}>
                        <span>Мышца</span><span>Характер</span><span>Сеты×повт</span><span>RIR</span><span>Вес</span><span>Темп</span>
                      </div>
                      {s.exercises.map((e, ei) => {
                        const rawW = e.workSets[0].weight;
                        const adjW = autoRegOn && autoRegResult ? Math.round(rawW * autoRegResult.topSetPctMultiplier * 10) / 10 : rawW;
                        const adjSets0 = autoRegOn && autoRegResult ? Math.max(1, Math.round(e.sets * autoRegResult.volumeMultiplier)) : e.sets;
                        const adjSets = Math.max(1, Math.round(adjSets0 * bridgeMult));
                        const tmpo = getTempo(e.muscle, bbGoal, e.character === 'тяж');
                        return (
                        <div key={ei} style={{ display:'grid', gridTemplateColumns:'1.4fr 0.7fr 0.6fr 0.6fr 0.6fr 0.6fr', gap:2, padding:'5px 10px', fontSize:10, color:'rgba(255,255,255,0.85)', borderTop:'1px solid rgba(255,255,255,0.04)', minWidth:340 }}>
                          <span style={{ fontWeight:600, whiteSpace:'normal', overflowWrap:'anywhere' }}>{e.muscle}</span>
                          <span style={{ color:'rgba(255,255,255,0.6)' }}>{e.character}</span>
                          <span>{adjSets}×{e.workSets[0].reps}</span>
                          <span style={{ color:'#f59e0b' }}>{peakRirTarget != null ? peakRirTarget : Math.max(0, e.rir + bridgeRir)}{autoRegOn && autoRegResult?.rirShift ? `+${autoRegResult.rirShift}` : ''}</span>
                          <span style={{ color: adjW !== rawW ? '#f59e0b' : ACCENT, fontWeight:700 }}>{adjW} кг{adjW !== rawW ? ' ⚡' : ''}</span>
                          <span style={{ fontSize:9, color:'#a855f7', fontWeight:700, background:'rgba(168,85,247,0.1)', padding:'2px 6px', borderRadius:4, textAlign:'center' }}>{tempoStr || tmpo.tempo.toString}</span>
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
                  <div style={{ ...SMALL, background:'rgba(0,230,138,0.06)', padding:'6px 8px', borderRadius:8 }}>Всего сетов/ротация: <b style={{ color:'#fff' }}>{m.totalSets}</b></div>
                  <div style={{ ...SMALL, background:'rgba(0,230,138,0.06)', padding:'6px 8px', borderRadius:8 }}>Тяжёлых: <b style={{ color:'#fff' }}>{(m.тяжPct * 100).toFixed(0)}%</b></div>
                  <div style={{ ...SMALL, background:'rgba(0,230,138,0.06)', padding:'6px 8px', borderRadius:8 }}>Памп: <b style={{ color:'#fff' }}>{(m.пампPct * 100).toFixed(0)}%</b></div>
                  <div style={{ ...SMALL, background:'rgba(0,230,138,0.06)', padding:'6px 8px', borderRadius:8 }}>Средний RIR: <b style={{ color:'#fff' }}>{m.avgRir.toFixed(1)}</b></div>
                </div>
              </MetricCard>
              {/* Объём по мышцам */}
              <MetricCard title="Объём по мышцам (сетов/нед)" icon="🏋️" accent="#a855f7">
              <div style={{ overflowX:'auto', WebkitOverflowScrolling:'touch', scrollbarWidth:'none' }}>
                <div style={{ display:'grid', gridTemplateColumns:'1.4fr 0.5fr 0.5fr 0.5fr 0.5fr', gap:2, fontSize:9, fontWeight:700, color:'rgba(255,255,255,0.4)', textTransform:'uppercase', padding:'2px 0', minWidth:340 }}>
                  <span>Мышца</span><span>Сетов</span><span>Тяж</span><span>Памп</span><span>MRV</span>
                </div>
                {m.perMuscle.map(mm => { const over = mm.totalSets > (mm.mrv || 999); return (
                  <div key={mm.muscle} style={{ display:'grid', gridTemplateColumns:'1.4fr 0.5fr 0.5fr 0.5fr 0.5fr', gap:2, fontSize:10, color:'rgba(255,255,255,0.85)', padding:'3px 0', borderTop:'1px solid rgba(255,255,255,0.04)', minWidth:340 }}>
                    <span style={{ fontWeight:600 }}>{mm.muscle}{over ? ' ⚠' : ''}</span>
                    <span style={{ color: over ? '#ef4444' : ACCENT, fontWeight:700 }}>{mm.totalSets}</span>
                    <span style={{ color:'#ef4444' }}>{mm.тяжSets}</span>
                    <span style={{ color:'#60a5fa' }}>{mm.пампSets}</span>
                    <span style={{ color:'rgba(255,255,255,0.5)' }}>{mm.mrv}</span>
                  </div>
                ); })}
              </div>
              </MetricCard>
              {(() => { const wkStats = W.map(w => { const exs = w.sessions.flatMap(s => s.exercises); const sets = exs.reduce((s, e) => s + e.sets, 0); const rir = sets > 0 ? exs.reduce((s, e) => s + e.rir * e.sets, 0) / sets : 0; return { week: w.week, sets, rir }; }); const maxS = Math.max(1, ...wkStats.map(x => x.sets)); const px = (i: number) => 24 + (i / Math.max(1, W.length - 1)) * 280; const py = (v: number) => 60 - (v / 5) * 44; return <div style={{ marginTop: 8, padding: 10, borderRadius: 10, background: 'rgba(168,85,247,0.05)', border: '1px solid rgba(168,85,247,0.15)' }}><div style={{ fontSize: 10, fontWeight: 700, color: '#a855f7', marginBottom: 6 }}>📈 Прогрессия объёма и RIR по неделям</div><svg width='100%' viewBox='0 0 320 70' style={{ maxWidth: 360, margin: '0 auto', display: 'block' }}>{wkStats.map(x => <rect key={'b'+x.week} x={px(x.week-1)-8} y={60 - (x.sets / maxS) * 44} width={16} height={(x.sets / maxS) * 44} rx={3} fill='rgba(0,230,138,0.4)' />)}<polyline points={wkStats.map(x => px(x.week-1) + ',' + py(x.rir)).join(' ')} fill='none' stroke='#a855f7' strokeWidth={1.6} />{wkStats.map(x => <circle key={'r'+x.week} cx={px(x.week-1)} cy={py(x.rir)} r={2} fill='#a855f7' />)}</svg><div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 4 }}><span style={{ fontSize: 9, color: 'rgba(0,230,138,0.8)' }}>▮ Сеты/нед</span><span style={{ fontSize: 9, color: '#a855f7' }}>● RIR</span></div></div>; })()}
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
          <div style={{ fontSize: 16, fontWeight: 800, color: '#00e68a', marginBottom: 8 }}>Ручной конструктор переехал</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginBottom: 16, lineHeight: 1.6 }}>
            Полный ручной конструктор теперь доступен в разделе <b style={{ color: '#00e68a' }}>📐 Планирование → 🛠️ Ручной конструктор</b>.<br />
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
            background: 'linear-gradient(135deg,#00e68a,#00c853)', color: '#000',
            fontWeight: 800, fontSize: 13,
          }}>
            🚀 Открыть полный конструктор
          </button>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', marginTop: 12 }}>
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
                      const PH_COLOR_B: Record<string,string> = { base: '#22c55e', build: '#eab308', peak: '#ef4444', deload: '#60a5fa' };
                      const PH_RU_B: Record<string,string> = { base: 'База', build: 'Накопление', peak: 'Пик', deload: 'Разгрузка' };
                      return (
                        <button key={w} onClick={() => setBridgeWeek(w)}
                          title={`Неделя ${w}: ${PH_RU_B[ph] || ''}`}
                          style={{
                            padding: '7px 0', borderRadius: 7,
                            border: active ? '1px solid #00e68a' : '1px solid rgba(255,255,255,0.08)',
                            background: active ? PH_COLOR_B[ph] : (PH_COLOR_B[ph] || '#22c55e') + '1a',
                            color: active ? '#000' : '#fff',
                            fontSize: 10, fontWeight: 700, cursor: 'pointer'
                          }}
                        >{w}</button>
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
                  title={`${s.focus} · ${s.exercises.length} упр.`}
                  icon={s.source === 'SRC' ? '🏋️' : '💪'}
                  short={`${s.totalSets} сетов · ${Math.round(s.totalVolume)} кг·пов${s.planned ? ' · запланировано' : ''}`}
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
                                display: 'inline-block', padding: '2px 6px', borderRadius: 4, fontSize: 9,
                                background: 'rgba(0,230,138,0.08)', border: '1px solid rgba(0,230,138,0.12)',
                                color: 'rgba(255,255,255,0.8)'
                              }}>
                                {set.reps}×{set.weightKg}кг
                                {set.rir > 0 ? ` · RIR ${set.rir}` : ''}
                              </span>
                            ))}
                          </div>
                          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>
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

      {subView === 'plates' && <PlateCalcTab initialWeight={workingWeight} onApply={() => {}} />}
      {subView === 'autoreg' && <AutoregPanel />}
      {subView === 'peak' && <PeakingPanel />}
      {subView === 'peak_bb' && <PeakingPanel defaultKind="bb" />}
      {subView === 'recovery' && (<><RecoveryPanel /><div style={{ marginTop: 10 }}><div style={{ fontSize: 14, fontWeight: 700, color: '#00e68a', margin: '10px 0 6px' }}>🧮 Training Score Engine</div><TrainingScoreCard workoutsPerWeek={mainTab === 'pl' ? days : bbDays} avgMinutes={75} intensity={autoRegResult.deload ? 'low' : 'moderate'} goal={mainTab === 'pl' ? 'strength' : 'hypertrophy'} experience={(mainTab === 'pl' ? (level === 'novice' ? 'beginner' : level === 'intermediate' ? 'intermediate' : 'advanced') : (bbLevel === 'beginner' ? 'beginner' : bbLevel === 'intermediate' ? 'intermediate' : 'advanced')) as 'beginner' | 'intermediate' | 'advanced'} sleepHours={(linked.readiness?.sleep ?? 7) as number} stressLevel={Math.round((linked.readiness?.stress ?? 3) as number)} jointPain={[]} deloadWeeksAgo={autoRegResult.deload ? 0 : 99} weight={mainTab === 'pl' ? bw : 80} age={30} sex={'male'} /></div><ReadinessForecastCard /></>)}
      {subView === 'safety' && <ExerciseSafetyPanel />}
      {subView === 'demo' && <ExerciseDemoPanel />}
      {subView === 'programs' && <ProgramsTab selectedProgram={selectedProgram} setSelectedProgram={setSelectedProgram} onAddToMyTraining={() => {}} />}
      {subView === 'methods' && (<>
        {methodNote && <div style={{ ...CARD, borderColor:'rgba(0,230,138,0.3)', background:'rgba(0,230,138,0.08)', color:'#00e68a', fontSize:11 }}>{methodNote}</div>}
        <MethodsTab linked={linked} trainingOutput={null} diaryStats={[] as any} historyWorkouts={[] as any} goal={mainTab === 'pl' ? goal : bbGoal} level={mainTab === 'pl' ? level : bbLevel} daysPerWeek={mainTab === 'pl' ? days : bbDays} recovery={linked.readiness?.recovery ?? 80} fatigue={linked.readiness?.fatigue ?? 30} appliedMethods={appliedMethods} onToggleMethod={(name, cat) => setAppliedMethods(prev => { const n = { ...prev }; if (n[cat] === name) delete n[cat]; else n[cat] = name; return n; })} onApplyComposition={() => { const keys = Object.keys(appliedMethods); if (keys.length > 0) { const h = deriveHints(appliedMethods); setMethodHints(h); setMethodNote(`✓ Применена методология: ${h.label}${h.volumeMult !== 1 ? ' · объём×' + h.volumeMult : ''}${h.technique ? ' · техн: ' + h.technique : ''}`); } else { setMethodHints({ volumeMult: 1, technique: null, label: '' }); setMethodNote('Выберите методики (по одной из категории)'); } }} />
      </>)}
      {subView === 'analytics' && (<><AnalyticsTab sessions={historyWorkouts} /><VisualTab sessions={historyWorkouts} /></>)}
      {subView === 'prometrics' && <ProMetricsPanel />}
      {subView === 'charts' && <TrainingMetricsChart lms={lmsChart} bb={bbChart} />}
    </div>
  );
};

export default SRCBBScreen;
