import { SUPPORT_CATALOG_DATA } from '../data/support-database';
import type { LabCompositeResult } from './lab-analysis.engine';
import { INTERACTIONS_DB, resolveInteractionId } from '../data/support-interactions-db';
import { hasBlockingInteraction, getDDIForPair, getDDIForDrug } from '../data/drug-drug-interactions';
import { NUTRIENT_LIMITS_V2, resolveNutrient, type NutrientLimit } from './support-limits';
import { resolveElementalFactor, elementalMgOf } from '../data/elemental-dose';

// Обратная совместимость: раньше пересчёт жил здесь, потребители импортируют его отсюда.
export { resolveElementalFactor, elementalMgOf } from '../data/elemental-dose';

/* ─── ЕДИНЫЙ реестр пределов ───
   До этого здесь жила ЧЕТВЁРТАЯ копия таблицы UL (`SUPPLEMENT_UPPER_LIMITS`)
   со своими числами (B6 = 100 мг IOM вместо EFSA 12 мг, селен = 400 вместо 255)
   и одной единицей («мг») — расходилась с `NUTRIENT_UL` движка и с реестром.
   Источник теперь один — `NUTRIENT_LIMITS_V2`; `SUPPLEMENT_UPPER_LIMITS`
   остаётся производным видом (мг) для внешних потребителей и тестов.
   ВАЖНО: UL ≠ safe level ≠ клинический ориентир. «Красным» может быть только
   превышение настоящего UL; `SafeLevel`/`ClinicalGuidance` — жёлтая титрация. */

/** Предел реестра в мг ЭЛЕМЕНТАРНОГО вещества (мкг/МЕ приводим к мг). */
function limitToMg(lim: NutrientLimit): number | undefined {
  if (!(lim.value > 0)) return undefined;                    // NotEstablished (value = 0)
  if (lim.unit === 'mg') return lim.value;
  if (lim.unit === 'mcg') return lim.value / 1000;
  if (lim.unit === 'iu') return lim.value * 0.025 / 1000;    // 1 МЕ витамина D = 0.025 мкг
  return undefined;
}

/** Производный вид реестра в мг элементарного вещества — обратная совместимость. */
export const SUPPLEMENT_UPPER_LIMITS: Record<string, number> = (() => {
  const out: Record<string, number> = {};
  for (const [key, lim] of Object.entries(NUTRIENT_LIMITS_V2)) {
    if (lim.kind === 'NotEstablished') continue;
    const mg = limitToMg(lim);
    if (mg !== undefined) out[key] = mg;
  }
  // Исторический ключ проекта: реестр зовёт нутриент `vitamin_d`.
  if (out.vitamin_d !== undefined) out.vitamin_d3 = out.vitamin_d;
  return out;
})();

/* ─── Daily OPTIMAL doses (mg элементарного вещества) ───
   Это НЕ регуляторный предел, а клинический оптимум: выше opt×1.5 движок
   предлагает титрацию/циклирование (`severity: 'titrate'`). Для ботаники и
   аминокислот без установленного UL это единственный честный контур — им
   НЕЛЬЗЯ выдавать выдуманный «UL». */
export const SUPPLEMENT_OPTIMAL_LIMITS: Record<string, number> = {
  zinc: 30, selenium: 0.2, vitamin_b6: 25, vitamin_c: 1000,
  calcium: 1200, iron: 18, copper: 3, manganese: 5, boron: 10,
  chromium: 0.2, iodine: 0.15, coq10: 300, alpha_lipoic: 600,
  nac: 1200, curcumin: 1000, berberine: 1000, ashwagandha: 600,
  l_carnitine: 2000, creatine: 5000, taurine: 2000, theanine: 200,
  glycine: 5000, glutamine: 10000, vitamin_e: 400,
};

/* ─── Nutrient competition pairs (antagonists) ─── */
interface CompetitionPair { a: string; b: string; effect: string; recommendation: string; }
export const NUTRIENT_COMPETITION: CompetitionPair[] = [
  { a: 'zinc', b: 'copper', effect: 'Цинк в высоких дозах (>40 мг/день) истощает запасы меди', recommendation: 'Разнести приём: цинк утром, медь вечером. Или добавить 2 мг меди на каждые 30 мг цинка' },
  { a: 'calcium', b: 'iron', effect: 'Кальций блокирует всасывание железа на 50-60%', recommendation: 'Разнести на 2+ часа. Железо натощак с витамином C, кальций с едой' },
  { a: 'calcium', b: 'magnesium', effect: 'Высокие дозы кальция (>1500 мг) конкурируют с магнием за всасывание', recommendation: 'Разнести: кальций утром, магний вечером. Соотношение Ca:Mg = 2:1' },
  { a: 'calcium', b: 'zinc', effect: 'Кальций снижает абсорбцию цинка при совместном приёме', recommendation: 'Разнести на 2+ часа' },
  { a: 'iron', b: 'zinc', effect: 'Железо и цинк конкурируют за транспортёр DMT1', recommendation: 'Разнести на 2+ часа. Цинк на ночь, железо утром' },
  { a: 'magnesium', b: 'zinc', effect: 'Высокие дозы магния (>400 мг) могут снижать абсорбцию цинка', recommendation: 'Разнести: магний вечером, цинк утром/днём' },
  { a: 'potassium', b: 'magnesium', effect: 'Калий и магний — синергисты, но высокие дозы калия (>2000 мг) требуют адекватного магния', recommendation: 'Принимать вместе для баланса электролитов' },
  { a: 'iron', b: 'copper', effect: 'Железо в высоких дозах может снижать уровень меди', recommendation: 'При длительном приёме железа добавить 1-2 мг меди' },
];

/* ─── Chelation pairs (minerals that bind each other in gut) ─── */
interface ChelationPair { a: string; b: string; effect: string; }
export const CHELATION_PAIRS: ChelationPair[] = [
  { a: 'calcium', b: 'iron', effect: 'Кальций образует нерастворимые комплексы с железом в ЖКТ' },
  { a: 'magnesium', b: 'calcium', effect: 'Магний и кальций — конкуренты за транспортёры' },
  { a: 'zinc', b: 'calcium', effect: 'Цинк и кальций конкурируют за всасывание' },
  { a: 'iron', b: 'zinc', effect: 'Железо и цинк конкурируют за DMT1 транспортёр' },
  { a: 'magnesium', b: 'zinc', effect: 'Магний (>400 мг) конкурирует с цинком' },
  { a: 'copper', b: 'zinc', effect: 'Цинк индуцирует металлотионеин → связывает медь' },
];

