// PK Bateman engine — честная однокомпартментная модель с Tmax (паритет InjectBuddy/SteroidPlotter/OptiPin).
// C(t) = dose * ka/(ka-ke) * (e^-ke*t - e^-ka*t), ke = ln2/tHalf, ka из Tmax бисекцией.
// Относительные единицы (не нг/дл) — подтвердить анализом крови + врачом.
export interface EsterCanon {
  tHalfDays: number;
  tmaxDays?: number;
  confidence: 1 | 2 | 3 | 4 | 5;
  source: string;
}

export const PK_DISCLAIMER =
  'Относительные единицы модели, не показания лаборатории. Подтверди анализом крови и врачом.';

// Сверка с OptiPin (66 соединений) + InjectBuddy. Strong = контролируемые PK-исследования.
export const PK_ESTER_CANON: Record<string, EsterCanon> = {
  propionate: { tHalfDays: 1.0, tmaxDays: 0.5, confidence: 5, source: 'OptiPin Strong' },
  phenylpropionate: { tHalfDays: 2.5, tmaxDays: 1.0, confidence: 3, source: 'OptiPin Moderate' },
  acetate: { tHalfDays: 3.0, tmaxDays: 1.2, confidence: 3, source: 'InjectBuddy' },
  enanthate: { tHalfDays: 7.2, tmaxDays: 2.0, confidence: 5, source: 'OptiPin Strong' },
  cypionate: { tHalfDays: 6.9, tmaxDays: 2.5, confidence: 5, source: 'OptiPin Strong' },
  decanoate: { tHalfDays: 10.2, tmaxDays: 3.0, confidence: 5, source: 'OptiPin Strong (nandrolone)' },
  undecanoate: { tHalfDays: 20.0, tmaxDays: 5.0, confidence: 3, source: 'OptiPin Estimated (MCT 20 / castor 34)' },
  isocaproate: { tHalfDays: 7.0, tmaxDays: 2.0, confidence: 3, source: 'OptiPin Moderate' },
  hexahydrobenzylcarbonate: { tHalfDays: 8.0, tmaxDays: 2.5, confidence: 3, source: 'OptiPin Moderate' },
  sustanon: { tHalfDays: 7.2, tmaxDays: 2.0, confidence: 2, source: 'Смесь 4 эфиров — max-оценка, не точно' },
  oral: { tHalfDays: 0.3, tmaxDays: 0.1, confidence: 4, source: 'OptiPin oral avg' },
};

export function resolveEsterCanon(ester: string): EsterCanon & { key: string; estimated: boolean } {
  const key = String(ester || '').toLowerCase();
  const found = PK_ESTER_CANON[key];
  if (found) return { ...found, key, estimated: found.confidence <= 2 };
  return { tHalfDays: 4.5, tmaxDays: 2.0, confidence: 1, source: 'Оценка — не измерено', key, estimated: true };
}

export function keFromHalfLifeDays(tHalfDays: number): number {
  if (!Number.isFinite(tHalfDays) || tHalfDays <= 0) return 0;
  return Math.LN2 / (tHalfDays * 24); // per hour
}

// Бисекция ka по Tmax: tmax = ln(ka/ke)/(ka-ke). Паритет InjectBuddy.
export function solveKaFromTmax(tmaxHours: number, ke: number): number {
  if (!Number.isFinite(tmaxHours) || tmaxHours <= 0 || !(ke > 0)) return ke * 2;
  let lo = ke * 1.001;
  let hi = ke * 100;
  const f = (ka: number) => Math.log(ka / ke) / (ka - ke);
  // если tmax больше возможного — вернуть медленную абсорбцию
  if (f(lo) < tmaxHours) return lo;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (f(mid) > tmaxHours) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

export function batemanC(dose: number, ka: number, ke: number, tHours: number): number {
  if (!(dose > 0) || !(ka > 0) || !(ke > 0) || !(tHours >= 0)) return 0;
  if (Math.abs(ka - ke) < 1e-9) return dose * ka * tHours * Math.exp(-ke * tHours);
  return (dose * ka) / (ka - ke) * (Math.exp(-ke * tHours) - Math.exp(-ka * tHours));
}

// Кривая многократных инъекций по расписанию (дни 1..7) на N дней. Возвращает дневные точки.
export function batemanCourse(dosePerInjection: number, tHalfDays: number, tmaxDays: number | undefined, injectDays: number[], totalDays: number): number[] {
  const ke = keFromHalfLifeDays(tHalfDays);
  const tmaxH = Math.max(1, (tmaxDays ?? tHalfDays / 3) * 24);
  const ka = solveKaFromTmax(tmaxH, ke);
  const set = new Set((injectDays || []).filter((d) => d >= 1 && d <= 7));
  const out: number[] = new Array(Math.max(0, totalDays)).fill(0);
  let carry = 0;
  // Простой суперпозиционный расчёт: каждая инъекция даёт Bateman-хвост
  const tails: { startDay: number }[] = [];
  for (let day = 1; day <= totalDays; day++) {
    const dow = ((day - 1) % 7) + 1;
    if (set.has(dow)) tails.push({ startDay: day });
    let c = 0;
    for (const t of tails) {
      const tH = (day - t.startDay) * 24 + 12; // середина дня
      if (tH >= 0) c += batemanC(dosePerInjection, ka, ke, tH);
    }
    out[day - 1] = Math.round(c * 100) / 100;
    carry = c;
  }
  return out;
}

export function peakTroughRatio(peak: number, trough: number): number {
  if (!(trough > 0)) return peak > 0 ? Number.POSITIVE_INFINITY : 1;
  return peak / trough;
}

export function ratioVerdict(ratio: number): { ok: boolean; label: string } {
  if (!Number.isFinite(ratio)) return { ok: false, label: 'Нет данных' };
  if (ratio <= 1.5) return { ok: true, label: 'Стабильно ≤1.5' };
  if (ratio <= 2.0) return { ok: false, label: 'Качели — учащай инъекции' };
  return { ok: false, label: 'Сильные качели — доза делится' };
}

// Подбор интервала (дней) для ratio ≤1.5 steady-state одноэкспоненциальной оценкой.
export function suggestIntervalDays(tHalfDays: number, target = 1.5): number {
  if (!(tHalfDays > 0)) return 3.5;
  // ratio ≈ e^{ke*interval} для bolus steady-state; interval = ln(target)/ke
  const keDay = Math.LN2 / tHalfDays;
  const iv = Math.log(target) / keDay;
  return Math.max(0.5, Math.round(iv * 2) / 2);
}

export function timeToSteadyDays(tHalfDays: number): number {
  return Math.round(4.3 * tHalfDays * 10) / 10;
}
export function timeToClearDays(tHalfDays: number): number {
  return Math.round(5 * tHalfDays * 10) / 10;
}
