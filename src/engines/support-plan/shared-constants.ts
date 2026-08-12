/**
 * shared-constants.ts — ЕДИНЫЙ источник констант дедупликации.
 * Разорван circular dependency между engine-helpers.ts и recommendation-engine.ts.
 *
 * Содержит:
 *   - SUB_ALIAS + canonId — канонизация ID веществ (семантические синонимы)
 *   - TZ_AUTO_BLACKLIST — вещества, не назначаемые автоматически
 *   - SAME_CLASS_GROUPS + ID_TO_CLASS + sameClassIds — дедупликация по классу препаратов
 *
 * Оба файла (engine-helpers.ts, recommendation-engine.ts) импортируют отсюда.
 */

// ═══════════════════════════════════════════════════════════════
//  Канонические алиасы веществ
// ═══════════════════════════════════════════════════════════════
// Решает проблему семантических дубликатов: рекомендательный движок
// использует ID с суффиксами (_sup, _ii, _supplement, singular/plural),
// а SUPPLEMENTS_DB/PHARMACY_DB — базовые ID.
// Без этой мапы один и тот же препарат попадает в план дважды под разными ID.
export const SUB_ALIAS: Record<string, string> = {
  zinc_sup: 'zinc', selenium_sup: 'selenium',
  taurine_sup: 'taurine', curcumin_sup: 'curcumin',
  collagen_ii: 'collagen', collagen_uc2: 'collagen',
  calcium_supplement: 'calcium',
  probiotic: 'probiotics', probiotics_sup: 'probiotics',
  methylfolate: 'folate', methylcobalamin: 'vitamin_b12',
  red_yeast_rice: 'red_yeast',
  acetyl_l_carnitine: 'l_carnitine', carnitine: 'l_carnitine',
  grape_seed_extract: 'grape_seed',
  l_theanine: 'theanine', l_tyrosine: 'tyrosine', l_dopa: 'l_dopa',
  l_lysine: 'lysine', l_tryptophan: 'tryptophan',
  saw_palmetto: 'saw_palmetto',
  telmi: 'telmisartan',
  pharma_anastrozole: 'anastrozole',
  pharma_cabergoline: 'cabergoline',
  pharma_clomiphene: 'clomi',
  pharma_enclomiphene: 'clomi',
  pharma_letrozole: 'letrozole',
  metformin_dup: 'metformin',
  levothyroxine_dup: 'levothyroxine',
  liothyronine_dup: 'liothyronine',
  hyaluronic: 'hyaluronic_acid',
  chondroitin: 'chondroitin_sulfate',
  // ── Расширение: синонимы витаминов/минералов/БАД ──
  vitamin_d: 'vitamin_d3', cholecalciferol: 'vitamin_d3', vitamin_d_3: 'vitamin_d3',
  fish_oil: 'omega3', omega_3: 'omega3', epa_dha: 'omega3', krill_oil: 'omega3',
  magnesium_glycinate: 'magnesium', magnesium_citrate: 'magnesium', magnesium_oxide: 'magnesium',
  magnesium_bisglycinate: 'magnesium', mg: 'magnesium',
  coenzyme_q10: 'coq10', ubiquinone: 'coq10', ubiquinol: 'coq10',
  folic_acid: 'folate', vitamin_b9: 'folate',
  pyridoxine: 'vitamin_b6', b6: 'vitamin_b6',
  cobalamin: 'vitamin_b12', b12: 'vitamin_b12',
  ascorbic_acid: 'vitamin_c', vit_c: 'vitamin_c',
  alpha_lipoic_acid: 'alpha_lipoic', ala: 'alpha_lipoic',
  n_acetyl_cysteine: 'nac', nac_sup: 'nac',
  silymarin: 'milk_thistle', silybin: 'milk_thistle',
  glucosamine_sulfate: 'glucosamine', glucosamine_hcl: 'glucosamine',
  boswellia_serrata: 'boswellia', boswellic_acid: 'boswellia',
  withania_somnifera: 'ashwagandha', withania: 'ashwagandha',
  cordyceps_sinensis: 'cordyceps', cordyceps_militaris: 'cordyceps',
  hericium_erinaceus: 'lions_mane', lion_mane: 'lions_mane',
  ganoderma_lucidum: 'reishi', lingzhi: 'reishi',
  inonotus_obliquus: 'chaga',
  grifola_frondosa: 'maitake',
  piper_longum: 'piperine', black_pepper_extract: 'piperine',
  s_adenosyl_methionine: 'same', sam_e: 'same',
  trimethylglycine: 'betaine', tmg: 'betaine',
  '5_hydroxytryptophan': 'x5htp', '5_htp': 'x5htp', hydroxytryptophan: 'x5htp',
  gamma_aminobutyric_acid: 'gaba',
  phosphatidylcholine: 'lecithin', pc: 'lecithin',
  phosphatidylserine: 'phosphatidylserine', ps: 'phosphatidylserine',
  l_carnitine_tartrate: 'l_carnitine', lcart: 'l_carnitine',
  vitamin_k2_mk7: 'vitamin_k2', mk7: 'vitamin_k2', menaquinone: 'vitamin_k2',
  vitamin_e_tocopherol: 'vitamin_e', tocopherol: 'vitamin_e', tocotrienol: 'vitamin_e',
  selenium_yeast: 'selenium', selenomethionine: 'selenium',
  boron_boron: 'boron', boron_citrate: 'boron',
  potassium_citrate: 'potassium', potassium_chloride: 'potassium',
  DIM: 'dim', diindolylmethane: 'dim',
  taurine_supplement: 'taurine',
  // ── КРИТИЧНЫЕ: сломанные ссылки engine.ts → DB ──
  bromantan: 'bromantane',
  huperzine: 'huperzine_a',
  // ── UPPERCASE catalog keys → lowercase (для canonId dedup) ──
  SERRAPEPTASE: 'serrapeptase',
  NATTOKINASE: 'nattokinase',
  LUMBROKINASE: 'lumbrokinase',
  NARINGIN: 'naringin',
  BROMELAIN: 'bromelain',
  PAPAIN: 'papain',
  // ── Бренд-неймы → МНН ──
  heptral: 'same', legalon: 'milk_thistle', ursosan: 'udca',
  essentiale: 'lecithin', essentiale_forte: 'lecithin',
  // ── Префиксные/иммунные варианты ──
  immune_lactoferrin: 'lactoferrin', immune_support: 'lactoferrin',
  pharma_tadalafil: 'tadalafil',
  // ── Формы витаминов (B1) ──
  benfotiamine: 'vitamin_b1', sulbutiamine: 'vitamin_b1', thiamine: 'vitamin_b1',
  // ── Формы магния (доп) ──
  magnesium_l_threonate: 'magnesium', magnesium_malate: 'magnesium',
  magnesium_taurate: 'magnesium', magnesium_aspartate: 'magnesium',
  // ── Формы B12 (доп) ──
  cyanocobalamin: 'vitamin_b12', adenosylcobalamin: 'vitamin_b12',
  hydroxocobalamin: 'vitamin_b12',
  // ── Желчные кислоты ──
  udca: 'tudca', ursodeoxycholic_acid: 'tudca', tauroursodeoxycholic_acid: 'tudca',
  // ── Формы цинка ──
  zinc_carnosine: 'zinc', zinc_picolinate: 'zinc', zinc_gluconate: 'zinc',
  zinc_citrate: 'zinc', zinc_oxide: 'zinc', zinc_methionine: 'zinc',
  // ── L-аминокислоты (префиксные варианты) ──
  l_citrulline: 'citrulline', l_arginine: 'arginine', l_glutamine: 'glutamine',
  l_serine: 'serine', l_proline: 'proline', l_threonine: 'threonine',
  l_methionine: 'methionine', l_alanine: 'alanine', l_cysteine: 'cysteine',
  l_phenylalanine: 'phenylalanine', l_leucine: 'leucine',
  l_isoleucine: 'isoleucine', l_valine: 'valine',
  // ── Пептиды (варианты написания) ──
  tb_500: 'tb500', thymosin_beta_4: 'tb500', thymosin_b4: 'tb500',
  bpc_157: 'bpc157', cjc_1295: 'cjc1295', cjc1295_dac: 'cjc1295',
  ghrp_2: 'ghrp2', ghrp_6: 'ghrp6',
  growth_hormone_releasing_peptide_2: 'ghrp2',
  growth_hormone_releasing_peptide_6: 'ghrp6',
  ghk_cu: 'ghk_cu', copper_peptide: 'ghk_cu',
  thymosin_a1: 'thymosin_alpha1', pt_141: 'pt141', bremelanotide: 'pt141',
  melanotan_1: 'melanotan1', mt1: 'melanotan1',
  melanotan_2: 'melanotan2', mt2: 'melanotan2',
  // ── Ботанические синонимы ──
  rhodiola_rosea: 'rhodiola', panax_ginseng: 'ginseng',
  eleutherococcus: 'eleuthero', siberian_ginseng: 'eleuthero',
  ocimum_sanctum: 'holy_basil', tulsi: 'holy_basil',
  bacopa_monnieri: 'bacopa', brahmi: 'bacopa',
  ginkgo_biloba: 'ginkgo', centella_asiatica: 'gotu_kola',
  oleuropein: 'olive_extract', olive_leaf: 'olive_extract',
  allicin: 'garlic', allium_sativum: 'garlic',
  zingiber_officinale: 'ginger', ginger_root: 'ginger',
  epigallocatechin_gallate: 'egcg', green_tea_extract: 'egcg',
  cissus_quadrangularis: 'cissus',
  // ── Хим. синонимы ──
  pyrroloquinoline_quinone: 'pqq',
  nicotinamide_mononucleotide: 'nmn',
  beta_hydroxy_beta_methylbutyrate: 'hmb',
  branched_chain_amino_acids: 'bcaa',
  // ── Формы селена (доп) ──
  selenium_methylselenocysteine: 'selenium', sodium_selenite: 'selenium',
  // ── Формы калия (доп) ──
  potassium_iodide: 'potassium', potassium_sulfate: 'potassium',
  // ── Формы витамина K (доп) ──
  phylloquinone: 'vitamin_k2', vitamin_k1: 'vitamin_k2', menaquinone_7: 'vitamin_k2',
  // ── Куркумин формы ──
  curcuminoids: 'curcumin', curcuma_longa: 'curcumin', turmeric: 'curcumin',
  // ── Резвератрол формы ──
  trans_resveratrol: 'resveratrol',
  // ── Глутатион формы ──
  liposomal_glutathione: 'glutathione', reduced_glutathione: 'glutathione',
  gsh: 'glutathione',
  // ── Коэнзим Q10 доп ──
  coq10_ubiquinol: 'coq10',
};

