/**
 * cardio-physiology.engine.ts — чистые физиологические хелперы, вынесены из god-file cardio.engine.ts (B1).
 * Содержит только чистые функции без IO: пульс-зоны, VDOT, TRIMP, CTL/ATL/TSB.
 * cardio.engine.ts реэкспортирует их для обратной совместимости.
 */
import type { CardioType, CardioCycle } from './cardio.engine';

export interface HeartZone {
  zone: number;
  label: string;
  rangeMin: number;
  rangeMax: number;
  bpmMin: number;
  bpmMax: number;
  purpose: string;
}

/** Формула ЧССмакс: classic (220/226-age) vs Tanaka 208-0.7×age (точнее по мета-анализу 351 исследования, 2024 Compendium). */
export function maxHrClassic(age: number, sex?: 'male' | 'female'): number {
  const a = Math.max(12, Math.min(90, age));
  return sex === 'female' ? 226 - a : 220 - a;
}
export function maxHrTanaka(age: number): number {
  const a = Math.max(12, Math.min(90, age));
  return Math.round(208 - 0.7 * a);
}
export function maxHrGulati(age: number): number {
  const a = Math.max(12, Math.min(90, age));
  return Math.round(206 - 0.88 * a);
}

/** Пульс-зоны (Karvonen с резервом при restingHr; иначе % от ЧССмакс). Поддерживает Tanaka/Gulati. */
export function cardioHeartZones(
  age: number,
  restingHr?: number,
  maxHr?: number,
  sex?: 'male' | 'female',
  formula?: 'classic' | 'tanaka' | 'gulati',
): HeartZone[] {
  const a = Math.max(12, Math.min(90, age));
  let hrmax: number;
  if (maxHr && maxHr > 0) hrmax = maxHr;
  else if (formula === 'tanaka') hrmax = maxHrTanaka(a);
  else if (formula === 'gulati') hrmax = maxHrGulati(a);
  else hrmax = maxHrClassic(a, sex);
  const rest = restingHr && restingHr > 0 ? Math.max(30, Math.min(100, restingHr)) : undefined;
  const ranges: { zone: number; label: string; min: number; max: number; purpose: string }[] = [
    { zone: 1, label: 'Z1 Recovery', min: 50, max: 60, purpose: 'Восстановление, разминка' },
    { zone: 2, label: 'Z2 Zone 2', min: 60, max: 70, purpose: 'Аэробная база, липолиз' },
    { zone: 3, label: 'Z3 Tempo/MISS', min: 70, max: 80, purpose: 'Мисс, аэробная выносливость' },
    { zone: 4, label: 'Z4 Threshold', min: 80, max: 90, purpose: 'Порог, интервалы' },
    { zone: 5, label: 'Z5 VO2max', min: 90, max: 100, purpose: 'Максимальный стимул (короткие интервалы)' },
  ];
  const karvonen = (pct: number) => rest != null ? Math.round(rest + (hrmax - rest) * pct / 100) : Math.round(hrmax * pct / 100);
  return ranges.map(r => ({
    zone: r.zone,
    label: r.label,
    rangeMin: r.min,
    rangeMax: r.max,
    bpmMin: karvonen(r.min),
    bpmMax: karvonen(r.max),
    purpose: r.purpose,
  }));
}

/** Пульс-зоны по LTHR (Friel 2017). */
export function lthrZones(lthr: number): HeartZone[] {
  const l = Math.max(80, Math.min(220, Math.round(lthr)));
  const ranges: { zone: number; label: string; min: number; max: number; purpose: string }[] = [
    { zone: 1, label: 'Z1 Recovery', min: 0, max: 81, purpose: 'Восстановление, разминка' },
    { zone: 2, label: 'Z2 Zone 2', min: 82, max: 88, purpose: 'Аэробная база, липолиз' },
    { zone: 3, label: 'Z3 Tempo/MISS', min: 89, max: 93, purpose: 'Мисс, аэробная выносливость' },
    { zone: 4, label: 'Z4 Threshold', min: 94, max: 100, purpose: 'Порог, интервалы' },
    { zone: 5, label: 'Z5 VO2max', min: 101, max: 130, purpose: 'Максимальный стимул' },
  ];
  return ranges.map(r => ({
    zone: r.zone,
    label: r.label,
    rangeMin: r.min,
    rangeMax: r.max,
    bpmMin: Math.round(l * r.min / 100),
    bpmMax: Math.round(l * r.max / 100),
    purpose: r.purpose,
  }));
}

