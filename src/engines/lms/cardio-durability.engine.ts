/**
 * cardio-durability.engine.ts — Durability / Aerobic Decoupling трекер (Эпик E).
 * Чистые функции, без IO.
 *
 * Литература:
 * - TrainingPeaks: decoupling Pw:Hr / Pa:Hr = (1-half2/half1)×100%; <5% strong, 5-10% moderate, >10% weak.
 * - Polar: дрейф значим после 60-90' steady; первые 45-60' — HR эталон, дальше pace/RPE.
 * - Barsumyan 2025 (Front AI): responder = улучшение drift + decoupling между тестами (VGP 0.93).
 * - Rothschild 2025: HR/FR decoupling предсказывает падение VT1 (MAE 7.2W, R² 0.95).
 */

export type DecouplingLevel = 'strong' | 'moderate' | 'weak';

export interface DecouplingResult {
  decouplingPct: number;
  level: DecouplingLevel;
  advice: string;
}

/**
 * Aerobic decoupling по двум половинам steady-усилия.
 * efficiency = output/hr (мощность/пульс или темп-инверсия). decoupling = (eff1−eff2)/eff1×100.
 */
export function aerobicDecoupling(effFirstHalf: number, effSecondHalf: number): DecouplingResult | null {
  if (!(effFirstHalf > 0) || !(effSecondHalf > 0)) return null;
  const decouplingPct = Math.round((((effFirstHalf - effSecondHalf) / effFirstHalf) * 100) * 10) / 10;
  if (decouplingPct < 0) {
    // отрицательный = вторая половина эффективнее (прогрев) — считаем strong
    return { decouplingPct, level: 'strong', advice: 'Отрицательный decoupling — вторая половина эффективнее (прогрев). База отличная.' };
  }
  if (decouplingPct < 5) {
    return { decouplingPct, level: 'strong', advice: `Decoupling ${decouplingPct}% <5% — сильная аэробная выносливость на этой длительности.` };
  }
  if (decouplingPct <= 10) {
    return { decouplingPct, level: 'moderate', advice: `Decoupling ${decouplingPct}% 5-10% — умеренное ограничение базы/усталость/жара; держите объём, проверьте гидратацию.` };
  }
  return { decouplingPct, level: 'weak', advice: `Decoupling ${decouplingPct}% >10% — усилие выше аэробного порога или слабая база; снизьте интенсивность, продлите базу.` };
}

/** Эффективность по HR и выходу: power/HR (вело) или скорость/HR (бег). */
export function efficiencyPowerHr(powerWatts: number, hr: number): number | null {
  if (!(powerWatts > 0) || !(hr > 0)) return null;
  return powerWatts / hr;
}

export function efficiencyPaceHr(speedKmh: number, hr: number): number | null {
  if (!(speedKmh > 0) || !(hr > 0)) return null;
  return speedKmh / hr;
}

export interface DurabilityPoint {
  date: string;
  decouplingPct: number;
  durationMin: number;
}

/** Тренд durability: сравнение среднего первых и последних замеров. */
export function durabilityTrend(points: DurabilityPoint[]): { trend: 'improving' | 'stable' | 'worsening' | 'nodata'; delta: number | null; note: string } {
  const valid = (points ?? []).filter(p => Number.isFinite(p.decouplingPct) && p.durationMin >= 60);
  if (valid.length < 2) return { trend: 'nodata', delta: null, note: 'Нужно ≥2 замеров steady ≥60\' для тренда durability.' };
  const sorted = [...valid].sort((a, b) => (a.date < b.date ? -1 : 1));
  const first = sorted.slice(0, Math.max(1, Math.floor(sorted.length / 2)));
  const last = sorted.slice(Math.ceil(sorted.length / 2));
  const avg = (xs: DurabilityPoint[]) => xs.reduce((s, x) => s + x.decouplingPct, 0) / xs.length;
  const delta = Math.round((avg(last) - avg(first)) * 10) / 10;
  if (delta <= -2) return { trend: 'improving', delta, note: `Durability улучшается (decoupling ${delta} п.п.) — база растёт, можно продлевать AeT.` };
  if (delta >= 2) return { trend: 'worsening', delta, note: `Durability ухудшается (+${delta} п.п.) — усталость/жара/потеря формы; проверьте сон/объём.` };
  return { trend: 'stable', delta, note: `Durability стабильна (${delta} п.п.) — держите план.` };
}

/** Responder-классификация (Barsumyan lite): улучшение drift И decoupling = responder. */
export function responderClassification(
  prev: { driftPct: number; decouplingPct: number } | null,
  curr: { driftPct: number; decouplingPct: number } | null,
): { responder: boolean | null; note: string } {
  if (!prev || !curr) return { responder: null, note: 'Нужны два monthly-теста 60\' @75%FTP для классификации responder.' };
  const driftBetter = curr.driftPct < prev.driftPct;
  const decBetter = curr.decouplingPct < prev.decouplingPct;
  if (driftBetter && decBetter) return { responder: true, note: 'Responder: drift и decoupling улучшились — адаптация идёт, держите план.' };
  if (!driftBetter && !decBetter) return { responder: false, note: 'Non-responder: drift и decoupling не улучшились — проверьте восстановление/объём/железо.' };
  return { responder: false, note: 'Частичный отклик: один из метрик улучшился — повторите тест через 4 нед.' };
}

/** Цель по длительности AeT-удержания: вело 2-4ч, бег 1-2ч (TrainingPeaks практика). */
export function durabilityDurationTarget(sport: 'bike' | 'run', raceHours: number): { targetHours: number; note: string } {
  const r = Number(raceHours);
  if (!(r > 0)) return { targetHours: sport === 'bike' ? 2 : 1, note: 'Длительность гонки не задана — цель 2ч вело / 1ч бег.' };
  if (sport === 'bike') {
    if (r < 2) return { targetHours: 2, note: 'Вело <2ч: держите 2ч steady AeT с decoupling <5%.' };
    if (r <= 4) return { targetHours: Math.round(r * 10) / 10, note: `Вело ${r}ч: стройте AeT до длительности гонки.` };
    return { targetHours: 4, note: 'Вело >4ч (Ironman): кап 4ч AeT-оценки достаточно.' };
  }
  if (r < 1) return { targetHours: 1, note: 'Бег <1ч: держите 1ч steady AeT.' };
  if (r <= 2) return { targetHours: Math.round(r * 10) / 10, note: `Бег ${r}ч: стройте AeT до длительности гонки.` };
  return { targetHours: 2, note: 'Бег >2ч (марафон): кап 2ч AeT-оценки.' };
}
