/**
 * bb-corrective-block.engine.ts — ROUND-10: сессия и блок (волна) коррекции ББ-хаба.
 * Паритет с ТА (`correctiveSessionFor`/`correctiveBlockFor`) и стронгом (`correctiveSessionForSM`/
 * `correctiveBlockForSM`): из выбранных библиотечных коррекций собирается одна сессия
 * (порядок техника → сила → стабильность, ≤6) и 4–8-недельный блок с волной сетов
 * (канон 3-3-4-4-4-4-3-3), разгрузкой в хвосте и экспортом строк.
 *
 * Чистые функции, без UI/storage. Ранжир НЕ дублируется: на вход идут уже выбранные
 * библиотечные коррекции (тот же источник, что карточка/экспорт/вставка хаба).
 */
import { EXERCISE_CATALOG } from '../../core/exercise-catalog';
import type { BBCorrective, BBWeakCause, BBCorrPhase } from './bb-corrective.engine';
import { correctiveDose } from './bb-corrective.engine';

export type BBCorrBlockFocus = 'Втягивание' | 'Прогрессия' | 'Пик' | 'Разгрузка';

export interface BBCorrPickInput {
  corr: BBCorrective;
  why?: string[];
}

export interface BBCorrSessionItem {
  corrId: string;
  exerciseId: string;
  name: string;
  phase: BBCorrPhase;
  targets: string[];
  sets: number;
  repsMin: number;
  repsMax: number;
  rir: number;
  tempo: string;
  restSec: number;
  reason: string;
}

export interface BBCorrBlockWeek {
  week: number;
  focus: BBCorrBlockFocus;
  items: BBCorrSessionItem[];
  note: string;
}

export interface BBCorrBlock {
  weeks: BBCorrBlockWeek[];
  targets: string[];
  summary: string;
}

const PHASE_ORDER: Record<BBCorrPhase, number> = { technique: 0, strength: 1, stability: 2 };
const FOCUS_RU: Record<BBCorrBlockFocus, string> = {
  'Втягивание': 'Втягивание',
  'Прогрессия': 'Прогрессия',
  'Пик': 'Пик',
  'Разгрузка': 'Разгрузка (RIR+1)',
};