/** Полевой тест LTHR: средняя ЧСС последних 20 мин 30-мин all-out (Friel). */
export function estimateLTHRFrom30Min(avgHrLast20: number): number | null {
  const v = Math.round(avgHrLast20);
  if (!Number.isFinite(v) || v < 80 || v > 220) return null;
  return v;
}

/** Оценка зон по полевым тестам: приоритет LTHR → VDOT → возраст/ЧССпокоя. */
export function estimateZonesFromFieldTests(input: {
  lthr?: number;
  vdot?: number;
  age?: number;
  restingHr?: number;
  sex?: 'male' | 'female';
  formula?: 'classic' | 'tanaka' | 'gulati';
}): { source: 'lthr' | 'vdot' | 'age'; zones: HeartZone[] } | null {
  if (input.lthr && input.lthr >= 80 && input.lthr <= 220) {
    return { source: 'lthr', zones: lthrZones(input.lthr) };
  }
  if (input.vdot && input.vdot >= 20 && input.vdot <= 85) {
    // VDOT → pace, не HR, но для совместимости даём возрастные зоны
    const zones = cardioHeartZones(input.age ?? 30, input.restingHr, undefined, input.sex, input.formula);
    return { source: 'vdot', zones };
  }
  if (input.age) {
    return { source: 'age', zones: cardioHeartZones(input.age, input.restingHr, undefined, input.sex, input.formula) };
  }
  return null;
}

export interface PowerZone { zone: number; label: string; pctMin: number; pctMax: number; wattsMin: number; wattsMax: number; purpose: string }
/** Ватт-зоны для вело по FTP (Coggan). */
export function cyclingPowerZones(ftpWatts: number): PowerZone[] {
  const ftp = Math.max(50, Math.min(800, Math.round(ftpWatts)));
  const ranges = [
    { zone: 1, label: 'Z1 Active Recovery', pctMin: 0, pctMax: 55, purpose: 'Восстановление' },
    { zone: 2, label: 'Z2 Endurance', pctMin: 56, pctMax: 75, purpose: 'Аэробная база' },
    { zone: 3, label: 'Z3 Tempo', pctMin: 76, pctMax: 90, purpose: 'Темпо' },
    { zone: 4, label: 'Z4 Threshold', pctMin: 91, pctMax: 105, purpose: 'Порог' },
    { zone: 5, label: 'Z5 VO2max', pctMin: 106, pctMax: 120, purpose: 'VO2max' },
    { zone: 6, label: 'Z6 Anaerobic', pctMin: 121, pctMax: 150, purpose: 'Анаэроб' },
    { zone: 7, label: 'Z7 Neuromuscular', pctMin: 151, pctMax: 300, purpose: 'Нейромышечная' },
  ];
  return ranges.map(r => ({
    ...r,
    wattsMin: Math.round(ftp * r.pctMin / 100),
    wattsMax: r.zone === 7 ? Math.round(ftp * 2) : Math.round(ftp * r.pctMax / 100),
  }));
}

export interface VdotResult {
  vdot: number;
  pacesKm: { label: string; minPerKm: number }[];
}

