// ════════════════════════════════════════════════════════════════════════════
//  LAB-TIER-RECOMMENDATIONS — рекомендации per marker+tier
//  TIER 0 = норма (нет рекомендаций)
//  TIER 1 = грань (профилактика: +препарат + нутри-AC)
//  TIER 2 = лечение (титрация доз↑, +препараты, нутри-AC усиленные)
//  TIER 3 = ⛔ экстрено (STOP COURSE + к врачу)
//
//  computeTierAdjustments(labs) → {addSubs, titrationFactors, nutritionTips, alerts, stopCourse}
// ════════════════════════════════════════════════════════════════════════════

import { deriveTier, getTierLabel, LAB_TIERS, type Tier } from './lab-tier-ranges';

export interface TierAddSub {
  id: string;
  reason: string;
  dose?: string;
  tier: Tier;
  marker: string;
}

export interface TierTitration {
  id: string;
  factor: number;       // множитель дозы (1.5 = +50%, 2.0 = ×2)
  reason: string;
  tier: Tier;
  marker: string;
}

export interface TierNutritionTip {
  action: string;
  target: string;
  marker: string;
  tier: Tier;
}

export interface TierAlert {
  marker: string;
  value: number;
  tier: Tier;
  message: string;
  stopCourse?: boolean;
}

export interface TierAdjustmentResult {
  addSubs: TierAddSub[];
  titrations: TierTitration[];
  nutrition: TierNutritionTip[];
  alerts: TierAlert[];
  stopCourse: boolean;
  tierSummary: { marker: string; value: number; tier: Tier; label: string; unit: string }[];
}

interface TierRule {
  marker: string;
  tier1?: {
    add?: Array<[string, string, string?]>;        // [id, reason, dose]
    titrate?: Array<[string, number, string]>;     // [id, factor, reason]
    nutrition?: Array<[string, string]>;           // [action, target]
  };
  tier2?: {
    add?: Array<[string, string, string?]>;
    titrate?: Array<[string, number, string]>;
    nutrition?: Array<[string, string]>;
    note?: string;
  };
  tier3?: {
    alerts: string[];
    stopCourse?: boolean;
    nutrition?: Array<[string, string]>;
  };
}

