import { readFileSync, writeFileSync } from 'fs';

const filePath = 'D:\\BodyBuildHealth\\src\\data\\support-catalog-data.ts';
let content = readFileSync(filePath, 'utf8');

// ══════════════════════════════════════════════
// ENRICHMENT MAPPINGS
// (analog and specialInstructions for each substance)
// ══════════════════════════════════════════════

const ANALOG_MAP = {
  silicon: ['calcium', 'boron'],
  calcium: ['magnesium', 'vitamin_d3'],
  phosphorus: ['calcium', 'magnesium'],
  trace_minerals: ['zinc', 'selenium'],
  chromium: ['vanadium', 'berberine'],
  gotu_kola: ['bacopa', 'ginkgo'],
  ecdysterone: ['creatine', 'beta_ecdysterone'],
  shilajit: ['ashwagandha', 'rhodiola'],
  schisandra: ['milk_thistle', 'ashwagandha'],
  ginger: ['curcumin', 'bromelain'],
  astaxanthin: ['lycopene', 'lutein'],
  resveratrol: ['quercetin', 'pterostilbene'],
  quercetin: ['resveratrol', 'apigenin'],
  egcg: ['green_tea', 'grape_seed_extract'],
  sulforaphane: ['nrf2_activator', 'curcumin'],
  melatonin: ['gaba', 'magnesium_glycinate'],
  ginkgo: ['bacopa', 'vinpocetine'],
  cjc1295: ['ipamorelin', 'ghrp2'],
  ipamorelin: ['cjc1295', 'ghrp2'],
  ghrp2: ['ghrp6', 'ipamorelin'],
  ghrp6: ['ghrp2', 'ipamorelin'],
  follistatin: ['myostatin_inhibitor', 'ace031'],
  semax: ['selank', 'cerebrolysin'],
  selank: ['semax', 'phenibut'],
  dsip: ['melatonin', 'gaba'],
  p21: ['semax', 'cerebrolysin'],
  mots_c: ['humanin', 'ss31'],
  humanin: ['mots_c', 'ss31'],
  ss31: ['mots_c', 'humanin'],
  thymosin_alpha1: ['thymosin_beta4', 'colostrum'],
  ghk_cu: ['bpc157', 'tb500'],
  bpc157: ['tb500', 'ghk_cu'],
  tb500: ['bpc157', 'ghk_cu'],
  melanotan1: ['melanotan2', 'pt141'],
  melanotan2: ['melanotan1', 'pt141'],
  pt141: ['melanotan2', 'tadalafil'],
  gonadorelin: ['kisspeptin', 'hcg'],
  kisspeptin: ['gonadorelin', 'hcg'],
  glp1: ['semaglutide', 'berberine'],
  gip: ['glp1', 'tirzepatide'],
  cerebrolysin: ['cortexin', 'semax'],
  cortexin: ['cerebrolysin', 'semax'],
  elastin: ['collagen', 'gelatin'],
  histidine: ['beta_alanine', 'carnosine'],
  cysteine: ['nac', 'taurine'],
  serine: ['glycine', 'threonine'],
  proline: ['glycine', 'hydroxyproline'],
  aspartate: ['glutamate', 'alpha_ketoglutarate'],
  ornithine: ['citrulline', 'arginine'],
  threonine: ['serine', 'glycine'],
  lysine: ['arginine', 'proline'],
  phenylalanine: ['tyrosine', 'tryptophan'],
  glutamate: ['glutamine', 'gaba'],
  alpha_ketoglutarate: ['glutamine', 'ornithine'],
  reishi: ['chaga', 'lions_mane'],
  chaga: ['reishi', 'turkey_tail'],
  maitake: ['shiitake', 'reishi'],
  shiitake: ['maitake', 'reishi'],
  agaricus: ['reishi', 'maitake'],
  turkey_tail: ['reishi', 'chaga'],
  lutein: ['zeaxanthin', 'astaxanthin'],
  lycopene: ['astaxanthin', 'lutein'],
  anthocyanins: ['grape_seed_extract', 'pycnogenol'],
  grape_seed_extract: ['pycnogenol', 'anthocyanins'],
  pycnogenol: ['grape_seed_extract', 'citrus_bioflavonoids'],
  cocoa_flavanols: ['green_tea', 'grape_seed_extract'],
  c60: ['coq10', 'astaxanthin'],
  nrf2_activator: ['sulforaphane', 'curcumin'],
  olive_extract: ['grape_seed_extract', 'resveratrol'],
  citrus_bioflavonoids: ['hesperidin', 'rutin'],
  flavonoids: ['quercetin', 'apigenin'],
  ellagic_acid: ['resveratrol', 'pomegranate'],
  ursolic_acid: ['oleanolic_acid', 'rosemary'],
  magnolia: ['lemon_balm', 'ashwagandha'],
  gentian: ['artichoke', 'milk_thistle'],
  artichoke: ['milk_thistle', 'gentian'],
  garlic: ['nattokinase', 'curcumin'],
  mangosteen: ['green_tea', 'quercetin'],
  nattokinase: ['serrapeptase', 'lumbrokinase'],
  grapefruit_seed: ['garlic', 'cranberry'],
  nobiletin: ['tangeretin', 'quercetin'],
  fisetin: ['quercetin', 'resveratrol'],
  baicalin: ['scutellaria', 'quercetin'],
  taxifolin: ['quercetin', 'dihydroquercetin'],
  soy_isoflavones: ['red_clover', 'flaxseed'],
  rosemary: ['curcumin', 'rosmarinic_acid'],
  cinnamon: ['berberine', 'chromium'],
  pomegranate: ['grape_seed_extract', 'ellagic_acid'],
  cranberry: ['d_mannose', 'vitamin_c'],
  urolithin_a: ['resveratrol', 'ellagic_acid'],
  bile_acids: ['tudca', 'milk_thistle'],
  piracetam: ['aniracetam', 'oxiracetam'],
  aniracetam: ['piracetam', 'pramiracetam'],
  oxiracetam: ['piracetam', 'pramiracetam'],
  pramiracetam: ['piracetam', 'oxiracetam'],
  fasoracetam: ['piracetam', 'aniracetam'],
  coluracetam: ['piracetam', 'citicoline'],
  noopept: ['piracetam', 'semax'],
  citicoline: ['alpha_gpc', 'phosphatidylcholine'],
  alpha_gpc: ['citicoline', 'phosphatidylserine'],
  vinpocetine: ['ginkgo', 'nicergoline'],
  modafinil: ['armodafinil', 'phenylpiracetam'],
  selegiline: ['rasagiline', 'deprenyl'],
  memantine: ['amantadine', 'ketamine'],
  bromantane: ['selegiline', 'phenylpiracetam'],
  tianeptine: ['st_johns_wort', 'saffron'],
  huperzine_a: ['galantamine', 'donepezil'],
  apigenin: ['luteolin', 'chamomile'],
  lemon_balm: ['magnolia', 'ashwagandha'],
  saffron: ['st_johns_wort', 'rhodiola'],
  metformin: ['berberine', 'semaglutide'],
  semaglutide: ['glp1', 'liraglutide'],
  finasteride: ['dutasteride', 'saw_palmetto'],
  cabergoline: ['bromocriptine', 'p5p'],
  testosterone: ['test_enan', 'test_prop'],
  caffeine: ['theacrine', 'green_tea'],
  diclofenac: ['meloxicam', 'ibuprofen'],
  meloxicam: ['diclofenac', 'celecoxib'],
  ppi_drugs: ['famotidine', 'antacid'],
  spironolactone: ['eplerenone', 'amiloride'],
  antidepressant_drugs: ['st_johns_wort', 'saffron'],
  anxiolytic_drugs: ['phenibut', 'magnesium'],
  antipsychotic_drugs: ['abilify', 'seroquel'],
  anticonvulsant_drugs: ['lamotrigine', 'valproate'],
  ketamine: ['memantine', 'tianeptine'],
  antidiabetic_drugs: ['metformin', 'semaglutide'],
  thyroid_drugs: ['levothyroxine', 'ashwagandha'],
  corticosteroid_drugs: ['prednisone', 'budesonide'],
  statin_drugs: ['coq10', 'red_rice'],
  antiplatelet_drugs: ['aspirin', 'nattokinase'],
  anticoagulant_drugs: ['warfarin', 'apixaban'],
  ace_inhibitor_drugs: ['arb_drugs', 'nebivolol'],
  arb_drugs: ['ace_inhibitor_drugs', 'nebivolol'],
  ccb_drugs: ['amlodipine', 'diltiazem'],
  beta_blocker_drugs: ['nebivolol', 'metoprolol'],
  diuretic_drugs: ['spironolactone', 'hctz'],
  immunosuppressant_drugs: ['cyclosporine', 'tacrolimus'],
  antibiotic_drugs: ['amoxicillin', 'ciprofloxacin'],
  antihistamine_drugs: ['quercetin', 'loratadine'],
  nsaid_drugs: ['diclofenac', 'ibuprofen'],
  levothyroxine: ['thyroid_drugs', 'ashwagandha'],
  antithyroid_drugs: ['methimazole', 'ptu'],
  postbiotics: ['probiotics', 'prebiotics'],
  paraprobiotics: ['probiotics', 'postbiotics'],
  resistant_starch: ['fiber', 'beta_glucan'],
  beta_glucan: ['fiber', 'resistant_starch'],
  fiber: ['beta_glucan', 'resistant_starch'],
  hmo_prebiotics: ['fos', 'gos'],
  lactate: ['probiotics', 'postbiotics'],
  digestive_enzymes: ['bromelain', 'papain'],
  zinc_carnosine: ['l_carnosine', 'zinc'],
  colostrum: ['beta_glucan', 'ahcc'],
  ahcc: ['reishi', 'beta_glucan'],
  pectin: ['fiber', 'resistant_starch'],
  fadogia: ['tongkat_ali', 'ashwagandha'],
  andrographis: ['echinacea', 'astragalus'],
  boswellia: ['curcumin', 'ginger'],
  cissus: ['glucosamine', 'chondroitin'],
  licorice: ['ashwagandha', 'rhodiola'],
  antacid: ['ppi_drugs', 'famotidine'],
  cortisol: ['adaptogen_complex', 'phosphatidylserine'],
  adrenaline: ['beta_blocker_drugs', 'magnesium'],
  endocrine_marker: ['dhea', 'pregnenolone'],
  neurosteroid: ['pregnenolone', 'dhea'],
  glucagon: ['glp1', 'berberine'],
  nmn: ['nr', 'coq10'],
  oxytocin: ['pt141', 'melanotan2'],
  dhea: ['pregnenolone', '7_keto_dhea'],
  estradiol: ['soy_isoflavones', 'dhea'],
  progesterone: ['dhea', 'pregnenolone'],
  insulin: ['metformin', 'berberine'],
  vasopressin: ['oxytocin', 'corticosteroid_drugs'],
  endocannabinoid: ['cbd', 'omega3'],
  pregrenolone: ['dhea', 'neurosteroid'],
  immune_support: ['astragalus', 'echinacea'],
  igf1: ['cjc1295', 'ipamorelin'],
  mgf: ['cjc1295', 'igf1'],
  kpv: ['glutathione', 'nac'],
  ASTRAGALUS: ['echinacea', 'andrographis'],
  NAC: ['glutathione', 'alpha_lipoic'],
  TUDCA: ['milk_thistle', 'nac'],
  DIOSMIN: ['hesperidin', 'rutin'],
  BERGAMOT: ['citrus_bioflavonoids', 'berberine'],
  SERRAPEPTASE: ['nattokinase', 'bromelain'],
  PAPAIN: ['bromelain', 'serrapeptase'],
  PHARMA_TADALAFIL: ['sildenafil', 'icariin'],
  LUMBROKINASE: ['nattokinase', 'serrapeptase'],
  HORSE_CHESTNUT: ['diosmin', 'hesperidin'],
  INOSINE: ['creatine', 'beta_alanine'],
  NARINGIN: ['grapefruit_seed', 'citrus_bioflavonoids'],
  PHARMA_CABERGOLINE: ['cabergoline', 'bromocriptine'],
  NATTOKINASE: ['serrapeptase', 'lumbrokinase'],
  HESPERIDIN: ['diosmin', 'citrus_bioflavonoids'],
  CITRUS_BIOFLAVONOIDS: ['hesperidin', 'rutin'],
  BROMANTANE: ['selegiline', 'phenylpiracetam'],
  FASORACETAM: ['piracetam', 'aniracetam'],
  AGMATINE: ['citrulline', 'arginine'],
  TMG: ['glycine', 'sam_e'],
  SAME: ['tm_g', 'methylfolate'],
  VITAMIN_B1: ['benfotiamine', 'alpha_lipoic'],
  COLOSTRUM: ['beta_glucan', 'ahcc'],
  PYCNOGENOL: ['grape_seed_extract', 'citrus_bioflavonoids'],
  BROMELAIN: ['serrapeptase', 'papain'],
  FOLATE: ['methylfolate', 'vitamin_b12'],
  LECITHIN: ['phosphatidylcholine', 'citicoline'],
  PHOSPHATIDYLSERINE: ['phosphatidylcholine', 'citicoline'],
  PHOSPHATIDYLCHOLINE: ['lecithin', 'citicoline'],
  ARTICHOKE: ['milk_thistle', 'gentian'],
  VITAMIN_E: ['astaxanthin', 'coq10'],
  BERBERINE: ['metformin', 'cinnamon'],
  L_THEANINE: ['magnesium_glycinate', 'gaba'],
  GLYCINE: ['magnesium_glycinate', 'taurine'],
  RUTIN: ['hesperidin', 'citrus_bioflavonoids'],
  HEPTRAL: ['nac', 'milk_thistle'],
  LEGALON: ['milk_thistle', 'tudca'],
  IBUDILAST: ['cilostazol', 'vinpocetine'],
};

