/**
 * cardio-safety.engine.ts — Safety v2: жара/высота/гидратация + тайминг-оптимизатор (Эпик G).
 * Чистые функции, без IO.
 *
 * Литература:
 * - Polar/Cardiac drift: жара + дегидратация → дрейф; >90' — pace/RPE первичны, HR вторичен.
 * - Petré 2021: тренированные страдают только при same session (ES −0.66); раздельно >2ч — ок.
 * - Robineau: интервал ≥6ч между силой и выносливостью; иначе interference растёт.
 * - Wilson 2012: бег вредит силе/гипертрофии, вело — нет; частота/длительность r=−0.26..−0.75.
 * - Huiberts 2023: interference lower-body у мужчин −0.43, у женщин ~0.
 */

export interface HeatContext {
  tempC?: number;
  humidityPct?: number;
  altitudeM?: number;
  durationMin: number;
}

/** Поправка HR на жару/влажность/высоту (уд/мин сверху к зонам). */
export function heatAltitudeHrAdd(ctx: HeatContext): { addBpm: number; notes: string[] } {
  const notes: string[] = [];
  let add = 0;
  if (ctx.tempC != null && ctx.tempC > 25) {
    const d = Math.min(10, Math.round(ctx.tempC - 25));
    add += d;
    notes.push(`Жара ${ctx.tempC}°C → +${d} уд/мин к зонам (терморегуляция).`);
  }
  if (ctx.humidityPct != null && ctx.humidityPct > 70 && ctx.durationMin > 60) {
    add += 2;
    notes.push('Влажность >70% + >60\' → +2 уд/мин (испарение затруднено).');
  }
  if (ctx.altitudeM != null && ctx.altitudeM > 1000) {
    const d = Math.min(15, Math.round((ctx.altitudeM - 1000) / 300));
    add += d;
    notes.push(`Высота ${ctx.altitudeM}м → +${d} уд/мин (гипоксия).`);
  }
  if (add === 0) notes.push('Жара/высота в норме — поправки не нужны.');
  return { addBpm: add, notes };
}

/** Гидратация: 500-750 мл/ч, >90' — электролиты Na/K/Mg. */
export function hydrationAdvice(durationMin: number, tempC?: number): string {
  const hot = tempC != null && tempC >= 25;
  if (durationMin < 60) return 'До 60\': вода по жажде; электролиты не обязательны.';
  if (durationMin <= 90) return `60-90\': ${hot ? '750' : '500'}-750 мл/ч${hot ? ', жара — пейте раньше жажды' : ''}.`;
  return `>90\': 500-750 мл/ч + электролиты (Na 500-700мг/л, K/Mg); углеводы 30-60г/ч; жара ${tempC ?? '—'}°C — увеличьте объём.`;
}

export type SessionGap = 'separate_day' | 'same_day_6h' | 'same_day_2h' | 'same_session';

export interface TimingInput {
  legDays: number[];
  cardioDay: number;
  gap?: SessionGap;
  sex?: 'male' | 'female';
  trained?: boolean;
}

/**
 * Тайминг-оптимизатор: separate_day (0) > same_day_6h (+0.5) > same_day_2h (+1.5) > same_session (+2.5, Petré ES −0.66).
 * Возвращает penalty 0-3 и рекомендацию.
 */
export function cardioTimingPenalty(input: TimingInput): { penalty: number; advice: string } {
  const gap = input.gap ?? 'separate_day';
  const base = gap === 'separate_day' ? 0 : gap === 'same_day_6h' ? 0.5 : gap === 'same_day_2h' ? 1.5 : 2.5;
  // день ног рядом усиливает
  const diff = input.legDays.length === 0 ? 99 : Math.min(...input.legDays.map(d => {
    const delta = (input.cardioDay - d + 7) % 7;
    return Math.min(delta, 7 - delta);
  }));
  const dayAdd = diff === 0 ? 1.5 : diff === 1 ? 0.7 : 0;
  let penalty = base + dayAdd;
  if (input.sex === 'female') penalty *= 0.85;
  if (input.trained === false) penalty *= 0.9;
  penalty = Math.round(Math.min(3, penalty) * 10) / 10;
  const advice = penalty < 1
    ? 'Тайминг оптимален: отдельный день или ≥6ч от ног — interference минимален.'
    : penalty < 2
      ? 'Умеренный тайминг: держите ≥6ч от силовой, кардио ПОСЛЕ силы (Robineau).'
      : 'Плохой тайминг: same session / перед ногами — сила −31%/гипертрофия −18% (Wilson); перенесите на отдельный день.';
  return { penalty, advice };
}

export interface InterferenceV2Input {
  modality?: string | string[];
  frequencyPerWeek?: number;
  avgDurationMin?: number;
  legDaysPerWeek?: number;
  gap?: SessionGap;
  sex?: 'male' | 'female';
  trained?: boolean;
  hiitRatio?: number;
}

