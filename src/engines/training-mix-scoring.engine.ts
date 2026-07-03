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
  goal: 'pump' | 'endurance' | 'strength' | 'recovery' | 'focus' | 'powerlifting' | 'competition' | 'crossfit' | 'post_comp' | 'hiit' | 'mma' | 'sprint' | 'fat_loss' | 'joint' | 'gut' | 'sleep' | 'hydration';
  timing: 'pre' | 'intra' | 'post';
  weightKg: number;
  isOnCycle: boolean;
  drugs: { insulin: boolean; insulinDose?: number; insulinTiming?: 'pre' | 'post'; igf: boolean; igfDose?: number; igfTiming?: 'pre' | 'post'; gh: boolean; ghDose?: number; ghTiming?: 'pre' | 'post'; mgf: boolean; mgfDose?: number; mgfTiming?: 'pre' | 'post'; glp1: boolean };
  hasNandrolone: boolean;
  userElectrolytes: { sodiumMmolL: number; potassiumMmolL: number; chlorideMmolL: number };
  workoutType: 'heavy' | 'moderate' | 'light';
  timeOfDay: 'morning' | 'afternoon' | 'evening';
  workoutDurationMin: number;
  experience?: 'novice' | 'intermediate' | 'advanced';
  dayType?: 'push' | 'pull' | 'legs' | 'upper' | 'lower' | 'fullbody';
  aas?: string[];
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
  hiit: 'Анаэробная ёмкость (β-аланин + креатин), гидратация (глицерол + электролиты), NO-буст (цитруллин), CNS-активация (кофеин), быстрый ресинтез АТФ (кордицепс), буфер лактата (таурин).',
  mma: 'Взрывная сила (креатин), CNS-ready (кофеин 200 мг + тирозин), лактат-буфер (β-аланин), гидратация (глицерол), NO-кровоток (цитруллин), адаптоген (родиола), защита мозга (АЦЛ-карнитин + таурин).',
  sprint: 'Быстрая АТФ-регенерация (креатин 8 г + кордицепс), NO-пампинг (цитруллин + глицерол), CNS-стимуляция (кофеин), H⁺-буфер (β-аланин), нейромышечная передача (магний + таурин).',
};

export interface MixTemplateItem {
  id: string;
  name?: string;
  dose: string;
  unit: string;
  note?: string;
}

export interface MixTemplate {
  id: string;
  name: string;
  description: string;
  goal: MixProfile['goal'];
  tags: string[];
  pre: MixTemplateItem[];
  intra: MixTemplateItem[];
  post: MixTemplateItem[];
}

export interface MixRenderItem {
  name: string;
  id: string;
  dose: string;
  unit: string;
  note: string;
  mg: number;
}