/** Канонизирует ID вещества через SUB_ALIAS. */
export function canonId(id: string): string {
  const key = String(id || '').trim().toLowerCase();
  return SUB_ALIAS[key] || key;
}

// ═══════════════════════════════════════════════════════════════
//  Блэклист: вещества, НЕ назначаемые автоматически
// ═══════════════════════════════════════════════════════════════
// Политика: ноотропы, пептиды и врачебные рецептурные ДОЛЖНЫ оставаться в выдаче
// (по явному требованию пользователя). Блэклист содержит ТОЛЬКО:
//   1) Сырые химические элементы/компоненты — НЕ препараты (соль, кофеин, адреналин)
//   2) Гормоны/стероиды — это сама фармакология, не «поддержка»
//   3) Абстрактные классы препаратов (`*_drugs`) — не конкретные вещества
//   4) Технические дубликаты записей (`*_dup`)
// Дубли препаратов одного класса (AI, SERM, статины…) устраняются через SAME_CLASS_GROUPS.
export const TZ_AUTO_BLACKLIST = new Set<string>([
  // ── Сырые химикалии/минералы/элементы — НЕ препараты поддержки:
  'sodium', 'caffeine', 'adrenaline', 'copper', 'iron',
  'flavonoids', 'anthocyanins', 'c60',
  'omega6', 'omega7', 'omega9',
  'l_histidine', 'ornithine', 'inosine', 'nrf2_activator',
  'lecithin', 'taxifolin',
  'glutamate', 'histidine', 'lactate',
  'endocrine_marker', 'endocannabinoid',
  'antacid', 'pharma',
  // ── Гормоны/стероиды — это сама фармакология, не «поддержка»:
  'pregnenolone', 'neurosteroid', 'progesterone', 'dhea',
  'estradiol', 'testosterone', 'cortisol', 'insulin', 'glucagon', 'vasopressin',
  'follistatin', 'igf1', 'mgf', 'gip', 'glp1',
  // ── Технические дубликаты записей БД:
  'levothyroxine_dup', 'liothyronine_dup', 'metformin_dup',
  // ── Абстрактные классы препаратов (не вещества):
  'ace_inhibitor_drugs', 'antibiotic_drugs', 'anticoagulant_drugs', 'anticonvulsant_drugs',
  'antidepressant_drugs', 'antidiabetic_drugs', 'antihistamine_drugs', 'antiplatelet_drugs',
  'antipsychotic_drugs', 'antithyroid_drugs', 'anxiolytic_drugs', 'arb_drugs',
  'beta_blocker_drugs', 'ccb_drugs', 'corticosteroid_drugs', 'diuretic_drugs',
  'immunosuppressant_drugs', 'nsaid_drugs', 'ppi_drugs', 'statin_drugs', 'thyroid_drugs',
  // Рецептурная/процедурная эскалация: не добавлять автоматически без
  // явного врачебного режима и подтверждённого показания.
  'warfarin', 'enoxaparin', 'sulodexide', 'lumbrokinase', 'dipyridamole', 'pentoxifylline',
]);

