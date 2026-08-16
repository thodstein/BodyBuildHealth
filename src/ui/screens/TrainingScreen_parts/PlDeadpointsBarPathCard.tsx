/**
 * PlDeadpointsBarPathCard.tsx — ЕДИНЫЙ КАЛЬКУЛЯТОР ДИАГНОСТИКИ ДВИЖЕНИЯ:
 * Мёртвые точки → Слабые точки → Движение штанги (bar-path).
 *
 * Пользователь сам выбирает движение, фазу и отклонения. Для каждого параметра
 * выводится анализ оптимальности упражнений из PL-пула с протоколом из раскладки
 * цикла (rankPLAssistanceForIssue) + SVG-схема траектории. Добавление в ПЛ-авто —
 * одно на выбор / все рекомендуемые / все сразу.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  diagnoseMovement, barPathAnalysis, barPathIssuesForLift, BAR_PATH_ISSUES, phaseForReps,
  type BarPathIssue,
} from '../../../engines/pro/lift-diagnostics.engine';
import { analyzePhaseAssistance, analyzeBarPathAssistance, analyzeStickingCorrections, protocolFromCycle, type AssistanceAnalysis } from '../../../engines/pro/lift-assistance.engine';
import { getPLWeakGroupExerciseCandidates } from '../../../engines/lms/lms-builder.engine';
import { WEAK_POINTS_BY_LIFT, type Lift, type WeakPoint } from '../../../engines/lms/weakpoint-pl';
import { detectWeakMusclesByE1rm } from '../../../engines/pro/weak-muscle-detection.engine';
import { diagnoseVelocity, LOAD_VELOCITY_PROFILE, type VBTLift } from '../../../engines/pro/vbt.engine';
import type { SRCycleTemplate } from '../../../data/lms-cycles/lms-types';
import { applyToPlanner } from './planner-bridge';
import { loadTrainingProfile, saveTrainingProfile } from './training-profile';

const ACCENT = '#00e68a';
const DIM = 'rgba(255,255,255,0.55)';

/** Слабые мышцы: группы → подробные подгруппы (по паттернам ПЛ-пула). */
const WEAK_MUSCLE_DETAIL: Array<{ id: string; label: string; subs: Array<{ sub: string; label: string; patterns: string[]; nameRe?: RegExp }> }> = [
  {
    id: 'chest', label: 'Грудь',
    subs: [
      { sub: 'upper', label: 'Верх груди', patterns: ['incline_push'] },
      { sub: 'lower', label: 'Низ груди', patterns: ['dip_push', 'decline_push'] },
      { sub: 'mid', label: 'Середина (изоляция)', patterns: ['isolation_chest'] },
    ],
  },
  {
    id: 'back', label: 'Спина',
    subs: [
      { sub: 'width', label: 'Широчайшие (ширина)', patterns: ['vertical_pull'] },
      { sub: 'thickness', label: 'Толщина (ромбовидные)', patterns: ['horizontal_pull'] },
      { sub: 'lats', label: 'Изоляция широчайших', patterns: ['isolation_back'] },
      { sub: 'rear_delt', label: 'Задние дельты', patterns: ['isolation_shoulders'] },
    ],
  },
  {
    id: 'legs', label: 'Ноги',
    subs: [
      { sub: 'quads', label: 'Квадрицепсы', patterns: ['lunge', 'isolation_legs_quad'] },
      { sub: 'hams', label: 'Бицепс бедра', patterns: ['isolation_legs_ham', 'hinge'] },
      { sub: 'glutes', label: 'Ягодицы', patterns: ['glute_squat', 'hinge'] },
      { sub: 'calves', label: 'Икры', patterns: ['isolation_calves'] },
    ],
  },
  {
    id: 'shoulders', label: 'Плечи',
    subs: [
      { sub: 'front', label: 'Передние дельты', patterns: ['isolation_shoulders'], nameRe: /передн|фронтальные|фронт|жим стоя|армейск/i },
      { sub: 'side', label: 'Средние дельты', patterns: ['isolation_shoulders'], nameRe: /средн|в сторону|в стороны|махи|подбородку/i },
      { sub: 'rear', label: 'Задние дельты', patterns: ['isolation_shoulders'], nameRe: /задн|в наклоне|к лицу|разведен/i },
    ],
  },
  {
    id: 'arms', label: 'Руки',
    subs: [
      { sub: 'biceps', label: 'Бицепс', patterns: ['isolation_arms'], nameRe: /бицепс|сгибан|молот|скотт|брахи|curl/i },
      { sub: 'triceps', label: 'Трицепс', patterns: ['isolation_arms'], nameRe: /трицепс|разгибан|француз|узким хватом|tricep/i },
    ],
  },
  {
    id: 'core', label: 'Кор',
    subs: [
      { sub: 'abs', label: 'Пресс', patterns: ['core'] },
      { sub: 'obliques', label: 'Косые/антиротация', patterns: ['rotation', 'anti_rotation'] },
    ],
  },
];

const LIFT_RU: Record<Lift, string> = {
  bench: 'Жим лёжа', squat: 'Присед', deadlift: 'Становая тяга',
  ohp: 'Жим стоя', row: 'Тяга в наклоне', pulldown: 'Тяга верхнего блока', incline_press: 'Жим на наклонной',
};
const ISSUE_RU: Record<BarPathIssue, string> = {
  forward_drift: 'Уход штанги вперёд',
  hips_shoot_up: 'Таз выстреливает вверх',
  good_morning: 'Good-morning присед',
  bar_loops: 'Петлеобразная траектория',
  asymmetric: 'Асимметрия сторон',
};
/** Русские подписи фаз (слабых точек) — для селектора и схемы. */
const PHASE_RU: Record<string, string> = {
  off_chest: 'Сход со груди', mid: 'Средняя точка', lockout: 'Дожим', start: 'Старт',
  bottom: 'Низ (выход из ямы)',
  sumo_start: 'Сумо: старт (срыв)', sumo_lockout: 'Сумо: дожим (замыкание)',
  ohp_start: 'Старт с плеч', ohp_mid: 'Середина', ohp_lockout: 'Дожим вверх',
  row_start: 'Старт (съём)', row_mid: 'Середина', row_squeeze: 'Сведение лопаток',
  pd_top: 'Верх (старт)', pd_mid: 'Середина', pd_squeeze: 'Сведение к груди',
  inc_off: 'Сход с груди (верх)', inc_mid: 'Середина', inc_lockout: 'Дожим',
};
/** Все фазы в порядке, типичном для каждого движения. */
const LIFT_PHASES: Record<Lift, WeakPoint[]> = {
  bench: ['off_chest', 'mid', 'lockout', 'start'],
  squat: ['bottom', 'mid', 'lockout'],
  deadlift: ['start', 'mid', 'lockout', 'sumo_start', 'sumo_lockout'],
  ohp: ['ohp_start', 'ohp_mid', 'ohp_lockout'],
  row: ['row_start', 'row_mid', 'row_squeeze'],
  pulldown: ['pd_top', 'pd_mid', 'pd_squeeze'],
  incline_press: ['inc_off', 'inc_mid', 'inc_lockout'],
};
const LIFT_TO_GROUP: Record<Lift, string> = { bench: 'chest', squat: 'legs', deadlift: 'back', ohp: 'shoulders', row: 'back', pulldown: 'back', incline_press: 'chest' };

/* ── VBT: диапазон скоростей движения из LVP (для подсказок ввода) ───────── */
const VBT_LIFT_MAP: Record<Lift, VBTLift> = {
  squat: 'squat', bench: 'bench', deadlift: 'deadlift', ohp: 'ohp', row: 'row',
  pulldown: 'row', incline_press: 'bench',
};

/** Типичные значения для быстрого старта: [лучший, последний] по движению. */
const VBT_TYPICAL: Record<Lift, [string, string]> = {
  squat: ['0.75', '0.50'], bench: ['0.50', '0.35'], deadlift: ['0.62', '0.42'],
  ohp: ['0.52', '0.36'], row: ['0.68', '0.48'], pulldown: ['0.68', '0.48'], incline_press: ['0.52', '0.36'],
};

function vbtRangeForLift(lift: Lift): { min: number; max: number } | null {
  const tbl = LOAD_VELOCITY_PROFILE[VBT_LIFT_MAP[lift]];
  if (!tbl || tbl.length < 2) return null;
  // Таблица от 100%1RM (минимальная скорость) к 30% (максимальная).
  return { min: tbl[0][1], max: tbl[tbl.length - 1][1] };
}

