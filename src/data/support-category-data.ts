// ── FROM: categories.ts ──
export interface Category {
  id: string;
  type: string;
  name: string;
  description: string;
}

export const CATEGORIES_DB: Category[] = [
  { id: "CAT_SUB_VITAMINS", type: "SUBSTANCE", name: "Витамины", description: "Микронутриенты для метаболизма и иммунитета." },
  { id: "CAT_SUB_MINERALS", type: "SUBSTANCE", name: "Минералы", description: "Электролиты и кофакторы ферментов." },
  { id: "CAT_SUB_AMINO", type: "SUBSTANCE", name: "Аминокислоты", description: "Строительный материал и нейромедиаторы." },
  { id: "CAT_SUB_ADAPTOGENS", type: "SUBSTANCE", name: "Адаптогены", description: "Регуляция стресса и кортизола." },
  { id: "CAT_SUB_STIMULANTS", type: "SUBSTANCE", name: "Стимуляторы", description: "Повышение энергии и концентрации." },
  { id: "CAT_SUB_NOOTROPICS", type: "SUBSTANCE", name: "Ноотропы", description: "Когнитивная поддержка." },
  { id: "CAT_SUB_FATTYACIDS", type: "SUBSTANCE", name: "Жирные кислоты", description: "Противовоспалительные и структурные функции." },
  { id: "CAT_SUB_HERBS", type: "SUBSTANCE", name: "Травы", description: "Фитотерапия и модуляция систем." },
  { id: "CAT_SUB_PROBIOTICS", type: "SUBSTANCE", name: "Пробиотики", description: "Микробиота и ЖКТ." },
  { id: "CAT_SUB_ENZYMES", type: "SUBSTANCE", name: "Ферменты", description: "Улучшение пищеварения." },
  { id: "CAT_SUB_HORMONAL", type: "SUBSTANCE", name: "Гормональные вещества", description: "Регуляция эндокринной системы." },
  { id: "CAT_SUB_DETOX", type: "SUBSTANCE", name: "Детокс‑вещества", description: "Поддержка печени и антиоксидантов." },
  { id: "CAT_RISK_LIVER", type: "RISK", name: "Печень", description: "Риски, связанные с функцией печени." },
  { id: "CAT_RISK_KIDNEYS", type: "RISK", name: "Почки", description: "Риски почечной функции." },
  { id: "CAT_RISK_HEART", type: "RISK", name: "Сердце", description: "Кардио‑риски." },
  { id: "CAT_RISK_LUNGS", type: "RISK", name: "Лёгкие", description: "Риски дыхательной системы." },
  { id: "CAT_RISK_GUT", type: "RISK", name: "ЖКТ", description: "Риски пищеварения." },
  { id: "CAT_RISK_HORMONES", type: "RISK", name: "Гормоны", description: "Эндокринные риски." },
  { id: "CAT_RISK_BRAIN", type: "RISK", name: "Мозг", description: "Когнитивные и нервные риски." },
  { id: "CAT_RISK_BLOOD", type: "RISK", name: "Кровь", description: "Гематологические риски." },
  { id: "CAT_RISK_JOINTS", type: "RISK", name: "Суставы", description: "Опорно‑двигательные риски." },
  { id: "CAT_RISK_SKIN", type: "RISK", name: "Кожа", description: "Дерматологические риски." },
  { id: "CAT_RISK_VISION", type: "RISK", name: "Зрение", description: "Офтальмологические риски." },
  { id: "CAT_RISK_IMMUNE", type: "RISK", name: "Иммунитет", description: "Иммунные риски." },
  { id: "CAT_MECH_INFLAMMATION", type: "MECHANISM", name: "Воспаление", description: "Уровень системного воспаления." },
  { id: "CAT_MECH_CORTISOL", type: "MECHANISM", name: "Кортизол", description: "Стресс‑ось." },
  { id: "CAT_MECH_THYROID", type: "MECHANISM", name: "Щитовидка", description: "Гормоны T3/T4." },
  { id: "CAT_MECH_GABA", type: "MECHANISM", name: "GABA", description: "Тормозная система мозга." },
  { id: "CAT_MECH_DOPAMINE", type: "MECHANISM", name: "Дофамин", description: "Мотивация и энергия." },
  { id: "CAT_MECH_SEROTONIN", type: "MECHANISM", name: "Серотонин", description: "Настроение и сон." },
  { id: "CAT_MECH_LIPIDS", type: "MECHANISM", name: "Липиды", description: "Жировой обмен." },
  { id: "CAT_MECH_GLUCOSE", type: "MECHANISM", name: "Глюкоза", description: "Углеводный обмен." },
  { id: "CAT_MECH_OXIDATIVE", type: "MECHANISM", name: "Окисление", description: "Антиоксидантный статус." },
  { id: "CAT_MECH_DETOX", type: "MECHANISM", name: "Детокс", description: "Функция печени." },
  { id: "CAT_ORGAN_LIVER", type: "ORGAN", name: "Печень", description: "Метаболизм и детокс." },
  { id: "CAT_ORGAN_KIDNEYS", type: "ORGAN", name: "Почки", description: "Фильтрация и электролиты." },
  { id: "CAT_ORGAN_HEART", type: "ORGAN", name: "Сердце", description: "Кровообращение." },
  { id: "CAT_ORGAN_LUNGS", type: "ORGAN", name: "Лёгкие", description: "Дыхание." },
  { id: "CAT_ORGAN_GUT", type: "ORGAN", name: "ЖКТ", description: "Пищеварение и микробиота." },
  { id: "CAT_ORGAN_BRAIN", type: "ORGAN", name: "Мозг", description: "ЦНС и когнитивные функции." },
  { id: "CAT_ORGAN_HORMONES", type: "ORGAN", name: "Гормоны", description: "Эндокринная система." },
  { id: "CAT_ORGAN_IMMUNE", type: "ORGAN", name: "Иммунитет", description: "Защитные функции." },
  { id: "CAT_ORGAN_BLOOD", type: "ORGAN", name: "Кровь", description: "Гемостаз и перенос кислорода." },
  { id: "CAT_ORGAN_JOINTS", type: "ORGAN", name: "Суставы", description: "Опорно‑двигательная система." },
  { id: "CAT_ORGAN_SKIN", type: "ORGAN", name: "Кожа", description: "Барьер и воспаление." },
  { id: "CAT_ORGAN_EYES", type: "ORGAN", name: "Глаза", description: "Зрение." },
  { id: "CAT_AXIS_LIVER_THYROID", type: "AXIS", name: "Печень–Щитовидка", description: "Конверсия T4→T3." },
  { id: "CAT_AXIS_GUT_BRAIN", type: "AXIS", name: "Кишечник–Мозг", description: "Серотонин и воспаление." },
  { id: "CAT_AXIS_ADRENAL_GONAD", type: "AXIS", name: "Надпочечники–Гонады", description: "Кортизол и половые гормоны." },
  { id: "CAT_AXIS_HEART_KIDNEY", type: "AXIS", name: "Сердце–Почки", description: "Давление и фильтрация." },
  { id: "CAT_AXIS_LIVER_GUT", type: "AXIS", name: "Печень–ЖКТ", description: "Желчь и микробиота." },
  { id: "CAT_AXIS_GUT_IMMUNE", type: "AXIS", name: "ЖКТ–Иммунитет", description: "Барьер и воспаление." },
  { id: "CAT_AXIS_BRAIN_ADRENAL", type: "AXIS", name: "Мозг–Надпочечники", description: "Стресс‑ось." },
  { id: "CAT_AXIS_LIVER_SKIN", type: "AXIS", name: "Печень–Кожа", description: "Детокс и воспаление." },
  { id: "CAT_AXIS_EYES_BRAIN", type: "AXIS", name: "Глаза–Мозг", description: "Нагрузка и когнитивная связь." },
  { id: "CAT_SYSTEM_LIVER", type: "SYSTEM", name: "Печень", description: "Состояние печени." },
  { id: "CAT_SYSTEM_KIDNEYS", type: "SYSTEM", name: "Почки", description: "Состояние почек." },
  { id: "CAT_SYSTEM_HEART", type: "SYSTEM", name: "Сердце", description: "Состояние сердца." },
  { id: "CAT_SYSTEM_GUT", type: "SYSTEM", name: "ЖКТ", description: "Состояние пищеварения." },
  { id: "CAT_SYSTEM_BRAIN", type: "SYSTEM", name: "Мозг", description: "Состояние ЦНС." },
  { id: "CAT_SYSTEM_HORMONES", type: "SYSTEM", name: "Гормоны", description: "Состояние эндокринной системы." },
  { id: "CAT_SYSTEM_IMMUNE", type: "SYSTEM", name: "Иммунитет", description: "Состояние иммунной системы." },
  { id: "CAT_GLOBAL_SLEEP", type: "GLOBAL", name: "Сон", description: "Гигиена сна." },
  { id: "CAT_GLOBAL_STRESS", type: "GLOBAL", name: "Стресс", description: "Уровень стресса." },
  { id: "CAT_GLOBAL_DIET", type: "GLOBAL", name: "Питание", description: "Качество рациона." },
  { id: "CAT_GLOBAL_ACTIVITY", type: "GLOBAL", name: "Активность", description: "Физическая нагрузка." },
  { id: "CAT_GLOBAL_WATER", type: "GLOBAL", name: "Вода", description: "Гидратация." },
  { id: "CAT_GLOBAL_CAFFEINE", type: "GLOBAL", name: "Кофеин", description: "Стимуляторы." },
  { id: "CAT_GLOBAL_ALCOHOL", type: "GLOBAL", name: "Алкоголь", description: "Нагрузка алкоголем." },
  { id: "CAT_GLOBAL_SUGAR", type: "GLOBAL", name: "Сахар", description: "Углеводная нагрузка." },
  { id: "CAT_GLOBAL_SCREENS", type: "GLOBAL", name: "Экраны", description: "Цифровая нагрузка." },
  { id: "CAT_GLOBAL_RECOVERY", type: "GLOBAL", name: "Восстановление", description: "Регенерация." },
  { id: "CAT_GLOBAL_CIRCADIAN", type: "GLOBAL", name: "Циркадные ритмы", description: "Режим дня." }
];
// ── FROM: effects.ts ──
export type EffectType = 'DIRECT' | 'SYSTEMIC';

export interface Effect {
  id: string;
  type: EffectType;
  description: string;
  riskId: string;
}

export const EFFECTS_DB: Effect[] = [
  { id: "GABA_UP", type: "DIRECT", description: "Повышает активность GABA-рецепторов", riskId: "GABA_UP" },
  { id: "GABA_DOWN", type: "DIRECT", description: "Снижает активность GABA-рецепторов", riskId: "GABA_DOWN" },
  { id: "SEROTONIN_UP", type: "DIRECT", description: "Повышает уровень серотонина", riskId: "SEROTONIN_UP" },
  { id: "SEROTONIN_DOWN", type: "DIRECT", description: "Снижает уровень серотонина", riskId: "SEROTONIN_DOWN" },
  { id: "DOPAMINE_UP", type: "DIRECT", description: "Повышает уровень дофамина", riskId: "DOPAMINE_UP" },
  { id: "DOPAMINE_DOWN", type: "DIRECT", description: "Снижает уровень дофамина", riskId: "DOPAMINE_DOWN" },
  { id: "NE_UP", type: "DIRECT", description: "Повышает норадреналин", riskId: "NE_UP" },
  { id: "NE_DOWN", type: "DIRECT", description: "Снижает норадреналин", riskId: "NE_DOWN" },
  { id: "CORTISOL_UP", type: "SYSTEMIC", description: "Повышает кортизол", riskId: "CORTISOL_UP" },
  { id: "CORTISOL_DOWN", type: "SYSTEMIC", description: "Снижает кортизол", riskId: "CORTISOL_DOWN" },
  { id: "ADRENALINE_UP", type: "DIRECT", description: "Повышает адреналин", riskId: "ADRENALINE_UP" },
  { id: "ADRENALINE_DOWN", type: "DIRECT", description: "Снижает адреналин", riskId: "ADRENALINE_DOWN" },
  { id: "T3_T4_UP", type: "DIRECT", description: "Повышает активность щитовидных гормонов", riskId: "T3_T4_UP" },
  { id: "T3_T4_DOWN", type: "DIRECT", description: "Снижает активность щитовидных гормонов", riskId: "T3_T4_DOWN" },
  { id: "IODINE_UP", type: "DIRECT", description: "Повышает доступность йода", riskId: "T3_T4_UP" },
  { id: "INSULIN_SENS_UP", type: "SYSTEMIC", description: "Повышает чувствительность к инсулину", riskId: "GLUCOSE_UP" },
  { id: "INSULIN_SENS_DOWN", type: "SYSTEMIC", description: "Снижает чувствительность к инсулину", riskId: "GLUCOSE_DOWN" },
  { id: "GLUCOSE_UP", type: "DIRECT", description: "Повышает глюкозу", riskId: "GLUCOSE_UP" },
  { id: "GLUCOSE_DOWN", type: "DIRECT", description: "Снижает глюкозу", riskId: "GLUCOSE_DOWN" },
  { id: "LIPIDS_UP", type: "SYSTEMIC", description: "Повышает липиды", riskId: "LIPIDS_UP" },
  { id: "LIPIDS_DOWN", type: "SYSTEMIC", description: "Снижает липиды", riskId: "LIPIDS_DOWN" },
  { id: "LDL_UP", type: "DIRECT", description: "Повышает ЛПНП", riskId: "LIPIDS_UP" },
  { id: "LDL_DOWN", type: "DIRECT", description: "Снижает ЛПНП", riskId: "LIPIDS_DOWN" },
  { id: "HDL_UP", type: "DIRECT", description: "Повышает ЛПВП", riskId: "LIPIDS_DOWN" },
  { id: "HDL_DOWN", type: "DIRECT", description: "Снижает ЛПВП", riskId: "LIPIDS_UP" },
  { id: "TG_UP", type: "DIRECT", description: "Повышает триглицериды", riskId: "LIPIDS_UP" },
  { id: "TG_DOWN", type: "DIRECT", description: "Снижает триглицериды", riskId: "LIPIDS_DOWN" },
  { id: "INFLAMMATION_UP", type: "SYSTEMIC", description: "Повышает воспаление", riskId: "INFLAMMATION_UP" },
  { id: "INFLAMMATION_DOWN", type: "SYSTEMIC", description: "Снижает воспаление", riskId: "INFLAMMATION_DOWN" },
  { id: "NFkB_DOWN", type: "DIRECT", description: "Снижает NF-kB", riskId: "INFLAMMATION_DOWN" },
  { id: "COX_DOWN", type: "DIRECT", description: "Снижает COX", riskId: "INFLAMMATION_DOWN" },
  { id: "OXIDATIVE_STRESS_UP", type: "SYSTEMIC", description: "Повышает оксидативный стресс", riskId: "OXIDATIVE_UP" },
  { id: "OXIDATIVE_STRESS_DOWN", type: "SYSTEMIC", description: "Снижает оксидативный стресс", riskId: "OXIDATIVE_DOWN" },
  { id: "ANTIOX_UP", type: "DIRECT", description: "Повышает антиоксидантную защиту", riskId: "OXIDATIVE_DOWN" },
  { id: "BILE_FLOW_UP", type: "DIRECT", description: "Улучшает отток желчи", riskId: "BILE_FLOW_UP" },
  { id: "BILE_FLOW_DOWN", type: "DIRECT", description: "Снижает отток желчи", riskId: "BILE_FLOW_DOWN" },
  { id: "DETOX_UP", type: "SYSTEMIC", description: "Ускоряет детокс печени", riskId: "DETOX_UP" },
  { id: "DETOX_DOWN", type: "SYSTEMIC", description: "Замедляет детокс печени", riskId: "DETOX_DOWN" },
  { id: "MICROBIOME_UP", type: "SYSTEMIC", description: "Улучшает микробиоту", riskId: "MICROBIOME_UP" },
  { id: "MICROBIOME_DOWN", type: "SYSTEMIC", description: "Ухудшает микробиоту", riskId: "MICROBIOME_DOWN" },
  { id: "LPS_UP", type: "SYSTEMIC", description: "Повышает эндотоксины", riskId: "LPS_UP" },
  { id: "LPS_DOWN", type: "SYSTEMIC", description: "Снижает эндотоксины", riskId: "LPS_DOWN" },
  { id: "NO_UP", type: "DIRECT", description: "Повышает оксид азота", riskId: "NO_UP" },
  { id: "NO_DOWN", type: "DIRECT", description: "Снижает оксид азота", riskId: "NO_DOWN" },
  { id: "HR_UP", type: "DIRECT", description: "Повышает ЧСС", riskId: "CARDIO_UP" },
  { id: "HR_DOWN", type: "DIRECT", description: "Снижает ЧСС", riskId: "CARDIO_DOWN" },
  { id: "BP_UP", type: "DIRECT", description: "Повышает давление", riskId: "CARDIO_UP" },
  { id: "BP_DOWN", type: "DIRECT", description: "Снижает давление", riskId: "CARDIO_DOWN" },
  { id: "PLATELETS_UP", type: "DIRECT", description: "Повышает тромбоциты", riskId: "COAG_UP" },
  { id: "PLATELETS_DOWN", type: "DIRECT", description: "Снижает тромбоциты", riskId: "COAG_DOWN" },
  { id: "COAG_UP", type: "SYSTEMIC", description: "Повышает свёртываемость", riskId: "COAG_UP" },
  { id: "COAG_DOWN", type: "SYSTEMIC", description: "Снижает свёртываемость", riskId: "COAG_DOWN" },
  { id: "MOTILITY_UP", type: "DIRECT", description: "Ускоряет моторику ЖКТ", riskId: "GUT_UP" },
  { id: "MOTILITY_DOWN", type: "DIRECT", description: "Замедляет моторику ЖКТ", riskId: "GUT_DOWN" },
  { id: "ACID_UP", type: "DIRECT", description: "Повышает кислотность желудка", riskId: "GUT_UP" },
  { id: "ACID_DOWN", type: "DIRECT", description: "Снижает кислотность желудка", riskId: "GUT_DOWN" },
  { id: "IMMUNE_UP", type: "SYSTEMIC", description: "Повышает иммунитет", riskId: "IMMUNE_UP" },
  { id: "IMMUNE_DOWN", type: "SYSTEMIC", description: "Снижает иммунитет", riskId: "IMMUNE_DOWN" },
  { id: "AUTOIMMUNE_UP", type: "SYSTEMIC", description: "Повышает аутоиммунную активность", riskId: "IMMUNE_UP" },
  { id: "MITO_UP", type: "DIRECT", description: "Улучшает митохондрии", riskId: "ENERGY_UP" },
  { id: "MITO_DOWN", type: "DIRECT", description: "Снижает митохондриальную функцию", riskId: "ENERGY_DOWN" },
  { id: "ATP_UP", type: "DIRECT", description: "Повышает энергию", riskId: "ENERGY_UP" },
  { id: "ATP_DOWN", type: "DIRECT", description: "Снижает энергию", riskId: "ENERGY_DOWN" }
];
// ── FROM: mechanisms.ts ──
export interface Mechanism {
  id: string;
  name: string;
  systemsUp: string[];
  systemsDown: string[];
  effectsPositive: string[];
  effectsNegative: string[];
}

