/**
 * support-plan/substances.ts — построение PlanSubstance[] и schedule.
 */

import { DEFAULT_DOSAGES } from '../../data/support-database';
import { formatDefaultDose, naturalFromMg, IU_PER_MCG_VITAMIN_D } from '../../data/dose-units';
import type { CalculatorResult, PlanSubstance } from './types';
import { catalogEntry, NUTRIENT_UL, NUTRIENT_UL_ALIAS, NUTRIENT_LIMIT_INFO, PLAN_DOSED_NUTRIENTS } from './types';
import { canonId } from './shared-constants';
import { getBrandName, getSubstancePriorityAny } from '../../data/lab-priority-map';
import { getEvidenceLevel, getProtocolRefs } from '../../data/support-dosing';
import { getEvidenceDosage } from '../../data/evidence-dosage-db';

// ═══════════════════════════════════════════════════════════════
//  WEIGHT_BASED_DOSING — дозировки, зависящие от веса тела
// ═══════════════════════════════════════════════════════════════
const WEIGHT_BASED_DOSING: Record<string, { mgPerKg: number; minMg: number; maxMg: number }> = {
  nac: { mgPerKg: 15, minMg: 600, maxMg: 1800 },
  omega3: { mgPerKg: 50, minMg: 2000, maxMg: 6000 },
  vitamin_c: { mgPerKg: 10, minMg: 500, maxMg: 1500 },
  // Магний — элементарный: 2.5 мг/кг даёт 200 мг при 80 кг (как DEFAULT_DOSAGES),
  // а потолок 350 мг = UL реестра. Раньше здесь было 6 мг/кг с max 800 →
  // план рекомендовал 480 мг при обычной массе (137% UL) и спорил с собственной
  // базовой дозой; UL-контур честно это показал (проход 13).
  magnesium: { mgPerKg: 2.5, minMg: 200, maxMg: 350 },
  taurine: { mgPerKg: 20, minMg: 1000, maxMg: 3000 },
  glycine: { mgPerKg: 40, minMg: 1000, maxMg: 5000 },
  alpha_lipoic: { mgPerKg: 5, minMg: 300, maxMg: 800 },
  coq10: { mgPerKg: 3, minMg: 100, maxMg: 400 },
  // Цинк: IOM UL 40 мг — жёсткий предел (выше → дефицит меди), поэтому max = UL.
  zinc: { mgPerKg: 0.5, minMg: 15, maxMg: 40 },
};

/**
 * Вес-дозы для МИКРОГРАММОВЫХ нутриентов (D3, Se) — таблица в мкг, а не в мг:
 * 0.0007 мг/кг читать невозможно, а `naturalFromMg` молча пересчитывал бы не то.
 * Потолки = UL реестра (`NUTRIENT_UL`), поэтому вес не может вывести за предел.
 */
const WEIGHT_BASED_DOSING_MCG: Record<string, { mcgPerKg: number; minMcg: number; maxMcg: number }> = {
  // 50 мкг = 2000 МЕ при 70 кг (как базовая DEFAULT_DOSAGES), рост до UL 100 мкг = 4000 МЕ.
  vitamin_d3: { mcgPerKg: 50 / 70, minMcg: 50, maxMcg: 100 },
  // Селен весом НЕ дозируется. Правило 50 мкг/70 кг давало 57 мкг при 80 кг —
  // третье число, которого нет ни в одном реестре: `DEFAULT_DOSAGES` и каталог
  // держат 200 мкг. Вес-таблица перебивала оба и занижала дозу в 3.5 раза;
  // потолок реестра (255 мкг) остаётся в `NUTRIENT_UL` и применяется в
  // `applyTitration`, поэтому отдельная вес-строка не нужна.
};