/* ── Персистентность выбора карточки (he_pl_diagnostic_card_v1) ─────────────
 * Выбор пользователя (движение/фаза/отклонения/отмеченные упражнения/слабые
 * точки плана) переживает перезагрузку — раньше терялся при remount. */

const DIAG_CARD_KEY = 'he_pl_diagnostic_card_v1';

interface DiagnosticCardState {
  lift: Lift;
  phase: WeakPoint | '';
  issues: BarPathIssue[];
  planWeakPoints: { lift: Lift; weakPoint: WeakPoint }[];
  weakMuscleGroups: string[];
  weakMuscleSubs: string[];
  selected: Record<string, string[]>;
  days: Record<string, number[]>;
  /** Слабее сторона для отклонения «asymmetric». */
  asymSide: 'left' | 'right' | null;
  /** VBT: ручной ввод скоростей (м/с) и веса (кг) — строки инпутов. */
  vbtBest: string;
  vbtLast: string;
  vbtWeight: string;
}

const LIFT_KEYS = new Set<Lift>(Object.keys(LIFT_RU) as Lift[]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function cleanStringMap(raw: unknown): Record<string, string[]> {
  if (!isRecord(raw)) return {};
  const out: Record<string, string[]> = {};
  for (const [key, list] of Object.entries(raw)) {
    if (!Array.isArray(list)) continue;
    const names = list.filter((n): n is string => typeof n === 'string').slice(0, 40);
    if (names.length > 0) out[key.slice(0, 120)] = names;
  }
  return out;
}

function cleanDayMap(raw: unknown): Record<string, number[]> {
  if (!isRecord(raw)) return {};
  const out: Record<string, number[]> = {};
  for (const [key, list] of Object.entries(raw)) {
    if (!Array.isArray(list)) continue;
    const days = list.filter((d): d is number => typeof d === 'number' && Number.isFinite(d) && d >= 1 && d <= 7).slice(0, 7);
    if (days.length > 0) out[key.slice(0, 120)] = days;
  }
  return out;
}

function loadDiagnosticCardState(): DiagnosticCardState {
  try {
    const raw = JSON.parse(localStorage.getItem(DIAG_CARD_KEY) || 'null');
    if (!isRecord(raw)) throw new Error('bad shape');
    const lift = LIFT_KEYS.has(raw.lift as Lift) ? (raw.lift as Lift) : 'squat';
    const validPhases = LIFT_PHASES[lift] ?? [];
    const phase = typeof raw.phase === 'string' && (validPhases as string[]).includes(raw.phase) ? (raw.phase as WeakPoint) : '';
    const issues = Array.isArray(raw.issues) ? (raw.issues as BarPathIssue[]).filter(i => barPathIssuesForLift(lift).includes(i)) : [];
    const planWeakPoints = Array.isArray(raw.planWeakPoints)
      ? (raw.planWeakPoints as any[]).filter(p => p && LIFT_KEYS.has(p.lift) && typeof p.weakPoint === 'string' && ((WEAK_POINTS_BY_LIFT[p.lift as Lift] ?? []) as string[]).includes(p.weakPoint)).map(p => ({ lift: p.lift as Lift, weakPoint: p.weakPoint as WeakPoint }))
      : [];
    const weakMuscleGroups = Array.isArray(raw.weakMuscleGroups) ? raw.weakMuscleGroups.filter((g): g is string => typeof g === 'string' && WEAK_MUSCLE_DETAIL.some(d => d.id === g)) : [];
    const weakMuscleSubs = Array.isArray(raw.weakMuscleSubs)
      ? raw.weakMuscleSubs.filter((s): s is string => {
        if (typeof s !== 'string') return false;
        const [g] = s.split('|');
        const detail = WEAK_MUSCLE_DETAIL.find(d => d.id === g);
        return !!detail && detail.subs.some(sub => sub.sub === s.split('|')[1]);
      })
      : [];
    const asymSide = raw.asymSide === 'left' || raw.asymSide === 'right' ? (raw.asymSide as 'left' | 'right') : null;
    const str = (v: unknown): string => typeof v === 'string' ? v.slice(0, 20) : '';
    return { lift, phase, issues, planWeakPoints, weakMuscleGroups, weakMuscleSubs, selected: cleanStringMap(raw.selected), days: cleanDayMap(raw.days), asymSide, vbtBest: str(raw.vbtBest), vbtLast: str(raw.vbtLast), vbtWeight: str(raw.vbtWeight) };
  } catch {
    return { lift: 'squat', phase: '', issues: [], planWeakPoints: [], weakMuscleGroups: [], weakMuscleSubs: [], selected: {}, days: {}, asymSide: null, vbtBest: '', vbtLast: '', vbtWeight: '' };
  }
}

function saveDiagnosticCardState(state: DiagnosticCardState): void {
  try { localStorage.setItem(DIAG_CARD_KEY, JSON.stringify(state)); } catch { /* quota — молча пропускаем */ }
}

const CARD: React.CSSProperties = {
  padding: 12, borderRadius: 10, background: 'rgba(24,24,27,0.45)',
  border: '1px solid rgba(255,255,255,0.08)', marginTop: 8,
};

/** Мини-схема траектории штанги: идеальная линия vs выбранные отклонения.
 *  Клик по зоне фазы выбирает фазу; клик по кривой отклонения — цикл по issues. */
const BarPathSvg: React.FC<{
  lift: Lift;
  issues: BarPathIssue[];
  onIssue: (issue: BarPathIssue) => void;
  onPhase: (phase: WeakPoint) => void;
  activePhase: WeakPoint | '';
  phases: WeakPoint[];
}> = ({ lift, issues, onIssue, onPhase, activePhase, phases }) => {
  const W = 300, H = 170, PAD = 24;
  const cx = W / 2, topY = PAD, botY = H - PAD - 6;
  const path = (pts: [number, number][]): string => pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0]},${p[1]}`).join(' ');
  const ideal: [number, number][] = lift === 'squat'
    ? [[cx, topY], [cx - 6, topY + (botY - topY) * 0.3], [cx + 5, topY + (botY - topY) * 0.62], [cx, botY]]
    : [[cx, topY], [cx, botY]];
  // Отклонения: смещение кривой по X в зависимости от issues
  const offset = issues.reduce((sum, issue) => {
    switch (issue) {
      case 'forward_drift': return sum + 14;
      case 'hips_shoot_up': return sum + 8;
      case 'good_morning': return sum + 6;
      case 'bar_loops': return sum + 10;
      case 'asymmetric': return sum - 8;
      default: return sum;
    }
  }, 0);
  const deviated = ideal.map((p, i) => {
    if (i === 0) return p;
    const bend = issues.includes('hips_shoot_up') && i === 1 ? -8 : 0;
    return [p[0] + offset + bend, p[1]] as [number, number];
  });
  const phaseZones = phases.length > 0;
  // Циклический выбор отклонения при клике на кривую
  const cycleIssue = () => {
    const all = barPathIssuesForLift(lift);
    if (all.length === 0) return;
    const current = all.findIndex(i => issues.includes(i));
    const next = all[(current + 1) % all.length];
    onIssue(next);
  };
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: 340, display: 'block', margin: '0 auto', cursor: 'pointer' }} role="img" aria-label="Схема траектории штанги — клик по зоне выбирает фазу, по кривой — отклонение" onClick={cycleIssue}>
      {/* ось движения */}
      <line x1={PAD} y1={botY} x2={W - PAD} y2={botY} stroke="rgba(255,255,255,0.25)" strokeWidth={1} />
      <line x1={cx} y1={topY - 8} x2={cx} y2={botY} stroke="rgba(255,255,255,0.1)" strokeWidth={1} strokeDasharray="4 4" />
      {/* зоны фаз (клик выбирает фазу) */}
      {phaseZones && phases.map((zone, zi) => {
        const y0 = topY + (botY - topY) * (zi / Math.max(1, phases.length));
        const y1 = topY + (botY - topY) * ((zi + 1) / Math.max(1, phases.length));
        const isActive = activePhase === zone;
        return <g key={zone} onClick={e => { e.stopPropagation(); onPhase(zone); }} style={{ cursor: 'pointer' }}>
          <rect x={PAD - 4} y={y0} width={W - 2 * PAD + 8} height={y1 - y0} fill={isActive ? 'rgba(0,230,138,0.12)' : 'rgba(0,230,138,0.03)'} stroke={isActive ? 'rgba(0,230,138,0.4)' : 'transparent'} strokeWidth={1} rx={3} />
          <text x={W - PAD - 2} y={(y0 + y1) / 2 + 3} fontSize={8} fill={isActive ? ACCENT : 'rgba(255,255,255,0.4)'} textAnchor="end">{PHASE_RU[zone] || zone}</text>
        </g>;
      })}
      {/* идеальная линия */}
      <path d={path(ideal)} fill="none" stroke="#22c55e" strokeWidth={2} strokeDasharray="5 3" />
      {/* отклонение (клик — цикл) */}
      {issues.length > 0 && <path d={path(deviated)} fill="none" stroke="#ef4444" strokeWidth={2} />}
      {/* точки */}
      {ideal.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r={2.5} fill="#22c55e" />)}
      {issues.length > 0 && deviated.map((p, i) => <circle key={'d' + i} cx={p[0]} cy={p[1]} r={2.5} fill="#ef4444" />)}
      <text x={PAD} y={12} fontSize={8} fill="rgba(255,255,255,0.5)">кл.зона = фаза · кл.кривая = отклонение{issues.length ? ` (${issues.map(i => ISSUE_RU[i]).join(', ')})` : ''}</text>
    </svg>
  );
};

export const PlDeadpointsBarPathCard: React.FC<{ dayCount?: number; template?: SRCycleTemplate | null; sessions?: any[] }> = ({ dayCount = 7, template = null, sessions = [] }) => {
  const initialCardState = useMemo(loadDiagnosticCardState, []);
  const [lift, setLift] = useState<Lift>(initialCardState.lift);
  const [phase, setPhase] = useState<WeakPoint | ''>(initialCardState.phase);
  const [issues, setIssues] = useState<BarPathIssue[]>(initialCardState.issues);
  const [selected, setSelected] = useState<Record<string, string[]>>(initialCardState.selected);
  const [days, setDays] = useState<Record<string, number[]>>(initialCardState.days);
  const [savedFocus, setSavedFocus] = useState(false);
  // 🎯 Слабые точки, добавляемые в план ПЛ-авто (как бывшая верхняя карточка «Слабые точки СРЦ»).
  const [planWeakPoints, setPlanWeakPoints] = useState<{ lift: Lift; weakPoint: WeakPoint }[]>(initialCardState.planWeakPoints);
  // 💪 Слабые мышцы (подгруппы) — по циклу, как бывшая верхняя карточка «Слабые группы мышц».
  const [weakMuscleGroups, setWeakMuscleGroups] = useState<string[]>(initialCardState.weakMuscleGroups);
  const [weakMuscleSubs, setWeakMuscleSubs] = useState<string[]>(initialCardState.weakMuscleSubs);
  // ⚖️ Слабее сторона для отклонения «asymmetric» (bar-path).
  const [asymSide, setAsymSide] = useState<'left' | 'right' | null>(initialCardState.asymSide);
  // ⚡ VBT: ручной ввод скорости штанги (м/с) для диагностики потери скорости.
  const [vbtBest, setVbtBest] = useState<string>(initialCardState.vbtBest ?? '');
  const [vbtLast, setVbtLast] = useState<string>(initialCardState.vbtLast ?? '');
  const [vbtWeight, setVbtWeight] = useState<string>(initialCardState.vbtWeight ?? '');
  useEffect(() => {
    saveDiagnosticCardState({ lift, phase, issues, planWeakPoints, weakMuscleGroups, weakMuscleSubs, selected, days, asymSide, vbtBest, vbtLast, vbtWeight });
  }, [lift, phase, issues, planWeakPoints, weakMuscleGroups, weakMuscleSubs, selected, days, asymSide, vbtBest, vbtLast, vbtWeight]);
  const toggleWeakMuscle = (g: string) => setWeakMuscleGroups(cur => {
    if (cur.includes(g)) return cur.filter(x => x !== g);
    return [...cur, g];
  });
  const toggleWeakMuscleSub = (key: string) => setWeakMuscleSubs(cur => cur.includes(key) ? cur.filter(x => x !== key) : [...cur, key]);

  // Ассистенты слабых подгрупп мышц по раскладке цикла: 5 на выбор.
  const muscleAnalyses = useMemo<Record<string, AssistanceAnalysis>>(() => {
    if (!template) return {};
    const out: Record<string, AssistanceAnalysis> = {};
    for (const key of weakMuscleSubs) {
      const [group, subId] = key.split('|');
      const detail = WEAK_MUSCLE_DETAIL.find(d => d.id === group);
      const sub = detail?.subs.find(s => s.sub === subId);
      if (!detail || !sub) continue;
      const candidates = getPLWeakGroupExerciseCandidates(template, group)
        .filter(ex => sub.patterns.includes(ex.movementPattern || ''))
        .filter(ex => !sub.nameRe || sub.nameRe.test(`${ex.name} ${ex.targetMuscle || ''}`))
        .slice(0, 5);
      out[key] = {
        lift, phase: null, issue: null,
        items: candidates.map((exercise, index) => ({
          exercise,
          targetGroup: group,
          optimal: index === 0,
          rationale: `Слабая мышца «${sub.label}» — ассистент из раскладки цикла, не дублирует основные лифты.`,
          source: 'muscle' as const,
          protocol: protocolFromCycle(template, group),
          pattern: exercise.movementPattern || '',
        })),
      };
    }
    return out;
  }, [template, weakMuscleSubs, lift]);

  // 📊 Авто-детекция слабых мышц по e1RM-тренду дневника (подсказка, не авто-выбор).
  const weakMuscleHints = useMemo(() => detectWeakMusclesByE1rm(sessions), [sessions]);

  // Авто-пресет из дневника: частые тяжёлые подходы (RPE≥8) в фазе движения — подсказка (не авто-выбор).
  const diaryHint = useMemo(() => {
    if (!sessions.length) return null;
    const LIFT_ALIASES: Record<Lift, string[]> = {
      squat: ['squat', 'присед', 'приседания'],
      bench: ['bench', 'жим', 'жим лёжа', 'bench press'],
      deadlift: ['deadlift', 'тяга', 'становая тяга'],
      ohp: ['overhead press', 'жим стоя', 'ohp', 'military press'],
      row: ['barbell row', 'тяга в наклоне', 'bent over row', 'pendlay row'],
      pulldown: ['pulldown', 'тяга верхнего', 'lat pulldown', 'подтягивания'],
      incline_press: ['incline bench', 'жим на наклонной', 'incline press'],
    };
    const aliases = LIFT_ALIASES[lift] ?? [];
    const phaseCounts: Record<string, number> = {};
    const sumoPhaseCounts: Record<string, number> = {};
    let totalHard = 0;
    let sumoHard = 0;
    for (const w of sessions) {
      for (const e of (w.exercises || [])) {
        const en = (e.exerciseName || e.exerciseId || '').toLowerCase();
        if (!aliases.some(a => en.includes(a))) continue;
        const isSumo = lift === 'deadlift' && /сумо|sumo/.test(en);
        for (const s of (e.sets || [])) {
          const weight = s.weightKg || 0;
          const reps = s.reps || 0;
          const rpe = (s.rpe && s.rpe > 0) ? s.rpe : (s.rir != null ? 10 - s.rir : 0);
          const isHard = rpe >= 8 && weight > 0 && reps > 0;
          if (!isHard) continue;
          totalHard += 1;
          if (isSumo) {
            sumoHard += 1;
            // Сумо: срыв обычно в старте (низкие повторы) или замыкании бёдер.
            const sumoCand = reps <= 2 ? 'sumo_start' : reps <= 5 ? 'sumo_lockout' : null;
            if (sumoCand) sumoPhaseCounts[sumoCand] = (sumoPhaseCounts[sumoCand] || 0) + 1;
            continue;
          }
          // Фаза по повторениям — каноническая эвристика (низкая достоверность);
          // ≥6 повторений → фаза не определяется и в статистику не идёт.
          const cand = phaseForReps(reps, lift);
          if (cand) phaseCounts[cand] = (phaseCounts[cand] || 0) + 1;
        }
      }
    }
    if (totalHard === 0) return null;
    const allCounts = { ...phaseCounts, ...sumoPhaseCounts };
    if (Object.keys(allCounts).length === 0) return null;
    const top = Object.entries(allCounts).sort((a, b) => b[1] - a[1])[0];
    return { phase: top[0] as WeakPoint, count: top[1], totalHard, sumoHard, sumoPhase: Object.entries(sumoPhaseCounts).sort((a, b) => b[1] - a[1])[0]?.[0] as WeakPoint | undefined };
  }, [sessions, lift]);

  const phases = useMemo(() => (LIFT_PHASES[lift] ?? []).filter(p => {
    const d = diagnoseMovement(lift, p);
    return d.weakPoint.assistance.length > 0 || d.sticking != null;
  }), [lift]);

  // Авто-выбор первой доступной фазы при смене движения — секция видна сразу.
  const effectivePhase = phase || phases[0] || '';

  const movement = useMemo(() => (effectivePhase ? diagnoseMovement(lift, effectivePhase as WeakPoint) : null), [lift, effectivePhase]);
  const applicableIssues = useMemo(() => barPathIssuesForLift(lift), [lift]);
  const barPath = useMemo(() => issues.length ? barPathAnalysis(lift, issues) : null, [lift, issues]);

  // Анализ оптимальности по каждому параметру
  const phaseAnalysis = useMemo<AssistanceAnalysis | null>(() => (effectivePhase ? analyzePhaseAssistance(lift, effectivePhase as WeakPoint, template ?? undefined) : null), [lift, effectivePhase, template]);
  const issueAnalyses = useMemo(() => Object.fromEntries(issues.map(i => [i, analyzeBarPathAssistance(lift, i, template ?? undefined)])), [lift, issues, template]);
  // Упражнения-коррекции мёртвой точки (секция 2)
  const stickingAnalysis = useMemo<AssistanceAnalysis | null>(() => (effectivePhase ? analyzeStickingCorrections(lift, effectivePhase as WeakPoint, template ?? undefined) : null), [lift, effectivePhase, template]);
  const stickingKey = `${lift}|sticking|${effectivePhase}`;

  const changeLift = (value: Lift) => { setLift(value); setPhase(''); setIssues([]); setSelected({}); };
  const toggleIssue = (issue: BarPathIssue) => setIssues(cur => cur.includes(issue) ? cur.filter(i => i !== issue) : [...cur, issue]);
  const togglePlanWeakPoint = () => {
    if (!effectivePhase) return;
    setPlanWeakPoints(cur => {
      const idx = cur.findIndex(x => x.lift === lift && x.weakPoint === effectivePhase);
      if (idx >= 0) return cur.filter((_, i) => i !== idx);
      return [...cur, { lift, weakPoint: effectivePhase as WeakPoint }];
    });
  };

  const keyForPhase = `${lift}|${effectivePhase}`;
  const toggleExercise = (key: string, name: string) => setSelected(cur => {
    const values = new Set(cur[key] || []);
    if (values.has(name)) values.delete(name); else values.add(name);
    return { ...cur, [key]: [...values] };
  });
  const toggleDay = (key: string, day: number) => setDays(cur => {
    const values = new Set(cur[key] || []);
    if (values.has(day)) values.delete(day); else values.add(day);
    return { ...cur, [key]: [...values].sort((a, b) => a - b) };
  });
  const setAutoDays = (key: string) => setDays(cur => { const next = { ...cur }; delete next[key]; return next; });

  const addToPlan = (key: string, names: string[]) => {
    if (!names.length) return;
    setSelected(cur => ({ ...cur, [key]: [...new Set([...(cur[key] || []), ...names])] }));
  };
  const applySelected = () => applyToPlanner({
    kind: 'weakpoints',
    label: 'Диагностика движения: слабые мышцы + слабые точки + коррекции',
    data: {
      groups: [...new Set([...weakMuscleSubs.map(k => k.split('|')[0]), ...planWeakPoints.map(p => LIFT_TO_GROUP[p.lift]).filter(Boolean)])],
      plWeakPoints: planWeakPoints.map(p => ({ lift: p.lift, weakPoint: p.weakPoint, days: days[`${p.lift}|${p.weakPoint}`] ?? [] })),
      weakGroupExerciseMap: Object.fromEntries(weakMuscleSubs.map(k => [k.split('|')[0], selected[k] ?? []])),
      weakGroupDayMap: Object.fromEntries(weakMuscleSubs.map(k => [k.split('|')[0], days[k] ?? []])),
      diagnosticExerciseMap: selected,
      diagnosticDayMap: days,
    },
  });
  const saveFocus = () => {
    const group = LIFT_TO_GROUP[lift];
    const p = loadTrainingProfile();
    if (group && !p.weakPoints.includes(group)) saveTrainingProfile({ ...p, weakPoints: [...p.weakPoints, group] });
    applyToPlanner({ kind: 'weakpoints', label: 'Слабая группа (ПЛ): ' + LIFT_RU[lift] + ' → ' + group, data: { groups: [group], lift } });
    setSavedFocus(true); setTimeout(() => setSavedFocus(false), 2000);
  };

  return (
    <div style={{ padding: 12, color: '#fff' }}>
      <div style={{ fontSize: 15, fontWeight: 800, color: ACCENT }}>🎯 Слабые мышцы → Слабые точки → Мёртвые точки → Движение штанги</div>
      <div style={{ fontSize: 10, color: DIM, marginTop: 3, lineHeight: 1.45 }}>
        Выберите движение, фазу срыва и отклонения траектории. Для каждого параметра — упражнения из раскладки цикла и анализ, какое оптимально.
      </div>

      <div style={{ display: 'flex', gap: 5, marginTop: 10, flexWrap: 'wrap' }}>
        {(Object.keys(LIFT_RU) as Lift[]).map(item => (
          <button key={item} onClick={() => changeLift(item)} style={{ minHeight: 38, padding: '5px 9px', borderRadius: 8, cursor: 'pointer', border: lift === item ? `1px solid ${ACCENT}` : '1px solid rgba(255,255,255,0.1)', background: lift === item ? 'rgba(0,230,138,0.12)' : 'transparent', color: lift === item ? ACCENT : DIM, fontWeight: 700, fontSize: 10 }}>
            {LIFT_RU[item]}
          </button>
        ))}
      </div>

      {/* ═══ 1. Слабые мышцы (по циклу) ═══ */}
      <div style={CARD}>
        <div style={{ fontSize: 11, fontWeight: 800, color: '#4ade80' }}>1 · Слабые мышцы</div>
        <div style={{ fontSize: 10, color: DIM, marginTop: 2, lineHeight: 1.4 }}>
          Выберите слабую мышцу — 5 ассистентов из раскладки цикла (%ПМ/повторы/подходы — как у аксессуара недели). Основные жим/присед/становая и их дубли исключены.
        </div>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 6 }}>
          {WEAK_MUSCLE_DETAIL.map(d => {
            const on = weakMuscleGroups.includes(d.id);
            return <button key={d.id} onClick={() => toggleWeakMuscle(d.id)} style={{ minHeight: 32, padding: '5px 10px', borderRadius: 14, cursor: 'pointer', border: on ? '1px solid #4ade80' : '1px solid rgba(255,255,255,0.08)', background: on ? 'rgba(74,222,128,0.15)' : 'transparent', color: on ? '#4ade80' : DIM, fontWeight: 700, fontSize: 10 }}>{d.label}{on ? ' ✓' : ''}</button>;
          })}
        </div>
        {weakMuscleHints.length > 0 && (
          <div style={{ marginTop: 8, padding: 8, borderRadius: 8, background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#fbbf24', marginBottom: 4 }}>📊 Дневник: e1RM-тренд (28 дней) — подсказка слабых мышц</div>
            {weakMuscleHints.map(signal => (
              <div key={signal.group} style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 3 }}>
                <span style={{ fontSize: 10, color: DIM }}>
                  {signal.status === 'weak' ? '📉' : '🟡'} {signal.label}: {signal.currentE1rm}{signal.priorE1rm > 0 ? ` кг (было ${signal.priorE1rm}, ${signal.deltaPct > 0 ? '+' : ''}${signal.deltaPct}%)` : ' кг'} · {signal.sessions} сесс.
                </span>
                <button onClick={() => { if (!weakMuscleGroups.includes(signal.group)) toggleWeakMuscle(signal.group); }} style={{ padding: '2px 8px', borderRadius: 6, cursor: 'pointer', fontSize: 9, border: '1px solid rgba(245,158,11,0.3)', background: 'rgba(245,158,11,0.1)', color: '#fbbf24', fontWeight: 700, minHeight: 26 }}>
                  ➕ в слабые мышцы
                </button>
              </div>
            ))}
          </div>
        )}
        {!template && (
          <div style={{ marginTop: 6, fontSize: 10, color: 'rgba(255,255,255,0.45)' }}>Выберите цикл в ПЛ-авто — ассистенты подбираются по его раскладке.</div>
        )}
        {weakMuscleGroups.map(group => {
          const detail = WEAK_MUSCLE_DETAIL.find(d => d.id === group);
          if (!detail) return null;
          return (
            <div key={group} style={{ marginTop: 8, padding: 8, borderRadius: 8, background: 'rgba(74,222,128,0.04)', border: '1px solid rgba(74,222,128,0.12)' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#4ade80', marginBottom: 4 }}>{detail.label} — выберите мышцу:</div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {detail.subs.map(s => {
                  const key = `${group}|${s.sub}`;
                  const on = weakMuscleSubs.includes(key);
                  return <button key={s.sub} onClick={() => toggleWeakMuscleSub(key)} style={{ minHeight: 28, padding: '4px 9px', borderRadius: 10, cursor: 'pointer', fontSize: 9, border: on ? '1px solid #4ade80' : '1px solid rgba(255,255,255,0.08)', background: on ? 'rgba(74,222,128,0.18)' : 'transparent', color: on ? '#4ade80' : DIM, fontWeight: 700 }}>{s.label}{on ? ' ✓' : ''}</button>;
                })}
              </div>
              {detail.subs.filter(s => weakMuscleSubs.includes(`${group}|${s.sub}`)).map(s => {
                const key = `${group}|${s.sub}`;
                const analysis = muscleAnalyses[key];
                if (!analysis || analysis.items.length === 0) return null;
                return (
                  <div key={key} style={{ marginTop: 8, padding: 8, borderRadius: 8, background: 'rgba(74,222,128,0.05)', border: '1px solid rgba(74,222,128,0.15)' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#4ade80', marginBottom: 4 }}>🏋️ {s.label} — ассистенты по циклу (выберите и добавьте в план):</div>
                    {analysis.items.map((item, idx) => (
                      <ExerciseRow key={idx} item={item} selected={selected[key]?.includes(item.exercise.name) ?? false}
                        onToggle={() => toggleExercise(key, item.exercise.name)} onAdd={() => addToPlan(key, [item.exercise.name])} />
                    ))}
                    <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                      <button onClick={() => addToPlan(key, analysis.items.filter(i => i.optimal).map(i => i.exercise.name))} style={{ ...btn, background: 'rgba(0,230,138,0.15)', color: ACCENT, border: '1px solid rgba(0,230,138,0.3)' }}>➕ Рекомендуемые</button>
                      <button onClick={() => addToPlan(key, analysis.items.map(i => i.exercise.name))} style={{ ...btn, background: 'rgba(96,165,250,0.12)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.25)' }}>➕ Все</button>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* ═══ 2. Слабые точки ═══ */}
      <div style={CARD}>
        <div style={{ fontSize: 11, fontWeight: 800, color: ACCENT }}>2 · Слабые точки</div>
        <div style={{ fontSize: 10, color: DIM, marginTop: 6, marginBottom: 4 }}>Фаза (срыв / слабое место) — выберите чип:</div>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {phases.map(item => {
            const on = effectivePhase === item;
            return <button key={item} onClick={() => setPhase(item)} style={{ minHeight: 34, padding: '5px 10px', borderRadius: 8, cursor: 'pointer', border: on ? '1px solid #a855f7' : '1px solid rgba(255,255,255,0.1)', background: on ? 'rgba(168,85,247,0.16)' : 'transparent', color: on ? '#c084fc' : DIM, fontWeight: 700, fontSize: 10 }}>{PHASE_RU[item] || item}</button>;
          })}
        </div>
        {diaryHint && (
          <div style={{ marginTop: 6, padding: 7, borderRadius: 8, background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.25)', fontSize: 10, color: '#fbbf24', lineHeight: 1.5 }}>
            📊 Дневник: {diaryHint.count} из {diaryHint.totalHard} тяжёлых подходов ({lift === 'squat' ? 'присед' : lift === 'bench' ? 'жим' : lift === 'deadlift' ? 'тяга' : LIFT_RU[lift]}) срываются в фазе «{PHASE_RU[diaryHint.phase]}». Эвристика по повторениям (низкая достоверность) — подсказка, не авто-выбор.
            {lift === 'deadlift' && diaryHint.sumoHard > 0 && (
              <div style={{ marginTop: 3 }}>
                🤸 Сумо: {diaryHint.sumoHard} тяжёлых подходов{diaryHint.sumoPhase ? ` — вероятная фаза «${PHASE_RU[diaryHint.sumoPhase]}»` : ''} — проверьте фазы «Сумо: старт» и «Сумо: дожим».
              </div>
            )}
          </div>
        )}
        {movement && (
          <div style={{ marginTop: 10 }}>
            <div style={{ fontWeight: 800, color: '#ef4444', fontSize: 12 }}>⚠ {movement.weakPoint.label}</div>
            <div style={{ fontSize: 10, color: DIM, marginTop: 2 }}>{movement.weakPoint.description}</div>
            {/* Результат: упражнения с анализом оптимальности (слабые + мёртвые точки) */}
            {phaseAnalysis && phaseAnalysis.items.length > 0 && (
              <div style={{ marginTop: 8, padding: 8, borderRadius: 8, background: 'rgba(0,230,138,0.04)', border: '1px solid rgba(0,230,138,0.12)' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: ACCENT, marginBottom: 4 }}>🏋️ Упражнения (из раскладки цикла, %ПМ/повторы/подходы):</div>
                {phaseAnalysis.items.map((item, idx) => (
                  <ExerciseRow key={idx} item={item} selected={selected[keyForPhase]?.includes(item.exercise.name) ?? false}
                    onToggle={() => toggleExercise(keyForPhase, item.exercise.name)} onAdd={() => addToPlan(keyForPhase, [item.exercise.name])} />
                ))}
                <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                  <button onClick={() => addToPlan(keyForPhase, phaseAnalysis.items.filter(i => i.optimal).map(i => i.exercise.name))} style={{ ...btn, background: 'rgba(0,230,138,0.15)', color: ACCENT, border: '1px solid rgba(0,230,138,0.3)' }}>➕ Рекомендуемые</button>
                  <button onClick={() => addToPlan(keyForPhase, phaseAnalysis.items.map(i => i.exercise.name))} style={{ ...btn, background: 'rgba(96,165,250,0.12)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.25)' }}>➕ Все</button>
                </div>
              </div>
            )}
          </div>
        )}
        {(() => {
          const inPlan = planWeakPoints.some(x => x.lift === lift && x.weakPoint === effectivePhase);
          return (
            <button onClick={togglePlanWeakPoint} disabled={!effectivePhase} style={{ width: '100%', minHeight: 40, marginTop: 10, border: 'none', borderRadius: 8, cursor: effectivePhase ? 'pointer' : 'not-allowed', background: inPlan ? 'rgba(34,197,94,0.15)' : 'rgba(139,92,246,0.15)', color: inPlan ? '#4ade80' : '#8b5cf6', fontWeight: 700, fontSize: 11, opacity: effectivePhase ? 1 : 0.5 }}>
              {inPlan ? '✓ Слабая точка в плане ПЛ — убрать' : '➕ Добавить слабую точку в план ПЛ (ассистенты при сборке: тяжёлый + памп-день)'}
            </button>
          );
        })()}
        <button onClick={saveFocus} style={{ width: '100%', minHeight: 40, marginTop: 10, border: 'none', borderRadius: 8, cursor: 'pointer', background: 'rgba(168,85,247,0.15)', color: '#c084fc', fontWeight: 700, fontSize: 11 }}>
          {savedFocus ? '✓ Фокус-группа сохранена в профиль' : '💾 Сохранить фокус-группу в профиль'}
        </button>
      </div>

      {/* ═══ 3. Мёртвые точки (та же фаза — углы суставов) ═══ */}
      <div style={CARD}>
        <div style={{ fontSize: 11, fontWeight: 800, color: '#60a5fa' }}>3 · Мёртвые точки {effectivePhase ? `· ${LIFT_RU[lift]} / ${PHASE_RU[effectivePhase] || effectivePhase}` : ''}</div>
        {movement?.sticking ? (
          <div style={{ marginTop: 6, padding: 8, borderRadius: 8, background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.15)' }}>
            <div style={{ fontSize: 10, color: DIM }}>📐 Угол: {movement.sticking.angleRangeDeg[0]}°–{movement.sticking.angleRangeDeg[1]}° · сустав: {movement.sticking.keyJoint}</div>
            <div style={{ fontSize: 10, color: DIM, marginTop: 2 }}>🧠 {movement.sticking.biomechanicalReason}</div>
            <div style={{ fontSize: 10, color: DIM, marginTop: 2 }}>💪 Слабые мышцы: {movement.sticking.weakMuscles.join(', ')}</div>
            <div style={{ fontSize: 10, color: '#f59e0b', marginTop: 3 }}>Коррекции: {movement.sticking.corrections.join(' · ')}</div>
            <div style={{ fontSize: 10, color: '#818cf8', marginTop: 3 }}>💡 Cue: {movement.sticking.loadCues}</div>
          </div>
        ) : (
          <div style={{ marginTop: 6, padding: 8, borderRadius: 8, background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.15)' }}>
            <div style={{ fontSize: 10, color: DIM, lineHeight: 1.5 }}>
              📐 Угловая диагностика недоступна для этой фазы — используйте слабые точки (раздел 2) и движение штанги (раздел 4).
            </div>
          </div>
        )}
        {/* Выбираемые упражнения-коррекции (для ВСЕХ движений — не только текст) */}
        {stickingAnalysis && stickingAnalysis.items.length > 0 && (
          <div style={{ marginTop: 8, padding: 8, borderRadius: 8, background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.18)' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#60a5fa', marginBottom: 4 }}>🏋️ Упражнения-коррекции (выберите и добавьте в план):</div>
            {stickingAnalysis.items.map((item, idx) => (
              <ExerciseRow key={idx} item={item} selected={selected[stickingKey]?.includes(item.exercise.name) ?? false}
                onToggle={() => toggleExercise(stickingKey, item.exercise.name)} onAdd={() => addToPlan(stickingKey, [item.exercise.name])} />
            ))}
            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              <button onClick={() => addToPlan(stickingKey, stickingAnalysis.items.filter(i => i.optimal).map(i => i.exercise.name))} style={{ ...btn, background: 'rgba(0,230,138,0.15)', color: ACCENT, border: '1px solid rgba(0,230,138,0.3)' }}>➕ Рекомендуемые</button>
              <button onClick={() => addToPlan(stickingKey, stickingAnalysis.items.map(i => i.exercise.name))} style={{ ...btn, background: 'rgba(96,165,250,0.12)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.25)' }}>➕ Все</button>
            </div>
          </div>
        )}
        {movement && movement.barPathRelated.length > 0 && (
          <div style={{ marginTop: 6, fontSize: 10, color: '#c084fc' }}>
            🔗 Связанные отклонения траектории: {movement.barPathRelated.map(i => ISSUE_RU[i]).join(', ')}
          </div>
        )}
      </div>

      {/* ═══ 3.5. VBT: скорость штанги (ручной ввод) ═══ */}
      <div style={CARD}>
        <div style={{ fontSize: 11, fontWeight: 800, color: '#f472b6' }}>3.5 · ⚡ VBT: скорость штанги · {LIFT_RU[lift]}</div>
        <div style={{ fontSize: 10, color: DIM, marginTop: 2, lineHeight: 1.4 }}>
          Введите скорости повторов (м/с). Потеря скорости от лучшего к последнему повтору показывает, насколько близко вы к отказу: <b style={{ color: '#f472b6' }}>&lt;10% — стабильно</b> · <b style={{ color: '#f59e0b' }}>10–20% — зона силы</b> · <b style={{ color: '#ef4444' }}>≥20% — отказ близко</b>.
        </div>
        {(() => { const rng = vbtRangeForLift(lift); return rng && (
          <div style={{ marginTop: 4, fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>
            📐 Типичный диапазон {LIFT_RU[lift]}: <b style={{ color: '#f472b6' }}>{rng.min.toFixed(2)}–{rng.max.toFixed(2)} м/с</b> (от ~100%1RM к ~30%1RM).
          </div>
        ); })()}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 8, boxSizing: 'border-box' }}>
          <label style={{ display: 'block', fontSize: 10, color: DIM }}>
            <div style={{ fontWeight: 700, color: '#f472b6', marginBottom: 3 }}>⚡ Лучший повтор</div>
            <input type="number" step="0.01" min="0" value={vbtBest} onChange={e => setVbtBest(e.target.value)} placeholder={VBT_TYPICAL[lift][0]} aria-label="Скорость лучшего повтора (м/с)"
              style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(244,114,182,0.25)', color: '#fff', borderRadius: 8, padding: '7px 8px', fontSize: 12, outline: 'none' }} />
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', marginTop: 3, lineHeight: 1.3 }}>Самая быстрая скорость в подходе (1-й повтор)</div>
          </label>
          <label style={{ display: 'block', fontSize: 10, color: DIM }}>
            <div style={{ fontWeight: 700, color: '#f472b6', marginBottom: 3 }}>⏱ Последний повтор</div>
            <input type="number" step="0.01" min="0" value={vbtLast} onChange={e => setVbtLast(e.target.value)} placeholder={VBT_TYPICAL[lift][1]} aria-label="Скорость последнего повтора (м/с)"
              style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(244,114,182,0.25)', color: '#fff', borderRadius: 8, padding: '7px 8px', fontSize: 12, outline: 'none' }} />
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', marginTop: 3, lineHeight: 1.3 }}>Скорость финального повтора (медленнее лучшего)</div>
          </label>
          <label style={{ display: 'block', fontSize: 10, color: DIM }}>
            <div style={{ fontWeight: 700, color: '#f472b6', marginBottom: 3 }}>🏋️ Вес (кг)</div>
            <input type="number" step="0.5" min="0" value={vbtWeight} onChange={e => setVbtWeight(e.target.value)} placeholder="100" aria-label="Вес штанги (кг)"
              style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(244,114,182,0.25)', color: '#fff', borderRadius: 8, padding: '7px 8px', fontSize: 12, outline: 'none' }} />
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', marginTop: 3, lineHeight: 1.3 }}>Для оценки e1RM по скорости (необязательно)</div>
          </label>
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
          <button onClick={() => { const [b, l] = VBT_TYPICAL[lift]; setVbtBest(b); setVbtLast(l); }} style={{ ...btn, background: 'rgba(244,114,182,0.1)', color: '#f472b6', border: '1px solid rgba(244,114,182,0.25)' }}>🎯 Заполнить типичными</button>
          <button onClick={() => { setVbtBest(''); setVbtLast(''); setVbtWeight(''); }} style={{ ...btn, background: 'rgba(255,255,255,0.05)', color: DIM, border: '1px solid rgba(255,255,255,0.12)' }}>✕ Сбросить</button>
        </div>
        {(() => {
          const best = parseFloat(vbtBest);
          const last = parseFloat(vbtLast);
          const weight = parseFloat(vbtWeight);
          const hasVelocities = Number.isFinite(best) && Number.isFinite(last) && best > 0 && last > 0 && last <= best;
          const d = hasVelocities ? diagnoseVelocity(lift, best, last, Number.isFinite(weight) && weight > 0 ? weight : undefined) : null;
          // Фаза для коррекций: при отказе — фаза максимального момента (suggested),
          // иначе — текущая выбранная фаза движения (коррекции доступны всегда).
          const vbtPhase = (d?.suggestedPhase ?? effectivePhase) as WeakPoint | null;
          const vbtSticking = vbtPhase ? analyzeStickingCorrections(lift, vbtPhase, template ?? undefined) : null;
          const vbtKey = `${lift}|vbt|${vbtPhase ?? 'none'}`;
          return (
            <div style={{ marginTop: 6, padding: 8, borderRadius: 8, background: d?.exceeded ? 'rgba(239,68,68,0.07)' : 'rgba(244,114,182,0.05)', border: `1px solid ${d?.exceeded ? 'rgba(239,68,68,0.25)' : 'rgba(244,114,182,0.2)'}` }}>
              {hasVelocities && d && (
                <>
                  <div style={{ fontSize: 10, color: '#f472b6', fontWeight: 700 }}>
                    Потеря скорости: {d.lossPct}% · {d.zone}
                  </div>
                  {d.e1RMByVelocity != null && (
                    <div style={{ fontSize: 10, color: DIM, marginTop: 2 }}>e1RM по скорости (последний повтор): {d.e1RMByVelocity} кг</div>
                  )}
                  {d.exceeded && d.suggestedPhase && (
                    <div style={{ marginTop: 4, fontSize: 10, color: '#fbbf24', lineHeight: 1.4 }}>
                      ⚠ Отказ близко — вероятная слабая фаза «{PHASE_RU[d.suggestedPhase] || d.suggestedPhase}» (максимальный момент). Коррекции ниже.
                    </div>
                  )}
                  {!d.exceeded && (
                    <div style={{ marginTop: 4, fontSize: 10, color: DIM, lineHeight: 1.4 }}>
                      Скорость в пределах порога. Коррекции текущей фазы — ниже.
                    </div>
                  )}
                </>
              )}
              {!hasVelocities && (
                <div style={{ fontSize: 10, color: Number.isFinite(best) && Number.isFinite(last) && best > 0 && last > 0 ? '#f59e0b' : 'rgba(255,255,255,0.45)' }}>
                  {Number.isFinite(best) && Number.isFinite(last) && best > 0 && last > 0
                    ? '⚠ Последний повтор не может быть быстрее лучшего — проверьте значения.'
                    : 'Введите скорости (м/с) — коррекции текущей фазы показаны ниже сразу.'}
                </div>
              )}
              {vbtSticking && vbtSticking.items.length > 0 && (
                <div style={{ marginTop: 6 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#f472b6', marginBottom: 3 }}>
                    🏋️ Коррекции фазы «{PHASE_RU[vbtPhase!] || vbtPhase}» (выберите и добавьте в план):
                  </div>
                  {vbtSticking.items.map((item, idx) => (
                    <ExerciseRow key={idx} item={item} selected={selected[vbtKey]?.includes(item.exercise.name) ?? false}
                      onToggle={() => toggleExercise(vbtKey, item.exercise.name)} onAdd={() => addToPlan(vbtKey, [item.exercise.name])} />
                  ))}
                  <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                    <button onClick={() => addToPlan(vbtKey, vbtSticking.items.filter(i => i.optimal).map(i => i.exercise.name))} style={{ ...btn, background: 'rgba(0,230,138,0.15)', color: ACCENT, border: '1px solid rgba(0,230,138,0.3)' }}>➕ Рекомендуемые</button>
                    <button onClick={() => addToPlan(vbtKey, vbtSticking.items.map(i => i.exercise.name))} style={{ ...btn, background: 'rgba(244,114,182,0.12)', color: '#f472b6', border: '1px solid rgba(244,114,182,0.3)' }}>➕ Все</button>
                  </div>
                </div>
              )}
              {(!vbtSticking || vbtSticking.items.length === 0) && (
                <div style={{ marginTop: 6, fontSize: 10, color: 'rgba(255,255,255,0.45)' }}>
                  Коррекции для фазы «{vbtPhase ? (PHASE_RU[vbtPhase] || vbtPhase) : '—'}» не найдены в пуле — используйте слабые точки (раздел 2).
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* ═══ 4. Движение штанги (bar-path) ═══ */}
      {applicableIssues.length > 0 && (
        <div style={CARD}>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#a855f7' }}>4 · Движение штанги (bar-path) · {LIFT_RU[lift]}</div>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 8 }}>
            {applicableIssues.map(issue => {
              const on = issues.includes(issue);
              return <button key={issue} onClick={() => toggleIssue(issue)} style={{ minHeight: 34, padding: '5px 8px', borderRadius: 7, cursor: 'pointer', border: on ? '1px solid #a855f7' : '1px solid rgba(255,255,255,0.1)', background: on ? 'rgba(168,85,247,0.14)' : 'transparent', color: on ? '#c084fc' : DIM, fontSize: 10 }}>{ISSUE_RU[issue]}</button>;
            })}
          </div>
          {issues.includes('asymmetric') && (
            <div style={{ marginTop: 6, padding: 6, borderRadius: 8, background: 'rgba(168,85,247,0.06)', border: '1px solid rgba(168,85,247,0.15)' }}>
              <div style={{ fontSize: 10, color: DIM, marginBottom: 4 }}>⚖️ Какая сторона слабее? (для подбора унилатеральной работы)</div>
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                {(['left', 'right'] as const).map(side => {
                  const on = asymSide === side;
                  return <button key={side} onClick={() => setAsymSide(cur => cur === side ? null : side)} style={{ minHeight: 30, padding: '4px 12px', borderRadius: 7, cursor: 'pointer', border: on ? '1px solid #a855f7' : '1px solid rgba(255,255,255,0.1)', background: on ? 'rgba(168,85,247,0.18)' : 'transparent', color: on ? '#c084fc' : DIM, fontSize: 10, fontWeight: 700 }}>{side === 'left' ? 'Левая' : 'Правая'}{on ? ' ✓' : ''}</button>;
                })}
              </div>
            </div>
          )}
          <BarPathSvg lift={lift} issues={issues} onIssue={toggleIssue} onPhase={p => setPhase(p)} activePhase={effectivePhase} phases={phases} />
          {barPath && barPath.diagnoses.map(item => (
            <div key={item.issue} style={{ marginTop: 6, padding: 7, borderRadius: 8, background: 'rgba(168,85,247,0.05)', border: '1px solid rgba(168,85,247,0.15)' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#c084fc' }}>{ISSUE_RU[item.issue]}{item.relatedPhase ? ` · связана с фазой ${item.relatedPhase}` : ''}</div>
              {item.issue === 'asymmetric' && asymSide && (
                <div style={{ fontSize: 10, color: '#f59e0b', marginTop: 2 }}>⚖️ Слабее: {asymSide === 'left' ? 'левая' : 'правая'} сторона → приоритет унилатеральной работе (выпады, тяга гантели одной рукой, болгарские сплит-приседы).</div>
              )}
              <div style={{ fontSize: 10, color: DIM, marginTop: 2 }}>{item.cause} <span style={{ color: ACCENT }}>→ {item.correction}</span></div>
              <div style={{ marginTop: 4 }}>
                {issueAnalyses[item.issue]?.items.map((a, idx) => (
                  <ExerciseRow key={idx} item={a} selected={selected[`${lift}|barpath|${item.issue}`]?.includes(a.exercise.name) ?? false}
                    onToggle={() => toggleExercise(`${lift}|barpath|${item.issue}`, a.exercise.name)} onAdd={() => addToPlan(`${lift}|barpath|${item.issue}`, [a.exercise.name])} />
                ))}
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                <button onClick={() => addToPlan(`${lift}|barpath|${item.issue}`, issueAnalyses[item.issue]?.items.filter(i => i.optimal).map(i => i.exercise.name) ?? [])} style={{ ...btn, background: 'rgba(0,230,138,0.15)', color: ACCENT, border: '1px solid rgba(0,230,138,0.3)' }}>➕ Рекомендуемые</button>
                <button onClick={() => addToPlan(`${lift}|barpath|${item.issue}`, issueAnalyses[item.issue]?.items.map(i => i.exercise.name) ?? [])} style={{ ...btn, background: 'rgba(96,165,250,0.12)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.25)' }}>➕ Все</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 🎯 Слабые точки плана ПЛ (ассистенты при сборке; дни — свои или Авто) */}
      {planWeakPoints.length > 0 && (
        <div style={CARD}>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#8b5cf6' }}>🎯 Слабые точки плана (СРЦ)</div>
          <div style={{ fontSize: 10, color: DIM, marginTop: 2, lineHeight: 1.4 }}>
            Добавятся в план при сборке: тяжёлый (3×8 RIR 2) + памп-день (3×12 @60% RIR 3). Выберите дни или оставьте «Авто».
          </div>
          {planWeakPoints.map(p => {
            const key = `${p.lift}|${p.weakPoint}`;
            const inPlanDays = days[key] || [];
            return (
              <div key={key} style={{ marginTop: 6 }}>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.75)', fontWeight: 700 }}>
                  {LIFT_RU[p.lift]} · {PHASE_RU[p.weakPoint] || p.weakPoint}
                  <button onClick={() => setPlanWeakPoints(cur => cur.filter(x => !(x.lift === p.lift && x.weakPoint === p.weakPoint)))} style={{ marginLeft: 8, padding: '2px 7px', borderRadius: 6, cursor: 'pointer', fontSize: 9, border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.1)', color: '#f87171' }}>✕ убрать</button>
                </div>
                <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                  <button onClick={() => setAutoDays(key)} style={{ padding: '3px 7px', borderRadius: 6, cursor: 'pointer', fontSize: 9, border: !inPlanDays.length ? '1px solid #8b5cf6' : '1px solid rgba(255,255,255,0.1)', background: !inPlanDays.length ? 'rgba(139,92,246,.15)' : 'transparent', color: !inPlanDays.length ? '#a78bfa' : DIM }}>Авто (тяжёлый+памп)</button>
                  {Array.from({ length: Math.max(1, dayCount) }, (_, index) => index + 1).map(day => (
                    <button key={day} onClick={() => toggleDay(key, day)} style={{ padding: '3px 7px', borderRadius: 6, cursor: 'pointer', fontSize: 9, border: inPlanDays.includes(day) ? '1px solid #8b5cf6' : '1px solid rgba(255,255,255,0.1)', background: inPlanDays.includes(day) ? 'rgba(139,92,246,.15)' : 'transparent', color: inPlanDays.includes(day) ? '#a78bfa' : DIM }}>Д{day}</button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Выбор дней для добавленных упражнений (виден всегда; Авто = тяжёлый + памп-день) */}
      <div style={CARD}>
        <div style={{ fontSize: 11, fontWeight: 800, color: ACCENT }}>📅 Дни добавления</div>
        <div style={{ fontSize: 10, color: DIM, marginTop: 2, lineHeight: 1.4 }}>
          По умолчанию — «Авто» (тяжёлый + памп-день). Для выбранных упражнений можно задать свои дни:
        </div>
        {Object.keys(selected).length === 0 && (
          <div style={{ marginTop: 6, fontSize: 10, color: 'rgba(255,255,255,0.45)' }}>
            Сначала отметьте упражнения кнопками «＋»/«➕» — появятся чипы дней.
          </div>
        )}
        {Object.entries(selected).map(([key, names]) => names.length > 0 && (
          <div key={key} style={{ marginTop: 6 }}>
            <div style={{ fontSize: 10, color: DIM }}>{key}: {names.join(', ')}</div>
            <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap', alignItems: 'center' }}>
              <button onClick={() => setAutoDays(key)} style={{ padding: '3px 7px', borderRadius: 6, cursor: 'pointer', fontSize: 9, border: !days[key]?.length ? '1px solid #a855f7' : '1px solid rgba(255,255,255,0.1)', background: !days[key]?.length ? 'rgba(168,85,247,.15)' : 'transparent', color: !days[key]?.length ? '#c084fc' : DIM }}>Авто</button>
              {Array.from({ length: Math.max(1, dayCount) }, (_, index) => index + 1).map(day => (
                <button key={day} onClick={() => toggleDay(key, day)} style={{ padding: '3px 7px', borderRadius: 6, cursor: 'pointer', fontSize: 9, border: days[key]?.includes(day) ? '1px solid #a855f7' : '1px solid rgba(255,255,255,0.1)', background: days[key]?.includes(day) ? 'rgba(168,85,247,.15)' : 'transparent', color: days[key]?.includes(day) ? '#c084fc' : DIM }}>Д{day}</button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* 🏆 Рекомендация тренера ПЛ: итоговый оптимальный перечень под выбор пользователя */}
      <div style={CARD}>
        <div style={{ fontSize: 11, fontWeight: 800, color: '#fbbf24' }}>🏆 Рекомендация тренера ПЛ</div>
        {(() => {
          const recs: Array<{ key: string; name: string; label: string }> = [];
          for (const key of weakMuscleSubs) {
            const first = muscleAnalyses[key]?.items.find(i => i.optimal);
            if (first) {
              const [g, subId] = key.split('|');
              const label = WEAK_MUSCLE_DETAIL.find(d => d.id === g)?.subs.find(s => s.sub === subId)?.label || g;
              recs.push({ key, name: first.exercise.name, label: '💪 ' + label });
            }
          }
          if (phaseAnalysis) {
            const first = phaseAnalysis.items.find(i => i.optimal);
            if (first) recs.push({ key: keyForPhase, name: first.exercise.name, label: '⚡ Слабая точка' });
          }
          if (stickingAnalysis) {
            const first = stickingAnalysis.items.find(i => i.optimal);
            if (first) recs.push({ key: stickingKey, name: first.exercise.name, label: '🩻 Мёртвая точка' });
          }
          for (const issue of issues) {
            const first = issueAnalyses[issue]?.items.find(i => i.optimal);
            if (first) recs.push({ key: `${lift}|barpath|${issue}`, name: first.exercise.name, label: '📈 ' + (ISSUE_RU[issue] || issue) });
          }
          if (recs.length === 0) {
            return <div style={{ marginTop: 6, fontSize: 10, color: DIM }}>Отметьте слабые мышцы, точки и отклонения — здесь появится итоговый перечень тренера под ваш выбор.</div>;
          }
          return (
            <div style={{ marginTop: 6 }}>
              <div style={{ fontSize: 10, color: DIM, lineHeight: 1.4 }}>Оптимальный перечень под ваш выбор (по одному лучшему на параметр):</div>
              {recs.map((r, i) => (
                <div key={i} style={{ marginTop: 4, fontSize: 10, color: 'rgba(255,255,255,0.85)', padding: '5px 8px', borderRadius: 7, background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.18)', display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                  <span style={{ minWidth: 0, overflowWrap: 'break-word' }}>{r.label}: <b style={{ color: '#fbbf24' }}>{r.name}</b></span>
                  <button onClick={() => addToPlan(r.key, [r.name])} style={{ ...btn, flexShrink: 0, background: 'rgba(251,191,36,0.12)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.3)' }}>➕</button>
                </div>
              ))}
              <button onClick={() => recs.forEach(r => addToPlan(r.key, [r.name]))} style={{ width: '100%', minHeight: 38, marginTop: 8, border: 'none', borderRadius: 8, cursor: 'pointer', background: 'rgba(251,191,36,0.14)', color: '#fbbf24', fontWeight: 800, fontSize: 11 }}>
                🏆 Добавить весь рекомендованный перечень в план
              </button>
            </div>
          );
        })()}
      </div>

      <button onClick={applySelected} style={{ width: '100%', minHeight: 44, marginTop: 8, border: 'none', borderRadius: 9, cursor: 'pointer', background: 'linear-gradient(135deg,#00e68a,#00c853)', color: '#000', fontWeight: 800 }}>
        🛠 Добавить выбранные упражнения в ПЛ-авто ({Object.values(selected).reduce((s, n) => s + n.length, 0)})
      </button>

      <div style={{ marginTop: 8, padding: 9, borderRadius: 8, background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.18)', color: '#fbbf24', fontSize: 10, lineHeight: 1.45 }}>
        Правило ПЛ-авто: исходные упражнения и процентовки цикла не меняются. Эти данные используются для выбора дополнительных ассистентов и корректирующих упражнений.
      </div>
    </div>
  );
};

const btn: React.CSSProperties = { padding: '5px 10px', borderRadius: 7, cursor: 'pointer', fontSize: 10, fontWeight: 700, minHeight: 32 };

const SOURCE_TAG: Record<string, { label: string; color: string; bg: string }> = {
  muscle: { label: '💪 Слабая мышца', color: '#4ade80', bg: 'rgba(74,222,128,0.12)' },
  weak: { label: '⚡ Слабая точка', color: '#4ade80', bg: 'rgba(34,197,94,0.12)' },
  sticking: { label: '🩻 Мёртвая точка', color: '#60a5fa', bg: 'rgba(96,165,250,0.12)' },
  bar: { label: '📈 Bar-path', color: '#c084fc', bg: 'rgba(168,85,247,0.12)' },
};

const ExerciseRow: React.FC<{ item: any; selected: boolean; onToggle: () => void; onAdd: () => void }> = ({ item, selected, onToggle, onAdd }) => {
  const tag = SOURCE_TAG[item.source] || SOURCE_TAG.sticking;
  return (
  <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 6px', marginTop: 3, borderRadius: 6, background: selected ? 'rgba(0,230,138,0.1)' : 'rgba(255,255,255,0.02)', border: selected ? '1px solid rgba(0,230,138,0.35)' : '1px solid rgba(255,255,255,0.05)' }}>
    <button onClick={onToggle} style={{ minWidth: 24, height: 24, borderRadius: 5, cursor: 'pointer', border: 'none', background: selected ? ACCENT : 'rgba(255,255,255,0.1)', color: selected ? '#000' : DIM, fontWeight: 800, fontSize: 12 }}>{selected ? '✓' : '＋'}</button>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#fff' }}>
        {item.optimal ? '⭐ ' : ''}{item.exercise.name} <span style={{ color: ACCENT, fontWeight: 800 }}>{item.protocol.sets}×{item.protocol.reps} @{Math.round(item.protocol.pct * 100)}% RIR {item.protocol.rir ?? 2}</span>{' '}
        <span style={{ fontSize: 8, padding: '1px 5px', borderRadius: 4, color: tag.color, background: tag.bg, fontWeight: 700 }}>{tag.label}</span>
      </div>
      <div style={{ fontSize: 9, color: DIM, lineHeight: 1.3, marginTop: 1 }}>{item.rationale}</div>
    </div>
    <button onClick={onAdd} style={{ ...btn, background: 'rgba(0,230,138,0.12)', color: ACCENT, border: '1px solid rgba(0,230,138,0.25)' }}>➕</button>
  </div>
  );
};

export default PlDeadpointsBarPathCard;
