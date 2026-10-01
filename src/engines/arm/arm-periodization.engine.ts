/**
 * arm-periodization.engine.ts — профессиональный контур периодизации арм-плана.
 *
 * Закрывает структурные пробелы планировщика (аудит Oct 2026):
 * - мезо-блоки (blocks) внутри одного плана — фаза→блок с целями и неделями;
 * - стили прогрессии: auto (цикл/линейная), linear (%/нед), double (повторы
 *   внутри блока + шаг веса между блоками 2.5%), wave (тяжёлая/средняя/лёгкая
 *   волна внутри блока);
 * - мульти-старты (peaks A/B/C) внутри ОДНОГО плана: тейпер-окна и
 *   восстановительная неделя после старта (A: 3 нед окна, B: 2 нед, C: шарпенинг);
 * - база-якорь (LegsCore: присед/тяга/фермер) — реальная сессия в неделях
 *   базы, а не строка-обещание (legsAnchorBlock PRO-контура доезжает до плана).
 *
 * Чистый модуль: только типы + детерминированные вычисления.
 */

import type { ArmPeakInput, ArmProgressionStyle } from './arm-types';
import { getArmCycle } from './arm-cycle-library.engine';

/* ── Мезо-блоки ──────────────────────────────────────────────────────────── */

export interface ArmBlockInfo {
  id: string;
  name: string;
  objective: string;
  weekStart: number;
  weekEnd: number;
}

const PHASE_BLOCK_META: Record<string, { id: string; name: string; objective: string }> = {
  accumulation: { id: 'base', name: 'База', objective: 'объём, сухожилия, техника' },
  intensification: { id: 'build', name: 'Силовой блок', objective: 'интенсивность, дожим слабых точек' },
  deload: { id: 'deload', name: 'Разгрузка', objective: 'восстановление, суперкомпенсация' },
  peaking: { id: 'peak', name: 'Пик/стейт', objective: 'свежесть, специфика стола без отказа' },
};

/** Блоки по фазам: серии одинаковых фаз схлопываются в мезо-блоки. */
export function deriveArmBlocks(phaseMap: Record<number, string>, weeks: number): ArmBlockInfo[] {
  const out: ArmBlockInfo[] = [];
  let cur: string | null = null;
  for (let w = 1; w <= weeks; w++) {
    const ph = String(phaseMap[w] || 'accumulation');
    if (ph !== cur) {
      const meta = PHASE_BLOCK_META[ph] || { id: ph, name: ph, objective: '' };
      out.push({ id: meta.id, name: meta.name, objective: meta.objective, weekStart: w, weekEnd: w });
      cur = ph;
    } else if (out.length) {
      out[out.length - 1].weekEnd = w;
    }
  }
  return out;
}

/** Блок-подпись недели: «База (1–3)» + цель. */
export function blockForWeek(blocks: ArmBlockInfo[], week: number): ArmBlockInfo | null {
  for (const b of blocks) if (week >= b.weekStart && week <= b.weekEnd) return b;
  return null;
}

/** Блоки именного цикла: явные (библиотека) или выведенные из фаз. */
export function cycleBlocksFor(cycleId: string | undefined, phaseMap: Record<number, string>, weeks: number): ArmBlockInfo[] {
  try {
    const c = cycleId ? getArmCycle(cycleId) : undefined;
    if (c?.blocks?.length) {
      const valid = c.blocks
        .filter((b) => b.weekStart >= 1 && b.weekEnd >= b.weekStart)
        .map((b, i) => ({
          id: `${c.id}:${i}`,
          name: b.name,
          objective: b.objective,
          weekStart: Math.max(1, Math.min(weeks, b.weekStart)),
          weekEnd: Math.max(1, Math.min(weeks, b.weekEnd)),
        }))
        .filter((b) => b.weekEnd >= b.weekStart);
      if (valid.length) return valid;
    }
  } catch { /* fallback ниже */ }
  return deriveArmBlocks(phaseMap, weeks);
}

/* ── Стили прогрессии ────────────────────────────────────────────────────── */

export interface ArmProgressionWeek {
  weightMult: number; // множитель к базовому весу недели
  repsShift: number; // сдвиг повторов (double progression)
  note?: string;
}

