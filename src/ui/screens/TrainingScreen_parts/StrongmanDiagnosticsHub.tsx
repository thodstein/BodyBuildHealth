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
import { assessOHS, OHS_NORMS } from '../../../engines/strength-sport/strength-sport-ohs.engine';
import { VBT_SS_THRESHOLDS } from '../../../engines/strength-sport/strength-sport-vbt.engine';
import { diagnoseVelocityLossSS } from '../../../engines/strength-sport/strength-sport-vbt.engine';
import { parseKinoveaCSV, analyzeBarTracking, diagnoseCarrySway } from '../../../engines/strength-sport/strength-sport-video.engine';
import { detectSMWeakFromDiary, candidateSMWeakPointsFromDiary } from '../../../engines/strength-sport/strength-sport-sm-diary.engine';
import { buildSMDiagnosticsHtml, downloadSMHtml, downloadSMCsv } from '../../../engines/strength-sport/strength-sport-sm-export.engine';
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
};

const DEFAULT_STATE: SMState = {
  pressWeak: [], carryWeak: [], loadWeak: [], gripWeak: [],
  yokeKg: '', farmersKg: '', stoneKg: '', logKg: '', axleKg: '',
  gripHoldSec: '', pinchHoldSec: '', axleHoldSec: '', corePlankSec: '',
  platformHeightCm: '', tackyUsed: false, swayCm: '', yokeSwayCm: '',
  vbtYokeBest: '', vbtYokeLast: '', vbtStoneBest: '', vbtStoneLast: '', vbtLogBest: '', vbtLogLast: '',
  leftMax: '', rightMax: '',
  ohsHeelsFlat: true, ohsKneeValgus: false, ohsHipBelowParallel: true, ohsTrunkUpright: true, ohsArmsOverMidfoot: true, ohsLumbarNeutral: true,
  kneeToWallCm: '', ankleDeg: '', heelRetest: '',
  contestId: '', turnNeeded: false, conditioningFail: false,
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

  const contest = useMemo(() => {
    const id = state.contestId;
    if (!id) return null;
    return (CONTEST_PRESETS as any)[id] || null;
  }, [state.contestId]);

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
    const data: any = {
      groups: weakPoints,
      smWeakPoints,
      weakPoints,
      wlWeakPoints: weakPoints,
      smContest: contest || CONTEST_PRESETS[Object.keys(CONTEST_PRESETS)[0]],
      contest,
      platformHeightCm: state.platformHeightCm ? parseFloat(state.platformHeightCm) : null,
      tackyUsed: state.tackyUsed,
      turnNeeded: state.turnNeeded,
      swayCm,
      sway: swayDiag?.text ?? null,
      vbt: vbtLoss ? `${vbtLoss.lossPct}%` : null,
      vbtLossPct: vbtLoss?.lossPct ?? null,
      score, level, verification: scoring.verification,
      biomech: biomechDetails,
      smBiomech: biomechDetails,
      ohs: { totalScore: ohs.totalScore, failed: ohs.failed },
      gripFails,
      asymmetry: asymmetry?.diff ?? null,
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
    <div style={{ padding: '10px 8px 18px', color: '#fff', maxWidth: 860, margin: '0 auto' }}>
      <div style={{ ...CARD, padding: '14px 14px 12px', background: 'linear-gradient(135deg,rgba(239,68,68,0.12),rgba(245,158,11,0.12))', border: '1px solid rgba(239,68,68,0.22)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -18, right: -18, width: 110, height: 110, borderRadius: 110, background: 'radial-gradient(circle,rgba(239,68,68,0.14),transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg,#ef4444,#f59e0b)', color: '#fff', fontWeight: 900, fontSize: 16 }}>🏋️‍♂️</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 900, color: '#fff', lineHeight: 1 }}>Стронгмен-диагностика — хаб PRO</div>
            <div style={{ fontSize: 10, color: '#fff', lineHeight: 1.3, opacity: 0.9 }}>13 фаз (лог 4 + carry 6 + stone 3) × углы + биомеханика + VBT carry 15% + OHS 6 + grip tri-modal + sway + контест.</div>
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
            {vbtLoss && <div style={{ fontSize:10, color: vbtLoss.exceeded?'#ef4444':'#22c55e', marginTop:4 }}>VBT потеря {vbtLoss.lossPct}% · {vbtLoss.zone} · {vbtLoss.recommendation} · порог 15% carry</div>}
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
            <div style={{ fontSize:10, color: gripFails>=2?'#ef4444':'#22c55e', marginTop:4 }}>Grip fails {gripFails}/3 {gripFails>=2?'— prehab hammer 3×12 + pinch 2×15': '— норма'} · axial {axialOverload?'перегруз ≥12 сетов+300м — QL suitcase 2×20м': 'норм'}</div>
            <div style={{ fontSize:10, color:DIM, marginTop:6 }}>ACWR {acwr? `${acwr.ratio.toFixed(2)} ${acwr.zone}` : '—'} · conditioning как в strength-sport-conditioning (alactic 8×10с/50с)</div>
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
                <div style={{ fontSize:10, color:DIM }}>Пороги 7/12% — предиктор distal biceps tear (Heazlewood).</div>
              </div>
            )}
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
        <button onClick={applyToConstructor} style={{ width:'100%', padding:'10px 14px', borderRadius:8, background:'linear-gradient(135deg,#ef4444,#f59e0b)', color:'#fff', border:'none', fontWeight:800, fontSize:13, cursor:'pointer' }}>→ Применить в Стронг-конструктор ({weakPoints.join(', ') || 'баланс'})</button>
        <div style={{ display:'flex', gap:6, marginTop:8 }}>
          <button onClick={handleExport} style={{ flex:1, padding:'8px', borderRadius:8, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)', color:DIM, fontSize:11, cursor:'pointer' }}>🖨 HTML</button>
          <button onClick={handleExportCsv} style={{ flex:1, padding:'8px', borderRadius:8, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)', color:DIM, fontSize:11, cursor:'pointer' }}>📥 CSV</button>
        </div>
      </div>
    </div>
  );
};

export default StrongmanDiagnosticsHub;
