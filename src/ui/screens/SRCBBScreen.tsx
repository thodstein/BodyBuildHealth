import React, { useEffect, useMemo, useState } from 'react';
import { LMS_CYCLES, getCycleById } from '../../data/lms-cycles/lms-cycle-index';
import { rankCycles, selectBestCycle, explainSelection, type LMSSelectorInput } from '../../engines/lms/lms-selector.engine';
import { buildLMSPlan, type LMSBuildOutput } from '../../engines/lms/lms-builder.engine';
import { mesocyclePhaseForWeek } from '../../engines/rir-matrix.engine';
import { autoRegulate, type AutoRegOutput } from '../../engines/pro/autoregulation-pro.engine';
import { acuteChronicRatio, toDailyLoads } from '../../engines/pro/training-load.engine';
import { loadSRPESessions } from '../../engines/pro/srpe-store';
import { SPLIT_PATTERNS } from '../../engines/bb/bb-split-patterns';
import { rankBBSplits, selectBestBBSplit, explainBBSelection, type BBSelectorInput } from '../../engines/bb/bb-selector.engine';
import { buildBBPlan, type BBPlan } from '../../engines/bb/bb-builder.engine';
import { calcBBPlanMetrics, explainBBMetrics } from '../../engines/bb/bb-metrics.engine';
import { adaptForPEDs, explainPEDAdaptation, type PED } from '../../engines/bb/bb-ped-adaptation.engine';
import { getAllVolumeLandmarks } from '../../engines/volume-landmarks.engine';
import { PlateCalculator } from './SRCBBScreen_parts/PlateCalculator';
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
import { getMethodsByCategory } from '../../engines/training-methodology.engine';
import { FULL_PROGRAM_LIBRARY } from '../../engines/complete-program-library.engine';
import { WOMENS_PROGRAMS, CUSTOM_PROGRAMS } from './TrainingScreen_parts/programs-data';
import { loadTrainingProfile, saveTrainingProfile } from './TrainingScreen_parts/training-profile';
import { StrengthDiary } from '../../engines/strength-diary.engine';
import type { WorkoutLog } from '../../core/types';
import { AnalyticsTab } from './TrainingScreen_parts/AnalyticsTab';
import { VisualTab } from './TrainingScreen_parts/VisualTab';
import { ProMetricsPanel } from './SRCBBScreen_parts/ProMetricsPanel';
import { PopupNumber, PopupSelect, ExpandableCard, MetricCard, SaveButton } from './SRCBBScreen_parts/TrainingPopups';
import { TrainingScoreCard } from '../components/TrainingScoreCard';
import { ReadinessForecastCard } from './TrainingScreen_parts/ReadinessForecastCard';
type Mode = 'pl' | 'bb' | 'manual';

const CARD: React.CSSProperties = { background: 'rgba(24,24,27,0.6)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.04)', padding: '12px', margin: '6px 0' };
const SMALL: React.CSSProperties = { color: 'rgba(255,255,255,0.55)', fontSize: 10, lineHeight: 1.4 };
const cardBg = CARD;
const ACCENT = '#00e68a';
const BTN: React.CSSProperties = { background: ACCENT, color: '#0a0a0a', border: 'none', borderRadius: 8, padding: '10px 14px', fontWeight: 600, fontSize: 12, minHeight: 40, cursor: 'pointer' };
const BTN_GHOST: React.CSSProperties = { ...BTN, background: 'transparent', color: ACCENT, border: `1px solid ${ACCENT}20` };
const PILL = (active: boolean) => ({ padding:'6px 14px', borderRadius:20, fontSize:10, fontWeight: active ? 700 : 500, cursor:'pointer', border: active ? '1px solid #00e68a' : '1px solid rgba(255,255,255,0.06)', background: active ? 'linear-gradient(135deg,#00e68a,#00c8a0)' : '#18181b', color: active ? '#000' : '#fff', whiteSpace:'nowrap' as const, flexShrink:0 } as React.CSSProperties);
const SEL: React.CSSProperties = { background: '#18181b', color: '#fff', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '8px', minHeight: 40, width: '100%', outline: 'none', boxSizing: 'border-box' };
const IN: React.CSSProperties = { ...SEL, padding: '10px' };
const LABEL: React.CSSProperties = { color: 'rgba(255,255,255,0.6)', fontSize: 10, margin: '6px 0 3px' };
const H: React.CSSProperties = { fontSize: 14, fontWeight: 700, color: '#00e68a', marginBottom: 8 };

