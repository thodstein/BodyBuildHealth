/**
 * BBDiagnosticsHub.tsx — диагностика ДВИЖЕНИЙ под бодибилдинг (мышца + упражнение → стимул → коррекция).
 * 4 таба: screening (OHS-скрининг + односторонний + драйвер)/exercise (разбор+PROF-техника+Δ)/stimulus (стимул-карта)/symmetry (пропорции).
 * Нагрузка/восстановление/объём/VBT/LVP/видео/ортопедия — НЕ дублируются, только ссылки на свои хабы.
 * Хедер RSS 0-100 (движения: слабые/симметрия/стимул/скрининг/SFR/углы/длина) + verification. Мост weakpoints → BbAutoConstructor.
 */
import React, { useMemo, useState, useEffect } from 'react';
import { CARD, ACCENT } from './training-ui';
import { applyToPlanner } from './planner-bridge';
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
import { buildSpecBlock } from '../../../engines/bb/bb-spec-block.engine';
import { injectBBWeakPoints, pushPlanSnapshot, readPlanHistory, type PlanSnapshot } from '../../../engines/bb/bb-diagnostics-injection.engine';
import { idealMcCallumMap, symmetryTriadDeviation, appendMeasureSnapshot, measureDeltas, type MeasureSnapshot } from '../../../engines/bb/bb-symmetry.engine';
import { weakHeadForZone, HEAD_FUNCTIONS, auditHeadCoverage, headsHitOf } from '../../../engines/bb/bb-stimulus-target.engine';
import { resolveMovementDriver, singleLegVerdict, ohsFailCodes, movementDelta, type MovementSnapshot } from '../../../engines/bb/bb-movement-screen.engine';

const STORAGE_KEY = 'he_bb_diagnostics_hub_v1';
type BBTab = 'weak' | 'screening' | 'exercise' | 'stimulus' | 'symmetry';

type BBState = {
  weakManual: string[];
  circ: Record<string, string>;
  ohsHeelsFlat: boolean; ohsKneeValgus: boolean; ohsHipBelowParallel: boolean; ohsTrunkUpright: boolean; ohsArmsOverMidfoot: boolean; ohsLumbarNeutral: boolean;
  kneeToWallCm: string; ankleDeg: string;   heelRetest: '' | 'better' | 'same';
  /** Скрининг v2: руки на бёдрах чистят поясницу (тест на широчайшие) + односторонний + снимок. */
  handsOnHipsBetter: boolean;
  splitL: '' | 'pass' | 'fail';
  splitR: '' | 'pass' | 'fail';
  rdlL: '' | 'pass' | 'fail';
  rdlR: '' | 'pass' | 'fail';
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
};

