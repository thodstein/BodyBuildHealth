/**
 * Clinical Pathology Database — Полный реестр патологий, маркеров и связей
 *
 * Адаптировано из медицинского ТЗ для Telegram Mini App.
 * Интегрируется с drug-mapper.engine.ts и существующей системой рисков.
 * НЕ заменяет — ДОПОЛНЯЕТ существующий маппинг.
 *
 * 8 систем органов, 28 патологий, 100+ биомаркеров, 13 препаратов.
 *
 * @module clinical-pathology-db
 */

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export interface ClinicalMarker {
  code: string;
  name: string;
  ec50: number;
  isInverted: boolean;
  unit: string;
  description: string;
}

export interface ClinicalPathology {
  id: string;
  name: string;
  systemName: string;
  systemIcon: string;
  linkedMarkers: string[];
  kAggression: number;
  zCrit: number;
  genetics: Record<string, number>;
  pharmaTriggers: string[];
  instrumentalVerification: string;
  riskFormula: string;
}

export interface CompoundRiskMapping {
  compound: string;
  class: string;
  riskIds: string[];
  labPanel: string[];
  instrumentalPanel: string[];
}

export interface SystemGroup {
  systemKey: string;
  systemName: string;
  icon: string;
  pathologyIds: string[];
}

// ═══════════════════════════════════════════════════════════════════════════
// CLINICAL MARKER DATABASE
// ═══════════════════════════════════════════════════════════════════════════

