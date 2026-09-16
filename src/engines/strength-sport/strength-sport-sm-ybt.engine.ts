/**
 * strength-sport-sm-ybt.engine.ts — YBT + SIDE-HOP скрининг (SM movement P7 + P8-честность)
 *
 * 2024–2025 (Xie n=458; Plisky YBT-LQ): anterior-асимметрия >4см (OR~2.2) +
 * FMS ≤14 (OR~2.3–2.7), комбинация OR~3.6 — лучший скрининг; но мета-анализ 2025
 * (Sports): чувствительность 25–58% — только скрининг, не диагноз; обязательно
 * в мультифакторной связке (нагрузка/анамнез). Хаб имеет OHS 6/6 — YBT дополняет
 * низ (LQ anterior) и верх (UQ — для лога над головой); side-hop — предиктор при ΔY≥4
 * (BMC 2024: side-hop предсказывает ΔYBT, OR 0.94).
 *
 * Чистый движок, без UI/storage.
 */

export const SM_SCREENING_DISCLAIMER =
  'Скрининг, не диагноз: FMS/YBT ловят 25–60% будущих травм — решение только в связке с нагрузкой и анамнезом (мета-анализ 2025)';

export interface SMYbtInput {
  antLeftCm?: number | null;
  antRightCm?: number | null;
  legLengthCm?: number | null; // длина ноги — для композита % (опционально)
  pmLeftCm?: number | null;
  pmRightCm?: number | null;
  plLeftCm?: number | null;
  plRightCm?: number | null;
  uqLeftCm?: number | null; // верхний квадрант (медиальный доступ, для лога)
  uqRightCm?: number | null;
}

export interface SMYbtResult {
  valid: boolean;
  verdict: 'ok' | 'warn' | 'critical';
  antAsymCm: number | null;
  uqAsymCm: number | null;
  compositePct: number | null;
  lines: string[];
}

/** Anterior-асимметрия низа: >4см риск (Plisky), >6см высокий. */
export function diagnoseYBT(input: SMYbtInput): SMYbtResult | null {
  const { antLeftCm: l, antRightCm: r } = input;
  const okLR = l != null && r != null && Number.isFinite(l) && Number.isFinite(r) && l > 0 && r > 0;
  const hasPM = input.pmLeftCm != null && input.pmRightCm != null;
  const hasPL = input.plLeftCm != null && input.plRightCm != null;
  if (!okLR && !hasPM && !hasPL && !(input.uqLeftCm != null && input.uqRightCm != null)) return null;
  const lines: string[] = [];
  let bad = 0;
  let antAsym: number | null = null;
  if (okLR) {
    antAsym = Math.round(Math.abs((l as number) - (r as number)) * 10) / 10;
    if (antAsym > 6) { bad += 2; lines.push(`YBT anterior-асимметрия ${antAsym}см >6см — высокий риск низа: баланс+стопы (Plisky)`); }
    else if (antAsym > 4) { bad++; lines.push(`YBT anterior-асимметрия ${antAsym}см >4см — риск ×2: односторонняя работа (Plisky)`); }
    else lines.push(`YBT anterior-асимметрия ${antAsym}см ≤4см — норма`);
  }
  let composite: number | null = null;
  if (okLR && hasPM && hasPL && input.legLengthCm != null && (input.legLengthCm as number) > 0) {
    const best = (a: number, b: number) => Math.max(a, b);
    const sum = best(l as number, r as number)
      + best(input.pmLeftCm as number, input.pmRightCm as number)
      + best(input.plLeftCm as number, input.plRightCm as number);
    composite = Math.round(((sum / 3 / (input.legLengthCm as number)) * 100) * 10) / 10;
    lines.push(`YBT композит ${composite}% длины ноги (ориентир LQ ~94%, Plisky)`);
    if (composite < 89.6) { bad++; lines.push('Композит <89.6% — нижняя зона: мобильность голеностопа + баланс'); }
  }
  let uqAsym: number | null = null;
  if (input.uqLeftCm != null && input.uqRightCm != null && input.uqLeftCm > 0 && input.uqRightCm > 0) {
    const uq = Math.round(Math.abs(input.uqLeftCm - input.uqRightCm) * 10) / 10;
    uqAsym = uq;
    if (uq > 4) { bad++; lines.push(`YBT-UQ асимметрия ${uq}см >4см — плечо под логом: торакальная + лопатки`); }
    else lines.push(`YBT-UQ асимметрия ${uq}см — норма`);
  }
  const verdict = bad === 0 ? 'ok' : bad >= 2 ? 'critical' : 'warn';
  return { valid: true, verdict, antAsymCm: antAsym, uqAsymCm: uqAsym, compositePct: composite, lines };
}

export interface SMSideHopResult {
  valid: boolean;
  verdict: 'ok' | 'warn';
  text: string;
}

/** Side-hop при ΔY≥4 — predictor-предиктор (BMC 2024); без ΔY — просто норматив штрафа. */
export function diagnoseSideHop(hops30s?: number | null, antAsymCm?: number | null): SMSideHopResult | null {
  if (hops30s == null || !Number.isFinite(hops30s) || hops30s <= 0) return null;
  if (antAsymCm != null && antAsymCm >= 4) {
    if (hops30s < 30) return { valid: true, verdict: 'warn', text: `Side-hop ${hops30s}/30с <30 при ΔY ${antAsymCm}см — предиктор травм активен: баланс-прогрессия` };
    return { valid: true, verdict: 'ok', text: `Side-hop ${hops30s}/30с ≥30 — компенсирует ΔY ${antAsymCm}см` };
  }
  if (hops30s < 25) return { valid: true, verdict: 'warn', text: `Side-hop ${hops30s}/30с <25 — низкая латеральная устойчивость` };
  return { valid: true, verdict: 'ok', text: `Side-hop ${hops30s}/30с — норма` };
}