function exerciseName(id: string): string {
  try {
    const hit = (EXERCISE_CATALOG as Array<{ id?: string; name?: string }>).find(
      (e) => String(e?.id || '').toLowerCase() === String(id || '').toLowerCase(),
    );
    return hit?.name ? String(hit.name) : id;
  } catch {
    return id;
  }
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/** Волна сетов: 8 нед — канон 3-3-4-4-4-4-3-3; короче — та же логика (первые ~25% втягивание, хвост 2 нед разгрузка). */
export function correctiveWaveForWeeks(weeks: number): number[] {
  const w = Math.max(1, Math.round(weeks));
  const first = Math.max(1, Math.ceil(w * 0.25));
  const deloads = w >= 6 ? 2 : w >= 3 ? 1 : 0;
  const out: number[] = [];
  for (let i = 0; i < w; i++) {
    const isFirst = i < first;
    const isDeload = deloads > 0 && i >= w - deloads;
    out.push(isFirst ? 3 : isDeload ? 3 : 4);
  }
  return out;
}

export function correctiveFocusForWeek(i: number, weeks: number): BBCorrBlockFocus {
  const w = Math.max(1, Math.round(weeks));
  const deloads = w >= 6 ? 2 : w >= 3 ? 1 : 0;
  if (deloads > 0 && i >= w - deloads) return 'Разгрузка';
  if (deloads > 0 && i === w - deloads - 1) return 'Пик';
  const first = Math.max(1, Math.ceil(w * 0.25));
  return i < first ? 'Втягивание' : 'Прогрессия';
}

function toItem(p: BBCorrPickInput, opts: { sets?: number; rirShift?: number; cause?: BBWeakCause | null } = {}): BBCorrSessionItem {
  const corr = p.corr;
  let dose: { sets: number; repsMin: number; repsMax: number; rir: number; tempo: string; restSec: number } | null = null;
  try {
    const d = correctiveDose(corr, opts.cause ?? null, {});
    if (d) dose = { sets: d.sets, repsMin: d.repsMin, repsMax: d.repsMax, rir: d.rir, tempo: d.tempo, restSec: corr.protocol.restSec };
  } catch { /* фолбэк ниже */ }
  const base = dose ?? {
    sets: corr.protocol.sets,
    repsMin: corr.protocol.repsMin,
    repsMax: corr.protocol.repsMax,
    rir: corr.protocol.rir,
    tempo: corr.protocol.tempo,
    restSec: corr.protocol.restSec,
  };
  return {
    corrId: corr.id,
    exerciseId: corr.exerciseId,
    name: exerciseName(corr.exerciseId),
    phase: corr.phase,
    targets: corr.targets,
    sets: clamp(opts.sets ?? base.sets, 1, 6),
    repsMin: base.repsMin,
    repsMax: base.repsMax,
    rir: clamp(base.rir + (opts.rirShift ?? 0), 0, 4),
    tempo: base.tempo,
    restSec: base.restSec,
    reason: (p.why || []).join(' + ') || 'по зоне',
  };
}

/** Одна сессия коррекции: порядок техника → сила → стабильность, ≤6 упражнений, без дублей. */
export function correctiveSessionForBB(
  picks: BBCorrPickInput[],
  opts: { max?: number; cause?: BBWeakCause | null } = {},
): BBCorrSessionItem[] {
  const max = clamp(opts.max ?? 6, 1, 6);
  const seen = new Set<string>();
  const ordered = [...(picks || [])]
    .filter((p) => p && p.corr && !seen.has(p.corr.id) && (seen.add(p.corr.id), true))
    .sort((a, b) => PHASE_ORDER[a.corr.phase] - PHASE_ORDER[b.corr.phase]);
  return ordered.slice(0, max).map((p) => toItem(p, { cause: opts.cause ?? null }));
}

/** Блок коррекции 4–8 нед: волна сетов, разгрузка в хвосте (RIR+1), фокус недели. */
export function correctiveBlockForBB(
  picks: BBCorrPickInput[],
  weeks = 6,
  opts: { max?: number; cause?: BBWeakCause | null } = {},
): BBCorrBlock {
  const session = correctiveSessionForBB(picks, opts);
  const w = clamp(Math.round(weeks) || 6, 2, 12);
  const wave = correctiveWaveForWeeks(w);
  const out: BBCorrBlockWeek[] = [];
  for (let i = 0; i < w; i++) {
    const focus = correctiveFocusForWeek(i, w);
    const items = session.map((s) => ({
      ...s,
      sets: clamp(wave[i], 1, 6),
      rir: clamp(s.rir + (focus === 'Разгрузка' ? 1 : 0), 0, 4),
    }));
    out.push({
      week: i + 1,
      focus,
      items,
      note: `${FOCUS_RU[focus]} · ${wave[i]} сетов · ${items.length} упр.`,
    });
  }
  const targets = Array.from(new Set(session.flatMap((s) => s.targets)));
  const summary = session.length
    ? `${w} нед · ${session.length} упр. · волна ${wave.join('-')} · зоны: ${targets.join(', ')}`
    : `${w} нед · нет коррекций (пусто)`;
  return { weeks: out, targets, summary };
}

/** Строки для экспорта/печати (без UI). */
export function correctiveBlockExportLines(block: BBCorrBlock | null | undefined): string[] {
  if (!block || !block.weeks?.length) return [];
  // честно: блок без упражнений не выгружаем (не плодим строки с «—»)
  if (!block.weeks.some((w) => (w.items || []).length > 0)) return [];
  const lines: string[] = [`📅 Блок коррекции: ${block.summary}`];
  for (const wk of block.weeks) {
    const body = wk.items.length
      ? wk.items.map((i) => `${i.name} ${i.sets}×${i.repsMin}–${i.repsMax} RIR${i.rir}`).join('; ')
      : '—';
    lines.push(`Нед ${wk.week} (${wk.focus}): ${body}`);
  }
  return lines;
}
