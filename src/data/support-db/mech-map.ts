/**
 * mech-map.ts — ЕДИНЫЙ резолвер «вещество поддержки → механизмы ТЗ».
 *
 * Зачем: механизм-ориентированная модель риска знает только 28 механизмов
 * (`risk-engine-tz-spec.ts`) и берёт поддержку из `SUPPLEMENTS_DB` /
 * `PHARMACY_DB` по ТОЧНОМУ совпадению ключа. Каталог же содержит 521 вещество,
 * часть id — в другом регистре (`NAC`, `TUDCA`, `VITAMIN_E`), часть отсутствует
 * в обеих таблицах (zinc_sup, selenium_sup, curcumin_sup, PHARMA_ANASTROZOLE…).
 * Итог до этого модуля: 67 из 521 веществ каталога молча давали **0** вклада
 * в покрытие риска, хотя назначались в план (цинк, селен, куркумин, AI/SERM…).
 *
 * Резолюция идёт по приоритету:
 *   1. Кураторская запись (SUPPLEMENTS_DB / PHARMACY_DB) — k/q/source из ТЗ-таблицы.
 *   2. Явная доработка (EXTRA_SUPPORT_MECHS) — для реальных пробелов с клинической
 *      привязкой к 28 механизмам.
 *   3. Производная оценка из самого каталога (`deriveFromCatalog`): токены
 *      `mechanisms[]` → механизмы ТЗ, затем системы/органы как fallback.
 *      Всегда q='C' и k ≤ 0.12 — «правдоподобно», а не «доказано».
 *
 * Производные записи помечены в `source` строкой DERIVED_SOURCE, поэтому UI
 * может честно отделить «доказанные» механизмы от «оценочных».
 */
import { SUPPLEMENTS_DB } from './supplements';
import { PHARMACY_DB } from './pharmacy-db';
import { SUPPORT_CATALOG_DATA } from '../support-catalog-data';
import { canonId } from '../../engines/support-plan/shared-constants';

export interface SupportMechEntry {
  organId: string;
  mechId: string;
  k: number;
  q: 'A' | 'B' | 'C';
  source: string;
}

export const DERIVED_SOURCE = 'Оценка по механизмам каталога (не первичные данные)';

/** Кураторские таблицы: единственный источник k/q там, где он есть. */
const CURATED: Record<string, SupportMechEntry[]> = {
  ...(SUPPLEMENTS_DB as Record<string, SupportMechEntry[]>),
  ...(PHARMACY_DB as Record<string, SupportMechEntry[]>),
};

/**
 * Явные доработки для веществ, которые каталог предлагает в план,
 * а механизм-таблицы не покрывали вовсе.
 * k ≤ 0.15, q='C' — консервативно: это поддержка, а не терапия.
 */
