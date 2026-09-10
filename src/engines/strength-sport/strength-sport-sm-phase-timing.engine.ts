/**
 * strength-sport-sm-phase-timing.engine.ts — ПОФАЗНЫЙ ТАЙМИНГ (SM PRO P3)
 *
 * Камень (Hindle 2021): 5 фаз — восстановление / хват / 1-я тяга / колени / 2-я тяга.
 * Ключ скорости: резкий переход «низ приседа → 2-я тяга» (stretch-shorten) + высокий RFD
 * во 2-й тяге; затянутая 1-я тяга + скомканная 2-я = провал. Ориентиры (полевые):
 * 1-я тяга ≤3.0 с, колени ≤2.0 с, 2-я тяга ≤3.5 с (М) / ≤2.8 с (Ж).
 * Переноски (Keogh 2014 фермер; Hindle 2021 йок): разгон 0–5 м / макс 5–15 м / финиш
 * 15–20 м. Топ = пик поздно (17–20 м); пик в середине = слабый разгон; затухание к
 * финишу = выносливость/хват. Ввод — 3 числа отрезков (HubNum) или тайминги CSV.
 *
 * Чистый движок, без UI/storage.
 */

export interface SMStonePhaseInput {
  pull1S?: number | null; // 1-я тяга (пол → колени), с
  lapS?: number | null; // колени (перехват), с
  pull2S?: number | null; // 2-я тяга (колени → платформа), с
  sex?: 'male' | 'female' | null;
}

export const SM_STONE_PHASE_NORMS = { pull1MaxS: 3.0, lapMaxS: 2.0, pull2MaxSM: 3.5, pull2MaxSF: 2.8 };

export interface SMPhaseTimingResult {
  valid: boolean;
  verdict: 'ok' | 'warn' | 'critical';
  weakPhase: 'pull1' | 'lap' | 'pull2' | null;
  lines: string[];
}

const num = (v: number | null | undefined): number | null =>
  v != null && Number.isFinite(v) && (v as number) > 0 ? (v as number) : null;

export function diagnoseStonePhaseTiming(input: SMStonePhaseInput): SMPhaseTimingResult | null {
  const p1 = num(input.pull1S);
  const lap = num(input.lapS);
  const p2 = num(input.pull2S);
  if (p1 == null && lap == null && p2 == null) return null;
  const pull2Max = input.sex === 'female' ? SM_STONE_PHASE_NORMS.pull2MaxSF : SM_STONE_PHASE_NORMS.pull2MaxSM;
  const lines: string[] = [];
  let bad = 0;
  let weakPhase: SMPhaseTimingResult['weakPhase'] = null;
  let worst = 0;
  const check = (v: number | null, cap: number, name: string, fix: string, key: 'pull1' | 'lap' | 'pull2') => {
    if (v == null) return;
    if (v <= cap) {
      lines.push(`${name} ${v} с ≤ ${cap} с — норма`);
    } else {
      bad++;
      lines.push(`${name} ${v} с > ${cap} с — ${fix}`);
      if (v - cap > worst) {
        worst = v - cap;
        weakPhase = key;
      }
    }
  };
  check(p1, SM_STONE_PHASE_NORMS.pull1MaxS, '1-я тяга', 'тяга с пола слабая: RDL/дефицит + обхват', 'pull1');
  check(lap, SM_STONE_PHASE_NORMS.lapMaxS, 'Колени', 'перехват слабый: колени выше + смола + предплечья', 'lap');
  check(p2, pull2Max, '2-я тяга', 'взрыв таза слабый: прыжки/толчки + RFD-пик', 'pull2');
  const verdict: SMPhaseTimingResult['verdict'] = bad === 0 ? 'ok' : bad >= 2 ? 'critical' : 'warn';
  return { valid: true, verdict, weakPhase, lines };
}

export interface SMCarrySplitsResult {
  valid: boolean;
  verdict: 'ok' | 'warn' | 'critical';
  peakSegment: 1 | 2 | 3;
  lines: string[];
}

/** Отрезки переноски 20 м: 0–5 / 5–15 / 15–20 м (меньше секунд = быстрее). */
export function diagnoseCarrySplits(splits: Array<number | null | undefined>): SMCarrySplitsResult | null {
  const [a, b, c] = splits.map(num);
  if (a == null || b == null || c == null) return null;
  const lines: string[] = [];
  const peak = a <= b && a <= c ? 1 : b <= c ? 2 : 3;
  lines.push(`Отрезки: 0–5 м ${a} с · 5–15 м ${b} с · 15–20 м ${c} с → пик: отрезок ${peak}`);
  if (peak === 3) {
    lines.push('Пик поздно (15–20 м) — топ-профиль: разгон частотой, шаг короткий (Hindle)');
    return { valid: true, verdict: 'ok', peakSegment: 3, lines };
  }
  if (peak === 2) {
    lines.push('Пик в середине — разгон слабый: стартовая мощность (сани 0–5 м + первый шаг)');
    return { valid: true, verdict: 'warn', peakSegment: 2, lines };
  }
  lines.push('Затухание к финишу — выносливость/хват: медли-темп + support до 60 с');
  return { valid: true, verdict: 'critical', peakSegment: 1, lines };
}
