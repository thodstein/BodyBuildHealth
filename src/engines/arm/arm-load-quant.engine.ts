/**
 * arm-load-quant.engine.ts — количественная нагрузка (эпик F PRO-плана).
 *
 * Проблемы: workMax по умолчанию 30 кг «с потолка», нет e1RM-гардов для
 * мелких групп, VBT-зоны живут отдельно, radial/fingers недогружены
 * (Praxis топ-3: flexion + pronation + RADIAL; GripStrength: finger control).
 */

/** Осторожный e1RM Эпли с гардом 1–12 повт (ядро arm-progression.epley1RM — без гарда, не дублируем имя). */
export function armEpley1RM(weightKg: number, reps: number): number | null {
  const w = Number(weightKg);
  const r = Number(reps);
  if (!Number.isFinite(w) || !Number.isFinite(r) || w <= 0 || r < 1 || r > 12) return null;
  return Math.round(w * (1 + r / 30) * 2) / 2;
}

/** Мелкие группы (кисть/пронация): e1RM только по 3-8 повт, иначе hold-оценка. */
export function smallMuscleE1RM(weightKg: number, reps: number): number | null {
  const r = Number(reps);
  if (!Number.isFinite(r) || r < 3 || r > 8) return null;
  return armEpley1RM(weightKg, r);
}

/** Hold-оценка максимума: 10с = 100%, каждые +10с −10% (как estimateGripMax). */
export function holdE1RM(weightKg: number, holdSec: number): number | null {
  const w = Number(weightKg);
  const h = Number(holdSec);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return null;
  if (h <= 10) return Math.round(w * 2) / 2;
  const factor = Math.max(0.7, 1 - (h - 10) * 0.01);
  return Math.round((w / factor) * 2) / 2;
}

export interface BenchToWorkMaxInput {
  wristCurlLb?: number;
  pronHoldSec?: number;
  cupHoldSec?: number;
  cocLevel?: number;
  rtKg?: number;
  sideKg?: number;
}

/**
 * Бенчи → workMax (оценочно, вместо default-30):
 * wrist_flexors из фунтов, grip_support = RT, side = sideKg,
 * crush из CoC-уровня, pron/cup из удержаний (кабельный эквивалент).
 */
export function workMaxFromBenchmarks(input: BenchToWorkMaxInput): Record<string, number> {
  const wm: Record<string, number> = {};
  if (Number.isFinite(Number(input.wristCurlLb)) && Number(input.wristCurlLb) > 0)
    wm['wrist_flexors'] = Math.round(Number(input.wristCurlLb) * 0.4536 * 2) / 2;
  if (Number.isFinite(Number(input.rtKg)) && Number(input.rtKg) > 0)
    wm['grip_support'] = Math.round(Number(input.rtKg) * 2) / 2;
  if (Number.isFinite(Number(input.sideKg)) && Number(input.sideKg) > 0)
    wm['side_pressure'] = Math.round(Number(input.sideKg) * 2) / 2;
  if (Number.isFinite(Number(input.cocLevel)) && Number(input.cocLevel) >= 0)
    wm['grip_crush'] = Math.round(Number(input.cocLevel) * 25 * 2) / 2;
  if (Number.isFinite(Number(input.pronHoldSec)) && Number(input.pronHoldSec) > 0)
    wm['pronators'] = Math.round((10 + Number(input.pronHoldSec) * 0.4) * 2) / 2;
  if (Number.isFinite(Number(input.cupHoldSec)) && Number(input.cupHoldSec) > 0)
    wm['wrist_flexors_cup_hold'] = Math.round((15 + Number(input.cupHoldSec) * 0.5) * 2) / 2;
  return wm;
}

/** Обязательные мелкие: radial + fingers/containment всегда в FullArm. */
export const MANDATORY_SMALL = ['radial_deviators', 'risers', 'thumb'] as const;

export function ensureRadialFingers(muscles: string[]): string[] {
  const out = [...muscles];
  for (const m of MANDATORY_SMALL) if (!out.includes(m)) out.push(m);
  return out;
}

/** Централизованный % нагрузки (дубль builder-логики — единый источник для тестов). */
export function loadPctFor(character: string): number {
  if (character === 'тяж') return 0.82;
  if (character === 'техника') return 0.6;
  if (character === 'памп') return 0.68;
  return 0.65;
}
