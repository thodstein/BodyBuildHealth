/**
 * strength-sport-strongman-attempts.engine.ts — план попыток для стронг-ивентов.
 * Max: лог/аксель 85/92/98-102%; Reps: 60с AMRAP; Medley: дистанция+время; Ladder: камни 5 ступеней.
 */

export type SMStrategy = 'conservative' | 'balanced' | 'aggressive';

export const SM_STRATEGY_PCT: Record<SMStrategy, { opener: number; second: number; third: number }> = {
  conservative: { opener: 0.85, second: 0.92, third: 0.98 },
  balanced: { opener: 0.88, second: 0.95, third: 1.00 },
  aggressive: { opener: 0.90, second: 0.97, third: 1.02 },
};

export interface SMAttemptSet {
  opener: number;
  second: number;
  third: number;
  target: number;
}

export function smAttemptsFor(pm: number, strategy: SMStrategy = 'balanced', stepKg = 2.5): SMAttemptSet {
  const round = (v: number) => Math.round(v / stepKg) * stepKg;
  const pct = SM_STRATEGY_PCT[strategy] || SM_STRATEGY_PCT.balanced;
  return {
    opener: round(pm * pct.opener),
    second: round(pm * pct.second),
    third: round(pm * pct.third),
    target: round(pm * pct.third),
  };
}

export const SM_EVENT_STEP: Record<string, number> = {
  log_press: 2.5, axle_press: 2.5, viking_press: 5, circus_db_press: 2.5, circus_db_medley: 2.5, axle_deadlift: 5, deadlift: 5, car_deadlift_18: 10, car_deadlift_side: 10, deadlift_max: 5,
  yoke_walk: 10, frame_carry: 10, husafell_carry: 5, conan_wheel: 5, shield_carry: 5, farmers_walk_heavy: 5, atlas_stone_load: 5, atlas_stone_over_bar: 5, natural_stone_shoulder: 5, stone_lift: 5, sandbag_load: 5, sandbag_over_bar: 5, keg_toss: 2, keg_over_bar: 2, keg_load: 2, sandbag_toss: 2, sandbag_carry: 5, truck_pull: 10, arm_over_arm: 5, duck_walk: 5,
};

export const SM_EVENT_LABEL: Record<string, string> = {
  log_press: 'Лог-пресс', axle_press: 'Аксель-пресс', viking_press: 'Викинг', circus_db_medley: 'Гантели-лестница', yoke_walk: 'Йок', frame_carry: 'Рама', husafell_carry: 'Хусафелл', conan_wheel: 'Колесо Конана', shield_carry: 'Щит', duck_walk: 'Утка', farmers_walk_heavy: 'Фермер', atlas_stone_load: 'Атлас-камень', atlas_stone_over_bar: 'Камень через планку', natural_stone_shoulder: 'Натуральный камень', sandbag_load: 'Мешок загрузка', sandbag_over_bar: 'Мешок через планку', sandbag_carry: 'Мешок переноска', keg_toss: 'Бочка бросок', keg_over_bar: 'Бочка через планку', axle_deadlift: 'Аксель-тяга', car_deadlift_18: 'Автодедлифт', car_deadlift_side: 'Автодедлифт боковой', truck_pull: 'Тяга грузовика', arm_over_arm: 'Канат', deadlift_max: 'Тяга макс',
};

export interface SMEventPlan {
  event: string;
  attempts: SMAttemptSet;
  warmup: { pct: number; weight: number; reps?: number; distanceM?: number; timeCapS?: number }[];
  strategy: SMStrategy;
  medley?: { events: string[]; totalTimeS: number; timeCapS: number; transitionsS: number };
  ladder?: { weights: number[]; platformHeights?: number[] };
}

export function buildSMEventPlan(
  eventId: string,
  pm: number,
  strategy: SMStrategy = 'balanced',
): SMEventPlan | null {
  if (!Number.isFinite(pm) || pm <= 0) return null;
  const step = SM_EVENT_STEP[eventId] || 2.5;
  const attempts = smAttemptsFor(pm, strategy, step);
  const isCarry = ['yoke_walk','frame_carry','husafell_carry','farmers_walk_heavy','sandbag_carry','zercher_carry','conan_wheel','shield_carry','duck_walk','truck_pull','arm_over_arm','sled_drag','sled_push'].includes(eventId);
  const isStone = ['atlas_stone_load','atlas_stone_over_bar','natural_stone_shoulder','stone_lift','sandbag_load','sandbag_over_bar','keg_over_bar','keg_load'].includes(eventId);
  const isReps = ['keg_toss','sandbag_toss','tire_flip','car_deadlift_18','car_deadlift_side','viking_press'].includes(eventId);
  const warmupPct = [0.50, 0.65, 0.75, 0.85];
  const warmup = warmupPct.map(p => ({
    pct: p,
    weight: isReps && p >= 0.85 ? 0 : Math.round(pm * p / step) * step,
    reps: isCarry ? 1 : isReps ? (p >= 0.85 ? 3 : 5) : p < 0.65 ? 3 : p < 0.80 ? 2 : 1,
    distanceM: isCarry ? (p >= 0.85 ? 10 : 20) : undefined,
    timeCapS: isCarry ? 60 : isReps ? 60 : undefined,
  }));
  // для камней — ladder по умолчанию
  if (isStone) {
    const ladder = buildStoneLadder(pm, 5, step);
    return { event: eventId, attempts, warmup, strategy, ladder: { weights: ladder } };
  }
  return { event: eventId, attempts, warmup, strategy };
}

