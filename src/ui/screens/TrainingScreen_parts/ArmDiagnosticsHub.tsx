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
import { estimateForceVector, getRtWorldClass } from '../../../engines/arm/arm-force-capture.engine';
import { diagnoseVbt } from '../../../engines/arm/arm-vbt-capture.engine';
import { buildDynamicReport } from '../../../engines/arm/arm-dynamic-force.engine';
import { loadForceTrials, addForceTrial, buildWeeklyStats, fatigueTrend, forceTrend } from '../../../engines/arm/arm-force-history.store';
import { resolveArmLevelByTests, wafWeightClassFor, benchAdviceForLevel } from '../../../engines/arm/arm-benchmarks.engine';
import { ARM_MUSCLE_RU } from '../../../engines/arm/arm-types';
import { applyToPlanner } from './planner-bridge';
import { CARD, DIM, ACCENT } from './training-ui';
import { ARM_BIOMECH, type ArmWeakPoint, isArmWeakPoint, isValidAngleForArmWeakPoint, angleJointForWeakPoint, vbtThresholdForWeakPoint, phaseForArmAngle } from '../../../engines/arm/arm-biomechanics.engine';
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
import { autoregArmFromDiary } from '../../../engines/arm/arm-diary-autoreg.engine';
import { checkUCLGuard, checkShoulderGuard, checkTendonGuard } from '../../../engines/arm/arm-injury-guard.engine';
import { planBilateralVolume, loadBilateralHist, saveBilateralEntry, bilateralTrend } from '../../../engines/arm/arm-bilateral.engine';
import { scorePlatform, planAttempts } from '../../../engines/arm/arm-platform.engine';
import { buildArmDiagnosticsHtml, buildArmDiagnosticsCsv, downloadArmFile } from '../../../engines/arm/arm-diagnostics-export.engine';
import { loadArmMeasureHistory, saveArmMeasureSnapshot } from '../../../engines/arm/arm-force-history.store';
import { scoreArm, scoreColor, scoreLabel } from '../../../engines/arm/arm-scoring.engine';
import { loadSRPESessions } from '../../../engines/pro/srpe-store';
import { toDailyLoads, acuteChronicRatio } from '../../../engines/pro/training-load.engine';
import { haptics, isOnline } from '../../../core/native-bridge';

const STORAGE_KEY = 'he_arm_diagnostics_hub_v4';

type HubTab = 'grip' | 'wrist' | 'pressure' | 'strength' | 'recovery';

type ArmDiagState = {
  rtKg: string;
  axleKg: string;
  pinchSec: string;
  sideKg: string;
  backKg: string;
  leftKg: string;
  rightKg: string;
  bwKg: string;
  sex: string;
  weightClass: string;
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
  rtKg: '', axleKg: '', pinchSec: '', sideKg: '', backKg: '', leftKg: '', rightKg: '', bwKg: '80', sex: 'male', weightClass: '',
  cup: false, rising: false, pron: false, sup: false, side: false, back: false, weakPoints: [],
  technique: 'balanced', level: 'intermediate',
  elbowDeg: '110', forearmDeg: '90', wristDeg: '10', direction: 'to_middle',
  vbtWeight: '', vbtReps: '', vbtVel: '',
  fingerKg: '', fingerMs: '', hammerKg: '', hammerMs: '', hookKg: '', hookMs: '', cupKg: '', cupMs: '',
  wristCurlLb: '', pronHoldSec: '', cupHoldSec: '', cocLevel: '',
};

const LEVEL_OPTS = [
  { id: 'beginner', label: 'Новичок' },
  { id: 'intermediate', label: 'Средний' },
  { id: 'advanced', label: 'Продвинутый' },
  { id: 'enhanced', label: 'Enhanced' },
];

const TAB_DEFS: Array<{ id: HubTab; label: string; icon: string; desc: string }> = [
  { id: 'grip', label: 'Хват', icon: '✊', desc: 'RT/Axle/Pinch + WR 130.5/77.2' },
  { id: 'wrist', label: 'Кисть/Ротация', icon: '🤚', desc: '12 мёртвых точек + РУ/РА + VBT' },
  { id: 'pressure', label: 'Давление', icon: '💥', desc: 'Side/Back + humerus + table 3/2/1' },
  { id: 'strength', label: 'Сила', icon: '⚡', desc: 'F/t F100/F500 + асимметрия + бенчмарки' },
  { id: 'recovery', label: 'Сухожилие/Восстановление', icon: '🛡️', desc: 'Tendon + ACWR + fatigue' },
];

const WEAK_GROUPS: Array<{ title: string; points: ArmWeakPoint[] }> = [
  { title: 'Кисть', points: ['cup_start','cup_hold','rising_top','contain_fingers'] },
  { title: 'Ротация', points: ['pron_open','pron_lock','sup_cup','sup_drag'] },
  { title: 'Давление', points: ['side_mid','side_pin','back_start','back_drag'] },
];