export const MECHANISMS_DB: Mechanism[] = [
  { id: "GABA_UP", name: "Повышение GABA", systemsUp: ["BRAIN"], systemsDown: [], effectsPositive: ["BRAIN_ANXIETY_DOWN"], effectsNegative: ["BRAIN_ANXIETY"] },
  { id: "GABA_DOWN", name: "Снижение GABA", systemsUp: [], systemsDown: ["BRAIN"], effectsPositive: [], effectsNegative: ["BRAIN_SLEEP_ISSUES"] },
  { id: "SEROTONIN_UP", name: "Повышение серотонина", systemsUp: ["BRAIN", "GUT"], systemsDown: [], effectsPositive: ["BRAIN_DEPRESSION_DOWN"], effectsNegative: ["BRAIN_DEPRESSION"] },
  { id: "SEROTONIN_DOWN", name: "Снижение серотонина", systemsUp: [], systemsDown: ["BRAIN"], effectsPositive: [], effectsNegative: ["BRAIN_SLEEP_ISSUES"] },
  { id: "DOPAMINE_UP", name: "Повышение дофамина", systemsUp: ["BRAIN"], systemsDown: [], effectsPositive: ["BRAIN_FOG_DOWN"], effectsNegative: ["BRAIN_FOG"] },
  { id: "DOPAMINE_DOWN", name: "Снижение дофамина", systemsUp: [], systemsDown: ["BRAIN"], effectsPositive: [], effectsNegative: ["BRAIN_MOTIVATION_LOW"] },
  { id: "CORTISOL_UP", name: "Повышение кортизола", systemsUp: ["ADRENALS"], systemsDown: ["BRAIN", "GUT"], effectsPositive: [], effectsNegative: ["HORMONE_LOW_T"] },
  { id: "CORTISOL_DOWN", name: "Снижение кортизола", systemsUp: ["BRAIN", "ADRENALS"], systemsDown: [], effectsPositive: [], effectsNegative: [] },
  { id: "T3_T4_UP", name: "Повышение щитовидных гормонов", systemsUp: ["THYROID", "LIVER"], systemsDown: [], effectsPositive: [], effectsNegative: ["HORMONE_HYPER"] },
  { id: "T3_T4_DOWN", name: "Снижение щитовидных гормонов", systemsUp: [], systemsDown: ["THYROID"], effectsPositive: [], effectsNegative: [] },
  { id: "GLUCOSE_UP", name: "Повышение глюкозы", systemsUp: [], systemsDown: ["PANCREAS"], effectsPositive: [], effectsNegative: ["INSULIN_RESISTANCE"] },
  { id: "GLUCOSE_DOWN", name: "Снижение глюкозы", systemsUp: ["PANCREAS"], systemsDown: [], effectsPositive: [], effectsNegative: [] },
  { id: "LIPIDS_UP", name: "Повышение липидов", systemsUp: [], systemsDown: ["HEART"], effectsPositive: [], effectsNegative: ["HEART_ATHEROSCLEROSIS"] },
  { id: "LIPIDS_DOWN", name: "Снижение липидов", systemsUp: ["HEART"], systemsDown: [], effectsPositive: [], effectsNegative: [] },
  { id: "INFLAMMATION_UP", name: "Повышение воспаления", systemsUp: [], systemsDown: ["ALL"], effectsPositive: [], effectsNegative: ["ALL_DISEASE"] },
  { id: "INFLAMMATION_DOWN", name: "Снижение воспаления", systemsUp: ["ALL"], systemsDown: [], effectsPositive: [], effectsNegative: [] },
  { id: "OXIDATIVE_UP", name: "Повышение оксидативного стресса", systemsUp: [], systemsDown: ["ALL"], effectsPositive: [], effectsNegative: ["AGING"] },
  { id: "OXIDATIVE_DOWN", name: "Снижение оксидативного стресса", systemsUp: ["ALL"], systemsDown: [], effectsPositive: [], effectsNegative: [] },
  { id: "DETOX_UP", name: "Ускорение детокса", systemsUp: ["LIVER"], systemsDown: [], effectsPositive: [], effectsNegative: ["LIVER_TOXICITY"] },
  { id: "DETOX_DOWN", name: "Замедление детокса", systemsUp: [], systemsDown: ["LIVER"], effectsPositive: [], effectsNegative: [] },
  { id: "BILE_FLOW_UP", name: "Улучшение желчи", systemsUp: ["LIVER", "GI"], systemsDown: [], effectsPositive: [], effectsNegative: ["LIVER_CHOLESTASIS"] },
  { id: "BILE_FLOW_DOWN", name: "Снижение желчи", systemsUp: [], systemsDown: ["GI"], effectsPositive: [], effectsNegative: ["GI_DYSBIOSIS"] },
  { id: "MICROBIOME_UP", name: "Улучшение микробиоты", systemsUp: ["GI"], systemsDown: [], effectsPositive: [], effectsNegative: ["IMMUNE_AUTOIMMUNE"] },
  { id: "MICROBIOME_DOWN", name: "Ухудшение микробиоты", systemsUp: [], systemsDown: ["GI"], effectsPositive: [], effectsNegative: ["IMMUNE_AUTOIMMUNE"] },
  { id: "NO_UP", name: "Повышение NO", systemsUp: ["HEART"], systemsDown: [], effectsPositive: [], effectsNegative: ["ERECTION_UP"] },
  { id: "NO_DOWN", name: "Снижение NO", systemsUp: [], systemsDown: ["HEART"], effectsPositive: [], effectsNegative: ["ERECTION_DOWN"] },
  { id: "CARDIO_UP", name: "Повышение нагрузки на сердце", systemsUp: [], systemsDown: ["HEART"], effectsPositive: [], effectsNegative: ["HEART_FAILURE"] },
  { id: "CARDIO_DOWN", name: "Снижение нагрузки на сердце", systemsUp: ["HEART"], systemsDown: [], effectsPositive: [], effectsNegative: [] },
  { id: "COAG_UP", name: "Повышение свёртываемости", systemsUp: [], systemsDown: ["BLOOD"], effectsPositive: [], effectsNegative: ["BLOOD_THICK"] },
  { id: "COAG_DOWN", name: "Снижение свёртываемости", systemsUp: ["BLOOD"], systemsDown: [], effectsPositive: [], effectsNegative: [] },
  { id: "GUT_UP", name: "Улучшение ЖКТ", systemsUp: ["GI"], systemsDown: [], effectsPositive: [], effectsNegative: ["GI_REFLUX"] },
  { id: "GUT_DOWN", name: "Снижение функции ЖКТ", systemsUp: [], systemsDown: ["GI"], effectsPositive: [], effectsNegative: ["GI_DYSBIOSIS"] },
  { id: "IMMUNE_UP", name: "Повышение иммунитета", systemsUp: ["IMMUNE_SYSTEM"], systemsDown: [], effectsPositive: [], effectsNegative: ["AUTOIMMUNE_UP"] },
  { id: "IMMUNE_DOWN", name: "Снижение иммунитета", systemsUp: [], systemsDown: ["IMMUNE_SYSTEM"], effectsPositive: [], effectsNegative: ["INFECTION_RISK"] },
  { id: "ENERGY_UP", name: "Повышение энергии", systemsUp: ["ALL"], systemsDown: [], effectsPositive: [], effectsNegative: ["FATIGUE"] },
  { id: "ENERGY_DOWN", name: "Снижение энергии", systemsUp: [], systemsDown: ["ALL"], effectsPositive: [], effectsNegative: ["LOW_ENERGY"] }
];
// ── FROM: axes.ts ──
export interface Axis {
  id: string;
  name: string;
  organs: string[];
  description: string;
  mechanismUp: string[];
  mechanismDown: string[];
  riskUp: string[];
  riskDown: string[];
}