const EXTRA_SUPPORT_MECHS: Record<string, SupportMechEntry[]> = {
  // ── Минералы / витамины ──
  zinc_sup: [
    { organId: 'reproductive', mechId: 'rep2', k: 0.15, q: 'C', source: 'Zn — кофактор стероидогенеза и тестикулярной функции' },
    { organId: 'hematologic', mechId: 'hem2', k: 0.10, q: 'C', source: 'Zn — антиоксидантная и иммунная поддержка' },
    { organId: 'cns', mechId: 'cns2', k: 0.08, q: 'C', source: 'Zn — снижение окислительного стресса' },
  ],
  selenium_sup: [
    { organId: 'cns', mechId: 'cns4', k: 0.12, q: 'C', source: 'Se — кофактор дейодиназ T4→T3 (тиреоидная ось)' },
    { organId: 'cns', mechId: 'cns2', k: 0.12, q: 'B', source: 'Se — глутатионпероксидаза (GPx), антиоксидант' },
    { organId: 'reproductive', mechId: 'rep3', k: 0.10, q: 'C', source: 'Se — сперматогенез' },
  ],
  copper_supp: [
    { organId: 'hematologic', mechId: 'hem2', k: 0.10, q: 'C', source: 'Cu — кофактор церулоплазмина, железо-обмен' },
    { organId: 'cns', mechId: 'cns1', k: 0.08, q: 'C', source: 'Cu — кофактор дофамин-β-гидроксилазы' },
  ],
  potassium_citrate: [
    { organId: 'cardio', mechId: 'cv5', k: 0.15, q: 'B', source: 'K+ — профилактика гипокалиемии/аритмии' },
    { organId: 'hematologic', mechId: 'hem5', k: 0.12, q: 'C', source: 'K+ — водно-электролитный баланс' },
    { organId: 'renal', mechId: 'ren1', k: 0.08, q: 'C', source: 'Цитрат — снижение риска кальцификации/камней' },
  ],
  iron_supplement: [
    { organId: 'hematologic', mechId: 'hem2', k: 0.10, q: 'B', source: 'Fe — субстрат эритропоэза (восполнение дефицита)' },
  ],
  iron_lipofer: [
    { organId: 'hematologic', mechId: 'hem2', k: 0.10, q: 'B', source: 'Fe (липосомальное) — восполнение дефицита, эритропоэз' },
  ],
  methylcobalamin: [
    { organId: 'cns', mechId: 'cns3', k: 0.12, q: 'B', source: 'B12 — метилирование, снижение гомоцистеина' },
    { organId: 'cns', mechId: 'cns2', k: 0.08, q: 'C', source: 'B12 — миелин и нейропротекция' },
    { organId: 'hematologic', mechId: 'hem2', k: 0.08, q: 'C', source: 'B12 — эритропоэз' },
  ],
  // ── Растительные / аминокислоты ──
  curcumin_sup: [
    { organId: 'hepatic', mechId: 'liv1', k: 0.12, q: 'B', source: 'Куркумин — NF-κB/COX-2 ингибирование, гепатопротекция' },
    { organId: 'cns', mechId: 'cns2', k: 0.12, q: 'B', source: 'Куркумин — антиоксидант/противовоспалительное' },
  ],
  garlic_extract: [
    { organId: 'cardio', mechId: 'cv2', k: 0.10, q: 'B', source: 'Чеснок — ↓LDL/липидный профиль' },
    { organId: 'cardio', mechId: 'cv4', k: 0.08, q: 'C', source: 'Чеснок — ↓агрегация тромбоцитов' },
  ],
  daa: [
    { organId: 'reproductive', mechId: 'rep1', k: 0.08, q: 'C', source: 'D-аспарагиновая кислота — модуляция LH/тестостерона (слабые данные)' },
    { organId: 'reproductive', mechId: 'rep2', k: 0.08, q: 'C', source: 'DAA — стероидогенез' },
  ],
  collagen_ii: [
    { organId: 'cns', mechId: 'cns6', k: 0.0, q: 'C', source: 'Коллаген II — суставная поддержка (вне 28 механизмов ТЗ)' },
  ],
  col_ii: [
    { organId: 'cns', mechId: 'cns6', k: 0.0, q: 'C', source: 'Коллаген II — суставная поддержка (вне 28 механизмов ТЗ)' },
  ],
  // ── Фармакология поддержки (AI/SERM/каберголин) ──
  pharma_anastrozole: [
    { organId: 'reproductive', mechId: 'rep4', k: 0.45, q: 'A', source: 'Анастрозол — ингибитор ароматазы, ↓E2' },
    { organId: 'reproductive', mechId: 'rep2', k: 0.20, q: 'B', source: '↓E2 → ↓отрицательная обратная связь, ↑LH/FT' },
  ],
  pharma_letrozole: [
    { organId: 'reproductive', mechId: 'rep4', k: 0.50, q: 'A', source: 'Летрозол — ингибитор ароматазы, ↓E2' },
    { organId: 'reproductive', mechId: 'rep2', k: 0.20, q: 'B', source: '↓E2 → ↑LH/FT' },
  ],
  pharma_clomiphene: [
    { organId: 'reproductive', mechId: 'rep1', k: 0.35, q: 'A', source: 'Кломифен — SERM, восстановление LH/FSH (ПКТ)' },
    { organId: 'reproductive', mechId: 'rep2', k: 0.25, q: 'B', source: 'SERM → ↑эндогенный тестостерон' },
    { organId: 'reproductive', mechId: 'rep3', k: 0.20, q: 'B', source: 'SERM → ↑FSH, сперматогенез' },
  ],
  pharma_enclomiphene: [
    { organId: 'reproductive', mechId: 'rep1', k: 0.40, q: 'A', source: 'Энкломифен — селективный SERM, LH/FSH (ПКТ)' },
    { organId: 'reproductive', mechId: 'rep2', k: 0.30, q: 'B', source: 'Энкломифен → ↑эндогенный тестостерон' },
    { organId: 'reproductive', mechId: 'rep3', k: 0.20, q: 'B', source: 'Энкломифен → ↑FSH' },
  ],
  pharma_cabergoline: [
    { organId: 'cns', mechId: 'cns1', k: 0.40, q: 'A', source: 'Каберголин — агонист D2, ↓пролактин' },
    { organId: 'reproductive', mechId: 'rep3', k: 0.25, q: 'B', source: '↓пролактин → восстановление гонадотропинов' },
  ],
  pharma_tadalafil: [
    { organId: 'cardio', mechId: 'cv1', k: 0.10, q: 'C', source: 'Тадалафил — эндотелиальная функция/NO' },
    { organId: 'cardio', mechId: 'cv3', k: 0.08, q: 'C', source: 'Тадалафил — лёгкая вазодилатация' },
  ],
};

