/** StrongmanDiagnosticsHub.tsx — ХАБ диагностики стронгмена (PRO v2).
 *  6 табов: Жим | Переноски | Загрузки | Хват/Кор | Мобильность | Видео
 *  - SM_BIOMECH 13 фаз (углы + биомеханика + коррекции) как TA_BIOMECH
 *  - RSS-скоринг scoreSM (weak/asym/sway/vbt/mobility/grip/axial)
 *  - VBT carry 15%/stone 15% (Hindle), OHS 6 + grip tri-modal, Kinovea sway, contest packet
 *  - Вывод в конструктор Стронг via planner-bridge (mode:strongman)
 */
import React, { useMemo, useState, useEffect } from 'react';
import { EVENT_META } from '../../../engines/strength-sport/strength-sport-event-types';
import { CONTEST_PRESETS } from '../../../engines/strength-sport/strength-sport-contest.types';
import { WL_WEAKPOINT_LABELS } from '../../../engines/strength-sport/strength-sport-weakpoint';
import { SM_BIOMECH, diagnoseSMWeakPoint, SM_WEAKPOINT_CORRECTION, type SMWeakPoint } from '../../../engines/strength-sport/strength-sport-sm-biomechanics.engine';
import { scoreSM, smScoreColor } from '../../../engines/strength-sport/strength-sport-sm-scoring.engine';
import { assessOHS, OHS_NORMS, appendOHSSnapshot, ohsScoreTrend } from '../../../engines/strength-sport/strength-sport-ohs.engine';
import { buildSMBackup, downloadSMBackup, smStorageBytes, SM_STORAGE_KEYS } from '../../../engines/strength-sport/strength-sport-sm-storage.engine';
import { VBT_SS_THRESHOLDS } from '../../../engines/strength-sport/strength-sport-vbt.engine';
import { diagnoseVelocityLossSS } from '../../../engines/strength-sport/strength-sport-vbt.engine';
import { parseKinoveaCSV, analyzeBarTracking, diagnoseCarrySway } from '../../../engines/strength-sport/strength-sport-video.engine';
import { detectSMWeakFromDiary, candidateSMWeakPointsFromDiary } from '../../../engines/strength-sport/strength-sport-sm-diary.engine';
import { buildSMDiagnosticsHtml, downloadSMHtml, downloadSMCsv } from '../../../engines/strength-sport/strength-sport-sm-export.engine';
import { LIMITER_OPTIONS } from '../../../engines/pro/limiter-calculator.engine';
import { estimateAnglesFromLandmarks, livePoseStatus, createMockPoseStream } from '../../../engines/strength-sport/strength-sport-pose.engine';
import { validatePassport, validateContestPassports } from '../../../engines/strength-sport/strength-sport-passport.engine';
import { correctEnodeByVariable } from '../../../engines/strength-sport/strength-sport-barpath.engine';
import { getStrong } from '../../../engines/strength-sport/strength-sport-volume';
import { diagnoseSMWeakCause, SM_WEAK_CAUSE_LABELS } from '../../../engines/strength-sport/strength-sport-sm-weak-cause.engine';
import { rankCorrectionsForSM } from '../../../engines/strength-sport/strength-sport-sm-correction-rank.engine';
import { buildSMSpecBlock } from '../../../engines/strength-sport/strength-sport-sm-spec-block.engine';
import { simulateContest } from '../../../engines/strength-sport/strength-sport-contest-simulator.engine';
import { buildSMAttemptsForContest } from '../../../engines/strength-sport/strength-sport-sm-attempts-bridge.engine';
import { diagnoseSMAnthro } from '../../../engines/strength-sport/strength-sport-sm-anthro.engine';
import { diagnoseSMGripAsymmetry, appendSMGripSnapshot, smGripTrend } from '../../../engines/strength-sport/strength-sport-sm-asymmetry.engine';
import { diagnoseSMHold } from '../../../engines/strength-sport/strength-sport-sm-hold.engine';
import { appendSMProgress, smProgressTrend, loadSMProgress, saveSMProgress } from '../../../engines/strength-sport/strength-sport-sm-progress.engine';
import { buildSMIcs, downloadSMIcs } from '../../../engines/strength-sport/strength-sport-sm-ics.engine';
import { buildSMAnnualOverlay, saveSMAnnualOverlay } from '../../../engines/strength-sport/strength-sport-sm-annual-bridge.engine';
import { calibrateSMLVP, smLvpPointsFromRamp, saveSMLVPProfile, loadSMLVPProfile, smLvpLiftFor } from '../../../engines/strength-sport/strength-sport-sm-lvp-calibration.engine';
import { diagnoseLogDip } from '../../../engines/strength-sport/strength-sport-sm-biomechanics.engine';
import { smPoseCheckFromCsv } from '../../../engines/strength-sport/strength-sport-sm-pose-check.engine';
import { smCondSessionFor, allSMCondSessions } from '../../../engines/strength-sport/strength-sport-sm-conditioning.engine';
import { carryPhysics } from '../../../engines/strength-sport/strength-sport-carry-physics.engine';
import { stoneMoment } from '../../../engines/strength-sport/strength-sport-stone-moment.engine';
import { buildSMGripProfile, smGripFailsCalibrated, loadSMGripProfile, saveSMGripProfile } from '../../../engines/strength-sport/strength-sport-sm-grip-calibration.engine';
import { heazlewoodCheck, axialMomentCheck, mixedGripCheck } from '../../../engines/strength-sport/strength-sport-sm-safety.engine';
import { applyToPlanner } from './planner-bridge';
import { CARD, DIM, ACCENT } from './training-ui';
import { loadSRPESessions } from '../../../engines/pro/srpe-store';
import { toDailyLoads, acuteChronicRatio } from '../../../engines/pro/training-load.engine';

const STORAGE_KEY = 'he_strongman_diagnostics_hub_v1';

type SMTab = 'press' | 'carry' | 'load' | 'grip' | 'mobility' | 'video';

type SMState = {
  pressWeak: string[];
  carryWeak: string[];
  loadWeak: string[];
  gripWeak: string[];
  yokeKg: string;
  farmersKg: string;
  stoneKg: string;
  logKg: string;
  axleKg: string;
  gripHoldSec: string;
  pinchHoldSec: string;
  axleHoldSec: string;
  corePlankSec: string;
  platformHeightCm: string;
  tackyUsed: boolean;
  diameterCm: string;
  surface: string;
  swayCm: string;
  yokeSwayCm: string;
  vbtYokeBest: string;
  vbtYokeLast: string;
  vbtStoneBest: string;
  vbtStoneLast: string;
  vbtLogBest: string;
  vbtLogLast: string;
  leftMax: string;
  rightMax: string;
  ohsHeelsFlat: boolean;
  ohsKneeValgus: boolean;
  ohsHipBelowParallel: boolean;
  ohsTrunkUpright: boolean;
  ohsArmsOverMidfoot: boolean;
  ohsLumbarNeutral: boolean;
  kneeToWallCm: string;
  ankleDeg: string;
  heelRetest: '' | 'better' | 'same';
  contestId: string;
  turnNeeded: boolean;
  conditioningFail: boolean;
  // SM PRO: LVP ramp + log-dip + hold + anthro + progress + attempts/strategy + grip-calib
  lvpLift: string;
  lvp50: string;
  lvp65: string;
  lvp75: string;
  lvp90: string;
  lvpResult: string;
  logDipCm: string;
  logDipMs: string;
  logHoldSec: string;
  farmersHoldSec: string;
  axleDohKg: string;
  bodyweightKg: string;
  deadliftKg: string;
  anthroHeight: string;
  anthroArmSpan: string;
  progYoke20m: string;
  progFarmers40m: string;
  progLogMax: string;
  progStoneLadder: string;
  progBw: string;
  strategy: string;
  pinchWidth: string;
  cocLevel: string;
  fatGripMm: string;
  specWeeks: string;
  annualStartWeek: string;
  mixGrip: string;
  armsBent: boolean;
  poseCsv: string;
  poseLift: string;
};

const DEFAULT_STATE: SMState = {
  pressWeak: [], carryWeak: [], loadWeak: [], gripWeak: [],
  yokeKg: '', farmersKg: '', stoneKg: '', logKg: '', axleKg: '',
  gripHoldSec: '', pinchHoldSec: '', axleHoldSec: '', corePlankSec: '',
  platformHeightCm: '', tackyUsed: false, diameterCm: '', surface: '', swayCm: '', yokeSwayCm: '',
  vbtYokeBest: '', vbtYokeLast: '', vbtStoneBest: '', vbtStoneLast: '', vbtLogBest: '', vbtLogLast: '',
  leftMax: '', rightMax: '',
  ohsHeelsFlat: true, ohsKneeValgus: false, ohsHipBelowParallel: true, ohsTrunkUpright: true, ohsArmsOverMidfoot: true, ohsLumbarNeutral: true,
  kneeToWallCm: '', ankleDeg: '', heelRetest: '',
  contestId: '', turnNeeded: false, conditioningFail: false,
  lvpLift: 'yoke_walk', lvp50: '', lvp65: '', lvp75: '', lvp90: '', lvpResult: '',
  logDipCm: '', logDipMs: '', logHoldSec: '', farmersHoldSec: '', axleDohKg: '',
  bodyweightKg: '', deadliftKg: '', anthroHeight: '', anthroArmSpan: '',
  progYoke20m: '', progFarmers40m: '', progLogMax: '', progStoneLadder: '', progBw: '',
  strategy: 'balanced', pinchWidth: '3in', cocLevel: 'coc1_5', fatGripMm: '50',
  specWeeks: '6', annualStartWeek: '1', mixGrip: 'overhand', armsBent: false,
  poseCsv: '', poseLift: 'yoke_walk',
};

const TAB_DEFS: Array<{ id: SMTab; label: string; icon: string; desc: string }> = [
  { id: 'press', label: 'Жим', icon: '🏋️', desc: 'лог/аксель/жим' },
  { id: 'carry', label: 'Переноски', icon: '🚜', desc: 'йок/фермер/рама' },
  { id: 'load', label: 'Загрузки', icon: '🪨', desc: 'камни/мешок/кега' },
  { id: 'grip', label: 'Хват/Кор', icon: '✊', desc: 'хват + кор + кондиция' },
  { id: 'mobility', label: 'Мобильность', icon: '🧘', desc: 'OHS 6 + sway' },
  { id: 'video', label: 'Видео', icon: '📹', desc: 'Kinovea/sway' },
];

const PRESS_OPTS = [
  { id: 'press_start', label: WL_WEAKPOINT_LABELS.press_start, sm: 'log_dip' as SMWeakPoint },
  { id: 'jerk_lockout', label: WL_WEAKPOINT_LABELS.jerk_lockout, sm: 'log_lockout' as SMWeakPoint },
  { id: 'jerk_drive', label: WL_WEAKPOINT_LABELS.jerk_drive, sm: 'log_drive' as SMWeakPoint },
  { id: 'log_clean', label: SM_BIOMECH.log_clean.label, sm: 'log_clean' as SMWeakPoint },
];
const CARRY_OPTS = [
  { id: 'squat_bottom', label: 'Йок: низ (глубина)', sm: 'yoke_pickup' as SMWeakPoint },
  { id: 'squat_mid', label: 'Йок: середина', sm: 'yoke_walk' as SMWeakPoint },
  { id: 'pull_start', label: 'Фермер: старт', sm: 'farmers_pickup' as SMWeakPoint },
  { id: 'yoke_turn', label: SM_BIOMECH.yoke_turn.label, sm: 'yoke_turn' as SMWeakPoint },
  { id: 'farmers_carry', label: SM_BIOMECH.farmers_carry.label, sm: 'farmers_carry' as SMWeakPoint },
];
const LOAD_OPTS = [
  { id: 'pull_start', label: 'Камень: отрыв', sm: 'stone_off_floor' as SMWeakPoint },
  { id: 'squat_bottom', label: 'Камень: загрузка', sm: 'stone_load' as SMWeakPoint },
  { id: 'press_start', label: 'Мешок: жим', sm: 'stone_lap' as SMWeakPoint },
];
const GRIP_OPTS = [
  { id: 'grip', label: 'Хват слаб', sm: 'farmers_grip' as SMWeakPoint },
  { id: 'core', label: 'Кор слаб', sm: 'core_brace' as SMWeakPoint },
  { id: 'conditioning', label: 'Кондиция', sm: 'conditioning' as SMWeakPoint },
  { id: 'grip_support', label: SM_BIOMECH.grip_support.label, sm: 'grip_support' as SMWeakPoint },
];