/** VDOT Daniels 2013. */
export function runningVdot(testKm: number, testMin: number): VdotResult | null {
  if (!(testKm > 0) || !(testMin > 0)) return null;
  const vel = (testKm * 1000) / testMin;
  const vo2 = -4.6 + 0.182258 * vel + 0.000104 * vel * vel;
  const t = testMin;
  const denom = 0.8 + 0.1894393 * Math.exp(-0.012778 * t) + 0.2989558 * Math.exp(-0.1932605 * t);
  const rawVdot = vo2 / denom;
  const vdot = Math.round(Math.max(20, Math.min(85, rawVdot)) * 10) / 10;
  const velFromVo2 = (targetVo2: number): number => {
    const a = 0.000104, b = 0.182258, c = -(targetVo2 + 4.6);
    const disc = b * b - 4 * a * c;
    return (-b + Math.sqrt(Math.max(0, disc))) / (2 * a);
  };
  const paceFromVel = (vMpm: number): number => {
    if (!(vMpm > 0)) return 0;
    const minPerKm = 1000 / vMpm;
    return Math.round(minPerKm * 10) / 10;
  };
  const intensities: { label: string; pct: number }[] = [
    { label: 'Лёгкий', pct: 0.70 },
    { label: 'Марафон', pct: 0.81 },
    { label: 'Порог', pct: 0.88 },
    { label: 'Интервал', pct: 0.975 },
    { label: 'Повтор', pct: 1.05 },
  ];
  const pacesKm = intensities.map(p => {
    const vo2t = vdot * p.pct;
    const v = velFromVo2(vo2t);
    const pace = paceFromVel(v);
    if (!(pace > 0)) {
      const paceMinPerKm = testMin / testKm;
      const mult = p.label === 'Лёгкий' ? 1.35 : p.label === 'Марафон' ? 1.15 : p.label === 'Порог' ? 1.03 : p.label === 'Интервал' ? 0.94 : 0.88;
      return { label: p.label, minPerKm: Math.round(paceMinPerKm * mult * 10) / 10 };
    }
    return { label: p.label, minPerKm: pace };
  });
  for (let i = 1; i < pacesKm.length; i++) {
    if (pacesKm[i].minPerKm >= pacesKm[i - 1].minPerKm) {
      pacesKm[i].minPerKm = Math.max(0.5, Math.round((pacesKm[i - 1].minPerKm - 0.2) * 10) / 10);
    }
  }
  return { vdot, pacesKm };
}

/** Banister TRIMP */
export function banisterTrimp(durationMin: number, avgHr: number, restHr: number, maxHr: number, sex: 'male' | 'female' = 'male'): number {
  if (!(durationMin > 0) || !(avgHr > 0) || !(restHr > 0) || !(maxHr > restHr)) return 0;
  const hrr = Math.max(0, Math.min(1, (avgHr - restHr) / (maxHr - restHr)));
  const k = sex === 'female' ? 0.86 : 0.64;
  const b = sex === 'female' ? 1.67 : 1.92;
  const trimp = durationMin * hrr * k * Math.exp(b * hrr);
  return Math.round(trimp * 10) / 10;
}
export const CARDIO_TRIMP_FACTOR: Record<CardioType, number> = { zone2: 2, miss: 3, hiit: 5, recovery: 1 };
export function sessionTrimpEstimate(type: CardioType, durationMin: number, avgHr?: number, restHr?: number, maxHr?: number, sex: 'male' | 'female' = 'male'): number {
  if (avgHr && restHr && maxHr) {
    const t = banisterTrimp(durationMin, avgHr, restHr, maxHr, sex);
    if (t > 0) return t;
  }
  return Math.round(durationMin * (CARDIO_TRIMP_FACTOR[type] ?? 2));
}
export function weeklyTrimp(sessions: { type: CardioType; durationMin: number; weeklyFrequency: number; avgHr?: number }[], restHr?: number, maxHr?: number, sex: 'male' | 'female' = 'male'): number {
  let sum = 0;
  for (const s of sessions) {
    const per = sessionTrimpEstimate(s.type, s.durationMin, (s as unknown as Record<string, unknown>).avgHr as number | undefined, restHr, maxHr, sex);
    sum += per * s.weeklyFrequency;
  }
  return Math.round(sum);
}