/** Build the default comprehensive stack for a goal+timing (without multiplier — apply at render). */
export function buildDefaultStack(
  goal: string,
  timing: 'pre' | 'intra' | 'post',
  bw: number,
  multiplier: number,
  durHrs: number,
  isCompetition: boolean,
): MixRenderItem[] {
  const mixUnit = (v: number): string => v >= 1000 ? `${(v/1000).toFixed(1)}` : `${v}`;
  const mixSuffix = (v: number): string => v >= 1000 ? 'г' : 'мг';
  const isPL = goal === 'powerlifting' || goal === 'competition';
  const isStrengthGoal = goal === 'strength';
  const isPumpGoal = goal === 'pump';
  const isFocusGoal = goal === 'focus';
  const isEnduranceGoal = goal === 'endurance';
  const isRecoveryGoal = goal === 'recovery';
  const isHIIT = goal === 'hiit';
  const isMMA = goal === 'mma';
  const isSprint = goal === 'sprint';
  const isPostComp = goal === 'post_comp';
  const isCF = goal === 'crossfit';
  const nil: MixRenderItem[] = [];

  // ── PRE ──
  if (timing === 'pre') {
    if (isPL) return [
      { name:'Креатин (загрузка)', id:'creatine', dose:mixUnit(8000*multiplier), unit:'г', note:'За 45 мин до. АТФ для максимальных усилий', mg:Math.round(8000*multiplier) },
      { name:'Кофеин', id:'caffeine', dose:`${isCompetition?400:300}`, unit:'мг', note:'За 30 мин до. CNS-активация', mg:isCompetition?400:300 },
      { name:'Бета-аланин', id:'beta_alanine', dose:'4', unit:'г', note:'За 30 мин до. Буфер H⁺ ионов', mg:4000 },
      { name:'L-тирозин', id:'tyrosine', dose:mixUnit(3000*multiplier), unit:mixSuffix(3000*multiplier), note:'За 30 мин до. Фокус, дофамин', mg:Math.round(3000*multiplier) },
      { name:'OKG (орнитин)', id:'glutamine', dose:'5', unit:'г', note:'За 30 мин до. Аммиак-буфер для ЦНС', mg:5000 },
      { name:'Цитруллин', id:'citrulline', dose:mixUnit(6000*multiplier), unit:'г', note:'За 45 мин. NO для кровотока', mg:Math.round(6000*multiplier) },
      { name:'Таурин', id:'taurine', dose:mixUnit(2000*multiplier), unit:mixSuffix(2000*multiplier), note:'За 30 мин до. Осморегуляция, пампинг', mg:Math.round(2000*multiplier) },
      { name:'Кордицепс', id:'cordyceps', dose:'3', unit:'г', note:'За 45 мин до. VO₂max, митохондриальный биогенез', mg:3000 },
      { name:'Глицерол', id:'glycerol', dose:`${(3*multiplier).toFixed(1)}`, unit:'г', note:'За 60 мин до. Гипергидратация, венозный пампинг', mg:Math.round(3000*multiplier) },
      { name:'Агматин', id:'agmatine', dose:'1', unit:'г', note:'За 30 мин до. NO-модуляция, нейромодулятор', mg:1000 },
      { name:'Экдистерон', id:'ecdysterone', dose:'500', unit:'мг', note:'За 30 мин до. mTOR, синтез белка', mg:500 },
    ];
    if (isStrengthGoal) return [
      { name:'Креатин', id:'creatine', dose:mixUnit(5000*multiplier), unit:mixSuffix(5000*multiplier), note:'За 45 мин до. АТФ, фосфокреатин', mg:Math.round(5000*multiplier) },
      { name:'Кофеин', id:'caffeine', dose:'300', unit:'мг', note:'За 30 мин до. CNS-активация', mg:300 },
      { name:'Бета-аланин', id:'beta_alanine', dose:'3.2', unit:'г', note:'За 30 мин до. Буфер H⁺', mg:3200 },
      { name:'Экдистерон', id:'ecdysterone', dose:'500', unit:'мг', note:'За 45 мин до. mTOR, синтез белка', mg:500 },
      { name:'Таурин', id:'taurine', dose:`${(2*multiplier).toFixed(1)}`, unit:'г', note:'За 30 мин до. Ca²⁺-модуляция', mg:Math.round(2000*multiplier) },
      { name:'Цитруллин', id:'citrulline', dose:'6', unit:'г', note:'За 45 мин до. NO для рабочего кровотока', mg:6000 },
      { name:'АЦЛ-карнитин', id:'alcar', dose:'1.5', unit:'г', note:'За 30 мин до. Ацетилхолин, нейромышечная передача', mg:1500 },
      { name:'Родиола розовая', id:'rhodiola', dose:'500', unit:'мг', note:'За 30 мин до. ↓ утомления ЦНС', mg:500 },
    ];
    if (isFocusGoal) return [
      { name:'L-тирозин', id:'tyrosine', dose:`${(3*multiplier).toFixed(1)}`, unit:'г', note:'За 30 мин до. Дофамин/норадреналин', mg:Math.round(3000*multiplier) },
      { name:'АЦЛ-карнитин', id:'alcar', dose:'1.5', unit:'г', note:'За 30 мин до. Ацетилхолин', mg:1500 },
      { name:'Кордицепс', id:'cordyceps', dose:'2', unit:'г', note:'За 45 мин до. ATP для мозга', mg:2000 },
      { name:'Родиола розовая', id:'rhodiola', dose:'500', unit:'мг', note:'За 30 мин до. ↓ утомления, ↑ стрессоустойчивость', mg:500 },
      { name:'Кофеин', id:'caffeine', dose:'200', unit:'мг', note:'За 30 мин до. CNS-стимуляция', mg:200 },
      { name:'Цитруллин', id:'citrulline', dose:'4', unit:'г', note:'За 30 мин до. NO для мозгового кровотока', mg:4000 },
      { name:'Таурин', id:'taurine', dose:'2', unit:'г', note:'За 30 мин до. GABA-модуляция, фокус', mg:2000 },
    ];
    if (isEnduranceGoal) return [
      { name:'Кордицепс', id:'cordyceps', dose:'3', unit:'г', note:'За 45 мин до. VO₂max, митохондрии', mg:3000 },
      { name:'Бета-аланин', id:'beta_alanine', dose:'4', unit:'г', note:'За 30 мин до. Карнозин, буфер H⁺', mg:4000 },
      { name:'Родиола розовая', id:'rhodiola', dose:'500', unit:'мг', note:'За 30 мин до. ↓ утомления, ↑ выносливость', mg:500 },
      { name:'Цитруллин', id:'citrulline', dose:'6', unit:'г', note:'За 45 мин до. NO, кровоток', mg:6000 },
      { name:'Таурин', id:'taurine', dose:`${(2*multiplier).toFixed(1)}`, unit:'г', note:'За 30 мин до. Осморегуляция, буфер', mg:Math.round(2000*multiplier) },
      { name:'L-карнитин', id:'l_carnitine', dose:'1.5', unit:'г', note:'За 45 мин до. Транспорт жирных кислот', mg:1500 },
      { name:'Глицерол', id:'glycerol', dose:`${(4*multiplier).toFixed(1)}`, unit:'г', note:'За 60 мин до. Гипергидратация', mg:Math.round(4000*multiplier) },
    ];
    if (isRecoveryGoal) return [
      { name:'Креатин', id:'creatine', dose:'5', unit:'г', note:'За 30 мин до. Восстановление АТФ', mg:5000 },
      { name:'Цитруллин', id:'citrulline', dose:'4', unit:'г', note:'За 30 мин до. NO, кровоток к мышцам', mg:4000 },
      { name:'Родиола розовая', id:'rhodiola', dose:'500', unit:'мг', note:'За 30 мин до. Адаптоген', mg:500 },
      { name:'Таурин', id:'taurine', dose:'2', unit:'г', note:'За 30 мин до. Осморегуляция', mg:2000 },
      { name:'Ашваганда', id:'ashwagandha', dose:'600', unit:'мг', note:'За 45 мин до. ↓ кортизол', mg:600 },
    ];
    if (isHIIT) return [
      { name:'Кофеин', id:'caffeine', dose:'200', unit:'мг', note:'За 30 мин до. CNS-активация для взрывных усилий', mg:200 },
      { name:'Бета-аланин', id:'beta_alanine', dose:'4', unit:'г', note:'За 30 мин до. Буфер H⁺ для анаэробной работы', mg:4000 },
      { name:'Креатин', id:'creatine', dose:'5', unit:'г', note:'За 30 мин до. АТФ для интервалов', mg:5000 },
      { name:'Цитруллин', id:'citrulline', dose:'6', unit:'г', note:'За 45 мин до. NO для кровотока', mg:6000 },
      { name:'Таурин', id:'taurine', dose:'2', unit:'г', note:'За 30 мин до. Осморегуляция, Ca²⁺-модуляция', mg:2000 },
    ];
    if (isMMA) return [
      { name:'Креатин', id:'creatine', dose:'5', unit:'г', note:'За 30 мин до. Взрывная сила', mg:5000 },
      { name:'Кофеин', id:'caffeine', dose:'200', unit:'мг', note:'За 30 мин до. CNS-ready без перестимуляции', mg:200 },
      { name:'Бета-аланин', id:'beta_alanine', dose:'4', unit:'г', note:'За 30 мин до. Буфер H⁺', mg:4000 },
      { name:'L-тирозин', id:'tyrosine', dose:'2', unit:'г', note:'За 30 мин до. CNS-фокус, дофамин', mg:2000 },
      { name:'Цитруллин', id:'citrulline', dose:'6', unit:'г', note:'За 45 мин до. NO для кровотока', mg:6000 },
      { name:'АЦЛ-карнитин', id:'alcar', dose:'1.5', unit:'г', note:'За 30 мин до. Ацетилхолин, защита мозга', mg:1500 },
      { name:'Таурин', id:'taurine', dose:'2', unit:'г', note:'За 30 мин до. Нейромодуляция, GABA', mg:2000 },
      { name:'Родиола розовая', id:'rhodiola', dose:'500', unit:'мг', note:'За 30 мин до. Адаптоген, ↓ утомления ЦНС', mg:500 },
    ];
    if (isSprint) return [
      { name:'Креатин', id:'creatine', dose:'8', unit:'г', note:'За 45 мин до. Максимум фосфокреатина', mg:8000 },
      { name:'Кофеин', id:'caffeine', dose:'250', unit:'мг', note:'За 30 мин до. CNS-активация', mg:250 },
      { name:'Бета-аланин', id:'beta_alanine', dose:'4', unit:'г', note:'За 30 мин до. Буфер H⁺', mg:4000 },
      { name:'Цитруллин', id:'citrulline', dose:'8', unit:'г', note:'За 45 мин до. NO для кровотока', mg:8000 },
      { name:'Кордицепс', id:'cordyceps', dose:'3', unit:'г', note:'За 45 мин до. ATP-регенерация', mg:3000 },
      { name:'Таурин', id:'taurine', dose:'2', unit:'г', note:'За 30 мин до. Ca²⁺-модуляция, осморегуляция', mg:2000 },
      { name:'Магний', id:'magnesium', dose:'400', unit:'мг', note:'За 45 мин до. Нейромышечная передача', mg:400 },
    ];
    if (isPostComp) return [
      { name:'Ашваганда KSM-66', id:'ashwagandha', dose:'600', unit:'мг', note:'За 45 мин до. ↓ кортизол, адаптоген', mg:600 },
      { name:'Магний', id:'magnesium', dose:'400', unit:'мг', note:'За 30 мин до. ↓ кортизол, сон', mg:400 },
      { name:'Родиола розовая', id:'rhodiola', dose:'500', unit:'мг', note:'За 30 мин до. ↓ утомления ЦНС', mg:500 },
    ];
    // pump / crossfit / fallback → pump default
    return [
      { name:'Цитруллин (малат)', id:'citrulline', dose:mixUnit(Math.min(8000,6000*multiplier)), unit:'г', note:'За 30-45 мин до. NO-бустер, пампинг', mg:Math.round(Math.min(8000,6000*multiplier)) },
      { name:'Бета-аланин', id:'beta_alanine', dose:'3.2', unit:'г', note:'За 30 мин до. Буфер молочной кислоты', mg:3200 },
      { name:'L-тирозин', id:'tyrosine', dose:mixUnit(2000*multiplier), unit:mixSuffix(2000*multiplier), note:'За 30 мин до. Фокус, дофамин', mg:Math.round(2000*multiplier) },
      { name:'Креатин', id:'creatine', dose:mixUnit(5000*multiplier), unit:mixSuffix(5000*multiplier), note:'За 30 мин до. АТФ, взрывная сила', mg:Math.round(5000*multiplier) },
      { name:'Таурин', id:'taurine', dose:mixUnit(2000*multiplier), unit:mixSuffix(2000*multiplier), note:'За 30 мин до. Осморегуляция, пампинг', mg:Math.round(2000*multiplier) },
      { name:'АЦЛ-карнитин', id:'alcar', dose:'1.5', unit:'г', note:'За 30 мин до. Ацетилхолин, митохондрии', mg:1500 },
      { name:'Глицерол', id:'glycerol', dose:`${(3*multiplier).toFixed(1)}`, unit:'г', note:'За 60 мин до. Гипергидратация, венозный пампинг', mg:Math.round(3000*multiplier) },
      { name:'Родиола розовая', id:'rhodiola', dose:'500', unit:'мг', note:'За 30 мин до. Адаптоген, снижение утомления', mg:500 },
      { name:'Кордицепс', id:'cordyceps', dose:'2', unit:'г', note:'За 45 мин до. ATP, выносливость', mg:2000 },
      { name:'Тонгкат Али 200:1', id:'tongkat_ali', dose:'400', unit:'мг', note:'За 30 мин до. Тестостерон, энергия', mg:400 },
    ];
  }

  // ── INTRA ──
  if (timing === 'intra') {
    if (isPL || isStrengthGoal) return [
      { name:'HBCD', id:'hbcd', dose:`${Math.round(30*durHrs)}`, unit:'г', note:'Каждые 20 мин. Быстрый углевод для мощности', mg:Math.round(30000*durHrs) },
      { name:'EAA (2:1:1)', id:'eaa', dose:mixUnit(10000*multiplier), unit:'г', note:'Каждые 30 мин. Анти-катаболизм', mg:Math.round(10000*multiplier) },
      { name:'L-глютамин', id:'glutamine', dose:'5', unit:'г', note:'Каждые 30 мин. ЖКТ, иммунитет', mg:5000 },
      { name:'Электролиты (Na/K/Mg)', id:'electrolyte', dose:'1.5', unit:'г/л', note:'Каждые 15-20 мин. Гидратация', mg:Math.round(1500*durHrs) },
      { name:'Таурин', id:'taurine', dose:'2', unit:'г', note:'Каждые 30 мин. Осморегуляция', mg:2000 },
      { name:'Креатин', id:'creatine', dose:'3', unit:'г', note:'Приём. Поддержка АТФ', mg:3000 },
      { name:'Кордицепс', id:'cordyceps', dose:'2', unit:'г', note:'Однократно. Выносливость для многоповторов', mg:2000 },
    ];
    if (isEnduranceGoal || isCF) return [
      { name:'HBCD', id:'hbcd', dose:`${Math.round(50*durHrs)}`, unit:'г', note:'Каждые 15 мин. Много углеводов для длительной работы', mg:Math.round(50000*durHrs) },
      { name:'EAA (2:1:1)', id:'eaa', dose:`${(15*multiplier).toFixed(0)}`, unit:'г', note:'Каждые 30 мин. Максимальный анти-катаболизм', mg:Math.round(15000*multiplier) },
      { name:'L-глютамин', id:'glutamine', dose:'5', unit:'г', note:'Каждые 30 мин. ЖКТ, иммунитет', mg:5000 },
      { name:'Электролиты (Na/K/Mg)', id:'electrolyte', dose:'2', unit:'г/л', note:'Каждые 15 мин. Гидратация + соль', mg:Math.round(2000*durHrs) },
      { name:'L-карнитин', id:'l_carnitine', dose:'1', unit:'г', note:'Каждые 30 мин. Транспорт жирных кислот', mg:1000 },
      { name:'Таурин', id:'taurine', dose:'2', unit:'г', note:'Каждые 30 мин. Осморегуляция', mg:2000 },
      { name:'Кордицепс', id:'cordyceps', dose:'3', unit:'г', note:'Однократно. VO₂max', mg:3000 },
      { name:'Глицерол', id:'glycerol', dose:'3', unit:'г', note:'В изотоник. Гипергидратация', mg:3000 },
    ];
    if (isPumpGoal) return [
      { name:'Глицерол', id:'glycerol', dose:'5', unit:'г', note:'В изотоник. Венозный пампинг', mg:5000 },
      { name:'Цитруллин', id:'citrulline', dose:'3', unit:'г', note:'Каждые 30 мин. NO для пампа', mg:3000 },
      { name:'Таурин', id:'taurine', dose:'2', unit:'г', note:'Каждые 30 мин. Осморегуляция', mg:2000 },
      { name:'Электролиты (Na/K/Mg)', id:'electrolyte', dose:'1.5', unit:'г/л', note:'Каждые 15-20 мин. Гидратация', mg:Math.round(1500*durHrs) },
      { name:'EAA (2:1:1)', id:'eaa', dose:'10', unit:'г', note:'Каждые 30 мин. Анти-катаболизм', mg:10000 },
      { name:'L-глютамин', id:'glutamine', dose:'5', unit:'г', note:'Каждые 30 мин. ЖКТ', mg:5000 },
      { name:'Креатин', id:'creatine', dose:'3', unit:'г', note:'Приём. Поддержка АТФ', mg:3000 },
    ];
    if (isHIIT) return [
      { name:'HBCD', id:'hbcd', dose:`${Math.round(30*durHrs)}`, unit:'г', note:'Между спринтами — быстрый углевод', mg:Math.round(30000*durHrs) },
      { name:'Электролиты (Na/K/Mg)', id:'electrolyte', dose:'1.5', unit:'г/л', note:'Каждые 15 мин. Гидратация', mg:Math.round(1500*durHrs) },
      { name:'Глицерол', id:'glycerol', dose:'3', unit:'г', note:'В изотоник. Гипергидратация', mg:3000 },
    ];
    if (isMMA) return [
      { name:'HBCD', id:'hbcd', dose:`${Math.round(40*durHrs)}`, unit:'г', note:'Углеводы между раундами', mg:Math.round(40000*durHrs) },
      { name:'EAA (2:1:1)', id:'eaa', dose:'10', unit:'г', note:'Каждые 30 мин. Анти-катаболизм', mg:10000 },
      { name:'Электролиты (Na/K/Mg)', id:'electrolyte', dose:'2', unit:'г/л', note:'Каждые 15 мин. Гидратация', mg:Math.round(2000*durHrs) },
      { name:'Глицерол', id:'glycerol', dose:'3', unit:'г', note:'В изотоник. Гипергидратация', mg:3000 },
    ];
    if (isSprint) return [
      { name:'Электролиты (Na/K/Mg)', id:'electrolyte', dose:'1', unit:'г/л', note:'Каждые 15 мин. Лёгкая гидратация', mg:Math.round(1000*durHrs) },
      { name:'Глицерол', id:'glycerol', dose:'3', unit:'г', note:'В изотоник. Гипергидратация', mg:3000 },
    ];
    // recovery / focus / post_comp / fallback
    return [
      { name:'HBCD', id:'hbcd', dose:`${Math.round(20*durHrs)}`, unit:'г', note:'Каждые 20 мин. Лёгкий углевод', mg:Math.round(20000*durHrs) },
      { name:'EAA (2:1:1)', id:'eaa', dose:'8', unit:'г', note:'Каждые 30 мин. Анти-катаболизм', mg:8000 },
      { name:'L-глютамин', id:'glutamine', dose:'5', unit:'г', note:'Каждые 30 мин. ЖКТ', mg:5000 },
      { name:'Электролиты (Na/K/Mg)', id:'electrolyte', dose:'1', unit:'г/л', note:'Каждые 20 мин. Гидратация', mg:1000 },
      { name:'Таурин', id:'taurine', dose:'2', unit:'г', note:'Каждые 30 мин. Осморегуляция', mg:2000 },
    ];
  }

  // ── POST ──
  if (timing === 'post') {
    if (isRecoveryGoal || isPostComp) return [
      { name:'Сывороточный протеин', id:'protein', dose:`${(0.35*bw).toFixed(0)}`, unit:'г', note:'Сразу после. Быстрое усвоение', mg:Math.round(0.35*bw*1000) },
      { name:'Креатин моногидрат', id:'creatine', dose:'5', unit:'г', note:'Сразу после. Креатин-фосфат', mg:5000 },
      { name:'L-глютамин', id:'glutamine', dose:`${(5*multiplier).toFixed(0)}`, unit:'г', note:'Сразу после. Восстановление', mg:Math.round(5000*multiplier) },
      { name:'NAC', id:'nac', dose:'1.2', unit:'г', note:'Сразу после. Глутатион, детоксикация', mg:1200 },
      { name:'Ашваганда KSM-66', id:'ashwagandha', dose:'600', unit:'мг', note:'Сразу после. ↓ кортизол', mg:600 },
      { name:'Куркумин (с пиперином)', id:'curcumin', dose:'800', unit:'мг', note:'Сразу после. ↓ воспаление', mg:800 },
      { name:'Омега-3', id:'omega3', dose:'2', unit:'г', note:'Сразу после. Противовоспалительное', mg:2000 },
      { name:'Цинк + Магний (ZMA)', id:'zinc', dose:'30+450', unit:'мг', note:'Перед сном. Сон, тестостерон', mg:480 },
      { name:'Витамин C', id:'vitamin_c', dose:'1000', unit:'мг', note:'Сразу после. Антиоксидант, кортизол', mg:1000 },
    ];
    if (isStrengthGoal) return [
      { name:'Сывороточный протеин', id:'protein', dose:`${(0.45*bw).toFixed(0)}`, unit:'г', note:'Сразу после. MPS, синтез белка', mg:Math.round(0.45*bw*1000) },
      { name:'Креатин моногидрат', id:'creatine', dose:'5', unit:'г', note:'Сразу после. Креатин-фосфат', mg:5000 },
      { name:'L-глютамин', id:'glutamine', dose:`${(5*multiplier).toFixed(0)}`, unit:'г', note:'Сразу после. Восстановление', mg:Math.round(5000*multiplier) },
      { name:'Экдистерон', id:'ecdysterone', dose:'500', unit:'мг', note:'Сразу после. mTOR, синтез белка', mg:500 },
      { name:'Ашваганда KSM-66', id:'ashwagandha', dose:'600', unit:'мг', note:'Сразу после. ↑ IGF-1', mg:600 },
      { name:'NAC', id:'nac', dose:'1.2', unit:'г', note:'Сразу после. Глутатион', mg:1200 },
      { name:'Омега-3', id:'omega3', dose:'2', unit:'г', note:'Сразу после. Противовоспалительное', mg:2000 },
      { name:'Цинк + Магний (ZMA)', id:'zinc', dose:'30+450', unit:'мг', note:'Перед сном. Тестостерон, сон', mg:480 },
    ];
    if (isMMA) return [
      { name:'Сывороточный протеин', id:'protein', dose:`${(0.4*bw).toFixed(0)}`, unit:'г', note:'Сразу после. MPS', mg:Math.round(0.4*bw*1000) },
      { name:'L-глютамин', id:'glutamine', dose:'10', unit:'г', note:'GABA, восстановление, ЖКТ', mg:10000 },
      { name:'Креатин моногидрат', id:'creatine', dose:'5', unit:'г', note:'Сразу после. Восстановление АТФ', mg:5000 },
      { name:'Омега-3', id:'omega3', dose:'3', unit:'г', note:'Защита мозга, противовоспалительное', mg:3000 },
      { name:'Ашваганда KSM-66', id:'ashwagandha', dose:'600', unit:'мг', note:'↓ кортизол, адаптоген', mg:600 },
      { name:'Куркумин (с пиперином)', id:'curcumin', dose:'800', unit:'мг', note:'NF-kB, системное воспаление', mg:800 },
    ];
    if (isHIIT) return [
      { name:'Сывороточный протеин', id:'protein', dose:`${(0.35*bw).toFixed(0)}`, unit:'г', note:'Сразу после. Быстрое усвоение', mg:Math.round(0.35*bw*1000) },
      { name:'Креатин моногидрат', id:'creatine', dose:'5', unit:'г', note:'Сразу после. Креатин-фосфат', mg:5000 },
      { name:'Омега-3', id:'omega3', dose:'2', unit:'г', note:'Противовоспалительное', mg:2000 },
      { name:'Кордицепс', id:'cordyceps', dose:'2', unit:'г', note:'Восстановление митохондрий', mg:2000 },
    ];
    if (isSprint) return [
      { name:'Сывороточный протеин', id:'protein', dose:`${(0.3*bw).toFixed(0)}`, unit:'г', note:'Сразу после. Быстрое усвоение', mg:Math.round(0.3*bw*1000) },
      { name:'Креатин моногидрат', id:'creatine', dose:'5', unit:'г', note:'Сразу после. Дозагрузка креатина', mg:5000 },
      { name:'HMB', id:'hmb', dose:'3', unit:'г', note:'Анти-катаболизм, ↓ MuRF1', mg:3000 },
      { name:'L-карнитин', id:'l_carnitine', dose:'1', unit:'г', note:'Окисление ЖК, восстановление', mg:1000 },
    ];
    // pump / endurance / focus / crossfit / PL / fallback
    return [
      { name:'Сывороточный протеин', id:'protein', dose:`${(0.4*bw).toFixed(0)}`, unit:'г', note:'Сразу после. Быстрое усвоение', mg:Math.round(0.4*bw*1000) },
      { name:'Креатин моногидрат', id:'creatine', dose:'5', unit:'г', note:'Сразу после. Креатин-фосфат', mg:5000 },
      { name:'L-глютамин', id:'glutamine', dose:mixUnit(5000*multiplier), unit:mixSuffix(5000*multiplier), note:'Сразу после. Восстановление', mg:Math.round(5000*multiplier) },
      { name:'Цинк + Магний (ZMA)', id:'zinc', dose:'30+450', unit:'мг', note:'Перед сном. Тестостерон, сон', mg:480 },
      { name:'Витамин C', id:'vitamin_c', dose:'500', unit:'мг', note:'Сразу после. Антиоксидант', mg:500 },
      { name:'Ашваганда KSM-66', id:'ashwagandha', dose:'600', unit:'мг', note:'Сразу после. Кортизол, анаболизм', mg:600 },
      { name:'Омега-3', id:'omega3', dose:'2', unit:'г', note:'Сразу после. Противовоспалительное', mg:2000 },
      { name:'NAC', id:'nac', dose:'1.2', unit:'г', note:'Сразу после. Глутатион, детоксикация', mg:1200 },
      { name:'Куркумин (с пиперином)', id:'curcumin', dose:'800', unit:'мг', note:'Сразу после. NF-kB, воспаление', mg:800 },
      { name:'Альфа-липоевая кислота', id:'alpha_lipoic', dose:'300', unit:'мг', note:'Сразу после. Nrf2, антиоксидант', mg:300 },
      { name:'L-карнитин', id:'l_carnitine', dose:'1', unit:'г', note:'Сразу после. Восстановление мышц', mg:1000 },
    ];
  }

  return nil;
}

