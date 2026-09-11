/**
 * bb-bar-path.engine.ts — P4 PRO-2: петля штанги из видеоразбора (SRD-порог).
 * P6: тонкий делегат над pro/bar-path-core (единый канон SRD 4/6) — формулы
 * живут в одном месте, имена BB сохранены для совместимости.
 */

import { barLoopFlag, barTrajectoryType, barLoopVerdict } from '../pro/bar-path-core.engine';

export type BbBarFlag = 'ok' | 'warn' | 'crit';

export interface BbBarVerdict {
  flag: BbBarFlag;
  type: string;
  text: string;
}

export function bbBarSrdFlag(xLoopCm: number): BbBarFlag {
  return barLoopFlag(xLoopCm);
}

export function bbTrajectoryType(xLoopCm: number): string {
  return barTrajectoryType(xLoopCm);
}

/** Итоговый вердикт для хаба (русский, одна строка). */
export function bbBarPathVerdict(xLoopCm: number, yMaxCm?: number | null): BbBarVerdict {
  return barLoopVerdict(xLoopCm, yMaxCm);
}