/** Спец-алиасы для id каталога, которые не сводятся к lowercase. */
const SPECIAL_ALIAS: Record<string, string> = {
  metformin_mr: 'metformin',
  metformin_sr: 'metformin',
  metformin_xr: 'metformin',
  thiamine: 'vitamin_b1',
  benfotiamine: 'vitamin_b1',
  methylcobalamin: 'vitamin_b12',
  cyanocobalamin: 'vitamin_b12',
  folate: 'folate',
  iron_bisglycinate: 'iron',
  iron_lipofer: 'iron_lipofer',
  garlic_extract: 'garlic_extract',
  collagen_ii: 'collagen_ii',
  col_ii: 'collagen_ii',
  curcumin: 'curcumin_sup',
  copper_supplement: 'copper_supp',
  nac: 'nac',
  tudca: 'tudca',
  sam_е: 'same',
  s_adenosylmethionine: 'same',
  vitamin_b1_: 'vitamin_b1',
};

/**
 * Канонизация id вещества поддержки.
 * Возвращает ключ, по которому есть кураторская/явная запись, иначе lowercase.
 */
export function canonSupportId(id: string): string {
  const raw = String(id || '').trim();
  if (!raw) return '';
  if (CURATED[raw] || EXTRA_SUPPORT_MECHS[raw]) return raw;
  const low = raw.toLowerCase().replace(/[\s-]+/g, '_');
  if (CURATED[low] || EXTRA_SUPPORT_MECHS[low]) return low;
  const alias = SPECIAL_ALIAS[low] || SPECIAL_ALIAS[raw];
  if (alias) return alias;
  return low;
}

/** Есть ли у вещества кураторская (доказательная) запись механизмов. */
export function isCuratedSupport(id: string): boolean {
  const k = canonSupportId(id);
  if ((CURATED[k] && CURATED[k].length > 0) || !!EXTRA_SUPPORT_MECHS[k]) return true;
  // Глобальные алиасы (`metformin_dup` → `metformin`): запись живёт под каноном.
  const canon = canonId(k);
  return canon !== k && !!(CURATED[canon]?.length || EXTRA_SUPPORT_MECHS[canon]);
}

/** Служебные записи каталога — не вещества, выбирать их нельзя. */
const NON_SUBSTANCE_IDS: ReadonlySet<string> = new Set(['pharma']);

/**
 * Сопутствующие препараты (НЕ поддержка): НПВС, ГКС, антиконвульсанты,
 * иммунодепрессанты, половые/метаболические гормоны.
 *
 * Они есть в каталоге ради взаимодействий и противопоказаний, но покрытие
 * риска ими НЕ закрывается — это не «снижатели риска». Пустой список
 * механизмов для них — правильный ответ, а не пробел в данных. Отдельный
 * список нужен, чтобы отчёт «не учтено» не смешивал их с реальными дырами
 * покрытия (аудит 2026-11: 16 таких записей молча попадали в «521 вещество
 * покрыто механизмами», хотя механизмов у них нет).
 */