export const SRCBBScreen: React.FC<{ track?: 'pl' | 'bb' | 'auto' }> = ({ track = 'auto' }) => {
  const [mainTab, setMainTab] = useState<Mode>(track === 'bb' ? 'bb' : track === 'pl' ? 'pl' : 'manual');
  const subViewList: Record<Mode, { key: string; label: string }[]> = {
    pl: [['plan', '📋 План цикла'], ['plates', '🧮 Калькулятор блинов'], ['autoreg', '🧠 Авторегуляция'], ['peak', '🏁 Пиковая фаза'], ['recovery', '🔋 Восстановление'], ['safety', '🛡 Безопасность'], ['demo', '🎬 Демонстрация']].map(([k, l]) => ({ key: k, label: l })),
    bb: [['plan', '📋 План сплита'], ['methods', '🧠 Методики'], ['analytics', '📈 Аналитика'], ['prometrics', '🧮 PRO-метрики'], ['charts', '📊 Графики']].map(([k, l]) => ({ key: k, label: l })),
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
  const [selectedCycleId, setSelectedCycleId] = useState<string>(_plSaved?.selectedCycleId || 'cycle-01');
  const [cycleWeeks, setCycleWeeks] = useState<number>(_plSaved?.cycleWeeks ?? 12);
  const [builtSrc, setBuiltSrc] = useState<LMSBuildOutput | null>(_plSaved?.builtSrc ?? null);
  const [srcWeek, setSrcWeek] = useState<number>(_plSaved?.srcWeek ?? 1);
  useEffect(() => { try { localStorage.setItem('he_pl_session', JSON.stringify({ selectedCycleId, cycleWeeks, srcWeek, builtSrc, plLevel: level, plGoal: goal, plDir: dir, plBw: bw, plDays: days, pmSquat, pmBench, pmDead })); } catch { /* ignore */ } }, [selectedCycleId, cycleWeeks, srcWeek, builtSrc, level, goal, dir, bw, days, pmSquat, pmBench, pmDead]);
  useEffect(() => { try { saveTrainingProfile({ ...loadTrainingProfile(), pmSquat, pmBench, pmDead, bodyWeight: bw }); } catch { /* ignore */ } }, [pmSquat, pmBench, pmDead, bw]);
  // U4: ручная правка поверх сгенерированного плана (оверлей правок по позиции сета)
  const [editMode, setEditMode] = useState<boolean>(false);
  const [srcEdits, setSrcEdits] = useState<Record<string, { weight?: number; reps?: number; sets?: number }>>({});
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
  const addAccessory = (dk: string, name: string, group: string) => setSrcAdditions(prev => ({ ...prev, [dk]: [...(prev[dk]||[]), { uid: 'acc_'+Date.now()+'_'+Math.random().toString(36).slice(2,6), name, group, sets: 3, reps: 10, weight: Math.round((loadTrainingProfile().workMax[group] || 80) * 0.7) }] }));

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

  const ranked = useMemo(() => rankCycles({ goal: goal as any, level: level as any, bodyWeight: bw, daysPerWeek: days, direction: dir as any, mode: 'natural' }), [goal, level, bw, days, dir]);
  const best = ranked[0];

  const buildSrc = () => {
    const tpl = getCycleById(selectedCycleId);
    if (!tpl) return;
    const plan = buildLMSPlan({ template: tpl, pmMap: { 'Присед': pmSquat, 'Жим лежа': pmBench, 'Становая тяга': pmDead }, fallbackPm: 80, mode: 'natural', weeksOverride: cycleWeeks });
    setBuiltSrc(plan); setSrcWeek(1); setSrcEdits({}); setEditMode(false); setSrcAdditions({}); setPickerDay(null);
  };

  // ── BB ──
  const _bbSaved: any = (() => { try { return JSON.parse(localStorage.getItem('he_bb_session') || 'null'); } catch { return null; } })();
  const [bbLevel, setBbLevel] = useState<string>(_bbSaved?.bbLevel || 'intermediate');
  const [bbGoal, setBbGoal] = useState<string>(_bbSaved?.bbGoal || 'mass');
  const [bbDays, setBbDays] = useState<number>(_bbSaved?.bbDays ?? 4);
  const [bbWeeks, setBbWeeks] = useState<number>(_bbSaved?.bbWeeks ?? 4);
  const [peds, setPeds] = useState<PED[]>(_bbSaved?.peds ?? (_profPL.onCourse ? (['AAS'] as PED[]) : []));
  const [builtBb, setBuiltBb] = useState<BBPlan | null>(_bbSaved?.builtBb ?? null);
  const [bbWeekSel, setBbWeekSel] = useState<number>(_bbSaved?.bbWeekSel ?? 1);
  const WEAK_GROUPS = [['chest','Грудь'],['back','Спина'],['legs','Ноги'],['shoulders','Плечи'],['arms','Руки'],['core','Кор']] as const;
  const [weakPoints, setWeakPoints] = useState<string[]>(_profPL.weakPoints || []);
  const toggleWeak = (g: string) => setWeakPoints(p => p.includes(g) ? p.filter(x => x !== g) : [...p, g]);
  useEffect(() => { try { saveTrainingProfile({ ...loadTrainingProfile(), weakPoints }); } catch {} }, [weakPoints]);
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
  // P12-wire #2: проф-авторегуляция плана (readiness + ACWR из sRPE-дневника)
  const [autoRegOn, setAutoRegOn] = useState<boolean>(false);
  const autoRegResult: AutoRegOutput = useMemo(() => {
    const rec = linked.readiness?.recovery ?? 80;
    const fat = linked.readiness?.fatigue ?? 30;
    const srpe = loadSRPESessions();
    const acwr = srpe.length >= 2 ? acuteChronicRatio(toDailyLoads(srpe)) : { ratio: 1.0, zone: 'optimal' as const };
    return autoRegulate({ readiness: rec, acwr: { ratio: acwr.ratio, zone: acwr.zone }, fatigue: fat, lastSessionRPE: 8, lastVelocityLossPct: 15, plannedTopSetPct: 0.85, plannedRIR: 2 });
  }, [linked.readiness]);
  const diary = useMemo(() => new StrengthDiary(), []);
  const [historyWorkouts, setHistoryWorkouts] = useState<WorkoutLog[]>([]);
  useEffect(() => { (async () => { try { const w = await diary.getWorkoutLogs(); setHistoryWorkouts(w.reverse()); } catch { /* ignore */ } })(); }, [diary]);

  const bbRanked = useMemo(() => rankBBSplits({ level: bbLevel, goal: bbGoal as any, daysPerWeek: bbDays }), [bbLevel, bbGoal, bbDays]);
  const bbBest = bbRanked[0];

  const buildBb = () => {
    if (!bbBest) return;
    const plan = buildBBPlan({ patternId: bbBest.pattern.id, level: bbLevel, goal: bbGoal as any, weeks: bbWeeks, workMax: bbWorkMax, weakPoints });
    setBuiltBb(plan); setBbWeekSel(1);
  };
  const baseMrv = useMemo(() => Object.fromEntries(Object.entries(getAllVolumeLandmarks(bbLevel)).map(([k, v]) => [k, v.mrv])), [bbLevel]);
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
          targetSets: e.workSets.flatMap((ws, si) => { let es = effSet(w0, i, ei, si, ws); if (autoRegOn && autoRegResult) { es = { ...es, sets: Math.round(es.sets * autoRegResult.volumeMultiplier), weight: Math.round(es.weight * autoRegResult.topSetPctMultiplier * 10) / 10 }; } return Array.from({ length: es.sets }, () => ({ weight: es.weight, reps: es.reps, rir: 0 })); }),
          pm: e.pm, coef: e.coef, mnosz: e.mnosz, group: e.group,
        })),
        ...(srcAdditions[dayKey(w0, i)] || []).map(a => ({
          name: a.name, muscleGroup: a.group,
          targetSets: Array.from({ length: a.sets }, () => ({ weight: a.weight, reps: a.reps, rir: 0 })),
          pm: Math.max(a.weight * 1.4, 1), coef: 1, mnosz: 1, group: a.group,
        })),
      ],
    }));
  }, [builtSrc, srcEdits, srcAdditions, autoRegOn, autoRegResult]);

  const bbDaysArr: PlayerDay[] = useMemo(() => {
    if (!builtBb) return [];
    const wk = builtBb.weeks[0];
    return wk.sessions.map((sess, i) => ({
      label: `Д${i + 1} ${sess.character}`,
      exercises: sess.exercises.map(e => ({
        name: e.muscle, muscleGroup: e.muscle,
        targetSets: e.workSets.map(ws => ({ weight: ws.weight, reps: ws.reps, rir: ws.rir })),
      })),
    }));
  }, [builtBb]);

  const playerDays: PlayerDay[] = mainTab === 'pl' ? srcDays : bbDaysArr;
  const workingWeight = useMemo(() => {
    if (mainTab === 'pl' && builtSrc) return builtSrc.weeks[0]?.days[0]?.exercises[0]?.workSets[0]?.weight || 100;
    if (mainTab === 'bb' && builtBb) return builtBb.weeks[0]?.sessions[0]?.exercises[0]?.workSets[0]?.weight || 100;
    return 100;
  }, [mainTab, builtSrc, builtBb]);
  const runFocus = mainTab === 'pl' ? (getCycleById(selectedCycleId)?.meta.title || 'СРЦ') : 'BB';
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
    return calcBBPlanMetrics(builtBb).perMuscle.map(p => ({ muscle: p.muscle, sets: Math.round(p.totalSets * mult), тяж: Math.round(p.тяжSets * mult), памп: Math.round(p.пампSets * mult), mrv: p.mrv }));
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
            <PopupSelect label="Направление" value={dir} onChange={setDir} options={[['powerlifting','Троеборье'],['bench','Жим лёжа'],['deadlift_bench','Тяга + Жим'],['armwrestling','Армрестлинг'],['bodybuilding','Бодибилдинг']].map(([id,label]) => ({ id, label }))} />
            <PopupNumber label="Дней в неделю" value={days} min={2} max={7} suffix="" onChange={v => setDays(v)} />
            <PopupNumber label="Вес тела" value={bw} min={40} max={200} suffix=" кг" onChange={v => setBw(v)} />
          </div>
          {best && <ExpandableCard title={`🏆 Рекомендован: ${best.cycle.meta.title}`} icon="🏆" short={best.cycle.meta.description} full={<><div style={{ marginBottom: 8 }}><b>Почему этот цикл:</b> {explainSelection(best)}</div><div style={{ fontSize: 10, color: "rgba(255,255,255,0.55)" }}>{best.cycle.meta.howItWorks}</div><button onClick={() => { setSelectedCycleId(best.cycle.meta.id); setTimeout(buildSrc, 0); }} style={{ marginTop: 10, width: "100%", padding: 10, borderRadius: 8, border: "none", cursor: "pointer", background: "linear-gradient(135deg,#00e68a,#00c853)", color: "#000", fontWeight: 700, fontSize: 12 }}>✅ Применить цикл и собрать план</button></>} />}
          <div style={H}>📂 Каталог циклов ({LMS_CYCLES.length})</div>
          <PopupSelect label="Выбор цикла из каталога" value={selectedCycleId} onChange={setSelectedCycleId} hint="Полный каталог саморасчитывающихся циклов (СРЦ), блоков и встроенных программ. Нажмите, чтобы открыть." options={LMS_CYCLES.map(c => ({ id: c.meta.id, label: c.meta.title, desc: `${({ powerlifting: 'Троеборье', bench: 'Жим лёжа', deadlift_bench: 'Тяга+Жим', armwrestling: 'Армрестлинг', bodybuilding: 'Бодибилдинг' } as Record<string,string>)[c.meta.direction] || c.meta.direction} · ${c.meta.period} · ${c.meta.level} · ${c.meta.weeks} нед` }))} />
          {(() => { const c = getCycleById(selectedCycleId); if (!c) return null; return <ExpandableCard title={c.meta.title} icon="📖" short={<><b>Кратко:</b> {c.meta.description}</>} full={<><div style={{ marginBottom: 8 }}><b>Как работает цикл:</b> {c.meta.howItWorks}</div>{c.meta.conditions.length > 0 && <div><b>Условия применения:</b><ul style={{ margin: '4px 0 0 16px', padding: 0 }}>{c.meta.conditions.map((cond, i) => <li key={i} style={{ marginBottom: 3 }}>{cond}</li>)}</ul></div>}</>} />; })()}
          <div style={H}>💪 Предельные максимумы (ПМ)</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            <PopupNumber label="Присед" value={pmSquat} min={20} max={500} suffix=" кг" onChange={v => setPmSquat(v)} />
            <PopupNumber label="Жим лёжа" value={pmBench} min={20} max={400} suffix=" кг" onChange={v => setPmBench(v)} />
            <PopupNumber label="Становая тяга" value={pmDead} min={20} max={500} suffix=" кг" onChange={v => setPmDead(v)} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
            <PopupSelect label="Длина мезоцикла" value={String(cycleWeeks)} onChange={v => setCycleWeeks(+v)} options={[['12','12 недель'],['16','16 недель'],['20','20 недель'],['24','24 недели']].map(([id,label]) => ({ id, label }))} />
          </div>
          <div style={{ marginTop: 8, fontSize: 11, fontWeight: 700, color: ACCENT }}>🎯 Слабые группы (акцент, сохраняются в профиль)</div>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 4, marginBottom: 6 }}>{WEAK_GROUPS.map(([id, l]) => { const on = weakPoints.includes(id); return <button key={id} onClick={() => toggleWeak(id)} style={{ padding: "5px 10px", borderRadius: 14, fontSize: 10, fontWeight: 700, cursor: "pointer", border: on ? "1px solid #00e68a" : "1px solid rgba(255,255,255,0.08)", background: on ? "rgba(0,230,138,0.15)" : "rgba(255,255,255,0.02)", color: on ? "#00e68a" : "rgba(255,255,255,0.6)" }}>{l}{on ? " ✓" : ""}</button>; })}</div>
          <button style={{ ...BTN, width: '100%', marginTop: 10 }} onClick={buildSrc}>Сгенерировать план ({cycleWeeks} нед)</button>
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
              return sets + 'x' + s.reps + 'x' + weight + 'кг (' + Math.round(s.pct*100) + '%)' + (autoRegOn && autoRegResult && (autoRegResult.topSetPctMultiplier !== 1 || autoRegResult.volumeMultiplier !== 1) ? ' ⚡' : '');
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
              <div style={{ marginTop:8, padding:'8px 10px', borderRadius:10, background: autoRegResult.deload ? 'rgba(239,68,68,0.08)' : 'rgba(96,165,250,0.06)', border: '1px solid ' + (autoRegResult.deload ? 'rgba(239,68,68,0.25)' : 'rgba(96,165,250,0.2)') }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <span style={{ fontSize:11, fontWeight:700, color: autoRegResult.deload ? '#ef4444' : '#60a5fa' }}>🧠 Авторегуляция плана {autoRegOn ? 'ВКЛ' : 'ВЫКЛ'}</span>
                  <button onClick={() => setAutoRegOn(a => !a)} style={{ padding:'5px 10px', borderRadius:6, fontSize:10, fontWeight:700, cursor:'pointer', border:'none', background: autoRegOn ? '#60a5fa' : 'rgba(255,255,255,0.1)', color: autoRegOn ? '#000' : 'var(--text-dim)' }}>{autoRegOn ? 'Отключить' : 'Применить'}</button>
                </div>
                {autoRegOn && <div style={{ marginTop:6, fontSize:10, color:'rgba(255,255,255,0.7)' }}>
                  <div>Топ-сет ×{autoRegResult.topSetPctMultiplier} · объём ×{autoRegResult.volumeMultiplier} · RIR +{autoRegResult.rirShift}{autoRegResult.deload ? ' · 🔴 DELOAD-триггер' : ''}</div>
                  {autoRegResult.decisions.slice(0,3).map((d, i) => <div key={i} style={{ marginTop:2, color:'rgba(255,255,255,0.55)' }}>• {d}</div>)}
                </div>}
              </div>
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
                <div style={{ fontSize:11, color:'rgba(255,255,255,0.65)', marginBottom:6, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <span style={{ fontWeight:700, color:'#fff' }}>Неделя {wk.week} из {totalW}</span>
                  <span style={{ fontSize:10, fontWeight:700, color:PH_COLOR[phase], background:PH_COLOR[phase]+'22', padding:'2px 8px', borderRadius:8 }}>{PH_RU[phase]}</span>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(36px, 1fr))', gap:4 }}>
                  {W.map(w => { const ph = mesocyclePhaseForWeek(w.week, totalW); const active = w.week===wk.week; return <button key={w.week} onClick={() => setSrcWeek(w.week)} title={'Неделя '+w.week+': '+PH_RU[ph]} style={{ padding:'7px 0', borderRadius:7, border: active ? '1px solid #00e68a' : '1px solid rgba(255,255,255,0.08)', background: active ? PH_COLOR[ph] : PH_COLOR[ph]+'1a', color: active ? '#000' : '#fff', fontSize:10, fontWeight:700, cursor:'pointer' }}>{w.week}</button>; })}
                </div>
              </div>
              {/* Визуальный календарь мезоцикла: недели × дни с тоннажём и фазой */}
              <div style={{ marginTop: 8, padding: 8, borderRadius: 10, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.6)', marginBottom: 6 }}>📅 Календарь мезоцикла (нед × дни, тоннаж)</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {W.map(w => { const ph = mesocyclePhaseForWeek(w.week, totalW); const active = w.week === wk.week; const maxT = Math.max(1, ...W.map(ww => ww.days.reduce((s, d) => s + d.metrics.tonnage, 0))); const wTotal = w.days.reduce((s, d) => s + d.metrics.tonnage, 0); return (
                    <div key={w.week} onClick={() => setSrcWeek(w.week)} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 6px', borderRadius: 6, cursor: 'pointer', background: active ? 'rgba(0,230,138,0.08)' : 'transparent', border: active ? '1px solid rgba(0,230,138,0.3)' : '1px solid transparent' }}>
                      <span style={{ fontSize: 9, fontWeight: 700, color: active ? '#00e68a' : 'rgba(255,255,255,0.7)', minWidth: 26 }}>Н{w.week}</span>
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
                    <div style={{ background:'rgba(255,255,255,0.02)', borderRadius:8, overflow:'hidden', border:'1px solid rgba(255,255,255,0.06)' }}>
                      <div style={{ display:'grid', gridTemplateColumns:'2.2fr 0.5fr 1.3fr', gap:2, padding:'5px 8px', fontSize:8, fontWeight:700, color:'rgba(255,255,255,0.4)', textTransform:'uppercase', background:'rgba(0,230,138,0.05)' }}>
                        <span>Упражнение</span><span>Нагр.</span><span>Подходы</span>
                      </div>
                      {d.exercises.map((e, ei) => (
                        <div key={ei} style={{ display:'grid', gridTemplateColumns:'2.2fr 0.5fr 1.3fr', gap:2, padding:'5px 8px', fontSize:10, color:'rgba(255,255,255,0.9)', borderTop:'1px solid rgba(255,255,255,0.04)', alignItems:'center' }}>
                          <span style={{ fontWeight:600 }}>{e.name}</span>
                          <span style={{ fontSize:9, fontWeight:700, color:e.load === 'main' ? '#00e68a' : e.load === 'additional' ? '#f59e0b' : 'rgba(255,255,255,0.4)' }}>{e.load === 'main' ? 'ОСН' : e.load === 'additional' ? 'ДОП' : 'АКС'}</span>
                          <span style={{ color:'rgba(255,255,255,0.85)' }}>{e.workSets.map((ws, si) => setStr(effSet(wk.week, di, ei, si, ws))).join('  ·  ')}</span>
                        </div>
                      ))}
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
                                <span style={{ fontSize:7, color:'rgba(255,255,255,0.3)' }}>С{si+1}</span>
                                <input type='number' value={es.weight} onChange={ev => setSrcEdits(prev => ({ ...prev, [k]: { ...prev[k], weight: +ev.target.value } }))} style={{ ...INM, width:44 }} />
                                <span style={{ fontSize:7 }}>×</span>
                                <input type='number' value={es.reps} onChange={ev => setSrcEdits(prev => ({ ...prev, [k]: { ...prev[k], reps: +ev.target.value } }))} style={{ ...INM, width:32 }} />
                                <span style={{ fontSize:7 }}>×</span>
                                <input type='number' value={es.sets} onChange={ev => setSrcEdits(prev => ({ ...prev, [k]: { ...prev[k], sets: +ev.target.value } }))} style={{ ...INM, width:28 }} />
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
              {weakPoints.length > 0 && (() => { const eq = loadTrainingProfile().equipment; const eqOk = (e: any) => eq.length === 0 || eq.includes(e.equipment); const GRP_RU: Record<string,string> = { chest:'Грудь', back:'Спина', legs:'Ноги', shoulders:'Плечи', arms:'Руки', core:'Кор' }; const dk0 = dayKey(wk.week, 0); return <MetricCard title='🎯 Рекомендации для слабых групп (добавить аксессуары)' icon='🎯' accent='#ff9100'>
                {weakPoints.map(g => { const pool = getExercisesByGroup(g).filter(eqOk).filter(e => e.type === 'isolation').slice(0, 3); if (pool.length === 0) return null; return <div key={g} style={{ marginBottom: 6 }}><div style={{ fontSize: 10, fontWeight: 700, color: '#ff9100' }}>{GRP_RU[g] || g}</div>{pool.map(ex => <button key={ex.id} onClick={() => addAccessory(dk0, ex.name, g)} style={{ marginRight: 4, marginBottom: 3, padding: '4px 8px', borderRadius: 6, fontSize: 9, cursor: 'pointer', border: '1px solid rgba(255,145,0,0.3)', background: 'rgba(255,145,0,0.08)', color: '#ff9100' }}>＋ {ex.name}</button>)}</div>; })}
                <div style={{ ...SMALL, color: 'rgba(255,255,255,0.5)' }}>Добавляется в день 1 текущей недели (3×10, вес ~70% от workMax). Можно отредактировать в режиме правки.</div>
              </MetricCard>; })()}
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
            const m = calcBBPlanMetrics(builtBb);
            return <div style={{ ...CARD, borderLeft: `3px solid ${ACCENT}`, boxShadow: '0 0 0 1px rgba(0,230,138,0.08)' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', gap:8 }}>
                <div style={{ ...H, margin:0 }}>📋 План: {builtBb.pattern.name}</div>
                <span style={{ fontSize:10, fontWeight:700, color: ACCENT, background:'rgba(0,230,138,0.12)', padding:'3px 8px', borderRadius:8 }}>{W.length} нед</span>
              </div>
              {(() => { const srpe = loadSRPESessions(); if (srpe.length < 2) return null; const acwr = acuteChronicRatio(toDailyLoads(srpe)); if (acwr.ratio <= 1.5) return null; return <div style={{ marginTop: 6, padding: 8, borderRadius: 8, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444', fontSize: 10, fontWeight: 600 }}>🚨 ACWR {acwr.ratio.toFixed(2)} — опасная зона. Рекомендуется разгрузочная неделя: объём −40%, RIR 4, без отказных подходов. Включите авторегуляцию или снизьте сеты по мышцам до MRV.</div>; })()}
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
                    <div style={{ padding: '4px 0' }}>
                      <div style={{ display:'grid', gridTemplateColumns:'1.6fr 0.8fr 0.7fr 0.7fr 0.8fr', gap:2, padding:'4px 10px', fontSize:8, fontWeight:700, color:'rgba(255,255,255,0.4)', textTransform:'uppercase' }}>
                        <span>Мышца</span><span>Характер</span><span>Сеты×повт</span><span>RIR</span><span>Вес</span>
                      </div>
                      {s.exercises.map((e, ei) => (
                        <div key={ei} style={{ display:'grid', gridTemplateColumns:'1.6fr 0.8fr 0.7fr 0.7fr 0.8fr', gap:2, padding:'5px 10px', fontSize:10, color:'rgba(255,255,255,0.85)', borderTop:'1px solid rgba(255,255,255,0.04)' }}>
                          <span style={{ fontWeight:600 }}>{e.muscle}</span>
                          <span style={{ color:'rgba(255,255,255,0.6)' }}>{e.character}</span>
                          <span>{e.sets}×{e.workSets[0].reps}</span>
                          <span style={{ color:'#f59e0b' }}>{e.rir}</span>
                          <span style={{ color:ACCENT, fontWeight:700 }}>{e.workSets[0].weight} кг</span>
                        </div>
                      ))}
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
                <div style={{ display:'grid', gridTemplateColumns:'1.4fr 0.5fr 0.5fr 0.5fr 0.5fr', gap:2, fontSize:8, fontWeight:700, color:'rgba(255,255,255,0.4)', textTransform:'uppercase', padding:'2px 0' }}>
                  <span>Мышца</span><span>Сетов</span><span>Тяж</span><span>Памп</span><span>MRV</span>
                </div>
                {m.perMuscle.map(mm => { const over = mm.totalSets > (mm.mrv || 999); return (
                  <div key={mm.muscle} style={{ display:'grid', gridTemplateColumns:'1.4fr 0.5fr 0.5fr 0.5fr 0.5fr', gap:2, fontSize:10, color:'rgba(255,255,255,0.85)', padding:'3px 0', borderTop:'1px solid rgba(255,255,255,0.04)' }}>
                    <span style={{ fontWeight:600 }}>{mm.muscle}{over ? ' ⚠' : ''}</span>
                    <span style={{ color: over ? '#ef4444' : ACCENT, fontWeight:700 }}>{mm.totalSets}</span>
                    <span style={{ color:'#ef4444' }}>{mm.тяжSets}</span>
                    <span style={{ color:'#60a5fa' }}>{mm.пампSets}</span>
                    <span style={{ color:'rgba(255,255,255,0.5)' }}>{mm.mrv}</span>
                  </div>
                ); })}
              </MetricCard>
              {(() => { const wkStats = W.map(w => { const exs = w.sessions.flatMap(s => s.exercises); const sets = exs.reduce((s, e) => s + e.sets, 0); const rir = sets > 0 ? exs.reduce((s, e) => s + e.rir * e.sets, 0) / sets : 0; return { week: w.week, sets, rir }; }); const maxS = Math.max(1, ...wkStats.map(x => x.sets)); const px = (i: number) => 24 + (i / Math.max(1, W.length - 1)) * 280; const py = (v: number) => 60 - (v / 5) * 44; return <div style={{ marginTop: 8, padding: 10, borderRadius: 10, background: 'rgba(168,85,247,0.05)', border: '1px solid rgba(168,85,247,0.15)' }}><div style={{ fontSize: 10, fontWeight: 700, color: '#a855f7', marginBottom: 6 }}>📈 Прогрессия объёма и RIR по неделям</div><svg width='100%' viewBox='0 0 320 70' style={{ maxWidth: 360, margin: '0 auto', display: 'block' }}>{wkStats.map(x => <rect key={'b'+x.week} x={px(x.week-1)-8} y={60 - (x.sets / maxS) * 44} width={16} height={(x.sets / maxS) * 44} rx={3} fill='rgba(0,230,138,0.4)' />)}<polyline points={wkStats.map(x => px(x.week-1) + ',' + py(x.rir)).join(' ')} fill='none' stroke='#a855f7' strokeWidth={1.6} />{wkStats.map(x => <circle key={'r'+x.week} cx={px(x.week-1)} cy={py(x.rir)} r={2} fill='#a855f7' />)}</svg><div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 4 }}><span style={{ fontSize: 9, color: 'rgba(0,230,138,0.8)' }}>▮ Сеты/нед</span><span style={{ fontSize: 9, color: '#a855f7' }}>● RIR</span></div></div>; })()}
              <div style={{ ...SMALL, marginTop: 8, padding: 8, background:'rgba(96,165,250,0.06)', borderRadius:8, border:'1px solid rgba(96,165,250,0.15)' }}>{explainBBMetrics(m)}</div>
            </div>;
          })()}
        </div>
      )}

      {/* ── Ручной сбор ── */}
      {mainTab === 'manual' && (() => {
        const [manualWorkout, setManualWorkout] = React.useState<{ name: string; exercises: { name: string; sets: number; reps: number; weight: number }[]; date: string; cfg?: Record<string, string> }>({ name: '', exercises: [{ name: '', sets: 3, reps: 10, weight: 0 }], date: new Date().toISOString().slice(0, 10) });
        const [saved, setSaved] = React.useState<typeof manualWorkout[]>(() => { try { return JSON.parse(localStorage.getItem('he_manual_workouts') || '[]'); } catch { return []; } });
        const addEx = () => setManualWorkout(p => ({ ...p, exercises: [...p.exercises, { name: '', sets: 3, reps: 10, weight: 0 }] }));
        const updEx = (i: number, field: string, val: any) => setManualWorkout(p => { const ex = [...p.exercises]; ex[i] = { ...ex[i], [field]: val }; return { ...p, exercises: ex }; });
        const [cfg, setCfg] = React.useState<Record<string, string>>({});
        const setCfgField = (k: string, v: string) => setCfg(p => ({ ...p, [k]: v }));
        const saveWorkout = () => { if (!manualWorkout.name.trim() || manualWorkout.exercises.every(e => !e.name.trim())) return; const item = { ...manualWorkout, cfg }; const updated = [...saved, item]; setSaved(updated); localStorage.setItem('he_manual_workouts', JSON.stringify(updated)); setCfg({}); setManualWorkout({ name: '', exercises: [{ name: '', sets: 3, reps: 10, weight: 0 }], date: new Date().toISOString().slice(0, 10) }); };
        const delWorkout = (i: number) => { const updated = saved.filter((_, idx) => idx !== i); setSaved(updated); localStorage.setItem('he_manual_workouts', JSON.stringify(updated)); };
        const splitOpts = Object.entries(TRAINING_SPLITS).map(([id, s]: [string, { name: string; desc: string }]) => ({ id, label: s.name, desc: s.desc }));
        const DIR_RU: Record<string, string> = { powerlifting: 'Троеборье', bench: 'Жим лёжа', deadlift_bench: 'Тяга+Жим', armwrestling: 'Армрестлинг', bodybuilding: 'Бодибилдинг' };
        const cycleOpts = LMS_CYCLES.map(c => { const cat = c.meta.id.startsWith("block") ? "Блок" : c.meta.id.startsWith("embed") ? "Встроенная программа" : "СРЦ-цикл"; return { id: c.meta.id, label: c.meta.title, desc: cat + " · " + (DIR_RU[c.meta.direction] || c.meta.direction) + " · " + c.meta.level }; });
        const progOpts = [...FULL_PROGRAM_LIBRARY, ...WOMENS_PROGRAMS, ...CUSTOM_PROGRAMS].map((p: any) => ({ id: p.id, label: p.name, desc: p.type + " · " + p.goal + " · " + p.level }));
        const methodOpts = (cat: string) => getMethodsByCategory(cat).map(m => ({ id: m.name, label: m.name, desc: m.bestFor }));
        const CFG_LABEL: Record<string, string> = { split: 'сплит', cycle: 'цикл', program: 'программа', periodization: 'периодизация', progression: 'прогрессия', intensity: 'интенсивность', technique: 'техника', volume: 'объём', frequency: 'частота' };
        const cfgSummary = Object.entries(cfg).filter(([, v]) => v);
        return <div>
          <div style={{ ...CARD, marginBottom: 12 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#00e68a', marginBottom: 10 }}>🛠 Ручной конструктор тренировки</div>
            <div style={{ ...H, margin: '4px 0 8px' }}>⚙️ Конфигурация программы</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <PopupSelect label='Тип сплита' value={cfg.split || ''} onChange={v => setCfgField('split', v)} options={splitOpts} hint='Все доступные сплиты из библиотеки.' />
              <PopupSelect label='Тип цикла' value={cfg.cycle || ''} onChange={v => setCfgField('cycle', v)} options={cycleOpts} hint='Все циклы (СРЦ, блоки, встроенные программы) по категориям.' />
              <PopupSelect label='Программа тренировок' value={cfg.program || ''} onChange={v => setCfgField('program', v)} options={progOpts} hint='Готовые программы из библиотеки.' />
              <PopupSelect label='Периодизация' value={cfg.periodization || ''} onChange={v => setCfgField('periodization', v)} options={methodOpts('periodization')} />
              <PopupSelect label='Прогрессия' value={cfg.progression || ''} onChange={v => setCfgField('progression', v)} options={methodOpts('progression')} />
              <PopupSelect label='Интенсивность' value={cfg.intensity || ''} onChange={v => setCfgField('intensity', v)} options={methodOpts('intensity')} />
              <PopupSelect label='Техника' value={cfg.technique || ''} onChange={v => setCfgField('technique', v)} options={methodOpts('technique')} />
              <PopupSelect label='Объём' value={cfg.volume || ''} onChange={v => setCfgField('volume', v)} options={methodOpts('volume')} />
              <PopupSelect label='Частота' value={cfg.frequency || ''} onChange={v => setCfgField('frequency', v)} options={methodOpts('frequency')} />
            </div>
            {cfgSummary.length > 0 && <div style={{ marginTop: 8, padding: 8, borderRadius: 8, background: 'rgba(0,230,138,0.06)', border: '1px solid rgba(0,230,138,0.15)', fontSize: 10, color: '#00e68a', lineHeight: 1.6 }}>✓ Выбрано: {cfgSummary.map(([k, v]) => (CFG_LABEL[k] || k) + ': ' + v).join(' · ')}</div>}
            <div style={{ ...H, margin: '12px 0 8px' }}>📝 Состав тренировки</div>
            <div style={LABEL}>Название тренировки</div>
            <input style={IN} value={manualWorkout.name} onChange={e => setManualWorkout(p => ({ ...p, name: e.target.value }))} placeholder="Грудные + трицепс" />
            <div style={LABEL}>Дата</div>
            <input style={IN} type="date" value={manualWorkout.date} onChange={e => setManualWorkout(p => ({ ...p, date: e.target.value }))} />
            {manualWorkout.exercises.map((ex, i) => (
              <div key={i} style={{ display: 'flex', gap: 4, marginTop: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                <input style={{ ...IN, flex: 3, minWidth: 80 }} value={ex.name} onChange={e => updEx(i, 'name', e.target.value)} placeholder="Упражнение" list="ex-list" />
                <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)' }}>С</span>
                <input style={{ ...IN, flex: 1, minWidth: 36, textAlign: 'center' }} type="number" min={1} max={20} value={ex.sets} onChange={e => updEx(i, 'sets', +e.target.value)} placeholder="С" />
                <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)' }}>П</span>
                <input style={{ ...IN, flex: 1, minWidth: 36, textAlign: 'center' }} type="number" min={1} max={100} value={ex.reps} onChange={e => updEx(i, 'reps', +e.target.value)} placeholder="П" />
                <input style={{ ...IN, flex: 1.5, minWidth: 50, textAlign: 'center' }} type="number" min={0} step={2.5} value={ex.weight} onChange={e => updEx(i, 'weight', +e.target.value)} placeholder="кг" />
                {manualWorkout.exercises.length > 1 && <button style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', fontSize: 12 }} onClick={() => setManualWorkout(p => ({ ...p, exercises: p.exercises.filter((_, idx) => idx !== i) }))}>✕</button>}
              </div>
            ))}
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button style={{ ...BTN, flex: 1 }} onClick={addEx}>+ Упражнение</button>
              <SaveButton label="💾 Сохранить тренировку" savedLabel="✓ Тренировка сохранена" disabled={!manualWorkout.name.trim() || manualWorkout.exercises.every(e => !e.name.trim())} onSave={saveWorkout} />
            </div>
            <datalist id="ex-list">{EXERCISE_CATALOG.slice(0, 100).map(e => <option key={e.id} value={e.name} />)}</datalist>
          </div>
          {saved.length > 0 && <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 8 }}>Сохранённые тренировки ({saved.length})</div>
            {saved.map((w, i) => (
              <div key={i} style={{ ...CARD, marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontWeight: 700, color: '#00e68a', fontSize: 12 }}>{w.name}</span>
                  <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>{w.date}</span>
                </div>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.6)', marginBottom: 6, lineHeight: 1.4 }}>{w.exercises.map(e => `${e.name}: ${e.sets}×${e.reps}@${e.weight}кг`).join(' · ')}</div>
                <button style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)', color: '#ef4444', borderRadius: 8, padding: '4px 12px', cursor: 'pointer', fontSize: 10 }} onClick={() => delWorkout(i)}>✕ Удалить</button>
              </div>
            ))}
          </div>}
        </div>;
      })()}

      {subView === 'plates' && <PlateCalculator initialWeight={workingWeight} />}

      {subView === 'autoreg' && <AutoregPanel />}
      {subView === 'peak' && <PeakingPanel />}
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
