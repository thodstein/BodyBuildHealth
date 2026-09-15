/**
 * armlift-completeness.engine.ts — полнота диагностики (PRO-5 D18).
 * Диагноз честен настолько, насколько заполнены входы: точка срыва (40%) +
 * релевантный тест под снаряд (40%) + данные мобильности (20%).
 * Боль/кожа — гейты, не полнота. Чистые функции.
 */
import { relevantTestsFor } from './armlift-failure-modes.engine';

export interface ArmliftCompletenessInput {
  implement?: string;
  failurePoint?: string;
  /** Значения тестов: pinch/farmer (с), coc (уровень), silver (с). */
  pinchHoldSec?: number | null;
  farmerHoldSec?: number | null;
  cocLevel?: number | null;
  silverSec?: number | null;
  /** Есть ли данные мобильности (градусы/тоглы/провалы). */
  hasMobilityData?: boolean;
}

export interface ArmliftCompletenessResult {
  pct: number;
  missing: string[];
}

/** Тест из relevantTestsFor покрыт значением? */
function testCovered(test: string, i: ArmliftCompletenessInput): boolean {
  const pos = (v: number | null | undefined): boolean => v != null && Number.isFinite(v) && v > 0;
  if (test === 'Pinch-hold') return pos(i.pinchHoldSec);
  if (test === 'Farmer-hold') return pos(i.farmerHoldSec);
  if (test === 'CoC') return i.cocLevel != null && Number.isFinite(i.cocLevel) && (i.cocLevel as number) >= 0;
  if (test === 'Silver') return pos(i.silverSec);
  return false;
}

export function diagnosticCompleteness(i: ArmliftCompletenessInput): ArmliftCompletenessResult {
  const missing: string[] = [];
  let pct = 0;
  if (i.failurePoint) pct += 40;
  else missing.push('точка срыва');
  const rel = relevantTestsFor(i.implement || '');
  if (rel.some((t) => testCovered(t, i))) pct += 40;
  else missing.push(`релевантный тест (${rel.join(' / ')})`);
  if (i.hasMobilityData) pct += 20;
  else missing.push('мобильность');
  return { pct, missing };
}
