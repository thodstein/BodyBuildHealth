/**
 * cardio-race-predictor.engine.ts — предиктор результата + гоночный чек-лист (P6 PRO-2).
 * Riegel (1977/1981): T2 = T1 × (D2/D1)^1.06 — прогноз, не обещание.
 * Чистые функции, без IO.
 */

export interface RacePrediction {
  distKm: number;
  label: string;
  timeSec: number;
  timeStr: string;
}

function fmtTime(totalSec: number): string {
  const s = Math.max(1, Math.round(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(sec).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}

/**
 * Прогноз времён по известному результату (Riegel ^1.06).
 * Возвращает null при некорректном входе. Монотонность гарантирована
 * (дистанция больше → время больше).
 */
export function predictRaceTimes(knownDistKm: number, knownTimeSec: number): RacePrediction[] | null {
  if (!Number.isFinite(knownDistKm) || !Number.isFinite(knownTimeSec)) return null;
  if (knownDistKm < 0.5 || knownDistKm > 200 || knownTimeSec < 30 || knownTimeSec > 24 * 3600) return null;
  const targets: { distKm: number; label: string }[] = [
    { distKm: 5, label: '5 км' },
    { distKm: 10, label: '10 км' },
    { distKm: 21.0975, label: 'Полумарафон' },
    { distKm: 42.195, label: 'Марафон' },
  ];
  return targets.map(t => {
    const timeSec = knownTimeSec * Math.pow(t.distKm / knownDistKm, 1.06);
    return { distKm: t.distKm, label: t.label, timeSec, timeStr: fmtTime(timeSec) };
  });
}

export function predictorNote(): string {
  return 'Прогноз по Riegel (T2=T1×(D2/D1)^1.06) — ориентир для пейсинга, не обещание: жара/рельеф/самочувствие сдвигают результат.';
}

/** Гоночная неделя: 5 пунктов (Bosquet-канон + гигиена). */
export const RACE_WEEK_CHECKLIST: string[] = [
  '😴 Сон 8 ч — недосып съедает taper-эффект.',
  '🚫 Без нового за 48–72 ч: ни обуви, ни геля, ни упражнений.',
  '🍝 Привычное питание и гидратация 500–750 мл/ч — без экспериментов.',
  '🏃 Shakeout 15–20 мин легко за 1–2 дня до старта.',
  '📉 Объём −41…−60%, интенсивность та же (Bosquet 2007).',
];

/** Короткая строка чек-листа для ICS-описаний taper-сессий. */
export function raceChecklistIcsLine(): string {
  return 'Чек-лист гоночной недели: сон 8ч, без нового 48–72ч, привычное питание/гидратация, shakeout 15–20 мин.';
}
