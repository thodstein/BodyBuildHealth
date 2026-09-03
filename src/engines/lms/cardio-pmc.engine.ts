/**
 * cardio-pmc.engine.ts — PRO-модель нагрузки: daily PMC (CTL/ATL/TSB) + TSS + HR-drift коррекция (Эпик B).
 * Чистые функции, без IO.
 *
 * Литература:
 * - Banister IRM (Calvert 1976): performance = fitness − fatigue; CTL τ=42д, ATL τ=7д (TrainingPeaks).
 * - Papini 2024 (Front Physiol): HR drift hysteresis AUC −77% коррекцией (delay + TRIMP + sigmoid + increase/decrease).
 *   Здесь — lite-версия: поправка HR на длительность >60', жару и дегидратацию перед Banister TRIMP.
 * - TrainingPeaks: hrTSS, powerTSS = dur × (NP/FTP)² × 100/3600, rTSS по VDOT.
 */

export interface DailyLoad {
  date: string; // YYYY-MM-DD
  load: number; // TSS/TRIMP дня
}

export interface PmcPoint {
  date: string;
  ctl: number;
  atl: number;
  tsb: number;
  load: number;
}

/** EWMA-серия PMC по дневным нагрузкам (τ CTL=42, ATL=7). Даты — календарно от первой до reference включительно. */
export function dailyPmcSeries(
  loads: DailyLoad[],
  opts: { referenceIso?: string; days?: number; tauCtl?: number; tauAtl?: number } = {},
): PmcPoint[] {
  if (!loads || loads.length === 0) return [];
  const tauCtl = opts.tauCtl ?? 42;
  const tauAtl = opts.tauAtl ?? 7;
  const alphaCtl = 2 / (tauCtl + 1);
  const alphaAtl = 2 / (tauAtl + 1);
  const map = new Map<string, number>();
  for (const l of loads) {
    if (!l.date || !(l.load >= 0)) continue;
    map.set(l.date, (map.get(l.date) ?? 0) + l.load);
  }
  const sorted = [...map.keys()].sort();
  if (sorted.length === 0) return [];
  const ref = opts.referenceIso ?? sorted[sorted.length - 1];
  const days = Math.max(7, Math.min(365, Math.round(opts.days ?? 90)));
  const parse = (s: string) => new Date(s.length === 10 ? s + 'T00:00:00' : s);
  const toIso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const addDays = (iso: string, n: number) => {
    const d = parse(iso);
    const nd = new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
    return toIso(nd);
  };
  const start = addDays(ref, -(days - 1));
  let ctl = 0;
  let atl = 0;
  const out: PmcPoint[] = [];
  let cur = start;
  let guard = 0;
  while (cur <= ref && guard < 400) {
    const load = map.get(cur) ?? 0;
    ctl = ctl + alphaCtl * (load - ctl);
    atl = atl + alphaAtl * (load - atl);
    const tsb = Math.round((ctl - atl) * 10) / 10;
    out.push({ date: cur, ctl: Math.round(ctl * 10) / 10, atl: Math.round(atl * 10) / 10, tsb, load });
    if (cur === ref) break;
    cur = addDays(cur, 1);
    guard++;
  }
  return out;
}

/** hrTSS по Banister: duration × HRR × k × e^(b×HRR) (k/b по полу). */
export function hrTss(durationMin: number, avgHr: number, restHr: number, maxHr: number, sex: 'male' | 'female' = 'male'): number {
  if (!(durationMin > 0) || !(avgHr > 0) || !(restHr > 0) || !(maxHr > restHr)) return 0;
  const hrr = Math.max(0, Math.min(1, (avgHr - restHr) / (maxHr - restHr)));
  const k = sex === 'female' ? 0.86 : 0.64;
  const b = sex === 'female' ? 1.67 : 1.92;
  return Math.round(durationMin * hrr * k * Math.exp(b * hrr) * 10) / 10;
}

/** powerTSS: dur(с) × (NP/FTP)² × IF²-нормализация (TrainingPeaks упрощённо: TSS = dur_h × IF² × 100). */
export function powerTss(durationMin: number, normPowerWatts: number, ftpWatts: number): number | null {
  if (!(durationMin > 0) || !(normPowerWatts > 0) || !(ftpWatts >= 30 && ftpWatts <= 800)) return null;
  const intF = normPowerWatts / ftpWatts;
  if (!(intF > 0) || intF > 2.5) return null;
  return Math.round(((durationMin * 60 * normPowerWatts * intF) / (ftpWatts * 3600)) * 100 * 10) / 10;
}

/** rTSS по VDOT: оценка по темпу (мин/км) против порогового темпа VDOT. Упрощённо через IF = thresholdPace/actualPace. */
export function runTss(durationMin: number, actualMinPerKm: number, thresholdMinPerKm: number): number | null {
  if (!(durationMin > 0) || !(actualMinPerKm > 0) || !(thresholdMinPerKm > 0)) return null;
  const intF = thresholdMinPerKm / actualMinPerKm;
  if (!(intF > 0) || intF > 1.6) return null;
  return Math.round(durationMin * intF * intF * 10) / 10;
}

