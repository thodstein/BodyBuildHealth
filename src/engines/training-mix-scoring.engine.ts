import { SUPPORT_CATALOG_DATA } from '../data/support-catalog-data';
import type { SupportCatalogEntry } from '../data/support-catalog-data';

export type MixCategory = 'pump' | 'energy' | 'focus' | 'strength' | 'hydration' | 'endurance' | 'anticatabolic' | 'recovery' | 'protein' | 'glycogen' | 'antiinflammatory' | 'hormonal';

export interface MixSubstance {
  id: string; name: string; doseMg: number;
}

export interface SubstanceScoreBreakdown {
  id: string;
  name: string;
  doseMg: number;
  baseScore: number;
  categories: { key: string; label: string; score: number }[];
}

export interface TrainingMixScore {
  pumpScore: number; energyScore: number; focusScore: number; strengthScore: number;
  hydrationScore: number; enduranceScore: number; anticatabolicScore: number;
  recoveryScore: number; proteinScore: number; glycogenScore: number;
  noScore: number; compositeScore: number;
  label: string; color: string;
  recommendedCarbsG: number; recommendedEAAG: number; recommendedWaterMl: number;
  recommendedNaMg: number; recommendedKMg: number; recommendedClMg: number;
  drugModifiers: { drug: string; effect: string; bonus: number }[];
  electrolyteWarnings: string[];
  suggestions: string[];
  substanceBreakdown: SubstanceScoreBreakdown[];
}

export interface MixProfile {
  goal: 'pump' | 'endurance' | 'strength' | 'recovery' | 'focus' | 'powerlifting' | 'competition' | 'crossfit' | 'post_comp';
  timing: 'pre' | 'intra' | 'post';
  weightKg: number;
  isOnCycle: boolean;
  drugs: { insulin: boolean; insulinDose?: number; insulinTiming?: 'pre' | 'post'; igf: boolean; igfDose?: number; igfTiming?: 'pre' | 'post'; gh: boolean; ghDose?: number; ghTiming?: 'pre' | 'post'; mgf: boolean; mgfDose?: number; mgfTiming?: 'pre' | 'post'; glp1: boolean };
  hasNandrolone: boolean;
  userElectrolytes: { sodiumMmolL: number; potassiumMmolL: number; chlorideMmolL: number };
  workoutType: 'heavy' | 'moderate' | 'light';
  timeOfDay: 'morning' | 'afternoon' | 'evening';
  workoutDurationMin: number;
}

// Dynamic substance scoring — lookup by SUPPORT_CATALOG_DATA categories
function getSubstanceScore(substanceId: string): { categories: MixCategory[]; baseScore: number } | null {
  const id = substanceId.toLowerCase();
  const entry = SUPPORT_CATALOG_DATA[id] as SupportCatalogEntry | undefined;
  if (!entry) return null;

  const cats = new Set<MixCategory>();
  const catMap: Record<string, MixCategory[]> = {
    antioxidant: ['recovery', 'antiinflammatory'],
    hepatoprotector: ['recovery'],
    cardioprotector: ['pump', 'endurance'],
    mineral: ['hydration', 'recovery'],
    vitamin: ['recovery', 'energy'],
    amino: ['protein', 'anticatabolic'],
    fatty_acid: ['antiinflammatory', 'recovery'],
    nootropic: ['focus', 'energy'],
    adaptogen: ['recovery', 'energy'],
    antiinflammatory: ['antiinflammatory', 'recovery'],
    renoprotector: ['hydration'],
    joint: ['recovery', 'antiinflammatory'],
    hormonal: ['hormonal', 'strength'],
    stimulant: ['energy', 'focus'],
  };

  if (entry.category) {
    for (const cat of entry.category) {
      for (const mapped of (catMap[cat] || [])) cats.add(mapped);
    }
  }

  const mechMap: Record<string, MixCategory[]> = {
    COLLAGEN_SYNTHESIS: ['recovery'], GLUTATHIONE_SYNTHESIS: ['recovery'],
    ANTIOXIDANT: ['recovery', 'antiinflammatory'], AMPK_ACTIVATION: ['endurance'],
    NRF2_ACTIVATION: ['recovery'], NGF_STIMULATION: ['focus'],
    DOPAMINE_PRECURSOR: ['focus'], SEROTONIN_PRECURSOR: ['focus'],
    VASODILATION: ['pump'], FIBRINOLYSIS: ['pump'],
    ATP_REGENERATION: ['strength', 'energy'], PROTEIN_SYNTHESIS: ['protein'],
    ERYTHROPOIESIS: ['endurance'], ANTIINFLAMMATORY: ['antiinflammatory'],
    ELECTROLYTE_BALANCE: ['hydration'], CHOLESTEROL_REDUCTION: ['endurance'],
    MITOCHONDRIAL_ENERGY: ['energy', 'endurance'],
  };

  if (entry.mechanisms) {
    for (const mech of entry.mechanisms) {
      for (const mapped of (mechMap[mech] || [])) cats.add(mapped);
    }
  }

  if (cats.size === 0) return null;
  const score = entry.tier === 'core' ? 70 : entry.tier === 'standard' ? 60 : entry.tier === 'advanced' ? 50 : 40;
  return { categories: [...cats], baseScore: Math.min(85, Math.max(30, score + cats.size * 5)) };
}