export interface InterferenceV2Result {
  score: number;
  level: 'low' | 'mid' | 'high';
  advice: string;
  breakdown: { factor: string; points: number; note: string }[];
}

/**
 * Interference v2: Wilson/Huiberts/Petré/Robineau.
 * Шкала 0-10: <4 low, 4-6 mid, >6 high. Учитывает gap (same session +2.5), пол, тренированность.
 */
export function cardioInterferenceV2(input: InterferenceV2Input = {}): InterferenceV2Result {
  const breakdown: { factor: string; points: number; note: string }[] = [];
  let score = 0;
  const wOf = (m: string): number => {
    const k = String(m).toLowerCase();
    if (/бег|run/.test(k)) return 1.0;
    if (/hiit/.test(k)) return 0.6;
    if (/miss|zone2/.test(k)) return 0.5;
    if (/вело|cycl|bike/.test(k)) return 0.3;
    if (/греб|row/.test(k)) return 0.4;
    if (/эллипс|ellipt/.test(k)) return 0.35;
    if (/ходьб|walk/.test(k)) return 0.1;
    if (/плаван|swim/.test(k)) return 0.25;
    if (/recover/.test(k)) return 0.1;
    return 0.5;
  };
  const mods = Array.isArray(input.modality) ? input.modality : input.modality ? [input.modality] : [];
  const worst = mods.length > 0 ? Math.max(...mods.map(wOf)) : 0.5;
  const modPts = worst * 3;
  if (mods.length > 0) breakdown.push({ factor: 'modality', points: Math.round(modPts * 10) / 10, note: `${mods.join('+')} (worst ${worst})` });
  score += modPts;
  const freq = input.frequencyPerWeek ?? 3;
  let fp = freq <= 3 ? freq * 0.3 : freq <= 5 ? 0.9 + (freq - 3) * 0.8 : Math.min(3, 2.5 + (freq - 5));
  fp = Math.min(3, fp);
  breakdown.push({ factor: 'frequency', points: Math.round(fp * 10) / 10, note: `${freq}×/нед (Wilson r=−0.3)` });
  score += fp;
  const dur = input.avgDurationMin ?? 30;
  let dp = dur <= 30 ? dur / 60 : dur <= 45 ? 0.5 + (dur - 30) / 30 : dur <= 60 ? 1.0 + (dur - 45) / 30 : Math.min(2, 1.5 + (dur - 60) / 60);
  breakdown.push({ factor: 'duration', points: Math.round(dp * 10) / 10, note: `${dur} мин` });
  score += dp;
  const gap = input.gap ?? 'separate_day';
  const gapPts = gap === 'separate_day' ? 0 : gap === 'same_day_6h' ? 0.5 : gap === 'same_day_2h' ? 1.5 : 2.5;
  breakdown.push({ factor: 'gap', points: gapPts, note: `${gap} (Petré same session ES −0.66)` });
  score += gapPts;
  const legs = input.legDaysPerWeek ?? 2;
  const legPts = legs >= 4 ? 0.8 : legs >= 3 ? 0.4 : 0;
  breakdown.push({ factor: 'legs', points: legPts, note: `${legs}× ноги/нед` });
  score += legPts;
  const hiit = input.hiitRatio ?? 0;
  if (hiit > 0.5) {
    const hp = (hiit - 0.5) * 1.0;
    breakdown.push({ factor: 'hiit', points: Math.round(hp * 10) / 10, note: `${Math.round(hiit * 100)}% HIIT` });
    score += hp;
  }
  if (input.sex === 'female') {
    score *= 0.85;
    breakdown.push({ factor: 'sex', points: -0.5, note: 'Женщины −15% (Huiberts 2023: interference ~0)' });
  }
  if (input.trained === true) {
    // тренированные страдают сильнее при same session — уже учтено в gap; без штрафа
    breakdown.push({ factor: 'trained', points: 0, note: 'Тренированный: разделяйте сессии >2ч (Petré)' });
  } else if (input.trained === false) {
    score *= 0.9;
    breakdown.push({ factor: 'trained', points: -0.3, note: 'Новичок −10%: быстрее восстанавливается' });
  }
  score = Math.max(0, Math.min(10, Math.round(score * 10) / 10));
  const level: 'low' | 'mid' | 'high' = score < 4 ? 'low' : score <= 6 ? 'mid' : 'high';
  const advice = level === 'low'
    ? 'Совместимо: 2-3× вело/гребля в отдельные дни, ≥6ч от ног (Schumann 2022).'
    : level === 'mid'
      ? 'Умеренный риск: бег ≤3×, не перед ногами, кардио ПОСЛЕ силы, ≥6ч разрыв (Robineau).'
      : 'Высокий interference: снизьте бег/частоту, только вело после ног, отдельные дни.';
  return { score, level, advice, breakdown };
}
