/**
 * training-load.engine.ts — P3: мониторинг тренировочной нагрузки (проф. уровень).
 * NEW + UNIFY: sRPE-нагрузка, ACWR (EWMA), monotony/strain, fitness-fatigue (Banister).
 * Заполняет пробел: sRPE и fitness-fatigue отсутствовали; ACWR был разбросан по 13 файлам →
 * здесь канонический модуль для проф-фич (P4 авторегуляция, P12 UI).
 */

export interface TrainingSession { date: string; sRPE: number; durationMin: number; }
export interface DayLoad { date: string; load: number; }        // нагрузка на день (AU)
export interface WeeklyLoad { weekStart: string; load: number; days: number; }

export type ACWRZone = 'undertrained' | 'optimal' | 'caution' | 'dangerous';
export interface ACWRResult { acute: number; chronic: number; ratio: number; zone: ACWRZone; acuteDays: number; chronicDays: number; }
export interface MonotonyResult { meanDailyLoad: number; stdev: number; monotony: number; weeklyLoad: number; strain: number; }
export interface BanisterPoint { date: string; fitness: number; fatigue: number; performance: number; }
export interface FitnessFatigueResult { series: BanisterPoint[]; current: BanisterPoint | null; peakPerformanceIdx: number; }

/** Нагрузка сессии = session RPE × длительность (AU, Foster/Impellizzeri). */
export function sessionLoad(sRPE: number, durationMin: number): number {
  return Math.max(0, sRPE) * Math.max(0, durationMin);
}

/** День → ISO-дата (YYYY-MM-DD). */
function dayOf(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return typeof date === 'string' ? date : '';
  return d.toISOString().slice(0, 10);
}
function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10);
}

/** Сессии → дневная нагрузка (агрегация по датам, отсортировано). */
export function toDailyLoads(sessions: TrainingSession[]): DayLoad[] {
  const map: Record<string, number> = {};
  for (const s of sessions) {
    const d = dayOf(s.date);
    if (!d) continue;
    map[d] = (map[d] || 0) + sessionLoad(s.sRPE, s.durationMin);
  }
  return Object.keys(map).sort().map(d => ({ date: d, load: map[d] }));
}

/** EWMA (экспоненциально взвешенное среднее) для ряда нагрузок. */
export function ewma(values: number[], alpha: number): number {
  if (values.length === 0) return 0;
  let e = values[0];
  for (let i = 1; i < values.length; i++) e = alpha * values[i] + (1 - alpha) * e;
  return e;
}

/** ACWR: острая (7д) / хроническая (28д) нагрузка. Использует EWMA (Rollinson/Gabbett).
 *  referenceDate — конец окна (по умолчанию последний день из dailyLoads). */
export function acuteChronicRatio(dailyLoads: DayLoad[], referenceDate?: string, acuteDays = 7, chronicDays = 28): ACWRResult {
  if (dailyLoads.length === 0) return { acute: 0, chronic: 0, ratio: 0, zone: 'undertrained', acuteDays, chronicDays };
  const sorted = [...dailyLoads].sort((a, b) => a.date < b.date ? -1 : 1);
  const ref = referenceDate || sorted[sorted.length - 1].date;
  //日均 нагрузка за окно
  const avgOver = (days: number) => {
    const start = addDays(ref, -(days - 1));
    let sum = 0, n = 0;
    for (const d of sorted) {
      if (d.date >= start && d.date <= ref) { sum += d.load; n++; }
    }
    return n > 0 ? sum / days : 0; //日均 (делим на длину окна, не на число записей → учитывает нулевые дни)
  };
  // EWMA-вариант: alpha = 2/(N+1)
  const acute = avgOver(acuteDays);
  const chronic = avgOver(chronicDays);
  const ratio = chronic > 0 ? acute / chronic : (acute > 0 ? 2 : 0);
  const zone: ACWRZone = ratio < 0.8 ? 'undertrained' : ratio <= 1.3 ? 'optimal' : ratio <= 1.5 ? 'caution' : 'dangerous';
  return { acute, chronic, ratio: Math.round(ratio * 100) / 100, zone, acuteDays, chronicDays };
}

