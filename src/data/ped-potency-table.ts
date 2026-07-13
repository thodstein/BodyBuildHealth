// ════════════════════════════════════════════════════════════════════════════
//  PED-POTENCY-TABLE — модель PED-доз с potency-фактором per препарат
//
//  computeIntensityFactor(pedDoses) — суммарная интенсивность курса
//  Используется для:
//    - титрации протокольных доз (telmisartan, TUDCA, anastrozole, ...)
//    - определения тяжести курса → выбор уровня стэка
//    - warnings (multi-oral, GH+insulin, winny+oxy стоп-комбо)
// ════════════════════════════════════════════════════════════════════════════

export type PEDClass =
  | 'aas_test' | 'aas_nandrolone' | 'aas_tren' | 'aas_bold' | 'aas_dht_inject'
  | 'aas_oral_dbol' | 'aas_oral_oxy' | 'aas_oral_winny' | 'aas_oral_anavar' | 'aas_oral_tbol' | 'aas_oral_halo' | 'aas_oral_other'
  | 'sarm' | 'gh' | 'igf' | 'mgf' | 'insulin' | 't3' | 't4' | 'clenbut' | 'ai' | 'serm' | '5ari' | 'other';

export interface PEDDose {
  id: string;            // 'test_enan', 'tren_acetate', 'somatropin', ...
  pClass: PEDClass;     // класс для switch-логики
  mgPerWeek?: number;   // для AAS
  iuPerDay?: number;    // для GH, insulin
  mcgPerDay?: number;   // для clenbut, T3, T4, IGF
  form?: 'inject' | 'oral' | 'subq' | 'im';
}

// ════════════════════════════════════════════════════════════════════════════
//  Таблица potency-факторов (отн. test_enan 500 мг/нед = 1.0)
//
//  Подход: potency = токсичность/андрогенность оTHосительно тестостерона.
//  Чем выше potency, тем меньше мг нужно для той же интенсивности.
//
//  Особенности:
//   - test_enan/cyp/sus/undec: 1.0 (baseline)
//   - test_prop: 1.1 (быстрее пик, чуть выше нагрузка)
//   - deca/npp: 1.4 (прогестаген, сильнее подавляет HPTA)
//   - boldenone: 0.7 (лайт анаболизм, но HCT-риск)
//   - trenbolone ace: 3.0 (3× токсичнее test)
//   - trenbolone enan: 3.5
//   - parabolan: 4.0
//   - masteron: 0.9 (лайт, анти-эстро)
//   - primobolan: 0.5 (мягкий)
//   - proviron: 0.2
//   - anavar: 0.8
//   - winstrol: 2.0 (печень + липиды)
//   - dbol: 3.5
//   - anadrol/oxy: 4.0 (печень #1)
//   - tbol: 1.5
//   - halotestin: 5.0 (токсичнейший)
//   - cheque_drops/mibolerone: 6.0
//   - gh 1 МЕ/d: 0.4 (cumulative)
//   - igf1_lr3: 3.0 per мкг-equiv
//   - insulin_rapid 10 МЕ/d: 1.0
//   - sarms ostarine: 0.6
//   - lgd: 0.9
//   - rad140: 1.2
//   - yk11: 1.5
//   - clenbut: 2.0
//   - t3: 1.5 (cumulative)
// ════════════════════════════════════════════════════════════════════════════