// ════════════════════════════════════════════════════════════════════════════
//  ПРАВИЛА — список рекомендаций per marker+tier
// ════════════════════════════════════════════════════════════════════════════
const TIER_RULES: TierRule[] = [

  // ─── ПЕЧЕНЬ ───
  { marker: 'ALT', tier1: { add: [['milk_thistle', 'Силимарин 280 мг — стабилизация мембран гепатоцитов']], nutrition: [['Снизить фруктозу', '↓ фруктовые соки/сахар'], ['М крестоцветные', '↑ брокколи/капуста (sulforaphane→Nrf2)']] }, tier2: { titrate: [['tudca', 2.0, 'TUDCA ↑1000 мг (было 500) — усиленный желчеотток']], add: [['milk_thistle', 'Силимарин 280 мг — мембраны']], nutrition: [['STOP алкоголь', 'ZERO алкоголя'], ['Снизить фруктозу', '↓ соки/сахар ZERO fructose'], ['STOP оральные AAS', 'Отменить 17α-AAS если есть']], note: 'ALT 80-200: TUDCA ×2 + milk_thistle + ↓ fructose/alcohol ZERO' }, tier3: { alerts: ['⛔ ALT = {value} U/L (3× ULN). НЕМЕДЛЕННО прекратить AAS. Повторить анализ через 7 дней. Желтуха/боли → госпитализация.'], stopCourse: true, nutrition: [['STOP AAS', 'Немедленная отмена'], ['STOP алкоголь', 'ZERO'], ['Врач', 'Гастроэнтеролог / токсикология']] } },

  { marker: 'AST', tier1: { nutrition: [['Антиоксиданты', '↑ NAC + α-липоевая']] }, tier2: { titrate: [['tudca', 2.0, 'TUDCA ↑1000 мг']], nutrition: [['STOP алкоголь', 'ZERO']] }, tier3: { alerts: ['⛔ AST = {value} U/L. Прекратить AAS. Гастроэнтеролог.'], stopCourse: true } },

  { marker: 'GGT', tier1: { add: [['tudca', 'TUDCA 500 мг — стимуляция BSEP-желчеоттока']], nutrition: [['STOP алкоголь', 'ZERO']] }, tier2: { titrate: [['tudca', 2.0, 'TUDCA ↑1000 мг']], nutrition: [['STOP алкоголь', 'ZERO']] }, tier3: { alerts: ['⛔ GGT = {value} U/L. Холестаз. Прекратить AAS. УЗИ билиарного тракта.'], stopCourse: true } },

  { marker: 'BILIRUBIN', tier1: { nutrition: [['Поддержка желчеоттока', 'TUDCA 500 мг']] }, tier2: { add: [['tudca', 'TUDCA 1000 мг — холестаз']], nutrition: [['Жёлчегонные', 'TUDCA + dandelion']] }, tier3: { alerts: ['⛔ Билирубин = {value} mcmol/L. Желтуха. Прекратить AAS. Проверить на гепатит. К врачу.'], stopCourse: true } },

  // ─── ССС ───
  { marker: 'LDL', tier1: { add: [['bergamot', 'Бергамот ×2 (1000 мг) — HMG-CoA редуктаза']], nutrition: [['Снизить насыщенные жиры', '<7% ккал (≈15 г/день на 2000 ккал)'], ['Псиллиум', '+ псиллиум 30 г (soluble fiber)']] }, tier2: { add: [['bergamot', 'Бергамот 1000 мг'], ['niacin', 'Ниацин 500 мг на ночь'], ['garlic', 'Чеснок 1200 мг'], ['omega3', 'Омега-3 ↑4 г']], nutrition: [['STOP trans-жиры', 'ZERO гидрогенизированных'], ['Псиллиум', '50 г'], ['Sat-fat', '<5% ккал']] }, tier3: { alerts: ['LDL = {value} mmol/L — выраженная гиперхолестеринемия. Эндокринолог / кардиолог'], stopCourse: false } },

  { marker: 'HDL', tier1: { add: [['niacin', 'Ниацин 500 мг на ночь — ↑HDL first-line']], nutrition: [['Aerobic', '+30 мин 5×/нед'], ['STOP trans', 'ZERO trans']] }, tier2: { titrate: [['niacin', 2.0, 'Ниацин ↑1000 мг']], add: [['l_carnitine', 'L-Карнитин 2 г — митохондрии / липиды']], nutrition: [['Aerobic', '60 мин 5×/нед'], ['STOP trans', 'ZERO'], ['STOP smoking', 'ZERO табак']] }, tier3: { alerts: ['HDL = {value} mmol/L — критически низкий. Кардиолог'], stopCourse: false } },

  { marker: 'TRIGLYCERIDES', tier1: { add: [['omega3', 'Омега-3 ↑3 г'], ['l_carnitine', 'L-Карнитин 2 г']], nutrition: [['Снизить сахар', '↓ быстрые углеводы']] }, tier2: { titrate: [['omega3', 1.5, 'Омега-3 ↑4.5 г']], nutrition: [['Lowcarb', '<50 г углеводов/день'], ['STOP alcohol', 'ZERO'], ['Омега-3', '4-5 г EPA/DHA']] }, tier3: { alerts: ['ТГ = {value} mmol/L — риск панкреатита. Острые ТГ >5.6 → ER'], stopCourse: false } },

  { marker: 'BP_SYSTOLIC', tier1: { add: [['beetroot', 'Beetroot 500 мг — нитраты→NO'], ['garlic', 'Чеснок 1200 мг']], nutrition: [['Снизить натрий', '2-3 г/день'], ['↑ калий', '+ бананы/авокадо 3.5-5 г/день']] }, tier2: { titrate: [['telmisartan', 1.5, 'Telmisartan ↑60-80 мг']], add: [['nebivolol', 'Nebivolol 2.5 мг — β1+NO (только при ЧСС>80)']], nutrition: [['DASH-diet', 'sodium 1.5-2 г'], ['Mg', '↑400-600 мг'], ['Beetroot', '1 кг/нед']] }, tier3: { alerts: ['⛔ АД сист = {value} mmHg — гипертонический криз. ER. STOP AAS.'], stopCourse: true } },

  { marker: 'CK', tier1: { nutrition: [['Mg', '↑400 мг (судороги)'], ['Вода', '45+ мл/кг']] }, tier2: { nutrition: [['STOP тренировки', '3-7 дней покой'], ['Вода', '45+ мл/кг']] }, tier3: { alerts: ['⛔ КФК = {value} U/L — рабдомиолиз. ER немедленно. Проверить миоглобин мочи. STOP тренировок. Врач.'], stopCourse: true } },

  { marker: 'D_DIMER', tier1: { add: [['nattokinase', 'Nattokinase 100 мг'], ['serrapeptase', 'Serrapeptase 10 мг']] }, tier2: { add: [['serrapeptase', 'Serrapeptase 20 мг'], ['nattokinase', 'Nattokinase 200 мг'], ['garlic', 'Чеснок 1200 мг — ↓ aggregation']], nutrition: [['Omega-3', '↑4 г']], note: 'Срочный визит к врачу' }, tier3: { alerts: ['⛔ D-димер = {value} мг/L — тромбоэмболия. ER немедленно.'], stopCourse: true } },

  { marker: 'FIBRINOGEN', tier1: { add: [['omega3', 'Омега-3 ↑3 г'], ['nattokinase', 'Nattokinase 100 мг']] }, tier2: { titrate: [['omega3', 1.5, 'Омега-3 ↑4.5 г']], add: [['serrapeptase', 'Serrapeptase 20 мг'], ['nattokinase', 'Nattokinase 200 мг']] }, tier3: { alerts: ['Фибриноген = {value} г/L — выраженная гиперфибриногенемия. Врач.'] } },

  // ─── ПОЧКИ ───
  { marker: 'CREATININE', tier1: { add: [['astragalus', 'Астрагал 500 мг — ↓ протеинурия'], ['cordyceps', 'Кордицепс 1000 мг']], nutrition: [['Снизить белок', '1.8 г/кг (не >2.2)'], ['STOP creatine', 'ZERO креатин добавок']] }, tier2: { titrate: [['astragalus', 2.0, 'Астрагал ↑1000 мг'], ['cordyceps', 2.0, 'Кордицепс ↑2000 мг']], nutrition: [['Снизить белок', '1.6 г/кг'], ['STOP creatine', 'ZERO'], ['STOP NSAIDs', 'ZERO ибупрофен/напроксен']] }, tier3: { alerts: ['⛔ Креатинин = {value} mcmol/L — ОПН риск. STOP AAS. Нефролог срочно.'], stopCourse: true } },

  { marker: 'EGFR', tier1: { add: [['astragalus', 'Астрагал 500 мг']], nutrition: [['Hydration', '45+ мл/кг/день'], ['Lower protein', '1.8 г/кг']] }, tier2: { add: [['cordyceps', 'Кордицепс 2000 мг']], nutrition: [['Lower protein', '1.6 г/кг'], ['Hydration', '45+ мл/кг']] }, tier3: { alerts: ['⛔ eGFR = {value} mL/min — ХБП ст.4. Нефролог. STOP AAS.'], stopCourse: true } },

  { marker: 'PROTEIN_URINE', tier1: { nutrition: [['Вода', '45+ мл/кг'], ['Белок', '1.8 г/кг (умеренно)']] }, tier2: { add: [['telmisartan', 'Telmisartan ↑80 мг (антипротеинурический)']], nutrition: [['Снизить белок', '1.6 г/кг'], ['STOP creatine', 'ZERO']] }, tier3: { alerts: ['Протеинурия = {value} g/L — выраженная. Нефролог.'], stopCourse: true } },

  // ─── ГЕМАТОЛОГИЯ ───
  { marker: 'HCT', tier1: { add: [['serrapeptase', 'Serrapeptase 10 мг'], ['bromelain', 'Bromelain 500 мг']], nutrition: [['Вода', '40+ мл/кг'], ['STOP iron', 'ZERO препаратов железа']] }, tier2: { titrate: [['serrapeptase', 2.0, 'Serra ↑20 мг']], add: [['nattokinase', 'Nattokinase 200 мг'], ['bromelain', 'Bromelain 1000 мг'], ['hesperidin', 'Hesperidin 500 + Diosmin 450 — венотоник']], nutrition: [['Кровопускание', '300-450 мл (рекомендация врача)'], ['Вода', '45+ мл/кг'], ['STOP iron', 'ZERO'], ['Cardio', 'Аэроб 30 мин 5×/нед']] }, tier3: { alerts: ['⛔ Гематокрит = {value}% — полицитемия. Гипервязкость. Кровопускание 450 мл СРОЧНО + STOP AAS.'], stopCourse: true } },

  { marker: 'HEMOGLOBIN', tier1: { nutrition: [['Вода', '40+ мл/кг'], ['STOP iron', 'ZERO']] }, tier2: { add: [['serrapeptase', 'Serrapeptase 20 мг'], ['nattokinase', 'Nattokinase 200 мг']], nutrition: [['Кровопускание', '300-450 мл'], ['STOP iron', 'ZERO']] }, tier3: { alerts: ['⛔ Гемоглобин = {value} g/L — полицитемия. Кровопускание + STOP AAS.'], stopCourse: true } },

  { marker: 'PLT', tier1: { nutrition: [['Omega-3', '↑3 г']] }, tier2: { add: [['garlic', 'Чеснок 1200 мг — ↓ aggregation'], ['omega3', 'Омега-3 4 г'], ['nattokinase', 'Nattokinase 200 мг']], nutrition: [['STOP smoking', 'ZERO']] }, tier3: { alerts: ['Тромбоциты = {value}×10⁹/L — тромбоцитоз. Кардиолог/гематолог.'] } },

  // ─── ГОРМОНАЛЬНЫЕ ───
  { marker: 'E2', tier1: { titrate: [['anastrozole', 1.5, 'Anastrozole ↑3р/нед (было 2р)']], nutrition: [['Контроль E2', 'Повторить через 7 дней']] }, tier2: { titrate: [['anastrozole', 2.0, 'Anastrozole ↑1 мг/день (было 0.5 2р/нед)']], nutrition: [['Срочно сдать E2', 'Повтор через 7 дней']] }, tier3: { alerts: ['⛔ Эстрадиол = {value} pg/mL — риск гинекомастии. ↑AI до 1 мг/день + рассмотреть SERM (tamoxifen 20 мг). Срочно.'] } },

  { marker: 'PRL', tier1: { add: [['vitamin_b6', 'B6 P5P ↑50 мг — модуляция пролактина (D2)']] }, tier2: { add: [['cabergoline', 'Cabergoline 0.5 мг 2р/нед — D2-агонист']], nutrition: [['Dopamine', '↑ tyrosine, B6']] }, tier3: { alerts: ['⛔ Пролактин = {value} ng/mL — пролактининома? МРТ селлярной области. Эндокринолог срочно.'] } },

  { marker: 'TSH', tier1: { add: [['selenium', 'Selenium 200 мкг — кофактор дейодиназы D1/D2 (T4→T3)']], nutrition: [['Йод', '150-200 мкг/день (морская капуста/рыба)']] }, tier2: { add: [['selenium', 'Selenium 200 мкг']], nutrition: [['Доктор', 'Эндокринолог'], ['Йод', '200 мкг']] }, tier3: { alerts: ['ТТГ = {value} mU/L — гипотиреоз. Эндокринолог. Левотироксин.'] } },

  { marker: 'CORTISOL', tier1: { add: [['phosphatidylserine', 'Phosphatidylserine 300 мг — ↓ ACTH при стрессе'], ['theanine', 'Theanine 200 мг — ↓ тревога']], nutrition: [['Сон', '8+ часов'], ['Caffeine', '↓ кофеин <200 мг']] }, tier2: { titrate: [['phosphatidylserine', 1.5, 'PS ↑450 мг']], add: [['ashwagandha', 'Ашваганда 500 мг — если на ПКТ']], nutrition: [['Сон', '8+ ч'], ['Caffeine', '<200 мг']] }, tier3: { alerts: ['Кортизол = {value} nmol/L — гиперкортицизм? Эндокринолог.'] } },

  { marker: 'TESTOSTERONE', tier1: { nutrition: [['Цинк', '30 мг (если дефицит)'], ['Витамин D', '5000+ МЕ'], ['Сон', '8+ ч']] }, tier2: { add: [['hcg', 'hCG 500-1000 МЕ 2р/нед (восстановление)']], nutrition: [['Цинк', '30 мг'], ['D3', '10000 МЕ + K2']] }, tier3: { alerts: ['Testosterone = {value} nmol/L — тяжёлый гипогонадизм. Эндокринолог. Заместительная терапия.'] } },

  // ─── МЕТАБОЛИЧЕСКИЕ ───
  { marker: 'GLUCOSE', tier1: { add: [['berberine', 'Berberine 1500 мг — AMPK, ↓ глюкоза'], ['carnitine', 'L-Карнитин 2 г']], nutrition: [['Lowcarb', '<100 г/день'], ['Fiber', '30+ г'], ['TRE', 'Time-restricted eating 12 ч']] }, tier2: { titrate: [['berberine', 1.33, 'Berberine ↑2000 мг']], nutrition: [['Lowcarb', '<50 г/день'], ['STOP GH', 'Отменить GH/инсулин если есть'], ['Врач', 'Эндокринолог']] }, tier3: { alerts: ['⛔ Глюкоза = {value} mmol/L — тяжёлая гипергликемия/кетоацидоз риск. ОТМЕНИТЬ GH и инсулин. ER. Инсулин под контролем врача.'], stopCourse: true } },

  { marker: 'HBA1C', tier1: { add: [['berberine', 'Berberine 1500 мг']], nutrition: [['Lowcarb', '<100 г'], ['Walking', '10k steps/день']] }, tier2: { nutrition: [['STOP GH', 'Обязательно'], ['Врач', 'Эндокринолог'], ['Metformin?', 'Через врача']] }, tier3: { alerts: ['HbA1c = {value}% — сахарный диабет. Эндокринолог.'], stopCourse: false } },

  { marker: 'INSULIN', tier1: { add: [['berberine', 'Berberine 1500 мг'], ['carnitine', 'L-Карнитин 2 г']] }, tier2: { titrate: [['berberine', 1.33, 'Berberine ↑2000 мг']], nutrition: [['Lowcarb', '<30 г'], ['IF', '16:8 intermittent fasting']] }, tier3: { alerts: ['Инсулин = {value} mcU/mL — выраженная гиперинсулинемия. Эндокринолог.'] } },

  { marker: 'HOMAIR', tier1: { add: [['berberine', 'Berberine 1500 мг'], ['carnitine', 'L-Карнитин 2 г']], nutrition: [['Lowcarb', '<100 г'], ['Walking', '10k/день']] }, tier2: { titrate: [['berberine', 1.33, 'Berberine ↑2000 мг']], add: [['metformin', 'Metformin 500 мг (через врача)']], nutrition: [['Lowcarb', '<50 г'], ['IF', '16:8']] }, tier3: { alerts: ['HOMA-IR = {value} — тяжёлая инсулинорезистентность. Эндокринолог.'] } },

  { marker: 'HOMOCYSTEINE', tier1: { titrate: [['tmg', 1.5, 'TMG ↑1500 мг (было 1000)'], ['vitamin_b6', 2.0, 'B6 ↑50 мг'], ['vitamin_b12', 2.0, 'B12 ↑2000 мкг']], nutrition: [['↑ овощи', 'folate из овощей']] }, tier2: { titrate: [['tmg', 2.0, 'TMG ↑2000-3000 мг'], ['folate', 1.5, 'Folate ↑600 мкг']], nutrition: [['B-complex', 'Активные формы']] }, tier3: { alerts: ['Гомоцистеин = {value} mcmol/L — риск тромбоза. B6+B12+Folate+TMG высокие дозы. Врач.'] } },

  { marker: 'CRP', tier1: { add: [['curcumin', 'Curcumin 500 мг + Piperine — ↓ NF-κB'], ['omega3', 'Омега-3 ↑3 г']], nutrition: [['↑ omega-3', '2-3 г EPA/DHA'], ['↑ рыба', '3×/нед']] }, tier2: { titrate: [['omega3', 1.5, 'Омега-3 ↑4.5 г'], ['curcumin', 2.0, 'Curcumin ↑1000 мг']], nutrition: [['STOP alcohol', 'ZERO'], ['Sleep', '8+ ч']] }, tier3: { alerts: ['СРБ = {value} mg/L — выраженное воспаление. Врач. Исключить инфекцию/сепсис.'] } },

  { marker: 'FERRITIN', tier1: { add: [['iron_bisglycinate', 'Iron bisglycinate 30 мг'], ['vitamin_c', 'VitC 500 мг (↑ всасывание железа ×3)']], nutrition: [['Вместе с мясом', 'Heme-iron'], ['STOP tea/coffee', '1 час до/после еды']] }, tier2: { titrate: [['iron_bisglycinate', 2.0, 'Iron ↑60 мг']], add: [['vitamin_c', 'VitC 1000 мг']], nutrition: [['Врач', 'Гастро/гематолог']] }, tier3: { alerts: ['Ферритин = {value} ng/mL — избыток железа. Гематолог (исключить гемохроматоз); НЕ назначать железо.'] } },

  // ─── ВИТАМИНЫ/МИНЕРАЛЫ ───
  { marker: 'VITAMIN_D', tier1: { titrate: [['vitamin_d3', 2.0, 'D3 ↑10000 МЕ (было 5000)'], ['vitamin_k2', 2.0, 'K2 ↑200 мкг']], nutrition: [['Солнце', '15 мин/день']] }, tier2: { titrate: [['vitamin_d3', 4.0, 'D3 ↑20000 МЕ'], ['vitamin_k2', 2.0, 'K2 ↑200 мкг']], nutrition: [['Солнце', '20 мин/день']] }, tier3: { alerts: ['D3 = {value} ng/mL — тяжёлый дефицит. Врач. Высокие дозы под контролем.'] } },

  { marker: 'B12', tier1: { titrate: [['vitamin_b12', 2.0, 'B12 ↑2000 мкг (метилкобаламин)']], nutrition: [['Животные продукты', 'Мясо/рыба/яйца']] }, tier2: { titrate: [['vitamin_b12', 5.0, 'B12 ↑5000 мкг']], nutrition: [['Врач', 'Невролог если нейропатия']] }, tier3: { alerts: ['B12 = {value} pg/mL — нейропатия. Врач. Инъекции B12.'] } },

  { marker: 'MAGNESIUM', tier1: { titrate: [['magnesium', 1.5, 'Mg ↑600 мг']], nutrition: [['Mg-богатые', 'Орехи/семена/шпинат']] }, tier2: { titrate: [['magnesium', 2.0, 'Mg ↑800 мг']], nutrition: [['Внутривенно', 'Через врача если <0.5']] }, tier3: { alerts: ['Mg = {value} mmol/L — судороги/аритмия. ER.'] } },

  { marker: 'ZINC', tier1: { add: [['zinc', 'Цинк 30 мг']], nutrition: [['Орехи', 'Тыквенные семечки']] }, tier2: { titrate: [['zinc', 1.5, 'Zinc ↑45 мг']], add: [['copper', 'Copper 1 мг (баланс с цинком)']] }, tier3: { alerts: ['Цинк = {value} mcmol/L — иммунодефицит. Врач.'] } },

  { marker: 'POTASSIUM', tier1: { nutrition: [['↑ калий', '+ бананы/авокадо/картофель 3.5-5 г/день']] }, tier2: { add: [['potassium', 'K⁺ 200 мг (через врача)']], nutrition: [['↑ калий', '4-5 г/день']] }, tier3: { alerts: ['⛔ Калий = {value} mmol/L — ОПАСНО ДЛЯ ЖИЗНИ. Cardiac arrest risk. ER НЕМЕДЛЕННО.'] } },

  { marker: 'SODIUM', tier1: { nutrition: [['Соль', '5-6 г/день']] }, tier2: { nutrition: [['Соль', '↑8-10 г/день'], ['Вода', 'контроль intake']] }, tier3: { alerts: ['⛔ Натрий = {value} mmol/L — ЦНС депрессия/отёк мозга. ER.'] } },

  // ─── T3/T4 (тиреоид) ───
  { marker: 'TPO_AB', tier1: { add: [['selenium', 'Selenium 200 мкг']], nutrition: [['Gluten-free', 'Пробная безглютеновая диета 4 нед']] }, tier2: { titrate: [['selenium', 1.5, 'Selenium ↑300 мкг']], nutrition: [['Врач', 'Эндокринолог (АИТ)']] }, tier3: { alerts: ['TPO-АТ = {value} IU/mL — аутоиммунный тиреоидит. Эндокринолог.'] } },

  { marker: 'DHEA_S', tier1: { nutrition: [['DHEA', 'Через врача']] }, tier2: { nutrition: [['Врач', 'Эндокринолог']] }, tier3: { alerts: ['DHEA-S = {value} — критически низкий. Врач.'] } },

  { marker: 'SHBG', tier1: { nutrition: [['Белок', 'Сывороточный протеин']] }, tier2: { nutrition: [['Врач', 'Эндокринолог']] }, tier3: { alerts: ['SHBG = {value} nmol/L — значительно повышен. Эндокринолог.'] } },

  { marker: 'IGF1', tier1: { nutrition: [['Контроль GH', 'Проверить дозу GH']] }, tier2: { nutrition: [['↓ GH', 'Снизить GH']] }, tier3: { alerts: ['IGF-1 = {value} ng/mL — риск акромегалии. Эндокринолог. ↓ GH.'] } },

  { marker: 'URIC_ACID', tier1: { add: [['vitamin_c', 'VitC 1000 мг — ↑ выведение мочевой кислоты']], nutrition: [['↓ purine', 'Меньше красного мяса/морепродуктов'], ['Вода', '45+ мл/кг'], ['STOP alcohol', 'ZERO пиво']] }, tier2: { add: [['vitamin_c', 'VitC 2000 мг']], nutrition: [['STOP alcohol', 'ZERO'], ['Cherry', 'Вишнёвый сок (↓ uric acid)']] }, tier3: { alerts: ['Мочевая кислота = {value} — подагра. Ревматолог.'] } },

  { marker: 'ESR', tier1: { nutrition: [['Curcumin', '500 мг'], ['Omega-3', '3 г']] }, tier2: { add: [['curcumin', 'Curcumin 1000 мг'], ['omega3', 'Омега-3 4 г']], nutrition: [['Врач', 'Терапевт (инфекция/иммун)']] }, tier3: { alerts: ['СОЭ = {value} мм/ч — выраженное воспаление. Врач.'] } },

  { marker: 'AMMONIA', tier1: { add: [['nac', 'NAC 1200 мг'], ['l_carnitine', 'L-Карнитин 2 г']], nutrition: [['↓ белок', '1.5 г/кг временно']] }, tier2: { titrate: [['nac', 1.5, 'NAC ↑1800 мг'], ['l_carnitine', 2.0, 'Carnitine ↑4 г']], nutrition: [['STOP белок', '0.8 г/кг'], ['Lactulose', 'По рецепту врача']] }, tier3: { alerts: ['⛔ Аммиак = {value} mcmol/L — печёночная энцефалопатия. ER.'], stopCourse: true } },

  { marker: 'ALP', tier1: { add: [['tudca', 'TUDCA 500 мг — желчеотток']], nutrition: [['Витамин D', 'Проверить D3'] ] }, tier2: { titrate: [['tudca', 2.0, 'TUDCA ↑1000 мг']], nutrition: [['УЗИ', 'Кости/печень']] }, tier3: { alerts: ['ЩФ = {value} U/L — болезни костей или холестаз. Врач.'] } },
];

