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
export interface ACWRResult { acute: number; chronic: number; ratio: number; zone: ACWRZone; acuteDays: number; chronicDays: number; method: ACWRMethod; lowBase: boolean; }

/** Метод расчёта ACWR: coupled_ra — классика Gabbett (острая неделя входит в хроническую, дефолт для совместимости);
 *  ewma_uncoupled — Вильямс 2017: экспоненциально взвешенное среднее + хроническая без острой недели. */
export type ACWRMethod = 'coupled_ra' | 'ewma_uncoupled';
export interface ACWROptions { method?: ACWRMethod; chronicFloor?: number; }
/** Пол хронической среднедневной нагрузки (AU/день): ниже — база тонкая, ratio завышен (флаг lowBase). */
export const ACWR_CHRONIC_FLOOR_DEFAULT = 100;
/** Честный дисклеймер: ACWR — эвристика мониторинга, а не предсказание травмы. */
export const ACWR_DISCLAIMER = 'ACWR — эвристика мониторинга нагрузки, а не предсказание травмы (Impellizzeri 2020; мета-анализ BMC Sports Sci Med Rehab 2025, c≈0.57). Решение — по совокупности сигналов: сон/HRV/RPE/другая симптоматика.';
/** Канон зон/цветов/подписей — единый источник для хаба и дашборда (без дублей порогов в UI). */
export const ACWR_ZONE_META: Record<ACWRZone, { label: string; color: string }> = {
  undertrained: { label: 'Недотрен', color: '#3b82f6' },
  optimal: { label: 'Оптимум', color: '#22c55e' },
  caution: { label: 'Осторожно', color: '#eab308' },
  dangerous: { label: 'Опасно', color: '#ef4444' },
};
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

/** ACWR: острая (7д) / хроническая (28д) нагрузка.
 *  referenceDate — конец окна (по умолчанию последний день из dailyLoads).
 *  Без opts — байт-в-байт классика coupled RA (все 40+ потребителей не меняются).
 *  С opts.method='ewma_uncoupled' — честный метод Вильямса 2017: EWMA (α=2/(N+1)) + хроническая без острой недели. */
export function acuteChronicRatio(dailyLoads: DayLoad[], referenceDate?: string, acuteDays = 7, chronicDays = 28, opts: ACWROptions = {}): ACWRResult {
  if (dailyLoads.length === 0) return { acute: 0, chronic: 0, ratio: 0, zone: 'undertrained', acuteDays, chronicDays, method: opts.method ?? 'coupled_ra', lowBase: false };
  const method = opts.method ?? 'coupled_ra';
  if (method === 'ewma_uncoupled') return acwrEwmaUncoupled(dailyLoads, referenceDate, acuteDays, chronicDays, opts.chronicFloor ?? ACWR_CHRONIC_FLOOR_DEFAULT);
  const sorted = [...dailyLoads].sort((a, b) => a.date < b.date ? -1 : 1);
  const ref = referenceDate || sorted[sorted.length - 1].date;
  // средняя дневная нагрузка за окно
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
  return { acute, chronic, ratio: Math.round(ratio * 100) / 100, zone, acuteDays, chronicDays, method, lowBase: false };
}

/** Честный ACWR: EWMA acute (окно acuteDays) + EWMA chronic по дням ВНЕ острого окна (uncoupled).
 *  Тонкая база (chronic < chronicFloor) → lowBase:true, зона не выше caution (не пугаем детренов красным). */
function acwrEwmaUncoupled(dailyLoads: DayLoad[], referenceDate: string | undefined, acuteDays: number, chronicDays: number, chronicFloor: number): ACWRResult {
  const sorted = [...dailyLoads].sort((a, b) => a.date < b.date ? -1 : 1);
  const ref = referenceDate || sorted[sorted.length - 1].date;
  const byDate: Record<string, number> = {};
  for (const d of sorted) byDate[d.date] = (byDate[d.date] || 0) + d.load;
  // полный ряд с нулями за хроническое окно
  const series: number[] = [];
  for (let i = chronicDays - 1; i >= 0; i--) series.push(byDate[addDays(ref, -i)] || 0);
  const ewmaOf = (vals: number[], n: number) => ewma(vals, 2 / (n + 1));
  const acute = ewmaOf(series.slice(chronicDays - acuteDays), acuteDays);
  const chronicSeries = series.slice(0, chronicDays - acuteDays);
  const chronic = chronicSeries.length > 0 ? ewmaOf(chronicSeries, chronicDays - acuteDays) : 0;
  const lowBase = chronic < chronicFloor;
  const ratio = chronic > 0 ? acute / chronic : (acute > 0 ? 2 : 0);
  let zone: ACWRZone = ratio < 0.8 ? 'undertrained' : ratio <= 1.3 ? 'optimal' : ratio <= 1.5 ? 'caution' : 'dangerous';
  if (lowBase && zone === 'dangerous') zone = 'caution'; // тонкая база раздувает ratio — красную зону не ставим
  return { acute: Math.round(acute * 100) / 100, chronic: Math.round(chronic * 100) / 100, ratio: Math.round(ratio * 100) / 100, zone, acuteDays, chronicDays, method: 'ewma_uncoupled', lowBase };
}

