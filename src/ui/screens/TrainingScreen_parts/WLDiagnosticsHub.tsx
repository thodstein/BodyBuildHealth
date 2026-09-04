/** WLDiagnosticsHub.tsx — ТА-диагностика — хаб движения PRO (v2)
 *  Рывок 5 фаз + взятие 3 + толчок 3 × числовые углы (биомеханика) + bar path PRO (Vorobyev типы + метрики + SRD)
 *  + VBT peak zones (PLOS 2026) + FvR2 (Sandau) + OHS 6-сегментов + асимметрия + IMTP/ISPP + diary e1RM + RSS scoring
 *  + LIMITER-коррекции + видео Kinovea/Enode + apply в StrengthSportConstructor (weightlifting)
 */
import React, { useMemo, useState, useEffect } from 'react';
import { WL_WEAKPOINT_LABELS, WL_WEAKPOINT_CORRECTION, type WLWeakPoint } from '../../../engines/strength-sport/strength-sport-weakpoint';
import { TA_BIOMECH, diagnoseTAWeakPoint, autoValidateAnglesFromPose, autoOHSFromPose } from '../../../engines/strength-sport/strength-sport-biomechanics.engine';
import { diagnoseBarPath, type BarPathDeviation, BAR_PATH_LABELS } from '../../../engines/strength-sport/strength-sport-diagnostics';
import { classifyTrajectoryType, computeBarPathMetrics, diagnoseBarPathFromMetrics, isRealChange, correctEnodeHorizontal, extractBfPCAPatterns, type BarPathMetrics } from '../../../engines/strength-sport/strength-sport-barpath.engine';
import { loadBarTracking } from '../../../engines/strength-sport/strength-sport-video.engine';
import { diagnoseJerkDip } from '../../../engines/strength-sport/strength-sport-biomechanics.engine';
import { optimalFvSlopeForPmax, vbtEwma } from '../../../engines/strength-sport/strength-sport-vbt.engine';
import { applyToPlanner } from './planner-bridge';
import { CARD, DIM, ACCENT } from './training-ui';
import { loadSRPESessions } from '../../../engines/pro/srpe-store';
import { toDailyLoads, acuteChronicRatio } from '../../../engines/pro/training-load.engine';
import { scoreTA, scoreColor } from '../../../engines/strength-sport/strength-sport-scoring.engine';
import { assessOHS, OHS_NORMS } from '../../../engines/strength-sport/strength-sport-ohs.engine';
import { TA_PEAK_VELOCITY_ZONES, taVthresNorms, computeFvR2, taZoneForVelocity, thresholdForTALift, velocityTypeForLift } from '../../../engines/strength-sport/strength-sport-vbt.engine';
import { calibrateLVP, saveLVPProfile, loadLVPProfiles, velocityForLVP } from '../../../engines/strength-sport/strength-sport-lvp-calibration.engine';
import { diagnoseVelocityLossSS, vbtRecommendationSS } from '../../../engines/strength-sport/strength-sport-vbt.engine';
import { LIMITER_CATEGORIES, LIMITER_OPTIONS } from '../../../engines/pro/limiter-calculator.engine';
import { parseKinoveaCSV, analyzeBarTracking } from '../../../engines/strength-sport/strength-sport-video.engine';
import { estimateAnglesFromLandmarks, livePoseStatus, createMockPoseStream, parsePoseAnglesCsv, summarizePoseAngles, avgAnglesOfSummary } from '../../../engines/strength-sport/strength-sport-pose.engine';
import { buildWLDiagnosticsHtml, downloadWLHtml, downloadWLCsv } from '../../../engines/strength-sport/strength-sport-wl-export.engine';
import { detectTAWeakFromDiary, candidateTAWeakPointsFromDiary } from '../../../engines/strength-sport/strength-sport-diary-integration.engine';
import { auditTAPlan, hubTabForPhase } from '../../../engines/strength-sport/strength-sport-ta-plan-audit.engine';
import { diagnoseTAWeakCause, TA_WEAK_CAUSE_LABELS } from '../../../engines/strength-sport/strength-sport-ta-weak-cause.engine';
import { rankCorrectionsForTA } from '../../../engines/strength-sport/strength-sport-ta-correction-rank.engine';
import { simulateTACorrection } from '../../../engines/strength-sport/strength-sport-ta-simulator.engine';
import { buildTASpecBlock } from '../../../engines/strength-sport/strength-sport-ta-spec-block.engine';
import { diagnoseTAAnthro } from '../../../engines/strength-sport/strength-sport-ta-anthro.engine';
import { diagnoseSplitJerkAsymmetry, appendSplitJerkSnapshot, splitJerkTrend, type SplitJerkSnapshot } from '../../../engines/strength-sport/strength-sport-ta-asymmetry.engine';
import { planTAAttempts } from '../../../engines/strength-sport/strength-sport-ta-attempts.engine';
import { injectTAWeakPoints, snapshotTAPlanForInject, rollbackTAPlanInject, hasTAPlanPrev } from '../../../engines/strength-sport/strength-sport-ta-injection.engine';

const STORAGE_KEY = 'he_wl_diagnostics_hub_v1';

type WLTab = 'snatch' | 'clean' | 'jerk' | 'mobility' | 'vbt' | 'video';

type WLState = {
  snatchWeak: WLWeakPoint[];
  cleanWeak: WLWeakPoint[];
  jerkWeak: WLWeakPoint[];
  barPath: BarPathDeviation | '';
  barLift: string;
  leftMax: string;
  rightMax: string;
  vbtWeight: string;
  vbtVel: string;
  vbtBest: string;
  vbtLast: string;
  vbtVthres: string;
  fvrLoad80: string;
  fvrVmax80: string;
  fvrLoad110: string;
  fvrVmax110: string;
  fvrHAcc: string;
  // LVP ramp 50/65/75/90
  lvpLift: string;
  lvp50: string;
  lvp65: string;
  lvp75: string;
  lvp90: string;
  lvpResult: string;
  // OHS 6 segments
  ohsHeelsFlat: boolean;
  ohsKneeValgus: boolean;
  ohsHipBelowParallel: boolean;
  ohsTrunkUpright: boolean;
  ohsArmsOverMidfoot: boolean;
  ohsLumbarNeutral: boolean;
  overheadSquat: string; // совместимость: старый ввод глубины (legacy)
  ankleDorsiflex: string; // legacy deg
  kneeToWallCm: string;
  ankleDeg: string;
  heelRetest: '' | 'better' | 'same';
  // IMTP
  imtpKg: string;
  isppKg: string;
  // Bar path metrics (ручной ввод)
  xLoopCm: string;
  yMaxCm: string;
  peakVelMs: string;
  // E3: предпочитаемая коррекция на фазу (идёт первой в инъекцию E6)
  preferredCorr: Record<string, string>;
  // E7: jerk dip метрики + bfPCA сводка
  jerkDipCm: string;
  jerkDipMs: string;
  bfPattern: string;
  // E8: углы суставов с видео (CSV трекера поз)
  poseCsv: string;
  // E9: антропометрия ТА
  anthroHeight: string;
  anthroArmSpan: string;
  anthroShoulder: string;
  // E11: split-jerk ноги (левая/правая впереди)
  jerkLeftFwd: string;
  jerkRightFwd: string;
  // E12: заявки и скорости стандарта для попыток
  taSnatchMax: string;
  taCjMax: string;
  taVelStd: string;
  taVelToday: string;
  taStrategy: string;
};

const DEFAULT_STATE: WLState = {
  snatchWeak: [], cleanWeak: [], jerkWeak: [],
  barPath: '', barLift: 'snatch',
  leftMax: '', rightMax: '',
  vbtWeight: '', vbtVel: '', vbtBest: '', vbtLast: '', vbtVthres: '',
  fvrLoad80: '', fvrVmax80: '', fvrLoad110: '', fvrVmax110: '', fvrHAcc: '0.8',
  lvpLift: 'snatch', lvp50: '2.70', lvp65: '2.15', lvp75: '1.80', lvp90: '1.55', lvpResult: '',
  ohsHeelsFlat: true, ohsKneeValgus: false, ohsHipBelowParallel: true, ohsTrunkUpright: true, ohsArmsOverMidfoot: true, ohsLumbarNeutral: true,
  overheadSquat: '', ankleDorsiflex: '',
  kneeToWallCm: '', ankleDeg: '',
  heelRetest: '',
  imtpKg: '', isppKg: '',
  xLoopCm: '', yMaxCm: '', peakVelMs: '',
  preferredCorr: {},
  jerkDipCm: '', jerkDipMs: '', bfPattern: '',
  // E8: углы суставов с видео (CSV трекера поз)
  poseCsv: '',
  // E9: антропометрия ТА
  anthroHeight: '', anthroArmSpan: '', anthroShoulder: '',
  // E11: split-jerk ноги
  jerkLeftFwd: '', jerkRightFwd: '',
  // E12: заявки/скорости/стратегия
  taSnatchMax: '', taCjMax: '', taVelStd: '', taVelToday: '', taStrategy: 'balanced',
};

const TAB_DEFS: Array<{ id: WLTab; label: string; icon: string; desc: string }> = [
  { id: 'snatch', label: 'Рывок', icon: '🏋️', desc: '5 фаз + углы' },
  { id: 'clean', label: 'Взятие', icon: '🏋️‍♂️', desc: '3 фазы + ISPP' },
  { id: 'jerk', label: 'Толчок', icon: '🦾', desc: '3 фазы + drive' },
  { id: 'vbt', label: 'VBT/FvR', icon: '⚡', desc: 'пик-зоны + FvR2' },
  { id: 'video', label: 'Видео', icon: '📹', desc: 'Kinovea/Enode' },
  { id: 'mobility', label: 'Мобильность', icon: '🧘', desc: 'OHS 6 + асимметрия' },
];

