/**
 * BBDiagnosticsHub.tsx — диагностика ДВИЖЕНИЙ под бодибилдинг (мышца + упражнение → стимул → коррекция).
 * 4 таба: screening (OHS-скрининг + односторонний + драйвер)/exercise (разбор+PROF-техника+Δ)/stimulus (стимул-карта)/symmetry (пропорции).
 * Нагрузка/восстановление/объём/VBT/LVP/видео/ортопедия — НЕ дублируются, только ссылки на свои хабы.
 * Хедер RSS 0-100 (движения: слабые/симметрия/стимул/скрининг/SFR/углы/длина) + verification. Мост weakpoints → BbAutoConstructor.
 */
import React, { useMemo, useState, useEffect } from 'react';
import { CARD, ACCENT } from './training-ui';
import { applyToPlanner } from './planner-bridge';
import { buildPro2Meta } from './bb-hub-export';
import { localIsoDate } from './diary-shared';
import { scoreColor as bbScoreColor } from '../../../engines/bb/bb-scoring.engine';
import { buildBBDiagnosticsReport } from '../../../engines/bb/bb-diagnostics-hub.engine';
import { buildBBDiagnosticsHtml, buildBBDiagnosticsCsv, downloadHtml, downloadCsv } from '../../../engines/bb/bb-diagnostics-export.engine';
import { MUSCLE_LABEL_RU } from '../../../engines/volume-landmarks.engine';
import { aggregateBBVolume } from '../../../engines/bb/bb-volume.engine';
import { analyzeBBBalance } from '../../../engines/bb/bb-balance.engine';
import { computePerMuscleACWR } from '../../../engines/bb/bb-progression-feedback.engine';
import { assessOHS, OHS_NORMS } from '../../../engines/strength-sport/strength-sport-ohs.engine';
import { lrVerdictsFromSessions } from '../../../engines/bb/bb-lr-volume.engine';
import { assessBbReadiness } from '../../../engines/bb/bb-readiness.engine';
import { assessBbRedFlags } from '../../../engines/bb/bb-red-flags.engine';
import { buildReturnToPlan, activeReturnToStage } from '../../../engines/bb/bb-return-to.engine';
import { mmcAdviceFor } from '../../../engines/bb/bb-mmc-gate.engine';
import { pushLrSnapshot, summarizeLrDirection, type BbLrSnapshot } from '../../../engines/bb/bb-lr-history.engine';
import { buildBBSpecIcs, downloadBBSpecIcs } from '../../../engines/bb/bb-spec-ics.engine';
import { bbSpecToAnnualPatch } from '../../../engines/bb/bb-spec-annual.engine';
import { loadAnnualTrainingPlan, saveAnnualTrainingPlan } from '../../../engines/annual-training/annual-training-storage';
import { setAnnualBlockConfig } from '../../../engines/annual-training/block-builders.engine';
import { isSpecializationTargetConflict, canonicalMuscle } from '../../../engines/bb/bb-specialization.engine';
import { calcExerciseEffect, exerciseEffectScore } from '../../../engines/bb/bb-exercise-effect.engine';
import { auditPlanExercises } from '../../../engines/bb/bb-plan-exercise-audit.engine';
import { diagnoseExercise } from '../../../engines/bb/bb-exercise-diagnosis.engine';
import { prescribeCorrections } from '../../../engines/bb/bb-exercise-correction.engine';
import { simulateCorrection } from '../../../engines/bb/bb-exercise-simulator.engine';
import { getProfExecutionProfile } from '../../../engines/bb/bb-execution-prof.engine';
import { EXERCISE_CATALOG } from '../../../core/exercise-catalog';
import { buildExerciseInstructions } from '../../../engines/bb/bb-exercise-instructions.engine';
import { sfrOf } from '../../../engines/bb/bb-sfr-db';
import { diagnoseWeakCausesBatch } from '../../../engines/bb/bb-weak-cause.engine';
import { volumeHistory28d, e1rmTrend28d } from '../../../engines/bb/bb-weak-detection.engine';
import { rankCorrectionsForWeak } from '../../../engines/bb/bb-correction-rank.engine';
import { rankCorrectives, correctiveDose } from '../../../engines/bb/bb-corrective.engine';
import { buildSpecBlock } from '../../../engines/bb/bb-spec-block.engine';
import { injectBBWeakPoints, pushPlanSnapshot, readPlanHistory, type PlanSnapshot } from '../../../engines/bb/bb-diagnostics-injection.engine';
import { idealMcCallumMap, symmetryTriadDeviation, appendMeasureSnapshot, measureDeltas, type MeasureSnapshot } from '../../../engines/bb/bb-symmetry.engine';
import { weakHeadForZone, HEAD_FUNCTIONS, auditHeadCoverage, headsHitOf } from '../../../engines/bb/bb-stimulus-target.engine';
import { resolveMovementDriver, singleLegVerdict, ohsFailCodes, d1d5FailCodes, v3FailCodes, movementDelta, screenPriorityList, teenLoadedGate, type MovementSnapshot } from '../../../engines/bb/bb-movement-screen.engine';
import { shoulderWallVerdict, thoracicRotationVerdict, erIrVerdict, ERIR_DISCLAIMER } from '../../../engines/bb/bb-shoulder-screen.engine';
import { hingeVerdict, loadedSquatVerdict, loadedHingeVerdict, HINGE_LOAD_NOTE } from '../../../engines/bb/bb-hinge-screen.engine';
import { ybtLqVerdict, YBT_DISCLAIMER } from '../../../engines/bb/bb-ybt-lq.engine';
import { substitutesForDriver, asymPriorityText, SCREENING_DISCLAIMER, VIDEO_GUIDE } from '../../../engines/bb/bb-movement-to-plan.engine';
import { benchScreenVerdict, benchCorrections, BENCH_DISCLAIMER } from '../../../engines/bb/bb-bench-screen.engine';
import { painMonitorVerdict, painMonitorLine, provocationFor, PAIN_LOCATIONS, PAIN_MONITOR_DISCLAIMER, type PainLocation } from '../../../engines/bb/bb-pain-monitor.engine';
import { nheVerdict, adductorVerdict, NHE_DISCLAIMER, ADDUCTOR_HONESTY, type CphLevel } from '../../../engines/bb/bb-posterior-readiness.engine';
import { assessBbTendonGuard } from '../../../engines/bb/bb-tendon-guard.engine';
import { calibrateBbLvp, parseBbLvpText, loadBbLvpProfiles, saveBbLvpProfile, clearBbLvpProfiles, type BbLvpProfile } from '../../../engines/bb/bb-lvp.engine';

const STORAGE_KEY = 'he_bb_diagnostics_hub_v1';
type BBTab = 'weak' | 'screening' | 'exercise' | 'stimulus' | 'symmetry';

type BBState = {
  weakManual: string[];
  circ: Record<string, string>;
  ohsHeelsFlat: boolean; ohsKneeValgus: boolean; ohsHipBelowParallel: boolean; ohsTrunkUpright: boolean; ohsArmsOverMidfoot: boolean; ohsLumbarNeutral: boolean;
  kneeToWallCm: string; ankleDeg: string; heelRetest: '' | 'better' | 'same';
  /** КТС левая/правая (см). kneeToWallCm — legacy (мигрирует в обе при загрузке). */
  ktwL: string; ktwR: string;
  /** Скрининг v2: руки на бёдрах чистят поясницу (тест на широчайшие) + односторонний + снимок. */
  handsOnHipsBetter: boolean;
  splitL: '' | 'pass' | 'fail';
  splitR: '' | 'pass' | 'fail';
  rdlL: '' | 'pass' | 'fail';
  rdlR: '' | 'pass' | 'fail';
  /** Опциональный угломер FPPA (градусы, замер с фото). Только tiebreak при чистой качественной оценке. */
  fppaL: string;
  fppaR: string;
  exerciseSelectedId: string | null;
  exerciseFilterSfr: number;
  exerciseFilterProfile: string;
  exerciseFilterUnilateral: boolean;
  wristCm: string;
  sex: '' | 'male' | 'female';
  specWeeks: string;
  showSpecBlock: boolean;
  stimCheating: boolean;
  stimShortRom: boolean;
  stimSetupNote: string;
  acutePain: boolean;
  swelling: boolean;
  numbness: boolean;
  jointClickPain: boolean;
  /** PRO-4 S3: подтверждённая ступень возврата ('' — авто: ступень 1). */
  returnStage: '' | '1' | '2' | '3';
  /** D1 плечо у стены (true = чисто; фолс — провал признака). */
  shBackOnWall: boolean; shHeadOnWall: boolean; shBicepsAtEars: boolean; shRibsDown: boolean; shNoShrug: boolean;
  /** D1 ротация грудного, градусы. */
  rotL: string; rotR: string;
  /** D2 шарнир (палка) + нагруженный присед. */
  hingeDowel: '' | 'full' | 'lumbar_loss' | 'neck_loss' | 'both';
  sqBody: '' | 'pass' | 'fail'; sqBar: '' | 'pass' | 'fail'; sqWork: '' | 'pass' | 'fail';
  /** D3 YBT-LQ anterior + длина голени. */
  ybtL: string; ybtR: string; shinCm: string;
  /** D4 скапула/болевая дуга + видео-стандарт. */
  painArc: boolean; scapWinging: boolean; videoTwoAngles: boolean;
  /** R4: таз/голеностоп — КТС прямым коленом (гастрокнемиус), сгибание бедра, «подворот» таза. */
  ktwStraightL: string; ktwStraightR: string; hipFlexDeg: string; ppTilt: boolean;
  /** R5: шарнир под весом (RDL / тяга с пола). */
  rdlLoaded: '' | 'pass' | 'fail'; floorLoaded: '' | 'pass' | 'fail';
  /** R6: ER/IR-ratio (кг, ручной замер). */
  erKg: string; irKg: string;
  /** R1: жим — хват/касание/лопатки/отведение/локти/боль. */
  benchGripCm: string; benchTouch: '' | 'nipple' | 'upper_abs' | 'neck'; benchScapula: '' | 'retracted' | 'neutral' | 'released';
  benchAbduction: string; benchElbowsBelow: boolean; benchPain: boolean;
  /** R2: боль-мониторинг (0–10 днём/утром + флаги). */
  pmLoc: '' | PainLocation; pmDuring: string; pmMorning: string; pmRising: boolean; pmNight: boolean; pmSharp: boolean;
  /** R3: задняя цепь — NHE (повторы/угол) + аддукторы (сжатие/уровень Copenhagen). */
  nheL: string; nheR: string; nheAngle: string; addL: string; addR: string; cphLevel: '' | CphLevel;
};

const DEFAULT_STATE: BBState = {
  weakManual: [],
  circ: { heightCm: '175', weightKg: '80', neck: '', chest: '', waist: '', hips: '', bicepL: '', bicepR: '', thighL: '', thighR: '', calfL: '', calfR: '', shoulderWidth: '', forearmL: '', forearmR: '' },
  ohsHeelsFlat: true, ohsKneeValgus: false, ohsHipBelowParallel: true, ohsTrunkUpright: true, ohsArmsOverMidfoot: true, ohsLumbarNeutral: true,
  kneeToWallCm: '', ankleDeg: '', heelRetest: '',
  ktwL: '', ktwR: '',
  handsOnHipsBetter: false,
  splitL: '', splitR: '', rdlL: '', rdlR: '',
  fppaL: '', fppaR: '',
  exerciseSelectedId: null,
  exerciseFilterSfr: 0,
  exerciseFilterProfile: 'all',
  exerciseFilterUnilateral: false,
  wristCm: '',
  sex: '',
  specWeeks: '8',
  showSpecBlock: false,
  stimCheating: false,
  stimShortRom: false,
  stimSetupNote: '',
  acutePain: false,
  swelling: false,
  numbness: false,
  jointClickPain: false,
  returnStage: '',
  shBackOnWall: true, shHeadOnWall: true, shBicepsAtEars: true, shRibsDown: true, shNoShrug: true,
  rotL: '', rotR: '',
  hingeDowel: '',
  sqBody: '', sqBar: '', sqWork: '',
  ybtL: '', ybtR: '', shinCm: '',
  painArc: false, scapWinging: false, videoTwoAngles: false,
  ktwStraightL: '', ktwStraightR: '', hipFlexDeg: '', ppTilt: false,
  rdlLoaded: '', floorLoaded: '',
  erKg: '', irKg: '',
  benchGripCm: '', benchTouch: '', benchScapula: '', benchAbduction: '', benchElbowsBelow: false, benchPain: false,
  pmLoc: '', pmDuring: '', pmMorning: '', pmRising: false, pmNight: false, pmSharp: false,
  nheL: '', nheR: '', nheAngle: '', addL: '', addR: '', cphLevel: '',
};

const TAB_DEFS: Array<{ id: BBTab; label: string; icon: string; desc: string }> = [
  { id: 'weak', label: 'Слабые', icon: '🎯', desc: 'зоны 1–2 + причина + топ-3' },
  { id: 'screening', label: 'Скрининг', icon: '🦿', desc: 'присед-тест + драйвер + 1 нога' },
  { id: 'exercise', label: 'Разбор', icon: '🏋️', desc: 'упражнение + техника + замена' },
  { id: 'stimulus', label: 'Стимул-карта', icon: '🎯', desc: 'SFR + длина + углы + читинг' },
  { id: 'symmetry', label: 'Пропорции', icon: '⚖️', desc: 'замеры + лево/право + дельты' },
];

const GRANULAR_OPTS: Array<{ id: string; label: string }> = [
  { id: 'delt_mid', label: 'Средняя дельта' },
  { id: 'delt_rear', label: 'Задняя дельта' },
  { id: 'delt_front', label: 'Передняя дельта' },
  { id: 'chest_upper', label: 'Верх груди' },
  { id: 'chest_lower', label: 'Низ груди' },
  { id: 'back_width', label: 'Ширина спины' },
  { id: 'back_thickness', label: 'Толщина спины' },
  { id: 'quads', label: 'Квадрицепс' },
  { id: 'hamstrings', label: 'Бицепс бедра' },
  { id: 'glutes', label: 'Ягодицы' },
  { id: 'biceps', label: 'Бицепс' },
  { id: 'triceps', label: 'Трицепс' },
  { id: 'calves', label: 'Икры' },
  { id: 'traps', label: 'Трапеции' },
  { id: 'forearms', label: 'Предплечья' },
];

/** Русские подписи профилей/мышц для вывода (движковые id не меняются). */
const PROFILE_RU: Record<string, string> = { lengthened: 'растянутая', mid: 'средняя', short: 'пиковая', all: 'все' };

/** PRO-5 Э3: RU-расшифровка кодов трекинга снимков (D1–D5/R1–R8; неизвестный код — как есть). */
const TRACKED_CODE_RU: Record<string, string> = {
  heels: 'пятки', valgus: 'вальгус', depth: 'глубина', trunk: 'корпус', arms: 'руки', lumbar: 'поясница', ppt: 'наклон таза',
  'sh-flexion': 'плечо: сгибание', 'sh-thoracic': 'плечо: грудной', 'sh-lats': 'плечо: широчайшие', 'sh-control': 'плечо: контроль', 'sh-position': 'плечо: позиция', 'sh-fail': 'плечо: провал',
  'rot-gap': 'ротация: разрыв', 'rot-low': 'ротация: мало',
  'hinge-lumbar': 'шарнир: поясница', 'hinge-neck': 'шарнир: шея', 'hinge-both': 'шарнир: поясница+шея',
  'sq-degraded': 'присед под весом', 'ybt-asym': 'YBT: асимметрия', 'ybt-comp': 'YBT: композит',
  'bench-fix': 'жим: правка', 'bench-watch': 'жим: наблюдать', 'nhe-asym': 'NHE: асимметрия', 'add-asym': 'аддукторы: асимметрия',
  'pm-red': 'боль: красная', 'pm-yellow': 'боль: жёлтая', 'hip-flex': 'сгибание бедра', 'hng-degraded': 'шарнир под весом', 'erir-low': 'ER/IR низко',
};
const trackedRu = (codes: string[]): string => codes.map((c) => TRACKED_CODE_RU[c] || c).join(' · ');
const profileRu = (p: string | null | undefined): string => (p && PROFILE_RU[p]) || String(p || '—');
const FLAG_RU: Record<string, string> = {
  synergistTakeover: 'нагрузку забирают соседи', stabilityGap: 'не хватает стабильности', wrongHead: 'бьёт мимо слабой головки',
  singleAngle: 'один угол — нужен второй', shortOnly: 'только короткая позиция', missingLengthened: 'нет растянутой позиции',
  jointOverload: 'перегруз сустава', mobilityBlock: 'мешает подвижность', asymRisk: 'риск перекоса',
  tempoOff: 'темп не тот', romShort: 'амплитуда укорочена', cheating: 'читинг',
};
const flagRu = (f: string): string => FLAG_RU[f] || f;
const CIRC_RU: Record<string, string> = {
  heightCm: 'рост', weightKg: 'вес', chest: 'грудь', waist: 'талия', hips: 'бёдра', neck: 'шея',
  shoulderWidth: 'плечи', bicepL: 'бицепс Л', bicepR: 'бицепс П', bicep: 'бицепс',
  thighL: 'бедро Л', thighR: 'бедро П', calfL: 'голень Л', calfR: 'голень П',
  forearmL: 'предплечье Л', forearmR: 'предплечье П', wristCm: 'запястье',
};
const circRu = (k: string): string => CIRC_RU[k] || k;
const weakRu = (z: string): string => GRANULAR_OPTS.find((o) => o.id === z)?.label || MUSCLE_LABEL_RU[z] || z;
const weakListRu = (zs: string[]): string => zs.map(weakRu).join(' · ');

/** Компактная кнопка-карточка вместо галочки (44px, АПК-тап). */
const BbCheckCard: React.FC<{ active: boolean; title: string; desc?: string; onToggle: () => void; accent?: string }> = ({ active, title, desc, onToggle, accent = '#00e68a' }) => (
  <button
    type="button"
    role="switch"
    aria-checked={active}
    aria-pressed={active}
    aria-label={title}
    data-bb="check-card"
    data-on={active ? '1' : '0'}
    onClick={onToggle}
    style={{
      display: 'flex', alignItems: 'center', gap: 8, minHeight: 44, padding: '8px 10px', borderRadius: 12,
      border: `1px solid ${active ? accent : 'rgba(255,255,255,0.10)'}`, cursor: 'pointer', textAlign: 'left',
      background: active ? 'rgba(0,230,138,0.12)' : 'rgba(255,255,255,0.03)', color: '#fff', fontSize: 12, fontWeight: 700,
    }}
  >
    <span aria-hidden style={{ width: 22, height: 22, borderRadius: 7, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: active ? accent : 'rgba(255,255,255,0.08)', color: active ? '#06281c' : '#fff', fontSize: 13, fontWeight: 900 }}>{active ? '✓' : ''}</span>
    <span style={{ lineHeight: 1.25 }}>{title}{desc ? <span style={{ display: 'block', fontSize: 10, fontWeight: 500, color: '#fff', opacity: 0.85 }}>{desc}</span> : null}</span>
  </button>
);

/** Красивое числовое поле: подпись + инпут 44px/16px + степпер. */
const BbNum: React.FC<{ label: string; value: string; onChange: (v: string) => void; placeholder?: string; width?: number | string; step?: number; testId?: string }> = ({ label, value, onChange, placeholder, width = '100%', step, testId }) => (
  <label data-bb="num-field" style={{ fontSize: 11, color: '#fff', display: 'block', minWidth: 0 }}>
    <span style={{ display: 'block', marginBottom: 3, lineHeight: 1.2 }}>{label}</span>
    <span style={{ display: 'flex', gap: 4, alignItems: 'stretch' }}>
      {step ? (
        <button type="button" data-bb="num-minus" aria-label={`Уменьшить ${label}`} onClick={() => { const n = parseFloat(value); onChange(Number.isFinite(n) ? String(Math.max(0, Math.round((n - step) * 10) / 10)) : ''); }} style={{ minWidth: 44, minHeight: 44, borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: 16, fontWeight: 800, cursor: 'pointer' }}>−</button>
      ) : null}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        inputMode="decimal"
        data-bb="num-input"
        data-testid={testId}
        aria-label={label}
        style={{ flex: 1, width, minHeight: 44, background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '10px 10px', fontSize: 16 }}
      />
      {step ? (
        <button type="button" data-bb="num-plus" aria-label={`Увеличить ${label}`} onClick={() => { const n = parseFloat(value); onChange(Number.isFinite(n) ? String(Math.round((n + step) * 10) / 10) : String(step)); }} style={{ minWidth: 44, minHeight: 44, borderRadius: 10, border: '1px solid rgba(0,230,138,0.30)', background: 'rgba(0,230,138,0.12)', color: '#fff', fontSize: 16, fontWeight: 800, cursor: 'pointer' }}>+</button>
      ) : null}
    </span>
  </label>
);

