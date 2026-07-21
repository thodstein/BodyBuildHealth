// bioequivalence-base.ts — фармакокинетическая база для замены препаратов
// Главный врач: каждая замена должна учитывать биодоступность, форму соли и клиническую эквивалентность

export interface FormProfile {
  id: string;
  name: string;
  type: 'salt' | 'elemental' | 'chelate' | 'organic' | 'liposomal' | 'standardized_extract' | 'active_form' | 'probiotic' | 'herb';
  elementalFactor: number;
  bioavailability: number;
  absorptionNotes: string;
  bestTakenWith: 'empty_stomach' | 'with_food' | 'with_fat' | 'with_vitamin_c' | 'anytime' | 'before_meal' | 'bedtime';
  preferredFor?: string[];
  advantages?: string[];
  disadvantages?: string[];
  notes: string;
  evidence: 'A' | 'B' | 'C';
}

export const FORM_PROFILES: Record<string, FormProfile> = {
  magnesium_glycinate_form: {
    id: 'magnesium_glycinate_form',
    name: 'Магний бисглицинат (хелат)',
    type: 'chelate',
    elementalFactor: 0.143,
    bioavailability: 0.80,
    absorptionNotes: 'Высокая биодоступность, не вызывает слабительный эффект',
    bestTakenWith: 'anytime',
    preferredFor: ['Женщины', 'Чувствительный ЖКТ', 'Сон', 'Судороги'],
    advantages: ['Минимальный слабительный эффект', 'Глицин → успокоение + сон'],
    disadvantages: ['Таблетки крупные'],
    notes: 'ЭТАЛОН для общего применения. 400 мг = ~57 мг элементарного Mg.',
    evidence: 'A',
  },
  magnesium_citrate_form: {
    id: 'magnesium_citrate_form',
    name: 'Магний цитрат',
    type: 'salt',
    elementalFactor: 0.16,
    bioavailability: 0.60,
    absorptionNotes: 'Умеренная биодоступность, может иметь мягкий слабительный эффект',
    bestTakenWith: 'with_food',
    preferredFor: ['Запоры', 'Перед сном'],
    advantages: ['Помогает при запорах', 'Дешевле'],
    disadvantages: ['Слабительный эффект при >350 мг'],
    notes: '200-400 мг цитрата = ~32-64 мг элементарного Mg.',
    evidence: 'A',
  },
  magnesium_l_threonate_form: {
    id: 'magnesium_l_threonate_form',
    name: 'Магний L-треонат (Magtein®)',
    type: 'organic',
    elementalFactor: 0.072,
    bioavailability: 0.65,
    absorptionNotes: 'Проникает через ГЭБ → мозг',
    bestTakenWith: 'anytime',
    preferredFor: ['Когнитивные функции', 'Память', 'Пожилые'],
    advantages: ['Единственная форма, проходящая ГЭБ'],
    disadvantages: ['Дорого', 'МНОГО элементарного Mg НЕ даёт (мало)'],
    notes: '⚠ 2000 мг Magtein® = ~144 мг элементарного Mg (НЕ 2000 мг).',
    evidence: 'B',
  },
  magnesium_oxide_form: {
    id: 'magnesium_oxide_form',
    name: 'Магний оксид',
    type: 'oxide' as any,
    elementalFactor: 0.603,
    bioavailability: 0.04,
    absorptionNotes: 'Почти не усваивается, сильный слабительный эффект',
    bestTakenWith: 'empty_stomach',
    preferredFor: ['ТОЛЬКО как слабительное'],
    advantages: ['Дешёвый', 'Слабительный'],
    disadvantages: ['Биодоступность 4%'],
    notes: '❌ НЕ РЕКОМЕНДУЕТСЯ для восполнения дефицита Mg.',
    evidence: 'A',
  },
  zinc_picolinate_form: {
    id: 'zinc_picolinate_form',
    name: 'Цинк пиколинат',
    type: 'chelate',
    elementalFactor: 0.21,
    bioavailability: 0.85,
    absorptionNotes: 'Хелатная форма с пиколиновой кислотой',
    bestTakenWith: 'with_food',
    preferredFor: ['Иммунитет', 'Тестостерон', 'Кожа'],
    advantages: ['Высокая биодоступность'],
    disadvantages: ['Конкурирует с Cu, Fe, Ca'],
    notes: '30 мг пиколината = 6.3 мг элементарного Zn. UL = 40 мг/день.',
    evidence: 'A',
  },
  zinc_carnosine_form: {
    id: 'zinc_carnosine_form',
    name: 'Цинк-L-карнозин (1:1 хелат)',
    type: 'chelate',
    elementalFactor: 0.082,
    bioavailability: 0.70,
    absorptionNotes: 'Хелат цинка с дипептидом карнозином',
    bestTakenWith: 'empty_stomach',
    preferredFor: ['Гастрит', 'Язва', 'H. pylori'],
    advantages: ['Защищает и заживляет слизистую'],
    disadvantages: ['Мало Zn в дозе'],
    notes: '75 мг карнозина = 16 мг цинка.',
    evidence: 'B',
  },
  iron_bisglycinate_form: {
    id: 'iron_bisglycinate_form',
    name: 'Железо бисглицинат',
    type: 'chelate',
    elementalFactor: 0.20,
    bioavailability: 0.50,
    absorptionNotes: 'Высокая биодоступность, минимальные побочки',
    bestTakenWith: 'empty_stomach',
    preferredFor: ['Анемия', 'Чувствительный ЖКТ'],
    advantages: ['2-3x лучше FeSO4', 'Нет запоров'],
    disadvantages: ['Дороже'],
    notes: '25 мг бисглицината = 5 мг элементарного Fe.',
    evidence: 'A',
  },
  iron_sulfate_form: {
    id: 'iron_sulfate_form',
    name: 'Железо сульфат',
    type: 'salt',
    elementalFactor: 0.20,
    bioavailability: 0.20,
    absorptionNotes: 'Стандартная форма, но много побочек',
    bestTakenWith: 'with_vitamin_c',
    advantages: ['Дёшево'],
    disadvantages: ['Запоры', 'Тошнота', 'Окрашивает зубы'],
    notes: '100 мг сульфата = 20 мг Fe. UL = 45 мг/день.',
    evidence: 'A',
  },
  calcium_citrate_form: {
    id: 'calcium_citrate_form',
    name: 'Кальций цитрат',
    type: 'salt',
    elementalFactor: 0.21,
    bioavailability: 0.40,
    absorptionNotes: 'Усваивается натощак (не требует HCl)',
    bestTakenWith: 'anytime',
    preferredFor: ['Пожилые (↓HCl)', 'ИПП'],
    advantages: ['Не требует кислой среды', 'Меньше камней'],
    disadvantages: ['Таблетки крупные'],
    notes: '500 мг цитрата = 105 мг Ca.',
    evidence: 'A',
  },
  calcium_carbonate_form: {
    id: 'calcium_carbonate_form',
    name: 'Кальций карбонат',
    type: 'salt',
    elementalFactor: 0.40,
    bioavailability: 0.25,
    absorptionNotes: 'Нужна кислая среда желудка',
    bestTakenWith: 'with_food',
    preferredFor: ['Молодые здоровые'],
    advantages: ['Больше элементарного Ca', 'Дешевле'],
    disadvantages: ['Не работает натощак'],
    notes: '500 мг карбоната = 200 мг Ca. ТОЛЬКО с едой.',
    evidence: 'A',
  },
  vitamin_k2_mk7_form: {
    id: 'vitamin_k2_mk7_form',
    name: 'Витамин K2 (MK-7)',
    type: 'active_form',
    elementalFactor: 1.0,
    bioavailability: 0.80,
    absorptionNotes: 'Длительный T1/2 (72ч). Можно 1x/д.',
    bestTakenWith: 'with_fat',
    preferredFor: ['Кости + сосуды'],
    advantages: ['1x/д достаточно', 'Длительный эффект'],
    disadvantages: ['Дороже MK-4'],
    notes: '100-200 мкг/день с жирной едой.',
    evidence: 'A',
  },
  vitamin_k2_mk4_form: {
    id: 'vitamin_k2_mk4_form',
    name: 'Витамин K2 (MK-4)',
    type: 'active_form',
    elementalFactor: 1.0,
    bioavailability: 0.85,
    absorptionNotes: 'Короткий T1/2 (1-2ч). Нужно 3x/д.',
    bestTakenWith: 'with_fat',
    preferredFor: ['Быстрый эффект'],
    advantages: ['Быстро работает'],
    disadvantages: ['Нужно 3x/день'],
    notes: '1-15 мг 3x/день (1000-15000 мкг/день).',
    evidence: 'A',
  },
  coq10_ubiquinol_form: {
    id: 'coq10_ubiquinol_form',
    name: 'CoQ10 убихинол (восстановленная форма)',
    type: 'active_form',
    elementalFactor: 1.0,
    bioavailability: 0.85,
    absorptionNotes: 'Активная форма, особенно для >40 лет',
    bestTakenWith: 'with_fat',
    preferredFor: ['>40 лет', 'Статины'],
    advantages: ['8x биодоступность', 'Не нужно конвертировать'],
    disadvantages: ['Дороже'],
    notes: '100-300 мг/день с жирной едой.',
    evidence: 'A',
  },
  coq10_ubiquinone_form: {
    id: 'coq10_ubiquinone_form',
    name: 'CoQ10 убихинон (окисленная форма)',
    type: 'standardized_extract',
    elementalFactor: 1.0,
    bioavailability: 0.20,
    absorptionNotes: 'Нужно конвертировать в убихинол',
    bestTakenWith: 'with_fat',
    preferredFor: ['<40 лет', 'Экономия'],
    advantages: ['Дешевле'],
    disadvantages: ['Низкая абсорбция'],
    notes: 'Молодым нужно 2-3x больше чем убихинола.',
    evidence: 'A',
  },
  glucosamine_sulfate_form: {
    id: 'glucosamine_sulfate_form',
    name: 'Глюкозамин сульфат',
    type: 'salt',
    elementalFactor: 0.626,
    bioavailability: 0.55,
    absorptionNotes: 'Стандартная форма с доказанной эффективностью (GAIT trial)',
    bestTakenWith: 'with_food',
    preferredFor: ['Остеоартрит коленей'],
    advantages: ['GAIT trial доказал эффективность'],
    disadvantages: ['Содержит натрий/калий'],
    notes: '1500 мг сульфата = ~939 мг глюкозамина.',
    evidence: 'A',
  },
  glucosamine_hcl_form: {
    id: 'glucosamine_hcl_form',
    name: 'Глюкозамин HCl',
    type: 'salt',
    elementalFactor: 0.83,
    bioavailability: 0.50,
    absorptionNotes: 'Больше чистого глюкозамина, но меньше клинических данных',
    bestTakenWith: 'with_food',
    preferredFor: ['Низконатриевая диета'],
    advantages: ['Нет Na/K'],
    disadvantages: ['Меньше клинических исследований'],
    notes: '1500 мг HCl = ~1245 мг глюкозамина.',
    evidence: 'B',
  },
  alpha_lipoic_r_form: {
    id: 'alpha_lipoic_r_form',
    name: 'Альфа-липоевая кислота (R-форма)',
    type: 'active_form',
    elementalFactor: 1.0,
    bioavailability: 0.85,
    absorptionNotes: 'Биологически активный энантиомер',
    bestTakenWith: 'empty_stomach',
    preferredFor: ['Диабет/IR', 'Нейропатия'],
    advantages: ['2-4x биодоступность vs S-формы'],
    disadvantages: ['Дороже рацемата'],
    notes: '300 мг R-формы ≈ 600 мг рацемата.',
    evidence: 'A',
  },
  alpha_lipoic_racemate_form: {
    id: 'alpha_lipoic_racemate_form',
    name: 'Альфа-липоевая кислота (рацемат R+S)',
    type: 'standardized_extract',
    elementalFactor: 1.0,
    bioavailability: 0.40,
    absorptionNotes: '50% активной R, 50% неактивной S',
    bestTakenWith: 'empty_stomach',
    preferredFor: ['Бюджет'],
    advantages: ['Дешевле'],
    disadvantages: ['Только 50% активной формы'],
    notes: '600 мг рацемата ≈ 300 мг R-формы.',
    evidence: 'A',
  },
  creatine_monohydrate_form: {
    id: 'creatine_monohydrate_form',
    name: 'Креатин моногидрат',
    type: 'standardized_extract',
    elementalFactor: 0.879,
    bioavailability: 0.99,
    absorptionNotes: 'Золотой стандарт. 99% усваивается.',
    bestTakenWith: 'anytime',
    preferredFor: ['Сила', 'Масса'],
    advantages: ['99% биодоступность', 'Самая изученная форма'],
    disadvantages: ['Задержка воды 1-2 кг'],
    notes: '5 г моногидрата = 4.4 г креатина. Стандарт: 3-5 г/день.',
    evidence: 'A',
  },
  curcumin_liposomal_form: {
    id: 'curcumin_liposomal_form',
    name: 'Куркумин липосомальный / LongVida® / Meriva®',
    type: 'liposomal',
    elementalFactor: 1.0,
    bioavailability: 0.65,
    absorptionNotes: 'Мицеллы/липосомы → биодоступность ×65',
    bestTakenWith: 'with_fat',
    preferredFor: ['Воспаление', 'Долгосрочный приём'],
    advantages: ['65-100x абсорбция', 'Проходит ГЭБ'],
    disadvantages: ['Дорого'],
    notes: '500 мг Meriva® = ~500 мг чистого куркумина с биодоступностью 65x.',
    evidence: 'A',
  },
  curcumin_plain_form: {
    id: 'curcumin_plain_form',
    name: 'Куркумин обычный (порошок)',
    type: 'standardized_extract',
    elementalFactor: 1.0,
    bioavailability: 0.01,
    absorptionNotes: 'Плохо всасывается без жира и пиперина',
    bestTakenWith: 'with_fat',
    advantages: ['Дешёво'],
    disadvantages: ['Биодоступность 1%'],
    notes: 'Без пиперина/жира усваивается только 1%.',
    evidence: 'A',
  },
  omega3_triglyceride_form: {
    id: 'omega3_triglyceride_form',
    name: 'Омега-3 триглицеридная форма (TG)',
    type: 'organic',
    elementalFactor: 0.6,
    bioavailability: 0.70,
    absorptionNotes: 'Естественная форма рыбьего жира',
    bestTakenWith: 'with_fat',
    preferredFor: ['Все цели'],
    advantages: ['Лучшая абсорбция', 'Меньше окисляется'],
    disadvantages: ['Дороже этиловых эфиров'],
    notes: '2000 мг TG = 1200 мг EPA+DHA.',
    evidence: 'A',
  },
  omega3_ethyl_ester_form: {
    id: 'omega3_ethyl_ester_form',
    name: 'Омега-3 этиловые эфиры (EE)',
    type: 'standardized_extract',
    elementalFactor: 0.85,
    bioavailability: 0.50,
    absorptionNotes: 'Полусинтетическая форма',
    bestTakenWith: 'with_fat',
    preferredFor: ['Бюджет'],
    advantages: ['Высокая концентрация'],
    disadvantages: ['Хуже усваивается vs TG'],
    notes: '1000 мг EE = 850 мг EPA+DHA.',
    evidence: 'A',
  },
  vitamin_d3_cholecalciferol_form: {
    id: 'vitamin_d3_cholecalciferol_form',
    name: 'Витамин D3 (холекальциферол)',
    type: 'active_form',
    elementalFactor: 1.0,
    bioavailability: 0.80,
    absorptionNotes: 'Жирорастворимый! С жирной едой',
    bestTakenWith: 'with_fat',
    preferredFor: ['Все', 'Особенно зимой'],
    advantages: ['Лучшая форма vs D2'],
    disadvantages: ['Гиперкальциемия при передозировке'],
    notes: '5000 МЕ = 125 мкг. Верх: 10000 МЕ/день под контролем 25(OH)D.',
    evidence: 'A',
  },
  nac_n_form: {
    id: 'nac_n_form',
    name: 'N-ацетилцистеин (NAC)',
    type: 'active_form',
    elementalFactor: 1.0,
    bioavailability: 0.06,
    absorptionNotes: 'Низкая биодоступность per os',
    bestTakenWith: 'empty_stomach',
    preferredFor: ['Детокс', 'Печень'],
    advantages: ['Предшественник глутатиона'],
    disadvantages: ['Серосодержащий → запах', 'Плохая биодоступность'],
    notes: 'Стандарт: 600-1200 мг/день натощак. UL: 3000 мг.',
    evidence: 'A',
  },
  ashwagandha_ksm66_form: {
    id: 'ashwagandha_ksm66_form',
    name: 'Ашваганда KSM-66® (5% withanolides)',
    type: 'standardized_extract',
    elementalFactor: 1.0,
    bioavailability: 0.55,
    absorptionNotes: 'KSM-66 — запатентованный экстракт корня',
    bestTakenWith: 'with_food',
    preferredFor: ['Кортизол ↓', 'Тревожность', 'Тестостерон'],
    advantages: ['5% withanolides', '30+ РКИ'],
    disadvantages: ['Стимулирует щитовидку'],
    notes: '300-600 мг/день.',
    evidence: 'A',
  },
};

