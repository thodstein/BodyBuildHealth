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
import { estimateAnglesFromLandmarks, livePoseStatus, createMockPoseStream, ensurePoseModel } from '../../../engines/strength-sport/strength-sport-pose.engine';
import { diagnoseCarryPathFromPoints } from '../../../engines/strength-sport/strength-sport-sm-carry-path.engine';
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
import { logDiameterClass, scaleLogAttempt, logDiameterNote } from '../../../engines/strength-sport/strength-sport-sm-log-diameter.engine';
import { diagnoseStoneSecondPullForSex, resolveAthleteSex, athleteSexLabel } from '../../../engines/strength-sport/strength-sport-sm-sex-norms.engine';
import { diagnoseStonePhaseTiming, diagnoseCarrySplits } from '../../../engines/strength-sport/strength-sport-sm-phase-timing.engine';
import { scoreSMBicepsRisk } from '../../../engines/strength-sport/strength-sport-sm-biceps-risk.engine';
import { diagnoseSMHoldEvent } from '../../../engines/strength-sport/strength-sport-sm-hold-event.engine';
import { buildSMFormatPlan, SM_EVENT_FORMAT_LABEL, type SMEventFormat } from '../../../engines/strength-sport/strength-sport-sm-format-attempts.engine';
import { smAutoAnglesFromCsv } from '../../../engines/strength-sport/strength-sport-sm-auto-angles.engine';
import { smAttemptsFor } from '../../../engines/strength-sport/strength-sport-strongman-attempts.engine';
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
  poseLive: '' | 'loading' | 'ok' | 'fail';
  poseSex: '' | 'male' | 'female';
  // SM PRO2: формат ивента + пофазный тайминг + бицепс-анамнез + холд/медли
  eventFormat: SMEventFormat;
  workPct: string;
  stonePull1S: string;
  stoneLapS: string;
  stonePull2S: string;
  carrySplit1S: string;
  carrySplit2S: string;
  carrySplit3S: string;
  bicepsHistory: boolean;
  herculesSec: string;
  herculesKg: string;
  medleyDrops: string;
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
  poseLive: '',
  poseSex: '',
  eventFormat: 'max', workPct: '90',
  stonePull1S: '', stoneLapS: '', stonePull2S: '',
  carrySplit1S: '', carrySplit2S: '', carrySplit3S: '',
  bicepsHistory: false,
  herculesSec: '', herculesKg: '', medleyDrops: '',
};