export const AXES_DB: Axis[] = [
  { id: "AXIS_LIVER_THYROID", name: "Liver → Thyroid Axis", organs: ["LIVER", "THYROID"], description: "Печень активирует T4→T3", mechanismUp: ["DETOX_UP", "T3_T4_UP"], mechanismDown: ["TOXIC_LOAD", "INFLAMMATION"], riskUp: ["LIVER_FATTY", "LIVER_NASH", "LIVER_CHOLESTASIS"], riskDown: ["HORMONE_HYPO"] },
  { id: "AXIS_THYROID_LIVER", name: "Thyroid → Liver Axis", organs: ["THYROID", "LIVER"], description: "Тиреоидные гормоны регулируют липиды и желчь", mechanismUp: ["T3_T4_UP"], mechanismDown: ["LIPID_DISORDER", "BILE_STASIS"], riskUp: ["HORMONE_HYPO", "HORMONE_HYPER"], riskDown: ["LIVER_FATTY"] },
  { id: "AXIS_GUT_BRAIN", name: "Gut → Brain Axis", organs: ["GI", "BRAIN"], description: "Микробиота управляет серотонином и воспалением", mechanismUp: ["SCFA_UP", "SEROTONIN_UP"], mechanismDown: ["DYSBIOSIS", "INFLAMMATION"], riskUp: ["GI_DYSBIOSIS", "GI_IBS"], riskDown: ["BRAIN_ANXIETY", "BRAIN_DEPRESSION"] },
  { id: "AXIS_BRAIN_GUT", name: "Brain → Gut Axis", organs: ["BRAIN", "GI"], description: "Стресс влияет на моторику и кислотность", mechanismUp: ["CORTISOL_UP", "NE_UP"], mechanismDown: ["MOTILITY_DOWN", "ACID_DOWN"], riskUp: ["BRAIN_ANXIETY", "BRAIN_BURNOUT"], riskDown: ["GI_IBS", "GI_REFLUX"] },
  { id: "AXIS_ADRENAL_GONAD", name: "Adrenals → Gonads Axis", organs: ["ADRENALS", "TESTES", "OVARIES"], description: "Кортизол подавляет половые гормоны", mechanismUp: ["CORTISOL_UP"], mechanismDown: ["TESTOSTERONE_DOWN", "ESTROGEN_DOWN"], riskUp: ["HORMONE_HIGH_CORTISOL"], riskDown: ["HORMONE_LOW_T", "HORMONE_LOW_E2"] },
  { id: "AXIS_GONAD_ADRENAL", name: "Gonads → Adrenals Axis", organs: ["TESTES", "OVARIES", "ADRENALS"], description: "Половые гормоны регулируют стресс‑ответ", mechanismUp: ["TESTOSTERONE_UP", "ESTROGEN_UP"], mechanismDown: ["CORTISOL_UP"], riskUp: ["HORMONE_LOW_T", "HORMONE_LOW_E2"], riskDown: ["HORMONE_HIGH_CORTISOL"] },
  { id: "AXIS_LIVER_GUT", name: "Liver → Gut Axis", organs: ["LIVER", "GI"], description: "Желчь регулирует микробиоту и переваривание", mechanismUp: ["BILE_FLOW_UP"], mechanismDown: ["STASIS", "DYSBIOSIS"], riskUp: ["LIVER_CHOLESTASIS", "LIVER_BILE_SLUDGE"], riskDown: ["GI_DYSBIOSIS"] },
  { id: "AXIS_GUT_LIVER", name: "Gut → Liver Axis", organs: ["GI", "LIVER"], description: "Эндотоксины → воспаление печени", mechanismUp: ["LPS_DOWN", "SCFA_UP"], mechanismDown: ["INFLAMMATION_UP"], riskUp: ["GI_DYSBIOSIS"], riskDown: ["LIVER_NASH", "LIVER_FATTY"] },
  { id: "AXIS_HEART_KIDNEY", name: "Heart → Kidney Axis", organs: ["HEART", "KIDNEYS"], description: "Сердечный выброс регулирует фильтрацию", mechanismUp: ["GFR_UP"], mechanismDown: ["GFR_DOWN", "EDEMA"], riskUp: ["HEART_FAILURE"], riskDown: ["KIDNEY_CKD"] },
  { id: "AXIS_KIDNEY_HEART", name: "Kidney → Heart Axis", organs: ["KIDNEYS", "HEART"], description: "Электролиты управляют ритмом сердца", mechanismUp: ["ELECTROLYTES_UP"], mechanismDown: ["ELECTROLYTES_DOWN"], riskUp: ["KIDNEY_CKD", "KIDNEY_ELECTROLYTE_IMBALANCE"], riskDown: ["HEART_ARRHYTHMIA"] },
  { id: "AXIS_LIVER_HORMONES", name: "Liver → Hormones Axis", organs: ["LIVER", "HORMONES"], description: "Печень очищает эстрогены и гормоны", mechanismUp: ["DETOX_UP"], mechanismDown: ["CLEARANCE_DOWN"], riskUp: ["LIVER_FATTY", "LIVER_CHOLESTASIS"], riskDown: ["HORMONE_HIGH_E2"] },
  { id: "AXIS_HORMONES_LIVER", name: "Hormones → Liver Axis", organs: ["HORMONES", "LIVER"], description: "Эстрогены влияют на желчь и липиды", mechanismUp: ["ESTROGEN_UP"], mechanismDown: ["BILE_STASIS"], riskUp: ["HORMONE_HIGH_E2"], riskDown: ["LIVER_CHOLESTASIS"] },
  { id: "AXIS_IMMUNE_GUT", name: "Immune → Gut Axis", organs: ["IMMUNE_SYSTEM", "GI"], description: "Иммунитет управляет барьером кишечника", mechanismUp: ["IMMUNE_UP"], mechanismDown: ["INFLAMMATION_UP"], riskUp: ["IMMUNE_AUTOIMMUNE"], riskDown: ["GI_IBD"] },
  { id: "AXIS_GUT_IMMUNE", name: "Gut → Immune Axis", organs: ["GI", "IMMUNE_SYSTEM"], description: "Микробиота регулирует иммунитет", mechanismUp: ["SCFA_UP"], mechanismDown: ["DYSBIOSIS"], riskUp: ["GI_DYSBIOSIS"], riskDown: ["IMMUNE_LOW", "IMMUNE_ALLERGY"] },
  { id: "AXIS_BRAIN_ADRENAL", name: "Brain → Adrenal Axis", organs: ["BRAIN", "ADRENALS"], description: "Стресс → кортизол", mechanismUp: ["CORTISOL_UP"], mechanismDown: ["HPA_DYSREGULATION"], riskUp: ["BRAIN_ANXIETY", "BRAIN_BURNOUT"], riskDown: ["HORMONE_HIGH_CORTISOL"] },
  { id: "AXIS_ADRENAL_BRAIN", name: "Adrenal → Brain Axis", organs: ["ADRENALS", "BRAIN"], description: "Кортизол влияет на настроение", mechanismUp: ["CORTISOL_UP"], mechanismDown: ["SEROTONIN_DOWN"], riskUp: ["HORMONE_HIGH_CORTISOL"], riskDown: ["BRAIN_DEPRESSION", "BRAIN_BRAIN_FOG"] },
  { id: "AXIS_HEART_LIVER", name: "Heart → Liver Axis", organs: ["HEART", "LIVER"], description: "Кровоток влияет на детокс", mechanismUp: ["CO_UP"], mechanismDown: ["DETOX_DOWN"], riskUp: ["HEART_FAILURE"], riskDown: ["LIVER_CONGESTION"] },
  { id: "AXIS_LIVER_HEART", name: "Liver → Heart Axis", organs: ["LIVER", "HEART"], description: "Липиды → сосуды", mechanismUp: ["LIPIDS_UP"], mechanismDown: ["INFLAMMATION_UP"], riskUp: ["LIVER_FATTY", "LIVER_NASH"], riskDown: ["HEART_ATHEROSCLEROSIS"] },
  { id: "AXIS_KIDNEY_ELECTROLYTES", name: "Kidney → Electrolytes Axis", organs: ["KIDNEYS", "CELLS"], description: "Почки регулируют натрий/калий", mechanismUp: ["ELECTROLYTES_UP"], mechanismDown: ["ELECTROLYTES_DOWN"], riskUp: ["KIDNEY_CKD"], riskDown: ["HEART_ARRHYTHMIA"] },
  { id: "AXIS_ELECTROLYTES_HEART", name: "Electrolytes → Heart Axis", organs: ["CELLS", "HEART"], description: "Электролиты управляют ритмом сердца", mechanismUp: ["K_UP", "MG_UP"], mechanismDown: ["K_DOWN", "MG_DOWN"], riskUp: ["KIDNEY_ELECTROLYTE_IMBALANCE"], riskDown: ["HEART_ARRHYTHMIA"] },
  { id: "AXIS_LIVER_SKIN", name: "Liver → Skin Axis", organs: ["LIVER", "SKIN"], description: "Токсины → кожа", mechanismUp: ["DETOX_UP"], mechanismDown: ["TOXIC_LOAD_UP"], riskUp: ["LIVER_DETOX_OVERLOAD"], riskDown: ["SKIN_ACNE", "SKIN_ECZEMA"] },
  { id: "AXIS_SKIN_IMMUNE", name: "Skin → Immune Axis", organs: ["SKIN", "IMMUNE_SYSTEM"], description: "Кожа отражает иммунный статус", mechanismUp: ["INFLAMMATION_UP"], mechanismDown: ["BARRIER_DOWN"], riskUp: ["SKIN_ECZEMA", "SKIN_PSORIASIS"], riskDown: ["IMMUNE_AUTOIMMUNE"] },
  { id: "AXIS_EYES_BRAIN", name: "Eyes → Brain Axis", organs: ["EYES", "BRAIN"], description: "Зрение связано с когнитивной нагрузкой", mechanismUp: ["RETINA_UP"], mechanismDown: ["NEUROFATIGUE_UP"], riskUp: ["VISION_AGE"], riskDown: ["BRAIN_BRAIN_FOG"] },
  { id: "AXIS_BRAIN_EYES", name: "Brain → Eyes Axis", organs: ["BRAIN", "EYES"], description: "Стресс влияет на аккомодацию", mechanismUp: ["CORTISOL_UP"], mechanismDown: ["ACCOMMODATION_DOWN"], riskUp: ["BRAIN_ANXIETY"], riskDown: ["VISION_MYOPIA"] }
];
// ── FROM: brands.ts ──
export interface Brand {
  id: string;
  name: string;
  type: string;
  country: string;
  description: string;
}

export const BRANDS_DB: Brand[] = [
  { id: "BRAND_HEALTH_FACTOR", name: "Health Factor", type: "brand", country: "Россия", description: "Производитель БАДов и нутра" },
  { id: "BRAND_DR_BADY", name: "DR.BADY", type: "brand", country: "Россия", description: "Российский бренд нутра" },
  { id: "BRAND_EASY_MAGIC", name: "Easy Magic", type: "brand", country: "Россия", description: "Российский бренд функциональных комплексов" },
  { id: "BRAND_MENTOR_MIND", name: "Mentor Mind", type: "brand", country: "Россия", description: "Нейро‑нутра и когнитивные комплексы" },
  { id: "BRAND_ASMD", name: "ASMD", type: "brand", country: "Россия", description: "Российский бренд спортивной и функциональной нутра" },
  { id: "BRAND_LIFE_EXTENSION", name: "Life Extension", type: "brand", country: "США", description: "Премиальная нутра и научные формулы" },
  { id: "BRAND_THORNE", name: "Thorne Research", type: "brand", country: "США", description: "Профессиональная нутра высокого уровня" },
  { id: "BRAND_PURE_ENCAPS", name: "Pure Encapsulations", type: "brand", country: "США", description: "Гипоаллергенные премиальные комплексы" },
  { id: "BRAND_NOW_FOODS", name: "Now Foods", type: "brand", country: "США", description: "Один из крупнейших мировых производителей БАДов" },
  { id: "BRAND_JARROW", name: "Jarrow Formulas", type: "brand", country: "США", description: "Научно ориентированный бренд нутра" },
  { id: "BRAND_SOLGAR", name: "Solgar", type: "brand", country: "США", description: "Один из старейших брендов витаминов и минералов" },
  { id: "BRAND_CALIFORNIA_GOLD", name: "California Gold Nutrition", type: "brand", country: "США", description: "Популярный бренд iHerb" },
  { id: "BRAND_NUTRICOST", name: "Nutricost", type: "brand", country: "USA", description: "Один из крупнейших производителей монокомпонентной нутры" },
  { id: "BRAND_KAGED", name: "Kaged", type: "brand", country: "USA", description: "Премиальная спортивная нутра" },
  { id: "BRAND_OPTIMUM", name: "Optimum Nutrition", type: "brand", country: "USA", description: "Мировой лидер спортивного питания" },
  { id: "BRAND_BULK", name: "Bulk Supplements", type: "brand", country: "USA", description: "Чистые порошковые ингредиенты" },
  { id: "BRAND_GARDEN_OF_LIFE", name: "Garden of Life", type: "brand", country: "USA", description: "Органическая нутра" },
  { id: "BRAND_SPORTS_RESEARCH", name: "Sports Research", type: "brand", country: "USA", description: "Популярный бренд витаминов и омега‑3" },
  { id: "BRAND_MUSCLETECH", name: "MuscleTech", type: "brand", country: "USA", description: "Спортивная нутра" },
  { id: "BRAND_MYPROTEIN", name: "MyProtein", type: "brand", country: "UK", description: "Европейский гигант спортивного питания" },
  { id: "BRAND_SWANSON", name: "Swanson", type: "brand", country: "USA", description: "Бюджетная нутра" },
  { id: "BRAND_BLUEBONNET", name: "Bluebonnet Nutrition", type: "brand", country: "USA", description: "Премиальная нутра" },
  { id: "BRAND_DOCTORS_BEST", name: "Doctor's Best", type: "brand", country: "USA", description: "Научно ориентированные формулы" }
];
// ── FROM: bands.ts ──
export interface Band {
  id: string;
  name: string;
  country: string;
  type: string;
}

export const BANDS_DB: Band[] = [];
// ── FROM: risks.ts ──
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export interface Risk {
  id: string;
  name: string;
  system: string;
  organs: string[];
  symptoms: string[];
  levels: RiskLevel[];
  description: string;
}

// Маппинг старых систем на стандартные RISK_SYSTEMS
export const RISK_SYSTEM_MAP: Record<string, string> = {
  metabolic: 'metabolic',
  structural: 'hepatic',
  bile: 'hepatic',
  lab: 'hepatic',
  toxic: 'hepatic',
  infectious: 'hepatic',
  autoimmune: 'hematologic',
  functional: 'renal',
  vascular: 'cardio',
  degenerative: 'musculoskeletal',
  inflammatory: 'musculoskeletal',
  skin: 'hematologic',
  vision: 'neuro',
  hormonal: 'endocrine',
  psychological: 'neuro',
  endo: 'endocrine',
  repro: 'reproductive',
  hem: 'hematologic',
  ms: 'musculoskeletal',
  renal_system: 'renal',
  nervous: 'neuro',
  blood_system: 'blood',
  vessels_system: 'vessels',
};