export interface BioequivalenceEntry {
  from: string;
  fromForm?: string;
  to: string;
  toForm?: string;
  doseRatio: number;
  notes: string;
  clinicalEquivalence: 'high' | 'moderate' | 'low';
}

export const BIOEQUIVALENCE: BioequivalenceEntry[] = [
  { from: 'magnesium_l_threonate', fromForm: 'magnesium_l_threonate_form', to: 'magnesium_glycinate', toForm: 'magnesium_glycinate_form', doseRatio: 0.072 / 0.143, notes: '⚠ L-треонат 2000 мг = 144 мг Mg; глицинат 800 мг = 114 мг Mg. НЕ ЭКВИВАЛЕНТНЫ (7.2% vs 14.3%).', clinicalEquivalence: 'low' },
  { from: 'magnesium', to: 'magnesium_glycinate', doseRatio: 1.0, notes: 'Стандартная замена. Обе формы в MgO equivalents.', clinicalEquivalence: 'high' },
  { from: 'magnesium_oxide', to: 'magnesium_glycinate', doseRatio: 0.04 / 0.80, notes: '❌ НЕ РЕКОМЕНДУЕТСЯ: оксид усваивается только 4%, глицинат 80%. Разница 20x.', clinicalEquivalence: 'low' },
  { from: 'coq10_ubiquinone', fromForm: 'coq10_ubiquinone_form', to: 'coq10_ubiquinol', toForm: 'coq10_ubiquinol_form', doseRatio: 0.20 / 0.85, notes: '⚠ Убихинол в 4.25x биодоступнее. 200 мг убихинона = 47 мг убихинола.', clinicalEquivalence: 'moderate' },
  { from: 'glucosamine', fromForm: 'glucosamine_sulfate_form', to: 'glucosamine_hcl', toForm: 'glucosamine_hcl_form', doseRatio: 0.83 / 0.626, notes: '1500 мг сульфата = 939 мг глюкозамина = 1130 мг HCl.', clinicalEquivalence: 'high' },
  { from: 'zinc', to: 'zinc_picolinate', doseRatio: 0.20 / 0.21, notes: 'Почти идентичная абсорбция. Замена 1:1.', clinicalEquivalence: 'high' },
  { from: 'zinc', to: 'zinc_carnosine', doseRatio: 0.20 / 0.082, notes: '⚠ Карнозин содержит 8% Zn. Для 8 мг Zn нужно 100 мг карнозина.', clinicalEquivalence: 'moderate' },
  { from: 'calcium_citrate', to: 'calcium_carbonate', doseRatio: 0.40 / 0.21, notes: 'Карбонат: 40% Ca, но требует HCl. Цитрат: 21% Ca, работает натощак.', clinicalEquivalence: 'high' },
  { from: 'alpha_lipoic_racemate', to: 'alpha_lipoic_r_form', doseRatio: 0.5, notes: '300 мг R-формы = 600 мг рацемата (R+S). R в 2x активнее.', clinicalEquivalence: 'moderate' },
  { from: 'iron_sulfate', to: 'iron_bisglycinate', doseRatio: 0.20 / 0.50, notes: 'Бисглицинат усваивается в 2-3x лучше, меньше побочек.', clinicalEquivalence: 'high' },
  { from: 'vitamin_k2_mk4', to: 'vitamin_k2_mk7', doseRatio: 15, notes: 'MK-4 нужно 15000 мкг = 15 мг. MK-7: 100-200 мкг.', clinicalEquivalence: 'moderate' },
];