// ═══════════════════════════════════════════════════════════════
//  SUBSTANCE_REASONS — однострочное обоснование для каждого вещества
// ═══════════════════════════════════════════════════════════════
const SUBSTANCE_REASONS: Record<string, string> = {
  nac: 'Гепатопротекция: ↑ глутатион, связывает токсичные метаболиты ААС',
  tudca: 'Гепатопротекция: ↓ ER-стресс, улучшает желчеотток (BSEP)',
  milk_thistle: 'Гепатопротекция: стабилизация мембран гепатоцитов',
  alpha_lipoic: 'Антиоксидант: Nrf2-активация, регенерация витаминов C/E',
  omega3: 'ССС: ↓ ТГ 20-30%, ↑ ЛПВП, антиатерогенный эффект',
  vitamin_d3: 'Иммунитет: VDR-агонизм, ↑ тестостерон, минерализация костей',
  vitamin_k2: 'ССС: ↓ кальцификации сосудов (MGP), ↑ остеокальцин',
  vitamin_c: 'Антиоксидант: кофактор синтеза коллагена, ↓ окислительного стресса',
  vitamin_e: 'Антиоксидант: защита мембран от перекисного окисления',
  magnesium: 'ССС: ↓ QT, ↓ аритмий, электролитный баланс',
  zinc: 'Репродукция: кофактор стероидогенеза, ↓ ароматазы',
  coq10: 'Митохондрии: ↓ окислительного стресса миокарда, ↑ АТФ',
  serrapeptase: 'Фибринолиз: расщепление α2-макроглобулина, ↑ текучесть крови',
  nattokinase: 'Фибринолиз: прямая активация плазминогена, ↓ вязкости',
  naringin: 'Реология: ингибиция агрегации тромбоцитов, ↓ вязкости',
  lumbrokinase: 'Фибринолиз: мощный плазминоген-активатор, ↓ фибриногена',
  bergamot: 'Липиды: ингибиция HMG-CoA редуктазы (натуральный статин)',
  berberine: 'Метаболизм: AMPK-активация, ↑ рецепторы ЛПНП',
  telmisartan: 'ССС: ARB, ↓ АД, ↓ гипертрофии ЛЖ',
  nebivolol: 'ССС: β1-блокада + NO-модуляция, ↓ ЧСС',
  diosmin: 'ССС: венотоник, ↓ растяжимости вен',
  dim: 'Эстрадиол: сдвиг метаболизма E2 → 2-OH (защитный путь)',
  vitex: 'Пролактин: D2-агонист, ↓ пролактина',
  p5p: 'Пролактин: кофактор дофамина, ↓ пролактина',
  taurine: 'Нейро: осморегуляция, защита миокарда от гипогликемии',
  pqq: 'Нейро: митохондриальный биогенез, ↑ NGF',
  lithium: 'Нейро: ↓ возбудимости, нейропротекция',
  glycine: 'Нейро: ↑ ГАМК, ↓ кортизола, улучшение сна',
  lions_mane: 'Нейро: ↑ NGF, восстановление миелина',
  theanine: 'Нейро: ↑ ГАМК, ↓ тревожности, α-волны',
  tyrosine: 'Нейро: предшественник дофамина/норадреналина',
  ashwagandha: 'Адаптоген: ↓ кортизола, ↑ тестостерона',
  astragalus: 'Почки: ↓ протеинурии, антиоксидант гепатоцитов',
  cordyceps: 'Почки: нефропротекция, ↓ гиперфильтрации клубочков',
  hcg: 'Репродукция: ↑ эндогенный T, профилактика атрофии яичек',
  anastrozole: 'Эстрадиол: ингибиция ароматазы, ↓ E2',
  cabergoline: 'Пролактин: D2-агонист, ↓ пролактина',
  folate: 'Метилирование: ↓ гомоцистеина, кофактор метилирования',
  methylcobalamin: 'Нейро: миелинизация, ↓ гомоцистеина',
  tmg: 'Метилирование: донатор метильных групп, ↓ гомоцистеина',
  niacin: 'Липиды: ↑ ЛПВП +15-35%, ↓ ЛПНП',
  vitamin_b6: 'Нейро: кофактор серотонина/дофамина',
  glutamine: 'ЖКТ: репарация энтероцитов, ↑ барьер',
  calcium: 'Кости: минерализация, ↓ судорог',
  potassium: 'ССС: электролит, ↓ аритмий',
  boron: 'Репродукция: ↑ T через ↓ SHBG',
  selenium: 'Антиоксидант: селенопротеины, ↑ глутатионпероксидаза',
  aspirin: 'ССС: ↓ агрегации тромбоцитов, ↓ тромбоз',
  celery_extract: 'ССС: апигенин, ↓ АД, диуретик',
  glutathione: 'Антиоксидант: прямое восполнение GSH',
};

const FOUNDATION_ITEMS: Record<
  string,
  { name: string; dose: string; timing: string; reason: string; kind: 'lifestyle' | 'mineral' }