/** Convert a MixTemplate's timing items to MixRenderItem[] with names, notes, and mg. */
export function resolveTemplateItems(items: MixTemplateItem[], multiplier: number, bw: number): MixRenderItem[] {
  return items.map(item => {
    const doseNum = parseFloat(item.dose);
    let mg = doseNum;
    if (item.unit === 'г' || item.unit === 'г/л') mg = doseNum * 1000;
    else if (item.unit === 'мг') mg = doseNum;
    else if (item.unit === 'г/кг') mg = doseNum * bw * 1000;
    mg = Math.round(mg * multiplier);
    const isPerKg = item.unit === 'г/кг';
    let displayDose = item.dose;
    let displayUnit = item.unit;
    if (isPerKg && !item.unit.includes('/')) { /* keep as-is */ }
    // Auto-generate name from id if not provided
    const displayName = item.name || item.id.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
    const displayNote = item.note || `Из шаблона. Доза: ${item.dose}${item.unit}`;
    return { name: displayName, id: item.id, dose: displayDose, unit: displayUnit, note: displayNote, mg };
  });
}

/** Find the default template for a goal (the first template matching the goal). */
export function getDefaultTemplate(goal: string): MixTemplate | undefined {
  return MIX_TEMPLATES.find(t => t.goal === goal);
}

