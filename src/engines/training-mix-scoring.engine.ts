import { SUPPORT_CATALOG_DATA } from '../data/support-catalog-data';
import type { SupportCatalogEntry } from '../data/support-catalog-data';

export interface MixSubstance {
  id: string; name: string; doseMg: number;
  category: 'pump' | 'energy' | 'focus' | 'strength' | 'hydration' | 'endurance' | 'anticatabolic' | 'recovery' | 'protein' | 'glycogen' | 'antiinflammatory' | 'hormonal';
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
}

export interface MixProfile {
  goal: 'pump' | 'endurance' | 'strength' | 'recovery' | 'focus' | 'powerlifting' | 'competition' | 'crossfit' | 'post_comp';
  timing: 'pre' | 'intra' | 'post';
  weightKg: number;
  isOnCycle: boolean;
  drugs: { insulin: boolean; igf: boolean; gh: boolean; mgf: boolean; glp1: boolean };
  hasNandrolone: boolean;
  userElectrolytes: { sodiumMmolL: number; potassiumMmolL: number; chlorideMmolL: number };
  workoutType: 'heavy' | 'moderate' | 'light';
  timeOfDay: 'morning' | 'afternoon' | 'evening';
  workoutDurationMin: number;
}

// Dynamic substance scoring — lookup by SUPPORT_CATALOG_DATA categories
function getSubstanceScore(substanceId: string): { categories: MixSubstance['category'][]; baseScore: number } | null {
  const id = substanceId.toLowerCase();
  const entry = SUPPORT_CATALOG_DATA[id] as SupportCatalogEntry | undefined;
  if (!entry) return null;

  const cats = new Set<MixSubstance['category']>();
  const catMap: Record<string, MixSubstance['category'][]> = {
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

  const mechMap: Record<string, MixSubstance['category'][]> = {
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
const SUBSTANCE_DB: Record<string, { categories: MixSubstance['category'][]; baseScore: number }> = {
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

  for (const sub of substances) {
    const db = getSubstanceScore(sub.id) || SUBSTANCE_DB[sub.id] || SUBSTANCE_DB[sub.id.toLowerCase()];
    if (!db) continue;
    const score = db.baseScore * multiplier;
    for (const cat of db.categories) {
      if (cat === 'pump') pump = Math.max(pump, score);
      if (cat === 'energy') energy = Math.max(energy, score);
      if (cat === 'focus') focus = Math.max(focus, score);
      if (cat === 'strength') strength = Math.max(strength, score);
      if (cat === 'hydration') hydration = Math.max(hydration, score);
      if (cat === 'endurance') endurance = Math.max(endurance, score);
      if (cat === 'anticatabolic') anticatabolic = Math.max(anticatabolic, score);
      if (cat === 'recovery') recovery = Math.max(recovery, score);
      if (cat === 'protein') protein = Math.max(protein, score);
      if (cat === 'glycogen') glycogen = Math.max(glycogen, score);
    }
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

  // Drug modifiers for NO
  if (profile.drugs.insulin) { noScore = Math.round(noScore * 1.15); drugModifiers.push({ drug: 'Инсулин', effect: '↑ усвоение глюкозы и аминокислот', bonus: 15 }); }
  if (profile.drugs.igf) { noScore = Math.round(noScore * 1.1); drugModifiers.push({ drug: 'ИГФ-1', effect: '↑ синтез белка, ↑ регенерация', bonus: 10 }); }
  if (profile.drugs.gh) { noScore = Math.round(noScore * 1.1); drugModifiers.push({ drug: 'ГР', effect: '↑ восстановление, ↑ IGF-1', bonus: 10 }); }
  if (profile.drugs.mgf) { noScore = Math.round(noScore * 1.08); drugModifiers.push({ drug: 'МГФ', effect: '↑ пролиферация сателлитных клеток', bonus: 8 }); }
  if (profile.drugs.glp1) { drugModifiers.push({ drug: 'ГПП-1', effect: '↓ гликемия — следить за гипогликемией', bonus: -5 }); }

  // Carb calculation based on goal and drugs
  let recCarbs = 0;
  if (profile.timing === 'pre') recCarbs = bw * (profile.goal === 'endurance' ? 1.2 : profile.goal === 'crossfit' ? 1.0 : profile.goal === 'powerlifting' || profile.goal === 'competition' ? 1.0 : profile.goal === 'post_comp' ? 0.6 : profile.goal === 'strength' ? 0.8 : 0.6) * multiplier;
  if (profile.timing === 'intra') recCarbs = bw * durHrs * (profile.goal === 'crossfit' ? 0.8 : profile.goal === 'powerlifting' ? 0.5 : profile.goal === 'competition' ? 0.4 : 0.6) * multiplier;
  if (profile.timing === 'post') recCarbs = bw * (profile.goal === 'crossfit' || profile.goal === 'post_comp' ? 1.4 : profile.goal === 'competition' ? 1.2 : 0.8) * multiplier;
  if (profile.drugs.insulin) recCarbs *= 1.3;
  if (profile.drugs.glp1) recCarbs *= 0.5;

  // EAA calculation
  let recEAA = profile.timing === 'intra' ? bw * 0.15 * multiplier : profile.timing === 'post' ? bw * 0.4 * multiplier : bw * 0.1 * multiplier;
  if (profile.drugs.insulin || profile.drugs.gh) recEAA *= 1.2;
  if (profile.workoutType === 'heavy') recEAA *= 1.3;

  // Time-of-day adjustments
  if (profile.timeOfDay === 'morning') { energy = Math.round(energy * 1.1); }
  if (profile.timeOfDay === 'evening') { recovery = Math.round(recovery * 1.15); }

  // Water
  const recWater = bw * 35 + durHrs * 500;

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

  // NO depletion from drugs (nandrolone primarily, but also check dehydration)
  if (profile.hasNandrolone && profile.timing === 'pre') {
    suggestions.push('⚠ Нандролон снижает NO — добавьте цитруллин 8-10 г + свекольный экстракт для компенсации');
  }

  // Composite score based on timing
  let composite = 0;
  const isPL = profile.goal === 'powerlifting' || profile.goal === 'competition';
  const isCF = profile.goal === 'crossfit';
  const isPostComp = profile.goal === 'post_comp';
  const weights = profile.timing === 'pre'
    ? { pump: isCF ? 0.15 : 0.15, energy: isCF ? 0.30 : isPL ? 0.30 : 0.25, focus: isCF ? 0.25 : isPL ? 0.30 : 0.25, strength: isPL ? 0.25 : 0.25, endurance: isCF ? 0.15 : 0 }
    : profile.timing === 'intra'
    ? { pump: 0.10, energy: 0.10, focus: 0.05, strength: 0.05, hydration: isCF ? 0.35 : 0.30, endurance: isCF ? 0.20 : 0.25, anticatabolic: 0.15 }
    : { pump: 0.05, energy: 0.05, focus: 0.05, strength: isPL ? 0.15 : 0.1, hydration: 0.05, recovery: isPostComp ? 0.45 : isPL ? 0.4 : 0.35, protein: isPostComp ? 0.25 : 0.25, glycogen: isPostComp ? 0.10 : isPL ? 0.05 : 0.10, antiinflammatory: isPostComp ? 0.10 : 0 };

  for (const [key, w] of Object.entries(weights)) {
    const val = (key === 'pump' ? pump : key === 'energy' ? energy : key === 'focus' ? focus : key === 'strength' ? strength : key === 'hydration' ? hydration : key === 'endurance' ? endurance : key === 'anticatabolic' ? anticatabolic : key === 'recovery' ? recovery : key === 'protein' ? protein : glycogen);
    composite += Math.round(val * w);
  }
  composite = Math.min(100, Math.round(composite * multiplier));

  const label = composite >= 85 ? '💎 Элитный' : composite >= 70 ? '⭐ Отличный' : composite >= 50 ? '👍 Хороший' : composite >= 30 ? '⚡ Базовый' : '⚠️ Слабый';
  const color = composite >= 85 ? '#a855f7' : composite >= 70 ? '#22c55e' : composite >= 50 ? '#3b82f6' : composite >= 30 ? '#f59e0b' : '#ef4444';

  const suggestions: string[] = [];
  if (pump < 60) suggestions.push('Добавьте цитруллин 6-8 г или агматин 1 г для пампа');
  if (energy < 60 && profile.timing === 'pre') suggestions.push('Добавьте кофеин 200 мг или бета-аланин 3.2 г для энергии');
  if (focus < 60 && profile.timing === 'pre') suggestions.push('Добавьте тирозин 2 г или альфа-GPC 600 мг для фокуса');
  if (hydration < 60 && profile.timing === 'intra') suggestions.push('Добавьте электролиты (Na/K/Mg) для гидратации');
  if (recovery < 60 && profile.timing === 'post') suggestions.push('Добавьте протеин 0.4 г/кг и глютамин 5 г для восстановления');
  if (glycogen < 60 && profile.timing === 'post') suggestions.push('Добавьте HBCD или декстрозу для восполнения гликогена');
  if (profile.goal === 'powerlifting' && profile.timing === 'pre') suggestions.push('💪 Пауэрлифтинг: креатин 5-10 г + кофеин 200-400 мг + бета-аланин 4-6 г для максимальной силы');
  if (profile.goal === 'competition' && profile.timing === 'pre') suggestions.push('🏆 Соревнования: добавьте аммиак-буфер (OKG 5 г или L-орнитин 2 г), нашатырь для CNS-активации перед подходом');
  if (profile.goal === 'competition' && profile.timing === 'intra') suggestions.push('🏆 Соревновательный режим: минимальный интра-приём, только электролиты + 15-20 г HBCD между попытками');
  if (profile.goal === 'competition' && profile.timing === 'post') suggestions.push('🏆 После соревнований: протеин 0.5 г/кг + HBCD 1 г/кг + креатин 10 г (загрузка) + глютамин 10 г');
  if (profile.drugs.insulin && profile.timing === 'intra' && glycogen < 70) suggestions.push('⚠ При инсулине: углеводы до ' + Math.round(recCarbs) + ' г для предотвращения гипогликемии');
  if (profile.goal === 'crossfit') {
    if (profile.timing === 'pre') suggestions.push('💪 CrossFit: кофеин 200-400 мг + бета-аланин 4 г + электролиты для WOD');
    if (profile.timing === 'intra') suggestions.push('💪 CF (2-3 сессии): HBCD 60-80 г + EAA 15 г + Na/K/Mg между WODами для восстановления');
    if (profile.timing === 'post') suggestions.push('💪 CF: протеин 0.5 г/кг + HBCD 1.5 г/кг + креатин 5 г + куркумин для системного воспаления');
  }
  if (profile.goal === 'post_comp') {
    suggestions.push('🔄 Пост-соревнования: гормональный откат — ZMA, ашваганда 600 мг, витамин C 1 г (кортизол)');
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
  };
}