const SI_MAP = {
  silicon: ['Принимать с едой', 'Курс 12 нед, перерыв 4 нед', 'Не сочетать с алюминиевыми антацидами'],
  calcium: ['Принимать с едой', 'Отдельно от железа (интервал 2 ч)', 'Цитрат натощак, карбонат с едой'],
  phosphorus: ['Принимать с едой', 'Не превышать 1000 мг/сут', 'Контролировать Ca/P баланс'],
  trace_minerals: ['Принимать с едой', 'Не превышать дозировку', 'Хранить в сухом месте'],
  chromium: ['Принимать с едой', 'Не превышать 1000 мкг/сут', 'Может повышать чувствительность к инсулину'],
  gotu_kola: ['Принимать с едой 2 раза в день', 'Курс 8-12 нед, перерыв 2 нед', 'Не превышать 1000 мг/сут'],
  ecdysterone: ['Принимать с едой (с белком)', 'Курс 8-12 нед', 'Лучше с жирами для абсорбции'],
  shilajit: ['Принимать с едой', 'Растворять в тёплой воде', 'Не превышать 500 мг/сут'],
  schisandra: ['Принимать с едой 2 раза в день', 'Курс 8-12 нед, перерыв 2 нед', 'Не принимать вечером — бессонница'],
  ginger: ['Принимать с едой', 'Не превышать 3 г/сут', 'С осторожностью при желчнокаменной болезни'],
  astaxanthin: ['Принимать с жирной пищей', '12 мг/сут достаточно', 'Курс до 12 нед'],
  resveratrol: ['Принимать с едой (с жирами)', 'Выше биодоступность с пиперином', 'Не превышать 1000 мг/сут'],
  quercetin: ['Принимать с едой', 'Лучше с бромелайном для усвоения', 'Курс 8-12 нед, перерыв 4 нед'],
  egcg: ['Принимать натощак', 'Не с железом (снижает всасывание)', 'Не превышать 800 мг/сут'],
  sulforaphane: ['Принимать натощак', 'Активировать мирозиназу', 'Курс 8-12 нед, перерыв 4 нед'],
  melatonin: ['Принимать за 30 мин до сна', 'Не превышать 10 мг', 'Не принимать долго — делать перерывы'],
  ginkgo: ['Принимать с едой 2 раза в день', 'Курс 8-12 нед, перерыв 4 нед', 'С осторожностью с антикоагулянтами'],
  cjc1295: ['Хранить в холодильнике 2-8°C', 'Вводить п/к 1 раз в неделю', 'Не превышать 2 мг/нед'],
  ipamorelin: ['Хранить в холодильнике 2-8°C', 'Вводить п/к 2-3 раза в день натощак', 'Не есть за 2 ч до и 30 мин после'],
  ghrp2: ['Хранить в холодильнике 2-8°C', 'Вводить п/к 2-3 раза в день натощак', 'Не есть за 2 ч до и 30 мин после'],
  ghrp6: ['Хранить в холодильнике 2-8°C', 'Вводить п/к 2-3 раза в день натощак', 'Вызывает сильный аппетит — контролировать'],
  follistatin: ['Хранить в холодильнике 2-8°C', 'Вводить п/к 2 раза в неделю', 'Курс 8-12 нед'],
  semax: ['Закапывать интраназально', 'Курс 10-14 дней, перерыв 2 нед', 'Не превышать 0.3 мг/доза'],
  selank: ['Закапывать интраназально', 'Курс 10-14 дней, перерыв 2 нед', 'Может вызывать сонливость'],
  dsip: ['Вводить п/к на ночь', 'Хранить в холодильнике', 'Курс 4-8 нед'],
  p21: ['Вводить п/к 1 раз в день', 'Хранить в холодильнике', 'Курс 4-8 нед'],
  mots_c: ['Вводить п/к 1 раз в день', 'Хранить в холодильнике', 'Курс 8-12 нед'],
  humanin: ['Вводить п/к 1 раз в день', 'Хранить в холодильнике', 'Курс 8-12 нед'],
  ss31: ['Вводить п/к 1 раз в день', 'Хранить в холодильнике', 'Курс 8-12 нед'],
  thymosin_alpha1: ['Хранить в холодильнике 2-8°C', 'Вводить п/к 2 раза в неделю', 'Курс 4-8 нед'],
  ghk_cu: ['Вводить п/к или наружно', 'Хранить в холодильнике', 'Курс 8-12 нед, перерыв 4 нед'],
  bpc157: ['Хранить в холодильнике 2-8°C', 'Вводить п/к 2 раза в день', 'Курс 4-8 нед'],
  tb500: ['Хранить в холодильнике 2-8°C', 'Вводить п/к 2 раза в неделю', 'Курс 4-8 нед'],
  melanotan1: ['Хранить в холодильнике 2-8°C', 'Титровать дозу (старт 0.25 мг)', 'Не превышать 1 мг/сут'],
  melanotan2: ['Хранить в холодильнике 2-8°C', 'Титровать дозу (старт 0.25 мг)', 'Может вызывать тошноту'],
  pt141: ['Вводить п/к за 30 мин до активности', 'Хранить в холодильнике', 'Не превышать 2 мг'],
  gonadorelin: ['Хранить в холодильнике 2-8°C', 'Вводить п/к 2-3 раза в день', 'Пульсирующий режим для стимуляции'],
  kisspeptin: ['Хранить в холодильнике 2-8°C', 'Вводить п/к 1 раз в день', 'Курс 8-12 нед'],
  glp1: ['Хранить в холодильнике 2-8°C', 'Вводить п/к 1-2 раза в день', 'Титровать дозу от 0.25 мг'],
  gip: ['Хранить в холодильнике 2-8°C', 'Вводить п/к 1 раз в день', 'Комбинировать с GLP-1'],
  cerebrolysin: ['Вводить в/м или в/в', 'Хранить в холодильнике', 'Курс 10 дней, перерыв 2 нед'],
  cortexin: ['Вводить в/м 1 раз в день', 'Хранить в холодильнике', 'Курс 10 дней, перерыв 2 нед'],
  elastin: ['Принимать с едой 2 раза в день', 'Хорошо сочетать с витамином С', 'Курс 8-12 нед'],
  histidine: ['Принимать с едой', 'Не превышать 3 г/сут', 'С осторожностью при биполярном расстройстве'],
  cysteine: ['Принимать с едой', 'Не превышать 1 г/сут', 'Может вызывать тошноту при высоких дозах'],
  serine: ['Принимать с едой', 'Курс 8-12 нед', 'Не превышать 3 г/сут'],
  proline: ['Принимать с едой', 'Хорошо сочетать с витамином С', 'Курс 8-12 нед'],
  aspartate: ['Принимать с едой', 'Не превышать 3 г/сут', 'С осторожностью при тревожности'],
  ornithine: ['Принимать натощак', 'Не превышать 3 г/сут', 'Курс 8-12 нед, перерыв 4 нед'],
  threonine: ['Принимать с едой', 'Курс 8-12 нед', 'Не превышать 2 г/сут'],
  lysine: ['Принимать с едой', 'Не превышать 3 г/сут', 'Курс 8-12 нед, перерыв 4 нед'],
  phenylalanine: ['Принимать натощак', 'Не при фенилкетонурии', 'Не превышать 1.5 г/сут'],
  glutamate: ['Принимать с едой', 'Не превышать 3 г/сут', 'С осторожностью при тревожности'],
  alpha_ketoglutarate: ['Принимать с едой', 'Не превышать 2 г/сут', 'Курс 8-12 нед'],
  reishi: ['Принимать с едой', 'Курс 8-12 нед, перерыв 4 нед', 'С осторожностью с антикоагулянтами'],
  chaga: ['Принимать с едой', 'Курс 8-12 нед, перерыв 4 нед', 'Не при аутоиммунных заболеваниях'],
  maitake: ['Принимать с едой', 'Курс 8-12 нед, перерыв 4 нед', 'Контролировать сахар крови'],
  shiitake: ['Принимать с едой', 'Курс 8-12 нед', 'Может вызывать сыпь у чувствительных'],
  agaricus: ['Принимать с едой', 'Курс 8-12 нед, перерыв 4 нед', 'С осторожностью при аллергии на грибы'],
  turkey_tail: ['Принимать с едой', 'Курс 8-12 нед', 'С осторожностью с иммуносупрессорами'],
  lutein: ['Принимать с жирной пищей', 'Курс 8-12 нед, перерыв 4 нед', 'Не превышать 40 мг/сут'],
  lycopene: ['Принимать с жирной пищей', 'Курс 8-12 нед', 'Не превышать 30 мг/сут'],
  anthocyanins: ['Принимать с едой', 'Курс 8-12 нед', 'Хорошо с витамином С'],
  grape_seed_extract: ['Принимать с едой', 'Стандартизация 95% проантоцианидинов', 'С осторожностью с антикоагулянтами'],
  pycnogenol: ['Принимать с едой', 'Курс 8-12 нед, перерыв 4 нед', 'Не превышать 200 мг/сут'],
  cocoa_flavanols: ['Принимать с едой', 'Выбирать минимально обработанный', 'Не превышать 500 мг/сут'],
  c60: ['Принимать с жирной пищей', 'Хранить в тёмном месте', 'Курс 8-12 нед, перерыв 4 нед'],
  nrf2_activator: ['Принимать с едой', 'Курс 8-12 нед, перерыв 4 нед', 'Не превышать дозировку'],
  olive_extract: ['Принимать с едой', 'Стандартизация по гидрокситирозолу', 'Курс 8-12 нед'],
  citrus_bioflavonoids: ['Принимать с едой', 'Хорошо с витамином С', 'Курс 8-12 нед'],
  flavonoids: ['Принимать с едой', 'Курс 8-12 нед', 'С осторожностью с антикоагулянтами'],
  ellagic_acid: ['Принимать с едой', 'Курс 8-12 нед', 'Не превышать 500 мг/сут'],
  ursolic_acid: ['Принимать с жирной пищей', 'Курс 8-12 нед', 'Не превышать 500 мг/сут'],
  magnolia: ['Принимать с едой', 'Курс 8-12 нед, перерыв 4 нед', 'Может вызывать сонливость'],
  gentian: ['Принимать до еды', 'Курс 4-8 нед', 'С осторожностью при язве желудка'],
  artichoke: ['Принимать с едой', 'Курс 8-12 нед, перерыв 4 нед', 'С осторожностью при ЖКБ'],
  garlic: ['Принимать с едой', 'Не превышать 1 г/сут', 'С осторожностью с антикоагулянтами'],
  mangosteen: ['Принимать с едой', 'Курс 8-12 нед', 'Не превышать 500 мг/сут'],
  nattokinase: ['Принимать натощак', 'Не с антикоагулянтами', 'Курс 8-12 нед, перерыв 4 нед'],
  grapefruit_seed: ['Принимать с едой', 'Разводить в воде', 'Не принимать с лекарствами CYP3A4'],
  nobiletin: ['Принимать с едой', 'Курс 8-12 нед', 'Хорошо с жирами'],
  fisetin: ['Принимать с едой (с жирами)', 'Курс 8-12 нед, перерыв 4 нед', 'Сенолитик — делать перерывы'],
  baicalin: ['Принимать с едой', 'Курс 8-12 нед', 'С осторожностью с антикоагулянтами'],
  taxifolin: ['Принимать с едой', 'Курс 8-12 нед', 'Не превышать 500 мг/сут'],
  soy_isoflavones: ['Принимать с едой', 'Курс 8-12 нед, перерыв 4 нед', 'С осторожностью при гормонозависимых опухолях'],
  rosemary: ['Принимать с едой', 'Курс 8-12 нед', 'Не превышать 1 г/сут экстракта'],
  cinnamon: ['Принимать с едой', 'Выбирать цейлонскую корицу', 'Не превышать 2 г/сут'],
  pomegranate: ['Принимать с едой', 'Сок без сахара', 'С осторожностью с антикоагулянтами'],
  cranberry: ['Принимать с едой', 'Пить много воды', 'С осторожностью с варфарином'],
  urolithin_a: ['Принимать с жирной пищей', 'Курс 8-12 нед, перерыв 4 нед', 'С осторожностью с антикоагулянтами'],
  bile_acids: ['Принимать за 30 мин до еды', 'Курс 4-8 нед', 'Не при полной обструкции желчевыводящих путей'],
  piracetam: ['Принимать с едой', 'Не превышать 4.8 г/сут', 'Курс 8-12 нед, перерыв 4 нед'],
  aniracetam: ['Принимать с жирной пищей', 'Не превышать 1.5 г/сут', 'Курс 8-12 нед, перерыв 4 нед'],
  oxiracetam: ['Принимать с едой', 'Не превышать 1.6 г/сут', 'Курс 8-12 нед, перерыв 4 нед'],
  pramiracetam: ['Принимать с едой', 'Не превышать 1.2 г/сут', 'Курс 8-12 нед, перерыв 4 нед'],
  fasoracetam: ['Принимать с едой', 'Не превышать 100 мг/сут', 'Может усиливать эффект GABA-препаратов'],
  coluracetam: ['Принимать с едой', 'Не превышать 40 мг/сут', 'Курс 8-12 нед, перерыв 4 нед'],
  noopept: ['Принимать сублингвально', 'Не превышать 30 мг/сут', 'Курс 4-8 нед, перерыв 4 нед'],
  citicoline: ['Принимать с едой', 'Не превышать 1 г/сут', 'Курс 8-12 нед, перерыв 4 нед'],
  alpha_gpc: ['Принимать с едой', 'Не превышать 1.2 г/сут', 'Может вызывать головную боль'],
  vinpocetine: ['Принимать с едой', 'Не превышать 30 мг/сут', 'С осторожностью с антикоагулянтами'],
  modafinil: ['Принимать утром', 'Не превышать 200 мг/сут', 'Не принимать после 14:00'],
  selegiline: ['Принимать утром', 'Не превышать 10 мг/сут', 'Избегать тираминовых продуктов'],
  memantine: ['Принимать с едой', 'Титровать дозу 5→10→20 мг', 'Не превышать 20 мг/сут'],
  bromantane: ['Принимать утром до еды', 'Курс 4-8 нед', 'Не превышать 100 мг/сут'],
  tianeptine: ['Принимать с едой', 'Не превышать 37.5 мг/сут', 'Не сочетать с ИМАО'],
  huperzine_a: ['Принимать с едой', 'Курс 4-8 нед, перерыв 4 нед', 'Не превышать 200 мкг/сут'],
  apigenin: ['Принимать с едой', 'Курс 8-12 нед', 'Может усиливать седацию'],
  lemon_balm: ['Принимать с едой или как чай', 'Курс 8-12 нед', 'Может усиливать седацию'],
  saffron: ['Принимать с едой', 'Не превышать 30 мг/сут экстракта', 'Курс 8-12 нед, перерыв 4 нед'],
  metformin: ['Принимать с едой', 'Титровать 500→1000→1500 мг', 'Контролировать B12'],
  semaglutide: ['Вводить п/к 1 раз в неделю', 'Титровать 0.25→0.5→1 мг', 'Не превышать 2.4 мг/нед'],
  finasteride: ['Принимать с едой или без', 'Не превышать 1 мг/сут', 'Не при планировании беременности'],
  cabergoline: ['Принимать с едой', 'Не превышать 1 мг 2 раза в неделю', 'Мониторинг пролактина'],
  testosterone: ['Вводить в/м или трансдермально', 'Не превышать 200 мг/нед', 'Требует контроля эстрадиола'],
  caffeine: ['Не принимать после 14:00', 'Не превышать 400 мг/сут', 'Не сочетать с другими стимуляторами'],
  diclofenac: ['Принимать с едой', 'Не превышать 150 мг/сут', 'Курс до 7 дней без назначения врача'],
  meloxicam: ['Принимать с едой', 'Не превышать 15 мг/сут', 'Курс до 7 дней'],
  ppi_drugs: ['Принимать за 30 мин до завтрака', 'Курс не более 8 нед без назначения', 'Контролировать Mg и B12'],
  spironolactone: ['Принимать с едой', 'Не превышать 100 мг/сут', 'Контролировать калий'],
  antidepressant_drugs: ['Принимать по назначению врача', 'Не превышать терапевтическую дозу', 'Не отменять резко'],
  anxiolytic_drugs: ['Принимать по назначению врача', 'Не превышать дозировку', 'Риск зависимости при долгом приёме'],
  antipsychotic_drugs: ['Принимать по назначению врача', 'Не превышать терапевтическую дозу', 'Контролировать пролактин и ЭКГ'],
  anticonvulsant_drugs: ['Принимать по назначению врача', 'Не отменять резко', 'Требует титрации'],
  ketamine: ['Только по назначению врача', 'Не превышать дозировку', 'Не сочетать с алкоголем'],
  antidiabetic_drugs: ['Принимать по назначению врача', 'Контролировать глюкозу', 'Риск гипогликемии'],
  thyroid_drugs: ['Принимать натощак за 30 мин до еды', 'Не превышать дозировку', 'Контролировать ТТГ каждые 6-8 нед'],
  corticosteroid_drugs: ['Принимать с едой', 'Не отменять резко', 'Требует титрации при отмене'],
  statin_drugs: ['Принимать вечером', 'Не превышать дозировку', 'Контролировать АЛТ, АСТ, КФК'],
  antiplatelet_drugs: ['Принимать с едой', 'Не превышать дозировку', 'Риск кровотечения — контроль'],
  anticoagulant_drugs: ['Принимать строго по часам', 'Не превышать дозировку', 'Контролировать МНО'],
  ace_inhibitor_drugs: ['Принимать с едой', 'Не превышать дозировку', 'Контролировать калий и креатинин'],
  arb_drugs: ['Принимать с едой', 'Не превышать дозировку', 'Контролировать калий и креатинин'],
  ccb_drugs: ['Принимать с едой', 'Не превышать дозировку', 'Может вызывать отёки лодыжек'],
  beta_blocker_drugs: ['Принимать с едой', 'Не отменять резко', 'Контролировать пульс и АД'],
  diuretic_drugs: ['Принимать утром', 'Не превышать дозировку', 'Контролировать калий и натрий'],
  immunosuppressant_drugs: ['Принимать строго по часам', 'Не превышать дозировку', 'Регулярный контроль крови'],
  antibiotic_drugs: ['Принимать курсом до конца', 'Соблюдать интервал между дозами', 'Пробиотики после курса'],
  antihistamine_drugs: ['Принимать с едой', 'Не превышать дозировку', 'Может вызывать сонливость'],
  nsaid_drugs: ['Принимать с едой', 'Не превышать дозировку', 'Курс до 7 дней без назначения'],
  levothyroxine: ['Принимать натощак за 30 мин до еды', 'Не превышать дозировку', 'Контролировать ТТГ каждые 6-8 нед'],
  antithyroid_drugs: ['Принимать с едой', 'Не превышать дозировку', 'Контролировать ТТГ и функцию печени'],
  postbiotics: ['Принимать с едой', 'Курс 8-12 нед', 'Хранить в холодильнике'],
  paraprobiotics: ['Принимать с едой', 'Курс 8-12 нед', 'Не требует хранения в холодильнике'],
  resistant_starch: ['Принимать с едой', 'Титровать от 5 г/сут', 'Пить больше воды'],
  beta_glucan: ['Принимать с едой', 'Курс 8-12 нед', 'Пить достаточно воды'],
  fiber: ['Принимать с едой', 'Титровать от 5 г/сут', 'Пить не менее 2 л воды'],
  hmo_prebiotics: ['Принимать с едой', 'Курс 8-12 нед', 'Хорошо для детской флоры'],
  lactate: ['Принимать с едой', 'Курс 8-12 нед', 'Хранить в холодильнике'],
  digestive_enzymes: ['Принимать с едой', 'Не превышать дозировку', 'Не разжёвывать капсулы энтеросолюбильные'],
  zinc_carnosine: ['Принимать натощак', 'Курс 8-12 нед, перерыв 4 нед', 'С осторожностью при болезни Вильсона'],
  colostrum: ['Принимать натощак', 'Курс 8-12 нед', 'Не превышать 3 г/сут'],
  ahcc: ['Принимать с едой', 'Курс 8-12 нед, перерыв 4 нед', 'С осторожностью при аутоиммунных'],
  pectin: ['Принимать с едой', 'Пить много воды', 'Не превышать 10 г/сут'],
  fadogia: ['Принимать с едой', 'Курс 8-12 нед, перерыв 4 нед', 'Контролировать тестостерон'],
  andrographis: ['Принимать с едой', 'Курс 8-12 нед, перерыв 4 нед', 'С осторожностью с антикоагулянтами'],
  boswellia: ['Принимать с едой', 'Курс 8-12 нед, перерыв 4 нед', 'Стандартизация по AKBA'],
  cissus: ['Принимать с едой', 'Курс 8-12 нед', 'С осторожностью при язве желудка'],
  licorice: ['Принимать с едой', 'Курс 4-6 нед', 'Контролировать АД и калий'],
  antacid: ['Принимать при симптомах', 'Не превышать 4 нед без назначения', 'Отдельно от других лекарств 2 ч'],
  cortisol: ['Контролировать уровень кортизола', 'Не превышать дозировку', 'С осторожностью с глюкокортикоидами'],
  adrenaline: ['Только по назначению врача', 'Не превышать дозировку', 'Контролировать АД и пульс'],
  endocrine_marker: ['Для диагностики — сдавать натощак', 'По назначению врача', 'Интерпретировать с врачом'],
  neurosteroid: ['Принимать по назначению врача', 'Не превышать дозировку', 'Может вызывать сонливость'],
  glucagon: ['Только по назначению врача', 'Вводить п/к/в/м при гипогликемии', 'Не превышать 1 мг'],
  nmn: ['Принимать сублингвально', 'Не превышать 500 мг/сут', 'Лучше утром'],
  oxytocin: ['Интраназально по назначению', 'Не превышать дозировку', 'Хранить в холодильнике'],
  dhea: ['Принимать с едой', 'Не превышать 50 мг/сут', 'Контролировать DHEA-S и тестостерон'],
  estradiol: ['Только по назначению врача', 'Не превышать дозировку', 'Контролировать E2'],
  progesterone: ['Принимать по назначению врача', 'Не превышать дозировку', 'Может вызывать сонливость'],
  insulin: ['Только по назначению врача', 'Строго контролировать дозу', 'Риск гипогликемии'],
  vasopressin: ['Только по назначению врача', 'Не превышать дозировку', 'Контролировать АД и натрий'],
  endocannabinoid: ['Принимать с жирной пищей', 'Титровать дозу', 'Не превышать дозировку'],
  pregrenolone: ['Принимать с едой', 'Не превышать 100 мг/сут', 'Курс 8-12 нед, перерыв 4 нед'],
  immune_support: ['Принимать с едой', 'Курс 8-12 нед', 'По потребности'],
  igf1: ['Только по назначению врача', 'Не превышать дозировку', 'Контролировать ИФР-1'],
  mgf: ['Только по назначению врача', 'Вводить п/к', 'Хранить в холодильнике'],
  kpv: ['Принимать с едой', 'Не превышать дозировку', 'Хранить в сухом месте'],
  ASTRAGALUS: ['Принимать с едой', 'Курс 8-12 нед, перерыв 4 нед', 'С осторожностью при аутоиммунных'],
  NAC: ['Принимать с едой', 'Не превышать 2400 мг/сут', 'Интервал с антибиотиками 2 ч'],
  TUDCA: ['Принимать за 2 ч до сна', 'Не превышать 1000 мг/сут', 'Старт 250 мг, титровать'],
  DIOSMIN: ['Принимать с едой', 'Курс 8-12 нед, перерыв 4 нед', 'Не превышать 1000 мг/сут'],
  BERGAMOT: ['Принимать с едой', 'Контролировать глюкозу', 'Не превышать 500 мг/сут'],
  SERRAPEPTASE: ['Принимать натощак', 'Не превышать 80 мг/сут', 'С осторожностью с антикоагулянтами'],
  PAPAIN: ['Принимать с едой', 'Не превышать 500 мг/сут', 'Аллергия на папайю'],
  PHARMA_TADALAFIL: ['Принимать по потребности', 'Не превышать 20 мг/сут', 'Не с нитратами'],
  LUMBROKINASE: ['Принимать натощак', 'Не с антикоагулянтами', 'Курс 8-12 нед, перерыв 4 нед'],
  HORSE_CHESTNUT: ['Принимать с едой', 'Стандартизация по эсцину', 'Не превышать 300 мг/сут'],
  INOSINE: ['Принимать с едой', 'Не превышать 3 г/сут', 'Курс 8-12 нед, перерыв 4 нед'],
  NARINGIN: ['Принимать с едой', 'Усиливает действие многих лекарств', 'С осторожностью с CYP3A4 субстратами'],
  PHARMA_CABERGOLINE: ['Принимать с едой', 'Не превышать 1 мг 2 раза в неделю', 'Контролировать пролактин'],
  NATTOKINASE: ['Принимать натощак', 'Не с антикоагулянтами', 'Курс 8-12 нед, перерыв 4 нед'],
  HESPERIDIN: ['Принимать с едой', 'Хорошо с витамином С', 'Курс 8-12 нед'],
  CITRUS_BIOFLAVONOIDS: ['Принимать с едой', 'Хорошо с витамином С', 'Курс 8-12 нед'],
  BROMANTANE: ['Принимать утром до еды', 'Курс 4-8 нед', 'Не превышать 100 мг/сут'],
  FASORACETAM: ['Принимать с едой', 'Не превышать 100 мг/сут', 'Курс 8-12 нед, перерыв 4 нед'],
  AGMATINE: ['Принимать натощак', 'Не превышать 1.5 г/сут', 'Может усиливать действие NO-доноров'],
  TMG: ['Принимать с едой', 'Не превышать 3 г/сут', 'Пить больше воды'],
  SAME: ['Принимать натощак', 'Не превышать 800 мг/сут', 'С осторожностью при биполярном расстройстве'],
  VITAMIN_B1: ['Принимать с едой', 'Бенфотиамин лучше всасывается', 'Не превышать 600 мг/сут'],
  COLOSTRUM: ['Принимать натощак', 'Курс 8-12 нед', 'Не превышать 3 г/сут'],
  PYCNOGENOL: ['Принимать с едой', 'Курс 8-12 нед, перерыв 4 нед', 'Не превышать 200 мг/сут'],
  BROMELAIN: ['Принимать натощак', 'Не превышать 500 мг/сут', 'С осторожностью с антикоагулянтами'],
  FOLATE: ['Принимать с едой', 'Активная форма (5-МТГФ) лучше', 'Не превышать 1000 мкг/сут'],
  LECITHIN: ['Принимать с едой', 'Не превышать 10 г/сут', 'Хранить в холодильнике'],
  PHOSPHATIDYLSERINE: ['Принимать с едой', 'Курс 8-12 нед, перерыв 4 нед', 'Не превышать 300 мг/сут'],
  PHOSPHATIDYLCHOLINE: ['Принимать с едой', 'Курс 8-12 нед', 'Хранить в холодильнике'],
  ARTICHOKE: ['Принимать с едой', 'Курс 8-12 нед, перерыв 4 нед', 'С осторожностью при ЖКБ'],
  VITAMIN_E: ['Принимать с едой (с жирами)', 'Не превышать 400 МЕ/сут', 'С осторожностью с антикоагулянтами'],
  BERBERINE: ['Принимать с едой', 'Не превышать 500 мг 3 раза в день', 'Курс 8-12 нед, перерыв 4 нед'],
  L_THEANINE: ['Принимать с едой или как чай', 'Не превышать 400 мг/сут', 'Может усиливать расслабление'],
  GLYCINE: ['Принимать сублингвально', 'Не превышать 3 г/сут', 'Курс 8-12 нед, перерыв 4 нед'],
  RUTIN: ['Принимать с едой', 'Хорошо с витамином С', 'Курс 8-12 нед'],
  HEPTRAL: ['Принимать натощак', 'Не превышать 1600 мг/сут', 'Курс 8-12 нед'],
  LEGALON: ['Принимать с едой', 'Не превышать 420 мг/сут', 'Курс 8-12 нед'],
  IBUDILAST: ['Принимать с едой', 'Не превышать 40 мг/сут', 'С осторожностью при печёночной недостаточности'],
};