> = {
  hydration: {
    name: 'Гидратация',
    dose: '40–45 мл/кг/сут',
    timing: 'в течение дня',
    reason: 'Поддержка объёма плазмы и снижение гемоконцентрации',
    kind: 'lifestyle',
  },
  cardio_aerobic: {
    name: 'Кардио (аэробная нагрузка)',
    dose: '30–45 мин, 5×/нед',
    timing: 'отдельно от силовой',
    reason: 'Эндотелиальная и реологическая поддержка',
    kind: 'lifestyle',
  },
  electrolyte_balance: {
    name: 'Электролиты Na/K/Mg',
    dose: 'по рациону и анализам',
    timing: 'с водой/едой',
    reason: 'Водно-электролитный баланс; K⁺ только с учётом eGFR/лекарств',
    kind: 'mineral',
  },
  daily_steps: {
    name: 'Бытовая активность (10 000+ шагов)',
    dose: '10 000–12 000 шагов/день',
    timing: 'в течение дня',
    reason: 'NEAT-активность: реология, эндотелий, липиды',
    kind: 'lifestyle',
  },
  no_smoking: {
    name: 'Отказ от курения',
    dose: 'полный отказ',
    timing: 'постоянно',
    reason: 'Эндотелий, гемоконцентрация (CO-Hb), атерогенный риск',
    kind: 'lifestyle',
  },
  no_alcohol: {
    name: 'Отказ от алкоголя',
    dose: 'полный отказ на курсе',
    timing: 'постоянно',
    reason: 'Печень (ГГТ/ЩФ/жир), липиды, АД, ЦНС',
    kind: 'lifestyle',
  },
};

export const NON_PILL_SUPPORT_IDS = new Set(Object.keys(FOUNDATION_ITEMS));

/**
 * Части дозы плана — один резолвер для `buildSubstances` и UL-контура движка.
 *
 * Раньше дозу плана знал только `buildSubstances`, а `checkUpperLimits` получал
 * карту титрации `applyTitration`, где половины веществ нет вовсе (B6, витамин A,
 * K2, фолат, бор, медь, железо). UL считался по одной дозе, а подписывался под
 * другой — или не считался совсем.
 */
function planDoseParts(
  id: string,
  weight?: number,
): {
  doseMg: number;
  wbdMg?: number;
  wbdMcg?: number;
  def?: { mg: number; timing: string };
  catalogDose?: number;
} {
  const cid = canonId(id);
  const e = catalogEntry(id);
  // Канонизация: алиасы (udca→tudca, telmi→telmisartan…) хранят дозу под каноническим id.
  const def = DEFAULT_DOSAGES[cid] || DEFAULT_DOSAGES[id];
  // Есть ли РЕАЛЬНАЯ доза в справочнике (не фолбэк 500 мг ниже).
  const catalogDose = e?.dosage?.mg && e.dosage.mg > 0 ? e.dosage.mg : undefined;
  // Weight-based dosing — считается в МГ (таблица выше в мг).
  const wbd = WEIGHT_BASED_DOSING[cid];
  const wbdMg =
    wbd && weight && weight > 0
      ? Math.round(Math.max(wbd.minMg, Math.min(wbd.maxMg, weight * wbd.mgPerKg)))
      : undefined;
  // Микрограммовые нутриенты (D3, Se) — отдельная таблица в мкг.
  const wbdMcgRule = WEIGHT_BASED_DOSING_MCG[cid];
  const wbdMcg =
    wbdMcgRule && weight && weight > 0
      ? Math.round(Math.max(wbdMcgRule.minMcg, Math.min(wbdMcgRule.maxMcg, weight * wbdMcgRule.mcgPerKg)))
      : undefined;
  // ВНУТРЕННЯЯ доза плана — всегда НАТУРАЛЬНАЯ единица вещества (мкг для
  // селена/биотина, МЕ для D3), как в `DEFAULT_DOSAGES`: `dosages[id].mg`
  // и `PlanSubstance.doseMg` читатели подписывают через `formatDefaultDose`.
  // Раньше мг-фолбэк каталога (biotin 5 мг) попадал сюда без пересчёта и
  // отображался как «5 мкг» — 1000× ниже реальной дозы.
  const doseMg =
    wbdMcg !== undefined
      ? naturalFromMg(cid, wbdMcg / 1000)
      : wbdMg !== undefined
        ? naturalFromMg(cid, wbdMg)
        : def
          ? def.mg
          : catalogDose !== undefined
            ? naturalFromMg(cid, catalogDose)
            : // Нет дозы ни в одном реестре — 0 и «по инструкции» в карточке.
              // Прежний фолбэк 500 мг был выдуманным числом (P3 аудита).
              0;
  return { doseMg, wbdMg, wbdMcg, def, catalogDose };
}

