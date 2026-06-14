export interface SupportStack {
  id: string;
  effects: string[];
  substances: string[];
  synergyScore: number;
  description: string;
}

export const EFFECT_LABELS_ru: Record<string, string> = {
  energy: '⚡ Энергия', focus: '🎯 Фокус', anti_stress: '🧘 Антистресс',
  mood: '😊 Настроение', fat_loss: '🔥 Жиросжигание', mitochondria: '🧬 Митохондрии',
  recovery: '🔄 Восстановление', sleep: '😴 Сон', hormone_balance: '⚖ Гормоны',
  immune_boost: '🛡 Иммунитет', gi_healing: '🫃 ЖКТ', detox: '🧹 Детокс',
  anti_inflammation: '💢 Противовоспаление', cardio_support: '❤️ Кардио',
  liver_support: '🫁 Печень', insulin_sensitivity: '📉 Инсулин',
  muscle_growth: '💪 Рост мышц', gh_igf_axis: '📈 GH/IGF',
  memory: '🧠 Память', thyroid_support: '🦋 Щитовидка',
  bone_support: '🦴 Кости', hydration: '💧 Гидратация', absorption: '📥 Абсорбция',
  antioxidant: '🧪 Антиоксидант', nootropic: '🧠 Ноотроп', vision: '👁 Зрение',
  skin: '✨ Кожа', joint: '🦵 Суставы', liver_detox: '🍃 Детокс печени',
  kidney: '🫘 Почки', lung: '🫁 Лёгкие', blood: '🩸 Кровь',
  adrenal: '🌀 Надпочечники', male_health: '♂️ Мужское здоровье',
  female_health: '♀️ Женское здоровье', prenatal: '🤰 Пренатальное',
  antiaging: '⏳ Антивозрастное', methylation: '🔄 Метилирование',
  nerve: '🧠 Нервы', tendon: '🦵 Сухожилия', probiotics: '🦠 Микробиом',
  collagen: '🧶 Коллаген', electrolyte: '💧 Электролиты',
  anemia: '🩸 Анемия', coagulation: '🩸 Свёртываемость',
  lymphatic: '♻️ Лимфа', dopamine: '🧠 Дофамин', serotonin: '🧠 Серотонин',
  gaba: '🧠 GABA', appetite: '🍽 Аппетит', pain: '💊 Боль',
  libido: '🔥 Либидо', hair: '💇 Волосы', nails: '💅 Ногти',
  pancreas: '🍬 Поджелудочная', allergy: '🤧 Аллергия',
  antimicrobial: '🦠 Антимикробное', antiviral: '🦠 Противовирусное',
};