export const WLDiagnosticsHub: React.FC = () => {
  const [state, setState] = useState<WLState>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const merged = { ...DEFAULT_STATE, ...(raw ? JSON.parse(raw) : {}) };
      // E9: пустые антропо-поля — из профиля (разово, ручной ввод приоритетнее)
      try {
        const p = JSON.parse(localStorage.getItem('he_profile_v2') || '{}');
        const personal = p?.personal ?? p?.settings?.personal ?? {};
        if (!merged.anthroArmSpan && Number.isFinite(personal.armSpanCm)) merged.anthroArmSpan = String(personal.armSpanCm);
        if (!merged.anthroShoulder && Number.isFinite(personal.shoulderWidthCm)) merged.anthroShoulder = String(personal.shoulderWidthCm);
        if (!merged.anthroHeight && Number.isFinite(personal.height)) merged.anthroHeight = String(personal.height);
      } catch { /* noop */ }
      return merged;
    } catch {}
    return DEFAULT_STATE;
  });
  const [tab, setTab] = useState<WLTab>('snatch');
  const [toast, setToast] = useState<string>('');
  const [csvText, setCsvText] = useState<string>('');
  // Нонс перечитывания плана ТА из хранилища (инъекция/откат меняют его мимо мемов)
  const [planNonce, setPlanNonce] = useState(0);
  // E6: флаг снапшота до инъекции (откат)
  const [hasInjectPrev, setHasInjectPrev] = useState<boolean>(() => {
    try { return hasTAPlanPrev(); } catch { return false; }
  });

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
  }, [state]);

  const acwr = useMemo(() => {
    try {
      const srpe = loadSRPESessions();
      if (srpe.length < 2) return null;
      return acuteChronicRatio(toDailyLoads(srpe as any));
    } catch { return null; }
  }, []);

  const diaryWeaks = useMemo(() => {
    try {
      const raw = localStorage.getItem('he_workout_log_v1') || localStorage.getItem('he_training_log');
      const logs = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(logs)) return [];
      return detectTAWeakFromDiary(logs as any);
    } catch { return []; }
  }, []);

  const diaryPhases = useMemo(() => {
    try {
      const raw = localStorage.getItem('he_workout_log_v1') || localStorage.getItem('he_training_log');
      const logs = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(logs)) return [];
      const sn = candidateTAWeakPointsFromDiary(logs as any, 'snatch');
      const cl = candidateTAWeakPointsFromDiary(logs as any, 'clean');
      const jk = candidateTAWeakPointsFromDiary(logs as any, 'jerk');
      return [...sn, ...cl, ...jk].slice(0, 3);
    } catch { return []; }
  }, []);

  const weakPoints = useMemo(() => {
    const all: WLWeakPoint[] = [...state.snatchWeak, ...state.cleanWeak, ...state.jerkWeak];
    return Array.from(new Set(all)).slice(0, 3);
  }, [state.snatchWeak, state.cleanWeak, state.jerkWeak]);

  const barPathDiag = useMemo(() => {
    if (!state.barPath) return null;
    return diagnoseBarPath(state.barLift, state.barPath as BarPathDeviation);
  }, [state.barPath, state.barLift]);

  const barMetrics: BarPathMetrics | null = useMemo(() => {
    const xLoop = parseFloat(state.xLoopCm);
    const yMax = parseFloat(state.yMaxCm);
    const vMax = parseFloat(state.peakVelMs);
    if (!Number.isFinite(xLoop) && !Number.isFinite(yMax) && !Number.isFinite(vMax)) return null;
    return {
      xMin: -xLoop / 2 || 0,
      xMax: xLoop / 2 || 0,
      xLoop: Number.isFinite(xLoop) ? xLoop : 0,
      yMax: Number.isFinite(yMax) ? yMax : 0,
      vMax: Number.isFinite(vMax) ? vMax : 0,
      trajectoryType: 'unknown',
    };
  }, [state.xLoopCm, state.yMaxCm, state.peakVelMs]);

  const barMetricsDiag = useMemo(() => barMetrics ? diagnoseBarPathFromMetrics(barMetrics, state.barLift) : null, [barMetrics, state.barLift]);

  const asymmetry = useMemo(() => {
    const l = parseFloat(state.leftMax);
    const r = parseFloat(state.rightMax);
    if (!Number.isFinite(l) || !Number.isFinite(r) || !l || !r) return null;
    const diff = Math.abs(l - r) / Math.max(l, r) * 100;
    return { diff: Math.round(diff * 10) / 10, isAsym: diff >= 7, isCrit: diff >= 12, weaker: l < r ? 'left' : 'right' };
  }, [state.leftMax, state.rightMax]);

  const ohs = useMemo(() => assessOHS({
    heelsFlat: state.ohsHeelsFlat, kneeValgus: state.ohsKneeValgus, hipBelowParallel: state.ohsHipBelowParallel,
    trunkUpright: state.ohsTrunkUpright, armsOverMidfoot: state.ohsArmsOverMidfoot, lumbarNeutral: state.ohsLumbarNeutral,
    kneeToWallCm: state.kneeToWallCm ? parseFloat(state.kneeToWallCm) : null,
    ankleDorsiflexDeg: state.ankleDeg ? parseFloat(state.ankleDeg) : state.ankleDorsiflex ? parseFloat(state.ankleDorsiflex) : null,
    heelRaiseRetest: state.heelRetest === 'better' ? true : state.heelRetest === 'same' ? false : null,
  }), [state.ohsHeelsFlat, state.ohsKneeValgus, state.ohsHipBelowParallel, state.ohsTrunkUpright, state.ohsArmsOverMidfoot, state.ohsLumbarNeutral, state.kneeToWallCm, state.ankleDeg, state.ankleDorsiflex, state.heelRetest]);

  const vbtLoss = useMemo(() => {
    const best = parseFloat(state.vbtBest);
    const last = parseFloat(state.vbtLast);
    if (!Number.isFinite(best) || !Number.isFinite(last) || !best) return null;
    const lift = state.barLift || 'snatch';
    const thr = thresholdForTALift(lift) as any;
    const r = diagnoseVelocityLossSS(best, last, thr, state.vbtWeight ? parseFloat(state.vbtWeight) : undefined, lift);
    return r;
  }, [state.vbtBest, state.vbtLast, state.vbtWeight, state.barLift]);

  const vbtZone = useMemo(() => {
    const vel = parseFloat(state.vbtVel || state.peakVelMs);
    if (!Number.isFinite(vel)) return null;
    const lift = state.barLift.includes('clean') ? 'clean' : state.barLift.includes('jerk') ? 'jerk' : 'snatch';
    return taZoneForVelocity(vel, lift);
  }, [state.vbtVel, state.peakVelMs, state.barLift]);

  const fvr = useMemo(() => {
    const l80 = parseFloat(state.fvrLoad80), v80 = parseFloat(state.fvrVmax80), l110 = parseFloat(state.fvrLoad110), v110 = parseFloat(state.fvrVmax110), h = parseFloat(state.fvrHAcc), vt = parseFloat(state.vbtVthres);
    if (![l80, v80, l110, v110, h, vt].every(Number.isFinite)) return null;
    return computeFvR2({ load80: l80, vmax80: v80, load110: l110, vmax110: v110, hAcc: h || 0.8, vThres: vt });
  }, [state.fvrLoad80, state.fvrVmax80, state.fvrLoad110, state.fvrVmax110, state.fvrHAcc, state.vbtVthres]);

  const isppRatio = useMemo(() => {
    const imtp = parseFloat(state.imtpKg), ispp = parseFloat(state.isppKg);
    if (!Number.isFinite(imtp) || !Number.isFinite(ispp) || !imtp) return null;
    return ispp / imtp;
  }, [state.imtpKg, state.isppKg]);

  // E7: вес из профиля (для drivePower толчка) + jerk dip + FvR-оптимум + VBT-тренд истории
  const profileWeightKg = useMemo(() => {
    try {
      const p = JSON.parse(localStorage.getItem('he_profile_v2') || '{}');
      const w = p?.settings?.personal?.weight ?? p?.personal?.weight;
      return Number.isFinite(w) && w > 0 ? w : undefined;
    } catch { return undefined; }
  }, []);
  // E10: пол из профиля — женские нормы (Type3, VBT-бенчмарки)
  const profileSex = useMemo(() => {
    try {
      const p = JSON.parse(localStorage.getItem('he_profile_v2') || '{}');
      const s = p?.settings?.personal?.sex ?? p?.personal?.sex;
      return s === 'female' || s === 'male' ? s : null;
    } catch { return null; }
  }, []);
  const jerkDip = useMemo(() => {
    const cm = parseFloat(state.jerkDipCm), ms = parseFloat(state.jerkDipMs);
    if (!Number.isFinite(cm) || !Number.isFinite(ms)) return null;
    return diagnoseJerkDip(cm, ms, profileWeightKg);
  }, [state.jerkDipCm, state.jerkDipMs, profileWeightKg]);
  const fvrOptimal = useMemo(() => {
    if (!fvr) return null;
    const opt = optimalFvSlopeForPmax(fvr.Pmax);
    const diff = Math.round((fvr.slope - opt) * 100) / 100;
    return { opt, diff, forceDom: fvr.slope < opt };
  }, [fvr]);

  // E12: попытки на старт (заявка; рывок по умолчанию из FvR snatchTh)
  const attemptArgs = useMemo(() => {
    const strat = state.taStrategy === 'conservative' || state.taStrategy === 'aggressive' ? state.taStrategy : 'balanced';
    const std = state.taVelStd ? parseFloat(state.taVelStd) : null;
    const today = state.taVelToday ? parseFloat(state.taVelToday) : null;
    return { strat, std, today };
  }, [state.taStrategy, state.taVelStd, state.taVelToday]);
  const snatchAttempts = useMemo(() => {
    try {
      const manual = state.taSnatchMax ? parseFloat(state.taSnatchMax) : NaN;
      const base = Number.isFinite(manual) && manual > 0 ? manual : fvr?.snatchTh ?? null;
      if (base == null) return null;
      return planTAAttempts({ declaredMaxKg: base, strategy: attemptArgs.strat as any, peakVelStandard: attemptArgs.std, peakVelToday: attemptArgs.today });
    } catch { return null; }
  }, [state.taSnatchMax, fvr, attemptArgs]);
  const cjAttempts = useMemo(() => {
    try {
      const manual = state.taCjMax ? parseFloat(state.taCjMax) : NaN;
      if (!Number.isFinite(manual) || manual <= 0) return null;
      return planTAAttempts({ declaredMaxKg: manual, strategy: attemptArgs.strat as any, peakVelStandard: attemptArgs.std, peakVelToday: attemptArgs.today });
    } catch { return null; }
  }, [state.taCjMax, attemptArgs]);
  const barTrend = useMemo(() => {
    try {
      const hist = loadBarTracking();
      if (!hist.length) return null;
      const vels = hist.map(h => h.vmax).filter(v => Number.isFinite(v) && v > 0);
      if (vels.length < 2) return null;
      const last = vels.slice(-5);
      return { from: last[0], to: last[last.length - 1], ewma: vbtEwma(vels), n: vels.length };
    } catch { return null; }
  }, [csvText]);

  // E8: углы с видео → сводка + автовалидация фаз + OHS-прогноз
  const poseSummary = useMemo(() => {
    try {
      if (!state.poseCsv.trim()) return null;
      return summarizePoseAngles(parsePoseAnglesCsv(state.poseCsv));
    } catch { return null; }
  }, [state.poseCsv]);
  const poseValidation = useMemo(() => {
    try {
      if (!poseSummary) return [];
      return autoValidateAnglesFromPose(avgAnglesOfSummary(poseSummary), weakPoints.length ? weakPoints : undefined);
    } catch { return []; }
  }, [poseSummary, weakPoints]);
  const poseOhs = useMemo(() => {
    try {
      if (!poseSummary) return null;
      return autoOHSFromPose(avgAnglesOfSummary(poseSummary));
    } catch { return null; }
  }, [poseSummary]);

  // E9: антропометрия → хват/старт
  const anthro = useMemo(() => {
    try {
      return diagnoseTAAnthro({
        heightCm: state.anthroHeight ? parseFloat(state.anthroHeight) : null,
        armSpanCm: state.anthroArmSpan ? parseFloat(state.anthroArmSpan) : null,
        shoulderCm: state.anthroShoulder ? parseFloat(state.anthroShoulder) : null,
      });
    } catch { return null; }
  }, [state.anthroHeight, state.anthroArmSpan, state.anthroShoulder]);

  // E11: split-jerk асимметрия + история
  const [jerkHist, setJerkHist] = useState<SplitJerkSnapshot[]>(() => {
    try {
      const raw = localStorage.getItem('he_ta_split_jerk_hist');
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr.filter(s => s && typeof s.date === 'string') : [];
    } catch { return []; }
  });
  const jerkAsym = useMemo(() => {
    try {
      return diagnoseSplitJerkAsymmetry({
        leftForwardKg: state.jerkLeftFwd ? parseFloat(state.jerkLeftFwd) : null,
        rightForwardKg: state.jerkRightFwd ? parseFloat(state.jerkRightFwd) : null,
      });
    } catch { return null; }
  }, [state.jerkLeftFwd, state.jerkRightFwd]);
  const jerkTrend = useMemo(() => { try { return splitJerkTrend(jerkHist); } catch { return null; } }, [jerkHist]);
  const takeJerkSnapshot = () => {
    if (!jerkAsym) {
      setToast('Введи оба максимума ножниц — снимать нечего');
      setTimeout(() => setToast(''), 2000);
      return;
    }
    const entry: SplitJerkSnapshot = {
      date: new Date().toISOString().slice(0, 10),
      leftKg: parseFloat(state.jerkLeftFwd), rightKg: parseFloat(state.jerkRightFwd), diffPct: jerkAsym.diffPct,
    };
    setJerkHist(prev => {
      const next = appendSplitJerkSnapshot(prev, entry);
      try { localStorage.setItem('he_ta_split_jerk_hist', JSON.stringify(next)); } catch { /* noop */ }
      return next;
    });
    setToast(`✓ Снимок ножниц ${entry.date} сохранён`);
    setTimeout(() => setToast(''), 2000);
  };

  const scoring = useMemo(() => scoreTA({
    weakCount: weakPoints.length,
    asymmetryPct: asymmetry?.diff ?? null,
    barPathDeviation: state.barPath || null,
    vbtLossPct: vbtLoss?.lossPct ?? (state.vbtVel ? (parseFloat(state.vbtVel) < 1.3 ? 12 : null) : null),
    mobilityFails: ohs.failed,
    imtpRatio: isppRatio,
    sex: profileSex,
    hasVideo: !!barMetrics || !!csvText,
    hasVbt: !!vbtLoss || !!state.vbtVel,
    hasMobility: ohs.failed !== 6,
  }), [weakPoints.length, asymmetry, state.barPath, vbtLoss, state.vbtVel, ohs.failed, isppRatio, profileSex, barMetrics, csvText]);

  const score = scoring.score;
  const level = scoring.level;
  const sColor = scoreColor(level);

  // E1: аудит текущего плана ТА (he_strength_sport_plan_v1) — покрытие фаз
  // E4: сам план отдельно — для симуляции Δ
  const planData = useMemo(() => {
    try {
      const raw = localStorage.getItem('he_strength_sport_plan_v1');
      if (!raw) return null;
      const j = JSON.parse(raw);
      return j?.weeksData ? j : j?.plan?.weeksData ? j.plan : null;
    } catch { return null; }
  }, [planNonce]);
  const planAudit = useMemo(() => auditTAPlan(planData), [planData]);

  const toggleWeak = (group: 'snatch' | 'clean' | 'jerk', wp: WLWeakPoint) => {
    setState(s => {
      const key = group === 'snatch' ? 'snatchWeak' : group === 'clean' ? 'cleanWeak' : 'jerkWeak';
      const arr = (s as any)[key] as WLWeakPoint[];
      const has = arr.includes(wp);
      const next = has ? arr.filter(x => x !== wp) : [...arr, wp].slice(0, 2);
      return { ...s, [key]: next };
    });
  };

  // E1: худшая фаза плана → открыть на разбор (parity BB selectWorstExercise)
  const selectWorstPhase = () => {
    const wp = planAudit.worstPhase;
    if (!wp) return;
    const grp = hubTabForPhase(wp);
    if (!grp) {
      setToast(`Худшая фаза «${wp}» — вспомогательная (присед/тяга), разбирается через OHS/VBT`);
      setTimeout(() => setToast(''), 2500);
      return;
    }
    setTab(grp);
    setState(s => {
      const key = grp === 'snatch' ? 'snatchWeak' : grp === 'clean' ? 'cleanWeak' : 'jerkWeak';
      const arr = (s as any)[key] as WLWeakPoint[];
      if (arr.includes(wp)) return s;
      return { ...s, [key]: [...arr, wp].slice(0, 2) };
    });
    setToast(`🎯 Худшая фаза плана: ${wp} — открыта на разбор`);
    setTimeout(() => setToast(''), 2500);
  };

  // E2: причина слабой фазы (объём/техника/мобильность/усталость/сила)
  const causeFor = (wp: WLWeakPoint) => {
    try {
      const cov = planAudit.byPhase[wp];
      const perWeek = cov && planAudit.workWeeks > 0 ? cov.sets / planAudit.workWeeks : null;
      return diagnoseTAWeakCause({
        zone: wp,
        factSetsPerWeek: perWeek,
        acwrZone: acwr?.zone ?? null,
        vbtLossPct: vbtLoss?.lossPct ?? null,
        ohsFailed: ohs.failed,
        isppRatio,
        barPathDeviation: state.barPath || null,
      });
    } catch { return null; }
  };

  // E3: оборудование и мобильность из профиля — фильтр ранжира (parity BB profileEquipment)
  const profileEquipment = useMemo(() => {
    try {
      const p = JSON.parse(localStorage.getItem('he_profile_v2') || '{}');
      const eq = p?.settings?.training?.equipment ?? p?.training?.equipment;
      if (Array.isArray(eq)) { const c = eq.map((s: any) => String(s)).filter(Boolean); return c.length ? c : undefined; }
      return undefined;
    } catch { return undefined; }
  }, []);
  const profileMobility = useMemo(() => {
    try {
      const p = JSON.parse(localStorage.getItem('he_profile_v2') || '{}');
      const m = p?.settings?.training?.mobilityRestrictions ?? p?.training?.mobilityRestrictions ?? p?.health?.mobilityRestrictions;
      return Array.isArray(m) ? m.map((s: any) => String(s)) : [];
    } catch { return []; }
  }, []);

  // E3: топ-3 коррекции фазы + выбор предпочитаемой (идёт первой в E6)
  const top3For = (wp: WLWeakPoint) => {
    try {
      const c = causeFor(wp);
      return rankCorrectionsForTA(wp, { equipment: profileEquipment, mobilityRestrictions: profileMobility, cause: c?.cause ?? null });
    } catch { return []; }
  };
  const togglePreferredCorr = (wp: WLWeakPoint, id: string) => {
    setState(s => {
      const cur = { ...(s.preferredCorr || {}) };
      if (cur[wp] === id) delete cur[wp];
      else cur[wp] = id;
      return { ...s, preferredCorr: cur };
    });
  };
  const top3Block = (wp: WLWeakPoint) => {
    const top = top3For(wp);
    if (!top.length) return null;
    const pref = (state.preferredCorr || {})[wp];
    return (
      <div style={{ marginTop: 6, padding: '6px 8px', borderRadius: 8, background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.14)' }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#60a5fa', marginBottom: 4 }}>🏋️ Топ-3 коррекции {pref ? '· ⭐ выбрана' : '· нажми ⭐ — пойдёт первой в план'}</div>
        {top.map(c => {
          const d = planData ? simulateTACorrection(planData, { weakPoint: wp, corrId: c.id, sets: c.protocol.sets, reps: c.protocol.reps }) : null;
          return (
          <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
            <button onClick={() => togglePreferredCorr(wp, c.id)} aria-pressed={pref === c.id} style={{ minWidth: 24, height: 24, borderRadius: 6, cursor: 'pointer', border: '1px solid rgba(59,130,246,0.3)', background: pref === c.id ? '#3b82f6' : 'transparent', color: pref === c.id ? '#fff' : '#60a5fa', fontSize: 11, fontWeight: 800 }}>{pref === c.id ? '⭐' : '☆'}</button>
            <div style={{ flex: 1, fontSize: 10, color: '#fff' }}>{c.name} <span style={{ color: '#60a5fa', fontWeight: 700 }}>{c.protocol.sets}×{c.protocol.reps} @{c.protocol.pct}%</span>{d ? <span style={{ color: DIM }}> · Δ {d.summary}</span> : null}</div>
          </div>
          );
        })}
      </div>
    );
  };

  // E6: уровень и спец-блок превью (волна по рабочим неделям плана)
  const taLevel = useMemo(() => {
    try {
      const p: any = planData;
      return p?.inputSnapshot?.level ?? p?.level ?? 'intermediate';
    } catch { return 'intermediate'; }
  }, [planData]);
  const specPreview = useMemo(() => {
    try {
      const wks = Math.max(4, Math.min(8, planAudit.workWeeks || 6));
      return buildTASpecBlock({ weakPoints, level: taLevel, weeks: wks });
    } catch { return null; }
  }, [weakPoints, taLevel, planAudit.workWeeks]);

  // E6: инъекция коррекций в сохранённый план (все рабочие недели + спец-блок + откат)
  const handleInjectToPlan = () => {
    const zones = weakPoints.slice(0, 3);
    if (!zones.length) {
      setToast('Выбери 1-3 слабые фазы — нечего вставлять');
      setTimeout(() => setToast(''), 2000);
      return;
    }
    if (!planData) {
      setToast('Нет плана ТА — собери в ТА-конструкторе, потом вставляй коррекции');
      setTimeout(() => setToast(''), 2500);
      return;
    }
    try { snapshotTAPlanForInject(); } catch { /* noop */ }
    const protocols: Record<string, { sets?: number; reps?: number; pct?: number }> = {};
    for (const wp of zones) {
      try {
        const t = top3For(wp);
        const prefId = (state.preferredCorr || {})[wp];
        const pick = (prefId && t.find(c => c.id === prefId)) || t[0];
        if (pick) protocols[wp] = { sets: pick.protocol.sets, reps: pick.protocol.reps, pct: pick.protocol.pct };
      } catch { /* noop */ }
    }
    const weekIdxs = (planData.weeksData || []).map((_: any, i: number) => i);
    let r;
    try {
      r = injectTAWeakPoints(planData, zones, {
        weekIdxs,
        preferredCorr: state.preferredCorr || {},
        protocols,
        targetSetsByWeek: specPreview ? specPreview.weeks.map(w => w.targetSets) : undefined,
        dayMap: specPreview ? specPreview.dayMap : undefined,
      });
    } catch {
      setToast('Ошибка инъекции — план не тронут');
      setTimeout(() => setToast(''), 2500);
      return;
    }
    if (!r.injected) {
      setToast(`⊘ Не вставлено (бюджет-скип: ${r.skippedBudget}, дубли: ${r.skippedDup})`);
      setTimeout(() => setToast(''), 3000);
      setHasInjectPrev(true);
      return;
    }
    try {
      r.plan.rationale = [...(r.plan.rationale || []), ...(specPreview ? specPreview.rationale : [])];
      const raw = localStorage.getItem('he_strength_sport_plan_v1');
      const j = raw ? JSON.parse(raw) : null;
      const out = j && j.weeksData ? r.plan : { ...(j || {}), plan: r.plan };
      localStorage.setItem('he_strength_sport_plan_v1', JSON.stringify(out));
    } catch {
      setToast('Не влезло в хранилище — очисти старые планы');
      setTimeout(() => setToast(''), 2500);
      return;
    }
    setHasInjectPrev(true);
    setPlanNonce(n => n + 1);
    setToast(`✓ Вставлено коррекций: ${r.injected} (нед: ${r.plan.weeksData.length}, скип-бюджет: ${r.skippedBudget}, дубли: ${r.skippedDup})`);
    setTimeout(() => setToast(''), 3000);
    try {
      window.dispatchEvent(new CustomEvent('planning-track-open', { detail: 'strength' } as any));
      localStorage.setItem('he_training_planning_track', 'strength');
      localStorage.setItem('he_strength_sport_mode', 'weightlifting');
    } catch { /* noop */ }
  };

  const handleRollbackInject = () => {
    try {
      if (!rollbackTAPlanInject()) {
        setToast('Снапшота нет — откатывать нечего');
        setTimeout(() => setToast(''), 2000);
        return;
      }
    } catch { /* noop */ }
    setHasInjectPrev(false);
    setPlanNonce(n => n + 1);
    setToast('↩ План восстановлен до инъекции');
    setTimeout(() => setToast(''), 2500);
  };

  const applyToConstructor = () => {
    if (weakPoints.length === 0) {
      setToast('Слабые фазы не выбраны — нечего применять');
      setTimeout(() => setToast(''), 2500);
      return;
    }
    // Include numeric biomech + scoring metadata for builder
    const biomechDetails = weakPoints.map(wp => diagnoseTAWeakPoint(wp)).filter(Boolean);
    applyToPlanner({
      kind: 'weakpoints',
      label: `ТА диагностика: ${weakPoints.join(', ')}`,
      data: {
        groups: weakPoints,
        plWeakPoints: weakPoints.map(wp => ({ lift: wp.split('_')[0], weakPoint: wp })),
        wlWeakPoints: weakPoints,
        barPath: state.barPath,
        vbt: state.vbtVel || state.vbtBest,
        score, level, verification: scoring.verification,
        biomech: biomechDetails,
        ohs: { totalScore: ohs.totalScore, failed: ohs.failed },
        asymmetry: asymmetry?.diff ?? null,
        fvr: fvr ? { snatchTh: fvr.snatchTh, Pmax: fvr.Pmax } : null,
        // E5/E6: спец-блок + предпочитаемые + причины (конструктор игнорирует неизвестные — safe)
        taSpecBlock: specPreview,
        taPreferredCorr: state.preferredCorr || {},
        taWeakCauses: Object.fromEntries(weakPoints.map(wp => { try { return [wp, causeFor(wp)?.cause ?? null]; } catch { return [wp, null]; } })),
      } as any,
      source: 'intellectual',
    });
    setToast(`✓ Применено в ТА-конструктор: ${weakPoints.map(w => WL_WEAKPOINT_LABELS[w] || w).join(', ')} (score ${score})`);
    setTimeout(() => setToast(''), 3000);
    try {
      window.dispatchEvent(new CustomEvent('planning-track-open', { detail: 'strength' } as any));
      localStorage.setItem('he_training_planning_track', 'strength');
      localStorage.setItem('he_strength_sport_mode', 'weightlifting');
    } catch {}
  };

  const handleCsvParse = () => {
    const pts = parseKinoveaCSV(csvText);
    if (!pts) { setToast('CSV не распознан'); setTimeout(()=>setToast(''),2000); return; }
    const res = analyzeBarTracking(pts);
    if (!res) { setToast('Нет точек'); return; }
    let bf = '';
    try {
      const pats = extractBfPCAPatterns(pts.map(p => p.x), pts.map(p => p.y));
      const p1 = pats.find(p => p.pattern === 1), p3 = pats.find(p => p.pattern === 3);
      if (p1 && p3) bf = `bfPCA P1 ${p1.score} (r ${p1.correlationWithPerformance}) · P3 ×${p3.score} ${p3.isOptimal ? 'OK' : 'много пересечений'}`;
    } catch { /* noop */ }
    setState(s => ({ ...s, xLoopCm: String(res.xLoop), yMaxCm: String(res.yMax), peakVelMs: String(res.vmax), fvrHAcc: String(res.hAcc), bfPattern: bf }));
    setToast(`✓ Kinovea: xLoop ${res.xLoop}см yMax ${res.yMax}см vmax ${res.vmax} м/с`);
    setTimeout(()=>setToast(''),3000);
  };

  // E9: размах/плечи → профиль (рост остаётся вводом хаба)
  const applyAnthroToProfile = () => {
    try {
      const raw = localStorage.getItem('he_profile_v2');
      const p = raw ? JSON.parse(raw) : {};
      const personal = p.personal ?? p.settings?.personal ?? {};
      const span = parseFloat(state.anthroArmSpan), sho = parseFloat(state.anthroShoulder);
      if (Number.isFinite(span) && span > 0) personal.armSpanCm = span;
      if (Number.isFinite(sho) && sho > 0) personal.shoulderWidthCm = sho;
      if (p.personal) p.personal = personal;
      else if (p.settings?.personal) p.settings.personal = personal;
      else p.personal = personal;
      localStorage.setItem('he_profile_v2', JSON.stringify(p));
      try { window.dispatchEvent(new CustomEvent('profile-updated')); } catch {}
      setToast('✓ Размах/плечи → профиль');
      setTimeout(() => setToast(''), 2000);
    } catch { /* noop */ }
  };

  const applyMobilityToProfile = () => {
    const restrictions: string[] = [];
    if (!state.ohsHeelsFlat) restrictions.push('ankle');
    if (state.ohsKneeValgus) restrictions.push('hip');
    if (!state.ohsHipBelowParallel) restrictions.push('hip');
    if (!state.ohsTrunkUpright) restrictions.push('hip');
    if (!state.ohsArmsOverMidfoot) restrictions.push('shoulder');
    if (!state.ohsLumbarNeutral) restrictions.push('lower_back');
    if (state.kneeToWallCm && Number.isFinite(parseFloat(state.kneeToWallCm)) && parseFloat(state.kneeToWallCm) < 12) restrictions.push('ankle');
    if (state.ankleDeg && Number.isFinite(parseFloat(state.ankleDeg)) && parseFloat(state.ankleDeg) < 35) restrictions.push('ankle');
    const uniq = [...new Set(restrictions)];
    try {
      const raw = localStorage.getItem('he_profile_v2');
      const p = raw ? JSON.parse(raw) : {};
      p.health = p.health || {};
      p.health.mobilityRestrictions = uniq;
      p.training = p.training || {};
      (p.training as any).mobilityRestrictions = uniq;
      localStorage.setItem('he_profile_v2', JSON.stringify(p));
      try { window.dispatchEvent(new CustomEvent('profile-updated')); } catch {}
      setToast(`✓ Мобильность ${uniq.join(', ') || 'OK'} → профиль (учтётся в ТА-плане)`);
      setTimeout(() => setToast(''), 2500);
    } catch {}
  };

  const handleExport = () => {
    const snap = { weakPoints, score, level, verification: scoring.verification, barPath: state.barPath || null, vbt: state.vbtVel || state.vbtBest || null, ohs: { totalScore: ohs.totalScore, failed: ohs.failed }, asymmetryPct: asymmetry?.diff ?? null, fvr: fvr ? { snatchTh: fvr.snatchTh, Pmax: fvr.Pmax } : null, findings: scoring.findings.map(f => f.text) } as any;
    const html = buildWLDiagnosticsHtml(snap);
    downloadWLHtml(html, `ta-diagnostics-${new Date().toISOString().slice(0, 10)}.html`);
    setToast('✓ HTML экспорт');
    setTimeout(() => setToast(''), 2000);
  };
  const handleExportCsv = () => {
    const snap = { weakPoints, score, level, verification: scoring.verification, barPath: state.barPath || null, vbt: state.vbtVel || state.vbtBest || null, ohs: { totalScore: ohs.totalScore, failed: ohs.failed }, asymmetryPct: asymmetry?.diff ?? null, fvr: fvr ? { snatchTh: fvr.snatchTh, Pmax: fvr.Pmax } : null, findings: scoring.findings.map(f => f.text) } as any;
    downloadWLCsv(snap, `ta-diagnostics-${new Date().toISOString().slice(0, 10)}.csv`);
    setToast('✓ CSV экспорт');
    setTimeout(() => setToast(''), 2000);
  };

  const mockPose = useMemo(() => {
    const frames = createMockPoseStream();
    const ang = estimateAnglesFromLandmarks(frames[0]);
    return { angles: ang, status: livePoseStatus(ang) };
  }, []);

  // Lifter limiter suggestions for selected phase (top 2)
  const limiterForPhase = useMemo(() => {
    const wp = weakPoints[0];
    if (!wp) return [];
    // Map WL phase → limiter category: off_floor → start_specific, mid → speed_strength, catch → stabilization, overhead→ stabilization
    let cat = 'speed_strength';
    if (wp.includes('off_floor') || wp.includes('pull_start')) cat = 'start_specific';
    else if (wp.includes('catch') || wp.includes('overhead')) cat = 'stabilization';
    else if (wp.includes('mid')) cat = 'speed_strength';
    const opts = LIMITER_OPTIONS.filter(o => o.category === cat as any).slice(0, 2);
    return opts;
  }, [weakPoints]);

  return (
    <div className="train-wldiag" style={{ padding: '10px 8px 18px', color: '#fff', maxWidth: 860, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ ...CARD, padding: '14px 14px 12px', background: 'linear-gradient(135deg,rgba(59,130,246,0.12),rgba(168,85,247,0.08))', border: '1px solid rgba(59,130,246,0.22)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -18, right: -18, width: 110, height: 110, borderRadius: 110, background: 'radial-gradient(circle,rgba(59,130,246,0.14),transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg,#3b82f6,#a855f7)', color: '#fff', fontWeight: 900, fontSize: 16 }}>🏋️</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 900, color: '#fff', lineHeight: 1 }}>ТА-диагностика — хаб движения PRO</div>
            <div style={{ fontSize: 10, color: '#fff', lineHeight: 1.3, opacity: 0.9 }}>Рывок 5 фаз + взятие 3 + толчок 3 × числовые углы + bar path PRO (Vorobyev типы, SRD) + VBT пиковые зоны + FvR2 + OHS 6 + видео Kinovea/Enode.</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: 52, height: 52, borderRadius: 26, background: `conic-gradient(${sColor} ${score}%, rgba(255,255,255,0.06) 0)`, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `2px solid ${sColor}`, fontWeight: 900, color: '#fff', fontSize: 14 }}>{score}</div>
            <div style={{ fontSize: 9, color: sColor, fontWeight: 700, marginTop: 2 }}>{level === 'ok' ? 'ОК' : level === 'warn' ? 'WARN' : 'CRITICAL'} · v{scoring.verification}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', fontSize: 10, marginBottom: 8 }}>
          <span style={{ padding: '2px 8px', borderRadius: 20, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: DIM }}>ACWR {acwr ? acwr.ratio.toFixed(2) : '—'} {acwr ? (acwr.zone === 'dangerous' ? '🔴' : acwr.zone === 'caution' ? '🟠' : '🟢') : ''}</span>
          <span style={{ padding: '2px 8px', borderRadius: 20, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: DIM }}>{weakPoints.length ? `${weakPoints.length} слабые фазы` : 'баланс'}</span>
          <span style={{ padding: '2px 8px', borderRadius: 20, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: DIM }}>{state.barPath ? BAR_PATH_LABELS[state.barPath as BarPathDeviation] : 'bar path —'}</span>
          <span style={{ padding: '2px 8px', borderRadius: 20, background: vbtZone ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: vbtZone ? '#22c55e' : DIM }}>{vbtZone ? `VBT ${vbtZone}` : 'VBT —'}</span>
          <span style={{ padding: '2px 8px', borderRadius: 20, background: ohs.level === 'ok' ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)', border: '1px solid rgba(255,255,255,0.06)', color: ohs.level === 'ok' ? '#22c55e' : '#ef4444' }}>OHS {ohs.totalScore}/6</span>
          {scoring.floors.length > 0 && <span style={{ padding: '2px 8px', borderRadius: 20, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.22)', color: '#ef4444' }}>floor: {scoring.floors[0]}</span>}
        </div>
        {diaryWeaks.length > 0 && <div style={{ fontSize: 10, color: '#5ee', marginBottom: 4 }}>📓 Дневник группы: {diaryWeaks.map(w => `${w.label} ${w.deltaPct}%`).join(', ')}</div>}
        {diaryPhases.length > 0 && <div style={{ fontSize: 10, color: '#a78bfa', marginBottom: 6 }}>📓 Дневник фазы (reps≤2 → max moment, 3-5 → mid): {diaryPhases.map(wp => WL_WEAKPOINT_LABELS[wp as WLWeakPoint] || wp).join(' · ')} <span style={{ color: DIM }}>(phaseForReps)</span></div>}
        <div style={{ fontSize: 10, color: '#fff', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '8px 10px', lineHeight: 1.45 }}>
          Выбери слабые фазы (числовые углы + биомеханика) + bar path с метриками (SRD 4/6см) + VBT/FvR2 → получи RSS-скор, verification и точечные коррекции. Кнопка <b style={{ color: '#60a5fa' }}>«Применить в ТА-конструктор»</b> отправит фазы с biomech в планировщик (mode:weightlifting).
        </div>
        {limiterForPhase.length > 0 && <div style={{ marginTop: 8, padding: '8px 10px', borderRadius: 8, background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.18)', fontSize: 10, color: '#a78bfa' }}>💡 Лимитеры для {WL_WEAKPOINT_LABELS[weakPoints[0]]}: {limiterForPhase.map(o => `${o.label} (${o.method.slice(0, 40)}…)`).join(' · ')}</div>}
        {toast && <div style={{ marginTop: 8, padding: '6px 10px', borderRadius: 8, background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.2)', color: '#22c55e', fontSize: 11 }}>{toast}</div>}
      </div>

      {/* Tabs */}
      <div style={{ ...CARD, padding: 12 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
          {TAB_DEFS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id as any)} aria-pressed={tab === t.id} style={{ padding: '6px 12px', borderRadius: 999, border: '1px solid', borderColor: tab === t.id ? '#3b82f6' : '#1f3a5f', background: tab === t.id ? 'rgba(59,130,246,0.14)' : '#0a1629', color: tab === t.id ? '#3b82f6' : DIM, cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
              {t.icon} {t.label}
            </button>
          ))}
          <button onClick={applyToConstructor} style={{ marginLeft: 'auto', padding: '8px 14px', borderRadius: 8, background: 'linear-gradient(135deg,#3b82f6,#a855f7)', color: '#fff', border: 'none', fontWeight: 800, fontSize: 12, cursor: 'pointer' }}>→ Применить в ТА-конструктор</button>
        </div>

        {tab === 'snatch' && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: ACCENT, marginBottom: 6 }}>Рывок — 5 фаз (числовые углы + биомеханика)</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
              {(['snatch_off_floor', 'snatch_mid', 'snatch_pull_under', 'snatch_catch', 'snatch_overhead'] as WLWeakPoint[]).map(wp => (
                <button key={wp} onClick={() => toggleWeak('snatch', wp)} aria-pressed={state.snatchWeak.includes(wp)} style={{ padding: '6px 10px', borderRadius: 999, border: '1px solid', borderColor: state.snatchWeak.includes(wp) ? '#3b82f6' : '#1f3a5f', background: state.snatchWeak.includes(wp) ? 'rgba(59,130,246,0.14)' : '#0a1629', color: state.snatchWeak.includes(wp) ? '#3b82f6' : DIM, fontSize: 11 }}>{WL_WEAKPOINT_LABELS[wp]}</button>
              ))}
            </div>
            {state.snatchWeak.map(wp => {
              const bio = diagnoseTAWeakPoint(wp);
              return (
                <div key={wp} style={{ padding: '8px 10px', borderRadius: 8, background: '#0a1629', border: '1px solid #1f3a5f', marginBottom: 6 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>{WL_WEAKPOINT_LABELS[wp]} <span style={{ color: DIM }}>· {bio?.joint} {bio?.angleRangeDeg[0]}-{bio?.angleRangeDeg[1]}° · {bio?.keyJoint}</span></div>
                  <div style={{ fontSize: 10, color: DIM }}>{bio?.weakMuscles.join(', ')} {bio?.references.join(' · ') ? `· ${bio?.references.join(', ')}` : ''}</div>
                  <div style={{ fontSize: 10, color: '#fff', marginTop: 4, lineHeight: 1.4 }}>{bio?.biomechanicalReason}</div>
                  <div style={{ fontSize: 11, color: '#5ee', marginTop: 4 }}>{(WL_WEAKPOINT_CORRECTION[wp] || []).join(' · ')} {bio?.loadCues ? `· ${bio?.loadCues}` : ''}</div>
                  {(() => { const c = causeFor(wp); return c ? <div style={{ fontSize: 10, color: '#f59e0b', marginTop: 4 }}>🔍 Причина: {TA_WEAK_CAUSE_LABELS[c.cause]} ({c.confidence}) — {c.text}</div> : null; })()}
                  {top3Block(wp)}
                </div>
              );
            })}
            <div style={{ marginTop: 8, padding: '8px 10px', borderRadius: 8, background: '#0a1629', border: '1px solid #1f3a5f' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>Bar path — рывок (Vorobyev типы + метрики)</div>
              <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                <select value={state.barLift} onChange={e => setState(s => ({ ...s, barLift: e.target.value }))} style={{ background: '#0a1629', color: '#fff', border: '1px solid #1f3a5f', borderRadius: 8, padding: '6px 8px', fontSize: 11 }}>
                  <option value="snatch">Рывок</option><option value="clean">Взятие</option><option value="jerk">Толчок</option><option value="squat">Присед</option>
                </select>
                <select value={state.barPath} onChange={e => setState(s => ({ ...s, barPath: e.target.value as any }))} style={{ background: '#0a1629', color: '#fff', border: '1px solid #1f3a5f', borderRadius: 8, padding: '6px 8px', fontSize: 11 }}>
                  <option value="">— нет отклонения</option>
                  <option value="forward">Уход вперёд</option><option value="backward">Уход назад</option><option value="loop">Петля</option><option value="early_pull">Ранняя тяга</option><option value="soft_lockout">Мягкий замок</option>
                </select>
                <input placeholder="xLoop см" value={state.xLoopCm} onChange={e => setState(s => ({ ...s, xLoopCm: e.target.value }))} style={{ width: 70, background: '#0a1629', color: '#fff', border: '1px solid #1f3a5f', borderRadius: 8, padding: '6px 8px', fontSize: 11 }} />
                <input placeholder="vmax м/с" value={state.peakVelMs} onChange={e => setState(s => ({ ...s, peakVelMs: e.target.value }))} style={{ width: 70, background: '#0a1629', color: '#fff', border: '1px solid #1f3a5f', borderRadius: 8, padding: '6px 8px', fontSize: 11 }} />
              </div>
              {barPathDiag?.weak && <div style={{ fontSize: 11, color: '#f59e0b', marginTop: 6 }}>→ {WL_WEAKPOINT_LABELS[barPathDiag.weak]} · {barPathDiag.corrections.join(' · ')}</div>}
              {barMetricsDiag && <div style={{ fontSize: 10, color: barMetricsDiag.severity === 'ok' ? '#22c55e' : barMetricsDiag.severity === 'warn' ? '#f59e0b' : '#ef4444', marginTop: 4 }}>{barMetricsDiag.text} {barMetrics?.xLoop ? `(SRD ${isRealChange(barMetrics.xLoop) ? 'реально' : 'в пределах шума'})` : ''}</div>}
              {barMetrics && <div style={{ fontSize: 10, color: DIM, marginTop: 4 }}>Метрика: xLoop {barMetrics.xLoop}см yMax {barMetrics.yMax}см vmax {barMetrics.vMax} м/с {TA_PEAK_VELOCITY_ZONES.snatch ? `· зона ${taZoneForVelocity(barMetrics.vMax, 'snatch')}` : ''}</div>}
            </div>
          </div>
        )}

        {tab === 'clean' && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: ACCENT, marginBottom: 6 }}>Взятие — 3 фазы + ISPP (предиктор 81%)</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
              {(['clean_off_floor', 'clean_mid', 'clean_catch'] as WLWeakPoint[]).map(wp => (
                <button key={wp} onClick={() => toggleWeak('clean', wp)} aria-pressed={state.cleanWeak.includes(wp)} style={{ padding: '6px 10px', borderRadius: 999, border: '1px solid', borderColor: state.cleanWeak.includes(wp) ? '#22c55e' : '#1f3a5f', background: state.cleanWeak.includes(wp) ? 'rgba(34,197,94,0.14)' : '#0a1629', color: state.cleanWeak.includes(wp) ? '#22c55e' : DIM, fontSize: 11 }}>{WL_WEAKPOINT_LABELS[wp]}</button>
              ))}
            </div>
            {state.cleanWeak.map(wp => {
              const bio = diagnoseTAWeakPoint(wp);
              return (
                <div key={wp} style={{ padding: '8px 10px', borderRadius: 8, background: '#0a1629', border: '1px solid #1f3a5f', marginBottom: 6 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>{WL_WEAKPOINT_LABELS[wp]} <span style={{ color: DIM }}>· {bio?.angleRangeDeg[0]}-{bio?.angleRangeDeg[1]}°</span></div>
                  <div style={{ fontSize: 10, color: DIM }}>{bio?.weakMuscles.join(', ')}</div>
                  <div style={{ fontSize: 10, color: '#fff', marginTop: 4 }}>{bio?.biomechanicalReason}</div>
                  <div style={{ fontSize: 11, color: '#5ee' }}>{(WL_WEAKPOINT_CORRECTION[wp] || []).join(' · ')}</div>
                  {(() => { const c = causeFor(wp); return c ? <div style={{ fontSize: 10, color: '#f59e0b', marginTop: 4 }}>🔍 Причина: {TA_WEAK_CAUSE_LABELS[c.cause]} ({c.confidence}) — {c.text}</div> : null; })()}
                  {top3Block(wp)}
                </div>
              );
            })}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
              <label style={{ fontSize: 11, color: DIM }}>IMTP кг<br /><input value={state.imtpKg} onChange={e => setState(s => ({ ...s, imtpKg: e.target.value }))} placeholder="250" style={{ width: '100%', marginTop: 4, background: '#0a1629', color: '#fff', border: '1px solid #1f3a5f', borderRadius: 8, padding: '6px 8px', fontSize: 12 }} /></label>
              <label style={{ fontSize: 11, color: DIM }}>ISPP кг<br /><input value={state.isppKg} onChange={e => setState(s => ({ ...s, isppKg: e.target.value }))} placeholder="220" style={{ width: '100%', marginTop: 4, background: '#0a1629', color: '#fff', border: '1px solid #1f3a5f', borderRadius: 8, padding: '6px 8px', fontSize: 12 }} /></label>
            </div>
            {isppRatio != null && <div style={{ fontSize: 10, color: isppRatio < 0.85 ? '#f59e0b' : '#22c55e', marginTop: 4 }}>ISPP/IMTP {(isppRatio * 100).toFixed(0)}% {isppRatio < 0.85 ? '— слабый отрыв (приоритет дефицит)' : '— норма'}</div>}
            <div style={{ fontSize: 10, color: DIM, marginTop: 4 }}>ISPP предиктор 81% дисп. рывка/толчка (Essex). Норма ISPP ≥85% IMTP.</div>
          </div>
        )}

        {tab === 'jerk' && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: ACCENT, marginBottom: 6 }}>Толчок — 3 фазы (dip 8-12см критичен)</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
              {(['jerk_dip', 'jerk_drive', 'jerk_lockout'] as WLWeakPoint[]).map(wp => (
                <button key={wp} onClick={() => toggleWeak('jerk', wp)} aria-pressed={state.jerkWeak.includes(wp)} style={{ padding: '6px 10px', borderRadius: 999, border: '1px solid', borderColor: state.jerkWeak.includes(wp) ? '#a855f7' : '#1f3a5f', background: state.jerkWeak.includes(wp) ? 'rgba(168,85,247,0.14)' : '#0a1629', color: state.jerkWeak.includes(wp) ? '#a855f7' : DIM, fontSize: 11 }}>{WL_WEAKPOINT_LABELS[wp]}</button>
              ))}
            </div>
            {state.jerkWeak.map(wp => {
              const bio = diagnoseTAWeakPoint(wp);
              return <div key={wp} style={{ padding: '8px 10px', borderRadius: 8, background: '#0a1629', border: '1px solid #1f3a5f', marginBottom: 6 }}><div style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>{WL_WEAKPOINT_LABELS[wp]} <span style={{ color: DIM }}>· {bio?.angleRangeDeg.join('-')}°</span></div><div style={{ fontSize: 10, color: '#fff', marginTop: 4 }}>{bio?.biomechanicalReason}</div><div style={{ fontSize: 11, color: '#5ee' }}>{(WL_WEAKPOINT_CORRECTION[wp] || []).join(' · ')}</div>{(() => { const c = causeFor(wp); return c ? <div style={{ fontSize: 10, color: '#f59e0b', marginTop: 4 }}>🔍 Причина: {TA_WEAK_CAUSE_LABELS[c.cause]} ({c.confidence}) — {c.text}</div> : null; })()}{top3Block(wp)}</div>;
            })}
            {/* E7: jerk dip метрики (Zhang: оптимум 8-12см за 0.15-0.25с) */}
            <div style={{ marginTop: 8, padding: '8px 10px', borderRadius: 8, background: '#0a1629', border: '1px solid #1f3a5f' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>Dip-метрика толчка</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 6 }}>
                <label style={{ fontSize: 11, color: DIM }}>Глубина dip см<br /><input value={state.jerkDipCm} onChange={e => setState(s => ({ ...s, jerkDipCm: e.target.value }))} placeholder="10" style={{ width: '100%', marginTop: 4, background: '#0a1629', color: '#fff', border: '1px solid #1f3a5f', borderRadius: 8, padding: '6px 8px', fontSize: 12 }} /></label>
                <label style={{ fontSize: 11, color: DIM }}>Время dip мс<br /><input value={state.jerkDipMs} onChange={e => setState(s => ({ ...s, jerkDipMs: e.target.value }))} placeholder="200" style={{ width: '100%', marginTop: 4, background: '#0a1629', color: '#fff', border: '1px solid #1f3a5f', borderRadius: 8, padding: '6px 8px', fontSize: 12 }} /></label>
              </div>
              {jerkDip && <div style={{ fontSize: 10, color: jerkDip.isOptimal ? '#22c55e' : '#f59e0b', marginTop: 6 }}>Dip {jerkDip.dipCm}см за {jerkDip.dipTimeMs}мс · скорость {jerkDip.dipVelocityMs} м/с{jerkDip.drivePowerW ? ` · drive ~${jerkDip.drivePowerW}Вт` : ''} — {jerkDip.recommendation}</div>}
            </div>
          </div>
        )}

        {tab === 'vbt' && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: ACCENT, marginBottom: 6 }}>VBT — пиковые зоны (PLOS 2026) + FvR2 (Sandau)</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <label style={{ fontSize: 11, color: DIM }}>Вес штанги кг<br /><input value={state.vbtWeight} onChange={e => setState(s => ({ ...s, vbtWeight: e.target.value }))} placeholder="100" style={{ width: '100%', marginTop: 4, background: '#0a1629', color: '#fff', border: '1px solid #1f3a5f', borderRadius: 8, padding: '6px 8px', fontSize: 12 }} /></label>
              <label style={{ fontSize: 11, color: DIM }}>Пиковая скорость м/с<br /><input value={state.vbtVel} onChange={e => setState(s => ({ ...s, vbtVel: e.target.value }))} placeholder="1.75" style={{ width: '100%', marginTop: 4, background: '#0a1629', color: '#fff', border: '1px solid #1f3a5f', borderRadius: 8, padding: '6px 8px', fontSize: 12 }} /></label>
            </div>
            {vbtZone && <div style={{ fontSize: 10, color: '#22c55e', marginTop: 4 }}>Зона {vbtZone} (все &gt;80% &gt;1.3 м/с — PLOS 2026). Для рывка absolute 1.3-1.75 м/с.</div>}
            {profileSex === 'female' && <div style={{ fontSize: 10, color: '#f9a8d4', marginTop: 4 }}>♀ Женские бенчмарки пика: рывок 1.5–1.8 · взятие 1.3–1.6 м/с (PoinT GO); Type3-траектория — вариант нормы (Hiskia 53% ЧМ).</div>}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
              <label style={{ fontSize: 11, color: DIM }}>Best м/с<br /><input value={state.vbtBest} onChange={e => setState(s => ({ ...s, vbtBest: e.target.value }))} placeholder="1.90" style={{ width: '100%', marginTop: 4, background: '#0a1629', color: '#fff', border: '1px solid #1f3a5f', borderRadius: 8, padding: '6px 8px', fontSize: 12 }} /></label>
              <label style={{ fontSize: 11, color: DIM }}>Last м/с<br /><input value={state.vbtLast} onChange={e => setState(s => ({ ...s, vbtLast: e.target.value }))} placeholder="1.55" style={{ width: '100%', marginTop: 4, background: '#0a1629', color: '#fff', border: '1px solid #1f3a5f', borderRadius: 8, padding: '6px 8px', fontSize: 12 }} /></label>
            </div>
            {vbtLoss && <div style={{ marginTop: 6, padding: '8px 10px', borderRadius: 8, background: vbtLoss.exceeded ? 'rgba(239,68,68,0.08)' : 'rgba(34,197,94,0.08)', border: `1px solid ${vbtLoss.exceeded ? 'rgba(239,68,68,0.2)' : 'rgba(34,197,94,0.2)'}` }}><div style={{ fontSize: 11, fontWeight: 700, color: vbtLoss.exceeded ? '#ef4444' : '#22c55e' }}>Потеря {vbtLoss.lossPct}% · {vbtLoss.zone} · {vbtLoss.recommendation} {vbtLoss.e1RMByVelocity ? `· e1RM ${vbtLoss.e1RMByVelocity}кг` : ''}</div><div style={{ fontSize: 10, color: DIM }}>Порог {thresholdForTALift(state.barLift)}% для ТА-power (vs 20% для силы). {vbtRecommendationSS(vbtLoss.lossPct, state.barLift).action}</div></div>}
            <div style={{ marginTop: 10, padding: '8px 10px', borderRadius: 8, background: '#0a1629', border: '1px solid #1f3a5f' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>FvR2 — прогноз рывка ±1.5кг (Sandau)</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginTop: 6 }}>
                <label style={{ fontSize: 10, color: DIM }}>Нагр80 кг<br /><input value={state.fvrLoad80} onChange={e => setState(s => ({ ...s, fvrLoad80: e.target.value }))} placeholder="80" style={{ width: '100%', background: '#0a1629', color: '#fff', border: '1px solid #1f3a5f', borderRadius: 6, padding: '6px', fontSize: 11 }} /></label>
                <label style={{ fontSize: 10, color: DIM }}>Vmax80 м/с<br /><input value={state.fvrVmax80} onChange={e => setState(s => ({ ...s, fvrVmax80: e.target.value }))} placeholder="1.95" style={{ width: '100%', background: '#0a1629', color: '#fff', border: '1px solid #1f3a5f', borderRadius: 6, padding: '6px', fontSize: 11 }} /></label>
                <label style={{ fontSize: 10, color: DIM }}>hAcc м<br /><input value={state.fvrHAcc} onChange={e => setState(s => ({ ...s, fvrHAcc: e.target.value }))} placeholder="0.8" style={{ width: '100%', background: '#0a1629', color: '#fff', border: '1px solid #1f3a5f', borderRadius: 6, padding: '6px', fontSize: 11 }} /></label>
                <label style={{ fontSize: 10, color: DIM }}>Нагр110 кг<br /><input value={state.fvrLoad110} onChange={e => setState(s => ({ ...s, fvrLoad110: e.target.value }))} placeholder="110" style={{ width: '100%', background: '#0a1629', color: '#fff', border: '1px solid #1f3a5f', borderRadius: 6, padding: '6px', fontSize: 11 }} /></label>
                <label style={{ fontSize: 10, color: DIM }}>Vmax110 м/с<br /><input value={state.fvrVmax110} onChange={e => setState(s => ({ ...s, fvrVmax110: e.target.value }))} placeholder="1.45" style={{ width: '100%', background: '#0a1629', color: '#fff', border: '1px solid #1f3a5f', borderRadius: 6, padding: '6px', fontSize: 11 }} /></label>
                <label style={{ fontSize: 10, color: DIM }}>Vthres м/с<br /><input value={state.vbtVthres} onChange={e => setState(s => ({ ...s, vbtVthres: e.target.value }))} placeholder="1.85" style={{ width: '100%', background: '#0a1629', color: '#fff', border: '1px solid #1f3a5f', borderRadius: 6, padding: '6px', fontSize: 11 }} /></label>
              </div>
              {fvr ? <div style={{ fontSize: 11, color: '#22c55e', marginTop: 6 }}>SnatchTh {fvr.snatchTh}кг · Pmax {fvr.Pmax}Вт · v0 {fvr.v0} м/с · F0 {fvr.F0}Н · slope {fvr.slope}</div> : <div style={{ fontSize: 10, color: DIM, marginTop: 6 }}>Норма vThres{profileSex === 'female' ? ' ♀' : ''} snatch {taVthresNorms(profileSex).snatch.min}-{taVthresNorms(profileSex).snatch.max} (opt {taVthresNorms(profileSex).snatch.optimal}), clean {taVthresNorms(profileSex).clean.min}-{taVthresNorms(profileSex).clean.max}</div>}
              {fvr && fvrOptimal && <div style={{ fontSize: 10, color: fvrOptimal.forceDom ? '#f59e0b' : '#22c55e', marginTop: 4 }}>FvR-профиль: slope {fvr.slope} vs оптимум {fvrOptimal.opt} (Δ {fvrOptimal.diff > 0 ? '+' : ''}{fvrOptimal.diff}) — {fvrOptimal.forceDom ? 'force-доминантен → приоритет скорость (вис/прыжки)' : 'сбалансирован ✓'}</div>}
            {/* E12: попытки на старт 90/96/102 + readiness −2.5 */}
            <div style={{ marginTop: 10, padding: '8px 10px', borderRadius: 8, background: '#0a1629', border: '1px solid #1f3a5f' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>🏁 Попытки на старт{fvr ? ` · рывок из FvR: ${fvr.snatchTh}кг` : ''}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 6 }}>
                <label style={{ fontSize: 10, color: DIM }}>Заявка рывок кг<br /><input value={state.taSnatchMax} onChange={e => setState(s => ({ ...s, taSnatchMax: e.target.value }))} placeholder={fvr ? String(fvr.snatchTh) : '100'} style={{ width: '100%', background: '#0a1629', color: '#fff', border: '1px solid #1f3a5f', borderRadius: 6, padding: '6px', fontSize: 11 }} /></label>
                <label style={{ fontSize: 10, color: DIM }}>Заявка толчок кг<br /><input value={state.taCjMax} onChange={e => setState(s => ({ ...s, taCjMax: e.target.value }))} placeholder="125" style={{ width: '100%', background: '#0a1629', color: '#fff', border: '1px solid #1f3a5f', borderRadius: 6, padding: '6px', fontSize: 11 }} /></label>
                <label style={{ fontSize: 10, color: DIM }}>Пик стандарт м/с<br /><input value={state.taVelStd} onChange={e => setState(s => ({ ...s, taVelStd: e.target.value }))} placeholder="1.90" style={{ width: '100%', background: '#0a1629', color: '#fff', border: '1px solid #1f3a5f', borderRadius: 6, padding: '6px', fontSize: 11 }} /></label>
                <label style={{ fontSize: 10, color: DIM }}>Пик сегодня м/с<br /><input value={state.taVelToday} onChange={e => setState(s => ({ ...s, taVelToday: e.target.value }))} placeholder="1.85" style={{ width: '100%', background: '#0a1629', color: '#fff', border: '1px solid #1f3a5f', borderRadius: 6, padding: '6px', fontSize: 11 }} /></label>
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                {(['conservative', 'balanced', 'aggressive'] as const).map(st => (
                  <button key={st} onClick={() => setState(s => ({ ...s, taStrategy: st }))} aria-pressed={attemptArgs.strat === st} style={{ padding: '4px 10px', borderRadius: 999, border: '1px solid', borderColor: attemptArgs.strat === st ? '#3b82f6' : '#1f3a5f', background: attemptArgs.strat === st ? 'rgba(59,130,246,0.14)' : '#0a1629', color: attemptArgs.strat === st ? '#3b82f6' : DIM, fontSize: 10 }}>{st === 'conservative' ? 'Осторожно' : st === 'balanced' ? 'Баланс' : 'Риск'}</button>
                ))}
              </div>
              {snatchAttempts && <div style={{ fontSize: 11, color: '#22c55e', marginTop: 6 }}>Рывок: {snatchAttempts.attempts[0]} / {snatchAttempts.attempts[1]} / {snatchAttempts.attempts[2]}{snatchAttempts.readinessCut ? ' (−2.5 readiness)' : ''}</div>}
              {cjAttempts && <div style={{ fontSize: 11, color: '#22c55e', marginTop: 4 }}>Толчок: {cjAttempts.attempts[0]} / {cjAttempts.attempts[1]} / {cjAttempts.attempts[2]}{cjAttempts.readinessCut ? ' (−2.5 readiness)' : ''}</div>}
              {(snatchAttempts?.readinessNote || cjAttempts?.readinessNote) && <div style={{ fontSize: 10, color: '#f59e0b', marginTop: 4 }}>⚠️ {snatchAttempts?.readinessNote || cjAttempts?.readinessNote}</div>}
              {!snatchAttempts && !cjAttempts && <div style={{ fontSize: 10, color: DIM, marginTop: 6 }}>Введи заявку (рывок подтянется из FvR) — получишь 90/96/102. Просадка пика &gt;0.15 м/с срежет −2.5кг.</div>}
            </div>
            </div>
            <div style={{ fontSize: 10, color: DIM, marginTop: 6 }}>Пороги ТА: power 10%, strength 15% (не 20%). Все absolute &gt;1.3 м/с — generic startingStrength недействителен (Wood 2026).</div>
            <div style={{ marginTop: 10, padding: '8px 10px', borderRadius: 8, background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.18)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#a78bfa' }}>LVP ramp — индивидуальный профиль (PLOS Wood 2026)</div>
              <div style={{ display:'grid', gridTemplateColumns:'80px 1fr 1fr 1fr 1fr', gap:6, marginTop:6, alignItems:'end' }}>
                <label style={{ fontSize:10, color:DIM }}>Лифт<br/><select value={state.lvpLift} onChange={e=> setState(s=>({...s, lvpLift: e.target.value}))} style={{ width:'100%', background:'#0a1629', color:'#fff', border:'1px solid #1f3a5f', borderRadius:6, padding:'6px', fontSize:11 }}><option value="snatch">Рывок</option><option value="clean">Толчок</option><option value="squat">Присед</option><option value="deadlift">Тяга</option><option value="yoke_walk">Йок</option></select></label>
                <label style={{ fontSize:10, color:DIM }}>50% м/с<br/><input value={state.lvp50} onChange={e=> setState(s=>({...s, lvp50:e.target.value}))} placeholder="2.70" style={{ width:'100%', background:'#0a1629', color:'#fff', border:'1px solid #1f3a5f', borderRadius:6, padding:'6px', fontSize:11 }} /></label>
                <label style={{ fontSize:10, color:DIM }}>65% м/с<br/><input value={state.lvp65} onChange={e=> setState(s=>({...s, lvp65:e.target.value}))} placeholder="2.15" style={{ width:'100%', background:'#0a1629', color:'#fff', border:'1px solid #1f3a5f', borderRadius:6, padding:'6px', fontSize:11 }} /></label>
                <label style={{ fontSize:10, color:DIM }}>80% м/с<br/><input value={state.lvp75} onChange={e=> setState(s=>({...s, lvp75:e.target.value}))} placeholder="1.80" style={{ width:'100%', background:'#0a1629', color:'#fff', border:'1px solid #1f3a5f', borderRadius:6, padding:'6px', fontSize:11 }} /></label>
                <label style={{ fontSize:10, color:DIM }}>90% м/с<br/><input value={state.lvp90} onChange={e=> setState(s=>({...s, lvp90:e.target.value}))} placeholder="1.55" style={{ width:'100%', background:'#0a1629', color:'#fff', border:'1px solid #1f3a5f', borderRadius:6, padding:'6px', fontSize:11 }} /></label>
              </div>
              <div style={{ display:'flex', gap:6, marginTop:8 }}>
                <button onClick={()=> {
                  const pts = [{pct:0.5, velocity:parseFloat(state.lvp50)}, {pct:0.65, velocity:parseFloat(state.lvp65)}, {pct:0.80, velocity:parseFloat(state.lvp75)}, {pct:0.90, velocity:parseFloat(state.lvp90)}].filter(p=> Number.isFinite(p.velocity) && p.velocity>0) as any;
                  const res = calibrateLVP(state.lvpLift, pts);
                  if (res) { saveLVPProfile(res); setState(s=>({...s, lvpResult: `r² ${res.r2} ${res.valid?'✅':'⚠️'} slope ${res.slope} → e1RM 80кг@${res.slope? (80/res.r2).toFixed(0):'—'} | ${velocityTypeForLift(state.lvpLift)}` })); setToast(`✦ LVP ${state.lvpLift} r² ${res.r2} ${res.valid?'✅':'⚠️'}`); setTimeout(()=>setToast(''),2000); }
                  else { setState(s=>({...s, lvpResult: 'Ошибка: нужно ≥3 точки, spread ≥0.2, slope<0' })); }
                }} style={{ padding:'6px 12px', borderRadius:8, background:'linear-gradient(135deg,#a855f7,#3b82f6)', color:'#fff', border:'none', fontWeight:700, fontSize:11, cursor:'pointer' }}>Калибровать LVP</button>
                <span style={{ fontSize:10, color:DIM, alignSelf:'center' }}>{state.lvpResult}</span>
              </div>
              <div style={{ fontSize:9, color:DIM, marginTop:4 }}>Population → individual приоритет: `velocityForSS` сначала ищет `he_lv_profile_ss_v1` (Wood 2026 individual). {velocityTypeForLift(state.lvpLift)==='peak'?'peak':'mpv'} badge.</div>
            </div>
           </div>
         )}

         {tab === 'video' && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: ACCENT, marginBottom: 6 }}>Видео / Bar tracking — Kinovea + Enode</div>
            <div style={{ fontSize: 10, color: DIM, marginBottom: 6 }}>Полевая методика Ang 2023 (loadsol + Kinovea free). Chavda 2024: Enode вертикаль r²=0.99, горизонталь bias → correction Intercept+Slope.</div>
            <textarea value={csvText} onChange={e => setCsvText(e.target.value)} placeholder="Вставь Kinovea CSV (time,x,y) или t,x,y; x,y в см" style={{ width: '100%', height: 80, background: '#0a1629', color: '#fff', border: '1px solid #1f3a5f', borderRadius: 8, padding: '8px', fontSize: 11, fontFamily: 'monospace' }} />
            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              <button onClick={handleCsvParse} style={{ padding: '6px 12px', borderRadius: 8, background: 'rgba(59,130,246,0.14)', border: '1px solid #1f3a5f', color: '#60a5fa', fontSize: 11, cursor: 'pointer' }}>📊 Разобрать Kinovea CSV</button>
              <span style={{ fontSize: 10, color: DIM, alignSelf: 'center' }}>Или введи метрики вручную ниже</span>
            </div>
            {state.bfPattern && <div style={{ fontSize: 10, color: '#a78bfa', marginTop: 6 }}>📐 {state.bfPattern} (Kipp 2024: P1 +0.42 лучше, P3 −0.38 хуже)</div>}
            {barTrend && <div style={{ fontSize: 10, color: DIM, marginTop: 4 }}>📈 История трекинга ({barTrend.n}): vmax {barTrend.from} → {barTrend.to} м/с · EWMA {barTrend.ewma}</div>}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginTop: 8 }}>
              <label style={{ fontSize: 11, color: DIM }}>xLoop см<br /><input value={state.xLoopCm} onChange={e => setState(s => ({ ...s, xLoopCm: e.target.value }))} placeholder="3.2" style={{ width: '100%', marginTop: 4, background: '#0a1629', color: '#fff', border: '1px solid #1f3a5f', borderRadius: 8, padding: '6px 8px', fontSize: 12 }} /></label>
              <label style={{ fontSize: 11, color: DIM }}>yMax см<br /><input value={state.yMaxCm} onChange={e => setState(s => ({ ...s, yMaxCm: e.target.value }))} placeholder="85" style={{ width: '100%', marginTop: 4, background: '#0a1629', color: '#fff', border: '1px solid #1f3a5f', borderRadius: 8, padding: '6px 8px', fontSize: 12 }} /></label>
              <label style={{ fontSize: 11, color: DIM }}>vMax м/с<br /><input value={state.peakVelMs} onChange={e => setState(s => ({ ...s, peakVelMs: e.target.value }))} placeholder="1.85" style={{ width: '100%', marginTop: 4, background: '#0a1629', color: '#fff', border: '1px solid #1f3a5f', borderRadius: 8, padding: '6px 8px', fontSize: 12 }} /></label>
            </div>
            {barMetrics && <div style={{ marginTop: 6, padding: '8px 10px', borderRadius: 8, background: barMetricsDiag?.severity === 'critical' ? 'rgba(239,68,68,0.08)' : barMetricsDiag?.severity === 'warn' ? 'rgba(245,158,11,0.08)' : 'rgba(34,197,94,0.08)', border: `1px solid ${barMetricsDiag?.severity === 'ok' ? 'rgba(34,197,94,0.2)' : barMetricsDiag?.severity === 'warn' ? 'rgba(245,158,11,0.2)' : 'rgba(239,68,68,0.2)'}` }}><div style={{ fontSize: 11, fontWeight: 700, color: barMetricsDiag?.severity === 'ok' ? '#22c55e' : barMetricsDiag?.severity === 'warn' ? '#f59e0b' : '#ef4444' }}>{barMetricsDiag?.text}</div><div style={{ fontSize: 10, color: DIM }}>Enode correction: {correctEnodeHorizontal(barMetrics.xLoop).toFixed(1)}см (bias). SRD: turnover {isRealChange(barMetrics.xLoop, 'turnover') ? 'реально >4см' : '≤4см норма'} · catch {isRealChange(barMetrics.xLoop, 'catch') ? 'реально >6см' : '≤6см норма'}</div></div>}
            {barMetrics?.trajectoryType && barMetrics.trajectoryType !== 'unknown' && <div style={{ fontSize: 10, color: '#a78bfa', marginTop: 4 }}>Тип {barMetrics.trajectoryType} — {classifyTrajectoryType([]).label}</div>}
            <div style={{ marginTop: 6, padding: '6px 8px', borderRadius: 8, background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.18)', fontSize: 10, color: '#a78bfa' }}>BlazePose stub: hip {mockPose.angles.hip}° knee {mockPose.angles.knee}° ankle {mockPose.angles.ankle}° shoulder {mockPose.angles.shoulder}° — {mockPose.status.faults.join(' · ') || 'OK (mock)'}</div>
            {/* E8: углы суставов с видео (CSV трекера поз) → автовалидация фаз + OHS-прогноз */}
            <div style={{ marginTop: 8, padding: '8px 10px', borderRadius: 8, background: '#0a1629', border: '1px solid #1f3a5f' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>📐 Углы с видео — вставь CSV трекера (t,hip,knee,ankle,shoulder)</div>
              <textarea value={state.poseCsv} onChange={e => setState(s => ({ ...s, poseCsv: e.target.value }))} placeholder="t,hip,knee,ankle,shoulder&#10;0,100,80,40,160&#10;0.1,95,70,38,155" style={{ width: '100%', height: 56, marginTop: 6, background: '#0a1629', color: '#fff', border: '1px solid #1f3a5f', borderRadius: 8, padding: '8px', fontSize: 11, fontFamily: 'monospace' }} />
              {poseSummary && (
                <div style={{ marginTop: 6 }}>
                  <div style={{ fontSize: 10, color: DIM }}>Кадров: {poseSummary.n} · колено {poseSummary.knee ? `${poseSummary.knee.min}–${poseSummary.knee.max}° (ср ${poseSummary.knee.avg}°)` : '—'} · таз {poseSummary.hip ? `ср ${poseSummary.hip.avg}°` : '—'} · голеностоп {poseSummary.ankle ? `ср ${poseSummary.ankle.avg}°` : '—'} · плечо {poseSummary.shoulder ? `ср ${poseSummary.shoulder.avg}°` : '—'}</div>
                  {poseValidation.length > 0 && <div style={{ marginTop: 4 }}>{poseValidation.map(v => <div key={v.weakPoint} style={{ fontSize: 10, color: v.valid ? '#22c55e' : '#f59e0b', marginTop: 2 }}>{v.valid ? '✅' : '⚠️'} {v.recommendation}</div>)}</div>}
                  {poseOhs && <div style={{ fontSize: 10, color: DIM, marginTop: 4 }}>OHS-прогноз по углам: {poseOhs.score}/6 ({poseOhs.level}) — сверь чекбоксы в табе «Мобильность» вручную</div>}
                </div>
              )}
              {state.poseCsv.trim() && !poseSummary && <div style={{ fontSize: 10, color: '#ef4444', marginTop: 4 }}>CSV не распознан — нужно ≥2 строк t,hip,knee,ankle,shoulder</div>}
            </div>
            <div style={{ marginTop: 8, padding: '8px 10px', borderRadius: 8, background: '#0a1629', border: '1px dashed #1f3a5f', textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: DIM }}>📹 BlazePose (MediaPipe) — следующий шаг</div>
              <div style={{ marginTop: 6, width: '100%', height: 60, background: 'rgba(255,255,255,0.03)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: DIM, fontSize: 11, border: '1px solid rgba(255,255,255,0.04)' }}>video preview — PRO: углы hip/knee/ankle/shoulder в реальном времени</div>
            </div>
          </div>
        )}

        {tab === 'mobility' && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: ACCENT, marginBottom: 6 }}>Мобильность — OHS 6 сегментов (FMS/NASM + PoinT GO)</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 8 }}>
              <label style={{ fontSize: 11, color: DIM, display: 'flex', alignItems: 'center', gap: 6 }}><input type="checkbox" checked={state.ohsHeelsFlat} onChange={e => setState(s => ({ ...s, ohsHeelsFlat: e.target.checked }))} /> Пятки плоско</label>
              <label style={{ fontSize: 11, color: DIM, display: 'flex', alignItems: 'center', gap: 6 }}><input type="checkbox" checked={!state.ohsKneeValgus} onChange={e => setState(s => ({ ...s, ohsKneeValgus: !e.target.checked }))} /> Колени без вальгуса</label>
              <label style={{ fontSize: 11, color: DIM, display: 'flex', alignItems: 'center', gap: 6 }}><input type="checkbox" checked={state.ohsHipBelowParallel} onChange={e => setState(s => ({ ...s, ohsHipBelowParallel: e.target.checked }))} /> Таз ниже параллели</label>
              <label style={{ fontSize: 11, color: DIM, display: 'flex', alignItems: 'center', gap: 6 }}><input type="checkbox" checked={state.ohsTrunkUpright} onChange={e => setState(s => ({ ...s, ohsTrunkUpright: e.target.checked }))} /> Корпус upright</label>
              <label style={{ fontSize: 11, color: DIM, display: 'flex', alignItems: 'center', gap: 6 }}><input type="checkbox" checked={state.ohsArmsOverMidfoot} onChange={e => setState(s => ({ ...s, ohsArmsOverMidfoot: e.target.checked }))} /> Руки над стопой</label>
              <label style={{ fontSize: 11, color: DIM, display: 'flex', alignItems: 'center', gap: 6 }}><input type="checkbox" checked={state.ohsLumbarNeutral} onChange={e => setState(s => ({ ...s, ohsLumbarNeutral: e.target.checked }))} /> Нейтраль поясницы</label>
            </div>
            <div style={{ padding: '8px 10px', borderRadius: 8, background: ohs.level === 'ok' ? 'rgba(34,197,94,0.08)' : ohs.level === 'warn' ? 'rgba(245,158,11,0.08)' : 'rgba(239,68,68,0.08)', border: `1px solid ${ohs.level === 'ok' ? 'rgba(34,197,94,0.18)' : ohs.level === 'warn' ? 'rgba(245,158,11,0.18)' : 'rgba(239,68,68,0.18)'}`, marginBottom: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: ohs.level === 'ok' ? '#22c55e' : ohs.level === 'warn' ? '#f59e0b' : '#ef4444' }}>OHS {ohs.totalScore}/6 {ohs.level.toUpperCase()} · fail {ohs.failed} {ohs.primaryDriver ? `· драйвер ${ohs.primaryDriver}` : ''}</div>
              <div style={{ fontSize: 10, color: DIM, marginTop: 4 }}>{ohs.recommendation} {ohs.needsPhysio ? '· нужен физио' : ''}</div>
              <div style={{ fontSize: 10, color: DIM, marginTop: 4 }}>Нормы OHS_NORMS knee-to-wall ≥{OHS_NORMS.kneeToWallCm.optimal}см (cutoff {OHS_NORMS.kneeToWallCm.cutoff}), ankle {OHS_NORMS.ankleDeg.range}, hip {OHS_NORMS.hipFlexion}°/IR {OHS_NORMS.hipIR}°, shoulder {OHS_NORMS.shoulderFlexion}°</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
              <label style={{ fontSize: 11, color: DIM }}>Knee-to-wall см<br /><input value={state.kneeToWallCm} onChange={e => setState(s => ({ ...s, kneeToWallCm: e.target.value }))} placeholder="12" style={{ width: '100%', marginTop: 4, background: '#0a1629', color: '#fff', border: '1px solid #1f3a5f', borderRadius: 8, padding: '6px 8px', fontSize: 12 }} /></label>
              <label style={{ fontSize: 11, color: DIM }}>Голеностоп °<br /><input value={state.ankleDeg} onChange={e => setState(s => ({ ...s, ankleDeg: e.target.value }))} placeholder="35" style={{ width: '100%', marginTop: 4, background: '#0a1629', color: '#fff', border: '1px solid #1f3a5f', borderRadius: 8, padding: '6px 8px', fontSize: 12 }} /></label>
            </div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: DIM }}>Heel-raise retest 2.5см</span>
              <button onClick={() => setState(s => ({ ...s, heelRetest: 'better' }))} style={{ padding: '4px 10px', borderRadius: 999, border: '1px solid', borderColor: state.heelRetest === 'better' ? '#22c55e' : '#1f3a5f', background: state.heelRetest === 'better' ? 'rgba(34,197,94,0.14)' : '#0a1629', color: state.heelRetest === 'better' ? '#22c55e' : DIM, fontSize: 11 }}>Лучше</button>
              <button onClick={() => setState(s => ({ ...s, heelRetest: 'same' }))} style={{ padding: '4px 10px', borderRadius: 999, border: '1px solid', borderColor: state.heelRetest === 'same' ? '#f59e0b' : '#1f3a5f', background: state.heelRetest === 'same' ? 'rgba(245,158,11,0.14)' : '#0a1629', color: state.heelRetest === 'same' ? '#f59e0b' : DIM, fontSize: 11 }}>Без изменений</button>
              <button onClick={() => setState(s => ({ ...s, heelRetest: '' }))} style={{ padding: '4px 10px', borderRadius: 999, border: '1px solid #1f3a5f', background: '#0a1629', color: DIM, fontSize: 11 }}>Сброс</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <label style={{ fontSize: 11, color: DIM }}>Левая макс кг<br /><input value={state.leftMax} onChange={e => setState(s => ({ ...s, leftMax: e.target.value }))} placeholder="100" style={{ width: '100%', marginTop: 4, background: '#0a1629', color: '#fff', border: '1px solid #1f3a5f', borderRadius: 8, padding: '6px 8px', fontSize: 12 }} /></label>
              <label style={{ fontSize: 11, color: DIM }}>Правая макс кг<br /><input value={state.rightMax} onChange={e => setState(s => ({ ...s, rightMax: e.target.value }))} placeholder="102" style={{ width: '100%', marginTop: 4, background: '#0a1629', color: '#fff', border: '1px solid #1f3a5f', borderRadius: 8, padding: '6px 8px', fontSize: 12 }} /></label>
            </div>
            {asymmetry && (
              <div style={{ marginTop: 8, padding: '8px 10px', borderRadius: 8, background: asymmetry.isCrit ? 'rgba(239,68,68,0.08)' : asymmetry.isAsym ? 'rgba(245,158,11,0.08)' : 'rgba(34,197,94,0.08)', border: `1px solid ${asymmetry.isCrit ? 'rgba(239,68,68,0.2)' : asymmetry.isAsym ? 'rgba(245,158,11,0.2)' : 'rgba(34,197,94,0.2)'}` }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: asymmetry.isCrit ? '#ef4444' : asymmetry.isAsym ? '#f59e0b' : '#22c55e' }}>Асимметрия {asymmetry.diff}% {asymmetry.isCrit ? 'CRITICAL ≥12%' : asymmetry.isAsym ? 'WARN ≥7%' : '— норма <7%'} {asymmetry.isAsym ? `→ слабее ${asymmetry.weaker}` : ''}</div>
                <div style={{ fontSize: 10, color: DIM }}>Пороги Bezkorovainyi 7.16% квалиф /12.47% элита.</div>
              </div>
            )}
            {/* E9: антропометрия → хват/старт */}
            <div style={{ marginTop: 8, padding: '8px 10px', borderRadius: 8, background: '#0a1629', border: '1px solid #1f3a5f' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>📏 Антропометрия — хват рывка</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginTop: 6 }}>
                <label style={{ fontSize: 11, color: DIM }}>Рост см<br /><input value={state.anthroHeight} onChange={e => setState(s => ({ ...s, anthroHeight: e.target.value }))} placeholder="180" style={{ width: '100%', marginTop: 4, background: '#0a1629', color: '#fff', border: '1px solid #1f3a5f', borderRadius: 8, padding: '6px 8px', fontSize: 12 }} /></label>
                <label style={{ fontSize: 11, color: DIM }}>Размах см<br /><input value={state.anthroArmSpan} onChange={e => setState(s => ({ ...s, anthroArmSpan: e.target.value }))} placeholder="182" style={{ width: '100%', marginTop: 4, background: '#0a1629', color: '#fff', border: '1px solid #1f3a5f', borderRadius: 8, padding: '6px 8px', fontSize: 12 }} /></label>
                <label style={{ fontSize: 11, color: DIM }}>Плечи см<br /><input value={state.anthroShoulder} onChange={e => setState(s => ({ ...s, anthroShoulder: e.target.value }))} placeholder="42" style={{ width: '100%', marginTop: 4, background: '#0a1629', color: '#fff', border: '1px solid #1f3a5f', borderRadius: 8, padding: '6px 8px', fontSize: 12 }} /></label>
              </div>
              {anthro
                ? <div style={{ marginTop: 6 }}><div style={{ fontSize: 10, color: '#a78bfa' }}>Размах {anthro.diffCm > 0 ? '+' : ''}{anthro.diffCm}см → {anthro.gripAdvice}</div><div style={{ fontSize: 10, color: DIM, marginTop: 2 }}>{anthro.startAdvice}</div></div>
                : <div style={{ fontSize: 10, color: DIM, marginTop: 6 }}>Введи рост + размах — посчитаем хват (Everett: широкий хват = риск промаха назад).</div>}
              <button onClick={applyAnthroToProfile} style={{ marginTop: 6, width: '100%', padding: '6px 12px', borderRadius: 8, background: 'rgba(167,139,250,0.10)', border: '1px solid rgba(167,139,250,0.2)', color: '#a78bfa', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>→ Размах/плечи в профиль</button>
            </div>
            {/* E11: split-jerk ножницы L/R */}
            <div style={{ marginTop: 8, padding: '8px 10px', borderRadius: 8, background: '#0a1629', border: '1px solid #1f3a5f' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>🦵 Ножницы толчка — левая/правая впереди</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 6 }}>
                <label style={{ fontSize: 11, color: DIM }}>Левая впереди кг<br /><input value={state.jerkLeftFwd} onChange={e => setState(s => ({ ...s, jerkLeftFwd: e.target.value }))} placeholder="95 нож" style={{ width: '100%', marginTop: 4, background: '#0a1629', color: '#fff', border: '1px solid #1f3a5f', borderRadius: 8, padding: '6px 8px', fontSize: 12 }} /></label>
                <label style={{ fontSize: 11, color: DIM }}>Правая впереди кг<br /><input value={state.jerkRightFwd} onChange={e => setState(s => ({ ...s, jerkRightFwd: e.target.value }))} placeholder="100 нож" style={{ width: '100%', marginTop: 4, background: '#0a1629', color: '#fff', border: '1px solid #1f3a5f', borderRadius: 8, padding: '6px 8px', fontSize: 12 }} /></label>
              </div>
              {jerkAsym && <div style={{ fontSize: 10, color: jerkAsym.isCrit ? '#ef4444' : jerkAsym.isAsym ? '#f59e0b' : '#22c55e', marginTop: 6 }}>Ножницы {jerkAsym.diffPct}% {jerkAsym.isCrit ? 'CRITICAL ≥12%' : jerkAsym.isAsym ? 'WARN ≥7%' : '— норма'} — {jerkAsym.text}</div>}
              {jerkTrend && <div style={{ fontSize: 10, color: DIM, marginTop: 4 }}>Тренд разницы ({jerkTrend.n} зам.): {jerkTrend.deltaPp > 0 ? '+' : ''}{jerkTrend.deltaPp} п.п. {jerkTrend.deltaPp <= 0 ? '— выравнивается ✓' : '— растёт ⚠️'}</div>}
              <button onClick={takeJerkSnapshot} style={{ marginTop: 6, width: '100%', padding: '6px 12px', borderRadius: 8, background: 'rgba(59,130,246,0.10)', border: '1px solid rgba(59,130,246,0.2)', color: '#60a5fa', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>📸 Снимок ножниц</button>
            </div>
            <button onClick={applyMobilityToProfile} style={{ marginTop: 8, width: '100%', padding: '8px 12px', borderRadius: 8, background: ohs.failed > 0 ? 'rgba(59,130,246,0.14)' : 'rgba(34,197,94,0.10)', border: `1px solid ${ohs.failed > 0 ? 'rgba(59,130,246,0.22)' : 'rgba(34,197,94,0.18)'}`, color: ohs.failed > 0 ? '#60a5fa' : '#22c55e', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>→ Применить OHS в профиль {ohs.failed ? `(${ohs.failed}/6 → ${ohs.primaryDriver || 'ограничения'})` : '(OK)'}</button>
            {/* Legacy compat fields hidden but synced */}
            <div style={{ display: 'none' }}><input value={state.overheadSquat} readOnly /><input value={state.ankleDorsiflex} readOnly /></div>
          </div>
        )}
      </div>

      {/* Summary */}
      <div style={{ ...CARD, padding: 12, background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.16)' }}>
        <div style={{ fontSize: 11, color: DIM, marginBottom: 6 }}>Выбрано: {weakPoints.length ? weakPoints.map(w => WL_WEAKPOINT_LABELS[w] || w).join(' · ') : '— баланс'} {asymmetry?.isAsym ? `· асимметрия ${asymmetry.diff}%` : ''} · score {score} · ver {scoring.verification} {scoring.floors.join(' · ')}</div>
        <div style={{ fontSize: 10, color: DIM, marginBottom: 8 }}>{scoring.findings.map(f => f.text).join(' · ')}</div>
        {/* E1: аудит плана ТА */}
        <div style={{ padding: '8px 10px', borderRadius: 8, background: '#0a1629', border: '1px solid #1f3a5f', marginBottom: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>
            📋 Аудит плана: {planAudit.hasPlan ? `покрытие фаз ${planAudit.coveredCount}/${planAudit.totalCore} (${planAudit.coveragePct}%) · сетов ${planAudit.totalSets} · тоннаж ${(planAudit.totalTonnage / 1000).toFixed(1)}т` : 'план ТА не собран — собери в ТА-конструкторе'}
          </div>
          {planAudit.hasPlan && planAudit.missing.length > 0 && <div style={{ fontSize: 10, color: '#f59e0b', marginTop: 4 }}>Нет в плане: {planAudit.missing.map(w => WL_WEAKPOINT_LABELS[w] || w).join(' · ')}</div>}
          {planAudit.hasPlan && planAudit.missing.length === 0 && <div style={{ fontSize: 10, color: '#22c55e', marginTop: 4 }}>Все 11 фаз двоеборья покрыты ✓</div>}
          {planAudit.hasPlan && planAudit.worstPhase && (
            <button onClick={selectWorstPhase} style={{ marginTop: 6, padding: '6px 12px', borderRadius: 8, background: 'rgba(59,130,246,0.14)', border: '1px solid #1f3a5f', color: '#60a5fa', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
              🎯 Худшая фаза: {WL_WEAKPOINT_LABELS[planAudit.worstPhase] || planAudit.worstPhase} ({planAudit.byPhase[planAudit.worstPhase].sets} сетов) → разобрать
            </button>
          )}
        </div>
        {level === 'critical' && <div style={{ fontSize: 11, color: '#ef4444', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.18)', borderRadius: 8, padding: '8px 10px', marginBottom: 8 }}>⚠️ CRITICAL — план будет урезан (MRV gate) и требует коррекции до пика. Рекомендуется OHS + VBT retest.</div>}
        {/* E5/E6: спец-блок + инъекция в план + откат */}
        {specPreview && specPreview.weakPoints.length > 0 && (
          <div style={{ padding: '8px 10px', borderRadius: 8, background: 'rgba(168,85,247,0.07)', border: '1px solid rgba(168,85,247,0.16)', marginBottom: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#a78bfa' }}>📅 Спец-блок {specPreview.totalWeeks} нед: {specPreview.weeks.map(w => `Н${w.week} ${Object.values(w.targetSets)[0]}×5`).join(' · ')}</div>
            <div style={{ fontSize: 10, color: DIM, marginTop: 2 }}>{specPreview.rationale[0]}</div>
            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              <button onClick={handleInjectToPlan} style={{ flex: 1, padding: '8px 12px', borderRadius: 8, background: 'linear-gradient(135deg,#3b82f6,#a855f7)', color: '#fff', border: 'none', fontWeight: 800, fontSize: 12, cursor: 'pointer' }}>💉 Вставить коррекции в план ({specPreview.weakPoints.length} фазы × все нед)</button>
              {hasInjectPrev && <button onClick={handleRollbackInject} style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>↩ Откат</button>}
            </div>
          </div>
        )}
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={applyToConstructor} style={{ flex: 1, padding: '10px 14px', borderRadius: 8, background: 'linear-gradient(135deg,#3b82f6,#a855f7)', color: '#fff', border: 'none', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>→ Применить в ТА-конструктор ({weakPoints.join(', ') || 'баланс'})</button>
          <button onClick={handleExport} style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>🖨 HTML</button>
          <button onClick={handleExportCsv} style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>📊 CSV</button>
        </div>
        <div style={{ fontSize: 10, color: DIM, marginTop: 6 }}>Pose stub: hip {mockPose.angles.hip}° knee {mockPose.angles.knee}° {mockPose.status.ok ? '✓' : `⚠ ${mockPose.status.faults.join(', ')}`}</div>
      </div>
    </div>
  );
};

export default WLDiagnosticsHub;
