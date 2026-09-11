/**
 * quality-hub-helpers.ts — P6/P7 Quality Hub PRO: чистые хелперы хаба качества.
 * Без React-зависимостей в логике (компоненты — в QualityActions.tsx).
 * - resolveWorkMax: единый фолбэк рабочих максимумов (профиль → 60), без хардкодов 140/100/160.
 * - buildSyntheticPlWeeks: единый синтез customWeeks из СРЦ-шаблона (был продублирован 4× в CalcQualityTab).
 * - deriveV2InputFromProgram: V2-вход из факта UserProgram (сессии/RIR/имена/делод).
 * - История снапшотов he_quality_history_v1 (кап 10) + сравнение A/B.
 * - Экспорт CSV/HTML с XSS-экранированием.
 * - Мост-отправки через planner-bridge (volume/deload/weakpoints).
 */
import { getVolumeLandmarks } from '../../../engines/volume-landmarks.engine';
import { deriveLengthShare, deriveShoulderFromNames } from '../../../engines/plan-quality.engine';
import type { V2ComposerInput } from '../../../engines/quality-score-v2.engine';
import { applyToPlanner } from './planner-bridge';

// ─── Рабочие максимумы ───

const WORKMAX_FALLBACK = 60;

const MUSCLE_TO_WM_KEY: Record<string, string> = {
  chest: 'chest', back: 'back', quads: 'quads', hamstrings: 'hamstrings', glutes: 'glutes',
  shoulders: 'shoulders', biceps: 'biceps', triceps: 'triceps', calves: 'calves', abs: 'abs',
  legs: 'quads', arms: 'biceps', core: 'abs',
  delt_front: 'shoulders', delt_mid: 'shoulders', delt_rear: 'shoulders', delt: 'shoulders',
  traps: 'traps', forearms: 'forearms',
};

/**
 * Legacy-дефолты тоннажных графиков (display-only, из CalcQualityTab до распила).
 * Профиль приоритетнее; эти числа — только когда профиля нет (графики не меняются).
 */
export const LEGACY_WM_DEFAULTS: Record<string, number> = {
  chest: 100, back: 110, quads: 140, hamstrings: 90, glutes: 160, shoulders: 60,
  biceps: 50, triceps: 60, calves: 120, abs: 60, legs: 120, arms: 50,
};

/** Единый резолв рабочего максимума: профиль → фолбэк 60. Не возвращает NaN/0. */
export function resolveWorkMax(
  profileWorkMax: Record<string, number> | null | undefined,
  muscle: string,
  fallback = WORKMAX_FALLBACK,
): number {
  const key = MUSCLE_TO_WM_KEY[(muscle || '').toLowerCase()] || 'chest';
  const v = Number(profileWorkMax?.[key]);
  if (Number.isFinite(v) && v > 0) return v;
  return fallback;
}

// ─── Синтез ПЛ-недель из СРЦ-шаблона (канон из CalcQualityTab, 1-в-1) ───

interface TplSet { pct?: number; reps?: number; sets?: number; rir?: number }
interface TplExercise { name: string; group?: string; sets: TplSet[] }
interface TplDay { exercises: TplExercise[] }
interface TplTemplate { weeks?: TplDay[][]; week1?: TplDay[] }

export function buildSyntheticPlWeeks(tpl: TplTemplate | null | undefined): Array<{
  week: number; phase: 'accumulation'; deload: boolean;
  days: Array<{ name: string; exercises: Array<{ name: string; lift: 'accessory'; muscle: string; sets: TplSet[] }> }>;
}> {
  if (!tpl) return [];
  const rawWeeks: TplDay[][] = (tpl.weeks && tpl.weeks.length ? tpl.weeks : tpl.week1 ? [tpl.week1] : []);
  return rawWeeks.map((days, wi) => ({
    week: wi + 1,
    phase: 'accumulation' as const,
    deload: false,
    days: days.map((d, di) => ({
      name: `День ${di + 1}`,
      exercises: (d.exercises || []).map(ex => ({
        name: ex.name,
        lift: 'accessory' as const,
        muscle: (ex as any).group || 'chest',
        sets: (ex.sets || []).map(s => ({ pct: s.pct, reps: s.reps, sets: s.sets, rir: s.rir ?? 2 })),
      })),
    })),
  }));
}

