/**
 * cardio-interference.engine.ts — модель интерференции кардио × силовой (Wilson 2012 / Schumann 2022 / Huiberts 2024)
 * Оценка совместимости по шкале 0-10 (low <4, mid 4-6, high >6).
 * Учитывает: модальность (бег worst), частоту/длительность, тайминг vs тяжёлые ноги, пол.
 * Чистые функции, без IO.
 */

import type { CardioEquipment, CardioType } from './cardio.engine';

export type InterferenceModality = CardioEquipment | CardioType | 'running' | 'cycling' | 'rowing' | 'elliptical' | 'walking' | 'swimming';

export type InterferenceTiming = 'separate_day' | 'same_day_after' | 'same_day_before' | 'day_before_legs' | 'day_after_legs';

export interface CardioInterferenceInput {
  /** Модальность кардио (бег worst 1.0, вело 0.3). Если массив — берётся worst. */
  modality?: InterferenceModality | InterferenceModality[];
  /** Частота кардио сессий в неделю */
  frequencyPerWeek?: number;
  /** Средняя длительность сессии (мин) */
  avgDurationMin?: number;
  /** Частота тяжёлых ног в неделю (из силового плана) */
  legDaysPerWeek?: number;
  /** Тайминг кардио относительно ног */
  timing?: InterferenceTiming;
  /** Пол (женщины менее подвержены по Huiberts 2024) */
  sex?: 'male' | 'female';
  /** Тренировочный статус: больше опыт → меньше interference */
  trainingStatus?: 'beginner' | 'intermediate' | 'advanced';
  /** Доля HIIT (>85% ЧССмакс) среди кардио (0-1) */
  hiitRatio?: number;
}

export interface CardioInterferenceResult {
  score: number; // 0-10, чем выше — хуже
  level: 'low' | 'mid' | 'high';
  advice: string;
  breakdown: { factor: string; points: number; note: string }[];
}

const MODALITY_WEIGHT: Record<string, number> = {
  running: 1.0,
  run: 1.0,
  hiit: 0.6, // HIIT via running more interference than Zone2, but less chronic AMPK than long run
  zone2: 0.5,
  miss: 0.6,
  recovery: 0.1,
  cycling: 0.3,
  rowing: 0.4,
  elliptical: 0.35,
  walking: 0.1,
  swimming: 0.25,
  swimming_pool: 0.25,
  bike: 0.3,
  elliptical_machine: 0.35,
};

function modalityW(m: string): number {
  const key = String(m).toLowerCase().trim();
  if (MODALITY_WEIGHT[key] !== undefined) return MODALITY_WEIGHT[key];
  // fallback: equipment mapping
  if (key.includes('бег') || key.includes('run')) return 1.0;
  if (key.includes('вело') || key.includes('cycling') || key.includes('bike')) return 0.3;
  if (key.includes('греб')) return 0.4;
  if (key.includes('эллипс')) return 0.35;
  if (key.includes('ходьб') || key.includes('walk')) return 0.1;
  if (key.includes('плаван')) return 0.25;
  return 0.5; // default moderate
}