export const POTENCY_FACTORS: Record<string, number> = {
  // Тестостероны
  test_enan: 1.0, test_enanthate: 1.0, testosterone_enanthate: 1.0,
  test_cyp: 1.0, test_cypionate: 1.0, testosterone_cypionate: 1.0,
  test_prop: 1.1, testosterone_propionate: 1.1,
  test_undec: 1.0, testosterone_undecanoate: 1.0,
  sustanon: 1.05, sust: 1.05, sustanon_250: 1.05,

  // 19-нор (нандролоны)
  deca: 1.4, deca_durabolin: 1.4, nandrolone_decanoate: 1.4,
  npp: 1.3, nandrolone_phenylpropionate: 1.3,

  // Тренболоны
  tren_ace: 3.0, trenbolone_acetate: 3.0, trenbolone: 3.0,
  tren_enan: 3.5, trenbolone_enanthate: 3.5,
  parabolan: 4.0, trenbolone_hexahydrobenzylcarbonate: 4.0,

  // Болденон
  boldenone: 0.7, eq: 0.7, equipoise: 0.7, boldenone_undecylenate: 0.7,

  // ДГТ-derivatives (inject)
  masteron: 0.9, drostanolone: 0.9, drostanolone_propionate: 0.9,
  primobolan: 0.5, methenolone: 0.5, methenolone_enanthate: 0.5,
  primobolan_acetate: 0.5, methenolone_acetate: 0.5,

  // Привидон (модель - oral но не 17α)
  proviron: 0.2, mesterolone: 0.2,

  // 17α-Оралы
  anavar: 0.8, oxandrolone: 0.8,
  winstrol: 2.0, stanozolol: 2.0, winny: 2.0,
  dbol: 3.5, dianabol: 3.5, methandienone: 3.5, methandrostenolone: 3.5,
  anadrol: 4.0, oxymetholone: 4.0, oxy: 4.0,
  tbol: 1.5, turinabol: 1.5, oral_turinabol: 1.5, chlorodehydromethyltestosterone: 1.5,
  halo: 5.0, halotestin: 5.0, fluoxymesterone: 5.0,
  methyltestosterone: 3.0,
  cheque_drops: 6.0, mibolerone: 6.0,

  // SARMs
  ostarine: 0.6, mk2866: 0.6, enobosarm: 0.6,
  lgd: 0.9, lgd4033: 0.9, ligandrol: 0.9,
  rad140: 1.2, testolone: 1.2,
  yk11: 1.5,
  andarine: 0.5, s4: 0.5,
  sr9009: 0.3, stenabolic: 0.3,
  gw501516: 0.4, cardarine: 0.4,

  // GH
  somatropin: 0.4, gh: 0.4, hgh: 0.4, growth_hormone: 0.4, jintropin: 0.4, genotropin: 0.4, norditropin: 0.4,

  // IGF / MGF
  igf1_lr3: 3.0, igf1: 3.0, igf_lr3: 3.0, igf_des: 3.5, mgf: 1.5, peg_mgf: 1.5,

  // Инсулин
  insulin_rapid: 1.0, insulin_lantus: 0.9, insulin_glargine: 0.9, insulin_detemir: 0.85, insulin: 1.0,
  novorapid: 1.0, humalog: 1.0, lantus: 0.9, levemir: 0.85,

  // T3 / T4
  t3: 1.5, liothyronine: 1.5, triiodothyronine: 1.5, cytomel: 1.5,
  t4: 0.8, levothyroxine: 0.8,

  // Clenbuterol
  clenbuterol: 2.0, clen: 2.0,
};

// Список оральных 17α (для гепаториска)
export const ORAL_17ALPHA_IDS: Set<string> = new Set([
  'anavar', 'winstrol', 'winny', 'stanozolol', 'oxandrolone',
  'dbol', 'dianabol', 'methandienone', 'methandrostenolone',
  'anadrol', 'oxymetholone', 'oxy',
  'tbol', 'turinabol', 'oral_turinabol',
  'halo', 'halotestin', 'fluoxymesterone',
  'methyltestosterone', 'cheque_drops', 'mibolerone',
]);

// Список не-17α оралов (Proviron)
export const ORAL_NON17_IDS: Set<string> = new Set([
  'proviron', 'mesterolone',
]);