/**
 * Доза, которую план реально рекомендует (натуральная единица вещества).
 * Экспортируется для UL-контура: проверять нужно ровно то, что видит пользователь.
 */
/**
 * Лаб-титрация: базовая доза × множитель ступени (`TierTitration.factor`).
 * Округление: ≥10 — до целого (мг/МЕ), <10 — до сотых (0.5 мг препаратов).
 * `undefined`/1 — доза не меняется.
 */
export function planDoseWithTitration(base: number, factor?: number): number {
  if (!(base > 0) || !factor || !Number.isFinite(factor) || factor === 1) return base;
  const scaled = base * factor;
  return scaled >= 10 ? Math.round(scaled) : Math.round(scaled * 100) / 100;
}

/** Множитель лаб-ступени по id; алиасы канонизируются, как везде в плане. */
export function titrationFactorOf(factors: Map<string, number> | undefined, id: string): number | undefined {
  if (!factors) return undefined;
  return factors.get(canonId(id)) ?? factors.get(id);
}

/**
 * Доказательная база дозы из двух реестров (E5). Уровень — `support-dosing`
 * (`A/B/C`), ссылки — `EVIDENCE_DOSAGES.references` или `support-dosing.refs`.
 * Оба реестра до этого прохода читались только в UI-калькуляторах, поэтому
 * план не мог ответить «почему эта доза». Нет записи — `undefined`, не «A».
 */
function evidenceFor(id: string, cid: string): { level?: string; refs?: string[] } | undefined {
  // `support-dosing` канонизирует id сам, `evidence-dosage-db` — нет: для `udca`
  // запись лежит под `tudca`, поэтому второй попытки по канону не избежать.
  const level = getEvidenceLevel(id) || getEvidenceLevel(cid);
  const doseDbRefs = getEvidenceDosage(id)?.references || getEvidenceDosage(cid)?.references || [];
  const protocolRefs = getProtocolRefs(id).length > 0 ? getProtocolRefs(id) : getProtocolRefs(cid);
  const refs = doseDbRefs.length > 0 ? doseDbRefs : protocolRefs;
  if (!level && refs.length === 0) return undefined;
  return { level, refs: refs.length > 0 ? refs : undefined };
}

/**
 * Потолок дозы для карточки/расписания — только там, где его ставит
 * `applyTitration` (`PLAN_DOSED_NUTRIENTS`): иначе карточка показывала цинк
 * 60 мг при UL 40, а в приём уходило 40; D3 9120 МЕ при UL 4000.
 * Клинические ориентиры (`ClinicalGuidance`) и B6/P5P не капаются — у них
 * превышение остаётся предупреждением, а не подменой числа.
 */
function capPlanDoseAtUl(id: string, natural: number): number {
  if (!(natural > 0)) return natural;
  const cid = canonId(id);
  if (!(PLAN_DOSED_NUTRIENTS as readonly string[]).includes(cid)) return natural;
  const key = NUTRIENT_UL_ALIAS[cid] || NUTRIENT_UL_ALIAS[id] || cid;
  const ul = NUTRIENT_UL[key];
  if (!(ul > 0)) return natural;
  const kind = NUTRIENT_LIMIT_INFO[key]?.kind || 'UL';
  if (kind === 'ClinicalGuidance' || kind === 'NotEstablished') return natural;
  const isD = cid === 'vitamin_d3' || cid === 'vitamin_d';
  const inUl = isD ? natural / IU_PER_MCG_VITAMIN_D : natural;
  if (inUl <= ul) return natural;
  return isD ? Math.round(ul * IU_PER_MCG_VITAMIN_D) : ul;
}

/** Препараты, чья доза в плане — формула приложения, а не назначение. */
const FORMULA_DOSED_MEDS = new Set(['telmisartan', 'nebivolol', 'anastrozole', 'cabergoline']);
const FORMULA_DOSE_NOTE = 'Расчёт приложения, не назначение: дозу препарата определяет врач.';

/**
 * Доза и время приёма для карточки вещества — ТОТ ЖЕ резолвер, что у плана
 * (`planDoseParts`), поэтому карточка каталога и карточка плана не могут
 * показать разные числа. Раньше `subDosage` в UI предпочитала дозу каталога
 * (`tudca 500`), а план — справочник (`tudca 1000`).
 * `null` — дозы нет ни в справочнике, ни в каталоге, ни в вес-таблице.
 */