/** Волновая раскладка внутри блока: тяжёлая → средняя → тяжёлая+ → лёгкая. */
const WAVE_PROFILE = [1.0, 0.92, 1.05, 0.96, 1.0, 0.94];
/** Шаг веса между блоками в double progression: +2.5% (одна ступень). */
export const DOUBLE_BLOCK_STEP = 0.025;
export const DOUBLE_MAX_REPS_SHIFT = 3;

/**
 * Прогрессия недели. Дефолт ('auto' без ставки) — ровно 1.0 (обратная
 * совместимость: старые планы без cycleId/ставок не меняются).
 */
export function progressionForWeek(input: {
  style: ArmProgressionStyle;
  phase: string;
  week: number;
  weekInPhase: number;
  phaseInstance: number;
  cyclePctPerWeek: number;
}): ArmProgressionWeek {
  const style = input.style || 'auto';
  const phase = String(input.phase || 'accumulation');
  const rate = Number.isFinite(input.cyclePctPerWeek) && input.cyclePctPerWeek > 0 ? input.cyclePctPerWeek : 0;
  const neutral: ArmProgressionWeek = { weightMult: 1, repsShift: 0 };
  if (phase === 'deload' || phase === 'peaking') {
    return neutral;
  }
  if (style === 'double') {
    const step = Math.max(0, Math.floor((input.phaseInstance || 1) - 1));
    const repsShift = Math.min(DOUBLE_MAX_REPS_SHIFT, Math.max(0, (input.weekInPhase || 1) - 1));
    return {
      weightMult: Math.round((1 + DOUBLE_BLOCK_STEP * step) * 10000) / 10000,
      repsShift,
      note: 'double: повторы +1/нед в блоке, вес +2.5% между блоками',
    };
  }
  const base = rate > 0 ? Math.pow(1 + rate / 100, Math.max(1, input.week) - 1) : 1;
  if (style === 'wave') {
    const idx = Math.max(0, Math.min(WAVE_PROFILE.length - 1, (input.weekInPhase || 1) - 1));
    const wave = WAVE_PROFILE[idx];
    const step = Math.max(0, (input.phaseInstance || 1) - 1) * 0.015; // +1.5%/блок поверх волны
    return {
      weightMult: Math.round(base * wave * (1 + step) * 10000) / 10000,
      repsShift: 0,
      note: 'wave: тяжёлая/средняя/лёгкая недели внутри блока',
    };
  }
  // auto/linear — линейный %/нед (как исторический cyclePctPerWeek)
  return { weightMult: Math.round(base * 10000) / 10000, repsShift: 0 };
}

/* ── Мульти-старты (peaks) в одном плане ─────────────────────────────────── */

export interface ArmPeakWindow {
  week: number;
  priority: 'A' | 'B' | 'C';
  name: string;
  leadWeeks: number[];
  recoveryWeek: number | null;
  skippedReason?: string;
}

export interface ArmPeaksRuntime {
  windows: ArmPeakWindow[];
  phaseOverrides: Record<number, string>;
  volumeOverrides: Record<number, number>;
  rirOverrides: Record<number, number>;
  taperWeeks: number[];
  recoveryWeeks: number[];
  markers: Record<number, { priority: 'A' | 'B' | 'C'; name: string }>;
  notes: string[];
}

const PEAK_PROFILE: Record<'A' | 'B' | 'C', { vol: number[]; rir: number[]; recovery: boolean }> = {
  A: { vol: [0.9, 0.65, 0.45], rir: [0, 1, 2], recovery: true }, // 3-нед окно
  B: { vol: [0.7, 0.45], rir: [1, 2], recovery: true }, // 2-нед окно
  C: { vol: [0.85], rir: [0], recovery: false }, // шарпенинг без восстановительной недели
};

/**
 * План стартов: тейпер-окна и восстановительные недели.
 * Пересечения окон не ломают план — старт переводится в C-режим с честной нотой.
 */