const DEFAULT_STATE: BBState = {
  weakManual: [],
  circ: { heightCm: '175', weightKg: '80', bodyFat: '', neck: '', chest: '', waist: '', hips: '', bicepL: '', bicepR: '', thighL: '', thighR: '', calfL: '', calfR: '', shoulderWidth: '', forearmL: '', forearmR: '' },
  ohsHeelsFlat: true, ohsKneeValgus: false, ohsHipBelowParallel: true, ohsTrunkUpright: true, ohsArmsOverMidfoot: true, ohsLumbarNeutral: true,
  kneeToWallCm: '', ankleDeg: '', heelRetest: '',
  handsOnHipsBetter: false,
  splitL: '', splitR: '', rdlL: '', rdlR: '',
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

export const BBDiagnosticsHub: React.FC = () => {
  const [state, setState] = useState<BBState>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return { ...DEFAULT_STATE, ...JSON.parse(raw), circ: { ...DEFAULT_STATE.circ, ...(JSON.parse(raw).circ || {}) } };
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

  useEffect(() => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {} }, [state]);

  const level = useMemo(() => {
    try { const p = JSON.parse(localStorage.getItem('he_profile_v2') || '{}'); return p?.settings?.training?.level || p?.training?.level || 'intermediate'; } catch { return 'intermediate'; }
  }, []);

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
  }, []);

  // Пол и сон — из профиля (единый источник; в хабе своих селектов нет, без дублей)
  const profileSex = useMemo(() => {
    try {
      const p = JSON.parse(localStorage.getItem('he_profile_v2') || '{}');
      const s = p?.settings?.personal?.sex ?? p?.personal?.sex;
      return s === 'female' || s === 'male' ? (s as 'male' | 'female') : '';
    } catch { return ''; }
  }, []);
  const profileSleep = useMemo(() => {
    try {
      const p = JSON.parse(localStorage.getItem('he_profile_v2') || '{}');
      const n = Number(p?.settings?.lifestyle?.sleepHours ?? p?.lifestyle?.sleepHours);
      return Number.isFinite(n) && n > 0 ? n : null;
    } catch { return null; }
  }, []);
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

  const balance = useMemo(() => {
    try {
      const plan = readSavedBbPlan();
      if (plan?.weeks) return analyzeBBBalance(plan);
      return null;
    } catch { return null; }
  }, [diarySessions]);

  const ohs = useMemo(() => assessOHS({
    heelsFlat: state.ohsHeelsFlat, kneeValgus: state.ohsKneeValgus, hipBelowParallel: state.ohsHipBelowParallel,
    trunkUpright: state.ohsTrunkUpright, armsOverMidfoot: state.ohsArmsOverMidfoot, lumbarNeutral: state.ohsLumbarNeutral,
    kneeToWallCm: state.kneeToWallCm ? parseFloat(state.kneeToWallCm) : null,
    ankleDorsiflexDeg: state.ankleDeg ? parseFloat(state.ankleDeg) : null,
    heelRaiseRetest: state.heelRetest === 'better' ? true : state.heelRetest === 'same' ? false : null,
  }), [state.ohsHeelsFlat, state.ohsKneeValgus, state.ohsHipBelowParallel, state.ohsTrunkUpright, state.ohsArmsOverMidfoot, state.ohsLumbarNeutral, state.kneeToWallCm, state.ankleDeg, state.heelRetest]);

  // P1: L/R-объём из дневника
  const lrVerdicts = useMemo(() => {
    try { return lrVerdictsFromSessions(diarySessions as any); } catch { return []; }
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
    plan: readSavedBbPlan(),
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
  }), [level, factVolume, diarySessions, measNum, balance, ohs.failed, state.weakManual]);

  // Скрининг v2: драйвер + односторонний + коды/снимок (чистые функции движка)
  const moveDriver = useMemo(() => {
    try {
      return resolveMovementDriver({
        heelsFlat: state.ohsHeelsFlat, kneeValgus: state.ohsKneeValgus, hipBelowParallel: state.ohsHipBelowParallel,
        trunkUpright: state.ohsTrunkUpright, armsOverMidfoot: state.ohsArmsOverMidfoot, lumbarNeutral: state.ohsLumbarNeutral,
        kneeToWallCm: state.kneeToWallCm ? parseFloat(state.kneeToWallCm) : null,
        ankleDeg: state.ankleDeg ? parseFloat(state.ankleDeg) : null,
        heelRetest: state.heelRetest === 'better' ? 'better' : state.heelRetest === 'same' ? 'same' : null,
        handsOnHipsBetter: state.handsOnHipsBetter || null,
      });
    } catch { return { driver: 'none', label: '—', fix: '', confidence: 0 } as any; }
  }, [state.ohsHeelsFlat, state.ohsKneeValgus, state.ohsHipBelowParallel, state.ohsTrunkUpright, state.ohsArmsOverMidfoot, state.ohsLumbarNeutral, state.kneeToWallCm, state.ankleDeg, state.heelRetest, state.handsOnHipsBetter]);
  const singleLeg = useMemo(() => {
    try {
      return singleLegVerdict({
        splitSquatL: (state.splitL || null) as any, splitSquatR: (state.splitR || null) as any,
        rdlL: (state.rdlL || null) as any, rdlR: (state.rdlR || null) as any,
      });
    } catch { return { weakSide: null, text: '' } as any; }
  }, [state.splitL, state.splitR, state.rdlL, state.rdlR]);
  const ohsCodes = useMemo(() => {
    try {
      return ohsFailCodes({
        heelsFlat: state.ohsHeelsFlat, kneeValgus: state.ohsKneeValgus, hipBelowParallel: state.ohsHipBelowParallel,
        trunkUpright: state.ohsTrunkUpright, armsOverMidfoot: state.ohsArmsOverMidfoot, lumbarNeutral: state.ohsLumbarNeutral,
      });
    } catch { return []; }
  }, [state.ohsHeelsFlat, state.ohsKneeValgus, state.ohsHipBelowParallel, state.ohsTrunkUpright, state.ohsArmsOverMidfoot, state.ohsLumbarNeutral]);
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
      return movementDelta(prev, ohsCodes);
    } catch { return { fixed: [], regressed: [], text: '' } as any; }
  }, [screenHist, ohsCodes]);

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
    // 28д-история + замеры + e1RM — внутри хендлера (мемы ниже по коду недоступны из-за TDZ)
    let histLazy: Record<string, number[]> = {};
    let measLazy: Record<string, number> = {};
    let trendLazy: Record<string, { deltaPct: number; sessions: number }> = {};
    try { histLazy = volumeHistory28d(diarySessions as any) || {}; } catch { /* noop */ }
    try { trendLazy = e1rmTrend28d(diarySessions as any) || {}; } catch { /* noop */ }
    try {
      measLazy = {};
      for (const [k, v] of Object.entries(state.circ)) {
        const n = parseFloat(v as string);
        if (Number.isFinite(n) && n > 0) measLazy[k] = n;
      }
    } catch { /* noop */ }
    try {
      weakCausesPayload = diagnoseWeakCausesBatch(report.weakZonesGranular.slice(0, 2), {
        level,
        factVolume: factVolume as any,
        perMuscleAcwr: perMuscleAcwr as any,
        sleepHours: Number.isFinite(profileSleep as number) ? (profileSleep as number) : null,
        vbtLossPct: null, // VBT живёт в Анализе силы — в диагностику движений не входит
        hist28: histLazy as any,
        e1rmTrend: trendLazy as any,
        meas: measLazy as any,
        heightCm: measLazy.heightCm ?? (parseFloat(state.circ.heightCm || '') || null),
        wristCm: state.wristCm ? parseFloat(state.wristCm) : null,
        canonicalOf: canonicalMuscle,
      });
    } catch { /* noop */ }
    try {
      const f: Record<string, number> = {};
      for (const [k, v] of Object.entries((factVolume as any) || {})) f[k] = (v as any)?.effectiveSets ?? (v as any)?.directSets ?? 0;
      specPayload = buildSpecBlock({ weakZones: report.weakZonesGranular, factSets: f, level, weeks: parseInt(state.specWeeks) || 8, sex: effSex || undefined });
      // топ-3 на каждую слабую зону с бонусом слабой головки (макс 6) + сами головки
      const seen = new Set<string>();
      const heads: string[] = [];
      for (const z of report.weakZonesGranular.slice(0, 2)) {
        const wh = weakHeadForZone(z);
        if (wh && !heads.includes(wh)) heads.push(wh);
        try {
          // 3.11: единый источник ранжирования — мемо top3ByZone (без повторного вызова).
          for (const r of (top3ByZone[z] || [])) {
            const id = String(r.id).toLowerCase();
            if (!seen.has(id)) { seen.add(id); topIds.push(r.id); }
          }
        } catch { /* noop */ }
      }
      topIds = topIds.slice(0, 6);
      weakHeads = heads;
    } catch { /* noop */ }
    // PRO-3 R6: копим направление перекоса (сырые стороны + дата) для динамики
    try {
      const raw = localStorage.getItem('he_bb_lr_history');
      let hist = raw ? (JSON.parse(raw) as BbLrSnapshot[]) : [];
      const today = new Date().toISOString().slice(0, 10);
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
        movementDriver: (() => { try {
          return resolveMovementDriver({
            heelsFlat: state.ohsHeelsFlat, kneeValgus: state.ohsKneeValgus, hipBelowParallel: state.ohsHipBelowParallel,
            trunkUpright: state.ohsTrunkUpright, armsOverMidfoot: state.ohsArmsOverMidfoot, lumbarNeutral: state.ohsLumbarNeutral,
            kneeToWallCm: state.kneeToWallCm ? parseFloat(state.kneeToWallCm) : null,
            ankleDeg: state.ankleDeg ? parseFloat(state.ankleDeg) : null,
            heelRetest: state.heelRetest === 'better' ? 'better' : state.heelRetest === 'same' ? 'same' : null,
            handsOnHipsBetter: state.handsOnHipsBetter || null,
          });
        } catch { return null; } })(),
        singleLeg: (() => { try {
          return singleLegVerdict({
            splitSquatL: (state.splitL || null) as any, splitSquatR: (state.splitR || null) as any,
            rdlL: (state.rdlL || null) as any, rdlR: (state.rdlR || null) as any,
          });
        } catch { return null; } })(),
        vbtLossPct: null,
        weakCauses: weakCausesPayload,
        preferredExerciseIds: topIds,
        weakHeads,
        specBlock: specPayload,
        sleepHours: Number.isFinite(profileSleep as number) ? profileSleep : null,
        // Симметрия L/R — движения (остаётся); направление перекоса — из истории
        lrVerdicts: (() => { try { return lrVerdictsFromSessions(diarySessions as any); } catch { return []; } })(),
        lrDirection: (() => {
          try {
            const raw = localStorage.getItem('he_bb_lr_history');
            const hist = raw ? (JSON.parse(raw) as BbLrSnapshot[]) : [];
            const out: Array<{ group: string; text: string }> = [];
            for (const v of lrVerdictsFromSessions(diarySessions as any).slice(0, 2)) {
              const d = summarizeLrDirection(hist, v.group);
              if (d) out.push({ group: v.group, text: d.text });
            }
            return out;
          } catch { return []; }
        })(),
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
    if (state.kneeToWallCm && Number.isFinite(parseFloat(state.kneeToWallCm)) && parseFloat(state.kneeToWallCm) < 12) restrictions.push('ankle');
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

  // Экспорт движений: направление перекоса L/R (нагрузка в файл не едет — её хабы свои)
  const buildPro3Export = (): Record<string, unknown> => {
    try {
      const raw = localStorage.getItem('he_bb_lr_history');
      const hist = raw ? (JSON.parse(raw) as BbLrSnapshot[]) : [];
      const dir: Array<{ group: string; text: string }> = [];
      for (const v of lrVerdictsFromSessions(diarySessions as any).slice(0, 2)) {
        const d = summarizeLrDirection(hist, v.group);
        if (d) dir.push({ group: v.group, text: d.text });
      }
      return {
        lrDirection: dir,
      };
    } catch { return {}; }
  };

  const handleExport = () => {
    let causes: Record<string, unknown> = {};
    let spec: unknown = null;
    const heads: string[] = [];
    try {
      // те же живые входы, что в меме и CSV (мемы ниже недоступны из-за TDZ)
      let histLazy: Record<string, number[]> = {};
      let trendLazy: Record<string, { deltaPct: number; sessions: number }> = {};
      try { histLazy = volumeHistory28d(diarySessions as any) || {}; } catch { /* noop */ }
      try { trendLazy = e1rmTrend28d(diarySessions as any) || {}; } catch { /* noop */ }
      const measLazy: Record<string, number> = {};
      try {
        for (const [k, v] of Object.entries(state.circ)) {
          const n = parseFloat(v as string);
          if (Number.isFinite(n) && n > 0) measLazy[k] = n;
        }
      } catch { /* noop */ }
      causes = diagnoseWeakCausesBatch(report.weakZonesGranular.slice(0, 2), {
        level,
        factVolume: factVolume as any,
        perMuscleAcwr: perMuscleAcwr as any,
        sleepHours: Number.isFinite(profileSleep as number) ? (profileSleep as number) : null,
        vbtLossPct: null, // VBT живёт в Анализе силы — в диагностику движений не входит
        hist28: histLazy as any,
        e1rmTrend: trendLazy as any,
        meas: measLazy as any,
        heightCm: measLazy.heightCm ?? (parseFloat(state.circ.heightCm || '') || null),
        wristCm: state.wristCm ? parseFloat(state.wristCm) : null,
        canonicalOf: canonicalMuscle,
      });
      for (const z of report.weakZonesGranular.slice(0, 2)) {
        const wh = weakHeadForZone(z);
        if (wh && !heads.includes(wh)) heads.push(wh);
      }
      const f: Record<string, number> = {};
      spec = buildSpecBlock({ weakZones: report.weakZonesGranular, factSets: f, level, weeks: parseInt(state.specWeeks) || 8, sex: effSex || undefined });
    } catch { /* noop */ }
    // Экспорт движений: L/R + скрининг-драйвер + односторонний (нагрузка — чужие хабы, в файл не едет)
    let pro2: Record<string, unknown> = {};
    try {
      const lr = lrVerdictsFromSessions(diarySessions as any).map((v) => ({ group: v.group, left: v.left, right: v.right, asymPct: v.asymPct, weakSide: v.weakSide, verdict: v.verdict, topUpSets: v.topUpSets, text: v.text }));
      let moveDriverEx: unknown = null;
      try {
        moveDriverEx = resolveMovementDriver({
          heelsFlat: state.ohsHeelsFlat, kneeValgus: state.ohsKneeValgus, hipBelowParallel: state.ohsHipBelowParallel,
          trunkUpright: state.ohsTrunkUpright, armsOverMidfoot: state.ohsArmsOverMidfoot, lumbarNeutral: state.ohsLumbarNeutral,
          kneeToWallCm: state.kneeToWallCm ? parseFloat(state.kneeToWallCm) : null,
          ankleDeg: state.ankleDeg ? parseFloat(state.ankleDeg) : null,
          heelRetest: state.heelRetest === 'better' ? 'better' : state.heelRetest === 'same' ? 'same' : null,
          handsOnHipsBetter: (state as any).handsOnHipsBetter || null,
        });
      } catch { /* noop */ }
      let singleLegEx: unknown = null;
      try {
        singleLegEx = singleLegVerdict({
          splitSquatL: ((state as any).splitL || null) as any, splitSquatR: ((state as any).splitR || null) as any,
          rdlL: ((state as any).rdlL || null) as any, rdlR: ((state as any).rdlR || null) as any,
        });
      } catch { /* noop */ }
      pro2 = {
        lr,
        movementDriver: moveDriverEx,
        singleLeg: singleLegEx,
        ohs: { totalScore: ohs.totalScore, failed: ohs.failed },
      };
      try { Object.assign(pro2, buildPro3Export()); } catch { /* noop */ }
    } catch { /* noop */ }
    const html = buildBBDiagnosticsHtml(report, { date: new Date().toISOString().slice(0, 10), level, plan: bbPlan, weakHeads: heads, weakCauses: causes as any, specBlock: spec as any, ...pro2 } as any);
    downloadHtml(html, `bb-diagnostics-${new Date().toISOString().slice(0, 10)}.html`);
    setToast('✓ HTML экспорт (движения: причины + спец-блок + разбор + скрининг)');
    setTimeout(() => setToast(''), 2000);
  };
  const handleExportCsv = () => {
    // лениво, как handleExport (мемы ниже недоступны из-за TDZ)
    let causes: Record<string, any> = {};
    let spec: any = null;
    const heads: string[] = [];
    try {
      let histLazy: Record<string, number[]> = {};
      let trendLazy: Record<string, { deltaPct: number; sessions: number }> = {};
      try { histLazy = volumeHistory28d(diarySessions as any) || {}; } catch { /* noop */ }
      try { trendLazy = e1rmTrend28d(diarySessions as any) || {}; } catch { /* noop */ }
      const measLazy: Record<string, number> = {};
      try {
        for (const [k, v] of Object.entries(state.circ)) {
          const n = parseFloat(v as string);
          if (Number.isFinite(n) && n > 0) measLazy[k] = n;
        }
      } catch { /* noop */ }
      for (const z of report.weakZonesGranular.slice(0, 2)) {
        const wh = weakHeadForZone(z);
        if (wh && !heads.includes(wh)) heads.push(wh);
      }
      causes = diagnoseWeakCausesBatch(report.weakZonesGranular.slice(0, 2), {
        level,
        factVolume: factVolume as any,
        perMuscleAcwr: perMuscleAcwr as any,
        sleepHours: Number.isFinite(profileSleep as number) ? (profileSleep as number) : null,
        vbtLossPct: null, // VBT живёт в Анализе силы — в диагностику движений не входит
        hist28: histLazy as any,
        e1rmTrend: trendLazy as any,
        meas: measLazy as any,
        heightCm: measLazy.heightCm ?? (parseFloat(state.circ.heightCm || '') || null),
        wristCm: state.wristCm ? parseFloat(state.wristCm) : null,
        canonicalOf: canonicalMuscle,
      });
      const f: Record<string, number> = {};
      spec = buildSpecBlock({ weakZones: report.weakZonesGranular, factSets: f, level, weeks: parseInt(state.specWeeks) || 8, sex: effSex || undefined });
    } catch { /* noop */ }
    let pro2csv: Record<string, unknown> = {};
    try {
      const lr = lrVerdictsFromSessions(diarySessions as any).map((v) => ({ group: v.group, left: v.left, right: v.right, asymPct: v.asymPct, weakSide: v.weakSide, verdict: v.verdict, topUpSets: v.topUpSets, text: v.text }));
      let moveDriverCsv: unknown = null;
      try {
        moveDriverCsv = resolveMovementDriver({
          heelsFlat: state.ohsHeelsFlat, kneeValgus: state.ohsKneeValgus, hipBelowParallel: state.ohsHipBelowParallel,
          trunkUpright: state.ohsTrunkUpright, armsOverMidfoot: state.ohsArmsOverMidfoot, lumbarNeutral: state.ohsLumbarNeutral,
          kneeToWallCm: state.kneeToWallCm ? parseFloat(state.kneeToWallCm) : null,
          ankleDeg: state.ankleDeg ? parseFloat(state.ankleDeg) : null,
          heelRetest: state.heelRetest === 'better' ? 'better' : state.heelRetest === 'same' ? 'same' : null,
          handsOnHipsBetter: (state as any).handsOnHipsBetter || null,
        });
      } catch { /* noop */ }
      pro2csv = {
        lr,
        movementDriver: moveDriverCsv,
        ohs: { totalScore: ohs.totalScore, failed: ohs.failed },
      };
      try { Object.assign(pro2csv, buildPro3Export()); } catch { /* noop */ }
    } catch { /* noop */ }
    const csv = buildBBDiagnosticsCsv(report, bbPlan as any, { weakCauses: causes, weakHeads: heads, specBlock: spec, ...pro2csv });
    downloadCsv(csv, `bb-diagnostics-${new Date().toISOString().slice(0, 10)}.csv`);
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
      const f: Record<string, number> = {};
      const sb = buildSpecBlock({ weakZones: report.weakZonesGranular, factSets: f, level, weeks: parseInt(state.specWeeks) || 8, sex: effSex || undefined });
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
      const f: Record<string, number> = {};
      const sb = buildSpecBlock({ weakZones: report.weakZonesGranular, factSets: f, level, weeks: parseInt(state.specWeeks) || 8, sex: effSex || undefined });
      const ics = buildBBSpecIcs(
        { weeks: (sb.weeks || []).map((w) => ({ week: w.week, targetSets: w.targetSets, note: w.note })), weakZones: report.weakZonesGranular },
        { title: 'ББ спец-блок' },
      );
      if (!ics) {
        setToast('Не удалось собрать календарь');
        setTimeout(() => setToast(''), 2000);
        return;
      }
      downloadBBSpecIcs(ics, `bb-spec-${new Date().toISOString().slice(0, 10)}.ics`);
      setToast('📅 Календарь спец-блока скачан');
      setTimeout(() => setToast(''), 2000);
    } catch {
      setToast('⚠ Не удалось собрать календарь');
      setTimeout(() => setToast(''), 2000);
    }
  };

  // ── Упражнения → эффект (единый инструмент) ──
  const bbPlan = useMemo(() => {
    const plan = readSavedBbPlan();
    return plan && plan.weeks ? plan : null;
  }, [diarySessions, state.exerciseSelectedId, planNonce]);

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
        const asym = (() => { try { const vs = Object.entries(report.symmetry.ratios).filter(([k]) => k.endsWith('_asym')).map(([, vv]) => Number(vv)); return vs.length ? Math.max(...vs) : null; } catch { return null; } })();
        const inPlan: string[] = [];
        try {
          if (bbPlan) for (const w of (bbPlan.weeks || [])) for (const s of (w.sessions || [])) for (const ex of (s.exercises || [])) inPlan.push(String((ex as any).exerciseName || (ex as any).name || ''));
        } catch { /* noop */ }
        out[z] = rankCorrectionsForWeak(z, null, {
          cause: weakCauses[z]?.cause,
          weakHead: weakHeadForZone(z),
          asymPct: asym,
          level,
          equipment: profileEquipment,
          missingAngles: aud?.angleCoverage.missing || [],
          missingStrict: aud?.strictCoverage.missing || [],
          inPlanIds: inPlan,
          sex: effSex || undefined,
        }).slice(0, 3);
      } catch { out[z] = []; }
    }
    return out;
  }, [report.weakZonesGranular, report.symmetry.ratios, weakCauses, level, effSex, planAudit, bbPlan, profileEquipment]);

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

  const selectedDiagnosis = useMemo(() => {
    if (!selectedExRaw) return null;
    try {
      const asym = (() => {
        const vals = Object.entries(report.symmetry.ratios).filter(([k]) => k.endsWith('_asym')).map(([, v]) => Number(v));
        return vals.length ? Math.max(...vals) : null;
      })();
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
        muscle: selectedExRaw.muscle, mobilityFails: ohs.failed, asymPct: asym, planTempo: selectedExRaw.tempo || null, planPauseSeconds: selectedExRaw.pauseSeconds ?? null, planReps: 10,
        singleAngleMuscle, uncoveredSubregions: uncovered, strictMissing, weakHead,
        cheating: state.stimCheating || null,
        rangeFull: state.stimShortRom ? false : null,
        setupIssues: state.stimSetupNote.trim() ? [state.stimSetupNote.trim()] : undefined,
      } as any);
    } catch { return null; }
  }, [selectedExRaw, report.weakZonesGranular, report.weakMusclesCanonical, report.symmetry.ratios, ohs.failed, level, planAudit, state.stimCheating, state.stimShortRom, state.stimSetupNote]);

  const selectedCorrections = useMemo(() => {
    if (!selectedDiagnosis || !selectedExRaw) return [];
    try {
      const asym = (() => { try { const vs = Object.entries(report.symmetry.ratios).filter(([k]) => k.endsWith('_asym')).map(([, vv]) => Number(vv)); return vs.length ? Math.max(...vs) : null; } catch { return null; } })();
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
      return prescribeCorrections(selectedDiagnosis, selectedExRaw as any, { goal: 'hypertrophy', level, muscle: selectedExRaw.muscle, weakHead, asymPct: asym, equipment: profileEquipment, missingAngles: aud?.angleCoverage.missing || [], missingStrict: aud?.strictCoverage.missing || [], sex: effSex || undefined });
    } catch { return []; }
  }, [selectedDiagnosis, selectedExRaw, level, report.symmetry.ratios, report.weakZonesGranular, planAudit, effSex, profileEquipment]);

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
    const entry = { date: new Date().toISOString().slice(0, 10), meas };
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
      const f: Record<string, number> = {};
      const sb = buildSpecBlock({ weakZones: zones, factSets: f, level, weeks: parseInt(state.specWeeks) || 8, sex: effSex || undefined });
      dayMap = sb.dayMap;
      specWeeks = sb.weeks || [];
    } catch { /* noop */ }
    const profTempo: Record<string, string> = {};
    for (const z of zones) {
      try {
        const p = getProfExecutionProfile(z) || getProfExecutionProfile(canonicalMuscle(z));
        if (p?.tempo) profTempo[z] = p.tempo;
      } catch { /* noop */ }
    }
    const preferredIds: Record<string, string> = {};
    for (const z of zones) {
      try {
        const top = (top3ByZone[z] || [])[0];
        if (top) preferredIds[z] = top.id;
      } catch { /* noop */ }
    }
    let working: any = plan;
    let injected = 0;
    let skippedBudget = 0;
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
        const r = injectBBWeakPoints(working, zones, { dayMap, targetSets, profTempo, preferredIds, weekIdxs: [wi], rirShift, volumeMult, unilateralTopUp, returnAction: retAct ?? undefined });
        working = r.plan;
        injected += r.injected;
        skippedBudget += r.skippedBudget;
      } catch { /* noop */ }
    }
    if (!injected) {
      setToast(`⊘ Не вставлено (бюджет переполнен: ${skippedBudget} · или уже есть в днях)`);
      setTimeout(() => setToast(''), 3000);
      return;
    }
    // Снапшот — только при реальном изменении + журнал последних (для отката на N шагов)
    try {
      localStorage.setItem('he_bb_plan_saved_prev', raw as string);
      const hist = readPlanHistory(localStorage.getItem('he_bb_plan_history'));
      const next = pushPlanSnapshot(hist, {
        date: new Date().toISOString().slice(0, 10),
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

  const planHistory = (() => {
    try { return readPlanHistory(localStorage.getItem('he_bb_plan_history')); } catch { return []; }
  })();

  const handleRestoreSnapshot = (idx: number) => {
    let snap: PlanSnapshot | null = null;
    try {
      const hist = readPlanHistory(localStorage.getItem('he_bb_plan_history'));
      snap = hist[idx] || null;
    } catch { /* noop */ }
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
            <div style={{ width: 52, height: 52, borderRadius: 26, background: `conic-gradient(${sColor} ${score}%, rgba(255,255,255,0.06) 0)`, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `2px solid ${sColor}`, fontWeight: 900, color: '#fff', fontSize: 14 }}>{score}</div>
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
                  const ru: Record<string, string> = { lowSFR: 'низкий стимул', midSFR: 'стимул средний', missingLengthened: 'мало растянутой', lowUnilateral: 'мало односторонних', highFatigue: 'усталость высокая', singleAngle: 'один угол' };
                  const tail = String(f).includes(':') ? ` (${String(f).split(':').slice(1).map((m) => MUSCLE_LABEL_RU[m] || m).join(', ')})` : '';
                  return `${ru[base] || f}${tail}`;
                }).join(' · ')}</div>}
                <div style={{ color: '#fff', marginTop: 2 }}>План: {bbPlan ? `${bbPlan.weeks?.length || 0} нед` : '— нет плана (собери в ББ-авто)'} · слабые: {weakListRu(report.weakZonesGranular) || '—'} · перекос {(() => { const v = Object.entries(report.symmetry.ratios).filter(([k]) => k.endsWith('_asym')).map(([, vv]) => Number(vv)); return v.length ? Math.max(...v).toFixed(1) + '%' : '—'; })()}</div>
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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 6, marginBottom: 6 }} data-bb="ex-picker">
                <BbSheetSelect label="Упражнение" value={state.exerciseSelectedId || ''} onChange={(v) => setState(s => ({ ...s, exerciseSelectedId: v || null, stimCheating: false, stimShortRom: false, stimSetupNote: '' }))} testId="bb-exercise" options={[{ id: '', label: 'Не выбрано' }, ...EXERCISE_CATALOG.slice(0, 80).map((c) => ({ id: c.id, label: `${c.name}`, hint: `${MUSCLE_LABEL_RU[(c as any).group] || (c as any).group} · СФР ${sfrOf(c as any) ?? '—'}` }))]} />
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
                  const col = badLen || badAngle || badStrict ? '#f59e0b' : '#22c55e';
                  return (
                    <div key={m} style={{ padding: '8px 10px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: `1px solid ${col}33`, fontSize: 10, lineHeight: 1.5 }}>
                      <b style={{ color: '#fff', fontSize: 11 }}>{MUSCLE_LABEL_RU[m] || m}</b>
                      <span style={{ color: col, marginLeft: 6 }}>{bm.totalSets} сет · SFR {bm.avgSfr ?? '—'} · раст. {lenPct}% · углы {bm.angleCoverage.covered}/{bm.angleCoverage.total} · строгие {bm.strictCoverage.covered}/{bm.strictCoverage.total}</span>
                      {(badLen || badAngle || badStrict) && (
                        <div style={{ color: '#fbbf24', marginTop: 2 }}>
                          Чинить: {[badLen ? 'добавь растянутую (наклон 30°/RDL/разводка с паузой)' : null, badAngle ? `второй угол (нет: ${bm.angleCoverage.missing.slice(0, 2).join(', ')})` : null, badStrict ? `строгая группа (нет: ${bm.strictCoverage.missing.slice(0, 2).join(', ')})` : null].filter(Boolean).join(' · ')}
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
            </div>
            <div style={{ padding: '8px 10px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', marginBottom: 6 }} data-bb="screen-history">
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginBottom: 4 }}>
                <b style={{ fontSize: 11, color: '#fff' }}>📸 Снимки скрининга ({screenHist.length})</b>
                <button onClick={() => {
                  const entry = { date: new Date().toISOString().slice(0, 10), fails: ohsCodes };
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
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 6 }} data-bb="ankle-grid">
              <BbNum label="Колено к стене, см" value={state.kneeToWallCm} onChange={(v) => setState(s => ({ ...s, kneeToWallCm: v }))} placeholder="12" step={0.5} />
              <BbNum label="Голеностоп, °" value={state.ankleDeg} onChange={(v) => setState(s => ({ ...s, ankleDeg: v }))} placeholder="35" step={1} />
            </div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 6, alignItems: 'center', flexWrap: 'wrap' }} data-bb="heel-row">
              <span style={{ fontSize: 12, color: '#fff', fontWeight: 700 }}>Подпятка 2,5 см</span>
              <button onClick={() => setState(s => ({ ...s, heelRetest: 'better' }))} aria-pressed={state.heelRetest === 'better'} data-bb="heel-better" style={{ minHeight: 44, padding: '8px 14px', borderRadius: 999, border: '1px solid', borderColor: state.heelRetest === 'better' ? '#22c55e' : 'rgba(255,255,255,0.12)', background: state.heelRetest === 'better' ? 'rgba(34,197,94,0.14)' : 'rgba(255,255,255,0.04)', color: state.heelRetest === 'better' ? '#22c55e' : '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Стало лучше</button>
              <button onClick={() => setState(s => ({ ...s, heelRetest: 'same' }))} aria-pressed={state.heelRetest === 'same'} data-bb="heel-same" style={{ minHeight: 44, padding: '8px 14px', borderRadius: 999, border: '1px solid', borderColor: state.heelRetest === 'same' ? '#f59e0b' : 'rgba(255,255,255,0.12)', background: state.heelRetest === 'same' ? 'rgba(245,158,11,0.14)' : 'rgba(255,255,255,0.04)', color: state.heelRetest === 'same' ? '#f59e0b' : '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Без изменений</button>
              <button onClick={() => setState(s => ({ ...s, heelRetest: '' }))} data-bb="heel-reset" style={{ minHeight: 44, padding: '8px 14px', borderRadius: 999, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)', color: '#fff', fontSize: 12, cursor: 'pointer' }}>Сброс</button>
              <span style={{ fontSize: 11, color: '#fff' }}>Норма ≥{OHS_NORMS.kneeToWallCm.optimal} см</span>
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