const L: Record<string, string> = {
  // === Original 40 ===
  caffeine:'Кофеин',l_theanine:'L-Теанин',rhodiola:'Родиола',
  acetyl_l_carnitine:'АЛКАР',mots_c:'MOTS-c',coq10:'CoQ10',
  omega3:'Омега-3',berberine:'Берберин',metformin:'Метформин',
  curcumin:'Куркумин',vitamin_c:'Витамин C',quercetin:'Кверцетин',
  sulforaphane:'Сульфорафан',nac:'NAC',reishi:'Рейши',bpc157:'BPC-157',
  egcg:'EGCG',glycine:'Глицин',taurine:'Таурин',magnesium:'Магний',
  vitamin_b6:'Витамин B6',l_glutamine:'L-Глутамин',melatonin:'Мелатонин',
  apigenin:'Апигенин',gh:'GH',igf1:'IGF-1',creatine:'Креатин',
  beta_alanine:'Бета-аланин',piracetam:'Пирацетам',noopept:'Ноопепт',
  alpha_gpc:'Альфа-GPC',huperzine_a:'Гуперзин A',bacopa:'Бакопа',
  ginseng:'Женьшень',modafinil:'Модафинил',l_tyrosine:'L-Тирозин',
  dhea:'DHEA',ashwagandha:'Ашваганда',cordyceps:'Кордицепс',
  selank:'Селанк',ss31:'SS-31',phenylpiracetam:'Фенилпирацетам',
  astaxanthin:'Астаксантин',milk_thistle:'Расторопша',
  electrolyte_mix:'Электролиты',iodine:'Йод',potassium:'Калий',
  vitamin_k2:'Витамин K2',piperine:'Пиперин',vitamin_d:'Витамин D',
  eaa:'EAA',chaga:'Чага',bifidobacterium:'Бифидобактерии',
  lactobacillus:'Лактобактерии',saccharomyces_boulardii:'S. boulardii',
  l_carnitine:'L-Карнитин',

  // === NEW: vitamins & minerals (from ALL_SUBSTANCES) ===
  vitamin_a:'Витамин A',vitamin_b1:'B1 (Тиамин)',vitamin_b2:'B2 (Рибофлавин)',
  vitamin_b3:'B3 (Ниацин)',vitamin_b5:'B5 (Пантотеновая)',vitamin_b7:'B7 (Биотин)',
  vitamin_b9:'B9 (Фолиевая)',vitamin_b12:'B12 (Метилкобаламин)',
  vitamin_e:'Витамин E',vitamin_k1:'Витамин K1',
  zinc:'Цинк',selenium:'Селен',copper:'Медь',manganese:'Марганец',
  chromium:'Хром',molybdenum:'Молибден',iron:'Железо',calcium:'Кальций',
  silicon:'Кремний',vanadium:'Ванадий',boron:'Бор',

  // === NEW: amino acids & proteins ===
  l_arginine:'L-Аргинин',l_citrulline:'L-Цитруллин',l_ornithine:'L-Орнитин',
  l_lysine:'L-Лизин',l_methionine:'L-Метионин',l_threonine:'L-Треонин',
  l_tryptophan:'L-Триптофан',l_valine:'L-Валин',l_leucine:'L-Лейцин',
  l_isoleucine:'L-Изолейцин',l_histidine:'L-Гистидин',l_proline:'L-Пролин',
  l_serine:'L-Серин',l_asparagine:'L-Аспарагин',l_glutamic:'L-Глутаминовая',
  l_carnosine:'L-Карнозин',l_theanine_extra:'L-Теанин (доп)',
  glutathione:'Глутатион',n_acetyl_cysteine:'N-Ацетилцистеин',
  bcaa:'BCAA',whey:'Сывороточный протеин',casein:'Казеин',

  // === NEW: adaptogens & herbs ===
  holy_basil:'Туласи (Священный базилик)',schisandra:'Лимонник',
  eleuthero:'Элеутерококк',astragalus:'Астрагал',echinacea:'Эхинацея',
  gingko:'Гинкго Билоба',gotu_kola:'Готу Кола',feverfew:'Пиретрум',
  valerian:'Валериана',passionflower:'Страстоцвет',hop:'Хмель',
  lemon_balm:'Мелисса',st_johns_wort:'Зверобой',kava:'Кава',
  maca:'Мака',tribulus:'Трибулус',tongkat_ali:'Тонгкат Али',
  fadogia:'Фадогия',shilajit:'Шиладжит',mucuna:'Мекуна (L-ДОФА)',
  guggul:'Гуггул',boswellia:'Босвеллия',cat_claw:'Кошка коготь',

  // === NEW: mushrooms ===
  lion_mane:'Львиная грива',maitake:'Майтаке',shiitake:'Шиитаке',
  tremella:'Тремелла',cordyceps_mil:'Кордицепс Militaris',
  agarikon:'Агарикон',polyporus:'Полипорус',poria:'Пория',

  // === NEW: nootropics & brain ===
  aniracetam:'Анирацетам',oxiracetam:'Оксирацетам',pramiracetam:'Прамирацетам',
  fasoracetam:'Фасорацетам',coluracetam:'Колурацетам',
  dmnea:'DMNEA',dmha:'DMHA',higenamine:'Хигенамин',
  racetam_base:'Рацетам',nefiracetam:'Нефирацетам',
  semax:'Семакс',cerebrolysin:'Церебролизин',p21:'P21',
  cortexin:'Кортексин',picamilon:'Пикамилон',phenibut:'Фенибут',
  noopept_extra:'Ноопепт (доп)',idebenone:'Идебенон',
  agmatine:'Агматин',uridine:'Уридин',choline:'Холин',
  citicoline:'Цитиколин',dmae:'DMAE',centrophenoxine:'Центрофеноксин',

  // === NEW: metabolic & mitochondrial ===
  ala:'Альфа-Липоевая',r_ala:'R-Альфа-Липоевая',pqq:'PQQ',
  nmn:'NMN',nr:'Никотинамид Рибоусид',nad:'NAD+',
  d_ribose:'D-Рибоза',shilajit_fulvic:'Фульвовая кислота',
  carnitine:'L-Карнитин',gpl:'GPL-Карнитин',acetyl_carnitine:'Ацетил-Карнитин',

  // === NEW: digestive & GI ===
  digestive_enzymes:'Пищеварительные ферменты',betaine_hcl:'Бетаин HCl',
  pepsin:'Пепсин',pancreatin:'Панкреатин',bromelain:'Бромелайн',
  papain:'Папаин',serrapeptase:'Серрапептаза',nattokinase:'Наттокиназа',
  slippery_elm:'Вяз скользкий',marshmallow_root:'Корень алтея',
  aloe_vera:'Алоэ Вера',licorice:'Солодка',deglycyrrhizinated_licorice:'DGL',
  peppermint_oil:'Мятное масло',ginger:'Имбирь',fennel:'Фенхель',
  caraway:'Тмин',artichoke:'Артишок',gentian:'Горечавка',
  milk_thistle_extract:'Расторопша экстракт',tudca:'TUDCA',

  // === NEW: cardiovascular ===
  coq10_ubiquinone:'Убихинон',coq10_ubiquinol:'Убихинол',
  pyrroloquinoline_quinone:'PQQ',hawthorn:'Боярышник',garlic:'Чеснок',
  cayenne:'Кайенский перец',gingko_biloba:'Гинкго Билоба',
  resveratrol:'Ресвератрол',pterostilbene:'Птеростильбен',
  magnesium_taurate:'Магния таурат',magnesium_glycinate:'Магния глицинат',
  magnesium_citrate:'Магния цитрат',magnesium_malate:'Магния малат',
  potassium_citrate:'Калия цитрат',potassium_chloride:'Калия хлорид',
  taurine_extra:'Таурин (доп)',l_arginine_extra:'Аргинин (доп)',

  // === NEW: joint & bone ===
  glucosamine:'Глюкозамин',chondroitin:'Хондроитин',msm:'MSM',
  hyaluronic:'Гиалуроновая кислота',collagen_i_iii:'Коллаген I+III',
  collagen_ii:'Коллаген II',collagen_hydro:'Гидролизат коллагена',
  eggshell_membrane:'Мембрана яйца',cissus:'Циссус',horsetail:'Хвощ полевой',
  bamboo_silica:'Бамбук кремний',vitamin_d3:'D3 5000',

  // === NEW: immune & antimicrobial ===
  propolis:'Прополис',bee_pollen:'Пыльца',royal_jelly:'Маточное молочко',
  colostrum:'Колострум',beta_glucan:'Бета-Глюкан',
  lactoferrin:'Лактоферрин',transfer_factor:'Трансфер фактор',
  monolauren:'Монолаурин',oregano_oil:'Масло орегано',
  olive_leaf:'Лист оливы',grapefruit_seed:'Экстракт грейпфрута',
  colloidal_silver:'Коллоидное серебро',vitamin_c_liposomal:'Витамин C липосомальный',

  // === NEW: hormonal & thyroid ===
  ashwagandha_ksm66:'KSM-66',ashwagandha_sensoril:'Сенсорил',
  tyrosine:'L-Тирозин',thyroid_glandular:'Тиреоид железа',
  iodine_potassium:'Йод (калия йодид)',selenomethionine:'Селенометионин',
  zinc_picolinate:'Цинка пиколинат',zinc_bisglycinate:'Цинка бисглицинат',
  dhea_extra:'DHEA (доп)',pregnenolone:'Прегненолон',
  keto_dhea:'7-Кето DHEA',androstenedione:'Андростендион',

  // === NEW: sleep & relaxation ===
  magnesium_theronate:'Магния треонат',gaba:'GABA',phenibut_extra:'Фенибут (доп)',
  l_theanine_sun:'L-Теанин Sun',h5_htp:'5-HTP',tryptophan:'Триптофан',
  chamomile:'Ромашка',lavender:'Лаванда',skullcap:'Шлемник',
  california_poppy:'Калифорнийский мак',ashwagandha_kSM66:'KSM-66',

  // === NEW: nootropic peptides ===
  semax_extra:'Семакс (доп)',selank_extra:'Селанк (доп)',dihexa:'Дигекса',
  noopept_peptide:'Ноопепт',cerebrolysin_extra:'Церебролизин (доп)',
  p21_extra:'P21 (доп)',epitalon:'Эпиталон',
};

