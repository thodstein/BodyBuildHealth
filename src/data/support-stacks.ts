import { SUPPORT_CATALOG_DATA } from './support-catalog';
export interface SupportStack {
  id: string;
  name?: string;
  effects: string[];
  substances: string[];
  synergyScore: number;
  description: string;
  dosages?: Record<string, { morning?: number; afternoon?: number; evening?: number; night?: number; unit: string }>;
  synergy_notes?: string;
  timing?: string;
  goalTags?: string[];
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

export function getSubstanceLabel(id: string): string {
  if (!id) return '—';
  if (L[id]) return L[id];
  const catEntry = SUPPORT_CATALOG_DATA[id];
  if (catEntry) return catEntry.nameRu || catEntry.name;
  return id.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
}

// Map each effect to substances that support it (100+ substances across 30+ effects)
const EFFECT_SUBSTANCES: Record<string, string[]> = {
  energy: ['caffeine','theanine','rhodiola','l_carnitine','coq10','creatine','taurine','ginseng','cordyceps','vitamin_b12','iron','l_carnitine','beta_alanine','creatine','caffeine','caffeine','stimulant_complex','pqq','nmn','nmn'],
  focus: ['caffeine','theanine','alpha_gpc','huperzine_a','noopept','piracetam','pramiracetam','modafinil','tyrosine','aniracetam','oxiracetam','pramiracetam','fasoracetam','ginkgo','citicoline','caffeine','caffeine'],
  anti_stress: ['ashwagandha','rhodiola','theanine','magnesium','glycine','taurine','selank','bacopa','apigenin','holy_basil','lemon_balm','lemon_balm','gaba','theanine','magnesium','magnesium','lemon_balm'],
  mood: ['tryptophan','x5htp','ashwagandha','rhodiola','tyrosine','selank','saffron','saffron','l_dopa','gaba','phenibut','agmatine','citicoline','magnesium'],
  fat_loss: ['mots_c','l_carnitine','coq10','egcg','berberine','metformin','caffeine','tyrosine','cissus','berberine','l_carnitine','choline','stimulant_complex','caffeine','stimulant_complex'],
  mitochondria: ['mots_c','pqq','coq10','ss31','nmn','nmn','nmn','creatine','alpha_lipoic','shilajit','pqq','coq10'],
  recovery: ['bpc157','glutamine','curcumin','creatine','beta_alanine','collagen','eaa','eaa','bcaa','vitamin_c','zinc','magnesium','fadogia','shilajit','l_carnitine'],
  sleep: ['melatonin','glycine','taurine','magnesium','apigenin','gaba','x5htp','tryptophan','apigenin','lemon_balm','lemon_balm','magnolia','lemon_balm','lemon_balm','magnesium','phenibut'],
  hormone_balance: ['vitamin_b6','ashwagandha','dhea','zinc','magnesium','boron','vitamin_d3','iodine','pregnenolone','fadogia','fadogia','fadogia','maca','shilajit'],
  immune_boost: ['vitamin_c','quercetin','sulforaphane','reishi','vitamin_d3','zinc','andrographis','astragalus','astragalus','beta_glucan','zinc_carnosine','colostrum','vitamin_c'],
  gi_healing: ['bpc157','glutamine','curcumin','glutamine','licorice','glutamine','glutamine','digestive_enzymes','ginger','artichoke','tudca'],
  detox: ['nac','milk_thistle','curcumin','sulforaphane','glutathione','alpha_lipoic','alpha_lipoic','vitamin_c','fiber','fiber','fiber','calcium'],
  anti_inflammation: ['curcumin','omega3','quercetin','ginger','boswellia','ginger','curcumin','resveratrol','astaxanthin','cissus','boswellia','nattokinase'],
  cardio_support: ['omega3','coq10','cordyceps','electrolyte_complex','potassium','magnesium','coq10','garlic','resveratrol','pterostilbene','arginine','citrulline','telmisartan','nebivolol','taurine'],
  liver_support: ['nac','milk_thistle','curcumin','tudca','artichoke','alpha_lipoic','selenium','vitamin_b6','vitamin_b12','folate','astragalus','schisandra'],
  insulin_sensitivity: ['berberine','metformin','mots_c','chromium','cinnamon','alpha_lipoic','magnesium','vitamin_d3','egcg','berberine','berberine','vanadium'],
  muscle_growth: ['cjc1295','igf1','creatine','beta_alanine','eaa','bcaa','eaa','hmb','arginine','citrulline','fadogia','fadogia','ecdysterone','turkey_tail'],
  gh_igf_axis: ['cjc1295','igf1','mots_c','melatonin','gaba','l_dopa','l_dopa','fadogia','fadogia','ipamorelin','cjc1295','ipamorelin','cjc1295'],
  memory: ['alpha_gpc','huperzine_a','l_carnitine','bacopa','noopept','piracetam','pramiracetam','citicoline','phosphatidylserine','ginkgo','lions_mane','citicoline'],
  thyroid_support: ['iodine','selenium','zinc','vitamin_d3','vitamin_b12','tyrosine','ashwagandha','tyrosine','copper','manganese','levothyroxine','magnesium'],
  bone_support: ['vitamin_d3','vitamin_k2','calcium','magnesium','boron','silicon','vitamin_c','collagen','silicon','silicon','msm','glucosamine'],
  hydration: ['electrolyte_complex','potassium','magnesium','calcium','sodium','taurine','creatine','electrolyte_complex','trace_minerals'],
  absorption: ['curcumin','ginger','ginger','ginger','digestive_enzymes','betaine','artichoke','gentian','milk_thistle'],
  antioxidant: ['vitamin_c','vitamin_e','selenium','curcumin','astaxanthin','quercetin','resveratrol','egcg','glutathione','alpha_lipoic','coq10','glutathione'],
  nootropic: ['piracetam','aniracetam','oxiracetam','pramiracetam','noopept','pramiracetam','alpha_gpc','citicoline','ginkgo','bacopa','lions_mane','semax','cerebrolysin'],
  vision: ['vitamin_a','lutein','lutein','astaxanthin','vitamin_c','vitamin_e','zinc','lutein','ginkgo','quercetin'],
  skin: ['collagen','vitamin_c','vitamin_e','biotin','zinc','silicon','collagen','astaxanthin','glutamine','vitamin_a','vitamin_b3'],
  joint: ['glucosamine','glucosamine','msm','collagen','collagen','cissus','ginger','curcumin','omega3','vitamin_d3','calcium'],
  kidney: ['astragalus','cranberry','astragalus','astragalus','potassium','magnesium','vitamin_b6','omega3','probiotics','curcumin'],
  lung: ['vitamin_c','quercetin','ginger','nac','omega3','magnesium','vitamin_d3','cordyceps','reishi','andrographis'],
  blood: ['iron','vitamin_b12','folate','vitamin_c','copper','vitamin_b6','vitamin_k2','omega3','nac','beta_alanine'],
  male_health: ['zinc','fadogia','fadogia','fadogia','maca','boron','ashwagandha','vitamin_d3','dhea','pregnenolone','shilajit'],
  antiaging: ['nmn','nmn','nmn','pqq','coq10','resveratrol','pterostilbene','astaxanthin','cjc1295','igf1','ss31','selank'],
  methylation: ['vitamin_b12','folate','vitamin_b6','betaine','phosphatidylcholine','methionine','zinc','magnesium','selenium','molybdenum'],
  probiotics: ['probiotics','probiotics','probiotics','prebiotics','prebiotics','colostrum','collagen','glutamine'],
  collagen: ['collagen','collagen','collagen','vitamin_c','silicon','collagen','msm','collagen'],
  electrolyte: ['electrolyte_complex','potassium','magnesium','calcium','sodium','trace_minerals','electrolyte_complex'],
  libido: ['maca','fadogia','fadogia','fadogia','zinc','boron','ashwagandha','dhea','shilajit','arginine','stimulant_complex'],
  hair: ['biotin','zinc','silicon','vitamin_d3','vitamin_e','collagen','msm','saw_palmetto','saw_palmetto','caffeine'],
  pain: ['curcumin','boswellia','ginger','magnesium','boswellia','cissus','boswellia','boswellia','magnolia','gaba'],
  dopamine: ['tyrosine','l_dopa','rhodiola','bromantane','l_carnitine','citicoline','phosphatidylserine','theanine','ginkgo','citicoline'],
  serotonin: ['x5htp','tryptophan','saffron','ashwagandha','magnesium','vitamin_b6','saffron','rhodiola','selank'],
  gaba: ['gaba','phenibut','magnesium','taurine','glycine','theanine','magnolia','apigenin','lemon_balm','gaba'],
  allergy: ['quercetin','vitamin_c','ginger','saw_palmetto','quercetin','vitamin_d3','zinc','probiotics','omega3'],
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
    { effects: ['energy','focus','mood','anti_stress'], substances: ['caffeine','theanine','rhodiola','tyrosine','alpha_gpc','magnesium'] },
    { effects: ['sleep','recovery','hormone_balance','anti_stress'], substances: ['melatonin','glycine','magnesium','ashwagandha','zinc','vitamin_b6','apigenin'] },
    { effects: ['immune_boost','anti_inflammation','detox','liver_support'], substances: ['vitamin_c','quercetin','sulforaphane','nac','curcumin','milk_thistle','selenium'] },
    { effects: ['gi_healing','anti_inflammation','recovery','immune_boost'], substances: ['bpc157','glutamine','curcumin','reishi','quercetin','tudca'] },
    { effects: ['focus','memory','nootropic','mood'], substances: ['alpha_gpc','huperzine_a','noopept','bacopa','theanine','citicoline','lions_mane','phosphatidylserine'] },
    { effects: ['fat_loss','insulin_sensitivity','energy','mitochondria'], substances: ['berberine','mots_c','coq10','l_carnitine','chromium','egcg','caffeine','pqq'] },
    { effects: ['cardio_support','anti_inflammation','detox','antioxidant'], substances: ['omega3','coq10','curcumin','nac','resveratrol','astaxanthin','garlic','magnesium'] },
    { effects: ['muscle_growth','recovery','gh_igf_axis','energy'], substances: ['creatine','beta_alanine','eaa','cjc1295','igf1','glutamine','zinc','l_carnitine'] },
    { effects: ['thyroid_support','hormone_balance','energy','mood'], substances: ['iodine','selenium','zinc','tyrosine','ashwagandha','vitamin_d3','magnesium','dhea'] },
    { effects: ['male_health','libido','hormone_balance','energy'], substances: ['fadogia','maca','boron','zinc','ashwagandha','vitamin_d3','shilajit'] },
    { effects: ['antiaging','mitochondria','antioxidant','methylation'], substances: ['nmn','pqq','coq10','resveratrol','astaxanthin','vitamin_b12','folate','ss31'] },
    { effects: ['bone_support','joint','collagen','anti_inflammation'], substances: ['vitamin_d3','vitamin_k2','calcium','magnesium','glucosamine','msm','collagen','collagen','boron'] },
    { effects: ['sleep','gaba','serotonin','anti_stress'], substances: ['melatonin','gaba','x5htp','magnesium','theanine','glycine','apigenin','lemon_balm'] },
    { effects: ['energy','focus','dopamine','mood'], substances: ['tyrosine','l_dopa','rhodiola','caffeine','theanine','l_carnitine','phosphatidylserine'] },
    { effects: ['immune_boost','gi_healing','detox','probiotics'], substances: ['probiotics','prebiotics','glutamine','colostrum','vitamin_d3','zinc','sulforaphane'] },
    { effects: ['liver_support','detox','antioxidant','anti_inflammation'], substances: ['nac','tudca','milk_thistle','artichoke','curcumin','selenium','alpha_lipoic','schisandra'] },
    { effects: ['hydration','electrolyte','cardio_support','energy'], substances: ['electrolyte_complex','potassium','magnesium','sodium','taurine','cordyceps','creatine'] },
    { effects: ['memory','nootropic','focus','anti_stress'], substances: ['piracetam','aniracetam','alpha_gpc','bacopa','theanine','phosphatidylserine','ginkgo'] },
    { effects: ['fat_loss','cardio_support','insulin_sensitivity','detox'], substances: ['egcg','berberine','omega3','l_carnitine','garlic','chromium'] },
    { effects: ['lung','immune_boost','anti_inflammation','detox'], substances: ['vitamin_c','quercetin','nac','omega3','vitamin_d3','reishi','cordyceps'] },
    { effects: ['skin','collagen','antioxidant','hydration'], substances: ['collagen','vitamin_c','collagen','astaxanthin','biotin','zinc','vitamin_e','silicon'] },
    { effects: ['kidney','detox','hydration','electrolyte'], substances: ['astragalus','cranberry','potassium','magnesium','vitamin_b6'] },
    { effects: ['blood','anemia','methylation','energy'], substances: ['iron','vitamin_b12','folate','vitamin_c','copper','vitamin_b6'] },
    { effects: ['allergy','anti_inflammation','immune_boost','lung'], substances: ['quercetin','vitamin_c','vitamin_d3','zinc','omega3'] },
    { effects: ['pain','anti_inflammation','joint','recovery'], substances: ['curcumin','boswellia','magnesium','msm','glucosamine'] },
    { effects: ['dopamine','serotonin','mood','focus'], substances: ['tyrosine','x5htp','rhodiola','theanine','phosphatidylserine','tryptophan'] },
    { effects: ['prenatal','methylation','bone_support','immune_boost'], substances: ['vitamin_b12','folate','vitamin_d3','calcium','iron','zinc','iodine','omega3','phosphatidylcholine'] },
    { effects: ['hair','skin','nails','collagen'], substances: ['biotin','zinc','silicon','collagen','msm','vitamin_d3','vitamin_e','astaxanthin'] },
    { effects: ['vision','antioxidant','anti_inflammation','brain'], substances: ['lutein','astaxanthin','vitamin_c','zinc','ginkgo','quercetin'] },
    { effects: ['thyroid_support','blood','hormone_balance','energy'], substances: ['iron','vitamin_c','selenium','iodine','zinc','copper','vitamin_b12','folate','vitamin_a'] },
    { effects: ['cancer_prevention','antioxidant','immune_boost','detox'], substances: ['sulforaphane','curcumin','egcg','resveratrol','vitamin_d3','quercetin','selenium','astragalus'] },
    { effects: ['anxiety','gaba','anti_stress','sleep'], substances: ['theanine','magnesium','ashwagandha','gaba','apigenin','lemon_balm','magnolia'] },
    { effects: ['fertility','hormone_balance','antioxidant','energy'], substances: ['zinc','selenium','vitamin_d3','coq10','l_carnitine','ashwagandha','maca','folate'] },
    { effects: ['neuroprotection','nootropic','antioxidant','mitochondria'], substances: ['lions_mane','citicoline','alpha_gpc','coq10','omega3','phosphatidylserine','bacopa','ginkgo'] },
    { effects: ['gut_healing','probiotics','anti_inflammation','immune_boost'], substances: ['probiotics','glutamine','zinc_carnosine','colostrum','prebiotics','butyrate','bpc157','kpv'] },
    { effects: ['antiaging_cellular','mitophagy','nad_boost','sirtuin'], substances: ['nmn','resveratrol','pterostilbene','urolithin_a','fisetin','pqq','coq10','ss31'] },
    { effects: ['testosterone_boost','libido','muscle_growth','recovery'], substances: ['fadogia','ashwagandha','zinc','vitamin_d3','boron','dhea','shilajit','maca'] },
    { effects: ['estrogen_balance','bone_support','mood','skin'], substances: ['vitamin_d3','vitamin_k2','calcium','magnesium','omega3','boron','maca','folate'] },
    { effects: ['cholesterol','cardio_support','liver_support','antioxidant'], substances: ['omega3','berberine','red_yeast_rice','coq10','niacin','garlic','artichoke','curcumin'] },
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

  // Phase 5.5: Hardcoded stacks
  stacks.push({
    id: 'iron_thyroid_stack',
    name: 'Железо и щитовидная',
    description: 'Поддержка кроветворения, транспорта железа и функции щитовидной железы',
    effects: ['blood','thyroid_support','energy','hormone_balance','immune_support'],
    substances: ['iron_bisglycinate','vitamin_c','selenium_methionine','iodine_potassium_iodide','zinc_picolinate','copper_gluconate','vitamin_b12_methylcobalamin','folate_methylfolate','vitamin_a_palmitate'],
    synergyScore: 25.5,
    dosages: {
      iron_bisglycinate: { morning: 30, unit: 'мг' },
      vitamin_c: { morning: 500, unit: 'мг' },
      selenium_methionine: { morning: 200, unit: 'мкг' },
      iodine_potassium_iodide: { morning: 150, unit: 'мкг' },
      zinc_picolinate: { evening: 15, unit: 'мг' },
      copper_gluconate: { evening: 2, unit: 'мг' },
      vitamin_b12_methylcobalamin: { morning: 500, unit: 'мкг' },
      folate_methylfolate: { morning: 400, unit: 'мкг' },
      vitamin_a_palmitate: { morning: 5000, unit: 'IU' },
    },
    synergy_notes: 'Витамин С удваивает абсорбцию железа. Цинк и медь конкурируют — разнесены на утро/вечер.',
    timing: 'Утро: железо + витамин С + селен + йод + B12 + фолат + витамин A. Вечер: цинк + медь.',
    goalTags: ['blood','thyroid','energy'],
  });

  stacks.push({
    id: 'full_support_protocol',
    name: 'Полный протокол поддержки (25.05-06.07.2026)',
    description: 'Комплексная поддержка на курсе: нейропротекция, сердечно-сосудистая, печень, почки, суставы, реология крови, гормональный баланс',
    effects: ['neuroprotection','cardiovascular','hepatic','renal','joint','blood_flow','hormone_balance','energy','sleep','immune'],
    substances: [
      'zinc_carnosine','colostrum','citicoline_complex','alpha_gpc','huperzine_a',
      'nattokinase','nattokinase','taurine','nac',
      'tadalafil','nebivolol','diosmin_complex','pine_extract_opc',
      'astragalus','vitamin_d3','vitamin_k2_mk7','vitamin_c_ascorbate',
      'ginger','bromantane','fasoracetam','agmatine',
      'bergamot','tmg_trimethylglycine','methylfolate_5mthf',
      'lecithin','same','artichoke','joint_health_complex',
      'atp_optimizer','vitamin_e_mixed','telmisartan',
      'udca_tabs','berberine_hcl_dhbbr',
      'theanine','ashwagandha','magnesium_l_threonate'
    ],
    synergyScore: 60,
    dosages: {
      lactoferrin: { morning: 500, unit: 'мг' },
      colostrum: { morning: 200, unit: 'мг' },
      citicoline_complex: { morning: 700, unit: 'мг' },
      alpha_gpc: { morning: 300, unit: 'мг' },
      huperzine_a: { morning: 50, unit: 'мкг' },
      serrapeptase: { morning: 240000, unit: 'SPU' },
      nattokinase: { morning: 12000, unit: 'FU' },
      taurine: { morning: 2000, unit: 'мг' },
      nac: { morning: 1800, unit: 'мг' },
      tadalafil: { morning: 5, unit: 'мг' },
      nebivolol: { morning: 2.5, unit: 'мг' },
      diosmin_complex: { morning: 300, unit: 'мг' },
      pine_extract_opc: { morning: 95, unit: '%' },
      astragalus: { morning: 1300, unit: 'мг' },
      vitamin_d3: { morning: 5000, unit: 'МЕ' },
      vitamin_k2_mk7: { morning: 100, unit: 'мкг' },
      vitamin_c_ascorbate: { morning: 1000, unit: 'мг' },
      bromelain: { morning: 1300, unit: 'GDU/G' },
      bromantane: { morning: 50, unit: 'мг' },
      fasoracetam: { morning: 100, unit: 'мг' },
      agmatine: { morning: 1000, unit: 'мг' },
      bergamot: { morning: 1, unit: 'таб' },
      tmg_trimethylglycine: { morning: 1000, unit: 'мг' },
      methylfolate_5mthf: { morning: 1000, unit: 'мкг' },
      lecithin: { morning: 1, unit: 'капс' },
      same: { morning: 1, unit: 'капс' },
      artichoke: { morning: 1, unit: 'капс' },
      joint_health_complex: { morning: 2, unit: 'капс' },
      atp_optimizer: { afternoon: 2, unit: 'капс' },
      vitamin_e_mixed: { afternoon: 400, unit: 'МЕ' },
      telmisartan: { evening: 80, unit: 'мг' },
      udca_tabs: { evening: 1500, unit: 'мг' },
      berberine_hcl_dhbbr: { evening: 1000, unit: 'мг' },
      l_theanine: { night: 400, unit: 'мг' },
      ashwagandha: { night: 50, unit: 'мг' },
      magnesium_l_threonate: { night: 1200, unit: 'мг' },
    },
    synergy_notes: 'Цитиколин+Alpha-GPC — синергия ацетилхолина. NAC+Таурин — глутатион+реология. D3+K2 — кальциевый обмен. Телмисартан+Небиволол — АД контроль. Берберин+TMG — метаболизм+гомоцистеин.',
    timing: 'Пробуждение (натощак 40 мин): Лактоферрин+Молозиво, Цитиколин комплекс, Серрапептаза+Наттокиназа, Таурин, NAC. Завтрак: Тадафил, Небиволол, DioMax, экстракт сосны, Астрагал, D3+K2, C, Бромелайн, Бромантан, Фасорацетам, Бергамот, TMG, 5-MTHF, Лецитин, SAMe, Артишок, JointHealth. Обед: DioMax, Астрагал, ATP Optimizer, E, Бергамот, TMG, 5-MTHF. Вечер: Телмисартан, УДХК, Берберин. Перед сном: L-Теанин, Ашваганда, Магний L-треонат.',
    goalTags: ['neuroprotection','cardiovascular','hepatic','renal','joint'],
  });

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

export const ALL_STACKS: SupportStack[] = (() => {
  const gen = generateStacks();
  const curated: SupportStack[] = [
    // === 40-препаратный полный стек покрытия ===
    {
      id: 'full_coverage_40', name: 'Полный стек покрытия (40)',
      effects: ['liver_support','cardio_support','kidney','lung','blood','anti_inflammation','antioxidant','immune_boost','detox','energy','recovery','hormone_balance'],
      substances: ['nac','tudca','milk_thistle','artichoke','omega3','coq10','magnesium','vitamin_d3','vitamin_k2','zinc','selenium','berberine','curcumin','quercetin','vitamin_c','ashwagandha','rhodiola','taurine','glycine','probiotics','bpc157','astragalus','alpha_lipoic','glutathione','pqq','nmn','resveratrol','astaxanthin','collagen','hyaluronic','glucosamine','msm','grape_seed_extract','pygeum','saw_palmetto','l_carnitine','carnosine','beta_alanine','creatine','eaa'],
      synergyScore: 38.5,
      description: 'Максимальное покрытие всех систем: печень ➔ кардио ➔ почки ➔ лёгкие ➔ кровь ➔ иммунитет ➔ суставы ➔ кожа ➔ митохондрии. 40 препаратов для полной поддержки на курсе ААС.',
      goalTags: ['full_coverage','aas_course','maximum'],
    },
    // === 5-6 развёрнутых стеков по 20+ препаратов ===
    {
      id: 'liver_detox_24', name: 'Детокс печени (24)',
      effects: ['liver_support','detox','antioxidant','gi_healing'],
      substances: ['nac','tudca','milk_thistle','artichoke','alpha_lipoic','glutathione','curcumin','selenium','vitamin_c','vitamin_e','vitamin_b6','vitamin_b12','folate','schisandra','astragalus','chanca_piedra','dandelion_root','barberry','betaine','methionine','inositol','choline','silymarin','lecithin'],
      synergyScore: 28.4,
      description: 'Комплексная детоксикация печени: фаза 1 и фаза 2 детокса, желчегонные, антиоксиданты и гепатопротекторы. Полное покрытие при токсическом поражении и холестазе.',
      goalTags: ['liver','detox','hepatoprotection'],
    },
    {
      id: 'cardio_protect_22', name: 'Кардиозащита (22)',
      effects: ['cardio_support','kidney','blood','electrolyte'],
      substances: ['omega3','coq10','magnesium','potassium','taurine','telmisartan','nebivolol','garlic','resveratrol','pterostilbene','hawthorn','arginine','citrulline','vitamin_k2','vitamin_d3','folate','vitamin_b12','nattokinase','serrapeptase','grape_seed_extract','pomegranate_extract','lycopene'],
      synergyScore: 29.1,
      description: 'Защита сердечно-сосудистой системы: снижение АД, липидный профиль, антиагреганты, электролиты и антиоксиданты. Полная кардиопротекция на курсе ААС.',
      goalTags: ['cardio','heart','bp'],
    },
    {
      id: 'neuro_protect_21', name: 'Нейрозащита + ноотропы (21)',
      effects: ['nootropic','memory','anti_stress','dopamine','gaba','sleep'],
      substances: ['alpha_gpc','citicoline','noopept','piracetam','pramiracetam','l_carnitine','ginkgo','bacopa','lions_mane','phosphatidylserine','magnesium_l_threonate','magnesium_glycinate','theanine','ashwagandha','rhodiola','tyrosine','selank','semax','cerebrolysin','p21','dihexa'],
      synergyScore: 30.2,
      description: 'Полная нейропротекция: нейропластичность, ацетилхолин, дофамин, GABA, антистресс и факторы роста нервов. Предотвращение нейротоксичности ААС и когнитивное улучшение.',
      goalTags: ['neuro','nootropic','brain'],
    },
    {
      id: 'immune_full_20', name: 'Иммунитет + антиоксиданты (20)',
      effects: ['immune_boost','antioxidant','anti_inflammation','lung','allergy'],
      substances: ['vitamin_c','vitamin_d3','zinc','quercetin','curcumin','omega3','sulforaphane','reishi','astragalus','echinacea','beta_glucan','colostrum','lactoferrin','probiotics','vitamin_a','selenium','copper','black_seed_oil','andrographis','elderberry'],
      synergyScore: 27.8,
      description: 'Максимальная иммунная поддержка: врождённый и адаптивный иммунитет, антиоксидантный каскад, лёгкие и противовоспалительная модуляция.',
      goalTags: ['immune','antioxidant','lungs'],
    },
    {
      id: 'joint_bone_20', name: 'Суставы + кости + связки (20)',
      effects: ['joint','bone_support','collagen','anti_inflammation'],
      substances: ['glucosamine','chondroitin','msm','collagen_i_iii','collagen_ii','hyaluronic','cissus','bpc157','tb500','vitamin_d3','vitamin_k2','calcium','magnesium','boron','silicon','curcumin','boswellia','ginger','eggshell_membrane','bamboo_silica'],
      synergyScore: 26.5,
      description: 'Комплексное восстановление суставов, костей и связок: матриксные белки, ингибиторы воспаления, минерализация и регенерация. Незаменим на курсах с тяжёлыми нагрузками.',
      goalTags: ['joints','bones','ligaments'],
    },
    {
      id: 'metabolic_mito_20', name: 'Метаболизм + митохондрии (20)',
      effects: ['mitochondria','energy','fat_loss','insulin_sensitivity','thyroid_support'],
      substances: ['pqq','coq10','nmn','nr','ss31','mots_c','ala','r_ala','l_carnitine','acetyl_l_carnitine','berberine','cinnamon','chromium','magnesium','vitamin_d3','iodine','selenium','zinc','shilajit','d_ribose'],
      synergyScore: 28.9,
      description: 'Митохондриальный биогенез, чувствительность к инсулину, термогенез и поддержка щитовидной железы. Полный контроль энергетического метаболизма.',
      goalTags: ['mitochondria','metabolic','thyroid'],
    },
    // === 3 органо-специфичных стека ===
    {
      id: 'renal_protect_12', name: 'Почечный протектор (12)',
      effects: ['kidney','electrolyte','detox'],
      substances: ['astragalus','cranberry','dandelion_root','chanca_piedra','potassium','magnesium','vitamin_b6','omega3','probiotics','curcumin','nettle_extract','horsetail'],
      synergyScore: 16.8,
      description: 'Нефропротекция: снижение мочевой кислоты, антиоксидантная защита почечных канальцев, электролитный баланс. Профилактика мочекаменной болезни.',
      goalTags: ['kidney','renal','uric_acid'],
    },
    {
      id: 'pulmo_protect_12', name: 'Лёгочный протектор (12)',
      effects: ['lung','immune_boost','antioxidant'],
      substances: ['nac','vitamin_c','quercetin','vitamin_d3','zinc','omega3','magnesium','cordyceps','reishi','andrographis','ginger','selenium'],
      synergyScore: 15.4,
      description: 'Защита лёгких: муколитик, сурфактант, антиоксидантная защита альвеол и бронхов. Улучшение кислородного обмена и детоксикация лёгочной ткани.',
      goalTags: ['lungs','pulmonary','oxygen'],
    },
    {
      id: 'gi_heal_12', name: 'ЖКТ протектор (12)',
      effects: ['gi_healing','probiotics','absorption'],
      substances: ['bpc157','glutamine','curcumin','licorice','slippery_elm','marshmallow_root','aloe_vera','probiotics','prebiotics','digestive_enzymes','betaine_hcl','ginger'],
      synergyScore: 17.2,
      description: 'Восстановление желудочно-кишечного тракта: регенерация слизистой, микробиом, абсорбция и пищеварение. Лечение и профилактика гастрита и язв.',
      goalTags: ['gi','gut','digestion'],
    },
  ];
  // Merge curated stacks with generated ones, giving priority to curated
  const existingIds = new Set(gen.map(s => s.id));
  for (const s of curated) {
    if (!existingIds.has(s.id)) gen.push(s);
  }
  return gen;
})();

export function findStacksByEffect(effect: string): SupportStack[] {
  return ALL_STACKS.filter(s => s.effects.includes(effect));
}

export function findStacksBySubstance(substanceId: string): SupportStack[] {
  return ALL_STACKS.filter(s => s.substances.includes(substanceId));
}

export function getStackSize(id: string): number { return ALL_STACKS.find(s=>s.id===id)?.substances.length??0; }