/* ─── Fat-soluble substance IDs ─── */
export const FAT_SOLUBLE_IDS = new Set([
  'vitamin_d3', 'vitamin_k2', 'vitamin_a', 'vitamin_e',
  'coq10', 'omega3', 'curcumin', 'idebenone', 'pqq',
  'astaxanthin', 'lutein', 'zeaxanthin', 'resveratrol',
  'flax_oil', 'fish_oil', 'krill_oil', 'evening_primrose',
]);

/* ─── Absorption enhancers ─── */
export const ABSORPTION_ENHANCERS: Array<{ target: string; enhancer: string; effect: string }> = [
  { target: 'iron', enhancer: 'vitamin_c', effect: 'Витамин C повышает всасывание железа в 2-3 раза' },
  { target: 'calcium', enhancer: 'vitamin_d3', effect: 'Витамин D необходим для всасывания кальция' },
  { target: 'magnesium', enhancer: 'vitamin_b6', effect: 'B6 улучшает усвоение и удержание магния в клетках' },
  { target: 'zinc', enhancer: 'vitamin_b6', effect: 'B6 улучшает транспорт цинка через мембраны' },
  { target: 'curcumin', enhancer: 'piperine', effect: 'Пиперин повышает биодоступность куркумина на 2000%' },
  { target: 'coq10', enhancer: 'vitamin_e', effect: 'Витамин E стабилизирует CoQ10 и улучшает его транспорт' },
  { target: 'selenium', enhancer: 'vitamin_e', effect: 'Синергия: селен + витамин E усиливают антиоксидантный эффект' },
];

/* ════════════════════════════════════════════════════════════════════
   TOXICITY UL CHECK
   ════════════════════════════════════════════════════════════════════ */

export interface ToxWarning {
  substanceId: string;
  name: string;
  /** Суммарная доза в мг ЭЛЕМЕНТАРНОГО вещества. */
  totalDose: number;
  /** Предел/оптимум в мг элементарного вещества. */
  ul: number;
  percentUL: number;
  severity: 'safe' | 'warning' | 'danger' | 'titrate';
  message: string;
  /** Доза в правильной единице («255 мкг», «4000 МЕ») — UI не должен склеивать «мг». */
  doseText?: string;
  /** Предел в той же единице, что и `doseText`. */
  limitText?: string;
  /** true — доза пересчитана из массы соли в элементарное вещество. */
  elemental?: boolean;
}

/* Легаси-карта форм → базовый нутриент. Основной резолв теперь `resolveNutrient`
   (реестр, границы слов), здесь остаются только исторические псевдонимы каталога. */
export const UL_CANONICAL: Record<string, string> = {
  'zinc_picolinate': 'zinc', 'zinc_carnosine': 'zinc', 'zinc_gluconate': 'zinc',
  'magnesium_citrate': 'magnesium', 'magnesium_glycinate': 'magnesium', 'magnesium_l_threonate': 'magnesium', 'magnesium_oxide': 'magnesium',
  'iron_bisglycinate': 'iron', 'iron_sulfate': 'iron', 'iron_fumarate': 'iron',
  'calcium_citrate': 'calcium', 'calcium_carbonate': 'calcium', 'calcium_gluconate': 'calcium',
  'copper_bisglycinate': 'copper', 'copper_gluconate': 'copper',
  'selenium_methylselenocysteine': 'selenium', 'selenium_yeast': 'selenium',
  'vitamin_b6': 'vitamin_b6', 'vitamin_b12': 'vitamin_b12',
  'alpha_lipoic': 'alpha_lipoic', 'l_carnitine': 'l_carnitine',
  'chromium_picolate': 'chromium', 'iodine_kelp': 'iodine', 'potassium_citrate': 'potassium',
};

/* ─── Пересчёт «как на этикетке» → элементарное вещество ───
   Единственная реализация — `src/data/elemental-dose.ts` (её же читает карточка
   вещества в калькуляторе). Каталог хранит МИЛЛИГРАММЫ для всех веществ:
   селен 0.2 мг = 200 мкг, D3 0.05 мг = 2000 МЕ, B12 1 мг = 1000 мкг — поэтому
   для микронутриентов коэффициент не нужен (раньше здесь стояли 0.001/0.000025,
   и доза занижалась в 1000×/40000×, а превышения селена/D3 молча не находились).
   Коэффициент нужен только минералам, где на этикетке МАССА СОЛИ
   («Магний цитрат 400 мг» ≈ 64 мг элементарного Mg).
   Решение продукта (ноябрь 2026): UL считаем в пересчёте на ЭЛЕМЕНТАРНОЕ
   вещество (фактическое количество в таблетке), а не массу соли. */

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

/** Число в единице предела реестра (мг / мкг / МЕ) — без «склейки» в мг. */
function formatLimitAmount(mg: number, unit: NutrientLimit['unit']): string {
  if (unit === 'mg') return `${round2(mg)} мг`;
  if (unit === 'mcg') return `${round2(mg * 1000)} мкг`;
  return `${Math.round(mg * 40000)} МЕ`; // iu — в реестре только витамин D
}

/**
 * Ключ агрегации: канонический нутриент реестра (`resolveNutrient`).
 * Для ботаники/аминокислот без регуляторного предела — их id, если у них есть
 * клинический оптимум (иначе `null`: лучше молчание, чем выдуманный «UL»).
 */
function aggregationKey(id: string, cat: any): string | null {
  const canon = resolveNutrient(id) ?? resolveNutrient(cat?.nameRu) ?? resolveNutrient(cat?.name);
  if (canon) return canon;
  const lc = id.toLowerCase();
  if (UL_CANONICAL[lc]) return UL_CANONICAL[lc];
  if (SUPPLEMENT_OPTIMAL_LIMITS[lc] !== undefined) return lc;
  return null;
}

/**
 * Токсикологический контроль стека: сумма по нутриентам в мг ЭЛЕМЕНТАРНОГО
 * вещества против единого реестра пределов (`NUTRIENT_LIMITS_V2`).
 *
 * Семантика типов сохранена: `danger`/`warning` — только превышение настоящего
 * UL; `safe` — 80–100 % UL; `titrate` — выше клинического оптимума/ориентира,
 * что НЕ является «превышением нормы».
 */