export const RISKS_DB: Risk[] = [
  // === ПЕЧЕНЬ (hepatic) ===
  { id: "LIVER_FATTY", name: "Жировой гепатоз", system: "hepatic", organs: ["Печень"], symptoms: ["Утомляемость", "Тяжесть в правом подреберье", "Вздутие"], levels: ["LOW", "MEDIUM", "HIGH"], description: "Накопление жира в гепатоцитах" },
  { id: "LIVER_NASH", name: "НАСГ", system: "hepatic", organs: ["Печень"], symptoms: ["Утомляемость", "Боль в правом подреберье", "Инсулинорезистентность"], levels: ["LOW", "MEDIUM", "HIGH"], description: "Неалкогольный стеатогепатит — воспаление на фоне жировой инфильтрации" },
  { id: "LIVER_CIRRHOSIS", name: "Цирроз печени", system: "hepatic", organs: ["Печень"], symptoms: ["Асцит", "Сосудистые звёздочки", "Потеря веса"], levels: ["LOW", "MEDIUM", "HIGH"], description: "Фиброзное замещение паренхимы печени" },
  { id: "LIVER_CHOLESTASIS", name: "Холестаз", system: "hepatic", organs: ["Печень", "Жёлчные протоки"], symptoms: ["Зуд", "Желтуха", "Тёмная моча"], levels: ["LOW", "MEDIUM", "HIGH"], description: "Нарушение оттока жёлчи" },
  { id: "LIVER_ENZYMES_HIGH", name: "Повышенные АЛТ/АСТ", system: "hepatic", organs: ["Печень"], symptoms: ["Утомляемость", "Тошнота", "Дискомфорт в правом подреберье"], levels: ["LOW", "MEDIUM", "HIGH"], description: "Цитолиз гепатоцитов — индикатор гепатотоксичности" },
  { id: "LIVER_DRUG_TOXICITY", name: "Лекарственная гепатотоксичность", system: "hepatic", organs: ["Печень"], symptoms: ["Тошнота", "Рвота", "Желтуха"], levels: ["LOW", "MEDIUM", "HIGH"], description: "Повреждение печени препаратами (17α-алкилированные ААС, НПВС)" },
  { id: "LIVER_ALCOHOLIC", name: "Алкогольное поражение печени", system: "hepatic", organs: ["Печень"], symptoms: ["Утомляемость", "Боль в правом подреберье", "Похмелье"], levels: ["LOW", "MEDIUM", "HIGH"], description: "Сочетание ААС и алкоголя синергично повреждает печень" },
  { id: "LIVER_DETOX_OVERLOAD", name: "Перегрузка детокс-систем", system: "hepatic", organs: ["Печень"], symptoms: ["Утомляемость", "Головная боль", "Чувствительность к запахам"], levels: ["LOW", "MEDIUM", "HIGH"], description: "Нарушение фазы I/II детоксикации печени" },
  { id: "LIVER_BILE_SLUDGE", name: "Застой жёлчи (сладж)", system: "hepatic", organs: ["Печень", "Жёлчный пузырь"], symptoms: ["Тошнота", "Горечь во рту", "Вздутие"], levels: ["LOW", "MEDIUM", "HIGH"], description: "Сгущение жёлчи и образование осадка" },
  { id: "LIVER_GALLSTONES", name: "Жёлчнокаменная болезнь", system: "hepatic", organs: ["Жёлчный пузырь"], symptoms: ["Боль в правом подреберье", "Тошнота", "Рвота"], levels: ["LOW", "MEDIUM", "HIGH"], description: "Камни в жёлчном пузыре" },
  { id: "LIVER_FIBROSIS", name: "Фиброз печени", system: "hepatic", organs: ["Печень"], symptoms: ["Утомляемость", "Боль в правом подреберье", "Слабость"], levels: ["LOW", "MEDIUM", "HIGH"], description: "Фиброзное перерождение печёночной ткани" },

  // === ПОЧКИ (renal) ===
  { id: "KIDNEY_CKD", name: "Хроническая болезнь почек", system: "renal", organs: ["Почки"], symptoms: ["Отёки", "Утомляемость", "Пенистая моча"], levels: ["LOW", "MEDIUM", "HIGH"], description: "Прогрессирующее снижение функции почек" },
  { id: "KIDNEY_STONES", name: "Мочекаменная болезнь", system: "renal", organs: ["Почки"], symptoms: ["Боль в пояснице", "Кровь в моче", "Тошнота"], levels: ["LOW", "MEDIUM", "HIGH"], description: "Образование камней в почках" },
  { id: "KIDNEY_INFECTION", name: "Пиелонефрит", system: "renal", organs: ["Почки"], symptoms: ["Лихорадка", "Боль в спине", "Озноб"], levels: ["LOW", "MEDIUM", "HIGH"], description: "Инфекционное воспаление почечной лоханки" },
  { id: "KIDNEY_PROTEINURIA", name: "Протеинурия", system: "renal", organs: ["Почки"], symptoms: ["Пенистая моча", "Отёки", "Утомляемость"], levels: ["LOW", "MEDIUM", "HIGH"], description: "Потеря белка с мочой — маркер клубочкового повреждения" },
  { id: "KIDNEY_HYPERTENSION", name: "Почечная гипертензия", system: "renal", organs: ["Почки"], symptoms: ["Высокое АД", "Головная боль", "Никтурия"], levels: ["LOW", "MEDIUM", "HIGH"], description: "Повышение АД вследствие поражения почек" },
  { id: "KIDNEY_DRUG_TOXICITY", name: "Лекарственная нефротоксичность", system: "renal", organs: ["Почки"], symptoms: ["Снижение диуреза", "Отёки", "Тошнота"], levels: ["LOW", "MEDIUM", "HIGH"], description: "Повреждение почек препаратами" },
  { id: "KIDNEY_DEHYDRATION", name: "Дегидратация", system: "renal", organs: ["Почки"], symptoms: ["Жажда", "Тёмная моча", "Судороги"], levels: ["LOW", "MEDIUM", "HIGH"], description: "Обезвоживание — фактор острого повреждения почек" },
  { id: "KIDNEY_UTI", name: "ИМП (инфекция мочевых путей)", system: "renal", organs: ["Мочевые пути"], symptoms: ["Боль при мочеиспускании", "Частые позывы", "Мутная моча"], levels: ["LOW", "MEDIUM", "HIGH"], description: "Инфекция мочевыводящих путей" },

  // === СЕРДЦЕ И СОСУДЫ (cardio) ===
  { id: "HEART_HYPERTENSION", name: "Артериальная гипертензия", system: "cardio", organs: ["Сердце", "Сосуды"], symptoms: ["Высокое АД", "Головная боль", "Мелькание мушек"], levels: ["LOW", "MEDIUM", "HIGH"], description: "Повышение артериального давления" },
  { id: "HEART_LVH", name: "Гипертрофия левого желудочка", system: "cardio", organs: ["Сердце"], symptoms: ["Одышка", "Боль в груди", "Утомляемость"], levels: ["LOW", "MEDIUM", "HIGH"], description: "Утолщение стенок ЛЖ на фоне ААС и гипертензии" },
  { id: "HEART_ATHEROSCLEROSIS", name: "Атеросклероз", system: "cardio", organs: ["Артерии"], symptoms: ["Стенокардия", "Перемежающаяся хромота", "ИБС"], levels: ["LOW", "MEDIUM", "HIGH"], description: "Поражение артерий холестериновыми бляшками" },
  { id: "HEART_ARRHYTHMIA", name: "Аритмия", system: "cardio", organs: ["Сердце"], symptoms: ["Учащённое сердцебиение", "Перебои", "Головокружение"], levels: ["LOW", "MEDIUM", "HIGH"], description: "Нарушение ритма сердца" },
  { id: "HEART_THROMBOSIS", name: "Тромбоз", system: "cardio", organs: ["Сосуды"], symptoms: ["Боль в конечности", "Отёк", "Одышка (ТЭЛА)"], levels: ["LOW", "MEDIUM", "HIGH"], description: "Образование тромбов вследствие полицитемии" },
  { id: "HEART_EMBOLISM", name: "Лёгочная эмболия", system: "cardio", organs: ["Лёгкие", "Сосуды"], symptoms: ["Одышка", "Боль в груди", "Кашель с кровью"], levels: ["LOW", "MEDIUM", "HIGH"], description: "Тромбоэмболия лёгочной артерии — жизнеугрожающее состояние" },
  { id: "VESSELS_STIFF", name: "Сосудистая ригидность", system: "cardio", organs: ["Сосуды"], symptoms: ["Повышенное АД", "Холодные конечности"], levels: ["LOW", "MEDIUM", "HIGH"], description: "Снижение эластичности сосудистой стенки" },

  // === НЕРВНАЯ СИСТЕМА (neuro) ===
  { id: "NEURO_INSOMNIA", name: "Бессонница", system: "neuro", organs: ["ЦНС"], symptoms: ["Нарушение засыпания", "Частые пробуждения", "Утренняя слабость"], levels: ["LOW", "MEDIUM", "HIGH"], description: "Нарушение сна — частый эффект тренболона и высоких доз тестостерона" },
  { id: "NEURO_AGRESSION", name: "Повышенная агрессия", system: "neuro", organs: ["ЦНС"], symptoms: ["Раздражительность", "Агрессия", "Импульсивность"], levels: ["LOW", "MEDIUM", "HIGH"], description: "Дофаминовая дисрегуляция на фоне ААС" },
  { id: "NEURO_ANXIETY", name: "Тревожность", system: "neuro", organs: ["ЦНС"], symptoms: ["Тревога", "Панические атаки", "Внутреннее напряжение"], levels: ["LOW", "MEDIUM", "HIGH"], description: "Нарушение ГАМК-ергической передачи" },
  { id: "NEURO_DEPRESSION", name: "Депрессия (ПКТ)", system: "neuro", organs: ["ЦНС"], symptoms: ["Подавленность", "Апатия", "Потеря мотивации"], levels: ["LOW", "MEDIUM", "HIGH"], description: "«Гормональная яма» после отмены ААС — низкий дофамин и серотонин" },
  { id: "NEURO_NEUROPATHY", name: "Периферическая нейропатия", system: "neuro", organs: ["Периферические нервы"], symptoms: ["Парестезии", "Онемение", "Жжение"], levels: ["LOW", "MEDIUM", "HIGH"], description: "Повреждение периферических нервов" },
  { id: "NEURO_BRAIN_FOG", name: "Туман в голове", system: "neuro", organs: ["ЦНС"], symptoms: ["Снижение концентрации", "Ухудшение памяти", "Рассеянность"], levels: ["LOW", "MEDIUM", "HIGH"], description: "Когнитивные нарушения на фоне нейротоксичности" },

  // === ЭНДОКРИННАЯ СИСТЕМА (endocrine) ===
  { id: "ENDO_HPG_SUPPRESSION", name: "Подавление ГГГ оси", system: "endocrine", organs: ["Гипоталамус", "Гипофиз", "Яички"], symptoms: ["Низкий тестостерон", "Атрофия яичек", "Бесплодие"], levels: ["LOW", "MEDIUM", "HIGH"], description: "ААС подавляют ЛГ/ФСГ → остановка эндогенного тестостерона" },
  { id: "ENDO_GYNECOMASTIA", name: "Гинекомастия", system: "endocrine", organs: ["Молочные железы"], symptoms: ["Увеличение грудных желёз", "Болезненность", "Выделения"], levels: ["LOW", "MEDIUM", "HIGH"], description: "Ароматизация тестостерона → эстрадиол → рост грудных желёз" },
  { id: "ENDO_PROLACTIN", name: "Гиперпролактинемия", system: "endocrine", organs: ["Гипофиз"], symptoms: ["Галакторея", "Снижение либидо", "Аменорея (у женщин)"], levels: ["LOW", "MEDIUM", "HIGH"], description: "Повышение пролактина (прогестагенные ААС, тренболон)" },
  { id: "ENDO_THYROID", name: "Нарушение щитовидной железы", system: "endocrine", organs: ["Щитовидная железа"], symptoms: ["Утомляемость", "Изменение веса", "Тремор"], levels: ["LOW", "MEDIUM", "HIGH"], description: "Влияние ААС на ТТГ, Т3, Т4" },
  { id: "ENDO_CORTISOL", name: "Дисбаланс кортизола", system: "endocrine", organs: ["Надпочечники"], symptoms: ["Утомляемость", "Мышечная слабость", "Отёки"], levels: ["LOW", "MEDIUM", "HIGH"], description: "Повышение или подавление кортизола на фоне ААС" },

  // === КРОВЕТВОРНАЯ СИСТЕМА (hematologic) ===
  { id: "HEMA_POLYCYTHEMIA", name: "Полицитемия", system: "hematologic", organs: ["Костный мозг"], symptoms: ["Покраснение лица", "Головная боль", "Затуманивание зрения"], levels: ["LOW", "MEDIUM", "HIGH"], description: "Повышение гематокрита >54% на фоне ААС" },
  { id: "HEMA_THROMBOSIS_RISK", name: "Риск тромбоза", system: "hematologic", organs: ["Сосуды"], symptoms: ["Боль в ноге", "Отёк", "Одышка"], levels: ["LOW", "MEDIUM", "HIGH"], description: "Гиперкоагуляция и полицитемия → тромбоз глубоких вен, ТЭЛА" },
  { id: "HEMA_ANEMIA", name: "Анемия", system: "hematologic", organs: ["Костный мозг"], symptoms: ["Бледность", "Утомляемость", "Одышка при нагрузке"], levels: ["LOW", "MEDIUM", "HIGH"], description: "Снижение гемоглобина и эритроцитов" },
  { id: "HEMA_HIGH_LDL", name: "Дислипидемия", system: "hematologic", organs: ["Печень", "Сосуды"], symptoms: ["Бессимптомно", "Атеросклероз (длительно)"], levels: ["LOW", "MEDIUM", "HIGH"], description: "ЛПНП ↑ ЛПВП ↓ на фоне ААС — основной фактор атеросклероза" },

  // === РЕПРОДУКТИВНАЯ СИСТЕМА (reproductive) ===
  { id: "REPRO_TESTICULAR_ATROPHY", name: "Атрофия яичек", system: "reproductive", organs: ["Яички"], symptoms: ["Уменьшение яичек", "Снижение сперматогенеза", "Бесплодие"], levels: ["LOW", "MEDIUM", "HIGH"], description: "Подавление ЛГ/ФСГ → остановка эндогенного тестостерона" },
  { id: "REPRO_INFERTILITY", name: "Мужское бесплодие", system: "reproductive", organs: ["Яички", "Эпидидимис"], symptoms: ["Олигоспермия", "Астеноспермия", "Низкий объём спермы"], levels: ["LOW", "MEDIUM", "HIGH"], description: "Нарушение сперматогенеза на фоне ААС" },
  { id: "REPRO_PROSTATE", name: "Гиперплазия простаты", system: "reproductive", organs: ["Предстательная железа"], symptoms: ["Частое мочеиспускание", "Слабая струя", "Ночные позывы"], levels: ["LOW", "MEDIUM", "HIGH"], description: "DHT-опосредованная гиперплазия предстательной железы" },
  { id: "REPRO_ERECTILE", name: "Эректильная дисфункция", system: "reproductive", organs: ["Половой член"], symptoms: ["Снижение либидо", "Эректильная дисфункция", "Снижение утренних эрекций"], levels: ["LOW", "MEDIUM", "HIGH"], description: "Нарушение эректильной функции на фоне подавления ГГГ" },

  // === ОПОРНО-ДВИГАТЕЛЬНАЯ СИСТЕМА (musculoskeletal) ===
  { id: "JOINT_TENDON_RISK", name: "Риск разрыва сухожилий", system: "musculoskeletal", organs: ["Сухожилия", "Связки"], symptoms: ["Боль в сухожилиях", "Слабость связок", "Ограничение подвижности"], levels: ["LOW", "MEDIUM", "HIGH"], description: "Мышечная сила ↑ быстрее, чем адаптируются сухожилия" },
  { id: "JOINT_ARTHRITIS", name: "Артрит", system: "musculoskeletal", organs: ["Суставы"], symptoms: ["Боль", "Отечность", "Покраснение"], levels: ["LOW", "MEDIUM", "HIGH"], description: "Воспаление суставов" },
  { id: "JOINT_ARTHROSIS", name: "Артроз", system: "musculoskeletal", organs: ["Суставы"], symptoms: ["Боль", "Хруст", "Ограничение подвижности"], levels: ["LOW", "MEDIUM", "HIGH"], description: "Дегенеративное поражение суставного хряща" },
  { id: "JOINT_GOUT", name: "Подагра", system: "metabolic", organs: ["Суставы"], symptoms: ["Острая боль", "Покраснение", "Отечность"], levels: ["LOW", "MEDIUM", "HIGH"], description: "Отложение мочевой кислоты в суставах" },
  { id: "JOINT_TENDONITIS", name: "Тендинит", system: "musculoskeletal", organs: ["Сухожилия"], symptoms: ["Боль", "Отечность", "Ограничение подвижности"], levels: ["LOW", "MEDIUM", "HIGH"], description: "Воспаление сухожилий" },

  // === МЕТАБОЛИЗМ (metabolic) ===
  { id: "METABOLIC_SYNDROME", name: "Метаболический синдром", system: "metabolic", organs: ["Печень", "Поджелудочная", "Жировая ткань"], symptoms: ["Инсулинорезистентность", "Абдоминальное ожирение", "Дислипидемия"], levels: ["LOW", "MEDIUM", "HIGH"], description: "Комплекс метаболических нарушений на фоне ААС" },
  { id: "METABOLIC_INSULIN_RESISTANCE", name: "Инсулинорезистентность", system: "metabolic", organs: ["Мышцы", "Печень", "Жировая ткань"], symptoms: ["Повышенный сахар", "Увеличение жировой массы", "Усталость после еды"], levels: ["LOW", "MEDIUM", "HIGH"], description: "Снижение чувствительности тканей к инсулину" },
  { id: "METABOLIC_HYPERURICEMIA", name: "Гиперурикемия", system: "metabolic", organs: ["Почки", "Суставы"], symptoms: ["Подагрические атаки", "Боль в суставах", "Мочевые камни"], levels: ["LOW", "MEDIUM", "HIGH"], description: "Повышение мочевой кислоты в крови" },

  // === GH/IGF (ghigf) ===
  { id: "GH_ACROMEGALY_RISK", name: "Риск акромегалии", system: "ghigf", organs: ["Гипофиз", "Кости", "Мягкие ткани"], symptoms: ["Увеличение кистей/стоп", "Грубые черты лица", "Головная боль"], levels: ["LOW", "MEDIUM", "HIGH"], description: "Хронический избыток GH/IGF-1 → акромегалия" },
  { id: "GH_INSULIN_RESISTANCE", name: "Инсулинорезистентность (GH)", system: "ghigf", organs: ["Печень", "Мышцы"], symptoms: ["Повышенный сахар", "Отёки", "Суставные боли"], levels: ["LOW", "MEDIUM", "HIGH"], description: "GH antagonizes insulin → гипергликемия" },
  { id: "GH_CARPAL_TUNNEL", name: "Синдром запястного канала", system: "ghigf", organs: ["Запястье", "Срединный нерв"], symptoms: ["Онемение пальцев", "Боль в запястье", "Слабость кисти"], levels: ["LOW", "MEDIUM", "HIGH"], description: "Отёк и компрессия срединного нерва на фоне GH" },

  // === ИНСУЛИНОВАЯ ОСЬ (ins_axis) ===
  { id: "INS_DIABETES_RISK", name: "Риск сахарного диабета", system: "ins_axis", organs: ["Поджелудочная железа", "Мышцы", "Печень"], symptoms: ["Жажда", "Частое мочеиспускание", "Утомляемость"], levels: ["LOW", "MEDIUM", "HIGH"], description: "Хроническая инсулинорезистентность → диабет 2 типа" },

  // === НЕЙРОТОКСИЧНОСТЬ (neuro_toxicity) ===
  { id: "NEUROTOX_DOPAMINE", name: "Дофаминовая дисрегуляция", system: "neuro_toxicity", organs: ["Дофаминовые нейроны"], symptoms: ["Агрессия", "Мания", "Зависимость", "ПКТ-депрессия"], levels: ["LOW", "MEDIUM", "HIGH"], description: "Нарушение дофаминовой передачи — тренболон, высокие дозы тестостерона" },
  { id: "NEUROTOX_SEROTONIN", name: "Серотониновый дисбаланс", system: "neuro_toxicity", organs: ["Серотониновые нейроны"], symptoms: ["Тревога", "Депрессия", "Бессонница", "Раздражительность"], levels: ["LOW", "MEDIUM", "HIGH"], description: "Нарушение серотониновой передачи — риск серотонинового синдрома при комбинациях" },
  { id: "NEUROTOX_GABA", name: "ГАМК-дисфункция", system: "neuro_toxicity", organs: ["ГАМК-рецепторы"], symptoms: ["Бессонница", "Тревожность", "Судороги", "Тремор"], levels: ["LOW", "MEDIUM", "HIGH"], description: "Подавление ГАМК-ергической передачи — снижение торможения в ЦНС" },
  { id: "NEUROTOX_PERIPHERAL", name: "Периферическая нейропатия", system: "neuro_toxicity", organs: ["Периферические нервы"], symptoms: ["Парестезии", "Онемение", "Боль", "Мышечная слабость"], levels: ["LOW", "MEDIUM", "HIGH"], description: "Повреждение периферических нервов токсичными метаболитами" },

  // === КРОВЬ (blood) ===
  { id: "BLOOD_POLYCYTHEMIA", name: "Эритроцитоз", system: "blood", organs: ["Костный мозг"], symptoms: ["Покраснение кожи", "Головная боль", "Затуманивание зрения"], levels: ["LOW", "MEDIUM", "HIGH"], description: "Стимуляция эритропоэза ААС → HCT >54%" },
  { id: "BLOOD_COAGULATION", name: "Гиперкоагуляция", system: "blood", organs: ["Плазма"], symptoms: ["Тромбоз", "ТЭЛА (редко)", "D-димер ↑"], levels: ["LOW", "MEDIUM", "HIGH"], description: "Повышение свёртываемости крови на фоне ААС" },

  // === СОСУДЫ (vessels) ===
  { id: "VESSELS_ENDOTHELIUM", name: "Эндотелиальная дисфункция", system: "vessels", organs: ["Эндотелий"], symptoms: ["Повышенное АД", "Холодные конечности", "Варикоз"], levels: ["LOW", "MEDIUM", "HIGH"], description: "Повреждение эндотелия сосудов — ранний маркер атеросклероза" },
  { id: "VESSELS_ATHEROSCLEROSIS", name: "Атеросклероз сосудов", system: "vessels", organs: ["Артерии"], symptoms: ["ИБС", "Стенокардия", "Перемежающаяся хромота"], levels: ["LOW", "MEDIUM", "HIGH"], description: "ЛПНП ↑ + эндотелиальная дисфункция → атеросклероз" },
  { id: "VESSELS_VASOSPASM", name: "Вазоспазм", system: "vessels", organs: ["Артерии"], symptoms: ["Головная боль", "Холодные конечности", "Мышечные судороги"], levels: ["LOW", "MEDIUM", "HIGH"], description: "Спазм сосудов на фоне ААС (тренболон, высокие дозы)" },
];