export const CLINICAL_MARKERS: Record<string, ClinicalMarker> = {
  // ── Cardiovascular / Endothelial ──
  ADMA: { code: 'ADMA', name: 'Асимметричный диметиларгинин', ec50: 0.7, isInverted: false, unit: 'мкмоль/л', description: 'Маркер эндотелиальной дисфункции' },
  Homocysteine: { code: 'Homocysteine', name: 'Гомоцистеин', ec50: 15, isInverted: false, unit: 'мкмоль/л', description: 'Предиктор сердечно-сосудистого риска' },
  'Endothelin-1': { code: 'Endothelin-1', name: 'Эндотелин-1', ec50: 2.5, isInverted: false, unit: 'пг/мл', description: 'Вазоконстрикторный пептид' },
  NO: { code: 'NO', name: 'Оксид азота', ec50: 20, isInverted: true, unit: 'мкмоль/л', description: 'Вазодилататор (падение = риск)' },

  // ── Blood / Erythrocytosis ──
  Hematocrit: { code: 'Hematocrit', name: 'Гематокрит', ec50: 52, isInverted: false, unit: '%', description: 'Объём эритроцитов' },
  Hemoglobin: { code: 'Hemoglobin', name: 'Гемоглобин', ec50: 17, isInverted: false, unit: 'г/дл', description: 'Кислородная ёмкость' },
  RBC: { code: 'RBC', name: 'Эритроциты', ec50: 6.0, isInverted: false, unit: '10¹²/л', description: 'Количество красных клеток' },
  EPO: { code: 'EPO', name: 'Эритропоэтин', ec50: 25, isInverted: false, unit: 'мМЕ/мл', description: 'Стимулятор эритропоэза' },

  // ── Coagulation ──
  Fibrinogen: { code: 'Fibrinogen', name: 'Фибриноген', ec50: 4.0, isInverted: false, unit: 'г/л', description: 'Фактор свёртывания I' },
  'D-Dimer': { code: 'D-Dimer', name: 'D-димер', ec50: 500, isInverted: false, unit: 'нг/мл', description: 'Продукт деградации фибрина' },
  Platelet_Aggregation: { code: 'Platelet_Aggregation', name: 'Агрегация тромбоцитов', ec50: 80, isInverted: false, unit: '%', description: 'Склонность к тромбообразованию' },
  Antithrombin_III: { code: 'Antithrombin_III', name: 'Антитромбин III', ec50: 80, isInverted: true, unit: '%', description: 'Естественный антикоагулянт' },

  // ── Lipids ──
  LDL: { code: 'LDL', name: 'ЛПНП', ec50: 4.0, isInverted: false, unit: 'ммоль/л', description: 'Плохой холестерин' },
  HDL: { code: 'HDL', name: 'ЛПВП', ec50: 1.0, isInverted: true, unit: 'ммоль/л', description: 'Хороший холестерин (падение = риск)' },
  Triglycerides: { code: 'Triglycerides', name: 'Триглицериды', ec50: 2.5, isInverted: false, unit: 'ммоль/л', description: 'Энергетические жиры' },
  ApoB: { code: 'ApoB', name: 'Аполипопротеин B', ec50: 1.2, isInverted: false, unit: 'г/л', description: 'Атерогенные частицы' },
  ApoA1: { code: 'ApoA1', name: 'Аполипопротеин A1', ec50: 1.0, isInverted: true, unit: 'г/л', description: 'Антиатерогенные частицы (падение = риск)' },

  // ── Blood Pressure ──
  SBP: { code: 'SBP', name: 'Систолическое АД', ec50: 140, isInverted: false, unit: 'мм рт.ст.', description: 'Верхнее давление' },
  DBP: { code: 'DBP', name: 'Диастолическое АД', ec50: 90, isInverted: false, unit: 'мм рт.ст.', description: 'Нижнее давление' },
  Aldosterone: { code: 'Aldosterone', name: 'Альдостерон', ec50: 300, isInverted: false, unit: 'пмоль/л', description: 'Минералокортикоид' },
  Renin: { code: 'Renin', name: 'Ренин', ec50: 40, isInverted: false, unit: 'мкМЕ/мл', description: 'Регулятор АД' },

  // ── Cardiac ──
  'NT-proBNP': { code: 'NT-proBNP', name: 'NT-proBNP', ec50: 125, isInverted: false, unit: 'пг/мл', description: 'Маркер сердечной недостаточности' },
  'hs-TnI': { code: 'hs-TnI', name: 'Высокочувствительный тропонин I', ec50: 0.04, isInverted: false, unit: 'нг/мл', description: 'Повреждение миокарда' },
  'CK-MB': { code: 'CK-MB', name: 'Креатинкиназа-МВ', ec50: 25, isInverted: false, unit: 'Ед/л', description: 'Сердечная изоформа КФК' },
  'Galectin-3': { code: 'Galectin-3', name: 'Галектин-3', ec50: 17.8, isInverted: false, unit: 'нг/мл', description: 'Маркер фиброза миокарда' },

  // ── Edema ──
  Na: { code: 'Na', name: 'Натрий', ec50: 148, isInverted: false, unit: 'ммоль/л', description: 'Задержка жидкости' },
  Albumin: { code: 'Albumin', name: 'Альбумин', ec50: 35, isInverted: true, unit: 'г/л', description: 'Онкотическое давление (падение = отёки)' },
  Total_Protein: { code: 'Total_Protein', name: 'Общий белок', ec50: 60, isInverted: true, unit: 'г/л', description: 'Белковый статус' },

  // ── Hepatic ──
  ALT: { code: 'ALT', name: 'АЛТ', ec50: 50, isInverted: false, unit: 'Ед/л', description: 'Цитолиз гепатоцитов' },
  AST: { code: 'AST', name: 'АСТ', ec50: 45, isInverted: false, unit: 'Ед/л', description: 'Митохондриальное повреждение' },
  'LDH-5': { code: 'LDH-5', name: 'ЛДГ-5', ec50: 250, isInverted: false, unit: 'Ед/л', description: 'Печёночная изоформа ЛДГ' },
  Bilirubin_Direct: { code: 'Bilirubin_Direct', name: 'Билирубин прямой', ec50: 5, isInverted: false, unit: 'мкмоль/л', description: 'Холестаз' },
  Bilirubin_Total: { code: 'Bilirubin_Total', name: 'Билирубин общий', ec50: 21, isInverted: false, unit: 'мкмоль/л', description: 'Общий билирубин' },
  ALP: { code: 'ALP', name: 'Щелочная фосфатаза', ec50: 130, isInverted: false, unit: 'Ед/л', description: 'Холестаз/костный метаболизм' },
  GGT: { code: 'GGT', name: 'ГГТ', ec50: 60, isInverted: false, unit: 'Ед/л', description: 'Маркер холестаза' },
  Bile_Acids: { code: 'Bile_Acids', name: 'Желчные кислоты', ec50: 15, isInverted: false, unit: 'мкмоль/л', description: 'Застой желчи' },

  // ── Renal ──
  Proteinuria_24h: { code: 'Proteinuria_24h', name: 'Суточная протеинурия', ec50: 0.3, isInverted: false, unit: 'г/24ч', description: 'Повреждение клубочков' },
  ACR: { code: 'ACR', name: 'Альбумин/креатинин (ACR)', ec50: 30, isInverted: false, unit: 'мг/г', description: 'Микроальбуминурия' },
  Microalbuminuria: { code: 'Microalbuminuria', name: 'Микроальбуминурия', ec50: 30, isInverted: false, unit: 'мг/24ч', description: 'Ранний маркер нефропатии' },
  Cystatin_C: { code: 'Cystatin_C', name: 'Цистатин С', ec50: 1.2, isInverted: false, unit: 'мг/л', description: 'СКФ маркер' },
  Creatinine: { code: 'Creatinine', name: 'Креатинин', ec50: 120, isInverted: false, unit: 'мкмоль/л', description: 'Функция почек' },
  Urea: { code: 'Urea', name: 'Мочевина', ec50: 8.3, isInverted: false, unit: 'ммоль/л', description: 'Азотистый обмен' },
  eGFR: { code: 'eGFR', name: 'СКФ (CKD-EPI)', ec50: 60, isInverted: true, unit: 'мл/мин/1.73м²', description: 'Скорость фильтрации (падение = ХПН)' },
  Uric_Acid: { code: 'Uric_Acid', name: 'Мочевая кислота', ec50: 480, isInverted: false, unit: 'мкмоль/л', description: 'Пуриновый обмен' },
  pH_Urine: { code: 'pH_Urine', name: 'pH мочи', ec50: 5.0, isInverted: true, unit: '', description: 'Кислотность мочи (низкий pH = уратные камни)' },

  // ── Metabolic ──
  Glucose: { code: 'Glucose', name: 'Глюкоза', ec50: 3.5, isInverted: true, unit: 'ммоль/л', description: 'Гипогликемия (падение = опасность)' },
  'HOMA-IR': { code: 'HOMA-IR', name: 'Индекс HOMA-IR', ec50: 2.5, isInverted: false, unit: '', description: 'Инсулинорезистентность' },
  HbA1c: { code: 'HbA1c', name: 'HbA1c', ec50: 6.0, isInverted: false, unit: '%', description: 'Гликированный гемоглобин' },
  Insulin: { code: 'Insulin', name: 'Инсулин натощак', ec50: 12, isInverted: false, unit: 'мкМЕ/мл', description: 'Гиперинсулинемия' },
  'C-Peptide': { code: 'C-Peptide', name: 'С-пептид', ec50: 4.0, isInverted: false, unit: 'нг/мл', description: 'Эндогенная секреция инсулина' },
  Fructosamine: { code: 'Fructosamine', name: 'Фруктозамин', ec50: 285, isInverted: false, unit: 'мкмоль/л', description: 'Гликемия за 2-3 недели' },
  TSH: { code: 'TSH', name: 'ТТГ', ec50: 6.0, isInverted: false, unit: 'мМЕ/л', description: 'Тиреотропный гормон (рост = гипотиреоз)' },
  T4_free: { code: 'T4_free', name: 'Т4 свободный', ec50: 10, isInverted: true, unit: 'пмоль/л', description: 'Тироксин (падение = гипотиреоз)' },
  T3_free: { code: 'T3_free', name: 'Т3 свободный', ec50: 3.5, isInverted: true, unit: 'пмоль/л', description: 'Трийодтиронин (падение = гипотиреоз)' },
  'IGF-1': { code: 'IGF-1', name: 'ИФР-1 / Соматомедин-С', ec50: 350, isInverted: false, unit: 'нг/мл', description: 'Фактор роста (рост = онкориск)' },
  'IGFBP-3': { code: 'IGFBP-3', name: 'ИФР-связывающий белок-3', ec50: 2.0, isInverted: false, unit: 'мг/л', description: 'Регулятор ИФР-1' },

  // ── HPTA ──
  LH: { code: 'LH', name: 'ЛГ', ec50: 1.5, isInverted: true, unit: 'МЕ/л', description: 'Лютеинизирующий гормон (падение = супрессия)' },
  FSH: { code: 'FSH', name: 'ФСГ', ec50: 1.5, isInverted: true, unit: 'МЕ/л', description: 'Фолликулостимулирующий гормон (падение = супрессия)' },
  Testosterone_Total: { code: 'Testosterone_Total', name: 'Тестостерон общий', ec50: 10, isInverted: true, unit: 'нмоль/л', description: 'Эндогенный тестостерон (падение = гипогонадизм)' },
  Estradiol: { code: 'Estradiol', name: 'Эстрадиол (E2)', ec50: 160, isInverted: false, unit: 'пмоль/л', description: 'Ароматизация' },
  Prolactin: { code: 'Prolactin', name: 'Пролактин', ec50: 400, isInverted: false, unit: 'мМЕ/л', description: 'Гинекомастия/галакторея' },
  Progesterone: { code: 'Progesterone', name: 'Прогестерон', ec50: 3.0, isInverted: false, unit: 'нмоль/л', description: '19-nor активность' },
  PSA_total: { code: 'PSA_total', name: 'ПСА общий', ec50: 4.0, isInverted: false, unit: 'нг/мл', description: 'Простат-специфический антиген' },
  PSA_free: { code: 'PSA_free', name: 'ПСА свободный', ec50: 1.0, isInverted: false, unit: 'нг/мл', description: 'Свободная фракция ПСА' },
  DHT: { code: 'DHT', name: 'Дигидротестостерон', ec50: 2.5, isInverted: false, unit: 'нмоль/л', description: 'Активный андроген' },
  Free_Testosterone: { code: 'Free_Testosterone', name: 'Свободный тестостерон', ec50: 0.5, isInverted: false, unit: 'нмоль/л', description: 'Биодоступный тестостерон' },

  // ── CNS ──
  Cortisol_saliva: { code: 'Cortisol_saliva', name: 'Кортизол (слюна)', ec50: 15, isInverted: false, unit: 'нмоль/л', description: 'Стресс-гормон' },
  Serotonin: { code: 'Serotonin', name: 'Серотонин', ec50: 50, isInverted: true, unit: 'нг/мл', description: 'Нейротрансмиттер (падение = депрессия)' },
  Dopamine: { code: 'Dopamine', name: 'Дофамин', ec50: 100, isInverted: true, unit: 'пг/мл', description: 'Нейротрансмиттер (падение = апатия)' },
  ISI_Score: { code: 'ISI_Score', name: 'Индекс тяжести инсомнии', ec50: 15, isInverted: false, unit: 'баллы', description: 'Шкала бессонницы' },
  Melatonin_Night: { code: 'Melatonin_Night', name: 'Мелатонин ночной', ec50: 30, isInverted: true, unit: 'пг/мл', description: 'Гормон сна (падение = бессонница)' },

  // ── Immune ──
  'hs-CRP': { code: 'hs-CRP', name: 'Высокочувствительный СРБ', ec50: 3.0, isInverted: false, unit: 'мг/л', description: 'Системное воспаление' },
  'IL-6': { code: 'IL-6', name: 'Интерлейкин-6', ec50: 5.0, isInverted: false, unit: 'пг/мл', description: 'Провоспалительный цитокин' },
  'TNF-alpha': { code: 'TNF-alpha', name: 'Фактор некроза опухоли', ec50: 8.0, isInverted: false, unit: 'пг/мл', description: 'Воспалительный маркер' },
  GAGS_Score: { code: 'GAGS_Score', name: 'Шкала тяжести акне', ec50: 20, isInverted: false, unit: 'баллы', description: 'GAGS оценка акне' },

  // ── Musculoskeletal ──
  Tendon_Thickness: { code: 'Tendon_Thickness', name: 'Толщина сухожилия', ec50: 8.0, isInverted: false, unit: 'мм', description: 'УЗИ-маркер тендинопатии' },
  VAS_Pain: { code: 'VAS_Pain', name: 'Шкала боли (VAS)', ec50: 5.0, isInverted: false, unit: 'баллы', description: 'Субъективная боль' },
  EMG_Delay: { code: 'EMG_Delay', name: 'Задержка ЭНМГ', ec50: 5.0, isInverted: false, unit: 'мс', description: 'Скорость проведения нерва' },
  FibroIndex: { code: 'FibroIndex', name: 'Индекс фиброза печени', ec50: 0.5, isInverted: false, unit: '', description: 'FibroMax/FibroTest' },
};