export function cardioInterferenceScoreDetailed(input: CardioInterferenceInput = {}): CardioInterferenceResult {
  const breakdown: { factor: string; points: number; note: string }[] = [];
  let score = 0;

  // 1. Модальность (0-3)
  const mods = Array.isArray(input.modality) ? input.modality : input.modality ? [input.modality] : [];
  const worstMod = mods.length > 0 ? Math.max(...mods.map(m => modalityW(String(m)))) : 0.5;
  const modPoints = worstMod * 3; // 0.3→0.9, 1.0→3.0
  if (mods.length > 0) breakdown.push({ factor: 'modality', points: Math.round(modPoints * 10) / 10, note: `Модальность ${mods.join('+')} (worst ${worstMod})` });
  score += modPoints;

  // 2. Частота (0-3): Wilson 2012 dose-response steep above 3
  const freq = input.frequencyPerWeek ?? 3;
  let freqPoints = 0;
  if (freq <= 3) freqPoints = freq * 0.3; // 3×0.3=0.9
  else if (freq <= 5) freqPoints = 0.9 + (freq - 3) * 0.8; // 5→2.5
  else freqPoints = 2.5 + (freq - 5) * 1.0; // >5 steep
  freqPoints = Math.min(3, freqPoints);
  breakdown.push({ factor: 'frequency', points: Math.round(freqPoints * 10) / 10, note: `${freq}×/нед` });
  score += freqPoints;

  // 3. Длительность (0-2): 20-30 min minimal, 60 min chronic AMPK
  const dur = input.avgDurationMin ?? 30;
  let durPoints = 0;
  if (dur <= 30) durPoints = dur / 60; // 30→0.5
  else if (dur <= 45) durPoints = 0.5 + (dur - 30) / 30; // 45→1.0
  else if (dur <= 60) durPoints = 1.0 + (dur - 45) / 30; // 60→1.5
  else durPoints = 1.5 + Math.min(0.5, (dur - 60) / 60); // cap 2.0
  breakdown.push({ factor: 'duration', points: Math.round(durPoints * 10) / 10, note: `${dur} мин` });
  score += durPoints;

  // 4. Тайминг (0-2.5): same_day_before worst (коэффициент Eddens 6.91% strength loss)
  const timing = input.timing ?? 'separate_day';
  const timingMap: Record<string, number> = {
    separate_day: 0,
    day_after_legs: 0.4,
    same_day_after: 1.0,
    day_before_legs: 1.5,
    same_day_before: 2.5,
  };
  const timingPoints = timingMap[timing] ?? 0;
  breakdown.push({ factor: 'timing', points: timingPoints, note: timing });
  score += timingPoints;

  // 5. Частота ног (чувствительность): 2× ноги уже требует осторожности
  const legFreq = input.legDaysPerWeek ?? 2;
  let legPoints = 0;
  if (legFreq >= 4) legPoints = 0.8;
  else if (legFreq >= 3) legPoints = 0.4;
  breakdown.push({ factor: 'legFreq', points: legPoints, note: `${legFreq}× ноги/нед` });
  score += legPoints;

  // 6. HIIT ratio: >50% high chronic stress
  const hiit = input.hiitRatio ?? 0;
  if (hiit > 0.5) {
    const hiitPoints = (hiit - 0.5) * 1.0; // 0.5→0, 1.0→0.5
    breakdown.push({ factor: 'hiitRatio', points: Math.round(hiitPoints * 10) / 10, note: `${Math.round(hiit * 100)}% HIIT` });
    score += hiitPoints;
  }

  // Модификаторы: пол (Huiberts 2024 women lower), статус
  if (input.sex === 'female') {
    score *= 0.85;
    breakdown.push({ factor: 'sex', points: -0.5, note: 'Женщины: −15% (Huiberts 2024)' });
  }
  if (input.trainingStatus === 'advanced') {
    score *= 0.9;
    breakdown.push({ factor: 'status', points: -0.3, note: 'Продвинутый: −10%' });
  } else if (input.trainingStatus === 'beginner') {
    score *= 1.1;
    breakdown.push({ factor: 'status', points: 0.3, note: 'Новичок: +10% (быстрее восстанавливается, но техника)' });
  }

  score = Math.max(0, Math.min(10, Math.round(score * 10) / 10));
  const level: 'low' | 'mid' | 'high' = score < 4 ? 'low' : score <= 6 ? 'mid' : 'high';
  let advice: string;
  if (level === 'low') advice = 'Совместимо: 2-3× вело/гребля в отдельные дни — кардио не мешает гипертрофии (Schumann 2022).';
  else if (level === 'mid') advice = 'Умеренный риск: сократите бег до 3×, перенесите в дни без ног, ≥6 ч от силовой (Eddens).';
  else advice = 'Высокий interference: 5× бег 60мин до ног — сила −31%/гипертрофия −18% (Wilson 2012). Снизьте объём/частоту, приоритет вело после ног.';

  return { score, level, advice, breakdown };
}

/** Совместимость: карта equipment/type → modality weight для быстрого скоринга цикла. */
export function interferenceForCycle(
  cycle: { weeks: { sessions: { type: string; equipment?: string; durationMin: number; weeklyFrequency: number }[] }[] },
  legDaysPerWeek?: number,
  sex?: 'male' | 'female',
): CardioInterferenceResult {
  if (!cycle || !cycle.weeks || cycle.weeks.length === 0) return cardioInterferenceScoreDetailed({ modality: 'cycling', frequencyPerWeek: 0 });
  const avgWeeks = cycle.weeks.slice(0, 4);
  const totalSessions = avgWeeks.reduce((s, w) => s + w.sessions.reduce((a, x) => a + x.weeklyFrequency, 0), 0) / Math.max(1, avgWeeks.length);
  const totalMin = avgWeeks.reduce((s, w) => s + w.sessions.reduce((a, x) => a + x.durationMin * x.weeklyFrequency, 0), 0) / Math.max(1, avgWeeks.length);
  const avgDur = totalSessions > 0 ? totalMin / totalSessions : 30;
  const modalities: string[] = [];
  for (const w of avgWeeks) for (const s of w.sessions) {
    if (s.equipment) modalities.push(s.equipment);
    else modalities.push(s.type);
  }
  const hiitCount = avgWeeks.reduce((s, w) => s + w.sessions.filter(x => x.type === 'hiit').reduce((a, x) => a + x.weeklyFrequency, 0), 0) / Math.max(1, avgWeeks.length);
  const hiitRatio = totalSessions > 0 ? hiitCount / totalSessions : 0;
  return cardioInterferenceScoreDetailed({
    modality: modalities.length > 0 ? modalities : undefined,
    frequencyPerWeek: Math.round(totalSessions),
    avgDurationMin: Math.round(avgDur),
    legDaysPerWeek,
    timing: 'separate_day',
    sex,
    hiitRatio,
  });
}

/** Legacy простой скор: день ног vs день кардио (для week editor). */
export function simpleInterferenceScore(legDays: number[], cardioDay: number): 'ok' | 'caution' | 'avoid' {
  if (!legDays || legDays.length === 0) return 'ok';
  const diff = Math.min(...legDays.map(d => {
    const delta = (cardioDay - d + 7) % 7;
    return Math.min(delta, 7 - delta);
  }));
  if (diff === 0) return 'avoid';
  if (diff === 1) return 'caution';
  return 'ok';
}
