/**
 * strength-sport-ta-attempts.engine.ts — ПОПЫТКИ ТА НА СТАРТ (E12 PRO-v2, W1 PRO-v3)
 *
 * Заявка → 90/96/102% (conservative 0.97 / balanced 1.0 / aggressive 1.03 —
 * parity с contest-simulator), readiness-флаг: просадка пика >0.15 м/с
 * на стандарте → −2.5кг к заявке (PoinT GO 2026). SnatchTh из FvR (±1.5кг, Sandau)
 * используется как база заявки рывка.
 * W1: MVT-прогноз несёт ошибку, растущую с мастерством (пропорциональный bias +
 * гетероскедастичность, PMC 2025) → каждая заявка идёт с полосой ±bandKg
 * (intermediate и ниже ±2.5, advanced+ ±3.5).
 * Чистый движок, без UI/storage.
 */

export type TAStrategy = 'conservative' | 'balanced' | 'aggressive';

export interface TAAttemptInput {
  declaredMaxKg?: number | null;
  strategy?: TAStrategy;
  /** Пик на стандарте (база) и сегодня — для readiness-флага. */
  peakVelStandard?: number | null;
  peakVelToday?: number | null;
  /** W1: уровень для ширины полосы (advanced+ шире — ошибка растёт с мастерством). */
  level?: string | null;
}

export interface TAAttemptPlan {
  baseKg: number;
  attempts: [number, number, number];
  readinessCut: boolean;
  readinessNote: string | null;
  /** W1: полуширина полосы неопределённости MVT-оценки, кг. */
  bandKg: number;
  rationale: string[];
}

/** W1: полоса MVT-ошибки — у сильных шире (гетероскедастичность, PMC 2025). */
export function attemptBandKg(level?: string | null): number {
  const l = String(level || '').toLowerCase();
  return l === 'advanced' || l === 'elite' || l === 'enhanced' ? 3.5 : 2.5;
}

const STRAT_MULT: Record<TAStrategy, number> = { conservative: 0.97, balanced: 1.0, aggressive: 1.03 };

/** Округление заявки вниз до 1кг (минимальный блин ТА). */
export function roundDownKg(v: number): number {
  return Math.floor(v);
}

export function planTAAttempts(input: TAAttemptInput): TAAttemptPlan | null {
  const base = input.declaredMaxKg;
  if (base == null || !Number.isFinite(base) || base <= 0) return null;
  const strategy: TAStrategy = input.strategy === 'conservative' || input.strategy === 'aggressive' ? input.strategy : 'balanced';
  const mult = STRAT_MULT[strategy];
  let readinessCut = false;
  let readinessNote: string | null = null;
  const std = input.peakVelStandard, today = input.peakVelToday;
  if (std != null && today != null && Number.isFinite(std) && Number.isFinite(today) && std > 0 && today > 0) {
    if (std - today > 0.15) {
      readinessCut = true;
      readinessNote = `Пик просел на ${Math.round((std - today) * 100) / 100} м/с (>0.15) — готовность низкая, −2.5кг к заявке`;
    }
  }
  const adj = base * mult - (readinessCut ? 2.5 : 0);
  const attempts: [number, number, number] = [
    roundDownKg(adj * 0.9),
    roundDownKg(adj * 0.96),
    roundDownKg(adj * 1.02),
  ];
  const bandKg = attemptBandKg(input.level);
  const rationale = [
    `Заявка ${base}кг × ${strategy} ${mult} ${readinessCut ? '− 2.5кг readiness' : ''} → ${attempts[0]}/${attempts[1]}/${attempts[2]} (±${bandKg})`,
    'Опener 90% — гарантированный подход; второй 96% — рабочий; третий 102% — рекорд.',
    `Полоса ±${bandKg}кг: MVT-оценка, ошибка растёт с мастерством (PMC 2025).`,
  ];
  return { baseKg: base, attempts, readinessCut, readinessNote, bandKg, rationale };
}

/* ───────────────────────── П1-Б: величина прыжка между попытками (26.09.2026) ─────────────────────────
 *
 * Источник: Darragh I.A.J., Egan B., Nolan D., Bennett K.E. Predicting a Successful Attempt in Raw
 * Powerlifting. A Nonlinear Mixed Logistic Regression Analysis. J Strength Cond Res 2026;40(2):e138-e146
 * · PMID 41160036 · DOI 10.1519/JSC.0000000000005276. Данные: 93 333 атлета (62 679 м / 30 654 ж),
 * 6 979 соревнований IPF; jump size = абсолютная разница веса между соседними попытками.
 *
 * Что показано (из abstract):
 *  - мужчины: присед и тяга — умеренные прыжки 5–20 кг ПОВЫШАЮТ успех; >20 кг — успех ПАДАЕТ,
 *    особенно на 3-й попытке; жим — рост успеха при прыжке <10 кг, дальше резкое падение;
 *  - женщины: присед улучшается только при ≤8 кг, >10 кг значимо снижает успех (сильнее 3-я);
 *    жим — почти линейное снижение уже на 2-й, 3-я падает резко свыше 4 кг; тяга — как присед,
 *    но терпимее, оптимум ≈9–11 кг;
 *  - у обоих полов 3-я попытка стабильно ХУЖЕ 2-й.
 *
 * ЧТО СДЕЛАНО: лестница заявок — фиксированные проценты (0.90/0.96/1.02), то есть прыжок = 6% от базы
 * ПРИ ЛЮБОМ ВЕСЕ. В карточке попыток теперь видно фактические прыжки в кг + оговорка.
 *
 * ЧТО НЕ СДЕЛАНО (осознанно): полосы 5–20 / ≤8 / <10 / ≤4 / 9–11 кг НЕ проверяются кодом. Эти
 * числа — для ОДИНОЧНЫХ видов ТА (присед/жим/тяга), а приложение строит попытки для ТОТАЛОВ
 * (рывок, С&Ж) — это сумма двух видов, и модель успеха на такие величины не калибровалась.
 * Приравнять рывок к приседу = выдуманная эквивалентность, а не оценка. Полосы живут в этом
 * комментарии как обоснование; применять их можно только вместе с калибровкой под тотал/одиночный
 * вид из истории соревнований пользователя.
 */

export function taTotalsJumpNote(attempts: [number, number, number]): string {
  const j1 = attempts[1] - attempts[0];
  const j2 = attempts[2] - attempts[1];
  return `Прыжки ${j1} и ${j2} кг — лестница считается процентами от базы, величина прыжка в процентах одинакова `
    + 'при любом весе. Ориентир по данным IPF (6 979 соревнований) есть только для одиночных видов, '
    + 'для ТОТАЛОВ калибровки нет; у обоих полов 3-я попытка в среднем хуже 2-й (PMID 41160036).';
}