// ═══════════════════════════════════════════════════════════════════════════
// PATHOLOGY DATABASE — 28 патологий в 8 системах
// ═══════════════════════════════════════════════════════════════════════════

export const CLINICAL_PATHOLOGIES: Record<string, ClinicalPathology> = {
  // ── Cardiovascular (7 патологий) ──
  endothelial_dysfunction: {
    id: 'endothelial_dysfunction',
    name: 'Эндотелиальная дисфункция и спазм микроциркуляторного русла',
    systemName: 'Сердечно-сосудистая система',
    systemIcon: '❤️',
    linkedMarkers: ['ADMA', 'Homocysteine', 'Endothelin-1', 'NO'],
    kAggression: 0.4, zCrit: 12.0,
    genetics: { MTHFR_mutation: 1.3, NOS3_variant: 1.5 },
    pharmaTriggers: ['Нандролон', 'Тренболон', 'Метандростенолон', 'Станозолол', 'Метилтриенолон'],
    instrumentalVerification: 'УЗДГ плечевой артерии (эндотелий-зависимая вазодилатация)',
    riskFormula: 'Hill(ADMA+Homocysteine+Endothelin1) × Hill_Inv(NO)',
  },
  erythrocytosis: {
    id: 'erythrocytosis',
    name: 'Истинный эритроцитоз и синдром повышенной вязкости',
    systemName: 'Сердечно-сосудистая система',
    systemIcon: '❤️',
    linkedMarkers: ['Hematocrit', 'Hemoglobin', 'RBC', 'EPO'],
    kAggression: 0.35, zCrit: 15.0,
    genetics: { JAK2_V617F: 2.5 },
    pharmaTriggers: ['Болденон', 'Тестостерон', 'Оксиметолон'],
    instrumentalVerification: 'Пульсоксиметрия, УЗДГ сосудов нижних конечностей',
    riskFormula: 'Hill(Hct+Hb+RBC)',
  },
  coagulopathy: {
    id: 'coagulopathy',
    name: 'Лекарственный тромбофилический статус (Коагулопатия)',
    systemName: 'Сердечно-сосудистая система',
    systemIcon: '❤️',
    linkedMarkers: ['Fibrinogen', 'D-Dimer', 'Platelet_Aggregation', 'Antithrombin_III'],
    kAggression: 0.5, zCrit: 10.0,
    genetics: { Factor_V_Leiden: 2.0, Prothrombin_G20210A: 1.8 },
    pharmaTriggers: ['Станозолол', 'Халотестин', 'Метилтриенолон', 'Тренболон'],
    instrumentalVerification: 'Тромбоэластография (ТЭГ), коагулограмма',
    riskFormula: 'Hill(Fibrinogen+D_Dimer+PlateletAgg) × Hill_Inv(Antithrombin_III)',
  },
  dyslipidemia: {
    id: 'dyslipidemia',
    name: 'Экстремальный атерогенный сдвиг (Дислипидемия)',
    systemName: 'Сердечно-сосудистая система',
    systemIcon: '❤️',
    linkedMarkers: ['LDL', 'Triglycerides', 'ApoB', 'ApoA1', 'HDL'],
    kAggression: 0.3, zCrit: 18.0,
    genetics: { ApoE4: 1.4, LDLR_mutation: 1.6 },
    pharmaTriggers: ['Все 17α-алкилированные ААС', 'Мастерон', 'Провирон', 'Тренболон'],
    instrumentalVerification: 'УЗДГ сонных и бедренных артерий (КИМ, бляшки)',
    riskFormula: 'Hill(LDL+TG+ApoB) × Hill_Inv(HDL+ApoA1)',
  },
  hypertension: {
    id: 'hypertension',
    name: 'Артериальная гипертензия',
    systemName: 'Сердечно-сосудистая система',
    systemIcon: '❤️',
    linkedMarkers: ['SBP', 'DBP', 'Aldosterone', 'Renin'],
    kAggression: 0.45, zCrit: 14.0,
    genetics: { AGT_M235T: 1.25 },
    pharmaTriggers: ['Метандростенолон', 'Оксиметолон', 'Тестостерон', 'Гормон Роста', 'Халотестин'],
    instrumentalVerification: 'СМАД (суточное мониторирование АД)',
    riskFormula: 'Hill(SBP) × Hill(DBP)',
  },
  myocardial_fibrosis: {
    id: 'myocardial_fibrosis',
    name: 'Концентрическое ремоделирование миокарда и фиброз ЛЖ',
    systemName: 'Сердечно-сосудистая система',
    systemIcon: '❤️',
    linkedMarkers: ['NT-proBNP', 'hs-TnI', 'CK-MB', 'Galectin-3'],
    kAggression: 0.2, zCrit: 24.0,
    genetics: { MYBPC3_variant: 1.5 },
    pharmaTriggers: ['Тренболон', 'Метилтриенолон', 'Тестостерон (сверхдозы)', 'Гормон Роста'],
    instrumentalVerification: 'ЭхоКГ с расчётом ИММЛЖ, МРТ сердца с гадолинием',
    riskFormula: 'Hill(NT-proBNP+hs-TnI+CK-MB+Galectin-3)',
  },
  edema: {
    id: 'edema',
    name: 'Системная гидрофильность тканей и периферические отёки',
    systemName: 'Сердечно-сосудистая система',
    systemIcon: '❤️',
    linkedMarkers: ['Na', 'Albumin', 'Total_Protein'],
    kAggression: 0.5, zCrit: 8.0,
    genetics: {},
    pharmaTriggers: ['Гормон Роста', 'Инсулин', 'Пептиды GHRP', 'Метандростенолон'],
    instrumentalVerification: 'Биоимпедансометрия (объём внеклеточной жидкости)',
    riskFormula: 'Hill(Na) × Hill_Inv(Albumin)',
  },

  // ── Hepatic (4 патологии) ──
  cytolysis: {
    id: 'cytolysis',
    name: 'Острый токсический цитолиз (повреждение гепатоцитов)',
    systemName: 'Гепатобилиарная система',
    systemIcon: '🫁',
    linkedMarkers: ['ALT', 'AST', 'LDH-5'],
    kAggression: 0.6, zCrit: 6.0,
    genetics: { CYP3A4_slow: 1.5 },
    pharmaTriggers: ['Метилтриенолон', 'Халотестин', 'Станозолол', 'Метандростенолон', 'Оксиметолон'],
    instrumentalVerification: 'УЗИ органов брюшной полости',
    riskFormula: 'Hill(ALT+AST)',
  },
  cholestasis: {
    id: 'cholestasis',
    name: 'Токсический внутрипеченочный холестаз',
    systemName: 'Гепатобилиарная система',
    systemIcon: '🫁',
    linkedMarkers: ['Bilirubin_Direct', 'Bilirubin_Total', 'ALP', 'GGT', 'Bile_Acids'],
    kAggression: 0.55, zCrit: 8.0,
    genetics: { UGT2B17_deletion: 2.0 },
    pharmaTriggers: ['Оксандролон', 'Метандростенолон', 'Станозолол', 'Туринабол'],
    instrumentalVerification: 'УЗИ желчного пузыря и протоков',
    riskFormula: 'Hill(Bilirubin_Direct+ALP+GGT)',
  },
  hepatic_fibrosis: {
    id: 'hepatic_fibrosis',
    name: 'Лекарственный стеатогепатит и фиброз печени',
    systemName: 'Гепатобилиарная система',
    systemIcon: '🫁',
    linkedMarkers: ['FibroIndex', 'Bilirubin_Total', 'ALT'],
    kAggression: 0.25, zCrit: 20.0,
    genetics: { PNPLA3_variant: 1.4 },
    pharmaTriggers: ['Длительный приём оральных ААС', 'Инсулин (на профиците)'],
    instrumentalVerification: 'Эластометрия печени (FibroScan)',
    riskFormula: 'Hill(FibroIndex)',
  },
  peliosis: {
    id: 'peliosis',
    name: 'Печёночная пурпура и узловая аденома',
    systemName: 'Гепатобилиарная система',
    systemIcon: '🫁',
    linkedMarkers: ['Bilirubin_Total', 'ALT', 'AST'],
    kAggression: 0.3, zCrit: 15.0,
    genetics: {},
    pharmaTriggers: ['Халотестин', 'Оксиметолон', 'Метилтриенолон (экстремальные дозы)'],
    instrumentalVerification: 'КТ/МРТ брюшной полости с контрастированием',
    riskFormula: 'Hill(Bilirubin_Total+ALT)',
  },

  // ── Renal (3 патологии) ──
  hyperfiltration: {
    id: 'hyperfiltration',
    name: 'Клубочковая гиперфильтрация и повреждение базальной мембраны',
    systemName: 'Нефрологическая система',
    systemIcon: '🫘',
    linkedMarkers: ['Proteinuria_24h', 'ACR', 'Microalbuminuria'],
    kAggression: 0.4, zCrit: 12.0,
    genetics: { APOL1_mutation: 1.8 },
    pharmaTriggers: ['Гормон Роста', 'Тренболон', 'Инсулин', 'Высокобелковая диета'],
    instrumentalVerification: 'УЗИ почек с допплерографией',
    riskFormula: 'Hill(Proteinuria_24h)',
  },
  renal_failure: {
    id: 'renal_failure',
    name: 'Токсическая нефропатия и падение СКФ (ХПН)',
    systemName: 'Нефрологическая система',
    systemIcon: '🫘',
    linkedMarkers: ['Cystatin_C', 'Creatinine', 'Urea', 'eGFR'],
    kAggression: 0.45, zCrit: 11.0,
    genetics: { ACE_DD: 1.3 },
    pharmaTriggers: ['Все ААС (лидер: Тренболон)', 'Диуретики на дегидратации'],
    instrumentalVerification: 'Дуплексное сканирование почечных артерий',
    riskFormula: 'Hill(Cystatin_C) × Hill_Inv(eGFR)',
  },
  urolithiasis: {
    id: 'urolithiasis',
    name: 'Гиперурикемия и уратный нефролитиаз (МКБ)',
    systemName: 'Нефрологическая система',
    systemIcon: '🫘',
    linkedMarkers: ['Uric_Acid', 'pH_Urine'],
    kAggression: 0.3, zCrit: 16.0,
    genetics: { URAT1_variant: 1.5 },
    pharmaTriggers: ['Все ААС (пуриновый обмен)', 'Высокобелковая диета'],
    instrumentalVerification: 'УЗИ почек, КТ мочевыводящих путей',
    riskFormula: 'Hill(Uric_Acid) × Hill_Inv(pH_Urine)',
  },

  // ── Metabolic (4 патологии) ──
  hypoglycemia: {
    id: 'hypoglycemia',
    name: 'Острая индуцированная гипогликемия',
    systemName: 'Эндокринная система и обмен веществ',
    systemIcon: '🔄',
    linkedMarkers: ['Glucose'],
    kAggression: 0.7, zCrit: 5.0,
    genetics: {},
    pharmaTriggers: ['Инсулин', 'IGF-1 LR3/DES', 'Тестаморелин'],
    instrumentalVerification: 'CGM (непрерывный мониторинг глюкозы)',
    riskFormula: 'Hill_Inv(Glucose)',
  },
  insulin_resistance: {
    id: 'insulin_resistance',
    name: 'Периферическая инсулинорезистентность и вторичный СД2',
    systemName: 'Эндокринная система и обмен веществ',
    systemIcon: '🔄',
    linkedMarkers: ['HOMA-IR', 'HbA1c', 'Insulin', 'C-Peptide', 'Fructosamine'],
    kAggression: 0.3, zCrit: 18.0,
    genetics: { TCF7L2_variant: 1.4 },
    pharmaTriggers: ['Гормон Роста (>4 МЕ/сут)', 'Пептиды GHRP/GHRH', 'Оксиметолон'],
    instrumentalVerification: 'ПГТТ (пероральный глюкозотолерантный тест)',
    riskFormula: 'Hill(HOMA-IR) × Hill(HbA1c)',
  },
  hypothyroidism: {
    id: 'hypothyroidism',
    name: 'Индуцированный гипотиреоз (угнетение тиреоидной оси)',
    systemName: 'Эндокринная система и обмен веществ',
    systemIcon: '🔄',
    linkedMarkers: ['TSH', 'T4_free', 'T3_free'],
    kAggression: 0.3, zCrit: 15.0,
    genetics: {},
    pharmaTriggers: ['Гормон Роста (высокие дозы)', 'Тренболон', 'Станозолол'],
    instrumentalVerification: 'УЗИ щитовидной железы',
    riskFormula: 'Hill(TSH) × Hill_Inv(T4_free)',
  },
  onco_proliferation: {
    id: 'onco_proliferation',
    name: 'Патологическая соматомединовая пролиферация и онкориск',
    systemName: 'Эндокринная система и обмен веществ',
    systemIcon: '🔄',
    linkedMarkers: ['IGF-1', 'IGFBP-3'],
    kAggression: 0.2, zCrit: 25.0,
    genetics: { TP53_variant: 2.0 },
    pharmaTriggers: ['Гормон Роста', 'IGF-1 DES/LR3', 'Пептиды GHRP/GHRH'],
    instrumentalVerification: 'Комплексный онкоскрининг (МРТ, колоноскопия, гастроскопия)',
    riskFormula: 'Hill(IGF-1)',
  },

  // ── HPTA (3 патологии) ──
  hpta_shutdown: {
    id: 'hpta_shutdown',
    name: 'Тотальный блок гонадотропной функции (Вторичный гипогонадизм)',
    systemName: 'Репродуктивная система и ось HPTA',
    systemIcon: '⚧️',
    linkedMarkers: ['LH', 'FSH', 'Testosterone_Total'],
    kAggression: 0.8, zCrit: 4.0,
    genetics: { AR_CAG_short: 1.3 },
    pharmaTriggers: ['Все ААС. Абсолютная супрессия: Тренболон, Нандролон, Метилтриенолон'],
    instrumentalVerification: 'Спермограмма ВОЗ, УЗИ яичек (объём)',
    riskFormula: 'Hill_Inv(LH+FSH+Testosterone)',
  },
  gynecomastia: {
    id: 'gynecomastia',
    name: 'Патологическая ароматизация и пролактин-зависимая гинекомастия',
    systemName: 'Репродуктивная система и ось HPTA',
    systemIcon: '⚧️',
    linkedMarkers: ['Estradiol', 'Prolactin', 'Progesterone'],
    kAggression: 0.5, zCrit: 10.0,
    genetics: { CYP19A1_hyper: 1.5 },
    pharmaTriggers: ['Тестостерон', 'Болденон', 'Метандростенолон', 'Нандролон', 'Тренболон'],
    instrumentalVerification: 'УЗИ грудных желез',
    riskFormula: 'Hill(Estradiol) × Hill(Prolactin)',
  },
  prostate_bph: {
    id: 'prostate_bph',
    name: 'Пролиферация простаты и индукция ПСА',
    systemName: 'Репродуктивная система и ось HPTA',
    systemIcon: '⚧️',
    linkedMarkers: ['PSA_total', 'PSA_free', 'DHT'],
    kAggression: 0.15, zCrit: 30.0,
    genetics: { SRD5A2_hyper: 1.6 },
    pharmaTriggers: ['Тестостерон', 'Мастерон', 'Станозолол', 'Провирон'],
    instrumentalVerification: 'ТРУЗИ предстательной железы',
    riskFormula: 'Hill(PSA_total) × Hill(DHT)',
  },

  // ── CNS (2 патологии) ──
  neurotoxicity: {
    id: 'neurotoxicity',
    name: 'Андроген-индуцированная нейротоксичность, агрессия и тревога',
    systemName: 'Центральная нервная система',
    systemIcon: '🧠',
    linkedMarkers: ['Cortisol_saliva', 'Serotonin', 'Dopamine'],
    kAggression: 0.5, zCrit: 8.0,
    genetics: { COMT_slow: 1.7, MAOA_mutation: 1.5 },
    pharmaTriggers: ['Тренболон', 'Халотестин', 'Метилтриенолон'],
    instrumentalVerification: 'Патопсихологические шкалы (Beck, HAM-A, HADS)',
    riskFormula: 'Hill(Cortisol) × Hill_Inv(Serotonin+Dopamine)',
  },
  insomnia: {
    id: 'insomnia',
    name: 'Инсомния и деструкция фаз сна (Тренболоновая бессонница)',
    systemName: 'Центральная нервная система',
    systemIcon: '🧠',
    linkedMarkers: ['ISI_Score', 'Melatonin_Night'],
    kAggression: 0.6, zCrit: 7.0,
    genetics: {},
    pharmaTriggers: ['Тренболон (все эфиры)', 'Халотестин'],
    instrumentalVerification: 'Полисомнография (ПСГ)',
    riskFormula: 'Hill(ISI_Score)',
  },

  // ── Immune/Skin (2 патологии) ──
  inflammation: {
    id: 'inflammation',
    name: 'Хроническое системное воспаление низкой интенсивности',
    systemName: 'Иммунная система и дерматология',
    systemIcon: '🛡️',
    linkedMarkers: ['hs-CRP', 'IL-6', 'TNF-alpha'],
    kAggression: 0.4, zCrit: 14.0,
    genetics: {},
    pharmaTriggers: ['Хронический приём ААС', 'Инсулин (на висцеральном жире)'],
    instrumentalVerification: 'Не требуется (лабораторный мониторинг)',
    riskFormula: 'Hill(hs-CRP+IL-6+TNF-alpha)',
  },
  acne: {
    id: 'acne',
    name: 'Тяжелое андрогенное акне и деструкция сальных желез',
    systemName: 'Иммунная система и дерматология',
    systemIcon: '🛡️',
    linkedMarkers: ['DHT', 'Free_Testosterone', 'GAGS_Score'],
    kAggression: 0.45, zCrit: 12.0,
    genetics: {},
    pharmaTriggers: ['Тестостерон', 'Тренболон', 'Мастерон', 'Болденон'],
    instrumentalVerification: 'Дерматоскопия, шкала GAGS',
    riskFormula: 'Hill(DHT) × Hill(GAGS_Score)',
  },

  // ── Musculoskeletal (2 патологии) ──
  tendinopathy: {
    id: 'tendinopathy',
    name: 'Дегенерация коллагенового матрикса сухожилий (Тендинопатия)',
    systemName: 'Опорно-двигательный аппарат',
    systemIcon: '🦴',
    linkedMarkers: ['Tendon_Thickness', 'VAS_Pain', 'hs-CRP'],
    kAggression: 0.35, zCrit: 16.0,
    genetics: { COL5A1_variant: 1.4 },
    pharmaTriggers: ['Станозолол', 'Халотестин', 'Мастерон'],
    instrumentalVerification: 'МРТ/УЗИ сухожилий',
    riskFormula: 'Hill(Tendon_Thickness) × Hill(VAS_Pain)',
  },
  tunnel_syndrome: {
    id: 'tunnel_syndrome',
    name: 'Компрессионно-ишемическая нейропатия (Туннельный синдром)',
    systemName: 'Опорно-двигательный аппарат',
    systemIcon: '🦴',
    linkedMarkers: ['IGF-1', 'EMG_Delay'],
    kAggression: 0.4, zCrit: 13.0,
    genetics: {},
    pharmaTriggers: ['Гормон Роста (>5 МЕ)', 'Пептиды (CJC-1295, GHRP-2, Ипаморелин)'],
    instrumentalVerification: 'Электронейромиография (ЭНМГ)',
    riskFormula: 'Hill(IGF-1) × Hill(EMG_Delay)',
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// COMPOUND → RISK MAPPING
// ═══════════════════════════════════════════════════════════════════════════

export const COMPOUND_RISK_MAP: Record<string, CompoundRiskMapping> = {
  testosterone: {
    compound: 'Тестостерон',
    class: 'AAS_Base',
    riskIds: ['erythrocytosis', 'dyslipidemia', 'hypertension', 'hpta_shutdown', 'prostate_bph', 'acne', 'gynecomastia'],
    labPanel: ['Hematocrit', 'Hemoglobin', 'RBC', 'LDL', 'HDL', 'Triglycerides', 'LH', 'FSH', 'PSA_total', 'DHT', 'Estradiol'],
    instrumentalPanel: ['СМАД', 'ТРУЗИ простаты', 'УЗИ яичек'],
  },
  nandrolone: {
    compound: 'Нандролон',
    class: 'AAS_19-nor',
    riskIds: ['endothelial_dysfunction', 'myocardial_fibrosis', 'hpta_shutdown', 'gynecomastia'],
    labPanel: ['ADMA', 'NO', 'NT-proBNP', 'hs-TnI', 'Prolactin', 'Progesterone', 'LH', 'FSH'],
    instrumentalPanel: ['Эхокардиография', 'УЗИ грудных желез'],
  },
  trenbolone: {
    compound: 'Тренболон',
    class: 'AAS_19-nor_Modified',
    riskIds: ['endothelial_dysfunction', 'myocardial_fibrosis', 'dyslipidemia', 'hpta_shutdown', 'neurotoxicity', 'insomnia', 'hyperfiltration', 'hypothyroidism'],
    labPanel: ['ADMA', 'NT-proBNP', 'LDL', 'HDL', 'ApoB', 'Cortisol_saliva', 'Proteinuria_24h', 'Cystatin_C', 'TSH', 'T4_free'],
    instrumentalPanel: ['Эхокардиография', 'МРТ сердца', 'Полисомнография', 'Допплер почек'],
  },
  dianabol: {
    compound: 'Метандростенолон',
    class: 'AAS_17a-alkylated',
    riskIds: ['cytolysis', 'cholestasis', 'hypertension', 'edema', 'dyslipidemia', 'gynecomastia'],
    labPanel: ['ALT', 'AST', 'Bilirubin_Direct', 'ALP', 'GGT', 'Na', 'Albumin', 'LDL', 'HDL', 'Estradiol'],
    instrumentalPanel: ['УЗИ брюшной полости', 'СМАД'],
  },
  stanozolol: {
    compound: 'Станозолол',
    class: 'AAS_DHT-derivative_17a-alk',
    riskIds: ['dyslipidemia', 'coagulopathy', 'cytolysis', 'tendinopathy', 'cholestasis'],
    labPanel: ['LDL', 'HDL', 'ApoB', 'Fibrinogen', 'D-Dimer', 'Platelet_Aggregation', 'ALT', 'AST', 'Bilirubin_Direct'],
    instrumentalPanel: ['УЗДГ сонных артерий', 'УЗИ сухожилий', 'Тромбоэластография'],
  },
  oxandrolone: {
    compound: 'Оксандролон',
    class: 'AAS_17a-alkylated_Mild',
    riskIds: ['cholestasis', 'cytolysis', 'dyslipidemia'],
    labPanel: ['Bilirubin_Direct', 'ALP', 'ALT', 'AST', 'LDL', 'HDL'],
    instrumentalPanel: ['УЗИ брюшной полости'],
  },
  masteron: {
    compound: 'Дростанолон (Мастерон)',
    class: 'AAS_DHT-derivative',
    riskIds: ['prostate_bph', 'acne', 'dyslipidemia', 'tendinopathy'],
    labPanel: ['PSA_total', 'PSA_free', 'DHT', 'LDL', 'HDL', 'Free_Testosterone'],
    instrumentalPanel: ['ТРУЗИ простаты'],
  },
  boldenone: {
    compound: 'Болденон',
    class: 'AAS_Bold-derivative',
    riskIds: ['erythrocytosis', 'dyslipidemia', 'gynecomastia', 'acne'],
    labPanel: ['Hematocrit', 'Hemoglobin', 'RBC', 'EPO', 'LDL', 'HDL', 'Estradiol', 'DHT'],
    instrumentalPanel: ['УЗДГ сосудов'],
  },
  halotestin: {
    compound: 'Халотестин',
    class: 'AAS_17a-alkylated_Extreme',
    riskIds: ['cytolysis', 'coagulopathy', 'neurotoxicity', 'hypertension', 'peliosis', 'tendinopathy', 'insomnia'],
    labPanel: ['ALT', 'AST', 'LDH-5', 'Fibrinogen', 'Cortisol_saliva', 'Aldosterone', 'ISI_Score'],
    instrumentalPanel: ['УЗИ брюшной полости', 'СМАД', 'Патопсихологические шкалы'],
  },
  methyltrienolone: {
    compound: 'Метилтриенолон',
    class: 'AAS_17a-alkylated_Ultrapotent',
    riskIds: ['cytolysis', 'hepatic_fibrosis', 'hpta_shutdown', 'neurotoxicity', 'myocardial_fibrosis', 'peliosis', 'coagulopathy'],
    labPanel: ['ALT', 'AST', 'FibroIndex', 'LH', 'FSH', 'Cortisol_saliva', 'NT-proBNP', 'hs-TnI'],
    instrumentalPanel: ['Эластометрия печени', 'МРТ сердца', 'МРТ брюшной полости'],
  },
  growth_hormone: {
    compound: 'Гормон Роста',
    class: 'Somatotropin_Axis',
    riskIds: ['insulin_resistance', 'edema', 'hyperfiltration', 'tunnel_syndrome', 'hypothyroidism', 'onco_proliferation', 'hypertension'],
    labPanel: ['HOMA-IR', 'HbA1c', 'Insulin', 'Na', 'Proteinuria_24h', 'IGF-1', 'IGFBP-3', 'TSH', 'T4_free'],
    instrumentalPanel: ['Биоимпедансометрия', 'ЭНМГ', 'УЗИ щитовидной', 'Колоноскопия'],
  },
  insulin: {
    compound: 'Инсулин',
    class: 'Metabolic_Peptide',
    riskIds: ['hypoglycemia', 'insulin_resistance', 'dyslipidemia', 'edema', 'hyperfiltration', 'hepatic_fibrosis'],
    labPanel: ['Glucose', 'HOMA-IR', 'HbA1c', 'Na', 'Albumin', 'Triglycerides', 'HDL'],
    instrumentalPanel: ['CGM (непрерывный мониторинг глюкозы)'],
  },
  peptides_ghrp: {
    compound: 'Пептиды GHRP (GHRP-2/6, Гексарелин, Ипаморелин)',
    class: 'Peptide_Secretagogue_GHS',
    riskIds: ['gynecomastia', 'insulin_resistance', 'edema', 'neurotoxicity', 'tunnel_syndrome'],
    labPanel: ['Prolactin', 'HOMA-IR', 'Glucose', 'Na', 'Cortisol_saliva', 'IGF-1'],
    instrumentalPanel: ['Биоимпедансометрия', 'МРТ гипофиза'],
  },
  peptides_ghrh: {
    compound: 'Пептиды GHRH (CJC-1295, Серморелин, Тестаморелин)',
    class: 'Peptide_Secretagogue_GHRH',
    riskIds: ['insulin_resistance', 'tunnel_syndrome', 'edema', 'onco_proliferation'],
    labPanel: ['IGF-1', 'HOMA-IR', 'HbA1c', 'IGFBP-3'],
    instrumentalPanel: ['ЭНМГ'],
  },
  igf1: {
    compound: 'IGF-1 (LR3/DES)',
    class: 'Direct_Somatomedin',
    riskIds: ['hypoglycemia', 'onco_proliferation', 'tunnel_syndrome'],
    labPanel: ['Glucose', 'IGF-1', 'IGFBP-3'],
    instrumentalPanel: ['CGM', 'ЭНМГ'],
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// SYSTEM GROUPS
// ═══════════════════════════════════════════════════════════════════════════

export const SYSTEM_GROUPS: SystemGroup[] = [
  { systemKey: 'cardiovascular', systemName: 'Сердечно-сосудистая', icon: '❤️', pathologyIds: ['endothelial_dysfunction', 'erythrocytosis', 'coagulopathy', 'dyslipidemia', 'hypertension', 'myocardial_fibrosis', 'edema'] },
  { systemKey: 'hepatic', systemName: 'Гепатобилиарная', icon: '🫁', pathologyIds: ['cytolysis', 'cholestasis', 'hepatic_fibrosis', 'peliosis'] },
  { systemKey: 'renal', systemName: 'Нефрологическая', icon: '🫘', pathologyIds: ['hyperfiltration', 'renal_failure', 'urolithiasis'] },
  { systemKey: 'metabolic', systemName: 'Эндокринная и обмен', icon: '🔄', pathologyIds: ['hypoglycemia', 'insulin_resistance', 'hypothyroidism', 'onco_proliferation'] },
  { systemKey: 'hpta', systemName: 'Репродуктивная (HPTA)', icon: '⚧️', pathologyIds: ['hpta_shutdown', 'gynecomastia', 'prostate_bph'] },
  { systemKey: 'cns', systemName: 'Центральная нервная', icon: '🧠', pathologyIds: ['neurotoxicity', 'insomnia'] },
  { systemKey: 'immune', systemName: 'Иммунная и кожа', icon: '🛡️', pathologyIds: ['inflammation', 'acne'] },
  { systemKey: 'musculoskeletal', systemName: 'Опорно-двигательная', icon: '🦴', pathologyIds: ['tendinopathy', 'tunnel_syndrome'] },
];