export const CONCOMITANT_ONLY_IDS: ReadonlySet<string> = new Set([
  'estradiol', 'glucagon', 'cortisol',
  'ibuprofen', 'naproxen', 'celecoxib',
  'prednisone', 'dexamethasone', 'hydrocortisone', 'methylprednisolone',
  'carbamazepine', 'phenytoin',
  'tacrolimus', 'cyclosporine', 'mycophenolate', 'azathioprine',
]);

/** Вещество каталога, которое участвует в покрытии риска (а не сопутствующий препарат). */
export function isSupportSubstanceId(id: string): boolean {
  const k = String(id || '').toLowerCase();
  return !!k && !NON_SUBSTANCE_IDS.has(k) && !CONCOMITANT_ONLY_IDS.has(k);
}

/**
 * Правила «токен каталога → механизмы ТЗ».
 * Порядок важен: более специфичные правила идут раньше.
 * k намеренно низкий (0.06-0.12): производная оценка не должна конкурировать
 * с доказательными k из ТЗ-таблиц.
 */
const TOKEN_RULES: Array<{ re: RegExp; out: Array<[string, string, number]> }> = [
  // Репродуктивная / HPG
  { re: /AROMATASE|ESTROGEN_MODULATION/, out: [['reproductive', 'rep4', 0.10]] },
  { re: /SERM|HPTA|GNRH|LH_|FSH_|LEYDIG|SPERMATOGENESIS|TESTICULAR/, out: [['reproductive', 'rep1', 0.10], ['reproductive', 'rep2', 0.08]] },
  { re: /TESTOSTERONE_(SYNTHESIS|PRODUCTION|UP|BOOST)|STEROIDOGENESIS/, out: [['reproductive', 'rep2', 0.10]] },
  { re: /PROLACTIN|DOPAMINERGIC/, out: [['cns', 'cns1', 0.08]] },
  // Печень
  { re: /GLUTATHIONE|LIVER_DETOX|HEPATOPROTECT|BILE_FLOW|CHOLERETIC|UDCA|TUDCA/, out: [['hepatic', 'liv1', 0.12], ['hepatic', 'liv2', 0.10]] },
  { re: /ANTI_FIBROTIC|LIVER_REGENERATION|HEPATOCYTE/, out: [['hepatic', 'liv1', 0.10], ['hepatic', 'liv3', 0.08]] },
  { re: /LIVER_LIPID|LIPID_PEROXIDATION/, out: [['hepatic', 'liv1', 0.08]] },
  // Почки
  { re: /NEPHRO|RENAL_PROTECT|KIDNEY/, out: [['renal', 'ren1', 0.10]] },
  { re: /URIC|URATE|XANTHINE/, out: [['renal', 'ren2', 0.10]] },
  { re: /OSMOREGULATION|AQUARETIC/, out: [['renal', 'ren4', 0.08]] },
  // ССС
  { re: /CHOLESTEROL|LIPID_(METABOLISM|LOWERING)|LDL|HDL|TRIGLYCERIDE|STATIN/, out: [['cardio', 'cv2', 0.10]] },
  { re: /BLOOD_PRESSURE|VASODILAT|ACE_INHIBITION|ANTIHYPERTENSIVE|NO_PRODUCTION|NITRIC_OXIDE|ENDOTHEL/, out: [['cardio', 'cv1', 0.08], ['cardio', 'cv3', 0.08]] },
  { re: /BLOOD_RHEOLOGY|PLATELET_AGGREGATION|ANTICOAGUL|FIBRINOLYS|THROMBOLYTIC|COAGUL/, out: [['cardio', 'cv4', 0.10]] },
  { re: /HEART_RHYTHM|ARRHYTHMIA|ANTIARRHYTHMIC|CARDIAC_FUEL|INOTROPIC/, out: [['cardio', 'cv5', 0.10]] },
  { re: /MICROCIRCULATION|CAPILLARY|VENOTONIC|LYMPHATIC/, out: [['cardio', 'cv4', 0.08]] },
  // ЦНС
  { re: /NEUROTRANSMITTER|DOPAMINE|SEROTONIN|GABA|GLUTAMATE|NMDA|ACETYLCHOLINE|CHOLINERGIC|ADAPTOGEN|ANXIOLYTIC|STRESS|CORTISOL/, out: [['cns', 'cns1', 0.08]] },
  { re: /ANTIOXIDANT|NRF2|NFKB|NF_KB|CYTOKINE|NLRP3|COX|LOX|INFLAMM|APOPTOSIS/, out: [['cns', 'cns2', 0.10]] },
  { re: /METHYLATION|HOMOCYSTEINE|FOLATE_CYCLE|BHMT|SAM_/, out: [['cns', 'cns3', 0.10]] },
  { re: /THYROID|THYROXINE|DEIODINASE|T4_T3|TSH/, out: [['cns', 'cns4', 0.10]] },
  { re: /COGNIT|BDNF|NGF|NEUROPLAST|SYNAPTIC|NEUROGENESIS|MYELIN|NERVE_CONDUCTION/, out: [['cns', 'cns1', 0.08], ['cns', 'cns2', 0.06]] },
  { re: /CEREBRAL_BLOOD_FLOW|NEUROPROTECT/, out: [['cns', 'cns2', 0.06]] },
  { re: /GLUCOSE_UPTAKE|GLUCONEOGENESIS|INSULIN_SENSITIVITY|AMPK|PPAR|ANTIDIABETIC/, out: [['hematologic', 'hem2', 0.10]] },
  // Гематология / метаболизм
  { re: /HEMOGLOBIN|ERYTHROPOIESIS|RED_BLOOD_CELL|IRON_METABOLISM|HEME_SYNTHESIS|OXYGEN_TRANSPORT|ERYTHROCYTE/, out: [['hematologic', 'hem2', 0.10]] },
  { re: /ELECTROLYTE|POTASSIUM|SODIUM|MAGNESIUM|CALCIUM_REGULATION|HYDRAT/, out: [['hematologic', 'hem5', 0.10], ['cardio', 'cv5', 0.06]] },
  { re: /MICROBIOME|GUT_BARRIER|ENTEROCYTE|PROBIOTIC|DIGESTIVE|LACTASE/, out: [['hematologic', 'hem2', 0.06]] },
  { re: /IMMUNE|TCELL|IGA|ANTIMICROBIAL|ANTIVIRAL|COLOSTRUM/, out: [['cns', 'cns2', 0.06]] },
  // Общее
  { re: /ATP_PRODUCTION|COENZYME|MITOCHONDRIAL|FATTY_ACID_(TRANSPORT|OXIDATION)|ENERGY/, out: [['cns', 'cns2', 0.06]] },
  { re: /COLLAGEN|CONNECTIVE_TISSUE|CARTILAGE|BONE_|TENDON|JOINT|MMP_REGULATION|HYALURONAN/, out: [['cns', 'cns6', 0.0]] },
  { re: /PROTEIN_SYNTHESIS|MUSCLE_(GROWTH|FUNCTION|PROTEIN)/, out: [['hematologic', 'hem2', 0.04]] },
];