// Hardcoded substance DB — fallback for substances not in SUPPORT_CATALOG_DATA
const SUBSTANCE_DB: Record<string, { categories: MixCategory[]; baseScore: number }> = {
  citrulline: { categories: ['pump', 'endurance'], baseScore: 85 },
  arginine: { categories: ['pump'], baseScore: 70 },
  beta_alanine: { categories: ['endurance'], baseScore: 80 },
  creatine: { categories: ['strength', 'recovery'], baseScore: 90 },
  tyrosine: { categories: ['focus'], baseScore: 75 },
  caffeine: { categories: ['energy', 'focus'], baseScore: 80 },
  taurine: { categories: ['hydration', 'recovery', 'pump'], baseScore: 85 },
  sodium: { categories: ['hydration'], baseScore: 70 },
  potassium: { categories: ['hydration'], baseScore: 70 },
  magnesium: { categories: ['hydration', 'recovery'], baseScore: 75 },
  hbcd: { categories: ['endurance', 'glycogen'], baseScore: 90 },
  eaa: { categories: ['anticatabolic', 'protein'], baseScore: 85 },
  bcaa: { categories: ['anticatabolic'], baseScore: 70 },
  glutamine: { categories: ['recovery', 'anticatabolic'], baseScore: 80 },
  protein: { categories: ['protein', 'recovery'], baseScore: 90 },
  hmb: { categories: ['anticatabolic', 'recovery'], baseScore: 75 },
  zinc: { categories: ['hormonal', 'recovery'], baseScore: 70 },
  vitamin_c: { categories: ['recovery', 'antiinflammatory'], baseScore: 65 },
  betaine: { categories: ['strength', 'pump'], baseScore: 75 },
  agmatine: { categories: ['pump', 'focus'], baseScore: 80 },
  glycerol: { categories: ['hydration', 'pump'], baseScore: 70 },
  dextrose: { categories: ['glycogen', 'energy'], baseScore: 65 },
  alcar: { categories: ['focus', 'energy'], baseScore: 75 },
  alpha_gpc: { categories: ['focus', 'strength'], baseScore: 80 },
  theanine: { categories: ['focus'], baseScore: 70 },
  beetroot: { categories: ['pump', 'endurance'], baseScore: 75 },
  electrolyte: { categories: ['hydration'], baseScore: 75 },
  // ── NEW EXPANDED SUBSTANCES ──
  cordyceps: { categories: ['endurance', 'energy', 'recovery'], baseScore: 85 },
  reishi: { categories: ['recovery', 'energy'], baseScore: 75 },
  lions_mane: { categories: ['focus', 'recovery'], baseScore: 78 },
  ashwagandha: { categories: ['recovery', 'strength'], baseScore: 82 },
  ecdysterone: { categories: ['strength', 'protein'], baseScore: 72 },
  ginseng: { categories: ['energy', 'focus', 'endurance'], baseScore: 78 },
  rhodiola: { categories: ['energy', 'focus', 'endurance'], baseScore: 82 },
  pqq: { categories: ['energy', 'recovery'], baseScore: 68 },
  tribulus: { categories: ['strength', 'hormonal'], baseScore: 62 },
  tongkat_ali: { categories: ['strength', 'hormonal', 'energy'], baseScore: 76 },
  shilajit: { categories: ['energy', 'strength'], baseScore: 68 },
  nac: { categories: ['recovery', 'antiinflammatory'], baseScore: 72 },
  omega3: { categories: ['recovery', 'antiinflammatory'], baseScore: 66 },
  curcumin: { categories: ['recovery', 'antiinflammatory'], baseScore: 72 },
};

// ── Mechanism descriptions for each substance ──
export const MIX_MECHANISMS: Record<string, string> = {
  // pre-workout core
  creatine: 'Повышает фосфокреатиновый пул в мышцах, ускоряет ресинтез АТФ при взрывной работе (до 10 сек). Улучшает силовые показатели на 5-15%, увеличивает сухую массу.',
  caffeine: 'Антагонист аденозиновых рецепторов A1/A2A, снимает утомление ЦНС, повышает бдительность и концентрацию. Увеличивает работоспособность на 3-12%.',
  beta_alanine: 'Повышает внутримышечный карнозин (дипептид β-аланин+гистидин), буферизует H⁺ ионы, отодвигает закисление. Эффективен при работе 1-4 мин.',
  tyrosine: 'Предшественник дофамина и норадреналина, предотвращает их истощение при длительных нагрузках. Улучшает когнитивную выносливость.',
  glutamine: 'Связывает аммиак в ЦНС через глутамат-глутаминовый цикл, снижает нейротоксичность. Поддерживает иммунитет через лимфоциты и энтероциты.',
  citrulline: 'Повышает аргинин в плазме через аргинино-сукцинатный путь (обходит печёночный метаболизм аргинина), увеличивает синтез NO на 50-100%.',
  taurine: 'Регулятор осмолярности клеток, модулятор Ca²⁺ каналов в саркоплазматическом ретикулуме, улучшает сократимость мышц, антиоксидант.',
  cordyceps: 'Повышает экспрессию PGC-1α, стимулирует митохондриальный биогенез, увеличивает VO₂max и аэробную ёмкость. Активирует AMPK.',
  glycerol: 'Увеличивает осмолярность плазмы, притягивает воду в сосудистое русло (в/в гипергидратация), улучшает венозный памп и терморегуляцию.',
  agmatine: 'Продукт декарбоксилирования аргинина, модулирует eNOS (умеренно), блокирует NMDA-рецепторы, усиливает ощущение пампа и нейромодуляцию.',
  ecdysterone: 'Активирует mTORC1 через связывание с ERβ и рецептором экдизона (?), стимулирует синтез белка, увеличивает сухую массу. Спорный.',
  // intra
  hbcd: 'Высокомолекулярный циклический декстрин (cluster dextrin), быстрое поступление в мышцы через GLUT4, низкая осмолярность — не задерживает желудок.',
  eaa: 'Полный набор незаменимых аминокислот (лейцин+изолейцин+валин+лизин+метионин+треонин+триптофан+фенилаланин), прямо активируют mTOR при концентрации лейцина >2 мМ.',
  electrolyte: 'Na⁺ обеспечивает деполяризацию мембран мышечных клеток и проведение нервного импульса; K⁺ реполяризация; Mg²⁺ кофактор АТФаз и стабилизация мембран.',
  l_carnitine: 'Переносит длинноцепочечные жирные кислоты через митохондриальную мембрану (карнитин-пальмитоилтрансфераза), увеличивает окисление жиров.',
  // post
  protein: 'Быстрое поступление аминокислот в плазму (сывороточный изолят — пик через 30-45 мин), активация mTORC1 и синтеза мышечного белка (MPS).',
  hmb: 'Метаболит лейцина (β-гидрокси-β-метилбутират), ингибирует убиквитин-протеасомную деградацию белка (MuRF1, atrogin-1), снижает катаболизм.',
  nac: 'Предшественник глутатиона (GSH), повышает внутриклеточный пул глутатиона, связывает активные формы кислорода и токсичные метаболиты.',
  ashwagandha: 'Адаптоген, снижает кортизол через модуляцию HPA-оси (на 15-30%), повышает IGF-1 и тестостерон, улучшает качество сна.',
  curcumin: 'Ингибирует NF-κB и COX-2, снижает системное воспаление (С-реактивный белок на 30-60%). С пиперином биодоступность +2000%.',
  omega3: 'ЭПК и ДГК снижают продукцию провоспалительных эйкозаноидов (PGE2, LTB4), повышают резолвины и протектины — противовоспалительный каскад.',
  zinc: 'Кофактор >300 ферментов, включая супероксиддисмутазу (Zn-SOD) и ароматазу. Поддерживает тестостерон (5α-редуктаза) и иммунитет.',
  vitamin_c: 'Антиоксидант, кофактор дофамин-β-гидроксилазы (синтез норадреналина), ингибирует секрецию кортизола через подавление ACTH.',
  alcar: 'Ацетилированная форма L-карнитина, проникает через ГЭБ, повышает ацетилхолин и дофамин, улучшает нейромышечную передачу и когнитивные функции.',
  rhodiola: 'Адаптоген, ингибирует МАО-А и МАО-В, повышает серотонин и дофамин в ЦНС, снижает восприятие утомления на 20-30%.',
  alpha_lipoic: 'Активатор Nrf2/ARE, повышает эндогенные антиоксиданты (глутатион, тиоредоксин), хелатирует переходные металлы, регенерирует витамины C и E.',
  tongkat_ali: 'Повышает свободный тестостерон через ингибирование SHBG, увеличивает биоактивность андрогенов, улучшает либидо и энергию.',
};