// ── FROM: recommendations.ts ──
export interface Recommendation {
  recId: string;
  type: string;
  riskId: string;
  level: string;
  title: string;
  text: string;
}

export const RECOMMENDATIONS_DB: Recommendation[] = [
  // === ПЕЧЕНЬ ===
  { recId: "REC_LIVER_FATTY_LOW", type: "RISK", riskId: "LIVER_FATTY", level: "LOW", title: "Лёгкий стеатоз", text: "Уменьши сахар и фастфуд, добавь 20–30 минут ходьбы." },
  { recId: "REC_LIVER_FATTY_MED", type: "RISK", riskId: "LIVER_FATTY", level: "MEDIUM", title: "Стеатоз средней степени", text: "Убери сахар, добавь омега-3 и NAC, контролируй вес." },
  { recId: "REC_LIVER_FATTY_HIGH", type: "RISK", riskId: "LIVER_FATTY", level: "HIGH", title: "Выраженный стеатоз", text: "Срочно снижать углеводы, добавить силовые, омега-3, УДХК." },
  { recId: "REC_LIVER_NASH_LOW", type: "RISK", riskId: "LIVER_NASH", level: "LOW", title: "Начало воспаления печени", text: "Убери алкоголь, добавь куркумин и омега-3." },
  { recId: "REC_LIVER_NASH_MED", type: "RISK", riskId: "LIVER_NASH", level: "MEDIUM", title: "НАСГ средней тяжести", text: "Добавь NAC, витамин E, контроль веса." },
  { recId: "REC_LIVER_NASH_HIGH", type: "RISK", riskId: "LIVER_NASH", level: "HIGH", title: "Выраженный НАСГ", text: "Требуется агрессивное снижение веса и антиоксиданты." },
  { recId: "REC_LIVER_CHOLESTASIS_LOW", type: "RISK", riskId: "LIVER_CHOLESTASIS", level: "LOW", title: "Лёгкий холестаз", text: "Добавь таурин и артишок." },
  { recId: "REC_LIVER_CHOLESTASIS_MED", type: "RISK", riskId: "LIVER_CHOLESTASIS", level: "MEDIUM", title: "Холестаз", text: "Убери жирное, добавь УДХК (урсосан)." },
  { recId: "REC_LIVER_CHOLESTASIS_HIGH", type: "RISK", riskId: "LIVER_CHOLESTASIS", level: "HIGH", title: "Выраженный холестаз", text: "Нужна медикаментозная терапия и контроль ферментов." },
  { recId: "REC_LIVER_ENZYMES_LOW", type: "RISK", riskId: "LIVER_ENZYMES_HIGH", level: "LOW", title: "Повышенные АЛТ/АСТ", text: "Контроль ферментов через 2 недели, добавить NAC." },
  { recId: "REC_LIVER_ENZYMES_MED", type: "RISK", riskId: "LIVER_ENZYMES_HIGH", level: "MEDIUM", title: "Умеренный цитолиз", text: "Снизить дозу ААС, добавить гепатопротекторы, контроль через 1 неделю." },
  { recId: "REC_LIVER_ENZYMES_HIGH", type: "RISK", riskId: "LIVER_ENZYMES_HIGH", level: "HIGH", title: "Выраженный цитолиз", text: "Немедленно снизить дозу или отменить гепатотоксичный препарат." },

  // === ПОЧКИ ===
  { recId: "REC_KIDNEY_CKD_LOW", type: "RISK", riskId: "KIDNEY_CKD", level: "LOW", title: "Снижение функции почек", text: "Пей воду, убери НПВС." },
  { recId: "REC_KIDNEY_CKD_MED", type: "RISK", riskId: "KIDNEY_CKD", level: "MEDIUM", title: "ХБП средней степени", text: "Контроль давления, ограничение соли." },
  { recId: "REC_KIDNEY_CKD_HIGH", type: "RISK", riskId: "KIDNEY_CKD", level: "HIGH", title: "Выраженная ХБП", text: "Срочно к нефрологу, контроль калия." },
  { recId: "REC_KIDNEY_STONES_LOW", type: "RISK", riskId: "KIDNEY_STONES", level: "LOW", title: "Риск камней", text: "Пей воду, добавь магний." },
  { recId: "REC_KIDNEY_STONES_MED", type: "RISK", riskId: "KIDNEY_STONES", level: "MEDIUM", title: "Камни", text: "Убери оксалаты, добавь цитрат калия." },
  { recId: "REC_KIDNEY_STONES_HIGH", type: "RISK", riskId: "KIDNEY_STONES", level: "HIGH", title: "Крупные камни", text: "Требуется УЗИ и терапия." },
  { recId: "REC_KIDNEY_PROTEINURIA_LOW", type: "RISK", riskId: "KIDNEY_PROTEINURIA", level: "LOW", title: "Следы белка", text: "Увеличь потребление воды, снизь белок до 2г/кг." },
  { recId: "REC_KIDNEY_PROTEINURIA_MED", type: "RISK", riskId: "KIDNEY_PROTEINURIA", level: "MEDIUM", title: "Протеинурия", text: "Обязательно УЗИ почек, контроль креатинина." },
  { recId: "REC_KIDNEY_PROTEINURIA_HIGH", type: "RISK", riskId: "KIDNEY_PROTEINURIA", level: "HIGH", title: "Выраженная протеинурия", text: "Срочно к нефрологу, возможна биопсия." },

  // === СЕРДЦЕ ===
  { recId: "REC_HEART_HYPERTENSION_LOW", type: "RISK", riskId: "HEART_HYPERTENSION", level: "LOW", title: "Повышенное давление", text: "Уменьши соль, добавь магний." },
  { recId: "REC_HEART_HYPERTENSION_MED", type: "RISK", riskId: "HEART_HYPERTENSION", level: "MEDIUM", title: "Гипертензия", text: "Добавь калий, омега-3, контроль веса." },
  { recId: "REC_HEART_HYPERTENSION_HIGH", type: "RISK", riskId: "HEART_HYPERTENSION", level: "HIGH", title: "Высокое давление", text: "Требуется медикаментозная терапия." },
  { recId: "REC_HEART_ATHEROSCLEROSIS_LOW", type: "RISK", riskId: "HEART_ATHEROSCLEROSIS", level: "LOW", title: "Риск атеросклероза", text: "Добавь омега-3 и витамин K2." },
  { recId: "REC_HEART_ATHEROSCLEROSIS_MED", type: "RISK", riskId: "HEART_ATHEROSCLEROSIS", level: "MEDIUM", title: "Атеросклероз", text: "Контроль липидов, добавить CoQ10." },
  { recId: "REC_HEART_ATHEROSCLEROSIS_HIGH", type: "RISK", riskId: "HEART_ATHEROSCLEROSIS", level: "HIGH", title: "Выраженный атеросклероз", text: "Требуется терапия статинами." },
  { recId: "REC_HEART_THROMBOSIS_LOW", type: "RISK", riskId: "HEART_THROMBOSIS", level: "LOW", title: "Риск тромбоза", text: "Аспирин 100 мг/день, обильное питьё." },
  { recId: "REC_HEART_THROMBOSIS_MED", type: "RISK", riskId: "HEART_THROMBOSIS", level: "MEDIUM", title: "Умеренный риск тромбоза", text: "Сдача крови, контроль HCT, омега-3." },
  { recId: "REC_HEART_THROMBOSIS_HIGH", type: "RISK", riskId: "HEART_THROMBOSIS", level: "HIGH", title: "Высокий риск тромбоза", text: "HCT >54% — кровопускание, антикоагулянты." },

  // === НЕРВНАЯ СИСТЕМА ===
  { recId: "REC_NEURO_INSOMNIA_LOW", type: "RISK", riskId: "NEURO_INSOMNIA", level: "LOW", title: "Лёгкая бессонница", text: "Магний L-треонат, мелатонин 0.5 мг." },
  { recId: "REC_NEURO_INSOMNIA_MED", type: "RISK", riskId: "NEURO_INSOMNIA", level: "MEDIUM", title: "Бессонница", text: "Глицин, 5-HTP, гигиена сна." },
  { recId: "REC_NEURO_INSOMNIA_HIGH", type: "RISK", riskId: "NEURO_INSOMNIA", level: "HIGH", title: "Тяжёлая бессонница", text: "Консультация сомнолога, возможна фармакотерапия." },
  { recId: "REC_NEURO_AGRESSION_LOW", type: "RISK", riskId: "NEURO_AGRESSION", level: "LOW", title: "Раздражительность", text: "Медитация, L-теанин." },
  { recId: "REC_NEURO_AGRESSION_MED", type: "RISK", riskId: "NEURO_AGRESSION", level: "MEDIUM", title: "Агрессия", text: "Снизить дозу, добавить антиоксиданты, проверить эстрадиол." },
  { recId: "REC_NEURO_AGRESSION_HIGH", type: "RISK", riskId: "NEURO_AGRESSION", level: "HIGH", title: "Выраженная агрессия", text: "Немедленно снизить дозу, консультация психиатра." },
  { recId: "REC_NEURO_ANXIETY_LOW", type: "RISK", riskId: "NEURO_ANXIETY", level: "LOW", title: "Лёгкая тревожность", text: "Магний, L-теанин, дыхательные практики." },
  { recId: "REC_NEURO_ANXIETY_MED", type: "RISK", riskId: "NEURO_ANXIETY", level: "MEDIUM", title: "Тревожность", text: "Ашваганда, Родинола розовая." },
  { recId: "REC_NEURO_ANXIETY_HIGH", type: "RISK", riskId: "NEURO_ANXIETY", level: "HIGH", title: "Выраженная тревога", text: "Консультация психиатра, возможна фармакотерапия." },
  { recId: "REC_NEURO_DEPRESSION_LOW", type: "RISK", riskId: "NEURO_DEPRESSION", level: "LOW", title: "Лёгкая депрессия на ПКТ", text: "Семгу, витамин D, физическая активность." },
  { recId: "REC_NEURO_DEPRESSION_MED", type: "RISK", riskId: "NEURO_DEPRESSION", level: "MEDIUM", title: "Депрессия на ПКТ", text: "5-HTP, дофаминовые предшественники, контроль гормонов." },
  { recId: "REC_NEURO_DEPRESSION_HIGH", type: "RISK", riskId: "NEURO_DEPRESSION", level: "HIGH", title: "Тяжёлая депрессия", text: "Консультация психиатра, антидепрессанты." },

  // === ЭНДОКРИННАЯ СИСТЕМА ===
  { recId: "REC_ENDO_HPG_LOW", type: "RISK", riskId: "ENDO_HPG_SUPPRESSION", level: "LOW", title: "Лёгкое подавление ГГГ", text: "ХГЧ 500 МЕ 2р/нед (схема 3/1), контроль ЛГ/ФСГ." },
  { recId: "REC_ENDO_HPG_MED", type: "RISK", riskId: "ENDO_HPG_SUPPRESSION", level: "MEDIUM", title: "Умеренное подавление ГГГ", text: "ХГЧ (500 МЕ 2р/нед, 3/1) + Кломид, контроль тестостерона и эстрадиола." },
  { recId: "REC_ENDO_HPG_HIGH", type: "RISK", riskId: "ENDO_HPG_SUPPRESSION", level: "HIGH", title: "Выраженное подавление ГГГ", text: "Длительная ПКТ (Кломид + Тамоксифен), эндокринолог." },
  { recId: "REC_ENDO_GYNECO_LOW", type: "RISK", riskId: "ENDO_GYNECOMASTIA", level: "LOW", title: "Риск гинекомастии", text: "Контроль эстрадиола, при ↑ — АИ." },
  { recId: "REC_ENDO_GYNECO_MED", type: "RISK", riskId: "ENDO_GYNECOMASTIA", level: "MEDIUM", title: "Гинекомастия", text: "Анастрозол 0.25-0.5 мг, контроль E2." },
  { recId: "REC_ENDO_GYNECO_HIGH", type: "RISK", riskId: "ENDO_GYNECOMASTIA", level: "HIGH", title: "Выраженная гинекомастия", text: "Хирургическая консультация, тамоксифен." },

  // === КРОВЕТВОРНАЯ СИСТЕМА ===
  { recId: "REC_HEMA_POLYCYTHEMIA_LOW", type: "RISK", riskId: "HEMA_POLYCYTHEMIA", level: "LOW", title: "Лёгкий эритроцитоз", text: "Обильное питьё, контроль HCT." },
  { recId: "REC_HEMA_POLYCYTHEMIA_MED", type: "RISK", riskId: "HEMA_POLYCYTHEMIA", level: "MEDIUM", title: "Эритроцитоз", text: "Кровопускание 450 мл, аспирин." },
  { recId: "REC_HEMA_POLYCYTHEMIA_HIGH", type: "RISK", riskId: "HEMA_POLYCYTHEMIA", level: "HIGH", title: "Опасный эритроцитоз", text: "HCT >54% — немедленное кровопускание, антикоагулянты." },
  { recId: "REC_HEMA_THROMBOSIS_LOW", type: "RISK", riskId: "HEMA_THROMBOSIS_RISK", level: "LOW", title: "Риск тромбоза", text: "Аспирин 100 мг, омега-3." },
  { recId: "REC_HEMA_THROMBOSIS_MED", type: "RISK", riskId: "HEMA_THROMBOSIS_RISK", level: "MEDIUM", title: "Умеренный риск", text: "Аспирин, контроль D-димера." },
  { recId: "REC_HEMA_THROMBOSIS_HIGH", type: "RISK", riskId: "HEMA_THROMBOSIS_RISK", level: "HIGH", title: "Высокий риск тромбоза", text: "Антикоагулянты, снижение дозы ААС." },

  // === РЕПРОДУКТИВНАЯ СИСТЕМА ===
  { recId: "REC_REPO_ATROPHY_LOW", type: "RISK", riskId: "REPRO_TESTICULAR_ATROPHY", level: "LOW", title: "Лёгкая атрофия яичек", text: "ХГЧ 500 МЕ 2×/нед, 3 нед через 1." },
  { recId: "REC_REPO_ATROPHY_MED", type: "RISK", riskId: "REPRO_TESTICULAR_ATROPHY", level: "MEDIUM", title: "Атрофия яичек", text: "ХГЧ 500 МЕ 2×/нед, 3 нед через 1, контроль объёма." },
  { recId: "REC_REPO_ATROPHY_HIGH", type: "RISK", riskId: "REPRO_TESTICULAR_ATROPHY", level: "HIGH", title: "Выраженная атрофия", text: "Экстренная ПКТ, консультация андролога." },
  { recId: "REC_REPO_PROSTATE_LOW", type: "RISK", riskId: "REPRO_PROSTATE", level: "LOW", title: "Риск гиперплазии простаты", text: "Контроль ПСА, пальцевое исследование." },
  { recId: "REC_REPO_PROSTATE_MED", type: "RISK", riskId: "REPRO_PROSTATE", level: "MEDIUM", title: "Гиперплазия простаты", text: "Финастерид, контроль ПСА каждые 3 месяца." },
  { recId: "REC_REPO_PROSTATE_HIGH", type: "RISK", riskId: "REPRO_PROSTATE", level: "HIGH", title: "Выраженная гиперплазия", text: "Уролог, биопсия при ПСА >4." },

  // === ОПОРНО-ДВИГАТЕЛЬНАЯ ===
  { recId: "REC_JOINT_TENDON_LOW", type: "RISK", riskId: "JOINT_TENDON_RISK", level: "LOW", title: "Риск сухожилий", text: "Ограничь рабочий вес, добавь коллаген." },
  { recId: "REC_JOINT_TENDON_MED", type: "RISK", riskId: "JOINT_TENDON_RISK", level: "MEDIUM", title: "Боль в сухожилиях", text: "Снизь объём, добавить BPC-157, MSM." },
  { recId: "REC_JOINT_TENDON_HIGH", type: "RISK", riskId: "JOINT_TENDON_RISK", level: "HIGH", title: "Высокий риск разрыва", text: "Полный отдых, МРТ, BPC-157, консультация ортопеда." },

  // === МЕТАБОЛИЗМ ===
  { recId: "REC_METABOLIC_SYNDROME_LOW", type: "RISK", riskId: "METABOLIC_SYNDROME", level: "LOW", title: "Риск метаболического синдрома", text: "Контроль сахара, добавить клетчатку." },
  { recId: "REC_METABOLIC_SYNDROME_MED", type: "RISK", riskId: "METABOLIC_SYNDROME", level: "MEDIUM", title: "Метаболический синдром", text: "Низкоуглеводная диета, омега-3, контроль HOMA-IR." },
  { recId: "REC_METABOLIC_SYNDROME_HIGH", type: "RISK", riskId: "METABOLIC_SYNDROME", level: "HIGH", title: "Выраженный метаболический синдром", text: "Эндокринолог, метформин, строгая диета." },
  { recId: "REC_METABOLIC_INSULIN_LOW", type: "RISK", riskId: "METABOLIC_INSULIN_RESISTANCE", level: "LOW", title: "Лёгкая инсулинорезистентность", text: "Добавь клетчатку, снизь быстрые углеводы." },
  { recId: "REC_METABOLIC_INSULIN_MED", type: "RISK", riskId: "METABOLIC_INSULIN_RESISTANCE", level: "MEDIUM", title: "Инсулинорезистентность", text: "Низкий ГИ, хром, контроль HOMA-IR." },
  { recId: "REC_METABOLIC_INSULIN_HIGH", type: "RISK", riskId: "METABOLIC_INSULIN_RESISTANCE", level: "HIGH", title: "Выраженная инсулинорезистентность", text: "Эндокринолог, метформин." },

  // === НЕЙРОТОКСИЧНОСТЬ ===
  { recId: "REC_NEUROTOX_DOPAMINE_LOW", type: "RISK", riskId: "NEUROTOX_DOPAMINE", level: "LOW", title: "Дофаминовый дисбаланс", text: "L-тирозин, витамин B6." },
  { recId: "REC_NEUROTOX_DOPAMINE_MED", type: "RISK", riskId: "NEUROTOX_DOPAMINE", level: "MEDIUM", title: "Дофаминовая дисрегуляция", text: "Снизить дозу тренболона, добавить антиоксиданты." },
  { recId: "REC_NEUROTOX_DOPAMINE_HIGH", type: "RISK", riskId: "NEUROTOX_DOPAMINE", level: "HIGH", title: "Выраженная дофаминовая токсичность", text: "Немедленно отменить тренболон, консультация психиатра." },
  { recId: "REC_NEUROTOX_GABA_LOW", type: "RISK", riskId: "NEUROTOX_GABA", level: "LOW", title: "Лёгкая ГАМК-дисфункция", text: "Магний, L-теанин, глицин." },
  { recId: "REC_NEUROTOX_GABA_MED", type: "RISK", riskId: "NEUROTOX_GABA", level: "MEDIUM", title: "ГАМК-дисфункция", text: "Магний L-треонат, фенибут (не более 2 недель)." },
  { recId: "REC_NEUROTOX_GABA_HIGH", type: "RISK", riskId: "NEUROTOX_GABA", level: "HIGH", title: "Тяжёлая ГАМК-дисфункция", text: "Консультация невролога, возможна фармакотерапия." },

  // === СОСУДЫ ===
  { recId: "REC_VESSELS_ENDOTHELIUM_LOW", type: "RISK", riskId: "VESSELS_ENDOTHELIUM", level: "LOW", title: "Лёгкая эндотелиальная дисфункция", text: "Омега-3, L-аргинин, витамин C." },
  { recId: "REC_VESSELS_ENDOTHELIUM_MED", type: "RISK", riskId: "VESSELS_ENDOTHELIUM", level: "MEDIUM", title: "Эндотелиальная дисфункция", text: "Омега-3 3г/день, CoQ10, контроль ЛПНП/ЛПВП." },
  { recId: "REC_VESSELS_ENDOTHELIUM_HIGH", type: "RISK", riskId: "VESSELS_ENDOTHELIUM", level: "HIGH", title: "Выраженная эндотелиальная дисфункция", text: "Статины, кардиолог, ЭХО-КГ." },

  // === МЕХАНИЗМЫ (общие) ===
  { recId: "REC_MECH_INFLAMMATION_UP", type: "MECHANISM", riskId: "INFLAMMATION_UP", level: "MEDIUM", title: "Повышено воспаление", text: "Добавь омега-3, куркумин, убери сахар." },
  { recId: "REC_MECH_CORTISOL_UP", type: "MECHANISM", riskId: "CORTISOL_UP", level: "MEDIUM", title: "Кортизол повышен", text: "Добавь магний и адаптогены." },
  { recId: "REC_MECH_T3_T4_DOWN", type: "MECHANISM", riskId: "T3_T4_DOWN", level: "MEDIUM", title: "Щитовидка снижена", text: "Добавь йод, селен." },
  { recId: "REC_MECH_GABA_DOWN", type: "MECHANISM", riskId: "GABA_DOWN", level: "MEDIUM", title: "Снижение GABA", text: "Добавь магний и теанин." },

  // === ОРГАНЫ (общие) ===
  { recId: "REC_ORGAN_LIVER", type: "ORGAN", riskId: "LIVER", level: "MEDIUM", title: "Печень нагружена", text: "Убери алкоголь, добавь NAC." },
  { recId: "REC_ORGAN_KIDNEYS", type: "ORGAN", riskId: "KIDNEYS", level: "MEDIUM", title: "Почки нагружены", text: "Пей воду, убери НПВС." },
  { recId: "REC_ORGAN_HEART", type: "ORGAN", riskId: "HEART", level: "MEDIUM", title: "Сердце нагружено", text: "Контроль АД, омега-3, CoQ10." },
  { recId: "REC_ORGAN_BRAIN", type: "ORGAN", riskId: "BRAIN", level: "MEDIUM", title: "ЦНС нагружена", text: "Магний, глицин, контроль сна." },
];

