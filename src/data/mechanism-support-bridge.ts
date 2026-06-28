// ════════════════════════════════════════════════════════════
//  MECHANISM → SUPPORT SUBSTANCE BRIDGE
//  Полная цепочка: Organ → System → Mechanism → SupportSubstance
//  Основано на: system-mechanisms.ts (133 механизма)
//  Используется: recommendation-engine.ts, support-calculator.engine.ts
// ════════════════════════════════════════════════════════════

export const MECHANISM_TO_SUPPORT_SUBSTANCE: Record<string, string[]> = {
  // ── CARDIO (8) ──
  cardio_1: ['omega3','bergamot','vitamin_e','berberine','niacin','red_yeast_rice'], // Дислипидемия
  cardio_2: ['telmisartan','nebivolol','magnesium','diosmin','hesperidin','pycnogenol'], // Гипертензия
  cardio_3: ['coq10','magnesium','vitamin_k2','vitamin_d3','telmisartan'], // Гипертрофия ЛЖ
  cardio_4: ['serrapeptase','nattokinase','naringin','lumbrokinase','aspirin'], // Тромбогенный
  cardio_5: ['coq10','vitamin_e','nac','alpha_lipoic','omega3'], // Окислительный стресс
  cardio_6: ['l_arginine','citrulline','pycnogenol','telmisartan','nebivolol'], // Эндотелиальная
  cardio_7: ['magnesium','taurine','potassium_sup','l_theanine'], // Аритмогенность
  cardio_8: ['coq10','omega3','vitamin_e','alpha_lipoic','nac'], // Фиброз миокарда

  // ── HEPATIC (8) ──
  hepatic_1: ['tudca','milk_thistle','phosphatidylcholine','artichoke','naringin'], // Холестаз
  hepatic_2: ['nac','milk_thistle','alpha_lipoic','tudca','glycine'], // Цитолиз
  hepatic_3: ['milk_thistle','nac','vitamin_e','tudca'], // Пелиозный гепатит
  hepatic_4: ['milk_thistle','curcumin_sup','alpha_lipoic','selenium_sup'], // Опухоли
  hepatic_5: ['omega3','coq10','nac','alpha_lipoic','milk_thistle'], // Стеатоз
  hepatic_6: ['nac','milk_thistle','glutamine','vitamin_b6'], // Синтетическая функция
  hepatic_7: ['milk_thistle','nac','vitamin_b6','alpha_lipoic'], // Метаболизм лекарств
  hepatic_8: ['milk_thistle','nac','tudca','alpha_lipoic'], // Фиброз/цирроз

  // ── RENAL (7) ──
  renal_1: ['astragalus','taurine','cordyceps','d_mannose','vitamin_d3'], // Гиперфильтрация
  renal_2: ['astragalus','taurine','cordyceps','d_mannose'], // Тубулоинтерстициальный
  renal_3: ['astragalus','taurine','cordyceps','coq10','alpha_lipoic'], // ОПП
  renal_4: ['astragalus','taurine','cordyceps','omega3'], // Протеинурия
  renal_5: ['potassium_sup','magnesium','vitamin_k2','d_mannose'], // Нефролитиаз
  renal_6: ['vitamin_k2','magnesium','vitamin_d3','taurine'], // Гиперкальциемия
  renal_7: ['astragalus','taurine','cordyceps','vitamin_d3'], // ХБП

  // ── NEURO / NEUROTOX (8) ──
  neuro_1: ['phosphatidylserine','alpha_lipoic','coq10','omega3'], // Окислительный стресс
  neuro_2: ['ashwagandha','l_theanine','magnesium_l_threonate','glycine'], // ГАМК-ергическая
  neuro_3: ['chaga','cordyceps','lions_mane','omega3'], // Нейровоспаление
  neuro_4: ['lions_mane','phosphatidylserine','alpha_lipoic','vitamin_d3'], // Миелиновая
  neuro_5: ['coq10','alpha_lipoic','l_carnitine','vitamin_b6'], // Митохондриальная
  neuro_6: ['alpha_lipoic','coq10','vitamin_e','nac'], // Апоптоз нейронов
  neuro_7: ['lions_mane','phosphatidylserine','alpha_lipoic','coq10'], // Снижение нейрогенеза
  neuro_8: ['taurine','magnesium_l_threonate','l_theanine'], // Экситотоксичность

  neuro_tox_1: ['citicoline','fasoracetam','bromantane','lions_mane'], // Допамин
  neuro_tox_2: ['vitamin_b6','vitamin_b12','methylfolate','tmg'], // Серотонин
  neuro_tox_3: ['lions_mane','phosphatidylserine','bromantane','omega3'], // Нейростериды
  neuro_tox_4: ['alpha_lipoic','coq10','nac','l_carnitine'], // Митохондрии ЦНС
  neuro_tox_5: ['ashwagandha','glycine','magnesium_l_threonate'], // Агрессия
  neuro_tox_6: ['lions_mane','alpha_lipoic','phosphatidylserine'], // Когнитив
  neuro_tox_7: ['melatonin','ashwagandha','l_theanine','glycine'], // Сон
  neuro_tox_8: ['omega3','carnitine','coq10','alpha_lipoic'], // Мотонейроны

  // ── ENDOCRINE / hormonal ──
  endocrine_1: ['zinc_sup','shilajit','tongkat_ali','boron','fadogia'], // HPTA
  endocrine_2: ['zinc_sup','selenium_sup','boron','shilajit','vitamin_d3'], // Тестостерон
  endocrine_3: ['ashwagandha','zinc_sup','selenium_sup','boron'], // Лейдиг
  endocrine_4: ['vitex','p5p','indinol','zinc_sup'], // Пролактин
  endocrine_5: ['dim','indinol','mesterolone','zinc_sup'], // Эстрадиол
  endocrine_6: ['vitamin_d3','vitamin_k2','calcium','magnesium'], // Кости
  endocrine_7: ['boron','tongkat_ali','shilajit','vitamin_d3'], // SHBG
  endocrine_8: ['enclomiphene','tamoxifen','clomi','zinc_sup'], // PCT

  // ── HEMATOLOGIC (7) ──
  hematologic_1: ['serrapeptase','nattokinase','naringin','lumbrokinase','aspirin'], // Полицитемия
  hematologic_2: ['iron_supplement','vitamin_c','folate','vitamin_b12'], // Анемия
  hematologic_3: ['serrapeptase','nattokinase','omega3','vitamin_e'], // Гипервязкость
  hematologic_4: ['zinc_sup','selenium_sup','vitamin_d3','probiotic'], // Иммунитет
  hematologic_5: ['vitamin_d3','zinc_sup','vitamin_c','probiotic'], // Лейкопения
  hematologic_6: ['serrapeptase','nattokinase','naringin'], // Микротромбы
  hematologic_7: ['omega3','vitamin_e','alpha_lipoic'], // Окислительный

  // ── REPRODUCTIVE (7) ──
  reproductive_1: ['enclomiphene','tamoxifen','zinc_sup','boron'], // Яички
  reproductive_2: ['zinc_sup','shilajit','tongkat_ali','l_carnitine'], // Сперматогенез
  reproductive_3: ['enclomiphene','tamoxifen','zinc_sup'], // Фертильность
  reproductive_4: ['boron','zinc_sup','vitamin_d3'], // Стероидогенез
  reproductive_5: ['ashwagandha','shilajit','zinc_sup','p5p'], // Либидо
  reproductive_6: ['saw_palmetto','zinc_sup','selenium_sup'], // Простата
  reproductive_7: ['zinc_sup','vitamin_d3','boron'], // Гонады

  // ── MUSCULOSKELETAL (7) ──
  musculoskeletal_1: ['collagen_ii','vitamin_c','zinc_sup','copper_supplement'], // Сухожилия
  musculoskeletal_2: ['collagen_ii','vitamin_c','omega3','curcumin_sup'], // Связки
  musculoskeletal_3: ['magnesium','calcium','vitamin_d3','vitamin_k2'], // Кости
  musculoskeletal_4: ['coq10','alpha_lipoic','magnesium'], // Митохондрии мышц
  musculoskeletal_5: ['glutamine','collagen_ii','vitamin_c','omega3'], // Саркопения
  musculoskeletal_6: ['taurine','magnesium','potassium_sup'], // Судороги
  musculoskeletal_7: ['curcumin_sup','omega3','ashwagandha'], // Воспаление

  // ── METABOLIC (8) ──
  metabolic_1: ['berberine','alpha_lipoic','chromium','vitamin_d3'], // Инсулинорезистентность
  metabolic_2: ['berberine','alpha_lipoic','magnesium'], // Глюкоза
  metabolic_3: ['omega3','vitamin_e','berberine','alpha_lipoic'], // Висцеральный жир
  metabolic_4: ['omega3','vitamin_e','coq10','alpha_lipoic'], // Липотоксичность
  metabolic_5: ['vitamin_k2','vitamin_d3','magnesium','calcium'], // Кальций
  metabolic_6: ['taurine','magnesium','potassium_sup'], // Электролиты
  metabolic_7: ['omega3','vitamin_e','berberine','taurine'], // Подагра
  metabolic_8: ['vitamin_b12','methylfolate','tmg','taurine'], // Гомоцистеин

  // ── GH/IGF (7) ──
  ghigf_1: ['ashwagandha','shilajit','phosphatidylserine'], // Снижение GH
  ghigf_2: ['berberine','alpha_lipoic','chromium','magnesium'], // IGF-1 резистентность
  ghigf_3: ['alpha_lipoic','coq10','vitamin_c','omega3'], // Окислительный
  ghigf_4: ['vitamin_b12','methylfolate','vitamin_b6','tmg'], // Метилирование
  ghigf_5: ['omega3','vitamin_e','alpha_lipoic'], // Липиды
  ghigf_6: ['vitamin_d3','calcium','vitamin_k2','magnesium'], // Кости
  ghigf_7: ['coq10','alpha_lipoic','omega3'], // Митохондрии

  // ── INSULIN AXIS (8) ──
  ins_axis_1: ['alpha_lipoic','berberine','chromium','magnesium'], // Гипогликемия
  ins_axis_2: ['berberine','alpha_lipoic','chromium','vitamin_d3'], // Гипергликемия
  ins_axis_3: ['alpha_lipoic','magnesium','coq10'], // Окислительный
  ins_axis_4: ['berberine','omega3','vitamin_e','alpha_lipoic'], // Липотоксичность
  ins_axis_5: ['taurine','magnesium','potassium_sup'], // Электролиты
  ins_axis_6: ['vitamin_k2','vitamin_d3','calcium'], // Гипокалиемия
  ins_axis_7: ['alpha_lipoic','coq10','omega3'], // Митохондрии
  ins_axis_8: ['omega3','alpha_lipoic','berberine'], // IGFBP

  // ── BLOOD (7) ──
  blood_1: ['serrapeptase','nattokinase','naringin','aspirin'], // Тромбоциты
  blood_2: ['serrapeptase','nattokinase','omega3'], // Коагуляция
  blood_3: ['serrapeptase','nattokinase','lumbrokinase'], // Фибринолиз
  blood_4: ['vitamin_d3','zinc_sup','selenium_sup','probiotic'], // Лейкоциты
  blood_5: ['iron_supplement','vitamin_b12','folate','vitamin_c'], // Эритроциты
  blood_6: ['omega3','vitamin_e','alpha_lipoic'], // Окислительный
  blood_7: ['iron_supplement','vitamin_c','vitamin_b6'], // Железо

  // ── VESSELS (7) ──
  vessels_1: ['telmisartan','pycnogenol','diosmin','nebivolol'], // Вазоконстрикция
  vessels_2: ['pycnogenol','omega3','vitamin_e'], // Атеросклероз
  vessels_3: ['diosmin','hesperidin','pycnogenol'], // Венозный стаз
  vessels_4: ['omega3','vitamin_e','coq10','selenium_sup'], // Эндотелий
  vessels_5: ['serrapeptase','nattokinase','lumbrokinase'], // Микроциркуляция
  vessels_6: ['pycnogenol','omega3','vitamin_c'], // Капилляры
  vessels_7: ['telmisartan','pycnogenol','diosmin','omega3'], // Жёсткость

  // ── IMMUNITY (7) ──
  immunity_1: ['vitamin_d3','zinc_sup','selenium_sup','probiotic'], // Иммуносупрессия
  immunity_2: ['zinc_sup','vitamin_d3','selenium_sup'], // Т-клетки
  immunity_3: ['vitamin_c','omega3','curcumin_sup'], // Воспаление
  immunity_4: ['zinc_sup','vitamin_d3','probiotic'], // Аутоиммунитет
  immunity_5: ['probiotic','vitamin_d3','zinc_sup'], // Кишечник
  immunity_6: ['omega3','curcumin_sup','ashwagandha'], // Цитокины
  immunity_7: ['zinc_sup','vitamin_d3','probiotic'], // В-клетки

  // ── THYROID (7) ──
  thyroid_1: ['zinc_sup','selenium_sup','ashwagandha'], // T4→T3
  thyroid_2: ['zinc_sup','selenium_sup','vitamin_d3'], // Тиреоидит
  thyroid_3: ['selenium_sup','zinc_sup','omega3'], // Аутоиммунный
  thyroid_4: ['magnesium','vitamin_b12','coq10'], // Митохондрии
  thyroid_5: ['zinc_sup','selenium_sup','omega3'], // Липиды
  thyroid_6: ['vitamin_c','omega3','alpha_lipoic'], // Окислительный
  thyroid_7: ['selenium_sup','zinc_sup','ashwagandha'], // Тиреотоксикоз

  // ── PROSTATE (7) ──
  prostate_1: ['saw_palmetto','zinc_sup','selenium_sup','vitamin_d3'], // Гипертрофия
  prostate_2: ['saw_palmetto','zinc_sup','selenium_sup'], // ДГТ
  prostate_3: ['zinc_sup','vitamin_d3','omega3'], // ПСА
  prostate_4: ['saw_palmetto','zinc_sup','selenium_sup','vitamin_e'], // Окислительный
  prostate_5: ['saw_palmetto','zinc_sup','omega3'], // Воспаление
  prostate_6: ['zinc_sup','selenium_sup','vitamin_e'], // Апоптоз
  prostate_7: ['saw_palmetto','zinc_sup','selenium_sup'], // Неоплазия
};