export const CRITICAL_REPLACEMENT_NOTES: Record<string, string> = {
  zinc_carnosine: '⚠ Только при гастрите/язве. Для иммунитета и тестостерона — picolinate.',
  curcumin: '⚠ БЕЗ пиперина усваивается только 1%. Всегда проверять «+piperine».',
  vitamin_k2: '⚠ MK-4 vs MK-7 — разные дозировки (мг vs мкг).',
  coq10: '⚠ Убихинон vs убихинол. После 40 лет — только убихинол.',
  alpha_lipoic: '⚠ R-форма vs рацемат. R в 2x активнее.',
  magnesium_l_threonate: '⚠ Magtein® 2000 мг = только 144 мг элементарного Mg. Уникально для мозга.',
  glucosamine: '⚠ Сульфат 2KCl vs HCl. 1500 мг ≠ 1500 мг чистого глюкозамина.',
  creatine: '⚠ Моногидрат — единственная форма с доказанной эффективностью. HMB ≠ креатин!',
  ashwagandha: '⚠ KSM-66 (корень, 5% withanolides) ≠ Sensoril (лист+корень, 10%).',
  tongkat_ali: '⚠ Стандартизация 200:1 vs 100:1. Нет универсальной дозы.',
  saw_palmetto: '⚠ 85-95% fatty acids обязательно. 320 мг/день стандарт.',
  berberine: '⚠ Может взаимодействовать с CYP3A4. Контроль.',
  iron: '⚠ Fe²⁺ бисглицинат всасывается в 2-3x лучше FeSO₄.',
  omega3: '⚠ TG > EE > Krill по абсорбции. Концентрат EPA+DHA ≥60%.',
  nac: '⚠ Биодоступность всего 6-10%. 1200 мг NAC = ~80 мг в крови.',
  magnesium: '⚠ Оксид магния усваивается только 4%! Только как слабительное.',
};

