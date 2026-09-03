/**
 * cardio-tid.engine.ts — TID + Polarization Index + фазированность (Эпик D).
 * Чистые функции, без IO.
 *
 * Литература:
 * - Treff 2019: PI = log10(Z1/Z2 × Z3 × 100); PI > 2 → polarized.
 * - Seiler & Kjerland 2006: POL = 75-80% Z1 + 15-20% Z3 + ~5% Z2.
 * - Silva 2025 (Sports Med): POL vs PYR без разницы VO2/TT в целом; competitive → POL лучше, recreational → PYR.
 * - Cove 2024 (велосипедисты): POL = NP (g 0.42 VO2 обе).
 * - Filipas 2021: PYR→POL за 16 нед +3% VO2max (лучший протокол).
 * - Frontiers 2025: фазовый сдвиг general PYR/POL → specific PYR → pre-comp POL.
 */
import type { CardioCycle, CardioType } from './cardio.engine';

export type TidModel = 'polarized' | 'pyramidal' | 'threshold' | 'other';

/** Маппинг типа сессии в зону TID: recovery/zone2 → Z1, miss → Z2, hiit → Z3. */
export function tidZoneOf(type: CardioType): 1 | 2 | 3 {
  if (type === 'miss') return 2;
  if (type === 'hiit') return 3;
  return 1;
}

export interface TimeInZones {
  z1Min: number;
  z2Min: number;
  z3Min: number;
  totalMin: number;
  pct: { z1: number; z2: number; z3: number };
}

/** Время в зонах по циклу (минуты = durationMin × weeklyFrequency). */
export function timeInZones(cycle: Pick<CardioCycle, 'weeks'>): TimeInZones {
  let z1Min = 0;
  let z2Min = 0;
  let z3Min = 0;
  for (const w of cycle.weeks) {
    for (const s of w.sessions) {
      const min = s.durationMin * s.weeklyFrequency;
      const z = tidZoneOf(s.type);
      if (z === 1) z1Min += min;
      else if (z === 2) z2Min += min;
      else z3Min += min;
    }
  }
  const totalMin = z1Min + z2Min + z3Min;
  const pct = totalMin > 0
    ? { z1: Math.round((z1Min / totalMin) * 1000) / 10, z2: Math.round((z2Min / totalMin) * 1000) / 10, z3: Math.round((z3Min / totalMin) * 1000) / 10 }
    : { z1: 0, z2: 0, z3: 0 };
  return { z1Min, z2Min, z3Min, totalMin, pct };
}

/** Polarization Index (Treff 2019): входы — проценты 0-100, внутри — доли.
 *  PI = log10((z1/z2) × z3доля × 100) = log10(z1/z2 × z3); порог 2.
 *  Пример: 80/5/15 → 2.38 polarized; 80/15/5 → 1.42 pyramidal. */
export function polarizationIndex(z1Pct: number, z2Pct: number, z3Pct: number): number | null {
  const z1 = Number(z1Pct);
  const z2 = Number(z2Pct);
  const z3 = Number(z3Pct);
  if (![z1, z2, z3].every(Number.isFinite) || z1 <= 0 || z3 <= 0) return null;
  if (z2 <= 0) {
    // Z2=0: доля 0.0001 (0.01%) чтобы избежать деления на 0
    const v = Math.log10((z1 / 0.01) * (z3 / 100) * 100);
    return Math.round(v * 100) / 100;
  }
  const v = Math.log10((z1 / z2) * z3);
  return Math.round(v * 100) / 100;
}

/** Классификация TID по PI и распределению. */
export function classifyTid(tiz: TimeInZones): { model: TidModel; pi: number | null; label: string } {
  const pi = polarizationIndex(tiz.pct.z1, tiz.pct.z2, tiz.pct.z3);
  if (tiz.totalMin === 0) return { model: 'other', pi, label: 'Нет объёма' };
  if (pi != null && pi > 2 && tiz.pct.z1 > tiz.pct.z3 && tiz.pct.z3 > tiz.pct.z2) {
    return { model: 'polarized', pi, label: `Polarized (PI ${pi} > 2, Z1>Z3>Z2)` };
  }
  if (tiz.pct.z1 > tiz.pct.z2 && tiz.pct.z2 > tiz.pct.z3 && tiz.pct.z1 >= 60) {
    return { model: 'pyramidal', pi, label: `Pyramidal (Z1>Z2>Z3, PI ${pi ?? '—'})` };
  }
  if (tiz.pct.z2 >= 35) {
    return { model: 'threshold', pi, label: `Threshold (Z2 ${tiz.pct.z2}% ≥ 35%)` };
  }
  return { model: 'other', pi, label: `Смешанное (PI ${pi ?? '—'})` };
}

/** Совет по TID с учётом уровня (Silva: recreational→PYR, competitive→POL; Cove: вело нейтрально). */
export function tidAdvice(
  model: TidModel,
  level: 'beginner' | 'intermediate' | 'advanced',
  sport?: 'run' | 'bike' | 'row' | 'other',
): string {
  if (model === 'polarized' && level === 'beginner') {
    return 'Polarized у новичка: замените часть Z3 на Z2 (pyramidal) — техника и база важнее интенсивности (Silva 2025: recreational → PYR).';
  }
  if (model === 'pyramidal' && level === 'advanced' && sport !== 'bike') {
    return 'Продвинутый + pyramidal: в предсоревновательный блок сдвиньте Z2→Z3 (PYR→POL, Filipas +3% VO2) — поляризация даст пик.';
  }
  if (sport === 'bike' && (model === 'polarized' || model === 'pyramidal')) {
    return 'Вело: POL = PYR по эффекту (Cove 2024) — держите удобную модель, ключ — объём и частота.';
  }
  if (model === 'threshold') {
    return 'Threshold (много Z2): эффективно для техники (плавание), но для бега/вело сдвиньте часть Z2 в Z1 (Seiler 80/20).';
  }
  return 'TID соответствует уровню: держите 75-85% Z1, 5-15% Z2, 10-20% Z3 в зависимости от фазы.';
}

export type SeasonPhase = 'general' | 'specific' | 'precomp' | 'comp';

/** Целевое распределение по фазе сезона (Seiler/Frontiers 2025). */
export function phasedTidTarget(phase: SeasonPhase): { z1: number; z2: number; z3: number; note: string } {
  switch (phase) {
    case 'general':
      return { z1: 85, z2: 8, z3: 7, note: 'General: PYR 85/8/7 — база, митохондрии (Seiler).' };
    case 'specific':
      return { z1: 80, z2: 10, z3: 10, note: 'Specific: PYR 80/10/10 — рост Z3 до 10% (спорт-специфика).' };
    case 'precomp':
      return { z1: 78, z2: 5, z3: 17, note: 'Pre-comp: POL 78/5/17 — Z2 <5%, Z3 15-20% (пик готовности).' };
    case 'comp':
      return { z1: 75, z2: 5, z3: 20, note: 'Comp: POL 75/5/20 — свежесть + интенсивность, объём −40-60%.' };
  }
}

/** Насколько текущий TID далёк от целевого (сумма |Δ|/2, 0-100). */
export function tidDistanceToTarget(tiz: TimeInZones, target: { z1: number; z2: number; z3: number }): number {
  const d = (Math.abs(tiz.pct.z1 - target.z1) + Math.abs(tiz.pct.z2 - target.z2) + Math.abs(tiz.pct.z3 - target.z3)) / 2;
  return Math.round(d * 10) / 10;
}
