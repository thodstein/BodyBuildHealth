/**
 * strength-sport-sm-carry-locomotion.engine.ts — ЛОКОМОЦИЯ КЕРРИ (SM movement P2 + P6-разворот)
 *
 * Hindle 2021 йок (19 атлетов, 20м @85%): шаг 1.14м / темп 1.62Гц / stance 0.42с;
 * фермер (Keogh 2014): шаг 1.54м / темп 1.89Гц / stance 0.32с.
 * HP-фермер (систематика): шаг 1.83 vs 1.40м, темп 2.01 vs 1.83Гц, контакт 0.29 vs 0.34с.
 * Разгон 0–5м — короткий шаг + высокий темп; дальше — крейсерская длина.
 * Модель (полевая, ориентир): v = длина × темп − k×нагрузка/BW (k йок 0.015 / фермер 0.010).
 * Разворот 180° — отдельная фаза: >3с или дроп на нём = слабое место медли.
 *
 * Чистый движок, без UI/storage. Все пороги подписаны как ориентиры, не диагноз.
 */

export type SMCarryKind = 'yoke' | 'farmers';

export interface SMCarryLocomotionInput {
  kind: SMCarryKind;
  strideLengthM?: number | null;
  strideRateHz?: number | null;
  stanceS?: number | null;
  loadKg?: number | null;
  bodyweightKg?: number | null;
  split20mS?: number | null; // факт 20м, с — для сверки с моделью
}

export interface SMCarryLocomotionResult {
  valid: boolean;
  verdict: 'ok' | 'warn' | 'critical';
  speedModelMS: number | null;
  lines: string[];
}

const num = (v: number | null | undefined): number | null =>
  v != null && Number.isFinite(v) && (v as number) > 0 ? (v as number) : null;

const HP_REFS = {
  yoke: { stride: 1.14, rate: 1.62, stance: 0.42 },
  farmers: { stride: 1.54, rate: 1.89, stance: 0.32 },
} as const;

const HP_TOP = { stride: 1.83, rate: 2.01, stance: 0.29 } as const;

export function carrySpeedModel(
  kind: SMCarryKind,
  strideM: number,
  rateHz: number,
  loadKg?: number | null,
  bwKg?: number | null,
): number {
  const k = kind === 'yoke' ? 0.015 : 0.01;
  const ratio = loadKg != null && bwKg != null && bwKg > 0 ? loadKg / bwKg : 0;
  return Math.max(0, Math.round((strideM * rateHz - k * ratio) * 100) / 100);
}

export function diagnoseCarryLocomotion(input: SMCarryLocomotionInput): SMCarryLocomotionResult | null {
  const stride = num(input.strideLengthM);
  const rate = num(input.strideRateHz);
  const stance = num(input.stanceS);
  if (stride == null && rate == null && stance == null) return null;
  const ref = HP_REFS[input.kind];
  const lines: string[] = [];
  let bad = 0;
  if (stride != null) {
    if (stride >= HP_TOP.stride) lines.push(`Шаг ${stride}м — топ-уровень (HP ≥1.83м)`);
    else if (stride >= ref.stride * 0.85) lines.push(`Шаг ${stride}м — около референса ${ref.stride}м`);
    else { bad++; lines.push(`Шаг ${stride}м <85% референса ${ref.stride}м — короткий шаг: сани 0–5м + мощность отталкивания`); }
  }
  if (rate != null) {
    if (rate >= HP_TOP.rate) lines.push(`Темп ${rate}Гц — топ (HP ≥2.01Гц)`);
    else if (rate >= ref.rate * 0.9) lines.push(`Темп ${rate}Гц — около референса ${ref.rate}Гц`);
    else { bad++; lines.push(`Темп ${rate}Гц низкий — частота не компенсирует: ускорение 0–5м коротким шагом`); }
  }
  if (stance != null) {
    if (stance <= HP_TOP.stance + 0.02) lines.push(`Контакт ${stance}с — топ (HP ~0.29с)`);
    else if (stance <= ref.stance * 1.25) lines.push(`Контакт ${stance}с — около референса ${ref.stance}с`);
    else { bad++; lines.push(`Контакт ${stance}с затянут — долгое стояние: жёсткость голеностопа + плиометрика`); }
  }
  let speedModelMS: number | null = null;
  if (stride != null && rate != null) {
    speedModelMS = carrySpeedModel(input.kind, stride, rate, input.loadKg ?? null, input.bodyweightKg ?? null);
    lines.push(`Модель: ${stride}м × ${rate}Гц → ~${speedModelMS} м/с (ориентир, k=${input.kind === 'yoke' ? 0.015 : 0.01})`);
    if (input.split20mS != null && Number.isFinite(input.split20mS) && input.split20mS > 0) {
      const fact = 20 / (input.split20mS as number);
      const d = Math.round((fact - speedModelMS) * 100) / 100;
      lines.push(`Факт 20м: ${input.split20mS}с (~${Math.round(fact * 100) / 100} м/с, Δ ${d >= 0 ? '+' : ''}${d} к модели)`);
      if (d < -0.5) { bad++; lines.push('Факт сильно ниже модели — тормозят развороты/дропы/торможение, не ноги'); }
    }
  }
  const verdict = bad === 0 ? 'ok' : bad >= 2 ? 'critical' : 'warn';
  return { valid: true, verdict, speedModelMS, lines };
}

export interface SMCarryTurnResult {
  valid: boolean;
  verdict: 'ok' | 'warn' | 'critical';
  text: string;
}

/** Разворот 180°: ≤2с топ, ≤3с норма, дольше/дроп = слабое место медли. */
export function diagnoseCarryTurn(turnS?: number | null, droppedOnTurn?: boolean | null): SMCarryTurnResult | null {
  const t = num(turnS);
  if (t == null && !droppedOnTurn) return null;
  if (droppedOnTurn) {
    return { valid: true, verdict: 'critical', text: 'Дроп на развороте — слабое место медли: низкий центр + короткие шаги + перехват заранее' };
  }
  if ((t as number) <= 2) return { valid: true, verdict: 'ok', text: `Разворот ${t}с ≤2с — топ` };
  if ((t as number) <= 3) return { valid: true, verdict: 'ok', text: `Разворот ${t}с ≤3с — норма` };
  return { valid: true, verdict: 'warn', text: `Разворот ${t}с >3с — долгий: дроп-тактика + постановка ног (учебные 180° ×10)` };
}
