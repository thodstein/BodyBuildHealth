/**
 * bb-readiness.engine.ts — P2 PRO-2: готовность дня (светофор).
 * Чистый движок: сон + боль + падение скорости + перегруженные мышцы → зелёный/жёлтый/красный.
 * Скрининг, не диагноз: красный — техника/сон/разгрузка, а не запрет тренироваться.
 *
 * AUDIT Oct 11 2026: «нет данных» больше не выдаётся за «зелёный». При отсутствии всех
 * метрик уровень — жёлтый (не красный: резать вставку без оснований нельзя) с прямой
 * пометкой `noData`, и только реально измеренный чистый день остаётся зелёным.
 */

export type BbReadinessLevel = 'green' | 'yellow' | 'red';

export interface BbReadinessInput {
  sleepHours?: number | null;
  pain010?: number | null; // 0–10, 0 = нет боли (это ДАННЫЕ, а не отсутствие)
  vbtLossPct?: number | null;
  dangerMuscles?: number | null; // null = замеров нагрузки нет (не «0 перегруженных»)
}

export interface BbReadiness {
  level: BbReadinessLevel;
  reasons: string[];
  advice: string;
  /** false — ни одной метрики не введено: уровень дефолтный, а не измеренный. */
  tested: boolean;
  /** true — то же, что `!tested` (удобочитаемый флаг для UI/моста). */
  noData?: boolean;
}

export function assessBbReadiness(input: BbReadinessInput): BbReadiness {
  const reasons: string[] = [];
  let score = 0; // 0 green → выше хуже
  const num = (v: unknown): number | null => {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const sleep = num(input.sleepHours);
  const pain = num(input.pain010);
  const loss = num(input.vbtLossPct);
  const danger = num(input.dangerMuscles);
  // Что из этого реально измерено: null/undefined ≠ 0.
  const tested = (sleep != null && sleep > 0)
    || (pain != null && pain >= 0)
    || (loss != null)
    || (danger != null && danger > 0);

  if (sleep != null && sleep > 0) {
    if (sleep < 5.5) { score += 3; reasons.push(`Сон ${sleep} ч — мало (норма 7–9)`); }
    else if (sleep < 6.5) { score += 1; reasons.push(`Сон ${sleep} ч — на нижней границе`); }
  }
  if (pain != null && pain > 0) {
    if (pain >= 7) { score += 3; reasons.push(`Боль ${pain}/10 — сильная, только лёгкая техника`); }
    else if (pain >= 4) { score += 1; reasons.push(`Боль ${pain}/10 — умеренная, без отказа`); }
  }
  if (loss != null) {
    if (loss > 30) { score += 2; reasons.push(`Скорость −${loss}% — недовосстановление`); }
    else if (loss > 25) { score += 1; reasons.push(`Скорость −${loss}% — на грани`); }
  }
  if (danger != null && danger > 0) {
    if (danger >= 2) { score += 3; reasons.push(`Перегруженных мышц: ${danger} — объём вниз`); }
    else if (danger >= 1) { score += 1; reasons.push('1 мышца перегружена — ей разгрузка'); }
  }

  // Нет данных ≠ «всё хорошо»: жёлтый с честной пометкой. Красный был бы ложным
  // запретом, зелёный — ложным разрешением.
  if (!tested) {
    return {
      level: 'yellow',
      reasons: ['Свои метрики восстановления не введены'],
      advice: 'Жёлтый по умолчанию: сон — в профиле, боль — в суставах/ортопедии, скорость — в Анализе силы. Без метрик объём не двигаем',
      tested: false,
      noData: true,
    };
  }
  if (score >= 3) {
    return {
      level: 'red',
      reasons,
      advice: 'Красный: сегодня техника и сон, объём −25%, отказ запрещён',
      tested: true,
    };
  }
  if (score >= 1) {
    return {
      level: 'yellow',
      reasons,
      advice: 'Жёлтый: можно тренироваться, но без отказа и без добавок объёма',
      tested: true,
    };
  }
  return { level: 'green', reasons, advice: 'Зелёный: можно по плану, включая добивки', tested: true };
}
