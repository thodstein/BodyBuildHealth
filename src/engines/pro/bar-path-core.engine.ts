/**
 * bar-path-core.engine.ts — P6: единый SRD-классификатор петли штанги.
 *
 * Канон: SRD 4/6 см (Frontiers 2023, из ТА-хаба).
 *   xLoop > 6 → crit, xLoop ≥ 4 → warn, иначе ok.
 * Тип: <2 прямая, <4 узкая петля, иначе широкая петля.
 * Чистые функции; BB/PL/SS тонко делегируют (тексты вердиктов — доменные).
 */

export type BarLoopFlag = 'ok' | 'warn' | 'crit';

export function barLoopFlag(xLoopCm: number): BarLoopFlag {
  const x = Number(xLoopCm);
  if (!Number.isFinite(x) || x < 0) return 'ok';
  if (x > 6) return 'crit';
  if (x >= 4) return 'warn';
  return 'ok';
}

export function barTrajectoryType(xLoopCm: number): string {
  const x = Number(xLoopCm);
  if (!Number.isFinite(x) || x < 0) return '—';
  if (x < 2) return 'прямая';
  if (x < 4) return 'узкая петля';
  return 'широкая петля';
}

export interface BarLoopVerdict {
  flag: BarLoopFlag;
  type: string;
  text: string;
}

/** Канонический вердикт (русский, одна строка; домены могут переопределять текст). */
export function barLoopVerdict(xLoopCm: number, yMaxCm?: number | null): BarLoopVerdict {
  const flag = barLoopFlag(xLoopCm);
  const type = barTrajectoryType(xLoopCm);
  const y = Number(yMaxCm);
  const yTail = Number.isFinite(y) && y > 0 ? ` · высота ${y} см` : '';
  if (flag === 'crit') return { flag, type, text: `Петля ${xLoopCm} см > 6 — разброс выше порога, чиним технику${yTail}` };
  if (flag === 'warn') return { flag, type, text: `Петля ${xLoopCm} см 4–6 — на грани порога, следим${yTail}` };
  return { flag, type, text: `Петля ${xLoopCm} см — в допуске (${type})${yTail}` };
}