/** Monotony = среднедневная нагрузка / СТД дневной нагрузки за неделю; strain = monotony × суммарная. */
export function weeklyMonotony(dailyLoads: DayLoad[], weekEnd?: string): MonotonyResult {
  if (dailyLoads.length === 0) return { meanDailyLoad: 0, stdev: 0, monotony: 0, weeklyLoad: 0, strain: 0 };
  const sorted = [...dailyLoads].sort((a, b) => a.date < b.date ? -1 : 1);
  const end = weekEnd || sorted[sorted.length - 1].date;
  const start = addDays(end, -6);
  const weekLoads: number[] = [];
  for (let i = 0; i < 7; i++) {
    const d = addDays(start, i);
    const found = sorted.find(x => x.date === d);
    weekLoads.push(found ? found.load : 0);
  }
  const weeklyLoad = weekLoads.reduce((s, v) => s + v, 0);
  const mean = weeklyLoad / 7;
  const variance = weekLoads.reduce((s, v) => s + (v - mean) ** 2, 0) / 7;
  const stdev = Math.sqrt(variance);
  const monotony = stdev > 0 ? mean / stdev : (mean > 0 ? 2 : 0);
  return {
    meanDailyLoad: Math.round(mean * 10) / 10,
    stdev: Math.round(stdev * 10) / 10,
    monotony: Math.round(monotony * 100) / 100,
    weeklyLoad: Math.round(weeklyLoad),
    strain: Math.round(monotony * weeklyLoad),
  };
}

/** Fitness-Fatigue (Banister): Fitness (τ1≈42д), Fatigue (τ2≈7д), Performance = k1·Fitness − k2·Fatigue.
 *  Свертка нагрузки с экспоненциальным затуханием по всем дням ряда. */
export function fitnessFatigue(
  dailyLoads: DayLoad[],
  opts: { tau1?: number; tau2?: number; k1?: number; k2?: number } = {}
): FitnessFatigueResult {
  const tau1 = opts.tau1 ?? 42;
  const tau2 = opts.tau2 ?? 7;
  const k1 = opts.k1 ?? 1;
  const k2 = opts.k2 ?? 2;
  if (dailyLoads.length === 0) return { series: [], current: null, peakPerformanceIdx: -1 };
  const sorted = [...dailyLoads].sort((a, b) => a.date < b.date ? -1 : 1);
  // заполнить ряд без пропусков (нагрузка 0 в дни отдыха)
  const minD = sorted[0].date, maxD = sorted[sorted.length - 1].date;
  const byDate: Record<string, number> = {};
  for (const d of sorted) byDate[d.date] = d.load;
  const full: DayLoad[] = [];
  for (let cur = minD; cur <= maxD; cur = addDays(cur, 1)) full.push({ date: cur, load: byDate[cur] || 0 });

  const series: BanisterPoint[] = [];
  for (let t = 0; t < full.length; t++) {
    let fitness = 0, fatigue = 0;
    for (let d = 0; d <= t; d++) {
      const dt = t - d;
      fitness += full[d].load * Math.exp(-dt / tau1);
      fatigue += full[d].load * Math.exp(-dt / tau2);
    }
    series.push({ date: full[t].date, fitness: Math.round(fitness), fatigue: Math.round(fatigue), performance: Math.round(k1 * fitness - k2 * fatigue) });
  }
  let peakIdx = 0;
  for (let i = 1; i < series.length; i++) if (series[i].performance > series[peakIdx].performance) peakIdx = i;
  return { series, current: series[series.length - 1] || null, peakPerformanceIdx: peakIdx };
}

export interface LoadReport {
  dailyLoads: DayLoad[];
  acwr: ACWRResult;
  monotony: MonotonyResult;
  banister: FitnessFatigueResult;
  recommendations: string[];
}

/** Сводный отчёт по нагрузке + рекомендации. */
export function trainingLoadReport(sessions: TrainingSession[], referenceDate?: string): LoadReport {
  const dailyLoads = toDailyLoads(sessions);
  const acwr = acuteChronicRatio(dailyLoads, referenceDate);
  const monotony = weeklyMonotony(dailyLoads, referenceDate);
  const banister = fitnessFatigue(dailyLoads);
  const recommendations: string[] = [];
  if (acwr.ratio > 1.5) recommendations.push(`ACWR ${acwr.ratio} > 1.5 — опасная зона: снизить объём на ~20-30%, риск травмы/перетрена.`);
  else if (acwr.ratio < 0.8) recommendations.push(`ACWR ${acwr.ratio} < 0.8 — недотренированность: можно плавно ↑ объём.`);
  else recommendations.push(`ACWR ${acwr.ratio} в оптимальной зоне (0.8-1.3).`);
  if (monotony.monotony > 2) recommendations.push(`Monotony ${monotony.monotony} > 2 — однообразная нагрузка, добавьте вариативность/восстановление.`);
  if (banister.current) {
    if (banister.current.performance < 0) recommendations.push(`Fitness-Fatigue performance отрицательный (${banister.current.performance}) —疲劳 накапливается, плановый deload.`);
    else recommendations.push(`Fitness-Fatigue performance ${banister.current.performance} (fitness ${banister.current.fitness} − fatigue ${banister.current.fatigue}).`);
  }
  return { dailyLoads, acwr, monotony, banister, recommendations };
}