export function getSubstanceLabel(id: string): string { if (!id) return '—'; return L[id] || id.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase()); }

// Map each effect to substances that support it (100+ substances across 30+ effects)
const EFFECT_SUBSTANCES: Record<string, string[]> = {
  energy: ['caffeine','l_theanine','rhodiola','acetyl_l_carnitine','coq10','creatine','taurine','ginseng','cordyceps','vitamin_b12','iron','l_carnitine','beta_alanine','d_ribose','dmnea','dmha','higenamine','pqq','nmn','nr'],
  focus: ['caffeine','l_theanine','alpha_gpc','huperzine_a','noopept','piracetam','phenylpiracetam','modafinil','l_tyrosine','aniracetam','oxiracetam','pramiracetam','fasoracetam','gingko','citicoline','dmnea','dmha'],
  anti_stress: ['ashwagandha','rhodiola','l_theanine','magnesium','glycine','taurine','selank','bacopa','apigenin','holy_basil','lemon_balm','passionflower','kava','l_theanine_extra','magnesium_glycinate','magnesium_theronate','skullcap'],
  mood: ['l_tryptophan','h5_htp','ashwagandha','rhodiola','l_tyrosine','selank','saffron','st_johns_wort','mucuna','gaba','phenibut','agmatine','uridine','magnesium_theronate'],
  fat_loss: ['mots_c','l_carnitine','coq10','egcg','berberine','metformin','caffeine','l_tyrosine','forskolin','guggul','carnitine','dmae','clenbuterol','synephrine','yohimbine'],
  mitochondria: ['mots_c','pqq','coq10','ss31','nmn','nr','nad','d_ribose','r_ala','shilajit_fulvic','pyrroloquinoline_quinone','idebenone'],
  recovery: ['bpc157','l_glutamine','curcumin','creatine','beta_alanine','collagen','whey','eaa','bcaa','vitamin_c','zinc','magnesium','tribulus','shilajit','l_carnitine'],
  sleep: ['melatonin','glycine','taurine','magnesium','apigenin','gaba','5_htp','l_tryptophan','chamomile','lavender','passionflower','valerian','lemon_balm','hop','magnesium_theronate','phenibut'],
  hormone_balance: ['vitamin_b6','ashwagandha','dhea','zinc','magnesium','boron','vitamin_d','iodine','pregnenolone','tribulus','tongkat_ali','fadogia','maca','shilajit'],
  immune_boost: ['vitamin_c','quercetin','sulforaphane','reishi','vitamin_d','zinc','echinacea','astragalus','propolis','beta_glucan','lactoferrin','colostrum','vitamin_c_liposomal'],
  gi_healing: ['bpc157','l_glutamine','curcumin','aloe_vera','deglycyrrhizinated_licorice','slippery_elm','marshmallow_root','peppermint_oil','ginger','artichoke','tudca'],
  detox: ['nac','milk_thistle','curcumin','sulforaphane','glutathione','ala','r_ala','vitamin_c','chlorophyll','bentonite_clay','activated_charcoal','d_glucarate'],
  anti_inflammation: ['curcumin','omega3','quercetin','bromelain','boswellia','ginger','turmeric','resveratrol','astaxanthin','cat_claw','feverfew','serrapeptase'],
  cardio_support: ['omega3','coq10','cordyceps','electrolyte_mix','potassium','magnesium','hawthorn','garlic','resveratrol','pterostilbene','l_arginine','citrulline','telmisartan','nebivolol','taurine'],
  liver_support: ['nac','milk_thistle','curcumin','tudca','artichoke','alpha_lipoic','selenium','vitamin_b6','vitamin_b12','folate','chanca_piedra','schisandra'],
  insulin_sensitivity: ['berberine','metformin','mots_c','chromium','cinnamon','alpha_lipoic','magnesium','vitamin_d','egcg','gymnema','banaba','vanadium'],
  muscle_growth: ['gh','igf1','creatine','beta_alanine','eaa','bcaa','whey','leucine','l_arginine','l_citrulline','tribulus','tongkat_ali','ecdysterone','turkey_tail'],
  gh_igf_axis: ['gh','igf1','mots_c','melatonin','gaba','l_dopa','mucuna','tongkat_ali','fadogia','ipamorelin','cjc1295','mk677','sermorelin'],
  memory: ['alpha_gpc','huperzine_a','acetyl_l_carnitine','bacopa','noopept','piracetam','pramiracetam','citicoline','phosphatidylserine','gingko','lion_mane','uridine'],
  thyroid_support: ['iodine','selenium','zinc','vitamin_d','vitamin_b12','tyrosine','ashwagandha','l_tyrosine','copper','manganese','thyroid_glandular','magnesium'],
  bone_support: ['vitamin_d3','vitamin_k2','calcium','magnesium','boron','silicon','vitamin_c','collagen_i_iii','horsetail','bamboo_silica','msm','glucosamine'],
  hydration: ['electrolyte_mix','potassium','magnesium','calcium','sodium','taurine','glycerol','coconut_water','trace_minerals'],
  absorption: ['piperine','ginger','bromelain','papain','digestive_enzymes','betaine_hcl','artichoke','gentian','milk_thistle'],
  antioxidant: ['vitamin_c','vitamin_e','selenium','curcumin','astaxanthin','quercetin','resveratrol','egcg','glutathione','alpha_lipoic','coq10','superoxide_dismutase'],
  nootropic: ['piracetam','aniracetam','oxiracetam','pramiracetam','noopept','phenylpiracetam','alpha_gpc','citicoline','gingko','bacopa','lion_mane','semax','cerebrolysin'],
  vision: ['vitamin_a','lutein','zeaxanthin','astaxanthin','vitamin_c','vitamin_e','zinc','bilberry','gingko','quercetin'],
  skin: ['collagen','vitamin_c','vitamin_e','biotin','zinc','silicon','hyaluronic','astaxanthin','aloe_vera','vitamin_a','vitamin_b3'],
  joint: ['glucosamine','chondroitin','msm','hyaluronic','collagen_ii','cissus','bromelain','curcumin','omega3','vitamin_d3','calcium'],
  kidney: ['astragalus','cranberry','dandelion_root','chanca_piedra','potassium','magnesium','vitamin_b6','omega3','probiotics','ligusticum'],
  lung: ['vitamin_c','quercetin','bromelain','nac','omega3','magnesium','vitamin_d','cordyceps','reishi','thyme'],
  blood: ['iron','vitamin_b12','folate','vitamin_c','copper','vitamin_b6','vitamin_k2','omega3','nac','beta_alanine'],
  male_health: ['zinc','tribulus','tongkat_ali','fadogia','maca','boron','ashwagandha','vitamin_d','dhea','pregnenolone','shilajit'],
  antiaging: ['nmn','nr','nad','pqq','coq10','resveratrol','pterostilbene','astaxanthin','gh','igf1','ss31','epitalon'],
  methylation: ['vitamin_b12','folate','vitamin_b6','betaine','cholin','methionine','zinc','magnesium','selenium','molybdenum'],
  probiotics: ['bifidobacterium','lactobacillus','saccharomyces_boulardii','prebiotic_fos','inulin','colostrum','bone_broth','l_glutamine'],
  collagen: ['collagen_i_iii','collagen_ii','collagen_hydro','vitamin_c','silicon','hyaluronic','msm','eggshell_membrane'],
  electrolyte: ['electrolyte_mix','potassium','magnesium','calcium','sodium','trace_minerals','coconut_water'],
  libido: ['maca','tribulus','tongkat_ali','fadogia','zinc','boron','ashwagandha','dhea','shilajit','l_arginine','yohimbine'],
  hair: ['biotin','zinc','silicon','vitamin_d','vitamin_e','collagen','msm','pumpkin_seed','saw_palmetto','caffeine'],
  pain: ['curcumin','boswellia','bromelain','magnesium','feverfew','cat_claw','white_willow','devils_claw','corydalis','kava'],
  dopamine: ['l_tyrosine','mucuna','rhodiola','bromantane','acetyl_l_carnitine','uridine','phosphatidylserine','l_theanine','gingko','citicoline'],
  serotonin: ['5_htp','l_tryptophan','saffron','ashwagandha','magnesium','vitamin_b6','st_johns_wort','rhodiola','selank'],
  gaba: ['gaba','phenibut','magnesium_theronate','taurine','glycine','l_theanine','valerian','apigenin','passionflower','kava'],
  allergy: ['quercetin','vitamin_c','bromelain','nettle','butterbur','vitamin_d','zinc','probiotics','omega3'],
};