/** Получить support-вещества по механизму */
export function getSupportByMechanism(mechanismId: string): string[] {
  return MECHANISM_TO_SUPPORT_SUBSTANCE[mechanismId] || [];
}

/** Получить support-вещества по системе */
export function getSupportBySystem(systemKey: string): string[] {
  const ids = new Set<string>();
  for (const [key, value] of Object.entries(MECHANISM_TO_SUPPORT_SUBSTANCE)) {
    if (key.startsWith(systemKey + '_')) {
      value.forEach(id => ids.add(id));
    }
  }
  return Array.from(ids);
}

/** Полный маппинг: орган → система → механизмы → support-препараты */
export function getFullChainSupport(organ: string): { system: string; mechanisms: string[]; supportIds: string[] } | null {
  // Орган → система (из system-mechanisms.ts структуры)
  const organToSystem: Record<string, string> = {
    liver: 'hepatic', heart: 'cardio', kidneys: 'renal', brain: 'neuro',
    testes: 'reproductive', prostate: 'reproductive', blood_vessels: 'vessels',
    thyroid: 'thyroid', pancreas: 'metabolic', bones: 'musculoskeletal',
    muscles: 'musculoskeletal', immune: 'immunity', skin: 'skin',
  };
  const sysKey = organToSystem[organ.toLowerCase()];
  if (!sysKey) return null;

  const mechanisms = Object.keys(MECHANISM_TO_SUPPORT_SUBSTANCE).filter(k => k.startsWith(sysKey + '_'));
  const supportIds = Array.from(new Set(mechanisms.flatMap(m => MECHANISM_TO_SUPPORT_SUBSTANCE[m] || [])));

  return { system: sysKey, mechanisms, supportIds };
}
