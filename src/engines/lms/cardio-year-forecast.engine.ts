/**
 * cardio-year-forecast.engine.ts — CTL-прогноз года по ленте циклов (P2-4).
 * Склеивает недели циклов в псевдо-цикл (тот же приём, что «Год кардио»
 * в CardioManageStep) и прогоняет cardioCtlSeries: итог CTL/ATL/TSB +
 * вердикт готовности. Чистая функция поверх движка — без дубля математики.
 */
import { cardioCtlSeries, type CardioCycle } from './cardio.engine';

export interface CardioYearForecast {
  weeks: number;
  ctl: number;
  atl: number;
  tsb: number;
  verdict: string;
}

/** Прогноз по упорядоченной ленте циклов (null — пустая лента). */
export function forecastYearCtl(cycles: CardioCycle[]): CardioYearForecast | null {
  const list = cycles.filter(c => Array.isArray(c.weeks) && c.weeks.length > 0);
  if (list.length === 0) return null;
  const pseudo = {
    weeks: list.flatMap(c => c.weeks),
    totalWeeks: list.reduce((s, c) => s + c.totalWeeks, 0),
  } as unknown as CardioCycle;
  let series: Array<{ ctl: number; atl: number; tsb: number }>;
  try {
    series = cardioCtlSeries(pseudo) as unknown as Array<{ ctl: number; atl: number; tsb: number }>;
  } catch { return null; }
  const last = series[series.length - 1];
  if (!last) return null;
  const tsb = last.tsb;
  const verdict = tsb > 5 && tsb < 15
    ? 'Форма в зоне свежести — можно стартовать.'
    : tsb <= -10
      ? 'Накопленная усталость — нужен делод/переход перед стартом.'
      : 'Нейтральная форма: держите объём, пик — за 2-3 нед taper.';
  return { weeks: pseudo.totalWeeks, ctl: last.ctl, atl: last.atl, tsb, verdict };
}
