/**
 * strength-sport-sm-grip-carry.engine.ts — МОСТ ХВАТ→КЕРРИ (SM movement P3)
 *
 * Практика + Winwood/Keogh: фермер проигрывается хватом раньше ног — предплечья держат
 * почти максимум 20–60с. Хаб меряет холды (support/pinch/axle) и керри отдельно;
 * этот движок связывает: выносливость хвата + дропы + скорость съёма → прогноз заступа.
 * Время под напряжением заступа 20–60с — калибр: холд короче заступа = риск дропа.
 *
 * Чистый движок, без UI/storage.
 */

export interface SMGripCarryInput {
  farmersHoldSec?: number | null; // лучший холд фермера, с
  runTimeSec?: number | null; // плановое/факт время заступа, с
  dropsPerRun?: number | null; // дропы за заступ
  pickupMs?: number | null; // скорость съёма, мс
}

export interface SMGripCarryResult {
  valid: boolean;
  verdict: 'ok' | 'warn' | 'critical';
  lines: string[];
  gripLimitsCarry: boolean;
}

const num = (v: number | null | undefined): number | null =>
  v != null && Number.isFinite(v) && (v as number) >= 0 ? (v as number) : null;

export function diagnoseGripCarry(input: SMGripCarryInput): SMGripCarryResult | null {
  const hold = num(input.farmersHoldSec);
  const run = num(input.runTimeSec);
  const drops = num(input.dropsPerRun);
  const pickup = num(input.pickupMs);
  if (hold == null && run == null && drops == null && pickup == null) return null;
  const lines: string[] = [];
  let bad = 0;
  let gripLimits = false;
  if (hold != null && run != null && run > 0) {
    if (hold >= run * 1.2) lines.push(`Холд ${hold}с ≥ время заступа ${run}с ×1.2 — запас есть`);
    else {
      bad++;
      gripLimits = true;
      lines.push(`Холд ${hold}с < заступа ${run}с — хват лимитирует фермер: толстый гриф/виси 30–90с 3–4×/нед`);
    }
  }
  if (drops != null && drops > 0) {
    bad += drops >= 2 ? 2 : 1;
    gripLimits = true;
    lines.push(`Дропы ${drops}/заступ — каждый перезапуск +4–8с: остановка→перехват→дальше (тренируй ре-пикап отдельно)`);
  } else if (drops === 0) {
    lines.push('Дропов нет — хват держит заступ');
  }
  if (pickup != null) {
    if (pickup <= 1000) lines.push(`Съём ${pickup}мс ≤1с — топ (пикап решает место в плотном зачёте)`);
    else { bad++; lines.push(`Съём ${pickup}мс >1с — медленный старт −2–3с: пикап до автоматизма (<1с по сигналу)`); }
  }
  const verdict = bad === 0 ? 'ok' : bad >= 2 ? 'critical' : 'warn';
  return { valid: true, verdict, lines, gripLimitsCarry: gripLimits };
}