// ════════════════════════════════════════════════════════════════════════════
//  computeTierAdjustments — главная функция
// ════════════════════════════════════════════════════════════════════════════
export function computeTierAdjustments(labs: Record<string, number>): TierAdjustmentResult {
  const addSubs: TierAddSub[] = [];
  const titrations: TierTitration[] = [];
  const nutrition: TierNutritionTip[] = [];
  const alerts: TierAlert[] = [];
  const tierSummary: { marker: string; value: number; tier: Tier; label: string; unit: string }[] = [];
  let stopCourse = false;

  for (const [marker, value] of Object.entries(labs)) {
    if (typeof value !== 'number' || isNaN(value)) continue;
    const tier = deriveTier(marker, value);
    if (tier === 0) continue;

    const rule = TIER_RULES.find(r => r.marker === marker.toUpperCase());
    if (!rule) continue;

    tierSummary.push({
      marker,
      value,
      tier,
      label: '', // заполнить из LAB_TIERS если нужно
      unit: '',
    });

    // CRITICAL: калий/натрий — direction:'both'. Добавлять препарат/соль ТОЛЬКО при НИЗКОЙ стороне.
    // При ВЫСОКОЙ стороне (гиперкалиемия/гипернатриемия) добавка K⁺/соли — фатальна → ограничение.
    const mkey = marker.toUpperCase();
    const tdef = LAB_TIERS[mkey];
    const isHighSide = !!tdef && tdef.direction === 'both' && value > (tdef.normal[0] + tdef.normal[1]) / 2;
    if ((mkey === 'POTASSIUM' || mkey === 'SODIUM') && isHighSide && tier > 0 && tier < 3) {
      nutrition.push({
        action: mkey === 'POTASSIUM' ? '🛑 ОГРАНИЧИТЬ КАЛИЙ' : '🛑 ОГРАНИЧИТЬ НАТРИЙ',
        target: mkey === 'POTASSIUM'
          ? 'Исключить бананы/авокадо/картофель/апельсины/шпинат; диуретик (фуросемид/буметанид) по врачу; ЭКГ (риск аритмии)'
          : 'Снизить соль <3 г/день; контроль АД и водного баланса; врач (риск отёка мозга/сердца)',
        marker,
        tier,
      });
      continue;
    }

    if (tier === 1 && rule.tier1) {
      if (rule.tier1.add) {
        for (const [id, reason, dose] of rule.tier1.add) {
          addSubs.push({ id, reason, dose, tier, marker });
        }
      }
      if (rule.tier1.titrate) {
        for (const [id, factor, reason] of rule.tier1.titrate) {
          titrations.push({ id, factor, reason, tier, marker });
        }
      }
      if (rule.tier1.nutrition) {
        for (const [action, target] of rule.tier1.nutrition) {
          nutrition.push({ action, target, marker, tier });
        }
      }
    }

    if (tier === 2 && rule.tier2) {
      if (rule.tier2.add) {
        for (const [id, reason, dose] of rule.tier2.add) {
          addSubs.push({ id, reason, dose, tier, marker });
        }
      }
      if (rule.tier2.titrate) {
        for (const [id, factor, reason] of rule.tier2.titrate) {
          titrations.push({ id, factor, reason, tier, marker });
        }
      }
      if (rule.tier2.nutrition) {
        for (const [action, target] of rule.tier2.nutrition) {
          nutrition.push({ action, target, marker, tier });
        }
      }
    }

    if (tier === 3 && rule.tier3) {
      for (const alertTemplate of rule.tier3.alerts) {
        const message = alertTemplate.replace('{value}', String(value));
        alerts.push({ marker, value, tier, message, stopCourse: rule.tier3.stopCourse ?? false });
      }
      if (rule.tier3.stopCourse) stopCourse = true;
      if (rule.tier3.nutrition) {
        for (const [action, target] of rule.tier3.nutrition) {
          nutrition.push({ action, target, marker, tier });
        }
      }
    }
  }

  return { addSubs, titrations, nutrition, alerts, stopCourse, tierSummary };
}

// Утилита для UI: получить текст для каждого tier-маркёра
export function formatTierAlert(alert: TierAlert): string {
  return alert.message;
}