export function checkStackToxicity(stackIds: string[]): ToxWarning[] {
  const warnings: ToxWarning[] = [];
  const agg: Record<string, {
    totalMg: number;
    ids: string[];
    names: string[];
    displayId: string;
    elemental: boolean;
  }> = {};

  for (const id of stackIds) {
    const cat = SUPPORT_CATALOG_DATA[id];
    if (!cat?.dosage?.mg || !(cat.dosage.mg > 0)) continue;
    const key = aggregationKey(id, cat);
    if (!key) continue;
    const factor = resolveElementalFactor(id, cat);
    const doseMg = elementalMgOf(id, cat);
    if (!(doseMg > 0)) continue;
    const name = cat.nameRu || cat.name || id;
    const acc = agg[key] ?? (agg[key] = {
      totalMg: 0, ids: [], names: [], displayId: id, elemental: false,
    });
    acc.totalMg += doseMg;
    acc.ids.push(id);
    if (!acc.names.includes(name)) acc.names.push(name);
    if (factor !== undefined) acc.elemental = true;
  }

  for (const [key, data] of Object.entries(agg)) {
    const lim = NUTRIENT_LIMITS_V2[key];
    const limitMg = lim ? limitToMg(lim) : undefined;
    const optMg = SUPPLEMENT_OPTIMAL_LIMITS[key];
    const elementalNote = data.elemental ? ' (в пересчёте на элементарное вещество)' : '';
    const totalText = lim && lim.unit
      ? formatLimitAmount(data.totalMg, lim.unit)
      : `${round2(data.totalMg)} мг`;
    // Несколько источников одного нутриента — показываем все («Цинк + Пиколинат цинка»).
    const nameText = data.names.join(' + ');

    // 1) Настоящий UL — единственный тип, где превышение = токсический риск.
    if (lim && lim.kind === 'UL' && limitMg !== undefined && limitMg > 0) {
      const pct = Math.round((data.totalMg / limitMg) * 100);
      if (pct >= 80) {
        const severity = pct > 150 ? 'danger' : pct > 100 ? 'warning' : 'safe';
        const ulText = formatLimitAmount(limitMg, lim.unit);
        // Альтернативное значение другого регулятора — показываем только в мягком
        // предупреждении, чтобы не выдавать его за применённый предел.
        const altText = lim.altValue != null && lim.altJurisdiction
          ? (lim.unit === 'iu'
            ? `${round2(lim.altValue)} мкг`
            : formatLimitAmount(lim.altValue, lim.unit))
          : '';
        const alt = altText ? ` (${lim.altJurisdiction} ${lim.altYear}: ${altText})` : '';
        warnings.push({
          substanceId: data.displayId,
          name: nameText,
          totalDose: round2(data.totalMg),
          ul: round2(limitMg),
          percentUL: pct,
          severity,
          doseText: totalText,
          limitText: ulText,
          elemental: data.elemental,
          message: severity === 'danger'
            ? `⛔ Суммарно ${totalText}${elementalNote} — это ${pct}% от UL ${ulText} (${lim.jurisdiction} ${lim.year}). Опасно: ${lim.criticalEffect}.`
            : severity === 'warning'
            ? `⚠ Суммарно ${totalText}${elementalNote} — ${pct}% от UL ${ulText} (${lim.jurisdiction} ${lim.year}). Риск токсичности: ${lim.criticalEffect}.`
            : `⚡ Суммарно ${totalText}${elementalNote} — ${pct}% от UL ${ulText}${alt}. OK, но следите.`,
        });
      }
      continue;
    }

    // 2) SafeLevel — выше него НЕ наблюдалось adverse effects, но это не UL.
    if (lim && lim.kind === 'SafeLevel' && limitMg !== undefined && limitMg > 0) {
      const pct = Math.round((data.totalMg / limitMg) * 100);
      if (pct >= 100) {
        warnings.push({
          substanceId: data.displayId,
          name: nameText,
          totalDose: round2(data.totalMg),
          ul: round2(limitMg),
          percentUL: pct,
          severity: 'warning',
          doseText: totalText,
          limitText: formatLimitAmount(limitMg, lim.unit),
          elemental: data.elemental,
          message: `⚠ Суммарно ${totalText}${elementalNote} — выше ${lim.jurisdiction} ${lim.year} safe level ${formatLimitAmount(limitMg, lim.unit)}. Это НЕ порог токсичности: UL для вещества не установлен, риск оценивается по анализам.`,
        });
      }
      continue;
    }

    // 3) Клинический ориентир — не регуляторный предел.
    if (lim && lim.kind === 'ClinicalGuidance' && limitMg !== undefined && limitMg > 0) {
      const pct = Math.round((data.totalMg / limitMg) * 100);
      if (pct >= 100) {
        warnings.push({
          substanceId: data.displayId,
          name: nameText,
          totalDose: round2(data.totalMg),
          ul: round2(limitMg),
          percentUL: pct,
          severity: 'titrate',
          doseText: totalText,
          limitText: formatLimitAmount(limitMg, lim.unit),
          elemental: data.elemental,
          message: `↕ Суммарно ${totalText}${elementalNote} — выше клинического ориентира ${formatLimitAmount(limitMg, lim.unit)} (${pct}%). Это не регуляторный UL; рассмотрите снижение/циклирование.`,
        });
      }
      continue;
    }

    // 4) Нет предела, но есть клинический оптимум → титрация, не «UL».
    if (optMg !== undefined && optMg > 0 && data.totalMg > optMg * 1.5) {
      const pctOpt = Math.round((data.totalMg / optMg) * 100);
      warnings.push({
        substanceId: data.displayId,
        name: nameText,
        totalDose: round2(data.totalMg),
        ul: round2(optMg),
        percentUL: pctOpt,
        severity: 'titrate',
        doseText: totalText,
        limitText: `${round2(optMg)} мг`,
        elemental: data.elemental,
        message: `↕ Суммарно ${totalText}${elementalNote} выше оптимальной (~${round2(optMg)} мг, ${pctOpt}%). Рассмотрите снижение/циклирование.`,
      });
    }
  }
  return warnings;
}

/* ════════════════════════════════════════════════════════════════════
   LAB-GUIDED DOSE ADJUSTMENT
   ════════════════════════════════════════════════════════════════════ */

export interface LabAdjustment {
  substanceId: string;
  name: string;
  originalDose: number;
  adjustedDose: number;
  multiplier: number;
  reason: string;
  labMarker: string;
  severity: 'info' | 'warning' | 'danger';
}