export const MIX_TEMPLATES: MixTemplate[] = [
  {
    id: 'fat_loss', name: '🔥 Жиросжигание (LISS/кардио)', description: 'Сжигание жира с сохранением мышц. Минимум углеводов, акцент на липолиз и энергию из жиров.',
    goal: 'fat_loss', tags: ['Жиросжигание','Кардио'],
    pre: [
      { id:'l_carnitine', dose:'2', unit:'г', note:'За 30 мин. Транспорт ЖК в митохондрии' },
      { id:'caffeine', dose:'250', unit:'мг', note:'За 20 мин. Липолиз + CNS' },
      { id:'cordyceps', dose:'2', unit:'г', note:'За 30 мин. VO₂max, ATP' },
      { id:'green_tea', dose:'500', unit:'мг', note:'За 20 мин. EGCG, термогенез' },
      { id:'tyrosine', dose:'2', unit:'г', note:'За 30 мин. Фокус, дофамин' },
    ],
    intra: [
      { id:'eaa', dose:'10', unit:'г', note:'Каждые 30 мин. Анти-катаболизм' },
      { id:'electrolyte', dose:'1.5', unit:'г/л', note:'Гидратация без калорий' },
    ],
    post: [
      { id:'protein', dose:'0.4', unit:'г/кг', note:'Сразу после. Сохранение мышц' },
      { id:'l_carnitine', dose:'1', unit:'г', note:'Липолиз' },
      { id:'omega3', dose:'2', unit:'г', note:'Противовоспалительное' },
      { id:'cla', dose:'2', unit:'г', note:'Липолиз, анти-катаболизм' },
    ],
  },
  {
    id: 'joint', name: '🦵 Суставы и связки', description: 'Защита хряща, регенерация соединительной ткани. Для профилактики травм на объёмных циклах.',
    goal: 'joint', tags: ['Суставы','Связки','Травмы'],
    pre: [
      { id:'collagen', dose:'15', unit:'г', note:'За 30 мин. Синтез коллагена' },
      { id:'glucosamine', dose:'1500', unit:'мг', note:'За 30 мин. Матрикс хряща' },
      { id:'msm', dose:'3', unit:'г', note:'За 30 мин. Сера для хряща' },
      { id:'vitamin_c', dose:'1000', unit:'мг', note:'За 30 мин. Кофактор коллагена' },
    ],
    intra: [
      { id:'hbcd', dose:'20', unit:'г', note:'Лёгкий углевод для гидратации тканей' },
      { id:'electrolyte', dose:'1.5', unit:'г/л', note:'Гидратация суставной жидкости' },
    ],
    post: [
      { id:'collagen', dose:'15', unit:'г', note:'Сразу после. Матрикс хряща' },
      { id:'vitamin_c', dose:'1', unit:'г', note:'Кофактор коллагена' },
      { id:'curcumin', dose:'800', unit:'мг', note:'NF-kB, воспаление суставов' },
      { id:'omega3', dose:'3', unit:'г', note:'Противовоспалительное для суставов' },
    ],
  },
  {
    id: 'gut', name: '🫀 Здоровье ЖКТ', description: 'Восстановление слизистой, микробиом, детоксикация. Для курсов с пероральными ААС и НПВС.',
    goal: 'gut', tags: ['ЖКТ','Микробиом','Слизистая'],
    pre: [
      { id:'glutamine', dose:'5', unit:'г', note:'За 20 мин. Энергия для энтероцитов' },
      { id:'zinc', dose:'25', unit:'мг', note:'За 20 мин. Восстановление слизистой' },
      { id:'probiotic', dose:'1', unit:'капс', note:'За 20 мин. L. rhamnosus, B. lactis' },
    ],
    intra: [
      { id:'glutamine', dose:'5', unit:'г', note:'Энергия энтероцитов' },
      { id:'electrolyte', dose:'1', unit:'г/л', note:'Лёгкий изотоник без сахара' },
    ],
    post: [
      { id:'glutamine', dose:'10', unit:'г', note:'Восстановление ворсинок' },
      { id:'zinc', dose:'25', unit:'мг', note:'Репарация слизистой' },
      { id:'betaine_hcl', dose:'1', unit:'капс', note:'Поддержка кислотности' },
      { id:'vitamin_c', dose:'1', unit:'г', note:'Антиоксидант, иммунитет ЖКТ' },
      { id:'bone_broth', dose:'200', unit:'мл', note:'Коллаген, глицин для слизистой' },
    ],
  },
  {
    id: 'sleep', name: '💤 Сон и восстановление', description: 'Глубокий сон, кортизол ↓, GH ↑, GABA-эргическая поддержка. Вечерний приём за 30-60 мин до сна.',
    goal: 'sleep', tags: ['Сон','Восстановление','Кортизол'],
    pre: [
      { id:'magnesium', dose:'400', unit:'мг', note:'Глицинат Mg за 30 мин. GABA, сон' },
      { id:'glycine', dose:'3', unit:'г', note:'За 30 мин. Нейромедиатор, ↓ темп. тела' },
      { id:'l_theanine', dose:'200', unit:'мг', note:'За 30 мин. Альфа-волны, релакс' },
      { id:'melatonin', dose:'3', unit:'мг', note:'За 20 мин. Циркадный ритм' },
      { id:'gaba', dose:'500', unit:'мг', note:'За 20 мин. GABA-рецепторы' },
    ],
    intra: [],
    post: [
      { id:'magnesium', dose:'400', unit:'мг', note:'Глицинат Mg — сон' },
      { id:'glycine', dose:'3', unit:'г', note:'Глицин — качество сна' },
      { id:'ashwagandha', dose:'600', unit:'мг', note:'↓ кортизол, ↑ GH' },
      { id:'zma', dose:'1', unit:'порц', note:'Цинк + Mg + B6 — тестостерон + сон' },
      { id:'melatonin', dose:'3', unit:'мг', note:'Циркадный ритм' },
    ],
  },
  {
    id: 'hydration', name: '💧 Гипергидратация', description: 'Максимальная гидратация для венозного пампинга, терморегуляции и профилактики судорог.',
    goal: 'hydration', tags: ['Гидратация','Электролиты','Памп'],
    pre: [
      { id:'glycerol', dose:'5', unit:'г', note:'За 60 мин. Гипергидратация' },
      { id:'electrolyte', dose:'1.5', unit:'г/л', note:'За 60 мин. Na/K/Mg' },
      { id:'taurine', dose:'2', unit:'г', note:'За 30 мин. Осморегуляция' },
      { id:'citrulline', dose:'6', unit:'г', note:'За 45 мин. NO + гидратация сосудов' },
    ],
    intra: [
      { id:'electrolyte', dose:'2', unit:'г/л', note:'Каждые 15 мин. Макс гидратация' },
      { id:'glycerol', dose:'3', unit:'г', note:'В изотоник. Удержание воды' },
      { id:'hbcd', dose:'20', unit:'г', note:'Лёгкий углевод для удержания воды' },
    ],
    post: [
      { id:'glycerol', dose:'5', unit:'г', note:'Догидратация' },
      { id:'electrolyte', dose:'2', unit:'г/л', note:'Восполнение солей' },
      { id:'taurine', dose:'2', unit:'г', note:'Осморегуляция' },
    ],
  },
  {
    id: 'antiinflammatory', name: '🧪 Противовоспалительный', description: 'Системное ↓ воспаления. Для восстановления после травм, при хроническом воспалении на курсе.',
    goal: 'recovery', tags: ['Воспаление','Иммунитет','Восстановление'],
    pre: [
      { id:'curcumin', dose:'800', unit:'мг', note:'С пиперином. NF-kB, ↓ IL-6' },
      { id:'omega3', dose:'3', unit:'г', note:'Высокая доза. Resolvin E1' },
      { id:'bromelain', dose:'500', unit:'мг', note:'Протеаза, ↓ отёк' },
      { id:'vitamin_c', dose:'1', unit:'г', note:'Антиоксидант' },
    ],
    intra: [
      { id:'electrolyte', dose:'1.5', unit:'г/л', note:'Гидратация' },
      { id:'hbcd', dose:'20', unit:'г', note:'Лёгкий углевод' },
    ],
    post: [
      { id:'curcumin', dose:'800', unit:'мг', note:'NF-kB, ↓ воспаление' },
      { id:'omega3', dose:'3', unit:'г', note:'Resolvin E1, ↓ IL-6' },
      { id:'bromelain', dose:'500', unit:'мг', note:'Протеаза, ↓ фибрин' },
      { id:'vitamin_c', dose:'1', unit:'г', note:'Антиоксидант' },
    ],
  },
  {
    id: 'immunity', name: '🛡️ Иммунитет', description: 'Поддержка иммунной системы на курсе. NK-клетки, антиоксиданты, адаптогены.',
    goal: 'recovery', tags: ['Иммунитет','Адаптогены','Антиоксиданты'],
    pre: [
      { id:'vitamin_c', dose:'2', unit:'г', note:'Высокая доза за 30 мин' },
      { id:'zinc', dose:'25', unit:'мг', note:'Кофактор иммунитета' },
      { id:'astragalus', dose:'500', unit:'мг', note:'Адаптоген, NK-клетки' },
      { id:'echinacea', dose:'400', unit:'мг', note:'За 30 мин. Иммуномодулятор' },
    ],
    intra: [
      { id:'electrolyte', dose:'1.5', unit:'г/л', note:'Гидратация' },
      { id:'glutamine', dose:'5', unit:'г', note:'Иммунитет ЖКТ' },
    ],
    post: [
      { id:'vitamin_c', dose:'2', unit:'г', note:'Антиоксидант' },
      { id:'zinc', dose:'25', unit:'мг', note:'Иммунитет' },
      { id:'vitamin_d3', dose:'2000', unit:'МЕ', note:'Иммуномодулятор' },
      { id:'probiotic', dose:'1', unit:'капс', note:'Микробиом → иммунитет' },
    ],
  },
];