// ─── V2-вход из UserProgram ───

interface BBBlockLike { muscle?: string; exerciseName?: string; sets?: Array<{ reps?: number; rir?: number }> }
interface BBWeekLike {
  week?: number; phase?: string; deload?: boolean;
  sessions?: Array<{ blocks?: BBBlockLike[] }>;
}
interface PLSetLike { pct?: number; reps?: number; sets?: number; rir?: number }
interface PLExLike { name?: string; muscle?: string; lift?: string; sets?: PLSetLike[] }
interface ProgramLike {
  meta?: { id?: string; title?: string; direction?: string; level?: string };
  bb?: { weeks?: BBWeekLike[] };
  hybrid?: { bbWeeks?: BBWeekLike[] };
  pl?: { customWeeks?: Array<{ week?: number; phase?: string; deload?: boolean; days?: Array<{ exercises?: PLExLike[] }> }> };
}

/** V2-вход из факта программы. null — нет данных для оценки. */
export function deriveV2InputFromProgram(
  program: ProgramLike | null | undefined,
  division: 'bb' | 'pl',
  level: string,
): V2ComposerInput | null {
  if (!program) return null;
  const weeklySets: Record<string, number> = {};
  const freqCount: Record<string, number> = {};
  const sessionMax: Record<string, number> = {};
  const namesByMuscle: Record<string, string[]> = {};
  const exerciseNames: string[][] = [];
  let weeksTotal = 0;
  let rirSum = 0; let rirN = 0; let rirLE2 = 0; let rir0 = 0;
  let deloadWeeks = 0;
  const deloadWeekNums: number[] = [];
  let deloadSetsSum = 0; let baseSetsSum = 0; let baseWeeksN = 0;
  let deloadRirSum = 0; let deloadRirN = 0; let baseRirSum = 0; let baseRirN = 0;
  const pushName = (mu: string, nm: string) => {
    if (!nm) return;
    const arr = namesByMuscle[mu] || (namesByMuscle[mu] = []);
    if (!arr.includes(nm)) arr.push(nm);
  };
  const pushRir = (rir: unknown, sets: number) => {
    const r = Number(rir);
    if (!Number.isFinite(r)) return;
    rirSum += r * sets; rirN += sets;
    if (r <= 2) rirLE2 += sets;
    if (r <= 0) rir0 += sets;
  };

  if (division === 'bb') {
    const weeks: BBWeekLike[] = (program.bb?.weeks as BBWeekLike[]) || (program.hybrid?.bbWeeks as BBWeekLike[]) || [];
    if (!weeks.length) return null;
    weeksTotal = weeks.length;
    for (const w of weeks) {
      const isDeloadW = !!(w as any).deload || (w as any).phase === 'deload';
      if (isDeloadW) { deloadWeeks += 1; deloadWeekNums.push((w as any).week || 0); }
      else baseWeeksN += 1;
      let weekSets = 0;
      for (const s of w.sessions || []) {
        const per: Record<string, number> = {};
        const names: string[] = [];
        for (const b of s.blocks || []) {
          const mu = (b.muscle || '').toLowerCase();
          if (!mu) continue;
          const n = b.sets?.length || 0;
          per[mu] = (per[mu] || 0) + n;
          weeklySets[mu] = (weeklySets[mu] || 0) + n;
          pushName(mu, b.exerciseName || '');
          names.push(b.exerciseName || '');
          for (const st of b.sets || []) {
            pushRir(st?.rir ?? 2, 1);
            const r = Number(st?.rir ?? 2);
            if (Number.isFinite(r)) {
              if (isDeloadW) { deloadRirSum += r; deloadRirN += 1; }
              else { baseRirSum += r; baseRirN += 1; }
            }
          }
          weekSets += n;
        }
        exerciseNames.push(names);
        for (const [mu] of Object.entries(per)) freqCount[mu] = (freqCount[mu] || 0) + 1;
        for (const [mu, n] of Object.entries(per)) sessionMax[mu] = Math.max(sessionMax[mu] || 0, n);
      }
      if (isDeloadW) deloadSetsSum += weekSets;
      else baseSetsSum += weekSets;
    }
  } else {
    const weeks = program.pl?.customWeeks || [];
    if (!weeks.length) return null;
    weeksTotal = weeks.length;
    for (const w of weeks) {
      const isDeloadW = !!(w as any).deload || (w as any).phase === 'deload';
      if (isDeloadW) { deloadWeeks += 1; deloadWeekNums.push((w as any).week || 0); }
      else baseWeeksN += 1;
      let weekSets = 0;
      for (const d of w.days || []) {
        const per: Record<string, number> = {};
        const names: string[] = [];
        for (const ex of d.exercises || []) {
          const mu = ((ex.muscle || ex.lift || 'chest') as string).toLowerCase();
          const n = ex.sets?.reduce((a, s) => a + (s.sets || 1), 0) || 0;
          per[mu] = (per[mu] || 0) + n;
          weeklySets[mu] = (weeklySets[mu] || 0) + n;
          pushName(mu, ex.name || '');
          names.push(ex.name || '');
          for (const s of ex.sets || []) {
            pushRir(s?.rir ?? 2, s.sets || 1);
            const r = Number(s?.rir ?? 2);
            if (Number.isFinite(r)) {
              if (isDeloadW) { deloadRirSum += r * (s.sets || 1); deloadRirN += (s.sets || 1); }
              else { baseRirSum += r * (s.sets || 1); baseRirN += (s.sets || 1); }
            }
          }
          weekSets += n;
        }
        exerciseNames.push(names);
        for (const [mu] of Object.entries(per)) freqCount[mu] = (freqCount[mu] || 0) + 1;
        for (const [mu, n] of Object.entries(per)) sessionMax[mu] = Math.max(sessionMax[mu] || 0, n);
      }
      if (isDeloadW) deloadSetsSum += weekSets;
      else baseSetsSum += weekSets;
    }
  }

  if (!Object.keys(weeklySets).length) return null;
  // Средние сеты/нед (мезоцикл может быть длиннее недели)
  for (const k of Object.keys(weeklySets)) weeklySets[k] = Math.round(weeklySets[k] / Math.max(1, weeksTotal));
  const frequency: Record<string, number> = {};
  for (const [mu, cnt] of Object.entries(freqCount)) {
    frequency[mu] = Math.round((cnt / Math.max(1, weeksTotal)) * 10) / 10;
  }
  const mev: Record<string, number> = {};
  const mav: Record<string, number> = {};
  const mrv: Record<string, number> = {};
  for (const mu of Object.keys(weeklySets)) {
    const lm = getVolumeLandmarks(level, mu);
    if (!lm) continue;
    mev[mu] = lm.mev; mav[mu] = lm.mav; mrv[mu] = lm.mrv;
  }
  const baseAvg = baseWeeksN > 0 ? baseSetsSum / baseWeeksN : 0;
  const deloadAvg = deloadWeeks > 0 ? deloadSetsSum / deloadWeeks : 0;
  return {
    level, weeklySets, frequency, mev, mav, mrv,
    sessionMaxByMuscle: sessionMax,
    namesByMuscle,
    rir: rirN >= 5 ? {
      avgRir: Math.round((rirSum / rirN) * 10) / 10,
      fracRirLE2: Math.round((rirLE2 / rirN) * 100) / 100,
      fracRir0: Math.round((rir0 / rirN) * 100) / 100,
      totalSets: rirN,
    } : null,
    deload: deloadWeeks > 0 ? {
      hasDeload: true,
      totalWeeks: weeksTotal,
      deloadWeeks: deloadWeekNums.filter(Boolean),
      depthVolume: baseAvg > 0 ? Math.max(0, Math.min(1, Math.round((1 - deloadAvg / baseAvg) * 100) / 100)) : null,
      rirShift: deloadRirN > 0 && baseRirN > 0
        ? Math.round(((deloadRirSum / deloadRirN) - (baseRirSum / baseRirN)) * 10) / 10
        : null,
      loadDrop: null,
      phaseTag: 'deload' as const,
    } : null,
    shoulder: deriveShoulderFromNames(namesByMuscle, weeklySets),
    lengthShare: deriveLengthShare(namesByMuscle, weeklySets),
    load: null,
    exerciseNames,
  };
}

