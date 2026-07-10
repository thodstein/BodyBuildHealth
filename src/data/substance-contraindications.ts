// ════════════════════════════════════════════════════════════════════════════
//  SUBSTANCE-CONTRAINDICATIONS — абсолютные и относительные противопоказания
//  + проверка по заболеваниям пользователя (state.health.conditions)
//
//  checkContraindications(substanceIds, healthConditions) → ContraAlert[]
// ════════════════════════════════════════════════════════════════════════════

export interface ContraindicationRule {
  substanceId: string;
  absolute: string[];      // ⛔ нельзя назначать
  absoluteConditions: string[];  // ⛔ нельзя при этом заболевании
  relative: string[];       // ⚠ осторожно
  relativeConditions: string[];
}

export const CONTRAINDICATIONS: Record<string, ContraindicationRule> = {

  tadalafil: {
    substanceId: 'tadalafil',
    absolute: ['Нитраты', 'α-блокаторы (без разнесения)', 'Тяжёлая гипотензия (<90/50)', 'Нестабильная стенокардия', 'Недавний ИМ (<90 дней)', 'Недавний инсульт (<6 мес)'],
    absoluteConditions: ['severe_hypotension', 'recent_mi', 'recent_stroke', 'unstable_angina', 'retinal_disease'],
    relative: ['Лёгкая/умеренная гипотензия', 'Аортальный стеноз', 'Склонность к приапизму', 'НАION в анамнезе'],
    relativeConditions: ['hypotension', 'aortic_stenosis', 'priapism_history', 'naion_history', 'bleeding_disorder'],
  },

  nebivolol: {
    substanceId: 'nebivolol',
    absolute: ['AV-блокада 2-3 ст.', 'ЧСС < 50', 'Декомпенсированная ХСН', 'Бронхиальная астма (β-блокада)', 'Сильный бронхоспазм'],
    absoluteConditions: ['av_block', 'bradycardia', 'decompensated_chf', 'asthma', 'copd'],
    relative: ['Лёгкая ХСН (компенсированная)', 'Периферические отёки', 'PVD (болезнь периферических артерий)', 'СД (маскировка гипогликемии)'],
    relativeConditions: ['mild_chf', 'diabetes', 'pvd', 'raynaud'],
  },

  cabergoline: {
    substanceId: 'cabergoline',
    absolute: ['Клапанные пороки (регургитация 3+)', 'Выпот в перикард', 'Фиброзирующие синдромы', 'Неконтролируемая гипотония'],
    absoluteConditions: ['valve_disease', 'pericardial_effusion', 'retroperitoneal_fibrosis', 'severe_hypotension'],
    relative: ['Гипотония', 'Психозы в анамнезе', 'Импульсивность/gambling (D2-дисрегуляция)', 'Беременность партнёрши'],
    relativeConditions: ['hypotension', 'psychosis', 'impulse_control'],
  },

  spironolactone: {
    substanceId: 'spironolactone',
    absolute: ['Гиперкалиемия (K⁺ >5.0)', 'ОПП/ХБП ст.4-5 (eGFR<30)', 'Болезнь Аддисона', 'Беременность', '⛔ ААС-курс (блокатор AR + 5α-редуктаза + CYP17)'],
    absoluteConditions: ['hyperkalemia', 'ckd_stage4_5', 'addison', 'pregnancy', 'aas_course'],
    relative: ['Пожилые (>65)', 'Сахарный диабет', 'Применение ACEi/ARBs (двойная K⁺)', 'Гинекомастия в анамнезе'],
    relativeConditions: ['elderly', 'diabetes', 'concurrent_raas', 'gynecomastia_history'],
  },

  hydrochlorothiazide: {
    substanceId: 'hydrochlorothiazide',
    absolute: ['Анурия', 'ХБП ст.4-5 (eGFR<30)', 'Гипокалиемия (K⁺ <3.5)', 'Гипонатриемия (Na⁺ <130)', 'Тяжёлая гипотензия (<90/60)', 'Аллергия к сульфаниламидам'],
    absoluteConditions: ['anuria', 'ckd_stage4_5', 'hypokalemia', 'hyponatremia', 'severe_hypotension', 'sulfa_allergy'],
    relative: ['Подагра (↑ мочевая кислота)', 'Сахарный диабет (↑ глюкоза)', 'Гиперурикемия', 'Беременность', 'Пожилые (>65)', 'Одновременный приём ACEi/ARBs'],
    relativeConditions: ['gout', 'diabetes', 'hyperuricemia', 'pregnancy', 'elderly', 'concurrent_raas'],
  },

  indapamide: {
    substanceId: 'indapamide',
    absolute: ['Анурия', 'ХБП ст.4-5 (eGFR<30)', 'Тяжёлая гипокалиемия (K⁺ <3.0)', 'Печёночная энцефалопатия', 'Тяжёлая гипотензия (<90/60)', 'Аллергия к сульфаниламидам'],
    absoluteConditions: ['anuria', 'ckd_stage4_5', 'hypokalemia', 'hepatic_encephalopathy', 'severe_hypotension', 'sulfa_allergy'],
    relative: ['Подагра (меньше риск чем HCTZ)', 'Сахарный диабет', 'Беременность', 'Пожилые (>65)', 'Одновременный приём ACEi/ARBs'],
    relativeConditions: ['gout', 'diabetes', 'pregnancy', 'elderly', 'concurrent_raas'],
  },

  metformin: {
    substanceId: 'metformin',
    absolute: ['eGFR < 30 (лактоацидоз)', 'Контрастное исследование (STOP 48 ч)', 'Острая гипоксия', 'Декомпенсированная ХСН', 'Тяжёлый алкоголизм'],
    absoluteConditions: ['ckd_stage4_5', 'contrast_study', 'hypoxia', 'decompensated_chf', 'alcoholism'],
    relative: ['eGFR 30-45', 'Пожилые', 'B12 дефицит (длительный приём)', 'Йод-контраст (низкий риск)'],
    relativeConditions: ['ckd_stage3', 'elderly', 'b12_deficiency'],
  },

  niacin: {
    substanceId: 'niacin',
    absolute: ['Активная язва Ж/ДПК', 'Тяжёлая печёночная недостаточность (ALT >200)', 'Подагра (острый приступ)'],
    absoluteConditions: ['peptic_ulcer', 'severe_hepatic', 'gout', 'hypersensitivity_niacin'],
    relative: ['Сахарный диабет (loss glycemic control)', 'Асимптоматическая гиперурикемия', 'Подагра в ремиссии', 'Glucose > 5.6', 'Язва в ремиссии'],
    relativeConditions: ['diabetes', 'hyperuricemia', 'gout_remission', 'glucose_elevated'],
  },

  anastrozole: {
    substanceId: 'anastrozole',
    absolute: ['Тяжёлый остеопороз (без DEXA оценки)', 'Беременность (категория X)'],
    absoluteConditions: ['severe_osteoporosis', 'pregnancy'],
    relative: ['Остеопения (Osteopenia T-score -1.0 to -2.5)', 'Заболевание печени (умеренное)', 'Ишемическая болезнь сердца (AI ↓HDL)'],
    relativeConditions: ['osteopenia', 'mild_hepatic', 'ihd'],
  },

  tamoxifen: {
    substanceId: 'tamoxifen',
    absolute: ['Тромбоэмболия в анамнезе (DVT/PE)', 'Беременность', 'Катаракта (↑ риск)'],
    absoluteConditions: ['thromboembolism_history', 'pregnancy', 'cataract'],
    relative: ['Пролонгированная иммобилизация', 'AF (atrial fibrillation)', 'Стеноз коронарных артерий'],
    relativeConditions: ['immobilization', 'afib', 'ihd'],
  },

  berberine: {
    substanceId: 'berberine',
    absolute: ['Беременность (стимулирует матку)', 'CYP3A4 со-субстрат (rare)'],
    absoluteConditions: ['pregnancy', 'cytochrome_p450_substrate'],
    relative: ['ЖКТ непереносимость (diarrhea, nausea)', 'СИОЗС/МАО ингибиторы'],
    relativeConditions: ['gastroint_intolerance', 'ssri', 'maoi'],
  },

  aspirin: {
    substanceId: 'aspirin',
    absolute: ['Язва Ж/ДПК', 'Кровотечение ЖК в анамнезе', 'H. pylori+ (до эрадикации)', 'Аспириновая астма', 'Беременность 3 триместр', 'Демпинг-синдром'],
    absoluteConditions: ['peptic_ulcer', 'gi_bleeding_history', 'h_pylori', 'aspirin_asthma', 'pregnancy_3rd', 'dumping_syndrome', 'bleeding_disorder'],
    relative: ['Пожилые (>65)', 'Гастрит в ремиссии', 'Антикоагулянты (additive)'],
    relativeConditions: ['elderly', 'gastritis_remission', 'anticoagulant'],
  },

  iron_bisglycinate: {
    substanceId: 'iron_bisglycinate',
    absolute: ['Гемохроматоз (HFE C282Y homo)', 'Сидеробластная анемия', 'Перегрузка железом (Ferritin >500)'],
    absoluteConditions: ['hemochromatosis', 'sideroblastic_anemia', 'iron_overload'],
    relative: ['Язвенный колит (enteral absorption variable)'],
    relativeConditions: ['ulcerative_colitis'],
  },

  curcumin: {
    substanceId: 'curcumin',
    absolute: ['Обструкция жёлчных путей', 'Камни жёлчного пузыря (осложнённые)'],
    absoluteConditions: ['biliary_obstruction', 'gallstones_complicated'],
    relative: ['Антикоагулянты (↑ кровотечение)', 'Сахарный диабет (↓ glucose)'],
    relativeConditions: ['anticoagulant', 'diabetes'],
  },

  clenbuterol: {
    substanceId: 'clenbuterol',
    absolute: ['Гипертиреоз', 'Тахиаритмии', 'ГКМП (гипертрофическая кардиомиопатия)', 'Неконтролированная гипертония'],
    absoluteConditions: ['hyperthyroidism', 'tachyarrhythmia', 'hocm', 'severe_hypertension'],
    relative: ['САД > 140/90 (↑ ещё)', 'Стенокардия', 'β-блокаторы (антагонизм)'],
    relativeConditions: ['hypertension', 'angina', 'concurrent_beta_blocker'],
  },

  melatonin: {
    substanceId: 'melatonin',
    absolute: ['Аутоиммунные болезни (↑ иммунитет)'],
    absoluteConditions: ['autoimmune_disease'],
    relative: ['Кровотечение (rare case reports)', 'Беременность', 'Вождение автомобиля'],
    relativeConditions: ['bleeding_disorder', 'pregnancy', 'driving'],
  },

  saw_palmetto: {
    substanceId: 'saw_palmetto',
    absolute: ['Гормон-зависимый рак (без одобрения онколога)'],
    absoluteConditions: ['hormone_cancer'],
    relative: ['Беременность (не актуально для мужчин)', 'Антикоагулянты (rare)'],
    relativeConditions: ['anticoagulant'],
  },

  hcg: {
    substanceId: 'hcg',
    absolute: ['Рак простаты', 'Рак яичка', 'Преждевременное половое созревание'],
    absoluteConditions: ['prostate_cancer', 'testicular_cancer', 'precocious_puberty'],
    relative: ['Гинекомастия в анамнезе', 'Астма'],
    relativeConditions: ['gynecomastia_history', 'asthma'],
  },

  tudca: {
    substanceId: 'tudca',
    absolute: ['Полная обструкция жёлчных путей', 'Острый холецистит'],
    absoluteConditions: ['biliary_obstruction_complete', 'acute_cholecystitis'],
    relative: ['ЖКБ с камнями >5 мм', 'Первичный склерозирующий холангит'],
    relativeConditions: ['gallstones_large'],
  },

  telmisartan: {
    substanceId: 'telmisartan',
    absolute: ['Двусторонний стеноз почечной артерии', 'Беременность (2-3 триместр)', 'Идиопатический ангионевротический отёк на АCEi/ARB'],
    absoluteConditions: ['bilateral_renal_artery_stenosis', 'pregnancy_2nd_3rd', 'hereditary_angioedema'],
    relative: ['K⁺ > 5.0 (гиперкалиемия)', 'БК стеноз (односторонний)'],
    relativeConditions: ['hyperkalemia', 'unilateral_renal_stenosis'],
  },

  garlic: {
    substanceId: 'garlic',
    absolute: [],
    absoluteConditions: [],
    relative: ['Антикоагулянты (повышает риск кровотечения)', 'Кровотечение в анамнезе', 'ЗА Democrat кровь (surgical)', 'HIV protease inhibitors'],
    relativeConditions: ['anticoagulant', 'bleeding_disorder', 'pre_surgery'],
  },

  agmatine: {
    substanceId: 'agmatine',
    absolute: ['Гипотония (<90/60)'],
    absoluteConditions: ['hypotension'],
    relative: ['СИОЗС/МАО ингибиторы (риск синдрома серотонина)'],
    relativeConditions: ['ssri', 'maoi'],
  },

  nattokinase: {
    substanceId: 'nattokinase',
    absolute: [],
    absoluteConditions: [],
    relative: ['Антикоагулянты (additive)', 'Кровотечение в анамнезе', 'Гемофилия', 'Pre-surgery (72 ч)'],
    relativeConditions: ['anticoagulant', 'bleeding_disorder', 'pre_surgery'],
  },

  serrapeptase: {
    substanceId: 'serrapeptase',
    absolute: [],
    absoluteConditions: [],
    relative: ['Антикоагулянты', 'Pre-surgery (72 ч)', 'Гемофилия'],
    relativeConditions: ['anticoagulant', 'pre_surgery', 'bleeding_disorder'],
  },

  potassium: {
    substanceId: 'potassium',
    absolute: ['Гиперкалиемия (>5.0)', 'K⁺-сберегающие диуретики (spiro)', 'ХБП ст.4-5 (eGFR<30)', 'ACEi/ARB + K⁺ добавки (hyperkalemia)'],
    absoluteConditions: ['hyperkalemia', 'potassium_sparing_diuretic', 'ckd_stage4_5', 'ace_arb'],
    relative: ['ХБП ст.3 (eGFR 30-60)', 'Применение спиронолактона'],
    relativeConditions: ['ckd_stage3', 'spiro_concurrent'],
  },

  calcium: {
    substanceId: 'calcium',
    absolute: ['Гиперкальциемия (>2.6)', 'Саркоидоз'],
    absoluteConditions: ['hypercalcemia', 'sarcoidosis'],
    relative: ['Камни почек (calcium oxalate)', 'Дигоксин', 'Тиреоидные препараты (T4)'],
    relativeConditions: ['nephrolithiasis', 'digoxin', 'levothyroxine'],
  },
};