export function getFormProfile(formId: string): FormProfile | undefined {
  return FORM_PROFILES[formId];
}

export function getCriticalNote(substanceId: string): string | undefined {
  return CRITICAL_REPLACEMENT_NOTES[substanceId];
}

export interface DoseValidation {
  isCorrect: boolean;
  warning?: string;
  recommendedDoseMg: number;
  doseRatioUsed: number;
  clinicalEquivalence: 'high' | 'moderate' | 'low' | 'unknown';
}

export function validateReplacementDose(
  fromId: string,
  toId: string,
  fromMg: number,
  toMg: number
): DoseValidation {
  const entry = BIOEQUIVALENCE.find(
    e => (e.from === fromId && e.to === toId) || (e.from === toId && e.to === fromId)
  );

  if (!entry) {
    return {
      isCorrect: true,
      recommendedDoseMg: toMg,
      doseRatioUsed: 1.0,
      clinicalEquivalence: 'unknown',
    };
  }

  const ratio = entry.from === fromId ? entry.doseRatio : 1 / entry.doseRatio;
  const recommendedToMg = fromMg * ratio;
  const tolerance = 0.20;
  const lowerBound = recommendedToMg * (1 - tolerance);
  const upperBound = recommendedToMg * (1 + tolerance);

  const isCorrect = toMg >= lowerBound && toMg <= upperBound;
  let warning: string | undefined;
  if (!isCorrect) {
    if (toMg < lowerBound) {
      warning = `⚠ Доза ${toMg} мг НИЖЕ рекомендуемой ${Math.round(recommendedToMg)} мг.`;
    } else {
      warning = `⚠ Доза ${toMg} мг ВЫШЕ рекомендуемой ${Math.round(recommendedToMg)} мг.`;
    }
  }

  return {
    isCorrect,
    warning,
    recommendedDoseMg: Math.round(recommendedToMg),
    doseRatioUsed: ratio,
    clinicalEquivalence: entry.clinicalEquivalence,
  };
}

export function getEquivalentDoses(fromId: string, fromMg: number): { toId: string; recommendedMg: number; equivalence: string; notes: string }[] {
  const entries = BIOEQUIVALENCE.filter(e => e.from === fromId);
  return entries.map(e => ({
    toId: e.to,
    recommendedMg: Math.round(fromMg * e.doseRatio),
    equivalence: e.clinicalEquivalence,
    notes: e.notes,
  }));
}
