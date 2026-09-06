/**
 * bb-ped-phasing.engine.ts — фазировка MGF/IGF1 + insulin-safety для ББ-авто.
 *
 * Биология (Goldspink/Hill, J Physiol 2003; Matheny minireview PMC2840678):
 * MGF — пролиферация сателлитных клеток (первый пульс 1–4 день после
 * повреждения), IGF-IEa/IGF1 — дифференцировка и синтез белка (пик ~10 день).
 * Синтетический MGF E-пептид держит миобласты в пролиферации и тормозит
 * дифференцировку — одновременный приём MGF + IGF1 мешает обоим.
 * Практика (PeptIQ, PepAtlas, Biomogging): чередование по дням/неделям
 * либо блоки 2–4 нед MGF → 3–4 нед IGF1, IGF1 строго с углеводами.
 *
 * Инсулин (PMC5723243 Anderson 2017; Piatkowski DAR 2024; Evans BJSM 2003):
 * анаболичен только вместе с гипераминоацидемией (EAA + быстрые углеводы),
 * правило 10 г углеводов на 1 IU, старт 3–5 IU, глюкометр, сахара под рукой.
 * Соло-инсулин без AAS/GH — преимущественно жир (Springer 2024).
 *
 * Движок чистый (без DOM/storage), только рекомендации — характер тяж/памп
 * дней и MRV-капы не трогает. Интеграция: recommendPEDMethodology (фаза в
 * pedProfile для schemeFor) + applyPEDMethodologyToPlan (пометки по неделям).
 */
import { computeAASEquivDose } from './bb-ped-adaptation.engine';

export type PED = 'AAS' | 'insulin' | 'MGF' | 'IGF1' | 'GH';

/** Фаза пептидного сигнала на конкретную неделю/план. */
export type PedPhase = 'proliferation' | 'differentiation' | 'both' | 'none';

export interface PedPhasingInput {
  peds: PED[];
  pedDoses?: Record<string, number>;
  /** Номер недели плана (1-индекс) — для чередования. По умолчанию 1. */
  weekIdx?: number;
  /** Длина плана в неделях — для блочной фазировки. По умолчанию 1. */
  totalWeeks?: number;
}

function doseOf(doses: Record<string, number> | undefined, k: string): number {
  const raw = doses?.[k];
  if (typeof raw === 'number') return raw;
  if (raw != null) return parseFloat(String(raw).replace(',', '.').replace(/[^0-9.]/g, '')) || 0;
  return 0;
}

function has(peds: PED[], doses: Record<string, number> | undefined, k: PED): boolean {
  return peds.includes(k) && doseOf(doses, k) > 0;
}

/**
 * Фаза для конкретной недели плана.
 * - Только MGF → proliferation (спутниковые клетки, повреждение/стретч).
 * - Только IGF1 → differentiation (синтез белка, углеводное окно).
 * - Оба + длинный план (≥8 нед): блоки — первая половина proliferation,
 *   вторая differentiation (блочный протокол Tony Huge / PepAtlas).
 * - Оба + короткий план: чередование по чётности недели
 *   (нечётные — proliferation, чётные — differentiation).
 * - Нет MGF/IGF1 → none.
 */
export function resolvePedPhase(input: PedPhasingInput): PedPhase {
  const { peds, pedDoses, weekIdx = 1, totalWeeks = 1 } = input;
  const mgf = has(peds, pedDoses, 'MGF');
  const igf = has(peds, pedDoses, 'IGF1');
  if (mgf && !igf) return 'proliferation';
  if (igf && !mgf) return 'differentiation';
  if (!mgf || !igf) return 'none';
  if (totalWeeks >= 8) {
    return weekIdx <= Math.ceil(totalWeeks / 2) ? 'proliferation' : 'differentiation';
  }
  return weekIdx % 2 === 1 ? 'proliferation' : 'differentiation';
}

/** План-уровень: есть ли обе фазы в цикле (для rationale). */
export function hasBothPhases(input: Omit<PedPhasingInput, 'weekIdx'>): boolean {
  const { peds, pedDoses, totalWeeks = 1 } = input;
  return has(peds, pedDoses, 'MGF') && has(peds, pedDoses, 'IGF1') && totalWeeks >= 1;
}

/** Человекочитаемое описание фазы для rationale. */
export function describePedPhase(phase: PedPhase): string {
  switch (phase) {
    case 'proliferation':
      return 'Пролиферация (MGF): сателлитные клетки — эксцентрик 3–4с, lengthened-позиция, loaded stretch 30–60с (Goldspink/Hill 2003)';
    case 'differentiation':
      return 'Дифференцировка (IGF1): синтез белка — объёмный памп 12–20 + углеводное окно 50–80г в 60 мин после инъекции (PeptIQ)';
    case 'both':
      return 'Чередование MGF/IGF1 по неделям: нечётные — пролиферация, чётные — дифференцировка (PepAtlas alternating)';
    default:
      return '';
  }
}

export interface InsulinSafety {
  active: boolean;
  doseIU: number;
  /** Обязательные быстрые углеводы вокруг инъекции (10 г / 1 IU). */
  requiredCarbsG: number;
  soloWithoutAasGh: boolean;
  warnings: string[];
}

/** Правило harm-reduction: 10 г быстрых углеводов на 1 IU инсулина. */
export function carbsForInsulinDose(doseIU: number): number {
  return Math.max(0, Math.round(doseIU * 10));
}

/**
 * Проверка безопасности инсулина. Только предупреждения — объём/методику
 * не меняет (решение о запрете схем принимает вызывающий по warnings).
 */
export function insulinSafetyCheck(peds: PED[], pedDoses?: Record<string, number>): InsulinSafety {
  const doseIU = doseOf(pedDoses, 'insulin');
  const active = peds.includes('insulin') && doseIU > 0;
  const warnings: string[] = [];
  // Соло = нет AAS (включая вещества-эквиваленты: tren/deca/oxa — через
  // T-eq агрегат, а не только ключ 'AAS') и нет GH.
  const soloWithoutAasGh =
    active && computeAASEquivDose(pedDoses) <= 0 && doseOf(pedDoses, 'GH') <= 0;
  if (!active) return { active, doseIU: 0, requiredCarbsG: 0, soloWithoutAasGh: false, warnings };
  warnings.push(
    `Инсулин ${doseIU} IU: обязательно ${carbsForInsulinDose(doseIU)} г быстрых углеводов вокруг инъекции (10 г/1 IU) + EAA 10–20 г — без аминокислот синтез не растёт (PMC5723243)`,
  );
  warnings.push(
    'Старт 3–5 IU с оценкой реакции, глюкометр + быстрые сахара под рукой; признаки гипо (пот, тремор, спутанность) → 20–30 г быстрых углеводов сразу (Piatkowski 2024, Evans 2003)',
  );
  if (soloWithoutAasGh) {
    warnings.push(
      '⚠ Инсулин соло без AAS/GH — преимущественно жир, не мышцы: сначала добавьте анаболическую базу (Springer 2024)',
    );
  }
  if (doseIU >= 20) {
    warnings.push(`⚠ Высокая доза инсулина (${doseIU} IU/день): риск затяжной гипогликемии — дробите на pre/post приёмы, контроль глюкозы каждые 30–60 мин`);
  }
  return { active, doseIU, requiredCarbsG: carbsForInsulinDose(doseIU), soloWithoutAasGh, warnings };
}
