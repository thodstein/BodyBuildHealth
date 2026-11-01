/**
 * Оценка КАЧЕСТВА собранного дня: 0–100 одним числом + разбивка по осям.
 *
 * Зачем: сходимость по КБЖУ (≤3%) говорит только о том, что граммы совпали с целью.
 * Она ничего не говорит о том, съедобен ли план: при идеальных макросах выдача может
 * иметь приём с 55% дневного жира, основной приём на 12 г белка, ноль овощей и
 * «19 г малины» вместо порции. Пользователь видит ровно это.
 *
 * Замер 50 конфигураций (5 профилей × 3–7 приёмов × трен/отдых, авто-цели поддержки):
 *  • жир в одном приёме >35% дня — 82% дней (средний максимум 43%);
 *  • основной приём <0.30 г белка/кг — 72% дней;
 *  • овощей <200 г — 46% дней, молочки — 0% дней;
 *  • пунктов меньше 30 г — 7.2 из 21.
 *
 * Веса осей подобраны так, чтобы «съедобность» (овощи, распределение, порции) не
 * перекрывалась микронутриентами: 150 г шпината не компенсируют приём на 8 г белка.
 *
 * Сделано (пакет QG1–QG7, 2026-11). Замер до/после на тех же 50 конфигурациях:
 *  • овощи <200 г: 46% → 24%; жир в одном приёме >35%: 82% → 28% (макс 43% → 35%);
 *  • основной приём ниже белкового пола: 38% → 22%; микро <70% RDA: 7.1 → 6.6 из 16;
 *  • молочка в дне: 50% → 62%; клетчатка: 17.6 → 18.4 г/1000 ккал;
 *  • средняя оценка дня: 66.2 → 78.4; дней <70: 46% → 22%, дней <60: 26% → 16%.
 * Канон 3% не взят в 20% дней и до, и после (средний макс-дев 3.10% → 3.51%).
 * Подробности и отложенные пункты — docs/NUTRITION-PLANNER-QUALITY-AUDIT-2026-10.md §8.
 */

export interface QualityScoringInput {
  weightKg: number;
  /** Оценка покрытия микро (0–1), если считалась. */
  microCoverage?: { lowCount: number; total: number };
}

export interface QualityBreakdown {
  total: number;
  veg: number;
  fatSpread: number;
  proteinSpread: number;
  portions: number;
  variety: number;
  micro: number;
}

/** Пункты, которые не являются «порцией еды»: добавки, масла, приправы. */
const NON_PORTION_ROLES = new Set(['supplement', 'liquid']);
const FAT_ROLES = new Set(['fat']);
const MIN_MEANINGFUL_G: Record<string, number> = {
  protein: 40, fast_protein: 20, slow_protein: 20,
  carb_slow: 30, carb_fast: 20, fruit: 80, veg: 60, fat: 7,
};

const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));
const typeOf = (m: any) => String(m?.type || '');
const isWindowMeal = (m: any) => ['preworkout', 'postworkout', 'intra'].includes(typeOf(m));
const isMainMeal = (m: any) => !isWindowMeal(m) && typeOf(m) !== 'presleep';

export function scoreDayQuality(meals: any[], input: QualityScoringInput): QualityBreakdown {
  const list = (meals || []).filter((m: any) => (m?.items || []).length > 0);
  const w = Math.max(1, Number(input?.weightKg) || 0);

  let vegG = 0;
  let fatTotal = 0;
  let items = 0;
  let meaningful = 0;
  const ids = new Set<string>();
  let maxFatShare = 0;
  let minMainProteinPerKg = Infinity;

  const main = list.filter(isMainMeal);
  for (const m of list) {
    const mf = Number(m?.totals?.f) || 0;
    fatTotal += mf;
  }
  for (const m of list) {
    const mf = Number(m?.totals?.f) || 0;
    if (fatTotal > 0 && isMainMeal(m)) maxFatShare = Math.max(maxFatShare, mf / fatTotal);
    if (isMainMeal(m)) {
      const ppk = (Number(m?.totals?.p) || 0) / w;
      minMainProteinPerKg = Math.min(minMainProteinPerKg, ppk);
    }
    for (const it of m?.items || []) {
      ids.add(String(it.id));
      if (NON_PORTION_ROLES.has(String(it.role))) continue;
      items++;
      if (String(it.role) === 'veg') vegG += Number(it.amount) || 0;
      const min = MIN_MEANINGFUL_G[String(it.role)];
      if (!min || (Number(it.amount) || 0) >= min) meaningful++;
      else if (FAT_ROLES.has(String(it.role))) meaningful += 0.5;
    }
  }
  if (!Number.isFinite(minMainProteinPerKg)) minMainProteinPerKg = 0;
  if (!Number.isFinite(maxFatShare)) maxFatShare = 0;

  // Овощи: 200 г — норма дня; 100 г — половина; 0 — ноль.
  const veg = clamp((vegG / 200) * 100);
  // Жир: ≤35% в приёме — норма, 50% — ноль.
  const fatSpread = clamp(100 - Math.max(0, maxFatShare - 0.35) * (100 / 0.15));
  // Белок основного приёма: 0.30 г/кг — норма (MPS-порог для 80 кг), 0.15 — половина.
  const proteinSpread = clamp((minMainProteinPerKg / 0.3) * 100);
  const portions = items > 0 ? clamp((meaningful / items) * 100) : 0;
  const variety = clamp((ids.size / 20) * 100);
  const micro = input?.microCoverage && input.microCoverage.total > 0
    ? clamp(100 - (input.microCoverage.lowCount / input.microCoverage.total) * 140)
    : 60;

  // Микро — самая «дорогая» ось по данным (6.5 из 16 ниже 70% RDA), но не главная:
  // пользователь жалуется на тарелки, а не на проценты.
  const total = Math.round(
    0.22 * veg + 0.20 * fatSpread + 0.20 * proteinSpread + 0.18 * portions + 0.08 * variety + 0.12 * micro,
  );

  return {
    total: clamp(total),
    veg: Math.round(veg),
    fatSpread: Math.round(fatSpread),
    proteinSpread: Math.round(proteinSpread),
    portions: Math.round(portions),
    variety: Math.round(variety),
    micro: Math.round(micro),
  };
}

/** Человеческая расшифровка слабых осей (для ноты в плане). */
export function describeQualityWeakness(q: QualityBreakdown): string[] {
  const out: string[] = [];
  if (q.veg < 70) out.push('овощи');
  if (q.fatSpread < 60) out.push('жир в одном приёме');
  if (q.proteinSpread < 70) out.push('белок основного приёма');
  if (q.portions < 70) out.push('мелкие порции');
  if (q.micro < 70) out.push('микронутриенты');
  return out;
}