/** Traffic Light по HRV + ACWR + RPE дрейфу */
export function trafficLight(hrvRatio: number | null, acwr: number, rpeDelta: number): 'green' | 'yellow' | 'red' {
  let score = 0;
  if (hrvRatio != null) { if (hrvRatio < 0.85) score += 2; else if (hrvRatio < 0.95) score += 1; }
  if (acwr > 1.5) score += 2; else if (acwr > 1.3) score += 1;
  if (rpeDelta >= 1) score += 1;
  if (rpeDelta >= 1.5) score += 1;
  if (score >= 3) return 'red';
  if (score >= 1) return 'yellow';
  return 'green';
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
  // P1-7: O(n) recurrence instead of O(n²) nested loop.
  // fitness[t] = fitness[t-1] * exp(-1/tau1) + load[t]
  // fatigue[t] = fatigue[t-1] * exp(-1/tau2) + load[t]
  const decay1 = Math.exp(-1 / tau1);
  const decay2 = Math.exp(-1 / tau2);
  let fitness = 0, fatigue = 0;
  for (let t = 0; t < full.length; t++) {
    fitness = fitness * decay1 + full[t].load;
    fatigue = fatigue * decay2 + full[t].load;
    series.push({ date: full[t].date, fitness: Math.round(fitness), fatigue: Math.round(fatigue), performance: Math.round(k1 * fitness - k2 * fatigue) });
  }
  let peakIdx = 0;
  for (let i = 1; i < series.length; i++) if (series[i].performance > series[peakIdx].performance) peakIdx = i;
  return { series, current: series[series.length - 1] || null, peakPerformanceIdx: peakIdx };
}

export interface MonotonyStreak { current: number; prev: number[]; sustainedHigh: boolean; }
/** Монотонность текущей + предыдущих недель (Фостер: monotony>2 + высокая нагрузка = риск перетрена).
 *  sustainedHigh — текущая И все prev выше 2 (честный «2 недели подряд», а не одна). */
export function monotonyStreak(dailyLoads: DayLoad[], weeks = 2): MonotonyStreak {
  if (dailyLoads.length === 0) return { current: 0, prev: [], sustainedHigh: false };
  const sorted = [...dailyLoads].sort((a, b) => a.date < b.date ? -1 : 1);
  const ref = sorted[sorted.length - 1].date;
  const current = weeklyMonotony(dailyLoads, ref).monotony;
  const prev: number[] = [];
  for (let w = 1; w < weeks; w++) prev.push(weeklyMonotony(dailyLoads, addDays(ref, -7 * w)).monotony);
  const sustainedHigh = current > 2 && prev.length === weeks - 1 && prev.every(m => m > 2);
  return { current: Math.round(current * 100) / 100, prev: prev.map(m => Math.round(m * 100) / 100), sustainedHigh };
}

export interface BanisterForm { z: number; trend: 'up' | 'flat' | 'down'; label: string; }
/** Форма по Banister как z-тренд performance за 7 дней (сырые AU несопоставимы с readiness 0–100).
 *  null при <7 точек. Тренд — наклон второй половины к первой в единицах SD. */
export function banisterForm(dailyLoads: DayLoad[]): BanisterForm | null {
  const { series } = fitnessFatigue(dailyLoads);
  if (series.length < 7) return null;
  const tail = series.slice(-7).map(p => p.performance);
  const mean = tail.reduce((s, v) => s + v, 0) / tail.length;
  const sd = Math.sqrt(tail.reduce((s, v) => s + (v - mean) ** 2, 0) / tail.length);
  const z = sd > 0 ? (tail[tail.length - 1] - mean) / sd : 0;
  const first = (tail[0] + tail[1] + tail[2]) / 3;
  const last = (tail[4] + tail[5] + tail[6]) / 3;
  const r = (v: number) => Math.round(v * 10) / 10;
  // Порог значимости: округление series до целых даёт лесенку +1/нед даже на асимптоте — ниже 5 AU шум, не тренд.
  if (Math.abs(last - first) < 5) return { z: r(z), trend: 'flat', label: `форма ${r(z)}σ · плато` };
  const slope = sd > 0 ? (last - first) / sd : 0;
  const trend = slope > 0.3 ? 'up' : slope < -0.3 ? 'down' : 'flat';
  const label = trend === 'up' ? `форма +${r(z)}σ · растёт — окно для тяжёлой сессии` : trend === 'down' ? `форма ${r(z)}σ · падает — придержите объём` : `форма ${r(z)}σ · плато`;
  return { z: r(z), trend, label };
}

export interface LoadReport {
  dailyLoads: DayLoad[];
  acwr: ACWRResult;
  monotony: MonotonyResult;
  banister: FitnessFatigueResult;
  recommendations: string[];
  disclaimer: string;
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
  return { dailyLoads, acwr, monotony, banister, recommendations, disclaimer: ACWR_DISCLAIMER };
}