export function resolvePlanSubstanceDose(
  id: string,
  weight?: number,
  titrationFactors?: Map<string, number>,
): { mg: number; timing: string } | null {
  const parts = planDoseParts(id, weight);
  const mg = capPlanDoseAtUl(id, planDoseWithTitration(parts.doseMg, titrationFactorOf(titrationFactors, id)));
  if (!(mg > 0)) return null;
  const timing = parts.def?.timing || catalogEntry(id)?.dosage?.timing || 'с едой';
  return { mg, timing };
}

/**
 * Доза, которую план реально рекомендует (натуральная единица вещества).
 * Экспортируется для UL-контура: проверять нужно ровно то, что видит пользователь.
 * `titrationFactors` — множители лаб-ступеней: без них обоснование говорило
 * «×2 по ALT», а рядом стояла базовая доза.
 */
export function resolvePlanDose(id: string, weight?: number, titrationFactors?: Map<string, number>): number {
  return planDoseWithTitration(planDoseParts(id, weight).doseMg, titrationFactorOf(titrationFactors, id));
}

/**
 * Доза для ЭКРАНА: та же база и тот же лаб-множитель, но с UL-капом.
 * Один вызов для карточки, расписания и экспортов «Копировать»/«Врачу».
 */
export function resolvePlanDoseDisplay(
  id: string,
  weight?: number,
  titrationFactors?: Map<string, number>,
): number {
  return capPlanDoseAtUl(id, resolvePlanDose(id, weight, titrationFactors));
}

/**
 * Преобразует список id веществ в PlanSubstance[] (с dedup по canonId).
 * Берёт display-инфо из каталога SUPPORT_CATALOG_DATA, дозировки из DEFAULT_DOSAGES.
 * Если передан weight — применяет вес-зависимые дозировки.
 */
export function buildSubstances(
  ids: string[],
  _tzRes: CalculatorResult,
  tags?: { boostAdded?: string[]; jointSubs?: string[]; neuroSubs?: string[] },
  weight?: number,
  /** Множители лаб-ступеней (`computeTierAdjustments`): доза карточки = база × фактор. */
  titrationFactors?: Map<string, number>,
): PlanSubstance[] {
  const boostSet = new Set(tags?.boostAdded || []);
  const jointSet = new Set(tags?.jointSubs || []);
  const neuroSet = new Set(tags?.neuroSubs || []);
  const seen = new Set<string>();
  const seenCanon = new Set<string>();
  const out: PlanSubstance[] = [];
  for (const id of ids) {
    const cid = canonId(id);
    if (seen.has(id) || seenCanon.has(cid)) continue;
    seen.add(id);
    seenCanon.add(cid);
    const e = catalogEntry(id);
    const parts = planDoseParts(id, weight);
    const foundation = FOUNDATION_ITEMS[cid];
    // Доза — один резолвер и одна единица: натуральная (мкг селена, МЕ D3,
    // млрд КОЕ пробиотиков). Единицу даёт `defaultDoseUnit(id)`, а не текст
    // `timing`: раньше «мкг/МЕ» жили в прозе, и новое вещество молча
    // подписывалось «мг». Лаб-титрация применяется здесь же — карточка,
    // расписание и UL-контур читают одно число.
    const doseMg = capPlanDoseAtUl(id, planDoseWithTitration(parts.doseMg, titrationFactorOf(titrationFactors, id)));
    const doseDisplay = foundation?.dose || (doseMg > 0 ? formatDefaultDose(cid, doseMg) : 'по инструкции');
    const evidence = evidenceFor(id, cid);
    const entry = {
      id,
      name: foundation?.name || e?.nameRu || e?.name || id,
      evidence,
      doseDisclaimer: FORMULA_DOSED_MEDS.has(cid) ? FORMULA_DOSE_NOTE : undefined,
      doseMg,
      doseDisplay,
      timing: foundation?.timing || parts.def?.timing || e?.dosage?.timing || e?.forms?.[0]?.dose || 'с едой',
      category: foundation ? [foundation.kind] : e?.category || [],
      tier: e?.tier || 'standard',
      targetSystems: e?.systems || [],
      comment: e?.description || '',
      mechanismReason: foundation?.reason || SUBSTANCE_REASONS[cid] || e?.mechanismOfAction || e?.mechanisms?.[0] || '',
      fromJoint: jointSet.has(id),
      fromBoost: boostSet.has(id),
      fromNeuro: neuroSet.has(id),
      kind: foundation?.kind || (e?.category?.includes('pharma') ? 'medicine' : 'supplement'),
    } as PlanSubstance;
    const brand = getBrandName(id);
    if (brand) entry.brandName = brand;
    const prio = getSubstancePriorityAny(id);
    if (prio) entry.priority = prio;
    out.push(entry);
  }
  return out;
}