const WP_LABEL_SHORT: Record<ArmWeakPoint,string> = {
  cup_start: 'Cup старт', cup_hold: 'Cup hold', rising_top: 'Rising', pron_open: 'Pron откр', pron_lock: 'Pron lock',
  sup_cup: 'Sup cup', sup_drag: 'Sup drag', side_mid: 'Side mid', side_pin: 'Side pin', back_start: 'Back старт', back_drag: 'Back drag', contain_fingers: 'Пальцы',
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
  const [specWeeks, setSpecWeeks] = useState('6');
  const [injectMsg, setInjectMsg] = useState('');
  const [planNonce, setPlanNonce] = useState(0);
  const [hasInjectPrev, setHasInjectPrev] = useState<boolean>(() => {
    try { return !!localStorage.getItem('he_arm_plan_saved_prev'); } catch { return false; }
  });
  const [bilatTick, setBilatTick] = useState(0);
  const [trackCsv, setTrackCsv] = useState('');
  const [baseXLoop, setBaseXLoop] = useState<string>(() => {
    try { return localStorage.getItem('he_arm_track_base') || ''; } catch { return ''; }
  });
  const [mobWristFlex, setMobWristFlex] = useState(true);
  const [mobWristExt, setMobWristExt] = useState(true);
  const [mobPron, setMobPron] = useState(true);
  const [mobSup, setMobSup] = useState(true);
  const [mobElbow, setMobElbow] = useState(true);
  const [mobRetest, setMobRetest] = useState<'' | 'better' | 'same'>('');
  const [mobMsg, setMobMsg] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const handsRef = useRef<{ stop: () => void } | null>(null);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
  }, [state]);

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
  const weightClassAuto = state.weightClass || wafWeightClassFor(bwNum);

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
    return diagnoseVbt([
      { weight: w, reps: r, velocityMs: v + 0.2, exerciseId: ex0, weakPoint: wp0 } as any,
      { weight: w, reps: r, velocityMs: v, exerciseId: ex0, weakPoint: wp0 } as any,
    ]);
  }, [state.vbtWeight, state.vbtReps, state.vbtVel, state.weakPoints]);

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
  } as any), [state.cup, state.rising, state.pron, state.sup, state.side, state.back, state.weakPoints, state.level, state.technique, state.elbowDeg, state.wristDeg, state.forearmDeg, state.vbtWeight, state.vbtReps, state.vbtVel, state.rtKg, state.axleKg, state.pinchSec, state.sideKg, state.backKg, state.leftKg, state.rightKg, derivedTable, derivedTendon, anglesVerified, weightClassAuto, bwNum, benchRes.level, forceHistoryTick]);

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
      const days = srpe.slice(-7).map((s: any) => ({
        dateIso: String(s.date || '').slice(0, 10),
        srpe: Number(s.sRPE ?? s.srpe ?? 0),
        velocityLossPct: vbt.velocityLossPct,
      }));
      if (!days.length) return null;
      return autoregArmFromDiary(days);
    } catch { return null; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vbt.velocityLossPct, forceHistoryTick]);

  const guardsP0 = useMemo(() => {
    if (!armPlan) return { ucl: [] as string[], shoulder: [] as string[], tendon: [] as string[] };
    try {
      return {
        ucl: checkUCLGuard({ weeks: (armPlan as any).weeks, level: state.level } as any),
        shoulder: checkShoulderGuard(armPlan as any),
        tendon: checkTendonGuard({ weeks: (armPlan as any).weeks, level: state.level } as any),
      };
    } catch { return { ucl: [] as string[], shoulder: [] as string[], tendon: [] as string[] }; }
  }, [armPlan, state.level]);

  const bilatP0 = useMemo(() => {
    try {
      const lk = state.leftKg ? parseFloat(state.leftKg) : undefined;
      const rk = state.rightKg ? parseFloat(state.rightKg) : undefined;
      return planBilateralVolume({ leftKg: lk, rightKg: rk, baseSets: 10, mrvSets: 18 });
    } catch { return null; }
  }, [state.leftKg, state.rightKg]);

  const bilatHistP0 = useMemo(() => {
    try { return loadBilateralHist(); } catch { return []; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bilatTick]);

  const bilatTrendP0 = useMemo(() => {
    try { return bilateralTrend(bilatHistP0); } catch { return null; }
  }, [bilatHistP0]);

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

  // E16 P2: критический side-gate активен?
  const criticalSideP0 = useMemo(() => {
    try {
      const sc = (report as any)?.scoring;
      if (!sc || sc.score > 49) return false;
      const floors: string[] = sc.floors || [];
      return floors.some((f) => /side|humerus/i.test(f)) && state.weakPoints.some((p) => p === 'side_mid' || p === 'side_pin');
    } catch { return false; }
  }, [report, state.weakPoints]);

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
        out[wp] = diagnoseArmWeakCause({
          point: wp,
          factSets7d: fact,
          hist28: h.length ? h : fact != null ? [fact] : [],
          e1rmDeltaPct: trend ? trend.deltaPct : null,
          e1rmSessions: trend ? trend.sessions : 0,
          acwrZone: acwr ? (acwr.ratio >= 1.5 ? 'danger' : acwr.ratio >= 1.3 ? 'caution' : 'ok') : null,
          tendonAcwrZone: tendonAcwr ? (tendonAcwr.ratio >= 1.5 ? 'danger' : tendonAcwr.ratio >= 1.3 ? 'caution' : 'ok') : null,
          mobilityFail: mobilityFailForWeakPoint(armMobility.fails, wp),
          vbtLossPct: vbt.velocityLossPct,
          vbtWarnPct: th.warnPct,
        });
      }
    } catch { /* noop */ }
    return out;
  }, [state.weakPoints, armAudit, diarySessionsP0, diaryTrendsP0, acwr, tendonAcwr, vbt.velocityLossPct, armMobility]);

  const armTop3P0 = useMemo(() => {
    const out: Record<string, ReturnType<typeof rankCorrectionsForArm>> = {};
    try {
      const inPlan: string[] = [];
      if (armPlan) for (const w of (armPlan as any).weeks || []) for (const s of (w as any).sessions || []) for (const ex of (s as any).exercises || []) if ((ex as any).exerciseId) inPlan.push(String((ex as any).exerciseId));
      for (const wp of state.weakPoints) {
        out[wp] = rankCorrectionsForArm(wp, { level: state.level, cause: armCausesP0[wp]?.cause, asymPct: report.asymmetryPct ?? (dynamicReport as any)?.asymmetry?.asymmetryPct ?? null, inPlanIds: inPlan });
      }
    } catch { /* noop */ }
    return out;
  }, [state.weakPoints, state.level, armCausesP0, armPlan, report.asymmetryPct, dynamicReport]);

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
    // E16 P2: критический гейтинг — score≤49 с side/humerus-floor → side только ремень/изометрия
    const scoringFloors: string[] = ((report as any)?.scoring?.floors || []) as string[];
    const scoringScore: number | null = ((report as any)?.scoring?.score ?? null) as number | null;
    const gatedSide = scoringScore != null && scoringScore <= 49
      && scoringFloors.some((f) => /side|humerus/i.test(f))
      && points.some((p) => p === 'side_mid' || p === 'side_pin');
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
    const payload: any = {
      groups: toApply,
      armTechnique: state.technique,
      armWeakPoints: weakPoints || [],
      armBiomechCards: (diag as any).biomechCards || [],
      armCorrections: (report as any).corrections || [],
      armScoring: (report as any).scoring,
      armDiag: state,
      armAngles: angles,
      armForce: forceVecPro,
      armVbt: vbt,
      armDynamic: dynamicReport,
      armBench: benchRes,
      armTendon: derivedTendon,
      armFindings: report.findings,
      armHumerus: report.humerusWarnings,
      armBalance: report.balanceWarnings,
      armAsymmetry: report.asymmetryPct,
      armInfo: report.info,
    };
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

  return (
    <div className="train-armdiag" style={{ padding: '10px 8px 18px', color: '#fff', maxWidth: 860, margin: '0 auto' }}>
      {/* Header score */}
      <div style={{ ...CARD, padding: '14px 14px 12px', background: 'linear-gradient(135deg,rgba(245,158,11,0.12),rgba(239,68,68,0.08))', border: '1px solid rgba(245,158,11,0.22)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -18, right: -18, width: 110, height: 110, borderRadius: 110, background: 'radial-gradient(circle,rgba(245,158,11,0.14),transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg,#f59e0b,#ef4444)', color: '#fff', fontWeight: 900, fontSize: 16 }}>🤝</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 900, color: '#fff', lineHeight: 1 }}>Арм-диагностика — PRO MAX хаб</div>
            <div style={{ fontSize: 10, color: '#fff', lineHeight: 1.3, opacity: 0.9 }}>5 таба × РУ/РА/РН × VBT × Force + Динамика F/t F100/F500 × Асимметрия × Бенчмарки × Fatigue × Tendon ACWR</div>
          </div>
          <div style={{ textAlign:'center', padding:'8px 10px', borderRadius:10, background: hasWeak ? 'rgba(245,158,11,0.12)' : 'rgba(34,197,94,0.12)', border:`1px solid ${hasWeak ? 'rgba(245,158,11,0.22)' : 'rgba(34,197,94,0.22)'}` }}>
            <div style={{ fontSize:11, fontWeight:700, color: hasWeak? '#f59e0b' : '#22c55e' }}>{hasWeak ? ((state.weakPoints.length? state.weakPoints.join(', ') : report.weakMuscles.join(', '))) : 'баланс'}</div>
            <div style={{ fontSize:9, color: DIM }}>{hasWeak ? `${(report as any).weakPoints?.length||0} мёртвых точек · ${report.findings.length} факта` : 'слабые зоны не выявлены'}</div>
          </div>
          {showScoring && scoring && (
            <div style={{ textAlign:'center', padding:'8px 10px', borderRadius:10, background: `rgba(${scoring.level==='ok'?'34,197,94': scoring.level==='warn'?'245,158,11':'239,68,68'},0.12)`, border:'1px solid rgba(255,255,255,0.12)', minWidth:70 }}>
              <div style={{ fontSize:18, fontWeight:900, color: scoreColor(scoring.level), lineHeight:1 }}>{scoring.score}</div>
              <div style={{ fontSize:9, color: DIM }}>{scoreLabel(scoring.score)} · v{Math.round(scoring.verification*100)}%</div>
              {scoring.floors.length>0 && <div style={{ fontSize:8, color:'#ef4444' }}>{scoring.floors[0]}</div>}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', fontSize: 10, marginBottom: 8 }}>
          <span style={{ padding: '2px 8px', borderRadius: 20, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: DIM }}>Table {(report.tableRatio*100).toFixed(0)}% (3/2/1) · Tendon {report.tendonLoad}/22 · WAF {weightClassAuto}кг</span>
          <span style={{ padding: '2px 8px', borderRadius: 20, background: benchRes.level==='competitive'?'rgba(34,197,94,0.12)':'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: benchRes.level==='competitive'?'#22c55e':DIM }}>{benchRes.level} · {Math.round(benchRes.avgScore*10)/10} (сила {forceVecPro.totalScore})</span>
          {report.asymmetryPct!=null && <span style={{ padding: '2px 8px', borderRadius: 20, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: DIM }}>Асимметрия {report.asymmetryPct}%</span>}
        </div>
        <div style={{ fontSize: 10, color: '#fff', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '8px 10px', lineHeight: 1.45 }}>
           Выбери <b style={{color:'#f59e0b'}}>12 мёртвых точек</b> (группы Кисть/Ротация/Давление) + провалы + хват + углы + 4 теста силы (кг+мс) + VBT → получи биомех-карточки (угол {`{0-20°при 110°}`}) + коррекции из каталога. Кнопка <b style={{ color: '#f59e0b' }}>«Применить в Арм-конструктор»</b> отправит мёртвые точки + динамику. RSS оверлей — только при видео/VBT/истории. Видео — опционально (BlazePose/HANDS).
        </div>
        {showScoring && scoring && <div style={{ marginTop:6, fontSize:10, color:DIM, padding:'6px 8px', background:'rgba(255,255,255,0.03)', borderRadius:8, border:'1px solid rgba(255,255,255,0.06)' }}>{scoring.findings.slice(0,3).map(f=>f.text).join(' · ')} {scoring.floors.length? `· floor: ${scoring.floors.join(', ')}` : ''} · v{Math.round(scoring.verification*100)}% (видео 0.35+VBT 0.35+история 0.30)</div>}
        {toast && <div style={{ marginTop: 8, padding: '6px 10px', borderRadius: 8, background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.2)', color: '#22c55e', fontSize: 11 }}>{toast}</div>}
      </div>

      {/* Controls */}
      <div style={{ ...CARD, padding: 12 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10, alignItems: 'flex-end' }}>
          <label style={{ fontSize: 11, color: DIM }}>Уровень<br/>
            <select value={state.level} onChange={e=>setState(s=>({...s, level:e.target.value}))} style={{ marginTop: 4, background: '#0a1629', color: '#fff', border: '1px solid #1f3a5f', borderRadius: 8, padding: '6px 8px', fontSize: 12 }}>
              {LEVEL_OPTS.map(o=><option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </label>
          <label style={{ fontSize: 11, color: DIM }}>Техника<br/>
            <select value={state.technique} onChange={e=>setState(s=>({...s, technique:e.target.value}))} style={{ marginTop: 4, background: '#0a1629', color: '#fff', border: '1px solid #1f3a5f', borderRadius: 8, padding: '6px 8px', fontSize: 12 }}>
              <option value="balanced">Сбалансировано</option><option value="hook">Хук</option><option value="toproll">Топролл</option><option value="press">Пресс</option>
            </select>
          </label>
          <label style={{ fontSize: 11, color: DIM }}>Вес кг<br/><input inputMode="decimal" value={state.bwKg} onChange={e=>setState(s=>({...s, bwKg:e.target.value}))} placeholder="80" style={{ width:70, marginTop:4, background:'#0a1629', color:'#fff', border:'1px solid #1f3a5f', borderRadius:8, padding:'6px 8px', fontSize:12 }} /></label>
          <label style={{ fontSize: 11, color: DIM }}>Пол<br/>
            <select value={state.sex} onChange={e=>setState(s=>({...s, sex:e.target.value}))} style={{ marginTop:4, background:'#0a1629', color:'#fff', border:'1px solid #1f3a5f', borderRadius:8, padding:'6px 8px', fontSize:12 }}>
              <option value="male">М</option><option value="female">Ж</option>
            </select>
          </label>
          <label style={{ fontSize: 11, color: DIM }}>Класс WAF<br/><input value={weightClassAuto} readOnly style={{ width:60, marginTop:4, background:'#0a1629', color:DIM, border:'1px solid #1f3a5f', borderRadius:8, padding:'6px 8px', fontSize:12 }} /></label>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'flex-end' }}>
            <button onClick={applyToConstructor} style={{ padding: '8px 14px', borderRadius: 8, background: 'linear-gradient(135deg,#f59e0b,#ef4444)', color: '#fff', border: 'none', fontWeight: 800, fontSize: 12, cursor: 'pointer' }}>→ Применить в Арм-конструктор</button>
          </div>
        </div>

        {/* Sub-tabs */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
          {TAB_DEFS.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)} aria-pressed={tab===t.id} style={{ padding:'6px 12px', borderRadius:999, border:'1px solid', borderColor: tab===t.id ? '#f59e0b' : '#1f3a5f', background: tab===t.id ? 'rgba(245,158,11,0.14)' : '#0a1629', color: tab===t.id ? '#f59e0b' : DIM, cursor:'pointer', fontSize:11, fontWeight:600 }}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {tab==='grip' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 8, marginBottom: 12 }}>
              <label style={{ fontSize: 11, color: DIM }}>RT кг<br/><input inputMode="decimal" value={state.rtKg} onChange={e=>setState(s=>({...s, rtKg:e.target.value}))} placeholder="60" style={{ width: '100%', marginTop: 4, background: '#0a1629', color: '#fff', border: '1px solid #1f3a5f', borderRadius: 8, padding: '6px 8px', fontSize: 12 }} /></label>
              <label style={{ fontSize: 11, color: DIM }}>Axle кг<br/><input inputMode="decimal" value={state.axleKg} onChange={e=>setState(s=>({...s, axleKg:e.target.value}))} placeholder="100" style={{ width: '100%', marginTop: 4, background: '#0a1629', color: '#fff', border: '1px solid #1f3a5f', borderRadius: 8, padding: '6px 8px', fontSize: 12 }} /></label>
              <label style={{ fontSize: 11, color: DIM }}>Pinch сек<br/><input inputMode="decimal" value={state.pinchSec} onChange={e=>setState(s=>({...s, pinchSec:e.target.value}))} placeholder="15" style={{ width: '100%', marginTop: 4, background: '#0a1629', color: '#fff', border: '1px solid #1f3a5f', borderRadius: 8, padding: '6px 8px', fontSize: 12 }} /></label>
              <label style={{ fontSize: 11, color: DIM }}>Left кг<br/><input inputMode="decimal" value={state.leftKg} onChange={e=>setState(s=>({...s, leftKg:e.target.value}))} placeholder="50" style={{ width: '100%', marginTop: 4, background: '#0a1629', color: '#fff', border: '1px solid #1f3a5f', borderRadius: 8, padding: '6px 8px', fontSize: 12 }} /></label>
              <label style={{ fontSize: 11, color: DIM }}>Right кг<br/><input inputMode="decimal" value={state.rightKg} onChange={e=>setState(s=>({...s, rightKg:e.target.value}))} placeholder="55" style={{ width: '100%', marginTop: 4, background: '#0a1629', color: '#fff', border: '1px solid #1f3a5f', borderRadius: 8, padding: '6px 8px', fontSize: 12 }} /></label>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(160px, 1fr))', gap:8, marginBottom:8 }}>
              <div style={{ padding:'8px 10px', borderRadius:8, background:'#0a1629', border:'1px solid #1f3a5f' }}>
                <div style={{ fontSize:11, fontWeight:700, color:'#fff' }}>Force Vector · WAF {weightClassAuto}</div>
                <div style={{ fontSize:10, color:DIM, marginTop:4 }}>Support {forceVecPro.gripSupport} · Pinch {forceVecPro.gripPinch} · Side {forceVecPro.sidePressure} · Back {forceVecPro.backPressure} → <b style={{color:ACCENT}}>{forceVecPro.totalScore}</b> {forceVecPro.asymmetryPct!=null ? `· Асим ${forceVecPro.asymmetryPct}%${forceVecPro.asymmetryPct>=12?' 🔴':forceVecPro.asymmetryPct>=7?' 🟠':' 🟢'}` : ''}</div>
                <div style={{ fontSize:9, color:DIM, marginTop:4 }}>WR M {getRtWorldClass('male')}кг / Ж {getRtWorldClass('female')}кг · Axle 133 · Side ref {(bwNum*0.6).toFixed(0)}кг</div>
                {/* E13 P2: помост %WR + попытки */}
                {platformP0 && (
                  <div style={{ fontSize:10, color:DIM, marginTop:4 }}>🏟 Помост RT: {platformP0.bestKg}кг = <b style={{ color:ACCENT }}>{platformP0.wrPct}% WR</b> ({platformP0.worldRecordKg}кг) · попытки {platformP0.plan.join('/')} · {platformP0.note}</div>
                )}
                <div style={{ fontSize:9, color:DIM, marginTop:4 }}>Весогонка WAF: М −0.5%/нед · Ж −0.4%/нед · L/R — отдельные зачёты</div>
                {/* E15 P2: снапшот замеров */}
                <div style={{ display:'flex', gap:6, marginTop:6, flexWrap:'wrap', alignItems:'center' }}>
                  <button onClick={() => { saveArmMeasureSnapshot({ rtKg: parseFloat(state.rtKg), sideKg: parseFloat(state.sideKg), backKg: parseFloat(state.backKg), leftKg: parseFloat(state.leftKg), rightKg: parseFloat(state.rightKg) }); setMeasureTick((x) => x + 1); }} style={{ padding:'5px 10px', borderRadius:8, border:'1px solid #1f3a5f', background:'#0a1629', color:DIM, cursor:'pointer', fontSize:10 }}>📸 Снапшот замеров</button>
                  {measureHistP0.length > 0 && <span style={{ fontSize:9, color:DIM }}>RT: {measureHistP0.slice(-5).map((h) => h.rtKg ?? '—').join(' → ')}</span>}
                </div>
              </div>
              <div style={{ padding:'8px 10px', borderRadius:8, background:'#0a1629', border:'1px solid #1f3a5f' }}>
                <div style={{ fontSize:11, fontWeight:700, color:'#fff' }}>VBT</div>
                <div style={{ fontSize:10, color:DIM, marginTop:4 }}>{vbt.advice} {vbt.e1RM? `· e1RM ${vbt.e1RM}кг` : ''} · zone <b>{vbt.zone}</b></div>
                {vbtThP0 && <div style={{ fontSize:9, color:DIM, marginTop:2 }}>Пороги точки {state.weakPoints[0]}: warn {vbtThP0.warnPct}% / stop {vbtThP0.stopPct}%</div>}
                <div style={{ display:'flex', gap:6, marginTop:6 }}>
                  <input inputMode="decimal" value={state.vbtWeight} onChange={e=>setState(s=>({...s, vbtWeight:e.target.value}))} placeholder="кг" style={{ flex:1, background:'#0a1629', color:'#fff', border:'1px solid #1f3a5f', borderRadius:6, padding:'4px 6px', fontSize:11 }} />
                  <input inputMode="numeric" value={state.vbtReps} onChange={e=>setState(s=>({...s, vbtReps:e.target.value}))} placeholder="повт" style={{ width:60, background:'#0a1629', color:'#fff', border:'1px solid #1f3a5f', borderRadius:6, padding:'4px 6px', fontSize:11 }} />
                  <input inputMode="decimal" value={state.vbtVel} onChange={e=>setState(s=>({...s, vbtVel:e.target.value}))} placeholder="м/с" style={{ width:60, background:'#0a1629', color:'#fff', border:'1px solid #1f3a5f', borderRadius:6, padding:'4px 6px', fontSize:11 }} />
                </div>
              </div>
              <div style={{ padding:'8px 10px', borderRadius:8, background: benchRes.level==='beginner'?'rgba(239,68,68,0.08)':'rgba(34,197,94,0.08)', border:'1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ fontSize:11, fontWeight:700, color:'#fff' }}>Бенчмарки · {benchRes.level}</div>
                <div style={{ fontSize:10, color:DIM }}>{benchRes.details.map(d=>`${d.id}:${d.value}→${d.level}`).join(' · ') || 'введи WristCurl/Coc'}</div>
                <div style={{ fontSize:10, color: DIM, marginTop:4 }}>{benchAdviceForLevel(benchRes.level)}</div>
              </div>
            </div>
            {(state.pinchSec && parseFloat(state.pinchSec) < 10) || (state.rtKg && parseFloat(state.rtKg) < 60) ? (
              <div style={{ padding:'8px 10px', borderRadius:8, background:'rgba(245,158,11,0.06)', border:'1px solid rgba(245,158,11,0.14)', marginBottom:8 }}>
                <div style={{ fontSize:11, fontWeight:700, color:'#f59e0b' }}>Слабое звено хвата → коррекция (contain_fingers)</div>
                <div style={{ fontSize:10, color:DIM, marginTop:4 }}>
                  {state.pinchSec && parseFloat(state.pinchSec) < 10 ? `Pinch ${state.pinchSec}с <10с → hub_pinch / plate_pinch_hold 3×15с @60% · ` : ''}
                  {state.rtKg && parseFloat(state.rtKg) < 60 ? `RT ${state.rtKg}кг <60 → rolling_thunder / apollon_axle DOH 3×5 @60%` : ''}
                </div>
                <button onClick={()=>toggleWeakPoint('contain_fingers')} aria-pressed={state.weakPoints.includes('contain_fingers')} style={{ marginTop:6, padding:'5px 10px', borderRadius:999, border:'1px solid', borderColor: state.weakPoints.includes('contain_fingers') ? '#f59e0b' : '#1f3a5f', background: state.weakPoints.includes('contain_fingers') ? 'rgba(245,158,11,0.16)' : '#0a1629', color: state.weakPoints.includes('contain_fingers') ? '#f59e0b' : DIM, cursor:'pointer', fontSize:10, fontWeight:600 }}>
                  {state.weakPoints.includes('contain_fingers') ? '✓ contain_fingers выбрана' : '+ Добавить contain_fingers'}
                </button>
              </div>
            ) : null}
            <div style={{ fontSize:10, color:DIM }}>Нормы IronMind: RT 55 avg /84 accomplished /130.5 WR M /77.2 WR F. Axle Saxon WR 133кг. Side/back нормированы на WAF класс.</div>
          </div>
        )}

        {tab==='wrist' && (
          <div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(140px, 1fr))', gap:8, marginBottom:8 }}>
              <label style={{ fontSize:11, color:DIM }}>Локоть°<br/><input inputMode="decimal" value={state.elbowDeg} onChange={e=>setState(s=>({...s, elbowDeg:e.target.value}))} placeholder="110" style={{ width:'100%', marginTop:4, background:'#0a1629', color:'#fff', border:'1px solid #1f3a5f', borderRadius:8, padding:'6px 8px', fontSize:12 }} /></label>
              <label style={{ fontSize:11, color:DIM }}>Предплечье°<br/><input inputMode="decimal" value={state.forearmDeg} onChange={e=>setState(s=>({...s, forearmDeg:e.target.value}))} placeholder="90" style={{ width:'100%', marginTop:4, background:'#0a1629', color:'#fff', border:'1px solid #1f3a5f', borderRadius:8, padding:'6px 8px', fontSize:12 }} /></label>
              <label style={{ fontSize:11, color:DIM }}>Кисть°<br/><input inputMode="decimal" value={state.wristDeg} onChange={e=>setState(s=>({...s, wristDeg:e.target.value}))} placeholder="10" style={{ width:'100%', marginTop:4, background:'#0a1629', color:'#fff', border:'1px solid #1f3a5f', borderRadius:8, padding:'6px 8px', fontSize:12 }} /></label>
              <label style={{ fontSize:11, color:DIM }}>Направление<br/>
                <select value={state.direction} onChange={e=>setState(s=>({...s, direction:e.target.value as any}))} style={{ width:'100%', marginTop:4, background:'#0a1629', color:'#fff', border:'1px solid #1f3a5f', borderRadius:8, padding:'6px 8px', fontSize:12 }}>
                  <option value="to_little">К мизинцу</option><option value="to_middle">К среднему</option><option value="to_thumb">К большому</option>
                </select>
              </label>
            </div>
            <div style={{ padding:'8px 10px', borderRadius:8, background: angleValid.valid? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)', border:`1px solid ${angleValid.valid?'rgba(34,197,94,0.2)':'rgba(239,68,68,0.2)'}`, marginBottom:8 }}>
              <div style={{ fontSize:11, fontWeight:700, color: angleValid.valid?'#22c55e':'#ef4444' }}>РУ: {angles.elbowDeg}° · {angles.direction} · pron {angles.pronDeg}° sup {angles.supDeg}° · {anglesVerified?'✓ верифицировано':'○ ручной ввод'}</div>
              <div style={{ fontSize:10, color:DIM, marginTop:2 }}>{angleValid.valid? '✓ В допуске' : angleValid.warnings.join(' · ')}</div>
              <div style={{ fontSize:10, color:DIM, marginTop:4 }}>Рекомендация для {state.technique}: {recAngles.elbowDeg}° {recAngles.direction} (hasVideoSupport: {hasVideoSupport()?'да':'нет — подключи Hands/BlazePose'})</div>
            </div>
            {autoPoint && !state.weakPoints.includes(autoPoint) && (
              <div style={{ padding:'8px 10px', borderRadius:8, background:'rgba(245,158,11,0.06)', border:'1px solid rgba(245,158,11,0.14)', marginBottom:8 }}>
                <div style={{ fontSize:10, color:DIM }}>Авто по углам ({angles.elbowDeg}°/{angles.forearmDeg}°/{angles.wristDeg}°): похожа на <b style={{ color:'#f59e0b' }}>{autoPoint}</b> — {ARM_BIOMECH[autoPoint].label}</div>
                <button onClick={()=>toggleWeakPoint(autoPoint)} style={{ marginTop:6, padding:'5px 10px', borderRadius:999, border:'1px solid #f59e0b', background:'rgba(245,158,11,0.12)', color:'#f59e0b', cursor:'pointer', fontSize:10, fontWeight:600 }}>+ Добавить {autoPoint}</button>
              </div>
            )}
            <div style={{ padding:'8px 10px', borderRadius:8, background:'#0a1629', border:'1px dashed #1f3a5f', textAlign:'center' }}>
              <div style={{ fontSize:11, color:DIM }}>📹 Видео (BlazePose/HANDS) — опционально</div>
              <div style={{ fontSize:10, color:DIM, marginTop:2 }}>Камера или landmarks JSON → углы автоматически (estimateAnglesFromLandmarks + angleBetween). Fallback — ручные ползунки.</div>
              {!isOnline() && <div style={{ fontSize:10, color:'#f59e0b', marginTop:4 }}>📴 Офлайн (APK): Hands-модель грузится из CDN и недоступна — камера покажет картинку без live-углов, вводи углы вручную или JSON.</div>}
              <div style={{ display:'flex', gap:6, justifyContent:'center', marginTop:6, flexWrap:'wrap' }}>
                <button onClick={()=> setShowCam(v=>!v)} style={{ padding:'6px 10px', borderRadius:8, border:'1px solid', borderColor: showCam?'#22c55e':'#1f3a5f', background: showCam?'rgba(34,197,94,0.14)':'#0a1629', color: showCam?'#22c55e':DIM, cursor:'pointer', fontSize:11, fontWeight:600 }}>{showCam?'⏹ Выкл камеру':'📹 Включить камеру'}</button>
                <label style={{ padding:'6px 10px', borderRadius:8, border:'1px solid #1f3a5f', background:'#0a1629', color:DIM, cursor:'pointer', fontSize:11 }}>📁 JSON<input type="file" accept=".json" onChange={handleVideoFile} style={{ display:'none' }} /></label>
              </div>
              {/* E8 P1: Kinovea CSV трекинга кисти → метрики + тип + SRD */}
              <div style={{ marginTop:6, padding:'8px 10px', borderRadius:8, background:'#0a1629', border:'1px solid #1f3a5f', textAlign:'left' }}>
                <div style={{ fontSize:11, fontWeight:700, color:'#fff' }}>📊 Kinovea CSV трекинга кисти (t,x,y)</div>
                <textarea value={trackCsv} onChange={(e) => setTrackCsv(e.target.value)} placeholder={'t,x,y\n0,0,0\n0.1,1.2,0.5'} rows={3} style={{ width:'100%', marginTop:6, background:'#060d1a', color:'#fff', border:'1px solid #1f3a5f', borderRadius:6, padding:'6px 8px', fontSize:10, fontFamily:'monospace' }} />
                <div style={{ display:'flex', gap:6, marginTop:6, flexWrap:'wrap' }}>
                  <button onClick={() => { try { if (trackMetrics) { setBaseXLoop(String(trackMetrics.xLoop)); localStorage.setItem('he_arm_track_base', String(trackMetrics.xLoop)); } } catch {} }} style={{ padding:'5px 10px', borderRadius:8, border:'1px solid #1f3a5f', background:'#0a1629', color:DIM, cursor:'pointer', fontSize:10 }}>📌 База SRD</button>
                  <button onClick={() => setTrackCsv('')} style={{ padding:'5px 10px', borderRadius:8, border:'1px solid #1f3a5f', background:'#0a1629', color:DIM, cursor:'pointer', fontSize:10 }}>🗑 Очистить</button>
                </div>
                {trackMetrics && (
                  <div style={{ fontSize:10, color:DIM, marginTop:6 }}>
                    xLoop {trackMetrics.xLoop} · yMax {trackMetrics.yMax} · vMax {trackMetrics.vMax} · точек {trackMetrics.points} · тип <b style={{ color:ACCENT }}>{trackType === 'inside_hook' ? 'hook внутрь' : trackType === 'outside_toproll' ? 'toproll наружу' : 'press прямо'}</b>
                    {trackSrd && <span> · {trackSrd}</span>}
                  </div>
                )}
              </div>
              <div style={{ marginTop:6, width:'100%', minHeight:90, background:'rgba(255,255,255,0.03)', borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', color:DIM, fontSize:11, border:'1px solid rgba(255,255,255,0.04)', flexDirection:'column', gap:4, position:'relative', overflow:'hidden' }}>
                {showCam ? (
                  <>
                    <video ref={videoRef} autoPlay muted playsInline style={{ width:'100%', maxHeight:140, borderRadius:8, background:'#000' }} />
                    <div style={{ position:'absolute', bottom:4, left:4, right:4, display:'flex', gap:4, justifyContent:'center', flexWrap:'wrap' }}>
                      <span style={{ padding:'2px 6px', borderRadius:999, background:'rgba(0,0,0,0.6)', color:'#fff', fontSize:10 }}>Элбоу {angles.elbowDeg}°</span>
                      <span style={{ padding:'2px 6px', borderRadius:999, background:'rgba(0,0,0,0.6)', color:'#fff', fontSize:10 }}>{angles.direction}</span>
                      <span style={{ padding:'2px 6px', borderRadius:999, background: angleValid.valid?'rgba(34,197,94,0.7)':'rgba(239,68,68,0.7)', color:'#fff', fontSize:10 }}>{angleValid.valid?'✓':'⚠'}</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div>video preview — PRO: BlazePose + angleBetween()</div>
                    <div style={{ fontSize:10 }}>Элбоу {angles.elbowDeg}° · forearm {angles.forearmDeg}° · wrist {angles.wristDeg}° · {hasVideoSupport()?'Hands ready':'нужен Hands'}</div>
                  </>
                )}
              </div>
            </div>
            {/* 12 мёртвых точек — группы Кисть/Ротация/Давление (PRO) */}
            <div style={{ padding:'8px 10px', borderRadius:8, background:'rgba(245,158,11,0.06)', border:'1px solid rgba(245,158,11,0.14)', marginTop:8 }}>
              <div style={{ fontSize:11, fontWeight:800, color:'#f59e0b', marginBottom:6 }}>🎯 12 мёртвых точек — выбери 1-3 (как WLDiagnosticsHub) · техника {state.technique} · до 3</div>
              <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
                {WEAK_GROUPS.map(g=> (
                  <div key={g.title} style={{ flex:'1 1 160px', minWidth:160 }}>
                    <div style={{ fontSize:10, fontWeight:700, color:DIM, marginBottom:4 }}>{g.title} {g.title==='Кисть'?'🤚' : g.title==='Ротация'?'🔄':'💥'}</div>
                    <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
                      {g.points.map(wp=>{
                        const sel = state.weakPoints.includes(wp);
                        const bio = ARM_BIOMECH[wp];
                        const isForTech = bio.technique.includes(state.technique) || bio.technique.includes('all') || state.technique==='balanced';
                        // подсвечиваем релевантные технике
                        return (
                          <button key={wp} onClick={()=>toggleWeakPoint(wp)} aria-pressed={sel} title={`${bio.label} ${bio.angleRangeDeg[0]}-${bio.angleRangeDeg[1]}° ${bio.keyJoint} → ${bio.corrections[0]}`}
                            style={{ padding:'5px 8px', borderRadius:999, border:'1px solid', borderColor: sel ? '#f59e0b' : isForTech ? '#1f3a5f' : 'rgba(255,255,255,0.08)', background: sel ? 'rgba(245,158,11,0.16)' : isForTech ? '#0a1629' : 'rgba(255,255,255,0.02)', color: sel ? '#f59e0b' : isForTech ? DIM : 'rgba(255,255,255,0.4)', cursor:'pointer', fontSize:10, fontWeight:600, opacity: isForTech?1:0.6 }}>
                            {WP_LABEL_SHORT[wp]} {isForTech? '●':''}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ display:'flex', gap:6, marginTop:8, flexWrap:'wrap', alignItems:'center' }}>
                <span style={{ fontSize:10, color:DIM }}>Выбрано: {state.weakPoints.length? state.weakPoints.join(', ') : '—'} {state.weakPoints.length>=3? '(макс 3)' : ''}</span>
                {state.weakPoints.length>0 && <button onClick={clearWeakPoints} style={{ padding:'4px 8px', borderRadius:999, border:'1px solid #1f3a5f', background:'#0a1629', color:DIM, cursor:'pointer', fontSize:10 }}>✕ Сбросить</button>}
                <span style={{ marginLeft:'auto', fontSize:9, color:DIM }}>Фильтр ● = для техники {state.technique}</span>
              </div>
              {/* Биомех-карточки выбранных */}
              {state.weakPoints.length>0 && (
                <div style={{ marginTop:8, display:'flex', flexDirection:'column', gap:6 }}>
                  {(diag as any).biomechCards?.map((c:any)=> {
                    const aj = angleJointForWeakPoint(c.weakPoint as ArmWeakPoint);
                    const curDeg = aj==='wrist' ? (parseFloat(state.wristDeg)||10) : aj==='elbow' ? (parseFloat(state.elbowDeg)||110) : (parseFloat(state.forearmDeg)||90);
                    const valid = aj==='none' ? null : isValidAngleForArmWeakPoint(c.weakPoint, curDeg);
                    const corr = ARM_CORRECTIONS[c.weakPoint as ArmWeakPoint];
                    return (
                      <div key={c.weakPoint} style={{ padding:'8px 10px', borderRadius:8, background:'#0a1629', border:`1px solid ${valid===null?'rgba(255,255,255,0.12)':valid?'rgba(34,197,94,0.2)':'rgba(239,68,68,0.2)'}` }}>
                        <div style={{ display:'flex', gap:6, flexWrap:'wrap', alignItems:'center' }}>
                          <span style={{ fontSize:11, fontWeight:800, color:'#fff' }}>{c.label}</span>
                          <span style={{ fontSize:10, padding:'2px 6px', borderRadius:999, background: valid===null?'rgba(255,255,255,0.06)':valid?'rgba(34,197,94,0.14)':'rgba(239,68,68,0.14)', color: valid===null?DIM:valid?'#22c55e':'#ef4444', border:`1px solid ${valid===null?'rgba(255,255,255,0.12)':valid?'rgba(34,197,94,0.2)':'rgba(239,68,68,0.2)'}` }}>{c.angleRangeDeg[0]}-{c.angleRangeDeg[1]}° {c.keyJoint} {valid===null?'• угол н/п — контроль по технике':valid?'✅':'⚠ вне'}</span>
                          <span style={{ fontSize:10, color:DIM }}>{c.technique.join('/')} · {c.weakMuscles.join('/')}</span>
                        </div>
                        <div style={{ fontSize:10, color:DIM, marginTop:4 }}>{c.reason}</div>
                        <div style={{ fontSize:10, color:'#5ee', marginTop:4 }}><b>Коррекции:</b> {c.corrections.join(' · ')} @ {Math.round(c.intensityPct*100)}% · <i>{c.loadCues}</i> · VBT {vbtThresholdForWeakPoint(c.weakPoint as ArmWeakPoint).warnPct}/{vbtThresholdForWeakPoint(c.weakPoint as ArmWeakPoint).stopPct}%</div>
                        {corr && <div style={{ fontSize:10, color:DIM, marginTop:2 }}>Сеты {corr.sets}×{corr.repsRange[0]}-{corr.repsRange[1]} RIR{corr.rir}{corr.holdSeconds?` hold ${corr.holdSeconds}с`:''} → день {corr.dayTags[0]} · группа {corr.substitutionGroup}</div>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginTop:8, opacity:0.7 }}>
              <span style={{ fontSize:10, color:DIM, alignSelf:'center' }}>Legacy провалы (совместимость):</span>
              {[
                ['cup','Кисть открывается (cup)'],
                ['rising','Пальцы уходят (rising)'],
                ['pron','Топролл не держит (pron)'],
                ['sup','Хук проваливается (sup)'],
              ].map(([k,label]) => (
                <button key={k} onClick={()=>toggleLegacy(k as any)} aria-pressed={!!(state as any)[k]} style={{ padding:'5px 8px', borderRadius:999, border:'1px dashed', borderColor:(state as any)[k] ? '#f59e0b' : '#1f3a5f', background:(state as any)[k] ? 'rgba(245,158,11,0.10)' : '#0a1629', color:(state as any)[k] ? '#f59e0b' : DIM, cursor:'pointer', fontSize:10, fontWeight:500 }}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {tab==='pressure' && (
          <div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:8 }}>
              <label style={{ fontSize:11, color:DIM }}>Side кг (блок)<br/><input value={state.sideKg} onChange={e=>setState(s=>({...s, sideKg:e.target.value}))} placeholder="30" style={{ width:'100%', marginTop:4, background:'#0a1629', color:'#fff', border:'1px solid #1f3a5f', borderRadius:8, padding:'6px 8px', fontSize:12 }} /></label>
              <label style={{ fontSize:11, color:DIM }}>Back кг (тяга)<br/><input value={state.backKg} onChange={e=>setState(s=>({...s, backKg:e.target.value}))} placeholder="50" style={{ width:'100%', marginTop:4, background:'#0a1629', color:'#fff', border:'1px solid #1f3a5f', borderRadius:8, padding:'6px 8px', fontSize:12 }} /></label>
            </div>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:8 }}>
              {[
                ['side','Не дожимает боком (side)'],
                ['back','Тяга слабая (back)'],
              ].map(([k,label]) => (
                <button key={k} onClick={()=>toggleLegacy(k as any)} aria-pressed={!!(state as any)[k]} style={{ padding:'6px 10px', borderRadius:999, border:'1px solid', borderColor:(state as any)[k] ? '#ef4444' : '#1f3a5f', background:(state as any)[k] ? 'rgba(239,68,68,0.12)' : '#0a1629', color:(state as any)[k] ? '#ef4444' : DIM, cursor:'pointer', fontSize:11, fontWeight:600 }}>
                  {label}
                </button>
              ))}
            </div>
            {/* Быстрый выбор 4 точек давления */}
            <div style={{ padding:'8px 10px', borderRadius:8, background:'rgba(239,68,68,0.06)', border:'1px solid rgba(239,68,68,0.12)', marginBottom:8 }}>
              <div style={{ fontSize:10, fontWeight:700, color:'#ef4444', marginBottom:6 }}>Мёртвые точки давления (быстрый выбор) · side/back — humerus guard</div>
              <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
                {(['side_mid','side_pin','back_start','back_drag'] as ArmWeakPoint[]).map(wp=>{
                  const sel = state.weakPoints.includes(wp);
                  const bio = ARM_BIOMECH[wp];
                  return (
                    <button key={wp} onClick={()=>toggleWeakPoint(wp)} aria-pressed={sel} title={`${bio.label} ${bio.angleRangeDeg[0]}-${bio.angleRangeDeg[1]}° → ${bio.corrections[0]}`}
                      style={{ padding:'5px 8px', borderRadius:999, border:'1px solid', borderColor: sel ? '#ef4444' : '#1f3a5f', background: sel ? 'rgba(239,68,68,0.14)' : '#0a1629', color: sel ? '#ef4444' : DIM, cursor:'pointer', fontSize:10, fontWeight:600 }}>
                      {WP_LABEL_SHORT[wp]} {bio.intensityPct*100===60?'60%':'70%'}
                    </button>
                  );
                })}
              </div>
              {state.weakPoints.filter(wp=>['side_mid','side_pin','back_start','back_drag'].includes(wp)).length>0 && (
                <div style={{ marginTop:6, fontSize:10, color:DIM }}>
                  Выбрано давления: {state.weakPoints.filter(wp=>['side_mid','side_pin','back_start','back_drag'].includes(wp)).join(', ')}
                  <span style={{ color:'#ef4444', marginLeft:8 }}>⚠ Side — прогрессия ≤10%/нед, RIR≥2, ≤3 сета первые 4н</span>
                </div>
              )}
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
              <div style={{ padding:'8px 10px', borderRadius:8, background: mockGuard.humerus.length? 'rgba(239,68,68,0.08)' : 'rgba(34,197,94,0.08)', border:`1px solid ${mockGuard.humerus.length?'rgba(239,68,68,0.2)':'rgba(34,197,94,0.2)'}` }}>
                <div style={{ fontSize:11, fontWeight:700, color: mockGuard.humerus.length?'#ef4444':'#22c55e' }}>Humerus (side)</div>
                <div style={{ fontSize:10, color:DIM, marginTop:2 }}>{mockGuard.humerus.length? mockGuard.humerus.join(' · ') : '✓ Нет риска: side ≤3, RIR≥2, прогрессия ≤10%/нед'}</div>
              </div>
              <div style={{ padding:'8px 10px', borderRadius:8, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ fontSize:11, fontWeight:700, color:'#fff' }}>Force Vector PRO</div>
                <div style={{ fontSize:10, color:DIM, marginTop:2 }}>Side {forceVecPro.sidePressure} · Back {forceVecPro.backPressure} · Total {forceVecPro.totalScore} {forceVecPro.asymmetryPct!=null? `· Асим ${forceVecPro.asymmetryPct}%`:''}</div>
                <div style={{ fontSize:10, color:DIM }}>Side ref {Math.round(bwNum*0.6)}кг · Back ref {Math.round(bwNum*0.8)}кг · WAF {weightClassAuto}</div>
              </div>
            </div>
            <div style={{ marginTop:8, padding:'8px 10px', borderRadius:8, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ fontSize:11, fontWeight:700, color:'#fff' }}>🗓 Стол — периодизация 3/2/1 (Кузнецов VIII) — ≥50% стол</div>
              <div style={{ display:'flex', gap:2, marginTop:6 }}>
                {tablePreview.map(({ wk, kind }) => {
                  const col = kind==='moderate'? '#22c55e' : kind==='heavy'? '#f59e0b' : '#ef4444';
                  return <div key={wk} style={{ flex:1, height:18, background:col, borderRadius:4, display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:9, fontWeight:700 }}>{wk}:{kind[0]}</div>;
                })}
              </div>
            </div>
          </div>
        )}

        {tab==='strength' && (
          <div>
            <div style={{ padding:'8px 10px', borderRadius:8, background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.16)', marginBottom:8 }}>
              <div style={{ fontSize:11, fontWeight:800, color:'#f59e0b' }}>4 теста Bezkorovainyi — ARM1 Device FB5k (патент #43082)</div>
              <div style={{ fontSize:10, color:DIM }}>finger_flex (сгибание пальцев) · hammer (разгиб. молот) · hook (крюк) · cup (сгибание кисти). Введи силу кг + время достижения макс мс → получи F/t, F100, F500, градиент, F/m.</div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(140px, 1fr))', gap:8, marginBottom:8 }}>
              {[
                ['fingerKg','fingerMs','Finger flex кг/мс'],
                ['hammerKg','hammerMs','Hammer кг/мс'],
                ['hookKg','hookMs','Hook кг/мс'],
                ['cupKg','cupMs','Cup кг/мс'],
              ].map(([kKg,kMs,label])=> (
                <div key={kKg} style={{ padding:'8px', borderRadius:8, background:'#0a1629', border:'1px solid #1f3a5f' }}>
                  <div style={{ fontSize:10, color:DIM, marginBottom:4 }}>{label}</div>
                  <input inputMode="decimal" value={(state as any)[kKg]} onChange={e=>setState(s=>({...s, [kKg]:e.target.value}))} placeholder="кг" style={{ width:'100%', background:'#0a1629', color:'#fff', border:'1px solid #1f3a5f', borderRadius:6, padding:'4px 6px', fontSize:11, marginBottom:4 }} />
                  <input inputMode="numeric" value={(state as any)[kMs]} onChange={e=>setState(s=>({...s, [kMs]:e.target.value}))} placeholder="мс" style={{ width:'100%', background:'#0a1629', color:'#fff', border:'1px solid #1f3a5f', borderRadius:6, padding:'4px 6px', fontSize:11 }} />
                </div>
              ))}
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:8 }}>
              <div style={{ padding:'8px 10px', borderRadius:8, background:'#0a1629', border:'1px solid #1f3a5f' }}>
                <div style={{ fontSize:11, fontWeight:700, color:'#fff' }}>Динамика — F/t градиент</div>
                <div style={{ fontSize:10, color:DIM, marginTop:4 }}>
                  {(dynamicReport as any)?.avgFt ? `Avg F/t ${(dynamicReport as any).avgFt} кг/с · Total ${(dynamicReport as any).totalF}кг · Avg ${(dynamicReport as any).avgF}кг` : 'Введи 4 теста → F/t'}
                  {(dynamicReport as any)?.tactic ? <div style={{ marginTop:4, color:ACCENT }}><b>Тактика:</b> {(dynamicReport as any).tactic}</div> : null}
                </div>
                {dynamicReport && (dynamicReport as any).metrics && (
                  <div style={{ fontSize:10, color:DIM, marginTop:6 }}>
                    {Object.entries((dynamicReport as any).metrics).map(([k,v]: any)=> v ? <div key={k}>{k}: F{v.fMax} F/t{v.ftIndex} F100{v.f100}({v.explosivePct}%) F500{v.f500}({v.fastPct}%) t0.5F{v.t05F}мс</div> : null)}
                  </div>
                )}
              </div>
              <div style={{ padding:'8px 10px', borderRadius:8, background: (dynamicReport as any)?.asymmetry?.level==='critical'?'rgba(239,68,68,0.08)': (dynamicReport as any)?.asymmetry?.level==='warn'?'rgba(245,158,11,0.08)':'rgba(34,197,94,0.08)', border:`1px solid ${(dynamicReport as any)?.asymmetry?.level==='critical'?'rgba(239,68,68,0.2)': (dynamicReport as any)?.asymmetry?.level==='warn'?'rgba(245,158,11,0.2)':'rgba(34,197,94,0.2)'}` }}>
                <div style={{ fontSize:11, fontWeight:700, color: (dynamicReport as any)?.asymmetry?.level==='critical'?'#ef4444': (dynamicReport as any)?.asymmetry?.level==='warn'?'#f59e0b':'#22c55e' }}>Асимметрия L/R</div>
                <div style={{ fontSize:10, color:DIM, marginTop:4 }}>{(dynamicReport as any)?.asymmetry ? `${(dynamicReport as any).asymmetry.leftMax} / ${(dynamicReport as any).asymmetry.rightMax} кг → ${(dynamicReport as any).asymmetry.asymmetryPct}% — ${(dynamicReport as any).asymmetry.advice}` : (forceVecPro.asymmetryPct!=null ? `По хвату ${forceVecPro.asymmetryPct}% ${forceVecPro.asymmetryPct>=12?'🔴':forceVecPro.asymmetryPct>=7?'🟠':'🟢'}` : 'Введи left/right хват или finger/hook обе руки')}</div>
                {/* E12 P1: bilateral-план + история */}
                {bilatP0 && (
                  <div style={{ fontSize:10, color:DIM, marginTop:6, paddingTop:6, borderTop:'1px solid rgba(255,255,255,0.06)' }}>
                    <b style={{ color:'#fff' }}>Bilateral:</b> {bilatP0.note} · слабая {bilatP0.weakArm || '—'} {bilatP0.weakSets} / сильная {bilatP0.strongArm || '—'} {bilatP0.strongSets} {bilatP0.withinMrv ? '· в MRV ✓' : '· вне MRV ⚠'}
                    {bilatTrendP0 && <div style={{ marginTop:2 }}>{bilatTrendP0.text}</div>}
                    {bilatHistP0.length > 0 && <div style={{ marginTop:2 }}>История: {bilatHistP0.slice(-6).map((h) => `${h.asymmetryPct}%`).join(' → ')}</div>}
                    <button onClick={() => { const lk = parseFloat(state.leftKg); const rk = parseFloat(state.rightKg); if (Number.isFinite(lk) && Number.isFinite(rk) && lk > 0 && rk > 0) { saveBilateralEntry(lk, rk); setBilatTick((x) => x + 1); } }} style={{ marginTop:6, padding:'5px 10px', borderRadius:8, border:'1px solid #1f3a5f', background:'#0a1629', color:DIM, cursor:'pointer', fontSize:10 }}>💾 Сохранить L/R замер</button>
                  </div>
                )}
              </div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(140px, 1fr))', gap:8, marginBottom:8 }}>
              <label style={{ fontSize:11, color:DIM }}>Wrist curl lb<br/><input inputMode="decimal" value={state.wristCurlLb} onChange={e=>setState(s=>({...s, wristCurlLb:e.target.value}))} placeholder="30" style={{ width:'100%', marginTop:4, background:'#0a1629', color:'#fff', border:'1px solid #1f3a5f', borderRadius:8, padding:'6px 8px', fontSize:12 }} /></label>
              <label style={{ fontSize:11, color:DIM }}>Pron hold с<br/><input inputMode="numeric" value={state.pronHoldSec} onChange={e=>setState(s=>({...s, pronHoldSec:e.target.value}))} placeholder="20" style={{ width:'100%', marginTop:4, background:'#0a1629', color:'#fff', border:'1px solid #1f3a5f', borderRadius:8, padding:'6px 8px', fontSize:12 }} /></label>
              <label style={{ fontSize:11, color:DIM }}>Cup hold с<br/><input inputMode="numeric" value={state.cupHoldSec} onChange={e=>setState(s=>({...s, cupHoldSec:e.target.value}))} placeholder="25" style={{ width:'100%', marginTop:4, background:'#0a1629', color:'#fff', border:'1px solid #1f3a5f', borderRadius:8, padding:'6px 8px', fontSize:12 }} /></label>
              <label style={{ fontSize:11, color:DIM }}>CoC lvl<br/><input inputMode="decimal" value={state.cocLevel} onChange={e=>setState(s=>({...s, cocLevel:e.target.value}))} placeholder="1" style={{ width:'100%', marginTop:4, background:'#0a1629', color:'#fff', border:'1px solid #1f3a5f', borderRadius:8, padding:'6px 8px', fontSize:12 }} /></label>
            </div>
            <div style={{ padding:'8px 10px', borderRadius:8, background: benchRes.level==='competitive'?'rgba(34,197,94,0.08)':'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)', marginBottom:8 }}>
              <div style={{ fontSize:11, fontWeight:700, color: benchRes.level==='competitive'?'#22c55e':'#fff' }}>Авто-уровень: {benchRes.level} · score {benchRes.avgScore} · {benchAdviceForLevel(benchRes.level)}</div>
              <div style={{ fontSize:10, color:DIM }}>{benchRes.details.map(d=>`${d.id}:${d.value}→${d.level}`).join(' · ') || '—'}</div>
              <div style={{ fontSize:9, color:DIM, marginTop:4 }}>Пороги: wrist curl 0/25/45/70/95 lb · pron 0/10/25/45/65с · cup 0/15/30/50/70с · CoC 0/1/1.5/2/2.5 · RT 0/45/75/100/120кг</div>
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={handleAddTrialsToHistory} style={{ flex:1, padding:'8px 10px', borderRadius:8, background:'rgba(34,197,94,0.12)', border:'1px solid rgba(34,197,94,0.2)', color:'#22c55e', fontWeight:700, cursor:'pointer', fontSize:11 }}>💾 Сохранить 4 теста в историю (12-нед avg/max/min)</button>
              <button onClick={()=> { const s = { fingerKg:'',fingerMs:'',hammerKg:'',hammerMs:'',hookKg:'',hookMs:'',cupKg:'',cupMs:'' }; setState(prev=> ({...prev, ...s})); }} style={{ padding:'8px 10px', borderRadius:8, background:'#0a1629', border:'1px solid #1f3a5f', color:DIM, cursor:'pointer', fontSize:11 }}>🗑 Сброс динамик</button>
            </div>
            {/* F/t → мёртвые точки (авто) */}
            {dynamicReport && (dynamicReport as any).metrics && (
              <div style={{ padding:'8px 10px', borderRadius:8, background:'rgba(245,158,11,0.06)', border:'1px solid rgba(245,158,11,0.14)', marginTop:8 }}>
                <div style={{ fontSize:11, fontWeight:700, color:'#f59e0b' }}>F/t → мёртвые точки (авто-подсказка)</div>
                <div style={{ fontSize:10, color:DIM, marginTop:4 }}>
                  {(dynamicReport as any).metrics.finger_flex && (dynamicReport as any).metrics.finger_flex.ftIndex < 30 ? 'finger_flex низкая → contain_fingers (pinch) · ' : ''}
                  {(dynamicReport as any).metrics.hammer && (dynamicReport as any).metrics.hammer.ftIndex < 30 ? 'hammer низкая → sup_drag/back_drag · ' : ''}
                  {(dynamicReport as any).metrics.hook && (dynamicReport as any).metrics.hook.fMax < 30 ? 'hook низкая → sup_cup/sup_drag · ' : ''}
                  {(dynamicReport as any).metrics.cup && (dynamicReport as any).metrics.cup.f500 < 25 ? 'cup низкая → cup_start/hold · ' : ''}
                  {!((dynamicReport as any).metrics.finger_flex?.ftIndex<30 || (dynamicReport as any).metrics.hammer?.ftIndex<30 || (dynamicReport as any).metrics.hook?.fMax<30 || (dynamicReport as any).metrics.cup?.f500<25) ? 'Все F/t в допуске — баланс' : ''}
                </div>
                <div style={{ display:'flex', gap:4, flexWrap:'wrap', marginTop:6 }}>
                  {[
                    { id:'contain_fingers', need: (dynamicReport as any).metrics.finger_flex?.ftIndex<30 },
                    { id:'sup_drag', need: (dynamicReport as any).metrics.hammer?.ftIndex<30 },
                    { id:'sup_cup', need: (dynamicReport as any).metrics.hook?.fMax<30 },
                    { id:'cup_start', need: (dynamicReport as any).metrics.cup?.f500<25 },
                  ].filter(x=>x.need).map(x=> (
                    <button key={x.id} onClick={()=>toggleWeakPoint(x.id as ArmWeakPoint)} style={{ padding:'5px 8px', borderRadius:999, border:'1px solid', borderColor: state.weakPoints.includes(x.id as ArmWeakPoint)? '#f59e0b':'#1f3a5f', background: state.weakPoints.includes(x.id as ArmWeakPoint)? 'rgba(245,158,11,0.14)':'#0a1629', color: state.weakPoints.includes(x.id as ArmWeakPoint)? '#f59e0b':DIM, cursor:'pointer', fontSize:10 }}>{x.id} {state.weakPoints.includes(x.id as ArmWeakPoint)?'✓':'+'}</button>
                  ))}
                </div>
              </div>
            )}
            {forceHistory.stats.length>0 && (
              <div style={{ marginTop:8, padding:'8px 10px', borderRadius:8, background:'#0a1629', border:'1px solid #1f3a5f' }}>
                <div style={{ fontSize:11, fontWeight:700, color:'#fff' }}>История 12 нед — avg/max/min + fatigue</div>
                <div style={{ fontSize:10, color:DIM, marginTop:4, display:'flex', gap:2 }}>
                  {forceHistory.stats.map((w:any)=> (
                    <div key={w.week} style={{ flex:1, textAlign:'center', padding:'2px 0', background:'rgba(255,255,255,0.04)', borderRadius:4 }}>
                      <div style={{ color:'#22c55e', fontWeight:700 }}>{w.avg}</div>
                      <div style={{ color:'#ef4444' }}>{w.max}</div>
                      <div style={{ color:'#60a5fa' }}>{w.min}</div>
                      <div style={{ color: w.fatiguePct>10?'#ef4444':'#22c55e', fontSize:9 }}>{w.fatiguePct}%</div>
                      <div style={{ fontSize:8, color:DIM }}>W{w.week}</div>
                    </div>
                  ))}
                </div>
                {forceHistory.fatigue && <div style={{ fontSize:10, color: forceHistory.fatigue.improving?'#22c55e':'#ef4444', marginTop:4 }}>{forceHistory.fatigue.text}</div>}
                {forceHistory.trend && <div style={{ fontSize:10, color:DIM }}>{forceHistory.trend.text}</div>}
              </div>
            )}
          </div>
        )}

        {tab==='recovery' && (
          <div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:8 }}>
              <div style={{ padding:'8px 10px', borderRadius:8, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ fontSize:11, fontWeight:700, color:'#fff' }}>ACWR {acwr? acwr.ratio.toFixed(2) : '—'}</div>
                <div style={{ fontSize:10, color:DIM }}>{acwr? `Острая/хроническая — факт` : 'нет данных (нужен дневник sRPE)'}</div>
              </div>
              <div style={{ padding:'8px 10px', borderRadius:8, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ fontSize:11, fontWeight:700, color:'#fff' }}>Tendon ACWR {tendonAcwr? tendonAcwr.ratio.toFixed(2) : '—'}</div>
                <div style={{ fontSize:10, color:DIM }}>{tendonAcwr? `Tendon — факт` : 'нет tendon-данных'}</div>
              </div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:8 }}>
              <div style={{ padding:'8px 10px', borderRadius:8, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ fontSize:11, fontWeight:700, color:'#fff' }}>Tendon Load · лимит {tendonWeeklyLimit(state.level)}</div>
                <div style={{ fontSize:10, color:DIM }}>{report.tendonLoad} сетов/нед · Side MRV {landmarks.side.mrv} · TendonCap 1.2× vs Muscle 1.7×</div>
                <div style={{ fontSize:10, color:DIM, marginTop:4 }}>Beginner 12 / Inter 16 / Adv 18 / Enh 22 — GripStrength F1 3с эксцентрик</div>
              </div>
              <div style={{ padding:'8px 10px', borderRadius:8, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ fontSize:11, fontWeight:700, color:'#fff' }}>Дополнительно</div>
                <div style={{ fontSize:10, color:DIM }}>Техника: {state.technique} · Уровень: {state.level} · Направление: {state.direction} · Углы: {angles.elbowDeg}°/{angles.forearmDeg}°/{angles.wristDeg}°</div>
                <div style={{ fontSize:10, color:DIM, marginTop:4 }}>Видео: {hasVideoSupport()?'поддерживается':'—'} · Ввод: {anglesVerified?'углы в допуске':'ручной'}</div>
              </div>
            </div>
            <div style={{ fontSize:10, color:DIM, padding:'8px 10px', borderRadius:8, background:'#0a1629', border:'1px solid #1f3a5f', marginBottom:8 }}>
              <b style={{ color:'#fff' }}>ACWR — факт:</b> ACWR {acwr ? acwr.ratio : '—'} — факт {acwr ? '' : '(нужен дневник sRPE ≥2 сесс.)'} {tendonAcwr ? `· Tendon ACWR ${tendonAcwr.ratio} — факт` : ''}
            </div>
            {/* E10 P1: мобильность ROM + retest → профиль */}
            <div style={{ padding:'8px 10px', borderRadius:8, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)', marginBottom:8 }}>
              <div style={{ fontSize:11, fontWeight:700, color:'#fff' }}>🦿 Мобильность · score {armMobility.score} {armMobility.failedCount ? `· провалы: ${armMobility.fails.join(', ')}` : '· ✓ норма'}</div>
              <div style={{ display:'flex', gap:4, flexWrap:'wrap', marginTop:6 }}>
                {[
                  ['mobWristFlex', mobWristFlex, setMobWristFlex, 'Сгиб кисти ≥80°'],
                  ['mobWristExt', mobWristExt, setMobWristExt, 'Разгиб ≥70°'],
                  ['mobPron', mobPron, setMobPron, 'Пронация ≥80°'],
                  ['mobSup', mobSup, setMobSup, 'Супинация ≥80°'],
                  ['mobElbow', mobElbow, setMobElbow, 'Локоть полный'],
                ].map(([key, val, set, label]: any) => (
                  <button key={key} onClick={() => set(!val)} aria-pressed={!!val} style={{ padding:'5px 8px', borderRadius:999, border:'1px solid', borderColor: val ? 'rgba(34,197,94,0.3)' : '#ef4444', background: val ? 'rgba(34,197,94,0.10)' : 'rgba(239,68,68,0.10)', color: val ? '#22c55e' : '#ef4444', cursor:'pointer', fontSize:10 }}>{label}</button>
                ))}
              </div>
              <div style={{ display:'flex', gap:6, marginTop:6, flexWrap:'wrap', alignItems:'center' }}>
                <label style={{ fontSize:10, color:DIM }}>Reverse-retest<br />
                  <select value={mobRetest} onChange={(e) => setMobRetest(e.target.value as any)} style={{ marginTop:4, background:'#0a1629', color:'#fff', border:'1px solid #1f3a5f', borderRadius:6, padding:'4px 6px', fontSize:10 }}>
                    <option value="">—</option><option value="better">Лучше</option><option value="same">Так же</option>
                  </select>
                </label>
                <button onClick={() => { const s = applyArmMobilityToProfile(armMobility.restrictions); setMobMsg(`✓ Мобильность ${s} → профиль`); setTimeout(() => setMobMsg(''), 2500); }} style={{ padding:'6px 10px', borderRadius:8, border:'1px solid #1f3a5f', background:'#0a1629', color:DIM, cursor:'pointer', fontSize:10, fontWeight:700 }}>→ В профиль</button>
                {armMobility.retestHint && <span style={{ fontSize:10, color:DIM }}>{armMobility.retestHint}</span>}
                {mobMsg && <span style={{ fontSize:10, color:'#22c55e' }}>{mobMsg}</span>}
              </div>
            </div>
            {/* E11 P1: авторегуляция из дневника + гварды UCL/плечо/tendon */}
            <div style={{ padding:'8px 10px', borderRadius:8, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)', marginBottom:8 }}>
              <div style={{ fontSize:11, fontWeight:700, color:'#fff' }}>🔄 Авторегуляция (sRPE 7д + VBT)</div>
              <div style={{ fontSize:10, color:DIM, marginTop:2 }}>{autoregP0 ? `${autoregP0.note} · объём ×${autoregP0.volumeMult} · RIR+${autoregP0.rirShift}${autoregP0.extraRestDays ? ` · +${autoregP0.extraRestDays} дн отдыха` : ''}` : 'Нет sRPE за 7д — план без изменений'}</div>
              <div style={{ fontSize:10, color:DIM, marginTop:6 }}><b style={{ color:'#fff' }}>Гварды плана:</b> {guardsP0.ucl.length + guardsP0.shoulder.length + guardsP0.tendon.length === 0 ? (armPlan ? '✓ UCL/плечо/tendon чисто' : 'нет плана — нечего проверять') : [...guardsP0.ucl, ...guardsP0.shoulder, ...guardsP0.tendon].slice(0, 4).join(' · ')}</div>
            </div>
            {showScoring && scoring && (
              <div style={{ fontSize:10, color:DIM, padding:'8px 10px', borderRadius:8, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', marginBottom:8 }}>
                <b style={{ color: scoreColor(scoring.level) }}>RSS {scoring.score} {scoreLabel(scoring.score)}</b> · v{Math.round(scoring.verification*100)}% · {scoring.findings.slice(0,2).map(f=>f.text).join(' · ')}
              </div>
            )}
            {forceHistory.stats.length>0 && (
              <div style={{ padding:'8px 10px', borderRadius:8, background:'#0a1629', border:'1px solid #1f3a5f' }}>
                <div style={{ fontSize:11, fontWeight:700, color:'#fff' }}>Fatigue 12-нед (патент WO2026106582A1)</div>
                <div style={{ fontSize:10, color:DIM }}>Avg {forceHistory.stats[0]?.avg}→{forceHistory.stats[forceHistory.stats.length-1]?.avg} · Max {forceHistory.stats[0]?.max}→{forceHistory.stats[forceHistory.stats.length-1]?.max} · Fatigue {forceHistory.fatigue?.first}%→{forceHistory.fatigue?.last}% ({forceHistory.fatigue?.improving? '↓ адаптация':'↑ усталость'})</div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Diagnostics output — механизм-ориентированная + 12 мёртвых точек */}
      <div style={{ ...CARD, padding: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: ACCENT, marginBottom: 6 }}>🔬 Диагностика — мёртвые точки (12) + сустав/сухожилие</div>
        <div style={{ fontSize:11, color:DIM, marginBottom:8 }}>{report.findings.slice(0,3).map((f:any)=>f.text).join(' · ')} {report.asymmetryPct!=null ? `· Асим ${report.asymmetryPct}%` : ''} {(report as any).weakPoints?.length? `· точек ${(report as any).weakPoints.join(', ')}` : ''}</div>
        {report.findings.length>3 && <div style={{ fontSize:10, color:DIM, marginTop:6, maxHeight:80, overflowY:'auto', padding:'6px 8px', background:'rgba(255,255,255,0.03)', borderRadius:8, border:'1px solid rgba(255,255,255,0.06)' }}>{report.findings.map((f:any,i:number)=><div key={i} style={{ color: f.level==='critical'?'#ef4444': f.level==='warn'?'#f59e0b':'#22c55e', marginBottom:2 }}>• {f.text} {f.level!=='ok'?'('+f.level+')':''}</div>)}</div>}
        {/* 12 точек карточки */}
        {(diag as any).biomechCards?.length ? (
          <div style={{ display:'flex', flexDirection:'column', gap:8, marginTop:8 }}>
            {(diag as any).biomechCards.map((c:any)=>(
              <div key={c.weakPoint} style={{ padding:'10px 12px', borderRadius:10, background:'#0a1629', border:'1px solid rgba(245,158,11,0.18)' }}>
                <div style={{ display:'flex', gap:6, flexWrap:'wrap', alignItems:'center', marginBottom:4 }}>
                  <span style={{ fontSize:12, fontWeight:800, color:'#fff' }}>{c.label}</span>
                  <span style={{ fontSize:10, padding:'2px 6px', borderRadius:999, background:'rgba(245,158,11,0.12)', color:'#f59e0b', border:'1px solid rgba(245,158,11,0.18)' }}>{c.angleRangeDeg[0]}-{c.angleRangeDeg[1]}° {c.keyJoint}</span>
                  <span style={{ fontSize:10, color:DIM }}>{c.weakMuscles.join('/')}</span>
                  <span style={{ marginLeft:'auto', fontSize:10, color: (()=>{ const aj2 = angleJointForWeakPoint(c.weakPoint as ArmWeakPoint); if (aj2==='none') return DIM; const d2 = aj2==='wrist' ? angles.wristDeg : aj2==='elbow' ? angles.elbowDeg : angles.forearmDeg; return isValidAngleForArmWeakPoint(c.weakPoint as ArmWeakPoint, d2) ? '#22c55e' : '#ef4444'; })() }}>{(()=>{ const aj3 = angleJointForWeakPoint(c.weakPoint as ArmWeakPoint); if (aj3==='none') return '• угол н/п'; const d3 = aj3==='wrist' ? angles.wristDeg : aj3==='elbow' ? angles.elbowDeg : angles.forearmDeg; return isValidAngleForArmWeakPoint(c.weakPoint as ArmWeakPoint, d3) ? '✅' : '⚠ вне диапазона'; })()}</span>
                </div>
                <div style={{ fontSize:10, color:DIM, marginBottom:4 }}>{c.reason}</div>
                <div style={{ fontSize:11, color:'#5ee', marginBottom:4 }}><b>Коррекции:</b> {c.corrections.join(' · ')} @ {Math.round(c.intensityPct*100)}% · <i>{c.loadCues}</i> · VBT warn {vbtThresholdForWeakPoint(c.weakPoint as ArmWeakPoint).warnPct}%/stop {vbtThresholdForWeakPoint(c.weakPoint as ArmWeakPoint).stopPct}%</div>
                <div style={{ fontSize:10, color:DIM }}>День {ARM_CORRECTIONS[c.weakPoint as ArmWeakPoint]?.dayTags[0] || '—'} · {ARM_CORRECTIONS[c.weakPoint as ArmWeakPoint]?.sets}×{ARM_CORRECTIONS[c.weakPoint as ArmWeakPoint]?.repsRange.join('-')} RIR{ARM_CORRECTIONS[c.weakPoint as ArmWeakPoint]?.rir} {ARM_CORRECTIONS[c.weakPoint as ArmWeakPoint]?.holdSeconds?`hold ${ARM_CORRECTIONS[c.weakPoint as ArmWeakPoint]?.holdSeconds}с`:''} · {c.technique.join('/')}</div>
              </div>
            ))}
          </div>
        ) : diag.priorities.length===0 ? <div style={{ fontSize:11, color:DIM, marginTop:8 }}>Слабые зоны не выявлены — баланс. {dynamicReport && (dynamicReport as any).asymmetry ? `· ${(dynamicReport as any).tactic}` : ''}</div> : (
          <div style={{ display:'flex', flexDirection:'column', gap:8, marginTop:8 }}>
            {diag.priorities.map((p,i)=>(
              <div key={i} style={{ padding:'10px 12px', borderRadius:10, background:'#0a1629', border:'1px solid #1f3a5f' }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                  <span style={{ fontSize:12, fontWeight:800, color:'#fff' }}>{ARM_MUSCLE_RU[p.muscle as any] || p.muscle}</span>
                  <span style={{ fontSize:10, color:DIM }}>{p.reason}</span>
                </div>
                <div style={{ fontSize:11, color:'#5ee', marginBottom:6 }}>{p.exercises.join(' · ')}</div>
                <div style={{ fontSize:10, color:DIM }}>MEV {getArmLandmarks(state.level, p.muscle).mev} · MAV {getArmLandmarks(state.level, p.muscle).mav} · MRV <b style={{color:'#fff'}}>{getArmLandmarks(state.level, p.muscle).mrv}</b> · Tendon {getArmLandmarks(state.level, p.muscle).mrv <=9?'низкий (humerus)':''}</div>
              </div>
            ))}
          </div>
        )}
        {(report as any).corrections?.length ? (
          <div style={{ marginTop:8, padding:'8px 10px', borderRadius:8, background:'rgba(0,230,138,0.08)', border:'1px solid rgba(0,230,138,0.12)', fontSize:10, color:DIM }}>
            <b style={{color:'#00e68a'}}>Инъекция в план (предпросмотр):</b> {(report as any).corrections.map((c:any)=> `${c.weakPoint}→${c.exercises[0]} @${Math.round(c.intensityPct*100)}% в ${c.dayTags[0]}`).join(' · ')}
            <div style={{ marginTop:4, color:DIM }}>Дней инъекции: {Array.from(new Set((report as any).corrections.map((c:any)=>c.dayTags[0]))).join(', ')} · per-day dedup, budget {(report as any).scoring ? `RSS ${(report as any).scoring.score}` : ''}</div>
          </div>
        ) : null}
        {dynamicReport && (dynamicReport as any).metrics && (
          <div style={{ marginTop:8, padding:'8px 10px', borderRadius:8, background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.16)', fontSize:10, color:DIM }}>
            <b style={{color:'#f59e0b'}}>Динамика F/t:</b> avgFt {(dynamicReport as any).avgFt ?? '—'} кг/с · total {(dynamicReport as any).totalF ?? '—'}кг · tactic {(dynamicReport as any).tactic} · {Object.entries((dynamicReport as any).metrics).map(([k,v]:any)=> v? `${k}:${v.ftIndex}`:'' ).filter(Boolean).join(' · ') || ''}
          </div>
        )}
        {showScoring && scoring && (
          <div style={{ marginTop:8, padding:'8px 10px', borderRadius:8, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)', fontSize:10, color:DIM }}>
            <b style={{color: scoreColor(scoring.level)}}>RSS {scoring.score} {scoreLabel(scoring.score)}</b> · v{Math.round(scoring.verification*100)}% · {scoring.findings.map(f=>f.text).join(' · ')} {scoring.floors.length? `· floor ${scoring.floors.join(', ')}` : ''}
          </div>
        )}
      </div>

      {/* P0 PRO: план → аудит → причины → топ-3 → спец-блок → инъекция → дневник */}
      <div style={{ ...CARD, padding: 12, background: 'rgba(0,230,138,0.06)', border: '1px solid rgba(0,230,138,0.16)' }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: ACCENT, marginBottom: 6 }}>🧬 P0 PRO — план → причины → топ-3 → спец-блок → инъекция</div>
        <div style={{ fontSize: 10, color: DIM, marginBottom: 8 }}>
          {armAudit ? `Аудит плана: покрытие ${armAudit.covered.length}/12 (${armAudit.coveragePct}%) · стол ${(armAudit.tableRatio * 100).toFixed(0)}% · статика ${armAudit.staticSets}/динамика ${armAudit.dynamicSets}${armAudit.duplicates.length ? ` · дубли: ${armAudit.duplicates.slice(0, 3).join(', ')}` : ''}` : 'Нет плана арм (he_arm_plan_saved / he_arm_last_plan) — собери в Арм-конструкторе; причины и топ-3 работают и без плана'}
          {armWorst ? ` · 🎯 худшая из выбранных: ${armWorst}` : ''}
        </div>
        {state.weakPoints.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
            {state.weakPoints.map((wp) => {
              const cause = (armCausesP0 as any)[wp];
              const top = (armTop3P0 as any)[wp] || [];
              const sim = (() => { try { return simulateArmInjection(armPlan as any, wp); } catch { return null; } })();
              return (
                <div key={wp} style={{ padding: '8px 10px', borderRadius: 8, background: '#0a1629', border: '1px solid rgba(0,230,138,0.18)' }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#fff' }}>{wp} {cause ? `· ${cause.cause} (${Math.round(cause.confidence * 100)}%)` : ''}</div>
                  {cause && <div style={{ fontSize: 10, color: DIM, marginTop: 2 }}>{cause.evidence.join(' · ')} → <b style={{ color: ACCENT }}>{cause.fix}</b></div>}
                  {top.length > 0 && <div style={{ fontSize: 10, color: '#5ee', marginTop: 4 }}>Топ-3: {top.map((t: any) => `${t.id} (${t.score})`).join(' · ')} {sim ? `· Δ ${sim.summary}` : ''}</div>}
                </div>
              );
            })}
          </div>
        )}
        <div style={{ fontSize: 10, color: DIM, marginBottom: 6 }}>
          {armSpecP0 ? `${armSpecP0.summary} · волна: ${armSpecP0.weeks.slice(0, 4).map((w) => `Н${w.week}:${w.kind}`).join(' ')}` : ''}
          {diaryTrendsP0.length ? ` · 📊 дневник: ${diaryTrendsP0.map((t) => `${t.muscle} ${t.deltaPct}% (${t.status})`).join(', ')}` : ' · 📊 дневник: нет e1RM-тренда (нужны сессии 28-56д)'}
          {diarySuggestP0.length ? ` → подсказка: ${diarySuggestP0.join(', ')}` : ''}
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <label style={{ fontSize: 10, color: DIM }}>Нед спец-блока<br />
            <input inputMode="numeric" value={specWeeks} onChange={(e) => setSpecWeeks(e.target.value)} style={{ width: 56, marginTop: 4, background: '#0a1629', color: '#fff', border: '1px solid #1f3a5f', borderRadius: 6, padding: '4px 6px', fontSize: 11 }} />
          </label>
          {armWorst && !state.weakPoints.includes(armWorst as any) && (
            <button onClick={() => toggleWeakPoint(armWorst as any)} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #f59e0b', background: 'rgba(245,158,11,0.12)', color: '#f59e0b', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>🎯 Худшая в плане: {armWorst} → разобрать</button>
          )}
          {diarySuggestP0.length > 0 && (
            <button onClick={() => { for (const p of diarySuggestP0.slice(0, 3)) if (!state.weakPoints.includes(p as any)) toggleWeakPoint(p as any); }} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #1f3a5f', background: '#0a1629', color: DIM, cursor: 'pointer', fontSize: 11 }}>📊 Дневник → в слабые ({diarySuggestP0.slice(0, 3).join(', ')})</button>
          )}
          <button onClick={handleInjectP0} style={{ padding: '8px 12px', borderRadius: 8, background: 'linear-gradient(135deg,#00e68a,#0aa)', color: '#fff', border: 'none', fontWeight: 800, fontSize: 12, cursor: 'pointer' }}>💉 Вставить коррекции в план ({state.weakPoints.length || 0})</button>
          {hasInjectPrev && (
            <button onClick={handleRollbackP0} style={{ padding: '8px 12px', borderRadius: 8, background: '#0a1629', border: '1px solid #1f3a5f', color: DIM, cursor: 'pointer', fontSize: 11 }}>↩ Откат</button>
          )}
          <button onClick={handleExportHtmlP0} style={{ padding: '8px 12px', borderRadius: 8, background: '#0a1629', border: '1px solid #1f3a5f', color: DIM, cursor: 'pointer', fontSize: 11 }}>🖨 HTML</button>
          <button onClick={handleExportCsvP0} style={{ padding: '8px 12px', borderRadius: 8, background: '#0a1629', border: '1px solid #1f3a5f', color: DIM, cursor: 'pointer', fontSize: 11 }}>📥 CSV</button>
          {criticalSideP0 && <span style={{ fontSize: 10, color: '#ef4444' }}>🔴 критично — side только ремень/изометрия</span>}
        </div>
        {injectMsg && <div style={{ marginTop: 6, fontSize: 11, color: injectMsg.startsWith('✓') || injectMsg.startsWith('↩') ? '#22c55e' : '#f59e0b' }}>{injectMsg}</div>}
      </div>

      {/* Table periodization */}
      <div style={{ ...CARD, padding: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: ACCENT, marginBottom: 6 }}>🗓 Стол — периодизация 3/2/1 (Кузнецов VIII) — ≥50% стол</div>
        <div style={{ display:'flex', gap:2, marginBottom:6 }}>
          {tablePreview.map(({ wk, kind }) => {
            const col = kind==='moderate'? '#22c55e' : kind==='heavy'? '#f59e0b' : '#ef4444';
            return <div key={wk} style={{ flex:1, height:18, background:col, borderRadius:4, display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:9, fontWeight:700 }}>{wk}:{kind[0]}</div>;
          })}
        </div>
        <div style={{ fontSize:10, color:DIM }}>≥50% тренировок — стол. Тейпер 2–3 нед: 0.65/0.45, side×0.5, RIR+1/+2. Moderate 50-75% 1-3мин / Heavy 75-100% 10с-1мин / Stress 100-125% 5-10с.</div>
        {forceHistory.trend && <div style={{ fontSize:10, color:ACCENT, marginTop:4 }}>{forceHistory.trend.text}</div>}
      </div>

      {/* Action */}
      <div style={{ ...CARD, padding: 12, background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.16)' }}>
        <button onClick={applyToConstructor} style={{ width:'100%', padding:'10px 14px', borderRadius:8, background:'linear-gradient(135deg,#f59e0b,#ef4444)', color:'#fff', border:'none', fontWeight:800, fontSize:13, cursor:'pointer' }}>→ Применить в Арм-конструктор ({(state.weakPoints.length? state.weakPoints.join(', ') : diag.weakMuscles.slice(0,2).join(', ')) || (dynamicReport && Object.keys((dynamicReport as any).metrics||{}).length ? 'динамика' : 'баланс')} · {(state.weakPoints.length? `${state.weakPoints.length} точек` : `${diag.weakMuscles.length} мышц`)})</button>
        <div style={{ fontSize:10, color:DIM, marginTop:6, textAlign:'center' }}>Bridge: <code>weakpoints</code> → <code>ArmAutoConstructor</code> via <code>planner-bridge</code> · <code>armWeakPoints(12)</code>+<code>biomechCards</code>+<code>corrections</code>+<code>armDynamic</code>+<code>scoring</code> в payload · dedup/budget/humerus gated</div>
        {(diag as any).biomechCards?.length ? <div style={{ fontSize:10, color:DIM, marginTop:4, textAlign:'center' }}>Инъекция: {(diag as any).biomechCards.map((c:any)=> `${c.weakPoint}→${c.corrections[0]}`).join(' · ')} · per-day ≤8, budget {(report as any).scoring?.score ?? ''}</div> : null}
      </div>
    </div>
  );
};

export default ArmDiagnosticsHub;