export function applyLabAdjustments(
  stackIds: string[],
  lab: LabCompositeResult | null | undefined
): LabAdjustment[] {
  const adjustments: LabAdjustment[] = [];
  if (!lab) return adjustments;

  // Helper: read a single lab interpretation by marker code (set by
  // lab-analysis.engine from real lab values).
  const findInterp = (code: string): { code: string; status?: string; riskPercent?: number } | undefined =>
    (lab as any).interpretations?.find((x: any) => x?.code === code);
  const statusOf = (code: string): string => {
    const i = findInterp(code);
    return i?.status || 'normal';
  };
  // Normalize interpretation status → 0..1 risk score (LabInterpretation stores
  // `risk` as a string code + `riskPercent` 0-40, so derive from status instead).
  const riskOf = (code: string): number => {
    const s = statusOf(code);
    if (s === 'critical_high') return 0.9;
    if (s === 'high' || s === 'low') return 0.6;
    return 0;
  };
  // Derived electrolyte flags — POTASSIUM now present in REFERENCE_RANGES so
  // interpretations are actually built (was previously always normal/dead).
  const potassiumHigh = statusOf('POTASSIUM') === 'high' || statusOf('POTASSIUM') === 'critical_high';
  const potassiumLow = statusOf('POTASSIUM') === 'low';
  const homaIR = typeof (lab as any).homaIR === 'number' ? (lab as any).homaIR : 0;

  for (const id of stackIds) {
    const cat = SUPPORT_CATALOG_DATA[id];
    if (!cat?.dosage?.mg) continue;
    const dose = cat.dosage.mg;
    const name = cat.nameRu || cat.name || id;
    const lc = id.toLowerCase();

    let multiplier = 1.0;
    let reason = '';
    let labMarker = '';
    let severity: LabAdjustment['severity'] = 'info';

    // Renal impairment → reduce renally-cleared supplements
    if ((lab as any).kidneyStress > 60) {
      const renalIds = ['magnesium', 'potassium', 'creatine', 'taurine', 'calcium', 'zinc', 'selenium'];
      if (renalIds.some(r => lc.includes(r))) {
        multiplier = 0.7;
        reason = 'Почечный стресс (eGFR): снижение дозы на 30%';
        labMarker = `kidneyStress: ${Math.round((lab as any).kidneyStress)}`;
        severity = 'warning';
      }
    }

    // Hepatic impairment → reduce hepatically-metabolized supplements
    if ((lab as any).liverStress > 60) {
      const hepaticIds = ['berberine', 'curcumin', 'resveratrol', 'nac', 'milk_thistle', 'alpha_lipoic', 'ashwagandha', 'tongkat_ali'];
      if (hepaticIds.some(h => lc.includes(h))) {
        multiplier = Math.min(multiplier, 0.5);
        reason = 'Печёночный стресс (ALT/AST): снижение дозы на 50%';
        labMarker = `liverStress: ${Math.round((lab as any).liverStress)}`;
        severity = 'danger';
      }
    }

    // Hyperkalemia risk → reduce potassium (derived from interpretations)
    if (potassiumHigh && lc.includes('potassium')) {
      multiplier = 0.3;
      reason = 'Гиперкалиемия: резкое снижение дозы калия';
      labMarker = 'K+ elevated';
      severity = 'danger';
    }
    // Hypokalemia → flag potassium/cramps supplements for emphasis
    if (potassiumLow && (lc.includes('potassium') || lc.includes('magnesium'))) {
      multiplier = Math.max(multiplier, 1.0);
      reason = 'Гипокалиемия: добор калия/магния под контролем анализов';
      labMarker = 'K+ low';
      severity = 'warning';
    }

    // Thyroid stress (low free T4 / high TSH / abnormal free T3) →
    // reduce thyroid-sensitive adaptogens (ashwagandha, iodine)
    if (riskOf('FREE_T4') > 0.5 || riskOf('FREE_T3') > 0.5 || riskOf('TSH') > 0.5) {
      const thyroidIds = ['ashwagandha', 'iodine', 'lithium'];
      if (thyroidIds.some(t => lc.includes(t))) {
        multiplier = Math.min(multiplier, 0.7);
        reason = 'Нарушение функции ЩЖ: снижение дозы на 30% (контроль ТТГ)';
        labMarker = `thyroid risk: ${Math.round(Math.max(riskOf('FREE_T4'), riskOf('FREE_T3'), riskOf('TSH')) * 100)}%`;
        severity = 'warning';
      }
    }

    // Glucose / HOMA-IR stress → reduce glycemia-aggravating stimulants
    if (riskOf('GLUCOSE') > 0.5 || homaIR > 2.5) {
      const glucoseIds = ['caffeine'];
      if (glucoseIds.some(g => lc.includes(g))) {
        multiplier = Math.min(multiplier, 0.5);
        reason = 'Инсулинорезистентность/гипергликемия: снижение стимуляторов на 50%';
        labMarker = homaIR > 2.5 ? `HOMA-IR: ${homaIR.toFixed(1)}` : `glucose risk: ${Math.round(riskOf('GLUCOSE') * 100)}%`;
        severity = 'warning';
      }
    }

    // Sodium imbalance → creatine draws water/Na, reduce if Na abnormal
    if (riskOf('SODIUM') > 0.5 && lc.includes('creatine')) {
      multiplier = Math.min(multiplier, 0.8);
      reason = 'Нарушение натриевого баланса: снижение креатина на 20%, контроль воды';
      labMarker = `Na risk: ${Math.round(riskOf('SODIUM') * 100)}%`;
      severity = 'warning';
    }

    // Cardio risk → reduce stimulants
    if ((lab as any).cardioRisk > 60) {
      const stimIds = ['caffeine', 'yohimbine', 'synephrine', 'dmaa', 'ephedra', 'green_tea', 'guarana'];
      if (stimIds.some(s => lc.includes(s))) {
        multiplier = 0.3;
        reason = 'Сердечно-сосудистый риск: отмена/снижение стимуляторов';
        labMarker = `cardioRisk: ${Math.round((lab as any).cardioRisk)}`;
        severity = 'danger';
      }
    }

    if (multiplier < 1.0) {
      adjustments.push({
        substanceId: id,
        name,
        originalDose: dose,
        adjustedDose: Math.round(dose * multiplier),
        multiplier,
        reason,
        labMarker,
        severity,
      });
    }
  }
  return adjustments;
}

/* ════════════════════════════════════════════════════════════════════
   NUTRIENT COMPETITION & CHELATION CHECK
   ════════════════════════════════════════════════════════════════════ */

export interface CompetitionWarning {
  idA: string; nameA: string;
  idB: string; nameB: string;
  effect: string;
  recommendation: string;
  type: 'competition' | 'chelation';
}

export function checkNutrientConflicts(stackIds: string[]): CompetitionWarning[] {
  const warnings: CompetitionWarning[] = [];

  const checkList = [...NUTRIENT_COMPETITION, ...CHELATION_PAIRS.map(c => ({
    a: c.a, b: c.b, effect: c.effect, recommendation: 'Разнести приём на 2+ часа',
  }))];

  for (const pair of checkList) {
    const idA = stackIds.find(id => id.toLowerCase().includes(pair.a));
    const idB = stackIds.find(id => id.toLowerCase().includes(pair.b));
    if (!idA || !idB) continue;
    if (idA === idB) continue;

    const nameA = SUPPORT_CATALOG_DATA[idA]?.nameRu || SUPPORT_CATALOG_DATA[idA]?.name || idA;
    const nameB = SUPPORT_CATALOG_DATA[idB]?.nameRu || SUPPORT_CATALOG_DATA[idB]?.name || idB;

    const isChelation = CHELATION_PAIRS.some(c => c.a === pair.a && c.b === pair.b);
    warnings.push({
      idA, nameA, idB, nameB,
      effect: pair.effect,
      recommendation: pair.recommendation,
      type: isChelation ? 'chelation' : 'competition',
    });
  }
  return warnings;
}