export interface HrDriftContext {
  durationMin: number;
  tempC?: number;
  humidityPct?: number;
  /** Потеря массы за сессию, % (если известна из взвешиваний). */
  weightLossPct?: number;
}

/**
 * Lite-коррекция HR-drift (Papini 2024 идея): измеренный avgHr завышен дрейфом,
 * истинная метаболическая нагрузка ниже. Возвращает скорректированный HR.
 * - База: дрейф растёт после 60' (~0.5 уд/мин за каждые 10' сверх часа, кап 12).
 * - Жара >25°C: +1 уд/мин за каждый °C сверх 25 (кап 10).
 * - Дегидратация: weightLossPct × 4 уд/мин (кап 12).
 */
export function correctHrForDrift(measuredAvgHr: number, ctx: HrDriftContext): { correctedHr: number; driftBpm: number; note: string } {
  if (!(measuredAvgHr > 30 && measuredAvgHr < 250)) return { correctedHr: measuredAvgHr, driftBpm: 0, note: 'Некорректный HR — без коррекции.' };
  let drift = 0;
  if (ctx.durationMin > 60) drift += Math.min(12, ((ctx.durationMin - 60) / 10) * 0.5 * 2);
  if (ctx.tempC != null && ctx.tempC > 25) drift += Math.min(10, (ctx.tempC - 25) * 1);
  if (ctx.humidityPct != null && ctx.humidityPct > 70 && ctx.durationMin > 60) drift += 2;
  if (ctx.weightLossPct != null && ctx.weightLossPct > 0) drift += Math.min(12, ctx.weightLossPct * 4);
  drift = Math.round(drift * 10) / 10;
  const correctedHr = Math.max(40, Math.round((measuredAvgHr - drift) * 10) / 10);
  const note = drift <= 0
    ? 'Дрейф незначим (<60\', прохладно) — коррекция не нужна.'
    : `Дрейф ~${drift} уд/мин (длительность/жара/дегидратация) — TRIMP считать по скорректированному ${correctedHr}.`;
  return { correctedHr, driftBpm: drift, note };
}

/** TSS с учётом дрейфа: сначала correctHrForDrift, затем hrTss. */
export function driftCorrectedTss(
  durationMin: number,
  measuredAvgHr: number,
  restHr: number,
  maxHr: number,
  sex: 'male' | 'female',
  ctx: HrDriftContext,
): { tss: number; rawTss: number; driftBpm: number } {
  const rawTss = hrTss(durationMin, measuredAvgHr, restHr, maxHr, sex);
  const { correctedHr, driftBpm } = correctHrForDrift(measuredAvgHr, ctx);
  const tss = hrTss(durationMin, correctedHr, restHr, maxHr, sex);
  return { tss, rawTss, driftBpm };
}

/** Рампа TSS: % роста acute (7д) к chronic (28д). >15%/нед — риск (TrainingPeaks). */
export function tssRampRate(daily: DailyLoad[], referenceIso?: string): { acute: number; chronic: number; rampPct: number | null; warn: string | null } {
  if (!daily || daily.length === 0) return { acute: 0, chronic: 0, rampPct: null, warn: null };
  const ref = referenceIso ?? [...daily.map(d => d.date)].sort().pop()!;
  const ms = (s: string) => new Date(s.length === 10 ? s + 'T00:00:00' : s).getTime();
  const refMs = ms(ref);
  const sum = (from: number, to: number) => daily
    .filter(e => { const m = ms(e.date); return m >= refMs - from * 86400000 && (to > 0 ? m < refMs - to * 86400000 : m <= refMs); })
    .reduce((s, e) => s + e.load, 0);
  const acute = sum(7, 0);
  const chronic = (sum(28, 7) / 28) * 7;
  if (chronic <= 0) return { acute: Math.round(acute), chronic: 0, rampPct: null, warn: 'Мало базы (chronic=0) — рампу не считаем.' };
  const rampPct = Math.round(((acute - chronic) / chronic) * 1000) / 10;
  const warn = rampPct > 15 ? `Рампа +${rampPct}%/нед >15% — риск перегруза, снизьте объём.` : null;
  return { acute: Math.round(acute), chronic: Math.round(chronic), rampPct, warn };
}

/** Интерпретация TSB: >+15 пик формы (свежесть), <−10 перегруз. */
export function interpretTsb(tsb: number): string {
  if (tsb > 15) return 'TSB >+15 — пик свежести: старт/контрольный тест, объём не повышать.';
  if (tsb > 5) return 'TSB +5..+15 — хорошая свежесть, можно качественную работу.';
  if (tsb >= -10) return 'TSB −10..+5 — баланс нагрузка/восстановление.';
  return 'TSB <−10 — перегруз: лёгкие дни, сон, объём −20-30%.';
}
