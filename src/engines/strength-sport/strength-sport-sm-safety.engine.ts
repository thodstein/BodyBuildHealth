/**
 * strength-sport-sm-safety.engine.ts — БЕЗОПАСНОСТЬ СТРОНГМЕНА (SM PRO P1)
 *
 * Heazlewood/checks:
 *  heazlewoodCheck — согнутые руки на камне/шине/миксте DL + супинация → warn
 *  (distal biceps 11% травм, Winwood 2014; Lorenz IJSPT 2022: эксцентрик на супинации).
 *  axialMomentCheck — количественный момент вместо boolean: yoke 3-4×BW компрессия
 *  (McGill 2009), stone anterior moment (Harris 2018) → ok/warn/high + QL-рецепт.
 *  mixedGripCheck — mixed-grip тяга → hook/straps рекомендация.
 * Чистый движок.
 */

export interface SMBicepsCheckInput {
  eventId: string;
  armsBent?: boolean | null; // руки согнуты на камне/шине
  grip?: string | null; // mixed | hook | straps | overhand | neutral
  loadPct?: number | null; // % ПМ (≥90 — зона риска, Winwood 91%)
}

export interface SMBicepsCheckResult {
  risk: 'ok' | 'warn' | 'high';
  warnings: string[];
}

const BICEPS_EVENTS = ['atlas_stone', 'stone', 'tire_flip', 'sandbag', 'deadlift', 'axle_deadlift', 'car_deadlift', 'arm_over_arm'];

export function heazlewoodCheck(input: SMBicepsCheckInput): SMBicepsCheckResult {
  const warnings: string[] = [];
  const id = String(input.eventId || '').toLowerCase();
  const isRiskyEvent = BICEPS_EVENTS.some((t) => id.includes(t));
  const bent = input.armsBent === true;
  const mixed = String(input.grip || '').toLowerCase() === 'mixed';
  const heavy = input.loadPct != null && input.loadPct >= 90;
  if (isRiskyEvent && bent) {
    warnings.push('Руки согнуты на камне/шине — выпрями в канаты: сгибание = distal biceps avulsion (Heazlewood 11%).');
  }
  if (mixed && (id.includes('deadlift') || id.includes('axle'))) {
    warnings.push('Mixed-grip тяга — супинированная рука рвётся в экстензии: переходи на hook/straps (Lorenz IJSPT).');
  }
  if (heavy && (bent || mixed)) {
    warnings.push('Нагрузка ≥90% ПМ в зоне риска — 91% травм стронга именно там (Winwood): снизь до техники или добавь hammer 3×12.');
  }
  let risk: SMBicepsCheckResult['risk'] = 'ok';
  if (warnings.length >= 2) risk = 'high';
  else if (warnings.length === 1) risk = 'warn';
  return { risk, warnings };
}

export interface SMAxialCheckInput {
  yokeKg?: number | null;
  bodyweightKg?: number | null;
  carryMeters?: number | null; // суммарная дистанция carries недели, м
  stoneMomentNm?: number | null; // из stoneMoment()
  axialSets?: number | null; // осевых сетов в неделю
}

export interface SMAxialCheckResult {
  risk: 'ok' | 'warn' | 'high';
  ratioBW: number | null; // йок / BW
  text: string;
  recipe: string;
}

/** Количественный axial вместо boolean ≥12+300м: ratio + дистанция + момент. */
export function axialMomentCheck(input: SMAxialCheckInput): SMAxialCheckResult {
  const yoke = input.yokeKg ?? null;
  const bw = input.bodyweightKg ?? null;
  const ratioBW = yoke != null && bw != null && bw > 0 ? Math.round((yoke / bw) * 100) / 100 : null;
  const meters = input.carryMeters ?? 0;
  const sets = input.axialSets ?? 0;
  const moment = input.stoneMomentNm ?? 0;
  let risk: SMAxialCheckResult['risk'] = 'ok';
  // McGill: йок 3-4×BW — max компрессия; Harris: stone moment >350 high
  if ((ratioBW != null && ratioBW >= 3) || moment > 350 || (sets >= 18 && meters >= 300)) risk = 'high';
  else if ((ratioBW != null && ratioBW >= 2) || moment > 250 || (sets >= 12 && meters >= 300) || (sets >= 12 && (meters as number) >= 200)) risk = 'warn';
  const text =
    risk === 'high'
      ? `Axial HIGH: йок ${ratioBW ?? '—'}×BW / carries ${meters}м / сеты ${sets} / stone ${moment}Н·м — компрессия McGill max`
      : risk === 'warn'
        ? `Axial WARN: йок ${ratioBW ?? '—'}×BW / carries ${meters}м / сеты ${sets} / stone ${moment}Н·м`
        : `Axial OK: йок ${ratioBW ?? '—'}×BW / carries ${meters}м / сеты ${sets}`;
  const recipe = risk === 'ok' ? 'QL-профилактика: suitcase 2×20м' : 'QL suitcase 2×20м + side plank 2×30с + hammer 3×12 + plank (McGill/Hindle)';
  return { risk, ratioBW, text, recipe };
}

export function mixedGripCheck(grip: string | null | undefined, eventId: string): string | null {
  if (String(grip || '').toLowerCase() !== 'mixed') return null;
  if (!/deadlift|axle/.test(String(eventId).toLowerCase())) return null;
  return 'Mixed-grip на тяге: супинированная рука — зона разрыва; используй hook/straps, warm-up — double-overhand.';
}