/* ════════════════════════════════════════════════════════════════════
   FAT-SOLUBLE TIMING
   ════════════════════════════════════════════════════════════════════ */

export interface TimingRecommendation {
  substanceId: string;
  name: string;
  currentTiming: string;
  recommendedTiming: 'morning' | 'afternoon' | 'evening' | 'night' | 'fasting';
  reason: string;
  type: 'fat_soluble' | 'water_soluble' | 'chelating' | 'stimulant' | 'sedative';
}

export function optimizeTiming(stackIds: string[]): TimingRecommendation[] {
  const recs: TimingRecommendation[] = [];

  for (const id of stackIds) {
    const cat = SUPPORT_CATALOG_DATA[id];
    if (!cat) continue;
    const name = cat.nameRu || cat.name || id;
    const lc = id.toLowerCase();
    const currentTiming = (cat as any)?.timingDosage || cat?.dosage?.timing || '—';

    let recTiming: TimingRecommendation['recommendedTiming'] = 'morning';
    let reason = '';
    let type: TimingRecommendation['type'] = 'water_soluble';

    // Fat-soluble → with largest meal (morning/lunch)
    if (FAT_SOLUBLE_IDS.has(id) || FAT_SOLUBLE_IDS.has(lc)) {
      recTiming = 'morning';
      reason = 'Жирорастворимый: требует приёма с жирной пищей для усвоения. Лучше с завтраком или обедом';
      type = 'fat_soluble';
    }
    // Stimulants → morning only
    else if (lc.includes('caffeine') || lc.includes('synephrine') || lc.includes('yohimbine') || lc.includes('green_tea')) {
      recTiming = 'morning';
      reason = 'Стимулятор: только утром, не позже 14:00 во избежание нарушения сна';
      type = 'stimulant';
    }
    // Sedatives/sleep aids → evening
    else if (lc.includes('melatonin') || lc.includes('ashwagandha') || lc.includes('magnesium') || lc.includes('glycine') || lc.includes('theanine') || lc.includes('gaba')) {
      recTiming = 'evening';
      reason = 'Седативный/расслабляющий эффект: оптимален вечером за 30-60 мин до сна';
      type = 'sedative';
    }
    // Testosterone boosters → morning (follows diurnal rhythm)
    else if (lc.includes('tongkat') || lc.includes('fadogia') || lc.includes('dhea') || lc.includes('boron')) {
      recTiming = 'morning';
      reason = 'Поддержка тестостерона: утренний приём соответствует циркадному пику тестостерона';
      type = 'water_soluble';
    }
    // Berberine → with meals (glucose management)
    else if (lc.includes('berberine') || lc.includes('chromium') || lc.includes('metformin')) {
      recTiming = 'morning';
      reason = 'Контроль глюкозы: принимать с едой для снижения постпрандиальной гликемии';
      type = 'water_soluble';
    }
    else { continue; }

    if (currentTiming !== '—' && currentTiming.toLowerCase().includes(recTiming)) continue;

    recs.push({ substanceId: id, name, currentTiming, recommendedTiming: recTiming, reason, type });
  }
  return recs;
}

/* ════════════════════════════════════════════════════════════════════
   ABSORPTION ENHANCER SUGGESTIONS
   ════════════════════════════════════════════════════════════════════ */

export interface EnhancerSuggestion {
  targetId: string; targetName: string;
  enhancerId: string; enhancerName: string;
  effect: string;
  inStack: boolean;
}

export function findAbsorptionEnhancers(stackIds: string[]): EnhancerSuggestion[] {
  const suggestions: EnhancerSuggestion[] = [];

  for (const pair of ABSORPTION_ENHANCERS) {
    const target = stackIds.find(id => id.toLowerCase().includes(pair.target));
    if (!target) continue;
    const enhancer = stackIds.find(id => id.toLowerCase().includes(pair.enhancer));
    const tName = SUPPORT_CATALOG_DATA[target]?.nameRu || SUPPORT_CATALOG_DATA[target]?.name || target;
    const eName = enhancer ? (SUPPORT_CATALOG_DATA[enhancer]?.nameRu || SUPPORT_CATALOG_DATA[enhancer]?.name || enhancer) : pair.enhancer;
    suggestions.push({
      targetId: target, targetName: tName,
      enhancerId: enhancer || pair.enhancer,
      enhancerName: eName,
      effect: pair.effect,
      inStack: !!enhancer,
    });
  }
  return suggestions;
}

/* ════════════════════════════════════════════════════════════════════
   DRUG-SAFETY FILTER: exclude substances with HIGH-severity drug interactions
   ════════════════════════════════════════════════════════════════════ */

export interface DrugSafetyExclusion {
  substanceId: string;
  substanceName: string;
  drug: string;
  effect: string;
  severity: string;
  mechanism: string;
}

export interface DrugSafetyTitration {
  substanceId: string;
  substanceName: string;
  drug: string;
  effect: string;
  mechanism: string;
  recommendation: string;
}

// Нормализация для сопоставления (убирает пунктуацию/подчёркивания, lower)
function normId(s: string): string {
  return s.toLowerCase().replace(/[^a-zа-яё0-9]/gi, '');
}

function interactionTokens(value: string): string[] {
  const normalized = normId(value);
  return [...new Set([
    normalized,
    normalized.replace(/^pharma/, ''),
    ...expandDrug(value).map(normId),
  ].filter(Boolean))];
}

/* ════════════════════════════════════════════════════════════════════
   DRUG ALIASES — единый источник en↔ru синонимов ЛС.
   РАНЕЕ: взаимодействия ЛС↔БАД матчились ТОЛЬКО по русским именам →
   ввод «tadalafil»/«warfarin»/«nitrates» НИКОГДА не давал предупреждения
   (жизнеугрожающие комбинации PDE5i+нитраты, варфарин+наттокиназа были
   молчаливо отключены). Теперь обе стороны (ввод пользователя и БД)
   расширяются до объединённого набора токенов и матчатся по пересечению.
   ════════════════════════════════════════════════════════════════════ */