// ════════════════════════════════════════════════════════════════════════════
//  classifyPed — автоопределение класса по ID
// ════════════════════════════════════════════════════════════════════════════
export function classifyPed(id: string): PEDClass {
  const k = id.toLowerCase();
  // Тестостероны
  if (k.includes('test_') || k.includes('testosterone') || k.includes('sust')) return 'aas_test';
  // 19-нор
  if (k.includes('nandrolone') || k.includes('deca') || k.includes('npp')) return 'aas_nandrolone';
  // Трен
  if (k.includes('tren') || k.includes('parabolan')) return 'aas_tren';
  // Болденон
  if (k.includes('bold') || k.includes('equipoise') || k.includes('eq'+'_')) return 'aas_bold';
  // ДГТ-inject
  if (k.includes('masteron') || k.includes('drostanolone') || k.includes('primobolan') || k.includes('methenolone')) return 'aas_dht_inject';
  // 17α Оралы
  if (k.includes('anavar') || k.includes('oxandrolone')) return 'aas_oral_anavar';
  if (k.includes('winstrol') || k.includes('stanozolol') || k.includes('winny')) return 'aas_oral_winny';
  if (k.includes('anadrol') || k.includes('oxymetholone') || k==='oxy') return 'aas_oral_oxy';
  if (k.includes('dbol') || k.includes('dianabol') || k.includes('methandienone')) return 'aas_oral_dbol';
  if (k.includes('tbol') || k.includes('turinabol')) return 'aas_oral_tbol';
  if (k.includes('halo') || k.includes('fluoxymesterone')) return 'aas_oral_halo';
  if (ORAL_17ALPHA_IDS.has(k)) return 'aas_oral_other';
  // SARMs
  if (k.includes('ostarine') || k.includes('lgd') || k.includes('rad') || k.includes('yk11') || k.includes('andarine') || k.includes('s4') || k.includes('sr9009') || k.includes('gw501516') || k.includes('cardarine')) return 'sarm';
  // GH
  if (k.includes('somatropin') || k === 'gh' || k === 'hgh' || k.includes('growth_hormone') || k.includes('jintropin') || k.includes('genotropin') || k.includes('norditropin')) return 'gh';
  // IGF
  if (k.includes('igf') || k.includes('lr3') || k.includes('des')) return 'igf';
  if (k.includes('mgf') || k.includes('peg_mgf')) return 'mgf';
  // Insulin
  if (k.includes('insulin') || k.includes('novorapid') || k.includes('humalog') || k.includes('lantus') || k.includes('levemir')) return 'insulin';
  // T3/T4
  if (k.includes('t3') || k.includes('liothyronine') || k.includes('cytomel') || k.includes('triiodothyronine')) return 't3';
  if (k.includes('t4') || k.includes('levothyroxine')) return 't4';
  // Clen
  if (k.includes('clenbuterol') || k === 'clen') return 'clenbut';
  return 'other';
}

// ════════════════════════════════════════════════════════════════════════════
//  computeIntensityFactor — суммарная интенсивность курса
//
//  Formula:
//    intensity_from_aas = sum_over_peds( (mgPerWeek/500) × POTENCY_FACTORS[id] )
//    intensity_from_gh = sum( (iuPerDay/4) × POTENCY_FACTORS[id] )
//    intensity_from_insulin = sum( (iuPerDay/10) × POTENCY_FACTORS[id] )
//    intensity_from_other = sum( factor × normalized_dose )
//    total = clamp( 0.5 + aas + gh + insulin + other, 0.5, 3.0 )
//
//  Interpretation:
//    0.5  — TRT/clean
//    1.0  — стандарт 500 мг test/нед
//    1.5  — moderate(800-1000 мг test или test+tren200)
//    2.0  — aggressive (1500 мг test или test+tren300+dbol30)
//    2.5+ — heavy (> 2000 мг test или multi-oral)
// ════════════════════════════════════════════════════════════════════════════

export function computeIntensityFactor(peds: PEDDose[]): number {
  let intensityAAS = 0;
  let intensityGH = 0;
  let intensityInsulin = 0;
  let intensityOther = 0;

  for (const p of peds) {
    const potency = POTENCY_FACTORS[p.id.toLowerCase()] ?? 1.0;
    const pClass = p.pClass;
    if (pClass === 'gh' || pClass === 'igf' || pClass === 'mgf') {
      const iu = p.iuPerDay ?? (p.mcgPerDay ? p.mcgPerDay / 100 : 0);
      intensityGH += (iu / 4) * potency;
    } else if (pClass === 'insulin') {
      const iu = p.iuPerDay ?? 0;
      intensityInsulin += (iu / 10) * potency;
    } else if (pClass === 't3' || pClass === 't4' || pClass === 'clenbut') {
      const mcg = p.mcgPerDay ?? 0;
      intensityOther += (mcg / 50) * potency;  // 50 мкг T3 = 1.0
    } else if (pClass === 'sarm') {
      const mg = p.mgPerWeek ? p.mgPerWeek / 7 : 0;
      intensityAAS += (mg / 25) * potency;  // 25 мг/день sarm = 0.6 → 1 sarm test
    } else {
      // AAS
      const mg = p.mgPerWeek ?? 0;
      intensityAAS += (mg / 500) * potency;
    }
  }
  const total = 0.4 + intensityAAS + intensityGH + intensityInsulin + intensityOther;
  return Math.max(0.5, Math.min(3.0, total));
}