/** Красивый попап-выбор вместо нативного селекта (кнопка 44px + шит). */
const BbSheetSelect: React.FC<{ label: string; value: string; options: Array<{ id: string; label: string; hint?: string }>; onChange: (id: string) => void; testId?: string }> = ({ label, value, options, onChange, testId }) => {
  const [open, setOpen] = useState(false);
  const cur = options.find((o) => o.id === value) || null;
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open ]);
  return (
    <span data-bb="sheet-select" style={{ display: 'block', minWidth: 0 }}>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`${label}: ${cur ? cur.label : 'не выбрано'}`}
        data-bb="sheet-trigger"
        data-testid={testId}
        onClick={() => setOpen((o) => !o)}
        style={{ width: '100%', minHeight: 44, display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', textAlign: 'left' }}
      >
        <span style={{ fontSize: 10, fontWeight: 500, color: '#fff', opacity: 0.8 }}>{label}</span>
        <span style={{ flex: 1 }}>{cur ? cur.label : '— выбери —'}</span>
        <span aria-hidden style={{ color: '#fff', opacity: 0.8 }}>▾</span>
      </button>
      {open && (
        <span data-bb="sheet-backdrop" onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 60, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <span role="dialog" aria-modal="true" aria-label={label} data-bb="sheet-card" onClick={(e) => e.stopPropagation()} style={{ width: 'min(560px, 100%)', maxHeight: '70vh', overflowY: 'auto', background: '#101827', border: '1px solid rgba(255,255,255,0.12)', borderBottom: 'none', borderRadius: '18px 18px 0 0', padding: '12px 12px calc(16px + env(safe-area-inset-bottom, 0px))' }}>
            <span style={{ display: 'block', width: 40, height: 4, borderRadius: 4, background: 'rgba(255,255,255,0.2)', margin: '0 auto 10px' }} />
            <span style={{ display: 'block', fontSize: 13, fontWeight: 800, color: '#fff', marginBottom: 8 }}>{label}</span>
            {options.map((o) => (
              <button
                key={o.id}
                type="button"
                aria-pressed={value === o.id}
                data-bb="sheet-option"
                data-active={value === o.id ? '1' : '0'}
                onClick={() => { onChange(o.id); setOpen(false); }}
                style={{ width: '100%', minHeight: 48, display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', marginBottom: 6, borderRadius: 12, border: `1px solid ${value === o.id ? 'rgba(0,230,138,0.45)' : 'rgba(255,255,255,0.10)'}`, background: value === o.id ? 'rgba(0,230,138,0.12)' : 'rgba(255,255,255,0.03)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', textAlign: 'left' }}
              >
                <span aria-hidden style={{ width: 20, height: 20, borderRadius: 10, border: '1px solid rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>{value === o.id ? '●' : ''}</span>
                <span style={{ flex: 1 }}>{o.label}{o.hint ? <span style={{ display: 'block', fontSize: 10, fontWeight: 500, color: '#fff', opacity: 0.8 }}>{o.hint}</span> : null}</span>
              </button>
            ))}
            <button type="button" data-bb="sheet-done" onClick={() => setOpen(false)} style={{ width: '100%', minHeight: 48, borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#00e68a,#00c853)', color: '#06281c', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>Готово</button>
          </span>
        </span>
      )}
    </span>
  );
};

/* 3.11: единый парсинг плана ББ из localStorage (было 4 копии). */
export function pickPlanFromSaved(parsed: unknown): any | null {
  const j: any = parsed;
  if (Array.isArray(j) && j[0]?.plan?.weeks) return j[0].plan;
  if (j?.plan?.weeks) return j.plan;
  if (j?.weeks) return j;
  return null;
}
function readSavedBbPlanRaw(): string | null {
  try { return localStorage.getItem('he_bb_plan_saved') || localStorage.getItem('he_bb_plans'); } catch { return null; }
}
function readSavedBbPlan(): any | null {
  const raw = readSavedBbPlanRaw();
  if (!raw) return null;
  try { return pickPlanFromSaved(JSON.parse(raw)); } catch { return null; }
}

/** КТС: L/R приоритетнее legacy-одиночки; eff — худшая сторона (разница ≥2 см — см. драйвер). */
function ktwOf(s: { ktwL?: string; ktwR?: string; kneeToWallCm?: string }): { l: number | null; r: number | null; eff: number | null } {
  const num = (v: unknown): number | null => { const n = parseFloat(String(v ?? '')); return Number.isFinite(n) && n >= 0 ? n : null; };
  const l = num(s.ktwL) ?? num(s.kneeToWallCm);
  const r = num(s.ktwR) ?? num(s.kneeToWallCm);
  return { l, r, eff: l != null && r != null ? Math.min(l, r) : (l ?? r) };
}

export const BBDiagnosticsHub: React.FC = () => {
  const [state, setState] = useState<BBState>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        // Миграция legacy: одно значение КТС → обе стороны (дальше живут раздельно)
        if ((parsed.ktwL == null || parsed.ktwL === '') && (parsed.ktwR == null || parsed.ktwR === '') && parsed.kneeToWallCm) {
          parsed.ktwL = parsed.ktwR = parsed.kneeToWallCm;
        }
        return { ...DEFAULT_STATE, ...parsed, circ: { ...DEFAULT_STATE.circ, ...(parsed.circ || {}) } };
      }
    } catch {}
    return DEFAULT_STATE;
  });
  const [tab, setTab] = useState<BBTab>('weak');
  const [toast, setToast] = useState<string>('');
  const [measureHist, setMeasureHist] = useState<MeasureSnapshot[]>(() => {
    try {
      const raw = localStorage.getItem('he_bb_measure_history');
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr.filter((s) => s && typeof s.date === 'string' && s.meas) : [];
    } catch { return []; }
  });
  const [hasInjectPrev, setHasInjectPrev] = useState<boolean>(() => {
    try { return !!localStorage.getItem('he_bb_plan_saved_prev'); } catch { return false; }
  });
  // Нонс перечитывания плана из хранилища (инъекция/откат меняют его мимо мемов)
  const [planNonce, setPlanNonce] = useState(0);
  // PRO-5 Э2: профиль читают мемы — бампим тик по profile-updated/storage (правка профиля без ремаунта)
  const [profileNonce, setProfileNonce] = useState(0);
  useEffect(() => {
    const bump = () => setProfileNonce((t) => t + 1);
    try {
      window.addEventListener('profile-updated', bump as EventListener);
      window.addEventListener('storage', bump as EventListener);
    } catch { /* noop */ }
    return () => {
      try {
        window.removeEventListener('profile-updated', bump as EventListener);
        window.removeEventListener('storage', bump as EventListener);
      } catch { /* noop */ }
    };
  }, []);

  useEffect(() => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {} }, [state]);
  // Э4 PRO-5: поиск упражнения в «Разборе» (план — первыми, каталог без произвольного среза)
  const [exQuery, setExQuery] = useState('');
  // Э6 PRO-5: LVP-калибровка (движок был без UI-потребителя) — аккордеон в «Разборе»
  const [lvpLift, setLvpLift] = useState('squat');
  const [lvpText, setLvpText] = useState('');
  const [lvpProfile, setLvpProfile] = useState<BbLvpProfile | null>(null);
  const [lvpSaved, setLvpSaved] = useState<number>(() => { try { return Object.keys(loadBbLvpProfiles()).length; } catch { return 0; } });

  const level = useMemo(() => {
    try { const p = JSON.parse(localStorage.getItem('he_profile_v2') || '{}'); return p?.settings?.training?.level || p?.training?.level || 'intermediate'; } catch { return 'intermediate'; }
  }, [profileNonce]);

  // Оборудование зала из профиля — фильтр кандидатов (без него — весь каталог)
  const profileEquipment = useMemo(() => {
    try {
      const p = JSON.parse(localStorage.getItem('he_profile_v2') || '{}');
      const eq = p?.settings?.training?.equipment ?? p?.training?.equipment;
      if (Array.isArray(eq)) {
        const clean = eq.map((s) => String(s)).filter(Boolean);
        return clean.length ? clean : undefined;
      }
      return undefined;
    } catch { return undefined; }
  }, [profileNonce]);

  // Пол и сон — из профиля (единый источник; в хабе своих селектов нет, без дублей)
  const profileSex = useMemo(() => {
    try {
      const p = JSON.parse(localStorage.getItem('he_profile_v2') || '{}');
      const s = p?.settings?.personal?.sex ?? p?.personal?.sex;
      return s === 'female' || s === 'male' ? (s as 'male' | 'female') : '';
    } catch { return ''; }
  }, [profileNonce]);
  const profileSleep = useMemo(() => {
    try {
      const p = JSON.parse(localStorage.getItem('he_profile_v2') || '{}');
      const n = Number(p?.settings?.lifestyle?.sleepHours ?? p?.lifestyle?.sleepHours);
      return Number.isFinite(n) && n > 0 ? n : null;
    } catch { return null; }
  }, [profileNonce]);
  // R6: возраст из профиля — гейт нагруженных проб для 14–15 (прецедент teenNotes ББ-авто)
  const profileAge = useMemo(() => {
    try {
      const p = JSON.parse(localStorage.getItem('he_profile_v2') || '{}');
      const a = Number(p?.settings?.personal?.age ?? p?.personal?.age);
      return Number.isFinite(a) && a > 0 ? a : null;
    } catch { return null; }
  }, [profileNonce]);
  const teenGate = useMemo(() => teenLoadedGate(profileAge), [profileAge]);
  // state.sex — замороженный легаси-фолбэк (UI-селекта больше нет); профиль приоритетнее
  const effSex = ((profileSex || state.sex || '') as '' | 'male' | 'female');

  const diarySessions: any[] = useMemo(() => {
    try {
      const raw = localStorage.getItem('he_workout_log_v1') || localStorage.getItem('he_training_log') || localStorage.getItem('he_workout_log_v2') || '[]';
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch { return []; }
  }, []);

  const factVolume = useMemo(() => {
    try {
      // последние 7 дней факт (effective)
      const now = Date.now();
      const DAY = 24 * 3600 * 1000;
      const recent = diarySessions.filter((s: any) => {
        const t = s.date ? new Date(s.date).getTime() : 0;
        return t && now - t <= 7 * DAY;
      });
      if (recent.length === 0) return null;
      // 3.11: факт-объём через канонический aggregateBBVolume (direct + EMG-indirect),
      // а не своя сумма «direct = effective» без косвенной нагрузки.
      const exercises = recent.flatMap((s: any) => ((s.exercises || []) as any[]).map((ex) => ({
        name: String(ex.exerciseName || ex.name || ''),
        muscle: String(ex.muscleGroup || ex.muscle || '').toLowerCase(),
        sets: Array.isArray(ex.sets) ? ex.sets.length : Math.max(0, Number(ex.sets) || 0),
        rir: Number(ex.rir) || 2,
        role: 'accessory' as const,
      })).filter((e) => e.muscle && e.sets > 0));
      if (exercises.length === 0) return null;
      return aggregateBBVolume([{ exercises }]);
    } catch { return null; }
  }, [diarySessions]);

  const perMuscleAcwr = useMemo(() => {
    try { return computePerMuscleACWR(diarySessions as any); } catch { return {}; }
  }, [diarySessions]);

  // Э5-доводка (R6): сохранённый план читается ОДИН раз на рендер (было 3 точки readSavedBbPlan)
  const savedPlan = useMemo(() => {
    try { return readSavedBbPlan(); } catch { return null; }
  }, [planNonce, diarySessions]);

  const balance = useMemo(() => {
    try {
      if (savedPlan?.weeks) return analyzeBBBalance(savedPlan);
      return null;
    } catch { return null; }
  }, [savedPlan]);

  const ohs = useMemo(() => assessOHS({
    heelsFlat: state.ohsHeelsFlat, kneeValgus: state.ohsKneeValgus, hipBelowParallel: state.ohsHipBelowParallel,
    trunkUpright: state.ohsTrunkUpright, armsOverMidfoot: state.ohsArmsOverMidfoot, lumbarNeutral: state.ohsLumbarNeutral,
    kneeToWallCm: ktwOf(state).eff,
    ankleDorsiflexDeg: state.ankleDeg ? parseFloat(state.ankleDeg) : null,
    heelRaiseRetest: state.heelRetest === 'better' ? true : state.heelRetest === 'same' ? false : null,
  }), [state.ohsHeelsFlat, state.ohsKneeValgus, state.ohsHipBelowParallel, state.ohsTrunkUpright, state.ohsArmsOverMidfoot, state.ohsLumbarNeutral, state.ktwL, state.ktwR, state.kneeToWallCm, state.ankleDeg, state.heelRetest]);

  // P1: L/R-объём из дневника + флип-гейт по истории (D2: сторона плавает — шум измерения,
  // добивку не фиксируем; стабильная сторона ≥3 замеров — добивка оправдана).
  const lrVerdicts = useMemo(() => {
    try {
      const base = lrVerdictsFromSessions(diarySessions as any);
      let hist: BbLrSnapshot[] = [];
      try {
        const raw = localStorage.getItem('he_bb_lr_history');
        hist = raw ? (JSON.parse(raw) as BbLrSnapshot[]) : [];
      } catch { /* noop */ }
      return base.map((v) => {
        if ((v.verdict === 'topup' || v.verdict === 'watch') && v.weakSide) {
          try {
            const d = summarizeLrDirection(hist, v.group);
            if (d && d.flipped && !d.persistent) {
              return { ...v, verdict: 'watch' as const, topUpSets: 0, text: `${v.text} · сторона плавает — шум измерения, добивку не фиксируем` };
            }
          } catch { /* noop */ }
        }
        return v;
      });
    } catch { return []; }
  }, [diarySessions]);
  // P2/P3: готовность + красные флаги
  const redFlags = useMemo(() => {
    try {
      return assessBbRedFlags({ acutePain: state.acutePain, swelling: state.swelling, numbness: state.numbness, jointClickPain: state.jointClickPain });
    } catch { return { active: false, blocked: false, items: [], text: '' } as any; }
  }, [state.acutePain, state.swelling, state.numbness, state.jointClickPain]);
  const readiness = useMemo(() => {
    try {
      // Сон — из профиля; боль сегодня в хабе не спрашиваем (нет данных — нет штрафа, честно)
      const sl = profileSleep;
      const danger = Object.values(perMuscleAcwr as any).filter((v: any) => v?.zone === 'dangerous').length;
      return assessBbReadiness({
        sleepHours: Number.isFinite(sl as number) ? (sl as number) : null,
        pain010: null,
        // VBT живёт в Анализе силы — сюда не входит (movement-only)
        vbtLossPct: null,
        dangerMuscles: danger,
      });
    } catch { return { level: 'green', reasons: [], advice: '' } as any; }
  }, [profileSleep, perMuscleAcwr]);
  // PRO-3 R2 + PRO-4 S3: return-to после стоп-флагов (ступень выбирается вручную) — гейт вставки
  const returnToPlan = useMemo(() => {
    try { return buildReturnToPlan(redFlags as any); } catch { return null; }
  }, [redFlags]);
  const returnActive = useMemo(() => {
    try { return activeReturnToStage(returnToPlan as any, state.returnStage as any); } catch { return null; }
  }, [returnToPlan, state.returnStage]);
  // PRO-3 R6: направление перекоса (история слабых сторон)
  const lrDirection = useMemo(() => {
    try {
      const raw = localStorage.getItem('he_bb_lr_history');
      const hist = raw ? (JSON.parse(raw) as BbLrSnapshot[]) : [];
      const out: Array<{ group: string; text: string }> = [];
      for (const v of lrVerdicts.slice(0, 2)) {
        const d = summarizeLrDirection(hist, v.group);
        if (d) out.push({ group: v.group, text: d.text });
      }
      return out;
    } catch { return []; }
  }, [lrVerdicts]);

  const measNum: Record<string, number> = useMemo(() => {
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(state.circ)) {
      const n = parseFloat(v as string);
      if (Number.isFinite(n) && n > 0) out[k] = n;
    }
    return out;
  }, [state.circ]);

  const report = useMemo(() => buildBBDiagnosticsReport({
    level,
    factVolume: factVolume as any,
    sessions: diarySessions as any,
    meas: measNum as any,
    heightCm: measNum.heightCm ?? null,
    plan: savedPlan as any,
    balance,
    // Движения, не нагрузка: ACWR/VBT в скоринг не входят (их хабы — Интеллект/Анализ силы).
    // perMuscleAcwr остаётся тихим входом причин (weakCauses), но не штрафа баллов.
    perMuscleAcwr: null,
    mobilityFails: ohs.failed,
    vbtLossPct: null,
    hasDiary: diarySessions.length > 0,
    hasCircumf: Object.keys(measNum).some(k => ['chest','waist','bicepL','bicepR','thighL','thighR'].includes(k)),
    hasVbt: false,
    manualWeak: state.weakManual,
  }), [level, factVolume, diarySessions, measNum, balance, ohs.failed, state.weakManual, savedPlan]);

  // Э5-доводка (R3): макс перекос L/R — один мемо (было 5 копий расчёта в карточках/выдаче/мосте)
  const asymMax = useMemo(() => {
    try {
      const vals = Object.entries(report.symmetry.ratios).filter(([k]) => k.endsWith('_asym')).map(([, v]) => Number(v));
      return vals.length ? Math.max(...vals) : null;
    } catch { return null; }
  }, [report.symmetry.ratios]);

  // Скрининг v2: драйвер + односторонний + коды/снимок (чистые функции движка)
  const moveDriver = useMemo(() => {
    try {
      const numStr = (v: string): number | null => { const n = parseFloat(v); return Number.isFinite(n) ? n : null; };
      return resolveMovementDriver({
        heelsFlat: state.ohsHeelsFlat, kneeValgus: state.ohsKneeValgus, hipBelowParallel: state.ohsHipBelowParallel,
        trunkUpright: state.ohsTrunkUpright, armsOverMidfoot: state.ohsArmsOverMidfoot, lumbarNeutral: state.ohsLumbarNeutral,
        kneeToWallCm: ktwOf(state).eff,
        kneeToWallL: ktwOf(state).l,
        kneeToWallR: ktwOf(state).r,
        ankleDeg: state.ankleDeg ? parseFloat(state.ankleDeg) : null,
        heelRetest: state.heelRetest === 'better' ? 'better' : state.heelRetest === 'same' ? 'same' : null,
        handsOnHipsBetter: state.handsOnHipsBetter || null,
        // R4: гастрокнемиус (прямое колено) + ROM сгибания бедра + задний наклон таза
        ktwStraightL: numStr(state.ktwStraightL), ktwStraightR: numStr(state.ktwStraightR),
        hipFlexionDeg: numStr(state.hipFlexDeg),
        ppTilt: state.ppTilt,
      });
    } catch { return { driver: 'none', label: '—', fix: '', confidence: 0 } as any; }
  }, [state.ohsHeelsFlat, state.ohsKneeValgus, state.ohsHipBelowParallel, state.ohsTrunkUpright, state.ohsArmsOverMidfoot, state.ohsLumbarNeutral, state.ktwL, state.ktwR, state.kneeToWallCm, state.ankleDeg, state.heelRetest, state.handsOnHipsBetter, state.ktwStraightL, state.ktwStraightR, state.hipFlexDeg, state.ppTilt]);
  const singleLeg = useMemo(() => {
    try {
      const num = (v: string): number | null => { const n = parseFloat(v); return Number.isFinite(n) && n >= 0 ? n : null; };
      return singleLegVerdict({
        splitSquatL: (state.splitL || null) as any, splitSquatR: (state.splitR || null) as any,
        rdlL: (state.rdlL || null) as any, rdlR: (state.rdlR || null) as any,
        fppaL: num(state.fppaL), fppaR: num(state.fppaR),
      });
    } catch { return { weakSide: null, text: '' } as any; }
  }, [state.splitL, state.splitR, state.rdlL, state.rdlR, state.fppaL, state.fppaR]);
  // D1–D5: плечо/шарнир/YBT/асимметрии/замены (чистые мемы, без TDZ — выше экспорта/моста)
  const shoulderV = useMemo(() => {
    try {
      return shoulderWallVerdict({
        backOnWall: state.shBackOnWall, headOnWall: state.shHeadOnWall, bicepsAtEars: state.shBicepsAtEars,
        ribsDown: state.shRibsDown, noShrug: state.shNoShrug,
      });
    } catch { return { pass: true, fails: [], locus: 'ok', text: '' } as any; }
  }, [state.shBackOnWall, state.shHeadOnWall, state.shBicepsAtEars, state.shRibsDown, state.shNoShrug]);
  const rotV = useMemo(() => {
    try {
      const n = (v: string): number | null => { const x = parseFloat(v); return Number.isFinite(x) && x >= 0 ? x : null; };
      return thoracicRotationVerdict({ rotL: n(state.rotL), rotR: n(state.rotR) });
    } catch { return { text: '', gap: null, low: false } as any; }
  }, [state.rotL, state.rotR]);
  const hingeV = useMemo(() => {
    try { return hingeVerdict((state.hingeDowel || null) as any); } catch { return { pass: true, locus: 'not_tested', text: '' } as any; }
  }, [state.hingeDowel]);
  const loadedV = useMemo(() => {
    try {
      return loadedSquatVerdict({
        bodyweight: (state.sqBody || null) as any, bar: (state.sqBar || null) as any, working: (state.sqWork || null) as any,
      });
    } catch { return { degraded: false, text: '' } as any; }
  }, [state.sqBody, state.sqBar, state.sqWork]);
  const ybtV = useMemo(() => {
    try {
      const n = (v: string): number | null => { const x = parseFloat(v); return Number.isFinite(x) && x > 0 ? x : null; };
      return ybtLqVerdict({ antL: n(state.ybtL), antR: n(state.ybtR), shinCm: n(state.shinCm) });
    } catch { return { tested: false, asymCm: null, compositePct: null, warn: false, text: '' } as any; }
  }, [state.ybtL, state.ybtR, state.shinCm]);
  const asymText = useMemo(() => {
    try {
      const n = (v: string): number | null => { const x = parseFloat(v); return Number.isFinite(x) ? x : null; };
      const kl = n(state.ktwL); const kr = n(state.ktwR);
      const fl = n(state.fppaL); const fr = n(state.fppaR);
      return asymPriorityText({
        ktwGapCm: kl != null && kr != null ? Math.abs(kl - kr) : null,
        fppaGapDeg: fl != null && fr != null ? Math.abs(fl - fr) : null,
        ybtAsymCm: (ybtV as any)?.asymCm ?? null,
        rotGapDeg: (rotV as any)?.gap ?? null,
      });
    } catch { return ''; }
  }, [state.ktwL, state.ktwR, state.fppaL, state.fppaR, ybtV, rotV]);
  const driverSubs = useMemo(() => {
    try { return substitutesForDriver((moveDriver as any)?.driver); } catch { return { avoid: [], prefer: [], note: '' } as any; }
  }, [moveDriver]);
  // ── R1–R6 PRO-2: жим / боль-мониторинг / задняя цепь / шарнир-нагрузка / ER:IR (чистые мемы) ──
  const benchV = useMemo(() => {
    try {
      const num = (v: string): number | null => { const n = parseFloat(v); return Number.isFinite(n) && n > 0 ? n : null; };
      return benchScreenVerdict({
        gripCm: num(state.benchGripCm),
        biacromialCm: num(state.circ.shoulderWidth),
        touchPoint: (state.benchTouch || null) as any,
        scapula: (state.benchScapula || null) as any,
        abductionDeg: num(state.benchAbduction),
        elbowsBelowBench: state.benchElbowsBelow,
        pain: state.benchPain,
      });
    } catch { return benchScreenVerdict({}); }
  }, [state.benchGripCm, state.circ.shoulderWidth, state.benchTouch, state.benchScapula, state.benchAbduction, state.benchElbowsBelow, state.benchPain]);
  const painMon = useMemo(() => {
    try {
      const num = (v: string): number | null => { const n = parseFloat(v); return Number.isFinite(n) ? n : null; };
      const input = {
        location: (state.pmLoc || null) as any,
        during010: num(state.pmDuring),
        nextMorning010: num(state.pmMorning),
        weeksRising: state.pmRising,
        nightPain: state.pmNight,
        sharp: state.pmSharp,
      };
      return { verdict: painMonitorVerdict(input), line: painMonitorLine(input) };
    } catch { return { verdict: painMonitorVerdict({}), line: '' }; }
  }, [state.pmLoc, state.pmDuring, state.pmMorning, state.pmRising, state.pmNight, state.pmSharp]);
  const painJointTendon = useMemo(() => {
    try {
      const joint = state.pmLoc === 'elbow' ? 'elbow' : state.pmLoc === 'shoulder' ? 'shoulder' : null;
      if (!joint || !diarySessions.length) return null;
      const g = assessBbTendonGuard(diarySessions as any, {
        level,
        painRedJoint: painMon.verdict.level === 'red' ? joint : null,
      });
      return (g as any)[joint] as { text: string; level: string } | null;
    } catch { return null; }
  }, [state.pmLoc, diarySessions, level, painMon.verdict.level]);
  const nheV = useMemo(() => {
    try {
      const num = (v: string): number | null => { const n = parseFloat(v); return Number.isFinite(n) && n >= 0 ? n : null; };
      const angle = num(state.nheAngle);
      return nheVerdict({ repsL: num(state.nheL), repsR: num(state.nheR), breakAngleL: angle, breakAngleR: angle });
    } catch { return nheVerdict({}); }
  }, [state.nheL, state.nheR, state.nheAngle]);
  const adductorV = useMemo(() => {
    try {
      const num = (v: string): number | null => { const n = parseFloat(v); return Number.isFinite(n) && n > 0 ? n : null; };
      return adductorVerdict({ squeezeL: num(state.addL), squeezeR: num(state.addR), cphLevel: (state.cphLevel || '') as any });
    } catch { return adductorVerdict({}); }
  }, [state.addL, state.addR, state.cphLevel]);
  const loadedHingeV = useMemo(() => {
    try {
      if (teenGate.blocked) return { degraded: false, text: teenGate.note };
      return loadedHingeVerdict({ rdl: (state.rdlLoaded || null) as any, floor: (state.floorLoaded || null) as any });
    } catch { return { degraded: false, text: '' }; }
  }, [state.rdlLoaded, state.floorLoaded, teenGate]);
  const erIrV = useMemo(() => {
    try {
      if (teenGate.blocked) return erIrVerdict({});
      const num = (v: string): number | null => { const n = parseFloat(v); return Number.isFinite(n) && n > 0 ? n : null; };
      return erIrVerdict({ erKg: num(state.erKg), irKg: num(state.irKg) });
    } catch { return erIrVerdict({}); }
  }, [state.erKg, state.irKg, teenGate]);
  const ohsCodes = useMemo(() => {
    try {
      return ohsFailCodes({
        heelsFlat: state.ohsHeelsFlat, kneeValgus: state.ohsKneeValgus, hipBelowParallel: state.ohsHipBelowParallel,
        trunkUpright: state.ohsTrunkUpright, armsOverMidfoot: state.ohsArmsOverMidfoot, lumbarNeutral: state.ohsLumbarNeutral,
        ppTilt: state.ppTilt,
      });
    } catch { return []; }
  }, [state.ohsHeelsFlat, state.ohsKneeValgus, state.ohsHipBelowParallel, state.ohsTrunkUpright, state.ohsArmsOverMidfoot, state.ohsLumbarNeutral, state.ppTilt]);
  // П1: D1–D5 коды снимка из вердиктов (только провалы; чисто — тихо).
  const d1d5Codes = useMemo(() => {
    try {
      return d1d5FailCodes({
        shoulder: { pass: !!(shoulderV as any).pass, locus: String((shoulderV as any).locus || '') },
        rotGap: (rotV as any).gap ?? null,
        rotLow: !!(rotV as any).low,
        hinge: { pass: !!(hingeV as any).pass, locus: String((hingeV as any).locus || '') },
        loadedDegraded: !!(loadedV as any).degraded,
        ybtAsymCm: (ybtV as any).asymCm ?? null,
        ybtCompositePct: (ybtV as any).compositePct ?? null,
        ybtTested: !!(ybtV as any).tested,
      });
    } catch { return []; }
  }, [shoulderV, rotV, hingeV, loadedV, ybtV]);
  // R7: R1–R6 коды снимка (жим/боль/NHE/аддукторы/бедро/шарнир-нагрузка/ER:IR)
  const v3Codes = useMemo(() => {
    try {
      const n = (v: string): number | null => { const x = parseFloat(v); return Number.isFinite(x) ? x : null; };
      return v3FailCodes({
        benchLevel: benchV.level,
        nheAsymReps: nheV.asymReps,
        addAsymPct: adductorV.asymPct,
        painLevel: painMon.verdict.level,
        hipFlexionDeg: n(state.hipFlexDeg),
        ppTilt: state.ppTilt,
        loadedHingeDegraded: teenGate.blocked ? false : loadedHingeV.degraded,
        erIrRatio: teenGate.blocked ? null : erIrV.ratio,
      });
    } catch { return []; }
  }, [benchV.level, nheV.asymReps, adductorV.asymPct, painMon.verdict.level, state.hipFlexDeg, state.ppTilt, teenGate.blocked, loadedHingeV.degraded, erIrV.ratio]);
  const screenCodes = useMemo(() => Array.from(new Set([...ohsCodes, ...d1d5Codes, ...v3Codes])), [ohsCodes, d1d5Codes, v3Codes]);
  const screenPriority = useMemo(() => {
    try {
      return screenPriorityList({
        painLevel: painMon.verdict.level,
        painText: painMon.line,
        driver: moveDriver as any,
        asymText,
        tendon: painJointTendon && painJointTendon.level === 'stop' ? { level: 'stop', text: painJointTendon.text } : null,
        bench: { level: benchV.level, text: benchV.text },
        posterior: { nhe: nheV.tested ? nheV.text : null, adductor: adductorV.tested ? adductorV.text : null },
        loadedHinge: { degraded: teenGate.blocked ? false : loadedHingeV.degraded, text: loadedHingeV.text },
        erIr: erIrV.tested ? erIrV.text : null,
      });
    } catch { return []; }
  }, [painMon, moveDriver, asymText, painJointTendon, benchV, nheV, adductorV, loadedHingeV, erIrV, teenGate.blocked]);
  const [screenHist, setScreenHist] = useState<MovementSnapshot[]>(() => {
    try {
      const raw = localStorage.getItem('he_bb_screen_history');
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr.filter((s) => s && typeof s.date === 'string' && Array.isArray(s.fails)) : [];
    } catch { return []; }
  });
  const screenDelta = useMemo(() => {
    try {
      const prev = screenHist.length ? screenHist[screenHist.length - 1] : null;
      return movementDelta(prev, screenCodes);
    } catch { return { fixed: [], regressed: [], tracked: [], text: '' } as any; }
  }, [screenHist, screenCodes]);

  const score = report.score.score;
  const sLevel = report.score.level;
  const sColor = bbScoreColor(sLevel);
  // Фокус внимания: изоляция слабой зоны → внутренний, иначе внешний (нагрузка %1RM — в Анализе силы)
  const mmcAdvice = useMemo(() => {
    try {
      const iso = (report.weakZonesGranular || []).length > 0;
      return mmcAdviceFor({ isolation: iso, loadPct1RM: null, explosive: false });
    } catch { return null; }
  }, [report]);
  // Э5-доводка (R5): MMC-строка — одна (карточка/мост/экспорт)
  const mmcLine = useMemo(() => {
    try {
      const a = mmcAdvice;
      return a ? `${a.focus === 'internal' ? 'Внутренний' : 'Внешний'} фокус: ${a.cue} — ${a.text}` : null;
    } catch { return null; }
  }, [mmcAdvice]);

  // ── MAX PRO: причины слабых + McCallum + триада + спец-блок + топ-3 ──
  const wristNum = state.wristCm ? parseFloat(state.wristCm) : NaN;
  const mcCallum = useMemo(() => (Number.isFinite(wristNum) && wristNum > 0 ? idealMcCallumMap(wristNum) : null), [wristNum]);
  const triadDev = useMemo(() => {
    try {
      const n = (k: string): number | null => { const v = parseFloat((state.circ as any)[k] || ''); return Number.isFinite(v) && v > 0 ? v : null; };
      const b = n('bicepL') ?? n('bicepR') ?? (measNum as any).bicep ?? null;
      const c = n('calfL') ?? n('calfR') ?? null;
      const nk = n('neck');
      return symmetryTriadDeviation({ neck: nk, bicep: b, calf: c });
    } catch { return null; }
  }, [state.circ, measNum]);

  const toggleWeak = (id: string) => {
    setState(s => {
      const has = s.weakManual.includes(id);
      let next: string[];
      if (has) next = s.weakManual.filter(x => x !== id);
      else {
        // проверка конфликта parent+zone
        if (s.weakManual.some(ex => isSpecializationTargetConflict(ex, id))) {
          setToast('Конфликт: плечи+зона нельзя, две зоны можно');
          setTimeout(() => setToast(''), 2000);
          return s;
        }
        next = [...s.weakManual, id].slice(0, 2);
      }
      return { ...s, weakManual: next };
    });
  };

  const applyToConstructor = () => {
    if (report.weakMusclesCanonical.length === 0) {
      setToast('Слабые зоны не выбраны — выберите 1-2 (или заполните дневник/замеры для авто)');
      setTimeout(() => setToast(''), 2500);
      return;
    }
    // MAX PRO payload: причины + топ-3 + спец-блок (лениво, без TDZ — считается внутри хендлера)
    let weakCausesPayload: Record<string, unknown> = {};
    let topIds: string[] = [];
    let weakHeads: string[] = [];
    let specPayload: unknown = null;
    // Э5 PRO-5: причины — то же мемо, что в карточке/экспорте (единый набор входов + auditFor)
    try { weakCausesPayload = weakCauses as Record<string, unknown>; } catch { /* noop */ }
    try {
      specPayload = specBlock;
      // топ-3 на каждую слабую зону (макс 6) + головки — из общего мемо exportHeads
      const seen = new Set<string>();
      for (const z of report.weakZonesGranular.slice(0, 2)) {
        try {
          // 3.11: единый источник ранжирования — мемо top3ByZone (без повторного вызова).
          for (const r of (top3ByZone[z] || [])) {
            const id = String(r.id).toLowerCase();
            if (!seen.has(id)) { seen.add(id); topIds.push(r.id); }
          }
        } catch { /* noop */ }
      }
      topIds = topIds.slice(0, 6);
      weakHeads = exportHeads;
    } catch { /* noop */ }
    // PRO-3 R6: копим направление перекоса (сырые стороны + дата) для динамики
    try {
      const raw = localStorage.getItem('he_bb_lr_history');
      let hist = raw ? (JSON.parse(raw) as BbLrSnapshot[]) : [];
      const today = localIsoDate();
      for (const v of lrVerdictsFromSessions(diarySessions as any).slice(0, 4)) {
        hist = pushLrSnapshot(hist, { date: today, group: v.group, weakSide: v.weakSide, asymPct: v.asymPct, verdict: v.verdict });
      }
      localStorage.setItem('he_bb_lr_history', JSON.stringify(hist));
    } catch { /* noop */ }
    applyToPlanner({
      kind: 'weakpoints',
      label: `ББ-диагностика: ${report.weakZonesGranular.map(weakRu).join(', ')}`,
      data: {
        groups: report.weakZonesGranular,
        weakPoints: report.weakZonesGranular,
        weakZonesGranular: report.weakZonesGranular,
        weakMusclesCanonical: report.weakMusclesCanonical,
        bbDiagScore: score, bbDiagLevel: sLevel, verification: report.score.verification,
        symmetry: report.symmetry, stimulus: report.stimulus,
        // Движения, не нагрузка: скрининг + односторонний драйвер (ACWR/readiness/VBT/LVP/сон/боль — чужие хабы, в мост не едут)
        ohs: { totalScore: ohs.totalScore, failed: ohs.failed },
        movementDriver: moveDriver,
        singleLeg,
        vbtLossPct: null,
        weakCauses: weakCausesPayload,
        preferredExerciseIds: topIds,
        // Э5 PRO-5: единая деталь коррекций библиотеки (карточка = экспорт = мост)
        correctiveDetail: correctiveDetailForExport,
        weakHeads,
        specBlock: specPayload,
        // MMC-строка: приёмник ББ-авто её уже читает (typeof string) — шлём тот же текст, что в карточке
        mmc: mmcLine,
        sleepHours: Number.isFinite(profileSleep as number) ? profileSleep : null,
        // Симметрия L/R — движения, с флип-гейтом (сторона плавает — без добивки); направление — из истории
        lrVerdicts,
        lrDirection,
        // D1–D5: плечо/шарнир/YBT/лопатка/видео + замены драйвера (всё опционально, приёмник только сохраняет/показывает)
        shoulder: (() => { try { return { pass: (shoulderV as any).pass, locus: (shoulderV as any).locus, text: (shoulderV as any).text }; } catch { return null; } })(),
        hinge: (() => { try { return { pass: (hingeV as any).pass, locus: (hingeV as any).locus, text: (hingeV as any).text, loaded: (loadedV as any).text }; } catch { return null; } })(),
        ybt: (() => { try { return { tested: (ybtV as any).tested, asymCm: (ybtV as any).asymCm, compositePct: (ybtV as any).compositePct, text: (ybtV as any).text }; } catch { return null; } })(),
        scapPain: (() => { try { return { painArc: state.painArc, winging: state.scapWinging, text: state.painArc || state.scapWinging ? 'Лопатка/дуга: есть замечания (скрининг, не диагноз)' : null }; } catch { return null; } })(),
        videoStandard: state.videoTwoAngles ? 'снято с 2 ракурсов' : null,
        driverSubs: (() => { try { return { prefer: (driverSubs as any).prefer, avoid: (driverSubs as any).avoid, note: (driverSubs as any).note }; } catch { return null; } })(),
        asymPriority: (() => { try { return asymText; } catch { return null; } })(),
        // Э1 PRO-5: возврат в работу — план ступеней (инфо) + ручная ступень + её исполняемое
        // действие для автосборки (BbAutoConstructor применяет через he_bb_return_action).
        ...(returnToPlan ? {
          returnTo: returnToPlan,
          returnStage: state.returnStage || null,
          returnAction: state.returnStage ? (returnActive?.action ?? null) : null,
        } : {}),
        // R1–R8 PRO-2: жим/боль/задняя цепь/шарнир-нагрузка/ER:IR/приоритет (инфо-слой, сборку не меняет §9.2)
        bench: benchV.tested ? { level: benchV.level, text: benchV.text } : null,
        painMon: painMon.line || null,
        posterior: nheV.tested || adductorV.tested ? { nhe: nheV.tested ? nheV.text : null, adductor: adductorV.tested ? adductorV.text : null } : null,
        loadedHinge: !teenGate.blocked && !/не проверялся/.test(loadedHingeV.text) ? { text: loadedHingeV.text } : null,
        erir: !teenGate.blocked && erIrV.tested ? { text: erIrV.text } : null,
        screenPriority: screenPriority.length ? screenPriority : null,
      },
      source: 'intellectual',
    });
    setToast(`✓ Применено в ББ-авто: ${report.weakZonesGranular.map(weakRu).join(', ')} (оценка ${score})`);
    setTimeout(() => setToast(''), 3000);
    try {
      window.dispatchEvent(new CustomEvent('planning-track-open', { detail: 'bb' } as any));
      localStorage.setItem('he_training_planning_track', 'bb');
    } catch {}
  };

  const applyMobilityToProfile = () => {
    const restrictions: string[] = [];
    if (!state.ohsHeelsFlat) restrictions.push('ankle');
    if (state.ohsKneeValgus) restrictions.push('hip');
    if (!state.ohsHipBelowParallel) restrictions.push('hip');
    if (!state.ohsTrunkUpright) restrictions.push('hip');
    if (!state.ohsArmsOverMidfoot) restrictions.push('shoulder');
    if (!state.ohsLumbarNeutral) restrictions.push('lower_back');
    // D1: провал плеча у стены — тоже плечо в профиль (тот же канал, без дублей)
    try { if (!(shoulderV as any)?.pass) restrictions.push('shoulder'); } catch { /* noop */ }
    const ktwEff = ktwOf(state).eff;
    if (ktwEff != null && ktwEff < 12) restrictions.push('ankle');
    const uniq = [...new Set(restrictions)];
    try {
      const raw = localStorage.getItem('he_profile_v2');
      const p = raw ? JSON.parse(raw) : {};
      p.health = p.health || {}; p.health.mobilityRestrictions = uniq;
      p.training = p.training || {}; (p.training as any).mobilityRestrictions = uniq;
      localStorage.setItem('he_profile_v2', JSON.stringify(p));
      try { window.dispatchEvent(new CustomEvent('profile-updated')); } catch {}
      const restrRu: Record<string, string> = { ankle: 'голеностоп', hip: 'таз', shoulder: 'плечо', lower_back: 'поясница' };
      setToast(`✓ Подвижность ${uniq.map((r) => restrRu[r] || r).join(', ') || 'в порядке'} → профиль`);
      setTimeout(() => setToast(''), 2500);
    } catch {}
  };

  // PRO-CORR-FIX: единый конструктор сигналов библиотеки — карточка, HTML- и CSV-экспорт
  // обязаны считать одним набором входов (иначе топ в файле ≠ показанному/вставленному).
  const corrSignalsFor = (z: string, cause: unknown) => {
    const drv = (() => { try { return String((moveDriver as any)?.driver || ''); } catch { return ''; } })();
    const pLevel = (() => { try { return String((painMon as any)?.verdict?.level || 'green'); } catch { return 'green'; } })();
    return {
      zones: [z],
      driver: drv && drv !== 'none' ? drv : null,
      benchLevel: (() => { try { return String((benchV as any)?.level || '') || null; } catch { return null; } })(),
      nheWeak: (() => { try { const l = String((nheV as any)?.level || ''); return l === 'weak' || l === 'very_weak'; } catch { return false; } })(),
      addWeak: (() => { try { return String((adductorV as any)?.level || '') === 'weak'; } catch { return false; } })(),
      erirLow: (() => { try { const r = (erIrV as any)?.ratio; return typeof r === 'number' && Number.isFinite(r) && r < 0.75; } catch { return false; } })(),
      painLevel: (pLevel === 'red' || pLevel === 'yellow' ? pLevel : 'green') as 'green' | 'yellow' | 'red',
      hingeFail: (() => { try { return !!((hingeV as any)?.pass === false); } catch { return false; } })(),
      shoulderFail: (() => { try { return !!((shoulderV as any)?.pass === false); } catch { return false; } })(),
      ybtAsym: (() => { try { const a = (ybtV as any)?.asymCm; return typeof a === 'number' && Number.isFinite(a) && a > 4; } catch { return false; } })(),
      ktwAsym: (() => { try { return String(asymText || '').includes('голеностоп'); } catch { return false; } })(),
      asym: asymMax != null && asymMax >= 7,
      teenBlocked: (() => { try { return !!teenGate.blocked; } catch { return false; } })(),
      shoulderPain: state.pmLoc === 'shoulder' && (pLevel === 'yellow' || pLevel === 'red'),
      rotGap: (() => { try { const g = (rotV as any)?.gap; return typeof g === 'number' && Number.isFinite(g) && g >= 10; } catch { return false; } })(),
      loadedFail: (() => { try { return teenGate.blocked ? false : !!loadedHingeV.degraded; } catch { return false; } })(),
      cause: (cause ?? null) as 'volume' | 'activation' | 'recovery' | 'technique' | 'genetics' | null,
      level, equipment: profileEquipment,
    };
  };

  // PRO-CORR-FIX П2-финал: единые флаги дозы — карточка, мост, оба экспорта и вставка
  // обязаны показывать/класть одно и то же («показано = вставится = экспортировано»).
  const corrDoseFlags = () => ({
    readinessRed: (readiness as any)?.level === 'red',
    painYellow: (() => { try { return String((painMon as any)?.verdict?.level || '') === 'yellow'; } catch { return false; } })(),
    painRed: (() => { try { return String((painMon as any)?.verdict?.level || '') === 'red'; } catch { return false; } })(),
  });

  // Э6 PRO-5: LVP-калибровка — валидный профиль (r²≥0.85) сохраняем, шумный честно не пишем
  const runLvp = () => {
    try {
      const pts = parseBbLvpText(lvpText);
      const p = calibrateBbLvp(lvpLift, pts);
      setLvpProfile(p);
      if (p && p.valid) {
        const store = saveBbLvpProfile(p);
        setLvpSaved(Object.keys(store).length);
        setToast(`✓ LVP ${p.lift}: e1RM ≈ ${p.e1rm} кг (r² ${p.r2}) — профиль сохранён`);
      } else {
        setToast(p ? `LVP: r² ${p.r2} — мало/шумно, профиль не сохранён` : 'LVP: нужно 3+ точки с разбросом (формат «вес скорость»)');
      }
      setTimeout(() => setToast(''), 3000);
    } catch { /* noop */ }
  };
  const clearLvp = () => {
    try {
      clearBbLvpProfiles();
      setLvpSaved(0);
      setLvpProfile(null);
      setToast('LVP-профили очищены');
      setTimeout(() => setToast(''), 2000);
    } catch { /* noop */ }
  };

  const handleExport = () => {
    // Э5 PRO-5: причины — мемо weakCauses (с auditFor: «показано = экспортировано»), PRO-мета — общий сборщик
    const html = buildBBDiagnosticsHtml(report, { date: localIsoDate(), level, plan: bbPlan, weakHeads: exportHeads, weakCauses: weakCauses as any, specBlock: specBlock as any, ...pro2Meta } as any);
    downloadHtml(html, `bb-diagnostics-${localIsoDate()}.html`);
    setToast('✓ HTML экспорт (движения: причины + спец-блок + разбор + скрининг)');
    setTimeout(() => setToast(''), 2000);
  };
  const handleExportCsv = () => {
    // Э5 PRO-5: тот же объект меты, что HTML (CSV больше не теряет driver_subs)
    const csv = buildBBDiagnosticsCsv(report, bbPlan as any, { weakCauses: weakCauses as any, weakHeads: exportHeads, specBlock: specBlock as any, ...pro2Meta });
    downloadCsv(csv, `bb-diagnostics-${localIsoDate()}.csv`);
    setToast('✓ CSV экспорт (движения: причины + спец-блок + разбор + скрининг)');
    setTimeout(() => setToast(''), 2000);
  };

  // PRO-3 R7: спец-блок → конфиг BB-блока годового плана (официальный setAnnualBlockConfig)
  const handleAnnualApply = () => {
    try {
      if (!report.weakZonesGranular.length) {
        setToast('Выбери 1-2 слабые зоны — нечего класть в год');
        setTimeout(() => setToast(''), 2000);
        return;
      }
      const plan = loadAnnualTrainingPlan();
      if (!plan || !plan.blocks.length) {
        setToast('Годового плана нет — собери разметку в «Годовой план»');
        setTimeout(() => setToast(''), 2500);
        return;
      }
      const bbBlocks = plan.blocks.filter((b) => b?.ref?.kind === 'BB');
      if (!bbBlocks.length) {
        setToast('В году нет ББ-блоков — спец-блок класть некуда');
        setTimeout(() => setToast(''), 2500);
        return;
      }
      // Блок года выбирает годовой план сам (первый ББ-блок) — селекта в диагностике нет, без дублей
      const key = bbBlocks[0].ref.blockKey;
      const sb = specBlock;
      if (!sb) {
        setToast('Не удалось собрать спец-блок');
        setTimeout(() => setToast(''), 2000);
        return;
      }
      const patch = bbSpecToAnnualPatch(sb, report.weakZonesGranular);
      if (!patch) {
        setToast('Не удалось собрать патч спец-блока');
        setTimeout(() => setToast(''), 2000);
        return;
      }
      const next = setAnnualBlockConfig(plan, key, patch as any);
      saveAnnualTrainingPlan(next);
      setToast(`✓ Спец-блок → годовой план (${key}): слабые + специализация, блок помечен stale`);
      setTimeout(() => setToast(''), 3000);
    } catch {
      setToast('⚠ Не удалось применить в годовой план');
      setTimeout(() => setToast(''), 2000);
    }
  };

  // PRO-3 R7: календарь спец-блока (.ics) — тот же паттерн, что SM/TA
  const handleSpecIcs = () => {
    try {
      if (!report.weakZonesGranular.length) {
        setToast('Выбери 1-2 слабые зоны — нечего класть в календарь');
        setTimeout(() => setToast(''), 2000);
        return;
      }
      const sb = specBlock;
      if (!sb) {
        setToast('Не удалось собрать календарь');
        setTimeout(() => setToast(''), 2000);
        return;
      }
      const ics = buildBBSpecIcs(
        { weeks: (sb.weeks || []).map((w) => ({ week: w.week, targetSets: w.targetSets, note: w.note })), weakZones: report.weakZonesGranular },
        { title: 'ББ спец-блок' },
      );
      if (!ics) {
        setToast('Не удалось собрать календарь');
        setTimeout(() => setToast(''), 2000);
        return;
      }
      downloadBBSpecIcs(ics, `bb-spec-${localIsoDate()}.ics`);
      setToast('📅 Календарь спец-блока скачан');
      setTimeout(() => setToast(''), 2000);
    } catch {
      setToast('⚠ Не удалось собрать календарь');
      setTimeout(() => setToast(''), 2000);
    }
  };

  // ── Упражнения → эффект (единый инструмент) ──
  const bbPlan = useMemo(() => {
    return savedPlan && savedPlan.weeks ? savedPlan : null;
  }, [savedPlan]);

  const planAudit = useMemo(() => {
    try { return bbPlan ? auditPlanExercises(bbPlan) : null; } catch { return null; }
  }, [bbPlan]);

  // ── MAX PRO: причины + спец-блок + топ-3 (после planAudit/bbPlan — порядок важен) ──
  const hist28 = useMemo(() => {
    try { return volumeHistory28d(diarySessions as any); } catch { return {}; }
  }, [diarySessions]);
  const e1rmTrend = useMemo(() => {
    try { return e1rmTrend28d(diarySessions as any); } catch { return {}; }
  }, [diarySessions]);
  const weakCauses = useMemo(() => {
    try {
      return diagnoseWeakCausesBatch(report.weakZonesGranular.slice(0, 2), {
        level,
        factVolume: factVolume as any,
        perMuscleAcwr: perMuscleAcwr as any,
        sleepHours: Number.isFinite(profileSleep as number) ? (profileSleep as number) : null,
        vbtLossPct: null, // VBT живёт в Анализе силы — в диагностику движений не входит
        hist28: hist28 as any,
        e1rmTrend: e1rmTrend as any,
        meas: measNum as any,
        heightCm: measNum.heightCm ?? (parseFloat(state.circ.heightCm || '') || null),
        wristCm: state.wristCm ? parseFloat(state.wristCm) : null,
        canonicalOf: canonicalMuscle,
        auditFor: (z) => {
          const aud = (() => { try { return planAudit?.byMuscle?.[z]; } catch { return null; } })();
          if (!aud) return null;
          return {
            lengthened: aud.lengthened > 0,
            singleAngle: aud.angleCoverage.total > 1 && aud.angleCoverage.covered === 1 && aud.totalSets >= 6,
            missingStrict: aud.strictCoverage.missing.length > 0,
            avgSfr: aud.avgSfr ?? null,
          };
        },
      });
    } catch { return {}; }
  }, [report.weakZonesGranular, level, factVolume, perMuscleAcwr, profileSleep, planAudit, hist28, e1rmTrend, measNum, state.circ.heightCm, state.wristCm]);
  const specBlock = useMemo(() => {
    try {
      if (!report.weakZonesGranular.length) return null;
      const f: Record<string, number> = {};
      for (const [k, v] of Object.entries((factVolume as any) || {})) f[k] = (v as any)?.effectiveSets ?? (v as any)?.directSets ?? 0;
      return buildSpecBlock({ weakZones: report.weakZonesGranular, factSets: f, level, weeks: parseInt(state.specWeeks) || 8, sex: effSex || undefined });
    } catch { return null; }
  }, [report.weakZonesGranular, factVolume, level, state.specWeeks, effSex]);
  const top3ByZone = useMemo(() => {
    const out: Record<string, ReturnType<typeof rankCorrectionsForWeak>> = {};
    for (const z of report.weakZonesGranular.slice(0, 2)) {
      try {
        const aud = (() => { try { return planAudit?.byMuscle?.[z]; } catch { return null; } })();
        const inPlan: string[] = [];
        try {
          if (bbPlan) for (const w of (bbPlan.weeks || [])) for (const s of (w.sessions || [])) for (const ex of (s.exercises || [])) inPlan.push(String((ex as any).exerciseName || (ex as any).name || ''));
        } catch { /* noop */ }
        out[z] = rankCorrectionsForWeak(z, null, {
          cause: weakCauses[z]?.cause,
          weakHead: weakHeadForZone(z),
          asymPct: asymMax,
          level,
          equipment: profileEquipment,
          missingAngles: aud?.angleCoverage.missing || [],
          missingStrict: aud?.strictCoverage.missing || [],
          missingShort: (aud?.totalSets ?? 0) >= 6 && (aud?.shortened ?? 0) === 0,
          inPlanIds: inPlan,
          sex: effSex || undefined,
        }).slice(0, 3);
      } catch { out[z] = []; }
    }
    return out;
  }, [report.weakZonesGranular, report.symmetry.ratios, weakCauses, level, effSex, planAudit, bbPlan, profileEquipment]);

  // PRO-CORR: библиотека коррекций — зона + причина + сигналы скринингов (единый corrSignalsFor: паритет с экспортом/вставкой).
  const correctiveTopByZone = useMemo(() => {
    const out: Record<string, ReturnType<typeof rankCorrectives>> = {};
    for (const z of report.weakZonesGranular.slice(0, 2)) {
      try {
        out[z] = rankCorrectives(corrSignalsFor(z, (weakCauses as any)?.[z]?.cause)).slice(0, 3);
      } catch { out[z] = []; }
    }
    return out;
  }, [report.weakZonesGranular, report.symmetry.ratios, weakCauses, level, profileEquipment, moveDriver, benchV, nheV, adductorV, erIrV, painMon, hingeV, shoulderV, ybtV, asymText, teenGate, state.pmLoc, rotV, loadedHingeV]);

  // Э5 PRO-5: единые входы выдачи — головки, детали коррекций и PRO-мета (HTML/CSV/мост одним объектом)
  const exportHeads = useMemo(() => {
    try {
      const out: string[] = [];
      for (const z of report.weakZonesGranular.slice(0, 2)) {
        const wh = weakHeadForZone(z);
        if (wh && !out.includes(wh)) out.push(wh);
      }
      return out;
    } catch { return []; }
  }, [report.weakZonesGranular]);
  const correctiveDetailForExport = useMemo(() => {
    try {
      const det: Array<{ id: string; zone: string; exerciseId: string; protocol: string; cues: string[]; source: string }> = [];
      for (const z of report.weakZonesGranular.slice(0, 2)) {
        const r = (correctiveTopByZone[z] || [])[0];
        if (!r) continue;
        const dose = correctiveDose(r.corr, (weakCauses as any)?.[z]?.cause ?? null, corrDoseFlags());
        det.push({ id: r.corr.id, zone: z, exerciseId: r.corr.exerciseId, protocol: `${dose.sets}×${dose.repsMin}–${dose.repsMax} RIR${dose.rir} ${dose.tempo}`, cues: r.corr.cues.slice(0, 3), source: r.corr.source });
      }
      return det.length ? det : null;
    } catch { return null; }
  }, [report.weakZonesGranular, correctiveTopByZone, weakCauses, readiness, painMon]);
  const pro2Meta = useMemo(() => buildPro2Meta({
    lrVerdicts: lrVerdicts as any,
    moveDriver,
    singleLeg,
    ohs: { totalScore: ohs.totalScore, failed: ohs.failed },
    mmcLine,
    shoulder: (() => { try { return { pass: (shoulderV as any).pass, locus: (shoulderV as any).locus, text: (shoulderV as any).text }; } catch { return null; } })(),
    hingeText: (() => { try { return `${(hingeV as any).text} · ${(loadedV as any).text}`; } catch { return ''; } })(),
    ybt: (() => { try { return { text: (ybtV as any).text }; } catch { return null; } })(),
    asymText,
    driverSubsText: (() => { try { const pref = ((driverSubs as any).prefer || []) as string[]; const note = String((driverSubs as any).note || ''); return pref.length || note ? `${pref.join(' · ')} — ${note}` : null; } catch { return null; } })(),
    bench: benchV.tested ? { level: benchV.level, text: benchV.text } : null,
    painMonLine: painMon.line || null,
    posterior: nheV.tested || adductorV.tested ? { nhe: nheV.tested ? nheV.text : null, adductor: adductorV.tested ? adductorV.text : null } : null,
    loadedHinge: !teenGate.blocked && !/не проверялся/.test(loadedHingeV.text) ? { text: loadedHingeV.text } : null,
    erir: !teenGate.blocked && erIrV.tested ? { text: erIrV.text } : null,
    screenPriority: screenPriority.length ? screenPriority : null,
    correctiveDetail: correctiveDetailForExport,
    lrDirection,
  }), [lrVerdicts, moveDriver, singleLeg, ohs, mmcLine, shoulderV, hingeV, loadedV, ybtV, asymText, driverSubs, benchV, painMon, nheV, adductorV, loadedHingeV, erIrV, teenGate, screenPriority, correctiveDetailForExport, lrDirection]);

  // Покрытие слабых головок текущим планом (есть ли хоть одно упражнение в головку)
  const headCoverage = useMemo(() => {
    try {
      const heads = report.weakZonesGranular.slice(0, 2).map(weakHeadForZone).filter(Boolean) as string[];
      if (!heads.length || !bbPlan) return [];
      return auditHeadCoverage(bbPlan as any, heads);
    } catch { return []; }
  }, [report.weakZonesGranular, bbPlan]);

  // Слабые головки для подсветки библиотеки (🎯 бьёт в цель)
  const libWeakHeads = useMemo(() => {
    try {
      return report.weakZonesGranular.map(weakHeadForZone).filter(Boolean) as string[];
    } catch { return []; }
  }, [report.weakZonesGranular]);

  // Прошлый разбор из ББ-авто (he_bb_last_weak_heads) — вернуть в работу одной кнопкой
  const lastWeakHeads = useMemo(() => {
    try {
      const raw = localStorage.getItem('he_bb_last_weak_heads');
      const arr = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(arr)) return [];
      const valid = new Set(GRANULAR_OPTS.map((o) => o.id));
      return arr.map((h) => String(h)).filter((h) => valid.has(h)).slice(0, 2);
    } catch { return []; }
  }, []);

  const selectedExRaw = useMemo(() => {
    const id = state.exerciseSelectedId;
    if (!id) return null;
    // ищем в плане
    if (bbPlan) {
      for (const w of (bbPlan.weeks || [])) for (const s of (w.sessions || [])) for (const ex of (s.exercises || [])) {
        const curId = String(ex.exerciseName || ex.id || ex.name || '').toLowerCase();
        if (curId === String(id).toLowerCase()) return { id: String(ex.exerciseName || ex.id), name: String(ex.name || ex.exerciseName || id), muscle: String(ex.muscle || ''), sets: ex.sets ?? ex.workSets?.length ?? 3, rir: ex.rir ?? 2, tempo: ex.tempo, pauseSeconds: ex.pauseSeconds, stretchPhase: (ex as any).stretchPhase };
      }
    }
    const cat = EXERCISE_CATALOG.find(c => c.id === id);
    if (cat) return { id: cat.id, name: cat.name, muscle: cat.group, sets: 3, rir: 2 };
    return { id, name: id, muscle: 'chest' };
  }, [state.exerciseSelectedId, bbPlan]);

  // Э4 PRO-5: «Разбор» больше не режет каталог с начала — упражнения плана первыми + живой поиск
  const plannedCatalogIds = useMemo(() => {
    const set = new Set<string>();
    try {
      if (bbPlan) for (const w of (bbPlan.weeks || [])) for (const s of (w.sessions || [])) for (const ex of (s.exercises || [])) {
        const id = String((ex as any).exerciseName || (ex as any).id || '');
        if (id) set.add(id);
      }
    } catch { /* noop */ }
    return set;
  }, [bbPlan]);
  const exPickerOptions = useMemo(() => {
    const q = exQuery.trim().toLowerCase();
    let list = EXERCISE_CATALOG;
    if (q) list = list.filter((c) => String(c.name).toLowerCase().includes(q) || String(c.id).toLowerCase().includes(q));
    const planFirst = list.filter((c) => plannedCatalogIds.has(c.id));
    const rest = list.filter((c) => !plannedCatalogIds.has(c.id));
    return [{ id: '', label: 'Не выбрано' }, ...[...planFirst, ...rest].slice(0, 80).map((c) => ({ id: c.id, label: `${c.name}`, hint: `${MUSCLE_LABEL_RU[(c as any).group] || (c as any).group} · СФР ${sfrOf(c as any) ?? '—'}` }))];
  }, [exQuery, plannedCatalogIds]);

  const selectedDiagnosis = useMemo(() => {
    if (!selectedExRaw) return null;
    try {
      const singleAngleMuscle = planAudit ? Object.entries(planAudit.byMuscle).find(([, bm]) => bm.angleCoverage.total > 1 && bm.angleCoverage.covered === 1 && bm.totalSets >= 6)?.[0] || null : null;
      const uncovered = planAudit?.byMuscle[selectedExRaw.muscle || '']?.regionalCoverage.missing || [];
      const strictMissing = planAudit?.byMuscle[selectedExRaw.muscle || '']?.strictCoverage.missing || [];
      // слабая головка под выбранную мышцу (для wrongHead): первая зона, чья головка из той же семьи
      const weakHead = (() => {
        try {
          const m = String(selectedExRaw.muscle || '').toLowerCase();
          const LEGS = new Set(['quads', 'hamstrings', 'glutes', 'calves', 'legs']);
          for (const z of report.weakZonesGranular) {
            const h = weakHeadForZone(z);
            if (!h) continue;
            const hm = HEAD_FUNCTIONS[h]?.muscle || '';
            if (hm === m || (LEGS.has(hm) && LEGS.has(m))) return h;
          }
          return null;
        } catch { return null; }
      })();
      return diagnoseExercise(selectedExRaw as any, {
        goal: 'hypertrophy', level, weakZones: report.weakZonesGranular, weakMusclesCanonical: report.weakMusclesCanonical,
        muscle: selectedExRaw.muscle, mobilityFails: ohs.failed, asymPct: asymMax, planTempo: selectedExRaw.tempo || null, planPauseSeconds: selectedExRaw.pauseSeconds ?? null, planReps: 10,
        singleAngleMuscle, uncoveredSubregions: uncovered, strictMissing, weakHead,
        cheating: state.stimCheating || null,
        rangeFull: state.stimShortRom ? false : null,
        setupIssues: state.stimSetupNote.trim() ? [state.stimSetupNote.trim()] : undefined,
      } as any);
    } catch { return null; }
  }, [selectedExRaw, report.weakZonesGranular, report.weakMusclesCanonical, asymMax, ohs.failed, level, planAudit, state.stimCheating, state.stimShortRom, state.stimSetupNote]);

  const selectedCorrections = useMemo(() => {
    if (!selectedDiagnosis || !selectedExRaw) return [];
    try {
      const aud = (() => { try { return planAudit?.byMuscle?.[selectedExRaw.muscle || '']; } catch { return null; } })();
      // слабая головка под мышцу — замены целятся в неё
      let weakHead: string | null = null;
      try {
        const m = String(selectedExRaw.muscle || '').toLowerCase();
        const LEGS = new Set(['quads', 'hamstrings', 'glutes', 'calves', 'legs']);
        for (const z of report.weakZonesGranular) {
          const h = weakHeadForZone(z);
          if (!h) continue;
          const hm = HEAD_FUNCTIONS[h]?.muscle || '';
          if (hm === m || (LEGS.has(hm) && LEGS.has(m))) { weakHead = h; break; }
        }
      } catch { /* noop */ }
      return prescribeCorrections(selectedDiagnosis, selectedExRaw as any, { goal: 'hypertrophy', level, muscle: selectedExRaw.muscle, weakHead, asymPct: asymMax, equipment: profileEquipment, missingAngles: aud?.angleCoverage.missing || [], missingStrict: aud?.strictCoverage.missing || [], sex: effSex || undefined });
    } catch { return []; }
  }, [selectedDiagnosis, selectedExRaw, level, asymMax, report.weakZonesGranular, planAudit, effSex, profileEquipment]);

  const selectedProf = useMemo(() => {
    if (!selectedExRaw) return null;
    try { return getProfExecutionProfile(selectedExRaw.muscle || ''); } catch { return null; }
  }, [selectedExRaw]);

  const exerciseLibraryFiltered = useMemo(() => {
    let list = EXERCISE_CATALOG;
    if (state.exerciseFilterSfr >= 4) list = list.filter(e => (sfrOf(e as any) ?? 0) >= 4);
    if (state.exerciseFilterProfile !== 'all') list = list.filter(e => {
      try {
        const eff = calcExerciseEffect(e as any, {});
        return eff.profile === state.exerciseFilterProfile;
      } catch { return false; }
    });
    if (state.exerciseFilterUnilateral) list = list.filter(e => {
      try { const eff = calcExerciseEffect(e as any, {}); return eff.unilateral; } catch { return false; }
    });
    return list.slice(0, 40);
  }, [state.exerciseFilterSfr, state.exerciseFilterProfile, state.exerciseFilterUnilateral]);

  const handleApplyExerciseCorrection = (action: any, targetExId?: string | null) => {
    const weak = report.weakZonesGranular;
    if (!weak.length && !action.targetId && action.type !== 'modifyExecution' && action.type !== 'modifyTempo' && action.type !== 'modifyROM') {
      setToast('Выбери слабую зону или упражнение — нечего применять');
      setTimeout(() => setToast(''), 2500);
      return;
    }
    const delta = (() => { try { return bbPlan && action ? simulateCorrection(bbPlan, action, targetExId || selectedExRaw?.id || null) : null; } catch { return null; } })();
    applyToPlanner({
      kind: 'weakpoints',
      label: `ББ: ${weak.map(weakRu).join(', ') || 'техника'} → ${action.targetName || action.type}`,
      data: {
        groups: weak.length ? weak : report.weakMusclesCanonical,
        weakPoints: weak.length ? weak : report.weakMusclesCanonical,
        weakZonesGranular: weak, weakMusclesCanonical: report.weakMusclesCanonical,
        preferredExerciseIds: action.targetId ? [action.targetId] : [],
        exerciseSwap: action.targetId && targetExId ? { oldId: targetExId, newId: action.targetId } : action.targetId && selectedExRaw?.id ? { oldId: selectedExRaw.id, newId: action.targetId } : undefined,
        labDiagnosis: selectedDiagnosis ? { flags: selectedDiagnosis.flags, issues: selectedDiagnosis.issues, score: selectedDiagnosis.score } : null,
        // 3.10: цель коррекции (id/имя упражнения) — иначе приёмник менял все упражнения.
        labCorrection: { ...action, targetId: action.targetId || targetExId || selectedExRaw?.id || null, targetName: action.targetName || selectedExRaw?.name || null },
        labDelta: delta,
        bbDiagScore: score, bbDiagLevel: sLevel, verification: report.score.verification,
      },
      source: 'intellectual',
    });
    setToast(`✓ Коррекция ${action.type} → в ББ-авто${delta?.summary ? ` (${delta.summary})` : ''}`);
    setTimeout(() => setToast(''), 3000);
    try { window.dispatchEvent(new CustomEvent('planning-track-open', { detail: 'bb' } as any)); localStorage.setItem('he_training_planning_track', 'bb'); } catch {}
  };

  // 🎯 Худшее упражнение плана по полному диагнозу (со слабыми головками) — открыть на разбор
  const selectWorstExercise = () => {
    if (!bbPlan) {
      setToast('Нет плана ББ — собери в ББ-авто');
      setTimeout(() => setToast(''), 2000);
      return;
    }
    let worst: { id: string; name: string; score: number } | null = null;
    try {
      const LEGS = new Set(['quads', 'hamstrings', 'glutes', 'calves', 'legs']);
      for (const w of (bbPlan.weeks || [])) {
        for (const s of (w.sessions || [])) {
          for (const ex of (s.exercises || [])) {
            const id = String((ex as any).exerciseName || (ex as any).id || '');
            const name = String((ex as any).name || id);
            const muscle = String((ex as any).muscle || '');
            if (!id && !name) continue;
            let wh: string | null = null;
            try {
              const m = muscle.toLowerCase();
              for (const z of report.weakZonesGranular) {
                const h = weakHeadForZone(z);
                if (!h) continue;
                const hm = HEAD_FUNCTIONS[h]?.muscle || '';
                if (hm === m || (LEGS.has(hm) && LEGS.has(m))) { wh = h; break; }
              }
            } catch { /* noop */ }
            let sc = 100;
            try {
              sc = diagnoseExercise(
                { id: id || undefined, name, muscle, rir: (ex as any).rir ?? 2, tempo: (ex as any).tempo, pauseSeconds: (ex as any).pauseSeconds } as any,
                { muscle, weakHead: wh, level } as any,
              ).score;
            } catch { /* noop */ }
            if (!worst || sc < worst.score) worst = { id: id || name, name, score: sc };
          }
        }
      }
    } catch { /* noop */ }
    if (!worst) {
      setToast('В плане нет упражнений');
      setTimeout(() => setToast(''), 2000);
      return;
    }
    setState((st) => ({ ...st, exerciseSelectedId: worst!.id, stimCheating: false, stimShortRom: false, stimSetupNote: '' }));
    setToast(`🎯 Худшее в плане: ${worst.name} (${worst.score}/100) — разбираем`);
    setTimeout(() => setToast(''), 3000);
  };

  const takeMeasureSnapshot = () => {
    let meas: Record<string, number> = {};
    try {
      for (const [k, v] of Object.entries(state.circ)) {
        const n = parseFloat(v as string);
        if (Number.isFinite(n) && n > 0) meas[k] = n;
      }
    } catch { /* noop */ }
    if (!Object.keys(meas).length) {
      setToast('Введи хотя бы один замер — снимать нечего');
      setTimeout(() => setToast(''), 2000);
      return;
    }
    const entry = { date: localIsoDate(), meas };
    setMeasureHist((prev) => {
      const next = appendMeasureSnapshot(prev, entry);
      try { localStorage.setItem('he_bb_measure_history', JSON.stringify(next)); } catch { /* noop */ }
      return next;
    });
    setToast(`✓ Снимок замеров ${entry.date} сохранён`);
    setTimeout(() => setToast(''), 2500);
  };

  // 💉 Инъекция коррекций в сохранённый план (лениво — мемы ниже недоступны из-за TDZ).
  // Пишет he_bb_plan_saved (+снапшот he_bb_plan_saved_prev) и будит конструктор событием he-bb-plan-saved.
  const handleInjectToPlan = () => {
    try {
      const gate = assessBbRedFlags({ acutePain: state.acutePain, swelling: state.swelling, numbness: state.numbness, jointClickPain: state.jointClickPain });
      if (gate.blocked) {
        setToast(`⛔ ${gate.text}`);
        setTimeout(() => setToast(''), 3000);
        return;
      }
      if (gate.active) {
        setToast(`⚠ ${gate.text} — вставляем только технику, без объёма`);
        setTimeout(() => setToast(''), 3000);
      }
    } catch { /* noop */ }
    const zones = report.weakZonesGranular.slice(0, 2);
    if (!zones.length) {
      setToast('Выбери 1-2 слабые зоны — нечего вставлять');
      setTimeout(() => setToast(''), 2000);
      return;
    }
    let raw: string | null = null;
    try { raw = localStorage.getItem('he_bb_plan_saved'); } catch { /* noop */ }
    if (!raw) {
      setToast('Нет плана ББ — собери в ББ-авто, потом вставляй коррекции');
      setTimeout(() => setToast(''), 2500);
      return;
    }
    let parsed: any = null;
    try { parsed = JSON.parse(raw); } catch {
      setToast('План в хранилище битый — пересобери в ББ-авто');
      setTimeout(() => setToast(''), 2500);
      return;
    }
    const plan = pickPlanFromSaved(parsed);
    if (!plan) {
      setToast('План не распознан — пересобери в ББ-авто');
      setTimeout(() => setToast(''), 2500);
      return;
    }
    // dayMap/targetSets из спец-блока, темп из PROF, упражнения из топ-3
    let dayMap: Record<string, number[]> | undefined;
    let specWeeks: Array<{ targetSets: Record<string, number> }> = [];
    try {
      const sb = specBlock;
      if (sb) {
        dayMap = sb.dayMap;
        specWeeks = sb.weeks || [];
      }
    } catch { /* noop */ }
    const profTempo: Record<string, string> = {};
    for (const z of zones) {
      try {
        const p = getProfExecutionProfile(z) || getProfExecutionProfile(canonicalMuscle(z));
        if (p?.tempo) profTempo[z] = p.tempo;
      } catch { /* noop */ }
    }
    const preferredIds: Record<string, string> = {};
    const corrective: Record<string, { sets?: number; reps?: number; rir?: number; tempo?: string; label?: string }> = {};
    for (const z of zones) {
      try {
        // PRO-CORR: библиотека первична (зона+причина+сигналы+доза); каталоговый топ-3 — fallback.
        const lib = (correctiveTopByZone[z] || [])[0];
        if (lib) {
          const dose = correctiveDose(lib.corr, (weakCauses as any)?.[z]?.cause ?? null, corrDoseFlags());
          preferredIds[z] = lib.corr.exerciseId;
          corrective[z] = { sets: dose.sets, reps: dose.repsMin, rir: dose.rir, tempo: dose.tempo, label: `${lib.corr.title} · ${dose.note}` };
          profTempo[z] = dose.tempo;
          continue;
        }
        const top = (top3ByZone[z] || [])[0];
        if (top) preferredIds[z] = top.id;
      } catch { /* noop */ }
    }
    let working: any = plan;
    let injected = 0;
    let skippedBudget = 0;
    let onlyTechSkip = false;
    const nWeeks = Array.isArray(working.weeks) ? working.weeks.length : 0;
    for (let wi = 0; wi < nWeeks; wi++) {
      if (!working.weeks[wi] || working.weeks[wi].deload) continue;
      const sw = specWeeks[wi] || specWeeks[specWeeks.length - 1];
      const targetSets: Record<string, number> = {};
      if (sw) for (const z of zones) {
        const v = Number((sw.targetSets as any)?.[z]);
        if (Number.isFinite(v)) targetSets[z] = v;
      }
      try {
        // PRO-3 R2 + S3: готовность + возврат + L/R-добивка двигают вставку (не мезоцикл)
        const baseRir = readiness?.level === 'red' ? 1 : 0;
        const baseVol = readiness?.level === 'red' ? 0.75 : 1;
        const retAct = returnActive?.action ?? null;
        const rirShift = baseRir + (retAct ? retAct.rirShift : 0);
        const volumeMult = baseVol * (retAct ? retAct.volumeMult : 1);
        if (retAct && retAct.volumeMult <= 0) {
          onlyTechSkip = true;
          skippedBudget++;
          continue;
        }
        const unilateralTopUp: Record<string, { side: 'left' | 'right'; sets: number }> = {};
        try {
          if (!retAct || retAct.volumeMult > 0) {
            for (const v of lrVerdicts) {
              if ((v.verdict === 'topup' || v.verdict === 'watch') && v.weakSide) {
                unilateralTopUp[v.group] = { side: v.weakSide, sets: Math.max(1, Math.min(3, v.topUpSets)) };
              }
            }
          }
        } catch { /* noop */ }
        const r = injectBBWeakPoints(working, zones, { dayMap, targetSets, profTempo, preferredIds, corrective, weekIdxs: [wi], rirShift, volumeMult, unilateralTopUp, returnAction: retAct ?? undefined });
        working = r.plan;
        injected += r.injected;
        skippedBudget += r.skippedBudget;
      } catch { /* noop */ }
    }
    if (!injected) {
      setToast(onlyTechSkip
        ? '↩ Ступень 1 — вставка без силового объёма (только техника). Выбери ступень 2–3, когда боли нет'
        : `⊘ Не вставлено (бюджет переполнен: ${skippedBudget} · или уже есть в днях)`);
      setTimeout(() => setToast(''), 3000);
      return;
    }
    // Снапшот — только при реальном изменении + журнал последних (для отката на N шагов)
    try {
      localStorage.setItem('he_bb_plan_saved_prev', raw as string);
      const next = pushPlanSnapshot(planHistory, {
        date: localIsoDate(),
        label: `до вставки: ${zones.map(weakRu).join(', ')}`,
        plan,
      });
      localStorage.setItem('he_bb_plan_history', JSON.stringify(next));
    } catch { /* noop */ }
    try {
      working.rationale = [...(working.rationale || []), `ББ-диагностика: вставка коррекций (${zones.map(weakRu).join(', ')})`];
      localStorage.setItem('he_bb_plan_saved', JSON.stringify({ plan: working, date: new Date().toISOString() }));
    } catch {
      setToast('Не влезло в хранилище — очисти старые планы');
      setTimeout(() => setToast(''), 2500);
      return;
    }
    setHasInjectPrev(true);
    setPlanNonce((n) => n + 1);
    try { window.dispatchEvent(new Event('he-bb-plan-saved')); } catch { /* noop */ }
    setToast(`✓ Вставлено коррекций: ${injected} (нед: ${nWeeks}) · открыт ББ-авто`);
    setTimeout(() => setToast(''), 3000);
    try {
      window.dispatchEvent(new CustomEvent('planning-track-open', { detail: 'bb' } as any));
      localStorage.setItem('he_training_planning_track', 'bb');
    } catch { /* noop */ }
  };

  const handleRollbackInject = () => {
    try {
      const prev = localStorage.getItem('he_bb_plan_saved_prev');
      if (!prev) return;
      localStorage.setItem('he_bb_plan_saved', prev);
      localStorage.removeItem('he_bb_plan_saved_prev');
    } catch { /* noop */ }
    setHasInjectPrev(false);
    setPlanNonce((n) => n + 1);
    try { window.dispatchEvent(new Event('he-bb-plan-saved')); } catch { /* noop */ }
    setToast('↩ План восстановлен до инъекции');
    setTimeout(() => setToast(''), 2500);
  };

  // Э5-доводка (R6): журнал плана — одно чтение на рендер (инъекция/откат бампят planNonce)
  const planHistory = useMemo(() => {
    try { return readPlanHistory(localStorage.getItem('he_bb_plan_history')); } catch { return []; }
  }, [planNonce]);

  const handleRestoreSnapshot = (idx: number) => {
    const snap: PlanSnapshot | null = planHistory[idx] || null;
    if (!snap) return;
    try {
      localStorage.setItem('he_bb_plan_saved', JSON.stringify({ plan: snap.plan, date: new Date().toISOString() }));
    } catch {
      setToast('Не влезло в хранилище — очисти старые планы');
      setTimeout(() => setToast(''), 2500);
      return;
    }
    setPlanNonce((n) => n + 1);
    try { window.dispatchEvent(new Event('he-bb-plan-saved')); } catch { /* noop */ }
    setToast(`↩ Восстановлен снимок ${snap.date} (${snap.label || 'без метки'})`);
    setTimeout(() => setToast(''), 2500);
  };

  return (
    <div className="train-bbdiag" data-bb="hub-root" style={{ padding: '6px 6px 12px', color: '#fff', maxWidth: 860, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ ...CARD, padding: '10px 10px 8px', margin: 0, background: 'linear-gradient(135deg,rgba(0,230,138,0.12),rgba(168,85,247,0.08))', border: '1px solid rgba(0,230,138,0.22)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -18, right: -18, width: 110, height: 110, borderRadius: 110, background: 'radial-gradient(circle,rgba(0,230,138,0.14),transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg,#00e68a,#a855f7)', color: '#fff', fontWeight: 900, fontSize: 16 }}>💪</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 900, color: '#fff', lineHeight: 1 }}>Движения ББ — диагностика</div>
            <div style={{ fontSize: 10, color: '#fff', lineHeight: 1.3, opacity: 0.9 }}>Скрининг + разбор упражнения + стимул-карта + пропорции. Нагрузка — ⚡ Интеллект, объём — 📐 Объём-хаб, суставы — 🦴 Ортопедия (здесь только ссылки).</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div data-bb="score" style={{ width: 52, height: 52, borderRadius: 26, background: `conic-gradient(${sColor} ${score}%, rgba(255,255,255,0.06) 0)`, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `2px solid ${sColor}`, fontWeight: 900, color: '#fff', fontSize: 14 }}>{score}</div>
            <div style={{ fontSize: 9, color: sColor, fontWeight: 700, marginTop: 2 }}>{sLevel === 'ok' ? 'ОК' : sLevel === 'warn' ? 'ВНИМАНИЕ' : 'КРИТИЧНО'} · пров. {report.score.verification}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', fontSize: 10, marginBottom: 8 }}>
          <span style={{ padding: '2px 8px', borderRadius: 20, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: '#fff' }}>Драйвер: {moveDriver.driver === 'none' ? '—' : moveDriver.label}</span>
          <span style={{ padding: '2px 8px', borderRadius: 20, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: '#fff' }}>{report.weakMusclesCanonical.length ? `${report.weakMusclesCanonical.length} слабые` : 'баланс'}</span>
          <span style={{ padding: '2px 8px', borderRadius: 20, background: report.symmetry.score < 70 ? 'rgba(239,68,68,0.12)' : 'rgba(34,197,94,0.08)', border: '1px solid rgba(255,255,255,0.06)', color: report.symmetry.score < 70 ? '#ef4444' : '#22c55e' }}>Симметрия {report.symmetry.score}</span>
          <span style={{ padding: '2px 8px', borderRadius: 20, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: '#fff' }}>Стимул {report.stimulus.scorePenalty ? `−${report.stimulus.scorePenalty}` : 'порядок'}</span>
          {planAudit && <span style={{ padding: '2px 8px', borderRadius: 20, background: planAudit.avgSfr != null && planAudit.avgSfr < 3.5 ? 'rgba(239,68,68,0.12)' : 'rgba(34,197,94,0.08)', border: '1px solid rgba(255,255,255,0.06)', color: planAudit.avgSfr != null && planAudit.avgSfr < 3.5 ? '#ef4444' : '#22c55e' }}>SFR {planAudit.avgSfr ?? '—'}</span>}
          {planAudit && <span style={{ padding: '2px 8px', borderRadius: 20, background: planAudit.lengthenedRatio < 0.3 ? 'rgba(239,68,68,0.12)' : 'rgba(34,197,94,0.08)', border: '1px solid rgba(255,255,255,0.06)', color: planAudit.lengthenedRatio < 0.3 ? '#ef4444' : '#22c55e' }}>раст. {(planAudit.lengthenedRatio * 100).toFixed(0)}%</span>}
          {report.score.floors.length > 0 && <span style={{ padding: '2px 8px', borderRadius: 20, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.22)', color: '#ef4444' }}>порог: {report.score.floors[0]}</span>}
        </div>
        <div style={{ fontSize: 10, color: '#fff', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '8px 10px', lineHeight: 1.45 }}>
          Выбери слабые зоны + упражнение → разбор 12 признаков + «как дать в мышцу» → изменение эффекта. Кнопка <b style={{ color: '#00e68a' }}>«Применить в ББ-авто»</b> отправит зоны + технику/темп/замену в конструктор (стимул + растянутая позиция + рисунок движения).
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8, fontSize: 10 }}>
          <span style={{ padding: '4px 8px', borderRadius: 999, background: Object.keys(measNum).length >= 3 ? 'rgba(34,197,94,0.12)' : 'rgba(245,158,11,0.12)', border: '1px solid rgba(255,255,255,0.06)', color: Object.keys(measNum).length >= 3 ? '#22c55e' : '#f59e0b' }}>1.Замеры {Object.keys(measNum).length >= 3 ? '✓' : '→ Пропорции'}</span>
          <span style={{ padding: '4px 8px', borderRadius: 999, background: diarySessions.length >= 4 ? 'rgba(34,197,94,0.12)' : 'rgba(245,158,11,0.12)', border: '1px solid rgba(255,255,255,0.06)', color: diarySessions.length >= 4 ? '#22c55e' : '#f59e0b' }}>2.Дневник/план {diarySessions.length >= 4 ? `✓ ${diarySessions.length}` : '→ введи тренировки'}</span>
          <span style={{ padding: '4px 8px', borderRadius: 999, background: report.weakZonesGranular.length ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: report.weakZonesGranular.length ? '#22c55e' : '#fff' }}>3.Коррекция {report.weakZonesGranular.length ? `→ ${report.weakZonesGranular.join(', ')}` : '— выбери зону'}</span>
        </div>
        {toast && <div style={{ marginTop: 8, padding: '6px 10px', borderRadius: 8, background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.2)', color: '#22c55e', fontSize: 11 }}>{toast}</div>}
      </div>

      <div style={{ ...CARD, padding: 10, margin: 0 }} data-bb="tabs-card">
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }} data-bb="tabs-row">
          {TAB_DEFS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id as any)} aria-pressed={tab === t.id} data-bb="tab" data-active={tab === t.id ? '1' : '0'} style={{ minHeight: 44, padding: '8px 12px', borderRadius: 999, border: '1px solid', borderColor: tab === t.id ? '#00e68a' : 'rgba(255,255,255,0.12)', background: tab === t.id ? 'rgba(0,230,138,0.14)' : 'rgba(255,255,255,0.04)', color: tab === t.id ? '#00e68a' : '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
              {t.icon} {t.label}
            </button>
          ))}
          <button onClick={applyToConstructor} data-bb="apply-top" style={{ marginLeft: 'auto', minHeight: 44, padding: '10px 14px', borderRadius: 10, background: 'linear-gradient(135deg,#00e68a,#00c853)', color: '#06281c', border: 'none', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>→ В ББ-авто</button>
        </div>

        {tab === 'weak' && (
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#fff', marginBottom: 6 }}>Отстающие — зоны роста (1–2)</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
              {GRANULAR_OPTS.map(o => (
                <button key={o.id} onClick={() => toggleWeak(o.id)} aria-pressed={state.weakManual.includes(o.id)} data-bb="weak-zone" data-active={state.weakManual.includes(o.id) ? '1' : '0'} style={{ minHeight: 44, padding: '8px 12px', borderRadius: 999, border: '1px solid', borderColor: state.weakManual.includes(o.id) ? '#00e68a' : 'rgba(255,255,255,0.12)', background: state.weakManual.includes(o.id) ? 'rgba(0,230,138,0.14)' : 'rgba(255,255,255,0.04)', color: state.weakManual.includes(o.id) ? '#00e68a' : '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>{o.label}</button>
              ))}
            </div>
            <div style={{ fontSize: 10, color: '#fff', marginBottom: 6 }}>Авто-кандидаты: {report.weakCandidates.length ? report.weakCandidates.map(c => `${MUSCLE_LABEL_RU[c.muscle] || c.muscle}${c.granular ? ` (${c.granular})` : ''} ${c.deltaPct}%`).join(' · ') : '— баланс (дневник/объём/замеры не выдали)'}</div>
            <div style={{ fontSize: 10, color: '#fff', background: '#0a1629', border: '1px solid #1f3a5f', borderRadius: 8, padding: '8px 10px' }}>
              Выбрано: {report.weakZonesGranular.join(', ') || '—'} → канонические: {report.weakMusclesCanonical.join(', ') || '—'} (×1.15 объём + бонус упражнения в ББ-авто)
            </div>
            {report.weakZonesGranular.length === 0 && lastWeakHeads.length > 0 && (
              <div style={{ marginTop: 6, padding: '8px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', fontSize: 10, color: '#fff', display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                <span>Прошлый разбор: {lastWeakHeads.map(weakRu).join(', ')}</span>
                <button onClick={() => setState((s) => ({ ...s, weakManual: lastWeakHeads.slice(0, 2) }))} data-bb="restore-weak" style={{ minHeight: 44, padding: '8px 12px', borderRadius: 10, background: 'rgba(0,230,138,0.12)', border: '1px solid rgba(0,230,138,0.22)', color: '#00e68a', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>↩ Вернуть в работу</button>
              </div>
            )}
            {report.weakZonesGranular.length > 0 && (
              <div style={{ marginTop: 6, display: 'grid', gap: 6 }}>
                {report.weakZonesGranular.slice(0, 2).map((z) => {
                  const c = weakCauses[z];
                  if (!c) return null;
                  const col = c.cause === 'recovery' ? '#ef4444' : c.cause === 'volume' ? '#f59e0b' : '#a78bfa';
                  const causeRuMap: Record<string, string> = { volume: 'объём', recovery: 'восстановление', technique: 'техника', strength: 'сила', mobility: 'подвижность', fatigue: 'усталость', activation: 'включение мышцы', genetics: 'особенности строения' };
                  const causeRu = causeRuMap[String(c.cause)] || String(c.cause);
                  return (
                    <div key={z} style={{ padding: '8px 10px', borderRadius: 8, background: `${col}0f`, border: `1px solid ${col}33`, fontSize: 10, lineHeight: 1.5 }}>
                      <b style={{ color: col }}>{weakRu(z)}: причина — {causeRu} ({Math.round(c.confidence * 100)}%)</b>
                      <div style={{ color: '#fff' }}>{c.evidence.join(' · ') || '—'}</div>
                      {(() => {
                        let t: { deltaPct: number; sessions: number } | null = null;
                        try { t = (e1rmTrend as any)[z] || (e1rmTrend as any)[canonicalMuscle(z)] || null; } catch { /* noop */ }
                        if (!t || !Number.isFinite(t.deltaPct)) {
                          if (diarySessions.length > 0) {
                            return <div style={{ color: '#fff' }}>Дневник e1RM: мало данных — нужны замеры 3+ нед назад для тренда</div>;
                          }
                          return null;
                        }
                        const arrow = t.deltaPct <= -5 ? '▼' : t.deltaPct <= 1 ? '►' : '▲';
                        const tcol = t.deltaPct <= -5 ? '#ef4444' : t.deltaPct <= 1 ? '#f59e0b' : '#22c55e';
                        return <div style={{ color: tcol }}>Дневник e1RM (28д): {arrow} {t.deltaPct}% · {t.sessions} зам.</div>;
                      })()}
                      <div style={{ color: '#fff' }}>Чинить: {c.fix}</div>
                      {top3ByZone[z] && top3ByZone[z].length > 0 && (
                        <div style={{ marginTop: 4, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {top3ByZone[z].map((r, i) => (
                            <span key={r.id} title={r.reason} style={{ padding: '2px 7px', borderRadius: 20, background: i === 0 ? 'rgba(0,230,138,0.12)' : 'rgba(255,255,255,0.04)', border: `1px solid ${i === 0 ? 'rgba(0,230,138,0.25)' : 'rgba(255,255,255,0.08)'}`, color: i === 0 ? '#00e68a' : '#fff', fontWeight: 700 }}>#{i + 1} {r.name} · {r.reason}</span>
                          ))}
                        </div>
                      )}
                      {correctiveTopByZone[z] && correctiveTopByZone[z].length > 0 && (
                        <div style={{ marginTop: 6, padding: '8px 10px', borderRadius: 8, background: 'rgba(0,230,138,0.06)', border: '1px solid rgba(0,230,138,0.22)' }} data-bb="corrective-card" data-zone={z}>
                          <b style={{ color: '#00e68a', fontSize: 11 }}>🛠 Коррекция по скринингам (доза + техника)</b>
                          {correctiveTopByZone[z].slice(0, 2).map((r) => {
                            // П2: те же флаги, что вставка (readiness-red/жёлтая боль) — «показано = вставится».
                            const dose = (() => { try { return correctiveDose(r.corr, (weakCauses as any)?.[z]?.cause ?? null, corrDoseFlags()); } catch { return null; } })();
                            return (
                              <div key={r.corr.id} style={{ marginTop: 6, fontSize: 10, lineHeight: 1.5, color: '#fff' }} data-bb="corrective-row" data-corr={r.corr.id}>
                                <b style={{ color: '#fff' }}>{r.corr.title}</b>
                                <div>Доза: {dose ? `${dose.sets}×${dose.repsMin}–${dose.repsMax} RIR${dose.rir} ${dose.tempo}` : `${r.corr.protocol.sets}×${r.corr.protocol.repsMin}–${r.corr.protocol.repsMax}`} · {r.why.join(' + ') || 'по зоне'}</div>
                                <div>Кью: {r.corr.cues.join(' · ')}</div>
                                <div>Дальше: {r.corr.progression} · Ре-тест: {r.corr.retest} ({r.corr.source})</div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            <div style={{ fontSize: 10, color: '#fff', marginTop: 6, background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.18)', borderRadius: 8, padding: '8px 10px' }}>
              Подсказка: две зоны одной мышцы (средняя + задняя дельты) — можно, плечи + зона — конфликт.
            </div>
            <div style={{ marginTop: 6, padding: '8px 10px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', fontSize: 11, lineHeight: 1.5 }} data-bb="lr-card">
              <b style={{ color: '#fff' }}>↔ Лево/право по дневнику (унилатеральные — своей стороне, штанга — поровну)</b>
              {lrVerdicts.length === 0 && <div style={{ color: '#fff', marginTop: 4 }}>Пока пусто — нужны унилатеральные сеты в дневнике (гантели, по одной стороне).</div>}
              {lrVerdicts.slice(0, 4).map((v) => (
                <div key={v.group} style={{ color: v.verdict === 'norm' ? '#22c55e' : v.verdict === 'watch' ? '#f59e0b' : '#ef4444', marginTop: 4 }}>
                  {MUSCLE_LABEL_RU[v.group] || v.group}: Л {v.left} · П {v.right}{v.asymPct != null ? ` · перекос ${v.asymPct}%` : ''} — {v.text}
                </div>
              ))}
              <div style={{ color: '#fff', marginTop: 4, fontSize: 10, opacity: 0.9 }} data-bb="lr-disclaimer">Перекос/LSI — ориентир приоритета, не прогноз травмы (BJSM 2025: LSI не различает безопасный возврат)</div>
            </div>
            {report.weakZonesGranular.length > 0 && (
              <div style={{ marginTop: 6, padding: '8px 10px', borderRadius: 8, background: '#0a1629', border: '1px solid #1f3a5f', fontSize: 10, lineHeight: 1.5 }}>
                <b style={{ color: ACCENT }}>Покрытие головок планом:</b>
                {!bbPlan && <div style={{ color: '#fff' }}>Нет плана ББ — собери в ББ-авто, покрытие появится здесь.</div>}
                {bbPlan && headCoverage.length === 0 && <div style={{ color: '#fff' }}>—</div>}
                {headCoverage.map((hc) => (
                  <div key={hc.head} style={{ color: hc.covered ? '#22c55e' : '#f59e0b', marginTop: 2 }}>
                    {hc.covered ? '✓' : '✗'} {hc.head}{hc.covered ? ` — ${hc.by.join(', ')}` : ' — нет упражнения в плане (см. топ-3 выше)'}
                  </div>
                ))}
              </div>
            )}
            {/* Движения, не нагрузка: скорость/LVP/сухожилия/возврат — в своих хабах, здесь только ссылки */}
            <div style={{ marginTop: 6, padding: '8px 10px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', fontSize: 11, lineHeight: 1.5 }} data-bb="pro3-card">
              <b style={{ color: '#fff' }}>🔗 Смежные хабы (без дублей)</b>
              <div style={{ color: '#fff', marginTop: 4, fontSize: 10, lineHeight: 1.5 }}>
                Скорость/VBT — <b>⚡ Анализ силы → VBT</b> · Сухожилия/возврат/боль — <b>🦴 Суставы и ортопедия</b> · Нагрузка/сон/готовность — <b>⚡ Интеллект</b> · Объём MEV/MRV — <b>📐 Объём-хаб</b> · Видеоразбор траектории — <b>ТА/СМ-хаб</b>
              </div>
              {mmcAdvice && (
                <div style={{ color: '#fff', marginTop: 4 }} data-bb="mmc-line">
                  {mmcAdvice.focus === 'internal' ? '🧠 Внутренний' : '🎯 Внешний'} фокус: {mmcAdvice.cue} — {mmcAdvice.text}
                </div>
              )}
              {lrDirection.length > 0 && (
                <div style={{ marginTop: 4 }} data-bb="lr-direction">
                  {lrDirection.map((d) => (
                    <div key={d.group} style={{ color: '#fff', marginTop: 2 }}>{d.text}</div>
                  ))}
                </div>
              )}
              <button onClick={handleSpecIcs} data-bb="export-ics" style={{ width: '100%', minHeight: 48, marginTop: 6, padding: '10px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>📅 Спец-блок (.ics)</button>
              <button onClick={handleAnnualApply} data-bb="annual-apply" style={{ width: '100%', minHeight: 48, marginTop: 6, padding: '10px 14px', borderRadius: 10, background: 'rgba(0,230,138,0.10)', border: '1px solid rgba(0,230,138,0.30)', color: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>🗓 Спец-блок → в годовой план</button>
            </div>
            {report.weakZonesGranular.length > 0 && (
              <div style={{ marginTop: 6, padding: '8px 10px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', fontSize: 11, lineHeight: 1.5 }} data-bb="stop-flags">
                <b style={{ color: '#fff' }}>⛔ Стоп-флаги вставки (скрининг, не диагноз)</b>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                  {([
                    ['acutePain', 'Острая боль', 'в суставе/мышце'],
                    ['swelling', 'Отёк', 'сустав опух'],
                    ['numbness', 'Онемение', 'покалывание'],
                    ['jointClickPain', 'Щелчки с болью', 'щёлкает и болит'],
                  ] as Array<['acutePain' | 'swelling' | 'numbness' | 'jointClickPain', string, string]>).map(([k, title, desc]) => (
                    <button
                      key={k}
                      type="button"
                      role="switch"
                      aria-checked={state[k]}
                      aria-pressed={state[k]}
                      aria-label={title}
                      data-bb="stop-flag"
                      data-on={state[k] ? '1' : '0'}
                      onClick={() => setState((s) => ({ ...s, [k]: !s[k] }))}
                      style={{
                        minHeight: 44, padding: '8px 12px', borderRadius: 999, border: '1px solid',
                        borderColor: state[k] ? '#ef4444' : 'rgba(255,255,255,0.12)',
                        background: state[k] ? 'rgba(239,68,68,0.14)' : 'rgba(255,255,255,0.04)',
                        color: state[k] ? '#ef4444' : '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                      }}
                    >
                      {title}
                    </button>
                  ))}
                </div>
                {(redFlags as any).active && (
                  <div style={{ marginTop: 6, color: '#fff' }} data-bb="stop-note">
                    {(redFlags as any).blocked ? '⛔ ' : '⚠ '}{(redFlags as any).text} — при сомнениях к врачу.
                  </div>
                )}
                <div style={{ fontSize: 10, color: '#fff', opacity: 0.85, marginTop: 4 }}>Полный суставной скрининг — <b>🦴 Суставы и ортопедия</b> (здесь только гейт вставки).</div>
              </div>
            )}
            {returnToPlan && (
              <div style={{ marginTop: 6, padding: '8px 10px', borderRadius: 10, background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.20)', fontSize: 11, lineHeight: 1.5 }} data-bb="return-card">
                <b style={{ color: '#fff' }}>🔄 Возврат в работу после стоп-флагов (ступени — только ручные)</b>
                <div style={{ color: '#fff', marginTop: 4, fontSize: 10 }}>{returnToPlan.text}</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                  {([['', 'Авто · ступень 1'], ['1', '1 · техника'], ['2', '2 · ×0.5 RIR+3'], ['3', '3 · полный']] as Array<[BBState['returnStage'], string]>).map(([v, label]) => (
                    <button
                      key={v || 'auto'}
                      type="button"
                      aria-pressed={(state.returnStage || '') === v}
                      aria-label={`Ступень возврата: ${label}`}
                      data-bb="return-stage"
                      data-active={(state.returnStage || '') === v ? '1' : '0'}
                      onClick={() => setState((s) => ({ ...s, returnStage: v }))}
                      style={{ minHeight: 44, padding: '8px 12px', borderRadius: 999, border: '1px solid', borderColor: (state.returnStage || '') === v ? '#f59e0b' : 'rgba(255,255,255,0.12)', background: (state.returnStage || '') === v ? 'rgba(245,158,11,0.14)' : 'rgba(255,255,255,0.04)', color: (state.returnStage || '') === v ? '#f59e0b' : '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                    >{label}</button>
                  ))}
                </div>
                {returnActive && (
                  <div style={{ color: '#fff', marginTop: 6, fontSize: 10 }} data-bb="return-active">
                    Активная: <b style={{ color: '#f59e0b' }}>{returnActive.title}</b> · {returnActive.volume} · {returnActive.rir}
                    {returnActive.action.volumeMult <= 0 ? ' — силовые коррекции не вставляются (только техника)' : ''}
                  </div>
                )}
                <div style={{ color: '#fff', marginTop: 4, fontSize: 10, opacity: 0.9 }}>
                  Правило боли (ПММ): во время ≤5/10 и к утру — как до нагрузки. Боль вернулась — назад на ступень. Ступень уехает в ББ-авто кнопкой «→ В ББ-авто» и учитывается при 💉.
                </div>
              </div>
            )}
            {report.weakZonesGranular.length > 0 && (
              <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                <button onClick={handleInjectToPlan} data-bb="inject" style={{ minHeight: 48, padding: '10px 14px', borderRadius: 10, background: 'linear-gradient(135deg,#00e68a,#00c853)', color: '#06281c', border: 'none', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>💉 Вставить коррекции в план</button>
                {hasInjectPrev && <button onClick={handleRollbackInject} data-bb="rollback" style={{ minHeight: 48, padding: '10px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>↩ Откатить вставку</button>}
              </div>
            )}
            {planHistory.length > 0 && (
              <div style={{ marginTop: 6, padding: '8px 10px', borderRadius: 8, background: '#0a1629', border: '1px solid #1f3a5f', fontSize: 10, lineHeight: 1.5 }}>
                <b style={{ color: ACCENT }}>🕓 Журнал плана ({planHistory.length}):</b>
                {planHistory.map((s, i) => (
                  <div key={`${s.date}-${i}`} style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 4, flexWrap: 'wrap' }}>
                    <span style={{ color: '#fff' }}>{s.date} · {s.label || 'снимок'}</span>
                    <button onClick={() => handleRestoreSnapshot(i)} data-bb="snapshot-restore" style={{ minHeight: 44, padding: '8px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>↩ Восстановить</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'symmetry' && (
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#fff', marginBottom: 6 }}>Пропорции — замеры (см) + лево/право + идеал Маккаллума</div>
            <div style={{ fontSize: 10, color: '#fff', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: '6px 8px', marginBottom: 6 }}>Пол/возраст/цикл — в <b>профиле</b> (здесь только сантиметры и дельты, без дублей).</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 6 }} data-bb="circ-main">
              {[{ k: 'heightCm', ru: 'Рост, см' }, { k: 'weightKg', ru: 'Вес, кг' }, { k: 'chest', ru: 'Грудь, см' }, { k: 'waist', ru: 'Талия, см' }, { k: 'hips', ru: 'Бёдра, см' }, { k: 'shoulderWidth', ru: 'Плечи (ширина), см' }, { k: 'neck', ru: 'Шея, см' }].map(({ k, ru }) => (
                <BbNum key={k} label={ru} value={state.circ[k] || ''} onChange={(v) => setState(s => ({ ...s, circ: { ...s.circ, [k]: v } }))} placeholder="—" step={0.5} />
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 6 }} data-bb="circ-lr">
              {[{ k: 'bicepL', ru: 'Бицепс левый, см' }, { k: 'bicepR', ru: 'Бицепс правый, см' }, { k: 'thighL', ru: 'Бедро левое, см' }, { k: 'thighR', ru: 'Бедро правое, см' }, { k: 'calfL', ru: 'Голень левая, см' }, { k: 'calfR', ru: 'Голень правая, см' }, { k: 'forearmL', ru: 'Предплечье левое, см' }, { k: 'forearmR', ru: 'Предплечье правое, см' }].map(({ k, ru }) => (
                <BbNum key={k} label={ru} value={state.circ[k] || ''} onChange={(v) => setState(s => ({ ...s, circ: { ...s.circ, [k]: v } }))} placeholder="—" step={0.5} />
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 6 }}>
              <BbNum label="Запястье, см (Маккаллум)" value={state.wristCm} onChange={(v) => setState(s => ({ ...s, wristCm: v }))} placeholder="17,5" step={0.5} />
              <span style={{ alignSelf: 'end' }}>{mcCallum && <span style={{ fontSize: 10, color: '#60a5fa' }}>Маккаллум: грудь {mcCallum.chest} · биц {mcCallum.bicep} · икры {mcCallum.calf} · талия {mcCallum.waist}</span>}</span>
              {triadDev != null && <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: triadDev >= 12 ? 'rgba(239,68,68,0.12)' : 'rgba(34,197,94,0.08)', border: '1px solid rgba(255,255,255,0.06)', color: triadDev >= 12 ? '#ef4444' : '#22c55e', alignSelf: 'end' }}>Триада шея=биц=икры Δ {triadDev}%</span>}
            </div>
            <div style={{ padding: '8px 10px', borderRadius: 8, background: report.symmetry.score < 70 ? 'rgba(239,68,68,0.08)' : 'rgba(34,197,94,0.08)', border: `1px solid ${report.symmetry.score < 70 ? 'rgba(239,68,68,0.18)' : 'rgba(34,197,94,0.18)'}`, marginBottom: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: report.symmetry.score < 70 ? '#ef4444' : '#22c55e' }}>Симметрия {report.symmetry.score}/100</div>
              <div style={{ fontSize: 10, color: '#fff' }}>{Object.entries(report.symmetry.ratios).map(([k, v]) => `${circRu(k)} ${typeof v === 'number' ? v.toFixed(2) : v}`).join(' · ') || '— замеры не введены'}</div>
              <div style={{ fontSize: 10, color: report.symmetry.score < 70 ? '#ef4444' : '#fff', marginTop: 4 }}>{report.symmetry.issues.join(' · ') || 'Пропорции в норме'}</div>
            </div>
            <div style={{ padding: '8px 10px', borderRadius: 8, background: '#0a1629', border: '1px solid #1f3a5f', marginBottom: 8 }}>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6, flexWrap: 'wrap' }}>
                <b style={{ fontSize: 11, color: '#fff' }}>📸 Трекинг замеров</b>
                <button onClick={takeMeasureSnapshot} data-bb="snapshot" style={{ minHeight: 44, padding: '8px 12px', borderRadius: 10, background: 'rgba(0,230,138,0.12)', border: '1px solid rgba(0,230,138,0.22)', color: '#00e68a', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Снимок сегодня</button>
                <span style={{ fontSize: 10, color: '#fff' }}>снимков: {measureHist.length} · перепроверка через ~4 нед</span>
              </div>
              {measureHist.length === 0 && <div style={{ fontSize: 10, color: '#fff' }}>Пока пусто — введи замеры и нажми «Снимок», дельты появятся здесь и в причинах (наследственность).</div>}
              {measureHist.length > 0 && (() => {
                const last = measureHist[measureHist.length - 1];
                const deltas = measureDeltas(last, measNum as any);
                const keys = Object.keys(deltas);
                if (!keys.length) return <div style={{ fontSize: 10, color: '#fff' }}>Снимок {last.date} — введи новые замеры для дельты.</div>;
                return (
                  <div>
                    <div style={{ fontSize: 10, color: '#fff', marginBottom: 4 }}>vs {last.date}:</div>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {keys.map((k) => {
                        const d = deltas[k];
                        const goodUp = k !== 'waist';
                        const good = d.deltaPct === 0 ? null : (d.deltaPct > 0) === goodUp;
                        const col = good == null ? '#fff' : good ? '#22c55e' : '#f59e0b';
                        return <span key={k} style={{ fontSize: 10, padding: '2px 7px', borderRadius: 20, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', color: col }}>{circRu(k)} {d.from}→{d.to} ({d.deltaPct > 0 ? '+' : ''}{d.deltaPct}%)</span>;
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {tab === 'exercise' && (
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#fff', marginBottom: 6 }}>Разбор — упражнение + техника → стимул в плане (подробно)</div>
            {/* Лента аудита */}
            {planAudit ? (
              <div style={{ padding: '8px 10px', borderRadius: 10, background: 'linear-gradient(135deg,rgba(0,230,138,0.08),rgba(168,85,247,0.06))', border: '1px solid rgba(0,230,138,0.16)', marginBottom: 8, fontSize: 10, lineHeight: 1.5 }}>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
                  <span style={{ padding: '2px 8px', borderRadius: 20, background: planAudit.avgSfr != null && planAudit.avgSfr < 3.5 ? 'rgba(239,68,68,0.12)' : 'rgba(34,197,94,0.08)', border: '1px solid rgba(255,255,255,0.06)', color: planAudit.avgSfr != null && planAudit.avgSfr < 3.5 ? '#ef4444' : '#22c55e', fontWeight: 700 }}>SFR {planAudit.avgSfr ?? '—'}/5 {planAudit.avgSfr != null && planAudit.avgSfr < 3.5 ? '⚠ низко' : 'порядок'}</span>
                  <span style={{ padding: '2px 8px', borderRadius: 20, background: planAudit.lengthenedRatio < 0.3 ? 'rgba(239,68,68,0.12)' : 'rgba(34,197,94,0.08)', border: '1px solid rgba(255,255,255,0.06)', color: planAudit.lengthenedRatio < 0.3 ? '#ef4444' : '#22c55e', fontWeight: 700 }}>растяж. {(planAudit.lengthenedRatio * 100).toFixed(0)}% {planAudit.lengthenedRatio < 0.3 ? '⚠ мало' : 'порядок'}</span>
                  <span style={{ padding: '2px 8px', borderRadius: 20, background: planAudit.unilateralRatio < 0.08 ? 'rgba(245,158,11,0.12)' : 'rgba(34,197,94,0.08)', border: '1px solid rgba(255,255,255,0.06)', color: planAudit.unilateralRatio < 0.08 ? '#f59e0b' : '#22c55e' }}>одност. {(planAudit.unilateralRatio * 100).toFixed(0)}% {planAudit.unilateralRatio < 0.08 ? '→ добавь' : 'порядок'}</span>
                  <span style={{ padding: '2px 8px', borderRadius: 20, background: planAudit.fatigueDensity > 1.35 ? 'rgba(239,68,68,0.12)' : 'rgba(34,197,94,0.08)', border: '1px solid rgba(255,255,255,0.06)', color: planAudit.fatigueDensity > 1.35 ? '#ef4444' : '#fff' }}>усталость {planAudit.fatigueDensity.toFixed(2)} {planAudit.fatigueDensity > 1.35 ? '⚠ высоко' : ''}</span>
                  <span style={{ padding: '2px 8px', borderRadius: 20, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: '#fff' }}>{planAudit.totalExercises} упр · {planAudit.totalSets} сетов</span>
                </div>
                {planAudit.flags.length > 0 && <div style={{ color: '#f59e0b', fontSize: 10 }}>Замечания: {planAudit.flags.map((f) => {
                  const base = String(f).split(':')[0];
                  const ru: Record<string, string> = { lowSFR: 'низкий стимул', midSFR: 'стимул средний', missingLengthened: 'мало растянутой', missingShortened: 'нет пиковой (сечка)', lowUnilateral: 'мало односторонних', highFatigue: 'усталость высокая', singleAngle: 'один угол' };
                  const tail = String(f).includes(':') ? ` (${String(f).split(':').slice(1).map((m) => MUSCLE_LABEL_RU[m] || m).join(', ')})` : '';
                  return `${ru[base] || f}${tail}`;
                }).join(' · ')}</div>}
                <div style={{ color: '#fff', marginTop: 2 }}>План: {bbPlan ? `${bbPlan.weeks?.length || 0} нед` : '— нет плана (собери в ББ-авто)'} · слабые: {weakListRu(report.weakZonesGranular) || '—'} · перекос {asymMax != null ? `${asymMax.toFixed(1)}%` : '—'}</div>
              </div>
            ) : (
              <div style={{ padding: '8px 10px', borderRadius: 8, background: '#0a1629', border: '1px solid #1f3a5f', fontSize: 10, color: '#fff', marginBottom: 8 }}>Нет плана ББ — собери в ББ-авто, тогда аудит портфеля появится здесь.</div>
            )}

            {/* Секция 1: Аудит портфеля по мышцам */}
            {planAudit && (
              <div style={{ marginBottom: 10, border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, overflow: 'hidden' }}>
                <div style={{ padding: '8px 10px', background: 'rgba(255,255,255,0.03)', fontSize: 11, fontWeight: 700, color: '#fff' }}>1 · Аудит портфеля по мышцам (каждое упражнение — максимально)</div>
                <div style={{ maxHeight: 260, overflowY: 'auto' }}>
                  {Object.entries(planAudit.byMuscle).map(([m, bm]) => (
                    <div key={m} style={{ padding: '8px 10px', borderTop: '1px solid rgba(255,255,255,0.04)', background: bm.totalSets >= 6 && bm.angleCoverage.covered === 1 ? 'rgba(239,68,68,0.04)' : 'transparent' }}>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 4 }}>
                        <b style={{ color: '#fff', fontSize: 11 }}>{MUSCLE_LABEL_RU[m] || m}</b>
                        <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 20, background: bm.avgSfr != null && bm.avgSfr < 3.5 ? 'rgba(239,68,68,0.12)' : 'rgba(34,197,94,0.08)', color: bm.avgSfr != null && bm.avgSfr < 3.5 ? '#ef4444' : '#22c55e' }}>SFR {bm.avgSfr ?? '—'}</span>
                        <span style={{ fontSize: 10, color: '#fff' }}>раст. {bm.lengthened}/{bm.totalSets} · сред. {bm.mid} · пик. {bm.shortened}</span>
                        <span style={{ fontSize: 10, color: bm.angleCoverage.missing.length ? '#f59e0b' : '#22c55e' }}>углы {bm.angleCoverage.covered}/{bm.angleCoverage.total} {bm.angleCoverage.missing.length ? `→ нет: ${bm.angleCoverage.missing.slice(0, 2).join(', ')}` : 'порядок'}</span>
                        <span style={{ fontSize: 10, color: bm.strictCoverage.missing.length ? '#f59e0b' : '#fff' }}>строгие {bm.strictCoverage.covered}/{bm.strictCoverage.total}</span>
                        <span style={{ fontSize: 10, color: bm.regionalCoverage.missing.length ? '#f59e0b' : '#fff' }}>подрег {bm.regionalCoverage.covered}/{bm.regionalCoverage.total}</span>
                        <span style={{ fontSize: 10, color: '#fff' }}>{bm.totalSets} сет · уни {bm.unilateral} · устал {bm.fatigueDensity.toFixed(2)}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {bm.exercises.map((eff, i) => {
                          const sc = exerciseEffectScore(eff);
                          const col = sc >= 70 ? '#22c55e' : sc >= 50 ? '#f59e0b' : '#ef4444';
                          return (
                            <span key={i} title={`${eff.name}: SFR ${eff.sfr ?? '—'} · ${eff.profile ?? '—'} · ${eff.angleClass ?? '—'} · ${eff.strictGroup?.key ?? '—'} · ${eff.jointStress ?? '—'} · tempo ${eff.note || '—'}`} style={{ padding: '3px 7px', borderRadius: 20, background: `${col}14`, border: `1px solid ${col}33`, color: col, fontSize: 10, fontWeight: 600, cursor: 'pointer' }} onClick={() => setState(s => ({ ...s, exerciseSelectedId: eff.id || eff.name, stimCheating: false, stimShortRom: false, stimSetupNote: '' }))}>
                              {eff.name} · СФР {eff.sfr ?? '—'} {eff.profile === 'lengthened' ? '📐' : eff.profile === 'short' ? '🔹' : '▪'} {eff.unilateral ? '↔' : ''} {eff.angleClass ? `·${eff.angleClass}` : ''} {eff.strictGroup ? `·${eff.strictGroup.key}` : ''} ·{sc}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Секция 2: Диагноз выбранного */}
            <div style={{ padding: '10px', borderRadius: 10, background: '#0a1629', border: '1px solid #1f3a5f', marginBottom: 10 }}>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6, flexWrap: 'wrap' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: ACCENT }}>2 · Диагноз упражнения (выбери из портфеля выше или из каталога)</div>
                <button onClick={selectWorstExercise} data-bb="worst" style={{ marginLeft: 'auto', minHeight: 44, padding: '8px 12px', borderRadius: 10, background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.25)', color: '#f59e0b', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>🎯 Худшее в плане</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 6, marginBottom: 6 }} data-bb="ex-search-row">
                <input
                  value={exQuery}
                  onChange={(e) => setExQuery(e.target.value)}
                  placeholder="Поиск упражнения (план — первыми)"
                  aria-label="Поиск упражнения"
                  data-bb="ex-search"
                  data-testid="bb-ex-search"
                  style={{ minHeight: 44, padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)', color: '#fff', fontSize: 16 }}
                />
                <button onClick={() => setExQuery('')} data-bb="ex-search-clear" aria-label="Очистить поиск" style={{ minHeight: 44, minWidth: 48, padding: '8px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>✕</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 6, marginBottom: 6 }} data-bb="ex-picker">
                <BbSheetSelect label="Упражнение" value={state.exerciseSelectedId || ''} onChange={(v) => setState(s => ({ ...s, exerciseSelectedId: v || null, stimCheating: false, stimShortRom: false, stimSetupNote: '' }))} testId="bb-exercise" options={exPickerOptions} />
                <button onClick={() => setState(s => ({ ...s, exerciseSelectedId: null, stimCheating: false, stimShortRom: false, stimSetupNote: '' }))} data-bb="ex-reset" style={{ minHeight: 44, minWidth: 64, padding: '8px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Сброс</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 6 }} data-bb="exec-cards">
                <BbCheckCard active={state.stimCheating} title="Читинг / раскачка" desc="включаю рывок корпусом" onToggle={() => setState(s => ({ ...s, stimCheating: !s.stimCheating }))} accent="#f59e0b" />
                <BbCheckCard active={state.stimShortRom} title="Амплитуда укорочена" desc="не довожу до конца" onToggle={() => setState(s => ({ ...s, stimShortRom: !s.stimShortRom }))} accent="#f59e0b" />
              </div>
              <div style={{ marginBottom: 6 }}><BbNum label="Отклонение в технике (например: локти вперёд)" value={state.stimSetupNote} onChange={(v) => setState(s => ({ ...s, stimSetupNote: v }))} placeholder="Опиши отклонение" /></div>
              {selectedDiagnosis?.stimulus?.record && selectedDiagnosis.stimulus.record.cheating.length > 0 && (
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6, alignItems: 'center' }}>
                  <span style={{ fontSize: 10, color: '#fff' }}>Проверь себя:</span>
                  {selectedDiagnosis.stimulus.record.cheating.map((ch, i) => {
                    const active = state.stimSetupNote.toLowerCase().includes(ch.deviation.toLowerCase().split(' ')[0]);
                    return (
                      <button
                        key={i}
                        title={`Если так делаешь — забирает: ${ch.steals}`}
                        onClick={() => setState((s) => {
                          const parts = s.stimSetupNote.split(',').map((p) => p.trim()).filter(Boolean);
                          const key = ch.deviation.toLowerCase().split(' ')[0];
                          const has = parts.some((p) => p.toLowerCase().includes(key));
                          const next = has ? parts.filter((p) => !p.toLowerCase().includes(key)) : [...parts, ch.deviation];
                          return { ...s, stimSetupNote: next.join(', ') };
                        })}
                        aria-pressed={active}
                        style={{ minHeight: 44, padding: '8px 12px', borderRadius: 20, border: '1px solid', borderColor: active ? '#f59e0b' : 'rgba(255,255,255,0.12)', background: active ? 'rgba(245,158,11,0.14)' : 'rgba(255,255,255,0.04)', color: active ? '#f59e0b' : '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                      >
                        {active ? '✓ ' : ''}{ch.deviation}
                      </button>
                    );
                  })}
                </div>
              )}
              {!selectedDiagnosis ? (
                <div style={{ fontSize: 10, color: '#fff' }}>Выбери упражнение — появится разбор 12 признаков + проверка техники + оценка 0–100.</div>
              ) : (
                <div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ padding: '4px 10px', borderRadius: 20, background: selectedDiagnosis.score >= 70 ? 'rgba(34,197,94,0.12)' : selectedDiagnosis.score >= 50 ? 'rgba(245,158,11,0.12)' : 'rgba(239,68,68,0.12)', border: `1px solid ${selectedDiagnosis.score >= 70 ? 'rgba(34,197,94,0.22)' : selectedDiagnosis.score >= 50 ? 'rgba(245,158,11,0.22)' : 'rgba(239,68,68,0.22)'}`, color: selectedDiagnosis.score >= 70 ? '#22c55e' : selectedDiagnosis.score >= 50 ? '#f59e0b' : '#ef4444', fontWeight: 800, fontSize: 11 }}>Оценка {selectedDiagnosis.score}/100</span>
                    <span style={{ fontSize: 10, color: '#fff' }}>{selectedDiagnosis.effect.name} · {MUSCLE_LABEL_RU[selectedDiagnosis.effect.muscle || ''] || selectedDiagnosis.effect.muscle || '—'} · СФР {selectedDiagnosis.effect.sfr ?? '—'} · {profileRu(selectedDiagnosis.effect.profile)} · {selectedDiagnosis.effect.angleClass ?? '—'} · {selectedDiagnosis.effect.strictGroup?.key ?? '—'} · {selectedDiagnosis.effect.jointStress ?? '—'} · {selectedDiagnosis.effect.unilateral ? '↔ одностороннее' : 'двустороннее'}</span>
                    {selectedProf && <span style={{ fontSize: 10, color: '#a78bfa' }}>Техника {selectedProf.label}: {selectedProf.cues[0]}</span>}
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
                    {selectedDiagnosis.flags.map(f => <span key={f} title={f} style={{ padding: '2px 7px', borderRadius: 20, background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.22)', color: '#f59e0b', fontSize: 10, fontWeight: 600 }}>{flagRu(f)}</span>)}
                    {selectedDiagnosis.flags.length === 0 && <span style={{ padding: '2px 7px', borderRadius: 20, background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.22)', color: '#22c55e', fontSize: 10 }}>Порядок — выполнение чистое</span>}
                  </div>
                  <div style={{ fontSize: 10, color: selectedDiagnosis.issues.length ? '#fbbf24' : '#22c55e', lineHeight: 1.5, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 8, padding: '6px 8px' }}>{selectedDiagnosis.issues.join(' · ') || 'Замечаний нет — эталон для ББ'}</div>
                  {selectedDiagnosis.profGaps.length > 0 && <div style={{ fontSize: 10, color: '#a78bfa', marginTop: 4, background: 'rgba(168,85,247,0.06)', border: '1px solid rgba(168,85,247,0.14)', borderRadius: 8, padding: '6px 8px' }}>Разрывы техники: {selectedDiagnosis.profGaps.map(g => g.issue).join(' · ')}</div>}
                  {selectedDiagnosis.stimulus && selectedDiagnosis.stimulus.score != null && (
                    <div style={{ fontSize: 10, marginTop: 4, background: 'rgba(0,230,138,0.05)', border: '1px solid rgba(0,230,138,0.14)', borderRadius: 8, padding: '6px 8px', lineHeight: 1.5 }}>
                      <b style={{ color: '#00e68a' }}>🎯 Стимул в цель: {selectedDiagnosis.stimulus.score}/100</b>
                      <span style={{ color: '#fff' }}> — {selectedDiagnosis.stimulus.headsHit.join(', ') || '—'}</span>
                      {selectedDiagnosis.stimulus.headsMissed.length > 0 && <span style={{ color: '#f59e0b' }}> · мимо: {selectedDiagnosis.stimulus.headsMissed.join(', ')}</span>}
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                        {Object.entries(selectedDiagnosis.stimulus.breakdown || {}).map(([k, v]) => (
                          <span key={k} style={{ padding: '1px 6px', borderRadius: 20, background: (v as number) >= 80 ? 'rgba(34,197,94,0.10)' : (v as number) >= 60 ? 'rgba(245,158,11,0.10)' : 'rgba(239,68,68,0.10)', color: (v as number) >= 80 ? '#22c55e' : (v as number) >= 60 ? '#f59e0b' : '#ef4444' }}>{k} {v}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {selectedProf && (selectedProf.setupChecklist || selectedProf.leakTo) && (
                    <div style={{ fontSize: 10, color: '#fff', marginTop: 4, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 8, padding: '6px 8px', lineHeight: 1.5 }}>
                      {selectedProf.setupChecklist && <div><b style={{ color: '#fff' }}>Сетап:</b> {selectedProf.setupChecklist.join(' · ')}</div>}
                      {selectedProf.leakTo && <div style={{ color: '#f87171' }}>Утечка: {selectedProf.leakTo}</div>}
                    </div>
                  )}
                  {selectedExRaw && (() => { try { const instr = buildExerciseInstructions({ exerciseId: selectedExRaw.id || undefined, exerciseName: selectedExRaw.name, muscle: selectedExRaw.muscle || undefined } as any); return <div style={{ fontSize: 10, color: '#fff', marginTop: 6, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 8, padding: '6px 8px', lineHeight: 1.4 }}><b style={{ color: '#fff' }}>Техника ({instr.source}) · паттерн {instr.pattern} · темп {instr.tempo} · {instr.order}</b><br />{instr.cues.slice(0, 3).join(' · ')}<br /><span style={{ color: '#f87171' }}>Ошибки: {instr.mistakes.slice(0, 3).join(' · ')}</span></div>; } catch { return null; } })()}
                </div>
              )}
            </div>

            {/* Секция 3: PROF-коррекция выполнения (центральная) */}
            {selectedDiagnosis && selectedProf && (
              <div style={{ padding: '10px', borderRadius: 10, background: 'linear-gradient(135deg,rgba(168,85,247,0.08),rgba(0,230,138,0.06))', border: '1px solid rgba(168,85,247,0.18)', marginBottom: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#a78bfa', marginBottom: 6 }}>3 · Техника выполнения — как дать именно в мышцу ({selectedProf.label})</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8, fontSize: 10 }}>
                  <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '6px 8px', border: '1px solid rgba(255,255,255,0.04)' }}><b style={{ color: '#fff' }}>Угол:</b> {selectedProf.angle || '—'}</div>
                  <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '6px 8px', border: '1px solid rgba(255,255,255,0.04)' }}><b style={{ color: '#fff' }}>Локти:</b> {selectedProf.elbow || '—'}</div>
                  <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '6px 8px', border: '1px solid rgba(255,255,255,0.04)' }}><b style={{ color: '#fff' }}>Лопатки:</b> {selectedProf.scapula || '—'}</div>
                  <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '6px 8px', border: '1px solid rgba(255,255,255,0.04)' }}><b style={{ color: '#fff' }}>Темп:</b> {selectedProf.tempo} · <b>ROM:</b> {selectedProf.rom}</div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                  {selectedProf.cues.map((c, i) => <span key={i} style={{ padding: '4px 8px', borderRadius: 20, background: 'rgba(0,230,138,0.08)', border: '1px solid rgba(0,230,138,0.14)', color: '#00e68a', fontSize: 10, fontWeight: 600 }}>{i + 1}. {c}</span>)}
                </div>
                <div style={{ fontSize: 10, color: '#f87171', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.12)', borderRadius: 8, padding: '6px 8px', marginBottom: 6 }}>Ошибки: {selectedProf.errors.join(' · ')}</div>
                <div style={{ fontSize: 10, color: '#a78bfa', background: 'rgba(168,85,247,0.06)', border: '1px solid rgba(168,85,247,0.14)', borderRadius: 8, padding: '6px 8px' }}>Связь с мышцей: {selectedProf.mindMuscle} · время под нагрузкой ↑, пауза в растянутой работает лучше</div>
                <button onClick={() => handleApplyExerciseCorrection({ type: 'modifyExecution', execCues: selectedProf.cues, reason: `Техника: ${selectedProf.label}`, confidence: 0.85, deltaPreview: `Проработка: ${selectedProf.label}` } as any, selectedExRaw?.id || null)} data-bb="apply-exec" style={{ marginTop: 8, width: '100%', minHeight: 48, padding: '10px 12px', borderRadius: 10, background: 'linear-gradient(135deg,#a78bfa,#7c3aed)', color: '#fff', border: 'none', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>▶ Применить технику в план</button>
              </div>
            )}

            {/* Секция 4: Коррекция упражнением (замена/дополнение) */}
            {selectedDiagnosis && selectedCorrections.length > 0 && (
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: ACCENT, marginBottom: 6 }}>4 · Коррекция упражнением → эффект (топ-3)</div>
                {selectedCorrections.slice(0, 3).map((a, i) => {
                  const delta = (() => { try { return simulateCorrection(bbPlan, a as any, selectedExRaw?.id || null); } catch { return null; } })();
                  return (
                    <div key={i} style={{ padding: '8px 10px', borderRadius: 10, background: i === 0 ? 'rgba(0,230,138,0.08)' : 'rgba(255,255,255,0.03)', border: `1px solid ${i === 0 ? 'rgba(0,230,138,0.18)' : 'rgba(255,255,255,0.06)'}`, marginBottom: 6 }}>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
                        <span style={{ padding: '2px 7px', borderRadius: 20, background: i === 0 ? '#00e68a' : 'rgba(255,255,255,0.08)', color: i === 0 ? '#06281c' : '#fff', fontWeight: 800, fontSize: 10 }}>#{i + 1} {a.type}</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>{a.targetName || a.tempo || a.execCues?.[0] || a.type}</span>
                        <span style={{ marginLeft: 'auto', fontSize: 10, padding: '2px 7px', borderRadius: 20, background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.18)', color: '#a78bfa' }}>увер. {(a.confidence * 100).toFixed(0)}%</span>
                      </div>
                      <div style={{ fontSize: 10, color: '#fff', lineHeight: 1.4, marginBottom: 4 }}>{a.reason}</div>
                      <div style={{ fontSize: 10, color: '#60a5fa', marginBottom: 6 }}>{a.deltaPreview} {delta?.summary ? `· Δ ${delta.summary}` : ''} {delta?.issuesResolved?.length ? `→ исправит: ${delta.issuesResolved.join(', ')}` : ''}</div>
                      <button onClick={() => handleApplyExerciseCorrection(a as any, selectedExRaw?.id || null)} data-bb="apply-correction" style={{ width: '100%', minHeight: 48, padding: '10px 12px', borderRadius: 10, background: i === 0 ? 'linear-gradient(135deg,#00e68a,#00c853)' : 'rgba(255,255,255,0.06)', color: i === 0 ? '#06281c' : '#fff', border: i === 0 ? 'none' : '1px solid rgba(255,255,255,0.08)', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>▶ Применить в ББ-авто</button>
                    </div>
                  );
                })}
                {selectedCorrections.length > 3 && (
                  <details style={{ fontSize: 10, color: '#fff' }}>
                    <summary style={{ cursor: 'pointer', color: ACCENT }}>Ещё {selectedCorrections.length - 3} коррекции</summary>
                    <div style={{ marginTop: 6 }}>
                      {selectedCorrections.slice(3).map((a, i) => (
                        <div key={i} style={{ padding: '6px 8px', borderRadius: 8, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', marginBottom: 4 }}>
                          <div style={{ fontWeight: 700, color: '#fff' }}>{a.type} {a.targetName || a.tempo || ''}</div>
                          <div style={{ color: '#fff' }}>{a.reason}</div>
                          <button onClick={() => handleApplyExerciseCorrection(a as any, selectedExRaw?.id || null)} data-bb="apply-correction-more" style={{ marginTop: 4, minHeight: 44, padding: '8px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Применить</button>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            )}

            {/* Секция 5: Библиотека */}
            <div style={{ padding: '8px 10px', borderRadius: 10, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: ACCENT, marginBottom: 6 }}>5 · Библиотека упражнений (подробно по каждому)</div>
              <div style={{ fontSize: 10, color: '#fff', marginBottom: 6 }}>Детали объёма — <b>📐 Объём-хаб → Объём</b> · качество плана — <b>→ Качество</b> · нагрузка — <b>⚡ Интеллект</b> (без дублей, здесь только выбор).</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 6 }} data-bb="lib-filters">
                <BbSheetSelect label="Стимул от " value={String(state.exerciseFilterSfr)} onChange={(v) => setState(s => ({ ...s, exerciseFilterSfr: parseInt(v) }))} options={[{ id: '0', label: 'Любой' }, { id: '4', label: '4 и выше' }, { id: '5', label: 'Только 5' }]} />
                <BbSheetSelect label="Профиль" value={state.exerciseFilterProfile} onChange={(v) => setState(s => ({ ...s, exerciseFilterProfile: v }))} options={[{ id: 'all', label: 'Все' }, { id: 'lengthened', label: 'Растянутая' }, { id: 'mid', label: 'Средняя' }, { id: 'short', label: 'Пиковая' }]} />
              </div>
              <div style={{ marginBottom: 6 }}><BbCheckCard active={state.exerciseFilterUnilateral} title="Только односторонние" desc="гантели, по одной стороне" onToggle={() => setState(s => ({ ...s, exerciseFilterUnilateral: !s.exerciseFilterUnilateral }))} /></div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', maxHeight: 160, overflowY: 'auto' }}>
                {exerciseLibraryFiltered.map(c => {
                  const eff = (() => { try { return calcExerciseEffect(c as any, {}); } catch { return null; } })();
                  const sc = eff ? exerciseEffectScore(eff) : 50;
                  const col = sc >= 70 ? '#22c55e' : sc >= 50 ? '#f59e0b' : '#ef4444';
                  const heads = (() => { try { return headsHitOf({ id: c.id, name: c.name }); } catch { return []; } })();
                  const hitsWeak = heads.some((h) => libWeakHeads.includes(h));
                  const bcol = hitsWeak ? '#00e68a' : col;
                  return (
                    <span key={c.id} title={`${c.name}: SFR ${eff?.sfr ?? '—'} · ${eff?.profile ?? '—'} · ${eff?.angleClass ?? '—'} · ${eff?.strictGroup?.key ?? '—'} · ${eff?.jointStress ?? '—'} · бьёт: ${heads.join(', ') || '—'}`} style={{ padding: '3px 7px', borderRadius: 20, background: hitsWeak ? 'rgba(0,230,138,0.12)' : `${col}12`, border: `1px solid ${bcol}${hitsWeak ? '' : '22'}`, color: hitsWeak ? '#00e68a' : col, fontSize: 10, fontWeight: hitsWeak ? 800 : 600, cursor: 'pointer' }} onClick={() => setState(s => ({ ...s, exerciseSelectedId: c.id, stimCheating: false, stimShortRom: false, stimSetupNote: '' }))}>
                      {hitsWeak ? '🎯 ' : ''}{c.name} · СФР {eff?.sfr ?? '—'} {eff?.profile === 'lengthened' ? '📐' : eff?.profile === 'short' ? '🔹' : '▪'} {eff?.unilateral ? '↔' : ''} ·{sc}
                    </span>
                  );
                })}
              </div>
            </div>

            {/* Секция 6: LVP-калибровка (Э6 PRO-5 — движок был без UI) */}
            <details data-bb="lvp-card" style={{ marginTop: 10, padding: '8px 10px', borderRadius: 10, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
              <summary style={{ cursor: 'pointer', minHeight: 44, display: 'flex', alignItems: 'center', fontSize: 11, fontWeight: 700, color: ACCENT }}>6 · ⚡ LVP-калибровка (индивидуальный профиль нагрузка–скорость)</summary>
              <div style={{ fontSize: 10, color: '#fff', marginTop: 6, lineHeight: 1.5 }}>
                3+ точки «вес скорость лучшего повтора», по одной в строке: «80 0.62» (кг, м/с). Профиль даёт индивидуальный e1RM при MVT движения (канон VBT).
                В мост/план не уходит — ориентир; сохранено профилей: {lvpSaved}.
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 6, marginTop: 6 }}>
                <BbSheetSelect label="Движение" value={lvpLift} onChange={setLvpLift} testId="bb-lvp-lift" options={[{ id: 'squat', label: 'Присед' }, { id: 'bench', label: 'Жим лёжа' }, { id: 'deadlift', label: 'Тяга' }, { id: 'ohp', label: 'Жим стоя' }, { id: 'row', label: 'Тяга в наклоне' }]} />
                <textarea value={lvpText} onChange={(e) => setLvpText(e.target.value)} placeholder={'80 0.62\n100 0.5\n120 0.4'} aria-label="Точки вес скорость" data-bb="lvp-text" data-testid="bb-lvp-text" style={{ minHeight: 72, padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)', color: '#fff', fontSize: 16, resize: 'vertical' }} />
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                <button onClick={runLvp} data-bb="lvp-run" style={{ minHeight: 48, padding: '10px 14px', borderRadius: 10, background: 'rgba(0,230,138,0.12)', border: '1px solid rgba(0,230,138,0.30)', color: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>📈 Калибровать</button>
                {lvpSaved > 0 && <button onClick={clearLvp} data-bb="lvp-clear" style={{ minHeight: 48, padding: '10px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Очистить профили</button>}
              </div>
              {lvpProfile && (
                <div data-bb="lvp-result" style={{ marginTop: 6, fontSize: 10, color: lvpProfile.valid ? '#22c55e' : '#f59e0b', lineHeight: 1.5 }}>
                  {lvpProfile.text}
                </div>
              )}
            </details>
          </div>
        )}

        {tab === 'stimulus' && (
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#fff', marginBottom: 6 }}>Стимул-карта — где теряется рост (из плана, без объёмов)</div>
            <div style={{ padding: '8px 10px', borderRadius: 8, background: '#0a1629', border: '1px solid #1f3a5f', marginBottom: 8 }}>
              <div style={{ fontSize: 10, color: '#fff' }}>Всего: растянутых {report.stimulus.global.lengthened} · средних {report.stimulus.global.midRange} · пиковых {report.stimulus.global.shortened} · база {report.stimulus.global.compound} / изоляция {report.stimulus.global.isolation}</div>
              <div style={{ fontSize: 10, color: report.stimulus.issues.length ? '#f59e0b' : '#22c55e', marginTop: 4 }}>{report.stimulus.issues.join(' · ') || 'Стимул сбалансирован'}</div>
              {report.stimulus.bfrEligible.length > 0 && <div style={{ fontSize: 10, color: '#a78bfa', marginTop: 4 }}>Жгуты подходят: {report.stimulus.bfrEligible.join(', ')} (20–30%, схема 30-15-15-15, пауза 30 с)</div>}
              <div style={{ fontSize: 10, color: '#fff', marginTop: 6 }} data-bb="stimulus-chip">Разбор каждого упражнения — во вкладке <b>🏋️ Разбор → Аудит портфеля</b> (здесь карта, без дублей).</div>
            </div>
            {planAudit ? (
              <div style={{ display: 'grid', gap: 6 }} data-bb="stimulus-map">
                {Object.entries(planAudit.byMuscle).map(([m, bm]) => {
                  const lenPct = bm.totalSets ? Math.round((bm.lengthened / bm.totalSets) * 100) : 0;
                  const badLen = bm.totalSets >= 6 && lenPct < 30;
                  const badAngle = bm.angleCoverage.total > 1 && bm.angleCoverage.covered === 1 && bm.totalSets >= 6;
                  const badStrict = bm.strictCoverage.total > 0 && bm.strictCoverage.covered === 0 && bm.totalSets >= 6;
                  const badShort = bm.totalSets >= 6 && bm.shortened === 0;
                  const col = badLen || badAngle || badStrict || badShort ? '#f59e0b' : '#22c55e';
                  return (
                    <div key={m} style={{ padding: '8px 10px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: `1px solid ${col}33`, fontSize: 10, lineHeight: 1.5 }}>
                      <b style={{ color: '#fff', fontSize: 11 }}>{MUSCLE_LABEL_RU[m] || m}</b>
                      <span style={{ color: col, marginLeft: 6 }}>{bm.totalSets} сет · SFR {bm.avgSfr ?? '—'} · раст. {lenPct}% · углы {bm.angleCoverage.covered}/{bm.angleCoverage.total} · строгие {bm.strictCoverage.covered}/{bm.strictCoverage.total}</span>
                      {(badLen || badAngle || badStrict || badShort) && (
                        <div style={{ color: '#fbbf24', marginTop: 2 }}>
                          Чинить: {[badLen ? 'добавь растянутую (наклон 30°/RDL/разводка с паузой)' : null, badAngle ? `второй угол (нет: ${bm.angleCoverage.missing.slice(0, 2).join(', ')})` : null, badStrict ? `строгая группа (нет: ${bm.strictCoverage.missing.slice(0, 2).join(', ')})` : null, badShort ? 'пиковая (сечка): добей изоляцией с паузой в пике' : null].filter(Boolean).join(' · ')}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ padding: '8px 10px', borderRadius: 8, background: '#0a1629', border: '1px solid #1f3a5f', fontSize: 10, color: '#fff' }}>Нет плана ББ — собери в ББ-авто, карта построится по упражнениям.</div>
            )}
            <div style={{ fontSize: 10, color: '#fff', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: '8px 10px', marginTop: 8 }}>
              План-баланс: {balance ? balance.issues.slice(0, 2).join(' · ') : '— нет плана (собери в ББ-авто)'} · Объёмы MEV/MRV — <b>📐 Объём-хаб</b> · Качество плана — <b>→ Качество</b>
            </div>
          </div>
        )}

        {tab === 'screening' && (
          <div data-bb="mobility-tab">
            <div style={{ fontSize: 12, fontWeight: 800, color: '#fff', marginBottom: 6 }}>Скрининг — присед с руками вверх (6 признаков) + одна нога + драйвер</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 6 }} data-bb="ohs-grid">
              <BbCheckCard active={state.ohsHeelsFlat} title="Пятки плоско" desc="стопы не отрываются" onToggle={() => setState(s => ({ ...s, ohsHeelsFlat: !s.ohsHeelsFlat }))} />
              <BbCheckCard active={!state.ohsKneeValgus} title="Без вальгуса" desc="колени не сводятся" onToggle={() => setState(s => ({ ...s, ohsKneeValgus: !s.ohsKneeValgus }))} />
              <BbCheckCard active={state.ohsHipBelowParallel} title="Таз ниже параллели" desc="глубина приседа" onToggle={() => setState(s => ({ ...s, ohsHipBelowParallel: !s.ohsHipBelowParallel }))} />
              <BbCheckCard active={state.ohsTrunkUpright} title="Корпус вертикально" desc="грудь вверх" onToggle={() => setState(s => ({ ...s, ohsTrunkUpright: !s.ohsTrunkUpright }))} />
              <BbCheckCard active={state.ohsArmsOverMidfoot} title="Руки над стопой" desc="руки над серединой стопы" onToggle={() => setState(s => ({ ...s, ohsArmsOverMidfoot: !s.ohsArmsOverMidfoot }))} />
              <BbCheckCard active={state.ohsLumbarNeutral} title="Нейтраль поясницы" desc="без округления" onToggle={() => setState(s => ({ ...s, ohsLumbarNeutral: !s.ohsLumbarNeutral }))} />
              <BbCheckCard active={!state.ppTilt} title="Таз без «подворота»" desc="глубина до нейтрали таза (не ФАИ-паттерн)" onToggle={() => setState(s => ({ ...s, ppTilt: !s.ppTilt }))} />
            </div>
            <div style={{ padding: '8px 10px', borderRadius: 10, background: ohs.level === 'ok' ? 'rgba(34,197,94,0.08)' : ohs.level === 'warn' ? 'rgba(245,158,11,0.08)' : 'rgba(239,68,68,0.08)', border: `1px solid ${ohs.level === 'ok' ? 'rgba(34,197,94,0.18)' : ohs.level === 'warn' ? 'rgba(245,158,11,0.18)' : 'rgba(239,68,68,0.18)'}`, marginBottom: 6 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: '#fff' }}>Присед-тест {ohs.totalScore}/6 · {ohs.level === 'ok' ? 'хорошо' : ohs.level === 'warn' ? 'есть замечания' : 'нужна работа'} · несдано {ohs.failed}{ohs.primaryDriver ? ` · ${ohs.primaryDriver}` : ''}</div>
              <div style={{ fontSize: 11, color: '#fff', marginTop: 4 }}>{ohs.recommendation}</div>
            </div>
            <div style={{ padding: '8px 10px', borderRadius: 10, background: 'rgba(0,230,138,0.07)', border: '1px solid rgba(0,230,138,0.16)', marginBottom: 6 }} data-bb="driver-card">
              <div style={{ fontSize: 12, fontWeight: 800, color: '#00e68a' }}>🎯 Драйвер: {moveDriver.label} ({Math.round(moveDriver.confidence * 100)}%)</div>
              <div style={{ fontSize: 11, color: '#fff', marginTop: 4 }}>{moveDriver.fix}</div>
              <div style={{ marginTop: 6 }}>
                <BbCheckCard active={state.handsOnHipsBetter} title="Руки на бёдрах чистят поясницу" desc="присед с руками на бёдрах лучше — виноваты широчайшие" onToggle={() => setState((s) => ({ ...s, handsOnHipsBetter: !s.handsOnHipsBetter }))} accent="#60a5fa" />
              </div>
            </div>
            <div style={{ padding: '8px 10px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', marginBottom: 6 }} data-bb="single-leg">
              <div style={{ fontSize: 12, fontWeight: 800, color: '#fff', marginBottom: 6 }}>Одна нога — сплит-присед + RDL (5 повторов на сторону, качество)</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 6 }}>
                <BbSheetSelect label="Сплит-присед Л" value={state.splitL} onChange={(v) => setState((s) => ({ ...s, splitL: v as any }))} options={[{ id: '', label: 'Не проверял' }, { id: 'pass', label: 'Чисто' }, { id: 'fail', label: 'Гуляет' }]} testId="bb-split-l" />
                <BbSheetSelect label="Сплит-присед П" value={state.splitR} onChange={(v) => setState((s) => ({ ...s, splitR: v as any }))} options={[{ id: '', label: 'Не проверял' }, { id: 'pass', label: 'Чисто' }, { id: 'fail', label: 'Гуляет' }]} testId="bb-split-r" />
                <BbSheetSelect label="RDL на ноге Л" value={state.rdlL} onChange={(v) => setState((s) => ({ ...s, rdlL: v as any }))} options={[{ id: '', label: 'Не проверял' }, { id: 'pass', label: 'Чисто' }, { id: 'fail', label: 'Гуляет' }]} testId="bb-rdl-l" />
                <BbSheetSelect label="RDL на ноге П" value={state.rdlR} onChange={(v) => setState((s) => ({ ...s, rdlR: v as any }))} options={[{ id: '', label: 'Не проверял' }, { id: 'pass', label: 'Чисто' }, { id: 'fail', label: 'Гуляет' }]} testId="bb-rdl-r" />
              </div>
              <div style={{ fontSize: 11, color: singleLeg.weakSide ? '#f59e0b' : '#22c55e' }} data-bb="single-leg-verdict">{singleLeg.text}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 6 }}>
                <BbNum label="Угломер FPPA Л, ° (необязательно)" value={state.fppaL} onChange={(v) => setState(s => ({ ...s, fppaL: v }))} placeholder="—" step={1} testId="bb-fppa-l" />
                <BbNum label="Угломер FPPA П, ° (необязательно)" value={state.fppaR} onChange={(v) => setState(s => ({ ...s, fppaR: v }))} placeholder="—" step={1} testId="bb-fppa-r" />
              </div>
              <div style={{ fontSize: 10, color: '#fff', opacity: 0.85, marginTop: 4 }}>Угломер — только tiebreak при чистой качественной оценке (разрыв ≥10°). Без угломера вердикт не меняется.</div>
            </div>
            <div style={{ padding: '8px 10px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', marginBottom: 6 }} data-bb="shoulder-screen">
              <div style={{ fontSize: 12, fontWeight: 800, color: '#fff', marginBottom: 6 }}>Плечо у стены + ротация грудного (жим/ОHP-зона)</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 6 }}>
                <BbCheckCard active={state.shBackOnWall} title="Спина на стене" desc="пятки/ягодицы/лопатки плотно" onToggle={() => setState((s) => ({ ...s, shBackOnWall: !s.shBackOnWall }))} />
                <BbCheckCard active={state.shHeadOnWall} title="Голова на стене" desc="затылок касается, поясница плоская" onToggle={() => setState((s) => ({ ...s, shHeadOnWall: !s.shHeadOnWall }))} />
                <BbCheckCard active={state.shBicepsAtEars} title="Бицепс у ушей" desc="руки вверх без ухода вперёд" onToggle={() => setState((s) => ({ ...s, shBicepsAtEars: !s.shBicepsAtEars }))} />
                <BbCheckCard active={state.shRibsDown} title="Рёбра вниз" desc="поясница не прогибается" onToggle={() => setState((s) => ({ ...s, shRibsDown: !s.shRibsDown }))} />
                <BbCheckCard active={state.shNoShrug} title="Без шрагов" desc="плечи не к ушам" onToggle={() => setState((s) => ({ ...s, shNoShrug: !s.shNoShrug }))} />
              </div>
              <div style={{ fontSize: 11, color: shoulderV.pass ? '#22c55e' : '#f59e0b' }} data-bb="shoulder-verdict">{shoulderV.text}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 6 }}>
                <BbNum label="Ротация грудного Л, °" value={state.rotL} onChange={(v) => setState(s => ({ ...s, rotL: v }))} placeholder="50" step={1} testId="bb-rot-l" />
                <BbNum label="Ротация грудного П, °" value={state.rotR} onChange={(v) => setState(s => ({ ...s, rotR: v }))} placeholder="50" step={1} testId="bb-rot-r" />
              </div>
              <div style={{ fontSize: 11, color: '#fff', marginTop: 4 }} data-bb="rot-verdict">{rotV.text}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 6 }}>
                <BbNum label="ER кг (ручной динам.)" value={state.erKg} onChange={(v) => setState(s => ({ ...s, erKg: v }))} placeholder="—" step={0.5} testId="bb-er-kg" />
                <BbNum label="IR кг (ручной динам.)" value={state.irKg} onChange={(v) => setState(s => ({ ...s, irKg: v }))} placeholder="—" step={0.5} testId="bb-ir-kg" />
              </div>
              <div style={{ fontSize: 11, color: erIrV.warn ? '#f59e0b' : '#fff', marginTop: 4 }} data-bb="erir-verdict">{erIrV.text}</div>
              {!teenGate.blocked && <div style={{ fontSize: 10, color: '#fff', opacity: 0.85, marginTop: 4 }} data-bb="erir-disclaimer">{ERIR_DISCLAIMER}</div>}
              <div style={{ fontSize: 10, color: '#fff', opacity: 0.85, marginTop: 4 }}>Норма ротации ≥50°/сторона, разрыв ≥10° — чинить слабую. Тест стоя у стены, руки вверх, 3 повтора.</div>
            </div>
            <div style={{ padding: '8px 10px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', marginBottom: 6 }} data-bb="hinge-screen">
              <div style={{ fontSize: 12, fontWeight: 800, color: '#fff', marginBottom: 6 }}>Шарнир (палка) + присед под нагрузкой</div>
              <BbSheetSelect label="Палка: затылок/лопатки/крестец" value={state.hingeDowel} onChange={(v) => setState((s) => ({ ...s, hingeDowel: v as any }))} options={[{ id: '', label: 'Не проверял' }, { id: 'full', label: 'Держится (3 точки)' }, { id: 'lumbar_loss', label: 'Поясница отрывается' }, { id: 'neck_loss', label: 'Затылок отрывается' }, { id: 'both', label: 'Теряются обе' }]} testId="bb-hinge" />
              <div style={{ fontSize: 11, color: hingeV.pass ? '#22c55e' : '#f59e0b', marginTop: 4 }} data-bb="hinge-verdict">{hingeV.text}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginTop: 6 }}>
                <BbSheetSelect label="Присед без веса" value={state.sqBody} onChange={(v) => setState((s) => ({ ...s, sqBody: v as any }))} options={[{ id: '', label: '—' }, { id: 'pass', label: 'Чисто' }, { id: 'fail', label: 'Плывёт' }]} testId="bb-sq-body" />
                <BbSheetSelect label="Гриф 20 кг" value={state.sqBar} onChange={(v) => setState((s) => ({ ...s, sqBar: v as any }))} options={[{ id: '', label: '—' }, { id: 'pass', label: 'Чисто' }, { id: 'fail', label: 'Плывёт' }]} testId="bb-sq-bar" />
                <BbSheetSelect label="Рабочий вес" value={state.sqWork} onChange={(v) => setState((s) => ({ ...s, sqWork: v as any }))} options={[{ id: '', label: '—' }, { id: 'pass', label: 'Чисто' }, { id: 'fail', label: 'Плывёт' }]} testId="bb-sq-work" />
              </div>
              <div style={{ fontSize: 11, color: loadedV.degraded ? '#f59e0b' : '#fff', marginTop: 4 }} data-bb="loaded-verdict">{loadedV.text}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 6 }}>
                <BbSheetSelect label="RDL под весом" value={state.rdlLoaded} onChange={(v) => setState((s) => ({ ...s, rdlLoaded: v as any }))} options={[{ id: '', label: '—' }, { id: 'pass', label: 'Нейтраль держится' }, { id: 'fail', label: 'Поясница уходит' }]} testId="bb-rdl-loaded" />
                <BbSheetSelect label="Тяга с пола" value={state.floorLoaded} onChange={(v) => setState((s) => ({ ...s, floorLoaded: v as any }))} options={[{ id: '', label: '—' }, { id: 'pass', label: 'Нейтраль держится' }, { id: 'fail', label: 'Поясница уходит' }]} testId="bb-floor-loaded" />
              </div>
              <div style={{ fontSize: 11, color: loadedHingeV.degraded ? '#f59e0b' : '#fff', marginTop: 4 }} data-bb="loaded-hinge-verdict">{loadedHingeV.text}</div>
              {!teenGate.blocked && <div style={{ fontSize: 10, color: '#fff', opacity: 0.85, marginTop: 4 }} data-bb="hinge-load-note">{HINGE_LOAD_NOTE}</div>}
            </div>
            <div style={{ padding: '8px 10px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', marginBottom: 6 }} data-bb="ybt-screen">
              <div style={{ fontSize: 12, fontWeight: 800, color: '#fff', marginBottom: 6 }}>YBT-баланс (anterior, босиком)</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                <BbNum label="Anterior Л, см" value={state.ybtL} onChange={(v) => setState(s => ({ ...s, ybtL: v }))} placeholder="—" step={0.5} testId="bb-ybt-l" />
                <BbNum label="Anterior П, см" value={state.ybtR} onChange={(v) => setState(s => ({ ...s, ybtR: v }))} placeholder="—" step={0.5} testId="bb-ybt-r" />
                <BbNum label="Голень, см" value={state.shinCm} onChange={(v) => setState(s => ({ ...s, shinCm: v }))} placeholder="—" step={0.5} testId="bb-shin" />
              </div>
              <div style={{ fontSize: 11, color: ybtV.warn ? '#f59e0b' : '#fff', marginTop: 4 }} data-bb="ybt-verdict">{ybtV.text}</div>
              <div style={{ fontSize: 10, color: '#fff', opacity: 0.85, marginTop: 4 }} data-bb="ybt-disclaimer">{YBT_DISCLAIMER} · пороги: асим &gt;4 см, композит &lt;94%.</div>
              <div style={{ fontSize: 11, color: '#fff', marginTop: 4 }} data-bb="asym-priority">{asymText}</div>
            </div>
            <div style={{ padding: '8px 10px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', marginBottom: 6 }} data-bb="bench-screen">
              <div style={{ fontSize: 12, fontWeight: 800, color: '#fff', marginBottom: 6 }}>Жим лёжа — хват и техника (главный плечевой риск)</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 6 }}>
                <BbNum label="Хват, см (между указательными)" value={state.benchGripCm} onChange={(v) => setState(s => ({ ...s, benchGripCm: v }))} placeholder="—" step={1} testId="bb-bench-grip" />
                <BbNum label="Отведение плеча, °" value={state.benchAbduction} onChange={(v) => setState(s => ({ ...s, benchAbduction: v }))} placeholder="—" step={1} testId="bb-bench-abd" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 6 }}>
                <BbSheetSelect label="Точка касания" value={state.benchTouch} onChange={(v) => setState((s) => ({ ...s, benchTouch: v as any }))} options={[{ id: '', label: 'Не проверял' }, { id: 'nipple', label: 'Линия сосков' }, { id: 'upper_abs', label: 'Живот (арка)' }, { id: 'neck', label: 'У шеи' }]} testId="bb-bench-touch" />
                <BbSheetSelect label="Лопатки" value={state.benchScapula} onChange={(v) => setState((s) => ({ ...s, benchScapula: v as any }))} options={[{ id: '', label: '—' }, { id: 'retracted', label: 'Сведены' }, { id: 'neutral', label: 'Нейтрально' }, { id: 'released', label: 'Распущены' }]} testId="bb-bench-scapula" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 6 }}>
                <BbCheckCard active={!state.benchElbowsBelow} title="Локти не ниже скамьи" desc="плечо в безопасном коридоре" onToggle={() => setState(s => ({ ...s, benchElbowsBelow: !s.benchElbowsBelow }))} />
                <BbCheckCard active={!state.benchPain} title="Без боли в жиме" desc="боль → техника + правило боли" accent="#ef4444" onToggle={() => setState(s => ({ ...s, benchPain: !s.benchPain }))} />
              </div>
              <div style={{ fontSize: 11, color: benchV.level === 'fix' ? '#f59e0b' : '#fff' }} data-bb="bench-verdict">{benchV.text}</div>
              {benchCorrections(benchV).length > 1 && (
                <ul style={{ margin: '4px 0 0', paddingLeft: 18, fontSize: 10, color: '#fff', lineHeight: 1.5 }} data-bb="bench-fixes">
                  {benchCorrections(benchV).map((f, i) => <li key={i}>{f}</li>)}
                </ul>
              )}
              <div style={{ fontSize: 10, color: '#fff', opacity: 0.85, marginTop: 4 }} data-bb="bench-disclaimer">{BENCH_DISCLAIMER}{benchV.gripBaw != null ? ` · хват ${benchV.gripBaw} BAW` : ' · BAW — из ширины плеч в «Пропорциях»'}</div>
            </div>
            <div style={{ padding: '8px 10px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', marginBottom: 6 }} data-bb="pain-monitor">
              <div style={{ fontSize: 12, fontWeight: 800, color: '#fff', marginBottom: 6 }}>Боль-мониторинг (правило ≤5 днём / &lt;5 утром)</div>
              <BbSheetSelect label="Локация боли" value={state.pmLoc} onChange={(v) => setState((s) => ({ ...s, pmLoc: v as any }))} options={[{ id: '', label: 'Не заполнено' }, ...PAIN_LOCATIONS.map((p) => ({ id: p.id, label: p.label }))]} testId="bb-pm-loc" />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 6, marginBottom: 6 }}>
                <BbNum label="Боль во время, 0–10" value={state.pmDuring} onChange={(v) => setState(s => ({ ...s, pmDuring: v }))} placeholder="—" step={1} testId="bb-pm-during" />
                <BbNum label="Боль на утро, 0–10" value={state.pmMorning} onChange={(v) => setState(s => ({ ...s, pmMorning: v }))} placeholder="—" step={1} testId="bb-pm-morning" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 6 }}>
                <BbCheckCard active={!state.pmRising} title="Не растёт по неделям" desc="тренд стабилен/падает" onToggle={() => setState(s => ({ ...s, pmRising: !s.pmRising }))} accent="#f59e0b" />
                <BbCheckCard active={!state.pmNight} title="Без ночной боли" desc="ночью не беспокоит" accent="#ef4444" onToggle={() => setState(s => ({ ...s, pmNight: !s.pmNight }))} />
                <BbCheckCard active={!state.pmSharp} title="Без резкой боли" desc="боль тупая, не «прострел»" accent="#ef4444" onToggle={() => setState(s => ({ ...s, pmSharp: !s.pmSharp }))} />
              </div>
              <div style={{ fontSize: 11, color: painMon.verdict.level === 'red' ? '#ef4444' : painMon.verdict.level === 'yellow' ? '#f59e0b' : '#fff' }} data-bb="pm-verdict">{painMon.verdict.text}</div>
              {painMon.verdict.tested && <div style={{ fontSize: 11, color: '#fff', marginTop: 4 }} data-bb="pm-advice">{painMon.verdict.advice}</div>}
              {state.pmLoc && <div style={{ fontSize: 10, color: '#fff', opacity: 0.85, marginTop: 4 }} data-bb="pm-provocation">Провокация: {provocationFor(state.pmLoc)}</div>}
              {painJointTendon && <div style={{ fontSize: 11, color: '#fff', marginTop: 4 }} data-bb="pm-tendon">{painJointTendon.text}</div>}
              <div style={{ fontSize: 10, color: '#fff', opacity: 0.85, marginTop: 4 }} data-bb="pm-disclaimer">{PAIN_MONITOR_DISCLAIMER}</div>
            </div>
            <div style={{ padding: '8px 10px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', marginBottom: 6 }} data-bb="posterior-readiness">
              <div style={{ fontSize: 12, fontWeight: 800, color: '#fff', marginBottom: 6 }}>Задняя цепь — NHE (эксцентрик) + аддукторы</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 6 }}>
                <BbNum label="NHE повторов Л" value={state.nheL} onChange={(v) => setState(s => ({ ...s, nheL: v }))} placeholder="—" step={1} testId="bb-nhe-l" />
                <BbNum label="NHE повторов П" value={state.nheR} onChange={(v) => setState(s => ({ ...s, nheR: v }))} placeholder="—" step={1} testId="bb-nhe-r" />
                <BbNum label="Контроль до угла, °" value={state.nheAngle} onChange={(v) => setState(s => ({ ...s, nheAngle: v }))} placeholder="—" step={5} testId="bb-nhe-angle" />
              </div>
              <div style={{ fontSize: 11, color: nheV.level === 'ok' || nheV.level === 'not_tested' ? '#fff' : '#f59e0b' }} data-bb="nhe-verdict">{nheV.text}</div>
              <div style={{ fontSize: 10, color: '#fff', opacity: 0.85, marginTop: 4 }} data-bb="nhe-disclaimer">{NHE_DISCLAIMER}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 6, marginBottom: 6 }}>
                <BbNum label="Сжатие аддукторов Л, кг" value={state.addL} onChange={(v) => setState(s => ({ ...s, addL: v }))} placeholder="—" step={1} testId="bb-add-l" />
                <BbNum label="Сжатие аддукторов П, кг" value={state.addR} onChange={(v) => setState(s => ({ ...s, addR: v }))} placeholder="—" step={1} testId="bb-add-r" />
              </div>
              <BbSheetSelect label="Copenhagen, уровень" value={state.cphLevel} onChange={(v) => setState((s) => ({ ...s, cphLevel: v as any }))} options={[{ id: '', label: '—' }, { id: 'L0', label: 'L0 — изометрия' }, { id: 'L1', label: 'L1 — короткий рычаг' }, { id: 'L2', label: 'L2 — полный' }, { id: 'L3', label: 'L3 — динамика' }]} testId="bb-cph-level" />
              <div style={{ fontSize: 11, color: adductorV.level === 'weak' ? '#f59e0b' : '#fff', marginTop: 4 }} data-bb="adductor-verdict">{adductorV.text}</div>
              <div style={{ fontSize: 10, color: '#fff', opacity: 0.85, marginTop: 4 }} data-bb="adductor-honesty">{ADDUCTOR_HONESTY}</div>
            </div>
            <div style={{ padding: '8px 10px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', marginBottom: 6 }} data-bb="scap-video">
              <div style={{ fontSize: 12, fontWeight: 800, color: '#fff', marginBottom: 6 }}>Лопатка/боль + видео + замены</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 6 }}>
                <BbCheckCard active={!state.painArc} title="Без боли 60–120°" desc="дуга подъёма чистая" onToggle={() => setState((s) => ({ ...s, painArc: !s.painArc }))} accent="#ef4444" />
                <BbCheckCard active={!state.scapWinging} title="Лопатка стабильна" desc="без крыловидности" onToggle={() => setState((s) => ({ ...s, scapWinging: !s.scapWinging }))} accent="#60a5fa" />
              </div>
              {(state.painArc || state.scapWinging) && (
                <div style={{ fontSize: 11, color: '#f59e0b', marginBottom: 6 }} data-bb="scap-note">
                  {state.painArc ? 'Боль в дуге 60–120°: жимы над головой и тяги за голову — стоп до врача; нейтральный хват + лицо-тяги. ' : ''}
                  {state.scapWinging ? 'Крыловидность: стена-слайды + серратус (кулак вверх у стены) 2×12, жим — с паузой и сведением.' : ''}
                  Скрининг, не диагноз.
                </div>
              )}
              <BbCheckCard active={state.videoTwoAngles} title="Видео с 2 ракурсов" desc="5 повторов, босиком, спереди + сбоку" onToggle={() => setState((s) => ({ ...s, videoTwoAngles: !s.videoTwoAngles }))} accent="#a855f7" />
              <div style={{ fontSize: 10, color: '#fff', opacity: 0.85, marginTop: 4 }} data-bb="video-guide">{VIDEO_GUIDE}</div>
              <div style={{ fontSize: 11, color: '#fff', marginTop: 6 }} data-bb="driver-subs">
                Замены под драйвер: {driverSubs.prefer.length ? driverSubs.prefer.join(' · ') : '—'}
                {driverSubs.avoid.length ? ` (убрать: ${driverSubs.avoid.join(' · ')})` : ''} — {driverSubs.note}
              </div>
              <div style={{ fontSize: 10, color: '#fff', opacity: 0.85, marginTop: 4 }} data-bb="screening-disclaimer">{SCREENING_DISCLAIMER}</div>
            </div>
            <div style={{ padding: '8px 10px', borderRadius: 10, background: 'rgba(0,230,138,0.06)', border: '1px solid rgba(0,230,138,0.16)', marginBottom: 6 }} data-bb="screen-priority">
              <div style={{ fontSize: 12, fontWeight: 800, color: '#00e68a', marginBottom: 4 }}>🧭 Что чинить первым (горизонт 4–6 нед)</div>
              <ol style={{ margin: 0, paddingLeft: 18, fontSize: 11, color: '#fff', lineHeight: 1.5 }}>
                {screenPriority.map((p, i) => <li key={i}>{p}</li>)}
              </ol>
              {teenGate.blocked && <div style={{ fontSize: 10, color: '#f59e0b', marginTop: 4 }} data-bb="teen-gate">{teenGate.note}</div>}
            </div>
            <div style={{ padding: '8px 10px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', marginBottom: 6 }} data-bb="screen-history">
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginBottom: 4 }}>
                <b style={{ fontSize: 11, color: '#fff' }}>📸 Снимки скрининга ({screenHist.length})</b>
                <button onClick={() => {
                  // П1/R7: снимок v:3 — OHS + D1–D5 + R1–R6 коды (legacy без v / v:2 мигрируют в дельте, не регрессом)
                  const entry = { date: localIsoDate(), fails: screenCodes, v: 3 };
                  setScreenHist((prev) => {
                    const next = [...prev, entry].slice(-10);
                    try { localStorage.setItem('he_bb_screen_history', JSON.stringify(next)); } catch { /* noop */ }
                    return next;
                  });
                  setToast(`✓ Снимок скрининга ${entry.date} сохранён`);
                  setTimeout(() => setToast(''), 2000);
                }} data-bb="screen-snapshot" style={{ minHeight: 44, padding: '8px 12px', borderRadius: 10, background: 'rgba(0,230,138,0.12)', border: '1px solid rgba(0,230,138,0.22)', color: '#00e68a', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Снимок сегодня</button>
              </div>
              <div style={{ fontSize: 11, color: '#fff' }} data-bb="screen-delta">{screenDelta.text}</div>
              {(screenDelta.tracked?.length ?? 0) > 0 && (
                <div style={{ fontSize: 10, color: '#fff', marginTop: 2, opacity: 0.9 }} data-bb="screen-tracked" title={screenDelta.tracked.join(', ')}>
                  Новый трекинг: {trackedRu(screenDelta.tracked)}
                </div>
              )}
              {(() => {
                try {
                  const last = screenHist.length ? screenHist[screenHist.length - 1] : null;
                  if (!last) return null;
                  const days = Math.floor((Date.now() - new Date(last.date + 'T12:00:00').getTime()) / 86400000);
                  if (days > 42) {
                    return <div style={{ marginTop: 4, color: '#f59e0b' }} data-bb="screen-stale">⏰ Снимку {days} дн — пора перепроверить (норма re-screen 4–6 нед).</div>;
                  }
                  return null;
                } catch { return null; }
              })()}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 6 }} data-bb="ankle-grid">
              <BbNum label="КТС левая, см" value={state.ktwL} onChange={(v) => setState(s => ({ ...s, ktwL: v }))} placeholder="12" step={0.5} testId="bb-ktw-l" />
              <BbNum label="КТС правая, см" value={state.ktwR} onChange={(v) => setState(s => ({ ...s, ktwR: v }))} placeholder="12" step={0.5} testId="bb-ktw-r" />
              <BbNum label="Голеностоп, °" value={state.ankleDeg} onChange={(v) => setState(s => ({ ...s, ankleDeg: v }))} placeholder="35" step={1} testId="bb-ankle-deg" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 6 }} data-bb="ankle-straight">
              <BbNum label="КТС прям. колено Л, см" value={state.ktwStraightL} onChange={(v) => setState(s => ({ ...s, ktwStraightL: v }))} placeholder="12" step={0.5} testId="bb-ktw-straight-l" />
              <BbNum label="КТС прям. колено П, см" value={state.ktwStraightR} onChange={(v) => setState(s => ({ ...s, ktwStraightR: v }))} placeholder="12" step={0.5} testId="bb-ktw-straight-r" />
              <BbNum label="Сгибание бедра, °" value={state.hipFlexDeg} onChange={(v) => setState(s => ({ ...s, hipFlexDeg: v }))} placeholder="120" step={1} testId="bb-hip-flex" />
            </div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 6, alignItems: 'center', flexWrap: 'wrap' }} data-bb="heel-row">
              <span style={{ fontSize: 12, color: '#fff', fontWeight: 700 }}>Подпятка 2,5 см</span>
              <button onClick={() => setState(s => ({ ...s, heelRetest: 'better' }))} aria-pressed={state.heelRetest === 'better'} data-bb="heel-better" style={{ minHeight: 44, padding: '8px 14px', borderRadius: 999, border: '1px solid', borderColor: state.heelRetest === 'better' ? '#22c55e' : 'rgba(255,255,255,0.12)', background: state.heelRetest === 'better' ? 'rgba(34,197,94,0.14)' : 'rgba(255,255,255,0.04)', color: state.heelRetest === 'better' ? '#22c55e' : '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Стало лучше</button>
              <button onClick={() => setState(s => ({ ...s, heelRetest: 'same' }))} aria-pressed={state.heelRetest === 'same'} data-bb="heel-same" style={{ minHeight: 44, padding: '8px 14px', borderRadius: 999, border: '1px solid', borderColor: state.heelRetest === 'same' ? '#f59e0b' : 'rgba(255,255,255,0.12)', background: state.heelRetest === 'same' ? 'rgba(245,158,11,0.14)' : 'rgba(255,255,255,0.04)', color: state.heelRetest === 'same' ? '#f59e0b' : '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Без изменений</button>
              <button onClick={() => setState(s => ({ ...s, heelRetest: '' }))} data-bb="heel-reset" style={{ minHeight: 44, padding: '8px 14px', borderRadius: 999, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)', color: '#fff', fontSize: 12, cursor: 'pointer' }}>Сброс</button>
              <span style={{ fontSize: 11, color: '#fff' }}>Норма ≥{OHS_NORMS.kneeToWallCm.optimal} см · разница Л/П ≥2 см — чинить отстающую</span>
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
              <button onClick={applyMobilityToProfile} data-bb="mobility-to-profile" style={{ minHeight: 48, flex: '1 1 200px', padding: '10px 14px', borderRadius: 10, background: ohs.failed > 0 ? 'rgba(59,130,246,0.14)' : 'rgba(34,197,94,0.10)', border: `1px solid ${ohs.failed > 0 ? 'rgba(59,130,246,0.22)' : 'rgba(34,197,94,0.18)'}`, color: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>→ В профиль {ohs.failed ? `(${ohs.failed}/6)` : '(порядок)'}</button>
            </div>
            <div style={{ fontSize: 11, color: '#fff', marginTop: 6 }}>Скорость/VBT — <b>⚡ Анализ силы</b> · Траектория/углы из видео — <b>ТА/СМ видеоразбор</b> · Суставы — <b>🦴 Суставы и ортопедия</b> · Нагрузка — <b>⚡ Интеллект</b> (здесь только скрининг, без дублей).</div>
          </div>
        )}
      </div>

      <div style={{ ...CARD, padding: 10, margin: 0, background: 'rgba(0,230,138,0.08)', border: '1px solid rgba(0,230,138,0.16)' }} data-bb="footer">
        <div style={{ fontSize: 11, color: '#fff', marginBottom: 6 }}>Выбрано: {weakListRu(report.weakZonesGranular) || '— баланс'} · оценка {score} · пров. {report.score.verification} {report.score.floors.join(' · ')}</div>
        <div style={{ fontSize: 11, color: '#fff', marginBottom: 6 }}>{report.findings.slice(0, 3).join(' · ') || '—'}</div>
        {sLevel === 'critical' && <div style={{ fontSize: 11, color: '#ef4444', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.18)', borderRadius: 8, padding: '8px 10px', marginBottom: 6 }}>⚠️ Критично — урезание предельного объёма и коррекция до пика. Проверь присед-тест + объём.</div>}
        {specBlock && (
          <div style={{ marginBottom: 6, padding: '8px 10px', borderRadius: 10, background: 'rgba(168,85,247,0.06)', border: '1px solid rgba(168,85,247,0.16)', fontSize: 11, lineHeight: 1.5 }} data-bb="spec-block">
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4, flexWrap: 'wrap' }}>
              <b style={{ color: '#fff' }}>Спец-блок {specBlock.lengthWeeks} нед: {report.weakZonesGranular.map(weakRu).join(', ')}</b>
              <span style={{ marginLeft: 'auto', minWidth: 120, flex: '0 1 140px' }}><BbNum label="Длина, нед" value={state.specWeeks} onChange={(v) => setState(s => ({ ...s, specWeeks: v }))} placeholder="8" step={1} /></span>
              <button onClick={() => setState(s => ({ ...s, showSpecBlock: !s.showSpecBlock }))} data-bb="spec-toggle" style={{ minHeight: 44, padding: '8px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>{state.showSpecBlock ? 'Скрыть' : 'Недели'}</button>
            </div>
            <div style={{ color: '#fff' }}>{specBlock.rationale.join(' · ')}</div>
            {state.showSpecBlock && <div style={{ marginTop: 4, color: '#fff' }}>{specBlock.weeks.slice(0, 8).map((w) => `Н${w.week}: ${Object.entries(w.targetSets).map(([k, v]) => `${MUSCLE_LABEL_RU[k] || k} ${v}`).join(', ')} ×${Object.entries(w.frequency).map(([, f]) => `${f}`).join('/')}/нед`).join(' · ')}</div>}
          </div>
        )}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }} data-bb="export-row">
          <button onClick={applyToConstructor} data-bb="apply-bottom" style={{ flex: '2 1 200px', minHeight: 52, padding: '12px 14px', borderRadius: 12, background: 'linear-gradient(135deg,#00e68a,#00c853)', color: '#06281c', border: 'none', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>→ Применить в ББ-авто ({report.weakZonesGranular.map(weakRu).join(', ') || 'баланс'})</button>
          <button onClick={handleExport} data-bb="export-html" style={{ flex: '1 1 120px', minHeight: 52, padding: '12px 14px', borderRadius: 12, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>🖨 Печать</button>
          <button onClick={handleExportCsv} data-bb="export-csv" style={{ flex: '1 1 120px', minHeight: 52, padding: '12px 14px', borderRadius: 12, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>📊 Таблица</button>
        </div>
        <div style={{ fontSize: 11, color: '#fff', marginTop: 6 }}>Объём: <b>📐 Объём-хаб</b> · Нагрузка: <b>⚡ Интеллект</b> · Суставы: <b>🦴 Суставы и ортопедия</b> · Сила: <b>🏋️ Анализ силы</b> — без дублей, только чтение.</div>
      </div>
    </div>
  );
};

export default BBDiagnosticsHub;