const DRUG_ALIASES: Record<string, string[]> = {
  // ── PDE5-ингибиторы ──
  'пдэ-5 (силденафил)': ['силденафил', 'sildenafil', 'виагра', 'viagra', 'пдэ5', 'pde5'],
  'пдэ-5 (тадалафил)': ['тадалафил', 'tadalafil', 'сиалис', 'cialis', 'пдэ5', 'pde5'],
  'ваденафил': ['vardenafil', 'левитра', 'levitra'],
  // ── Нитраты ──
  'нитраты': ['nitrates', 'нитроглицерин', 'nitroglycerin', 'изосорбида', 'isosorbide', 'моночик', 'мононитрат'],
  // ── α-блокаторы ──
  'альфа-блокатор': ['альфа1-блокатор', 'alphablocker', 'doxazosin', 'доксазозин', 'тамсулозин', 'tamsulosin', 'terazosin', 'теразозин', 'prazosin', 'празозин'],
  // ── Антикоагулянты / антиагреганты ──
  'варфарин': ['warfarin'],
  'клопидогрель': ['clopidogrel', 'плавикс', 'plavix'],
  'аспирин': ['aspirin', 'ацетилсалициловая', 'acetylsalicylic'],
  'апиксабан': ['apixaban', 'эликвис', 'eliquis'],
  'дабигатран': ['dabigatran', 'прадакса', 'pradaxa'],
  'ривароксабан': ['rivaroxaban', 'ксарелто', 'xarelto'],
  'гепарин': ['heparin', 'эноксапарин', 'enoxaparin', 'клексан', 'clexane'],
  // ── СИОЗС / СИОЗСиН / ИМАО ──
  'эсциталопрам (сиозс)': ['эсциталопрам', 'escitalopram', 'ципралекс', 'cipralex', 'сиозс', 'ssri'],
  'сиозсин (венлафаксин)': ['венлафаксин', 'venlafaxine', 'сиозсин', 'snri'],
  'сиозсин (дулоксетин)': ['дулоксетин', 'duloxetine', 'сиозсин', 'snri'],
  'имао': ['maoi', 'моклобемид', 'moclobemide', 'ниаламид', 'nialamide', 'транилципромин', 'tranylcypromine', 'селегилин', 'selegiline', 'фенелзин', 'phenelzine', 'ингибитор мао'],
  // ── Сердечно-сосудистые ──
  'иапф (рамиприл)': ['рамиприл', 'ramipril', 'эналаприл', 'enalapril', 'лизиноприл', 'lisinopril', 'каптоприл', 'captopril', 'периндоприл', 'perindopril', 'квинаприл', 'quinapril', 'фозиноприл', 'fosinopril', 'иапф', 'ace inhibitor'],
  'ара (лозартан)': ['лозартан', 'losartan', 'валсартан', 'valsartan', 'ирбесартан', 'irbesartan', 'кандесартан', 'candesartan', 'телмисартан', 'telmisartan', 'эпросартан', 'eprosartan', 'ара', 'arb'],
  'β-блокаторы (бисопролол)': ['бисопролол', 'bisoprolol', 'метопролол', 'metoprolol', 'атенолол', 'atenolol', 'пропранолол', 'propranolol', 'небиволол', 'nebivolol', 'карведилол', 'carvedilol', 'бета-блокатор', 'betablocker'],
  'бкк (амлодипин)': ['амлодипин', 'amlodipine', 'фелодипин', 'felodipine', 'нифедипин', 'nifedipine', 'бкк', 'ccb'],
  'бкк (верапамил)': ['верапамил', 'verapamil', 'дилтиазем', 'diltiazem', 'бкк', 'ccb'],
  'тиазидные (гидрохлоротиазид)': ['гидрохлоротиазид', 'hydrochlorothiazide', 'хлорталидон', 'chlorthalidone', 'тиазид', 'thiazide'],
  'петлевые (фуросемид)': ['фуросемид', 'furosemide', 'торасемид', 'torasemide', 'петлевой', 'loop diuretic'],
  'калийсберегающие (спиронолактон)': ['спиронолактон', 'spironolactone', 'эплеренон', 'eplerenone', 'калийсберегающий', 'potassium sparing'],
  'амиодарон': ['amiodarone'],
  'дигоксин': ['digoxin'],
  // ── НПВС / анальгетики ──
  'нпвс (ибупрофен)': ['ибупрофен', 'ibuprofen', 'диклофенак', 'diclofenac', 'напроксен', 'naproxen', 'кетопрофен', 'ketoprofen', 'мелоксикам', 'meloxicam', 'целекоксиб', 'celecoxib', 'нпвс', 'nsaid'],
  'нпвс (диклофенак)': ['диклофенак', 'diclofenac', 'ибупрофен', 'ibuprofen', 'нпвс', 'nsaid'],
  'трамадол': ['tramadol'],
  'прегабалин': ['pregabalin', 'лирика', 'lyrica'],
  'клозапин': ['clozapine'],
  'метадон': ['methadone'],
  'бупренорфин': ['buprenorphine'],
  'триптаны (суматриптан)': ['суматриптан', 'sumatriptan', 'золмитриптан', 'zolmitriptan', 'триптан', 'triptan'],
  'дифенгидрамин': ['diphenhydramine', 'димедрол', 'dimedrol'],
  // ── Иммуносупрессоры / противоопухолевые ──
  'циклоспорин': ['cyclosporine', 'cyclosporin', 'сандиммун', 'sandimmun'],
  'такролимус': ['tacrolimus', 'програф', 'prograf'],
  'метотрексат': ['methotrexate'],
  'колхицин': ['colchicine'],
  // ── Противосудорожные / нормотимики ──
  'вальпроат': ['valproate', 'депакин', 'depakine', 'вальпроевая'],
  'карбамазепин': ['carbamazepine'],
  'топирамат': ['topiramate'],
  // ── Психотропные ──
  'оланзапин': ['olanzapine'],
  'бензодиазепины': ['benzodiazepine', 'диазепам', 'diazepam', 'клоназепам', 'clonazepam', 'феназепам', 'phenazepam', 'лоразепам', 'lorazepam'],
  'z-гипнотики (золпидем)': ['золпидем', 'zolpidem', 'амбен', 'ambien'],
  // ── Паркинсонизм ──
  'леводопа': ['levodopa', 'l-dopa', 'синемет', 'sinemet'],
  // ── Бронхолитики ──
  'сальбутамол': ['salbutamol', 'albuterol', 'вентолин', 'ventolin'],
  'теофиллин': ['theophylline'],
  // ── Антибиотики ──
  'фторхинолоны (ципрофлоксацин)': ['ципрофлоксацин', 'ciprofloxacin', 'левофлоксацин', 'levofloxacin', 'офлоксацин', 'ofloxacin', 'фторхинолон', 'fluoroquinolone'],
  'тетрациклины (доксициклин)': ['доксициклин', 'doxycycline', 'тетрациклин', 'tetracycline', 'миноциклин', 'minocycline'],
  // ── Костная ткань ──
  'алендронат': ['alendronate', 'фосамакс', 'fosamax'],
  // ── Гормональные ──
  'пероральные контрацептивы': ['oral contraceptive', 'ок', 'жанин', 'janine', 'лексинет', 'lexinet', 'ригевидон', 'rigevidon', 'ярина', 'yarinа'],
  'глюкокортикоиды (преднизолон)': ['преднизолон', 'prednisolone', 'преднизон', 'prednisone', 'метилпреднизолон', 'methylprednisolone', 'дексаметазон', 'dexamethasone', 'гкс', 'глюкокортикоид', 'glucocorticoid'],
  'левотироксин': ['левотироксин', 'levothyroxine', 'lthyroxine', 'эутирокс', 'euthyrox', 'l-тироксин', 'lt4'],
  'левтироксин': ['левотироксин', 'levothyroxine', 'эутирокс', 'euthyrox'],
  'мерказолил (тиреостатики)': ['мерказолил', 'тиамазол', 'thiamazole', 'methimazole', 'тиреостатик', 'antithyroid'],
  'бигуаниды': ['biguanide', 'метформин', 'metformin', 'сиофор', 'glucophage', 'глюкофаж'],
  'глп-1 (агонисты)': ['glp1', 'liraglutide', 'лираглутид', 'semaglutide', 'семаглутид', 'оземпик', 'ozempic', 'эксенатид', 'exenatide', 'агонист глп1', 'glp1 agonist'],
  'sglt2 (глифлозины)': ['sglt2', 'empagliflozin', 'эмпаглифлозин', 'dapagliflozin', 'дапаглифлозин', 'глифлозин', 'gliflozin'],
  // ── Прочие ──
  'ингибиторы протонной помпы': ['ppi', 'омепразол', 'omeprazole', 'эзомепразол', 'esomeprazole', 'пантопразол', 'pantoprazole', 'рабепразол', 'rabeprazole', 'ипп'],
  'инсулин': ['insulin'],
  'метформин': ['metformin', 'сиофор', 'glucophage'],
  'литий': ['lithium'],
  'орлистат': ['orlistat', 'ксеникал', 'xenical'],
  'аллопуринол': ['allopurinol'],
  'ондансетрон': ['ondansetron'],
  'домперидон': ['domperidone', 'мотилиум', 'motilium'],
  'метоклопрамид': ['metoclopramide'],
  'варениклин': ['varenicline', 'чампикс', 'champix'],
  'бупропион': ['bupropion', 'зибан', 'zyban'],
  'тенофовир': ['tenofovir'],
  'ацикловир': ['acyclovir'],
  'тизанидин': ['tizanidine'],
  'клонидин': ['clonidine'],
  'баклофен': ['baclofen'],
  'кетоконазол': ['ketoconazole'],
  'ацетазоламид': ['acetazolamide', 'диакарб', 'diacarb'],
  'изониазид': ['isoniazid'],
  'рифампицин': ['rifampicin', 'rifampin', 'рифампицин'],
  'финастерид': ['finasteride', 'проскар', 'proscar', 'проpecia', 'propecia'],
  'дутастерид': ['dutasteride', 'аводарт', 'avodart'],
  'гинкго': ['ginkgo', 'гинкго билоба', 'ginkgo biloba'],
  'чеснок': ['garlic', 'garlic_extract', 'аджоен', 'ajoene'],
  'кофеин': ['caffeine', 'кофеин'],
};