/** CTL/ATL/TSB по TRIMP */
export interface CardioCtlPoint { week: number; ctl: number; atl: number; tsb: number; trimp: number }
export function cardioCtlSeries(cycle: CardioCycle, restHr?: number, maxHr?: number, sex: 'male' | 'female' = 'male'): CardioCtlPoint[] {
  const trimpPerWeek = cycle.weeks.map(w => weeklyTrimp(w.sessions, restHr, maxHr, sex));
  const alphaCtl = 2 / (42 + 1);
  const alphaAtl = 2 / (7 + 1);
  let ctl = 0, atl = 0;
  return cycle.weeks.map((w, i) => {
    const load = trimpPerWeek[i];
    ctl = ctl + alphaCtl * (load - ctl);
    atl = atl + alphaAtl * (load - atl);
    const tsb = Math.round((ctl - atl) * 10) / 10;
    return { week: w.week, ctl: Math.round(ctl), atl: Math.round(atl), tsb, trimp: load };
  });
}
export function cardioMonotonyStrain(trimpPerDay: number[]): { monotony: number; strain: number; mean: number; stdev: number } {
  if (trimpPerDay.length === 0) return { monotony: 0, strain: 0, mean: 0, stdev: 0 };
  const mean = trimpPerDay.reduce((a, b) => a + b, 0) / trimpPerDay.length;
  const variance = trimpPerDay.reduce((s, v) => s + (v - mean) ** 2, 0) / trimpPerDay.length;
  const stdev = Math.sqrt(variance);
  const monotony = stdev > 0 ? mean / stdev : (mean > 0 ? 2 : 0);
  const sum = trimpPerDay.reduce((a, b) => a + b, 0);
  return { monotony: Math.round(monotony * 100) / 100, strain: Math.round(monotony * sum), mean: Math.round(mean * 10) / 10, stdev: Math.round(stdev * 10) / 10 };
}
export function cardioAcwrEwma(dailyTrimp: { date: string; load: number }[], referenceDate?: string): { ratio: number; zone: 'undertrained' | 'optimal' | 'caution' | 'dangerous'; acute: number; chronic: number } {
  if (dailyTrimp.length === 0) return { ratio: 0, zone: 'undertrained', acute: 0, chronic: 0 };
  const sorted = [...dailyTrimp].sort((a, b) => a.date < b.date ? -1 : 1);
  const ref = referenceDate || sorted[sorted.length - 1].date;
  const addDays = (d: string, n: number): string => { const dd = new Date(d); dd.setDate(dd.getDate() + n); return `${dd.getFullYear()}-${String(dd.getMonth() + 1).padStart(2, '0')}-${String(dd.getDate()).padStart(2, '0')}`; };
  const ewma = (vals: number[], alpha: number): number => { if (vals.length === 0) return 0; let e = vals[0]; for (let i = 1; i < vals.length; i++) e = alpha * vals[i] + (1 - alpha) * e; return e; };
  const alphaA = 2 / (7 + 1), alphaC = 2 / (28 + 1);
  const acuteVals: number[] = [], chronicVals: number[] = [];
  for (let i = 0; i < 7; i++) { const d = addDays(ref, -6 + i); const found = sorted.find(x => x.date === d); acuteVals.push(found ? found.load : 0); }
  for (let i = 0; i < 28; i++) { const d = addDays(ref, -27 + i); const found = sorted.find(x => x.date === d); chronicVals.push(found ? found.load : 0); }
  const acute = ewma(acuteVals, alphaA);
  const chronic = ewma(chronicVals, alphaC);
  const ratio = chronic > 0 ? acute / chronic : (acute > 0 ? 2 : 0);
  const zone = ratio < 0.8 ? 'undertrained' : ratio <= 1.3 ? 'optimal' : ratio <= 1.5 ? 'caution' : 'dangerous';
  return { ratio: Math.round(ratio * 100) / 100, zone, acute: Math.round(acute), chronic: Math.round(chronic) };
}

// ─── Фактическая нагрузка из дневника (daily TRIMP факта) ───

export interface CardioFactCtlPoint { date: string; ctl: number; atl: number; tsb: number; trimp: number }

function toLocalIsoFromDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function addDaysLocal(iso: string, days: number): string {
  const d = new Date(iso.length === 10 ? iso + 'T00:00:00' : iso);
  const nd = new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);
  return toLocalIsoFromDate(nd);
}

