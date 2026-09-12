/** ArmDiagnosticsHub.tsx — ХАБ диагностики армрестлинга/армлифтинга PRO MAX (без рисков).
 * 5 подвкладок: Grip | Wrist/Rotation | Pressure | Strength(Dynamic+Bench) | Recovery(Tendon/ACWR)
 * - Углы РУ/РА/РН (motion-capture) + VBT + Force + Dynamic F/t F100/F500 + asymmetry + benchmarks + fatigue + ACWR (факт, без оценок риска)
 * - Детали + info (без score/verification/уровней) + table 3/2/1 + tendon факт
 * - Видео BlazePose (estimateAnglesFromLandmarks) + canvas preview
 * - Вывод в Арм-конструктор via planner-bridge (weakpoints)
 */
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { diagnoseArmWeakDetailed, expandLegacyWeakPoints, LEGACY_TO_DETAILED } from '../../../engines/arm/arm-weakpoint.engine';
import { getArmLandmarks, tendonWeeklyLimit } from '../../../engines/arm/arm-volume-landmarks.engine';
import { checkHumerusGuard, checkWristBalance } from '../../../engines/arm/arm-injury-guard.engine';
import { tableWeekKind } from '../../../engines/arm/arm-table.engine';
import { buildArmDiagnosticsReport } from '../../../engines/arm/arm-diagnostics-hub.engine';
import { estimateArmAngles, validateArmAngles, recommendAnglesForTechnique, estimateAnglesFromLandmarks, hasVideoSupport, ensureHandsModel, createHandsProcessor, isAnglesVerified } from '../../../engines/arm/arm-motion-capture.engine';
import { estimateForceVector } from '../../../engines/arm/arm-force-capture.engine';
import { diagnoseVbt } from '../../../engines/arm/arm-vbt-capture.engine';
import { buildDynamicReport } from '../../../engines/arm/arm-dynamic-force.engine';
import { loadForceTrials, addForceTrial, buildWeeklyStats, fatigueTrend, forceTrend } from '../../../engines/arm/arm-force-history.store';
import { resolveArmLevelByTests } from '../../../engines/arm/arm-benchmarks.engine';
import { ARM_MUSCLE_RU } from '../../../engines/arm/arm-types';
import { applyToPlanner } from './planner-bridge';
import { AdRoot, AdCard } from './arm-design-system';
import { LEVEL_OPTS, TAB_DEFS, WEAK_GROUPS, WP_LABEL_SHORT } from './arm-hub-shared';
import type { HubTab, TiqBout } from './arm-hub-shared';
import { HubHead, HubControls, HubOutput, HubP0Panel, HubAction, HubTabNext, HubScenarios } from './arm-hub-panels';
import { HubGripTab, HubWristTab } from './arm-hub-tabs1';
import { HubPressureTab, HubStrengthTab, HubRecoveryTab } from './arm-hub-tabs2';
import { ARM_BIOMECH, type ArmWeakPoint, isArmWeakPoint, vbtThresholdForWeakPoint, phaseForArmAngle } from '../../../engines/arm/arm-biomechanics.engine';
import { ARM_CORRECTIONS } from '../../../engines/arm/arm-weakpoint-corrections';
import { auditArmPlan, worstArmPoint } from '../../../engines/arm/arm-plan-audit.engine';
import { diagnoseArmWeakCause } from '../../../engines/arm/arm-weak-cause.engine';
import { rankCorrectionsForArm } from '../../../engines/arm/arm-correction-rank.engine';
import { simulateArmInjection } from '../../../engines/arm/arm-simulator.engine';
import { buildArmSpecBlock } from '../../../engines/arm/arm-spec-block.engine';
import { injectArmCorrections, saveArmPlanPrev, loadArmPlanPrev, clearArmPlanPrev } from '../../../engines/arm/arm-diagnostics-injection.engine';
import { detectArmWeakByE1rm, armVolumeHistory28d, armPointsForMuscles } from '../../../engines/arm/arm-diary-weak-detection.engine';
import { parseArmTrackCsv, armPathMetrics, classifyArmTrajectory, isArmRealChange } from '../../../engines/arm/arm-video-analysis.engine';
import { assessArmMobility, mobilityFailForWeakPoint, applyArmMobilityToProfile } from '../../../engines/arm/arm-mobility.engine';
import { autoregArmFromDiary, type ArmDiaryDay } from '../../../engines/arm/arm-diary-autoreg.engine';
import { checkUCLGuard, checkShoulderGuard, checkTendonGuard } from '../../../engines/arm/arm-injury-guard.engine';
import { planBilateralVolume, loadBilateralHist, saveBilateralEntry, bilateralTrend } from '../../../engines/arm/arm-bilateral.engine';
import { scorePlatform, planAttempts, loadPlatformLog } from '../../../engines/arm/arm-platform.engine';
import { computeArmPerMuscleACWR, worstArmAcwrZone, armAcwrSummary } from '../../../engines/arm/arm-acwr.engine';
import { buildArmDiagnosticsHtml, buildArmDiagnosticsCsv, downloadArmFile } from '../../../engines/arm/arm-diagnostics-export.engine';
import { buildArmBridgeData } from '../../../engines/arm/arm-bridge-payload.engine';
import { loadRedFlags, redFlagLabels } from '../../../engines/arm/arm-redflags.store';
import { readHumerusBridge } from '../../../engines/arm/arm-pro5-safety.engine';
import { wafClassFor } from '../../../engines/arm/arm-norms-table.engine';
import { analyzeTableIq, tableIqTrend } from '../../../engines/arm/arm-table-iq.engine';
import { profileOpponent } from '../../../engines/arm/arm-matchup.engine';
import { buildRehabPlan } from '../../../engines/arm/arm-rehab.engine';
import { loadArmMeasureHistory } from '../../../engines/arm/arm-force-history.store';
import { scoreArm, scoreLabel } from '../../../engines/arm/arm-scoring.engine';
import { loadSRPESessions } from '../../../engines/pro/srpe-store';
import { toDailyLoads, acuteChronicRatio } from '../../../engines/pro/training-load.engine';
import { haptics } from '../../../core/native-bridge';
import { OrthoScreenCard } from './OrthoScreenCard';

const STORAGE_KEY = 'he_arm_diagnostics_hub_v4';

// TOP T1/T7b: Table-IQ журнал + матчап (отдельные ключи, v4-стейт не трогаем)
const TIQ_KEY = 'he_arm_table_iq';
const MU_KEY = 'he_arm_matchup';
function loadTiq(): TiqBout[] {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(TIQ_KEY) : null;
    const j = raw ? JSON.parse(raw) : [];
    return Array.isArray(j) ? j.filter((b) => b && typeof b === 'object').slice(0, 60) : [];
  } catch { return []; }
}
function saveTiq(bouts: TiqBout[]): void {
  try { if (typeof localStorage !== 'undefined') localStorage.setItem(TIQ_KEY, JSON.stringify(bouts.slice(0, 60))); } catch {}
}
function loadMu(): { opp: string; hand: string; wd: string } {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(MU_KEY) : null;
    const j = raw ? JSON.parse(raw) : {};
    return { opp: String((j as any).opp || 'unknown'), hand: String((j as any).hand || 'unknown'), wd: String((j as any).wd || '') };
  } catch { return { opp: 'unknown', hand: 'unknown', wd: '' }; }
}
function saveMu(mu: { opp: string; hand: string; wd: string }): void {
  try { if (typeof localStorage !== 'undefined') localStorage.setItem(MU_KEY, JSON.stringify(mu)); } catch {}
}
// D4: персистентность P1/P2-состояния (отдельный ключ, v4-стейт не трогаем)
const P1_KEY = 'he_arm_diagnostics_hub_p1';
function loadP1State(): Record<string, any> {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(P1_KEY) : null;
    const j = raw ? JSON.parse(raw) : {};
    return j && typeof j === 'object' ? j : {};
  } catch { return {}; }
}

type ArmDiagState = {
  rtKg: string;
  axleKg: string;
  axleImpl: string;
  excalKg: string;
  pinchSec: string;
  sideKg: string;
  backKg: string;
  leftKg: string;
  rightKg: string;
  bwKg: string;
  sex: string;
  weightClass: string;
  ageBand: string;
  cup: boolean;
  rising: boolean;
  pron: boolean;
  sup: boolean;
  side: boolean;
  back: boolean;
  weakPoints: ArmWeakPoint[]; // 12 мёртвых точек
  technique: string;
  level: string;
  elbowDeg: string;
  forearmDeg: string;
  wristDeg: string;
  direction: 'to_little' | 'to_middle' | 'to_thumb';
  vbtWeight: string;
  vbtReps: string;
  vbtVel: string;
  /** PRO-3 P1: скорость 2-го подхода — честный loss между замерами (пусто = оценка best≈ввод+0.2). */
  vbtVel2: string;
  // dynamic: 4 trials
  fingerKg: string;
  fingerMs: string;
  hammerKg: string;
  hammerMs: string;
  hookKg: string;
  hookMs: string;
  cupKg: string;
  cupMs: string;
  wristCurlLb: string;
  pronHoldSec: string;
  cupHoldSec: string;
  cocLevel: string;
};