// ── FROM: hormonal-axes.ts ──
export interface HormonalAxisData {
  id: string;
  name: string;
  type: 'hormonal_axis' | 'hormonal_dysfunction' | 'hormonal_intervention';
  pathway: string;
  organs: string;
  target: string;
  description: string;
}

export const HORMONAL_AXES_DB: HormonalAxisData[] = [
  { id: "AXIS_HPA", name: "HPA Axis", type: "hormonal_axis", pathway: "CRH>ACTH>CORTISOL", organs: "HYPOTHALAMUS>PITUITARY>ADRENALS", target: "STRESS_RESPONSE", description: "Ось стресс-реакции" },
  { id: "AXIS_HPT", name: "HPT Axis", type: "hormonal_axis", pathway: "TRH>TSH>T4/T3", organs: "HYPOTHALAMUS>PITUITARY>THYROID", target: "METABOLISM", description: "Ось щитовидки" },
  { id: "AXIS_HPG", name: "HPG Axis", type: "hormonal_axis", pathway: "GnRH>LH/FSH>SEX_HORMONES", organs: "HYPOTHALAMUS>PITUITARY>GONADS", target: "REPRODUCTION", description: "Ось половых гормонов" },
  { id: "AXIS_HPTA", name: "HPTA Axis", type: "hormonal_axis", pathway: "GHRH>GH>IGF1", organs: "HYPOTHALAMUS>PITUITARY>LIVER", target: "GROWTH_REPAIR", description: "Ось роста" },
  { id: "AXIS_METABOLIC", name: "Metabolic Axis", type: "hormonal_axis", pathway: "INSULIN>LEPTIN>ADIPONECTIN", organs: "PANCREAS>FAT_TISSUE", target: "ENERGY_BALANCE", description: "Метаболическая ось" },
  { id: "AXIS_GI", name: "GI Endocrine Axis", type: "hormonal_axis", pathway: "GLP1>GIP>PYY>CCK", organs: "GI_TRACT", target: "APPETITE_DIGESTION", description: "Кишечная эндокринная ось" },
  { id: "AXIS_BONE", name: "Bone Endocrine Axis", type: "hormonal_axis", pathway: "PTH>CALCITONIN>FGF23", organs: "BONE>THYROID>KIDNEY", target: "CALCIUM_BALANCE", description: "Костная эндокринная ось" },
  { id: "AXIS_HPA_DYS", name: "HPA Dysfunction", type: "hormonal_dysfunction", pathway: "CORTISOL_HIGH/DHEA_LOW", organs: "STRESS_BURNOUT", target: "", description: "Хронический стресс" },
  { id: "AXIS_HPT_DYS", name: "HPT Dysfunction", type: "hormonal_dysfunction", pathway: "LOW_T3/HIGH_rT3", organs: "HYPOTHYROIDISM", target: "", description: "Гипотиреоз" },
  { id: "AXIS_HPG_DYS", name: "HPG Dysfunction", type: "hormonal_dysfunction", pathway: "LOW_TESTOSTERONE/HIGH_PROLACTIN", organs: "SEX_DYSFUNCTION", target: "", description: "Гипогонадизм" },
  { id: "AXIS_HPTA_DYS", name: "HPTA Dysfunction", type: "hormonal_dysfunction", pathway: "LOW_GH/LOW_IGF1", organs: "GROWTH_DEFICIT", target: "", description: "Дефицит гормона роста" },
  { id: "AXIS_METABOLIC_DYS", name: "Metabolic Dysfunction", type: "hormonal_dysfunction", pathway: "INSULIN_RESISTANCE/LEPTIN_RESISTANCE", organs: "OBESITY", target: "", description: "Метаболический синдром" },
  { id: "AXIS_GI_DYS", name: "GI Endocrine Dysfunction", type: "hormonal_dysfunction", pathway: "LOW_GLP1/HIGH_GHRELIN", organs: "APPETITE_DYSREGULATION", target: "", description: "Нарушение аппетита" },
  { id: "AXIS_BONE_DYS", name: "Bone Endocrine Dysfunction", type: "hormonal_dysfunction", pathway: "HIGH_PTH/LOW_CALCITONIN", organs: "OSTEOPOROSIS", target: "", description: "Остеопороз" },
  { id: "AXIS_HPA_INTERVENTION", name: "HPA Intervention", type: "hormonal_intervention", pathway: "LOWER_CRH/LOWER_ACTH/RAISE_DHEA", organs: "STRESS_DOWN", target: "", description: "Коррекция стресса" },
  { id: "AXIS_HPT_INTERVENTION", name: "HPT Intervention", type: "hormonal_intervention", pathway: "IMPROVE_T4_TO_T3/LOWER_rT3", organs: "METABOLISM_UP", target: "", description: "Коррекция щитовидки" },
  { id: "AXIS_HPG_INTERVENTION", name: "HPG Intervention", type: "hormonal_intervention", pathway: "LOWER_PROLACTIN/RAISE_LH/FSH", organs: "SEX_HORMONES_UP", target: "", description: "Коррекция половых гормонов" },
  { id: "AXIS_HPTA_INTERVENTION", name: "HPTA Intervention", type: "hormonal_intervention", pathway: "RAISE_GHRH/LOWER_SOMATOSTATIN", organs: "GH_IGF1_UP", target: "", description: "Коррекция роста" },
  { id: "AXIS_METABOLIC_INTERVENTION", name: "Metabolic Intervention", type: "hormonal_intervention", pathway: "IMPROVE_INSULIN/IMPROVE_LEPTIN", organs: "ENERGY_BALANCE_UP", target: "", description: "Коррекция метаболизма" },
  { id: "AXIS_GI_INTERVENTION", name: "GI Endocrine Intervention", type: "hormonal_intervention", pathway: "RAISE_GLP1/LOWER_GHRELIN", organs: "APPETITE_CONTROL", target: "", description: "Коррекция аппетита" },
  { id: "AXIS_BONE_INTERVENTION", name: "Bone Endocrine Intervention", type: "hormonal_intervention", pathway: "LOWER_PTH/RAISE_CALCITONIN", organs: "BONE_STRENGTH_UP", target: "", description: "Коррекция костей" }
];
// ── FROM: pharma-details.ts ──
import type { PharmaSynergy, SideEffect } from '../core/types';

