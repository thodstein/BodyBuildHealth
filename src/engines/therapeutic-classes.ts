// therapeutic-classes.ts — справочник терапевтических классов для клинически релевантной замены

export type TherapeuticClass =
  | 'hepatoprotector'
  | 'cardioprotector'
  | 'antioxidant'
  | 'adaptogen'
  | 'nootropic'
  | 'joint'
  | 'lipid_modifier'
  | 'insulin_sensitizer'
  | 'sleep'
  | 'antiinflammatory'
  | 'gut'
  | 'immune'
  | 'aas_protection'
  | 'pct'
  | 'renal'
  | 'testosterone'
  | 'estrogen_control'
  | 'prostate'
  | 'blood_flow'
  | 'fertility'
  | 'cortisol'
  | 'hair_skin_nails'
  | 'mitochondrial'
  | 'detox'
  | 'bone'
  | 'eye'
  | 'iron'
  | 'b_vitamin'
  | 'electrolyte'
  | 'pharma_antihypertensive'
  | 'pharma_ai'
  | 'pharma_oral_aas'
  | 'pharma_inject_aas'
  | 'peptide'
  | 'mushroom'
  | 'fiber'
  | 'prebiotic'
  | 'digestive'
  | 'thermogenic'
  | 'muscle_build'
  | 'omega_fatty_acid';

