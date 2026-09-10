/**
 * bb-lr-volume.engine.ts — P1 PRO-2: объём лево/право по дневнику.
 * Чистый движок без UI: унилатеральные сеты — своей стороне, билатеральные — поровну.
 * Вердикт как в arm-bilateral: 7–12% → +15% слабой, ≥12% → +25% (кап MRV снаружи).
 */

export interface LrSideSets {
  left: number;
  right: number;
}

export interface LrGroupVerdict {
  group: string;
  left: number;
  right: number;
  total: number;
  asymPct: number | null;
  weakSide: 'left' | 'right' | null;
  verdict: 'norm' | 'watch' | 'topup';
  bonus: number; // 0 / 0.15 / 0.25
  topUpSets: number; // suggested extra sets for weak side (rounded)
  text: string;
}

const ARM_GROUPS = new Set(['biceps', 'triceps', 'forearms', 'arms', 'бицепс', 'трицепс']);
const LEG_GROUPS = new Set(['quads', 'hamstrings', 'glutes', 'calves', 'legs', 'квадрицепс']);

function normMuscle(m: string): string {
  const s = String(m || '').toLowerCase().trim();
  if (!s) return '';
  if (['biceps', 'бицепс'].includes(s)) return 'biceps';
  if (['triceps', 'трицепс'].includes(s)) return 'triceps';
  if (['forearms', 'forearm', 'предплечья', 'предплечье'].includes(s)) return 'forearms';
  if (['quads', 'quad', 'квадрицепс'].includes(s)) return 'quads';
  if (['hamstrings', 'hamstring', 'harm', 'бицепс бедра'].includes(s)) return 'hamstrings';
  if (['glutes', 'glute', 'ягодицы'].includes(s)) return 'glutes';
  if (['calves', 'calf', 'икры'].includes(s)) return 'calves';
  return '';
}

/** Сторона сета: явный маркер руки → она; иначе по имени; иначе билатераль. */
export function sideOfExercise(ex: any): 'left' | 'right' | 'both' {
  try {
    const rawSide = String(ex?.side ?? ex?.arm ?? ex?.hand ?? '').toLowerCase().trim();
    if (['l', 'left', 'лев', 'левая', 'лево'].some((k) => rawSide === k || rawSide.startsWith(k))) return 'left';
    if (['r', 'right', 'прав', 'правая', 'право'].some((k) => rawSide === k || rawSide.startsWith(k))) return 'right';
    if (ex?.unilateral === true) {
      // унилатераль без маркера — не приписываем никому (честно, без выдумок)
      return 'both';
    }
    const name = `${ex?.exerciseName || ''} ${ex?.name || ''}`.toLowerCase();
    const hasL = /(лев|left|\bl\b|л\/)/.test(name);
    const hasR = /(прав|right|\br\b|п\/)/.test(name);
    if (hasL && !hasR) return 'left';
    if (hasR && !hasL) return 'right';
  } catch { /* noop */ }
  return 'both';
}

export function countSets(ex: any): number {
  if (Array.isArray(ex?.sets)) return ex.sets.length;
  if (Number.isFinite(Number(ex?.sets))) return Math.max(0, Math.round(Number(ex.sets)));
  return 0;
}

/** Агрегация L/R сетов по группам рук/ног из сессий дневника. */
export function lrSetsFromSessions(sessions: any[]): Record<string, LrSideSets> {
  const out: Record<string, LrSideSets> = {};
  if (!Array.isArray(sessions)) return out;
  for (const s of sessions) {
    const list = (s?.exercises || []) as any[];
    if (!Array.isArray(list)) continue;
    for (const ex of list) {
      const g = normMuscle(String(ex?.muscleGroup ?? ex?.muscle ?? ''));
      if (!g || (!ARM_GROUPS.has(g) && !LEG_GROUPS.has(g))) continue;
      const n = countSets(ex);
      if (n <= 0) continue;
      if (!out[g]) out[g] = { left: 0, right: 0 };
      const side = sideOfExercise(ex);
      if (side === 'left') out[g].left += n;
      else if (side === 'right') out[g].right += n;
      else {
        out[g].left += n / 2;
        out[g].right += n / 2;
      }
    }
  }
  // округление до 0.5 (половинки от билатерали) — без плавающего мусора
  for (const k of Object.keys(out)) {
    out[k].left = Math.round(out[k].left * 2) / 2;
    out[k].right = Math.round(out[k].right * 2) / 2;
  }
  return out;
}

export function lrAsymPct(left: number, right: number): number | null {
  const mx = Math.max(Number(left) || 0, Number(right) || 0);
  if (!(mx > 0)) return null;
  return Math.round((Math.abs(Number(left) - Number(right)) / mx) * 1000) / 10;
}

const SIDE_RU: Record<string, string> = { left: 'левая', right: 'правая' };

/** Вердикт по группе: норма / наблюдение / добивка слабой (+15–25%). */
export function lrVerdictFor(group: string, left: number, right: number): LrGroupVerdict {
  const l = Number(left) || 0;
  const r = Number(right) || 0;
  const total = Math.round((l + r) * 2) / 2;
  const asymPct = lrAsymPct(l, r);
  if (asymPct == null) {
    return { group, left: l, right: r, total, asymPct, weakSide: null, verdict: 'norm', bonus: 0, topUpSets: 0, text: 'Нет односторонних данных — штанга поровну, перекоса не видно' };
  }
  const weakSide = l <= r ? 'left' : 'right';
  if (asymPct >= 12) {
    const base = Math.max(l, r);
    return {
      group, left: l, right: r, total, asymPct, weakSide, verdict: 'topup', bonus: 0.25,
      topUpSets: Math.max(1, Math.round(base * 0.25)),
      text: `Слабее: ${SIDE_RU[weakSide]} (${asymPct}%) → добивка +25% слабой в пределах максимума`,
    };
  }
  if (asymPct >= 7) {
    const base = Math.max(l, r);
    return {
      group, left: l, right: r, total, asymPct, weakSide, verdict: 'watch', bonus: 0.15,
      topUpSets: Math.max(1, Math.round(base * 0.15)),
      text: `Перекос ${asymPct}% → слабой (${SIDE_RU[weakSide]}) +15%, следим 4 недели`,
    };
  }
  return { group, left: l, right: r, total, asymPct, weakSide: null, verdict: 'norm', bonus: 0, topUpSets: 0, text: `Симметрия ${asymPct}% — норма, добивка не нужна` };
}

/** Вердикты по всем группам с данными (отсортированы по перекосу вниз). */
export function lrVerdictsFromSessions(sessions: any[]): LrGroupVerdict[] {
  const agg = lrSetsFromSessions(sessions);
  return Object.entries(agg)
    .map(([g, v]) => lrVerdictFor(g, v.left, v.right))
    .sort((a, b) => (b.asymPct ?? -1) - (a.asymPct ?? -1));
}