// ═══════════════════════════════════════════════════════════════
//  Phase-блэклист: вещества, запрещённые на определённых фазах
// ═══════════════════════════════════════════════════════════════
// Принцип: на курсе тестостерон ВЫСОКИЙ от ААС → Т-бустеры бесполезны.
//          На ПКТ эстрадиол ПАДАЕТ → AI не нужны (могут крашнуть E2).
export const PHASE_BLOCKLIST: Record<string, Set<string>> = {
  // ── Курс: Т-бустеры бесполезны (тест от ААС и так высокий),
  //         кломифен/энкломифен — для ПКТ (стимуляция HPTA не нужна)
  course: new Set([
    'tribulus', 'tribulus_terrestris', 'fenugreek', 'tongkat_ali', 'eurycoma_longifolia',
    'd_aspartic_acid', 'daa', 'ecdysterone', 'ecdysteroids', 'safed_musli', 'shilajit',
    'clomi', 'clomiphene', 'enclomiphene', 'enclomid', 'clomid',
    'saw_palmetto', 'saw_palmetto',
  ]),
  // ── Мост: те же ограничения (тест ещё подавлен от остаточного ААС)
  bridge: new Set([
    'tribulus', 'tribulus_terrestris', 'fenugreek', 'tongkat_ali', 'eurycoma_longifolia',
    'd_aspartic_acid', 'daa', 'ecdysterone', 'ecdysteroids', 'safed_musli', 'shilajit',
    'clomi', 'clomiphene', 'enclomiphene', 'enclomid', 'clomid',
  ]),
  // ── ПКТ: AI не нужны (E2 падает естественно при отмене ААС),
  //        каберголин — только при подтверждённой гиперпролактинемии
  pct: new Set([
    'anastrozole', 'letrozole', 'exemestane', 'arimidex', 'femara',
  ]),
  // ── Фертильность: антиэстрогены (нужен нормальный E2 для сперматогенеза)
  fertility: new Set([
    'anastrozole', 'letrozole', 'exemestane', 'arimidex', 'femara',
  ]),
};