export const MIX_SYNERGY: Record<string, string> = {
  pump: 'Максимальный NO-буст: цитруллин + глицерол + агматин дают тройной удар по разным точкам NO-каскада — субстрат (аргинин через цитруллин), осмолярность (глицерол) и модуляция eNOS/NMDA (агматин). Таурин и β-аланин дополняют через Ca²⁺-модуляцию и буферизацию H⁺.',
  endurance: 'Митохондриальный биогенез (кордицепс → PGC-1α), буферизация (β-аланин), адаптогенная защита ЦНС (родиола), жирно-кислотный транспорт (L-карнитин) и гипергидратация (глицерол) — полный охват аэробного метаболизма.',
  strength: 'Субстрат АТФ (креатин), CNS-активация (кофеин), буфер H⁺ (β-аланин), mTOR-активация (экдистерон), нейромышечная передача (АЦЛ-карнитин), Ca²⁺-модуляция (таурин).',
  recovery: 'Быстрый MPS (протеин) + креатин-фосфат + глютамин (иммунитет/ЖКТ) + HMB (анти-катаболизм) + NAC (глутатион) + ашваганда (кортизол↓) + омега-3 (воспаление↓) — комплексное восстановление всех систем.',
  focus: 'Дофамин/норадреналин (тирозин) + ацетилхолин (АЦЛ-карнитин) + ATP для мозга (кордицепс) + адаптоген (родиола) + умеренная CNS-стимуляция (кофеин) + GABA-модуляция (таурин) + NO для мозгового кровотока (цитруллин).',
  powerlifting: 'Максимальная CNS-активация (кофеин 300-400 мг), аммиак-буфер (OKG), фосфокреатин (загрузка креатина 8 г), тройной NO (цитруллин + агматин + глицерол) для кровотока и венозного памяти, допамин-буст (тирозин), митохондрии (кордицепс).',
  competition: 'Экстремальный CNS-фокус (кофеин 400 мг), аммиак-буфер (OKG), NO-каскад (агматин + цитруллин), умеренная гипергидратация (глицерол). Минимум объёма, максимум CNS-активации.',
  crossfit: 'Митохондриальная ёмкость (кордицепс) + H⁺-буферизация (β-аланин) + гидратация (глицерол) + NO для кровотока (цитруллин) + адаптоген (родиола) + осморегуляция (таурин).',
  post_comp: 'Гормональная стабилизация (ZMA + ашваганда + родиола), полный MPS (протеин + глютамин), креатин-загрузка, антиоксиданты (вит. C), глутатион (NAC), системное воспаление (омега-3).',
};

export interface MixTemplate {
  id: string;
  name: string;
  description: string;
  goal: MixProfile['goal'];
  tags: string[];
  pre: { id: string; dose: string; unit: string; }[];
  intra: { id: string; dose: string; unit: string; }[];
  post: { id: string; dose: string; unit: string; }[];
}