// ── MIX RECIPE ENGINE ──
// Вместо жёсткой привязки drug->вещества — система рецептов, которые подбирают
// коктейль по активным препаратам, профилю и цели. Рецепты конкурируют по synergyScore,
// ротируются при равном счёт, а пользователь может заменять/удалять вещества.

export interface MixRecipeItem {
  id: string;
  dose: string;
  unit: string;
  note: string;
  mg: number;
  timing: 'pre' | 'intra' | 'post';
  alternatives?: { id: string; dose: string; unit: string; note: string }[];
}

export interface MixRecipe {
  id: string;
  name: string;
  description: string;
  condition: (activeDrugs: { id: string; dose?: number; timing?: string }[], profile: MixProfile) => boolean;
  build: (activeDrugs: { id: string; dose?: number; timing?: string }[], profile: MixProfile) => MixRecipeItem[];
  synergyScore: number;
  synergyNote: string;
}

function activeDrugsFromProfile(p: MixProfile): { id: string; dose?: number; timing?: string }[] {
  const arr: { id: string; dose?: number; timing?: string }[] = [];
  if (p.drugs.insulin) arr.push({ id:'insulin', dose:p.drugs.insulinDose, timing:p.drugs.insulinTiming });
  if (p.drugs.igf) arr.push({ id:'igf', dose:p.drugs.igfDose, timing:p.drugs.igfTiming });
  if (p.drugs.mgf) arr.push({ id:'mgf', dose:p.drugs.mgfDose, timing:p.drugs.mgfTiming });
  if (p.drugs.gh) arr.push({ id:'gh', dose:p.drugs.ghDose, timing:p.drugs.ghTiming });
  if (p.drugs.glp1) arr.push({ id:'glp1' });
  return arr;
}

