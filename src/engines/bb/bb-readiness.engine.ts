/**
 * bb-readiness.engine.ts — P2 PRO-2: готовность дня (светофор).
 * Чистый движок: сон + боль + падение скорости + перегруженные мышцы → зелёный/жёлтый/красный.
 * Скрининг, не диагноз: красный — техника/сон/разгрузка, а не запрет тренироваться.
 */

export type BbReadinessLevel = 'green' | 'yellow' | 'red';

export interface BbReadinessInput {
  sleepHours?: number | null;
  pain010?: number | null; // 0–10, 0 = нет боли
  vbtLossPct?: number | null;
  dangerMuscles?: number; // число мышц в опасной зоне нагрузки
}

export interface BbReadiness {
  level: BbReadinessLevel;
  reasons: string[];
  advice: string;
}

export function assessBbReadiness(input: BbReadinessInput): BbReadiness {
  const reasons: string[] = [];
  let score = 0; // 0 green → выше хуже
  const sleep = Number(input.sleepHours);
  if (Number.isFinite(sleep) && sleep > 0) {
    if (sleep < 5.5) { score += 3; reasons.push(`Сон ${sleep} ч — мало (норма 7–9)`); }
    else if (sleep < 6.5) { score += 1; reasons.push(`Сон ${sleep} ч — на нижней границе`); }
  }
  const pain = Number(input.pain010);
  if (Number.isFinite(pain) && pain > 0) {
    if (pain >= 7) { score += 3; reasons.push(`Боль ${pain}/10 — сильная, только лёгкая техника`); }
    else if (pain >= 4) { score += 1; reasons.push(`Боль ${pain}/10 — умеренная, без отказа`); }
  }
  const loss = Number(input.vbtLossPct);
  if (Number.isFinite(loss)) {
    if (loss > 30) { score += 2; reasons.push(`Скорость −${loss}% — недовосстановление`); }
    else if (loss > 25) { score += 1; reasons.push(`Скорость −${loss}% — на грани`); }
  }
  const danger = Math.max(0, Math.round(Number(input.dangerMuscles) || 0));
  if (danger >= 2) { score += 3; reasons.push(`Перегруженных мышц: ${danger} — объём вниз`); }
  else if (danger >= 1) { score += 1; reasons.push('1 мышца перегружена — ей разгрузка'); }

  if (score >= 3) {
    return {
      level: 'red',
      reasons,
      advice: 'Красный: сегодня техника и сон, объём −25%, отказ запрещён',
    };
  }
  if (score >= 1) {
    return {
      level: 'yellow',
      reasons,
      advice: 'Жёлтый: можно тренироваться, но без отказа и без добавок объёма',
    };
  }
  return { level: 'green', reasons, advice: 'Зелёный: можно по плану, включая добивки' };
}