export function planArmPeaks(
  peaks: ArmPeakInput[] | undefined,
  weeks: number,
  phaseMap: Record<number, string>,
): ArmPeaksRuntime {
  const runtime: ArmPeaksRuntime = {
    windows: [], phaseOverrides: {}, volumeOverrides: {}, rirOverrides: {},
    taperWeeks: [], recoveryWeeks: [], markers: {}, notes: [],
  };
  if (!Array.isArray(peaks) || peaks.length === 0 || weeks <= 0) return runtime;
  const seen = new Set<number>();
  const sorted = peaks
    .map((p) => ({ week: Math.round(Number(p?.week) || 0), priority: (p?.priority || 'B') as 'A' | 'B' | 'C', name: String(p?.name || '') }))
    .filter((p) => p.week >= 1 && p.week <= weeks && !seen.has(p.week) && (seen.add(p.week), true))
    .sort((a, b) => a.week - b.week);

  let cursor = 0; // последняя занятая неделя (тейпер/старт/восстановление)
  for (const p of sorted) {
    const prof = PEAK_PROFILE[p.priority] || PEAK_PROFILE.B;
    const name = p.name || `Старт ${p.priority}`;
    const leadCount = prof.vol.length - 1;
    const windowStart = p.week - leadCount;
    let priority: 'A' | 'B' | 'C' = p.priority;
    let skipped: string | undefined;
    if (windowStart <= 0 || windowStart <= cursor) {
      // Пересечение с предыдущим стартом: старт остаётся, тейпер окно переводится в C.
      priority = 'C';
      skipped = `Старт Н${p.week} («${name}») без полного тейпера: окно пересекается с предыдущим — C-шарпенинг 85% за неделю.`;
    }
    const effProf = PEAK_PROFILE[priority];
    const leads: number[] = [];
    // Кривая хронологична: самый ранний хвост окна — 0.9, пик — 0.45.
    const span = effProf.vol.length;
    for (let i = 0; i < span; i++) {
      const wk = p.week - (span - 1) + i;
      if (wk < 1 || wk > weeks) continue;
      runtime.volumeOverrides[wk] = Math.min(runtime.volumeOverrides[wk] ?? 1, effProf.vol[i]);
      runtime.rirOverrides[wk] = Math.max(runtime.rirOverrides[wk] ?? 0, effProf.rir[i]);
      runtime.taperWeeks.push(wk);
      leads.push(wk);
    }
    // C-шарпенинг фазу не переводит (иначе peaking-обработка резала бы до 45%).
    if (priority !== 'C') runtime.phaseOverrides[p.week] = 'peaking';
    runtime.markers[p.week] = { priority, name };
    let recovery: number | null = null;
    if (effProf.recovery && p.week + 1 <= weeks) {
      recovery = p.week + 1;
      runtime.volumeOverrides[recovery] = Math.min(runtime.volumeOverrides[recovery] ?? 1, 0.6);
      runtime.phaseOverrides[recovery] = 'deload';
      runtime.recoveryWeeks.push(recovery);
    }
    cursor = recovery ?? p.week;
    runtime.windows.push({
      week: p.week, priority, name,
      leadWeeks: leads.sort((a, b) => a - b),
      recoveryWeek: recovery,
      ...(skipped ? { skippedReason: skipped } : {}),
    });
    if (skipped) runtime.notes.push(skipped);
    else {
      const curve = effProf.vol.map((v) => Math.round(v * 100)).join('→');
      runtime.notes.push(
        `🏁 Старт (${priority}) Н${p.week} «${name}»: тейпер ${curve}%${recovery ? `, восстановление Н${recovery} (60%)` : ', без восстановительной недели'}.`,
      );
    }
  }
  // Отметить фазу пика только если неделя не была разгрузкой естественного хвоста
  // (иначе перезапись phaseMap уже верна и повторная установка не нужна).
  for (const w of Object.keys(runtime.phaseOverrides)) {
    const wk = Number(w);
    if (runtime.phaseOverrides[wk] === 'peaking' && String(phaseMap[wk] || '') === 'deload') {
      // старт стоит на запланированной разгрузке — оставляем фазу разгрузки, объём и так снижен
    }
  }
  return runtime;
}

/* ── Разминочная рампа ───────────────────────────────────────────────────── */

/**
 * Разминочные подходы тяжёлого упражнения (BB-паттерн в арм-масштабе):
 * 40–50% ×10–12 → 70% ×5 → 85% ×3. Только для weighted-работы; загрузки строго
 * возрастают и не перешагивают рабочий вес. Малые веса получают 2 ступени.
 */