const DEFAULT_STATE: ArmDiagState = {
  rtKg: '', axleKg: '', axleImpl: 'saxon', excalKg: '', pinchSec: '', sideKg: '', backKg: '', leftKg: '', rightKg: '', bwKg: '80', sex: 'male', weightClass: '', ageBand: '',
  cup: false, rising: false, pron: false, sup: false, side: false, back: false, weakPoints: [],
  technique: 'balanced', level: 'intermediate',
  elbowDeg: '110', forearmDeg: '90', wristDeg: '10', direction: 'to_middle',
  vbtWeight: '', vbtReps: '', vbtVel: '', vbtVel2: '',
  fingerKg: '', fingerMs: '', hammerKg: '', hammerMs: '', hookKg: '', hookMs: '', cupKg: '', cupMs: '',
  wristCurlLb: '', pronHoldSec: '', cupHoldSec: '', cocLevel: '',
};

export const ArmDiagnosticsHub: React.FC = () => {
  const [state, setState] = useState<ArmDiagState>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        // миграция: гарантируем weakPoints массив
        if (!Array.isArray(parsed.weakPoints)) parsed.weakPoints = [];
        // E15 P2: валидация формы — только канонические 12 точек, макс 3
        parsed.weakPoints = parsed.weakPoints.filter((w: unknown) => typeof w === 'string' && isArmWeakPoint(w)).slice(0, 3);
        return { ...DEFAULT_STATE, ...parsed };
      }
      const v3 = localStorage.getItem('he_arm_diagnostics_hub_v3');
      if (v3) {
        const parsed = JSON.parse(v3);
        // v3 → v4: развернуть legacy booleans в weakPoints
        const legacy: string[] = [];
        if (parsed.cup) legacy.push('cup'); if (parsed.rising) legacy.push('rising');
        if (parsed.pron) legacy.push('pronation'); if (parsed.sup) legacy.push('supination');
        if (parsed.side) legacy.push('side'); if (parsed.back) legacy.push('back');
        const expanded = expandLegacyWeakPoints(legacy);
        return { ...DEFAULT_STATE, ...parsed, weakPoints: expanded.slice(0,3) };
      }
      const v2 = localStorage.getItem('he_arm_diagnostics_hub_v2');
      if (v2) return { ...DEFAULT_STATE, ...JSON.parse(v2), weakPoints: [] };
    } catch {}
    return DEFAULT_STATE;
  });
  const [tab, setTab] = useState<HubTab>('grip');
  const [toast, setToast] = useState<string>('');
  const [forceHistoryTick, setForceHistoryTick] = useState(0);
  const [showCam, setShowCam] = useState(false);
  const p1saved = useMemo(loadP1State, []);
  const [specWeeks, setSpecWeeks] = useState(String((p1saved as any).specWeeks ?? '6'));
  const [injectMsg, setInjectMsg] = useState('');
  const [planNonce, setPlanNonce] = useState(0);
  const [hasInjectPrev, setHasInjectPrev] = useState<boolean>(() => {
    try { return !!localStorage.getItem('he_arm_plan_saved_prev'); } catch { return false; }
  });
  const [bilatTick, setBilatTick] = useState(0);
  const [trackCsv, setTrackCsv] = useState(String((p1saved as any).trackCsv ?? ''));
  const [baseXLoop, setBaseXLoop] = useState<string>(() => {
    try { return String((p1saved as any).baseXLoop ?? localStorage.getItem('he_arm_track_base') ?? ''); } catch { return ''; }
  });
  const [mobWristFlex, setMobWristFlex] = useState((p1saved as any).mobWristFlex !== false);
  const [mobWristExt, setMobWristExt] = useState((p1saved as any).mobWristExt !== false);
  const [mobPron, setMobPron] = useState((p1saved as any).mobPron !== false);
  const [mobSup, setMobSup] = useState((p1saved as any).mobSup !== false);
  const [mobElbow, setMobElbow] = useState((p1saved as any).mobElbow !== false);
  const [mobRetest, setMobRetest] = useState<'' | 'better' | 'same'>(((p1saved as any).mobRetest as any) || '');
  const [mobMsg, setMobMsg] = useState('');
  // D1: боли + сон; D4: попытка помоста
  const [painElbow, setPainElbow] = useState(String((p1saved as any).painElbow ?? ''));
  const [painWrist, setPainWrist] = useState(String((p1saved as any).painWrist ?? ''));
  const [sleepHours, setSleepHours] = useState(String((p1saved as any).sleepHours ?? ''));
  const [attKg, setAttKg] = useState(String((p1saved as any).attKg ?? ''));
  const [attOk, setAttOk] = useState(true);
  const [attTick, setAttTick] = useState(0);
  // TOP T1/T7b: матчап + Table-IQ журнал (свои ключи)
  const [tiq, setTiq] = useState<TiqBout[]>(() => loadTiq());
  const [tiqFouls, setTiqFouls] = useState('');
  const [tiqWin, setTiqWin] = useState(true);
  const [tiqSlip, setTiqSlip] = useState(false);
  const [tiqStrap, setTiqStrap] = useState(false);
  const [tiqCenter, setTiqCenter] = useState('');
  const [tiqFinish, setTiqFinish] = useState('');
  const [muState, setMuState] = useState(() => loadMu());
  // TOP T5b: return-to-pull (локальное состояние, без персиста)
  const [rhInjury, setRhInjury] = useState('none');
  const [rhWeeks, setRhWeeks] = useState('');
  const [rhPain, setRhPain] = useState('');
  const [rhSurg, setRhSurg] = useState(false);
  const addTiqBout = () => {
    const today = (() => { try { return new Date().toISOString().slice(0, 10); } catch { return ''; } })();
    const b: TiqBout = {
      fouls: Math.max(0, Math.round(Number(tiqFouls) || 0)),
      win: tiqWin, slip: tiqSlip, strap: tiqStrap,
      centerHoldSec: tiqCenter ? Number(tiqCenter) : undefined,
      finishSec: tiqWin && tiqFinish ? Number(tiqFinish) : undefined,
      dateIso: today || undefined,
    };
    setTiq((prev) => { const next = [...prev, b].slice(-60); saveTiq(next); return next; });
    setTiqFouls(''); setTiqWin(true); setTiqSlip(false); setTiqStrap(false); setTiqCenter(''); setTiqFinish('');
  };
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const handsRef = useRef<{ stop: () => void } | null>(null);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
  }, [state]);

  // D4: персистентность P1/P2-полей (отдельный ключ)
  useEffect(() => {
    try {
      localStorage.setItem(P1_KEY, JSON.stringify({
        specWeeks, trackCsv, baseXLoop,
        mobWristFlex, mobWristExt, mobPron, mobSup, mobElbow, mobRetest,
        painElbow, painWrist, sleepHours, attKg,
      }));
    } catch {}
  }, [specWeeks, trackCsv, baseXLoop, mobWristFlex, mobWristExt, mobPron, mobSup, mobElbow, mobRetest, painElbow, painWrist, sleepHours, attKg]);

  // ACWR from diary — факт без зон
  const acwr = useMemo(() => {
    try {
      const srpe = loadSRPESessions();
      if (srpe.length < 2) return null;
      const r = acuteChronicRatio(toDailyLoads(srpe as any));
      return { ratio: Math.round(r.ratio*100)/100 };
    } catch { return null; }
  }, []);

  const tendonAcwr = useMemo(() => {
    try {
      const srpe: any[] = loadSRPESessions() as any;
      if (srpe.length < 3) return null;
      const tendonOnly = srpe.filter((s:any) => {
        if (!s.exercises) return true;
        const TENDON = new Set(['wrist_flexors','wrist_extensors','pronators','supinators','risers','thumb','ulnar_deviators','radial_deviators']);
        return (s.exercises as any[]).some((e:any)=> TENDON.has(e.muscle));
      });
      if (tendonOnly.length < 3) return null;
      const dl = toDailyLoads(tendonOnly as any);
      if (dl.length < 5) return null;
      const r = acuteChronicRatio(dl as any);
      return { ratio: Math.round(r.ratio*100)/100 };
    } catch { return null; }
  }, []);

  const diag = useMemo(() => diagnoseArmWeakDetailed({
    weakTest: {
      cupFails: state.cup,
      risingFails: state.rising,
      pronationFails: state.pron,
      supinationFails: state.sup,
      sidePressureFails: state.side,
      backPressureFails: state.back,
      gripSupportMaxKg: state.rtKg ? parseFloat(state.rtKg) : undefined,
      gripAxleMaxKg: state.axleKg ? parseFloat(state.axleKg) : undefined,
      pinchHoldSec: state.pinchSec ? parseFloat(state.pinchSec) : undefined,
    },
    weakPoints: state.weakPoints,
    technique: state.technique,
  }), [state.cup, state.rising, state.pron, state.sup, state.side, state.back, state.rtKg, state.axleKg, state.pinchSec, state.technique, state.weakPoints]);

  const bwNum = parseFloat(state.bwKg) || 80;
  // PRO-3 P3: класс по полу (раньше wafWeightClassFor — только мужская сетка)
  const weightClassAuto = state.weightClass || wafClassFor(bwNum, state.sex).cls;

  // локально с bw/sex/weightClass для корректного sideRef
  const forceVecPro = useMemo(() => estimateForceVector({
    rtKg: state.rtKg ? parseFloat(state.rtKg) : undefined,
    axleKg: state.axleKg ? parseFloat(state.axleKg) : undefined,
    pinchSec: state.pinchSec ? parseFloat(state.pinchSec) : undefined,
    sideKg: state.sideKg ? parseFloat(state.sideKg) : undefined,
    backKg: state.backKg ? parseFloat(state.backKg) : undefined,
    leftKg: state.leftKg ? parseFloat(state.leftKg) : undefined,
    rightKg: state.rightKg ? parseFloat(state.rightKg) : undefined,
    bodyWeightKg: bwNum,
    sex: state.sex,
    weightClass: weightClassAuto,
  } as any), [state.rtKg, state.axleKg, state.pinchSec, state.sideKg, state.backKg, state.leftKg, state.rightKg, bwNum, state.sex, weightClassAuto]);

  const angles = useMemo(() => estimateArmAngles({
    elbowDeg: parseFloat(state.elbowDeg) || 110,
    forearmDeg: parseFloat(state.forearmDeg) || 90,
    wristDeg: parseFloat(state.wristDeg) || 10,
    direction: state.direction,
  }), [state.elbowDeg, state.forearmDeg, state.wristDeg, state.direction]);

  const angleValid = useMemo(() => validateArmAngles(angles), [angles]);
  const recAngles = useMemo(() => recommendAnglesForTechnique(state.technique), [state.technique]);
  const autoPoint = useMemo(() => {
    try {
      return phaseForArmAngle({ elbowDeg: angles.elbowDeg, wristDeg: angles.wristDeg, forearmDeg: angles.forearmDeg, technique: state.technique });
    } catch { return null; }
  }, [angles.elbowDeg, angles.wristDeg, angles.forearmDeg, state.technique]);

  const vbt = useMemo(() => {
    const w = parseFloat(state.vbtWeight);
    const r = parseInt(state.vbtReps, 10);
    const v = parseFloat(state.vbtVel);
    if (!Number.isFinite(w) || !Number.isFinite(r) || !Number.isFinite(v)) return diagnoseVbt([]);
    // E9 P1: exerciseId топ-коррекции + weakPoint первой точки → пороги точки, иначе legacy
    const wp0 = state.weakPoints[0];
    const ex0 = (() => { try { return wp0 ? ARM_CORRECTIONS[wp0]?.exercises[0] : undefined; } catch { return undefined; } })();
    // PRO-3 P1: два реальных замера — честный loss; один замер — оценка best≈ввод+0.2 (видно в UI)
    const v2 = parseFloat((state as any).vbtVel2);
    if (Number.isFinite(v2) && v2 > 0) {
      return diagnoseVbt([
        { weight: w, reps: r, velocityMs: v, exerciseId: ex0, weakPoint: wp0 } as any,
        { weight: w, reps: r, velocityMs: v2, exerciseId: ex0, weakPoint: wp0 } as any,
      ]);
    }
    return diagnoseVbt([
      { weight: w, reps: r, velocityMs: v + 0.2, exerciseId: ex0, weakPoint: wp0 } as any,
      { weight: w, reps: r, velocityMs: v, exerciseId: ex0, weakPoint: wp0 } as any,
    ]);
  }, [state.vbtWeight, state.vbtReps, state.vbtVel, (state as any).vbtVel2, state.weakPoints]);

  // E9 P1: какие пороги сейчас действуют на VBT-карточке
  const vbtThP0 = useMemo(() => {
    const wp0 = state.weakPoints[0];
    if (!wp0) return null;
    try { return vbtThresholdForWeakPoint(wp0); } catch { return null; }
  }, [state.weakPoints]);

  const anglesVerified = hasVideoSupport() && isAnglesVerified(angles);

  // Dynamic trials (Bezkorovainyi 4 теста)
  const dynamicTrials = useMemo(() => {
    const arr: any[] = [];
    const mk = (ex: string, kgS: string, msS: string) => {
      const kg = parseFloat(kgS); const ms = parseFloat(msS);
      if (Number.isFinite(kg) && kg>0 && Number.isFinite(ms) && ms>0) arr.push({ exercise: ex, forceKg: kg, timeMs: ms, bwKg: bwNum });
    };
    mk('finger_flex', state.fingerKg, state.fingerMs);
    mk('hammer', state.hammerKg, state.hammerMs);
    mk('hook', state.hookKg, state.hookMs);
    mk('cup', state.cupKg, state.cupMs);
    // если есть left/right отдельно — добавим как отдельные точки для асимметрии (если оба введены)
    if (state.leftKg && state.rightKg) {
      const lk = parseFloat(state.leftKg); const rk = parseFloat(state.rightKg);
      if (Number.isFinite(lk) && Number.isFinite(rk) && lk>0 && rk>0) {
        // добавим hook left/right для asymmetry calc
        arr.push({ exercise: 'hook', forceKg: lk, timeMs: 1200, bwKg: bwNum, hand: 'left' } as any);
        arr.push({ exercise: 'hook', forceKg: rk, timeMs: 1200, bwKg: bwNum, hand: 'right' } as any);
      }
    }
    return arr;
  }, [state.fingerKg, state.fingerMs, state.hammerKg, state.hammerMs, state.hookKg, state.hookMs, state.cupKg, state.cupMs, state.leftKg, state.rightKg, bwNum]);

  const dynamicReport = useMemo(() => buildDynamicReport(dynamicTrials as any), [dynamicTrials]);

  // Benchmarks auto-level
  const benchRes = useMemo(() => resolveArmLevelByTests({
    wristCurlLb: state.wristCurlLb ? parseFloat(state.wristCurlLb) : undefined,
    pronHoldSec: state.pronHoldSec ? parseFloat(state.pronHoldSec) : undefined,
    cupHoldSec: state.cupHoldSec ? parseFloat(state.cupHoldSec) : undefined,
    cocLevel: state.cocLevel ? parseFloat(state.cocLevel) : undefined,
    rtKg: state.rtKg ? parseFloat(state.rtKg) : undefined,
    sideKg: state.sideKg ? parseFloat(state.sideKg) : undefined,
    bwKg: bwNum,
  }), [state.wristCurlLb, state.pronHoldSec, state.cupHoldSec, state.cocLevel, state.rtKg, state.sideKg, bwNum]);

  const forceHistory = useMemo(() => {
    try {
      const trials = loadForceTrials();
      const stats = buildWeeklyStats(trials, 12);
      return { trials, stats, fatigue: fatigueTrend(stats), trend: forceTrend(stats) };
    } catch { return { trials: [], stats: [], fatigue: null, trend: null }; }
  }, [forceHistoryTick]);

  // Tendon sets + table ratio now from derived estimates (not hardcoded 2/4)
  // tendon/table из реального builtPlan (he_arm_last_plan) — факт, иначе оценка
  const derivedTendon = useMemo(() => {
    try {
      const raw = typeof localStorage !== 'undefined' ? localStorage.getItem('he_arm_last_plan') : null;
      if (raw) {
        const plan = JSON.parse(raw);
        if (plan?.weeks?.length) {
          let total = 0;
          for (const wk of plan.weeks) for (const sess of wk.sessions) for (const ex of sess.exercises) if (['wrist_flexors','pronators','supinators','risers','thumb','ulnar_deviators','radial_deviators','wrist_extensors'].includes(ex.muscle)) total += ex.sets;
          const avg = Math.round(total / plan.weeks.length);
          if (Number.isFinite(avg) && avg>0) return Math.min(22, avg);
        }
      }
    } catch {}
    let base = 8;
    if (state.cup) base += 4;
    if (state.pron) base += 6;
    if (state.sup) base += 4;
    if (benchRes.level === 'advanced' || benchRes.level === 'competitive') base += 2;
    return Math.min(22, base);
  }, [state.cup, state.pron, state.sup, benchRes.level, forceHistoryTick]);

  const derivedTable = useMemo(() => {
    try {
      const raw = typeof localStorage !== 'undefined' ? localStorage.getItem('he_arm_last_plan') : null;
      if (raw) {
        const plan = JSON.parse(raw);
        if (plan?.weeks?.length) {
          let totalTable = 0, totalSess = 0;
          for (const wk of plan.weeks) {
            totalTable += wk.sessions.filter((s:any)=> s.tableTime).length;
            totalSess += wk.sessions.length;
          }
          if (totalSess>0) {
            const ratio = totalTable / totalSess;
            const total = 4;
            const table = Math.round(ratio * total);
            return { table: Math.max(0, Math.min(total, table)), total };
          }
        }
      }
    } catch {}
    if (state.technique === 'press') return { table: 2, total: 4 };
    if (state.level === 'beginner') return { table: 1, total: 3 };
    return { table: 2, total: 4 };
  }, [state.technique, state.level, forceHistoryTick]);

  const report = useMemo(() => buildArmDiagnosticsReport({
    weakTest: {
      cupFails: state.cup, risingFails: state.rising, pronationFails: state.pron, supinationFails: state.sup, sidePressureFails: state.side, backPressureFails: state.back,
    },
    weakPoints: state.weakPoints as any,
    angles: { elbowDeg: parseFloat(state.elbowDeg) || 110, wristDeg: parseFloat(state.wristDeg) || 10, forearmDeg: parseFloat(state.forearmDeg) || 90 },
    hasVideo: hasVideoSupport(),
    hasVbt: !!(state.vbtWeight && state.vbtVel),
    hasGripHistory: (()=>{ try{ return loadForceTrials().length>0; } catch{ return false; } })(),
    grip: { rtKg: state.rtKg ? parseFloat(state.rtKg) : undefined, axleKg: state.axleKg ? parseFloat(state.axleKg) : undefined, pinchSec: state.pinchSec ? parseFloat(state.pinchSec) : undefined, sideKg: state.sideKg ? parseFloat(state.sideKg) : undefined, backKg: state.backKg ? parseFloat(state.backKg) : undefined, leftKg: state.leftKg ? parseFloat(state.leftKg) : undefined, rightKg: state.rightKg ? parseFloat(state.rightKg) : undefined } as any,
    vbtRecords: (state.vbtWeight && state.vbtVel) ? (() => {
      const wp0 = (state.weakPoints as any)[0];
      const ex0 = (() => { try { return wp0 ? (ARM_CORRECTIONS as any)[wp0]?.exercises[0] : undefined; } catch { return undefined; } })();
      const mk = (vel: number) => ({ weight: parseFloat(state.vbtWeight), reps: parseInt(state.vbtReps || '5', 10), velocityMs: vel, exerciseId: ex0, weakPoint: wp0 });
      // PRO-3 P1: паритет с vbt-мемо — два реальных замера, иначе оценка best≈ввод+0.2
      const v2raw = parseFloat((state as any).vbtVel2);
      if (Number.isFinite(v2raw) && v2raw > 0) return [mk(parseFloat(state.vbtVel)), mk(v2raw)];
      return [mk(parseFloat(state.vbtVel)), mk(parseFloat(state.vbtVel) + 0.2)];
    })() : [],
    level: state.level,
    technique: state.technique,
    tableSessions: derivedTable.table, totalSessions: derivedTable.total, tendonSets: derivedTendon,
    anglesVerified,
    sex: state.sex,
    weightClass: weightClassAuto,
    bodyWeightKg: bwNum,
    benchLevel: benchRes.level,
  } as any), [state.cup, state.rising, state.pron, state.sup, state.side, state.back, state.weakPoints, state.level, state.technique, state.elbowDeg, state.wristDeg, state.forearmDeg, state.vbtWeight, state.vbtReps, state.vbtVel, (state as any).vbtVel2, state.rtKg, state.axleKg, state.pinchSec, state.sideKg, state.backKg, state.leftKg, state.rightKg, derivedTable, derivedTendon, anglesVerified, weightClassAuto, bwNum, benchRes.level, forceHistoryTick]);

  // ── P0 PRO: план → аудит → причины → топ-3 → Δ → спец-блок → дневник ──
  const armPlan = useMemo(() => {
    try {
      const raw = typeof localStorage !== 'undefined' ? (localStorage.getItem('he_arm_plan_saved') || localStorage.getItem('he_arm_last_plan')) : null;
      if (!raw) return null;
      const j = JSON.parse(raw);
      if (j?.plan?.weeks) return j.plan;
      if (j?.weeks) return j;
      return null;
    } catch { return null; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planNonce, forceHistoryTick]);

  const armAudit = useMemo(() => {
    try { return auditArmPlan(armPlan as any); } catch { return null; }
  }, [armPlan]);

  const armWorst = useMemo(() => {
    try { return worstArmPoint(armPlan as any, state.weakPoints as any); } catch { return null; }
  }, [armPlan, state.weakPoints]);

  const diarySessionsP0 = useMemo(() => {
    try {
      const raw = typeof localStorage !== 'undefined' ? (localStorage.getItem('he_workout_log_v1') || localStorage.getItem('he_training_log') || '[]') : '[]';
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch { return []; }
  }, [forceHistoryTick]);

  const diaryTrendsP0 = useMemo(() => {
    try { return detectArmWeakByE1rm(diarySessionsP0 as any); } catch { return []; }
  }, [diarySessionsP0]);

  const diarySuggestP0 = useMemo(() => {
    try { return armPointsForMuscles(diaryTrendsP0.filter((t) => t.status !== 'ok').map((t) => t.muscle)); } catch { return []; }
  }, [diaryTrendsP0]);

  // ── P1: мобильность (E10), трекинг (E8), авторегуляция/гварды (E11), bilateral (E12) ──
  const armMobility = useMemo(() => assessArmMobility({
    wristFlexOk: mobWristFlex, wristExtOk: mobWristExt, pronOk: mobPron, supOk: mobSup,
    elbowExtOk: mobElbow, reverseRetest: mobRetest,
  }), [mobWristFlex, mobWristExt, mobPron, mobSup, mobElbow, mobRetest]);

  const trackPts = useMemo(() => {
    try { return trackCsv.trim() ? parseArmTrackCsv(trackCsv) : []; } catch { return []; }
  }, [trackCsv]);

  const trackMetrics = useMemo(() => {
    try { return trackPts.length >= 3 ? armPathMetrics(trackPts) : null; } catch { return null; }
  }, [trackPts]);

  const trackType = useMemo(() => {
    try { return trackPts.length >= 3 ? classifyArmTrajectory(trackPts) : null; } catch { return null; }
  }, [trackPts]);

  const trackSrd = useMemo(() => {
    const base = parseFloat(baseXLoop);
    if (!trackMetrics || !Number.isFinite(base)) return null;
    try {
      const real = isArmRealChange({ xLoop: base, yMax: 0, vMax: 0, points: 0 }, trackMetrics);
      const d = Math.abs(trackMetrics.xLoop - base).toFixed(1);
      return real ? `Δ${d} > SRD 4 — реальное изменение` : `Δ${d} ≤ SRD 4 — шум`;
    } catch { return null; }
  }, [trackMetrics, baseXLoop]);

  const autoregP0 = useMemo(() => {
    try {
      const srpe: any[] = loadSRPESessions() as any;
      const days: ArmDiaryDay[] = srpe.slice(-7).map((s: any) => ({
        dateIso: String(s.date || '').slice(0, 10),
        srpe: Number(s.sRPE ?? s.srpe ?? 0),
        velocityLossPct: vbt.velocityLossPct,
      }));
      if (!days.length) return null;
      // D1: ручные боли вешаем на последний день (max-правило движка)
      const pe = parseFloat(painElbow);
      const pw = parseFloat(painWrist);
      const lastD = days[days.length - 1];
      if (Number.isFinite(pe) && pe > 0) lastD.elbowPain = pe;
      if (Number.isFinite(pw) && pw > 0) lastD.wristPain = pw;
      return autoregArmFromDiary(days);
    } catch { return null; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vbt.velocityLossPct, forceHistoryTick, painElbow, painWrist]);

  // TOP wave-10: CNS-индикатор тяжёлых (RPE≥8 за 7 дней) из sRPE
  const cnsHeavyP0 = useMemo(() => {
    try {
      const srpe: any[] = loadSRPESessions() as any;
      const last7 = srpe.slice(-7);
      if (!last7.length) return null;
      const heavy = last7.filter((s: any) => Number(s.sRPE ?? s.srpe ?? 0) >= 8).length;
      return { total: last7.length, heavy };
    } catch { return null; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forceHistoryTick]);

  const guardsP0 = useMemo(() => {
    const empty = { ucl: [] as string[], shoulder: [] as string[], tendon: [] as string[], humerus: [] as string[] };
    if (!armPlan) return empty;
    try {
      return {
        ucl: checkUCLGuard({ weeks: (armPlan as any).weeks, level: state.level } as any),
        shoulder: checkShoulderGuard(armPlan as any),
        tendon: checkTendonGuard({ weeks: (armPlan as any).weeks, level: state.level } as any),
        humerus: checkHumerusGuard(armPlan as any),
      };
    } catch { return empty; }
  }, [armPlan, state.level]);

  const bilatP0 = useMemo(() => {
    try {
      const lk = state.leftKg ? parseFloat(state.leftKg) : undefined;
      const rk = state.rightKg ? parseFloat(state.rightKg) : undefined;
      // R1: база/кап из landmarks уровня (wrist_flexors), а не хардкод 10/18
      const lm = getArmLandmarks(state.level, 'wrist_flexors');
      return planBilateralVolume({ leftKg: lk, rightKg: rk, baseSets: lm.mav, mrvSets: lm.mrv });
    } catch { return null; }
  }, [state.leftKg, state.rightKg, state.level]);

  const bilatHistP0 = useMemo(() => {
    try { return loadBilateralHist(); } catch { return []; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bilatTick]);

  const bilatTrendP0 = useMemo(() => {
    try { return bilateralTrend(bilatHistP0); } catch { return null; }
  }, [bilatHistP0]);

  // ── D2: per-muscle ACWR из дневника; D3: контекст профиля для ранжира ──
  const perMuscleAcwrP0 = useMemo(() => {
    try { return computeArmPerMuscleACWR(diarySessionsP0 as any); } catch { return computeArmPerMuscleACWR([]); }
  }, [diarySessionsP0]);

  const perMuscleAcwrSumP0 = useMemo(() => {
    try { return armAcwrSummary(perMuscleAcwrP0); } catch { return { danger: [] as string[], caution: [] as string[] }; }
  }, [perMuscleAcwrP0]);

  const profileCtxP0 = useMemo(() => {
    try {
      const p = JSON.parse(localStorage.getItem('he_profile_v2') || '{}');
      const eq = p?.settings?.training?.equipment ?? p?.training?.equipment;
      const h = p?.settings?.health?.mobilityRestrictions ?? p?.health?.mobilityRestrictions;
      const t = p?.settings?.training?.mobilityRestrictions ?? p?.training?.mobilityRestrictions;
      return {
        equipment: (Array.isArray(eq) ? eq.map(String).filter(Boolean) : undefined) as string[] | undefined,
        mobility: Array.from(new Set([...(Array.isArray(h) ? h : []), ...(Array.isArray(t) ? t : [])].map(String))),
      };
    } catch { return { equipment: undefined as string[] | undefined, mobility: [] as string[] }; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forceHistoryTick]);

  // D4: журнал попыток помоста
  const attHistP0 = useMemo(() => {
    try { return loadPlatformLog(); } catch { return []; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attTick]);

  // ── P2 E13: помост %WR + попытки; E15: снапшоты замеров ──
  const platformP0 = useMemo(() => {
    const rt = parseFloat(state.rtKg);
    if (!Number.isFinite(rt) || rt <= 0) return null;
    try {
      const res = scorePlatform({ implement: 'rolling_thunder', sex: state.sex, attempts: [{ attempt: 1, weightKg: rt, success: true }] });
      return { ...res, plan: planAttempts(rt) };
    } catch { return null; }
  }, [state.rtKg, state.sex]);

  const [measureTick, setMeasureTick] = useState(0);
  const measureHistP0 = useMemo(() => {
    try { return loadArmMeasureHistory(); } catch { return []; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [measureTick, forceHistoryTick]);

  // E16 P2 + D4: критический side-gate (scoring-floor) ИЛИ фактический humerus-гейт плана
  const criticalSideP0 = useMemo(() => {
    try {
      const hasSide = state.weakPoints.some((p) => p === 'side_mid' || p === 'side_pin');
      if (!hasSide) return false;
      const sc = (report as any)?.scoring;
      if (sc && sc.score <= 49) {
        const floors: string[] = sc.floors || [];
        if (floors.some((f) => /side|humerus/i.test(f))) return true;
      }
      // D4: gate напрямую от плана (работает и без scoring)
      if (guardsP0.humerus.length > 0) return true;
      return false;
    } catch { return false; }
  }, [report, state.weakPoints, guardsP0]);

  const armCausesP0 = useMemo(() => {
    const out: Record<string, ReturnType<typeof diagnoseArmWeakCause>> = {};
    try {
      const hist = armVolumeHistory28d(diarySessionsP0 as any) as Record<string, number[]>;
      for (const wp of state.weakPoints) {
        const bio = ARM_BIOMECH[wp];
        const fact = armAudit?.byPoint?.[wp]?.sets ?? null;
        const m0 = bio?.weakMuscles?.[0];
        const h = (m0 && (hist as any)[m0]) || [];
        const trend = diaryTrendsP0.find((t) => bio?.weakMuscles?.includes(t.muscle));
        const th = vbtThresholdForWeakPoint(wp);
        // D2: худшая ACWR-зона — глобальная vs per-muscle точки
        const gz = acwr ? (acwr.ratio >= 1.5 ? 'danger' : acwr.ratio >= 1.3 ? 'caution' : 'ok') : null;
        const pmz = worstArmAcwrZone(perMuscleAcwrP0, bio?.weakMuscles || []);
        const rankZ = (z: string) => (z === 'danger' || z === 'dangerous' ? 2 : z === 'caution' ? 1 : 0);
        const acwrMerged = [gz, pmz].filter((z): z is string => !!z).sort((a, b) => rankZ(b) - rankZ(a))[0] ?? null;
        // D1: сон; D3: бенч-уровень + side/back vs ref
        const sleepNum = parseFloat(sleepHours);
        const sideRef = Math.max(30, bwNum * 0.6);
        const backRef = Math.max(40, bwNum * 0.8);
        const sideKgNum = parseFloat(state.sideKg);
        const backKgNum = parseFloat(state.backKg);
        const sideR = Number.isFinite(sideKgNum) && sideKgNum > 0 ? sideKgNum / sideRef : null;
        const backR = Number.isFinite(backKgNum) && backKgNum > 0 ? backKgNum / backRef : null;
        const refRatio = wp.startsWith('side_') ? sideR : wp.startsWith('back_') ? backR : (sideR != null && backR != null ? Math.min(sideR, backR) : sideR ?? backR);
        out[wp] = diagnoseArmWeakCause({
          point: wp,
          factSets7d: fact,
          hist28: h.length ? h : fact != null ? [fact] : [],
          e1rmDeltaPct: trend ? trend.deltaPct : null,
          e1rmSessions: trend ? trend.sessions : 0,
          acwrZone: acwrMerged,
          tendonAcwrZone: tendonAcwr ? (tendonAcwr.ratio >= 1.5 ? 'danger' : tendonAcwr.ratio >= 1.3 ? 'caution' : 'ok') : null,
          mobilityFail: mobilityFailForWeakPoint(armMobility.fails, wp),
          vbtLossPct: vbt.velocityLossPct,
          vbtWarnPct: th.warnPct,
          sleepHours: Number.isFinite(sleepNum) ? sleepNum : null,
          benchLevel: benchRes.level,
          sideBackRefRatio: refRatio,
        });
      }
    } catch { /* noop */ }
    return out;
  }, [state.weakPoints, armAudit, diarySessionsP0, diaryTrendsP0, acwr, tendonAcwr, vbt.velocityLossPct, armMobility, perMuscleAcwrP0, sleepHours, benchRes.level, state.sideKg, state.backKg, bwNum]);

  const armTop3P0 = useMemo(() => {
    const out: Record<string, ReturnType<typeof rankCorrectionsForArm>> = {};
    try {
      const inPlan: string[] = [];
      if (armPlan) for (const w of (armPlan as any).weeks || []) for (const s of (w as any).sessions || []) for (const ex of (s as any).exercises || []) if ((ex as any).exerciseId) inPlan.push(String((ex as any).exerciseId));
      for (const wp of state.weakPoints) {
        // D3: оборудование и мобильность из профиля + локальный ROM-тест
        const mobMerged = Array.from(new Set([...(profileCtxP0.mobility || []), ...armMobility.fails]));
        out[wp] = rankCorrectionsForArm(wp, { level: state.level, cause: armCausesP0[wp]?.cause, asymPct: report.asymmetryPct ?? (dynamicReport as any)?.asymmetry?.asymmetryPct ?? null, inPlanIds: inPlan, equipment: profileCtxP0.equipment, mobilityRestrictions: mobMerged });
      }
    } catch { /* noop */ }
    return out;
  }, [state.weakPoints, state.level, armCausesP0, armPlan, report.asymmetryPct, dynamicReport, profileCtxP0, armMobility]);

  const armSpecP0 = useMemo(() => {
    try {
      return buildArmSpecBlock({ weakPoints: state.weakPoints as any, level: state.level, weeks: parseInt(specWeeks) || 6, technique: state.technique });
    } catch { return null; }
  }, [state.weakPoints, state.level, specWeeks, state.technique]);

  const handleInjectP0 = () => {
    const points = state.weakPoints;
    if (!points.length) { setInjectMsg('Выбери 1-3 мёртвые точки — нечего вставлять'); setTimeout(() => setInjectMsg(''), 2500); return; }
    let raw: string | null = null;
    try { raw = localStorage.getItem('he_arm_plan_saved') || localStorage.getItem('he_arm_last_plan'); } catch { /* noop */ }
    if (!raw) { setInjectMsg('Нет плана арм — собери в Арм-конструкторе, потом вставляй'); setTimeout(() => setInjectMsg(''), 2500); return; }
    let parsed: any = null;
    try { parsed = JSON.parse(raw); } catch { setInjectMsg('План в хранилище битый — пересобери'); setTimeout(() => setInjectMsg(''), 2500); return; }
    const plan = parsed?.plan?.weeks ? parsed.plan : parsed?.weeks ? parsed : null;
    if (!plan) { setInjectMsg('План не распознан — пересобери'); setTimeout(() => setInjectMsg(''), 2500); return; }
    try { saveArmPlanPrev(raw); } catch { /* noop */ }
    const idx = (plan.weeks || []).map((_: any, i: number) => i).filter((i: number) => !(plan.weeks[i] as any)?.deload);
    const targetSets: Record<string, number> = {};
    try {
      const sb = buildArmSpecBlock({ weakPoints: points as any, level: state.level, weeks: parseInt(specWeeks) || 6, technique: state.technique });
      const w0 = sb.weeks[0];
      if (w0) for (const p of points) if ((w0.targetSets as any)?.[p] != null) targetSets[p] = (w0.targetSets as any)[p];
    } catch { /* noop */ }
    let working = plan;
    let injected = 0;
    let skipped = 0;
    // E16 P2 + D4: scoring-floor ИЛИ фактический humerus-гейт плана
    const scoringFloors: string[] = ((report as any)?.scoring?.floors || []) as string[];
    const scoringScore: number | null = ((report as any)?.scoring?.score ?? null) as number | null;
    const scoringGate = scoringScore != null && scoringScore <= 49
      && scoringFloors.some((f) => /side|humerus/i.test(f));
    let planGate = false;
    try {
      planGate = checkHumerusGuard(working as any).length > 0;
    } catch { /* noop */ }
    const gatedSide = (scoringGate || planGate) && points.some((p) => p === 'side_mid' || p === 'side_pin');
    try {
      const r = injectArmCorrections(working, points as any, { weekIdxs: idx, targetSets, level: state.level, gatedSideIso: gatedSide });
      working = r.plan;
      injected = r.injected;
      skipped = r.skippedBudget + r.skippedDup + r.skippedHumerus;
    } catch { /* noop */ }
    if (!injected) { setInjectMsg(`⊘ Не вставлено (скипов: ${skipped} — бюджет/дубли/humerus)`); setTimeout(() => setInjectMsg(''), 3000); return; }
    try {
      working.rationale = [...(working.rationale || []), `Арм-диагностика P0: инъекция (${points.join(', ')})`];
      const payload = JSON.stringify(parsed?.plan?.weeks ? { ...parsed, plan: working } : working);
      localStorage.setItem('he_arm_plan_saved', payload);
      try { localStorage.setItem('he_arm_last_plan', payload); } catch { /* noop */ }
    } catch { setInjectMsg('Не влезло в хранилище — очисти старые планы'); setTimeout(() => setInjectMsg(''), 2500); return; }
    setHasInjectPrev(true);
    setPlanNonce((n) => n + 1);
    try { window.dispatchEvent(new Event('he-arm-plan-saved')); } catch { /* noop */ }
    setInjectMsg(`✓ Вставлено коррекций: ${injected} (нед: ${(plan.weeks || []).length})${gatedSide ? ' · 🔴 side gated: только ремень/изометрия' : ''}`);
    setTimeout(() => setInjectMsg(''), 3000);
  };

  const handleRollbackP0 = () => {
    try {
      const prev = loadArmPlanPrev();
      if (!prev) return;
      localStorage.setItem('he_arm_plan_saved', prev);
      try { localStorage.setItem('he_arm_last_plan', prev); } catch { /* noop */ }
      clearArmPlanPrev();
    } catch { /* noop */ }
    setHasInjectPrev(false);
    setPlanNonce((n) => n + 1);
    try { window.dispatchEvent(new Event('he-arm-plan-saved')); } catch { /* noop */ }
    setInjectMsg('↩ План восстановлен до инъекции');
    setTimeout(() => setInjectMsg(''), 2500);
  };

  // ── P2 E14: экспорт HTML/CSV ──
  const exportDataP0 = () => {
    const scoring = (report as any).scoring as { score: number; level: string; verification: number; floors: string[] } | undefined;
    return {
      date: new Date().toISOString().slice(0, 10),
      level: state.level,
      technique: state.technique,
      score: scoring?.score ?? null,
      scoreLevel: scoring?.level ?? null,
      verificationPct: scoring ? Math.round(scoring.verification * 100) : null,
      floors: scoring?.floors ?? [],
      asymmetryPct: report.asymmetryPct ?? null,
      forceTotal: forceVecPro.totalScore ?? null,
      dynamicTactic: (dynamicReport as any)?.tactic ?? null,
      acwr: acwr?.ratio ?? null,
      tendonAcwr: tendonAcwr?.ratio ?? null,
      points: state.weakPoints.map((wp) => {
        const card = ((diag as any).biomechCards || []).find((c: any) => c.weakPoint === wp);
        const cause = (armCausesP0 as any)[wp];
        const top = ((armTop3P0 as any)[wp] || []).map((t: any) => ({ id: t.id, score: t.score }));
        let sim: string | undefined;
        try { sim = simulateArmInjection(armPlan as any, wp)?.summary; } catch { /* noop */ }
        let spec1: number | undefined;
        try { spec1 = armSpecP0?.weeks[0]?.targetSets[wp]; } catch { /* noop */ }
        return {
          weakPoint: wp,
          label: card?.label || wp,
          angleRangeDeg: card?.angleRangeDeg,
          keyJoint: card?.keyJoint,
          cause: cause ? `${cause.cause} (${Math.round(cause.confidence * 100)}%)` : undefined,
          causeFix: cause?.fix,
          topCorrections: top,
          simDelta: sim,
          specSetsWeek1: spec1,
        };
      }),
      injectionNotes: (report as any).corrections?.map((c: any) => `${c.weakPoint} → ${c.exercises[0]} @${Math.round(c.intensityPct * 100)}% в ${c.dayTags[0]}`),
      // TOP wave-10: матчап + Table-IQ + rehab в экспорт
      matchup: (() => { try {
        if (muState.opp === 'unknown' && !muState.wd) return null;
        const mp = profileOpponent({ myTechnique: state.technique, oppStyle: muState.opp, oppHand: muState.hand, weightDeltaKg: parseFloat(muState.wd) || 0 });
        return { note: mp.note, priority: mp.priorityMuscles.slice(0, 3), gameplan: mp.gameplan.slice(0, 2) };
      } catch { return null; } })(),
      tableIq: (() => { try {
        if (!tiq.length) return null;
        const iq = analyzeTableIq({ bouts: tiq });
        return { note: iq.note, levers: iq.levers, trend: tableIqTrend(tiq).note };
      } catch { return null; } })(),
      rehab: (() => { try {
        if (rhInjury === 'none') return null;
        const rh = buildRehabPlan({ injury: rhInjury, weeksSince: parseFloat(rhWeeks) || 0, pain: parseFloat(rhPain) || 0, surgery: rhSurg });
        return { note: rh.note, phase: rh.phase, title: rh.current.title };
      } catch { return null; } })(),
      // PRO-3 P4: red-flags в экспорт
      redFlags: (() => { try { return redFlagLabels(loadRedFlags()); } catch { return []; } })(),
    };
  };

  const handleExportHtmlP0 = () => {
    try {
      downloadArmFile(`arm-diagnostics-${new Date().toISOString().slice(0, 10)}.html`, buildArmDiagnosticsHtml(exportDataP0() as any), 'text/html');
      setInjectMsg('✓ HTML экспорт (точки + причины + топ-3 + Δ)');
      setTimeout(() => setInjectMsg(''), 2500);
    } catch { /* noop */ }
  };

  const handleExportCsvP0 = () => {
    try {
      downloadArmFile(`arm-diagnostics-${new Date().toISOString().slice(0, 10)}.csv`, buildArmDiagnosticsCsv(exportDataP0() as any), 'text/csv');
      setInjectMsg('✓ CSV экспорт');
      setTimeout(() => setInjectMsg(''), 2500);
    } catch { /* noop */ }
  };

  const handlePrintP0 = () => {
    try {
      const html = buildArmDiagnosticsHtml(exportDataP0() as any);
      const w = window.open('', '_blank');
      if (!w) { setInjectMsg('⚠ Всплывающие окна заблокированы — используй 🖨 HTML'); setTimeout(() => setInjectMsg(''), 2500); return; }
      w.document.write(html);
      w.document.close();
      w.focus();
      w.print();
    } catch { /* noop */ }
  };

  const mockGuard = useMemo(() => {
    // превью гвардов учитывает и чипы 12 точек, а не только legacy-чекбоксы (паритет с движком отчёта)
    const sideOn = state.side || state.weakPoints.some(wp => wp === 'side_mid' || wp === 'side_pin');
    const pronOn = state.pron || state.weakPoints.some(wp => wp === 'pron_open' || wp === 'pron_lock');
    const supOn = state.sup || state.weakPoints.some(wp => wp === 'sup_cup' || wp === 'sup_drag');
    const mockPlan: any = {
      weeks: [
        { week: 1, sessions: [{ exercises: [{ muscle: 'side_pressure', sets: sideOn ? 8 : 3 }] }] },
        { week: 2, sessions: [{ exercises: [{ muscle: 'side_pressure', sets: sideOn ? 8 : 3 }] }] },
      ],
    };
    return {
      humerus: checkHumerusGuard(mockPlan),
      balance: checkWristBalance({ weeks: [{ sessions: [{ exercises: [{ muscle: 'pronators', sets: pronOn ? 6 : 4 }, { muscle: 'supinators', sets: supOn ? 2 : 4 }] }] }] } as any),
    };
  }, [state.side, state.pron, state.sup, state.weakPoints]);

  const landmarks = useMemo(() => {
    const lvl = state.level as any;
    return {
      wrist: getArmLandmarks(lvl, 'wrist_flexors'),
      pron: getArmLandmarks(lvl, 'pronators'),
      side: getArmLandmarks(lvl, 'side_pressure'),
      grip: getArmLandmarks(lvl, 'grip_support'),
    };
  }, [state.level]);

  const toggleWeakPoint = (wp: ArmWeakPoint) => {
    try { void haptics('light'); } catch { /* no-op */ }
    // PRO-3 P6: 4-я точка вслух (раньше slice молча отбрасывал)
    if (!state.weakPoints.includes(wp) && state.weakPoints.length >= 3) {
      setToast(`Взяты первые 3 (${state.weakPoints.join(', ')}) — ${wp} вне топ-3: убери одну точку, чтобы добавить`);
      setTimeout(() => setToast(''), 3000);
      return;
    }
    setState(s => {
      const has = s.weakPoints.includes(wp);
      let next = has ? s.weakPoints.filter(x=>x!==wp) : [...s.weakPoints, wp].slice(0,3) as ArmWeakPoint[];
      // keep 3 max (parity TA/BB)
      if (!has && next.length>3) next = next.slice(0,3);
      return { ...s, weakPoints: next };
    });
  };
  const clearWeakPoints = () => setState(s=> ({...s, weakPoints: []}));

  const applyToConstructor = () => {
    const groups = diag.weakMuscles.slice(0, 2);
    const extra = (dynamicReport as any)?.metrics ? Object.entries((dynamicReport as any).metrics).filter(([_, v]: any)=> v && v.fMax < 30).map(([k])=> k==='finger_flex'?'risers': k==='hammer'?'brachialis':k==='hook'?'supinators':'wrist_flexors') : [];
    const finalGroups = groups.length ? groups : extra.slice(0,2);
    const weakPoints = (diag as any).weakPoints as ArmWeakPoint[] | undefined;
    const hasPoints = weakPoints && weakPoints.length>0;
    if (finalGroups.length === 0 && !hasPoints) {
      setToast('Слабые зоны не выявлены — выбери мёртвые точки или провалы/4 теста силы');
      setTimeout(() => setToast(''), 2500);
      return;
    }
    const toApply = finalGroups.length ? finalGroups : groups;
    // R1: payload через чистый билдер (база + причины/топ/spec/мобильность/ACWR/bilateral/попытки)
    const payload: any = buildArmBridgeData({
      groups: toApply,
      technique: state.technique,
      weakPoints: weakPoints || [],
      biomechCards: (diag as any).biomechCards || [],
      corrections: (report as any).corrections || [],
      scoring: (report as any).scoring,
      diag: state,
      angles,
      force: forceVecPro,
      vbt,
      dynamic: dynamicReport,
      bench: benchRes,
      tendon: derivedTendon,
      findings: report.findings,
      humerus: report.humerusWarnings,
      balance: report.balanceWarnings,
      asymmetry: report.asymmetryPct,
      info: report.info,
      weakCauses: armCausesP0 as any,
      topByPoint: armTop3P0 as any,
      spec: armSpecP0 as any,
      mobilityFails: armMobility.fails,
      acwrDanger: perMuscleAcwrSumP0.danger,
      bilateral: bilatP0 ? { weakArm: bilatP0.weakArm, weakSets: bilatP0.weakSets, strongSets: bilatP0.strongSets } : null,
      attempts: attHistP0,
      // PRO-3 P4: red-flags скрининга — в конструктор
      redFlags: (() => { try { return loadRedFlags(); } catch { return []; } })(),
    });
    // TOP: матчап + Table-IQ едут в конструктор тем же payload (аддитивно)
    try {
      (payload as any).armMatchup = { oppStyle: muState.opp, oppHand: muState.hand, weightDeltaKg: parseFloat(muState.wd) || 0 };
      if (tiq.length) (payload as any).armBouts = tiq;
      // TOP wave-13: профиль (L/R, вес, RT) + динамика → RFD
      const lp = parseFloat(state.leftKg);
      const rp = parseFloat(state.rightKg);
      const bw = parseFloat(state.bwKg);
      const rt = parseFloat(state.rtKg);
      if ((Number.isFinite(lp) && lp > 0) || (Number.isFinite(rp) && rp > 0) || (Number.isFinite(bw) && bw > 0) || (Number.isFinite(rt) && rt > 0)) {
        (payload as any).armProfile = {
          ...(Number.isFinite(lp) && lp > 0 ? { leftKg: lp } : {}),
          ...(Number.isFinite(rp) && rp > 0 ? { rightKg: rp } : {}),
          ...(Number.isFinite(bw) && bw > 0 ? { bwKg: bw } : {}),
          ...(Number.isFinite(rt) && rt > 0 ? { rtKg: rt } : {}),
        };
      }
      try {
        const mets = Object.values(((dynamicReport as any)?.metrics || {})) as any[];
        const expl = mets.filter((m) => m && Number.isFinite(Number(m.explosivePct))).map((m) => Number(m.explosivePct));
        if (expl.length) (payload as any).armRfd = { explosivePct: Math.round((expl.reduce((a, b) => a + b, 0) / expl.length) * 10) / 10 };
      } catch {}
      // PRO-5 №5: humerus-чеклист → ось/warmup моста (только затронутый чеклист)
      try {
        const hb = readHumerusBridge((k) => { try { return typeof localStorage !== 'undefined' ? localStorage.getItem(k) : null; } catch { return null; } });
        if (hb) {
          if (hb.armAxisCheck) (payload as any).armAxisCheck = hb.armAxisCheck;
          if (hb.armWarmupDone === true) (payload as any).armWarmupDone = true;
        }
      } catch {}
    } catch {}
    applyToPlanner({
      kind: 'weakpoints',
      label: `Арм диагностика: ${(weakPoints && weakPoints.length? weakPoints.join(',') : toApply.join(','))}`,
      data: payload,
      source: 'intellectual',
    });
    const label = hasPoints ? weakPoints!.join(', ') : toApply.map((g:any)=> ARM_MUSCLE_RU[g as any]||g).join(', ');
    setToast(`✓ Применено в Арм-конструктор: ${label} ${hasPoints? `(${(diag as any).biomechCards?.length||0} коррекций)` : ''}`);
    setTimeout(() => setToast(''), 3000);
    try {
      window.dispatchEvent(new CustomEvent('planning-track-open', { detail: 'arm' } as any));
      localStorage.setItem('he_training_planning_track', 'arm');
    } catch {}
  };

  const handleAddTrialsToHistory = () => {
    if (!dynamicTrials.length) { setToast('Заполни 4 теста: кг и мс'); setTimeout(()=>setToast(''),2000); return; }
    for (const t of dynamicTrials) {
      if ((t as any).hand) continue; // asymmetry duplicates skip
      addForceTrial({ exercise: t.exercise as any, forceKg: t.forceKg, timeMs: t.timeMs, bwKg: bwNum, dateIso: new Date().toISOString().slice(0,10) });
    }
    setForceHistoryTick(x=>x+1);
    setToast(`✓ Сохранено ${dynamicTrials.filter((t:any)=>!t.hand).length} trials в историю (avg/max/min график)`);
    setTimeout(()=>setToast(''),2500);
  };

  // legacy-чекбокс зеркалится в чипы 12 точек (единый видимый выбор): вкл — добавляет развёртку (до 3), выкл — убирает её
  const toggleLegacy = (k: 'cup' | 'rising' | 'pron' | 'sup' | 'side' | 'back') => {
    try { void haptics('light'); } catch { /* no-op */ }
    // PRO-3 P6: молча отброшенные развёртки — вслух
    if (!(state as any)[k]) {
      const legacyKey = k === 'pron' ? 'pronation' : k === 'sup' ? 'supination' : k;
      const expanded = LEGACY_TO_DETAILED[legacyKey] || [];
      const fresh = expanded.filter((p) => !state.weakPoints.includes(p));
      const room = 3 - state.weakPoints.length;
      if (fresh.length > room) {
        const dropped = fresh.slice(Math.max(0, room));
        setToast(`Взяты первые 3 — вне топ-3: ${dropped.join(', ')} (убери точку, чтобы добавить)`);
        setTimeout(() => setToast(''), 3000);
      }
    }
    setState(s => {
    const turningOn = !(s as any)[k];
    const legacyKey = k === 'pron' ? 'pronation' : k === 'sup' ? 'supination' : k;
    const expanded = LEGACY_TO_DETAILED[legacyKey] || [];
    let wp = [...s.weakPoints];
    if (turningOn) {
      for (const p of expanded) if (!wp.includes(p)) wp.push(p);
      wp = wp.slice(0, 3);
    } else {
      wp = wp.filter(p => !expanded.includes(p));
    }
    return { ...s, [k]: turningOn, weakPoints: wp } as ArmDiagState;
    });
  };

  const tablePreview = Array.from({ length: 6 }, (_, i) => {
    const wk = i + 1;
    const kind = tableWeekKind(wk, 12);
    return { wk, kind };
  });

   // нейтральный заголовок + scoring оверлей (PRO, как TA)
  const hasWeak = report.weakMuscles.length > 0 || (state.weakPoints.length>0);
  const scoring = (report as any).scoring as ReturnType<typeof scoreArm> | undefined;
  const showScoring = !!scoring && (scoring.verification>0 || scoring.floors.length>0);

  // Video handler stub — при загрузке файла парсим как landmarks
  const handleVideoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setToast('📹 Видео загружено — парсим углы (BlazePose stub: используем ручные ползунки, модель — отдельный эпик)');
    setTimeout(()=>setToast(''), 3000);
    // реальная модель требует @mediapipe/hands + canvas — оставляем ручной fallback, но помечаем verified
    // симуляция: считываем как текст json с landmarks если есть
    try {
      const text = await file.text();
      if (text.includes('shoulder')) {
        const lm = JSON.parse(text);
        const frame = estimateAnglesFromLandmarks(lm);
        if (frame.elbowDeg) setState(s=> ({ ...s, elbowDeg: String(frame.elbowDeg), forearmDeg: String(frame.forearmDeg), wristDeg: String(frame.wristDeg), direction: (frame.direction as any) || s.direction }));
        setToast('✓ Углы из landmarks применены');
      }
    } catch {}
  };

  // Camera: getUserMedia + Hands pipeline (механизм-ориентированная)
  useEffect(() => {
    if (!showCam) {
      if (streamRef.current) { streamRef.current.getTracks().forEach(t=>t.stop()); streamRef.current=null; }
      if (handsRef.current) { try { handsRef.current.stop(); } catch {} handsRef.current=null; }
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const stream = await (navigator.mediaDevices as any)?.getUserMedia?.({ video: { facingMode: 'user' } });
        if (!stream || cancelled) return;
        streamRef.current = stream;
        if (videoRef.current) { (videoRef.current as any).srcObject = stream; try { await videoRef.current.play(); } catch {} }
        const hasHands = await ensureHandsModel().catch(()=>false);
        if (!cancelled && hasHands && videoRef.current) {
          // запуск Hands loop — углы обновляются live
          const proc = createHandsProcessor(videoRef.current, (frame) => {
            if (cancelled) return;
            // обновляем ползунки live (факт, без риска)
            setState(s => ({ ...s,
              elbowDeg: String(frame.elbowDeg ?? s.elbowDeg),
              forearmDeg: String(frame.forearmDeg ?? s.forearmDeg),
              wristDeg: String(frame.wristDeg ?? s.wristDeg),
              direction: (frame.direction as any) ?? s.direction,
            }));
          });
          if (proc) handsRef.current = proc;
        }
        setToast(hasHands ? '📹 Камера + Hands модель загружена — углы live' : '📹 Камера включена — Hands CDN не загружен, fallback ползунки');
        setTimeout(()=>setToast(''),2500);
      } catch (e:any) {
        setToast(`⚠ Камера недоступна: ${e?.message || e}`);
        setTimeout(()=>setToast(''),3000);
        setShowCam(false);
      }
    })();
    return () => { cancelled = true; if (streamRef.current) { streamRef.current.getTracks().forEach(t=>t.stop()); streamRef.current=null; } if (handsRef.current) { try { handsRef.current.stop(); } catch {} handsRef.current=null; } };
  }, [showCam]);

  // Презентационный контекст для arm-hub-tabs/panels (вычислено выше, тела 1-в-1).
  const setMob = (key: string, v: boolean) => {
    const map: Record<string, (b: boolean) => void> = { mobWristFlex: setMobWristFlex, mobWristExt: setMobWristExt, mobPron: setMobPron, mobSup: setMobSup, mobElbow: setMobElbow };
    map[key]?.(v);
  };
  const mob = { mobWristFlex, mobWristExt, mobPron, mobSup, mobElbow };
  const rh = { injury: rhInjury, weeks: rhWeeks, pain: rhPain, surg: rhSurg };
  const setRh = (p: { injury?: string; weeks?: string; pain?: string; surg?: boolean }) => {
    if (p.injury !== undefined) setRhInjury(p.injury);
    if (p.weeks !== undefined) setRhWeeks(p.weeks);
    if (p.pain !== undefined) setRhPain(p.pain);
    if (p.surg !== undefined) setRhSurg(p.surg);
  };
  const undoTiqBout = () => { setTiq((prev)=>{ const next=prev.slice(0,-1); saveTiq(next); return next; }); };
  const clearTiqBouts = () => { setTiq([]); saveTiq([]); };
  // PRO-3 P5: полный рестор сценария — замена журнала схваток целиком
  const saveTiqAll = (bouts: TiqBout[]) => { const clean = Array.isArray(bouts) ? bouts.filter((b) => b && typeof b === 'object').slice(0, 60) : []; setTiq(clean); saveTiq(clean); };
  const onSaveBilat = () => { const lk = parseFloat(state.leftKg); const rk = parseFloat(state.rightKg); if (Number.isFinite(lk) && Number.isFinite(rk) && lk > 0 && rk > 0) { saveBilateralEntry(lk, rk); setBilatTick((x) => x + 1); } };
  const onResetDynamic = () => { const s = { fingerKg:'',fingerMs:'',hammerKg:'',hammerMs:'',hookKg:'',hookMs:'',cupKg:'',cupMs:'' }; setState(prev=> ({...prev, ...s})); };
  const onMobToProfile = () => { const s = applyArmMobilityToProfile(armMobility.restrictions); setMobMsg(`✓ Мобильность ${s} → профиль`); setTimeout(() => setMobMsg(''), 2500); };
  const setTrackCsvClear = () => setTrackCsv('');
  const H: any = {
    state, setState, report, diag, angles, angleValid, anglesVerified, recAngles, autoPoint,
    hasWeak, scoring, showScoring, weightClassAuto, benchRes, forceVecPro, toast, bwNum,
    applyToConstructor, tab, setTab, toggleWeakPoint, clearWeakPoints, toggleLegacy,
    handleVideoFile, showCam, setShowCam, videoRef,
    trackCsv, setTrackCsv, setTrackCsvClear, trackMetrics, trackType, trackSrd, setBaseXLoop,
    platformP0, measureHistP0, setMeasureTick,
    attKg, setAttKg, attOk, setAttOk, setAttTick, attHistP0,
    vbt, vbtThP0, vbtThresholdForWeakPoint,
    mockGuard, tablePreview,
    muState, setMuState, saveMu,
    tiq, tiqFouls, setTiqFouls, tiqWin, setTiqWin, tiqSlip, setTiqSlip, tiqStrap, setTiqStrap,
    tiqCenter, setTiqCenter, tiqFinish, setTiqFinish, addTiqBout, undoTiqBout, clearTiqBouts, setTiq, saveTiqAll,
    dynamicReport, bilatP0, bilatTrendP0, bilatHistP0, onSaveBilat,
    handleAddTrialsToHistory, onResetDynamic, forceHistory,
    acwr, tendonAcwr, landmarks, tendonWeeklyLimit, perMuscleAcwrSumP0,
    armMobility, mob, setMob, mobRetest, setMobRetest, onMobToProfile, mobMsg,
    painElbow, setPainElbow, painWrist, setPainWrist, sleepHours, setSleepHours,
    autoregP0, cnsHeavyP0, guardsP0, armPlan,
    rh, setRh, buildRehabPlanFn: buildRehabPlan, scoreLabel,
    specWeeks, setSpecWeeks, armAudit, armWorst, armCausesP0, armTop3P0, armSpecP0,
    diaryTrendsP0, diarySuggestP0,
    handleInjectP0, hasInjectPrev, handleRollbackP0, handleExportHtmlP0, handlePrintP0, handleExportCsvP0,
    injectMsg, criticalSideP0,
  };

  return (
    <AdRoot rootClass="train-armdiag" maxWidth={860}>
      <HubHead H={H} />

      <AdCard>
        <HubControls H={H} />

        {/* Tab content — key remount даёт enter-переход панели */}
        <div key={tab} className="ad-tabpanel" data-arm="hub-tabpanel">
          {tab==='grip' && <HubGripTab H={H} />}

          {tab==='strength' && <HubStrengthTab H={H} />}

          {tab==='wrist' && <HubWristTab H={H} />}

          {tab==='pressure' && <HubPressureTab H={H} />}

          {tab==='recovery' && <HubRecoveryTab H={H} />}
          {tab==='recovery' && (
            <div style={{ marginTop: 8 }} data-arm="ortho-screen">
              <OrthoScreenCard compact />
            </div>
          )}
        </div>
        <HubTabNext H={H} />
      </AdCard>

      <HubOutput H={H} />

      <HubP0Panel H={H} />

      <HubScenarios H={H} />

      <HubAction H={H} />
    </AdRoot>
  );
};

export default ArmDiagnosticsHub;