export function buildStoneLadder(pm: number, count = 5, step = 5): number[] {
  const pcts = [0.70, 0.78, 0.85, 0.92, 1.00].slice(0, count);
  return pcts.map(p => Math.round(pm * p / step) * step);
}

export interface MedleyPlan {
  events: { id: string; weight: number; distanceM: number; timeCapS: number }[];
  totalTimeS: number;
  timeCapS: number;
  strategy: SMStrategy;
}
export function buildMedleyPlan(events: { id: string; pm: number; distanceM?: number }[], strategy: SMStrategy = 'balanced'): MedleyPlan | null {
  if (!events.length) return null;
  const mapped = events.map(e => {
    const metaStep = SM_EVENT_STEP[e.id] || 5;
    const base = e.pm;
    // для medley берём 85-95% от ПМ (не max)
    const pct = strategy === 'conservative' ? 0.85 : strategy === 'aggressive' ? 0.95 : 0.90;
    const w = Math.round(base * pct / metaStep) * metaStep;
    const dist = e.distanceM ?? (e.id.includes('yoke') ? 20 : e.id.includes('farmers') ? 40 : e.id.includes('conan') ? 30 : e.id.includes('truck') ? 20 : 20);
    const cap = e.id.includes('yoke') ? 60 : e.id.includes('farmers') ? 75 : e.id.includes('truck') ? 90 : e.id.includes('conan') ? 90 : 60;
    return { id: e.id, weight: w, distanceM: dist, timeCapS: cap };
  });
  const transitionsS = (mapped.length - 1) * 5;
  // оценка времени: yoke 20м ~12с, farmers 40м ~28с, sled 25м ~15с, conan 30м ~25с, truck 20м ~35с
  const timeMap: Record<string, number> = { yoke_walk: 12, frame_carry: 12, husafell_carry: 18, conan_wheel: 25, shield_carry: 12, farmers_walk_heavy: 28, sled_push_sprint: 15, sled_push: 15, tire_flip: 20, sandbag_carry: 20, truck_pull: 35, arm_over_arm: 20, duck_walk: 14 };
  const totalTimeS = mapped.reduce((a,e)=> a + (timeMap[e.id] ?? 15), 0) + transitionsS;
  const timeCapS = mapped.reduce((a,e)=> a + e.timeCapS, 0) - 10; // запас 10с
  return { events: mapped, totalTimeS, timeCapS: Math.max(totalTimeS+20, timeCapS), strategy };
}

// ——— Points Engine PRO — очки за ивент, не тотал ———
export interface SMPointsRow { event: string; place: number; points: number; timeOrReps?: string }
export interface SMPointsResult { rows: SMPointsRow[]; totalPoints: number; averagePlace: number }

export function buildStrongmanPoints(rows: SMPointsRow[]): SMPointsResult {
  const totalPoints = rows.reduce((a,r)=> a + r.points, 0);
  const averagePlace = rows.length ? Math.round((rows.reduce((a,r)=> a + r.place, 0)/rows.length)*10)/10 : 0;
  return { rows, totalPoints, averagePlace };
}
export function pointsForPlace(place: number, athletes = 10): number {
  // классика стронгмена: 1st = N points, last =1
  if (place <=0) return 0;
  return Math.max(1, athletes - place + 1);
}
export function strategyToRpe(strategy: SMStrategy): string {
  return strategy === 'conservative' ? 'RPE7' : strategy === 'aggressive' ? 'RPE9.5' : 'RPE8.5';
}

export function smEventRationale(plan: SMEventPlan | null): string[] {
  if (!plan) return ['Нет данных для ивента'];
  const label = SM_EVENT_LABEL[plan.event] || plan.event;
  const lines: string[] = [
    `${label} ${plan.strategy} ${SM_STRATEGY_PCT[plan.strategy].opener * 100}/${SM_STRATEGY_PCT[plan.strategy].second * 100}/${SM_STRATEGY_PCT[plan.strategy].third * 100}% — шаг ${SM_EVENT_STEP[plan.event] || 2.5}кг`,
    `Попытки: ${plan.attempts.opener} / ${plan.attempts.second} / ${plan.attempts.third} кг`,
    `Разминка: ${plan.warmup.map(w => `${w.weight}кг${(w as any).distanceM ? ` ${ (w as any).distanceM}м` : `×${w.reps}`}`).join(' → ')}`,
  ];
  if (plan.ladder) lines.push(`Лестница камней: ${plan.ladder.weights.join(' → ')} кг`);
  if (plan.medley) lines.push(`Medley: ${plan.medley.events.join(' → ')} · ${plan.medley.totalTimeS}с / cap ${plan.medley.timeCapS}с`);
  return lines;
}
export function medleyRationale(m: MedleyPlan | null): string[] {
  if (!m) return ['Нет medley'];
  return [
    `Medley ${m.strategy}: ${m.events.map(e=> `${SM_EVENT_LABEL[e.id]||e.id} ${e.weight}кг ${e.distanceM}м`).join(' → ')}`,
    `Оценка ${m.totalTimeS}с / cap ${m.timeCapS}с · переходы 5с · запас ${m.timeCapS - m.totalTimeS}с`,
  ];
}
export function stoneLadderRationale(weights: number[]): string[] {
  return [`Лестница: ${weights.join(' → ')} кг · платформы 120→160см · тактика: слабые — скорость, тяжёлые — lap 2с`];
}