/** TRIMP одной записи дневника (Banister если есть avgHr+rest/max, иначе фактор). */
export function dailyTrimpFromLogEntry(
  entry: { type: CardioType; durationMin: number; avgHr?: number },
  restHr?: number,
  maxHr?: number,
  sex: 'male' | 'female' = 'male',
): number {
  const avgHr = (entry as { avgHr?: number }).avgHr;
  if (avgHr && restHr && maxHr) {
    const t = banisterTrimp(entry.durationMin, avgHr, restHr, maxHr, sex);
    if (t > 0) return t;
  }
  return sessionTrimpEstimate(entry.type, entry.durationMin);
}

/** Агрегированный daily TRIMP из лога (completed=true, дата → суммарный TRIMP). */
export function dailyTrimpMap(
  log: { date: string; type: CardioType; durationMin: number; avgHr?: number; completed?: boolean }[],
  restHr?: number,
  maxHr?: number,
  sex: 'male' | 'female' = 'male',
): Map<string, number> {
  const map = new Map<string, number>();
  for (const e of log) {
    if (e.completed === false) continue;
    if (!e.date || !(e.durationMin > 0)) continue;
    const trimp = dailyTrimpFromLogEntry(e as { type: CardioType; durationMin: number; avgHr?: number }, restHr, maxHr, sex);
    map.set(e.date, (map.get(e.date) ?? 0) + trimp);
  }
  return map;
}

/**
 * Фактическая CTL/ATL/TSB серия из дневника (daily EWMA 42/7, как TrainingPeaks).
 * Возвращает точки по датам от первой записи (или 42 дня до reference) до reference включительно.
 * Если лога нет — возвращает пустой массив (не 0-линия).
 */
export function cardioFactCtlSeries(
  log: { date: string; type: CardioType; durationMin: number; avgHr?: number; completed?: boolean }[],
  opts: { restHr?: number; maxHr?: number; sex?: 'male' | 'female'; referenceIso?: string; days?: number } = {},
): CardioFactCtlPoint[] {
  if (!log || log.length === 0) return [];
  const restHr = opts.restHr;
  const maxHr = opts.maxHr;
  const sex = opts.sex ?? 'male';
  const refIso = opts.referenceIso ?? toLocalIsoFromDate(new Date());
  const map = dailyTrimpMap(log, restHr, maxHr, sex);
  // диапазон: от min(log date, ref- days+1) до ref
  const days = Math.max(7, Math.min(365, Math.round(opts.days ?? 90)));
  const startIso = addDaysLocal(refIso, -(days - 1));
  // находим самую раннюю дату лога не позже ref, но не раньше startIso
  const sortedDates = [...map.keys()].sort();
  const effectiveStart = sortedDates.length > 0 && sortedDates[0] < startIso ? sortedDates[0] : startIso;
  // если лог начинается позже startIso, заполняем 0 до первой записи (CTL стартует с 0)
  const alphaCtl = 2 / (42 + 1);
  const alphaAtl = 2 / (7 + 1);
  let ctl = 0;
  let atl = 0;
  const out: CardioFactCtlPoint[] = [];
  let cur = effectiveStart;
  // идем по календарю день-за-днем до ref
  while (cur <= refIso) {
    const trimp = map.get(cur) ?? 0;
    ctl = ctl + alphaCtl * (trimp - ctl);
    atl = atl + alphaAtl * (trimp - atl);
    const tsb = Math.round((ctl - atl) * 10) / 10;
    out.push({ date: cur, ctl: Math.round(ctl * 10) / 10, atl: Math.round(atl * 10) / 10, tsb, trimp });
    if (cur === refIso) break;
    cur = addDaysLocal(cur, 1);
    // защита от бесконечности
    if (out.length > 400) break;
  }
  return out;
}

/** HR drift (decoupling) за сессию: если avgHr растёт >5% при стабильном темпе/мощности — warning. */
export function cardioHrDrift(
  firstHalfAvgHr: number,
  secondHalfAvgHr: number,
): { driftPct: number; warn: boolean } {
  if (!(firstHalfAvgHr > 0) || !(secondHalfAvgHr > 0)) return { driftPct: 0, warn: false };
  const driftPct = ((secondHalfAvgHr - firstHalfAvgHr) / firstHalfAvgHr) * 100;
  return { driftPct: Math.round(driftPct * 10) / 10, warn: driftPct > 5 };
}