// ─── Schedule (morning/afternoon/evening) ───
const MORNING_GROUP = new Set([
  'vitamin_c',
  'vitamin_d3',
  'vitamin_e',
  'coq10',
  'alpha_lipoic',
  'selenium',
  'boron',
  'zinc',
  'telmisartan',
  'nebivolol',
  'ashwagandha',
  'calcium',
  'vitamin_k2',
  'probiotics',
  'anastrozole',
  'cabergoline',
  'hcg',
  'curcumin',
  'dhea',
  'pregnenolone',
  'collagen',
  'melatonin',
  'l_citrulline',
  'DIM',
  'saw_palmetto',
  'b12',
  'folate',
  'betaine',
]);
const AFTERNOON_GROUP = new Set([
  'berberine',
  'bromelain',
  'nattokinase',
  'magnesium',
  'potassium',
  'artichoke',
  'bile_acids',
  'omega3',
  'glucosamine',
  'msm',
  'boswellia',
  'chondroitin_sulfate',
  'taurine',
  'inositol',
  'piperine',
  'reishi',
  'maitake',
  'shilajit',
  'chaga',
  'cordyceps',
  'lions_mane',
]);
const EVENING_GROUP = new Set([
  'nac',
  'tudca',
  'milk_thistle',
  'glycine',
  'theanine',
  'gaba',
  'tyrosine',
  'l_dopa',
  'x5htp',
  'vitamin_b6',
  'astragalus',
  'celery_extract',
  'glutathione',
  'bergamot',
  'red_yeast',
  'aspirin',
  'tamoxifen',
  '5htp',
  'hyaluronic_acid',
  'bpc157',
  'tb500',
]);

function timeOf(id: string): 'morning' | 'afternoon' | 'evening' {
  if (MORNING_GROUP.has(id)) return 'morning';
  if (AFTERNOON_GROUP.has(id)) return 'afternoon';
  if (EVENING_GROUP.has(id)) return 'evening';
  return 'morning';
}

/**
 * Расписание приёма из ГОТОВОГО плана (`PlanSubstance[]`).
 *
 * Карточка плана и «Расписание приёма» (`WeeklyPlanView`) обязаны показывать одну
 * и ту же дозу. Раньше `PlanResult.schedule` собирался повторным резолвом
 * `DEFAULT_DOSAGES` (без веса): при 140 кг карточка показывала магний 350 мг
 * (2.5 мг/кг), а расписание — 200 мг из справочника.
 *
 * Старый `buildSchedule(ids)` (вторая модель доз `DEFAULT_DOSAGES` без веса)
 * удалён в двадцатом проходе: его использовали только юнит-тесты, а прод-путь
 * (`index.ts`) с прохода 17 строит расписание из карточки плана.
 */
export function buildScheduleFromPlan(
  subs: PlanSubstance[],
): Array<{ timeBlock: string; substances: Array<{ id: string; name: string; dose: string; instructions: string }> }> {
  const blocks: Record<
    'morning' | 'afternoon' | 'evening',
    Array<{ id: string; name: string; dose: string; instructions: string }>
  > = {
    morning: [],
    afternoon: [],
    evening: [],
  };
  for (const s of subs) {
    const block = timeOf(canonId(s.id));
    blocks[block].push({
      id: s.id,
      name: s.name,
      dose: s.doseDisplay || 'по инструкции',
      instructions: block === 'morning' ? 'С завтраком' : block === 'afternoon' ? 'С обедом' : 'За 1-2 ч до сна',
    });
  }
  return (['morning', 'afternoon', 'evening'] as const).map((b) => ({ timeBlock: b, substances: blocks[b] }));
}

// ─── Week scale (titration) ───
export function computeWeekScale(week: number | undefined): number {
  const w = week ?? 1;
  if (w <= 2) return 0.5;
  if (w <= 4) return 0.75;
  if (w <= 6) return 0.9;
  return 1.0;
}
