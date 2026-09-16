/**
 * strength-sport-sm-stone-fatigue.engine.ts — КАМЕНЬ: lap-маркер + усталость серии (SM movement P1)
 *
 * Hindle 2021 (PeerJ, n=20, серия 4 камня растущей массы до 85% 1RM):
 *  - lap 1.325±1.112с — время на перехват; длинный lap = неуверенный обхват/смола;
 *  - повторы 1–2 укорочены vs 3–4 (растёт масса + утомление): удлиняются 1-я тяга и lap;
 *  - 2-я тяга самая длинная фаза; pop (бросок с груди) vs grind (дожим до касания).
 * Хаб уже меряет 1-ю/колени/2-ю (sm-phase-timing с нормами 3.0/2.0/3.5·2.8с).
 * Этот движок — слой поверх: lap-маркер качества перехвата + дрейф по повторам серии.
 *
 * Чистый движок, без UI/storage.
 */

export interface SMStoneLapInput {
  lapS?: number | null;
  zeroLap?: boolean | null;
}

export interface SMStoneLapResult {
  valid: boolean;
  verdict: 'ok' | 'warn' | 'critical';
  text: string;
}

const num = (v: number | null | undefined): number | null =>
  v != null && Number.isFinite(v) && (v as number) > 0 ? (v as number) : null;

/** Lap-маркер: ≤1.2с топ-перехват, ≤2.0с норма (канон phase-timing), >2.0с слабый. */
export function diagnoseStoneLap(input: SMStoneLapInput): SMStoneLapResult | null {
  if (input.zeroLap) {
    return { valid: true, verdict: 'ok', text: 'Zero-lap — перехват не нужен (one-motion топов)' };
  }
  const lap = num(input.lapS);
  if (lap == null) return null;
  if (lap <= 1.2) return { valid: true, verdict: 'ok', text: `Lap ${lap}с ≤1.2с — топ-перехват (обхват+смола держат)` };
  if (lap <= 2.0) return { valid: true, verdict: 'ok', text: `Lap ${lap}с ≤2.0с — норма` };
  if (lap <= 3.0) {
    return { valid: true, verdict: 'warn', text: `Lap ${lap}с >2.0с — перехват слабый: колени выше + смола + предплечья (Hindle lap 1.3±1.1с)` };
  }
  return { valid: true, verdict: 'critical', text: `Lap ${lap}с >3.0с — камень висит на коленях: обхват снизу + тактика (или легче камень)` };
}

export interface SMStoneRepInput {
  pull1S?: number | null;
  lapS?: number | null;
  pull2S?: number | null;
}

export interface SMStoneFatigueResult {
  valid: boolean;
  verdict: 'ok' | 'warn' | 'critical';
  driftS: number | null;
  lines: string[];
}

/**
 * Усталость серии: суммарное время повтора 1 vs повтора 3+ (Hindle: поздние длиннее).
 * Дрейф ≥+1.0с = утомление/масса давит; ≥+2.0с = серия разваливается.
 */
export function diagnoseStoneRepFatigue(
  rep1: SMStoneRepInput,
  repLate: SMStoneRepInput,
): SMStoneFatigueResult | null {
  const t1 = [num(rep1.pull1S), num(rep1.lapS), num(rep1.pull2S)];
  const t2 = [num(repLate.pull1S), num(repLate.lapS), num(repLate.pull2S)];
  if (t1.some((v) => v == null) || t2.some((v) => v == null)) return null;
  const sum1 = (t1[0] as number) + (t1[1] as number) + (t1[2] as number);
  const sum2 = (t2[0] as number) + (t2[1] as number) + (t2[2] as number);
  const drift = Math.round((sum2 - sum1) * 10) / 10;
  const lines = [`Повтор 1: ${sum1}с → поздний: ${sum2}с (Δ ${drift >= 0 ? '+' : ''}${drift}с)`];
  let verdict: SMStoneFatigueResult['verdict'] = 'ok';
  if (drift >= 2.0) {
    verdict = 'critical';
    lines.push('Дрейф ≥+2.0с — серия разваливается: снижай массу камней или удлиняй отдых (Hindle: поздние повторы длиннее)');
  } else if (drift >= 1.0) {
    verdict = 'warn';
    lines.push('Дрейф ≥+1.0с — утомление/масса давит: кондиция серии + перехват быстрее');
  } else {
    lines.push('Дрейф <1.0с — серия держится');
  }
  return { valid: true, verdict, driftS: drift, lines };
}
