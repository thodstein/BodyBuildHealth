/**
 * support-plan/substances.ts — построение PlanSubstance[] и schedule.
 */

import { DEFAULT_DOSAGES } from '../../data/support-database';
import type { CalculatorResult, PlanSubstance } from './types';
import { catalogEntry } from './types';
import { canonId } from './shared-constants';
import { getBrandName, getSubstancePriorityAny } from '../../data/lab-priority-map';

// ═══════════════════════════════════════════════════════════════
//  WEIGHT_BASED_DOSING — дозировки, зависящие от веса тела
// ═══════════════════════════════════════════════════════════════
const WEIGHT_BASED_DOSING: Record<string, { mgPerKg: number; minMg: number; maxMg: number }> = {
  nac:          { mgPerKg: 15,  minMg: 600,  maxMg: 1800 },
  omega3:       { mgPerKg: 50,  minMg: 2000, maxMg: 6000 },
  vitamin_c:    { mgPerKg: 10,  minMg: 500,  maxMg: 1500 },
  magnesium:    { mgPerKg: 6,   minMg: 300,  maxMg: 800  },
  taurine:      { mgPerKg: 20,  minMg: 1000, maxMg: 3000 },
  glycine:      { mgPerKg: 40,  minMg: 1000, maxMg: 5000 },
  alpha_lipoic: { mgPerKg: 5,   minMg: 300,  maxMg: 800  },
  coq10:        { mgPerKg: 3,   minMg: 100,  maxMg: 400  },
  zinc:         { mgPerKg: 0.5, minMg: 15,   maxMg: 50   },
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

const FOUNDATION_ITEMS: Record<string, { name: string; dose: string; timing: string; reason: string; kind: 'lifestyle' | 'mineral' }> = {
  hydration: { name: 'Гидратация', dose: '40–45 мл/кг/сут', timing: 'в течение дня', reason: 'Поддержка объёма плазмы и снижение гемоконцентрации', kind: 'lifestyle' },
  cardio_aerobic: { name: 'Кардио (аэробная нагрузка)', dose: '30–45 мин, 5×/нед', timing: 'отдельно от силовой', reason: 'Эндотелиальная и реологическая поддержка', kind: 'lifestyle' },
  electrolyte_balance: { name: 'Электролиты Na/K/Mg', dose: 'по рациону и анализам', timing: 'с водой/едой', reason: 'Водно-электролитный баланс; K⁺ только с учётом eGFR/лекарств', kind: 'mineral' },
};

export const NON_PILL_SUPPORT_IDS = new Set(Object.keys(FOUNDATION_ITEMS));

/**
 * Преобразует список id веществ в PlanSubstance[] (с dedup по canonId).
 * Берёт display-инфо из каталога SUPPORT_CATALOG_DATA, дозировки из DEFAULT_DOSAGES.
 * Если передан weight — применяет вес-зависимые дозировки.
 */
export function buildSubstances(
  ids: string[],
  _tzRes: CalculatorResult,
  tags?: { boostAdded?: string[]; jointSubs?: string[]; neuroSubs?: string[] },
  weight?: number
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
    const def = DEFAULT_DOSAGES[id];
    // Weight-based dosing
    let doseMg = def?.mg ?? e?.dosage?.mg ?? (FOUNDATION_ITEMS[cid] ? 0 : 500);
    const wbd = WEIGHT_BASED_DOSING[cid];
    if (wbd && weight && weight > 0) {
      doseMg = Math.round(Math.max(wbd.minMg, Math.min(wbd.maxMg, weight * wbd.mgPerKg)));
    }
    const foundation = FOUNDATION_ITEMS[cid];
    const doseDisplay = foundation?.dose || (doseMg >= 1000
      ? `${(doseMg / 1000).toFixed(1)} г`
      : `${doseMg} мг`);
    const entry = {
      id,
      name: foundation?.name || e?.nameRu || e?.name || id,
      doseMg,
      doseDisplay: foundation?.dose || ((def && !wbd) || !e?.dosage?.mg
        ? doseDisplay
        : (e.dosage.mg > 0 ? doseDisplay : 'по инструкции')),
      timing: foundation?.timing || def?.timing || e?.dosage?.timing || e?.forms?.[0]?.dose || 'с едой',
      category: foundation ? [foundation.kind] : (e?.category || []),
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
  'vitamin_c','vitamin_d3','vitamin_e','coq10','alpha_lipoic','selenium','boron','zinc',
  'telmisartan','nebivolol','ashwagandha','calcium','vitamin_k2','probiotics',
  'anastrozole','cabergoline','hcg','curcumin','dhea','pregnenolone','collagen',
  'melatonin','l_citrulline','DIM','saw_palmetto','b12','folate','betaine',
]);
const AFTERNOON_GROUP = new Set([
  'berberine','bromelain','nattokinase','magnesium','potassium','artichoke','bile_acids',
  'omega3','glucosamine','msm','boswellia','chondroitin_sulfate','taurine','inositol',
  'piperine','reishi','maitake','shilajit','chaga','cordyceps','lions_mane',
]);
const EVENING_GROUP = new Set([
  'nac','tudca','milk_thistle','glycine','theanine','gaba','tyrosine','l_dopa',
  'x5htp','vitamin_b6','astragalus','celery_extract','glutathione','bergamot',
  'red_yeast','aspirin','tamoxifen','5htp','hyaluronic_acid','bpc157','tb500',
]);

function timeOf(id: string): 'morning' | 'afternoon' | 'evening' {
  if (MORNING_GROUP.has(id)) return 'morning';
  if (AFTERNOON_GROUP.has(id)) return 'afternoon';
  if (EVENING_GROUP.has(id)) return 'evening';
  return 'morning';
}

/**
 * Распределение веществ по времени приёма (утро/день/вечер).
 * Для каждого вещества: id, name, dose, instructions.
 */
export function buildSchedule(
  ids: string[]
): Array<{ timeBlock: string; substances: Array<{ id: string; name: string; dose: string; instructions: string }> }> {
  const blocks: Record<'morning' | 'afternoon' | 'evening', Array<{ id: string; name: string; dose: string; instructions: string }>> = {
    morning: [], afternoon: [], evening: [],
  };
  const seen = new Set<string>();
  const seenCanon = new Set<string>();
  for (const id of ids) {
    const cid = canonId(id);
    if (seen.has(id) || seenCanon.has(cid)) continue;
    seen.add(id);
    seenCanon.add(cid);
    const e = catalogEntry(id);
    const def = DEFAULT_DOSAGES[id];
    const foundation = FOUNDATION_ITEMS[cid];
    if (foundation) {
      blocks.morning.push({ id, name: foundation.name, dose: foundation.dose, instructions: foundation.timing });
      continue;
    }
    const name = e?.nameRu || e?.name || id;
    const dose = def
      ? (def.mg >= 1000 ? `${(def.mg / 1000).toFixed(1)} г` : `${def.mg} мг`)
      : (e?.dosage?.mg ? `${e.dosage.mg} мг` : 'по инструкции');
    const block = timeOf(id);
    blocks[block].push({
      id, name, dose,
      instructions: block === 'morning' ? 'С завтраком' : block === 'afternoon' ? 'С обедом' : 'За 1-2 ч до сна',
    });
  }
  return (['morning', 'afternoon', 'evening'] as const).map(b => ({ timeBlock: b, substances: blocks[b] }));
}

// ─── Week scale (titration) ───
export function computeWeekScale(week: number | undefined): number {
  const w = week ?? 1;
  if (w <= 2) return 0.5;
  if (w <= 4) return 0.75;
  if (w <= 6) return 0.9;
  return 1.0;
}