export const MIX_RECIPES: MixRecipe[] = [
  // ── Комбинированные ──
  {
    id: 'max_anabolic',
    name: 'Максимальный анаболизм (Insulin + IGF-1)',
    description: 'Инсулин открывает клетки, IGF-1 запускает MPS. Декстроза + EAA + креатин.',
    condition: (d) => d.filter(x=>['insulin','igf'].includes(x.id)).length === 2,
    build: (d, p) => {
      const isPost = d.find(x=>x.id==='insulin')?.timing === 'post';
      const bw = p.weightKg;
      const items: MixRecipeItem[] = [];
      if (isPost) {
        items.push({ id:'dextrose', dose:`${Math.round(bw*0.8)}`, unit:'г', note:'Закрыть окно инсулина + IGF-1', mg:Math.round(bw*0.8*1000), timing:'post' });
        items.push({ id:'eaa', dose:`${Math.round(bw*0.3)}`, unit:'г', note:'Инсулин ↑ усвоение EAA, IGF-1 ↑ MPS — двойной анаболизм', mg:Math.round(bw*0.3*1000), timing:'post', alternatives:[{ id:'whey_hydro', dose:`${Math.round(bw*0.5)}`, unit:'г', note:'Сывороточный гидролизат — быстрее EAA, но + калории' }] });
        items.push({ id:'creatine', dose:'5', unit:'г', note:'Транспорт креатина с инсулином +30%', mg:5000, timing:'post', alternatives:[{ id:'hmb', dose:'3', unit:'г', note:'HMB — анти-катаболизм' }] });
      } else {
        items.push({ id:'dextrose', dose:`${Math.round(bw*0.5)}`, unit:'г', note:'Профилактика гипогликемии', mg:Math.round(bw*0.5*1000), timing:'pre' });
        items.push({ id:'eaa', dose:`${Math.round(bw*0.2)}`, unit:'г', note:'IGF-1 + EAA до тренировки', mg:Math.round(bw*0.2*1000), timing:'pre' });
        items.push({ id:'creatine', dose:'5', unit:'г', note:'Креатин до — загрузка', mg:5000, timing:'pre' });
      }
      items.push({ id:'glutamine', dose:'10', unit:'г', note:'IGF-1 ↑ пролиферацию энтероцитов', mg:10000, timing:'post' });
      return items;
    },
    synergyScore: 95,
    synergyNote: 'Инсулин ↑ транспорт субстратов, IGF-1 ↑ синтез белка — синергия первого порядка.',
  },
  {
    id: 'gh_mgf_regen',
    name: 'Регенерация + Сателлиты (GH + MGF)',
    description: 'GH ↑ липолиз и печёночный IGF-1, MGF ↑ сателлитные клетки локально.',
    condition: (d) => d.filter(x=>['gh','mgf'].includes(x.id)).length === 2,
    build: (d, p) => {
      const bw = p.weightKg;
      return [
        { id:'glutamine', dose:'10', unit:'г', note:'МГФ ↑ сателлитные — глутамин для деления', mg:10000, timing:'post', alternatives:[{ id:'glycine', dose:'5', unit:'г', note:'Глицин — для коллагена' }] },
        { id:'hmb', dose:'3', unit:'г', note:'МГФ + HMB = анти-катаболизм + регенерация', mg:3000, timing:'post', alternatives:[{ id:'creatine', dose:'5', unit:'г', note:'Креатин — если цель сила' }] },
        { id:'protein', dose:`${Math.round(bw*0.5)}`, unit:'г', note:'Белок для регенерации', mg:Math.round(bw*0.5*1000), timing:'post' },
        { id:'l_carnitine', dose:'2', unit:'г', note:'GH ↑ липолиз — транспорт ЖК', mg:2000, timing:'intra', alternatives:[{ id:'glycerol', dose:'3', unit:'г', note:'Глицерол — гидратация' }] },
        { id:'cordyceps', dose:'3', unit:'г', note:'GH + кордицепс = митохондриальный биогенез', mg:3000, timing:'pre' },
        { id:'electrolyte', dose:'1.5', unit:'г/л', note:'GH задерживает натрий — коррекция', mg:1500, timing:'intra' },
      ];
    },
    synergyScore: 90,
    synergyNote: 'GH ↑ системный IGF-1, MGF ↑ локальную регенерацию — полный охват.',
  },
  {
    id: 'insulin_mgf_pump',
    name: 'Гликоген + Сателлиты (Insulin + MGF)',
    description: 'Инсулин ↑ гликоген и транспорт, MGF ↑ регенерацию волокон.',
    condition: (d) => d.filter(x=>['insulin','mgf'].includes(x.id)).length === 2,
    build: (d, p) => {
      const bw = p.weightKg;
      return [
        { id:'dextrose', dose:`${Math.round(bw*0.6)}`, unit:'г', note:'Инсулин + MGF — гликоген + регенерация', mg:Math.round(bw*0.6*1000), timing:'post', alternatives:[{ id:'hbcd', dose:`${Math.round(bw*0.7)}`, unit:'г', note:'HBCD — медленнее, менее инсулиновый пик' }] },
        { id:'creatine', dose:'5', unit:'г', note:'Транспорт креатина +30%', mg:5000, timing:'post' },
        { id:'glutamine', dose:'10', unit:'г', note:'MGF ↑ сателлитные', mg:10000, timing:'post' },
        { id:'hmb', dose:'3', unit:'г', note:'MGF + HMB', mg:3000, timing:'post' },
      ];
    },
    synergyScore: 85,
    synergyNote: 'Инсулин — субстраты, MGF — сателлиты. Два независимых пути роста.',
  },
  {
    id: 'full_anabolic_cocktail',
    name: 'Полный анаболический коктейль (Insulin + IGF + GH + MGF)',
    description: 'Все 4 препарата — максимальный анаболизм, регенерация и сателлиты.',
    condition: (d) => d.filter(x=>['insulin','igf','gh','mgf'].includes(x.id)).length === 4,
    build: (d, p) => {
      const bw = p.weightKg;
      const isPost = d.find(x=>x.id==='insulin')?.timing === 'post';
      const items: MixRecipeItem[] = [
        { id:'dextrose', dose:`${Math.round(bw*0.8)}`, unit:'г', note:'Инсулин+IGF+GH — закрыть все окна', mg:Math.round(bw*0.8*1000), timing:'post' },
        { id:'eaa', dose:`${Math.round(bw*0.3)}`, unit:'г', note:'Субстрат для MPS (IGF) + транспорт (инсулин)', mg:Math.round(bw*0.3*1000), timing:'post' },
        { id:'creatine', dose:'5', unit:'г', note:'Транспорт +30% + контракт. функция (GH)', mg:5000, timing:'post' },
        { id:'glutamine', dose:'10', unit:'г', note:'MGF ↑ сателлиты + GH ↑ IgA', mg:10000, timing:'post' },
        { id:'hmb', dose:'3', unit:'г', note:'Анти-катаболизм (MGF + GH)', mg:3000, timing:'post' },
        { id:'protein', dose:`${Math.round(bw*0.5)}`, unit:'г', note:'Белок для всех 4 препаратов', mg:Math.round(bw*0.5*1000), timing:'post' },
        { id:'l_carnitine', dose:'2', unit:'г', note:'GH ↑ липолиз — транспорт ЖК', mg:2000, timing:'intra' },
        { id:'electrolyte', dose:'1', unit:'г/л', note:'GH задерживает натрий', mg:1000, timing:'intra' },
        { id:'cordyceps', dose:'3', unit:'г', note:'GH + кордицепс = митохондриальный биогенез', mg:3000, timing:'pre' },
      ];
      if (!isPost) items.push({ id:'dextrose', dose:`${Math.round(bw*0.5)}`, unit:'г', note:'Инсулин до — гипогликемия', mg:Math.round(bw*0.5*1000), timing:'pre' });
      return items;
    },
    synergyScore: 98,
    synergyNote: 'Максимальная синергия всех 4 препаратов: анаболизм, регенерация, сателлиты.',
  },
  // ── Insulin + GH (конфликт) ──
  {
    id: 'insulin_gh_compromise',
    name: 'Insulin + GH (компромисс)',
    description: 'GH ↑ контринсулярные гормоны, инсулин ↓ глюкозу. Баланс и коррекция.',
    condition: (d) => d.filter(x=>['insulin','gh'].includes(x.id)).length === 2,
    build: (d, p) => {
      const bw = p.weightKg;
      return [
        { id:'dextrose', dose:`${Math.round(bw*0.7)}`, unit:'г', note:'Выше — GH ↑ глюконеогенез', mg:Math.round(bw*0.7*1000), timing:'post', alternatives:[{ id:'hbcd', dose:`${Math.round(bw*0.8)}`, unit:'г', note:'HBCD — плавный подъём глюкозы' }] },
        { id:'eaa', dose:`${Math.round(bw*0.2)}`, unit:'г', note:'Субстрат для GH-зависимого IGF-1', mg:Math.round(bw*0.2*1000), timing:'post' },
        { id:'creatine', dose:'5', unit:'г', note:'GH + креатин = сила', mg:5000, timing:'post' },
        { id:'l_carnitine', dose:'2', unit:'г', note:'GH ↑ липолиз', mg:2000, timing:'intra' },
        { id:'electrolyte', dose:'1.5', unit:'г/л', note:'GH задерж. Na, инсулин ↓ K — коррекция', mg:1500, timing:'intra' },
      ];
    },
    synergyScore: 70,
    synergyNote: 'GH контринсулярный — выше глюкоза + электролиты.',
  },
  // ── Одиночные ──
  {
    id: 'insulin_only',
    name: 'Инсулин: субстратный коктейль',
    description: 'Инсулин — транспорт субстратов. Декстроза + креатин + EAA.',
    condition: (d) => d.filter(x=>x.id==='insulin').length === 1 && d.length === 1,
    build: (d, p) => {
      const isPost = d.find(x=>x.id==='insulin')?.timing === 'post';
      const bw = p.weightKg;
      return isPost ? [
        { id:'dextrose', dose:`${Math.round(bw*0.8)}`, unit:'г', note:'Закрыть инсулиновое окно', mg:Math.round(bw*0.8*1000), timing:'post', alternatives:[{ id:'waxy_maize', dose:`${Math.round(bw*0.9)}`, unit:'г', note:'Восковая кукуруза — спокойный инс. ответ' }] },
        { id:'creatine', dose:'5', unit:'г', note:'Транспорт +30%', mg:5000, timing:'post', alternatives:[{ id:'hmb', dose:'3', unit:'г', note:'HMB — анти-катаболизм' }] },
        { id:'eaa', dose:`${Math.round(bw*0.2)}`, unit:'г', note:'MPS с инсулином', mg:Math.round(bw*0.2*1000), timing:'post' },
      ] : [
        { id:'dextrose', dose:`${Math.round(bw*0.5)}`, unit:'г', note:'Профилактика гипогликемии', mg:Math.round(bw*0.5*1000), timing:'pre' },
        { id:'creatine', dose:'5', unit:'г', note:'Загрузка до', mg:5000, timing:'pre' },
      ];
    },
    synergyScore: 80,
    synergyNote: 'Инсулин — ключевой анаболический гормон: транспорт глюкозы, аминокислот, креатина.',
  },
  {
    id: 'igf_only',
    name: 'IGF-1: анаболический коктейль',
    description: 'IGF-1 ↑ MPS и пролиферацию сателлитов. EAA + глютамин + белок.',
    condition: (d) => d.filter(x=>x.id==='igf').length === 1 && d.length === 1,
    build: (d, p) => {
      const bw = p.weightKg;
      return [
        { id:'eaa', dose:`${Math.round(bw*0.25)}`, unit:'г', note:'Субстрат для IGF-1-зависимого MPS', mg:Math.round(bw*0.25*1000), timing:'intra', alternatives:[{ id:'whey_hydro', dose:`${Math.round(bw*0.4)}`, unit:'г', note:'Гидролизат сыворотки' }] },
        { id:'glutamine', dose:'10', unit:'г', note:'IGF-1 ↑ пролиферацию энтероцитов', mg:10000, timing:'post' },
        { id:'protein', dose:`${Math.round(bw*0.5)}`, unit:'г', note:'IGF-1 требует белка для синтеза', mg:Math.round(bw*0.5*1000), timing:'post' },
      ];
    },
    synergyScore: 82,
    synergyNote: 'IGF-1 запускает каскад синтеза белка — нужны субстраты.',
  },
  {
    id: 'mgf_only',
    name: 'MGF: сателлитный коктейль',
    description: 'МГФ активирует сателлитные клетки. Глутамин + HMB + белок.',
    condition: (d) => d.filter(x=>x.id==='mgf').length === 1 && d.length === 1,
    build: (d, p) => {
      const bw = p.weightKg;
      return [
        { id:'glutamine', dose:'10', unit:'г', note:'МГФ ↑ сателлитные — глутамин субстрат', mg:10000, timing:'post', alternatives:[{ id:'glycine', dose:'5', unit:'г', note:'Глицин — коллаген + сателлиты' }] },
        { id:'hmb', dose:'3', unit:'г', note:'Анти-катаболизм + синергия с MGF', mg:3000, timing:'post' },
        { id:'protein', dose:`${Math.round(bw*0.5)}`, unit:'г', note:'Белок для регенерации', mg:Math.round(bw*0.5*1000), timing:'post' },
      ];
    },
    synergyScore: 78,
    synergyNote: 'MGF — локальный фактор роста: сателлиты + анти-катаболизм.',
  },
  {
    id: 'gh_only',
    name: 'GH: липолиз + митохондрии',
    description: 'GH ↑ липолиз и печёночный IGF-1. L-карнитин + кордицепс + электролиты.',
    condition: (d) => d.filter(x=>x.id==='gh').length === 1 && d.length === 1,
    build: () => [
      { id:'l_carnitine', dose:'2', unit:'г', note:'GH ↑ липолиз — транспорт ЖК', mg:2000, timing:'intra', alternatives:[{ id:'acetyl_l_carnitine', dose:'1.5', unit:'г', note:'ALCAR — лучше ГЭБ' }] },
      { id:'cordyceps', dose:'3', unit:'г', note:'Митохондриальный биогенез + GH', mg:3000, timing:'pre' },
      { id:'electrolyte', dose:'1.5', unit:'г/л', note:'GH задерживает натрий', mg:1500, timing:'intra' },
    ],
    synergyScore: 75,
    synergyNote: 'GH ↑ IGF-1 и липолиз — поддержка митохондрий и электролитов.',
  },
  {
    id: 'glp1_only',
    name: 'GLP-1: метаболический коктейль',
    description: 'GLP-1 ↑ инсулин чувствительность, ↓ аппетит. Электролиты + магний.',
    condition: (d) => d.some(x=>x.id==='glp1'),
    build: () => [
      { id:'electrolyte', dose:'1', unit:'г/л', note:'GLP-1 ↑ диурез — коррекция', mg:1000, timing:'intra' },
      { id:'magnesium', dose:'400', unit:'мг', note:'GLP-1 ↓ Mg — восполнение', mg:400, timing:'post' },
    ],
    synergyScore: 60,
    synergyNote: 'GLP-1: риск дефицита электролитов и магния.',
  },
];

/** Выбрать лучший рецепт по активным препаратам. С ротацией при равном synergyScore. */
export function buildBestRecipe(profile: MixProfile): {
  recipe: MixRecipe;
  items: MixRecipeItem[];
} | null {
  const drugs = activeDrugsFromProfile(profile);
  if (drugs.length === 0) return null;

  const candidates = MIX_RECIPES
    .filter(r => r.condition(drugs, profile))
    .sort((a, b) => b.synergyScore - a.synergyScore);

  if (candidates.length === 0) return null;

  const topScore = candidates[0].synergyScore;
  const top = candidates.filter(r => r.synergyScore === topScore);
  const picked = top.length === 1 ? top[0] : (() => {
    const day = new Date().getDay();
    return top[day % top.length];
  })();

  return { recipe: picked, items: picked.build(drugs, profile) };
}

/** Сгруппировать и дедуплицировать по таймингу */
export function groupRecipeItemsByTiming(items: MixRecipeItem[]): Record<'pre'|'intra'|'post', MixRecipeItem[]> {
  const grouped = { pre: [] as MixRecipeItem[], intra: [] as MixRecipeItem[], post: [] as MixRecipeItem[] };
  const seen = new Set<string>();
  for (const item of items) {
    const key = `${item.id}_${item.timing}`;
    if (seen.has(key)) continue;
    seen.add(key);
    grouped[item.timing].push(item);
  }
  return grouped;
}