// Индекс: каждый токен (нормализованный) → объединённый набор всех вариантов
const DRUG_ALIAS_INDEX = new Map<string, string[]>();
for (const [canon, aliases] of Object.entries(DRUG_ALIASES)) {
  const all = [canon, ...aliases].map(normId);
  const set = Array.from(new Set(all));
  for (const tok of set) DRUG_ALIAS_INDEX.set(tok, set);
}

/** Расширить название ЛС до объединённого набора нормализованных токенов (en+ru). */
export function expandDrug(s: string): string[] {
  const n = normId(s);
  const hit = DRUG_ALIAS_INDEX.get(n);
  if (hit) return [...hit];
  // частичное совпадение по подстроке (напр. ввод «рамиприл» ⊂ «иапф (рамиприл)»)
  for (const [, set] of DRUG_ALIAS_INDEX) {
    if (set.some(t => t.includes(n) || n.includes(t))) return [...set];
  }
  return [n];
}

// Критичные ЛЕКАРСТВО-ЛЕКАРСТВО комбинации (оба — ЛС, не добавки)
const DRUG_DRUG_BLACKLIST: Array<{ a: string; b: string; effect: string; severity: 'HIGH'; mechanism: string }> = [
  { a: 'силденафил', b: 'нитраты', effect: 'ВЫРАЖЕННАЯ ГИПОТОНИЯ (жизнеугрожающее)', severity: 'HIGH', mechanism: 'NO/цГМФ путь — абсолютное противопоказание' },
  { a: 'тадалафил', b: 'нитраты', effect: 'ВЫРАЖЕННАЯ ГИПОТОНИЯ', severity: 'HIGH', mechanism: 'NO-доноры + PDE5 = абсолютное противопоказание' },
  { a: 'ваденафил', b: 'нитраты', effect: 'ВЫРАЖЕННАЯ ГИПОТОНИЯ', severity: 'HIGH', mechanism: 'NO/цГМФ путь — абсолютное противопоказание' },
  { a: 'альфа-блокатор', b: 'тадалафил', effect: 'Симптоматическая гипотония/коллапс', severity: 'HIGH', mechanism: 'α1-блокада + PDE5 вазодилатация' },
];