export const THERAPEUTIC_CLASS_MAP: Record<string, TherapeuticClass> = {
  // ГЕПАТОПРОТЕКТОРЫ
  nac: 'hepatoprotector', milk_thistle: 'hepatoprotector', tudca: 'hepatoprotector',
  phosphatidylcholine: 'hepatoprotector', alpha_lipoic: 'hepatoprotector',
  artichoke: 'hepatoprotector', glutathione: 'hepatoprotector', glycine: 'hepatoprotector',
  dandelion: 'hepatoprotector', boldo: 'hepatoprotector', schisandra: 'hepatoprotector',
  licorice: 'hepatoprotector',

  // КАРДИОПРОТЕКТОРЫ
  coq10: 'cardioprotector', magnesium: 'cardioprotector',
  magnesium_glycinate: 'cardioprotector', magnesium_citrate: 'cardioprotector',
  magnesium_l_threonate: 'cardioprotector', taurine: 'cardioprotector',
  omega3: 'cardioprotector', fish_oil: 'cardioprotector', krill_oil: 'cardioprotector',
  algae_oil: 'cardioprotector', telmisartan: 'cardioprotector', nebivolol: 'cardioprotector',
  carvedilol: 'cardioprotector', amlodipine: 'cardioprotector', lisinopril: 'cardioprotector',
  enalapril: 'cardioprotector', hesperidin: 'cardioprotector', diosmin: 'cardioprotector',
  rutin: 'cardioprotector', pycnogenol: 'cardioprotector', grape_seed: 'cardioprotector',
  hawthorn: 'cardioprotector',

  // АНТИОКСИДАНТЫ
  vitamin_c: 'antioxidant', vitamin_e: 'antioxidant', selenium: 'antioxidant',
  selenium_methionine: 'antioxidant', curcumin: 'antioxidant', astaxanthin: 'antioxidant',
  pqq: 'antioxidant', resveratrol: 'antioxidant', lutein: 'antioxidant',
  zeaxanthin: 'antioxidant', egcg: 'antioxidant', quercetin: 'antioxidant',
  trans_resveratrol: 'antioxidant', idebenone: 'antioxidant', lycopene: 'antioxidant',
  beta_carotene: 'antioxidant',

  // АДАПТОГЕНЫ
  ashwagandha: 'adaptogen', rhodiola: 'adaptogen', ginseng: 'adaptogen',
  holy_basil: 'adaptogen', eleutherococcus: 'adaptogen', tongkat_ali: 'adaptogen',
  fadogia: 'adaptogen', maca: 'adaptogen',

  // НООТРОПЫ
  theanine: 'nootropic', bacopa: 'nootropic', lion_mane: 'nootropic',
  phosphatidylserine: 'nootropic', agmatine: 'nootropic', tyrosine: 'nootropic',
  '5htp': 'nootropic', gaba: 'nootropic', l_dopa: 'nootropic', huperzine: 'nootropic',
  vinpocetine: 'nootropic', piracetam: 'nootropic', noopept: 'nootropic',
  phenylpiracetam: 'nootropic',

  // СУСТАВЫ
  glucosamine: 'joint', chondroitin: 'joint', msm: 'joint', collagen: 'joint',
  collagen_hydrolyzed: 'joint', boswellia: 'joint', hyaluronic_acid: 'joint',
  sam_e: 'joint', cissus: 'joint',

  // ЛИПИД-МОДИФИКАТОРЫ
  bergamot: 'lipid_modifier', red_yeast: 'lipid_modifier', garlic: 'lipid_modifier',
  garlic_extract: 'lipid_modifier', berberine: 'lipid_modifier', niacin: 'lipid_modifier',
  niacinamide: 'lipid_modifier', policosanol: 'lipid_modifier', plant_sterols: 'lipid_modifier',

  // ИНСУЛИН-СЕНСИТАЙЗЕРЫ
  chromium: 'insulin_sensitizer', chromium_picolinate: 'insulin_sensitizer',
  cinnamon: 'insulin_sensitizer', gymnema: 'insulin_sensitizer',
  banaba: 'insulin_sensitizer', inositol: 'insulin_sensitizer',

  // СОН
  melatonin: 'sleep',
  // glycine уже в hepatoprotector
  // magnesium_glycinate уже в cardioprotector
  ziziphus: 'sleep', valerian: 'sleep', passionflower: 'sleep', lemon_balm: 'sleep',

  // ПРОТИВОВОСПАЛИТЕЛЬНЫЕ
  bromelain: 'antiinflammatory', serrapeptase: 'antiinflammatory', nattokinase: 'antiinflammatory',

  // ЖКТ
  probiotics: 'gut', lactobacillus: 'gut', bifidobacterium: 'gut', glutamine: 'gut',
  zinc_carnosine: 'gut', digestive_enzymes: 'gut', prebiotics: 'gut',
  inulin: 'prebiotic', fos: 'prebiotic', gos: 'prebiotic',
  psyllium: 'fiber', oat_fiber: 'fiber',

  // ИММУНИТЕТ
  vitamin_d3: 'immune', zinc: 'immune', zinc_picolinate: 'immune',
  reishi: 'immune', chaga: 'immune', cordyceps: 'immune',
  turkey_tail: 'immune', maitake: 'immune', shiitake: 'immune',
  lactoferrin: 'immune', beta_glucan: 'immune', colostrum: 'immune',

  // ЗАЩИТА ААС
  hcg: 'aas_protection', anastrozole: 'aas_protection', letrozole: 'aas_protection',
  exemestane: 'aas_protection', tamoxifen: 'aas_protection', clomiphene: 'aas_protection',
  enclomiphene: 'aas_protection', raloxifene: 'aas_protection',

  // ПОЧКИ
  astragalus: 'renal', ketosteril: 'renal', nettle: 'renal',

  // ТЕСТОСТЕРОН
  boron: 'testosterone', d_aspartic_acid: 'testosterone', dhea: 'testosterone',
  pregnenolone: 'testosterone',

  // ЭСТРОГЕН-КОНТРОЛЬ
  diindolylmethane: 'estrogen_control', calcium_d_glucarate: 'estrogen_control',

  // ПРОСТАТА
  saw_palmetto: 'prostate', pygeum: 'prostate', stinging_nettle: 'prostate',
  pumpkin_seed: 'prostate',

  // КРОВОТОК
  citrulline: 'blood_flow', arginine: 'blood_flow', nitrates: 'blood_flow',
  beetroot: 'blood_flow',

  // ФЕРТИЛЬНОСТЬ
  // enclomiphene уже в aas_protection
  folate: 'fertility',

  // КОРТИЗОЛ
  magnolia: 'cortisol',

  // ВОЛОСЫ / КОЖА / НОГТИ
  biotin: 'hair_skin_nails', silica: 'hair_skin_nails', keratin: 'hair_skin_nails',

  // МИТОХОНДРИИ
  l_carnitine: 'mitochondrial', acetyl_l_carnitine: 'mitochondrial',
  creatine: 'mitochondrial', ribose: 'mitochondrial', nad: 'mitochondrial',
  nr: 'mitochondrial', nmn: 'mitochondrial',

  // ДЕТОКС
  chlorella: 'detox', cilantro: 'detox',

  // КОСТИ
  calcium: 'bone', calcium_citrate: 'bone', calcium_d3: 'bone',
  vitamin_k2: 'bone', strontium: 'bone',

  // ГЛАЗА
  vitamin_a: 'eye', bilberry: 'eye',

  // ЖЕЛЕЗО
  iron: 'iron', iron_bisglycinate: 'iron', iron_succinate: 'iron',

  // ВИТАМИНЫ B
  vitamin_b1: 'b_vitamin', vitamin_b2: 'b_vitamin', vitamin_b3: 'b_vitamin',
  vitamin_b5: 'b_vitamin', vitamin_b6: 'b_vitamin', vitamin_b7: 'b_vitamin',
  vitamin_b9: 'b_vitamin', vitamin_b12: 'b_vitamin',
  b_complex: 'b_vitamin', b_complex_2: 'b_vitamin',

  // ЭЛЕКТРОЛИТЫ
  potassium: 'electrolyte', sodium: 'electrolyte',

  // ФАРМА: антигипертензивные (расширения)
  hydrochlorothiazide: 'pharma_antihypertensive', indapamide: 'pharma_antihypertensive',
  spironolactone: 'pharma_antihypertensive', eplerenone: 'pharma_antihypertensive',

  // ФАРМА: оральные ААС
  oxandrolone: 'pharma_oral_aas', winstrol: 'pharma_oral_aas', anadrol: 'pharma_oral_aas',
  turinabol: 'pharma_oral_aas', proviron: 'pharma_oral_aas', dianabol: 'pharma_oral_aas',
  superdrol: 'pharma_oral_aas', halotestin: 'pharma_oral_aas',

  // ФАРМА: инъекционные ААС
  testosterone_enanthate: 'pharma_inject_aas', testosterone_cypionate: 'pharma_inject_aas',
  testosterone_propionate: 'pharma_inject_aas', nandrolone_decanoate: 'pharma_inject_aas',
  nandrolone_phenylpropionate: 'pharma_inject_aas', trenbolone_enanthate: 'pharma_inject_aas',
  trenbolone_acetate: 'pharma_inject_aas', boldenone: 'pharma_inject_aas',
  boldenone_undecylenate: 'pharma_inject_aas', masteron: 'pharma_inject_aas',
  drostanolone: 'pharma_inject_aas', primobolan: 'pharma_inject_aas',
  methenolone: 'pharma_inject_aas',

  // ПЕПТИДЫ
  bpc157: 'peptide', tb500: 'peptide', hgh_fragment: 'peptide',
  ipamorelin: 'peptide', sermorelin: 'peptide', cjc1295: 'peptide',

  // ПИЩЕВАРЕНИЕ
  papain: 'digestive', betaine_hcl: 'digestive',

  // ТЕРМОГЕННЫЕ
  caffeine: 'thermogenic', green_tea_extract: 'thermogenic', synephrine: 'thermogenic',
  yohimbine: 'thermogenic', capsaicin: 'thermogenic',

  // МЫШЕЧНЫЙ РОСТ
  creatine_monohydrate: 'muscle_build', hmb: 'muscle_build', eaas: 'muscle_build',
  bcaas: 'muscle_build', leucine: 'muscle_build', beta_alanine: 'muscle_build',

  // ЭЛЕКТРОЛИТЫ (продолжение)
  copper: 'electrolyte', manganese: 'electrolyte', iodine: 'electrolyte',
  molybdenum: 'electrolyte', vanadium: 'electrolyte',
};