// ════════════════════════════════════════════════════════════════════════════
//  Helpers для detection флагов
// ════════════════════════════════════════════════════════════════════════════

export interface PEDFlags {
  hasAAS: boolean;
  hasTest: boolean;
  hasNandrolone: boolean;
  hasTren: boolean;
  hasBold: boolean;
  hasDhtInject: boolean;
  hasOral17: boolean;
  hasOral17Count: number;  // число разных оралов (multi-oral warning)
  hasProviron?: boolean;
  hasSarm: boolean;
  hasGH: boolean;
  hasIGF: boolean;
  hasMGF: boolean;
  hasInsulin: boolean;
  hasT3: boolean;
  hasT4: boolean;
  hasClenbut: boolean;
  has17AlphaAndGH: boolean;
  isMultiOral: boolean;       // >1 oral17
  isGHPlusInsulin: boolean;
  isWinnyPlusOxy: boolean;    // STOP warning combo
  pedIds: string[];            // все не-AAS PED IDs
}

export function derivePEDFlags(peds: PEDDose[]): PEDFlags {
  const ids = peds.map(p => p.id.toLowerCase());
  const oral17Ids = ids.filter(id => ORAL_17ALPHA_IDS.has(id));
  const hasOral17 = oral17Ids.length > 0;
  const hasGH_ = peds.some(p => p.pClass === 'gh');
  const hasInsulin_ = peds.some(p => p.pClass === 'insulin');
  const flags: PEDFlags = {
    hasAAS: peds.some(p => p.pClass.startsWith('aas_')),
    hasTest: peds.some(p => p.pClass === 'aas_test'),
    hasNandrolone: peds.some(p => p.pClass === 'aas_nandrolone'),
    hasTren: peds.some(p => p.pClass === 'aas_tren'),
    hasBold: peds.some(p => p.pClass === 'aas_bold'),
    hasDhtInject: peds.some(p => p.pClass === 'aas_dht_inject'),
    hasOral17, hasOral17Count: oral17Ids.length,
    hasProviron: ids.includes('proviron') || ids.includes('mesterolone'),
    hasSarm: peds.some(p => p.pClass === 'sarm'),
    hasGH: hasGH_,
    hasIGF: peds.some(p => p.pClass === 'igf'),
    hasMGF: peds.some(p => p.pClass === 'mgf'),
    hasInsulin: hasInsulin_,
    hasT3: peds.some(p => p.pClass === 't3'),
    hasT4: peds.some(p => p.pClass === 't4'),
    hasClenbut: peds.some(p => p.pClass === 'clenbut'),
    has17AlphaAndGH: hasOral17 && hasGH_,
    isMultiOral: oral17Ids.length > 1,
    isGHPlusInsulin: hasGH_ && hasInsulin_,
    isWinnyPlusOxy: ids.includes('winstrol') && (ids.includes('anadrol') || ids.includes('oxymetholone') || ids.includes('oxy')),
    pedIds: ids,
  };
  return flags;
}

// ════════════════════════════════════════════════════════════════════════════
//  doseByIntensity — формула дозы от базового к макс по интенсивности
// ════════════════════════════════════════════════════════════════════════════
export function doseByIntensity(base: number, max: number, intensity: number): number {
  // intensity 0.5-3.0 → factor 0-1 для интерполяции base→max
  const norm = Math.max(0, Math.min(1, (intensity - 0.5) / 2.5));
  return Math.round((base + (max - base) * norm) * 100) / 100;
}