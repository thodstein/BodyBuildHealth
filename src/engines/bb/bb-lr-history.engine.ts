/**
 * bb-lr-history.engine.ts — PRO-3 R6: история направления перекоса лево/право.
 *
 * Литература (Parkinson/Bishop 2021–24): направление перекоса плавает между
 * тестами и сезоном, точечный 10–15% порог слаб. Поэтому копим направление:
 * стабильная слабая сторона ≥3 замеров подряд → добивка; флип → наблюдение.
 * Сырые значения хранятся рядом (процент без базы врёт). Чистый движок.
 */

export interface BbLrSnapshot {
  date: string; // ISO
  group: string;
  weakSide: 'left' | 'right' | null;
  asymPct: number | null;
  verdict: string;
}

export interface BbLrDirection {
  group: string;
  samples: number;
  stableSide: 'left' | 'right' | null;
  persistent: boolean; // одна сторона ≥3 подряд
  flipped: boolean; // направление менялось в окне
  text: string;
}

export const MAX_LR_SNAPSHOTS = 24;

export function pushLrSnapshot(
  history: BbLrSnapshot[] | null | undefined,
  entry: BbLrSnapshot,
  cap = MAX_LR_SNAPSHOTS,
): BbLrSnapshot[] {
  const list = Array.isArray(history)
    ? history.filter((s) => s && typeof s.date === 'string' && typeof s.group === 'string')
    : [];
  if (!entry || typeof entry.group !== 'string') return list;
  const next = [...list, {
    date: String(entry.date || ''),
    group: String(entry.group),
    weakSide: entry.weakSide === 'left' || entry.weakSide === 'right' ? entry.weakSide : null,
    asymPct: Number.isFinite(entry.asymPct as number) ? (entry.asymPct as number) : null,
    verdict: String(entry.verdict || ''),
  }];
  return next.slice(-Math.max(1, Math.round(cap)));
}

export function summarizeLrDirection(history: BbLrSnapshot[] | null | undefined, group: string): BbLrDirection | null {
  const seq = (Array.isArray(history) ? history : [])
    .filter((s) => s && s.group === group && (s.weakSide === 'left' || s.weakSide === 'right'))
    .slice(-6);
  if (!seq.length) return null;
  const last = seq[seq.length - 1].weakSide as 'left' | 'right';
  let run = 0;
  for (let i = seq.length - 1; i >= 0; i--) {
    if (seq[i].weakSide === last) run++;
    else break;
  }
  const sides = new Set(seq.map((s) => s.weakSide));
  const persistent = run >= 3;
  const flipped = sides.size > 1;
  const ru: Record<string, string> = { left: 'левая', right: 'правая' };
  return {
    group,
    samples: seq.length,
    stableSide: persistent ? last : null,
    persistent,
    flipped,
    text: persistent
      ? `Перекос ${group}: слабее ${ru[last]} ${run} замера подряд — добивка оправдана`
      : flipped
        ? `Перекос ${group}: сторона плавает — наблюдаем, добивку не фиксируем`
        : `Перекос ${group}: данных мало (${seq.length}) — следим дальше`,
  };
}