export function getTherapeuticClassLabel(cls: TherapeuticClass): string {
  const labels: Record<TherapeuticClass, string> = {
    hepatoprotector: 'Гепатопротектор (защита печени)',
    cardioprotector: 'Кардиопротектор / Антигипертензивный',
    antioxidant: 'Антиоксидант',
    adaptogen: 'Адаптоген',
    nootropic: 'Ноотроп / Когнитивный',
    joint: 'Суставный / Хондропротектор',
    lipid_modifier: 'Липид-нижежающий',
    insulin_sensitizer: 'Инсулин-сенситайзер',
    sleep: 'Сон / Релаксация',
    antiinflammatory: 'Противовоспалительный',
    gut: 'ЖКТ / Пробиотик / Ферменты',
    immune: 'Иммуномодулятор',
    aas_protection: 'Защита на курсе ААС',
    pct: 'ПКТ / Восстановление',
    renal: 'Нефропротектор',
    testosterone: 'Тестостерон / Андроген',
    estrogen_control: 'Контроль эстрогенов / АИ',
    prostate: 'Простата',
    blood_flow: 'Кровоток / NO-донор',
    fertility: 'Фертильность',
    cortisol: 'Кортизол / Адаптация к стрессу',
    hair_skin_nails: 'Волосы / Кожа / Ногти',
    mitochondrial: 'Митохондрии / Энергия',
    detox: 'Детокс',
    bone: 'Кости / Кальций',
    eye: 'Глаза / Зрение',
    iron: 'Железо / Гематокритический',
    b_vitamin: 'Витамины B',
    electrolyte: 'Электролит',
    pharma_antihypertensive: 'Фарма: Антигипертензивный',
    pharma_ai: 'Фарма: Ингибитор ароматазы',
    pharma_oral_aas: 'Фарма: Оральный ААС',
    pharma_inject_aas: 'Фарма: Инъекционный ААС',
    peptide: 'Пептид',
    mushroom: 'Грибной экстракт',
    fiber: 'Клетчатка',
    prebiotic: 'Пребиотик',
    digestive: 'Пищеварение / Ферменты',
    thermogenic: 'Термогенник',
    muscle_build: 'Мышечный рост / Анаболик',
    omega_fatty_acid: 'Омега-жирные кислоты',
  };
  return labels[cls] || cls;
}