export const MIX_TEMPLATES: MixTemplate[] = [
  {
    id: 'c4_original', name: 'C4 Original (аналог)', description: 'Классический предтреник: кофеин + креатин + β-аланин + аргинин. Энергия и памп без перегруза.',
    goal: 'pump', tags: ['pre', 'энергия', 'памп', 'классика'],
    pre: [{ id:'caffeine', dose:'200', unit:'мг' }, { id:'creatine', dose:'5', unit:'г' }, { id:'beta_alanine', dose:'3.2', unit:'г' }, { id:'citrulline', dose:'6', unit:'г' }, { id:'tyrosine', dose:'2', unit:'г' }],
    intra: [], post: [],
  },
  {
    id: 'pump_formula', name: 'Pump-формула MAX', description: 'Максимальный NO: цитруллин + глицерол + агматин. Венозный пампинг и гипергидратация.',
    goal: 'pump', tags: ['pre', 'памп', 'NO', 'max'],
    pre: [{ id:'citrulline', dose:'8', unit:'г' }, { id:'glycerol', dose:'5', unit:'г' }, { id:'agmatine', dose:'1', unit:'г' }, { id:'taurine', dose:'2', unit:'г' }, { id:'creatine', dose:'5', unit:'г' }],
    intra: [{ id:'glycerol', dose:'3', unit:'г' }, { id:'citrulline', dose:'3', unit:'г' }, { id:'electrolyte', dose:'1.5', unit:'г/л' }],
    post: [],
  },
  {
    id: 'superhuman_clone', name: 'SuperHuman (аналог)', description: 'Тяжёлый предтрен: двойной стимулятор + ноотропы. Максимум CNS-активации.',
    goal: 'powerlifting', tags: ['pre', 'сила', 'CNS', 'тяжёлый'],
    pre: [{ id:'caffeine', dose:'400', unit:'мг' }, { id:'tyrosine', dose:'3', unit:'г' }, { id:'alcar', dose:'1.5', unit:'г' }, { id:'beta_alanine', dose:'4', unit:'г' }, { id:'citrulline', dose:'6', unit:'г' }, { id:'agmatine', dose:'1', unit:'г' }, { id:'taurine', dose:'2', unit:'г' }],
    intra: [], post: [],
  },
  {
    id: 'endurance_pro', name: 'Endurance Pro', description: 'Для длительных кардио-сессий: кордицепс + родиола + карнитин + электролиты.',
    goal: 'endurance', tags: ['pre', 'intra', 'выносливость', 'кардио'],
    pre: [{ id:'cordyceps', dose:'3', unit:'г' }, { id:'rhodiola', dose:'500', unit:'мг' }, { id:'beta_alanine', dose:'4', unit:'г' }, { id:'l_carnitine', dose:'1.5', unit:'г' }],
    intra: [{ id:'hbcd', dose:'50', unit:'г' }, { id:'electrolyte', dose:'2', unit:'г/л' }, { id:'glycerol', dose:'3', unit:'г' }],
    post: [{ id:'protein', dose:'0.35', unit:'г/кг' }, { id:'glutamine', dose:'5', unit:'г' }, { id:'omega3', dose:'2', unit:'г' }],
  },
  {
    id: 'strength_basic', name: 'Strength Basic', description: 'База для силовой тренировки: креатин + кофеин + β-аланин. Минимум компонентов, максимум силы.',
    goal: 'strength', tags: ['pre', 'сила', 'база'],
    pre: [{ id:'creatine', dose:'5', unit:'г' }, { id:'caffeine', dose:'300', unit:'мг' }, { id:'beta_alanine', dose:'3.2', unit:'г' }, { id:'citrulline', dose:'6', unit:'г' }, { id:'taurine', dose:'2', unit:'г' }],
    intra: [], post: [],
  },
  {
    id: 'full_recovery', name: 'Full Recovery Kit', description: 'Полный пост-тренировочный комплект: MPS + антиоксиданты + гормональная стабилизация.',
    goal: 'recovery', tags: ['post', 'восстановление', 'MPS', 'антиоксидант'],
    pre: [],
    intra: [],
    post: [{ id:'protein', dose:'0.4', unit:'г/кг' }, { id:'creatine', dose:'5', unit:'г' }, { id:'glutamine', dose:'5', unit:'г' }, { id:'nac', dose:'1.2', unit:'г' }, { id:'ashwagandha', dose:'600', unit:'мг' }, { id:'omega3', dose:'2', unit:'г' }, { id:'vitamin_c', dose:'1000', unit:'мг' }, { id:'zinc', dose:'30+450', unit:'мг' }],
  },
  {
    id: 'focus_nootropic', name: 'Focus Nootropic Stack', description: 'Для максимальной концентрации: тирозин + АЦЛ-карнитин + родиола. Без перестимуляции.',
    goal: 'focus', tags: ['pre', 'фокус', 'ноотроп'],
    pre: [{ id:'tyrosine', dose:'3', unit:'г' }, { id:'alcar', dose:'1.5', unit:'г' }, { id:'rhodiola', dose:'500', unit:'мг' }, { id:'caffeine', dose:'200', unit:'мг' }, { id:'citrulline', dose:'4', unit:'г' }],
    intra: [{ id:'eaa', dose:'8', unit:'г' }, { id:'electrolyte', dose:'1', unit:'г/л' }],
    post: [],
  },
  {
    id: 'crossfit_wod', name: 'CF WOD Stack', description: 'Для CrossFit: энергия + гидратация + восстановление между WODами.',
    goal: 'crossfit', tags: ['pre', 'intra', 'post', 'CF', 'WOD'],
    pre: [{ id:'caffeine', dose:'300', unit:'мг' }, { id:'beta_alanine', dose:'4', unit:'г' }, { id:'cordyceps', dose:'3', unit:'г' }, { id:'citrulline', dose:'6', unit:'г' }],
    intra: [{ id:'hbcd', dose:'60', unit:'г' }, { id:'eaa', dose:'15', unit:'г' }, { id:'electrolyte', dose:'2', unit:'г/л' }, { id:'glycerol', dose:'3', unit:'г' }],
    post: [{ id:'protein', dose:'0.35', unit:'г/кг' }, { id:'creatine', dose:'5', unit:'г' }, { id:'omega3', dose:'2', unit:'г' }, { id:'curcumin', dose:'800', unit:'мг' }],
  },
];

// ── Drug-specific cocktail augmentations ──
// Each entry: what substances to ADD (+) or REMOVE (-) when drug is active
export interface DrugCocktailMod {
  substances: { id: string; dose: string; unit: string; note: string; mg: number; timing: 'pre' | 'intra' | 'post' }[];
  replaceProto?: string; // id proto-вещества, которое ЗАМЕНИТЬ (если drug заменяет обычный предтрен)
}

