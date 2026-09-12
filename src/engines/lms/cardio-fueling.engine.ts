/**
 * cardio-fueling.engine.ts — фьюлинг длинных + акклиматизация (P7 PRO-2).
 * Дозы из hydrationAdvice-канона (500–750 мл/ч, Na 500–700 мг/л,
 * угли 30–60 г/ч >90'), но в граммах на сессию, а не строкой.
 * Чистые функции, без IO.
 */

export interface FuelingPlan {
  waterMlPerHour: number;
  sodiumMgPerHour: number;
  carbsGPerHour: number;
  /** Суммы на сессию (округлены). */
  waterMlTotal: number;
  sodiumMgTotal: number;
  carbsGTotal: number;
  note: string;
}

/**
 * Фьюлинг сессии. <60' — вода по жажде (нули честно);
 * 60–90' — вода; >90' — вода + Na + угли.
 * Кап углей 60 г/ч (кишечный потолок без тренированного gut-train).
 */
export function fuelingForSession(durationMin: number, tempC?: number): FuelingPlan {
  const dur = Math.max(0, Math.round(durationMin));
  const hot = tempC != null && tempC >= 25;
  if (dur < 60) {
    return {
      waterMlPerHour: 0, sodiumMgPerHour: 0, carbsGPerHour: 0,
      waterMlTotal: 0, sodiumMgTotal: 0, carbsGTotal: 0,
      note: 'До 60′: вода по жажде; электролиты и угли не обязательны.',
    };
  }
  const hours = dur / 60;
  const waterMlPerHour = hot ? 750 : 600;
  if (dur <= 90) {
    return {
      waterMlPerHour, sodiumMgPerHour: 0, carbsGPerHour: 0,
      waterMlTotal: Math.round(waterMlPerHour * hours),
      sodiumMgTotal: 0, carbsGTotal: 0,
      note: `60–90′: ${waterMlPerHour} мл/ч${hot ? ' (жара — пить раньше жажды)' : ''}.`,
    };
  }
  const sodiumMgPerHour = 600;
  const carbsGPerHour = 45;
  return {
    waterMlPerHour, sodiumMgPerHour, carbsGPerHour,
    waterMlTotal: Math.round(waterMlPerHour * hours),
    sodiumMgTotal: Math.round(sodiumMgPerHour * hours),
    carbsGTotal: Math.round(carbsGPerHour * hours),
    note: `>90′: ${waterMlPerHour} мл/ч + Na ${sodiumMgPerHour} мг/л-эквив + угли ${carbsGPerHour} г/ч (всего: ${Math.round(waterMlPerHour * hours)} мл / ${Math.round(sodiumMgPerHour * hours)} мг Na / ${Math.round(carbsGPerHour * hours)} г углей).`,
  };
}

export interface AcclimationDay {
  day: number;
  mode: 'z2_short' | 'z2_build' | 'full';
  note: string;
}

/**
 * Акклиматизация к жаре (≥28°C): 10–14 дней постепенного набора.
 * Дни 1–4: только Z2 ≤60 мин; 5–10: +10%/день; HIIT только после дня 10.
 * <28°C → null (не нужна). Возвращает лесенку дней.
 */
export function heatAcclimationPlan(tempC?: number): AcclimationDay[] | null {
  if (tempC == null || !Number.isFinite(tempC) || tempC < 28) return null;
  const days: AcclimationDay[] = [];
  for (let d = 1; d <= 12; d++) {
    if (d <= 4) days.push({ day: d, mode: 'z2_short', note: `День ${d}: только Z2 ≤60 мин (жара ${tempC}°C — втягивание).` });
    else if (d <= 10) days.push({ day: d, mode: 'z2_build', note: `День ${d}: Z2 +10%/день к объёму, HIIT запрещён.` });
    else days.push({ day: d, mode: 'full', note: `День ${d}: полный план, HIIT разрешён при самочувствии.` });
  }
  return days;
}

/** Нота для высоты >1000м (первые дни — только Z2/recovery). */
export function altitudeNote(altitudeM?: number): string | null {
  if (altitudeM == null || !Number.isFinite(altitudeM) || altitudeM <= 1000) return null;
  return `Высота ${Math.round(altitudeM)} м: первые 3–5 дней только Z2/recovery, HIIT запрещён (гипоксия).`;
}