export function buildArmWarmupSets(topWeight: number, _opts?: { heavy?: boolean }): Array<{ load: number; reps: number }> {
  const w = Number(topWeight) || 0;
  if (w <= 0) return [];
  const out: Array<{ load: number; reps: number }> = [];
  const push = (pct: number, reps: number) => {
    const load = Math.max(2, Math.round(w * pct * 2) / 2);
    if (load >= w) return;
    if (out.length && load <= out[out.length - 1].load) return;
    out.push({ load, reps });
  };
  if (w >= 60) push(0.4, 12);
  push(0.5, 10);
  push(0.72, 5);
  if (w >= 50) push(0.85, 3);
  return out;
}

/* ── База-якорь (LegsCore) ───────────────────────────────────────────────── */

interface AnchorExerciseLike { id: string; name: string; sets: number; reps: string; }

const ANCHOR_MUSCLE: Record<string, string> = {
  back_squat_anchor: 'core_anchor',
  deadlift_anchor: 'back_pressure',
  farmer_carry_anchor: 'grip_support',
};
/** Группа замены якоря — паритет с проверкой чужеродного пула (foreignPoolWarnings). */
const ANCHOR_SG: Record<string, string> = {
  back_squat_anchor: 'core_anti',
  deadlift_anchor: 'back_drag',
  farmer_carry_anchor: 'grip_support',
};

function parseAnchorReps(reps: string): { reps: number; repsMax: number; holdSeconds?: number } {
  const s = String(reps || '');
  // Дистанция (фермер «30-40м») — холд по времени, не повторы. \b с кириллицей не работает.
  if (/м(?![а-яёa-z])|метр/i.test(s)) return { reps: 1, repsMax: 1, holdSeconds: 35 };
  const m = s.match(/(\d+)\s*[-–]\s*(\d+)/);
  const min = m ? Number(m[1]) : Number(s.match(/(\d+)/)?.[1] || 6) || 6;
  const max = m ? Number(m[2]) : min;
  return { reps: min, repsMax: Math.max(min, max) };
}

/**
 * Сессия базы-якоря: присед/тяга/фермер (из legsAnchorBlock PRO-контура) —
 * реальные упражнения с весом от workMax мышцы-носителя, а не строка.
 * Возвращает null для пустого блока.
 */
export function buildArmAnchorSession(
  anchor: AnchorExerciseLike[] | undefined,
  workMax: Record<string, number>,
): { sessionTag: string; character: string; exercises: Array<any>; note: string } | null {
  if (!Array.isArray(anchor) || anchor.length === 0) return null;
  const exercises = anchor.map((a) => {
    const muscle = ANCHOR_MUSCLE[a.id] || 'core_anchor';
    const max = Number(workMax[muscle] || workMax['default'] || 0);
    const w = max > 0 ? Math.round(max * 0.75 * 2) / 2 : 0;
    const parsed = parseAnchorReps(a.reps);
    const sets = Math.max(1, Math.min(6, Math.round(Number(a.sets) || 3)));
    const workSets = Array.from({ length: sets }, () => ({
      reps: parsed.reps,
      rir: 2,
      weight: w,
      restSeconds: a.id === 'farmer_carry_anchor' ? 120 : 150,
      ...(parsed.holdSeconds ? { holdSeconds: parsed.holdSeconds } : {}),
    }));
    return {
      muscle,
      name: a.name,
      role: 'primary' as const,
      character: 'тяж' as const,
      sets,
      repsRange: [parsed.reps, parsed.repsMax] as [number, number],
      rir: 2,
      workSets,
      isStatic: false,
      restSeconds: workSets[0]?.restSeconds,
      substitutionGroup: ANCHOR_SG[a.id] || 'core_anti',
      comment: `🏋️ База-якорь: ${a.reps}${w > 0 ? ` @ ${w} кг` : ' · вес по факту'}`,
      loadMode: 'external' as const,
      provenance: 'finalizer' as const,
      provenanceSource: 'arm-periodization:legs-anchor',
    };
  });
  return {
    sessionTag: 'LegsCore',
    character: 'тяж',
    exercises,
    note: '🏋️ База-якорь 1×/нед: присед/тяга/фермер — side-цепь, общий тонус и grip support.',
  };
}
