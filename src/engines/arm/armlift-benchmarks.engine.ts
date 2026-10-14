/**
 * armlift-benchmarks.engine.ts — уровни тест-батареи хвата (PRO-5 D10 E1) +
 * канон порогов холдов (аудит 2026-10).
 *
 * ЕДИНЫЙ ИСТОЧНИК ПОРОГОВ. До аудита одно и то же число жило в трёх файлах с
 * разными значениями: «слабый farmer» был <20 в diagnosis, <15 в cause и <15 в
 * бенчмарке — один замер давал три разных диагноза. Теперь все читают отсюда.
 *
 * Пороги из синтеза: PoinT GO 2026 (pinch 2×10кг), pinch-прогрессия (60с →
 * следующий вес), CoC-лестница IronMind. Итог — по слабейшему тесту
 * (философия слабого звена). Чистые функции.
 */

/**
 * Семантика «слабое звено» (отличие от бенчмарк-лестницы уровня, которая грубее):
 *  - < WEAK = проблема этого качества (пик силы / выносливость);
 *  - WEAK..MID = «середина»: держит, но плывёт.
 */
export const PINCH_WEAK_SEC = 10;
export const PINCH_MID_SEC = 20;
export const FARMER_WEAK_SEC = 15;
export const FARMER_MID_SEC = 30;
export const COC_WEAK_LEVEL = 2;
export const SILVER_WEAK_SEC = 20;
export const SILVER_MID_SEC = 45;
/** Порог межручной асимметрии: 15% — клинический (Mathiowetz-практика). */
export const ASYM_WEAK_PCT = 15;
/** Ниже 10% асимметрия — фон, evidence о слабой руке не пишем. */
export const ASYM_EVIDENCE_PCT = 10;

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

/**
 * D19: протокол выполнения теста (сравнимость замеров).
 * Свежим, лучший из 3 попыток — иначе динамика врёт.
 */
export function testProtocolFor(test: string): string {
  switch (String(test || '')) {
    case 'Pinch-hold':
      return 'Свежим, 3 попытки, лучший; гладкие стороны наружу, мел';
    case 'Farmer-hold':
      return 'Свежим, DOH без лямок, лучший из 3';
    case 'CoC':
      return 'Разминка легче, по 3 попытки каждой рукой, лучший';
    case 'Silver':
      return 'Новый гриппер, вертикаль, лучший из 3';
    default:
      return 'Свежим, лучший из 3 попыток';
  }
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