// Generate all valid stack combinations (200+)
function generateStacks(): SupportStack[] {
  const stacks: SupportStack[] = [];
  let idCounter = 0;

  // Helper: produce a numeric synergy score based on number of substances and effect overlap
  const calcSynergy = (substances: string[], effects: string[]): number => {
    const base = substances.length * 1.5 + effects.length * 1.2;
    // Synergy bonus: more substances covering the same effect = higher synergy potential
    let overlapBonus = 0;
    const allSubsForEffects = effects.flatMap(e => EFFECT_SUBSTANCES[e] || []);
    for (const sub of substances) {
      overlapBonus += allSubsForEffects.filter(s => s === sub).length * 0.3;
    }
    return parseFloat((Math.min(40, base + overlapBonus + Math.random() * 0.8)).toFixed(1));
  };

  const safeId = (parts: string[]): string => {
    const base = parts.join('_').toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 60);
    return `${base}_${idCounter++}`;
  };

  const genDesc = (effects: string[], substances: string[], score: number): string => {
    const effStr = effects.map(e => (EFFECT_LABELS_ru[e]||e).replace(/^.{1,2}\s/,'')).join(', ');
    const subStr = substances.map(s => getSubstanceLabel(s)).join(', ');
    let desc = `Стек для ${effStr}. Состав: ${subStr}.`;
    if (score > 15) desc += ' Высокая синергия компонентов.';
    else if (score > 10) desc += ' Хорошая совместимость компонентов.';
    else desc += ' Сбалансированная базовая комбинация.';
    if (substances.length >= 8) desc += ' Расширенный комплекс.';
    return desc;
  };

  // Phase 1: For each effect, generate 3-substance combos (every combination of 3 from pool)
  for (const [effect, subs] of Object.entries(EFFECT_SUBSTANCES)) {
    if (subs.length < 3) continue;
    const pool = [...new Set(subs)];
    // Generate up to 6 combos for each effect
    const maxCombos = Math.min(6, pool.length);
    for (let a = 0; a < pool.length - 2 && stacks.length < 250; a += 2) {
      for (let b = a + 1; b < pool.length - 1 && stacks.length < 250; b += 2) {
        for (let c = b + 1; c < pool.length && stacks.length < 250; c += 2) {
          const combo = [pool[a], pool[b], pool[c]];
          const score = calcSynergy(combo, [effect]);
          stacks.push({
            id: safeId([effect, ...combo]),
            effects: [effect],
            substances: combo,
            synergyScore: score,
            description: genDesc([effect], combo, score),
          });
        }
      }
    }
  }

  // Phase 2: Multi-effect combos (2-4 effects with 3-5 substances each)
  const effectGroups = Object.keys(EFFECT_SUBSTANCES);
  const multiEffectSizes = [2, 3, 4, 5];
  const counts = [3, 4, 5];

  for (let groupSize of [2, 3, 4]) {
    for (let ei = 0; ei < effectGroups.length - groupSize + 1 && stacks.length < 350; ei += 3) {
      const groupEffects = effectGroups.slice(ei, ei + groupSize);
      // Collect pool of substances that cover at least 2 effects in this group
      const subCounts: Record<string, number> = {};
      for (const ef of groupEffects) {
        for (const s of (EFFECT_SUBSTANCES[ef] || [])) {
          subCounts[s] = (subCounts[s] || 0) + 1;
        }
      }
      // Prefer substances covering multiple effects
      const ranked = Object.entries(subCounts)
        .filter(([_, count]) => count >= 2)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([s]) => s);

      if (ranked.length < groupSize) continue;
      const subCount = Math.min(ranked.length, counts[Math.floor(ei / 4) % counts.length]);
      const combo = ranked.slice(0, subCount);
      const score = calcSynergy(combo, groupEffects);
      stacks.push({
        id: safeId([...groupEffects]),
        effects: groupEffects,
        substances: combo,
        synergyScore: score,
        description: genDesc(groupEffects, combo, score),
      });
    }
  }

  // Phase 3: Named/premium stacks — combine 5-10 substances across 3-7 effects
  const premiumSets: { effects: string[]; substances: string[] }[] = [
    { effects: ['energy','focus','mood','anti_stress'], substances: ['caffeine','l_theanine','rhodiola','l_tyrosine','alpha_gpc','magnesium_glycinate'] },
    { effects: ['sleep','recovery','hormone_balance','anti_stress'], substances: ['melatonin','glycine','magnesium_theronate','ashwagandha','zinc','vitamin_b6','apigenin'] },
    { effects: ['immune_boost','anti_inflammation','detox','liver_support'], substances: ['vitamin_c','quercetin','sulforaphane','nac','curcumin','milk_thistle','selenium'] },
    { effects: ['gi_healing','anti_inflammation','recovery','immune_boost'], substances: ['bpc157','l_glutamine','curcumin','reishi','quercetin','aloe_vera','tudca'] },
    { effects: ['focus','memory','nootropic','mood'], substances: ['alpha_gpc','huperzine_a','noopept','bacopa','l_theanine','citicoline','lion_mane','phosphatidylserine'] },
    { effects: ['fat_loss','insulin_sensitivity','energy','mitochondria'], substances: ['berberine','mots_c','coq10','l_carnitine','chromium','egcg','caffeine','pqq'] },
    { effects: ['cardio_support','anti_inflammation','detox','antioxidant'], substances: ['omega3','coq10','curcumin','nac','resveratrol','astaxanthin','garlic','magnesium'] },
    { effects: ['muscle_growth','recovery','gh_igf_axis','energy'], substances: ['creatine','beta_alanine','eaa','gh','igf1','l_glutamine','zinc','l_carnitine'] },
    { effects: ['thyroid_support','hormone_balance','energy','mood'], substances: ['iodine','selenium','zinc','tyrosine','ashwagandha','vitamin_d','magnesium','dhea'] },
    { effects: ['male_health','libido','hormone_balance','energy'], substances: ['tribulus','tongkat_ali','maca','boron','zinc','ashwagandha','vitamin_d','shilajit'] },
    { effects: ['antiaging','mitochondria','antioxidant','methylation'], substances: ['nmn','pqq','coq10','resveratrol','astaxanthin','vitamin_b12','folate','ss31'] },
    { effects: ['bone_support','joint','collagen','anti_inflammation'], substances: ['vitamin_d3','vitamin_k2','calcium','magnesium','glucosamine','msm','collagen_ii','hyaluronic','boron'] },
    { effects: ['sleep','gaba','serotonin','anti_stress'], substances: ['melatonin','gaba','5_htp','magnesium_theronate','l_theanine','glycine','apigenin','lemon_balm'] },
    { effects: ['energy','focus','dopamine','mood'], substances: ['l_tyrosine','mucuna','rhodiola','caffeine','l_theanine','acetyl_l_carnitine','phosphatidylserine'] },
    { effects: ['immune_boost','gi_healing','detox','probiotics'], substances: ['bifidobacterium','lactobacillus','saccharomyces_boulardii','l_glutamine','colostrum','vitamin_d','zinc','sulforaphane'] },
    { effects: ['liver_support','detox','antioxidant','anti_inflammation'], substances: ['nac','tudca','milk_thistle','artichoke','curcumin','selenium','alpha_lipoic','schisandra'] },
    { effects: ['hydration','electrolyte','cardio_support','energy'], substances: ['electrolyte_mix','potassium','magnesium','sodium','taurine','cordyceps','creatine'] },
    { effects: ['memory','nootropic','focus','anti_stress'], substances: ['piracetam','aniracetam','alpha_gpc','bacopa','l_theanine','phosphatidylserine','gingko','uridine'] },
    { effects: ['fat_loss','cardio_support','insulin_sensitivity','detox'], substances: ['egcg','berberine','omega3','l_carnitine','green_tea','cayenne','garlic','chromium'] },
    { effects: ['lung','immune_boost','anti_inflammation','detox'], substances: ['vitamin_c','quercetin','nac','bromelain','omega3','vitamin_d','reishi','cordyceps'] },
    { effects: ['skin','collagen','antioxidant','hydration'], substances: ['collagen','vitamin_c','hyaluronic','astaxanthin','biotin','zinc','vitamin_e','silicon'] },
    { effects: ['kidney','detox','hydration','electrolyte'], substances: ['astragalus','cranberry','dandelion_root','chanca_piedra','potassium','magnesium','vitamin_b6'] },
    { effects: ['blood','anemia','methylation','energy'], substances: ['iron','vitamin_b12','folate','vitamin_c','copper','vitamin_b6','l_lysine'] },
    { effects: ['allergy','anti_inflammation','immune_boost','lung'], substances: ['quercetin','vitamin_c','bromelain','nettle','butterbur','vitamin_d','zinc','omega3'] },
    { effects: ['pain','anti_inflammation','joint','recovery'], substances: ['curcumin','boswellia','bromelain','magnesium','feverfew','cat_claw','devils_claw','msm'] },
    { effects: ['dopamine','serotonin','mood','focus'], substances: ['l_tyrosine','5_htp','mucuna','rhodiola','l_theanine','uridine','phosphatidylserine','l_tryptophan'] },
    { effects: ['prenatal','methylation','bone_support','immune_boost'], substances: ['vitamin_b12','folate','vitamin_d','calcium','iron','zinc','iodine','omega3','cholin'] },
    { effects: ['hair','skin','nails','collagen'], substances: ['biotin','zinc','silicon','collagen','msm','vitamin_d','vitamin_e','astaxanthin'] },
    { effects: ['vision','antioxidant','anti_inflammation','brain'], substances: ['lutein','zeaxanthin','astaxanthin','vitamin_c','zinc','gingko','quercetin','bilberry'] },
    { effects: ['libido','hormone_balance','male_health','energy'], substances: ['maca','tribulus','tongkat_ali','fadogia','boron','zinc','ashwagandha','shilajit','vitamin_d'] },
  ];

  for (const ps of premiumSets) {
    if (stacks.length >= 200) break;
    const pscore = calcSynergy(ps.substances, ps.effects);
    stacks.push({
      id: safeId([...ps.effects]),
      effects: ps.effects,
      substances: ps.substances,
      synergyScore: pscore,
      description: genDesc(ps.effects, ps.substances, pscore),
    });
  }

  // Phase 4: Fill remaining slots with random combos from top substances
  const allSubs = [...new Set(Object.values(EFFECT_SUBSTANCES).flat())];
  while (stacks.length < 200) {
    const size = 3 + (stacks.length % 4);
    const shuffled = [...allSubs].sort(() => Math.random() - 0.5).slice(0, size);
    const effectCount = 1 + (stacks.length % 3);
    const shuffledEffects = [...effectGroups].sort(() => Math.random() - 0.5).slice(0, effectCount);
    const fscore = calcSynergy(shuffled, shuffledEffects);
    stacks.push({
      id: safeId([...shuffledEffects, ...shuffled]),
      effects: shuffledEffects,
      substances: shuffled,
      synergyScore: fscore,
      description: genDesc(shuffledEffects, shuffled, fscore),
    });
  }

  // Phase 5: Organ & system stacks (various sizes: 2-4 to 30-35)
  const organGroups: { key: string; label: string; effects: string[]; sizeRange: [number,number] }[] = [
    { key:'organ_cardio',label:'Сердце и сосуды',effects:['cardio_support','hydration','electrolyte','anti_inflammation','antioxidant'], sizeRange:[3,12] },
    { key:'organ_liver',label:'Печень и детокс',effects:['liver_support','liver_detox','detox','antioxidant','anti_inflammation'], sizeRange:[3,12] },
    { key:'organ_kidney',label:'Почки',effects:['kidney','hydration','electrolyte','detox','anti_inflammation'], sizeRange:[2,8] },
    { key:'organ_lung',label:'Лёгкие и дыхание',effects:['lung','immune_boost','anti_inflammation','detox','antioxidant'], sizeRange:[2,8] },
    { key:'organ_brain',label:'Мозг и когниция',effects:['nootropic','memory','focus','mood','dopamine','serotonin','gaba','anti_stress'], sizeRange:[3,15] },
    { key:'organ_bones',label:'Кости и суставы',effects:['bone_support','joint','collagen','anti_inflammation','antioxidant'], sizeRange:[3,10] },
    { key:'organ_skin',label:'Кожа, волосы, ногти',effects:['skin','hair','nails','collagen','hydration','antioxidant'], sizeRange:[2,8] },
    { key:'organ_thyroid',label:'Щитовидная железа',effects:['thyroid_support','hormone_balance','energy','mood','antioxidant'], sizeRange:[2,7] },
    { key:'organ_pancreas',label:'Поджелудочная и инсулин',effects:['pancreas','insulin_sensitivity','fat_loss','mitochondria','energy'], sizeRange:[2,7] },
    { key:'organ_blood',label:'Кровь и анемия',effects:['blood','anemia','coagulation','methylation','energy'], sizeRange:[2,8] },
    { key:'organ_immune',label:'Иммунная система',effects:['immune_boost','antimicrobial','antiviral','allergy','lung','antioxidant'], sizeRange:[3,12] },
    { key:'organ_gi',label:'ЖКТ и микробиом',effects:['gi_healing','probiotics','detox','anti_inflammation','immuneboost'], sizeRange:[3,10] },
    { key:'organ_hormones',label:'Гормональный баланс',effects:['hormone_balance','adrenal','thyroid_support','mood','energy','libido'], sizeRange:[3,12] },
    { key:'organ_male',label:'Мужское здоровье',effects:['male_health','libido','hormone_balance','energy','recovery','muscle_growth'], sizeRange:[3,12] },
    { key:'organ_female',label:'Женское здоровье',effects:['female_health','prenatal','hormone_balance','mood','bone_support','skin'], sizeRange:[3,12] },
    { key:'organ_multi_metab',label:'Метаболизм и энергия',effects:['energy','mitochondria','fat_loss','insulin_sensitivity','thyroid_support','muscle_growth'], sizeRange:[5,20] },
    { key:'organ_multi_antiaging',label:'Антивозрастной комплекс',effects:['antiaging','mitochondria','antioxidant','methylation','skin','bone_support','nootropic','hormone_balance'], sizeRange:[8,35] },
    { key:'organ_multi_recovery',label:'Восстановление и сон',effects:['recovery','sleep','gaba','serotonin','anti_stress','anti_inflammation','joint','muscle_growth'], sizeRange:[5,20] },
  ];

  for (const og of organGroups) {
    // Collect all substances for these effects, weighted by how many effects they cover
    const subWeight: Record<string, number> = {};
    for (const ef of og.effects) {
      for (const s of (EFFECT_SUBSTANCES[ef] || [])) {
        subWeight[s] = (subWeight[s] || 0) + 1;
      }
    }
    const ranked = Object.entries(subWeight).sort((a,b) => b[1]-a[1]).map(([s]) => s);
    if (ranked.length < 2) continue;

    // Generate stacks of different sizes for this organ
    const sizeSteps = [[2,4],[5,7],[8,10],[11,15],[15,20],[20,25],[30,35]];
    for (const [lo,hi] of sizeSteps) {
      if (hi > ranked.length) continue;
      if (lo < og.sizeRange[0] || hi > og.sizeRange[1]) continue;
      // Create 2-3 stacks per size range
      for (let r = 0; r < 2 && stacks.length < 800; r++) {
        const count = lo + Math.floor(Math.random() * (hi - lo + 1));
        const size = Math.min(count, ranked.length);
        // Pick substances: top-ranked for the effects
        const selected = ranked.slice(0, Math.floor(size * 0.7))
          .concat([...ranked.slice(Math.floor(size * 0.7))].sort(() => Math.random() - 0.5).slice(0, size - Math.floor(size * 0.7)));
        const uniq = [...new Set(selected)];
        const score = calcSynergy(uniq, og.effects);
        stacks.push({
          id: safeId([og.key, String(lo), String(hi)]),
          effects: og.effects.slice(0, r===0?og.effects.length:Math.min(og.effects.length,3+Math.floor(Math.random()*3))),
          substances: uniq,
          synergyScore: score,
          description: `Стек для ${og.label}. ${uniq.length} веществ. Состав: ${uniq.map(s=>getSubstanceLabel(s)).join(', ')}.`,
        });
      }
    }
  }

  // Deduplicate by substance+effect signature
  const seen = new Set<string>();
  const unique: SupportStack[] = [];
  for (const s of stacks) {
    const sig = `${s.effects.sort().join(',')}|${s.substances.sort().join(',')}`;
    if (!seen.has(sig)) { seen.add(sig); unique.push(s); }
  }

  // Sort: larger first, then by score descending
  return unique.sort((a, b) => {
    if (b.substances.length !== a.substances.length) return b.substances.length - a.substances.length;
    if (b.effects.length !== a.effects.length) return b.effects.length - a.effects.length;
    return b.synergyScore - a.synergyScore;
  }).slice(0, 600);
}

export const ALL_STACKS: SupportStack[] = generateStacks();

export function findStacksByEffect(effect: string): SupportStack[] {
  return ALL_STACKS.filter(s => s.effects.includes(effect));
}

export function findStacksBySubstance(substanceId: string): SupportStack[] {
  return ALL_STACKS.filter(s => s.substances.includes(substanceId));
}

export function getStackSize(id: string): number { return ALL_STACKS.find(s=>s.id===id)?.substances.length??0; }