export function getDrugSafetyExclusions(
  candidateIds: string[],
  userMeds: string[]
): { excluded: DrugSafetyExclusion[]; titrations: DrugSafetyTitration[] } {
  if (!userMeds.length || !candidateIds.length) return { excluded: [], titrations: [] };
  const excluded: DrugSafetyExclusion[] = [];
  const titrations: DrugSafetyTitration[] = [];
  // Расширенные токены ЛС пользователя (en+ru алиасы) для точного матча
  const medTokens = userMeds.flatMap(m => expandDrug(m));

  // 1. КОМПРЕХЕНСИВНАЯ проверка Drug-Drug взаимодействий (новый модуль)
  const ddiBlocks = hasBlockingInteraction(userMeds, candidateIds);
  for (const ddi of ddiBlocks) {
    titrations.push({
      substanceId: '__DRUG_DRUG_BLOCK__',
      substanceName: `${ddi.drugA} + ${ddi.drugB}`,
      drug: `${ddi.drugA} + ${ddi.drugB}`,
      effect: ddi.clinicalEffect,
      mechanism: ddi.mechanism,
      recommendation: `🛑 ${ddi.severity === 'block' ? 'АБСОЛЮТНЫЙ ЗАПРЕТ' : 'КРИТИЧЕСКИЙ РИСК'}. ${ddi.management} Альтернативы: ${ddi.alternatives?.join(', ') || 'проконсультируйтесь с врачом'}.`,
    });
  }

  // 2. Существующий DRUG_DRUG_BLACKLIST (для обратной совместимости)
  for (const dd of DRUG_DRUG_BLACKLIST) {
    const aTok = expandDrug(dd.a);
    const bTok = expandDrug(dd.b);
    const hasA = medTokens.some(m => aTok.includes(m));
    const hasB = medTokens.some(m => bTok.includes(m));
    if (hasA && hasB) {
      titrations.push({
        substanceId: '__DRUG_DRUG__',
        substanceName: `${dd.a} + ${dd.b}`,
        drug: `${dd.a} + ${dd.b}`,
        effect: dd.effect,
        mechanism: dd.mechanism,
        recommendation: `🛑 АБСОЛЮТНОЕ ПРОТИВОПОКАЗАНИЕ. Немедленно проконсультируйтесь с врачом. Данную комбинацию лекарств НЕ принимайте.`,
      });
    }
  }

  // 3. Проверка Drug-Drug для всех комбинаций userMeds × userMeds (новый модуль)
  const allUserMeds = userMeds.map(m => m.toLowerCase());
  for (let i = 0; i < allUserMeds.length; i++) {
    for (let j = i + 1; j < allUserMeds.length; j++) {
      const pairDDI = getDDIForPair(allUserMeds[i], allUserMeds[j]);
      for (const ddi of pairDDI) {
        if (ddi.severity === 'block' || ddi.severity === 'critical') {
          titrations.push({
            substanceId: '__DRUG_DRUG_PAIR__',
            substanceName: `${ddi.drugA} + ${ddi.drugB}`,
            drug: `${ddi.drugA} + ${ddi.drugB}`,
            effect: ddi.clinicalEffect,
            mechanism: ddi.mechanism,
            recommendation: `🛑 ${ddi.severity === 'block' ? 'АБСОЛЮТНЫЙ ЗАПРЕТ' : 'КРИТИЧЕСКИЙ РИСК'}. ${ddi.management} Альтернативы: ${ddi.alternatives?.join(', ') || 'проконсультируйтесь с врачом'}.`,
          });
        }
      }
    }
  }

  // 4. Drug-Supplement interactions (from INTERACTIONS_DB)
  for (const subId of candidateIds) {
    const cat = SUPPORT_CATALOG_DATA[subId];
    if (!cat) continue;
    const candidateTokens = new Set([
      ...interactionTokens(subId),
      ...interactionTokens(cat.nameRu || ''),
      ...interactionTokens(cat.name || ''),
    ]);

    for (const inter of INTERACTIONS_DB) {
      const aTokens = interactionTokens(inter.substanceA);
      const bTokens = interactionTokens(inter.substanceB);
      const aIsCandidate = aTokens.some(token => candidateTokens.has(token));
      const bIsCandidate = bTokens.some(token => candidateTokens.has(token));
      // Check if this interaction involves the candidate supplement
      if (aIsCandidate === bIsCandidate) continue;

      // Determine which side is the drug and which is the supplement
      // Check if the other side matches any user medication (using drug aliases)
      const otherSide = aIsCandidate ? inter.substanceB : inter.substanceA;
      const otherTokens = interactionTokens(otherSide);
      const drugMatch = medTokens.some(tok => otherTokens.some(other => tok.includes(other) || other.includes(tok)));
      if (!drugMatch) continue;

      const drugName = otherSide;
      if (inter.severity === 'HIGH') {
        excluded.push({
          substanceId: subId,
          substanceName: cat.nameRu || cat.name || subId,
          drug: drugName,
          effect: inter.effect,
          severity: inter.severity,
          mechanism: (inter.mechanisms || []).join('; '),
        });
      } else {
        titrations.push({
          substanceId: subId,
          substanceName: cat.nameRu || cat.name || subId,
          drug: drugName,
          effect: inter.effect,
          mechanism: (inter.mechanisms || []).join('; '),
          recommendation: `⚠ Снизить дозу и контролировать анализы (риск ${inter.severity}). ${inter.effect}`,
        });
      }
    }
  }
  return { excluded, titrations };
}

export function getSafeStackRecommendations(
  allRecommended: string[],
  userMeds: string[]
): { safe: string[]; excluded: DrugSafetyExclusion[]; titrations: DrugSafetyTitration[] } {
  const { excluded, titrations } = getDrugSafetyExclusions(allRecommended, userMeds);
  const excludeIds = new Set(excluded.map(e => e.substanceId));
  const safe = allRecommended.filter(id => !excludeIds.has(id));
  return { safe, excluded, titrations };
}

/* ════════════════════════════════════════════════════════════════════
   TELEGRAM REMINDER SCHEDULING
   ════════════════════════════════════════════════════════════════════ */

export interface ReminderConfig {
  morningTime: string;   // '08:00'
  eveningTime: string;   // '20:00'
  enabled: boolean;
}

const REMINDER_KEY = 'he_biostack_reminders';

export function getReminderConfig(): ReminderConfig {
  try {
    const raw = localStorage.getItem(REMINDER_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { morningTime: '08:00', eveningTime: '20:00', enabled: false };
}

export function saveReminderConfig(config: ReminderConfig): void {
  localStorage.setItem(REMINDER_KEY, JSON.stringify(config));
}

export function scheduleTelegramReminder(config: ReminderConfig): void {
  if (!config.enabled) return;
  try {
    const tg = (window as any).Telegram?.WebApp;
    if (!tg) return;

    const now = new Date();
    const [mh, mm] = config.morningTime.split(':').map(Number);
    const [eh, em] = config.eveningTime.split(':').map(Number);
    const morningTarget = new Date(now); morningTarget.setHours(mh, mm, 0, 0);
    const eveningTarget = new Date(now); eveningTarget.setHours(eh, em, 0, 0);

    if (now < morningTarget) {
      const msUntil = morningTarget.getTime() - now.getTime();
      setTimeout(() => {
        tg.showPopup?.({ title: '💊 BioStack', message: 'Утренний приём БАДов! Отметьте compliance в стеке.', buttons: [{ type: 'ok' }] });
        tg.HapticFeedback?.notificationOccurred?.('warning');
      }, msUntil);
    }
    if (now < eveningTarget) {
      const msUntil = eveningTarget.getTime() - now.getTime();
      setTimeout(() => {
        tg.showPopup?.({ title: '💊 BioStack', message: 'Вечерний приём БАДов! Проверьте стек.', buttons: [{ type: 'ok' }] });
        tg.HapticFeedback?.notificationOccurred?.('warning');
      }, msUntil);
    }
  } catch {}
}