export interface ContraAlert {
  substanceId: string;
  severity: 'absolute' | 'relative';
  message: string;
  action: string;
  triggeredByCondition?: boolean;
}

// Маппинг: healthCondition string → внутренний id
const CONDITION_INVERSE: Record<string, string[]> = {};
// обратная инициализация не нужна: проверяем напрямую по substance absolute/relative string list

// ════════════════════════════════════════════════════════════════════════════
//  checkContraindications — проверка на абсолютные/относительные противопоказания
//  Возвращает ТОЛЬКО Алерты triggered по healthConditions + самую критичную general info
// ════════════════════════════════════════════════════════════════════════════
export function checkContraindications(
  substanceIds: string[],
  healthConditions?: string[]
): ContraAlert[] {
  const alerts: ContraAlert[] = [];
  const conditions = new Set((healthConditions || []).map(c => c.toLowerCase()));

  for (const subId of substanceIds) {
    const contra = CONTRAINDICATIONS[subId.toLowerCase()] || CONTRAINDICATIONS[subId];
    if (!contra) continue;

    // Абсолютные противопоказания ПО ЗАБОЛЕВАНИЯМ (приоритет — real alerts)
    for (const condId of contra.absoluteConditions) {
      if (conditions.has(condId.toLowerCase())) {
        alerts.push({
          substanceId: subId,
          severity: 'absolute',
          message: '⛔ ' + condId + ' — противопоказано',
          action: '⛔ Не назначать',
          triggeredByCondition: true,
        });
      }
    }

    // Относительные противопоказания ПО ЗАБОЛЕВАНИЯМ
    for (const condId of contra.relativeConditions) {
      if (conditions.has(condId.toLowerCase())) {
        alerts.push({
          substanceId: subId,
          severity: 'relative',
          message: '⚠ ' + condId,
          action: '⚠ Осторожно при сопутствующем заболевании',
          triggeredByCondition: true,
        });
      }
    }
  }

  // General recommendations (без disease триггера) — ТОЛЬКО если они критичные (block interactions)
  // Здесь пропускаем список absolute[] (полный справочник в expanded карточке)

  return alerts;
}

export function getContraindications(id: string): ContraindicationRule | null {
  return CONTRAINDICATIONS[id] || CONTRAINDICATIONS[id.toLowerCase()] || null;
}

export function hasContraindications(id: string): boolean {
  return !!getContraindications(id);
}