export const DRUG_COCKTAILS: Record<string, (profile: MixProfile) => DrugCocktailMod> = {
  insulin: (p) => {
    const isPost = p.drugs.insulinTiming === 'post';
    return {
      substances: isPost ? [
        { id:'dextrose', dose:`${Math.round(p.weightKg * 0.8)}`, unit:'г', note:'Сразу после — закрыть окно инсулина', mg:Math.round(p.weightKg * 0.8 * 1000), timing:'post' },
        { id:'creatine', dose:'5', unit:'г', note:'С инсулином усвоение креатина +30%', mg:5000, timing:'post' },
        { id:'eaa', dose:`${Math.round(p.weightKg * 0.3)}`, unit:'г', note:'Инсулин + EAA = макс. MPS', mg:Math.round(p.weightKg * 0.3 * 1000), timing:'post' },
      ] : [
        { id:'dextrose', dose:`${Math.round(p.weightKg * 0.5)}`, unit:'г', note:'Перед — профилактика гипогликемии', mg:Math.round(p.weightKg * 0.5 * 1000), timing:'pre' },
        { id:'creatine', dose:'5', unit:'г', note:'За 30 мин до. Усвоение +30% с инсулином', mg:5000, timing:'pre' },
      ],
    };
  },
  igf: (p) => ({
    substances: [
      { id:'eaa', dose:`${Math.round(p.weightKg * 0.25)}`, unit:'г', note:'IGF-1 ↑ MPS — максимум субстрата', mg:Math.round(p.weightKg * 0.25 * 1000), timing:'intra' },
      { id:'glutamine', dose:'10', unit:'г', note:'IGF-1 ↑ пролиферацию энтероцитов', mg:10000, timing:'post' },
      { id:'protein', dose:`${Math.round(p.weightKg * 0.5)}`, unit:'г', note:'IGF-1 ↑ синтез белка — двойная доза протеина', mg:Math.round(p.weightKg * 0.5 * 1000), timing:'post' },
    ],
  }),
  mgf: (p) => ({
    substances: [
      { id:'glutamine', dose:'10', unit:'г', note:'МГФ ↑ сателлитные клетки — глутамин для деления', mg:10000, timing:'post' },
      { id:'hmb', dose:'3', unit:'г', note:'МГФ + HMB = синергия анти-катаболизма', mg:3000, timing:'post' },
      { id:'protein', dose:`${Math.round(p.weightKg * 0.5)}`, unit:'г', note:'МГФ требует белка для регенерации', mg:Math.round(p.weightKg * 0.5 * 1000), timing:'post' },
    ],
  }),
  gh: (p) => ({
    substances: [
      { id:'l_carnitine', dose:'2', unit:'г', note:'ГР ↑ липолиз — карнитин усиливает транспорт ЖК', mg:2000, timing:'intra' },
      { id:'cordyceps', dose:'3', unit:'г', note:'ГР + кордицепс = митохондриальный биогенез', mg:3000, timing:'pre' },
      { id:'electrolyte', dose:'1.5', unit:'г/л', note:'ГР задерживает натрий — корректировка электролитов', mg:1500, timing:'intra' },
    ],
  }),
};