// ═══════════════════════════════════════════════════════════════
//  Same-class дедупликация: выбор препарата из класса блокирует альтернативы
// ═══════════════════════════════════════════════════════════════
// Решает проблему дублей: anastrozole + letrozole в одном плане.
// При markUsed(id): если id ∈ группе → ALL ID группы помечаются как used.
// Канонизация (canonId) применяется перед поиском группы.
export const SAME_CLASS_GROUPS: Record<string, string[]> = {
  ai:           ['anastrozole', 'letrozole', 'exemestane', 'arimidex', 'femara'],
  serm:         ['tamoxifen', 'tamox', 'clomi', 'clomid', 'enclomid', 'enclomiphene', 'raloxifene'],
  statin:       ['atorvastatin', 'rosuvastatin', 'simvastatin', 'pravastatin', 'pitavastatin', 'red_yeast', 'red_yeast_rice'],
  arb:          ['telmisartan', 'losartan', 'valsartan', 'irbesartan', 'olmesartan', 'candesartan'],
  ace:          ['lisinopril', 'enalapril', 'ramipril', 'perindopril', 'captopril'],
  bb:           ['metoprolol', 'atenolol', 'bisoprolol', 'carvedilol', 'propranolol', 'nebivolol'],
  ccb:          ['amlodipine', 'nifedipine', 'verapamil', 'diltiazem'],
  diuretic:     ['furosemide', 'hydrochlorothiazide', 'chlorthalidone', 'spironolactone'],
  anticoag:     ['warfarin', 'rivaroxaban', 'apixaban', 'dabigatran'],
  antiplatelet: ['clopidogrel', 'ticagrelor', 'aspirin'],
  racetam:      ['piracetam', 'aniracetam', 'oxiracetam', 'pramiracetam', 'coluracetam', 'fasoracetam'],
  choline_donor:['citicoline', 'alpha_gpc', 'l_alpha_gpc', 'choline', 'cdp_choline'],
  ssri:         ['fluoxetine', 'sertraline', 'citalopram', 'escitalopram'],
  snri:         ['venlafaxine', 'duloxetine'],
  benzodiazepine:['alprazolam', 'diazepam', 'lorazepam', 'clonazepam'],
  antipsychotic:['olanzapine', 'quetiapine', 'risperidone', 'aripiprazole', 'haloperidol'],
  nsaid:        ['ibuprofen', 'naproxen', 'celecoxib', 'diclofenac', 'meloxicam'],
  corticosteroid:['prednisone', 'dexamethasone', 'hydrocortisone', 'methylprednisolone'],
  antidiabetic: ['metformin', 'pioglitazone', 'acarbose', 'semaglutide'],
  thyroid:      ['levothyroxine', 'liothyronine', 'methimazole', 'propylthiouracil'],
  dopamine_agonist:['cabergoline', 'bromocriptine', 'pramipexole'],
  anticonvulsant:['valproate', 'lamotrigine', 'carbamazepine', 'phenytoin'],
  maoi:         ['selegiline', 'rasagiline', 'moclobemide'],
  estrogen_modulator: ['dim', 'indinol', 'i3c', 'indole_3_carbinol'],
};

// Обратный индекс: id → ключ группы (для быстрого lookup)
export const ID_TO_CLASS: Record<string, string> = (() => {
  const m: Record<string, string> = {};
  for (const [cls, ids] of Object.entries(SAME_CLASS_GROUPS)) for (const id of ids) m[id] = cls;
  return m;
})();

/** Возвращает все ID препаратов того же класса (пусто, если id не в группе). */
export function sameClassIds(id: string): string[] {
  const cls = ID_TO_CLASS[canonId(id)] || ID_TO_CLASS[id];
  return cls ? SAME_CLASS_GROUPS[cls] : [];
}
