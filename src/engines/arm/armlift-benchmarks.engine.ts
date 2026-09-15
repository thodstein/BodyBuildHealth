/**
 * armlift-benchmarks.engine.ts — уровни тест-батареи хвата (PRO-5 D10 E1).
 * Пороги из синтеза: PoinT GO 2026 (pinch 2×10кг: <10/<25/<45с; вис/холды),
 * pinch-прогрессия (60с → следующий вес), CoC-лестница IronMind.
 * Итог — по слабейшему тесту (философия слабого звена). Чистые функции.
 */

export type ArmliftTestLevel = 'beginner' | 'intermediate' | 'advanced' | 'elite';

export const ARMLIFT_LEVEL_RU: Record<ArmliftTestLevel, string> = {
  beginner: 'Начальный',
  intermediate: 'Средний',
  advanced: 'Продвинутый',
  elite: 'Элита',
};

const ORDER: ArmliftTestLevel[] = ['beginner', 'intermediate', 'advanced', 'elite'];

/** Pinch-hold (с): PoinT GO 2×10кг <10 / 10–25 / 25–45 / 45+. */
export function benchmarkPinchHold(sec: number | null | undefined): ArmliftTestLevel | null {
  if (sec == null || !Number.isFinite(sec) || sec <= 0) return null;
  if (sec < 10) return 'beginner';
  if (sec < 25) return 'intermediate';
  if (sec < 45) return 'advanced';
  return 'elite';
}

/** Farmer/support-hold (с): <15 / 15–30 / 30–45 / 45+ (шкала хаба, не федерация). */
export function benchmarkFarmerHold(sec: number | null | undefined): ArmliftTestLevel | null {
  if (sec == null || !Number.isFinite(sec) || sec <= 0) return null;
  if (sec < 15) return 'beginner';
  if (sec < 30) return 'intermediate';
  if (sec < 45) return 'advanced';
  return 'elite';
}

/** CoC-уровень (0–4): <1 / 1–1.5 / 2–2.5 / 3+ (ступени IronMind). */
export function benchmarkCoc(level: number | null | undefined): ArmliftTestLevel | null {
  if (level == null || !Number.isFinite(level) || level < 0) return null;
  if (level < 1) return 'beginner';
  if (level < 2) return 'intermediate';
  if (level < 3) return 'advanced';
  return 'elite';
}

/** Silver-hold (с): та же холд-лесенка, гриппер — контекстом. */
export function benchmarkSilverHold(sec: number | null | undefined): ArmliftTestLevel | null {
  return benchmarkFarmerHold(sec);
}

/** Итог — слабейший из заполненных (нет данных — null, честно). */
export function overallGripLevel(levels: Array<ArmliftTestLevel | null>): ArmliftTestLevel | null {
  const filled = levels.filter((l): l is ArmliftTestLevel => l != null);
  if (!filled.length) return null;
  let worst: ArmliftTestLevel = 'elite';
  for (const l of filled) {
    if (ORDER.indexOf(l) < ORDER.indexOf(worst)) worst = l;
  }
  return worst;
}