// ══════════════════════════════════════════════
// PROCESSING - find every bestForCourse + targetOrgan pair
// and insert analog + specialInstructions before targetOrgan
// if they're not already present
// ══════════════════════════════════════════════

let lines = content.split('\n');
let enriched = 0;
let analogAdded = 0;
let siAdded = 0;

// Process from bottom to top to preserve line indices
// First collect all insertion points
const insertions = [];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const trimmed = line.trim();
  
  // Find bestForCourse lines
  if (!trimmed.startsWith('bestForCourse:')) continue;
  
  // Find the entry name by looking backwards for `entryName: {`
  // It's the closest line matching `entryName: {` or `  entryName: {`
  let entryName = null;
  for (let k = i - 1; k >= 0; k--) {
    const prevLine = lines[k];
    // Skip blank lines and closing braces
    if (prevLine.trim() === '' || prevLine.trim() === '},' || prevLine.trim() === '}') continue;
    // Look for pattern: optional spaces, word chars, colon, space, brace
    const m = prevLine.match(/^(?:\s*)(\w[\w\d_]*):\s*\{$/);
    if (m) {
      const candidate = m[1];
      // Verify by checking if this name's id appears in the content
      // Simple check: is this in our ANALOG_MAP? Or is it at the right context?
      entryName = candidate;
      break;
    }
  }
  
  if (!entryName) continue;
  
  // Now look forward for targetOrgan:
  let targetOrganLine = -1;
  let hasSpecialInstructions = false;
  let hasAnalog = false;
  let braceCount = 0;
  
  for (let j = i + 1; j < lines.length; j++) {
    const tl = lines[j].trim();
    
    // Count braces to detect end of entry
    for (let c = 0; c < lines[j].length; c++) {
      if (lines[j][c] === '{') braceCount++;
      if (lines[j][c] === '}') braceCount--;
    }
    
    if (tl.startsWith('targetOrgan:')) {
      targetOrganLine = j;
      break;
    }
    if (tl.startsWith('specialInstructions:')) {
      hasSpecialInstructions = true;
    }
    if (tl.startsWith('analog:')) {
      hasAnalog = true;
    }
    
    // If braceCount goes negative or we see next entry start, stop
    if (braceCount < 0 || (j > i + 1 && lines[j].match(/^\w[\w\d_]*:\s*\{$/))) {
      break;
    }
  }
  
  if (targetOrganLine > 0 && !hasSpecialInstructions) {
    // Check if we have mappings for this entry
    const analog = ANALOG_MAP[entryName];
    const si = SI_MAP[entryName];
    
    if (analog || si) {
      const linesToAdd = [];
      if (analog && analog.length > 0 && !hasAnalog) {
        linesToAdd.push({ type: 'analog', text: "    analog: ['" + analog.join("', '") + "']," });
      }
      if (si && si.length > 0) {
        linesToAdd.push({ type: 'si', text: "    specialInstructions: ['" + si.join("', '") + "']," });
      }
      
      insertions.push({
        entryName,
        targetOrganLine,
        linesToAdd
      });
    }
  }
}

// Apply insertions in reverse order
insertions.sort((a, b) => b.targetOrganLine - a.targetOrganLine);

for (const ins of insertions) {
  lines.splice(ins.targetOrganLine, 0, ...ins.linesToAdd.map(l => l.text));
  enriched++;
  analogAdded += ins.linesToAdd.filter(l => l.type === 'analog').length;
  siAdded += ins.linesToAdd.filter(l => l.type === 'si').length;
}

// Write back
writeFileSync(filePath, lines.join('\n'), 'utf8');
console.log(`\n=== RESULTS ===`);
console.log(`Entries enriched: ${enriched}`);
console.log(`Analog lines added: ${analogAdded}`);
console.log(`SpecialInstructions lines added: ${siAdded}`);
console.log(`Successfully processed!`);