/** Fallback по системам каталога, когда токены не дали ничего. */
const SYSTEM_FALLBACK: Record<string, Array<[string, string, number]>> = {
  hepatic: [['hepatic', 'liv1', 0.08]],
  cardio: [['cardio', 'cv2', 0.06]],
  vascular: [['cardio', 'cv4', 0.06]],
  renal: [['renal', 'ren1', 0.08]],
  neuro: [['cns', 'cns2', 0.06]],
  endocrine: [['cns', 'cns4', 0.06]],
  reproductive: [['reproductive', 'rep2', 0.06]],
  hematologic: [['hematologic', 'hem2', 0.06]],
  metabolic: [['hematologic', 'hem2', 0.06]],
  immune: [['cns', 'cns2', 0.05]],
  gastrointestinal: [['hematologic', 'hem2', 0.04]],
  gi: [['hematologic', 'hem2', 0.04]],
};

/** Производная оценка механизмов из каталога (q='C', k ≤ 0.12). */
export function deriveFromCatalog(id: string): SupportMechEntry[] {
  const key = canonSupportId(id);
  const entry =
    (SUPPORT_CATALOG_DATA as Record<string, any>)[key] ||
    (SUPPORT_CATALOG_DATA as Record<string, any>)[String(id || '')] ||
    (SUPPORT_CATALOG_DATA as Record<string, any>)[String(id || '').toUpperCase()];
  if (!entry) return [];

  const seen = new Set<string>();
  const out: SupportMechEntry[] = [];
  const push = (organId: string, mechId: string, k: number) => {
    const dedupe = organId + ':' + mechId;
    if (seen.has(dedupe)) return;
    seen.add(dedupe);
    out.push({ organId, mechId, k: Math.min(0.12, k), q: 'C', source: DERIVED_SOURCE });
  };

  const tokens: string[] = Array.isArray(entry.mechanisms) ? entry.mechanisms : [];
  for (const token of tokens) {
    const up = String(token || '').toUpperCase();
    for (const rule of TOKEN_RULES) {
      if (rule.re.test(up)) {
        for (const [organId, mechId, k] of rule.out) push(organId, mechId, k);
        break;
      }
    }
  }

  if (out.length === 0) {
    const systems: string[] = Array.isArray(entry.systems) ? entry.systems : [];
    for (const sys of systems) {
      const fb = SYSTEM_FALLBACK[String(sys || '').toLowerCase()];
      if (fb) for (const [organId, mechId, k] of fb) push(organId, mechId, k);
    }
  }

  // Записи с k=0 не несут покрытия — отбрасываем, чтобы не раздувать счётчики.
  return out.filter((e) => e.k > 0);
}

