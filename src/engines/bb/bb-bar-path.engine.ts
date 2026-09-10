/**
 * bb-bar-path.engine.ts — P4 PRO-2: петля штанги из видеоразбора (SRD-порог).
 * Чистый движок: xLoop (см) → бейдж по SRD 4/6 см (порог из ТА-хаба) + тип траектории.
 * Вход — готовый разбор (analyzeBarTracking уже посчитан хабом), без нового ввода.
 */

export type BbBarFlag = 'ok' | 'warn' | 'crit';

export interface BbBarVerdict {
  flag: BbBarFlag;
  type: string;
  text: string;
}

export function bbBarSrdFlag(xLoopCm: number): BbBarFlag {
  const x = Number(xLoopCm);
  if (!Number.isFinite(x) || x < 0) return 'ok';
  if (x > 6) return 'crit';
  if (x >= 4) return 'warn';
  return 'ok';
}

export function bbTrajectoryType(xLoopCm: number): string {
  const x = Number(xLoopCm);
  if (!Number.isFinite(x) || x < 0) return '—';
  if (x < 2) return 'прямая';
  if (x < 4) return 'узкая петля';
  return 'широкая петля';
}

/** Итоговый вердикт для хаба (русский, одна строка). */
export function bbBarPathVerdict(xLoopCm: number, yMaxCm?: number | null): BbBarVerdict {
  const flag = bbBarSrdFlag(xLoopCm);
  const type = bbTrajectoryType(xLoopCm);
  const y = Number(yMaxCm);
  const yTail = Number.isFinite(y) && y > 0 ? ` · высота ${y} см` : '';
  if (flag === 'crit') return { flag, type, text: `Петля ${xLoopCm} см > 6 — разброс выше порога, чиним технику${yTail}` };
  if (flag === 'warn') return { flag, type, text: `Петля ${xLoopCm} см 4–6 — на грани порога, следим${yTail}` };
  return { flag, type, text: `Петля ${xLoopCm} см — в допуске (${type})${yTail}` };
}