export function calculateMixScore(substances: MixSubstance[], profile: MixProfile): TrainingMixScore {
  const multiplier = profile.isOnCycle ? 1.25 : 1.0;
  const bw = profile.weightKg;
  const durHrs = profile.workoutDurationMin / 60;

  // Score accumulators — аддитивные (больше веществ → выше скор)
  let pump = 0, pumpBest = 0, pumpCount = 0;
  let energy = 0, energyBest = 0, energyCount = 0;
  let focus = 0, focusBest = 0, focusCount = 0;
  let strength = 0, strengthBest = 0, strengthCount = 0;
  let hydration = 0, hydrationBest = 0, hydrationCount = 0;
  let endurance = 0, enduranceBest = 0, enduranceCount = 0;
  let anticatabolic = 0, anticatabolicBest = 0, anticatabolicCount = 0;
  let recovery = 0, recoveryBest = 0, recoveryCount = 0;
  let protein = 0, proteinBest = 0, proteinCount = 0;
  let glycogen = 0, glycogenBest = 0, glycogenCount = 0;
  let noScore = 0;
  const catLabel: Record<string, string> = { pump:'🩸 Памп', energy:'⚡ Энергия', focus:'🧠 Фокус', strength:'🏋️ Сила', hydration:'💧 Гидратация', endurance:'🏃 Выносливость', anticatabolic:'🛡️ Анти-катаболизм', recovery:'🔄 Восстановление', protein:'🥩 Белок', glycogen:'🍚 Гликоген' };
  const substanceBreakdown: SubstanceScoreBreakdown[] = [];
  const acc = (cat: string, sc: number) => {
    if (cat === 'pump') { pump = Math.max(pump, sc); pumpBest = Math.max(pumpBest, sc); pumpCount++; }
    if (cat === 'energy') { energy = Math.max(energy, sc); energyBest = Math.max(energyBest, sc); energyCount++; }
    if (cat === 'focus') { focus = Math.max(focus, sc); focusBest = Math.max(focusBest, sc); focusCount++; }
    if (cat === 'strength') { strength = Math.max(strength, sc); strengthBest = Math.max(strengthBest, sc); strengthCount++; }
    if (cat === 'hydration') { hydration = Math.max(hydration, sc); hydrationBest = Math.max(hydrationBest, sc); hydrationCount++; }
    if (cat === 'endurance') { endurance = Math.max(endurance, sc); enduranceBest = Math.max(enduranceBest, sc); enduranceCount++; }
    if (cat === 'anticatabolic') { anticatabolic = Math.max(anticatabolic, sc); anticatabolicBest = Math.max(anticatabolicBest, sc); anticatabolicCount++; }
    if (cat === 'recovery') { recovery = Math.max(recovery, sc); recoveryBest = Math.max(recoveryBest, sc); recoveryCount++; }
    if (cat === 'protein') { protein = Math.max(protein, sc); proteinBest = Math.max(proteinBest, sc); proteinCount++; }
    if (cat === 'glycogen') { glycogen = Math.max(glycogen, sc); glycogenBest = Math.max(glycogenBest, sc); glycogenCount++; }
  };
  const addBonus = (best: number, count: number) => Math.min(100, Math.round(best + (count - 1) * 5));

  for (const sub of substances) {
    const db = getSubstanceScore(sub.id) || SUBSTANCE_DB[sub.id] || SUBSTANCE_DB[sub.id.toLowerCase()];
    if (!db) continue;
    const score = db.baseScore * multiplier;
    const cats: { key: string; label: string; score: number }[] = [];
    for (const cat of db.categories) {
      acc(cat, score);
      cats.push({ key: cat, label: catLabel[cat] || cat, score: Math.round(score) });
    }
    substanceBreakdown.push({ id: sub.id, name: sub.name, doseMg: sub.doseMg, baseScore: Math.round(score), categories: cats });
  }
  // Apply additive bonus (best + 5 per extra substance in same category)
  pump = addBonus(pumpBest, pumpCount);
  energy = addBonus(energyBest, energyCount);
  focus = addBonus(focusBest, focusCount);
  strength = addBonus(strengthBest, strengthCount);
  hydration = addBonus(hydrationBest, hydrationCount);
  endurance = addBonus(enduranceBest, enduranceCount);
  anticatabolic = addBonus(anticatabolicBest, anticatabolicCount);
  recovery = addBonus(recoveryBest, recoveryCount);
  protein = addBonus(proteinBest, proteinCount);
  glycogen = addBonus(glycogenBest, glycogenCount);

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

  // ── EXPERIENCE MODIFIERS ──
  if (profile.experience === 'novice') {
    energy = Math.round(energy * 0.9);
    focus = Math.round(focus * 0.9);
    strength = Math.round(strength * 0.85);
  } else if (profile.experience === 'advanced') {
    energy = Math.round(energy * 1.1);
    pump = Math.round(pump * 1.1);
    strength = Math.round(strength * 1.1);
    glycogen = Math.round(glycogen * 1.15);
  }

  // ── DAY TYPE MODIFIERS ──
  if (profile.dayType === 'push') {
    pump = Math.round(pump * 1.15);
    focus = Math.round(focus * 1.10);
  } else if (profile.dayType === 'pull') {
    glycogen = Math.round(glycogen * 1.10);
    energy = Math.round(energy * 1.10);
  } else if (profile.dayType === 'legs') {
    hydration = Math.round(hydration * 1.15);
    strength = Math.round(strength * 1.15);
  } else if (profile.dayType === 'upper') {
    focus = Math.round(focus * 1.15);
    pump = Math.round(pump * 1.05);
  } else if (profile.dayType === 'lower') {
    strength = Math.round(strength * 1.15);
    hydration = Math.round(hydration * 1.10);
  }

  // ── AAS MODIFIERS ──
  if (profile.aas && profile.aas.length > 0) {
    const aasLower = profile.aas.map(a => a.toLowerCase());
    if (aasLower.some(a => a.includes('tren'))) {
      pump = Math.round(pump * 0.8);
      anticatabolic = Math.round(anticatabolic * 1.15);
      glycogen = Math.round(glycogen * 1.1);
      drugModifiers.push({ drug: 'Тренболон', effect: '↓ NO (вазоконстрикция) — памп ослаблен, ↑ анти-катаболизм', bonus: -20 });
    }
    if (aasLower.some(a => a.includes('diana') || a.includes('methandro') || a.includes('anadrol') || a.includes('oxymeth'))) {
      pump = Math.round(pump * 1.1);
      hydration = Math.round(hydration * 1.05);
      glycogen = Math.round(glycogen * 1.1);
      drugModifiers.push({ drug: 'Метан/Анадрол', effect: '↑ гликоген + вода — усиленный памп и гидратация', bonus: +10 });
    }
    if (aasLower.some(a => a.includes('winstrol') || a.includes('stanozolol'))) {
      strength = Math.round(strength * 1.15);
      hydration = Math.round(hydration * 0.95);
      recovery = Math.round(recovery * 0.95);
      drugModifiers.push({ drug: 'Станозолол', effect: '↑ сила, ↓ вода/восстановление (сухость суставов)', bonus: +5 });
    }
    if (aasLower.some(a => a.includes('equipoise') || a.includes('boldenone') || a.includes('eq_'))) {
      endurance = Math.round(endurance * 1.1);
      pump = Math.round(pump * 1.05);
      drugModifiers.push({ drug: 'Болденон (EQ)', effect: '↑ RBC → выносливость + памп', bonus: +10 });
    }
    if (aasLower.some(a => a.includes('masteron') || a.includes('drostanolone'))) {
      strength = Math.round(strength * 1.1);
      pump = Math.round(pump * 0.95);
      drugModifiers.push({ drug: 'Мастерон', effect: '↑ сила, ↓ вода (сушка)', bonus: +5 });
    }
    if (aasLower.some(a => a.includes('primobolan') || a.includes('methenolone'))) {
      recovery = Math.round(recovery * 1.05);
      drugModifiers.push({ drug: 'Примоболан', effect: '↑ коллаген → мягкое восстановление', bonus: +5 });
    }
    if (aasLower.some(a => a.includes('anavar') || a.includes('oxandrolone'))) {
      strength = Math.round(strength * 1.05);
      recovery = Math.round(recovery * 1.05);
      drugModifiers.push({ drug: 'Оксандролон', effect: '↑ сила + коллаген → восстановление', bonus: +8 });
    }
  }

  // Carb calculation based on goal and drugs
  let recCarbs = 0;
  if (profile.timing === 'pre') recCarbs = bw * (profile.goal === 'endurance' ? 1.2 : profile.goal === 'crossfit' ? 1.0 : profile.goal === 'powerlifting' || profile.goal === 'competition' ? 1.0 : profile.goal === 'post_comp' ? 0.6 : profile.goal === 'strength' ? 0.8 : profile.goal === 'hiit' ? 0.7 : profile.goal === 'mma' ? 0.7 : profile.goal === 'sprint' ? 0.6 : 0.6) * multiplier;
  if (profile.timing === 'intra') recCarbs = bw * durHrs * (profile.goal === 'crossfit' ? 0.8 : profile.goal === 'powerlifting' ? 0.5 : profile.goal === 'competition' ? 0.4 : profile.goal === 'hiit' ? 0.3 : profile.goal === 'mma' ? 0.4 : profile.goal === 'sprint' ? 0.2 : 0.6) * multiplier;
  if (profile.timing === 'post') recCarbs = bw * (profile.goal === 'crossfit' || profile.goal === 'post_comp' ? 1.4 : profile.goal === 'competition' ? 1.2 : profile.goal === 'hiit' ? 1.0 : profile.goal === 'mma' ? 1.0 : profile.goal === 'sprint' ? 0.8 : 0.8) * multiplier;
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

  // ── EXPERIENCE/DAY TYPE DOSE MODIFIERS (after recCarbs/recEAA/recWater init) ──
  if (profile.experience === 'novice') {
    recCarbs = Math.round(recCarbs * 0.8);
    recEAA = Math.round(recEAA * 0.85);
  }
  if (profile.dayType === 'legs') {
    recWater = Math.round(recWater * 1.15);
  }

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
  const isHIIT = profile.goal === 'hiit';
  const isMMA = profile.goal === 'mma';
  const isSprint = profile.goal === 'sprint';
  const isFatLoss = profile.goal === 'fat_loss';
  const isJoint = profile.goal === 'joint';
  const isGut = profile.goal === 'gut';
  const isSleep = profile.goal === 'sleep';
  const isHydration = profile.goal === 'hydration';
  const isFn = (v: boolean, def: number, map: Record<string, number>) => v ? (map[profile.timing] ?? def) : undefined;
  const weights = profile.timing === 'pre'
    ? { pump: (isPump ? 0.35 : isFatLoss ? 0.05 : isHydration ? 0.20 : isStrength ? 0.10 : isEndurance ? 0.10 : isFocus ? 0.05 : isCF ? 0.15 : isHIIT ? 0.08 : isMMA ? 0.05 : isSprint ? 0.05 : 0.15), energy: (isPump ? 0.15 : isFatLoss ? 0.30 : isStrength ? 0.20 : isEndurance ? 0.30 : isFocus ? 0.20 : isCF ? 0.30 : isHIIT ? 0.35 : isMMA ? 0.25 : isSprint ? 0.30 : 0.25), focus: (isPump ? 0.05 : isFatLoss ? 0.20 : isStrength ? 0.10 : isEndurance ? 0.10 : isFocus ? 0.40 : isCF ? 0.25 : isHIIT ? 0.05 : isMMA ? 0.20 : isSprint ? 0.05 : 0.25), strength: (isPump ? 0.10 : isFatLoss ? 0.05 : isStrength ? 0.40 : isEndurance ? 0.10 : isFocus ? 0.10 : isPL ? 0.25 : isHIIT ? 0.20 : isMMA ? 0.25 : isSprint ? 0.40 : 0.25), endurance: (isPump ? 0.10 : isFatLoss ? 0.30 : isStrength ? 0.05 : isEndurance ? 0.35 : isFocus ? 0.05 : isCF ? 0.15 : isHIIT ? 0.25 : isMMA ? 0.15 : isSprint ? 0.10 : 0.05) }
    : profile.timing === 'intra'
    ? { pump: (isPump ? 0.20 : isFatLoss ? 0.05 : isHydration ? 0.15 : isStrength ? 0.10 : isHIIT ? 0.08 : isMMA ? 0.10 : isSprint ? 0.20 : 0.10), energy: (isEndurance ? 0.20 : isCF ? 0.10 : isFatLoss ? 0.15 : 0.10), focus: (isFatLoss ? 0.10 : 0.05), strength: (isStrength ? 0.15 : isSprint ? 0.05 : isHIIT ? 0.05 : 0.05), hydration: (isCF ? 0.35 : isEndurance ? 0.35 : isHIIT ? 0.40 : isMMA ? 0.35 : isSprint ? 0.40 : isFatLoss ? 0.20 : isHydration ? 0.40 : 0.30), endurance: (isEndurance ? 0.25 : isCF ? 0.20 : isHIIT ? 0.30 : isMMA ? 0.25 : isSprint ? 0.20 : isFatLoss ? 0.25 : 0.20), anticatabolic: (isMMA ? 0.20 : isHIIT ? 0.15 : isSprint ? 0.10 : isFatLoss ? 0.15 : 0.15) }
    : { pump: (isPump ? 0.05 : isHydration ? 0.10 : 0.05), energy: 0.05, focus: 0.05, strength: (isStrength ? 0.20 : isPL ? 0.15 : isSprint ? 0.15 : 0.1), hydration: (isHydration ? 0.25 : 0.05), recovery: (isRecovery ? 0.50 : isPostComp ? 0.45 : isPL ? 0.40 : isHIIT ? 0.40 : isMMA ? 0.35 : isSprint ? 0.30 : isFatLoss ? 0.25 : isJoint ? 0.55 : isSleep ? 0.50 : isGut ? 0.30 : 0.35), protein: (isRecovery ? 0.20 : isStrength ? 0.30 : isPostComp ? 0.25 : isMMA ? 0.30 : isSprint ? 0.30 : isFatLoss ? 0.30 : isJoint ? 0.15 : isSleep ? 0.10 : isGut ? 0.15 : 0.25), glycogen: (isPostComp ? 0.10 : isPL ? 0.05 : isHIIT ? 0.15 : isMMA ? 0.10 : isSprint ? 0.10 : isFatLoss ? 0.10 : 0.10), antiinflammatory: (isRecovery ? 0.10 : isPostComp ? 0.10 : isMMA ? 0.05 : isSprint ? 0.05 : isJoint ? 0.20 : isSleep ? 0.20 : isGut ? 0.20 : 0) };

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
  if (profile.goal === 'hiit') {
    if (profile.timing === 'pre') suggestions.push('💨 HIIT: β-аланин 4 г для буферизации H⁺, креатин 5 г для АТФ, кофеин 200 мг для CNS, цитруллин 6 г для NO');
    if (profile.timing === 'intra') suggestions.push('💨 HIIT intra: HBCD 30 г + электролиты + глицерол 3 г для гидратации между спринтами');
    if (profile.timing === 'post') suggestions.push('💨 HIIT post: протеин 0.35 г/кг + креатин 5 г + омега-3 2 г + кордицепс 2 г для восстановления');
  }
  if (profile.goal === 'mma') {
    if (profile.timing === 'pre') suggestions.push('🥊 MMA: креатин 5 г для взрывной, тирозин + кофеин 200 мг для CNS, β-аланин 4 г, цитруллин 6 г для NO, родиола 500 мг адаптоген');
    if (profile.timing === 'intra') suggestions.push('🥊 MMA intra: HBCD 40 г + EAA 10 г + электролиты + глицерол 3 г между раундами');
    if (profile.timing === 'post') suggestions.push('🥊 MMA post: протеин 0.4 г/кг + глютамин 10 г для GABA/восстановление, креатин 5 г, омега-3 3 г, ашваганда 600 мг для кортизола');
  }
  if (profile.goal === 'sprint') {
    if (profile.timing === 'pre') suggestions.push('🏃 Спринт: креатин 8 г для фосфокреатина, β-аланин 4 г, кофеин 250 мг, кордицепс 3 г для АТФ, цитруллин 8 г');
    if (profile.timing === 'intra') suggestions.push('🏃 Спринт intra: электролиты + глицерол 3 г — короткая работа, только гидратация');
    if (profile.timing === 'post') suggestions.push('🏃 Спринт post: протеин 0.3 г/кг + креатин 5 г + HMB 3 г анти-катаболизм + L-карнитин 1 г');
  }
  if (profile.goal === 'post_comp') {
    suggestions.push('🔄 Пост-соревнования: гормональный откат — ZMA, ашваганда 600 мг, витамин C 1 г, родиола 500 мг (кортизол + восстановление)');
    suggestions.push('💤 Сон 9+ часов, холодные ванны для воспаления, минимум стимуляторов 3-5 дней');
  }
  if (profile.goal === 'fat_loss') {
    if (profile.timing === 'pre') suggestions.push('🔥 Жиросжигание: L-карнитин 2 г, кофеин 200-300 мг, кордицепс 2-3 г, экстракт зелёного чая 500 мг, йохимбин 5 мг');
    if (profile.timing === 'intra') suggestions.push('🔥 Жиросжигание intra: HBCD 15-20 г (минимум), EAA 10 г, электролиты — калорий минимум');
    if (profile.timing === 'post') suggestions.push('🔥 Жиросжигание post: протеин 0.4 г/кг, L-карнитин 1 г, CLA 2 г, омега-3 2 г (сохранение мышц + липолиз)');
  }
  if (profile.goal === 'joint') {
    if (profile.timing === 'pre') suggestions.push('🦵 Суставы: коллаген 15 г за 30 мин, глюкозамин 1500 мг, MSM 3 г, гиалуроновая к-та 100 мг');
    if (profile.timing === 'intra') suggestions.push('🦵 Суставы intra: HBCD 20 г + электролиты + глицерол 3 г — влажная среда для хрящей');
    if (profile.timing === 'post') suggestions.push('🦵 Суставы post: коллаген 15 г + витамин C 1 г + куркумин 800 мг + омега-3 3 г (матрикс хряща)');
  }
  if (profile.goal === 'gut') {
    if (profile.timing === 'pre') suggestions.push('🫀 ЖКТ: глутамин 5 г за 30 мин, пробиотики (L. rhamnosus), L-карнитин 1 г для тонуса ЖКТ');
    if (profile.timing === 'intra') suggestions.push('🫀 ЖКТ intra: только глутамин 5 г + простые электролиты — исключить сахара и HBCD при чувствительности');
    if (profile.timing === 'post') suggestions.push('🫀 ЖКТ post: глутамин 10 г, костный бульон, бетаин HCl, цинк 25 мг + витамин C 1 г (восстановление слизистой)');
  }
  if (profile.goal === 'sleep') {
    if (profile.timing === 'pre') suggestions.push('💤 Сон: глицин 3 г за 30 мин, магний 400 мг глицинат, L-теанин 200 мг, мелатонин 1-3 мг, GABA 500 мг');
    if (profile.timing === 'post') suggestions.push('💤 Сон post: магний 400 мг глицинат, глицин 3 г, ашваганда 600 мг (кортизол ↓), мелатонин 1-3 мг, ZMA');
  }
  if (profile.goal === 'hydration') {
    if (profile.timing === 'pre') suggestions.push('💧 Гидратация: глицерол 3-5 г + электролиты (Na 500 мг, K 200 мг) за 60 мин');
    if (profile.timing === 'intra') suggestions.push('💧 Гидратация intra: электролиты 2 г/л + глицерол 3 г + HBCD 20-30 г — максимум жидкости');
    if (profile.timing === 'post') suggestions.push('💧 Гидратация post: 1.5× потерянного веса воды + электролиты + глицерол 5 г');
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