export const StrongmanDiagnosticsHub: React.FC = () => {
  const [state, setState] = useState<SMState>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return { ...DEFAULT_STATE, ...JSON.parse(raw) };
    } catch {}
    return DEFAULT_STATE;
  });
  const [tab, setTab] = useState<SMTab>('press');
  const [toast, setToast] = useState<string>('');
  const [csvText, setCsvText] = useState<string>('');
  const [poseResult, setPoseResult] = useState<{ verdict: string; lines: string[]; n: number } | null>(null);

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
      const raw = localStorage.getItem('he_workout_log') || localStorage.getItem('he_training_log') || localStorage.getItem('he_workout_log_v1');
      const logs = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(logs)) return [];
      return detectSMWeakFromDiary(logs as any);
    } catch { return []; }
  }, []);

  const diaryPhases = useMemo(() => {
    try {
      const raw = localStorage.getItem('he_workout_log') || localStorage.getItem('he_training_log') || localStorage.getItem('he_workout_log_v1');
      const logs = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(logs)) return [];
      const y = candidateSMWeakPointsFromDiary(logs as any, 'yoke');
      const s = candidateSMWeakPointsFromDiary(logs as any, 'stone');
      const f = candidateSMWeakPointsFromDiary(logs as any, 'farmers');
      return [...y, ...s, ...f].slice(0, 3);
    } catch { return []; }
  }, []);

  const weakPoints = useMemo(() => {
    const all = [...state.pressWeak, ...state.carryWeak, ...state.loadWeak, ...state.gripWeak];
    return Array.from(new Set(all)).slice(0, 4);
  }, [state.pressWeak, state.carryWeak, state.loadWeak, state.gripWeak]);

  const smWeakPoints = useMemo(() => {
    const map: Record<string, SMWeakPoint> = {};
    for (const o of [...PRESS_OPTS, ...CARRY_OPTS, ...LOAD_OPTS, ...GRIP_OPTS]) map[o.id] = o.sm;
    return weakPoints.map(w => map[w] || w as SMWeakPoint);
  }, [weakPoints]);

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
    ankleDorsiflexDeg: state.ankleDeg ? parseFloat(state.ankleDeg) : null,
    heelRaiseRetest: state.heelRetest === 'better' ? true : state.heelRetest === 'same' ? false : null,
  }), [state.ohsHeelsFlat, state.ohsKneeValgus, state.ohsHipBelowParallel, state.ohsTrunkUpright, state.ohsArmsOverMidfoot, state.ohsLumbarNeutral, state.kneeToWallCm, state.ankleDeg, state.heelRetest]);

  const swayCm = useMemo(() => {
    const v = parseFloat(state.swayCm || state.yokeSwayCm);
    return Number.isFinite(v) ? v : null;
  }, [state.swayCm, state.yokeSwayCm]);

  const swayDiag = useMemo(() => swayCm != null ? diagnoseCarrySway(swayCm) : null, [swayCm]);

  const vbtLoss = useMemo(() => {
    // пробуем yoke, затем stone, затем log — первый валидный
    const pairs: Array<[string, string]> = [[state.vbtYokeBest, state.vbtYokeLast], [state.vbtStoneBest, state.vbtStoneLast], [state.vbtLogBest, state.vbtLogLast]];
    for (const [b, l] of pairs) {
      const best = parseFloat(b), last = parseFloat(l);
      if (Number.isFinite(best) && Number.isFinite(last) && best) {
        // для стронга порог 15% (carry/stone), 10% для log — берём 15 как базовый для SM
        const r = diagnoseVelocityLossSS(best, last, 15 as any, undefined, 'yoke_walk');
        if (r) return r;
      }
    }
    return null;
  }, [state.vbtYokeBest, state.vbtYokeLast, state.vbtStoneBest, state.vbtStoneLast, state.vbtLogBest, state.vbtLogLast]);

  const gripFails = useMemo(() => {
    let fails = 0;
    const g = parseFloat(state.gripHoldSec);
    const p = parseFloat(state.pinchHoldSec);
    const a = parseFloat(state.axleHoldSec);
    if (state.gripHoldSec && Number.isFinite(g) && g < 30) fails++;
    if (state.pinchHoldSec && Number.isFinite(p) && p < 20) fails++;
    if (state.axleHoldSec && Number.isFinite(a) && a < 30) fails++;
    if (state.gripWeak.includes('grip') || state.gripWeak.includes('grip_support')) fails = Math.max(fails, 1);
    if (fails > 3) fails = 3;
    return fails;
  }, [state.gripHoldSec, state.pinchHoldSec, state.axleHoldSec, state.gripWeak]);

  const axialOverload = useMemo(() => {
    const hasHeavy = (parseFloat(state.yokeKg) || 0) > 250 || (parseFloat(state.stoneKg) || 0) > 120;
    const hasMany = weakPoints.includes('core') || state.gripWeak.includes('core');
    return hasHeavy || hasMany;
  }, [state.yokeKg, state.stoneKg, weakPoints, state.gripWeak]);

  const scoring = useMemo(() => scoreSM({
    weakCount: weakPoints.length,
    asymmetryPct: asymmetry?.diff ?? null,
    carrySwayCm: swayCm,
    swayDeviation: null,
    vbtLossPct: vbtLoss?.lossPct ?? null,
    mobilityFails: ohs.failed,
    gripFails: gripFails || null,
    axialOverload,
    conditioningFail: state.conditioningFail || state.gripWeak.includes('conditioning') || false,
    hasVideo: !!swayCm || !!csvText,
    hasVbt: !!vbtLoss,
    hasMobility: ohs.failed !== 6,
    hasGrip: gripFails > 0 || !!state.gripHoldSec,
  }), [weakPoints.length, asymmetry, swayCm, vbtLoss, ohs.failed, gripFails, axialOverload, state.conditioningFail, state.gripWeak, csvText, state.gripHoldSec]);

  const score = scoring.score;
  const level = scoring.level;
  const sColor = smScoreColor(level);

  const limiterForPhase = useMemo(() => {
    const wp = smWeakPoints[0];
    if (!wp) return [];
    let cat = 'speed_strength';
    if (['yoke_pickup','farmers_pickup','stone_off_floor','log_clean'].includes(wp)) cat = 'start_specific';
    else if (['yoke_walk','farmers_carry','stone_load','log_lockout','yoke_turn'].includes(wp)) cat = 'stabilization';
    else if (['log_dip','log_drive'].includes(wp)) cat = 'speed_strength';
    else if (['farmers_grip','grip_support'].includes(wp)) cat = 'grip_stiffness';
    else if (['core_brace'].includes(wp)) cat = 'stabilization';
    else if (wp === 'conditioning') cat = 'endurance_profile';
    return LIMITER_OPTIONS.filter(o => o.category === cat as any).slice(0, 2);
  }, [smWeakPoints]);

  const contest = useMemo(() => {
    const id = state.contestId;
    if (!id) return null;
    return (CONTEST_PRESETS as any)[id] || null;
  }, [state.contestId]);

  const mockPose = useMemo(() => {
    const frames = createMockPoseStream();
    const ang = estimateAnglesFromLandmarks(frames[0]);
    return { angles: ang, status: livePoseStatus(ang) };
  }, []);

  const passportResult = useMemo(() => {
    const h = parseFloat(state.platformHeightCm);
    const yW = parseFloat(state.yokeKg);
    const sW = parseFloat(state.stoneKg);
    const fW = parseFloat(state.farmersKg);
    const lW = parseFloat(state.logKg);
    const diam = parseFloat(state.diameterCm);
    const errs: string[] = [];
    const warns: string[] = [];
    if (Number.isFinite(yW) && yW) { const r = validatePassport('yoke_walk', { weight: yW, distanceM: 20, timeCapS: 60, turn: state.turnNeeded }); errs.push(...r.errors); warns.push(...r.warnings); }
    if (Number.isFinite(sW) && sW) { const r = validatePassport('atlas_stone_load', { weight: sW, heightCm: Number.isFinite(h) ? h : 140, tacky: state.tackyUsed }); errs.push(...r.errors); warns.push(...r.warnings); }
    if (Number.isFinite(fW) && fW) { const r = validatePassport('farmers_walk_heavy', { weight: fW, distanceM: 40 }); errs.push(...r.errors); warns.push(...r.warnings); }
    if (Number.isFinite(lW) && lW) { const r = validatePassport('log_press', { weight: lW, diameterCm: Number.isFinite(diam) ? diam : undefined }); errs.push(...r.errors); warns.push(...r.warnings); }
    if (state.surface && state.surface !== 'не выбрано') warns.push(`покрытие: ${state.surface}`);
    if (contest && contest.events?.length) { const cr = validateContestPassports(contest as any); errs.push(...cr.errors); warns.push(...cr.warnings); }
    return { errors: errs.slice(0,3), warnings: warns.slice(0,3) };
  }, [state.yokeKg, state.stoneKg, state.farmersKg, state.logKg, state.diameterCm, state.surface, state.platformHeightCm, state.tackyUsed, state.turnNeeded, contest]);

  const axialProgress = useMemo(() => {
    const lm = getStrong('intermediate', 'carry');
    const mrv = lm?.mrv ?? 380;
    const curM = (parseFloat(state.yokeKg) > 0 ? 20 : 0) + (parseFloat(state.farmersKg) > 0 ? 40 : 0);
    const pct = mrv ? Math.min(100, Math.round((curM / mrv) * 100)) : 0;
    return { curM, mrv, pct };
  }, [state.yokeKg, state.farmersKg]);

  const enodeCorrected = useMemo(() => swayCm != null ? correctEnodeByVariable(swayCm, 'xLoop') : null, [swayCm]);

  // ── SM PRO: физика переноски/камня + симулятор + попытки + причины/ранжир/спек + hold/anthro/safety ──
  const bwKg = useMemo(() => { const v = parseFloat(state.bodyweightKg); return Number.isFinite(v) && v > 0 ? v : null; }, [state.bodyweightKg]);
  const carryPhys = useMemo(() => {
    const yW = parseFloat(state.yokeKg);
    if (!Number.isFinite(yW) || !yW || bwKg == null) return null;
    return carryPhysics({ loadKg: yW, bodyweightKg: bwKg, type: 'yoke', distanceM: 20 });
  }, [state.yokeKg, bwKg]);
  const stoneMom = useMemo(() => {
    const sW = parseFloat(state.stoneKg);
    if (!Number.isFinite(sW) || !sW) return null;
    const diam = parseFloat(state.diameterCm);
    const h = parseFloat(state.platformHeightCm);
    return stoneMoment({ loadKg: sW, diameterCm: Number.isFinite(diam) ? diam : 40, torsoAngleDeg: 45, heightCm: Number.isFinite(h) ? h : 140, athleteHeightCm: bwKg != null && state.anthroHeight ? parseFloat(state.anthroHeight) : 178 });
  }, [state.stoneKg, state.diameterCm, state.platformHeightCm, state.anthroHeight, bwKg]);
  const workMaxForSim = useMemo(() => ({
    yokeWalk: parseFloat(state.yokeKg) || 0,
    farmersWalk: parseFloat(state.farmersKg) || 0,
    atlasStone: parseFloat(state.stoneKg) || 0,
    logPress: parseFloat(state.logKg) || 0,
    axlePress: parseFloat(state.axleKg) || 0,
  }), [state.yokeKg, state.farmersKg, state.stoneKg, state.logKg, state.axleKg]);
  const contestSim = useMemo(() => {
    if (!contest) return null;
    try { return simulateContest(contest as any, workMaxForSim as any, (state.strategy as any) || 'balanced'); } catch { return null; }
  }, [contest, workMaxForSim, state.strategy]);
  const attemptsBridge = useMemo(() => {
    try {
      return buildSMAttemptsForContest(state.contestId || null, {
        yokeKg: parseFloat(state.yokeKg) || null,
        farmersKg: parseFloat(state.farmersKg) || null,
        stoneKg: parseFloat(state.stoneKg) || null,
        logKg: parseFloat(state.logKg) || null,
        axleKg: parseFloat(state.axleKg) || null,
      }, (state.strategy as any) || 'balanced', contest as any);
    } catch { return null; }
  }, [state.contestId, state.yokeKg, state.farmersKg, state.stoneKg, state.logKg, state.axleKg, state.strategy, contest]);
  const smCauses = useMemo(() => smWeakPoints.map((wp) => diagnoseSMWeakCause({
    zone: wp as any,
    factSetsPerWeek: null,
    e1rmDeltaPct: diaryWeaks.find((d) => String(d.lift).toLowerCase().includes(String(wp).split('_')[0]))?.deltaPct ?? null,
    e1rmSessions: 2,
    acwrZone: acwr ? (acwr as { zone?: string }).zone ?? null : null,
    vbtLossPct: vbtLoss?.lossPct ?? null,
    ohsFailed: ohs.failed,
    gripFails,
    swayCm,
    asymmetryPct: asymmetry?.diff ?? null,
  })), [smWeakPoints, diaryWeaks, acwr, vbtLoss, ohs.failed, gripFails, swayCm, asymmetry]);
  const smRankTop = useMemo(() => {
    const wp = smWeakPoints[0] as any;
    if (!wp) return [];
    try {
      let profile: string[] = [];
      try {
        const raw = localStorage.getItem('he_profile_v2');
        const p = raw ? JSON.parse(raw) : null;
        profile = p?.training?.mobilityRestrictions || p?.health?.mobilityRestrictions || [];
      } catch { /* noop */ }
      return rankCorrectionsForSM(wp, { cause: smCauses[0]?.cause ?? null, mobilityRestrictions: profile });
    } catch { return []; }
  }, [smWeakPoints, smCauses]);
  const smSpec = useMemo(() => {
    if (!smWeakPoints.length) return null;
    try { return buildSMSpecBlock({ weakPoints: smWeakPoints as any, weeks: parseInt(state.specWeeks) || 6 }); } catch { return null; }
  }, [smWeakPoints, state.specWeeks]);
  const logDipDiag = useMemo(() => {
    const d = parseFloat(state.logDipCm);
    if (!Number.isFinite(d) || !d) return null;
    const t = state.logDipMs ? parseFloat(state.logDipMs) / 1000 : null;
    return diagnoseLogDip(d, t, bwKg, parseFloat(state.logKg) || null);
  }, [state.logDipCm, state.logDipMs, bwKg, state.logKg]);
  const holdDiag = useMemo(() => diagnoseSMHold({
    bodyweightKg: bwKg,
    deadliftKg: parseFloat(state.deadliftKg) || null,
    logHoldSec: state.logHoldSec ? parseFloat(state.logHoldSec) : null,
    farmersHoldSec: state.farmersHoldSec ? parseFloat(state.farmersHoldSec) : null,
    farmersHoldKg: parseFloat(state.farmersKg) || null,
    axleDohKg: state.axleDohKg ? parseFloat(state.axleDohKg) : null,
  }), [bwKg, state.deadliftKg, state.logHoldSec, state.farmersHoldSec, state.farmersKg, state.axleDohKg]);
  const anthroDiag = useMemo(() => diagnoseSMAnthro({
    heightCm: state.anthroHeight ? parseFloat(state.anthroHeight) : null,
    armSpanCm: state.anthroArmSpan ? parseFloat(state.anthroArmSpan) : null,
    platformCm: state.platformHeightCm ? parseFloat(state.platformHeightCm) : null,
  }), [state.anthroHeight, state.anthroArmSpan, state.platformHeightCm]);
  const gripAsymDiag = useMemo(() => diagnoseSMGripAsymmetry({
    leftKg: state.leftMax ? parseFloat(state.leftMax) : null,
    rightKg: state.rightMax ? parseFloat(state.rightMax) : null,
  }), [state.leftMax, state.rightMax]);
  const gripProfile = useMemo(() => {
    try { return loadSMGripProfile(); } catch { return null; }
  }, [state.pinchWidth, state.cocLevel, state.fatGripMm]);
  const gripFailsCal = useMemo(() => smGripFailsCalibrated({
    supportSec: state.gripHoldSec ? parseFloat(state.gripHoldSec) : null,
    pinchSec: state.pinchHoldSec ? parseFloat(state.pinchHoldSec) : null,
    crushSec: state.axleHoldSec ? parseFloat(state.axleHoldSec) : null,
  }, gripProfile), [state.gripHoldSec, state.pinchHoldSec, state.axleHoldSec, gripProfile]);
  const axialQuant = useMemo(() => axialMomentCheck({
    yokeKg: parseFloat(state.yokeKg) || null,
    bodyweightKg: bwKg,
    carryMeters: (parseFloat(state.yokeKg) > 0 ? 20 : 0) + (parseFloat(state.farmersKg) > 0 ? 40 : 0),
    stoneMomentNm: stoneMom?.momentNm ?? null,
    axialSets: (parseFloat(state.yokeKg) > 0 ? 6 : 0) + (parseFloat(state.farmersKg) > 0 ? 6 : 0),
  }), [state.yokeKg, state.farmersKg, bwKg, stoneMom]);
  const bicepsWarn = useMemo(() => {
    const out: string[] = [];
    const c1 = heazlewoodCheck({ eventId: 'atlas_stone_load', armsBent: state.armsBent || undefined, loadPct: 95 });
    out.push(...c1.warnings);
    const mg = mixedGripCheck(state.mixGrip, 'axle_deadlift');
    if (mg) out.push(mg);
    return out.slice(0, 3);
  }, [state.armsBent, state.mixGrip]);
  const smProgressHist = useMemo(() => { try { return loadSMProgress(); } catch { return []; } }, []);
  const smTrend = useMemo(() => { try { return smProgressTrend(smProgressHist); } catch { return null; } }, [smProgressHist]);
  const SM_OHS_HIST_KEY = 'he_sm_ohs_hist_v1';
  const smOhsHist = useMemo(() => {
    try {
      const raw = localStorage.getItem(SM_OHS_HIST_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch { return []; }
  }, [ohs.totalScore, ohs.failed]);
  const smOhsTrend = useMemo(() => { try { return ohsScoreTrend(smOhsHist); } catch { return null; } }, [smOhsHist]);
  const smStoreBytes = useMemo(() => { try { return smStorageBytes(); } catch { return { total: 0, byKey: {} }; } }, [csvText, state.lvpResult]);
  const smLvpStored = useMemo(() => {
    try { return loadSMLVPProfile(smLvpLiftFor(state.lvpLift) || state.lvpLift); } catch { return null; }
  }, [state.lvpLift, state.lvpResult]);

  const toggle = (key: keyof Pick<SMState, 'pressWeak'|'carryWeak'|'loadWeak'|'gripWeak'>, id: string) => {
    setState(s => {
      const arr = (s as any)[key] as string[];
      const has = arr.includes(id);
      const next = has ? arr.filter(x=>x!==id) : [...arr, id].slice(0,2);
      return { ...s, [key]: next };
    });
  };

  const applyToConstructor = () => {
    if (weakPoints.length===0) {
      setToast('Слабые зоны не выбраны');
      setTimeout(()=>setToast(''),2500);
      return;
    }
    const biomechDetails = smWeakPoints.map(wp => diagnoseSMWeakPoint(wp as any)).filter(Boolean);
    // synthetic contest wiring for platform/turn when no preset selected
    let effectiveContest: any = contest;
    if (!effectiveContest && (state.platformHeightCm || state.turnNeeded)) {
      const h = state.platformHeightCm ? parseFloat(state.platformHeightCm) : 140;
      effectiveContest = {
        name: 'Кастом (платформа/разворот)',
        events: [
          { id: 'atlas_stone_load', format: 'loading_race', weight: parseFloat(state.stoneKg) || 120, heightCm: Number.isFinite(h) ? h : 140 },
          { id: 'yoke_walk', format: 'medley_distance', weight: parseFloat(state.yokeKg) || 300, distanceM: 20, timeCapS: 60, turn: !!state.turnNeeded },
          { id: 'farmers_walk_heavy', format: 'medley_distance', weight: parseFloat(state.farmersKg) || 120, distanceM: 40, timeCapS: 75, turn: !!state.turnNeeded },
        ],
      };
    } else if (effectiveContest && state.turnNeeded) {
      effectiveContest = { ...effectiveContest, events: effectiveContest.events.map((e: any) => ['yoke_walk','farmers_walk_heavy','frame_carry'].includes(e.id) ? { ...e, turn: true } : e) };
    } else if (effectiveContest && state.platformHeightCm) {
      const h = parseFloat(state.platformHeightCm);
      if (Number.isFinite(h)) effectiveContest = { ...effectiveContest, events: effectiveContest.events.map((e: any) => ['atlas_stone_load','atlas_stone_over_bar','sandbag_over_bar'].includes(e.id) ? { ...e, heightCm: h } : e) };
    }
    // VBT history for builder (per-lift)
    const velocityHistory: Record<string, number[]> = {};
    if (state.vbtYokeBest && state.vbtYokeLast) velocityHistory['yoke_walk'] = [parseFloat(state.vbtYokeBest), parseFloat(state.vbtYokeLast)];
    if (state.vbtStoneBest && state.vbtStoneLast) velocityHistory['atlas_stone_load'] = [parseFloat(state.vbtStoneBest), parseFloat(state.vbtStoneLast)];
    if (state.vbtLogBest && state.vbtLogLast) velocityHistory['log_press'] = [parseFloat(state.vbtLogBest), parseFloat(state.vbtLogLast)];
    const data: any = {
      groups: weakPoints,
      smWeakPoints,
      weakPoints,
      wlWeakPoints: weakPoints,
      smContest: effectiveContest || contest || (CONTEST_PRESETS as any)[Object.keys(CONTEST_PRESETS)[0]],
      contest: effectiveContest || contest,
      platformHeightCm: state.platformHeightCm ? parseFloat(state.platformHeightCm) : null,
      tackyUsed: state.tackyUsed,
      turnNeeded: state.turnNeeded,
      swayCm,
      sway: swayDiag?.text ?? null,
      vbt: vbtLoss ? `${vbtLoss.lossPct}%` : null,
      vbtLossPct: vbtLoss?.lossPct ?? null,
      velocityLossPct: vbtLoss?.lossPct ?? null,
      velocityHistory: Object.keys(velocityHistory).length ? velocityHistory : undefined,
      score, level, verification: scoring.verification,
      diagnosticLevel: level,
      biomech: biomechDetails,
      smBiomech: biomechDetails,
      ohs: { totalScore: ohs.totalScore, failed: ohs.failed },
      gripFails,
      gripFailsCalibrated: gripFailsCal,
      asymmetry: asymmetry?.diff ?? null,
      gripAsymmetry: gripAsymDiag,
      hold: holdDiag,
      anthro: anthroDiag,
      causes: smCauses,
      rankTop: smRankTop,
      specBlock: smSpec,
      contestSim,
      attempts: attemptsBridge,
      carryPhysics: carryPhys,
      stoneMoment: stoneMom,
      axialQuant,
      logDip: logDipDiag,
      lvp: smLvpStored,
      weakPointsSM: smWeakPoints,
    };
    applyToPlanner({
      kind: 'weakpoints',
      label: `Стронг диагностика: ${weakPoints.join(', ')}`,
      data,
      source: 'intellectual',
    });
    setToast(`✓ Применено в Стронг-конструктор: ${weakPoints.join(', ')} (score ${score})`);
    setTimeout(()=>setToast(''),3000);
    try {
      window.dispatchEvent(new CustomEvent('planning-track-open', { detail: 'strength' } as any));
      localStorage.setItem('he_training_planning_track', 'strength');
      localStorage.setItem('he_strength_sport_mode', 'strongman');
    } catch {}
  };

  const handleLvpFit = () => {
    const v = (s: string): number | null => {
      const n = parseFloat(s);
      return Number.isFinite(n) && n > 0.15 ? n : null;
    };
    const pts = smLvpPointsFromRamp(v(state.lvp50) ?? NaN, v(state.lvp65) ?? NaN, v(state.lvp75) ?? NaN, v(state.lvp90) ?? NaN);
    if (!pts) { setToast('LVP: нужно ≥3 точек 50/65/75/90%'); setTimeout(() => setToast(''), 2000); return; }
    const lift = smLvpLiftFor(state.lvpLift) || state.lvpLift;
    const { calibrateSMLVP: fit } = { calibrateSMLVP: calibrateSMLVP };
    const prof = fit(lift, pts.map((p, i) => ({ ...p, loadKg: undefined })));
    if (!prof) { setToast('LVP не сошёлся — скорость должна падать с весом'); setTimeout(() => setToast(''), 2500); return; }
    try { saveSMLVPProfile(prof); } catch { /* noop */ }
    setState((s) => ({ ...s, lvpResult: `r² ${prof.r2} ${prof.valid ? '✓ valid' : '⚠ проверь'} · slope ${prof.slope}` }));
    setToast(`✓ LVP ${lift}: r² ${prof.r2}${prof.valid ? '' : ' — проверь измерения'}`);
    setTimeout(() => setToast(''), 2500);
  };

  const handleSaveProgress = () => {
    const today = new Date().toISOString().slice(0, 10);
    const entry = {
      date: today,
      bodyweightKg: parseFloat(state.progBw || state.bodyweightKg) || 0,
      yoke20mS: state.progYoke20m ? parseFloat(state.progYoke20m) : null,
      farmers40mS: state.progFarmers40m ? parseFloat(state.progFarmers40m) : null,
      logKg: state.progLogMax ? parseFloat(state.progLogMax) : null,
      stoneLadderKg: state.progStoneLadder ? parseFloat(state.progStoneLadder) : null,
    };
    try {
      const hist = loadSMProgress();
      saveSMProgress(appendSMProgress(hist, entry as never));
      try {
        const raw = localStorage.getItem('he_workout_log');
        void raw;
      } catch { /* noop */ }
      setToast('✓ Прогресс сохранён (60 кап)');
      setTimeout(() => setToast(''), 2000);
    } catch { /* noop */ }
  };

  const handleSaveGripProfile = () => {
    try {
      const p = buildSMGripProfile({
        pinchWidth: (state.pinchWidth as never) || '3in',
        cocLevel: (state.cocLevel as never) || 'coc1_5',
        fatGripMm: parseInt(state.fatGripMm) || 50,
      });
      saveSMGripProfile(p);
      setToast(`✓ Grip-профиль: pinch ${p.pinchSec}с / crush ${p.crushSec}с / support ${p.supportSec}с`);
      setTimeout(() => setToast(''), 2500);
    } catch { /* noop */ }
  };

  const handleSaveOHSSnap = () => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const raw = localStorage.getItem(SM_OHS_HIST_KEY);
      const hist = raw ? JSON.parse(raw) : [];
      const next = appendOHSSnapshot(hist, { date: today, score: ohs.totalScore, failed: ohs.failed, level: ohs.level });
      localStorage.setItem(SM_OHS_HIST_KEY, JSON.stringify(next));
      const tr = ohsScoreTrend(next);
      setToast(`✓ OHS-снапшот ${ohs.totalScore}/6${tr && tr.n >= 2 ? ` · тренд ${tr.delta >= 0 ? '+' : ''}${tr.delta}` : ''}`);
      setTimeout(() => setToast(''), 2500);
    } catch { /* noop */ }
  };

  const handleSMBackup = () => {
    try {
      const b = buildSMBackup();
      downloadSMBackup(`sm-backup-${new Date().toISOString().slice(0, 10)}.json`);
      setToast(`✓ Бэкап SM: ${Object.keys(b.data).length}/${SM_STORAGE_KEYS.length} ключей · ${(smStoreBytes.total / 1024).toFixed(1)}КБ`);
      setTimeout(() => setToast(''), 2500);
    } catch { /* noop */ }
  };

  const handleSaveGripSnap = () => {
    try {
      const l = parseFloat(state.leftMax);
      const r = parseFloat(state.rightMax);
      if (!Number.isFinite(l) || !Number.isFinite(r) || !l || !r) { setToast('Введи L/R макс'); setTimeout(() => setToast(''), 2000); return; }
      const d = diagnoseSMGripAsymmetry({ leftKg: l, rightKg: r });
      if (!d) return;
      const key = 'he_sm_grip_hist_v1';
      const raw = localStorage.getItem(key);
      const hist = raw ? JSON.parse(raw) : [];
      const today = new Date().toISOString().slice(0, 10);
      const next = appendSMGripSnapshot(hist, { date: today, left: l, right: r, diffPct: d.diffPct, metric: 'kg' });
      localStorage.setItem(key, JSON.stringify(next));
      const tr = smGripTrend(next);
      setToast(`✓ Grip-снапшот ${d.diffPct}%${tr && tr.n >= 2 ? ` · тренд ${tr.deltaPp}п.п.` : ''}`);
      setTimeout(() => setToast(''), 2500);
    } catch { /* noop */ }
  };

  const handleExportIcs = () => {
    if (!smSpec) { setToast('Нет спец-блока — выбери слабые фазы'); setTimeout(() => setToast(''), 2000); return; }
    const ics = buildSMIcs(smSpec, { title: 'Стронг спец-блок' });
    if (!ics) return;
    downloadSMIcs(ics, `sm-spec-${new Date().toISOString().slice(0, 10)}.ics`);
    setToast('✓ ICS спец-блока');
    setTimeout(() => setToast(''), 2000);
  };

  const handleSaveAnnual = () => {
    if (!smSpec) { setToast('Нет спец-блока'); setTimeout(() => setToast(''), 2000); return; }
    const weeks = buildSMAnnualOverlay(smSpec, { startWeek: parseInt(state.annualStartWeek) || 1 });
    if (!weeks) return;
    saveSMAnnualOverlay(weeks, parseInt(state.annualStartWeek) || 1);
    setToast(`✓ Годовой overlay: ${weeks.length} нед → he_sm_annual_sync_v1`);
    setTimeout(() => setToast(''), 2500);
  };

  const handlePoseParse = () => {
    const r = smPoseCheckFromCsv(state.poseCsv, state.poseLift);
    if (!r) { setToast('Углы не распознаны (t,hip,knee,ankle,shoulder)'); setTimeout(() => setToast(''), 2000); return; }
    setPoseResult({ verdict: r.result.verdict, lines: r.result.lines, n: r.result.n });
    setToast(`✓ Углы: n=${r.result.n} → ${r.result.verdict.toUpperCase()}`);
    setTimeout(() => setToast(''), 2500);
  };

  const handleCsvParse = () => {
    const pts = parseKinoveaCSV(csvText);
    if (!pts) { setToast('CSV не распознан'); setTimeout(()=>setToast(''),2000); return; }
    const res = analyzeBarTracking(pts);
    if (!res) { setToast('Нет точек'); return; }
    const sway = Math.round(res.xLoop * 10)/10;
    setState(s => ({ ...s, swayCm: String(sway), yokeSwayCm: String(sway) }));
    setToast(`✓ Kinovea: sway ${sway}см yMax ${res.yMax}см vmax ${res.vmax} м/с`);
    setTimeout(()=>setToast(''),3000);
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
    if (gripFails >= 2) restrictions.push('wrist');
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
      setToast(`✓ Мобильность ${uniq.join(', ') || 'OK'} → профиль`);
      setTimeout(() => setToast(''), 2500);
    } catch {}
  };

  const proSnapExtra = () => ({
    conditioning: (() => {
      const s = smCondSessionFor({ conditioningFail: state.conditioningFail || state.gripWeak.includes('conditioning'), mhvDecrementPct: vbtLoss?.lossPct ?? null });
      return `${s.goal}: ${s.modality} ${s.sets}×${s.work}/${s.rest}`;
    })(),
    carryPhysics: carryPhys ? carryPhys.note : null,
    stoneMoment: stoneMom ? stoneMom.note : null,
    contestSim: contestSim ? `${contestSim.predictedPlace} место/10 · слабые ${contestSim.weakEvents.join(', ') || '—'} · ${contestSim.recOrder.join(' → ')}` : null,
    attempts: attemptsBridge ? attemptsBridge.rationale.slice(0, 8) : null,
    progress: smTrend ? `n=${smTrend.n} Δscore ${smTrend.scoreDelta} · лог ${smTrend.logDeltaKg ?? '—'}кг · йок ${smTrend.yokeDeltaS ?? '—'}с` : null,
    causes: smCauses.map((c) => `${c.zone}: ${SM_WEAK_CAUSE_LABELS[c.cause]} (${c.confidence})`),
    specBlock: smSpec ? `${smSpec.weakPoints.join(', ')} × ${smSpec.totalWeeks}нед` : null,
  });

  const handleExport = () => {
    const snap: any = {
      weakPoints,
      score, level, verification: scoring.verification,
      sway: swayDiag?.text || null,
      carrySwayCm: swayCm,
      vbt: vbtLoss ? `${vbtLoss.lossPct}%` : null,
      vbtLossPct: vbtLoss?.lossPct ?? null,
      ohs: { totalScore: ohs.totalScore, failed: ohs.failed },
      gripFails,
      asymmetryPct: asymmetry?.diff ?? null,
      platformHeightCm: state.platformHeightCm ? parseFloat(state.platformHeightCm) : null,
      tacky: state.tackyUsed,
      findings: scoring.findings.map(f => f.text),
      ...proSnapExtra(),
    };
    const html = buildSMDiagnosticsHtml(snap);
    downloadSMHtml(html, `strongman-diagnostics-${new Date().toISOString().slice(0,10)}.html`);
    setToast('✓ HTML экспорт');
    setTimeout(()=>setToast(''),2000);
  };
  const handleExportCsv = () => {
    const snap: any = {
      weakPoints,
      score, level, verification: scoring.verification,
      sway: swayDiag?.text || null,
      carrySwayCm: swayCm,
      vbt: vbtLoss ? `${vbtLoss.lossPct}%` : null,
      vbtLossPct: vbtLoss?.lossPct ?? null,
      ohs: { totalScore: ohs.totalScore, failed: ohs.failed },
      gripFails,
      asymmetryPct: asymmetry?.diff ?? null,
      platformHeightCm: state.platformHeightCm ? parseFloat(state.platformHeightCm) : null,
      tacky: state.tackyUsed,
      findings: scoring.findings.map(f => f.text),
      ...proSnapExtra(),
    };
    downloadSMCsv(snap, `strongman-diagnostics-${new Date().toISOString().slice(0,10)}.csv`);
    setToast('✓ CSV экспорт');
    setTimeout(()=>setToast(''),2000);
  };

  const smBiomechForWeak = (wp: string) => {
    const map: Record<string, SMWeakPoint> = {};
    for (const o of [...PRESS_OPTS, ...CARRY_OPTS, ...LOAD_OPTS, ...GRIP_OPTS]) map[o.id] = o.sm;
    const sm = map[wp] as SMWeakPoint | undefined;
    return sm ? diagnoseSMWeakPoint(sm) : null;
  };

  return (
    <div className="train-strongdiag" style={{ padding: '10px 8px 18px', color: '#fff', maxWidth: 860, margin: '0 auto' }}>
      <div style={{ ...CARD, padding: '14px 14px 12px', background: 'linear-gradient(135deg,rgba(239,68,68,0.12),rgba(245,158,11,0.12))', border: '1px solid rgba(239,68,68,0.22)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -18, right: -18, width: 110, height: 110, borderRadius: 110, background: 'radial-gradient(circle,rgba(239,68,68,0.14),transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg,#ef4444,#f59e0b)', color: '#fff', fontWeight: 900, fontSize: 16 }}>🏋️‍♂️</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 900, color: '#fff', lineHeight: 1 }}>Стронгмен-диагностика — хаб PRO</div>
            <div style={{ fontSize: 10, color: '#fff', lineHeight: 1.3, opacity: 0.9 }}>16 фаз (лог 4 + carry 6 + stone 3 + grip/core/cond) × углы + биомеханика + VBT carry 15% + LVP + OHS 6 + hold + grip tri-modal + sway + симулятор + попытки + физика.</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: 52, height: 52, borderRadius: 26, background: `conic-gradient(${sColor} ${score}%, rgba(255,255,255,0.06) 0)`, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `2px solid ${sColor}`, fontWeight: 900, color: '#fff', fontSize: 14 }}>{score}</div>
            <div style={{ fontSize: 9, color: sColor, fontWeight: 700, marginTop: 2 }}>{level==='ok'?'ОК':level==='warn'?'WARN':'CRITICAL'} · v{scoring.verification}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', fontSize: 10, marginBottom: 8 }}>
          <span style={{ padding: '2px 8px', borderRadius: 20, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: DIM }}>ACWR {acwr ? acwr.ratio.toFixed(2) : '—'} {acwr ? (acwr.zone === 'dangerous' ? '🔴' : acwr.zone === 'caution' ? '🟠' : '🟢') : ''}</span>
          <span style={{ padding: '2px 8px', borderRadius: 20, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: DIM }}>{weakPoints.length? `${weakPoints.length} слабые` : 'баланс'}</span>
          {swayDiag && <span style={{ padding: '2px 8px', borderRadius: 20, background: swayDiag.severity==='ok'?'rgba(34,197,94,0.12)':'rgba(239,68,68,0.12)', border: '1px solid rgba(255,255,255,0.06)', color: swayDiag.severity==='ok'?'#22c55e':'#ef4444' }}>sway {swayDiag.swayCm}см</span>}
          {vbtLoss && <span style={{ padding: '2px 8px', borderRadius: 20, background: vbtLoss.exceeded?'rgba(239,68,68,0.12)':'rgba(34,197,94,0.12)', border: '1px solid rgba(255,255,255,0.06)', color: vbtLoss.exceeded?'#ef4444':'#22c55e' }}>VBT {vbtLoss.lossPct}%</span>}
          <span style={{ padding: '2px 8px', borderRadius: 20, background: ohs.level==='ok'?'rgba(34,197,94,0.12)':'rgba(239,68,68,0.12)', border: '1px solid rgba(255,255,255,0.06)', color: ohs.level==='ok'?'#22c55e':'#ef4444' }}>OHS {ohs.totalScore}/6</span>
          <span style={{ padding: '2px 8px', borderRadius: 20, background: gripFails>0?'rgba(245,158,11,0.12)':'rgba(34,197,94,0.12)', border: '1px solid rgba(255,255,255,0.06)', color: gripFails>0?'#f59e0b':'#22c55e' }}>grip {gripFails? `${gripFails}/3` : 'OK'}</span>
          {scoring.floors.length>0 && <span style={{ padding: '2px 8px', borderRadius: 20, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.22)', color: '#ef4444' }}>floor: {scoring.floors[0]}</span>}
        </div>
        {diaryWeaks.length>0 && <div style={{ fontSize: 10, color: '#5ee', marginBottom: 4 }}>📓 Дневник: {diaryWeaks.map(w=> `${w.label}`).join(', ')}</div>}
        {diaryPhases.length>0 && <div style={{ fontSize: 10, color: '#a78bfa', marginBottom: 6 }}>📓 Фаза по дневнику: {diaryPhases.join(' · ')}</div>}
        <div style={{ fontSize: 10, color: '#fff', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '8px 10px', lineHeight: 1.45 }}>
          Выбери слабые фазы (числовые углы + биомеханика McGill/Harris) + sway (3/5см) + VBT 15% + grip tri-modal → RSS-скор. Кнопка <b style={{ color: '#f59e0b' }}>«Применить в Стронг-конструктор»</b> отправит с smBiomech + контест (mode:strongman).
        </div>
        {limiterForPhase.length>0 && <div style={{ marginTop: 8, padding: '8px 10px', borderRadius: 8, background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.18)', fontSize: 10, color: '#a78bfa' }}>💡 Лимитеры для {SM_BIOMECH[smWeakPoints[0] as SMWeakPoint]?.label || smWeakPoints[0]}: {limiterForPhase.map(o => `${o.label} (${o.method.slice(0, 40)}…)`).join(' · ')}</div>}
        {(passportResult.errors.length>0 || passportResult.warnings.length>0) && <div style={{ marginTop: 8, padding: '8px 10px', borderRadius: 8, background: passportResult.errors.length?'rgba(239,68,68,0.08)':'rgba(245,158,11,0.08)', border: `1px solid ${passportResult.errors.length?'rgba(239,68,68,0.22)':'rgba(245,158,11,0.22)'}`, fontSize: 10, color: passportResult.errors.length?'#ef4444':'#f59e0b' }}>{passportResult.errors.length? `⛔ ${passportResult.errors.join(' · ')}` : `⚠ ${passportResult.warnings.join(' · ')}`}</div>}
        {enodeCorrected != null && swayCm != null && <div style={{ marginTop: 8, padding: '6px 10px', borderRadius: 8, background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.18)', fontSize: 10, color: '#60a5fa' }}>Enode xLoop {swayCm}см → {enodeCorrected}см (Chavda 2024 bias) · VBT yoke {VBT_SS_THRESHOLDS.yoke_walk.optimalMin}/{VBT_SS_THRESHOLDS.yoke_walk.stopMin} камень {VBT_SS_THRESHOLDS.atlas_stone_load.optimalMin}/{VBT_SS_THRESHOLDS.atlas_stone_load.stopMin}</div>}
        <div style={{ marginTop: 8, padding: '6px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', fontSize: 10, color: DIM }}>Axial {axialProgress.curM}м / {axialProgress.mrv}м MRV ({axialProgress.pct}%) · {axialQuant.text} · {axialQuant.recipe} · cond {state.conditioningFail? 'FAIL — prowler 10×100ft' : 'ok — alactic 8×10с/50с'} · {swayDiag? `sway ${swayDiag.swayCm}см` : 'sway —'}</div>
        {carryPhys && <div style={{ marginTop: 8, padding: '6px 10px', borderRadius: 8, background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.18)', fontSize: 10, color: '#60a5fa' }}>🚜 Йок-физика (Legg/Hindle): {carryPhys.note}</div>}
        {stoneMom && <div style={{ marginTop: 8, padding: '6px 10px', borderRadius: 8, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.22)', fontSize: 10, color: '#f59e0b' }}>🪨 Камень-момент (Harris): {stoneMom.note}</div>}
        {contestSim && <div style={{ marginTop: 8, padding: '8px 10px', borderRadius: 8, background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.18)', fontSize: 10, color: '#a78bfa' }}>🏆 Симулятор: {contestSim.predictedPlace} место из 10 · total {contestSim.totalPoints}pts · слабые {contestSim.weakEvents.join(', ') || '—'} · порядок {contestSim.recOrder.join(' → ')}</div>}
        {attemptsBridge && attemptsBridge.rationale.length > 1 && <div style={{ marginTop: 8, padding: '6px 10px', borderRadius: 8, background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.18)', fontSize: 10, color: '#22c55e' }}>🎯 Попытки: {attemptsBridge.rationale.slice(1, 4).join(' · ')}{attemptsBridge.medley ? ` · Medley ${attemptsBridge.medley.totalTimeS}с/cap ${attemptsBridge.medley.timeCapS}с` : ''}</div>}
        {smCauses.length > 0 && <div style={{ marginTop: 8, padding: '6px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', fontSize: 10, color: '#fff' }}>🧬 Причины: {smCauses.map((c) => `${c.zone}: ${SM_WEAK_CAUSE_LABELS[c.cause]} (${c.confidence})`).join(' · ')}</div>}
        {smRankTop.length > 0 && <div style={{ marginTop: 8, padding: '6px 10px', borderRadius: 8, background: 'rgba(94,234,212,0.08)', border: '1px solid rgba(94,234,212,0.18)', fontSize: 10, color: '#5ee' }}>⭐ Топ-коррекция: {smRankTop.map((c) => `${c.name} ${c.protocol.sets}×${c.protocol.reps} @${c.protocol.pct}%`).join(' · ')}</div>}
        {smSpec && <div style={{ marginTop: 8, padding: '6px 10px', borderRadius: 8, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.18)', fontSize: 10, color: '#fca5a5' }}>📅 Спец-блок: {smSpec.weakPoints.join(', ')} × {smSpec.totalWeeks}нед · {smSpec.weeks[0]?.note || ''} · dayMap event-день</div>}
        {bicepsWarn.length > 0 && <div style={{ marginTop: 8, padding: '6px 10px', borderRadius: 8, background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.25)', fontSize: 10, color: '#ef4444' }}>🦾 Безопасность: {bicepsWarn.join(' · ')}</div>}
        {holdDiag && <div style={{ marginTop: 8, padding: '6px 10px', borderRadius: 8, background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.18)', fontSize: 10, color: '#22c55e' }}>✊ Hold: {holdDiag.verdict}</div>}
        {anthroDiag && <div style={{ marginTop: 8, padding: '6px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', fontSize: 10, color: DIM }}>📏 Антро: {anthroDiag.loadAdvice} {anthroDiag.pickupAdvice}</div>}
        {logDipDiag && <div style={{ marginTop: 8, padding: '6px 10px', borderRadius: 8, background: logDipDiag.verdict === 'ok' ? 'rgba(34,197,94,0.08)' : 'rgba(245,158,11,0.08)', border: '1px solid rgba(255,255,255,0.06)', fontSize: 10, color: logDipDiag.verdict === 'ok' ? '#22c55e' : '#f59e0b' }}>📐 Лог-дип: {logDipDiag.text}{logDipDiag.drivePowerW != null ? ` · drive ~${logDipDiag.drivePowerW}Вт` : ''}</div>}
        {gripAsymDiag && gripAsymDiag.isAsym && <div style={{ marginTop: 8, padding: '6px 10px', borderRadius: 8, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.22)', fontSize: 10, color: '#f59e0b' }}>⚖️ Grip-асимметрия: {gripAsymDiag.text}</div>}
        {toast && <div style={{ marginTop: 8, padding: '6px 10px', borderRadius: 8, background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.2)', color: '#22c55e', fontSize: 11 }}>{toast}</div>}
        <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
          <button onClick={handleExport} style={{ padding: '6px 12px', borderRadius: 8, background: 'rgba(59,130,246,0.14)', border: '1px solid #1f3a5f', color: '#60a5fa', fontSize: 11, cursor: 'pointer' }}>🖨 HTML</button>
          <button onClick={handleExportCsv} style={{ padding: '6px 12px', borderRadius: 8, background: 'rgba(59,130,246,0.14)', border: '1px solid #1f3a5f', color: '#60a5fa', fontSize: 11, cursor: 'pointer' }}>📥 CSV</button>
          <button onClick={applyMobilityToProfile} style={{ padding: '6px 12px', borderRadius: 8, background: 'rgba(34,197,94,0.14)', border: '1px solid rgba(34,197,94,0.22)', color: '#22c55e', fontSize: 11, cursor: 'pointer' }}>→ Мобильность в профиль</button>
        </div>
      </div>

      <div style={{ ...CARD, padding: 12 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
          {TAB_DEFS.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)} aria-pressed={tab===t.id} style={{ padding:'6px 12px', borderRadius:999, border:'1px solid', borderColor: tab===t.id ? '#ef4444' : '#1f3a5f', background: tab===t.id ? 'rgba(239,68,68,0.14)' : '#0a1629', color: tab===t.id ? '#ef4444' : DIM, cursor:'pointer', fontSize:11, fontWeight:600 }}>
              {t.icon} {t.label}
            </button>
          ))}
          <button onClick={applyToConstructor} style={{ marginLeft:'auto', padding:'8px 14px', borderRadius:8, background:'linear-gradient(135deg,#ef4444,#f59e0b)', color:'#fff', border:'none', fontWeight:800, fontSize:12, cursor:'pointer' }}>→ Применить в Стронг</button>
        </div>

        {tab==='press' && (
          <div>
            <div style={{ fontSize:11, fontWeight:700, color:ACCENT, marginBottom:6 }}>Жим — лог/аксель (4 фазы, дип 8-12см)</div>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:8 }}>
              {PRESS_OPTS.map(o=>(
                <button key={o.id} onClick={()=>toggle('pressWeak', o.id)} aria-pressed={state.pressWeak.includes(o.id)} style={{ padding:'6px 10px', borderRadius:999, border:'1px solid', borderColor: state.pressWeak.includes(o.id) ? '#ef4444' : '#1f3a5f', background: state.pressWeak.includes(o.id) ? 'rgba(239,68,68,0.14)' : '#0a1629', color: state.pressWeak.includes(o.id) ? '#ef4444' : DIM, fontSize:11 }}>{o.label}</button>
              ))}
            </div>
            {state.pressWeak.map(id=>{
              const bio = smBiomechForWeak(id);
              if (!bio) return null;
              return (
                <div key={id} style={{ padding:'8px 10px', borderRadius:8, background:'#0a1629', border:'1px solid #1f3a5f', marginBottom:6 }}>
                  <div style={{ fontSize:11, fontWeight:700, color:'#fff' }}>{bio.label} <span style={{ color:DIM }}>· {bio.joint} {bio.angleRangeDeg[0]}-{bio.angleRangeDeg[1]}° · {bio.keyJoint}</span></div>
                  <div style={{ fontSize:10, color:DIM }}>{bio.weakMuscles.join(', ')} · {bio.references.join(', ')}</div>
                  <div style={{ fontSize:10, color:'#fff', marginTop:4, lineHeight:1.4 }}>{bio.biomechanicalReason}</div>
                  <div style={{ fontSize:11, color:'#5ee', marginTop:4 }}>{bio.corrections.join(' · ')} · {bio.loadCues}</div>
                </div>
              );
            })}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginTop:8 }}>
              <label style={{ fontSize:11, color:DIM }}>Лог кг<br/><input value={state.logKg} onChange={e=>setState(s=>({...s, logKg:e.target.value}))} placeholder="100" style={{ width:'100%', marginTop:4, background:'#0a1629', color:'#fff', border:'1px solid #1f3a5f', borderRadius:8, padding:'6px 8px', fontSize:12 }} /></label>
              <label style={{ fontSize:11, color:DIM }}>Аксель кг<br/><input value={state.axleKg} onChange={e=>setState(s=>({...s, axleKg:e.target.value}))} placeholder="120" style={{ width:'100%', marginTop:4, background:'#0a1629', color:'#fff', border:'1px solid #1f3a5f', borderRadius:8, padding:'6px 8px', fontSize:12 }} /></label>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginTop:8 }}>
              <label style={{ fontSize:11, color:DIM }}>VBT лог best м/с<br/><input value={state.vbtLogBest} onChange={e=>setState(s=>({...s, vbtLogBest:e.target.value}))} placeholder="0.85" style={{ width:'100%', marginTop:4, background:'#0a1629', color:'#fff', border:'1px solid #1f3a5f', borderRadius:8, padding:'6px 8px', fontSize:12 }} /></label>
              <label style={{ fontSize:11, color:DIM }}>VBT лог last м/с<br/><input value={state.vbtLogLast} onChange={e=>setState(s=>({...s, vbtLogLast:e.target.value}))} placeholder="0.65" style={{ width:'100%', marginTop:4, background:'#0a1629', color:'#fff', border:'1px solid #1f3a5f', borderRadius:8, padding:'6px 8px', fontSize:12 }} /></label>
            </div>
            <div style={{ fontSize:10, color:DIM, marginTop:6 }}>Ивенты: {Object.keys(EVENT_META).slice(0,4).join(', ')} — {VBT_SS_THRESHOLDS.log_press ? `VBT log ${VBT_SS_THRESHOLDS.log_press.optimalMin}/${VBT_SS_THRESHOLDS.log_press.stopMin} м/с` : ''}</div>
            <div style={{ marginTop:8, padding:'8px 10px', borderRadius:8, background:'#0a1629', border:'1px solid #1f3a5f' }}>
              <div style={{ fontSize:11, fontWeight:700, color:'#fff' }}>Контест пакет</div>
              <select value={state.contestId} onChange={e=>setState(s=>({...s, contestId:e.target.value}))} style={{ width:'100%', marginTop:6, background:'#0a1629', color:'#fff', border:'1px solid #1f3a5f', borderRadius:8, padding:'6px 8px', fontSize:11 }}>
                <option value="">— без контеста (база)</option>
                {Object.entries(CONTEST_PRESETS as any).map(([id,c]:any)=> <option key={id} value={id}>{c.name}</option>)}
              </select>
              <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:11, color:DIM, marginTop:6 }}><input type="checkbox" checked={state.turnNeeded} onChange={e=>setState(s=>({...s, turnNeeded:e.target.checked}))}/> Разворот 180° (йок/фермер)</label>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginTop:6 }}>
                <label style={{ fontSize:11, color:DIM }}>Платформа см<br/><input value={state.platformHeightCm} onChange={e=>setState(s=>({...s, platformHeightCm:e.target.value}))} placeholder="140" style={{ width:'100%', marginTop:4, background:'#0a1629', color:'#fff', border:'1px solid #1f3a5f', borderRadius:8, padding:'6px 8px', fontSize:12 }} /></label>
                <label style={{ fontSize:11, color:DIM, display:'flex', alignItems:'center', gap:6, marginTop:16 }}><input type="checkbox" checked={state.tackyUsed} onChange={e=>setState(s=>({...s, tackyUsed:e.target.checked}))}/> Tacky есть</label>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginTop:6 }}>
                <label style={{ fontSize:11, color:DIM }}>Диаметр лога см<br/><input value={state.diameterCm} onChange={e=>setState(s=>({...s, diameterCm:e.target.value}))} placeholder="30" style={{ width:'100%', marginTop:4, background:'#0a1629', color:'#fff', border:'1px solid #1f3a5f', borderRadius:8, padding:'6px 8px', fontSize:12 }} /></label>
                <label style={{ fontSize:11, color:DIM }}>Покрытие<br/><select value={state.surface} onChange={e=>setState(s=>({...s, surface:e.target.value}))} style={{ width:'100%', marginTop:4, background:'#0a1629', color:'#fff', border:'1px solid #1f3a5f', borderRadius:8, padding:'6px 8px', fontSize:11 }}><option value="">—</option><option value="резина">резина</option><option value="трава">трава</option><option value="асфальт">асфальт</option><option value="песок">песок</option></select></label>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:8, marginTop:6 }}>
                <label style={{ fontSize:11, color:DIM }}>Дип см (8-12)<br/><input value={state.logDipCm} onChange={e=>setState(s=>({...s, logDipCm:e.target.value}))} placeholder="10" style={{ width:'100%', marginTop:4, background:'#0a1629', color:'#fff', border:'1px solid #1f3a5f', borderRadius:8, padding:'6px 8px', fontSize:12 }} /></label>
                <label style={{ fontSize:11, color:DIM }}>Дип мс (~200)<br/><input value={state.logDipMs} onChange={e=>setState(s=>({...s, logDipMs:e.target.value}))} placeholder="200" style={{ width:'100%', marginTop:4, background:'#0a1629', color:'#fff', border:'1px solid #1f3a5f', borderRadius:8, padding:'6px 8px', fontSize:12 }} /></label>
                <label style={{ fontSize:11, color:DIM }}>Вес тела кг<br/><input value={state.bodyweightKg} onChange={e=>setState(s=>({...s, bodyweightKg:e.target.value}))} placeholder="105" style={{ width:'100%', marginTop:4, background:'#0a1629', color:'#fff', border:'1px solid #1f3a5f', borderRadius:8, padding:'6px 8px', fontSize:12 }} /></label>
                <label style={{ fontSize:11, color:DIM }}>Тяга кг (axle)<br/><input value={state.deadliftKg} onChange={e=>setState(s=>({...s, deadliftKg:e.target.value}))} placeholder="250" style={{ width:'100%', marginTop:4, background:'#0a1629', color:'#fff', border:'1px solid #1f3a5f', borderRadius:8, padding:'6px 8px', fontSize:12 }} /></label>
              </div>
              {logDipDiag && <div style={{ fontSize:10, color: logDipDiag.verdict === 'ok' ? '#22c55e' : '#f59e0b', marginTop:4 }}>{logDipDiag.text} (Renals braking/propulsion, Zhang dip 0.20с)</div>}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginTop:6 }}>
                <label style={{ fontSize:11, color:DIM }}>Стратегия попыток<br/><select value={state.strategy} onChange={e=>setState(s=>({...s, strategy:e.target.value}))} style={{ width:'100%', marginTop:4, background:'#0a1629', color:'#fff', border:'1px solid #1f3a5f', borderRadius:8, padding:'6px 8px', fontSize:11 }}><option value="conservative">conservative 85/92/98</option><option value="balanced">balanced 88/95/100</option><option value="aggressive">aggressive 90/97/102</option></select></label>
                <label style={{ fontSize:11, color:DIM }}>Хват тяги<br/><select value={state.mixGrip} onChange={e=>setState(s=>({...s, mixGrip:e.target.value}))} style={{ width:'100%', marginTop:4, background:'#0a1629', color:'#fff', border:'1px solid #1f3a5f', borderRadius:8, padding:'6px 8px', fontSize:11 }}><option value="overhand">overhand/hook</option><option value="mixed">mixed (риск)</option><option value="straps">straps</option></select></label>
              </div>
              <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:11, color:DIM, marginTop:6 }}><input type="checkbox" checked={state.armsBent} onChange={e=>setState(s=>({...s, armsBent:e.target.checked}))}/> Руки согнуты на камне/шине (риск бицепса)</label>
              {attemptsBridge && attemptsBridge.rationale.length > 0 && <div style={{ fontSize:10, color:'#22c55e', marginTop:4 }}>{attemptsBridge.rationale.slice(0, 4).join(' · ')}</div>}
            </div>
          </div>
        )}

        {tab==='carry' && (
          <div>
            <div style={{ fontSize:11, fontWeight:700, color:ACCENT, marginBottom:6 }}>Переноски — йок/фермер/рама (5 фаз, sway 3/5см)</div>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:8 }}>
              {CARRY_OPTS.map(o=>(
                <button key={o.id} onClick={()=>toggle('carryWeak', o.id)} aria-pressed={state.carryWeak.includes(o.id)} style={{ padding:'6px 10px', borderRadius:999, border:'1px solid', borderColor: state.carryWeak.includes(o.id) ? '#f59e0b' : '#1f3a5f', background: state.carryWeak.includes(o.id) ? 'rgba(245,158,11,0.14)' : '#0a1629', color: state.carryWeak.includes(o.id) ? '#f59e0b' : DIM, fontSize:11 }}>{o.label}</button>
              ))}
            </div>
            {state.carryWeak.map(id=>{
              const bio = smBiomechForWeak(id);
              if (!bio) return null;
              return (
                <div key={id} style={{ padding:'8px 10px', borderRadius:8, background:'#0a1629', border:'1px solid #1f3a5f', marginBottom:6 }}>
                  <div style={{ fontSize:11, fontWeight:700, color:'#fff' }}>{bio.label} <span style={{ color:DIM }}>· {bio.angleRangeDeg.join('-')}°</span></div>
                  <div style={{ fontSize:10, color:'#fff', marginTop:4 }}>{bio.biomechanicalReason}</div>
                  <div style={{ fontSize:11, color:'#5ee' }}>{bio.corrections.join(' · ')}</div>
                </div>
              );
            })}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
              <label style={{ fontSize:11, color:DIM }}>Йок кг<br/><input value={state.yokeKg} onChange={e=>setState(s=>({...s, yokeKg:e.target.value}))} placeholder="300" style={{ width:'100%', marginTop:4, background:'#0a1629', color:'#fff', border:'1px solid #1f3a5f', borderRadius:8, padding:'6px 8px', fontSize:12 }} /></label>
              <label style={{ fontSize:11, color:DIM }}>Фермер кг (на руку)<br/><input value={state.farmersKg} onChange={e=>setState(s=>({...s, farmersKg:e.target.value}))} placeholder="120" style={{ width:'100%', marginTop:4, background:'#0a1629', color:'#fff', border:'1px solid #1f3a5f', borderRadius:8, padding:'6px 8px', fontSize:12 }} /></label>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginTop:8 }}>
              <label style={{ fontSize:11, color:DIM }}>Sway см<br/><input value={state.swayCm} onChange={e=>setState(s=>({...s, swayCm:e.target.value}))} placeholder="2.5" style={{ width:'100%', marginTop:4, background:'#0a1629', color:'#fff', border:'1px solid #1f3a5f', borderRadius:8, padding:'6px 8px', fontSize:12 }} /></label>
              <label style={{ fontSize:11, color:DIM }}>VBT йок best м/с<br/><input value={state.vbtYokeBest} onChange={e=>setState(s=>({...s, vbtYokeBest:e.target.value}))} placeholder="1.45" style={{ width:'100%', marginTop:4, background:'#0a1629', color:'#fff', border:'1px solid #1f3a5f', borderRadius:8, padding:'6px 8px', fontSize:12 }} /></label>
              <label style={{ fontSize:11, color:DIM }}>VBT йок last м/с<br/><input value={state.vbtYokeLast} onChange={e=>setState(s=>({...s, vbtYokeLast:e.target.value}))} placeholder="1.20" style={{ width:'100%', marginTop:4, background:'#0a1629', color:'#fff', border:'1px solid #1f3a5f', borderRadius:8, padding:'6px 8px', fontSize:12 }} /></label>
            </div>
            {swayDiag && <div style={{ fontSize:10, color: swayDiag.severity==='ok'?'#22c55e': swayDiag.severity==='warn'?'#f59e0b':'#ef4444', marginTop:4 }}>{swayDiag.text} · SRD 3/5см · VBT yoke {VBT_SS_THRESHOLDS.yoke_walk.optimalMin}/{VBT_SS_THRESHOLDS.yoke_walk.stopMin} м/с</div>}
            {vbtLoss && <div style={{ fontSize:10, color: vbtLoss.exceeded?'#ef4444':'#22c55e', marginTop:4 }}>VBT потеря {vbtLoss.lossPct}% · {vbtLoss.zone} · {vbtLoss.recommendation} · порог 15% carry (MHV-декремент &gt;15% = стоп, PoinT GO)</div>}
            {carryPhys ? <div style={{ fontSize:10, color:'#60a5fa', marginTop:4 }}>Физика: {carryPhys.note} · Hindle 1.69м/с stride 1.14м rate 1.62Hz</div> : <div style={{ fontSize:10, color:DIM, marginTop:4 }}>Физика йока: введи вес тела (таб Жим) + йок кг → speed/stride/cadence/feasible</div>}
            <div style={{ marginTop:8, padding:'8px 10px', borderRadius:8, background:'#0a1629', border:'1px dashed #1f3a5f', textAlign:'center' }}>
              <div style={{ fontSize:11, color:DIM }}>📹 Видео переноски — sway из Kinovea (xLoop)</div>
              <div style={{ fontSize:10, color:DIM, marginTop:4 }}>Сними сбоку 30fps → Kinovea CSV → вкладка Видео → sway автоматически</div>
            </div>
          </div>
        )}

        {tab==='load' && (
          <div>
            <div style={{ fontSize:11, fontWeight:700, color:ACCENT, marginBottom:6 }}>Загрузки — камни/мешок/кега (anterior load, high-hips)</div>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:8 }}>
              {LOAD_OPTS.map(o=>(
                <button key={o.id} onClick={()=>toggle('loadWeak', o.id)} aria-pressed={state.loadWeak.includes(o.id)} style={{ padding:'6px 10px', borderRadius:999, border:'1px solid', borderColor: state.loadWeak.includes(o.id) ? '#22c55e' : '#1f3a5f', background: state.loadWeak.includes(o.id) ? 'rgba(34,197,94,0.14)' : '#0a1629', color: state.loadWeak.includes(o.id) ? '#22c55e' : DIM, fontSize:11 }}>{o.label}</button>
              ))}
            </div>
            {state.loadWeak.map(id=>{
              const bio = smBiomechForWeak(id);
              if (!bio) return null;
              return (
                <div key={id} style={{ padding:'8px 10px', borderRadius:8, background:'#0a1629', border:'1px solid #1f3a5f', marginBottom:6 }}>
                  <div style={{ fontSize:11, fontWeight:700, color:'#fff' }}>{bio.label}</div>
                  <div style={{ fontSize:10, color:'#fff', marginTop:4 }}>{bio.biomechanicalReason}</div>
                  <div style={{ fontSize:11, color:'#5ee' }}>{bio.corrections.join(' · ')} · {bio.loadCues}</div>
                </div>
              );
            })}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
              <label style={{ fontSize:11, color:DIM }}>Камень кг<br/><input value={state.stoneKg} onChange={e=>setState(s=>({...s, stoneKg:e.target.value}))} placeholder="140" style={{ width:'100%', marginTop:4, background:'#0a1629', color:'#fff', border:'1px solid #1f3a5f', borderRadius:8, padding:'6px 8px', fontSize:12 }} /></label>
              <label style={{ fontSize:11, color:DIM }}>Sway камня см<br/><input value={state.swayCm} onChange={e=>setState(s=>({...s, swayCm:e.target.value}))} placeholder="2.0" style={{ width:'100%', marginTop:4, background:'#0a1629', color:'#fff', border:'1px solid #1f3a5f', borderRadius:8, padding:'6px 8px', fontSize:12 }} /></label>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginTop:8 }}>
              <label style={{ fontSize:11, color:DIM }}>VBT камень best м/с<br/><input value={state.vbtStoneBest} onChange={e=>setState(s=>({...s, vbtStoneBest:e.target.value}))} placeholder="0.75" style={{ width:'100%', marginTop:4, background:'#0a1629', color:'#fff', border:'1px solid #1f3a5f', borderRadius:8, padding:'6px 8px', fontSize:12 }} /></label>
              <label style={{ fontSize:11, color:DIM }}>VBT камень last м/с<br/><input value={state.vbtStoneLast} onChange={e=>setState(s=>({...s, vbtStoneLast:e.target.value}))} placeholder="0.55" style={{ width:'100%', marginTop:4, background:'#0a1629', color:'#fff', border:'1px solid #1f3a5f', borderRadius:8, padding:'6px 8px', fontSize:12 }} /></label>
            </div>
            <div style={{ fontSize:10, color:DIM, marginTop:6 }}>Контест пресеты: {Object.values(CONTEST_PRESETS as any).slice(0,3).map((c:any)=>c.name).join(', ')} · stone VBT {VBT_SS_THRESHOLDS.atlas_stone_load.optimalMin}/{VBT_SS_THRESHOLDS.atlas_stone_load.stopMin} м/с · платформа {state.platformHeightCm || '—'}см</div>
            <div style={{ fontSize:10, color: state.tackyUsed ? '#22c55e' : '#f59e0b', marginTop:4 }}>{state.tackyUsed ? '✓ Tacky учтён — руки не сгибать' : '⚠ Без tacky — риск сгибания рук + бицепс tear'}</div>
          </div>
        )}

        {tab==='grip' && (
          <div>
            <div style={{ fontSize:11, fontWeight:700, color:ACCENT, marginBottom:6 }}>Хват / Кор / Кондиция (tri-modal + axial)</div>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:8 }}>
              {GRIP_OPTS.map(o=>(
                <button key={o.id} onClick={()=>toggle('gripWeak', o.id)} aria-pressed={state.gripWeak.includes(o.id)} style={{ padding:'6px 10px', borderRadius:999, border:'1px solid', borderColor: state.gripWeak.includes(o.id) ? '#a855f7' : '#1f3a5f', background: state.gripWeak.includes(o.id) ? 'rgba(168,85,247,0.14)' : '#0a1629', color: state.gripWeak.includes(o.id) ? '#a855f7' : DIM, fontSize:11 }}>{o.label}</button>
              ))}
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
              <label style={{ fontSize:11, color:DIM }}>Support (фермер) сек<br/><input value={state.gripHoldSec} onChange={e=>setState(s=>({...s, gripHoldSec:e.target.value}))} placeholder="60" style={{ width:'100%', marginTop:4, background:'#0a1629', color:'#fff', border:'1px solid #1f3a5f', borderRadius:8, padding:'6px 8px', fontSize:12 }} /></label>
              <label style={{ fontSize:11, color:DIM }}>Pinch сек<br/><input value={state.pinchHoldSec} onChange={e=>setState(s=>({...s, pinchHoldSec:e.target.value}))} placeholder="20" style={{ width:'100%', marginTop:4, background:'#0a1629', color:'#fff', border:'1px solid #1f3a5f', borderRadius:8, padding:'6px 8px', fontSize:12 }} /></label>
              <label style={{ fontSize:11, color:DIM }}>Crush (axle) сек<br/><input value={state.axleHoldSec} onChange={e=>setState(s=>({...s, axleHoldSec:e.target.value}))} placeholder="30" style={{ width:'100%', marginTop:4, background:'#0a1629', color:'#fff', border:'1px solid #1f3a5f', borderRadius:8, padding:'6px 8px', fontSize:12 }} /></label>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginTop:8 }}>
              <label style={{ fontSize:11, color:DIM }}>Планка сек<br/><input value={state.corePlankSec} onChange={e=>setState(s=>({...s, corePlankSec:e.target.value}))} placeholder="120" style={{ width:'100%', marginTop:4, background:'#0a1629', color:'#fff', border:'1px solid #1f3a5f', borderRadius:8, padding:'6px 8px', fontSize:12 }} /></label>
              <label style={{ fontSize:11, color:DIM, display:'flex', alignItems:'center', gap:6, marginTop:16 }}><input type="checkbox" checked={state.conditioningFail} onChange={e=>setState(s=>({...s, conditioningFail:e.target.checked}))}/> Кондиция провал (medley &gt;60с)</label>
            </div>
            <div style={{ fontSize:10, color: gripFails>=2?'#ef4444':'#22c55e', marginTop:4 }}>Grip fails {gripFails}/3 (калибр {gripFailsCal}/3) {gripFails>=2?'— prehab hammer 3×12 + pinch 2×15': '— норма'} · axial {axialOverload?'перегруз ≥12 сетов+300м — QL suitcase 2×20м': 'норм'} · {axialQuant.text}</div>
            <div style={{ fontSize:10, color:DIM, marginTop:6 }}>ACWR {acwr? `${acwr.ratio.toFixed(2)} ${acwr.zone}` : '—'} · conditioning как в strength-sport-conditioning (alactic 8×10с/50с)</div>
            {(() => {
              const sess = smCondSessionFor({ conditioningFail: state.conditioningFail || state.gripWeak.includes('conditioning'), mhvDecrementPct: vbtLoss?.lossPct ?? null });
              return (
                <div style={{ marginTop:8, padding:'8px 10px', borderRadius:8, background:'rgba(59,130,246,0.08)', border:'1px solid rgba(59,130,246,0.18)' }}>
                  <div style={{ fontSize:11, fontWeight:700, color:'#60a5fa' }}>Кондиция → {sess.modality}</div>
                  <div style={{ fontSize:10, color:DIM, marginTop:2 }}>{sess.sets}× {sess.work} / отдых {sess.rest} · {sess.hrZone} · {sess.note}</div>
                  <div style={{ fontSize:10, color:DIM, marginTop:4 }}>Все системы: {allSMCondSessions().map((s) => `${s.goal} ${s.sets}×${s.work}`).join(' · ')}</div>
                </div>
              );
            })()}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginTop:8 }}>
              <label style={{ fontSize:11, color:DIM }}>Pinch-блок<br/><select value={state.pinchWidth} onChange={e=>setState(s=>({...s, pinchWidth:e.target.value}))} style={{ width:'100%', marginTop:4, background:'#0a1629', color:'#fff', border:'1px solid #1f3a5f', borderRadius:8, padding:'6px 8px', fontSize:11 }}><option value="2in">2″ (норма 30с)</option><option value="3in">3″ (норма 20с)</option><option value="4in">4″ (норма 15с)</option></select></label>
              <label style={{ fontSize:11, color:DIM }}>CoC<br/><select value={state.cocLevel} onChange={e=>setState(s=>({...s, cocLevel:e.target.value}))} style={{ width:'100%', marginTop:4, background:'#0a1629', color:'#fff', border:'1px solid #1f3a5f', borderRadius:8, padding:'6px 8px', fontSize:11 }}><option value="coc1">CoC 1 (20с)</option><option value="coc1_5">CoC 1.5 (30с)</option><option value="coc2">CoC 2 (40с)</option></select></label>
              <label style={{ fontSize:11, color:DIM }}>FatGrip мм<br/><select value={state.fatGripMm} onChange={e=>setState(s=>({...s, fatGripMm:e.target.value}))} style={{ width:'100%', marginTop:4, background:'#0a1629', color:'#fff', border:'1px solid #1f3a5f', borderRadius:8, padding:'6px 8px', fontSize:11 }}><option value="38">38 (стандарт)</option><option value="50">50 (axle)</option><option value="60">60 (толстый)</option></select></label>
            </div>
            <div style={{ display:'flex', gap:6, marginTop:6 }}>
              <button onClick={handleSaveGripProfile} style={{ padding:'6px 12px', borderRadius:8, background:'rgba(168,85,247,0.14)', border:'1px solid rgba(168,85,247,0.25)', color:'#a78bfa', fontSize:11, cursor:'pointer' }}>💾 Grip-профиль</button>
              <span style={{ fontSize:10, color:DIM, alignSelf:'center' }}>SBS r=0.40 — support/pinch/crush раздельно</span>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginTop:8 }}>
              <label style={{ fontSize:11, color:DIM }}>Лог-hold сек<br/><input value={state.logHoldSec} onChange={e=>setState(s=>({...s, logHoldSec:e.target.value}))} placeholder="10" style={{ width:'100%', marginTop:4, background:'#0a1629', color:'#fff', border:'1px solid #1f3a5f', borderRadius:8, padding:'6px 8px', fontSize:12 }} /></label>
              <label style={{ fontSize:11, color:DIM }}>Фермер-hold сек<br/><input value={state.farmersHoldSec} onChange={e=>setState(s=>({...s, farmersHoldSec:e.target.value}))} placeholder="60" style={{ width:'100%', marginTop:4, background:'#0a1629', color:'#fff', border:'1px solid #1f3a5f', borderRadius:8, padding:'6px 8px', fontSize:12 }} /></label>
              <label style={{ fontSize:11, color:DIM }}>Axle DOH кг<br/><input value={state.axleDohKg} onChange={e=>setState(s=>({...s, axleDohKg:e.target.value}))} placeholder="140" style={{ width:'100%', marginTop:4, background:'#0a1629', color:'#fff', border:'1px solid #1f3a5f', borderRadius:8, padding:'6px 8px', fontSize:12 }} /></label>
            </div>
            {holdDiag && <div style={{ fontSize:10, color: holdDiag.profile === 'balanced' ? '#22c55e' : '#f59e0b', marginTop:4 }}>{holdDiag.verdict} · {holdDiag.details.join(' · ')}</div>}
            {weakPoints.map(id=>{
              const bio = smBiomechForWeak(id);
              if (!bio || !['grip_support','core_brace','conditioning','farmers_grip'].includes(bio.weakPoint)) return null;
              return <div key={id} style={{ padding:'8px 10px', borderRadius:8, background:'#0a1629', border:'1px solid #1f3a5f', marginTop:6 }}><div style={{ fontSize:11, fontWeight:700, color:'#fff' }}>{bio.label}</div><div style={{ fontSize:10, color:'#fff' }}>{bio.biomechanicalReason}</div><div style={{ fontSize:11, color:'#5ee' }}>{bio.corrections.join(' · ')}</div></div>;
            })}
          </div>
        )}

        {tab==='mobility' && (
          <div>
            <div style={{ fontSize:11, fontWeight:700, color:ACCENT, marginBottom:6 }}>Мобильность — OHS 6 + асимметрия + sway</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6, marginBottom:8 }}>
              <label style={{ fontSize:11, color:DIM, display:'flex', alignItems:'center', gap:6 }}><input type="checkbox" checked={state.ohsHeelsFlat} onChange={e=>setState(s=>({...s, ohsHeelsFlat:e.target.checked}))}/> Пятки плоско</label>
              <label style={{ fontSize:11, color:DIM, display:'flex', alignItems:'center', gap:6 }}><input type="checkbox" checked={!state.ohsKneeValgus} onChange={e=>setState(s=>({...s, ohsKneeValgus:!e.target.checked}))}/> Колени без вальгуса</label>
              <label style={{ fontSize:11, color:DIM, display:'flex', alignItems:'center', gap:6 }}><input type="checkbox" checked={state.ohsHipBelowParallel} onChange={e=>setState(s=>({...s, ohsHipBelowParallel:e.target.checked}))}/> Таз ниже параллели</label>
              <label style={{ fontSize:11, color:DIM, display:'flex', alignItems:'center', gap:6 }}><input type="checkbox" checked={state.ohsTrunkUpright} onChange={e=>setState(s=>({...s, ohsTrunkUpright:e.target.checked}))}/> Корпус upright</label>
              <label style={{ fontSize:11, color:DIM, display:'flex', alignItems:'center', gap:6 }}><input type="checkbox" checked={state.ohsArmsOverMidfoot} onChange={e=>setState(s=>({...s, ohsArmsOverMidfoot:e.target.checked}))}/> Руки над стопой</label>
              <label style={{ fontSize:11, color:DIM, display:'flex', alignItems:'center', gap:6 }}><input type="checkbox" checked={state.ohsLumbarNeutral} onChange={e=>setState(s=>({...s, ohsLumbarNeutral:e.target.checked}))}/> Нейтраль поясницы</label>
            </div>
            <div style={{ padding:'8px 10px', borderRadius:8, background: ohs.level==='ok'?'rgba(34,197,94,0.08)': ohs.level==='warn'?'rgba(245,158,11,0.08)':'rgba(239,68,68,0.08)', border:`1px solid ${ohs.level==='ok'?'rgba(34,197,94,0.18)': ohs.level==='warn'?'rgba(245,158,11,0.18)':'rgba(239,68,68,0.18)'}`, marginBottom:8 }}>
              <div style={{ fontSize:11, fontWeight:700, color: ohs.level==='ok'?'#22c55e': ohs.level==='warn'?'#f59e0b':'#ef4444' }}>OHS {ohs.totalScore}/6 {ohs.level.toUpperCase()} · fail {ohs.failed} {ohs.primaryDriver? `· драйвер ${ohs.primaryDriver}`:''}</div>
              <div style={{ fontSize:10, color:DIM, marginTop:4 }}>{ohs.recommendation} {ohs.needsPhysio?'· нужен физио':''}</div>
              <div style={{ fontSize:10, color:DIM, marginTop:4 }}>Нормы knee-to-wall ≥{OHS_NORMS.kneeToWallCm.optimal}см (cutoff {OHS_NORMS.kneeToWallCm.cutoff}), ankle {OHS_NORMS.ankleDeg.range}</div>
              <div style={{ display:'flex', gap:6, marginTop:6, alignItems:'center' }}>
                <button onClick={handleSaveOHSSnap} style={{ padding:'6px 12px', borderRadius:8, background:'rgba(34,197,94,0.14)', border:'1px solid rgba(34,197,94,0.22)', color:'#22c55e', fontSize:11, cursor:'pointer' }}>📸 OHS-снапшот</button>
                <span style={{ fontSize:10, color:DIM }}>{smOhsTrend && smOhsTrend.n >= 2 ? `тренд ${smOhsTrend.delta >= 0 ? '+' : ''}${smOhsTrend.delta} за ${smOhsTrend.n} зам.` : `история ${smOhsHist.length}/10`}</span>
              </div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:8 }}>
              <label style={{ fontSize:11, color:DIM }}>Knee-to-wall см<br/><input value={state.kneeToWallCm} onChange={e=>setState(s=>({...s, kneeToWallCm:e.target.value}))} placeholder="12" style={{ width:'100%', marginTop:4, background:'#0a1629', color:'#fff', border:'1px solid #1f3a5f', borderRadius:8, padding:'6px 8px', fontSize:12 }} /></label>
              <label style={{ fontSize:11, color:DIM }}>Голеностоп °<br/><input value={state.ankleDeg} onChange={e=>setState(s=>({...s, ankleDeg:e.target.value}))} placeholder="35" style={{ width:'100%', marginTop:4, background:'#0a1629', color:'#fff', border:'1px solid #1f3a5f', borderRadius:8, padding:'6px 8px', fontSize:12 }} /></label>
            </div>
            <div style={{ display:'flex', gap:6, marginBottom:8, alignItems:'center' }}>
              <span style={{ fontSize:11, color:DIM }}>Heel-raise 2.5см</span>
              <button onClick={()=>setState(s=>({...s, heelRetest:'better'}))} style={{ padding:'4px 10px', borderRadius:999, border:'1px solid', borderColor: state.heelRetest==='better'?'#22c55e':'#1f3a5f', background: state.heelRetest==='better'?'rgba(34,197,94,0.14)':'#0a1629', color: state.heelRetest==='better'?'#22c55e':DIM, fontSize:11 }}>Лучше</button>
              <button onClick={()=>setState(s=>({...s, heelRetest:'same'}))} style={{ padding:'4px 10px', borderRadius:999, border:'1px solid', borderColor: state.heelRetest==='same'?'#f59e0b':'#1f3a5f', background: state.heelRetest==='same'?'rgba(245,158,11,0.14)':'#0a1629', color: state.heelRetest==='same'?'#f59e0b':DIM, fontSize:11 }}>Без изм</button>
              <button onClick={()=>setState(s=>({...s, heelRetest:''}))} style={{ padding:'4px 10px', borderRadius:999, border:'1px solid #1f3a5f', background:'#0a1629', color:DIM, fontSize:11 }}>Сброс</button>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
              <label style={{ fontSize:11, color:DIM }}>Левая макс кг<br/><input value={state.leftMax} onChange={e=>setState(s=>({...s, leftMax:e.target.value}))} placeholder="100" style={{ width:'100%', marginTop:4, background:'#0a1629', color:'#fff', border:'1px solid #1f3a5f', borderRadius:8, padding:'6px 8px', fontSize:12 }} /></label>
              <label style={{ fontSize:11, color:DIM }}>Правая макс кг<br/><input value={state.rightMax} onChange={e=>setState(s=>({...s, rightMax:e.target.value}))} placeholder="102" style={{ width:'100%', marginTop:4, background:'#0a1629', color:'#fff', border:'1px solid #1f3a5f', borderRadius:8, padding:'6px 8px', fontSize:12 }} /></label>
            </div>
            {asymmetry && (
              <div style={{ marginTop:8, padding:'8px 10px', borderRadius:8, background: asymmetry.isCrit?'rgba(239,68,68,0.08)': asymmetry.isAsym?'rgba(245,158,11,0.08)':'rgba(34,197,94,0.08)', border:`1px solid ${asymmetry.isCrit?'rgba(239,68,68,0.2)': asymmetry.isAsym?'rgba(245,158,11,0.2)':'rgba(34,197,94,0.2)'}` }}>
                <div style={{ fontSize:11, fontWeight:700, color: asymmetry.isCrit?'#ef4444': asymmetry.isAsym?'#f59e0b':'#22c55e' }}>Асимметрия {asymmetry.diff}% {asymmetry.isCrit?'CRITICAL ≥12%': asymmetry.isAsym?'WARN ≥7%':'— норма <7%'} {asymmetry.isAsym? `→ слабее ${asymmetry.weaker}`:''}</div>
                <div style={{ fontSize:10, color:DIM }}>Пороги 7/12% — предиктор distal biceps tear (Heazlewood). {gripAsymDiag ? gripAsymDiag.text : ''}</div>
                <button onClick={handleSaveGripSnap} style={{ marginTop:6, padding:'6px 12px', borderRadius:8, background:'rgba(245,158,11,0.14)', border:'1px solid rgba(245,158,11,0.25)', color:'#f59e0b', fontSize:11, cursor:'pointer' }}>📸 Grip-снапшот L/R</button>
              </div>
            )}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginTop:8 }}>
              <label style={{ fontSize:11, color:DIM }}>Рост см (антро)<br/><input value={state.anthroHeight} onChange={e=>setState(s=>({...s, anthroHeight:e.target.value}))} placeholder="182" style={{ width:'100%', marginTop:4, background:'#0a1629', color:'#fff', border:'1px solid #1f3a5f', borderRadius:8, padding:'6px 8px', fontSize:12 }} /></label>
              <label style={{ fontSize:11, color:DIM }}>Размах рук см<br/><input value={state.anthroArmSpan} onChange={e=>setState(s=>({...s, anthroArmSpan:e.target.value}))} placeholder="186" style={{ width:'100%', marginTop:4, background:'#0a1629', color:'#fff', border:'1px solid #1f3a5f', borderRadius:8, padding:'6px 8px', fontSize:12 }} /></label>
            </div>
            {anthroDiag && <div style={{ fontSize:10, color:DIM, marginTop:4 }}>{anthroDiag.loadAdvice} {anthroDiag.pickupAdvice} (tacky ≈{anthroDiag.tackyHeightCm}см)</div>}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginTop:8 }}>
              <label style={{ fontSize:11, color:DIM }}>Sway см (lateral)<br/><input value={state.swayCm} onChange={e=>setState(s=>({...s, swayCm:e.target.value}))} placeholder="2.5" style={{ width:'100%', marginTop:4, background:'#0a1629', color:'#fff', border:'1px solid #1f3a5f', borderRadius:8, padding:'6px 8px', fontSize:12 }} /></label>
              <label style={{ fontSize:11, color:DIM }}>Tacky<br/><select value={state.tackyUsed?'yes':'no'} onChange={e=>setState(s=>({...s, tackyUsed:e.target.value==='yes'}))} style={{ width:'100%', marginTop:4, background:'#0a1629', color:'#fff', border:'1px solid #1f3a5f', borderRadius:8, padding:'6px 8px', fontSize:12 }}><option value="no">нет</option><option value="yes">есть</option></select></label>
            </div>
            {swayDiag && <div style={{ fontSize:10, color: swayDiag.severity==='ok'?'#22c55e':'#ef4444', marginTop:4 }}>{swayDiag.text} · измеряй видео сбоку 30fps</div>}
          </div>
        )}

        {tab==='video' && (
          <div>
            <div style={{ fontSize:11, fontWeight:700, color:ACCENT, marginBottom:6 }}>Видео — Kinovea sway + carry VBT</div>
            <div style={{ fontSize:10, color:DIM, marginBottom:6 }}>Полевая методика: телефон сбоку 30fps → Kinovea (free) → трек центра масс/йока → xLoop = sway. VBT carry: скорость ходьбы м/с.</div>
            <textarea value={csvText} onChange={e=>setCsvText(e.target.value)} placeholder="Вставь Kinovea CSV (time,x,y) или t,x,y; x,y в см (sway = xLoop)" style={{ width:'100%', height:80, background:'#0a1629', color:'#fff', border:'1px solid #1f3a5f', borderRadius:8, padding:'8px', fontSize:11, fontFamily:'monospace' }} />
            <div style={{ display:'flex', gap:6, marginTop:6 }}>
              <button onClick={handleCsvParse} style={{ padding:'6px 12px', borderRadius:8, background:'rgba(59,130,246,0.14)', border:'1px solid #1f3a5f', color:'#60a5fa', fontSize:11, cursor:'pointer' }}>📊 Разобрать Kinovea CSV → sway</button>
              <span style={{ fontSize:10, color:DIM, alignSelf:'center' }}>Или введи sway/VBT вручную</span>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6, marginTop:8 }}>
              <label style={{ fontSize:11, color:DIM }}>Sway см<br/><input value={state.swayCm} onChange={e=>setState(s=>({...s, swayCm:e.target.value}))} placeholder="3.2" style={{ width:'100%', marginTop:4, background:'#0a1629', color:'#fff', border:'1px solid #1f3a5f', borderRadius:8, padding:'6px 8px', fontSize:12 }} /></label>
              <label style={{ fontSize:11, color:DIM }}>yMax см<br/><input value={state.stoneKg} onChange={e=>setState(s=>({...s, stoneKg:e.target.value}))} placeholder="85" style={{ width:'100%', marginTop:4, background:'#0a1629', color:'#fff', border:'1px solid #1f3a5f', borderRadius:8, padding:'6px 8px', fontSize:12 }} /></label>
              <label style={{ fontSize:11, color:DIM }}>VBT yoke м/с<br/><input value={state.vbtYokeLast} onChange={e=>setState(s=>({...s, vbtYokeLast:e.target.value}))} placeholder="1.25" style={{ width:'100%', marginTop:4, background:'#0a1629', color:'#fff', border:'1px solid #1f3a5f', borderRadius:8, padding:'6px 8px', fontSize:12 }} /></label>
            </div>
            {swayDiag && <div style={{ marginTop:6, padding:'8px 10px', borderRadius:8, background: swayDiag.severity==='critical'?'rgba(239,68,68,0.08)': swayDiag.severity==='warn'?'rgba(245,158,11,0.08)':'rgba(34,197,94,0.08)', border:`1px solid ${swayDiag.severity==='ok'?'rgba(34,197,94,0.2)': swayDiag.severity==='warn'?'rgba(245,158,11,0.2)':'rgba(239,68,68,0.2)'}` }}><div style={{ fontSize:11, fontWeight:700, color: swayDiag.severity==='ok'?'#22c55e': swayDiag.severity==='warn'?'#f59e0b':'#ef4444' }}>{swayDiag.text}</div><div style={{ fontSize:10, color:DIM }}>SRD sway 3/5см — {swayDiag.isReal?'реально >SRD':'в пределах шума'}</div></div>}
            {vbtLoss && <div style={{ marginTop:6, padding:'8px 10px', borderRadius:8, background: vbtLoss.exceeded?'rgba(239,68,68,0.08)':'rgba(34,197,94,0.08)', border:`1px solid ${vbtLoss.exceeded?'rgba(239,68,68,0.2)':'rgba(34,197,94,0.2)'}` }}><div style={{ fontSize:11, fontWeight:700, color: vbtLoss.exceeded?'#ef4444':'#22c55e' }}>VBT потеря {vbtLoss.lossPct}% · {vbtLoss.zone} · {vbtLoss.recommendation}</div><div style={{ fontSize:10, color:DIM }}>Порог carry 15% (Hindle stride 1.83м) vs TA 10% — VBT yoke {VBT_SS_THRESHOLDS.yoke_walk.optimalMin}/{VBT_SS_THRESHOLDS.yoke_walk.stopMin} м/с</div></div>}
            <div style={{ marginTop:6, padding:'6px 8px', borderRadius:8, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)', fontSize:10, color:DIM }}>VBT зоны: yoke {VBT_SS_THRESHOLDS.yoke_walk.optimalMin}-{VBT_SS_THRESHOLDS.yoke_walk.stopMin} · farmers {VBT_SS_THRESHOLDS.farmers_walk_heavy.optimalMin}/{VBT_SS_THRESHOLDS.farmers_walk_heavy.stopMin} · stone {VBT_SS_THRESHOLDS.atlas_stone_load.optimalMin}/{VBT_SS_THRESHOLDS.atlas_stone_load.stopMin} · log {VBT_SS_THRESHOLDS.log_press.optimalMin}/{VBT_SS_THRESHOLDS.log_press.stopMin} м/с</div>
            <div style={{ marginTop:6, display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
              <div style={{ padding:'6px 8px', borderRadius:8, background: swayCm!=null ? 'rgba(59,130,246,0.08)' : 'rgba(255,255,255,0.04)', border:'1px solid rgba(59,130,246,0.18)', fontSize:10, color:DIM }}>Enode: raw {swayCm ?? '—'}см → {enodeCorrected ?? '—'}см (xLoop bias Chavda 2024)<br/><span style={{ fontSize:9, color:'#60a5fa' }}>raw {swayCm ?? 0} ×1.08 −0.45 = {enodeCorrected ?? 0}</span></div>
              <div style={{ padding:'6px 8px', borderRadius:8, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)', fontSize:10, color:DIM }}>Сетка: yoke 1.30/1.00<br/>farmers 1.40/1.10<br/>stone 0.45/0.30<br/>log 0.32/0.20 м/с — стоп при &lt;stopMin</div>
            </div>
            <div style={{ marginTop:6, padding:'6px 8px', borderRadius:8, background:'rgba(168,85,247,0.08)', border:'1px solid rgba(168,85,247,0.18)', fontSize:10, color:'#a78bfa' }}>BlazePose stub: hip {mockPose.angles.hip}° knee {mockPose.angles.knee}° ankle {mockPose.angles.ankle}° shoulder {mockPose.angles.shoulder}° — {mockPose.status.faults.join(' · ') || 'OK (mock)'}</div>
            <div style={{ marginTop:8, padding:'8px 10px', borderRadius:8, background:'#0a1629', border:'1px solid #1f3a5f' }}>
              <div style={{ fontSize:11, fontWeight:700, color:'#fff' }}>Углы суставов с видео (Hindle-нормы)</div>
              <div style={{ fontSize:10, color:DIM, marginTop:2 }}>Трекер поз → экспорт CSV (t,hip,knee,ankle,shoulder) → вставь ниже. Йок: hip ROM [30,46] / knee [43,65]; лог: shoulder ≥150°.</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 2fr', gap:6, marginTop:6 }}>
                <label style={{ fontSize:11, color:DIM }}>Лифт<br/><select value={state.poseLift} onChange={e=>setState(s=>({...s, poseLift:e.target.value}))} style={{ width:'100%', marginTop:4, background:'#0a1629', color:'#fff', border:'1px solid #1f3a5f', borderRadius:8, padding:'6px 8px', fontSize:11 }}><option value="yoke_walk">yoke</option><option value="farmers_walk">farmers</option><option value="log_press">log</option></select></label>
                <div style={{ display:'flex', alignItems:'flex-end' }}><button onClick={handlePoseParse} style={{ padding:'6px 12px', borderRadius:8, background:'rgba(168,85,247,0.14)', border:'1px solid rgba(168,85,247,0.25)', color:'#a78bfa', fontSize:11, cursor:'pointer' }}>🦿 Разобрать углы</button></div>
              </div>
              <textarea value={state.poseCsv} onChange={e=>setState(s=>({...s, poseCsv:e.target.value}))} placeholder={'t,hip,knee,ankle,shoulder\n0.00,24,8,90,170\n0.03,20,25,88,172'} style={{ width:'100%', height:64, marginTop:6, background:'#0a1629', color:'#fff', border:'1px solid #1f3a5f', borderRadius:8, padding:'8px', fontSize:11, fontFamily:'monospace' }} />
              {poseResult && <div style={{ marginTop:6, padding:'6px 8px', borderRadius:8, background: poseResult.verdict === 'ok' ? 'rgba(34,197,94,0.08)' : 'rgba(245,158,11,0.08)', border:'1px solid rgba(255,255,255,0.06)', fontSize:10, color: poseResult.verdict === 'ok' ? '#22c55e' : '#f59e0b' }}>n={poseResult.n} · {poseResult.verdict.toUpperCase()} · {poseResult.lines.join(' · ')}</div>}
            </div>
            <div style={{ marginTop:8, padding:'8px 10px', borderRadius:8, background:'#0a1629', border:'1px solid #1f3a5f' }}>
              <div style={{ fontSize:11, fontWeight:700, color:'#fff' }}>LVP-калибровка SM (Wood PLOS 2026: population ±0.15 — нужен ramp)</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr 1fr', gap:6, marginTop:6 }}>
                <label style={{ fontSize:11, color:DIM }}>Лифт<br/><select value={state.lvpLift} onChange={e=>setState(s=>({...s, lvpLift:e.target.value}))} style={{ width:'100%', marginTop:4, background:'#0a1629', color:'#fff', border:'1px solid #1f3a5f', borderRadius:8, padding:'6px 8px', fontSize:11 }}><option value="yoke_walk">yoke</option><option value="farmers_walk">farmers</option><option value="stone_load">stone</option><option value="log_press">log</option></select></label>
                <label style={{ fontSize:11, color:DIM }}>50% м/с<br/><input value={state.lvp50} onChange={e=>setState(s=>({...s, lvp50:e.target.value}))} placeholder="1.90" style={{ width:'100%', marginTop:4, background:'#0a1629', color:'#fff', border:'1px solid #1f3a5f', borderRadius:8, padding:'6px 8px', fontSize:12 }} /></label>
                <label style={{ fontSize:11, color:DIM }}>65% м/с<br/><input value={state.lvp65} onChange={e=>setState(s=>({...s, lvp65:e.target.value}))} placeholder="1.60" style={{ width:'100%', marginTop:4, background:'#0a1629', color:'#fff', border:'1px solid #1f3a5f', borderRadius:8, padding:'6px 8px', fontSize:12 }} /></label>
                <label style={{ fontSize:11, color:DIM }}>75% м/с<br/><input value={state.lvp75} onChange={e=>setState(s=>({...s, lvp75:e.target.value}))} placeholder="1.40" style={{ width:'100%', marginTop:4, background:'#0a1629', color:'#fff', border:'1px solid #1f3a5f', borderRadius:8, padding:'6px 8px', fontSize:12 }} /></label>
                <label style={{ fontSize:11, color:DIM }}>90% м/с<br/><input value={state.lvp90} onChange={e=>setState(s=>({...s, lvp90:e.target.value}))} placeholder="1.10" style={{ width:'100%', marginTop:4, background:'#0a1629', color:'#fff', border:'1px solid #1f3a5f', borderRadius:8, padding:'6px 8px', fontSize:12 }} /></label>
              </div>
              <div style={{ display:'flex', gap:6, marginTop:6, alignItems:'center' }}>
                <button onClick={handleLvpFit} style={{ padding:'6px 12px', borderRadius:8, background:'rgba(59,130,246,0.14)', border:'1px solid #1f3a5f', color:'#60a5fa', fontSize:11, cursor:'pointer' }}>📈 Fit LVP</button>
                <span style={{ fontSize:10, color:DIM }}>{state.lvpResult || (smLvpStored ? `сохранён r² ${smLvpStored.r2}${smLvpStored.valid ? ' ✓' : ' ⚠'}` : 'ramp 50/65/75/90 → r²≥0.85')}</span>
              </div>
            </div>
            <div style={{ marginTop:8, padding:'8px 10px', borderRadius:8, background:'#0a1629', border:'1px solid #1f3a5f' }}>
              <div style={{ fontSize:11, fontWeight:700, color:'#fff' }}>Прогресс стронга (йок 20м / фермер 40м / лог / лестница)</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr 1fr', gap:6, marginTop:6 }}>
                <label style={{ fontSize:11, color:DIM }}>Йок 20м с<br/><input value={state.progYoke20m} onChange={e=>setState(s=>({...s, progYoke20m:e.target.value}))} placeholder="12.0" style={{ width:'100%', marginTop:4, background:'#0a1629', color:'#fff', border:'1px solid #1f3a5f', borderRadius:8, padding:'6px 8px', fontSize:12 }} /></label>
                <label style={{ fontSize:11, color:DIM }}>Фермер 40м с<br/><input value={state.progFarmers40m} onChange={e=>setState(s=>({...s, progFarmers40m:e.target.value}))} placeholder="28.0" style={{ width:'100%', marginTop:4, background:'#0a1629', color:'#fff', border:'1px solid #1f3a5f', borderRadius:8, padding:'6px 8px', fontSize:12 }} /></label>
                <label style={{ fontSize:11, color:DIM }}>Лог кг<br/><input value={state.progLogMax} onChange={e=>setState(s=>({...s, progLogMax:e.target.value}))} placeholder="110" style={{ width:'100%', marginTop:4, background:'#0a1629', color:'#fff', border:'1px solid #1f3a5f', borderRadius:8, padding:'6px 8px', fontSize:12 }} /></label>
                <label style={{ fontSize:11, color:DIM }}>Лестница кг<br/><input value={state.progStoneLadder} onChange={e=>setState(s=>({...s, progStoneLadder:e.target.value}))} placeholder="140" style={{ width:'100%', marginTop:4, background:'#0a1629', color:'#fff', border:'1px solid #1f3a5f', borderRadius:8, padding:'6px 8px', fontSize:12 }} /></label>
                <label style={{ fontSize:11, color:DIM }}>Вес кг<br/><input value={state.progBw} onChange={e=>setState(s=>({...s, progBw:e.target.value}))} placeholder="105" style={{ width:'100%', marginTop:4, background:'#0a1629', color:'#fff', border:'1px solid #1f3a5f', borderRadius:8, padding:'6px 8px', fontSize:12 }} /></label>
              </div>
              <div style={{ display:'flex', gap:6, marginTop:6, alignItems:'center' }}>
                <button onClick={handleSaveProgress} style={{ padding:'6px 12px', borderRadius:8, background:'rgba(34,197,94,0.14)', border:'1px solid rgba(34,197,94,0.22)', color:'#22c55e', fontSize:11, cursor:'pointer' }}>💾 Снапшот прогресса</button>
                <span style={{ fontSize:10, color:DIM }}>{smTrend ? `n=${smTrend.n} Δscore ${smTrend.scoreDelta} · best ${smTrend.bestScore} (${smTrend.bestDate})` : `история ${smProgressHist.length}/60`}</span>
              </div>
            </div>
            <div style={{ marginTop:8, padding:'8px 10px', borderRadius:8, background:'#0a1629', border:'1px dashed #1f3a5f', textAlign:'center' }}>
              <div style={{ fontSize:11, color:DIM }}>📹 Видео sway — измеряй lateral как max(x)-min(x) в Kinovea</div>
              <div style={{ marginTop:6, width:'100%', height:60, background:'rgba(255,255,255,0.03)', borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', color:DIM, fontSize:11, border:'1px solid rgba(255,255,255,0.04)' }}>preview — sway 3см норма, &gt;5см критично (McGill lateral bend)</div>
            </div>
          </div>
        )}
      </div>

      <div style={{ ...CARD, padding: 12, background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.16)' }}>
        <div style={{ fontSize:10, color:DIM, marginBottom:6 }}>Findings: {scoring.findings.map(f=>f.text).join(' · ') || '—'}</div>
        {scoring.floors.length>0 && <div style={{ fontSize:10, color:'#ef4444', marginBottom:6 }}>Floors: {scoring.floors.join(' · ')}</div>}
        <div style={{ fontSize:11, color:DIM, marginBottom:6 }}>Выбрано: {weakPoints.length? weakPoints.join(' · ') : '— баланс'} {smWeakPoints.length? `→ ${smWeakPoints.join(' · ')}` : ''}</div>
        {smRankTop.length > 0 && <div style={{ fontSize:10, color:'#5ee', marginBottom:6 }}>Ранжир: {smRankTop.map((c) => `${c.name} ${c.protocol.sets}×${c.protocol.reps} @${c.protocol.pct}% (score ${c.score})`).join(' · ')}</div>}
        {smSpec && <div style={{ fontSize:10, color:DIM, marginBottom:6 }}>Спец-блок {smSpec.totalWeeks}нед: {smSpec.weeks.slice(0, 3).map((w) => `нед${w.week} ${Object.values(w.targetSets)[0]}×5`).join(' · ')}… · {smSpec.rationale[0]}</div>}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, marginBottom:8 }}>
          <label style={{ fontSize:11, color:DIM }}>Спец-блок нед (4-8)<br/><input value={state.specWeeks} onChange={e=>setState(s=>({...s, specWeeks:e.target.value}))} placeholder="6" style={{ width:'100%', marginTop:4, background:'#0a1629', color:'#fff', border:'1px solid #1f3a5f', borderRadius:8, padding:'6px 8px', fontSize:12 }} /></label>
          <label style={{ fontSize:11, color:DIM }}>Год: старт-неделя<br/><input value={state.annualStartWeek} onChange={e=>setState(s=>({...s, annualStartWeek:e.target.value}))} placeholder="1" style={{ width:'100%', marginTop:4, background:'#0a1629', color:'#fff', border:'1px solid #1f3a5f', borderRadius:8, padding:'6px 8px', fontSize:12 }} /></label>
        </div>
        <button onClick={applyToConstructor} style={{ width:'100%', padding:'10px 14px', borderRadius:8, background:'linear-gradient(135deg,#ef4444,#f59e0b)', color:'#fff', border:'none', fontWeight:800, fontSize:13, cursor:'pointer' }}>→ Применить в Стронг-конструктор ({weakPoints.join(', ') || 'баланс'})</button>
        <div style={{ display:'flex', gap:6, marginTop:8 }}>
          <button onClick={handleExport} style={{ flex:1, padding:'8px', borderRadius:8, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)', color:DIM, fontSize:11, cursor:'pointer' }}>🖨 HTML</button>
          <button onClick={handleExportCsv} style={{ flex:1, padding:'8px', borderRadius:8, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)', color:DIM, fontSize:11, cursor:'pointer' }}>📥 CSV</button>
          <button onClick={handleExportIcs} style={{ flex:1, padding:'8px', borderRadius:8, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)', color:DIM, fontSize:11, cursor:'pointer' }}>📅 ICS</button>
          <button onClick={handleSaveAnnual} style={{ flex:1, padding:'8px', borderRadius:8, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)', color:DIM, fontSize:11, cursor:'pointer' }}>🗓 Год</button>
          <button onClick={handleSMBackup} style={{ flex:1, padding:'8px', borderRadius:8, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)', color:DIM, fontSize:11, cursor:'pointer' }}>📦 Бэкап</button>
        </div>
        <div style={{ fontSize:10, color:DIM, marginTop:6 }}>SM-storage: {(smStoreBytes.total / 1024).toFixed(1)}КБ · quota-safe (истории урезаются при переполнении, чужие ключи не трогаем)</div>
      </div>
    </div>
  );
};

export default StrongmanDiagnosticsHub;
