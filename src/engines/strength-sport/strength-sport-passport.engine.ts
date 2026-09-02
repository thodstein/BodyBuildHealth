/**
 * strength-sport-passport.engine.ts — паспорт имплемента стронга (валидация PRO)
 *
 * Проверяет вес/дистанцию/время/высоту/разворот/tacky по EVENT_META.
 * Источник: Forge 2026 log diameters, Winwood stepKg, EVENT_META defaults.
 */

import { EVENT_META } from './strength-sport-event-types';

export interface PassportInput {
  weight?: number;
  distanceM?: number;
  timeCapS?: number;
  heightCm?: number;
  turn?: boolean;
  tacky?: boolean;
  diameterCm?: number;
  implementWeight?: number; // вес пустого снаряда
}

export interface PassportResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

const WEIGHT_RANGES: Record<string, [number, number]> = {
  yoke_walk: [100, 600],
  farmers_walk_heavy: [40, 250],
  frame_carry: [80, 400],
  husafell_carry: [40, 200],
  log_press: [40, 220],
  axle_press: [40, 200],
  viking_press: [40, 250],
  atlas_stone_load: [50, 250],
  atlas_stone_over_bar: [50, 250],
  natural_stone_shoulder: [40, 200],
  sandbag_load: [30, 200],
  keg_over_bar: [20, 150],
  truck_pull: [1000, 20000],
  sled_push_sprint: [20, 150],
  car_deadlift_18: [80, 400],
  deadlift_max: [60, 500],
};

const HEIGHT_RANGE: [number, number] = [90, 180];
const DIST_RANGE: [number, number] = [5, 100];
const TIME_RANGE: [number, number] = [20, 180];

export function validatePassport(eventId: string, input: PassportInput): PassportResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const meta = (EVENT_META as any)[eventId] as { stepKg?: number; defaultDistanceM?: number; defaultTimeCapS?: number } | undefined;

  if (input.weight != null) {
    if (!Number.isFinite(input.weight) || input.weight <= 0) errors.push(`${eventId}: вес ≤0`);
    else {
      const range = WEIGHT_RANGES[eventId];
      if (range) {
        const [lo, hi] = range;
        if (input.weight < lo) warnings.push(`${eventId}: вес ${input.weight}кг < ${lo}кг — легко для уровня`);
        if (input.weight > hi) warnings.push(`${eventId}: вес ${input.weight}кг > ${hi}кг — выше элиты`);
      }
      if (meta?.stepKg && input.weight % meta.stepKg !== 0) warnings.push(`${eventId}: вес ${input.weight} не кратен шагу ${meta.stepKg}кг`);
    }
  }

  if (input.distanceM != null) {
    if (!Number.isFinite(input.distanceM) || input.distanceM <= 0) errors.push(`${eventId}: дистанция ≤0`);
    else if (input.distanceM < DIST_RANGE[0] || input.distanceM > DIST_RANGE[1]) warnings.push(`${eventId}: дистанция ${input.distanceM}м вне ${DIST_RANGE[0]}-${DIST_RANGE[1]}м`);
  }
  if (input.timeCapS != null) {
    if (!Number.isFinite(input.timeCapS) || input.timeCapS <= 0) errors.push(`${eventId}: timeCap ≤0`);
    else if (input.timeCapS < TIME_RANGE[0] || input.timeCapS > TIME_RANGE[1]) warnings.push(`${eventId}: timeCap ${input.timeCapS}с вне ${TIME_RANGE[0]}-${TIME_RANGE[1]}с`);
  }
  if (input.heightCm != null) {
    if (!Number.isFinite(input.heightCm) || input.heightCm <= 0) errors.push(`${eventId}: высота ≤0`);
    else if (input.heightCm < HEIGHT_RANGE[0] || input.heightCm > HEIGHT_RANGE[1]) warnings.push(`${eventId}: платформа ${input.heightCm}см вне ${HEIGHT_RANGE[0]}-${HEIGHT_RANGE[1]}см`);
    if (['atlas_stone_load','atlas_stone_over_bar','sandbag_over_bar','keg_over_bar'].includes(eventId) && input.heightCm < 110) warnings.push(`${eventId}: низкая платформа ${input.heightCm}см — ниже груди 190см атлета`);
  }
  if (input.implementWeight != null) {
    if (!Number.isFinite(input.implementWeight) || input.implementWeight <= 0) errors.push(`пустой вес ≤0`);
    else if (input.implementWeight > 120) warnings.push(`пустой снаряд ${input.implementWeight}кг — проверь (лог 50-110lb)`);
  }
  if (input.tacky === false && ['atlas_stone_load','atlas_stone_over_bar','natural_stone_shoulder','stone_lift'].includes(eventId)) {
    warnings.push(`${eventId}: без tacky — риск сгибания рук + бицепс tear`);
  }
  if (input.diameterCm != null && eventId === 'log_press') {
    if (input.diameterCm < 25 || input.diameterCm > 35) warnings.push(`лог диаметр ${input.diameterCm}см вне 25-35см`);
  }

  return { ok: errors.length === 0, errors, warnings };
}

export function validateContestPassports(contest: { events: Array<{ id: string; weight?: number; distanceM?: number; timeCapS?: number; heightCm?: number; turn?: boolean }> }): PassportResult {
  const allErr: string[] = [];
  const allWarn: string[] = [];
  for (const ev of contest.events || []) {
    const r = validatePassport(ev.id, { weight: ev.weight, distanceM: ev.distanceM, timeCapS: ev.timeCapS, heightCm: ev.heightCm, turn: ev.turn });
    allErr.push(...r.errors);
    allWarn.push(...r.warnings);
  }
  return { ok: allErr.length === 0, errors: allErr, warnings: allWarn };
}
