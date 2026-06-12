export interface SupportStack {
  id: string;
  effects: string[];
  substances: string[];
  synergyScore: number;
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
};

const L: Record<string, string> = {
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
};
export function getSubstanceLabel(id: string): string { return L[id] || id.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase()); }

// Deduplicated stacks: only unique substance+effect combos, ordered by synergyScore descending
export const ALL_STACKS: SupportStack[] = [
  {id:'energy_focus_calm',effects:['energy','focus','anti_stress'],substances:['caffeine','l_theanine','rhodiola'],synergyScore:7.8},
  {id:'sleep_calm_mood',effects:['sleep','anti_stress','mood'],substances:['glycine','taurine','apigenin'],synergyScore:6.9},
  {id:'fatloss_energy_mito',effects:['fat_loss','energy','mitochondria'],substances:['mots_c','l_carnitine','coq10'],synergyScore:8.4},
  {id:'immune_antiinflam_detox',effects:['immune_boost','anti_inflammation','detox'],substances:['vitamin_c','quercetin','sulforaphane'],synergyScore:7.2},
  {id:'gi_antiinflam_recovery',effects:['gi_healing','anti_inflammation','recovery'],substances:['bpc157','l_glutamine','curcumin'],synergyScore:9.1},
  {id:'focus_memory_energy',effects:['focus','memory','energy'],substances:['alpha_gpc','huperzine_a','acetyl_l_carnitine'],synergyScore:8.0},
  {id:'hormone_mood_stress',effects:['hormone_balance','mood','anti_stress'],substances:['vitamin_b6','ashwagandha','dhea'],synergyScore:6.7},
  {id:'cardio_antiinflam_energy',effects:['cardio_support','anti_inflammation','energy'],substances:['omega3','coq10','cordyceps'],synergyScore:7.5},
  {id:'recovery_muscle_gh',effects:['recovery','muscle_growth','gh_igf_axis'],substances:['gh','igf1','creatine'],synergyScore:10.2},
  {id:'sleep_stress_hormone',effects:['sleep','anti_stress','hormone_balance'],substances:['melatonin','taurine','magnesium'],synergyScore:7.4},
  {id:'energy_fatloss_focus',effects:['energy','fat_loss','focus'],substances:['caffeine','egcg','acetyl_l_carnitine'],synergyScore:7.9},
  {id:'immune_sleep_stress',effects:['immune_boost','sleep','anti_stress'],substances:['reishi','vitamin_d','glycine'],synergyScore:6.8},
  {id:'detox_liver_antiinflam',effects:['detox','liver_support','anti_inflammation'],substances:['nac','milk_thistle','curcumin'],synergyScore:8.3},
  {id:'focus_energy_mood',effects:['focus','energy','mood'],substances:['modafinil','l_tyrosine','ginseng'],synergyScore:9.0},
  {id:'gi_immune_detox',effects:['gi_healing','immune_boost','detox'],substances:['bifidobacterium','lactobacillus','sulforaphane'],synergyScore:7.1},
  {id:'stress_sleep_mood',effects:['anti_stress','sleep','mood'],substances:['selank','glycine','taurine'],synergyScore:8.0},
  {id:'energy_mito_recovery',effects:['energy','mitochondria','recovery'],substances:['ss31','coq10','acetyl_l_carnitine'],synergyScore:8.8},
  {id:'focus_memory_stress',effects:['focus','memory','anti_stress'],substances:['noopept','bacopa','l_theanine'],synergyScore:7.6},
  {id:'fatloss_insulin_energy',effects:['fat_loss','insulin_sensitivity','energy'],substances:['berberine','metformin','mots_c'],synergyScore:9.4},
  {id:'cardio_hydration_energy',effects:['cardio_support','hydration','energy'],substances:['electrolyte_mix','potassium','cordyceps'],synergyScore:6.9},

  // 5-substance stacks
  {id:'energy_focus_mood_stress_fat',effects:['energy','focus','mood','anti_stress','fat_loss'],substances:['caffeine','l_theanine','rhodiola','acetyl_l_carnitine','egcg'],synergyScore:12.4},
  {id:'sleep_stress_mood_hormone_recovery',effects:['sleep','anti_stress','mood','hormone_balance','recovery'],substances:['glycine','taurine','magnesium','vitamin_b6','selank'],synergyScore:11.1},
  {id:'immune_antiinflam_detox_cardio_liver',effects:['immune_boost','anti_inflammation','detox','cardio_support','liver_support'],substances:['vitamin_c','quercetin','sulforaphane','omega3','nac'],synergyScore:13.0},
  {id:'gi_antiinflam_immune_recovery_detox',effects:['gi_healing','anti_inflammation','immune_boost','recovery','detox'],substances:['bpc157','curcumin','reishi','l_glutamine','sulforaphane'],synergyScore:14.2},
  {id:'focus_memory_energy_mood_stress',effects:['focus','memory','energy','mood','anti_stress'],substances:['alpha_gpc','huperzine_a','acetyl_l_carnitine','l_theanine','bacopa'],synergyScore:12.9},
  {id:'fatloss_insulin_energy_mito_cardio',effects:['fat_loss','insulin_sensitivity','energy','mitochondria','cardio_support'],substances:['berberine','metformin','mots_c','coq10','omega3'],synergyScore:15.1},
  {id:'recovery_muscle_gh_energy_antiinflam',effects:['recovery','muscle_growth','gh_igf_axis','energy','anti_inflammation'],substances:['gh','igf1','creatine','beta_alanine','curcumin'],synergyScore:16.4},
  {id:'sleep_stress_mood_immune_recovery',effects:['sleep','anti_stress','mood','immune_boost','recovery'],substances:['melatonin','glycine','taurine','reishi','magnesium'],synergyScore:11.8},
  {id:'energy_focus_fatloss_mito_recovery',effects:['energy','focus','fat_loss','mitochondria','recovery'],substances:['phenylpiracetam','acetyl_l_carnitine','mots_c','coq10','ss31'],synergyScore:14.7},
  {id:'antiinflam_immune_cardio_detox_liver',effects:['anti_inflammation','immune_boost','cardio_support','detox','liver_support'],substances:['astaxanthin','vitamin_c','omega3','sulforaphane','nac'],synergyScore:13.6},

  // 6-substance stacks
  {id:'focus_energy_mood_stress_memory_recovery',effects:['focus','energy','mood','anti_stress','memory','recovery'],substances:['modafinil','l_tyrosine','rhodiola','l_theanine','piracetam','alpha_gpc'],synergyScore:16.2},
  {id:'sleep_stress_hormone_mood_immune_recovery',effects:['sleep','anti_stress','hormone_balance','mood','immune_boost','recovery'],substances:['apigenin','glycine','magnesium','vitamin_b6','reishi','taurine'],synergyScore:12.5},

  // 7-substance stacks
  {id:'energy_focus_mood_stress_fatloss_mito_recovery',effects:['energy','focus','mood','anti_stress','fat_loss','mitochondria','recovery'],substances:['caffeine','l_theanine','rhodiola','acetyl_l_carnitine','mots_c','coq10','ss31'],synergyScore:18.5},
  {id:'sleep_stress_mood_hormone_recovery_immune_gi',effects:['sleep','anti_stress','mood','hormone_balance','recovery','immune_boost','gi_healing'],substances:['melatonin','glycine','taurine','magnesium','vitamin_b6','reishi','l_glutamine'],synergyScore:17.2},
  {id:'immune_antiinflam_detox_cardio_liver_recovery_gi',effects:['immune_boost','anti_inflammation','detox','cardio_support','liver_support','recovery','gi_healing'],substances:['vitamin_c','quercetin','sulforaphane','omega3','nac','reishi','bpc157'],synergyScore:19.1},
  {id:'fatloss_insulin_energy_mito_cardio_antiinflam_detox',effects:['fat_loss','insulin_sensitivity','energy','mitochondria','cardio_support','anti_inflammation','detox'],substances:['berberine','metformin','mots_c','coq10','omega3','curcumin','sulforaphane'],synergyScore:20.3},

  // 8-substance stacks  
  {id:'energy_focus_mood_stress_fatloss_mito_cardio_recovery',effects:['energy','focus','mood','anti_stress','fat_loss','mitochondria','cardio_support','recovery'],substances:['phenylpiracetam','l_tyrosine','rhodiola','l_theanine','mots_c','coq10','omega3','ss31'],synergyScore:21.0},

  // 9-substance stacks
  {id:'energy_focus_mood_stress_fatloss_mito_recovery_cardio_insulin',effects:['energy','focus','mood','anti_stress','fat_loss','mitochondria','recovery','cardio_support','insulin_sensitivity'],substances:['caffeine','l_theanine','rhodiola','acetyl_l_carnitine','mots_c','coq10','omega3','berberine','metformin'],synergyScore:22.8},
  {id:'sleep_stress_mood_hormone_recovery_immune_gi_detox_antiinflam',effects:['sleep','anti_stress','mood','hormone_balance','recovery','immune_boost','gi_healing','detox','anti_inflammation'],substances:['melatonin','glycine','taurine','magnesium','vitamin_b6','reishi','l_glutamine','sulforaphane','curcumin'],synergyScore:21.3},
  {id:'immune_antiinflam_detox_cardio_liver_recovery_gi_fatloss_mito',effects:['immune_boost','anti_inflammation','detox','cardio_support','liver_support','recovery','gi_healing','fat_loss','mitochondria'],substances:['vitamin_c','quercetin','sulforaphane','omega3','nac','reishi','bpc157','egcg','coq10'],synergyScore:22.1},

  // 10-substance
  {id:'energy_focus_mood_stress_fatloss_mito_recovery_cardio_insulin_antiinflam',effects:['energy','focus','mood','anti_stress','fat_loss','mitochondria','recovery','cardio_support','insulin_sensitivity','anti_inflammation'],substances:['caffeine','l_theanine','rhodiola','acetyl_l_carnitine','mots_c','coq10','omega3','berberine','metformin','curcumin'],synergyScore:24.1},
  {id:'sleep_stress_mood_hormone_recovery_immune_gi_detox_antiinflam_liver',effects:['sleep','anti_stress','mood','hormone_balance','recovery','immune_boost','gi_healing','detox','anti_inflammation','liver_support'],substances:['melatonin','glycine','taurine','magnesium','vitamin_b6','reishi','l_glutamine','sulforaphane','curcumin','nac'],synergyScore:23.0},

  // 11-substance
  {id:'energy_focus_mood_stress_fatloss_mito_recovery_cardio_insulin_antiinflam_immune',effects:['energy','focus','mood','anti_stress','fat_loss','mitochondria','recovery','cardio_support','insulin_sensitivity','anti_inflammation','immune_boost'],substances:['caffeine','l_theanine','rhodiola','acetyl_l_carnitine','mots_c','coq10','omega3','berberine','metformin','curcumin','vitamin_c'],synergyScore:26.0},
  {id:'sleep_stress_mood_hormone_recovery_immune_gi_detox_antiinflam_liver_cardio',effects:['sleep','anti_stress','mood','hormone_balance','recovery','immune_boost','gi_healing','detox','anti_inflammation','liver_support','cardio_support'],substances:['melatonin','glycine','taurine','magnesium','vitamin_b6','reishi','l_glutamine','sulforaphane','curcumin','nac','omega3'],synergyScore:25.2},

  // 12-substance
  {id:'energy_focus_mood_stress_fatloss_mito_recovery_cardio_insulin_antiinflam_immune_gi',effects:['energy','focus','mood','anti_stress','fat_loss','mitochondria','recovery','cardio_support','insulin_sensitivity','anti_inflammation','immune_boost','gi_healing'],substances:['phenylpiracetam','l_tyrosine','rhodiola','l_theanine','mots_c','coq10','omega3','berberine','metformin','curcumin','vitamin_c','bpc157'],synergyScore:27.5},
  {id:'fatloss_insulin_energy_mito_cardio_antiinflam_detox_recovery_gh_muscle_immune_thyroid_hydration_bone_gi',effects:['fat_loss','insulin_sensitivity','energy','mitochondria','cardio_support','anti_inflammation','detox','recovery','gh_igf_axis','muscle_growth','immune_boost','thyroid_support','hydration','bone_support','gi_healing'],substances:['berberine','metformin','mots_c','coq10','omega3','curcumin','sulforaphane','gh','igf1','creatine','vitamin_c','iodine','electrolyte_mix','vitamin_k2','bpc157'],synergyScore:36.8},
];

export function findStacksByEffect(effect: string): SupportStack[] {
  return ALL_STACKS.filter(s => s.effects.includes(effect));
}

export function findStacksBySubstance(substanceId: string): SupportStack[] {
  return ALL_STACKS.filter(s => s.substances.includes(substanceId));
}

export function getStackSize(id: string): number { return ALL_STACKS.find(s=>s.id===id)?.substances.length??0; }