export function calculateMixScore(substances: MixSubstance[], profile: MixProfile): TrainingMixScore {
  const multiplier = profile.isOnCycle ? 1.25 : 1.0;
  const bw = profile.weightKg;
  const durHrs = profile.workoutDurationMin / 60;

  // Score accumulators
  let pump = 0, energy = 0, focus = 0, strength = 0;
  let hydration = 0, endurance = 0, anticatabolic = 0;
  let recovery = 0, protein = 0, glycogen = 0;
  let noScore = 0;
  const catLabel: Record<string, string> = { pump:'🩸 Памп', energy:'⚡ Энергия', focus:'🧠 Фокус', strength:'🏋️ Сила', hydration:'💧 Гидратация', endurance:'🏃 Выносливость', anticatabolic:'🛡️ Анти-катаболизм', recovery:'🔄 Восстановление', protein:'🥩 Белок', glycogen:'🍚 Гликоген' };
  const substanceBreakdown: SubstanceScoreBreakdown[] = [];

  for (const sub of substances) {
    const db = getSubstanceScore(sub.id) || SUBSTANCE_DB[sub.id] || SUBSTANCE_DB[sub.id.toLowerCase()];
    if (!db) continue;
    const score = db.baseScore * multiplier;
    const cats: { key: string; label: string; score: number }[] = [];
    for (const cat of db.categories) {
      if (cat === 'pump') { pump = Math.max(pump, score); cats.push({ key: cat, label: catLabel[cat] || cat, score: Math.round(score) }); }
      if (cat === 'energy') { energy = Math.max(energy, score); cats.push({ key: cat, label: catLabel[cat] || cat, score: Math.round(score) }); }
      if (cat === 'focus') { focus = Math.max(focus, score); cats.push({ key: cat, label: catLabel[cat] || cat, score: Math.round(score) }); }
      if (cat === 'strength') { strength = Math.max(strength, score); cats.push({ key: cat, label: catLabel[cat] || cat, score: Math.round(score) }); }
      if (cat === 'hydration') { hydration = Math.max(hydration, score); cats.push({ key: cat, label: catLabel[cat] || cat, score: Math.round(score) }); }
      if (cat === 'endurance') { endurance = Math.max(endurance, score); cats.push({ key: cat, label: catLabel[cat] || cat, score: Math.round(score) }); }
      if (cat === 'anticatabolic') { anticatabolic = Math.max(anticatabolic, score); cats.push({ key: cat, label: catLabel[cat] || cat, score: Math.round(score) }); }
      if (cat === 'recovery') { recovery = Math.max(recovery, score); cats.push({ key: cat, label: catLabel[cat] || cat, score: Math.round(score) }); }
      if (cat === 'protein') { protein = Math.max(protein, score); cats.push({ key: cat, label: catLabel[cat] || cat, score: Math.round(score) }); }
      if (cat === 'glycogen') { glycogen = Math.max(glycogen, score); cats.push({ key: cat, label: catLabel[cat] || cat, score: Math.round(score) }); }
    }
    substanceBreakdown.push({ id: sub.id, name: sub.name, doseMg: sub.doseMg, baseScore: Math.round(score), categories: cats });
  }

  // NO score = pump + endurance weighted, minus nandrolone penalty
  noScore = Math.round(pump * 0.5 + endurance * 0.3 + hydration * 0.2);
  const electrolyteWarnings: string[] = [];
  const drugModifiers: TrainingMixScore['drugModifiers'] = [];

  if (profile.hasNandrolone) {
    const noPenalty = 20;
    noScore = Math.max(0, noScore - noPenalty);
    pump = Math.max(0, Math.round(pump * 0.8));
    drugModifiers.push({ drug: 'Нандролон (19-нор)', effect: '↓ синтез NO через ↓ eNOS — требуется усиление пампа', bonus: -20 });
  }

  // ── DRUG MODIFIERS ──
  // Insulin — ↑ усвоение глюкозы & аминокислот, ↑ гликоген
  if (profile.drugs.insulin) {
    const doseFactor = profile.drugs.insulinDose ? Math.min(1.5, 1 + profile.drugs.insulinDose / 10) : 1.3;
    const postBoost = profile.drugs.insulinTiming === 'post' ? 1.2 : 1.0;
    noScore = Math.round(noScore * 1.15);
    strength = Math.round(strength * 1.1 * postBoost);
    recovery = Math.round(recovery * 1.15 * postBoost);
    glycogen = Math.round(glycogen * 1.3 * postBoost);
    drugModifiers.push({ drug: `Инсулин ${profile.drugs.insulinDose||'?'}ЕД (${profile.drugs.insulinTiming||'post'})`, effect: '↑ гликоген + MPS, требуется ↓ гипогликемии', bonus: Math.round((doseFactor-1)*100) });
  }
  // IGF-1 — ↑ MPS, ↑ регенерация, ↑ mTOR
  if (profile.drugs.igf) {
    const doseFactor = profile.drugs.igfDose ? Math.min(1.3, 1 + profile.drugs.igfDose / 200) : 1.1;
    const timingBoost = profile.drugs.igfTiming === 'post' ? 1.2 : 1.0;
    protein = Math.round(protein * 1.2 * timingBoost);
    recovery = Math.round(recovery * 1.2 * timingBoost);
    anticatabolic = Math.round(anticatabolic * 1.15 * timingBoost);
    noScore = Math.round(noScore * 1.1);
    drugModifiers.push({ drug: `ИГФ-1 ${profile.drugs.igfDose||'?'}мкг`, effect: '↑ MPS + регенерация, ↑ потребность в EAA', bonus: Math.round((doseFactor-1)*100) });
  }
  // GH — ↑ липолиз, ↑ IGF-1, ↑ восстановление
  if (profile.drugs.gh) {
    const doseFactor = profile.drugs.ghDose ? Math.min(1.4, 1 + profile.drugs.ghDose / 10) : 1.15;
    recovery = Math.round(recovery * 1.2 * doseFactor);
    endurance = Math.round(endurance * 1.1);
    noScore = Math.round(noScore * 1.1);
    if (profile.timing === 'post') { protein = Math.round(protein * 1.15); }
    drugModifiers.push({ drug: `ГР ${profile.drugs.ghDose||'?'}МЕ`, effect: '↑ восстановление + липолиз, ↑ потребность в белке', bonus: Math.round((doseFactor-1)*100) });
  }
  // MGF — ↑ сателлитные клетки, ↑ локальная регенерация
  if (profile.drugs.mgf) {
    const doseFactor = profile.drugs.mgfDose ? Math.min(1.2, 1 + profile.drugs.mgfDose / 500) : 1.08;
    recovery = Math.round(recovery * 1.15 * doseFactor);
    protein = Math.round(protein * 1.1);
    noScore = Math.round(noScore * 1.08);
    drugModifiers.push({ drug: `МГФ ${profile.drugs.mgfDose||'?'}мкг`, effect: '↑ пролиферация сателлитных клеток, ↑ акт. регенерация', bonus: Math.round((doseFactor-1)*100) });
  }
  if (profile.drugs.glp1) { drugModifiers.push({ drug: 'ГПП-1', effect: '↓ гликемия — следить за гипогликемией', bonus: -5 }); }

  // Carb calculation based on goal and drugs
  let recCarbs = 0;
  if (profile.timing === 'pre') recCarbs = bw * (profile.goal === 'endurance' ? 1.2 : profile.goal === 'crossfit' ? 1.0 : profile.goal === 'powerlifting' || profile.goal === 'competition' ? 1.0 : profile.goal === 'post_comp' ? 0.6 : profile.goal === 'strength' ? 0.8 : 0.6) * multiplier;
  if (profile.timing === 'intra') recCarbs = bw * durHrs * (profile.goal === 'crossfit' ? 0.8 : profile.goal === 'powerlifting' ? 0.5 : profile.goal === 'competition' ? 0.4 : 0.6) * multiplier;
  if (profile.timing === 'post') recCarbs = bw * (profile.goal === 'crossfit' || profile.goal === 'post_comp' ? 1.4 : profile.goal === 'competition' ? 1.2 : 0.8) * multiplier;
  if (profile.drugs.insulin) {
    const insulinFactor = profile.drugs.insulinTiming === 'post' ? 1.3 : 1.5;
    recCarbs *= insulinFactor;
  }
  if (profile.drugs.glp1) recCarbs *= 0.5;

  // EAA calculation — IGF/MGF ↑ потребность в аминокислотах
  let recEAA = profile.timing === 'intra' ? bw * 0.15 * multiplier : profile.timing === 'post' ? bw * 0.4 * multiplier : bw * 0.1 * multiplier;
  if (profile.drugs.insulin) recEAA *= 1.2;
  if (profile.drugs.igf) recEAA *= 1.25; // IGF ↑ MPS → больше субстрата
  if (profile.drugs.mgf) recEAA *= 1.2;  // MGF ↑ регенерацию → больше аминокислот
  if (profile.drugs.gh) recEAA *= 1.15;
  if (profile.workoutType === 'heavy') recEAA *= 1.3;

  // Water — insulin/GH ↑ потребность в воде
  let recWater = bw * 35 + durHrs * 500;
  if (profile.drugs.insulin) recWater *= 1.15;
  if (profile.drugs.gh) recWater *= 1.1;

  // Time-of-day adjustments
  if (profile.timeOfDay === 'morning') { energy = Math.round(energy * 1.1); }
  if (profile.timeOfDay === 'evening') { recovery = Math.round(recovery * 1.15); }

  // Electrolyte analysis & isotonic drink calculation
  // Normal ranges: Na 135-145, K 3.5-5.2, Cl 98-108 mmol/L
  const na = profile.userElectrolytes.sodiumMmolL || 140;
  const k = profile.userElectrolytes.potassiumMmolL || 4.2;
  const cl = profile.userElectrolytes.chlorideMmolL || 102;

  // Na loss: ~500-1500 mg per hour of sweating (avg 1000mg/h)
  const sweatNaMgH = na < 138 ? 1500 : na > 144 ? 700 : 1000;
  const recNa = Math.round(sweatNaMgH * durHrs);
  const recK = Math.round(k < 3.8 ? 400 * durHrs : 250 * durHrs);
  const recCl = Math.round(cl < 100 ? recNa * 1.5 : recNa * 1.2);

  if (profile.timing === 'intra') {
    hydration = Math.round(hydration * (na >= 138 && k >= 3.8 ? 1.0 : 0.85));
    if (na < 138) electrolyteWarnings.push(`Na⁺ снижен (${na} ммоль/л) — увеличьте соль в изотонике до ${recNa} мг`);
    if (k < 3.8) electrolyteWarnings.push(`K⁺ снижен (${k} ммоль/л) — добавьте калий ${recK} мг, риск судорог`);
    if (cl < 100) electrolyteWarnings.push(`Cl⁻ снижен (${cl} ммоль/л) — добавьте хлориды ${recCl} мг`);
  }

  const suggestions: string[] = [];

  // NO depletion from drugs (nandrolone primarily, but also check dehydration)
  if (profile.hasNandrolone && profile.timing === 'pre') {
    suggestions.push('⚠ Нандролон снижает NO — добавьте цитруллин 8-10 г + агматин 1 г + глицерол 3-5 г для компенсации');
  }

  // Composite score based on timing + goal
  let composite = 0;
  const isPL = profile.goal === 'powerlifting' || profile.goal === 'competition';
  const isCF = profile.goal === 'crossfit';
  const isPostComp = profile.goal === 'post_comp';
  const isStrength = profile.goal === 'strength';
  const isPump = profile.goal === 'pump';
  const isEndurance = profile.goal === 'endurance';
  const isFocus = profile.goal === 'focus';
  const isRecovery = profile.goal === 'recovery';
  const weights = profile.timing === 'pre'
    ? { pump: isPump ? 0.35 : isStrength ? 0.10 : isEndurance ? 0.10 : isFocus ? 0.05 : isCF ? 0.15 : 0.15, energy: isPump ? 0.15 : isStrength ? 0.20 : isEndurance ? 0.30 : isFocus ? 0.20 : isCF ? 0.30 : 0.25, focus: isPump ? 0.05 : isStrength ? 0.10 : isEndurance ? 0.10 : isFocus ? 0.40 : isCF ? 0.25 : 0.25, strength: isPump ? 0.10 : isStrength ? 0.40 : isEndurance ? 0.10 : isFocus ? 0.10 : isPL ? 0.25 : 0.25, endurance: isPump ? 0.10 : isStrength ? 0.05 : isEndurance ? 0.35 : isFocus ? 0.05 : isCF ? 0.15 : 0.05 }
    : profile.timing === 'intra'
    ? { pump: isPump ? 0.20 : isStrength ? 0.10 : 0.10, energy: isEndurance ? 0.20 : isCF ? 0.10 : 0.10, focus: 0.05, strength: isStrength ? 0.15 : 0.05, hydration: isCF ? 0.35 : isEndurance ? 0.35 : 0.30, endurance: isEndurance ? 0.25 : isCF ? 0.20 : 0.20, anticatabolic: 0.15 }
    : { pump: 0.05, energy: 0.05, focus: 0.05, strength: isStrength ? 0.20 : isPL ? 0.15 : 0.1, hydration: 0.05, recovery: isRecovery ? 0.50 : isPostComp ? 0.45 : isPL ? 0.40 : 0.35, protein: isRecovery ? 0.20 : isStrength ? 0.30 : isPostComp ? 0.25 : 0.25, glycogen: isPostComp ? 0.10 : isPL ? 0.05 : 0.10, antiinflammatory: isRecovery ? 0.10 : isPostComp ? 0.10 : 0 };

  for (const [key, w] of Object.entries(weights)) {
    const val = key === 'pump' ? pump : key === 'energy' ? energy : key === 'focus' ? focus : key === 'strength' ? strength : key === 'hydration' ? hydration : key === 'endurance' ? endurance : key === 'anticatabolic' ? anticatabolic : key === 'recovery' ? recovery : key === 'protein' ? protein : glycogen;
    composite += Math.round(val * w);
  }
  composite = Math.min(100, Math.round(composite * multiplier));

  const label = composite >= 85 ? '💎 Элитный' : composite >= 70 ? '⭐ Отличный' : composite >= 50 ? '👍 Хороший' : composite >= 30 ? '⚡ Базовый' : '⚠️ Слабый';
  const color = composite >= 85 ? '#a855f7' : composite >= 70 ? '#22c55e' : composite >= 50 ? '#3b82f6' : composite >= 30 ? '#f59e0b' : '#ef4444';

  if (pump < 60) suggestions.push('🩸 Усильте памп: цитруллин 6-8 г + глицерол 3-5 г + агматин 1 г для максимального NO');
  if (energy < 60 && profile.timing === 'pre') suggestions.push('⚡ Добавьте энергию: кофеин 200 мг + кордицепс 2-3 г или родиола 500 мг');
  if (focus < 60 && profile.timing === 'pre') suggestions.push('🧠 Улучшите фокус: тирозин 2 г + АЦЛ-карнитин 1.5 г + альфа-GPC 600 мг');
  if (hydration < 60 && profile.timing === 'intra') suggestions.push('💧 Добавьте гидратацию: электролиты (Na/K/Mg) + глицерол 3-5 г в изотоник');
  if (recovery < 60 && profile.timing === 'post') suggestions.push('🔄 Усильте восстановление: протеин 0.4 г/кг + глютамин 5 г + ашваганда 600 мг');
  if (glycogen < 60 && profile.timing === 'post') suggestions.push('🍚 Восполните гликоген: HBCD 1 г/кг + креатин 5 г');
  if (strength < 60 && profile.timing === 'pre') suggestions.push('🏋️ Добавьте силу: креатин 5 г + экдистерон 500 мг + таурин 2 г');
  if (anticatabolic < 60 && (profile.timing === 'intra' || profile.timing === 'post')) suggestions.push('🛡️ Анти-катаболизм: добавьте BCAA 8-10 г или HMB 3 г + глютамин 5 г');
  if (endurance < 60 && profile.timing === 'pre') suggestions.push('🏃 Увеличьте выносливость: кордицепс 2-3 г + бета-аланин 3.2 г + родиола 500 мг');
  if (profile.goal === 'powerlifting' && profile.timing === 'pre') suggestions.push('💪 Пауэрлифтинг: креатин 5-10 г + кофеин 200-400 мг + бета-аланин 4-6 г + таурин 2 г + цитруллин 6-8 г для максимальной силы и NO');
  if (profile.goal === 'competition' && profile.timing === 'pre') suggestions.push('🏆 Соревнования: аммиак-буфер (OKG 5 г) + креатин 8 г + кофеин 400 мг + агматин 1 г для CNS-активации');
  if (profile.goal === 'competition' && profile.timing === 'intra') suggestions.push('🏆 Соревнования: только электролиты + 15-20 г HBCD между попытками, креатин 3 г для поддержки АТФ');
  if (profile.goal === 'competition' && profile.timing === 'post') suggestions.push('🏆 После соревнований: протеин 0.5 г/кг + HBCD 1 г/кг + креатин 10 г (загрузка) + глютамин 10 г + NAC 1.2 г');
  if (profile.drugs.insulin && profile.timing === 'intra' && glycogen < 70) suggestions.push('⚠ При инсулине: углеводы до ' + Math.round(recCarbs) + ' г для предотвращения гипогликемии');
  if (profile.drugs.igf && profile.timing === 'post' && protein < 70) suggestions.push('🧬 ИГФ-1 на пост: увеличьте белок до ' + Math.round(recEAA) + ' г EAA для максимального MPS');
  if (profile.drugs.mgf && profile.timing === 'post') suggestions.push('🧬 МГФ требует субстрата: добавьте глютамин 10 г + BCAA 10 г для регенерации');
  if (profile.drugs.gh && profile.timing === 'intra') suggestions.push('💉 ГР на курсе: следите за гликемией (инсулин?), добавьте L-карнитин 1 г для липолиза');
  if (profile.drugs.gh && profile.timing === 'post') suggestions.push('💉 ГР усиливает липолиз: добавьте L-карнитин + CLA + экстракт зелёного чая для жиросжигания');
  if (profile.goal === 'crossfit') {
    if (profile.timing === 'pre') suggestions.push('💪 CrossFit: кофеин 200-400 мг + бета-аланин 4 г + кордицепс 3 г + электролиты для WOD');
    if (profile.timing === 'intra') suggestions.push('💪 CF (2-3 сессии): HBCD 60-80 г + EAA 15 г + L-карнитин 1 г + Na/K/Mg между WODами для восстановления');
    if (profile.timing === 'post') suggestions.push('💪 CF: протеин 0.5 г/кг + HBCD 1.5 г/кг + креатин 5 г + куркумин + омега-3 для системного воспаления');
  }
  if (profile.goal === 'post_comp') {
    suggestions.push('🔄 Пост-соревнования: гормональный откат — ZMA, ашваганда 600 мг, витамин C 1 г, родиола 500 мг (кортизол + восстановление)');
    suggestions.push('💤 Сон 9+ часов, холодные ванны для воспаления, минимум стимуляторов 3-5 дней');
  }

  return {
    pumpScore: pump, energyScore: energy, focusScore: focus, strengthScore: strength,
    hydrationScore: hydration, enduranceScore: endurance, anticatabolicScore: anticatabolic,
    recoveryScore: recovery, proteinScore: protein, glycogenScore: glycogen,
    noScore: Math.min(100, noScore),
    compositeScore: composite,
    label, color,
    recommendedCarbsG: Math.round(recCarbs),
    recommendedEAAG: Math.round(recEAA),
    recommendedWaterMl: Math.round(recWater),
    recommendedNaMg: recNa, recommendedKMg: recK, recommendedClMg: recCl,
    drugModifiers,
    electrolyteWarnings,
    suggestions,
    substanceBreakdown,
  };
}