const cache = new Map<string, SupportMechEntry[]>();

/**
 * Резолвер: id → механизмы ТЗ. Никогда не возвращает `undefined`:
 * для неизвестного вещества — пустой массив (честное «нет данных»).
 */
export function getSupportMechs(id: string): SupportMechEntry[] {
  if (!id) return [];
  const hit = cache.get(id);
  if (hit) return hit;
  const key = canonSupportId(id);
  const curated = CURATED[key];
  const extra = EXTRA_SUPPORT_MECHS[key];
  const result = curated && curated.length > 0 ? curated : extra && extra.length > 0 ? extra : deriveFromCatalog(key);
  if (result.length > 0) {
    cache.set(id, result);
    cache.set(key, result);
    return result;
  }
  // Глобальные алиасы: `metformin_dup`/`levothyroxine_dup`/`liothyronine_dup`
  // (и прочие исторические дубли) хранят механизмы под каноническим id.
  const canon = canonId(key);
  if (canon && canon !== key) {
    const canonCurated = CURATED[canon];
    const canonExtra = EXTRA_SUPPORT_MECHS[canon];
    const aliased = canonCurated && canonCurated.length > 0
      ? canonCurated
      : canonExtra && canonExtra.length > 0
        ? canonExtra
        : deriveFromCatalog(canon);
    if (aliased.length > 0) {
      cache.set(id, aliased);
      cache.set(key, aliased);
      return aliased;
    }
  }
  cache.set(id, result);
  cache.set(key, result);
  return result;
}

/**
 * Полный индекс: кураторские таблицы + доработки + производные записи
 * для остальных веществ каталога. Используется и подбором плана (engine.ts),
 * и pickSupport, чтобы «витрина» каталога и расчёт совпадали.
 */
let indexCache: Record<string, SupportMechEntry[]> | null = null;

export function getSupportMechIndex(): Record<string, SupportMechEntry[]> {
  if (indexCache) return indexCache;
  const index: Record<string, SupportMechEntry[]> = {};
  for (const id of Object.keys(CURATED)) {
    const list = getSupportMechs(id);
    if (list.length > 0) index[id] = list;
  }
  for (const id of Object.keys(EXTRA_SUPPORT_MECHS)) {
    const list = getSupportMechs(id);
    if (list.length > 0) index[id] = list;
  }
  for (const id of Object.keys(SUPPORT_CATALOG_DATA)) {
    const list = getSupportMechs(id);
    if (list.length > 0) index[id] = list;
  }
  indexCache = index;
  return index;
}

/** Вещества каталога без единого механизма ТЗ — для честного отчёта «не учтено».
 *  Сопутствующие препараты и служебные записи исключены: у них механизмов
 *  поддержки нет по определению (см. `CONCOMITANT_ONLY_IDS`), и смешивать их
 *  с реальными пробелами покрытия нельзя. */
export function listUnmappedSupportIds(): string[] {
  const out: string[] = [];
  for (const id of Object.keys(SUPPORT_CATALOG_DATA)) {
    if (!isSupportSubstanceId(id)) continue;
    if (getSupportMechs(id).length === 0) out.push(id);
  }
  return out;
}