// ─── История снапшотов ───

export const QUALITY_HISTORY_KEY = 'he_quality_history_v1';
export const QUALITY_HISTORY_CAP = 10;

export interface QualitySnapshot {
  id: string;
  ts: number;
  programId: string;
  title: string;
  division: 'bb' | 'pl';
  score: number;
  grade: string;
  v2Score: number | null;
  perMuscle: Array<{ muscle: string; peakSets: number; status: string }>;
}

function safeHistory(): QualitySnapshot[] {
  try {
    const raw = localStorage.getItem(QUALITY_HISTORY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter(s => s && typeof s.score === 'number' && typeof s.id === 'string');
  } catch { return []; }
}

export function loadQualityHistory(): QualitySnapshot[] {
  return safeHistory();
}

export function saveQualitySnapshot(snap: Omit<QualitySnapshot, 'id' | 'ts'>): QualitySnapshot[] {
  const full: QualitySnapshot = {
    ...snap,
    id: `q_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e6).toString(36)}`,
    ts: Date.now(),
  };
  const next = [full, ...safeHistory()].slice(0, QUALITY_HISTORY_CAP);
  try { localStorage.setItem(QUALITY_HISTORY_KEY, JSON.stringify(next)); } catch { /* quota — тихо */ }
  return next;
}

export function removeQualitySnapshot(id: string): QualitySnapshot[] {
  const next = safeHistory().filter(s => s.id !== id);
  try { localStorage.setItem(QUALITY_HISTORY_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  return next;
}

/** Дельта B относительно A (для сравнения программ/снапшотов). */
export function compareQualitySnapshots(
  a: Pick<QualitySnapshot, 'score' | 'perMuscle'>,
  b: Pick<QualitySnapshot, 'score' | 'perMuscle'>,
): { scoreDelta: number; muscleDelta: Array<{ muscle: string; a: number; b: number; delta: number }> } {
  const am = new Map(a.perMuscle.map(m => [m.muscle, m.peakSets]));
  const bm = new Map(b.perMuscle.map(m => [m.muscle, m.peakSets]));
  const keys = Array.from(new Set([...am.keys(), ...bm.keys()])).sort();
  return {
    scoreDelta: b.score - a.score,
    muscleDelta: keys.map(k => {
      const av = am.get(k) || 0;
      const bv = bm.get(k) || 0;
      return { muscle: k, a: av, b: bv, delta: bv - av };
    }),
  };
}

// ─── Экспорт ───

export function escapeQualityHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function csvCell(v: string | number): string {
  const s = String(v);
  // Защита от формульных инъекций Excel (префикс ')
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
}

export interface QualityExportInput {
  title: string;
  division: 'bb' | 'pl';
  level: string;
  pedLabel: string;
  score: number;
  grade: string;
  v2Score: number | null;
  v2Grade: string | null;
  perMuscle: Array<{ muscle: string; peakSets: number; avgSets: number; mev: number; mav: number; mrv: number; status: string }>;
  v2Issues: Array<{ id: string; severity: string; message: string }>;
}

export function buildQualityExportCsv(q: QualityExportInput): string {
  const rows: (string | number)[][] = [
    ['Программа', q.title, q.division, q.level, q.pedLabel],
    ['Оценка (база)', q.score, q.grade],
    ['Оценка V2', q.v2Score ?? '—', q.v2Grade ?? ''],
    [],
    ['Мышца', 'Пик', 'Ср/нед', 'MEV', 'MAV', 'MRV', 'Статус'],
    ...q.perMuscle.map(p => [p.muscle, p.peakSets, p.avgSets, p.mev, p.mav, p.mrv, p.status]),
    [],
    ['V2-замечания'],
    ...q.v2Issues.map(i => [i.severity, i.message]),
  ];
  return rows.map(r => r.map(csvCell).join(',')).join('\n');
}

export function buildQualityExportHtml(q: QualityExportInput): string {
  const rows = q.perMuscle.map(p =>
    `<tr><td>${escapeQualityHtml(p.muscle)}</td><td>${p.peakSets}</td><td>${p.avgSets}</td>` +
    `<td>${p.mev}/${p.mav}/${p.mrv}</td><td>${escapeQualityHtml(p.status)}</td></tr>`,
  ).join('');
  const issues = q.v2Issues.map(i =>
    `<li><b>${escapeQualityHtml(i.severity)}</b> — ${escapeQualityHtml(i.message)}</li>`,
  ).join('') || '<li>Замечаний нет</li>';
  return `<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8">` +
    `<title>${escapeQualityHtml(q.title)} — качество</title></head><body>` +
    `<h1>${escapeQualityHtml(q.title)} — качество (${escapeQualityHtml(q.division.toUpperCase())})</h1>` +
    `<p>Уровень ${escapeQualityHtml(q.level)} · ${escapeQualityHtml(q.pedLabel)} · ` +
    `База ${q.score}/100 ${escapeQualityHtml(q.grade)} · ` +
    `V2 ${q.v2Score ?? '—'}/100 ${escapeQualityHtml(q.v2Grade ?? '')}</p>` +
    `<table border="1" cellpadding="4"><thead><tr><th>Мышца</th><th>Пик</th><th>Ср/нед</th>` +
    `<th>MEV/MAV/MRV</th><th>Статус</th></tr></thead><tbody>${rows}</tbody></table>` +
    `<h2>V2-замечания</h2><ul>${issues}</ul></body></html>`;
}

// ─── Мост-фиксы в конструкторы ───

/** Снизить объём перегруженных мышц до MAV (kind 'volume'). */
export function sendQualityVolumeFix(sets: Record<string, number>, label: string): boolean {
  try {
    applyToPlanner({ kind: 'volume', label, data: { sets, label } });
    return true;
  } catch { return false; }
}

/** Добавить делод-неделю (kind 'deload': объём ×0.6, RIR+2). */
export function sendQualityDeloadFix(label: string): boolean {
  try {
    applyToPlanner({ kind: 'deload', label, data: { volumeMult: 0.6, rirShift: 2, weeks: [], label } });
    return true;
  } catch { return false; }
}

/** Добить слабые/непокрытые группы (kind 'weakpoints'). */
export function sendQualityWeakpointsFix(groups: string[], label: string): boolean {
  try {
    applyToPlanner({ kind: 'weakpoints', label, data: { groups } as any });
    return true;
  } catch { return false; }
}

/**
 * Текст плана разбиения объёма на 2 сессии (для кнопки split-fix).
 * Честный clipboard-план: конструкторы не умеют «разбить» мостом,
 * поэтому отдаём готовый текст под копирование, а не фейковый мост.
 */
export function buildSplitFixText(
  candidates: Array<{ muscle: string; weeklySets: number; frequency: number }>,
): string {
  const lines = candidates.map(c => {
    const half = Math.round((c.weeklySets / 2) * 10) / 10;
    return `${c.muscle}: ${c.weeklySets} сетов в ${c.frequency}×/нед → разбить на 2× по ~${half} (напр. Пн/Чт)`;
  });
  return `Разбиение объёма на 2 сессии (session MAV ≤10):\n${lines.join('\n')}`;
}

// ─── Сводка S3 + S4 + V2 (связка скорингов без двойного учёта) ───

import { gradeQualityScore } from '../../../engines/quality-score-v2.engine';

export interface CombinedQuality {
  base: number;
  proDelta: number | null;
  proTotal: number | null;
  v2: number | null;
  /** Все доступные грейды в пределах одной соседней ступени. */
  agreement: boolean;
  text: string;
}

const GRADE_BAND: Record<string, number> = {
  '🟢 Профессионально': 0, '🟡 Хорошо': 1, '🟠 Удовлетворительно': 2, '🔴 Требует доработки': 3,
};

/**
 * Единый итог трёх контуров: база S3 + PRO-дельта S4 + V2 отдельно.
 * Счёт НЕ суммируется (паттерны S4 и объём V2 — разные оси); agreement показывает,
 * говорят ли контуры одно и то же (ступени грейда рядом).
 */
export function combinedQualitySummary(
  baseScore: number,
  proDelta: number | null | undefined,
  v2Score: number | null | undefined,
): CombinedQuality {
  const pd = proDelta ?? null;
  const v = v2Score ?? null;
  const proTotal = pd == null ? null : Math.max(0, Math.min(100, baseScore + pd));
  const bands = [gradeQualityScore(baseScore)];
  if (proTotal != null) bands.push(gradeQualityScore(proTotal));
  if (v != null) bands.push(gradeQualityScore(v));
  const idx = bands.map(b => GRADE_BAND[b] ?? 3);
  const agreement = Math.max(...idx) - Math.min(...idx) <= 1;
  const text = `База ${baseScore}` +
    (proTotal != null ? ` + PRO ${pd! >= 0 ? `+${pd}` : `${pd}`} = ${proTotal}` : ' · PRO нет') +
    (v != null ? ` · V2 ${v}` : ' · V2 нет') +
    (agreement ? ' · контуры согласны ✓' : ' · контуры расходятся ⚠');
  return { base: baseScore, proDelta: pd, proTotal, v2: v, agreement, text };
}

// ─── Программа под разделение (канон синтеза из CalcQualityTab, 1-в-1) ───

interface ProgramForDivision {
  meta: { direction?: string };
  pl?: { sourceCycleId?: string | null; customWeeks?: unknown };
  hybrid?: { bbWeeks?: unknown };
  bb?: unknown;
}

/**
 * Программа для расчёта под разделение: ПЛ-синтетика из СРЦ-шаблона + hybrid-fallback.
 * Чистая; раньше жила двумя копиями внутри CalcQualityTab (analysis/analysisNatural).
 */
export function programForDivision<T extends ProgramForDivision>(
  selectedProgram: T | null | undefined,
  division: 'bb' | 'pl',
  getCycleById: (id: string) => unknown,
): T | null {
  if (!selectedProgram) return null;
  let progForCalc = selectedProgram;
  const isHybridProg = selectedProgram.meta.direction === 'hybrid';
  if ((division === 'pl' || isHybridProg) && selectedProgram.pl?.sourceCycleId && !selectedProgram.pl.customWeeks) {
    const tpl = getCycleById(selectedProgram.pl.sourceCycleId) as TplTemplate | null | undefined;
    if (tpl) {
      const synthWeeks = buildSyntheticPlWeeks(tpl);
      progForCalc = { ...selectedProgram, pl: { ...selectedProgram.pl, customWeeks: synthWeeks as any } };
    }
  }
  if (division === 'bb' && isHybridProg && !(progForCalc as any).bb && (progForCalc as any).hybrid?.bbWeeks) {
    progForCalc = {
      ...progForCalc,
      bb: {
        direction: 'bb', weeks: (progForCalc as any).hybrid.bbWeeks, volumeBudget: {},
        progression: { loadStrategy: 'double_progression', deloadProtocol: 'pump', intensityTechniques: [] },
        constraints: { equipment: [] }, microcycleTemplate: { daySlots: [] },
      } as any,
    };
  }
  return progForCalc;
}