export interface PharmaDetail {
  id: string;
  description: string;
  mechanism: string;
  synergies: PharmaSynergy[];
  contraindications: string[];
  sideEffects: SideEffect[];
  dosageRange?: { min: number; max: number; unit: string; frequency: string };
}

export const PHARMA_DETAILS: Record<string, PharmaDetail> = {
  test_enan: {
    id: 'test_enan',
    description: 'Эфирированная форма тестостерона с периодом полувыведения ~4.5 дня. Основной андрогенный препарат для ЗТТ и массонаборных курсов. Обеспечивает стабильный уровень тестостерона при еженедельных инъекциях.',
    mechanism: 'Связывается с андрогенными рецепторами (AR) → транслокация комплекса AR-тестостерон в ядро → активация генов белкового синтеза (AR-dependent транскрипция). Конвертируется в дигидротестостерон (ДГТ) через 5α-редуктазу и в эстрадиол через ароматазу.',
    synergies: [
      { with: 'hcg', type: 'complementary', desc: 'Предотвращает атрофию яичек, сохраняет эндогенную продукцию тестостерона и дескенс-цепь ЛГ' },
      { with: 'anastro', type: 'complementary', desc: 'Контроль эстрадиола при ароматизации — предотвращает гинекомастию и задержку жидкости' },
      { with: 'nandrolone', type: 'synergistic', desc: 'Усиленный анаболический эффект через синергию AR-зависимых путей белкового синтеза' },
      { with: 'finasteride', type: 'antagonistic', desc: 'Снижает ДГТ-зависимые побочки, но может маскировать андрогенный дефицит в коже/простате' },
    ],
    contraindications: ['Рак простаты', 'Рак молочной железы (муж)', 'Тромбофилия', 'Полицитемия (Hct >54%)', 'Обструктивная гипертрофия простаты', 'Тяжёлая сердечная недостаточность'],
    sideEffects: [
      { effect: 'Эстрадиоловая ароматизация (гино, отёки, перепады настроения)', frequency: 'common' },
      { effect: 'ДГТ-зависимые эффекты (алопеция, акне, гипертрофия простаты)', frequency: 'common' },
      { effect: 'Супрессия HPTA (эндогенный тестостерон ↓)', frequency: 'common' },
      { effect: 'Эритропоэз (полицитемия)', frequency: 'common' },
      { effect: 'Дислипидемия (ЛПВП ↓)', frequency: 'common' },
      { effect: 'Кардиотоксичность при высоких дозах', frequency: 'rare' },
      { effect: 'Задержка натрия и воды', frequency: 'common' },
    ],
    dosageRange: { min: 100, max: 500, unit: 'мг/нед', frequency: '1 раз в 5-7 дней' },
  },

  tren_acet: {
    id: 'tren_acet',
    description: '19-нор производное тестостерона. Мощнейший анаболик (анаболический индекс 500 vs тестостерон 100). Не ароматизируется, но значительно повышает пролактин. Ацетатный эфир — короткий период полувыведения (~3 дня).',
    mechanism: 'Мощный агонист AR (аффинность в 5× выше тестостерона). Активирует mTOR и MAPK/ERK-каскад → массивный белковый синтез. Не конвертируется в эстрадиол, но индуцирует пролактин через серотонинергические пути. Ингибирует 11β-HSD2 → кортизоловый парадокс.',
    synergies: [
      { with: 'test_enan', type: 'synergistic', desc: 'Комбинация тестостерон + тренболоне — классический массонаборный стек, синергия по AR' },
      { with: 'caberg', type: 'complementary', desc: 'Каберголин подавляет пролактин, индуцированный тренболоном — предотвращает гинекомастию и снижение либидо' },
      { with: 'anastro', type: 'antagonistic', desc: 'Тренболон не ароматизируется — ИА не нужны и могут снизить эстрадиол до опасных уровней' },
    ],
    contraindications: ['Рак простаты', 'Тяжёлая гипертензия', 'Психические расстройства (паранойя, агрессия)', 'Тромбофилия', 'Беременность партнёрши'],
    sideEffects: [
      { effect: 'Пролактин-индуцированная гинекомастия', frequency: 'common' },
      { effect: 'Агрессия, бессонница, «трен-кашель»', frequency: 'common' },
      { effect: 'Почечная токсичность (не гепатотоксичен!)', frequency: 'common' },
      { effect: 'Супрессия HPTA (полная, быстрое восстановление)', frequency: 'common' },
      { effect: 'Ночная потливость и бессонница', frequency: 'common' },
      { effect: 'Кардиотоксичность (гипертрофия левого желудочка)', frequency: 'rare' },
      { effect: 'Психозоподобные состояния', frequency: 'very_rare' },
    ],
    dosageRange: { min: 50, max: 350, unit: 'мг/нед', frequency: 'через день ( acetate)' },
  },

  oxan: {
    id: 'oxan',
    description: 'Оксандролон (Анавар) — пероральный ААС с минимальной андрогенной активностью и низким гепатотоксическим потенциалом. Популярен на сушке и у женщин.',
    mechanism: 'Слабый агонист AR (анаболический индекс 322-630 vs тестостерон 100). Не ароматизируется, не конвертируется в ДГТ. Активирует AR → ↑ белковый синтез, ↑ азотистый баланс, ↑ IGF-1. Минимально подавляет HPTA при дозах <20 мг/день.',
    synergies: [
      { with: 'test_enan', type: 'synergistic', desc: 'Тестостерон как база + оксандролон для синергии белкового синтеза' },
      { with: 'stan', type: 'complementary', desc: 'Оба DHT-производные — синергия при сушке, но двойная нагрузка на суставы' },
    ],
    contraindications: ['Тяжёлая печёночная недостаточность', 'Рак простаты', 'Беременность', 'Гиперкальциемия при злокачественных опухолях'],
    sideEffects: [
      { effect: 'Лёгкая гепатотоксичность (меньше чем у других оралов)', frequency: 'rare' },
      { effect: 'Супрессия HPTA (дозозависимая)', frequency: 'common' },
      { effect: 'Дислипидемия (ЛПВП ↓)', frequency: 'common' },
      { effect: 'Снижение либидо при высоких дозах', frequency: 'rare' },
    ],
    dosageRange: { min: 20, max: 80, unit: 'мг/день', frequency: 'ежедневно' },
  },

  anastro: {
    id: 'anastro',
    description: 'Анастрозол (Аримидекс) — ингибитор ароматазы III поколения. Блокирует конверсию тестостерона в эстрадиол на >80%. Ключевой препарат контроля эстрогена на курсах.',
    mechanism: 'Обратимо связывает ароматазу → блокирует конверсию андростендиона и тестостерона в эстрадиол. Уменьшает эстрадиол на 80-96% при 1 мг/день. ↑ ЛГ и ФСГ через обратную связь (устранение отрицательной обратной связи эстрогена).',
    synergies: [
      { with: 'test_enan', type: 'complementary', desc: 'Предотвращает эстрадиоловые побочки на тестостероновых курсах' },
      { with: 'clomi', type: 'complementary', desc: 'ИА + кломид на ПКТ: ИА снижает эстрадиол, кломид стимулирует ЛГ/ФСГ' },
      { with: 'tren_acet', type: 'antagonistic', desc: 'Трен не ароматизируется — ИА может снизить эстрадиол до опасных уровней (суставы, либидо, настроение)' },
    ],
    contraindications: ['Беременность', 'Тяжёлый остеопороз (эстроген.Protectiv для костей)', 'Предменопауза без ЗТТ'],
    sideEffects: [
      { effect: 'Суставные боли (снижение эстрогена до критических уровней)', frequency: 'common' },
      { effect: 'Снижение либидо при передозировке', frequency: 'common' },
      { effect: 'Ухудшение липидного профиля (ЛПВП ↓↓ )', frequency: 'common' },
      { effect: 'Остеопороз при длительном применении', frequency: 'rare' },
      { effect: 'Депрессия и раздражительность', frequency: 'common' },
    ],
    dosageRange: { min: 0.25, max: 1, unit: 'мг/день', frequency: '2-3 раза в неделю' },
  },

  caberg: {
    id: 'caberg',
    description: 'Каберголин (Достинекс) — агонист дофаминовых D2-рецепторов длительного действия. Мощный супрессор пролактина. Необходим при 19-нор курсах.',
    mechanism: 'Мощный агонист D2-рецепторов → прямое ингибирование секреции пролактина лактотрофами аденогипофиза. Период полувыведения ~65 часов. Также снижает резистентность к инсулину через дофаминергические пути.',
    synergies: [
      { with: 'tren_acet', type: 'complementary', desc: 'Контроль пролактина, индуцированного тренболоном' },
      { with: 'deca', type: 'complementary', desc: 'Нандролон ↑ пролактин — каберголин подавляет' },
      { with: 'test_enan', type: 'complementary', desc: 'Контроль пролактина при стеках с 19-нор' },
    ],
    contraindications: ['Тяжёлая печёночная недостаточность', 'Фиброзные заболевания сердечных клапанов', 'Психозы', 'Неконтролируемая гипертензия'],
    sideEffects: [
      { effect: 'Тошнота и желудочно-кишечные нарушения', frequency: 'common' },
      { effect: 'Снижение АД (ортостатическая гипотензия)', frequency: 'common' },
      { effect: 'Импульсивные расстройства (гиперсексуальность, азартные игры)', frequency: 'rare' },
      { effect: 'Фиброз клапанов сердца при длительном применении', frequency: 'very_rare' },
    ],
    dosageRange: { min: 0.25, max: 1, unit: 'мг/нед', frequency: '1-2 раза в неделю' },
  },

  clomi: {
    id: 'clomi',
    description: 'Кломифена цитрат — селективный модулятор эстрогеновых рецепторов (SERM). Стандартный препарат ПКТ для восстановления HPTA.',
    mechanism: 'Конкурентно связывается с эстрогеновыми рецепторами в гипоталамусе и гипофизе → блокирует отрицательную обратную связь эстрадиола → ↑ ГнРГ → ↑ ЛГ и ФСГ. В периферических тканях действует как антиэстроген (грудь, простата) и эстроген (кость, липиды).',
    synergies: [
      { with: 'tamox', type: 'synergistic', desc: 'Комбинация Кломид + Тамоксифен — золотой стандарт ПКТ' },
      { with: 'hcg', type: 'complementary', desc: 'ХГЧ восстанавливает яички + Кломид стимулирует ЛГ/ФСГ' },
      { with: 'anastro', type: 'complementary', desc: 'ИА снижает эстрадиол, Кломид блокирует ER — синергия на ПКТ' },
    ],
    contraindications: ['Беременность', 'Тяжёлая печёночная недостаточность', 'Тромбоэмболия в анамнезе', 'Кисты яичников'],
    sideEffects: [
      { effect: 'Перепады настроения, раздражительность', frequency: 'common' },
      { effect: 'Затуманивание зрения (редко)', frequency: 'rare' },
      { effect: 'Приливы жара', frequency: 'common' },
      { effect: 'Головные боли', frequency: 'common' },
    ],
    dosageRange: { min: 25, max: 100, unit: 'мг/день', frequency: 'ежедневно на ПКТ' },
  },

  bpc157: {
    id: 'bpc157',
    description: 'BPC-157 (Body Protective Compound-157) — пептид из 15 аминокислот, производный белка желудка. Мощнейший регенератор тканей — связывает ангиогенные и цитопротекторные эффекты.',
    mechanism: 'Активирует VEGF (сосудистый эндотелиальный фактор роста) → ангиогенез → неоваскуляризация повреждённых тканей. Активирует FGF-2 → пролиферация фибробластов и синтез коллагена. Стабилизирует NO-путь → цитопротекция endothelial NO-synthase. Модулирует простагландиновый каскад через POS-путь.',
    synergies: [
      { with: 'tb500', type: 'synergistic', desc: 'BPC-157 (ангиогенез) + TB-500 (актин-ремоделирование) = синергия регенерации сухожилий и связок' },
      { with: 'vitamin_c', type: 'complementary', desc: 'Витамин C + BPC-157 → синергия синтеза коллагена и ангиогенеза' },
    ],
    contraindications: ['Активные злокачественные новообразования (ангиогенез может стимулировать рост опухолей)', 'Беременность'],
    sideEffects: [
      { effect: 'Возможная стимуляция ангиогенеза при скрытых опухолях', frequency: 'very_rare' },
      { effect: 'Лёгкая тошнота при пероральном приёме', frequency: 'rare' },
    ],
    dosageRange: { min: 200, max: 500, unit: 'мкг/день', frequency: '1-2 раза в день, 2-4 недели' },
  },

  semax: {
    id: 'semax',
    description: 'Семакс (Ме-Glu-His-Phe-Pro-Gly-Pro) — ноотропный пептид, синтетический аналог ACTH(4-7). Стимулирует нейрогенез, повышает BDNF, улучшает когнитивные функции.',
    mechanism: 'Активирует меланокортиновые рецепторы MC3/MC4 → ↑ BDNF и NGF в гиппокампе. Модулирует серотониновый и дофаминовый обмен. Улучшает церебральный кровоток через NO-путь. Нормализует баланс возбуждения/торможения в ЦНС.',
    synergies: [
      { with: 'selank', type: 'synergistic', desc: 'Семакс + Селанк = синергия нейропротекции и ноотропии' },
      { with: 'vitamin_b12', type: 'complementary', desc: 'Витамин B12 + Семакс = улучшение нервной проводимости' },
    ],
    contraindications: ['Беременность', 'Повышенная чувствительность к пептидам'],
    sideEffects: [
      { effect: 'Лёгкое раздражение слизистой носа', frequency: 'common' },
      { effect: 'Головная боль при высоких дозах', frequency: 'rare' },
    ],
    dosageRange: { min: 500, max: 2000, unit: 'мкг/день', frequency: '2 раза в день (назальный спрей)' },
  },

  selank: {
    id: 'selank',
    description: 'Селанк (Ме-Glu-His-Pro-Gly-Pro) — ноотропный пептид, синтетический аналог пептида Тимуса. Анксиолитическое и нейропротекторное действие.',
    mechanism: 'Модулирует дофаминовый, серотониновый и ГАМК-ергический обмен. ↑ BDNF и NGF. Стабилизирует баланс возбуждения/торможения в ЦНС. Обладает выраженным анксиолитическим эффектом без седации.',
    synergies: [
      { with: 'semax', type: 'synergistic', desc: 'Селанк + Семакс = синергия нейропротекции и ноотропии' },
      { with: 'vitamin_b12', type: 'complementary', desc: 'Витамин B12 + Селанк = улучшение нервной проводимости' },
    ],
    contraindications: ['Беременность', 'Повышенная чувствительность к пептидам'],
    sideEffects: [
      { effect: 'Лёгкое раздражение слизистой носа', frequency: 'common' },
      { effect: 'Головная боль при высоких дозах', frequency: 'rare' },
    ],
    dosageRange: { min: 500, max: 2000, unit: 'мкг/день', frequency: '2 раза в день (назальный спрей)' },
  },

  mk677: {
    id: 'mk677',
    description: 'Ибутаморен (MK-677) — пероральный секретагог гормона роста. Миметизирует грелиновый рецептор (GHSR), стимулирует пульс GH и IGF-1. Пероральная альтернатива инъекционному GH.',
    mechanism: 'Мощный агонист GHSR (грелинового рецептора) → стимуляция соматотрофов аденогипофиза → пульсирующая секреция GH → ↑ IGF-1 в печени. Также ↑ ЛГ/ФСГ (слабо) и ↑ аппетит через грелиновый путь в гипоталамусе.',
    synergies: [
      { with: 'cjc1295', type: 'synergistic', desc: 'GHRH (CJC) + GHSR-агонист (MK-677) = максимальный пульс GH, больше чем каждый по отдельности' },
      { with: 'berberine', type: 'complementary', desc: 'MK-677 может ↑ инсулинорезистентность → береберин компенсирует через AMPK' },
    ],
    contraindications: ['Активные злокачественные опухоли (GH/IGF-1 могут стимулировать рост)', 'Диабет 2 типа без контроля', 'Синдром МЭН', 'Беременность'],
    sideEffects: [
      { effect: 'Значительное ↑ аппетита', frequency: 'common' },
      { effect: 'Инсулинорезистентность (↑ глюкоза, ↑ инсулин)', frequency: 'common' },
      { effect: 'Задержка воды, отёки', frequency: 'common' },
      { effect: 'Летаргия при высоких дозах', frequency: 'rare' },
    ],
    dosageRange: { min: 10, max: 25, unit: 'мг/день', frequency: 'ежедневно перорально на ночь' },
  },

  ostarine: {
    id: 'ostarine',
    description: 'Остарин (MK-2866, GTx-024) — селективный модулятор андрогенных рецепторов (SARM). Анаболический эффект в мышцах и костях с минимальным воздействием на простату и кожу.',
    mechanism: 'Селективный агонист AR в мышечной и костной ткани → ↑ белковый синтез без активации AR в простате и коже. Анаболический индекс ~3:1 (мышцы:простата). Не ароматизируется, не конвертируется в ДГТ.',
    synergies: [
      { with: 'test_enan', type: 'synergistic', desc: 'Тестостерон как база + остарин для дополнительного анаболизма' },
      { with: 'anastro', type: 'antagonistic', desc: 'IA не нужны — остарин не ароматизируется, риск снижения эстрадиола до нуля' },
    ],
    contraindications: ['Беременность', 'Рак простаты (теоретический риск)', 'Тяжёлые заболевания печени'],
    sideEffects: [
      { effect: 'Супрессия HPTA (дозозависимая, обратимая)', frequency: 'common' },
      { effect: 'Лёгкое ↑ ЛПНП и ↓ ЛПВП', frequency: 'common' },
      { effect: 'Гепатотоксичность (реже чем у оральных ААС)', frequency: 'rare' },
    ],
    dosageRange: { min: 10, max: 25, unit: 'мг/день', frequency: 'ежедневно перорально' },
  },

  deca: {
    id: 'deca',
    description: 'Нандролон деканоат (Дека) — один из самых популярных ААС для массонабора и лечения остеопороза. Деканоатный эфир обеспечивает длительное высвобождение (период полувыведения ~15 дней).',
    mechanism: 'Агонист AR с высокой аффинностью. Скорость конверсии в эстроген ~20% от тестостерона (через ароматазу). Конвертируется в дигидронандролон (ДГН) через 5α-редуктазу — значительно менее андрогенный, чем ДГТ. ↑ синтез коллагена, ↑ минерализация костей, ↑ эритропоэз.',
    synergies: [
      { with: 'test_enan', type: 'synergistic', desc: 'Классический стек: тестостерон база + нандролон для синергии белкового синтеза' },
      { with: 'caberg', type: 'complementary', desc: 'Нандролон ↑ пролактин → каберголин подавляет пролактин' },
    ],
    contraindications: ['Рак простаты', 'Рак молочной железы', 'Тяжёлая гипертензия', 'Нефроз', 'Беременность'],
    sideEffects: [
      { effect: 'Пролактин-индуцированная гинекомастия и ↓ либидо', frequency: 'common' },
      { effect: 'Задержка жидкости (периферические отёки)', frequency: 'common' },
      { effect: 'Супрессия HPTA (очень длительная — до 6 мес)', frequency: 'common' },
      { effect: 'Дислипидемия (ЛПВП ↓)', frequency: 'common' },
      { effect: 'Синдром «Дека-дика» (эректильная дисфункция после курса)', frequency: 'common' },
    ],
    dosageRange: { min: 200, max: 600, unit: 'мг/нед', frequency: '1 раз в 7-10 дней' },
  },

  stan: {
    id: 'stan',
    description: 'Станозолол (Винстрол) — ДГТ-производный ААС с уникальным профилем: одновременно анаболический и умеренно антиэстрогенный. Не ароматизируется. Популярен на сушке.',
    mechanism: 'Агонист AR с пониженной аффинностью, но сниженным SHBG-связыванием → ↑ свободный тестостерон. Не ароматизируется. Ингибирует SHBG → ↑ биодоступность других ААС. Стимулирует эритропоэз. Умеренно гепатотоксичен.',
    synergies: [
      { with: 'test_enan', type: 'synergistic', desc: '↓ SHBG → ↑ свободный тестостерон — синергия при сушке' },
      { with: 'oxan', type: 'complementary', desc: 'Оба DHT-производных для сушки, но двойная суставная нагрузка' },
    ],
    contraindications: ['Тяжёлые заболевания печени', 'Гиперкальциемия', 'Рак простаты', 'Беременность'],
    sideEffects: [
      { effect: 'Гепатотоксичность (↑ АЛТ, АСТ)', frequency: 'common' },
      { effect: 'Дислипидемия (ЛПВП ↓, ЛПНП ↑)', frequency: 'common' },
      { effect: 'Суставные боли (снижение синтовиальной жидкости)', frequency: 'common' },
      { effect: 'Выпадение волос (ДГТ-зависимое)', frequency: 'common' },
      { effect: 'Сухость связок → риск разрыва', frequency: 'rare' },
    ],
    dosageRange: { min: 20, max: 50, unit: 'мг/день', frequency: 'ежедневно (орал) / через день (инъекция)' },
  },

  telmi: {
    id: 'telmi',
    description: 'Телмисартан (Микардис) — АРБ (антагонист рецепторов ангиотензина II) с уникальным PPAR-γ частичным агонизмом. Используется для кардиопротекции на ААС-курсах.',
    mechanism: 'Блокада AT1-рецепторов ангиотензина II → ↓ вазоконстрикция, ↓ альдостерон → ↓ АД. Частичный агонист PPAR-γ → ↑ инсулиновая чувствительность, ↑ липидный обмен, ↓ воспаление. Снижает TGF-β1 → нефропротекция. Улучшает эндотелиальную функцию через ↑ NO.',
    synergies: [
      { with: 'omega3', type: 'complementary', desc: 'Телмисартан + Омега-3 = синергия кардиопротекции через PPAR-γ и EPA/DHA' },
      { with: 'nac', type: 'complementary', desc: 'Телмисартан (нефропротекция) + NAC (гепатопротекция) = комбинированная органопротекция' },
    ],
    contraindications: ['Беременность (II и III триместр)', 'Двусторонний стеноз почечных артерий', 'Обструктивная гипертрофическая кардиомиопатия', 'Одновременный приём ИАПФ'],
    sideEffects: [
      { effect: 'Гипотензия (при передозировке)', frequency: 'common' },
      { effect: 'Головокружение', frequency: 'common' },
      { effect: 'Гиперкалиемия (редко)', frequency: 'rare' },
    ],
    dosageRange: { min: 20, max: 80, unit: 'мг/день', frequency: 'ежедневно' },
  },

  nac: {
    id: 'nac',
    description: 'N-ацетилцистеин (NAC) — предшественник глутатиона, главного внутриклеточного антиоксиданта. Гепатопротектор, муколитик, нейропротектор.',
    mechanism: 'Деацетилируется до цистеина → предшественник глутатиона (GSH) → нейтрализация ROS и электрофильных токсинов. Модулирует NF-κB → противовоспительное действие. Расщепляет дисульфидные связи мукопротеинов → муколитический эффект. Хелатирует тяжёлые металлы.',
    synergies: [
      { with: 'tudca', type: 'synergistic', desc: 'NAC (глутатион ↑) + TUDCA (холестаз) = максимальная гепатопротекция' },
      { with: 'vitamin_c', type: 'synergistic', desc: 'NAC (GSH ↑) + Vit C (водорастворимый антиоксидант) = синергия антиоксидантной защиты' },
    ],
    contraindications: ['Бронхиальная астма (риск бронхоспазма при ингаляции)', 'Тяжёлая печёночная недостаточность'],
    sideEffects: [
      { effect: 'Тошнота, желудочно-кишечные нарушения', frequency: 'common' },
      { effect: 'Неприятный запах (сероводород)', frequency: 'common' },
      { effect: 'Аллергические реакции (редко)', frequency: 'very_rare' },
    ],
    dosageRange: { min: 600, max: 1800, unit: 'мг/день', frequency: '1-2 раза в день' },
  },

  omega3: {
    id: 'omega3',
    description: 'Омега-3 жирные кислоты (EPA + DHA) — эссенциальные полиненасыщенные жирные кислоты. Кардиопротектор, противовоспалительный, нейропротектор.',
    mechanism: 'EPA и DHA интегрируются в фосфолипидный бислой мембран → ↓ вязкость, ↑ текучесть. Служат предшественниками противовоспалительных эйкозаноидов (PGE3, LTB5) вместо прововоспалительных PGE2/LTB4 из арахидоновой кислоты. Активируют PPAR-α и PPAR-γ → ↓ триглицериды, ↑ ЛПВП. DHA — ключевой компонент мембран нейронов.',
    synergies: [
      { with: 'telmi', type: 'complementary', desc: 'Омега-3 + Телмисартан → PPAR-γ синергия, максимальная кардиопротекция' },
      { with: 'vitamin_d3', type: 'complementary', desc: 'Омега-3 + Витамин D → синергия иммунитета и костного метаболизма' },
    ],
    contraindications: ['Гемофилия и другие нарушения свёртываемости (высокие дозы)', 'Одновременный приём антикоагулянтов без контроля МНО'],
    sideEffects: [
      { effect: 'Рыбный запах от тела', frequency: 'common' },
      { effect: 'Разжижение крови при высоких дозах', frequency: 'rare' },
      { effect: 'ЖК дискомфорт', frequency: 'common' },
    ],
    dosageRange: { min: 1000, max: 3000, unit: 'мг/день EPA+DHA', frequency: 'с едой 1-2 раза' },
  },

  vitamin_d3: {
    id: 'vitamin_d3',
    description: 'Витамин D3 (холекальциферол) — стероидный прогормон, синтезирующийся в коже под УФ. Критичен для кальциевого гомеостаза, иммунитета и тестостерона.',
    mechanism: 'Гидроксилируется в печени (25-OH-D3) → почках (1,25-OH2-D3 = кальцитриол) → связывается с VDR (витамин D рецептор) → активирует >200 генов. ↑ всасывание Ca/P в кишечнике, ↑ остеокальцин, ↑ ФПП-23. ↑ иммунитет через кателицидины. ↑ тестостерон через стимуляцию ЛГ.',
    synergies: [
      { with: 'vitamin_k2', type: 'synergistic', desc: 'D3 ↑ всасывание Ca → K2 направляет Ca в кости (остеокальцин), предотвращая кальцификацию сосудов' },
      { with: 'magnesium', type: 'synergistic', desc: 'Mg необходим для активации D3 (25-OHase) → синергия метаболизма витамина D' },
    ],
    contraindications: ['Гиперкальциемия', 'Гипервитаминоз D', 'Саркоидоз (риск гиперкальциемии)', 'Тяжёлая почечная недостаточность'],
    sideEffects: [
      { effect: 'Гиперкальциемия при передозировке (>10000 МЕ/день)', frequency: 'rare' },
      { effect: 'Тошнота при высоких дозах', frequency: 'rare' },
    ],
    dosageRange: { min: 2000, max: 5000, unit: 'МЕ/день', frequency: 'ежедневно с едой' },
  },
};