const TAB_DEFS: Array<{ id: SMTab; label: string; icon: string; desc: string }> = [
  { id: 'press', label: 'Жим', icon: '🏋️', desc: 'лог/аксель/жим' },
  { id: 'carry', label: 'Переноски', icon: '🚜', desc: 'йок/фермер/рама' },
  { id: 'load', label: 'Загрузки', icon: '🪨', desc: 'камни/мешок/кега' },
  { id: 'grip', label: 'Хват/Кор', icon: '✊', desc: 'хват + кор + кондиция' },
  { id: 'mobility', label: 'Мобильность', icon: '🧘', desc: 'ОГС (OHS) 6 + качание' },
  { id: 'video', label: 'Видео', icon: '📹', desc: 'Кинова (Kinovea) + качание' },
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

const HUB_SF = '-apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif';

/** Свитч-тогл топ-уровня: трек 52×32, слайд-кноб, янтарный glow во вкл. */
const HubToggle: React.FC<{ checked: boolean; onChange: (v: boolean) => void; label: React.ReactNode; style?: React.CSSProperties }> = ({ checked, onChange, label, style }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    onClick={() => onChange(!checked)}
    style={{
      display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '12px 14px', minHeight: 56,
      borderRadius: 16, cursor: 'pointer', textAlign: 'left', fontFamily: HUB_SF,
      background: checked ? 'rgba(245,158,11,0.12)' : 'rgba(255,255,255,0.03)',
      border: '1px solid', borderColor: checked ? 'rgba(245,158,11,0.35)' : 'rgba(255,255,255,0.08)',
      color: '#fff', fontSize: 14, fontWeight: checked ? 700 : 500,
      boxShadow: checked ? '0 0 16px rgba(245,158,11,0.22)' : 'none',
      ...style,
    }}
  >
    <span style={{
      width: 52, height: 32, borderRadius: 16, padding: 3, display: 'flex',
      justifyContent: checked ? 'flex-end' : 'flex-start', flexShrink: 0, transition: 'all 0.2s',
      background: checked ? 'linear-gradient(135deg,#f59e0b,#ef4444)' : 'rgba(255,255,255,0.14)',
      boxShadow: checked ? '0 0 14px rgba(245,158,11,0.45)' : 'inset 0 1px 3px rgba(0,0,0,0.3)',
    }}>
      <span style={{ width: 26, height: 26, borderRadius: 13, background: '#fff', boxShadow: '0 2px 6px rgba(0,0,0,0.35)' }} />
    </span>
    <span style={{ flex: 1, lineHeight: 1.35 }}>{label}</span>
  </button>
);

/** Попап-селект топ-уровня: карточка 60px + шит с пружиной, деском и Done. */
const HubPopupSelect: React.FC<{ label: string; value: string; options: Array<{ id: string; label: string; desc?: string }>; onChange: (v: string) => void }> = ({ label, value, options, onChange }) => {
  const [open, setOpen] = React.useState(false);
  const sel = options.find(o => o.id === value);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label={label}
        style={{
          width: '100%', padding: '10px 14px', minHeight: 60, borderRadius: 16, cursor: 'pointer',
          background: 'rgba(22,30,52,0.88)', border: '1px solid rgba(140,190,255,0.16)',
          color: '#fff', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 2,
          textAlign: 'left', fontFamily: HUB_SF,
        }}
      >
        <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.2, color: '#f5b04c' }}>{label.toUpperCase()}</span>
        <span style={{ fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sel ? sel.label : 'Выбрать…'}</span>
          <span style={{ fontSize: 12, color: '#fff', flexShrink: 0 }}>▾</span>
        </span>
      </button>
      {open && (
        <div className="hub-sheet-backdrop" onClick={() => setOpen(false)} role="presentation" style={{ position: 'fixed', inset: 0, zIndex: 500, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', background: 'rgba(2,6,14,0.62)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', padding: 0, animation: 'hubFade 0.22s ease' }}>
          <div className="hub-sheet" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={label} style={{ width: '100%', maxWidth: 440, maxHeight: '80vh', overflowY: 'auto', scrollbarWidth: 'none', borderRadius: '24px 24px 0 0', background: 'linear-gradient(180deg, #232a3d 0%, #1a1e2e 100%)', border: '1px solid rgba(140,190,255,0.16)', borderBottom: 'none', borderTop: '2px solid #f59e0b', boxShadow: '0 -16px 48px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.07)', paddingBottom: 'max(16px, env(safe-area-inset-bottom))', animation: 'hubSheetUp 0.32s cubic-bezier(0.22,0.9,0.28,1)', fontFamily: HUB_SF }}>
            <div style={{ width: 40, height: 5, borderRadius: 3, background: 'rgba(140,190,255,0.30)', margin: '10px auto 0' }} />
            <div style={{ padding: '14px 16px 10px', fontSize: 15, fontWeight: 800, color: '#fff', textAlign: 'center' }}>{label}</div>
            <div style={{ padding: '0 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {options.map(o => {
                const active = o.id === value;
                return (
                  <button key={o.id} onClick={() => { onChange(o.id); setOpen(false); }} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '14px 16px', minHeight: 60, borderRadius: 14, cursor: 'pointer', textAlign: 'left', background: active ? 'rgba(245,158,11,0.16)' : 'rgba(255,255,255,0.02)', border: active ? '1px solid rgba(245,158,11,0.35)' : '1px solid transparent', color: '#fff', fontSize: 16, fontWeight: active ? 700 : 500 }}>
                    <span style={{ width: 22, height: 22, borderRadius: 11, border: '2px solid', borderColor: active ? '#f5b04c' : 'rgba(255,255,255,0.30)', background: active ? '#f59e0b' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, flexShrink: 0 }}>{active ? '✓' : ''}</span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.label}</span>
                      {o.desc && <span style={{ display: 'block', fontSize: 13, color: active ? '#f5b04c' : '#fff', marginTop: 2 }}>{o.desc}</span>}
                    </span>
                  </button>
                );
              })}
            </div>
            <div style={{ padding: '12px 16px' }}>
              <button onClick={() => setOpen(false)} style={{ width: '100%', minHeight: 52, borderRadius: 14, border: 'none', background: 'linear-gradient(135deg,#f59e0b,#ef4444)', color: '#fff', fontSize: 17, fontWeight: 800, cursor: 'pointer', fontFamily: HUB_SF, boxShadow: '0 6px 20px rgba(245,158,11,0.30)' }}>Готово</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

/** Красивый ввод числа: карточка 56px + шит со степпером, быстрыми кнопками и полем. Все кнопки ≥48px (АПК). */
const HubNum: React.FC<{ label: string; value: string; onChange: (v: string) => void; placeholder?: string; unit?: string; step?: number }> = ({ label, value, onChange, placeholder, unit, step }) => {
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState(value);
  React.useEffect(() => { if (open) setDraft(value); }, [open, value]);
  const st = step ?? 1;
  const bump = (d: number) => {
    const cur = parseFloat(draft);
    const base = Number.isFinite(cur) ? cur : 0;
    const next = Math.round((base + d) * 10) / 10;
    setDraft(String(next));
  };
  const commit = (v: string) => { onChange(v); setOpen(false); };
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label={`${label}: ${value || placeholder || 'не задано'}`}
        style={{
          width: '100%', padding: '8px 14px', minHeight: 56, borderRadius: 14, cursor: 'pointer',
          background: 'rgba(22,30,52,0.88)', border: '1px solid rgba(140,190,255,0.16)',
          color: '#fff', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 2,
          textAlign: 'left', fontFamily: HUB_SF,
        }}
      >
        <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.1, color: '#fff', textTransform: 'uppercase' }}>{label}{unit ? ` · ${unit}` : ''}</span>
        <span style={{ fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{value || placeholder || '—'}</span>
          <span style={{ fontSize: 12, color: '#fff', flexShrink: 0 }}>✎</span>
        </span>
      </button>
      {open && (
        <div className="hub-sheet-backdrop" onClick={() => setOpen(false)} role="presentation" style={{ position: 'fixed', inset: 0, zIndex: 500, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', background: 'rgba(2,6,14,0.62)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', padding: 0, animation: 'hubFade 0.22s ease' }}>
          <div className="hub-sheet" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={label} style={{ width: '100%', maxWidth: 440, maxHeight: '80vh', overflowY: 'auto', scrollbarWidth: 'none', borderRadius: '24px 24px 0 0', background: 'linear-gradient(180deg, #232a3d 0%, #1a1e2e 100%)', border: '1px solid rgba(140,190,255,0.16)', borderBottom: 'none', borderTop: '2px solid #f59e0b', boxShadow: '0 -16px 48px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.07)', paddingBottom: 'max(16px, env(safe-area-inset-bottom))', animation: 'hubSheetUp 0.32s cubic-bezier(0.22,0.9,0.28,1)', fontFamily: HUB_SF }}>
            <div style={{ width: 40, height: 5, borderRadius: 3, background: 'rgba(140,190,255,0.30)', margin: '10px auto 0' }} />
            <div style={{ padding: '14px 16px 10px', fontSize: 15, fontWeight: 800, color: '#fff', textAlign: 'center' }}>{label}{unit ? ` (${unit})` : ''}</div>
            <div style={{ padding: '0 16px', display: 'flex', gap: 8, alignItems: 'stretch' }}>
              <button type="button" onClick={() => bump(-st)} aria-label="Уменьшить" style={{ flexShrink: 0, width: 56, minHeight: 56, borderRadius: 14, border: '1px solid rgba(140,190,255,0.20)', background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: 22, fontWeight: 800, cursor: 'pointer' }}>−</button>
              <input value={draft} onChange={e => setDraft(e.target.value)} inputMode="decimal" placeholder={placeholder || '0'} aria-label={label} style={{ flex: 1, minWidth: 0, background: 'rgba(22,30,52,0.95)', color: '#fff', border: '1px solid rgba(245,158,11,0.35)', borderRadius: 14, padding: '12px 14px', fontSize: 20, fontWeight: 800, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }} />
              <button type="button" onClick={() => bump(st)} aria-label="Увеличить" style={{ flexShrink: 0, width: 56, minHeight: 56, borderRadius: 14, border: '1px solid rgba(140,190,255,0.20)', background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: 22, fontWeight: 800, cursor: 'pointer' }}>+</button>
            </div>
            <div style={{ padding: '10px 16px 0', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {[['−5', -5 * st], ['−1', -st], ['+1', st], ['+5', 5 * st]].map(([t, d]) => (
                <button key={t as string} type="button" onClick={() => bump(d as number)} style={{ flex: '1 1 60px', minHeight: 48, borderRadius: 12, border: '1px solid rgba(140,190,255,0.20)', background: 'rgba(255,255,255,0.04)', color: '#fff', fontSize: 14, fontWeight: 800, cursor: 'pointer' }}>{t as string}</button>
              ))}
              <button type="button" onClick={() => setDraft('')} style={{ flex: '1 1 60px', minHeight: 48, borderRadius: 12, border: '1px solid rgba(140,190,255,0.20)', background: 'rgba(255,255,255,0.04)', color: '#fff', fontSize: 14, fontWeight: 800, cursor: 'pointer' }}>Очистить</button>
            </div>
            <div style={{ padding: '12px 16px', display: 'flex', gap: 8 }}>
              <button type="button" onClick={() => setOpen(false)} style={{ flex: 1, minHeight: 52, borderRadius: 14, border: '1px solid rgba(255,255,255,0.12)', background: 'transparent', color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer', fontFamily: HUB_SF }}>Отмена</button>
              <button type="button" onClick={() => commit(draft)} style={{ flex: 2, minHeight: 52, borderRadius: 14, border: 'none', background: 'linear-gradient(135deg,#f59e0b,#ef4444)', color: '#fff', fontSize: 17, fontWeight: 800, cursor: 'pointer', fontFamily: HUB_SF, boxShadow: '0 6px 20px rgba(245,158,11,0.30)' }}>Готово</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

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
  const [carryPath, setCarryPath] = useState<{ type: string; verdict: string; lines: string[] } | null>(null);
  const [autoAngles, setAutoAngles] = useState<{ verdict: string; lines: string[] } | null>(null);

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

  // ── SM PRO2: диаметр лога + пол + фазы + бицепс + холд + формат ──
  const logDiamCm = useMemo(() => {
    const v = parseFloat(state.diameterCm);
    return Number.isFinite(v) && v > 0 ? v : null;
  }, [state.diameterCm]);
  const logDiamCls = useMemo(() => logDiameterClass(logDiamCm), [logDiamCm]);
  const profileSex = useMemo(() => {
    try {
      const raw = localStorage.getItem('he_profile_v2');
      const p = raw ? JSON.parse(raw) : null;
      return (p?.personal?.sex ?? p?.settings?.personal?.sex ?? null) as string | null;
    } catch { return null; }
  }, []);
  const athleteSex = useMemo(() => resolveAthleteSex(state.poseSex, profileSex), [state.poseSex, profileSex]);
  const scaledLogAttempts = useMemo(() => {
    const pm = parseFloat(state.logKg);
    if (!Number.isFinite(pm) || !pm || logDiamCm == null) return null;
    try {
      const a = smAttemptsFor(pm, (state.strategy as never) || ('balanced' as never), 2.5);
      return {
        opener: scaleLogAttempt(a.opener, logDiamCm),
        second: scaleLogAttempt(a.second, logDiamCm),
        third: scaleLogAttempt(a.third, logDiamCm),
      };
    } catch { return null; }
  }, [state.logKg, state.strategy, logDiamCm]);
  const numOrNull = (s: string): number | null => {
    const v = parseFloat(s);
    return Number.isFinite(v) && v > 0 ? v : null;
  };
  const stonePhase = useMemo(() => diagnoseStonePhaseTiming({
    pull1S: numOrNull(state.stonePull1S),
    lapS: numOrNull(state.stoneLapS),
    pull2S: numOrNull(state.stonePull2S),
    sex: athleteSex,
  }), [state.stonePull1S, state.stoneLapS, state.stonePull2S, athleteSex]);
  const sexStonePull = useMemo(() => diagnoseStoneSecondPullForSex(
    numOrNull(state.stonePull2S), athleteSex,
  ), [state.stonePull2S, athleteSex]);
  const carrySplitDiag = useMemo(() => diagnoseCarrySplits([
    numOrNull(state.carrySplit1S), numOrNull(state.carrySplit2S), numOrNull(state.carrySplit3S),
  ]), [state.carrySplit1S, state.carrySplit2S, state.carrySplit3S]);
  const bicepsRisk = useMemo(() => scoreSMBicepsRisk({
    stonePlanned: (parseFloat(state.stoneKg) || 0) > 0,
    mixedGrip: state.mixGrip === 'mixed',
    intensityPct: numOrNull(state.workPct),
    armsBent: state.armsBent,
    gripFails,
    historyBiceps: state.bicepsHistory,
  }), [state.stoneKg, state.mixGrip, state.workPct, state.armsBent, gripFails, state.bicepsHistory]);
  const holdEventDiag = useMemo(() => {
    const dRaw = parseFloat(state.medleyDrops);
    const drops = state.medleyDrops !== '' && Number.isFinite(dRaw) && dRaw >= 0 ? dRaw : null;
    return diagnoseSMHoldEvent({
      herculesSec: numOrNull(state.herculesSec),
      herculesKg: numOrNull(state.herculesKg),
      medleyDrops: drops,
    });
  }, [state.herculesSec, state.herculesKg, state.medleyDrops]);
  const formatPlan = useMemo(() => {
    try {
      return buildSMFormatPlan({
        format: state.eventFormat,
        pmKg: numOrNull(state.logKg),
        strategy: (state.strategy as never) || ('balanced' as never),
        heightFromM: numOrNull(state.platformHeightCm) != null ? (parseFloat(state.platformHeightCm) / 100) : null,
      });
    } catch { return null; }
  }, [state.eventFormat, state.logKg, state.strategy, state.platformHeightCm]);

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
      strategy: state.strategy,
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
      conditioning: smCondSessionFor({ conditioningFail: state.conditioningFail || state.gripWeak.includes('conditioning'), mhvDecrementPct: vbtLoss?.lossPct ?? null }),
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
      logDiameter: logDiamCls ? { cm: logDiamCm, cls: logDiamCls, scaledLogAttempts } : null,
      athleteSex,
      phaseTiming: { stone: stonePhase, carry: carrySplitDiag, sexStonePull },
      bicepsRisk: { score: bicepsRisk.score, level: bicepsRisk.level, gate: bicepsRisk.gate, lines: bicepsRisk.lines },
      holdEvent: holdEventDiag,
      eventFormat: state.eventFormat,
      formatPlan,
      autoAngles,
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
      setToast('✓ Прогресс сохранён (лимит 60)');
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
      setToast(`✓ Профиль хвата: щипок ${p.pinchSec} сек / сдавливание ${p.crushSec} сек / опора ${p.supportSec} сек`);
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
      setToast(`✓ Снапшот приседа (OHS) ${ohs.totalScore}/6${tr && tr.n >= 2 ? ` · тренд ${tr.delta >= 0 ? '+' : ''}${tr.delta}` : ''}`);
      setTimeout(() => setToast(''), 2500);
    } catch { /* noop */ }
  };

  const handleSMBackup = () => {
    try {
      const b = buildSMBackup();
      downloadSMBackup(`sm-backup-${new Date().toISOString().slice(0, 10)}.json`);
      setToast(`✓ Резервная копия: ${Object.keys(b.data).length}/${SM_STORAGE_KEYS.length} ключей · ${(smStoreBytes.total / 1024).toFixed(1)} КБ`);
      setTimeout(() => setToast(''), 2500);
    } catch { /* noop */ }
  };

  const handleSaveGripSnap = () => {
    try {
      const l = parseFloat(state.leftMax);
      const r = parseFloat(state.rightMax);
      if (!Number.isFinite(l) || !Number.isFinite(r) || !l || !r) { setToast('Введи левый/правый макс'); setTimeout(() => setToast(''), 2000); return; }
      const d = diagnoseSMGripAsymmetry({ leftKg: l, rightKg: r });
      if (!d) return;
      const key = 'he_sm_grip_hist_v1';
      const raw = localStorage.getItem(key);
      const hist = raw ? JSON.parse(raw) : [];
      const today = new Date().toISOString().slice(0, 10);
      const next = appendSMGripSnapshot(hist, { date: today, left: l, right: r, diffPct: d.diffPct, metric: 'kg' });
      localStorage.setItem(key, JSON.stringify(next));
      const tr = smGripTrend(next);
      setToast(`✓ Снапшот хвата ${d.diffPct}%${tr && tr.n >= 2 ? ` · тренд ${tr.deltaPp} п.п.` : ''}`);
      setTimeout(() => setToast(''), 2500);
    } catch { /* noop */ }
  };

  const handleExportIcs = () => {
    if (!smSpec) { setToast('Нет спец-блока — выбери слабые фазы'); setTimeout(() => setToast(''), 2000); return; }
    const ics = buildSMIcs(smSpec, { title: 'Стронг спец-блок' });
    if (!ics) return;
    downloadSMIcs(ics, `sm-spec-${new Date().toISOString().slice(0, 10)}.ics`);
    setToast('✓ Календарь спец-блока (ICS)');
    setTimeout(() => setToast(''), 2000);
  };

  const handleSaveAnnual = () => {
    if (!smSpec) { setToast('Нет спец-блока'); setTimeout(() => setToast(''), 2000); return; }
    const weeks = buildSMAnnualOverlay(smSpec, { startWeek: parseInt(state.annualStartWeek) || 1 });
    if (!weeks) return;
    saveSMAnnualOverlay(weeks, parseInt(state.annualStartWeek) || 1);
    setToast(`✓ Годовая подложка: ${weeks.length} нед → годовой план`);
    setTimeout(() => setToast(''), 2500);
  };

  const ruVerdict = (v: string): string => v === 'ok' ? 'ОК' : v === 'warn' ? 'ВНИМАНИЕ' : v === 'critical' ? 'КРИТ' : v;
  const handlePoseParse = () => {
    const r = smPoseCheckFromCsv(state.poseCsv, state.poseLift, state.poseSex || null);
    if (!r) { setToast('Углы не распознаны (время,таз,колено,голеностоп,плечо)'); setTimeout(() => setToast(''), 2000); return; }
    setPoseResult({ verdict: r.result.verdict, lines: r.result.lines, n: r.result.n });
    setToast(`✓ Углы: n=${r.result.n} → ${ruVerdict(r.result.verdict)}`);
    setTimeout(() => setToast(''), 2500);
  };

  const handleAutoAngles = () => {
    const r = smAutoAnglesFromCsv(state.poseCsv, state.poseLift);
    if (!r.valid) {
      setAutoAngles(null);
      setToast(`✕ ${r.error}`);
      setTimeout(() => setToast(''), 2500);
      return;
    }
    setAutoAngles({ verdict: r.verdict, lines: r.lines });
    setToast(`✓ Авто-углы: n=${r.angles.n} → ${ruVerdict(r.verdict)}`);
    setTimeout(() => setToast(''), 2500);
  };

  const handleCsvParse = () => {
    const pts = parseKinoveaCSV(csvText);
    if (!pts) { setToast('Таблица не распознана (нужен CSV Кинова)'); setTimeout(()=>setToast(''),2000); return; }
    const res = analyzeBarTracking(pts);
    if (!res) { setToast('Нет точек'); return; }
    const sway = Math.round(res.xLoop * 10)/10;
    setState(s => ({ ...s, swayCm: String(sway), yokeSwayCm: String(sway) }));
    try {
      const path = diagnoseCarryPathFromPoints(pts.map((p) => ({ x: p.x, y: p.y, t: p.t })));
      setCarryPath(path ? { type: path.type, verdict: path.verdict, lines: path.lines } : null);
    } catch { setCarryPath(null); }
    setToast(`✓ Кинова (Kinovea): качание ${sway} см, высота ${res.yMax} см, скорость ${res.vmax} м/с`);
    setTimeout(()=>setToast(''),3000);
  };

  // MediaPipe live-проверка (честно: только наличие модели, углы — через CSV выше; parity с ТА)
  const checkPoseLive = async () => {
    setState(s => ({ ...s, poseLive: 'loading' }));
    try {
      const ok = await ensurePoseModel();
      setState(s => ({ ...s, poseLive: ok ? 'ok' : 'fail' }));
      setToast(ok ? '✓ Модель поз доступна — живые углы следующим шагом' : '✕ Модель поз недоступна (нет сети)');
      setTimeout(() => setToast(''), 2500);
    } catch {
      setState(s => ({ ...s, poseLive: 'fail' }));
    }
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
      setToast(`✓ Подвижность ${uniq.join(', ') || 'ОК'} → профиль`);
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
    logDiameter: logDiamCls ? `${logDiamCm} см (${logDiamCls})${scaledLogAttempts ? ` → ${scaledLogAttempts.opener}/${scaledLogAttempts.second}/${scaledLogAttempts.third} кг` : ''}` : null,
    athleteSex: athleteSexLabel(athleteSex),
    sexStonePull: sexStonePull ? sexStonePull.lines.join(' · ') : null,
    stonePhases: stonePhase ? stonePhase.lines.join(' · ') : null,
    carrySplits: carrySplitDiag ? carrySplitDiag.lines.join(' · ') : null,
    biceps: `${bicepsRisk.score}/100 ${bicepsRisk.level}${bicepsRisk.gate ? ' · ГЕЙТ: только лямки/нейтраль' : ''}`,
    holdEvent: holdEventDiag ? holdEventDiag.lines.join(' · ') : null,
    eventFormat: `${SM_EVENT_FORMAT_LABEL[state.eventFormat]}${formatPlan ? ` · ${formatPlan.lines.join(' · ')}` : ''}`,
    autoAngles: autoAngles ? autoAngles.lines.join(' · ') : null,
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
    setToast('✓ Печать (HTML) готова');
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
    setToast('✓ Выгрузка (CSV) готова');
    setTimeout(()=>setToast(''),2000);
  };

  const smBiomechForWeak = (wp: string) => {
    const map: Record<string, SMWeakPoint> = {};
    for (const o of [...PRESS_OPTS, ...CARRY_OPTS, ...LOAD_OPTS, ...GRIP_OPTS]) map[o.id] = o.sm;
    const sm = map[wp] as SMWeakPoint | undefined;
    return sm ? diagnoseSMWeakPoint(sm) : null;
  };

  return (
    <div className="train-strongdiag" style={{ padding: '10px 8px 16px', color: '#fff', maxWidth: 880, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <style>{`.train-strongdiag input:focus, .train-strongdiag select:focus, .train-strongdiag textarea:focus{ border-color:rgba(245,158,11,0.65) !important; box-shadow:0 0 0 3px rgba(245,158,11,0.18) !important; outline:none !important; }.train-strongdiag input::placeholder, .train-strongdiag textarea::placeholder{ color:rgba(255,255,255,0.75); opacity:1; }.train-strongdiag button{ -webkit-tap-highlight-color:transparent; min-height:44px; }.train-strongdiag button:active{ transform:scale(0.97); }.train-strongdiag details > summary{ list-style:none; }.train-strongdiag details > summary::-webkit-details-marker{ display:none; }.train-strongdiag details > summary::after{ content:'▾'; margin-left:auto; color:#fff; font-size:12px; transition:transform 0.2s; flex-shrink:0; }.train-strongdiag details[open] > summary::after{ transform:rotate(180deg); }.train-strongdiag summary:active{ opacity:0.75; }.train-strongdiag button:focus-visible, .train-strongdiag summary:focus-visible, .train-strongdiag input:focus-visible, .train-strongdiag select:focus-visible, .train-strongdiag textarea:focus-visible{ outline:2px solid rgba(245,158,11,0.70); outline-offset:2px; }@media (prefers-reduced-motion: reduce){ .train-strongdiag button:active{ transform:none; } }@keyframes hubFade{from{opacity:0}to{opacity:1}}@keyframes hubSheetUp{from{opacity:0;transform:translateY(56px) scale(0.98)}to{opacity:1;transform:translateY(0) scale(1)}}`}</style>
      <div style={{ ...CARD, padding: '12px 12px 10px', background: 'linear-gradient(135deg,rgba(239,68,68,0.12),rgba(245,158,11,0.12))', border: '1px solid rgba(239,68,68,0.22)', borderTop: '3px solid rgba(239,68,68,0.55)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg,#ef4444,#f59e0b)', color: '#fff', fontWeight: 900, fontSize: 20, flexShrink: 0, boxShadow: '0 6px 20px rgba(239,68,68,0.35), inset 0 1px 0 rgba(255,255,255,0.25)' }}>🏋️‍♂️</div>
          <div style={{ flex: '1 1 180px', minWidth: 0 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#fff', lineHeight: 1.15, letterSpacing: -0.3 }}>Стронгмен-диагностика — хаб PRO</div>
            <div style={{ fontSize: 12, color: '#fff', lineHeight: 1.4, marginTop: 2 }}>16 фаз × углы + биомеханика + скорость (VBT) + присед над головой (OHS) + хват + качание (sway) + симулятор.</div>
          </div>
          <div style={{ textAlign: 'center', flexShrink: 0, marginLeft: 'auto' }}>
            <div style={{ width: 60, height: 60, borderRadius: 30, background: `conic-gradient(${sColor} ${score}%, rgba(255,255,255,0.06) 0)`, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `3px solid ${sColor}`, fontWeight: 900, color: '#fff', fontSize: 16, boxShadow: `0 0 20px ${sColor}44` }}>{score}</div>
            <div style={{ fontSize: 11, color: sColor, fontWeight: 800, marginTop: 4 }}>{level==='ok'?'ОК':level==='warn'?'ВНИМАНИЕ':'КРИТ'} · v{scoring.verification}</div>
          </div>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(130px, 1fr))', gap:6, marginBottom:6 }}>
          <div style={{ padding:'10px 12px', borderRadius:14, background:'rgba(255,255,255,0.035)', border:'1px solid rgba(255,255,255,0.07)', borderTop:`2px solid ${ohs.level==='ok'?'#22c55e':'#ef4444'}`, display:'flex', flexDirection:'column', gap:2 }}>
            <span style={{ fontSize:10, fontWeight:800, letterSpacing:1.2, color:'#fff' }}>OHS · МОБИЛЬНОСТЬ</span>
            <span style={{ fontSize:20, fontWeight:800, fontVariantNumeric:'tabular-nums', color: ohs.level==='ok'?'#22c55e':'#ef4444' }}>{ohs.totalScore}/6</span>
          </div>
          <div style={{ padding:'10px 12px', borderRadius:14, background:'rgba(255,255,255,0.035)', border:'1px solid rgba(255,255,255,0.07)', borderTop:`2px solid ${gripFails>0?'#f59e0b':'#22c55e'}`, display:'flex', flexDirection:'column', gap:2 }}>
            <span style={{ fontSize:10, fontWeight:800, letterSpacing:1.2, color:'#fff' }}>GRIP · ПРОВАЛЫ</span>
            <span style={{ fontSize:20, fontWeight:800, fontVariantNumeric:'tabular-nums', color: gripFails>0?'#f59e0b':'#22c55e' }}>grip {gripFails? `${gripFails}/3` : 'OK'}</span>
          </div>
          <div style={{ padding:'10px 12px', borderRadius:14, background:'rgba(255,255,255,0.035)', border:'1px solid rgba(255,255,255,0.07)', borderTop:`2px solid ${swayDiag ? (swayDiag.severity==='ok'?'#22c55e':'#ef4444') : 'rgba(255,255,255,0.15)'}`, display:'flex', flexDirection:'column', gap:2 }}>
            <span style={{ fontSize:10, fontWeight:800, letterSpacing:1.2, color:'#fff' }}>SWAY · CARRY</span>
            <span style={{ fontSize:20, fontWeight:800, fontVariantNumeric:'tabular-nums', color: swayDiag ? (swayDiag.severity==='ok'?'#22c55e':'#ef4444') : '#fff' }}>{swayDiag ? `качание ${swayDiag.swayCm} см` : '—'}</span>
          </div>
          <div style={{ padding:'10px 12px', borderRadius:14, background:'rgba(255,255,255,0.035)', border:'1px solid rgba(255,255,255,0.07)', borderTop:`2px solid ${vbtLoss ? (vbtLoss.exceeded?'#ef4444':'#22c55e') : 'rgba(255,255,255,0.15)'}`, display:'flex', flexDirection:'column', gap:2 }}>
            <span style={{ fontSize:10, fontWeight:800, letterSpacing:1.2, color:'#fff' }}>VBT · ПОТЕРЯ</span>
            <span style={{ fontSize:20, fontWeight:800, fontVariantNumeric:'tabular-nums', color: vbtLoss ? (vbtLoss.exceeded?'#ef4444':'#22c55e') : '#fff' }}>{vbtLoss ? `VBT ${vbtLoss.lossPct}%` : '—'}</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', fontSize: 12, marginBottom: 6 }}>
          <span style={{ padding: '6px 12px', borderRadius: 20, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: '#fff' }}>ACWR {acwr ? acwr.ratio.toFixed(2) : '—'} {acwr ? (acwr.zone === 'dangerous' ? '🔴' : acwr.zone === 'caution' ? '🟠' : '🟢') : ''}</span>
          <span style={{ padding: '6px 12px', borderRadius: 20, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: '#fff' }}>{weakPoints.length? `${weakPoints.length} слабые` : 'баланс'}</span>
          {scoring.floors.length>0 && <span style={{ padding: '6px 12px', borderRadius: 20, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.22)', color: '#fff' }}>порог: {scoring.floors[0]}</span>}
        </div>
        {(diaryWeaks.length>0 || diaryPhases.length>0) && (
          <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:6 }}>
            {diaryWeaks.length>0 && <span style={{ padding:'6px 12px', borderRadius:20, background:'rgba(94,234,212,0.10)', border:'1px solid rgba(94,234,212,0.22)', color:'#5ee', fontSize:12, fontWeight:700 }}>📓 Дневник: {diaryWeaks.map(w=> `${w.label}`).join(', ')}</span>}
            {diaryPhases.length>0 && <span style={{ padding:'6px 12px', borderRadius:20, background:'rgba(167,139,250,0.10)', border:'1px solid rgba(167,139,250,0.22)', color:'#a78bfa', fontSize:12, fontWeight:700 }}>📓 Фаза по дневнику: {diaryPhases.join(' · ')}</span>}
          </div>
        )}
        <div style={{ fontSize: 12, color: '#fff', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '10px 12px', lineHeight: 1.4 }}>
          Выбери слабые фазы (углы + биомеханика) + качание 3/5 см + скорость 15% + хват из 3 тестов → общий балл. Кнопка <b style={{ color: '#fff' }}>«Применить в Стронг-конструктор»</b> отправит данные с биомеханикой и контестом.
        </div>
        <details style={{ marginTop: 6, borderRadius: 14, background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <summary style={{ padding: '12px 14px', fontSize: 13, fontWeight: 800, color: '#fff', cursor: 'pointer', minHeight: 48, display: 'flex', alignItems: 'center', gap: 8 }}>📊 Детали расчёта — лимитеры, физика, симулятор, причины</summary>
          <div style={{ padding: '0 12px 12px', display: 'flex', flexDirection: 'column' }}>
        {limiterForPhase.length>0 && <div style={{ marginTop: 8, padding: '12px 14px', borderRadius: 14, background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.18)', fontSize: 12, color: '#a78bfa' }}>💡 Лимитеры для {SM_BIOMECH[smWeakPoints[0] as SMWeakPoint]?.label || smWeakPoints[0]}: {limiterForPhase.map(o => `${o.label} (${o.method.slice(0, 40)}…)`).join(' · ')}</div>}
        {(passportResult.errors.length>0 || passportResult.warnings.length>0) && <div style={{ marginTop: 8, padding: '12px 14px', borderRadius: 14, background: passportResult.errors.length?'rgba(239,68,68,0.08)':'rgba(245,158,11,0.08)', border: `1px solid ${passportResult.errors.length?'rgba(239,68,68,0.22)':'rgba(245,158,11,0.22)'}`, fontSize: 12, color: passportResult.errors.length?'#ef4444':'#f59e0b' }}>{passportResult.errors.length? `⛔ ${passportResult.errors.join(' · ')}` : `⚠ ${passportResult.warnings.join(' · ')}`}</div>}
        {enodeCorrected != null && swayCm != null && <div style={{ marginTop: 6, padding: '10px 14px', borderRadius: 14, background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.18)', fontSize: 12, color: '#fff' }}>Поправка Энода: {swayCm} см → {enodeCorrected} см · скорость йок {VBT_SS_THRESHOLDS.yoke_walk.optimalMin}/{VBT_SS_THRESHOLDS.yoke_walk.stopMin} · камень {VBT_SS_THRESHOLDS.atlas_stone_load.optimalMin}/{VBT_SS_THRESHOLDS.atlas_stone_load.stopMin} м/с</div>}
        <div style={{ marginTop: 6, padding: '10px 14px', borderRadius: 14, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', fontSize: 12, color: '#fff' }}>Осевая: {axialProgress.curM} м / {axialProgress.mrv} м (лимит {axialProgress.pct}%) · {axialQuant.text} · {axialQuant.recipe} · кондиция {state.conditioningFail? 'провалена — санки 10×30 м' : 'в норме — рывки 8×10 сек/50 сек'} · {swayDiag? `качание ${swayDiag.swayCm} см` : 'качание —'}</div>
        {carryPhys && <div style={{ marginTop: 8, padding: '10px 14px', borderRadius: 14, background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.18)', fontSize: 12, color: '#60a5fa' }}>🚜 Йок-физика (Legg/Hindle): {carryPhys.note}</div>}
        {stoneMom && <div style={{ marginTop: 8, padding: '10px 14px', borderRadius: 14, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.22)', fontSize: 12, color: '#f59e0b' }}>🪨 Камень-момент (Harris): {stoneMom.note}</div>}
        {contestSim && <div style={{ marginTop: 6, padding: '10px 14px', borderRadius: 14, background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.18)', fontSize: 12, color: '#fff' }}>🏆 Симулятор: {contestSim.predictedPlace} место из 10 · сумма {contestSim.totalPoints} очков · слабые {contestSim.weakEvents.join(', ') || '—'} · порядок {contestSim.recOrder.join(' → ')}</div>}
        {attemptsBridge && attemptsBridge.rationale.length > 1 && <div style={{ marginTop: 6, padding: '10px 14px', borderRadius: 14, background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.18)', fontSize: 12, color: '#fff' }}>🎯 Попытки: {attemptsBridge.rationale.slice(1, 4).join(' · ')}{attemptsBridge.medley ? ` · Медли (medley) ${attemptsBridge.medley.totalTimeS} сек / лимит ${attemptsBridge.medley.timeCapS} сек` : ''}</div>}
        {smCauses.length > 0 && <div style={{ marginTop: 8, padding: '10px 14px', borderRadius: 14, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', fontSize: 12, color: '#fff' }}>🧬 Причины: {smCauses.map((c) => `${c.zone}: ${SM_WEAK_CAUSE_LABELS[c.cause]} (${c.confidence})`).join(' · ')}</div>}
        {smRankTop.length > 0 && <div style={{ marginTop: 8, padding: '10px 14px', borderRadius: 14, background: 'rgba(94,234,212,0.08)', border: '1px solid rgba(94,234,212,0.18)', fontSize: 12, color: '#5ee' }}>⭐ Топ-коррекция: {smRankTop.map((c) => `${c.name} ${c.protocol.sets}×${c.protocol.reps} @${c.protocol.pct}%`).join(' · ')}</div>}
        {smSpec && <div style={{ marginTop: 6, padding: '10px 14px', borderRadius: 14, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.18)', fontSize: 12, color: '#fff' }}>📅 Спец-блок: {smSpec.weakPoints.join(', ')} × {smSpec.totalWeeks} нед · {smSpec.weeks[0]?.note || ''} · раскладка по дням ивента</div>}
        {bicepsWarn.length > 0 && <div style={{ marginTop: 8, padding: '10px 14px', borderRadius: 14, background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.25)', fontSize: 12, color: '#ef4444' }}>🦾 Безопасность: {bicepsWarn.join(' · ')}</div>}
        {holdDiag && <div style={{ marginTop: 6, padding: '10px 14px', borderRadius: 14, background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.18)', fontSize: 12, color: '#fff' }}>✊ Удержание: {holdDiag.verdict}</div>}
        {anthroDiag && <div style={{ marginTop: 8, padding: '10px 14px', borderRadius: 14, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', fontSize: 12, color: '#fff' }}>📏 Антро: {anthroDiag.loadAdvice} {anthroDiag.pickupAdvice}</div>}
        {logDipDiag && <div style={{ marginTop: 8, padding: '10px 14px', borderRadius: 14, background: logDipDiag.verdict === 'ok' ? 'rgba(34,197,94,0.08)' : 'rgba(245,158,11,0.08)', border: '1px solid rgba(255,255,255,0.06)', fontSize: 12, color: logDipDiag.verdict === 'ok' ? '#22c55e' : '#f59e0b' }}>📐 Лог-дип: {logDipDiag.text}{logDipDiag.drivePowerW != null ? ` · drive ~${logDipDiag.drivePowerW}Вт` : ''}</div>}
        {gripAsymDiag && gripAsymDiag.isAsym && <div style={{ marginTop: 6, padding: '10px 14px', borderRadius: 14, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.22)', fontSize: 12, color: '#fff' }}>⚖️ Асимметрия хвата: {gripAsymDiag.text}</div>}
          </div>
        </details>
        {toast && <div style={{ marginTop: 8, padding: '10px 14px', borderRadius: 14, background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.2)', color: '#22c55e', fontSize: 13 }}>{toast}</div>}
        <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
          <button onClick={handleExport} style={{ padding: '12px 16px', minHeight:48, borderRadius: 14, background: 'rgba(59,130,246,0.14)', border: '1px solid rgba(140,190,255,0.16)', color: '#60a5fa', fontSize: 13, fontWeight:700, cursor: 'pointer' }}>🖨 HTML</button>
          <button onClick={handleExportCsv} style={{ padding: '12px 16px', minHeight:48, borderRadius: 14, background: 'rgba(59,130,246,0.14)', border: '1px solid rgba(140,190,255,0.16)', color: '#60a5fa', fontSize: 13, fontWeight:700, cursor: 'pointer' }}>📥 CSV</button>
          <button onClick={applyMobilityToProfile} style={{ padding: '12px 16px', minHeight:48, borderRadius: 14, background: 'rgba(34,197,94,0.14)', border: '1px solid rgba(34,197,94,0.22)', color: '#22c55e', fontSize: 13, fontWeight:700, cursor: 'pointer' }}>→ Мобильность в профиль</button>
        </div>
      </div>

      <div style={{ ...CARD, padding: 10, position: 'sticky', top: 0, zIndex: 20, backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', boxShadow: '0 10px 28px rgba(0,0,0,0.45)' }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'nowrap', overflowX: 'auto', marginBottom: 8, alignItems: 'center', scrollbarWidth: 'none', paddingBottom: 2 }}>
          {TAB_DEFS.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)} aria-pressed={tab===t.id} style={{ padding:'11px 16px', minHeight:48, flexShrink:0, borderRadius:999, border:'1px solid', borderColor: tab===t.id ? '#ef4444' : 'rgba(140,190,255,0.16)', background: tab===t.id ? 'linear-gradient(135deg, rgba(239,68,68,0.22), rgba(245,158,11,0.12))' : 'rgba(22,30,52,0.88)', color: tab===t.id ? '#fff' : '#fff', cursor:'pointer', fontSize:14, fontWeight:800, boxShadow: tab===t.id ? '0 4px 16px rgba(239,68,68,0.25)' : 'none' }}>
              {t.icon} {t.label}
            </button>
          ))}
          <button onClick={applyToConstructor} style={{ marginLeft:'auto', flexShrink:0, padding:'13px 20px', minHeight:52, borderRadius:14, background:'linear-gradient(135deg,#ef4444,#f59e0b)', color:'#fff', border:'none', fontWeight:800, fontSize:14, cursor:'pointer', boxShadow:'0 6px 20px rgba(239,68,68,0.35), inset 0 1px 0 rgba(255,255,255,0.25)', whiteSpace:'nowrap' }}>→ Применить в Стронг</button>
        </div>

        {tab==='press' && (
          <div>
            <div style={{ fontSize:15, fontWeight:800, color:'#fff', marginBottom:6, paddingLeft:12, borderLeft:'3px solid #00e68a', lineHeight:1.35 }}>Жим — лог/аксель (4 фазы, дип 8-12 см)</div>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:6 }}>
              {PRESS_OPTS.map(o=>{ const on = state.pressWeak.includes(o.id); return (
                <button key={o.id} onClick={()=>toggle('pressWeak', o.id)} aria-pressed={on} style={{ flex:'1 1 160px', display:'flex', alignItems:'center', gap:10, padding:'12px 14px', minHeight:56, borderRadius:16, border:'1px solid', borderColor: on ? '#ef4444' : 'rgba(140,190,255,0.16)', background: on ? 'linear-gradient(135deg, rgba(239,68,68,0.20), rgba(245,158,11,0.10))' : 'rgba(22,30,52,0.88)', color:'#fff', fontSize:14, fontWeight: on?800:600, cursor:'pointer', textAlign:'left', boxShadow: on ? '0 0 16px rgba(239,68,68,0.35)' : 'none' }}>
                  <span style={{ width:22, height:22, borderRadius:11, border:'2px solid', borderColor: on ? '#ff6b6b' : 'rgba(255,255,255,0.30)', background: on ? '#ef4444' : 'transparent', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:800, color:'#fff', flexShrink:0 }}>{on ? '✓' : ''}</span>
                  <span>{o.label}</span>
                </button> );})}
            </div>
            {state.pressWeak.map(id=>{
              const bio = smBiomechForWeak(id);
              if (!bio) return null;
              return (
                <div key={id} style={{ padding:'12px 14px', borderRadius:14, background:'rgba(22,30,52,0.88)', border:'1px solid rgba(140,190,255,0.16)', borderLeft:'3px solid #ef4444', marginBottom:8 }}>
                  <div style={{ fontSize:14, fontWeight:800, color:'#fff' }}>{bio.label} <span style={{ color:'#fff', fontWeight:500 }}>· {bio.joint} {bio.angleRangeDeg[0]}-{bio.angleRangeDeg[1]}° · {bio.keyJoint}</span></div>
                  <div style={{ fontSize:12, color:'#fff' }}>{bio.weakMuscles.join(', ')} · {bio.references.join(', ')}</div>
                  <div style={{ fontSize:12, color:'#fff', marginTop:4, lineHeight:1.4 }}>{bio.biomechanicalReason}</div>
                  <div style={{ fontSize:13, color:'#5ee', marginTop:4 }}>{bio.corrections.join(' · ')} · {bio.loadCues}</div>
                </div>
              );
            })}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(150px, 1fr))', gap:6, marginTop:6 }}>
              <HubNum label="Лог" unit="кг" value={state.logKg} onChange={v=>setState(s=>({...s, logKg:v}))} placeholder="100" step={2.5} />
              <HubNum label="Аксель" unit="кг" value={state.axleKg} onChange={v=>setState(s=>({...s, axleKg:v}))} placeholder="120" step={2.5} />
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(150px, 1fr))', gap:6, marginTop:6 }}>
              <HubNum label="VBT лог — лучшая" unit="м/с" value={state.vbtLogBest} onChange={v=>setState(s=>({...s, vbtLogBest:v}))} placeholder="0.85" step={0.05} />
              <HubNum label="VBT лог — последняя" unit="м/с" value={state.vbtLogLast} onChange={v=>setState(s=>({...s, vbtLogLast:v}))} placeholder="0.65" step={0.05} />
            </div>
            <div style={{ fontSize:12, color:'#fff', marginTop:6 }}>Ивенты: {Object.keys(EVENT_META).slice(0,4).join(', ')} — {VBT_SS_THRESHOLDS.log_press ? `VBT log ${VBT_SS_THRESHOLDS.log_press.optimalMin}/${VBT_SS_THRESHOLDS.log_press.stopMin} м/с` : ''}</div>
            <details open style={{ marginTop:10, borderRadius:16, background:'rgba(22,30,52,0.88)', border:'1px solid rgba(140,190,255,0.16)' }}>
              <summary style={{ padding:'14px', fontSize:14, fontWeight:800, color:'#fff', cursor:'pointer', minHeight:52, display:'flex', alignItems:'center' }}>🏆 Контест пакет</summary>
              <div style={{ padding:'0 12px 12px', display:'flex', flexDirection:'column' }}>
              <div style={{ marginTop:6 }}><HubPopupSelect label="Контест" value={state.contestId} onChange={v=>setState(s=>({...s, contestId:v}))} options={[{ id:'', label:'Без контеста (база)', desc:'общий план' }, ...Object.entries(CONTEST_PRESETS as any).map(([id,c]:any)=> ({ id: String(id), label: String(c.name) }))]} /></div>
              <HubToggle checked={state.turnNeeded} onChange={v=>setState(s=>({...s, turnNeeded:v}))} label="Разворот 180° (йок/фермер)" style={{ marginTop:6 }} />
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(150px, 1fr))', gap:6, marginTop:6 }}>
                <HubNum label="Платформа" unit="см" value={state.platformHeightCm} onChange={v=>setState(s=>({...s, platformHeightCm:v}))} placeholder="140" step={5} />
                <HubToggle checked={state.tackyUsed} onChange={v=>setState(s=>({...s, tackyUsed:v}))} label="Смола липкая (tacky) есть" />
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(150px, 1fr))', gap:6, marginTop:6 }}>
                <HubNum label="Диаметр лога" unit="см" value={state.diameterCm} onChange={v=>setState(s=>({...s, diameterCm:v}))} placeholder="30" step={1} />
                <HubPopupSelect label="Покрытие" value={state.surface} onChange={v=>setState(s=>({...s, surface:v}))} options={[{ id:'', label:'Не выбрано' }, { id:'резина', label:'Резина' }, { id:'трава', label:'Трава' }, { id:'асфальт', label:'Асфальт' }, { id:'песок', label:'Песок' }]} />
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(140px, 1fr))', gap:6, marginTop:6 }}>
                <HubNum label="Дип 8–12" unit="см" value={state.logDipCm} onChange={v=>setState(s=>({...s, logDipCm:v}))} placeholder="10" step={1} />
                <HubNum label="Дип время" unit="мс" value={state.logDipMs} onChange={v=>setState(s=>({...s, logDipMs:v}))} placeholder="200" step={10} />
                <HubNum label="Вес тела" unit="кг" value={state.bodyweightKg} onChange={v=>setState(s=>({...s, bodyweightKg:v}))} placeholder="105" step={1} />
                <HubNum label="Тяга (аксель)" unit="кг" value={state.deadliftKg} onChange={v=>setState(s=>({...s, deadliftKg:v}))} placeholder="250" step={2.5} />
              </div>
              {logDipDiag && <div style={{ fontSize:12, color: logDipDiag.verdict === 'ok' ? '#22c55e' : '#f59e0b', marginTop:4 }}>{logDipDiag.text} (Renals braking/propulsion, Zhang dip 0.20с)</div>}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(150px, 1fr))', gap:6, marginTop:6 }}>
                <HubPopupSelect label="Стратегия попыток" value={state.strategy} onChange={v=>setState(s=>({...s, strategy:v}))} options={[{ id:'conservative', label:'Осторожная', desc:'85 / 92 / 98' }, { id:'balanced', label:'Сбалансированная', desc:'88 / 95 / 100' }, { id:'aggressive', label:'Агрессивная', desc:'90 / 97 / 102' }]} />
                <HubPopupSelect label="Хват тяги" value={state.mixGrip} onChange={v=>setState(s=>({...s, mixGrip:v}))} options={[{ id:'overhand', label:'Верхний / крюк' }, { id:'mixed', label:'Разнохват', desc:'риск бицепса' }, { id:'straps', label:'Лямки' }]} />
              </div>
              <HubToggle checked={state.armsBent} onChange={v=>setState(s=>({...s, armsBent:v}))} label="Руки согнуты на камне/шине (риск бицепса)" style={{ marginTop:6 }} />
              {attemptsBridge && attemptsBridge.rationale.length > 0 && <div style={{ fontSize:12, color:'#fff', marginTop:4 }}>{attemptsBridge.rationale.slice(0, 4).join(' · ')}</div>}
              <div style={{ marginTop:6 }}>
                <HubPopupSelect label="Формат ивента" value={state.eventFormat} onChange={v=>setState(s=>({...s, eventFormat:v as SMEventFormat}))} options={[{ id:'max', label:SM_EVENT_FORMAT_LABEL.max }, { id:'reps', label:SM_EVENT_FORMAT_LABEL.reps }, { id:'medley', label:SM_EVENT_FORMAT_LABEL.medley }, { id:'height', label:SM_EVENT_FORMAT_LABEL.height }]} />
              </div>
              {logDiamCls && (
                <div style={{ fontSize:12, color:'#fff', marginTop:4 }}>
                  {logDiameterNote(logDiamCm)}
                  {scaledLogAttempts && ` → лог: ${scaledLogAttempts.opener}/${scaledLogAttempts.second}/${scaledLogAttempts.third} кг`}
                  {logDiamCls === 'large' ? ' · большой лог тяжелее — снижай заявку' : logDiamCls === 'small' ? ' · малый лог быстрее — можно смелее' : ''}
                </div>
              )}
              {formatPlan && state.eventFormat !== 'max' && (
                <div style={{ fontSize:12, color:'#fff', marginTop:4 }}>📋 {formatPlan.lines.join(' · ')}</div>
              )}
              </div>
            </details>
          </div>
        )}

        {tab==='carry' && (
          <div>
            <div style={{ fontSize:15, fontWeight:800, color:'#fff', marginBottom:6, paddingLeft:12, borderLeft:'3px solid #00e68a', lineHeight:1.35 }}>Переноски — йок/фермер/рама (5 фаз, качание 3/5 см)</div>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:6 }}>
              {CARRY_OPTS.map(o=>{ const on = state.carryWeak.includes(o.id); return (
                <button key={o.id} onClick={()=>toggle('carryWeak', o.id)} aria-pressed={on} style={{ flex:'1 1 160px', display:'flex', alignItems:'center', gap:10, padding:'12px 14px', minHeight:56, borderRadius:16, border:'1px solid', borderColor: on ? '#f59e0b' : 'rgba(140,190,255,0.16)', background: on ? 'linear-gradient(135deg, rgba(245,158,11,0.20), rgba(239,68,68,0.08))' : 'rgba(22,30,52,0.88)', color:'#fff', fontSize:14, fontWeight: on?800:600, cursor:'pointer', textAlign:'left', boxShadow: on ? '0 0 16px rgba(245,158,11,0.35)' : 'none' }}>
                  <span style={{ width:22, height:22, borderRadius:11, border:'2px solid', borderColor: on ? '#ffb84d' : 'rgba(255,255,255,0.30)', background: on ? '#f59e0b' : 'transparent', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:800, color:'#fff', flexShrink:0 }}>{on ? '✓' : ''}</span>
                  <span>{o.label}</span>
                </button> );})}
            </div>
            {state.carryWeak.map(id=>{
              const bio = smBiomechForWeak(id);
              if (!bio) return null;
              return (
                <div key={id} style={{ padding:'12px 14px', borderRadius:14, background:'rgba(22,30,52,0.88)', border:'1px solid rgba(140,190,255,0.16)', borderLeft:'3px solid #f59e0b', marginBottom:8 }}>
                  <div style={{ fontSize:14, fontWeight:800, color:'#fff' }}>{bio.label} <span style={{ color:'#fff', fontWeight:500 }}>· {bio.angleRangeDeg.join('-')}°</span></div>
                  <div style={{ fontSize:12, color:'#fff', marginTop:4 }}>{bio.biomechanicalReason}</div>
                  <div style={{ fontSize:13, color:'#5ee' }}>{bio.corrections.join(' · ')}</div>
                </div>
              );
            })}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(150px, 1fr))', gap:6 }}>
              <HubNum label="Йок" unit="кг" value={state.yokeKg} onChange={v=>setState(s=>({...s, yokeKg:v}))} placeholder="300" step={5} />
              <HubNum label="Фермер (на руку)" unit="кг" value={state.farmersKg} onChange={v=>setState(s=>({...s, farmersKg:v}))} placeholder="120" step={2.5} />
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(140px, 1fr))', gap:6, marginTop:6 }}>
              <HubNum label="Качание (Sway)" unit="см" value={state.swayCm} onChange={v=>setState(s=>({...s, swayCm:v}))} placeholder="2.5" step={0.5} />
              <HubNum label="VBT йок — лучшая" unit="м/с" value={state.vbtYokeBest} onChange={v=>setState(s=>({...s, vbtYokeBest:v}))} placeholder="1.45" step={0.05} />
              <HubNum label="VBT йок — последняя" unit="м/с" value={state.vbtYokeLast} onChange={v=>setState(s=>({...s, vbtYokeLast:v}))} placeholder="1.20" step={0.05} />
            </div>
            {swayDiag && <div style={{ fontSize:12, color: '#fff', marginTop:4 }}>{swayDiag.text} · порог 3/5 см · скорость йок {VBT_SS_THRESHOLDS.yoke_walk.optimalMin}/{VBT_SS_THRESHOLDS.yoke_walk.stopMin} м/с</div>}
            {vbtLoss && <div style={{ fontSize:12, color: vbtLoss.exceeded?'#ef4444':'#22c55e', marginTop:4 }}>VBT потеря {vbtLoss.lossPct}% · {vbtLoss.zone} · {vbtLoss.recommendation} · порог 15% carry (MHV-декремент &gt;15% = стоп, PoinT GO)</div>}
            {carryPhys ? <div style={{ fontSize:12, color:'#fff', marginTop:4 }}>Физика: {carryPhys.note} · скорость 1.69 м/с, шаг 1.14 м, темп 1.62 Гц</div> : <div style={{ fontSize:12, color:'#fff', marginTop:4 }}>Физика йока: введи вес тела (вкладка Жим) + йок, кг → скорость/шаг/темп/оценка</div>}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(140px, 1fr))', gap:6, marginTop:6 }}>
              <HubNum label="Отрезок 0–5 м" unit="сек" value={state.carrySplit1S} onChange={v=>setState(s=>({...s, carrySplit1S:v}))} placeholder="4.0" step={0.5} />
              <HubNum label="Отрезок 5–15 м" unit="сек" value={state.carrySplit2S} onChange={v=>setState(s=>({...s, carrySplit2S:v}))} placeholder="7.0" step={0.5} />
              <HubNum label="Отрезок 15–20 м" unit="сек" value={state.carrySplit3S} onChange={v=>setState(s=>({...s, carrySplit3S:v}))} placeholder="4.5" step={0.5} />
            </div>
            {carrySplitDiag && <div style={{ fontSize:12, color:'#fff', marginTop:4 }}>⏱ {carrySplitDiag.lines.join(' · ')}</div>}
            <div style={{ marginTop:6, padding:'10px 12px', borderRadius:14, background:'rgba(22,30,52,0.88)', border:'1px dashed rgba(140,190,255,0.16)', textAlign:'center' }}>
              <div style={{ fontSize:13, color:'#fff' }}>📹 Видео переноски — качание из Кинова (Kinovea)</div>
              <div style={{ fontSize:12, color:'#fff', marginTop:4 }}>Сними сбоку 30 кадров/с → таблица Кинова (CSV) → вкладка Видео → качание само</div>
            </div>
          </div>
        )}

        {tab==='load' && (
          <div>
            <div style={{ fontSize:15, fontWeight:800, color:'#fff', marginBottom:6, paddingLeft:12, borderLeft:'3px solid #00e68a', lineHeight:1.35 }}>Загрузки — камни/мешок/кега (передняя нагрузка, высокие бёдра)</div>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:6 }}>
              {LOAD_OPTS.map(o=>{ const on = state.loadWeak.includes(o.id); return (
                <button key={o.id} onClick={()=>toggle('loadWeak', o.id)} aria-pressed={on} style={{ flex:'1 1 160px', display:'flex', alignItems:'center', gap:10, padding:'12px 14px', minHeight:56, borderRadius:16, border:'1px solid', borderColor: on ? '#22c55e' : 'rgba(140,190,255,0.16)', background: on ? 'linear-gradient(135deg, rgba(34,197,94,0.20), rgba(34,197,94,0.06))' : 'rgba(22,30,52,0.88)', color:'#fff', fontSize:14, fontWeight: on?800:600, cursor:'pointer', textAlign:'left', boxShadow: on ? '0 0 16px rgba(34,197,94,0.35)' : 'none' }}>
                  <span style={{ width:22, height:22, borderRadius:11, border:'2px solid', borderColor: on ? '#4ade80' : 'rgba(255,255,255,0.30)', background: on ? '#22c55e' : 'transparent', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:800, color:'#fff', flexShrink:0 }}>{on ? '✓' : ''}</span>
                  <span>{o.label}</span>
                </button> );})}
            </div>
            {state.loadWeak.map(id=>{
              const bio = smBiomechForWeak(id);
              if (!bio) return null;
              return (
                <div key={id} style={{ padding:'12px 14px', borderRadius:14, background:'rgba(22,30,52,0.88)', border:'1px solid rgba(140,190,255,0.16)', borderLeft:'3px solid #22c55e', marginBottom:8 }}>
                  <div style={{ fontSize:14, fontWeight:800, color:'#fff' }}>{bio.label}</div>
                  <div style={{ fontSize:12, color:'#fff', marginTop:4 }}>{bio.biomechanicalReason}</div>
                  <div style={{ fontSize:13, color:'#5ee' }}>{bio.corrections.join(' · ')} · {bio.loadCues}</div>
                </div>
              );
            })}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(150px, 1fr))', gap:6 }}>
              <HubNum label="Камень" unit="кг" value={state.stoneKg} onChange={v=>setState(s=>({...s, stoneKg:v}))} placeholder="140" step={2.5} />
              <HubNum label="Качание камня (Sway)" unit="см" value={state.swayCm} onChange={v=>setState(s=>({...s, swayCm:v}))} placeholder="2.0" step={0.5} />
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(150px, 1fr))', gap:6, marginTop:6 }}>
              <HubNum label="VBT камень — лучшая" unit="м/с" value={state.vbtStoneBest} onChange={v=>setState(s=>({...s, vbtStoneBest:v}))} placeholder="0.75" step={0.05} />
              <HubNum label="VBT камень — последняя" unit="м/с" value={state.vbtStoneLast} onChange={v=>setState(s=>({...s, vbtStoneLast:v}))} placeholder="0.55" step={0.05} />
            </div>
            <div style={{ fontSize:12, color:'#fff', marginTop:6 }}>Контест пресеты: {Object.values(CONTEST_PRESETS as any).slice(0,3).map((c:any)=>c.name).join(', ')} · stone VBT {VBT_SS_THRESHOLDS.atlas_stone_load.optimalMin}/{VBT_SS_THRESHOLDS.atlas_stone_load.stopMin} м/с · платформа {state.platformHeightCm || '—'}см</div>
            <div style={{ fontSize:12, color: '#fff', marginTop:4 }}>{state.tackyUsed ? '✓ Смола (tacky) учтена — руки не сгибать' : '⚠ Без смолы — риск сгибания рук + разрыв бицепса'}</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(140px, 1fr))', gap:6, marginTop:6 }}>
              <HubNum label="Рабочий % от макса" unit="%" value={state.workPct} onChange={v=>setState(s=>({...s, workPct:v}))} placeholder="90" step={1} />
              <HubNum label="Камень 1-я тяга" unit="сек" value={state.stonePull1S} onChange={v=>setState(s=>({...s, stonePull1S:v}))} placeholder="2.5" step={0.5} />
              <HubNum label="Камень колени" unit="сек" value={state.stoneLapS} onChange={v=>setState(s=>({...s, stoneLapS:v}))} placeholder="1.5" step={0.5} />
              <HubNum label="Камень 2-я тяга" unit="сек" value={state.stonePull2S} onChange={v=>setState(s=>({...s, stonePull2S:v}))} placeholder="2.5" step={0.5} />
            </div>
            {stonePhase && <div style={{ fontSize:12, color:'#fff', marginTop:4 }}>⏱ {stonePhase.lines.join(' · ')}</div>}
          </div>
        )}

        {tab==='grip' && (
          <div>
            <div style={{ fontSize:15, fontWeight:800, color:'#fff', marginBottom:6, paddingLeft:12, borderLeft:'3px solid #00e68a', lineHeight:1.35 }}>Хват / Кор / Кондиция (3 теста + осевая нагрузка)</div>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:6 }}>
              {GRIP_OPTS.map(o=>{ const on = state.gripWeak.includes(o.id); return (
                <button key={o.id} onClick={()=>toggle('gripWeak', o.id)} aria-pressed={on} style={{ flex:'1 1 160px', display:'flex', alignItems:'center', gap:10, padding:'12px 14px', minHeight:56, borderRadius:16, border:'1px solid', borderColor: on ? '#a855f7' : 'rgba(140,190,255,0.16)', background: on ? 'linear-gradient(135deg, rgba(168,85,247,0.20), rgba(168,85,247,0.06))' : 'rgba(22,30,52,0.88)', color:'#fff', fontSize:14, fontWeight: on?800:600, cursor:'pointer', textAlign:'left', boxShadow: on ? '0 0 16px rgba(168,85,247,0.35)' : 'none' }}>
                  <span style={{ width:22, height:22, borderRadius:11, border:'2px solid', borderColor: on ? '#c084fc' : 'rgba(255,255,255,0.30)', background: on ? '#a855f7' : 'transparent', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:800, color:'#fff', flexShrink:0 }}>{on ? '✓' : ''}</span>
                  <span>{o.label}</span>
                </button> );})}
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(140px, 1fr))', gap:6 }}>
              <HubNum label="Опора · Support (фермер)" unit="сек" value={state.gripHoldSec} onChange={v=>setState(s=>({...s, gripHoldSec:v}))} placeholder="60" step={5} />
              <HubNum label="Щипок · Pinch" unit="сек" value={state.pinchHoldSec} onChange={v=>setState(s=>({...s, pinchHoldSec:v}))} placeholder="20" step={1} />
              <HubNum label="Сдавливание · Crush (аксель)" unit="сек" value={state.axleHoldSec} onChange={v=>setState(s=>({...s, axleHoldSec:v}))} placeholder="30" step={1} />
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(150px, 1fr))', gap:6, marginTop:6 }}>
              <HubNum label="Планка" unit="сек" value={state.corePlankSec} onChange={v=>setState(s=>({...s, corePlankSec:v}))} placeholder="120" step={5} />
              <HubToggle checked={state.conditioningFail} onChange={v=>setState(s=>({...s, conditioningFail:v}))} label="Кондиция провалена (медли дольше 60 сек)" />
            </div>
            <div style={{ fontSize:12, color: '#fff', marginTop:4 }}>Хват: провалы {gripFails}/3 (калибровка {gripFailsCal}/3) {gripFails>=2?'— профилактика: молот 3×12 + щипок 2×15': '— норма'} · осевая {axialOverload?'перегруз — чемодан 2×20 м': 'в норме'} · {axialQuant.text}</div>
            <div style={{ fontSize:12, color:'#fff', marginTop:6 }}>Нагрузка (ACWR) {acwr? `${acwr.ratio.toFixed(2)}` : '—'} · кондиция: рывки 8×10 сек/50 сек</div>
            {(() => {
              const sess = smCondSessionFor({ conditioningFail: state.conditioningFail || state.gripWeak.includes('conditioning'), mhvDecrementPct: vbtLoss?.lossPct ?? null });
              return (
                <div style={{ marginTop:8, padding:'12px 14px', borderRadius:14, background:'rgba(59,130,246,0.08)', border:'1px solid rgba(59,130,246,0.18)' }}>
                  <div style={{ fontSize:14, fontWeight:800, color:'#60a5fa' }}>Кондиция → {sess.modality}</div>
                  <div style={{ fontSize:12, color:'#fff', marginTop:2 }}>{sess.sets}× {sess.work} / отдых {sess.rest} · {sess.hrZone} · {sess.note}</div>
                  <div style={{ fontSize:12, color:'#fff', marginTop:4 }}>Все системы: {allSMCondSessions().map((s) => `${s.goal} ${s.sets}×${s.work}`).join(' · ')}</div>
                </div>
              );
            })()}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(140px, 1fr))', gap:6, marginTop:6 }}>
              <HubPopupSelect label="Щипковый блок · Pinch" value={state.pinchWidth} onChange={v=>setState(s=>({...s, pinchWidth:v}))} options={[{ id:'2in', label:'2″', desc:'норма 30 сек' }, { id:'3in', label:'3″', desc:'норма 20 сек' }, { id:'4in', label:'4″', desc:'норма 15 сек' }]} />
              <HubPopupSelect label="Кистевой эспандер · CoC" value={state.cocLevel} onChange={v=>setState(s=>({...s, cocLevel:v}))} options={[{ id:'coc1', label:'CoC 1', desc:'норма 20 сек' }, { id:'coc1_5', label:'CoC 1.5', desc:'норма 30 сек' }, { id:'coc2', label:'CoC 2', desc:'норма 40 сек' }]} />
              <HubPopupSelect label="Толстый гриф · FatGrip, мм" value={state.fatGripMm} onChange={v=>setState(s=>({...s, fatGripMm:v}))} options={[{ id:'38', label:'38', desc:'стандарт' }, { id:'50', label:'50', desc:'аксель' }, { id:'60', label:'60', desc:'толстый' }]} />
            </div>
            <div style={{ display:'flex', gap:6, marginTop:6 }}>
              <button onClick={handleSaveGripProfile} style={{ padding:'13px 20px', minHeight:52, borderRadius:14, background:'linear-gradient(135deg,#a855f7,#6366f1)', border:'none', color:'#fff', fontSize:14, fontWeight:800, cursor:'pointer', boxShadow:'0 6px 20px rgba(168,85,247,0.35), inset 0 1px 0 rgba(255,255,255,0.25)' }}>💾 Профиль хвата</button>
              <span style={{ fontSize:12, color:'#fff', alignSelf:'center' }}>Опора/щипок/сдавливание — раздельно</span>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(140px, 1fr))', gap:6, marginTop:6 }}>
              <HubNum label="Удержание лога" unit="сек" value={state.logHoldSec} onChange={v=>setState(s=>({...s, logHoldSec:v}))} placeholder="10" step={1} />
              <HubNum label="Удержание фермера" unit="сек" value={state.farmersHoldSec} onChange={v=>setState(s=>({...s, farmersHoldSec:v}))} placeholder="60" step={5} />
              <HubNum label="Аксель верхним хватом" unit="кг" value={state.axleDohKg} onChange={v=>setState(s=>({...s, axleDohKg:v}))} placeholder="140" step={2.5} />
            </div>
            {holdDiag && <div style={{ fontSize:12, color: '#fff', marginTop:4 }}>{holdDiag.verdict} · {holdDiag.details.join(' · ')}</div>}
            <HubToggle checked={state.bicepsHistory} onChange={v=>setState(s=>({...s, bicepsHistory:v}))} label="Травма бицепса в прошлом" style={{ marginTop:6 }} />
            <div style={{ fontSize:12, color:'#fff', marginTop:4 }}>
              🦾 Риск бицепса {bicepsRisk.score}/100 ({bicepsRisk.level === 'high' ? 'высокий' : bicepsRisk.level === 'moderate' ? 'умеренный' : 'низкий'})
              {bicepsRisk.gate ? ' · ГЕЙТ: только лямки/нейтраль' : ''} · {bicepsRisk.lines.slice(-1)[0]}
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(140px, 1fr))', gap:6, marginTop:6 }}>
              <HubNum label="Геркулес удержание" unit="сек" value={state.herculesSec} onChange={v=>setState(s=>({...s, herculesSec:v}))} placeholder="40" step={5} />
              <HubNum label="Геркулес вес" unit="кг/рука" value={state.herculesKg} onChange={v=>setState(s=>({...s, herculesKg:v}))} placeholder="160" step={5} />
              <HubNum label="Падения в медли" unit="шт" value={state.medleyDrops} onChange={v=>setState(s=>({...s, medleyDrops:v}))} placeholder="0" step={1} />
            </div>
            {holdEventDiag && <div style={{ fontSize:12, color:'#fff', marginTop:4 }}>🏛 {holdEventDiag.lines.join(' · ')}</div>}
            {weakPoints.map(id=>{
              const bio = smBiomechForWeak(id);
              if (!bio || !['grip_support','core_brace','conditioning','farmers_grip'].includes(bio.weakPoint)) return null;
              return <div key={id} style={{ padding:'12px 14px', borderRadius:14, background:'rgba(22,30,52,0.88)', border:'1px solid rgba(140,190,255,0.16)', borderLeft:'3px solid #a855f7', marginTop:8 }}><div style={{ fontSize:14, fontWeight:800, color:'#fff' }}>{bio.label}</div><div style={{ fontSize:12, color:'#fff' }}>{bio.biomechanicalReason}</div><div style={{ fontSize:13, color:'#5ee' }}>{bio.corrections.join(' · ')}</div></div>;
            })}
          </div>
        )}

        {tab==='mobility' && (
          <div>
            <div style={{ fontSize:15, fontWeight:800, color:'#fff', marginBottom:6, paddingLeft:12, borderLeft:'3px solid #00e68a', lineHeight:1.35 }}>Подвижность — присед над головой (OHS) 6 + асимметрия + качание</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(150px, 1fr))', gap:6, marginBottom:8 }}>
                            <HubToggle checked={state.ohsHeelsFlat} onChange={v=>setState(s=>({...s, ohsHeelsFlat:v}))} label="Пятки плоско" />
              <HubToggle checked={!state.ohsKneeValgus} onChange={v=>setState(s=>({...s, ohsKneeValgus:!v}))} label="Колени без вальгуса" />
              <HubToggle checked={state.ohsHipBelowParallel} onChange={v=>setState(s=>({...s, ohsHipBelowParallel:v}))} label="Таз ниже параллели" />
              <HubToggle checked={state.ohsTrunkUpright} onChange={v=>setState(s=>({...s, ohsTrunkUpright:v}))} label="Корпус вертикально" />
              <HubToggle checked={state.ohsArmsOverMidfoot} onChange={v=>setState(s=>({...s, ohsArmsOverMidfoot:v}))} label="Руки над стопой" />
              <HubToggle checked={state.ohsLumbarNeutral} onChange={v=>setState(s=>({...s, ohsLumbarNeutral:v}))} label="Нейтраль поясницы" />
            </div>
            <div style={{ padding:'12px 14px', borderRadius:14, background: ohs.level==='ok'?'rgba(34,197,94,0.08)': ohs.level==='warn'?'rgba(245,158,11,0.08)':'rgba(239,68,68,0.08)', border:`1px solid ${ohs.level==='ok'?'rgba(34,197,94,0.18)': ohs.level==='warn'?'rgba(245,158,11,0.18)':'rgba(239,68,68,0.18)'}`, marginBottom:8 }}>
              <div style={{ fontSize:14, fontWeight:800, color: ohs.level==='ok'?'#22c55e': ohs.level==='warn'?'#f59e0b':'#ef4444' }}>Присед над головой (OHS) {ohs.totalScore}/6 {ohs.level==='ok'?'ОК':ohs.level==='warn'?'ВНИМАНИЕ':'КРИТ'} · провалы {ohs.failed} {ohs.primaryDriver? `· причина ${ohs.primaryDriver}`:''}</div>
              <div style={{ fontSize:12, color:'#fff', marginTop:4 }}>{ohs.recommendation} {ohs.needsPhysio?'· нужен врач':''}</div>
              <div style={{ fontSize:12, color:'#fff', marginTop:4 }}>Нормы колено-стена (Knee-to-wall) ≥{OHS_NORMS.kneeToWallCm.optimal} см (порог {OHS_NORMS.kneeToWallCm.cutoff}), голеностоп {OHS_NORMS.ankleDeg.range}</div>
              <div style={{ display:'flex', gap:6, marginTop:6, alignItems:'center' }}>
                <button onClick={handleSaveOHSSnap} style={{ padding:'13px 20px', minHeight:52, borderRadius:14, background:'linear-gradient(135deg,#16a34a,#30d158)', border:'none', color:'#fff', fontSize:14, fontWeight:800, cursor:'pointer', boxShadow:'0 6px 20px rgba(34,197,94,0.35), inset 0 1px 0 rgba(255,255,255,0.25)' }}>📸 Снапшот приседа (OHS)</button>
                <span style={{ fontSize:12, color:'#fff' }}>{smOhsTrend && smOhsTrend.n >= 2 ? `тренд ${smOhsTrend.delta >= 0 ? '+' : ''}${smOhsTrend.delta} за ${smOhsTrend.n} зам.` : `история ${smOhsHist.length}/10`}</span>
              </div>
              <div style={{ fontSize:12, color:'#fff', marginTop:4 }}>⚖️ Пол атлета: {athleteSexLabel(athleteSex)}{athleteSex ? ' — нормы камня/йока по полу' : ' — укажи пол во вкладке Видео или в профиле'}</div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(150px, 1fr))', gap:6, marginBottom:6 }}>
              <HubNum label="Колено-стена (Knee-to-wall)" unit="см" value={state.kneeToWallCm} onChange={v=>setState(s=>({...s, kneeToWallCm:v}))} placeholder="12" step={1} />
              <HubNum label="Голеностоп" unit="°" value={state.ankleDeg} onChange={v=>setState(s=>({...s, ankleDeg:v}))} placeholder="35" step={1} />
            </div>
            <div style={{ display:'flex', gap:6, marginBottom:6, alignItems:'center', flexWrap:'wrap' }}>
              <span style={{ fontSize:13, color:'#fff' }}>Подъём пятки 2.5 см (heel-raise)</span>
              <button onClick={()=>setState(s=>({...s, heelRetest:'better'}))} aria-pressed={state.heelRetest==='better'} style={{ padding:'10px 16px', minHeight:44, borderRadius:999, border:'1px solid', borderColor: state.heelRetest==='better'?'#22c55e':'rgba(140,190,255,0.16)', background: state.heelRetest==='better'?'rgba(34,197,94,0.14)':'rgba(22,30,52,0.88)', color: '#fff', fontSize:13, fontWeight:700 }}>Лучше</button>
              <button onClick={()=>setState(s=>({...s, heelRetest:'same'}))} aria-pressed={state.heelRetest==='same'} style={{ padding:'10px 16px', minHeight:44, borderRadius:999, border:'1px solid', borderColor: state.heelRetest==='same'?'#f59e0b':'rgba(140,190,255,0.16)', background: state.heelRetest==='same'?'rgba(245,158,11,0.14)':'rgba(22,30,52,0.88)', color: '#fff', fontSize:13, fontWeight:700 }}>Без изм</button>
              <button onClick={()=>setState(s=>({...s, heelRetest:''}))} aria-label="Сбросить тест пятки" style={{ padding:'10px 16px', minHeight:44, borderRadius:999, border:'1px solid rgba(140,190,255,0.16)', background:'rgba(22,30,52,0.88)', color:'#fff', fontSize:13, fontWeight:700 }}>Сброс</button>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(150px, 1fr))', gap:6 }}>
              <HubNum label="Левая макс" unit="кг" value={state.leftMax} onChange={v=>setState(s=>({...s, leftMax:v}))} placeholder="100" step={2.5} />
              <HubNum label="Правая макс" unit="кг" value={state.rightMax} onChange={v=>setState(s=>({...s, rightMax:v}))} placeholder="102" step={2.5} />
            </div>
            {asymmetry && (
              <div style={{ marginTop:8, padding:'12px 14px', borderRadius:14, background: asymmetry.isCrit?'rgba(239,68,68,0.08)': asymmetry.isAsym?'rgba(245,158,11,0.08)':'rgba(34,197,94,0.08)', border:`1px solid ${asymmetry.isCrit?'rgba(239,68,68,0.2)': asymmetry.isAsym?'rgba(245,158,11,0.2)':'rgba(34,197,94,0.2)'}` }}>
                <div style={{ fontSize:14, fontWeight:800, color: asymmetry.isCrit?'#ef4444': asymmetry.isAsym?'#f59e0b':'#22c55e' }}>Асимметрия {asymmetry.diff}% {asymmetry.isCrit?'КРИТ ≥12%': asymmetry.isAsym?'ВНИМАНИЕ ≥7%':'— норма <7%'} {asymmetry.isAsym? `→ слабее ${asymmetry.weaker === 'left' ? 'слева' : 'справа'}`:''}</div>
                <div style={{ fontSize:12, color:'#fff' }}>Пороги 7/12% — предиктор distal biceps tear (Heazlewood). {gripAsymDiag ? gripAsymDiag.text : ''}</div>
                <button onClick={handleSaveGripSnap} style={{ marginTop:8, padding:'13px 20px', minHeight:52, borderRadius:14, background:'linear-gradient(135deg,#f59e0b,#ef4444)', border:'none', color:'#fff', fontSize:14, fontWeight:800, cursor:'pointer', boxShadow:'0 6px 20px rgba(245,158,11,0.35), inset 0 1px 0 rgba(255,255,255,0.25)' }}>📸 Снапшот хвата (лев/прав)</button>
              </div>
            )}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(150px, 1fr))', gap:6, marginTop:6 }}>
              <HubNum label="Рост (антро)" unit="см" value={state.anthroHeight} onChange={v=>setState(s=>({...s, anthroHeight:v}))} placeholder="182" step={1} />
              <HubNum label="Размах рук" unit="см" value={state.anthroArmSpan} onChange={v=>setState(s=>({...s, anthroArmSpan:v}))} placeholder="186" step={1} />
            </div>
            {anthroDiag && <div style={{ fontSize:12, color:'#fff', marginTop:4 }}>{anthroDiag.loadAdvice} {anthroDiag.pickupAdvice} (tacky ≈{anthroDiag.tackyHeightCm}см)</div>}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(150px, 1fr))', gap:6, marginTop:6 }}>
              <HubNum label="Качание боковое (Sway)" unit="см" value={state.swayCm} onChange={v=>setState(s=>({...s, swayCm:v}))} placeholder="2.5" step={0.5} />
              <HubToggle checked={state.tackyUsed} onChange={v=>setState(s=>({...s, tackyUsed:v}))} label="Смола липкая (tacky)" />
            </div>
            {swayDiag && <div style={{ fontSize:12, color: '#fff', marginTop:4 }}>{swayDiag.text} · снимай видео сбоку 30 кадров/с</div>}
          </div>
        )}

        {tab==='video' && (
          <div>
            <div style={{ fontSize:15, fontWeight:800, color:'#fff', marginBottom:6, paddingLeft:12, borderLeft:'3px solid #00e68a', lineHeight:1.35 }}>Видео — Кинова (Kinovea): качание (Sway) + скорость переноски (VBT)</div>
            <div style={{ fontSize:12, color:'#fff', marginBottom:6 }}>Полевая методика: телефон сбоку 30 кадров/с → Кинова (Kinovea, бесплатно) → трек центра масс/йока → петля по горизонтали = качание. Скорость переноски: скорость ходьбы, м/с.</div>
            <textarea value={csvText} onChange={e=>setCsvText(e.target.value)} placeholder="Вставь файл Кинова (Kinovea CSV): время,x,y или t,x,y; x,y в см (качание = петля)" style={{ width:'100%', height:64, background:'rgba(22,30,52,0.88)', color:'#fff', border:'1px solid rgba(140,190,255,0.16)', borderRadius:14, padding:'12px 16px', fontSize:13, fontFamily:'monospace' }} />
            <div style={{ display:'flex', gap:6, marginTop:6, flexWrap:'wrap' }}>
              <button onClick={handleCsvParse} style={{ padding:'13px 20px', minHeight:52, borderRadius:14, background:'linear-gradient(135deg,#0a84ff,#30d158)', border:'none', color:'#fff', fontSize:14, fontWeight:800, cursor:'pointer', boxShadow:'0 6px 20px rgba(10,132,255,0.35), inset 0 1px 0 rgba(255,255,255,0.25)' }}>📊 Разобрать Kinovea CSV → Sway (качание)</button>
              <span style={{ fontSize:12, color:'#fff', alignSelf:'center' }}>Или введи качание/скорость вручную</span>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(140px, 1fr))', gap:6, marginTop:6 }}>
              <HubNum label="Качание (Sway)" unit="см" value={state.swayCm} onChange={v=>setState(s=>({...s, swayCm:v}))} placeholder="3.2" step={0.5} />
              <HubNum label="Высота подъёма (yMax)" unit="см" value={state.stoneKg} onChange={v=>setState(s=>({...s, stoneKg:v}))} placeholder="85" step={5} />
              <HubNum label="VBT йок — скорость" unit="м/с" value={state.vbtYokeLast} onChange={v=>setState(s=>({...s, vbtYokeLast:v}))} placeholder="1.25" step={0.05} />
            </div>
            {swayDiag && <div style={{ marginTop:6, padding:'12px 14px', borderRadius:14, background: swayDiag.severity==='critical'?'rgba(239,68,68,0.08)': swayDiag.severity==='warn'?'rgba(245,158,11,0.08)':'rgba(34,197,94,0.08)', border:`1px solid ${swayDiag.severity==='ok'?'rgba(34,197,94,0.2)': swayDiag.severity==='warn'?'rgba(245,158,11,0.2)':'rgba(239,68,68,0.2)'}` }}><div style={{ fontSize:14, fontWeight:800, color: swayDiag.severity==='ok'?'#22c55e': swayDiag.severity==='warn'?'#f59e0b':'#ef4444' }}>{swayDiag.text}</div><div style={{ fontSize:12, color:'#fff' }}>Порог качания 3/5 см — {swayDiag.isReal?'реально выше порога':'в пределах шума'}</div></div>}
            {vbtLoss && <div style={{ marginTop:6, padding:'12px 14px', borderRadius:14, background: vbtLoss.exceeded?'rgba(239,68,68,0.08)':'rgba(34,197,94,0.08)', border:`1px solid ${vbtLoss.exceeded?'rgba(239,68,68,0.2)':'rgba(34,197,94,0.2)'}` }}><div style={{ fontSize:14, fontWeight:800, color: vbtLoss.exceeded?'#ef4444':'#22c55e' }}>VBT потеря {vbtLoss.lossPct}% · {vbtLoss.zone} · {vbtLoss.recommendation}</div><div style={{ fontSize:12, color:'#fff' }}>Порог carry 15% (Hindle stride 1.83м) vs TA 10% — VBT yoke {VBT_SS_THRESHOLDS.yoke_walk.optimalMin}/{VBT_SS_THRESHOLDS.yoke_walk.stopMin} м/с</div></div>}
            <div style={{ marginTop:6, padding:'12px 12px', borderRadius:14, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)', fontSize:12, color:'#fff' }}>VBT зоны: yoke {VBT_SS_THRESHOLDS.yoke_walk.optimalMin}-{VBT_SS_THRESHOLDS.yoke_walk.stopMin} · farmers {VBT_SS_THRESHOLDS.farmers_walk_heavy.optimalMin}/{VBT_SS_THRESHOLDS.farmers_walk_heavy.stopMin} · stone {VBT_SS_THRESHOLDS.atlas_stone_load.optimalMin}/{VBT_SS_THRESHOLDS.atlas_stone_load.stopMin} · log {VBT_SS_THRESHOLDS.log_press.optimalMin}/{VBT_SS_THRESHOLDS.log_press.stopMin} м/с</div>
            <div style={{ marginTop:6, display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(160px, 1fr))', gap:6 }}>
              <div style={{ padding:'12px 12px', borderRadius:14, background: swayCm!=null ? 'rgba(59,130,246,0.08)' : 'rgba(255,255,255,0.04)', border:'1px solid rgba(59,130,246,0.18)', fontSize:12, color:'#fff' }}>Поправка Энода (Enode): было {swayCm ?? '—'} см → стало {enodeCorrected ?? '—'} см<br/><span style={{ fontSize:10, color:'#fff' }}>{swayCm ?? 0} ×1.08 −0.45 = {enodeCorrected ?? 0}</span></div>
              <div style={{ padding:'12px 12px', borderRadius:14, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)', fontSize:12, color:'#fff' }}>Сетка: yoke 1.30/1.00<br/>farmers 1.40/1.10<br/>stone 0.45/0.30<br/>log 0.32/0.20 м/с — стоп при &lt;stopMin</div>
            </div>
            <div style={{ marginTop:6, padding:'12px 12px', borderRadius:14, background:'rgba(168,85,247,0.08)', border:'1px solid rgba(168,85,247,0.18)', fontSize:12, color:'#fff' }}>Поз-трекинг (заглушка BlazePose): таз {mockPose.angles.hip}° колено {mockPose.angles.knee}° голеностоп {mockPose.angles.ankle}° плечо {mockPose.angles.shoulder}° — {mockPose.status.faults.join(' · ') || 'ОК (заглушка)'}</div>
            {carryPath && <div style={{ marginTop:6, padding:'12px 14px', borderRadius:14, background: carryPath.verdict === 'ok' ? 'rgba(34,197,94,0.08)' : carryPath.verdict === 'warn' ? 'rgba(245,158,11,0.08)' : 'rgba(239,68,68,0.08)', border:'1px solid rgba(255,255,255,0.06)' }}><div style={{ fontSize:14, fontWeight:800, color: carryPath.verdict === 'ok' ? '#22c55e' : carryPath.verdict === 'warn' ? '#f59e0b' : '#ef4444' }}>Траектория переноски: {carryPath.type} · {carryPath.verdict.toUpperCase()}</div><div style={{ fontSize:12, color:'#fff', marginTop:2 }}>{carryPath.lines.join(' · ')}</div></div>}
            <details style={{ marginTop:10, borderRadius:16, background:'rgba(22,30,52,0.88)', border:'1px solid rgba(140,190,255,0.16)' }}>
              <summary style={{ padding:'12px 14px', fontSize:14, fontWeight:800, color:'#fff', cursor:'pointer', minHeight:48, display:'flex', alignItems:'center' }}>🦿 Углы суставов с видео (нормы)</summary>
              <div style={{ padding:'0 12px 12px', display:'flex', flexDirection:'column' }}>
              <div style={{ fontSize:12, color:'#fff', marginTop:2 }}>Трекер поз → выгрузка таблицы (время,таз,колено,голеностоп,плечо) → вставь ниже. Йок: таз 30–46° / колено 43–65°; лог: плечо ≥150°.</div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(140px, 1fr))', gap:6, marginTop:6 }}>
                <HubPopupSelect label="Снаряд (углы)" value={state.poseLift} onChange={v=>setState(s=>({...s, poseLift:v}))} options={[{ id:'yoke_walk', label:'Йок (Yoke)' }, { id:'farmers_walk', label:'Фермер (Farmers)' }, { id:'log_press', label:'Лог (Log)' }]} />
                <HubPopupSelect label="Пол" value={state.poseSex} onChange={v=>setState(s=>({...s, poseSex:v as '' | 'male' | 'female'}))} options={[{ id:'', label:'Не указан' }, { id:'male', label:'Мужской' }, { id:'female', label:'Женский' }]} />
                <div style={{ display:'flex', alignItems:'flex-end', gap:6, flexWrap:'wrap' }}>
                  <button onClick={handlePoseParse} style={{ padding:'13px 20px', minHeight:52, borderRadius:14, background:'linear-gradient(135deg,#a855f7,#6366f1)', border:'none', color:'#fff', fontSize:14, fontWeight:800, cursor:'pointer', boxShadow:'0 6px 20px rgba(168,85,247,0.35), inset 0 1px 0 rgba(255,255,255,0.25)' }}>🦿 Разобрать углы</button>
                  <button onClick={handleAutoAngles} style={{ padding:'13px 20px', minHeight:52, borderRadius:14, background:'rgba(255,255,255,0.045)', border:'1px solid rgba(255,255,255,0.09)', color:'#fff', fontSize:14, fontWeight:800, cursor:'pointer' }}>📐 Авто-углы (ROM)</button>
                </div>
              </div>
              <textarea value={state.poseCsv} onChange={e=>setState(s=>({...s, poseCsv:e.target.value}))} placeholder={'время,таз,колено,голеностоп,плечо\n0.00,24,8,90,170\n0.03,20,25,88,172'} style={{ width:'100%', height:64, marginTop:6, background:'rgba(22,30,52,0.88)', color:'#fff', border:'1px solid rgba(140,190,255,0.16)', borderRadius:14, padding:'12px 16px', fontSize:13, fontFamily:'monospace' }} />
              {poseResult && <div style={{ marginTop:6, padding:'12px 12px', borderRadius:14, background: poseResult.verdict === 'ok' ? 'rgba(34,197,94,0.08)' : 'rgba(245,158,11,0.08)', border:'1px solid rgba(255,255,255,0.06)', fontSize:12, color: '#fff' }}>n={poseResult.n} · {ruVerdict(poseResult.verdict)} · {poseResult.lines.join(' · ')}</div>}
              {autoAngles && <div style={{ marginTop:6, padding:'12px 12px', borderRadius:14, background:'rgba(59,130,246,0.08)', border:'1px solid rgba(59,130,246,0.18)', fontSize:12, color: '#fff' }}>📐 {ruVerdict(autoAngles.verdict)} · {autoAngles.lines.join(' · ')}</div>}
              <div style={{ display:'flex', gap:6, marginTop:6, alignItems:'center' }}>
                <button onClick={checkPoseLive} style={{ padding:'12px 16px', minHeight:52, borderRadius:14, background:'rgba(255,255,255,0.045)', border:'1px solid rgba(255,255,255,0.09)', color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer' }}>📷 Живая проверка модели</button>
                {state.poseLive === 'loading' && <span style={{ fontSize: 12, color: '#fff' }}>проверяем сеть…</span>}
                {state.poseLive === 'ok' && <span style={{ fontSize: 12, color: '#fff' }}>✓ модель доступна — живые углы следующим шагом</span>}
                {state.poseLive === 'fail' && <span style={{ fontSize: 12, color: '#fff' }}>✕ нет сети — работай через таблицу выше</span>}
              </div>
              </div>
            </details>
            <details style={{ marginTop:10, borderRadius:16, background:'rgba(22,30,52,0.88)', border:'1px solid rgba(140,190,255,0.16)' }}>
              <summary style={{ padding:'12px 14px', fontSize:14, fontWeight:800, color:'#fff', cursor:'pointer', minHeight:48, display:'flex', alignItems:'center' }}>📈 Калибровка скорость-нагрузка (рампа → r²≥0.85)</summary>
              <div style={{ padding:'0 12px 12px', display:'flex', flexDirection:'column' }}>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(140px, 1fr))', gap:6, marginTop:6 }}>
                <HubPopupSelect label="Снаряд (профиль скорость-нагрузка)" value={state.lvpLift} onChange={v=>setState(s=>({...s, lvpLift:v}))} options={[{ id:'yoke_walk', label:'Йок (Yoke)' }, { id:'farmers_walk', label:'Фермер (Farmers)' }, { id:'stone_load', label:'Камень (Stone)' }, { id:'log_press', label:'Лог (Log)' }]} />
                <HubNum label="Скорость 50%" unit="м/с" value={state.lvp50} onChange={v=>setState(s=>({...s, lvp50:v}))} placeholder="1.90" step={0.05} />
                <HubNum label="Скорость 65%" unit="м/с" value={state.lvp65} onChange={v=>setState(s=>({...s, lvp65:v}))} placeholder="1.60" step={0.05} />
                <HubNum label="Скорость 75%" unit="м/с" value={state.lvp75} onChange={v=>setState(s=>({...s, lvp75:v}))} placeholder="1.40" step={0.05} />
                <HubNum label="Скорость 90%" unit="м/с" value={state.lvp90} onChange={v=>setState(s=>({...s, lvp90:v}))} placeholder="1.10" step={0.05} />
              </div>
              <div style={{ display:'flex', gap:6, marginTop:6, alignItems:'center' }}>
                <button onClick={handleLvpFit} style={{ padding:'13px 20px', minHeight:52, borderRadius:14, background:'linear-gradient(135deg,#0a84ff,#30d158)', border:'none', color:'#fff', fontSize:14, fontWeight:800, cursor:'pointer', boxShadow:'0 6px 20px rgba(10,132,255,0.35), inset 0 1px 0 rgba(255,255,255,0.25)' }}>📈 Fit LVP</button>
                <span style={{ fontSize:12, color:'#fff' }}>{state.lvpResult || (smLvpStored ? `сохранён r² ${smLvpStored.r2}${smLvpStored.valid ? ' ✓' : ' ⚠'}` : 'рампа 50/65/75/90 → r²≥0.85')}</span>
              </div>
              </div>
            </details>
            <details style={{ marginTop:10, borderRadius:16, background:'rgba(22,30,52,0.88)', border:'1px solid rgba(140,190,255,0.16)' }}>
              <summary style={{ padding:'14px', fontSize:14, fontWeight:800, color:'#fff', cursor:'pointer', minHeight:52, display:'flex', alignItems:'center' }}>📊 Прогресс стронга (йок / фермер / лог / лестница)</summary>
              <div style={{ padding:'0 12px 12px', display:'flex', flexDirection:'column' }}>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(140px, 1fr))', gap:6, marginTop:6 }}>
                <HubNum label="Йок 20 м" unit="сек" value={state.progYoke20m} onChange={v=>setState(s=>({...s, progYoke20m:v}))} placeholder="12.0" step={0.5} />
                <HubNum label="Фермер 40 м" unit="сек" value={state.progFarmers40m} onChange={v=>setState(s=>({...s, progFarmers40m:v}))} placeholder="28.0" step={0.5} />
                <HubNum label="Лог макс" unit="кг" value={state.progLogMax} onChange={v=>setState(s=>({...s, progLogMax:v}))} placeholder="110" step={2.5} />
                <HubNum label="Лестница камней" unit="кг" value={state.progStoneLadder} onChange={v=>setState(s=>({...s, progStoneLadder:v}))} placeholder="140" step={2.5} />
                <HubNum label="Вес тела" unit="кг" value={state.progBw} onChange={v=>setState(s=>({...s, progBw:v}))} placeholder="105" step={1} />
              </div>
              <div style={{ display:'flex', gap:6, marginTop:6, alignItems:'center' }}>
                <button onClick={handleSaveProgress} style={{ padding:'13px 20px', minHeight:52, borderRadius:14, background:'linear-gradient(135deg,#16a34a,#30d158)', border:'none', color:'#fff', fontSize:14, fontWeight:800, cursor:'pointer', boxShadow:'0 6px 20px rgba(34,197,94,0.35), inset 0 1px 0 rgba(255,255,255,0.25)' }}>💾 Снапшот прогресса</button>
                <span style={{ fontSize:12, color:'#fff' }}>{smTrend ? `n=${smTrend.n} Δscore ${smTrend.scoreDelta} · best ${smTrend.bestScore} (${smTrend.bestDate})` : `история ${smProgressHist.length}/60`}</span>
              </div>
              </div>
            </details>
            <div style={{ marginTop:6, padding:'10px 12px', borderRadius:14, background:'rgba(22,30,52,0.88)', border:'1px dashed rgba(140,190,255,0.16)', textAlign:'center' }}>
              <div style={{ fontSize:13, color:'#fff' }}>📹 Видео качания — измеряй боковое как макс(x)−мин(x) в Кинова (Kinovea)</div>
              <div style={{ marginTop:6, width:'100%', minHeight:52, background:'rgba(255,255,255,0.03)', borderRadius:14, display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:13, border:'1px solid rgba(255,255,255,0.04)' }}>Качание (Sway) 3 см — норма, больше 5 см — крит (McGill)</div>
            </div>
          </div>
        )}
      </div>

      <div style={{ ...CARD, padding: 10, background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.16)' }}>
        <div style={{ fontSize:15, fontWeight:800, color:'#fff', marginBottom:6 }}>📋 Итог и применение</div>
        <details style={{ marginBottom:6, borderRadius:14, background:'rgba(255,255,255,0.025)', border:'1px solid rgba(255,255,255,0.07)' }}>
          <summary style={{ padding:'12px 14px', fontSize:13, fontWeight:800, color:'#fff', cursor:'pointer', minHeight:48, display:'flex', alignItems:'center' }}>Сводка расчёта — находки, ранжир, спец-блок</summary>
          <div style={{ padding:'0 12px 12px', display:'flex', flexDirection:'column', gap:6 }}>
        <div style={{ fontSize:12, color:'#fff' }}>Находки: {scoring.findings.map(f=>f.text).join(' · ') || '—'}</div>
        {scoring.floors.length>0 && <div style={{ fontSize:12, color:'#fff' }}>Пороги: {scoring.floors.join(' · ')}</div>}
        <div style={{ fontSize:13, color:'#fff' }}>Выбрано: {weakPoints.length? weakPoints.join(' · ') : '— баланс'} {smWeakPoints.length? `→ ${smWeakPoints.join(' · ')}` : ''}</div>
        {smRankTop.length > 0 && <div style={{ fontSize:12, color:'#fff' }}>Ранжир: {smRankTop.map((c) => `${c.name} ${c.protocol.sets}×${c.protocol.reps} @${c.protocol.pct}%`).join(' · ')}</div>}
        {smSpec && <div style={{ fontSize:12, color:'#fff' }}>Спец-блок {smSpec.totalWeeks}нед: {smSpec.weeks.slice(0, 3).map((w) => `нед${w.week} ${Object.values(w.targetSets)[0]}×5`).join(' · ')}… · {smSpec.rationale[0]}</div>}
        {logDiamCls && <div style={{ fontSize:12, color:'#fff' }}>Диаметр: {logDiameterNote(logDiamCm)}{scaledLogAttempts ? ` → ${scaledLogAttempts.opener}/${scaledLogAttempts.second}/${scaledLogAttempts.third} кг` : ''}</div>}
        <div style={{ fontSize:12, color:'#fff' }}>Пол: {athleteSexLabel(athleteSex)}{sexStonePull ? ` · ${sexStonePull.lines.join(' · ')}` : ''}</div>
        {stonePhase && <div style={{ fontSize:12, color:'#fff' }}>Фазы камня: {stonePhase.lines.join(' · ')}</div>}
        {carrySplitDiag && <div style={{ fontSize:12, color:'#fff' }}>Отрезки: {carrySplitDiag.lines.join(' · ')}</div>}
        <div style={{ fontSize:12, color:'#fff' }}>Бицепс: {bicepsRisk.score}/100 ({bicepsRisk.level === 'high' ? 'высокий' : bicepsRisk.level === 'moderate' ? 'умеренный' : 'низкий'}){bicepsRisk.gate ? ' · ГЕЙТ: только лямки/нейтраль' : ''}</div>
        {holdEventDiag && <div style={{ fontSize:12, color:'#fff' }}>Ивент-холд: {holdEventDiag.lines.join(' · ')}</div>}
        {formatPlan && <div style={{ fontSize:12, color:'#fff' }}>Формат ({SM_EVENT_FORMAT_LABEL[state.eventFormat]}): {formatPlan.lines.join(' · ')}</div>}
        {autoAngles && <div style={{ fontSize:12, color:'#fff' }}>Авто-углы: {autoAngles.lines.join(' · ')}</div>}
          </div>
        </details>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(150px, 1fr))', gap:6, marginBottom:6 }}>
          <HubNum label="Спец-блок" unit="нед (4–8)" value={state.specWeeks} onChange={v=>setState(s=>({...s, specWeeks:v}))} placeholder="6" step={1} />
          <HubNum label="Год: старт-неделя" unit="нед" value={state.annualStartWeek} onChange={v=>setState(s=>({...s, annualStartWeek:v}))} placeholder="1" step={1} />
        </div>
        <button onClick={applyToConstructor} style={{ width:'100%', padding:'16px 20px', minHeight:56, borderRadius:16, background:'linear-gradient(135deg,#ef4444,#f59e0b)', color:'#fff', border:'none', fontWeight:800, fontSize:16, cursor:'pointer', boxShadow:'0 8px 24px rgba(239,68,68,0.35), inset 0 1px 0 rgba(255,255,255,0.25)' }}>→ Применить в Стронг-конструктор ({weakPoints.join(', ') || 'баланс'})</button>
        <div style={{ display:'flex', gap:6, marginTop:6, flexWrap:'wrap' }}>
          <button onClick={handleExport} aria-label="Печать отчёта (HTML)" style={{ flex:'1 1 140px', padding:'12px 8px', minHeight:52, borderRadius:14, background:'rgba(255,255,255,0.045)', border:'1px solid rgba(255,255,255,0.08)', color:'#fff', fontSize:14, fontWeight:800, cursor:'pointer' }}>🖨 Печать (HTML)</button>
          <button onClick={handleExportCsv} aria-label="Выгрузить таблицу (CSV)" style={{ flex:'1 1 140px', padding:'12px 8px', minHeight:52, borderRadius:14, background:'rgba(255,255,255,0.045)', border:'1px solid rgba(255,255,255,0.08)', color:'#fff', fontSize:14, fontWeight:800, cursor:'pointer' }}>📥 Выгрузка (CSV)</button>
          <button onClick={handleExportIcs} aria-label="Календарь спец-блока (ICS)" style={{ flex:'1 1 140px', padding:'12px 8px', minHeight:52, borderRadius:14, background:'rgba(255,255,255,0.045)', border:'1px solid rgba(255,255,255,0.08)', color:'#fff', fontSize:14, fontWeight:800, cursor:'pointer' }}>📅 Календарь (ICS)</button>
          <button onClick={handleSaveAnnual} aria-label="Отправить в годовой план" style={{ flex:'1 1 140px', padding:'12px 8px', minHeight:52, borderRadius:14, background:'rgba(255,255,255,0.045)', border:'1px solid rgba(255,255,255,0.08)', color:'#fff', fontSize:14, fontWeight:800, cursor:'pointer' }}>🗓 В годовой план</button>
          <button onClick={handleSMBackup} aria-label="Скачать резервную копию" style={{ flex:'1 1 140px', padding:'12px 8px', minHeight:52, borderRadius:14, background:'rgba(255,255,255,0.045)', border:'1px solid rgba(255,255,255,0.08)', color:'#fff', fontSize:14, fontWeight:800, cursor:'pointer' }}>📦 Резервная копия</button>
        </div>
        <div style={{ fontSize:12, color:'#fff', marginTop:6 }}>Хранилище: {(smStoreBytes.total / 1024).toFixed(1)} КБ · защита от переполнения (истории урезаются, чужие ключи не трогаем)</div>
      </div>

      <div style={{ position:'sticky', bottom:0, zIndex:20, display:'flex', gap:10, alignItems:'center', padding:'10px 12px calc(10px + env(safe-area-inset-bottom, 0px))', margin:'0 -12px -22px', background:'rgba(9,18,34,0.88)', borderTop:'1px solid rgba(140,190,255,0.14)', backdropFilter:'blur(20px)', WebkitBackdropFilter:'blur(20px)' }}>
        <span style={{ width:40, height:40, borderRadius:20, background:`conic-gradient(${sColor} ${score}%, rgba(255,255,255,0.08) 0)`, display:'flex', alignItems:'center', justifyContent:'center', border:`2px solid ${sColor}`, fontWeight:900, color:'#fff', fontSize:13, flexShrink:0, fontVariantNumeric:'tabular-nums' }}>{score}</span>
        <span style={{ fontSize:14, fontWeight:800, color: weakPoints.length ? '#fff' : '#fff', flex:1, minWidth:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{weakPoints.length ? `${weakPoints.length} слабые: ${weakPoints.join(', ')}` : 'Выбери слабые фазы'}</span>
        <button onClick={applyToConstructor} style={{ padding:'12px 16px', minHeight:52, borderRadius:14, background:'linear-gradient(135deg,#ef4444,#f59e0b)', color:'#fff', border:'none', fontWeight:800, fontSize:13, cursor:'pointer', flexShrink:0, whiteSpace:'nowrap', boxShadow:'0 6px 20px rgba(239,68,68,0.35), inset 0 1px 0 rgba(255,255,255,0.25)' }}>→ Применить в Стронг</button>
      </div>
    </div>
  );
};

export default StrongmanDiagnosticsHub;
