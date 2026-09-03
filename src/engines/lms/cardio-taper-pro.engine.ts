/**
 * cardio-taper-pro.engine.ts — индивидуализация taper (Эпик F).
 * Чистые функции, без IO. Дополняет bbCardioTaperMult непрерывной моделью.
 *
 * Литература:
 * - Bosquet 2007 (meta): 40-60% объём за 14д, интенсивность/частота сохранить → +1.9%.
 * - Mujika & Padilla: progressive > step; fast decay (τ≈4д) для короткого taper, slow (τ≈8д) для длинного.
 * - Thomas & Busso (моделирование): overload +20% 28д → нужен taper 3 нед (vs 2 без overload).
 * - Le Meur / Coutts: overload + taper даёт supercompensation, но F-OR требует дольше.
 * - Front Sports 2024 (пловцы): AF +1.82%, F-OR −0.49% при одинаковой нагрузке — F-OR нужен больший срез + сон.
 * - Wang 2023: 41-60% progressive 8-14д оптимально; ≤7д и 15-21д тоже работают.
 */

export type TaperDecay = 'fast' | 'slow';
export type FatigueClass = 'AF' | 'F-OR';

export interface PreTaperState {
  /** Рост нагрузки за 28д до taper, % к норме (0 = норма, +20 = overload). */
  overloadPct?: number;
  /** Класс усталости: AF (acute fatigue) vs F-OR (functional overreaching). */
  fatigue?: FatigueClass | null;
  /** Сон средний, ч. <6 → нужен длиннее + гигиена сна. */
  sleepHours?: number | null;
  /** ACWR текущий. ≥1.5 → F-OR-подобный. */
  acwr?: number | null;
}

/** Экспоненциальный taper: load(day) = base × (1 − reduction × (1 − e^(−day/τ))). Упрощённо — множитель дня. */
export function exponentialTaperMult(dayFromStart: number, totalDays: number, reductionPct: number, tauDays: number): number {
  const d = Math.max(0, dayFromStart);
  const t = Math.max(1, totalDays);
  const tau = Math.max(1, tauDays);
  const r = Math.max(0, Math.min(0.9, reductionPct / 100));
  const prog = 1 - Math.exp(-d / tau);
  const full = 1 - Math.exp(-t / tau);
  const k = full > 0 ? prog / full : 1;
  return Math.round((1 - r * k) * 1000) / 1000;
}

/** Step taper: постоянный срез с первого дня. */
export function stepTaperMult(reductionPct: number): number {
  const r = Math.max(0, Math.min(0.9, reductionPct / 100));
  return Math.round((1 - r) * 1000) / 1000;
}

/** Выбор decay по длительности: короткий ≤14д → fast τ=4, длинный >14д → slow τ=8 (Banister/Mujika). */
export function recommendTaperDecay(taperDays: number, preOverload: boolean): { decay: TaperDecay; tauDays: number; note: string } {
  const d = Math.max(1, Math.round(taperDays));
  if (d <= 14) {
    return { decay: 'fast', tauDays: 4, note: `Короткий taper ${d}д → fast decay τ=4д (экспонента быстро снимает усталость).${preOverload ? ' Pre-overload учтён — срез больше.' : ''}` };
  }
  return { decay: 'slow', tauDays: 8, note: `Длинный taper ${d}д → slow decay τ=8д (медленное снятие, сохранение адаптаций).` };
}

export interface IndividualTaperPlan {
  durationDays: number;
  reductionPct: number;
  model: 'exponential' | 'step';
  tauDays: number;
  expectedGainPct: number;
  reasons: string[];
  sleepHygiene: boolean;
}

/**
 * Индивидуальный taper-план по пред-нагрузке и усталости.
 * - База: 14д, −50%, exponential (Bosquet/Wang).
 * - Overload +20% 28д → 21д (Thomas & Busso).
 * - F-OR / ACWR≥1.5 / сон<6 → +7д и −10 п.п. среза больше + гигиена сна (Front 2024).
 */
export function individualizedTaperPlan(state: PreTaperState = {}): IndividualTaperPlan {
  let durationDays = 14;
  let reductionPct = 50;
  const reasons: string[] = ['База Bosquet/Wang: 14д, −50% объёма, интенсивность сохранить.'];
  const overload = state.overloadPct ?? 0;
  if (overload >= 20) {
    durationDays = 21;
    reasons.push('Pre-overload +20% 28д → taper 21д (Thomas & Busso: overload требует дольше).');
  } else if (overload >= 10) {
    durationDays = 17;
    reasons.push('Pre-overload +10% → taper 17д.');
  }
  const isFor = state.fatigue === 'F-OR' || (state.acwr != null && state.acwr >= 1.5);
  const badSleep = state.sleepHours != null && state.sleepHours < 6;
  if (isFor) {
    durationDays = Math.max(durationDays, 21);
    reductionPct = Math.min(65, reductionPct + 10);
    reasons.push('F-OR/ACWR≥1.5 → срез больше (−60%) и дольше (21д); иначе −0.5% результата (Front 2024).');
  }
  if (badSleep) {
    durationDays = Math.max(durationDays, 21);
    reasons.push('Сон <6ч → taper 21д + гигиена сна (ранний отбой, терморегуляция, cryo по показаниям).');
  }
  const { tauDays } = recommendTaperDecay(durationDays, overload >= 10);
  const expectedGainPct = isFor ? 0.5 : overload >= 20 ? 2.6 : 1.9;
  return {
    durationDays,
    reductionPct,
    model: 'exponential',
    tauDays,
    expectedGainPct: Math.round(expectedGainPct * 10) / 10,
    reasons,
    sleepHygiene: isFor || badSleep,
  };
}

/** Ожидаемый прирост результата по срезу/длите (Bosquet +1.9%, Mujika до 3%). */
export function performanceGainEstimate(reductionPct: number, durationDays: number): { gainPct: number; note: string } {
  const r = Number(reductionPct);
  const d = Number(durationDays);
  if (!(r >= 0) || !(d > 0)) return { gainPct: 0, note: 'Нет данных для прогноза.' };
  // оптимум 41-60% 8-21д → 1.9-2.6%; вне оптимума — меньше
  const inOpt = r >= 41 && r <= 60 && d >= 8 && d <= 21;
  const gainPct = inOpt ? 1.9 + Math.min(1.1, Math.max(0, (r - 41) / 19)) : Math.max(0.2, 1.9 - Math.abs(r - 50) / 25 - Math.abs(d - 14) / 20);
  return { gainPct: Math.round(gainPct * 10) / 10, note: inOpt ? 'Оптимум Wang/Bosquet: 41-60% 8-21д progressive.' : 'Вне оптимума 41-60% 8-21д — эффект ниже.' };
}
