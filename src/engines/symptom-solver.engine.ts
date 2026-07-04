/**
 * symptom-solver.engine.ts — Профессиональный движок: Симптом → Проблема → Анализ → Решение
 * 
 * Охватывает 50+ симптомов, характерных для пользователей ААС, спортсменов и биохакеров.
 * Каждая запись: клинически обоснованные дифференциальные диагнозы, лабораторные маркеры,
 * препараты/нутрицевтики с дозировками, timeline ожидаемого эффекта и побочные явления.
 */

export type UrgencyLevel = 'critical' | 'warning' | 'standard';

export interface SymptomEntry {
  id: string;
  symptom: string;
  category: SymptomCategory;
  problems: ProblemEntry[];
  generalInfo: string;
  urgency?: UrgencyLevel;
  relatedSymptoms?: string[];
  quickFacts?: string[];
  linkedDrugs?: string[];
}

export interface ProblemEntry {
  problem: string;
  probability: 'high' | 'medium' | 'low';
  mechanism: string;
  labMarkers: LabMarker[];
  solutions: SolutionEntry[];
  expectations: ExpectationEntry[];
}

export interface LabMarker {
  marker: string;
  expectedChange: '↑' | '↑↑' | '↑↑↑' | '↓' | '↓↓' | '↔' | string;
  targetRange: string;
  when: string;
}

export interface SolutionEntry {
  substanceId: string;
  name: string;
  type: 'supplement' | 'pharma' | 'lifestyle';
  dose: string;
  mechanism: string;
  evidenceLevel: 'A' | 'B' | 'C';
}

export interface ExpectationEntry {
  timeline: string;
  effect: string;
  sideNote?: string;
}

export type SymptomCategory =
  | 'cardiovascular'
  | 'hepatic'
  | 'renal'
  | 'cns'
  | 'endocrine'
  | 'gastrointestinal'
  | 'musculoskeletal'
  | 'hematologic'
  | 'dermatologic'
  | 'psychological';

export const SYMPTOM_CATEGORY_LABELS: Record<SymptomCategory, string> = {
  cardiovascular: 'Сердечно-сосудистая',
  hepatic: 'Печень и гепатобилиарная',
  renal: 'Почки и мочевыделительная',
  cns: 'ЦНС и неврология',
  endocrine: 'Эндокринная и гормональная',
  gastrointestinal: 'ЖКТ и пищеварение',
  musculoskeletal: 'Опорно-двигательная',
  hematologic: 'Кровь и гемостаз',
  dermatologic: 'Кожа и дерматология',
  psychological: 'Психика и когнитивные',
};

export const SYMPTOM_CATEGORY_ICONS: Record<SymptomCategory, string> = {
  cardiovascular: '❤️',
  hepatic: '🫁',
  renal: '💧',
  cns: '🧠',
  endocrine: '⚕️',
  gastrointestinal: '🫀',
  musculoskeletal: '🦴',
  hematologic: '🩸',
  dermatologic: '🧴',
  psychological: '🧘',
};

export const PROBABILITY_LABELS: Record<string, string> = {
  high: 'Высокая',
  medium: 'Средняя',
  low: 'Низкая',
};

export const PROBABILITY_COLORS: Record<string, string> = {
  high: '#f44336',
  medium: '#ff9800',
  low: '#4caf50',
};

export const EVIDENCE_LABELS: Record<string, string> = {
  A: 'A — РКИ / мета-анализы',
  B: 'B — Когортные / суррогатные',
  C: 'C — Патофизиология / opinion',
};

export const EVIDENCE_COLORS: Record<string, string> = {
  A: '#4caf50',
  B: '#2196f3',
  C: '#ff9800',
};

export const URGENCY_LABELS: Record<UrgencyLevel, string> = {
  critical: 'Критическое — немедленно',
  warning: 'Требует внимания',
  standard: 'Стандартный',
};

export const URGENCY_COLORS: Record<UrgencyLevel, string> = {
  critical: '#f44336',
  warning: '#ff9800',
  standard: '#4caf50',
};

export const URGENCY_ICONS: Record<UrgencyLevel, string> = {
  critical: '🔴',
  warning: '🟡',
  standard: '🟢',
};

/** Метки препаратов для связи симптом↔вещество */
export const DRUG_LABELS: Record<string, string> = {
  testosterone: 'Тестостерон',
  trenbolone: 'Тренболон',
  nandrolone: 'Нандролон (Дека)',
  methandienone: 'Метандиенон (Дианобол)',
  oxymetholone: 'Оксиметолон (Анадрол)',
  stanozolol: 'Станозолол (Винстрол)',
  oxandrolone: 'Оксандролон (Анавар)',
  masteron: 'Мастерон (Дростанолон)',
  boldenone: 'Болденон (Эквипойз)',
  turinabol: 'Туринабол',
  gh: 'Гормон роста (GH)',
  insulin: 'Инсулин',
  igf1: 'IGF-1',
  clenbuterol: 'Кленбутерол',
  t3: 'T3 (трийодтиронин)',
  t4: 'T4 (тироксин)',
  ai: 'Ингибиторы ароматазы (AI)',
  serm: 'SERM (тамоксифен/кломифен)',
  hcg: 'hCG',
  all_orals: 'Все 17α-алкилированные ААС',
  all_19nor: 'Все 19-нор-производные',
  all_aas: 'Все ААС',
  equipoise: 'Болденон (Эквипойз)',
  anadrol: 'Оксиметолон (Анадрол)',
  winstrol: 'Станозолол (Винстрол)',
  anavar: 'Оксандролон (Анавар)',
  deca: 'Нандролон (Дека)',
  clomid: 'Кломифен (Clomid)',
  nolvadex: 'Тамоксифен (Nolvadex)',
  rad140: 'RAD-140 (Testolone)',
  lgd4033: 'LGD-4033 (Ligandrol)',
  ostarine: 'Ostarine (MK-2866)',
  bpc157: 'BPC-157',
  tb500: 'TB-500',
  finasteride: 'Финастерид',
  dutasteride: 'Дутастерид',
  cabergoline: 'Каберголин',
  metformin: 'Метформин',
  telmisartan: 'Телмисартан',
  isotretinoin: 'Изотретиноин',
  ssri: 'SSRI (антидепрессанты)',
  diuretics: 'Диуретики',
  aspirin: 'Аспирин',
  omega3: 'Омега-3',
  calcium_supplements: 'Препараты кальция',
  estrogen_blockers: 'Блокаторы эстрогена',
  test_enan: 'Тестостерон энантат',
  test_cyp: 'Тестостерон ципионат',
  test_prop: 'Тестостерон пропионат',
  proviron: 'Местеролон (Провирон)',
  primobolan: 'Примоболан (Метенолон)',
  parabolan: 'Тренболон гексагидробензилкарбонат',
  npp: 'Нандролон фенилпропионат (NPP)',
  superdrol: 'Супердрол (Метилдростанолон)',
  halotestin: 'Флюоксиместерон (Галотестин)',
  ment: 'MENT (Тренболон ацетат)',
  insulin_rapid: 'Инсулин быстродействующий',
  lantus: 'Инсулин гларгин (Лантус)',
  mgf: 'MGF (Mechano Growth Factor)',
  peg_mgf: 'PEG-MGF',
  cjc1295: 'CJC-1295',
  ipamorelin: 'Ипаморелин',
  ghrp2: 'GHRP-2',
  ghrp6: 'GHRP-6',
  hexarelin: 'Гексарелин',
  semorelin: 'Семорелин',
  melanotan2: 'Меланотан II',
  pt141: 'PT-141 (Бремеланотид)',
  tesamorelin: 'Тесаморелин',
};

export const DRUG_CATEGORIES: Record<string, string> = {
  testosterone: 'AAS',
  trenbolone: 'AAS',
  nandrolone: 'AAS',
  methandienone: 'AAS',
  oxymetholone: 'AAS',
  stanozolol: 'AAS',
  oxandrolone: 'AAS',
  masteron: 'AAS',
  boldenone: 'AAS',
  turinabol: 'AAS',
  gh: 'GH',
  insulin: 'Инсулин',
  igf1: 'Пептид',
  clenbuterol: 'Стим.',
  t3: 'Тиреоид',
  t4: 'Тиреоид',
  ai: 'Вспом.',
  serm: 'Вспом.',
  hcg: 'Вспом.',
  all_orals: 'Группа',
  all_19nor: 'Группа',
  all_aas: 'Группа',
  equipoise: 'AAS',
  anadrol: 'AAS',
  winstrol: 'AAS',
  anavar: 'AAS',
  deca: 'AAS',
  clomid: 'SERM',
  nolvadex: 'SERM',
  rad140: 'SARM',
  lgd4033: 'SARM',
  ostarine: 'SARM',
  bpc157: 'Пептид',
  tb500: 'Пептид',
  finasteride: 'Вспом.',
  dutasteride: 'Вспом.',
  cabergoline: 'Вспом.',
  metformin: 'Вспом.',
  telmisartan: 'Вспом.',
  isotretinoin: 'Вспом.',
  ssri: 'Вспом.',
  diuretics: 'Вспом.',
  aspirin: 'Вспом.',
  omega3: 'Вспом.',
  calcium_supplements: 'Вспом.',
  estrogen_blockers: 'Вспом.',
  test_enan: 'AAS',
  test_cyp: 'AAS',
  test_prop: 'AAS',
  proviron: 'AAS',
  primobolan: 'AAS',
  parabolan: 'AAS',
  npp: 'AAS',
  superdrol: 'AAS',
  halotestin: 'AAS',
  ment: 'AAS',
  insulin_rapid: 'Инсулин',
  lantus: 'Инсулин',
  mgf: 'Пептид',
  peg_mgf: 'Пептид',
  cjc1295: 'Пептид',
  ipamorelin: 'Пептид',
  ghrp2: 'Пептид',
  ghrp6: 'Пептид',
  hexarelin: 'Пептид',
  semorelin: 'Пептид',
  melanotan2: 'Пептид',
  pt141: 'Пептид',
  tesamorelin: 'Пептид',
};

export const DRUG_CAT_COLORS: Record<string, string> = {
  'AAS': '#e91e63',
  'GH': '#00bcd4',
  'Инсулин': '#ff5722',
  'Пептид': '#9c27b0',
  'Стим.': '#ff9800',
  'Тиреоид': '#4caf50',
  'Вспом.': '#607d8b',
  'Группа': '#795548',
  'SARM': '#3f51b5',
  'SERM': '#009688',
};

/** ПОЛНАЯ БАЗА СИМПТОМОВ */
export const SYMPTOM_DB: SymptomEntry[] = [
  // ═══ СЕРДЕЧНО-СОСУДИСТАЯ ═══
  {
    id: 'hypertension', symptom: 'Повышенное АД (гипертензия)', category: 'cardiovascular',
    generalInfo: 'Наиболее частый кардиоваскулярный побочный эффект ААС. Обусловлен задержкой Na⁺/H₂O (минералокортикоидный эффект), активацией РААС, ↑ эритроцитарной массы. Распространённость: 40-60% на курсе.',
    problems: [
      {
        problem: 'Задержка Na⁺ и воды (минералокортикоидный эффект ААС)', probability: 'high',
        mechanism: 'Активация РААС → альдостерон ↑ → ↑ реабсорбция Na⁺ в дистальных канальцах → ↑ ОЦК → ↑ АД. Наиболее выражено у тестостерона, оксиметолона, нандролона.',
        labMarkers: [
          { marker: 'АД (сист./диаст.)', expectedChange: '↑', targetRange: '<130/85 мм рт.ст.', when: 'Ежедневно утром и вечером' },
          { marker: 'Ренин плазмы', expectedChange: '↑', targetRange: '2.8-39.9 мкМЕ/мл', when: 'До курса, каждые 8 нед' },
          { marker: 'Альдостерон', expectedChange: '↑', targetRange: '40-310 пг/мл', when: 'При стойкой гипертензии' },
          { marker: 'Na⁺, K⁺ сыворотки', expectedChange: '↑', targetRange: 'Na⁺ 135-145, K⁺ 3.5-5.1', when: 'Каждые 4 нед' },
        ],
        solutions: [
          { substanceId: 'telmisartan', name: 'Телмисартан', type: 'pharma', dose: '40-80 мг/сут', mechanism: 'ARB + PPARγ-агонизм', evidenceLevel: 'A' },
          { substanceId: 'nebivolol', name: 'Небиволол', type: 'pharma', dose: '2.5-5 мг/сут', mechanism: 'β1-блокада + NO-вазодилатация', evidenceLevel: 'A' },
          { substanceId: 'magnesium', name: 'Магния цитрат/глицинат', type: 'supplement', dose: '400-600 мг/сут', mechanism: 'Природный Ca²⁺-блокатор, кофактор eNOS', evidenceLevel: 'A' },
          { substanceId: 'omega3', name: 'Омега-3 (EPA/DHA)', type: 'supplement', dose: '2-4 г/сут', mechanism: '↓ тромбоксан A2, улучшение FMD', evidenceLevel: 'A' },
          { substanceId: 'potassium', name: 'Калия цитрат', type: 'supplement', dose: '1000-2000 мг/сут', mechanism: '↑ экскреция Na⁺, вазодилатация', evidenceLevel: 'B' },
          { substanceId: 'cardio_lifestyle', name: 'LISS-кардио + ↓ Na', type: 'lifestyle', dose: '30-45 мин 4-5×/нед + <3 г Na/сут', mechanism: '↓ ОЦК, улучшение барорефлекса', evidenceLevel: 'A' },
        ],
        expectations: [
          { timeline: '24-48 ч', effect: 'Телмисартан: начало снижения АД (пик через 4 нед)', sideNote: 'Контроль K⁺ — риск гиперкалиемии' },
          { timeline: '1-2 нед', effect: 'LISS-кардио: снижение resting АД на 5-10 мм рт.ст.' },
          { timeline: '4-8 нед', effect: 'Омега-3: улучшение FMD на 2-4%' },
        ],
      },
      {
        problem: 'Эритроцитоз и ↑ вязкость крови', probability: 'high',
        mechanism: 'ААС стимулируют эритропоэз через ↑ EPO-рецепторов → Hct >50% → ↑ периферическое сопротивление + риск тромбоза.',
        labMarkers: [
          { marker: 'Гематокрит (Hct)', expectedChange: '↑', targetRange: '40-50%', when: 'До курса, каждые 4-8 нед' },
          { marker: 'Гемоглобин (Hb)', expectedChange: '↑', targetRange: '130-170 г/л ♂', when: 'До курса, каждые 4-8 нед' },
          { marker: 'Ферритин', expectedChange: '↓', targetRange: '30-300 мкг/л', when: 'При Hct >52%' },
          { marker: 'D-димер', expectedChange: '↔', targetRange: '<500 нг/мл', when: 'При Hct >54%' },
        ],
        solutions: [
          { substanceId: 'aspirin', name: 'Аспирин', type: 'pharma', dose: '75-100 мг/сут', mechanism: '↓ агрегация тромбоцитов', evidenceLevel: 'A' },
          { substanceId: 'nattokinase', name: 'Наттокиназа', type: 'supplement', dose: '2000-4000 FU/сут', mechanism: 'Прямой фибринолиз', evidenceLevel: 'B' },
          { substanceId: 'therapeutic_phlebotomy', name: 'Флеботомия (при Hct>54%)', type: 'lifestyle', dose: '1×/8-12 нед', mechanism: 'Механическое ↓ эритроцитарной массы', evidenceLevel: 'A' },
          { substanceId: 'hydration', name: 'Гидратация 3-4 л/сут', type: 'lifestyle', dose: '3-4 л/сут', mechanism: 'Гемодилюция', evidenceLevel: 'B' },
        ],
        expectations: [
          { timeline: 'Немедленно', effect: 'Гидратация: ↓ вязкость на 5-8%', sideNote: 'Не пить >1 л за раз' },
          { timeline: '24-48 ч', effect: 'Флеботомия: Hct ↓ на 3-5%', sideNote: 'Риск гиповолемии' },
          { timeline: '2-4 нед', effect: 'Наттокиназа: D-димер ↓, вязкость ↓' },
        ],
      },
    ],
  },
  {
    id: 'tachycardia', symptom: 'Тахикардия / учащённое сердцебиение в покое', category: 'cardiovascular',
    generalInfo: 'Повышение ЧСС покоя >90 уд/мин на курсе. Может быть обусловлено симпатической активацией (кленбутерол, T3), электролитным дисбалансом (↓K⁺, ↓Mg²⁺), компенсаторным ответом на ↑ ОЦК.',
    problems: [
      {
        problem: 'Симпатическая гиперактивация (β2-агонисты / T3 / стимуляторы)', probability: 'high',
        mechanism: 'Кленбутерол — β2-агонист → ↑ cAMP → ↑ ЧСС. T3/T4 ↑ плотность β-рецепторов. Кофеин/эфедрин → ↑ катехоламинов.',
        labMarkers: [
          { marker: 'ЧСС покоя', expectedChange: '↑', targetRange: '60-80 уд/мин', when: 'Ежедневно утром' },
          { marker: 'TT3, TT4', expectedChange: '↔', targetRange: 'TT3 2.6-5.7 пмоль/л', when: 'При приёме тиреоидов' },
          { marker: 'K⁺, Mg²⁺', expectedChange: '↓', targetRange: 'K⁺ 3.5-5.1, Mg²⁺ 0.7-1.0', when: 'Каждые 4 нед' },
          { marker: 'ЭКГ (QTc)', expectedChange: '↔', targetRange: 'QTc <440 мс ♂', when: 'При ЧСС >100' },
        ],
        solutions: [
          { substanceId: 'nebivolol', name: 'Небиволол', type: 'pharma', dose: '2.5-5 мг/сут', mechanism: 'β1-селективная блокада', evidenceLevel: 'A' },
          { substanceId: 'magnesium', name: 'Магния таурат/глицинат', type: 'supplement', dose: '400-600 мг/сут', mechanism: 'Ca²⁺-антагонист в кардиомиоцитах', evidenceLevel: 'B' },
          { substanceId: 'taurine', name: 'Таурин', type: 'supplement', dose: '2-3 г/сут', mechanism: 'Модуляция Ca²⁺-гомеостаза', evidenceLevel: 'B' },
        ],
        expectations: [
          { timeline: '1-2 ч', effect: 'Небиволол: начало ↓ ЧСС, пик через 2-4 ч' },
          { timeline: '3-7 дней', effect: 'Магний + таурин: ↓ ЧСС покоя на 8-12 уд/мин' },
        ],
      },
    ],
  },
  {
    id: 'edema', symptom: 'Отёки (лицо, лодыжки, голени)', category: 'cardiovascular',
    generalInfo: 'Отёки на курсе ААС — признак задержки Na⁺/H₂O. Наиболее выражены у тестостерона, оксиметолона, нандролона. Дифференцировать с СН и патологией почек.',
    problems: [
      {
        problem: 'Минералокортикоидный эффект ААС', probability: 'high',
        mechanism: 'Активация РААС → альдостерон ↑ → ↑ реабсорбция Na⁺ и воды. Эстрогенный компонент также способствует задержке жидкости.',
        labMarkers: [
          { marker: 'Альдостерон', expectedChange: '↑', targetRange: '40-310 пг/мл', when: 'При выраженных отёках' },
          { marker: 'Na⁺ сыворотки', expectedChange: '↑', targetRange: '135-145 ммоль/л', when: 'Каждые 4 нед' },
          { marker: 'Креатинин', expectedChange: '↔', targetRange: '62-106 мкмоль/л', when: 'Каждые 4 нед' },
          { marker: 'E2 (эстрадиол)', expectedChange: '↑', targetRange: '20-50 пг/мл ♂', when: 'Каждые 4 нед' },
        ],
        solutions: [
          { substanceId: 'telmisartan', name: 'Телмисартан', type: 'pharma', dose: '40-80 мг/сут', mechanism: '↓ альдостерон через AT1-блокаду', evidenceLevel: 'A' },
          { substanceId: 'anastro', name: 'Анастрозол (при ↑ E2)', type: 'pharma', dose: '0.25-0.5 мг 2×/нед', mechanism: '↓ эстроген-опосредованная задержка H₂O', evidenceLevel: 'A' },
          { substanceId: 'potassium', name: 'Калия цитрат', type: 'supplement', dose: '1000-2000 мг/сут', mechanism: 'Na⁺/K⁺-обмен → натрийурез', evidenceLevel: 'B' },
          { substanceId: 'low_sodium', name: 'Ограничение Na⁺ <3 г/сут', type: 'lifestyle', dose: '<3 г/сут Na⁺', mechanism: '↓ осмоляльность плазмы → ↓ ОЦК', evidenceLevel: 'A' },
        ],
        expectations: [
          { timeline: '1-2 ч', effect: 'Анастрозол: начало ↓ E2 (пик 48-72 ч)', sideNote: 'Не крашить E2 в ноль' },
          { timeline: '3-7 дней', effect: 'Телмисартан + ↓ Na⁺: видимое уменьшение отёков', sideNote: 'Контроль АД и K⁺' },
        ],
      },
    ],
  },
  {
    id: 'nosebleeds', symptom: 'Носовые кровотечения', category: 'cardiovascular',
    generalInfo: 'Спонтанные носовые кровотечения на курсе — следствие ↑ АД + ↑ хрупкости капилляров. Высокое АД → разрыв сосудов в зоне Киссельбаха. ↑ Hct → ↑ вязкость → ↑ давление в микроциркуляции.',
    problems: [
      {
        problem: 'Гипертензия-индуцированное носовое кровотечение', probability: 'medium',
        mechanism: 'ААС-гипертензия + ↑ Hct → ↑ давление в капиллярах → разрыв поверхностных сосудов носовой перегородки.',
        labMarkers: [
          { marker: 'АД', expectedChange: '↑', targetRange: '<130/85 мм рт.ст.', when: 'Измерить немедленно' },
          { marker: 'Гематокрит (Hct)', expectedChange: '↑', targetRange: '40-50%', when: 'При рецидивах' },
          { marker: 'Коагулограмма (ПВ, АЧТВ)', expectedChange: '↔', targetRange: 'ПВ 11-13.5 с', when: 'При частых кровотечениях' },
        ],
        solutions: [
          { substanceId: 'bp_control', name: 'Контроль АД (см. Гипертензия)', type: 'pharma', dose: 'Телмисартан 40-80 мг', mechanism: '↓ АД → ↓ гидростатическое давление', evidenceLevel: 'A' },
          { substanceId: 'vitamin_c', name: 'Витамин C + биофлавоноиды', type: 'supplement', dose: '1000-2000 мг/сут', mechanism: 'Укрепление капиллярной стенки', evidenceLevel: 'B' },
          { substanceId: 'rutin', name: 'Рутин / Троксерутин', type: 'supplement', dose: '500-1000 мг/сут', mechanism: '↓ проницаемость капилляров', evidenceLevel: 'B' },
        ],
        expectations: [
          { timeline: '1-3 дня', effect: 'Контроль АД + вит. C: ↓ частота кровотечений' },
          { timeline: 'Немедленно', effect: 'Hct >54% + носовые кровотечения → флеботомия + контроль АД', sideNote: 'Кровотечения + головная боль + ↑ АД = риск инсульта' },
        ],
      },
    ],
  },

  // ═══ ПЕЧЕНЬ ═══
  {
    id: 'liver_pain', symptom: 'Боль / тяжесть в правом подреберье', category: 'hepatic',
    generalInfo: 'Серьёзный симптом на курсе ААС. Частая причина — холестаз от 17α-алкилированных ААС (оксиметолон, метандиенон, станозолол). Реже — гепатит, стеатоз. Требует немедленного обследования.',
    problems: [
      {
        problem: 'Холестаз (17α-алкилированные ААС)', probability: 'high',
        mechanism: '17α-алкилирование ингибирует BSEP (bile salt export pump) → нарушение оттока желчи → внутрипечёночный холестаз → цитолиз + боль.',
        labMarkers: [
          { marker: 'АЛТ', expectedChange: '↑', targetRange: '<40 Ед/л ♂', when: 'До курса, каждые 2-4 нед на ор. ААС' },
          { marker: 'АСТ', expectedChange: '↑', targetRange: '<40 Ед/л ♂', when: 'До курса, каждые 2-4 нед' },
          { marker: 'ГГТ', expectedChange: '↑↑↑', targetRange: '<55 Ед/л ♂', when: 'Каждые 4 нед' },
          { marker: 'ЩФ', expectedChange: '↑↑', targetRange: '<150 Ед/л', when: 'Каждые 4 нед' },
          { marker: 'Билирубин общий', expectedChange: '↑', targetRange: '<21 мкмоль/л', when: 'Каждые 4 нед' },
          { marker: 'УЗИ печени + желчного', expectedChange: '↔', targetRange: 'Норма', when: 'До курса, при болях' },
        ],
        solutions: [
          { substanceId: 'tudca', name: 'TUDCA', type: 'supplement', dose: '500-1000 мг/сут', mechanism: '↑ BSEP → улучшение желчеоттока + ↓ ER-стресс', evidenceLevel: 'A' },
          { substanceId: 'nac', name: 'NAC', type: 'supplement', dose: '1200-2400 мг/сут', mechanism: 'Предшественник глутатиона → детоксикация', evidenceLevel: 'A' },
          { substanceId: 'milk_thistle', name: 'Расторопша (силимарин 80%)', type: 'supplement', dose: '280-560 мг/сут', mechanism: 'Стабилизация мембран гепатоцитов + регенерация', evidenceLevel: 'A' },
          { substanceId: 'alpha_lipoic', name: 'R-ALA', type: 'supplement', dose: '300-600 мг/сут', mechanism: 'Активатор Nrf2/ARE', evidenceLevel: 'B' },
        ],
        expectations: [
          { timeline: '3-7 дней', effect: 'TUDCA 500 мг: ↓ ГГТ на 15-25%', sideNote: 'Может послабить стул первые 2 нед' },
          { timeline: '1-2 нед', effect: 'NAC 1200 мг: нормализация АЛТ/АСТ', sideNote: 'Интервал с антибиотиками ≥2 ч' },
          { timeline: '2-4 нед', effect: 'Силимарин: ↓ АЛТ на 30-40%', sideNote: 'Влияет на CYP3A4' },
          { timeline: 'Немедленно', effect: 'АЛТ >3× ВГН — ОТМЕНИТЬ 17α-алкилированные ААС. Боль + желтуха → urgent care' },
        ],
      },
    ],
  },
  {
    id: 'jaundice', symptom: 'Желтушность склер / кожи / тёмная моча', category: 'hepatic',
    urgency: 'critical',
    generalInfo: 'ЭКСТРЕННЫЙ симптом. Указывает на тяжёлый холестаз или гепатоцеллюлярное повреждение. Тёмная моча = ↑ прямой билирубин (холестаз). Обесцвеченный стул = обструкция. Немедленная отмена гепатотоксичных препаратов + врач.',
    problems: [
      {
        problem: 'Выраженный холестаз / лекарственный гепатит', probability: 'medium',
        mechanism: 'Массивное повреждение гепатоцитов или блокада желчеоттока → ↑ билирубин. ГГТ >5× ВГН. АЛТ >5-10× ВГН с ↑ билирубина — тяжёлое повреждение.',
        labMarkers: [
          { marker: 'Билирубин общий + прямой', expectedChange: '↑↑', targetRange: 'Общий <21, прямой <5 мкмоль/л', when: 'НЕМЕДЛЕННО' },
          { marker: 'АЛТ, АСТ, ГГТ, ЩФ', expectedChange: '↑↑↑', targetRange: 'АЛТ <40, ГГТ <55', when: 'НЕМЕДЛЕННО' },
          { marker: 'УЗИ печени', expectedChange: '↔', targetRange: 'Без обструкции', when: 'НЕМЕДЛЕННО' },
        ],
        solutions: [
          { substanceId: 'tudca', name: 'TUDCA (под контролем врача)', type: 'supplement', dose: '1000-1500 мг/сут', mechanism: 'Замещение токсичных желчных кислот', evidenceLevel: 'A' },
          { substanceId: 'stop_aas', name: 'НЕМЕДЛЕННАЯ ОТМЕНА всех ААС', type: 'lifestyle', dose: '—', mechanism: 'Устранение источника гепатотоксичности', evidenceLevel: 'A' },
          { substanceId: 'hospital', name: 'Госпитализация', type: 'lifestyle', dose: '—', mechanism: 'Мониторинг, инфузия, исключение ОПечН', evidenceLevel: 'A' },
        ],
        expectations: [
          { timeline: '24-72 ч', effect: 'После отмены ААС + TUDCA: ↓ ГГТ, ↓ билирубин', sideNote: 'Билирубин может расти 1-2 дня после отмены' },
          { timeline: '1-2 нед', effect: 'Нормализация билирубина при холестатической картине' },
          { timeline: 'Немедленно', effect: 'Тёмная моча + обесцвеченный стул + боль = обструкция → скорую' },
        ],
      },
    ],
  },

  // ═══ ПОЧКИ ═══
  {
    id: 'foamy_urine', symptom: 'Пенистая моча (протеинурия)', category: 'renal',
    generalInfo: 'Классический признак протеинурии. На курсе ААС — следствие гиперфильтрации (↑ СКФ), повреждения подоцитов (тренболон), либо ФСГС. Требует количественной оценки.',
    problems: [
      {
        problem: 'Гиперфильтрация и протеинурия на курсе ААС', probability: 'medium',
        mechanism: 'ААС ↑ СКФ через ↑ сердечного выброса и ↑ мышечной массы. Хроническая гиперфильтрация → ↑ внутриклубочковое давление → повреждение подоцитов. Наиболее нефротоксичны: тренболон, оксиметолон.',
        labMarkers: [
          { marker: 'ОАМ (белок)', expectedChange: '↑', targetRange: '<0.033 г/л', when: 'До курса, каждые 4-8 нед' },
          { marker: 'Суточная протеинурия', expectedChange: '↑', targetRange: '<30 мг/сут (альбумин)', when: 'При + белке в ОАМ' },
          { marker: 'СКФ (CKD-EPI)', expectedChange: '↔', targetRange: '>90 мл/мин', when: 'До курса, каждые 8 нед' },
          { marker: 'Цистатин C', expectedChange: '↔', targetRange: '0.6-1.0 мг/л', when: 'При сомнительном креатинине' },
        ],
        solutions: [
          { substanceId: 'telmisartan', name: 'Телмисартан', type: 'pharma', dose: '40-80 мг/сут', mechanism: '↓ внутриклубочковое давление → нефропротекция', evidenceLevel: 'A' },
          { substanceId: 'astragalus', name: 'Астрагал', type: 'supplement', dose: '500-1000 мг/сут', mechanism: '↓ TGF-β1 → защита подоцитов', evidenceLevel: 'B' },
          { substanceId: 'cordyceps', name: 'Кордицепс', type: 'supplement', dose: '1000-2000 мг/сут', mechanism: '↓ креатинин, ↑ СКФ', evidenceLevel: 'B' },
          { substanceId: 'bp_control', name: 'Контроль АД <130/85', type: 'lifestyle', dose: 'АД <130/85', mechanism: '↓ гидравлическое давление в клубочках', evidenceLevel: 'A' },
        ],
        expectations: [
          { timeline: '2-4 нед', effect: 'Телмисартан: ↓ протеинурия на 30-50%' },
          { timeline: 'Немедленно', effect: 'Протеинурия >1 г/сут — консультация нефролога, отмена нефротоксичных ААС', sideNote: 'ФСГС — потенциально необратимо' },
        ],
      },
    ],
  },
  {
    id: 'kidney_pain', symptom: 'Боль в пояснице (область почек)', category: 'renal',
    generalInfo: 'Может быть почечного или мышечного происхождения. Почечная боль: глубокая, не связана с движением, иррадиирует в пах. Мышечная: поверхностная, усиливается при наклонах.',
    problems: [
      {
        problem: 'Почечная колика (нефролитиаз / камень)', probability: 'medium',
        mechanism: 'Гиперкальциемия + дегидратация + ↑ потребление белка → ↑ экскреция Ca²⁺ и мочевой кислоты → камни. Риск ↑ при высоких дозах D3, дегидратации.',
        labMarkers: [
          { marker: 'ОАМ + pH', expectedChange: '↔', targetRange: 'pH 5.5-7.0', when: 'Немедленно при боли' },
          { marker: 'УЗИ почек', expectedChange: '↔', targetRange: 'Без конкрементов', when: 'Немедленно' },
          { marker: 'Ca²⁺ сыворотки', expectedChange: '↔', targetRange: '2.15-2.55 ммоль/л', when: 'При подозрении' },
          { marker: 'Мочевая кислота', expectedChange: '↑', targetRange: '200-420 мкмоль/л', when: 'При подозрении' },
        ],
        solutions: [
          { substanceId: 'potassium_citrate', name: 'Калия цитрат', type: 'supplement', dose: '2000-3000 мг/сут', mechanism: '↑ pH мочи → растворение уратных камней', evidenceLevel: 'A' },
          { substanceId: 'magnesium', name: 'Магния цитрат', type: 'supplement', dose: '400-600 мг/сут', mechanism: 'Связывает оксалат в кишечнике', evidenceLevel: 'A' },
          { substanceId: 'hydration_forced', name: 'Форсированная гидратация', type: 'lifestyle', dose: '3-4 л/сут', mechanism: 'Разведение мочи', evidenceLevel: 'A' },
          { substanceId: 'vitamin_b6', name: 'Витамин B6', type: 'supplement', dose: '50-100 мг/сут', mechanism: '↓ эндогенный синтез оксалата', evidenceLevel: 'B' },
        ],
        expectations: [
          { timeline: '24-72 ч', effect: 'Острая колика: консультация уролога, НПВС, УЗИ', sideNote: 'Камень <5 мм — консервативно. >5 мм — литотрипсия' },
          { timeline: 'Постоянно', effect: 'Профилактика: гидратация + цитрат + Mg ↓ риск рецидива на 40-60%' },
        ],
      },
    ],
  },

  // ═══ ЦНС ═══
  {
    id: 'insomnia', symptom: 'Бессонница / нарушения сна', category: 'cns',
    generalInfo: 'Инсомния на курсе ААС — 30-50% пользователей. Связана с симпатической активностью (тренболон, кленбутерол), ночной гипогликемией, тревожностью, апноэ сна.',
    problems: [
      {
        problem: 'Симпатическая гиперактивация (ААС)', probability: 'high',
        mechanism: 'Тренболон, оксиметолон ↑ норадреналин/дофамин → ↑ arousal. Кленбутерол — β2-агонист. T3/T4 ↑ метаболизм.',
        labMarkers: [
          { marker: 'Кортизол (слюна, вечер)', expectedChange: '↑', targetRange: '<2.0 нмоль/л (23:00)', when: 'При хронической бессоннице' },
          { marker: 'TT3, TT4', expectedChange: '↔', targetRange: 'TT3 2.6-5.7', when: 'Исключить тиреотоксикоз' },
        ],
        solutions: [
          { substanceId: 'magnesium', name: 'Магния глицинат/треонат', type: 'supplement', dose: '400-600 мг за 1 ч до сна', mechanism: 'Агонист GABA-рецепторов, ↓ кортизол', evidenceLevel: 'A' },
          { substanceId: 'glycine', name: 'Глицин', type: 'supplement', dose: '3-5 г за 30 мин до сна', mechanism: 'Ингибиторный нейромедиатор → ↓ t° тела', evidenceLevel: 'B' },
          { substanceId: 'ashwagandha', name: 'Ашваганда (сенсорил)', type: 'supplement', dose: '300-600 мг/сут', mechanism: '↓ кортизол на 20-30%, GABA-миметик', evidenceLevel: 'A' },
          { substanceId: 'sleep_hygiene', name: 'Гигиена сна', type: 'lifestyle', dose: 'Без экранов за 2 ч, t° 18-20°C', mechanism: 'Естественный мелатонин ↑', evidenceLevel: 'A' },
        ],
        expectations: [
          { timeline: '1-2 ч', effect: 'Магний + глицин: ↓ латентность засыпания на 10-15 мин' },
          { timeline: '1-2 нед', effect: 'Ашваганда: ↓ кортизол, улучшение сна к 10-14 дню' },
        ],
      },
    ],
  },
  {
    id: 'anxiety', symptom: 'Тревожность / панические атаки / раздражительность', category: 'cns',
    generalInfo: 'Частый, но недооценённый эффект ААС. Механизмы: глутамат-эргическая гиперактивация (тренболон), ГАМК-супрессия (↓ нейростероиды), эстрогенный дисбаланс.',
    problems: [
      {
        problem: 'Глутамат/GABA-дисбаланс (ААС-индуцированный)', probability: 'high',
        mechanism: 'ААС ↓ аллопрегнанолон (GABA-A модулятор) → ↓ GABA-тонус → ↑ тревожность. Тренбололон активирует NMDA-рецепторы → ↑ глутамат → нейротоксичность + тревога.',
        labMarkers: [
          { marker: 'Кортизол (слюна, утро)', expectedChange: '↑', targetRange: '5-20 нмоль/л', when: 'При тревожности' },
          { marker: 'E2', expectedChange: '↔', targetRange: '20-50 пг/мл ♂', when: 'Каждые 4 нед' },
        ],
        solutions: [
          { substanceId: 'ashwagandha', name: 'Ашваганда (KSM-66)', type: 'supplement', dose: '600 мг/сут', mechanism: '↓ кортизол, GABA-миметик', evidenceLevel: 'A' },
          { substanceId: 'l_theanine', name: 'L-теанин', type: 'supplement', dose: '200-400 мг 2×/день', mechanism: '↑ GABA, ↑ α-волны, ↑ дофамин', evidenceLevel: 'A' },
          { substanceId: 'magnesium', name: 'Магния треонат', type: 'supplement', dose: '1000-2000 мг/сут', mechanism: '↓ пресинаптический глутамат', evidenceLevel: 'B' },
          { substanceId: 'breath_work', name: 'Дыхание 4-7-8', type: 'lifestyle', dose: '5 мин 2×/д', mechanism: '↑ парасимпатический тонус', evidenceLevel: 'B' },
        ],
        expectations: [
          { timeline: '30-60 мин', effect: 'L-теанин 200 мг: ↓ тревожность, ↑ α-волны' },
          { timeline: 'Немедленно', effect: 'Панические атаки → исключить сердечную патологию. Дыхание 4-7-8 купирует за 2-3 мин', sideNote: 'Панические атаки на тренболоне — повод для отмены' },
        ],
      },
    ],
  },
  {
    id: 'brain_fog', symptom: 'Мозговой туман / снижение когнитивных функций', category: 'cns',
    generalInfo: '"Brain fog" — снижение концентрации, ухудшение памяти, замедление мышления. На курсе: гормональные колебания, нейровоспаление, гипогликемия, электролитные нарушения.',
    problems: [
      {
        problem: 'Нейровоспаление + оксидативный стресс', probability: 'medium',
        mechanism: 'ААС (тренболон, нандролон) активируют микроглию → ↑ TNF-α, IL-1β в ЦНС. Окислительный стресс → повреждение нейронов.',
        labMarkers: [
          { marker: 'E2', expectedChange: '↔', targetRange: '20-50 пг/мл', when: 'Каждые 4 нед' },
          { marker: 'ТТГ', expectedChange: '↔', targetRange: '0.4-4.0 мМЕ/л', when: 'Исключить гипотиреоз' },
          { marker: 'Витамин B12', expectedChange: '↔', targetRange: '200-900 пг/мл', when: 'При когнитивных жалобах' },
          { marker: 'CRP-hs', expectedChange: '↑', targetRange: '<3 мг/л', when: 'Оценка воспаления' },
        ],
        solutions: [
          { substanceId: 'alpha_lipoic', name: 'R-ALA', type: 'supplement', dose: '300-600 мг/сут', mechanism: 'Проникает ГЭБ → антиоксидант', evidenceLevel: 'B' },
          { substanceId: 'nac', name: 'NAC', type: 'supplement', dose: '1200-2400 мг/сут', mechanism: 'Предшественник GSH в ЦНС', evidenceLevel: 'B' },
          { substanceId: 'omega3', name: 'Омега-3 (DHA 1+ г)', type: 'supplement', dose: '2-4 г/сут', mechanism: 'DHA — структурный липид мозга', evidenceLevel: 'A' },
          { substanceId: 'creatine', name: 'Креатин', type: 'supplement', dose: '5 г/сут', mechanism: '↑ фосфокреатин в ЦНС', evidenceLevel: 'A' },
          { substanceId: 'lions_mane', name: 'Ежовик гребенчатый', type: 'supplement', dose: '1000-3000 мг/сут', mechanism: 'Стимуляция NGF → нейрогенез', evidenceLevel: 'B' },
        ],
        expectations: [
          { timeline: '1-2 ч', effect: 'Креатин 5 г: ↑ рабочая память', sideNote: 'Эффект заметнее при депривации сна' },
          { timeline: '2-4 нед', effect: 'NAC + R-ALA: ↓ нейровоспаление, улучшение ясности' },
          { timeline: '4-8 нед', effect: 'Lions Mane: начало нейрогенеза' },
        ],
      },
    ],
  },

  // ═══ ЭНДОКРИННАЯ ═══
  {
    id: 'libido_loss', symptom: 'Потеря либидо / сексуальной функции', category: 'endocrine',
    generalInfo: 'Многофакторная проблема: ↑ E2, ↑ пролактин, ↓ DHT, подавление ГГТ-оси, дофаминовая супрессия, сосудистый компонент.',
    problems: [
      {
        problem: 'Гиперпролактинемия', probability: 'high',
        mechanism: 'Нандролон, тренболон ↑ пролактин через PR-агонизм. Пролактин ↓ дофамин → ↓ либидо + ↓ GnRH → ↓ ЛГ → ↓ тестостерон.',
        labMarkers: [
          { marker: 'Пролактин', expectedChange: '↑', targetRange: '86-324 мкМЕ/мл', when: 'При ↓ либидо' },
          { marker: 'E2', expectedChange: '↔', targetRange: '20-50 пг/мл ♂', when: 'Каждые 4 нед' },
          { marker: 'DHT', expectedChange: '↓', targetRange: '0.4-2.5 нмоль/л', when: 'При нормальном T и ↓ либидо' },
        ],
        solutions: [
          { substanceId: 'cabergoline', name: 'Каберголин (D2-агонист)', type: 'pharma', dose: '0.25-0.5 мг 2×/нед', mechanism: '↓ секреция пролактина', evidenceLevel: 'A' },
          { substanceId: 'p5p', name: 'P5P (пиридоксаль-5-фосфат)', type: 'supplement', dose: '50-100 мг/сут', mechanism: 'Кофактор DOPA-декарбоксилазы → ↑ дофамин', evidenceLevel: 'B' },
          { substanceId: 'vitamin_e', name: 'Витамин E', type: 'supplement', dose: '400-800 МЕ/сут', mechanism: 'Защита дофаминергических нейронов', evidenceLevel: 'B' },
          { substanceId: 'zinc', name: 'Цинк', type: 'supplement', dose: '30-50 мг/сут', mechanism: '↓ пролактин', evidenceLevel: 'C' },
        ],
        expectations: [
          { timeline: '2-4 ч', effect: 'Каберголин 0.25 мг: начало ↓ пролактина', sideNote: 'Избегать при клапанных пороках сердца' },
          { timeline: '2-4 нед', effect: 'P5P + вит.E: ↓ пролактина на 20-40%', sideNote: 'B6 >200 мг/сут — риск нейропатии' },
        ],
      },
      {
        problem: 'Эстрогенный дисбаланс (↑ или ↓ E2)', probability: 'high',
        mechanism: 'Ароматизация T → ↑ E2 → ↓ либидо. Избыточное подавление AI → ↓ E2 <15 пг/мл тоже убивает либидо.',
        labMarkers: [
          { marker: 'E2', expectedChange: '↔', targetRange: '20-50 пг/мл ♂', when: 'Каждые 4 нед' },
        ],
        solutions: [
          { substanceId: 'anastro', name: 'Анастрозол (при ↑ E2)', type: 'pharma', dose: '0.25 мг 2×/нед', mechanism: 'Ингибитор ароматазы', evidenceLevel: 'A' },
          { substanceId: 'zinc', name: 'Цинк', type: 'supplement', dose: '30-50 мг/сут', mechanism: 'Умеренный ингибитор ароматазы', evidenceLevel: 'C' },
        ],
        expectations: [
          { timeline: '24-48 ч', effect: 'Анастрозол: начало ↓ E2', sideNote: 'Корректировать дозу по анализам' },
          { timeline: '1-2 нед', effect: 'Нормализация либидо при E2 20-50 пг/мл' },
        ],
      },
    ],
  },
  {
    id: 'gynecomastia', symptom: 'Гинекомастия / зуд / припухлость сосков', category: 'endocrine',
    generalInfo: 'Результат гормонального дисбаланса: ↑ E2 (ароматизация) + ↑ прогестерон (19-нор) + ↑ пролактин. Ранние признаки: зуд сосков. Поздние: пальпируемая ткань. Обратима на ранних стадиях.',
    problems: [
      {
        problem: 'Эстроген-опосредованная гинекомастия', probability: 'high',
        mechanism: 'Ароматизация → ↑ E2 → стимуляция ER-α в молочной железе → пролиферация железистой ткани.',
        labMarkers: [
          { marker: 'E2', expectedChange: '↑', targetRange: '20-50 пг/мл ♂', when: 'Немедленно при симптомах' },
          { marker: 'Пролактин', expectedChange: '↔', targetRange: '86-324 мкМЕ/мл', when: 'Немедленно' },
          { marker: 'Прогестерон', expectedChange: '↔', targetRange: '<1.2 нмоль/л', when: 'Исключить прогестагенную гин.' },
        ],
        solutions: [
          { substanceId: 'tamox', name: 'Тамоксифен', type: 'pharma', dose: '20-40 мг/сут до ↓ симптомов', mechanism: 'Блокада ER в молочной железе', evidenceLevel: 'A' },
          { substanceId: 'anastro', name: 'Анастрозол', type: 'pharma', dose: '0.5-1 мг/нед', mechanism: '↓ ароматизация', evidenceLevel: 'A' },
          { substanceId: 'ralox', name: 'Ралоксифен', type: 'pharma', dose: '60 мг/сут', mechanism: 'Более селективная ER-блокада', evidenceLevel: 'A' },
        ],
        expectations: [
          { timeline: '24-48 ч', effect: 'Тамоксифен 20 мг: ↓ зуд и чувствительность', sideNote: 'Не злоупотреблять — ↓ IGF-1' },
          { timeline: '3-7 дней', effect: 'Анастрозол: ↓ E2 на 50-70%', sideNote: 'Не крашить E2' },
          { timeline: 'Немедленно', effect: 'Гин. на прогестагенных ААС — тамоксифен может УСУГУБИТЬ. Использовать каберголин + ралоксифен' },
        ],
      },
    ],
  },
  {
    id: 'testicular_atrophy', symptom: 'Уменьшение размера яичек / атрофия', category: 'endocrine',
    generalInfo: 'Неизбежный эффект экзогенных андрогенов: подавление ГГТ-оси → ↓ ЛГ → клетки Лейдига не стимулируются → атрофия. Частично обратима. Профилактика: hCG на курсе.',
    problems: [
      {
        problem: 'Подавление ГГТ-оси и атрофия клеток Лейдига', probability: 'high',
        mechanism: 'ААС → негативная обратная связь → ↓ GnRH → ↓ ЛГ → ↓ стимуляция клеток Лейдига → ↓ трофика → атрофия.',
        labMarkers: [
          { marker: 'ЛГ', expectedChange: '↓', targetRange: '1.7-8.6 МЕ/л', when: 'Каждые 4-8 нед' },
          { marker: 'ФСГ', expectedChange: '↓', targetRange: '1.5-12.4 МЕ/л', when: 'Каждые 4-8 нед' },
          { marker: 'Ингибин B', expectedChange: '↓', targetRange: '25-325 пг/мл', when: 'При оценке фертильности' },
        ],
        solutions: [
          { substanceId: 'hcg', name: 'hCG 500 МЕ 2×/нед', type: 'pharma', dose: '500 МЕ 2×/нед (п/к)', mechanism: 'Аналог ЛГ → поддержание клеток Лейдига', evidenceLevel: 'A' },
          { substanceId: 'hmg', name: 'hMG (при подготовке к зачатию)', type: 'pharma', dose: '75-150 МЕ 2-3×/нед', mechanism: 'ФСГ + ЛГ → поддержание сперматогенеза', evidenceLevel: 'A' },
          { substanceId: 'zinc', name: 'Цинк', type: 'supplement', dose: '30-50 мг/сут', mechanism: 'Необходим для синтеза T и сперматогенеза', evidenceLevel: 'B' },
        ],
        expectations: [
          { timeline: '1-2 нед', effect: 'hCG: остановка атрофии, восстановление объёма', sideNote: 'Начинать с 1-й недели курса' },
          { timeline: 'Постоянно', effect: 'Без hCG: атрофия необратима через 6-12 мес непрерывного подавления' },
        ],
      },
    ],
  },
  {
    id: 'night_sweats', symptom: 'Ночная потливость', category: 'endocrine',
    generalInfo: 'Следствие гормональных колебаний. Причины: пики/спады уровней гормонов между инъекциями (короткие эфиры), андрогенная терморегуляция, тиреоиды, ночная гипогликемия.',
    problems: [
      {
        problem: 'Гормональные флуктуации (пик-спад между инъекциями)', probability: 'medium',
        mechanism: 'Короткие эфиры создают резкие пики и спады → гипоталамус интерпретирует падение как "сигнал опасности" → ↑ симпатическая активность → потливость.',
        labMarkers: [
          { marker: 'T общий (trough)', expectedChange: '↔', targetRange: '12.1-34.7 нмоль/л', when: 'Перед инъекцией' },
          { marker: 'ТТГ', expectedChange: '↔', targetRange: '0.4-4.0', when: 'Исключить гипертиреоз' },
        ],
        solutions: [
          { substanceId: 'more_frequent_inj', name: 'Более частые инъекции', type: 'lifestyle', dose: 'Переход на ежедневные', mechanism: 'Стабилизация уровня гормонов', evidenceLevel: 'C' },
          { substanceId: 'long_ester', name: 'Замена на длинные эфиры', type: 'lifestyle', dose: '—', mechanism: 'Более стабильный PK-профиль', evidenceLevel: 'C' },
        ],
        expectations: [
          { timeline: '1-2 нед', effect: 'Стабилизация протокола: ↓ потливость на 70-80%' },
          { timeline: 'Немедленно', effect: 'Ночные поты + потеря веса + лихорадка → исключить лимфому' },
        ],
      },
    ],
  },

  // ═══ ЖКТ ═══
  {
    id: 'gerd', symptom: 'Изжога / ГЭРБ / кислотный рефлюкс', category: 'gastrointestinal',
    generalInfo: 'ГЭРБ на курсе: расслабление НПС (прогестероновый эффект), ↑ внутрибрюшное давление, НПВС-гастропатия, высокобелковая диета → ↑ кислотность.',
    problems: [
      {
        problem: 'НПВС-индуцированный рефлюкс / гастрит', probability: 'medium',
        mechanism: 'НПВС ингибируют COX-1 → ↓ PGE2 → ↓ защитная слизь → повреждение слизистой → рефлюкс. ААС ↓ тонус НПС. Комбинация → эзофагит.',
        labMarkers: [
          { marker: 'ФГДС', expectedChange: '↔', targetRange: 'Норма', when: 'При хронической изжоге >4 нед' },
          { marker: 'H. pylori (дых. тест)', expectedChange: '↔', targetRange: 'Отрицательно', when: 'При подозрении' },
        ],
        solutions: [
          { substanceId: 'ppi', name: 'Омепразол / Пантопразол', type: 'pharma', dose: '20-40 мг/сут за 30 мин до еды', mechanism: 'Ингибирование H⁺/K⁺-ATPазы', evidenceLevel: 'A' },
          { substanceId: 'dgl', name: 'DGL (деглицирр. солодка)', type: 'supplement', dose: '400-800 мг за 20 мин до еды', mechanism: '↑ защитная слизь, ↑ PGE2', evidenceLevel: 'B' },
          { substanceId: 'glutamine', name: 'L-глутамин', type: 'supplement', dose: '5-10 г/сут', mechanism: 'Топливо для энтероцитов', evidenceLevel: 'B' },
          { substanceId: 'meal_spacing', name: 'Интервалы между едой', type: 'lifestyle', dose: '3-4 ч, последний приём за 3 ч до сна', mechanism: '↓ желудочное содержимое в горизонтальном положении', evidenceLevel: 'B' },
        ],
        expectations: [
          { timeline: '1-3 дня', effect: 'ИПП 20 мг: ↓ изжога на 80-90%', sideNote: 'Не >8 нед без перерыва — риск SIBO, дефицита B12' },
          { timeline: '1-2 нед', effect: 'DGL + глутамин: восстановление слизистой' },
        ],
      },
    ],
  },
  {
    id: 'bloating', symptom: 'Вздутие живота / газообразование', category: 'gastrointestinal',
    generalInfo: 'Метеоризм при высокобелковой диете (200-300+ г белка). Причины: ферментативная недостаточность, FODMAP-ферментация, дисбиоз, задержка жидкости.',
    problems: [
      {
        problem: 'Ферментативная недостаточность при высокобелковой диете', probability: 'high',
        mechanism: '300+ г белка/день → нагрузка на протеазы. Неполное переваривание → бактериальная ферментация → H₂, CH₄, CO₂ → вздутие.',
        labMarkers: [
          { marker: 'Фекальная эластаза-1', expectedChange: '↓', targetRange: '>200 мкг/г', when: 'При хроническом вздутии' },
        ],
        solutions: [
          { substanceId: 'digestive_enzymes', name: 'Панкреатин / пищ. ферменты', type: 'supplement', dose: '10000-25000 ЕД/приём', mechanism: 'Протеазы, липазы, амилазы', evidenceLevel: 'A' },
          { substanceId: 'probiotics', name: 'Пробиотики (Lacto + Bifido)', type: 'supplement', dose: '10-50 млрд КОЕ/сут', mechanism: '↓ газообразующие бактерии', evidenceLevel: 'A' },
          { substanceId: 'betaine_hcl', name: 'Бетаин HCl + пепсин', type: 'supplement', dose: '500-1000 мг с приёмом', mechanism: '↑ кислотность → активация пепсина', evidenceLevel: 'B' },
          { substanceId: 'ginger', name: 'Имбирь', type: 'supplement', dose: '500-1000 мг 2×/день', mechanism: 'Прокинетик: ↑ моторика ЖКТ', evidenceLevel: 'A' },
        ],
        expectations: [
          { timeline: '1-3 дня', effect: 'Ферменты + бетаин: ↓ вздутие на 50-70%', sideNote: 'Бетаин не при язве/гастрите' },
          { timeline: '1-2 нед', effect: 'Пробиотики: нормализация стула, ↓ газообразование' },
        ],
      },
    ],
  },

  // ═══ ОПОРНО-ДВИГАТЕЛЬНАЯ ═══
  {
    id: 'joint_pain', symptom: 'Боль в суставах / артралгии', category: 'musculoskeletal',
    generalInfo: 'Парадокс: ААС улучшают синтез белка, но часто вызывают суставные боли. Причины: ↓ E2 (чрезмерный AI), ↓ кортизол, быстрый набор силы, дегидратация хрящей.',
    problems: [
      {
        problem: 'Гипоэстрогения (crushed estrogen)', probability: 'high',
        mechanism: 'Избыточный приём AI → E2 <15 пг/мл. E2 критичен для синтеза коллагена II, синовиальной жидкости, эластичности связок.',
        labMarkers: [
          { marker: 'E2 (чувствительный)', expectedChange: '↓↓', targetRange: '20-50 пг/мл ♂', when: 'Немедленно при болях' },
        ],
        solutions: [
          { substanceId: 'reduce_ai', name: 'СНИЗИТЬ дозу AI', type: 'pharma', dose: '↓ на 50% или отменить', mechanism: 'Восстановление E2 до 20-50 пг/мл', evidenceLevel: 'A' },
          { substanceId: 'collagen_type2', name: 'Коллаген II (UC-II)', type: 'supplement', dose: '40 мг/сут', mechanism: 'Oral tolerance → защита хряща', evidenceLevel: 'A' },
          { substanceId: 'glucosamine_chondroitin', name: 'Глюкозамин + Хондроитин', type: 'supplement', dose: '1500 + 1200 мг/сут', mechanism: 'Субстраты для протеогликанов', evidenceLevel: 'A' },
          { substanceId: 'curcumin', name: 'Куркумин + пиперин', type: 'supplement', dose: '500-1000 мг + 5 мг', mechanism: '↓ NF-κB → ↓ TNF-α, IL-1β', evidenceLevel: 'A' },
          { substanceId: 'omega3', name: 'Омега-3', type: 'supplement', dose: '3-4 г/сут', mechanism: '↓ провоспалительные эйкозаноиды', evidenceLevel: 'A' },
        ],
        expectations: [
          { timeline: '3-7 дней', effect: 'Снижение AI + восстановление E2: ↓ боли', sideNote: 'E2 восстанавливается быстрее после летрозола чем анастрозола' },
          { timeline: '2-4 нед', effect: 'UC-II коллаген: ↓ утренняя скованность, ↓ боль по WOMAC на 33%' },
          { timeline: '4-8 нед', effect: 'Глюкозамин/хондроитин: регенерация хряща' },
        ],
      },
    ],
  },
  {
    id: 'muscle_cramps', symptom: 'Мышечные судороги / крампи', category: 'musculoskeletal',
    generalInfo: 'Классический признак электролитного дисбаланса (↓ Mg²⁺, ↓ K⁺) и дегидратации. Часто ночью (икроножные) или на тренировке. Усугубляются диуретиками, кленбутеролом, кофеином.',
    problems: [
      {
        problem: 'Гипомагниемия + гипокалиемия', probability: 'high',
        mechanism: 'Интенсивный тренинг + ААС → ↑ потери Mg²⁺ и K⁺ с потом. ↓ Mg²⁺ → sustained contraction → судорога.',
        labMarkers: [
          { marker: 'Mg²⁺ сыворотки', expectedChange: '↓', targetRange: '0.7-1.0 ммоль/л', when: 'При судорогах' },
          { marker: 'K⁺ сыворотки', expectedChange: '↓', targetRange: '3.5-5.1 ммоль/л', when: 'При судорогах' },
        ],
        solutions: [
          { substanceId: 'magnesium', name: 'Магния глицинат', type: 'supplement', dose: '400-600 мг/сут + 200 мг перед сном', mechanism: '↓ возбудимость NMJ', evidenceLevel: 'A' },
          { substanceId: 'potassium', name: 'Калия цитрат', type: 'supplement', dose: '1000-3000 мг/сут', mechanism: 'Реполяризация мембраны', evidenceLevel: 'A' },
          { substanceId: 'taurine', name: 'Таурин', type: 'supplement', dose: '2-3 г/сут', mechanism: 'Стабилизация мембран, Ca²⁺-гомеостаз', evidenceLevel: 'B' },
          { substanceId: 'hydration', name: 'Гидратация ≥3 л/сут', type: 'lifestyle', dose: '3-4 л/сут', mechanism: 'Поддержание электролитного баланса', evidenceLevel: 'B' },
        ],
        expectations: [
          { timeline: '1-2 ч', effect: 'Магний 200 мг: ↓ ночные судороги' },
          { timeline: '2-7 дней', effect: 'Комплексная коррекция: судороги исчезают' },
        ],
      },
    ],
  },
  {
    id: 'back_pumps', symptom: 'Болезненные "пампы" поясницы', category: 'musculoskeletal',
    generalInfo: 'Характерный симптом на пероральных ААС (дианобол, оксиметолон). Болезненное напряжение мышц нижней части спины при ходьбе/стоянии. Механизм: задержка жидкости + электролитный дисбаланс + ↑ внутрифасциальное давление.',
    problems: [
      {
        problem: 'ААС-индуцированные мышечные спазмы + задержка жидкости', probability: 'medium',
        mechanism: 'ААС ↑ синтез гликогена и задержку воды в мышцах. Дефицит Mg²⁺ и таурина → неконтролируемые сокращения → ишемия → боль.',
        labMarkers: [
          { marker: 'Mg²⁺, K⁺', expectedChange: '↓', targetRange: 'Mg 0.7-1.0, K 3.5-5.1', when: 'При back pumps' },
          { marker: 'КФК', expectedChange: '↔', targetRange: '<200 Ед/л', when: 'Исключить рабдомиолиз' },
        ],
        solutions: [
          { substanceId: 'taurine', name: 'Таурин', type: 'supplement', dose: '3-5 г/сут (2 г до тренировки)', mechanism: 'Стабилизация мембран, осмолит', evidenceLevel: 'B' },
          { substanceId: 'magnesium', name: 'Магния глицинат', type: 'supplement', dose: '400-600 мг/сут', mechanism: 'Мышечная релаксация', evidenceLevel: 'A' },
          { substanceId: 'potassium', name: 'Калия цитрат', type: 'supplement', dose: '1000-2000 мг/сут', mechanism: 'Восполнение K⁺', evidenceLevel: 'A' },
        ],
        expectations: [
          { timeline: '24-48 ч', effect: 'Таурин 3-5 г + Mg: значительное уменьшение болей', sideNote: 'Таурин — наиболее эффективное средство' },
        ],
      },
    ],
  },

  // ═══ КРОВЬ ═══
  {
    id: 'fatigue', symptom: 'Хроническая усталость / слабость', category: 'hematologic',
    generalInfo: 'Неспецифический, но важный симптом. Причины: дефицит Fe/B12/фолата (↑ эритропоэз), субклинический гипотиреоз, overtraining, гипогликемия, гепатотоксичность.',
    problems: [
      {
        problem: 'Дефицит Fe / B12 / фолата (анемия)', probability: 'medium',
        mechanism: 'ААС ↑ эритропоэз → ↑ потребление Fe, B12, фолата. При недостатке → анемия → слабость, ↓ производительность.',
        labMarkers: [
          { marker: 'ОАК (Hb, MCV)', expectedChange: '↔', targetRange: 'Hb 130-170, MCV 80-100', when: 'При усталости' },
          { marker: 'Ферритин', expectedChange: '↓', targetRange: '30-300 (оптимум >100)', when: 'При усталости' },
          { marker: 'B12', expectedChange: '↓', targetRange: '200-900 (оптимум >400)', when: 'При усталости' },
          { marker: 'Фолат', expectedChange: '↓', targetRange: '3-17 нг/мл', when: 'При усталости' },
          { marker: 'ТТГ', expectedChange: '↔', targetRange: '0.4-4.0', when: 'Исключить гипотиреоз' },
        ],
        solutions: [
          { substanceId: 'iron', name: 'Железа бисглицинат', type: 'supplement', dose: '25-50 мг/сут', mechanism: 'Восполнение дефицита Fe', evidenceLevel: 'A' },
          { substanceId: 'b12', name: 'Метилкобаламин', type: 'supplement', dose: '1000-5000 мкг/сут', mechanism: 'Кофактор синтеза ДНК', evidenceLevel: 'A' },
          { substanceId: 'folate', name: '5-МТГФ (активный фолат)', type: 'supplement', dose: '400-800 мкг/сут', mechanism: 'Метилирование + эритропоэз', evidenceLevel: 'A' },
          { substanceId: 'vitamin_c', name: 'Витамин C', type: 'supplement', dose: '500-1000 мг/сут', mechanism: '↑ абсорбция Fe', evidenceLevel: 'A' },
        ],
        expectations: [
          { timeline: '1-2 нед', effect: 'Fe + вит. C: начало ↑ ферритина', sideNote: 'Не принимать Fe с Ca²⁺/Zn²⁺' },
          { timeline: '4-8 нед', effect: '↑ Hb на 10-20 г/л', sideNote: 'Не принимать Fe профилактически без дефицита' },
        ],
      },
    ],
  },

  // ═══ КОЖА ═══
  {
    id: 'acne', symptom: 'Акне / угревая сыпь (спина, плечи, лицо)', category: 'dermatologic',
    generalInfo: '"Steroid acne" — наиболее частый дерматологический эффект (50-70%). ААС ↑ активность сальных желёз через AR → ↑ себум → закупорка пор → воспаление. Наиболее акнегенны: тренболон, тестостерон, оксиметолон.',
    problems: [
      {
        problem: 'Андроген-индуцированная гиперсеборея и акне', probability: 'high',
        mechanism: 'ААС → AR в себоцитах → ↑ липогенез → ↑ себум + кератинизация → комедоны. P. acnes ферментирует себум → воспаление.',
        labMarkers: [
          { marker: 'E2', expectedChange: '↔', targetRange: '20-50 пг/мл', when: 'При акне' },
          { marker: 'DHT', expectedChange: '↔', targetRange: '0.4-2.5 нмоль/л', when: 'При тяжёлом акне' },
        ],
        solutions: [
          { substanceId: 'isotretinoin', name: 'Изотретиноин (низкодозный)', type: 'pharma', dose: '10-20 мг/сут', mechanism: '↓ размер сальных желёз на 90%', evidenceLevel: 'A' },
          { substanceId: 'zinc', name: 'Цинк пиколинат', type: 'supplement', dose: '50-100 мг/сут', mechanism: '↓ 5α-редуктазу, ↓ воспаление', evidenceLevel: 'A' },
          { substanceId: 'pantothenic_acid', name: 'Витамин B5', type: 'supplement', dose: '2-5 г/сут', mechanism: '↓ синтез жирных кислот → ↓ себум', evidenceLevel: 'B' },
          { substanceId: 'topical_retinoid', name: 'Адапален / Третиноин местно', type: 'pharma', dose: '1×/день на ночь', mechanism: '↓ кератинизация фолликулов', evidenceLevel: 'A' },
          { substanceId: 'skin_hygiene', name: 'Гигиена кожи', type: 'lifestyle', dose: 'Душ 2×/день, салициловый гель', mechanism: 'Удаление себума, антибактериально', evidenceLevel: 'B' },
        ],
        expectations: [
          { timeline: '2-4 нед', effect: 'Цинк + B5: ↓ высыпания на 30-50%', sideNote: 'Цинк >50 мг → добавить Cu 1-2 мг' },
          { timeline: '4-8 нед', effect: 'Изотретиноин: ↓ себум, сухость кожи (нормально)', sideNote: 'Изотретиноин + ААС = двойная нагрузка на печень!' },
        ],
      },
    ],
  },
  {
    id: 'hair_loss', symptom: 'Выпадение волос / андрогенная алопеция', category: 'dermatologic',
    generalInfo: 'АГА на курсе: DHT связывается с AR в волосяных фолликулах → миниатюризация → выпадение. Генетическая предрасположенность. Наиболее алопецигенны: мастерон, тренболон, провирон, высокие дозы тестостерона.',
    problems: [
      {
        problem: 'DHT-опосредованная АГА', probability: 'medium',
        mechanism: '5α-редуктаза конвертирует T в DHT в фолликулах. DHT в 5× аффиннее к AR → ↓ анагеновая фаза → миниатюризация фолликула.',
        labMarkers: [
          { marker: 'DHT', expectedChange: '↑', targetRange: '0.4-2.5 нмоль/л', when: 'При выпадении' },
          { marker: 'Ферритин', expectedChange: '↔', targetRange: '>70 мкг/л', when: 'Исключить телогеновую алопецию' },
          { marker: 'ТТГ', expectedChange: '↔', targetRange: '0.4-4.0', when: 'Исключить гипотиреоз' },
        ],
        solutions: [
          { substanceId: 'finasteride', name: 'Финастерид', type: 'pharma', dose: '1 мг/сут', mechanism: 'Ингибитор 5α-R II типа → ↓ DHT на 60-70%', evidenceLevel: 'A' },
          { substanceId: 'dutasteride', name: 'Дутастерид', type: 'pharma', dose: '0.5 мг/сут', mechanism: 'Ингибитор 5α-R I+II → ↓ DHT на 90-95%', evidenceLevel: 'A' },
          { substanceId: 'minoxidil', name: 'Миноксидил 5%', type: 'pharma', dose: '1 мл 2×/день', mechanism: '↑ кровоток в фолликулах', evidenceLevel: 'A' },
          { substanceId: 'ketoconazole', name: 'Кетоконазол 2% шампунь', type: 'pharma', dose: '2-3×/нед', mechanism: 'Местный антиандроген', evidenceLevel: 'B' },
          { substanceId: 'biotin', name: 'Биотин', type: 'supplement', dose: '5000-10000 мкг/сут', mechanism: 'Кофактор синтеза кератина', evidenceLevel: 'C' },
        ],
        expectations: [
          { timeline: 'Немедленно', effect: 'Финастерид: начало ↓ DHT через 24 ч', sideNote: '↓ либидо у 1-2%' },
          { timeline: '3-6 мес', effect: 'Миноксидил: ↑ плотность волос', sideNote: 'Начальный shed в первые 2-4 нед — нормально' },
          { timeline: 'Сразу', effect: 'Избегать мастерона, тренболона, высоких доз T при предрасположенности', sideNote: 'Нандролон → DHN — менее алопецигенен' },
        ],
      },
    ],
  },

  // ═══ ПСИХИКА ═══
  {
    id: 'aggression', symptom: 'Повышенная агрессивность / "ройд-рейдж"', category: 'psychological',
    generalInfo: 'ААС влияют на миндалевидное тело (↑ реактивность), орбитофронтальную кору (↓ контроль), серотонин (↓ 5-HT1A → ↑ агрессия). Наиболее агрессиогенные: тренболон, станозолол, оксиметолон.',
    problems: [
      {
        problem: 'ААС-индуцированная агрессия (серотонин + миндалина)', probability: 'medium',
        mechanism: 'ААС ↓ серотонин (5-HT) → растормаживание агрессии. ↑ активность миндалевидного тела (fMRI). ↑ дофамин → ↑ импульсивность.',
        labMarkers: [
          { marker: 'E2', expectedChange: '↔', targetRange: '20-50 пг/мл', when: 'При агрессии' },
        ],
        solutions: [
          { substanceId: 'l_theanine', name: 'L-теанин', type: 'supplement', dose: '200-400 мг 2-3×/день', mechanism: '↑ α-волны, ↑ GABA, ↑ серотонин', evidenceLevel: 'A' },
          { substanceId: 'ashwagandha', name: 'Ашваганда', type: 'supplement', dose: '600 мг/сут', mechanism: '↓ кортизол, улучшение контроля', evidenceLevel: 'A' },
          { substanceId: 'nac', name: 'NAC', type: 'supplement', dose: '1200-2400 мг/сут', mechanism: 'Модуляция глутамата → ↓ импульсивность', evidenceLevel: 'B' },
          { substanceId: 'cbt', name: 'КПТ', type: 'lifestyle', dose: 'Сессии 1×/нед', mechanism: 'Осознанное управление эмоциями', evidenceLevel: 'A' },
          { substanceId: 'reduce_dose', name: 'Снижение дозы / смена препарата', type: 'lifestyle', dose: '↓ на 30-50%', mechanism: 'Устранение первопричины', evidenceLevel: 'A' },
        ],
        expectations: [
          { timeline: '30-60 мин', effect: 'L-теанин 200 мг: ↓ реактивность, ↑ спокойствие' },
          { timeline: '1-2 нед', effect: 'Ашваганда: ↓ baseline-раздражительность' },
          { timeline: 'Немедленно', effect: 'При агрессии, угрожающей окружающим — отмена ААС, психиатр' },
        ],
      },
    ],
  },
  {
    id: 'depression', symptom: 'Депрессивное настроение / апатия / ангедония', category: 'psychological',
    generalInfo: 'На курсе: гормональные колебания → аффективная нестабильность. После курса (PCT): гипогонадизм → ↓ дофамин/серотонин/норадреналин → "post-cycle crash". Особенно высок риск после 19-нор-производных.',
    problems: [
      {
        problem: 'Постцикловая депрессия (гипогонадизм-индуцированная)', probability: 'high',
        mechanism: 'После отмены ААС: ГГТ-ось подавлена → ↓ ЛГ/ФСГ → ↓ тестостерон → ↓ нейростероиды (аллопрегнанолон) → ↓ GABA-A → депрессия + тревога.',
        labMarkers: [
          { marker: 'T общий', expectedChange: '↓↓', targetRange: '12.1-34.7 нмоль/л', when: 'Через 2-4 нед после последней инъекции' },
          { marker: 'ЛГ, ФСГ', expectedChange: '↓', targetRange: 'ЛГ 1.7-8.6, ФСГ 1.5-12.4', when: 'Через 2-4 нед' },
          { marker: 'E2', expectedChange: '↓', targetRange: '20-50 пг/мл', when: 'Одновременно с T' },
          { marker: 'Витамин D (25-OH)', expectedChange: '↓', targetRange: '50-80 нг/мл', when: 'При депрессии' },
        ],
        solutions: [
          { substanceId: 'pct_proper', name: 'ПРАВИЛЬНЫЙ ПКТ (SERM + hCG)', type: 'pharma', dose: 'Тамоксифен 20 мг + кломифен 50 мг 4-6 нед', mechanism: 'SERM ↑ ЛГ/ФСГ → ↑ тестостерон', evidenceLevel: 'A' },
          { substanceId: 'hcg', name: 'hCG', type: 'pharma', dose: '500-1000 МЕ 2-3×/нед', mechanism: 'Стимуляция клеток Лейдига', evidenceLevel: 'A' },
          { substanceId: 'vitamin_d', name: 'Витамин D3', type: 'supplement', dose: '5000-10000 МЕ/сут', mechanism: '↑ синтез серотонина', evidenceLevel: 'A' },
          { substanceId: 'omega3', name: 'Омега-3 (EPA ≥1 г)', type: 'supplement', dose: '2-4 г/сут', mechanism: 'Антидепрессантный эффект, сравнимый с СИОЗС', evidenceLevel: 'A' },
          { substanceId: 'exercise', name: 'Аэробные тренировки', type: 'lifestyle', dose: '30-45 мин 3-5×/нед', mechanism: '↑ BDNF, ↑ эндорфины, ↑ нейрогенез', evidenceLevel: 'A' },
        ],
        expectations: [
          { timeline: '2-4 нед', effect: 'ПКТ: начало ↑ T, улучшение настроения', sideNote: 'При тяжёлом гипогонадизме может потребоваться TRT' },
          { timeline: 'Немедленно', effect: 'Суицидальные мысли — СРОЧНАЯ консультация психиатра. Отмена ААС', sideNote: 'Постцикловая депрессия — медицинская проблема' },
        ],
      },
    ],
  },

  // ═══ ДОПОЛНИТЕЛЬНЫЕ СИМПТОМЫ (краткие) ═══
  {
    id: 'hypoglycemia', symptom: 'Гипогликемия / головокружение / холодный пот', category: 'endocrine',
    generalInfo: 'Характерна для пользователей инсулина, IGF-1. Симптомы: внезапная слабость, холодный пот, тремор, спутанность сознания. Тяжёлая → потеря сознания.',
    problems: [
      {
        problem: 'Инсулин-индуцированная гипогликемия', probability: 'medium',
        mechanism: 'Экзогенный инсулин ↑ GLUT4 → ↑ захват глюкозы → ↓ глюкоза крови.',
        labMarkers: [
          { marker: 'Глюкоза крови', expectedChange: '↓↓', targetRange: '4.0-5.9 ммоль/л (натощак)', when: 'При каждом подозрении' },
        ],
        solutions: [
          { substanceId: 'glucose_fast', name: 'Быстрые углеводы', type: 'lifestyle', dose: '15-20 г немедленно', mechanism: 'Прямое ↑ глюкозы', evidenceLevel: 'A' },
          { substanceId: 'chromium', name: 'Хром пиколинат', type: 'supplement', dose: '200-400 мкг/сут', mechanism: '↑ чувствительность → ↓ доза инсулина', evidenceLevel: 'B' },
          { substanceId: 'glucagon', name: 'Глюкагон (экстренный)', type: 'pharma', dose: '1 мг в/м при потере сознания', mechanism: 'Гликогенолиз', evidenceLevel: 'A' },
        ],
        expectations: [
          { timeline: '5-15 мин', effect: '15 г глюкозы: ↑ глюкоза на 1.5-2 ммоль/л' },
          { timeline: 'Немедленно', effect: 'Потеря сознания: глюкагон 1 мг в/м + скорая', sideNote: 'Инсулин без глюкометра = игра в русскую рулетку' },
        ],
      },
    ],
  },
  {
    id: 'injection_pain', symptom: 'Боль / уплотнение / воспаление в месте инъекции', category: 'musculoskeletal',
    urgency: 'warning', relatedSymptoms: ['edema', 'nosebleeds'],
    quickFacts: ['Частота: 15-30% при в/м инъекциях', 'Основная причина: неправильная техника или объём >3 мл', 'Риск абсцесса <1%'],
    generalInfo: 'Постинъекционные реакции — частая проблема при внутримышечном введении масляных растворов ААС. Могут проявляться как локальная боль (PIP — post-injection pain), уплотнение (стерильный абсцесс), покраснение, отёк. Дифференцировать инфекционный абсцесс от стерильного воспаления.',
    problems: [
      {
        problem: 'Стерильное воспаление / "PIP" (post-injection pain)', probability: 'high',
        mechanism: 'Масляный депо-эффект: масляный раствор создаёт депо в мышце → локальное растяжение фасции → воспалительная реакция. Высокая концентрация бензилового спирта или пропиленгликоля в препарате → раздражение тканей. Объём >3 мл в одну точку — фактор риска.',
        labMarkers: [
          { marker: 'Визуальный осмотр', expectedChange: '↔', targetRange: 'Без флюктуации, без гноя', when: 'При каждом симптоме' },
          { marker: 'Температура тела', expectedChange: '↔', targetRange: '<37.5°C', when: 'При покраснении (исключить инфекцию)' },
          { marker: 'СРБ (C-реактивный белок)', expectedChange: '↔', targetRange: '<5 мг/л', when: 'При подозрении на абсцесс' },
        ],
        solutions: [
          { substanceId: 'proper_technique', name: 'Правильная техника инъекции', type: 'lifestyle', dose: 'Менять места, объём ≤3 мл, игла 23-25G × 1-1.5"', mechanism: 'Минимизация травматизации тканей', evidenceLevel: 'A' },
          { substanceId: 'warm_compress', name: 'Тёплый компресс + массаж', type: 'lifestyle', dose: '15-20 мин 2-3×/день', mechanism: '↑ кровоток → ускорение абсорбции масляного депо', evidenceLevel: 'B' },
          { substanceId: 'ibuprofen', name: 'Ибупрофен (НПВС)', type: 'pharma', dose: '400-600 мг при боли', mechanism: '↓ COX-1/2 → ↓ простагландины → ↓ воспаление', evidenceLevel: 'A' },
          { substanceId: 'smaller_volume', name: 'Разделение инъекции на 2 точки', type: 'lifestyle', dose: '≤2.5 мл на точку', mechanism: '↓ локальное давление в мышце → меньше PIP', evidenceLevel: 'C' },
        ],
        expectations: [
          { timeline: '24-72 ч', effect: 'PIP проходит самостоятельно в большинстве случаев', sideNote: 'Если боль НАРАСТАЕТ через 3 дня — подозрение на инфекцию' },
          { timeline: '1-2 нед', effect: 'Уплотнение ("стерильный абсцесс"): медленно рассасывается', sideNote: 'Не пытаться выдавить или вскрыть стерильное уплотнение' },
          { timeline: 'Немедленно', effect: 'Покраснение + горячая кожа + лихорадка >38°C + флюктуация = ИНФЕКЦИОННЫЙ АБСЦЕСС → хирург', sideNote: 'Инфекционный абсцесс требует дренирования и антибиотиков' },
        ],
      },
    ],
  },
  {
    id: 'erectile_dysfunction', symptom: 'Эректильная дисфункция (ЭД) / невозможность достичь эрекции', category: 'endocrine',
    urgency: 'warning', relatedSymptoms: ['libido_loss', 'testicular_atrophy'],
    quickFacts: ['Распространённость на курсе: 20-35%', 'Основные причины: ↑ E2, ↑ пролактин, ↓ DHT', 'Обратима при коррекции гормонального фона'],
    generalInfo: 'ЭД на курсе ААС — многофакторная проблема. Отличается от простой потери либидо: либидо — желание, ЭД — механика. Причины: 1) эстрогенный дисбаланс (E2 ↓ или ↑), 2) гиперпролактинемия (↓ дофамин), 3) ↓ DHT, 4) сосудистый компонент (эндотелиальная дисфункция + ↑ Hct), 5) психогенный компонент.',
    problems: [
      {
        problem: 'Эндотелиальная дисфункция + гемореологические нарушения', probability: 'medium',
        mechanism: 'ААС ↓ eNOS → ↓ NO → ↓ вазодилатация кавернозных тел. ↑ Hct → ↑ вязкость → ↓ микроциркуляция. Эндотелиальная дисфункция — ранний и потенциально необратимый эффект длительного применения.',
        labMarkers: [
          { marker: 'E2 (эстрадиол)', expectedChange: '↔', targetRange: '20-50 пг/мл ♂', when: 'Немедленно' },
          { marker: 'Пролактин', expectedChange: '↑', targetRange: '86-324 мкМЕ/мл', when: 'Немедленно' },
          { marker: 'DHT', expectedChange: '↓', targetRange: '0.4-2.5 нмоль/л', when: 'При нормальном T' },
          { marker: 'Гематокрит', expectedChange: '↑', targetRange: '40-50%', when: 'Каждые 4-8 нед' },
          { marker: 'Гомоцистеин', expectedChange: '↔', targetRange: '<15 мкмоль/л', when: 'При ЭД (маркер эндотелиальной дисфункции)' },
        ],
        solutions: [
          { substanceId: 'tadalafil', name: 'Тадалафил (Cialis)', type: 'pharma', dose: '5 мг/сут (ежедневно) или 20 мг по требованию', mechanism: 'Ингибитор PDE5 → ↑ cGMP → вазодилатация кавернозных тел', evidenceLevel: 'A' },
          { substanceId: 'citrulline', name: 'L-цитруллин', type: 'supplement', dose: '3-6 г/сут', mechanism: 'Предшественник аргинина → ↑ NO → улучшение эндотелиальной функции', evidenceLevel: 'A' },
          { substanceId: 'pycnogenol', name: 'Пикногенол (кора сосны)', type: 'supplement', dose: '100-200 мг/сут', mechanism: '↑ eNOS, ↓ окислительный стресс в эндотелии', evidenceLevel: 'B' },
          { substanceId: 'omega3', name: 'Омега-3 (EPA/DHA)', type: 'supplement', dose: '3-4 г/сут', mechanism: 'Улучшение эндотелиальной функции', evidenceLevel: 'A' },
          { substanceId: 'cabergoline', name: 'Каберголин (при ↑ пролактина)', type: 'pharma', dose: '0.25-0.5 мг 2×/нед', mechanism: 'D2-агонист → ↓ пролактин → ↑ дофамин', evidenceLevel: 'A' },
        ],
        expectations: [
          { timeline: '30-60 мин', effect: 'Тадалафил 20 мг: улучшение эрекции (через NO-путь)', sideNote: 'Не действует без сексуальной стимуляции' },
          { timeline: '2-4 нед', effect: 'Цитруллин 6 г: ↑ NO, улучшение качества эрекции на 20-30%' },
          { timeline: 'Немедленно', effect: 'ЭД + боль в груди при нагрузке → исключить ИБС. PDE5-ингибиторы + нитраты = смертельная гипотензия!', sideNote: 'Органическая ЭД на курсе — повод для кардиологического обследования' },
        ],
      },
    ],
  },
  {
    id: 'prostate_issues', symptom: 'Частое / затруднённое мочеиспускание (симптомы простаты)', category: 'endocrine',
    urgency: 'warning', relatedSymptoms: ['libido_loss', 'testicular_atrophy'],
    quickFacts: ['ДГПЖ на ААС — результат ↑ DHT и E2', 'Учащённое ночное мочеиспускание (никтурия) — ранний признак', 'ПСА может быть ↓ на фоне ААС (ложноотрицательный)'],
    generalInfo: 'Симптомы нижних мочевых путей (СНМП) на курсе: учащённое мочеиспускание, слабая струя, никтурия, чувство неполного опорожнения. Причина — ДГПЖ (доброкачественная гиперплазия) под действием DHT + E2. Важно: ПСА может быть ложно низким на фоне ААС из-за подавления андрогеновой сигнализации в простате.',
    problems: [
      {
        problem: 'Андроген/эстроген-индуцированная гиперплазия простаты', probability: 'medium',
        mechanism: 'DHT (из тестостерона через 5α-редуктазу) — основной фактор роста простаты. E2 через ER-α также стимулирует пролиферацию стромы. ААС ↑ оба фактора → ↑ объём простаты → компрессия уретры → СНМП.',
        labMarkers: [
          { marker: 'ПСА общий + свободный', expectedChange: '↔', targetRange: '<4 нг/мл, своб/общ >25%', when: 'До курса, каждые 6 мес' },
          { marker: 'DHT', expectedChange: '↑', targetRange: '0.4-2.5 нмоль/л', when: 'При СНМП' },
          { marker: 'E2', expectedChange: '↑', targetRange: '20-50 пг/мл', when: 'Каждые 4 нед' },
          { marker: 'УЗИ простаты (ТРУЗИ)', expectedChange: '↔', targetRange: 'Объём <30 см³', when: 'До курса, при СНМП' },
          { marker: 'IPSS (опросник)', expectedChange: '↔', targetRange: '0-7 баллов (лёгкая)', when: 'При СНМП' },
        ],
        solutions: [
          { substanceId: 'finasteride', name: 'Финастерид', type: 'pharma', dose: '5 мг/сут', mechanism: 'Ингибитор 5α-R II типа → ↓ DHT в простате на 80%', evidenceLevel: 'A' },
          { substanceId: 'tamsulosin', name: 'Тамсулозин (α1-блокатор)', type: 'pharma', dose: '0.4 мг/сут', mechanism: '↓ тонус гладкой мускулатуры шейки мочевого пузыря и простаты → ↑ поток', evidenceLevel: 'A' },
          { substanceId: 'saw_palmetto', name: 'Пальма сереноа', type: 'supplement', dose: '320 мг/сут (жирные кислоты)', mechanism: 'Слабый ингибитор 5α-R + ↓ AR в простате', evidenceLevel: 'B' },
          { substanceId: 'zinc', name: 'Цинк', type: 'supplement', dose: '30-50 мг/сут', mechanism: '↓ 5α-редуктазу, ↓ воспаление в простате', evidenceLevel: 'B' },
          { substanceId: 'pygeum', name: 'Пигеум (Pygeum africanum)', type: 'supplement', dose: '100-200 мг/сут', mechanism: '↓ пролиферация фибробластов, ↓ воспаление', evidenceLevel: 'B' },
        ],
        expectations: [
          { timeline: '2-4 нед', effect: 'Тамсулозин: улучшение потока мочи, ↓ никтурия', sideNote: 'Ретроградная эякуляция у 5-10% (обратимо)' },
          { timeline: '3-6 мес', effect: 'Финастерид: ↓ объём простаты на 20-30%', sideNote: '↓ ПСА на 50% — учитывать при скрининге (удваивать значение)' },
          { timeline: 'Немедленно', effect: 'Острая задержка мочи → катетеризация → уролог. Это неотложное состояние.', sideNote: 'Острая задержка мочи = ургентная урология' },
        ],
      },
    ],
  },
  {
    id: 'vision_changes', symptom: 'Нарушения зрения / пятна / "снег" в глазах (SERM-токсичность)', category: 'cns',
    urgency: 'critical', relatedSymptoms: ['insomnia', 'anxiety'],
    quickFacts: ['Классический SERM-эффект: тамоксифен, кломифен', 'Механизм: кристаллическая ретинопатия', 'При появлении — НЕМЕДЛЕННАЯ отмена препарата'],
    generalInfo: 'Нарушения зрения при приёме SERM (тамоксифен, кломифен) или высоких доз ААС — ПОТЕНЦИАЛЬНО НЕОБРАТИМЫЙ побочный эффект. SERM вызывают кристаллическую ретинопатию (отложения в макуле), проявляющуюся как "снег", пятна, искажение линий, ↓ остроты зрения. Требует немедленной отмены препарата и консультации офтальмолога.',
    problems: [
      {
        problem: 'SERM-индуцированная кристаллическая ретинопатия', probability: 'medium',
        mechanism: 'Тамоксифен накапливается в тканях глаза, образуя кристаллические отложения в слое нервных волокон сетчатки и макуле → искажение зрения. Дозозависимый эффект (выше при дозах >20 мг/сут и длительном приёме). Кломифен — аналогичный, но более редкий эффект.',
        labMarkers: [
          { marker: 'Офтальмоскопия (глазное дно)', expectedChange: '↔', targetRange: 'Без кристаллов', when: 'НЕМЕДЛЕННО при симптомах' },
          { marker: 'ОКТ (оптическая когерентная томография)', expectedChange: '↔', targetRange: 'Норма', when: 'При симптомах' },
          { marker: 'Острота зрения', expectedChange: '↔', targetRange: '1.0 (100%)', when: 'При симптомах' },
        ],
        solutions: [
          { substanceId: 'stop_serm', name: 'НЕМЕДЛЕННАЯ ОТМЕНА SERM', type: 'lifestyle', dose: '—', mechanism: 'Устранение токсического агента', evidenceLevel: 'A' },
          { substanceId: 'switch_to_ai', name: 'Замена на ингибитор ароматазы', type: 'pharma', dose: 'Анастрозол 0.25 мг 2×/нед', mechanism: 'Альтернативный контроль E2 без ретинальной токсичности', evidenceLevel: 'A' },
          { substanceId: 'ophthalmologist', name: 'Консультация офтальмолога', type: 'lifestyle', dose: '—', mechanism: 'Оценка степени повреждения, прогноз восстановления', evidenceLevel: 'A' },
          { substanceId: 'nac', name: 'NAC', type: 'supplement', dose: '1200-2400 мг/сут', mechanism: 'Антиоксидант → ↓ окислительное повреждение сетчатки', evidenceLevel: 'C' },
        ],
        expectations: [
          { timeline: 'Немедленно', effect: 'ОТМЕНИТЬ SERM. Не ждать ухудшения.', sideNote: 'Кристаллическая ретинопатия может быть НЕОБРАТИМОЙ при продолжении приёма' },
          { timeline: '1-4 нед', effect: 'После отмены: частичное восстановление зрения у 60-70%', sideNote: 'У 30% изменения персистируют — профилактика важнее лечения' },
          { timeline: '3-6 мес', effect: 'Контрольная ОКТ: оценка динамики кристаллов', sideNote: 'Офтальмологический контроль 1×/год при длительном приёме SERM' },
        ],
      },
    ],
  },
  {
    id: 'insulin_resistance_signs', symptom: 'Постоянный голод / тяга к сладкому / сонливость после еды', category: 'endocrine',
    urgency: 'warning', relatedSymptoms: ['fatigue', 'bloating'],
    quickFacts: ['↑ на курсе гормона роста и некоторых ААС', 'Инсулинорезистентность развивается за 4-8 нед', 'Ранний маркер: HOMA-IR >2.5'],
    generalInfo: 'Инсулинорезистентность (ИР) — метаболический побочный эффект ААС, особенно гормона роста и оксиметолона. Симптомы: постоянный голод (даже после еды), тяга к сладкому, сонливость после углеводной нагрузки, трудности с похудением. Хроническая ИР → метаболический синдром → диабет 2 типа.',
    problems: [
      {
        problem: 'ААС/GH-индуцированная инсулинорезистентность', probability: 'high',
        mechanism: 'Гормон роста (GH) — мощный диабетогенный гормон: стимулирует липолиз → ↑ СЖК → ↓ чувствительность к инсулину. Некоторые ААС (оксиметолон) ↓ GLUT4-транслокацию. Андрогены ↓ адипонектин → ↑ ИР.',
        labMarkers: [
          { marker: 'Глюкоза натощак', expectedChange: '↑', targetRange: '4.1-5.9 ммоль/л', when: 'Каждые 4 нед' },
          { marker: 'Инсулин натощак', expectedChange: '↑', targetRange: '2.6-24.9 мкМЕ/мл', when: 'Каждые 4-8 нед' },
          { marker: 'HOMA-IR', expectedChange: '↑', targetRange: '<2.5', when: 'Каждые 8 нед' },
          { marker: 'HbA1c', expectedChange: '↑', targetRange: '4.5-5.7%', when: 'Каждые 8-12 нед' },
          { marker: 'Липидограмма', expectedChange: '↔', targetRange: 'ЛПНП <3.0, ТГ <1.7', when: 'Каждые 8 нед' },
        ],
        solutions: [
          { substanceId: 'metformin', name: 'Метформин', type: 'pharma', dose: '500-1000 мг 2×/день с едой', mechanism: '↓ глюконеогенез в печени + ↑ GLUT4-транслокацию → ↓ ИР', evidenceLevel: 'A' },
          { substanceId: 'berberine', name: 'Берберин', type: 'supplement', dose: '500 мг 3×/день перед едой', mechanism: 'Активация AMPK → ↓ глюконеогенез, ↑ захват глюкозы (аналог метформина)', evidenceLevel: 'A' },
          { substanceId: 'alpha_lipoic', name: 'R-ALA', type: 'supplement', dose: '300-600 мг/сут', mechanism: '↑ GLUT4-транслокацию, инсулин-миметик', evidenceLevel: 'A' },
          { substanceId: 'chromium', name: 'Хром пиколинат', type: 'supplement', dose: '400-1000 мкг/сут', mechanism: '↑ чувствительность к инсулину (хромодулин)', evidenceLevel: 'B' },
          { substanceId: 'low_gi_diet', name: 'Низкогликемическая диета', type: 'lifestyle', dose: 'Сложные углеводы, клетчатка ≥30 г/сут', mechanism: '↓ постпрандиальная гипергликемия', evidenceLevel: 'A' },
          { substanceId: 'cardio', name: 'Аэробные нагрузки', type: 'lifestyle', dose: '30-45 мин 4-5×/нед', mechanism: '↑ GLUT4, ↑ чувствительность к инсулину на 24-48 ч', evidenceLevel: 'A' },
        ],
        expectations: [
          { timeline: '1-2 нед', effect: 'Метформин 500 мг: начало ↓ глюкозы натощак и постпрандиальной', sideNote: 'Начинать с 500 мг вечером — минимизировать GI-побочки' },
          { timeline: '2-4 нед', effect: 'Берберин 1500 мг/сут: ↓ HOMA-IR на 25-30%', sideNote: 'Не комбинировать с метформином без контроля — риск гипогликемии' },
          { timeline: '4-8 нед', effect: 'Комплексный подход: снижение HOMA-IR в норму, ↓ голод', sideNote: 'GH + инсулин вместе — экстремально высокий риск ИР. Обязателен мониторинг' },
        ],
      },
    ],
  },
  {
    id: 'thyroid_dysfunction', symptom: 'Симптомы дисфункции щитовидной: усталость / зябкость / сухость кожи (гипо) или потливость / тремор / тахикардия (гипер)', category: 'endocrine',
    urgency: 'warning', relatedSymptoms: ['fatigue', 'tachycardia', 'brain_fog'],
    quickFacts: ['T3/T4 часто используются на курсе для ↑ метаболизма', 'После отмены T3: rebound-гипотиреоз (2-6 нед)', '"T3-курс" без тестостерона = катаболизм мышц'],
    generalInfo: 'Тиреоидные гормоны (T3, T4) часто используются в бодибилдинге для ускорения метаболизма и сушки. Гипертиреоз на курсе: тахикардия, потливость, тремор, потеря веса. После отмены — rebound-гипотиреоз: вялость, набор веса, отёки. Лабораторный контроль обязателен — TT3, TT4, ТТГ.',
    problems: [
      {
        problem: 'Экзогенный гипертиреоз (T3/T4-курс)', probability: 'medium',
        mechanism: 'Приём T3 (25-100 мкг/сут) или T4 подавляет ТТГ → ↓ эндогенная продукция → при отмене — временный гипотиреоз до восстановления оси (2-6 нед). Гипертиреоз ↑ метаболизм → ↑ ЧСС, ↑ термогенез, ↑ катаболизм (при недостатке ААС).',
        labMarkers: [
          { marker: 'ТТГ', expectedChange: '↓', targetRange: '0.4-4.0 мМЕ/л', when: 'До курса, каждые 4 нед' },
          { marker: 'TT3', expectedChange: '↑', targetRange: '2.6-5.7 пмоль/л', when: 'Каждые 4 нед' },
          { marker: 'TT4 свободный', expectedChange: '↓', targetRange: '9-22 пмоль/л', when: 'Каждые 4 нед (↓ из-за подавления ТТГ)' },
        ],
        solutions: [
          { substanceId: 'taper_t3', name: 'Постепенное снижение T3 (титрация вниз)', type: 'lifestyle', dose: '↓ на 12.5-25 мкг каждые 3-4 дня', mechanism: 'Дать время гипофизу восстановить ТТГ', evidenceLevel: 'B' },
          { substanceId: 'selenium', name: 'Селен', type: 'supplement', dose: '200 мкг/сут', mechanism: 'Кофактор дейодиназы D1 (конверсия T4→T3)', evidenceLevel: 'A' },
          { substanceId: 'zinc', name: 'Цинк', type: 'supplement', dose: '30-50 мг/сут', mechanism: 'Необходим для синтеза ТТГ и тиреоидных гормонов', evidenceLevel: 'B' },
          { substanceId: 'tyrosine', name: 'L-тирозин', type: 'supplement', dose: '500-1000 мг/сут', mechanism: 'Предшественник тиреоидных гормонов (неэффективен при подавленном ТТГ)', evidenceLevel: 'C' },
          { substanceId: 'ashwagandha', name: 'Ашваганда', type: 'supplement', dose: '300-600 мг/сут', mechanism: 'Может ↑ T4 (осторожно при приёме T3/T4)', evidenceLevel: 'B' },
        ],
        expectations: [
          { timeline: 'Немедленно', effect: 'Т3 дозы >50 мкг/сут + ЧСС >100 = снизить дозу', sideNote: 'Т3 без ААС — катаболизм мышц! Минимальная защита — тестостерон 200-300 мг/нед' },
          { timeline: '2-6 нед', effect: 'После отмены Т3: rebound-гипотиреоз. Симптомы: вялость, набор веса, отёки. Проходит самостоятельно.' },
          { timeline: '4-8 нед', effect: 'Селен + цинк: поддержка восстановления тиреоидной оси', sideNote: 'При ТТГ >10 через 8 нед после отмены — консультация эндокринолога' },
        ],
      },
    ],
  },
  {
    id: 'pct_lethargy', symptom: 'Вялость / апатия / "туман" на ПКТ', category: 'psychological',
    urgency: 'warning', relatedSymptoms: ['depression', 'libido_loss', 'brain_fog'],
    quickFacts: ['Пик симптомов: 2-4 нед после начала ПКТ', 'Причина: гормональная перестройка + ↓ нейростероиды', 'Обычно проходит к 6-8 нед ПКТ'],
    generalInfo: 'Постцикловая вялость — изнуряющий симптом на ПКТ, связанный с гормональной нестабильностью: ↓ тестостерон, ↓ E2 (SERM), ↓ нейростероиды, колебания кортизола. Это НЕ "лень" — это физиологический дефицит нейротрансмиттеров. Адаптация занимает 4-8 нед.',
    problems: [
      {
        problem: 'Гормональная депривация на ПКТ (low T + low E2 + low нейростероиды)', probability: 'high',
        mechanism: 'SERM (тамоксифен, кломифен) блокируют ER в ЦНС → несмотря на ↑ Т, мозг "не видит" эстрогены → симптомы гипоэстрогении: вялость, апатия, brain fog. + ↓ аллопрегнанолон (↓ GABA) → тревога + усталость. SERM также ↓ IGF-1 на 20-30% (печёночный эффект).',
        labMarkers: [
          { marker: 'Тестостерон общий', expectedChange: '↔', targetRange: '12.1-34.7 нмоль/л', when: 'Каждые 2-4 нед' },
          { marker: 'E2', expectedChange: '↔', targetRange: '20-50 пг/мл ♂', when: 'Каждые 2-4 нед' },
          { marker: 'ЛГ, ФСГ', expectedChange: '↑', targetRange: 'ЛГ 1.7-8.6', when: 'Каждые 2-4 нед (оценка ответа на SERM)' },
          { marker: 'IGF-1', expectedChange: '↓', targetRange: 'Возрастная норма', when: 'При выраженной вялости' },
          { marker: 'Кортизол (утро)', expectedChange: '↔', targetRange: '5-20 нмоль/л', when: 'При вялости' },
        ],
        solutions: [
          { substanceId: 'hcg', name: 'hCG (до начала SERM)', type: 'pharma', dose: '500-1000 МЕ 2-3×/нед 2-3 нед', mechanism: 'Стимуляция клеток Лейдига → ↑ T + ↑ E2 (через ароматизацию) → ↓ SERM-индуцированная вялость', evidenceLevel: 'A' },
          { substanceId: 'dhea', name: 'DHEA', type: 'supplement', dose: '25-50 мг/сут', mechanism: 'Предшественник T и E2 → ↑ нейростероиды → улучшение настроения', evidenceLevel: 'B' },
          { substanceId: 'ashwagandha', name: 'Ашваганда (KSM-66)', type: 'supplement', dose: '600 мг/сут', mechanism: '↓ кортизол, адаптоген, ↑ устойчивость к стрессу', evidenceLevel: 'A' },
          { substanceId: 'vitamin_d', name: 'Витамин D3', type: 'supplement', dose: '5000-10000 МЕ/сут', mechanism: '↑ дофамин, ↑ серотонин, нейростероидогенез', evidenceLevel: 'A' },
          { substanceId: 'enclomiphene', name: 'Энкломифен (вместо кломифена)', type: 'pharma', dose: '25 мг/сут', mechanism: 'Чистый транс-изомер → меньше ER-блокады в ЦНС → меньше вялости', evidenceLevel: 'A' },
          { substanceId: 'exercise_moderate', name: 'Умеренные тренировки', type: 'lifestyle', dose: '3-4×/нед, объём -20%', mechanism: '↑ BDNF, ↑ эндорфины, без перегрузки ЦНС', evidenceLevel: 'B' },
        ],
        expectations: [
          { timeline: '2-4 нед', effect: 'Пик вялости: адаптация к SERM, гормональные колебания', sideNote: 'Это НОРМАЛЬНО. Не повышать дозу SERM — усугубит ЭД и вялость' },
          { timeline: '4-6 нед', effect: 'Начало улучшения: стабилизация гормонального фона, ↑ толерантность к SERM' },
          { timeline: '6-8 нед', effect: 'Значительное улучшение: возвращение энергии, ясности мышления', sideNote: 'При отсутствии улучшения через 8 нед — проверить кортизол, DHEA-S, IGF-1' },
          { timeline: 'Немедленно', effect: 'hCG до ПКТ (2-3 нед): ↓ тяжесть ПКТ-симптомов, ↑ плавность перехода', sideNote: 'Оптимальный протокол: hCG последние 2-3 нед курса + 2 нед после → ПКТ' },
        ],
      },
    ],
  },
  {
    id: 'nausea', symptom: 'Тошнота / рвота / отвращение к пище', category: 'gastrointestinal',
    urgency: 'warning', relatedSymptoms: ['liver_pain', 'appetite_loss'],
    quickFacts: ['Наиболее частая причина: ор. ААС на голодный желудок', 'Гепатотоксичность → тошнота — серьёзный признак', 'Отвращение к белковой пище — классический признак печёночной перегрузки'],
    generalInfo: 'Тошнота на курсе — от банальной (пероральные ААС на голодный желудок) до серьёзной (гепатотоксичность). Ключевой дифференциальный признак: тошнота после приёма таблеток vs постоянная тошнота + отвращение к мясу. Второе — признак печёночной недостаточности, требует немедленного обследования.',
    problems: [
      {
        problem: 'Пероральные ААС / добавки на голодный желудок', probability: 'high',
        mechanism: '17α-алкилированные ААС и некоторые добавки (цинк натощак, АЛЬК, NAC высокие дозы) раздражают слизистую желудка → тошнота. Причина: прямой контакт с mucosa + стимуляция хеморецепторов.',
        labMarkers: [
          { marker: 'АЛТ, АСТ (исключить гепатотоксичность)', expectedChange: '↔', targetRange: '<40 Ед/л', when: 'При постоянной тошноте' },
        ],
        solutions: [
          { substanceId: 'with_food', name: 'Принимать препараты С ЕДОЙ', type: 'lifestyle', dose: '—', mechanism: 'Буферизация слизистой желудка пищей', evidenceLevel: 'A' },
          { substanceId: 'ginger', name: 'Имбирь (свежий / экстракт)', type: 'supplement', dose: '500-1000 мг за 30 мин до приёма', mechanism: '5-HT3 антагонист → ↓ тошнота', evidenceLevel: 'A' },
          { substanceId: 'vitamin_b6', name: 'Витамин B6', type: 'supplement', dose: '50-100 мг', mechanism: '↓ тошнота через ЦНС-механизм (используется при токсикозе беременных)', evidenceLevel: 'A' },
        ],
        expectations: [
          { timeline: 'Немедленно', effect: 'Приём с едой: ↓ тошнота на 90% при лекарственной природе' },
          { timeline: '30-60 мин', effect: 'Имбирь 500 мг: ↓ тошнота через 30 мин, пик через 60 мин' },
        ],
      },
      {
        problem: 'Гепатотоксичность + уремия (тошнота как признак печёночной/почечной недостаточности)', probability: 'low',
        mechanism: 'Тяжёлая гепатотоксичность (АЛТ >5× ВГН) → ↓ детоксикация → накопление токсинов → тошнота + отвращение к мясу. Почечная недостаточность → ↑ мочевина → уремическая тошнота.',
        labMarkers: [
          { marker: 'АЛТ, АСТ, ГГТ', expectedChange: '↑↑', targetRange: '<40, <40, <55', when: 'НЕМЕДЛЕННО' },
          { marker: 'Мочевина, креатинин', expectedChange: '↑', targetRange: 'Мочевина 2.5-8.3, креатинин 62-106', when: 'НЕМЕДЛЕННО' },
        ],
        solutions: [
          { substanceId: 'stop_aas', name: 'ОТМЕНИТЬ все ААС', type: 'lifestyle', dose: '—', mechanism: 'Устранение источника', evidenceLevel: 'A' },
          { substanceId: 'doctor', name: 'Срочная консультация врача', type: 'lifestyle', dose: '—', mechanism: 'Диагностика, исключение ОПечН/ОПН', evidenceLevel: 'A' },
        ],
        expectations: [
          { timeline: 'Немедленно', effect: 'Тошнота + отвращение к мясу = печёночная недостаточность до исключения. Срочно АЛТ/АСТ + врач.', sideNote: 'Не принимать противорвотные — маскировка симптома' },
        ],
      },
    ],
  },
  {
    id: 'excessive_sweating', symptom: 'Повышенная потливость днём / гипергидроз', category: 'cns',
    relatedSymptoms: ['anxiety', 'night_sweats', 'thyroid_dysfunction'],
    quickFacts: ['Симпатическая активация — основная причина', 'Тренболон — наиболее потогенный ААС', 'Дифференцировать с гипогликемией и гипертиреозом'],
    generalInfo: 'Повышенная потливость (гипергидроз) на курсе — результат симпатической гиперактивации и ↑ термогенеза. ААС ↑ базальный метаболизм на 5-15%. Тренболон и кленбутерол особенно потогенны. Важно исключить гипогликемию (инсулин) и гипертиреоз (T3).',
    problems: [
      {
        problem: 'ААС-индуцированный гипергидроз (симпатическая активация + ↑ метаболизм)', probability: 'high',
        mechanism: 'ААС ↑ базальный метаболизм → ↑ теплопродукция → компенсаторное потоотделение. Симпатическая активация (тренболон, кленбутерол) → ↑ холинергическая стимуляция потовых желёз. ↑ катехоламинов → термогенез в бурой жировой ткани.',
        labMarkers: [
          { marker: 'TT3, ТТГ', expectedChange: '↔', targetRange: 'ТТГ 0.4-4.0', when: 'Исключить гипертиреоз' },
          { marker: 'Глюкоза', expectedChange: '↔', targetRange: '4.0-5.9 ммоль/л', when: 'Исключить гипогликемию' },
        ],
        solutions: [
          { substanceId: 'magnesium', name: 'Магния глицинат', type: 'supplement', dose: '400-600 мг/сут', mechanism: '↓ симпатический тонус через ↓ выброс катехоламинов', evidenceLevel: 'B' },
          { substanceId: 'l_theanine', name: 'L-теанин', type: 'supplement', dose: '200-400 мг 2×/день', mechanism: '↑ α-волны → ↓ симпатическая активность → ↓ потоотделение', evidenceLevel: 'C' },
          { substanceId: 'sage', name: 'Шалфей (экстракт)', type: 'supplement', dose: '300-600 мг/сут', mechanism: 'Антихолинергический эффект на потовые железы', evidenceLevel: 'B' },
          { substanceId: 'reduce_stimulants', name: '↓ кофеин / стимуляторы', type: 'lifestyle', dose: 'Кофеин ≤200 мг/сут', mechanism: '↓ симпатическая стимуляция потовых желёз', evidenceLevel: 'C' },
        ],
        expectations: [
          { timeline: '1-2 нед', effect: 'L-теанин + Mg: ↓ baseline-потливость, особенно при тревожности-связанной' },
          { timeline: 'Немедленно', effect: 'Потливость + тремор + тахикардия + потеря веса → исключить гипертиреоз', sideNote: 'При нормальном ТТГ — адаптивная реакция, не патология' },
        ],
      },
    ],
  },
  {
    id: 'water_retention_face', symptom: 'Одутловатость лица / "лунное лицо" (кушингоидные черты)', category: 'endocrine',
    urgency: 'warning', relatedSymptoms: ['edema', 'hypertension'],
    quickFacts: ['Классический признак задержки воды', 'Наиболее выражен на оксиметолоне, тестостероне', 'Проходит через 1-2 нед после отмены или коррекции E2'],
    generalInfo: 'Одутловатость лица ("moon face") — результат задержки Na⁺ и воды в подкожно-жировой клетчатке лица. Напоминает кушингоидный тип (но без перераспределения жира). Наиболее выражен на высоких дозах тестостерона, оксиметолоне, при ↑ E2. Может сопровождаться повышением АД.',
    problems: [
      {
        problem: 'Эстроген/минералокортикоид-индуцированная задержка воды в мягких тканях лица', probability: 'high',
        mechanism: '↑ E2 (ароматизация) → ↑ гиалуроновая кислота в коже → ↑ связывание воды → отёчность. Активация РААС → ↑ Na⁺ → ↑ вода во внеклеточном пространстве → одутловатость. Наиболее заметно утром после горизонтального положения.',
        labMarkers: [
          { marker: 'E2', expectedChange: '↑', targetRange: '20-50 пг/мл ♂', when: 'Каждые 4 нед' },
          { marker: 'АД', expectedChange: '↑', targetRange: '<130/85', when: 'Ежедневно' },
          { marker: 'Na⁺ сыворотки', expectedChange: '↔', targetRange: '135-145 ммоль/л', when: 'Каждые 4 нед' },
        ],
        solutions: [
          { substanceId: 'anastro', name: 'Анастрозол (контроль E2)', type: 'pharma', dose: '0.25-0.5 мг 2×/нед', mechanism: '↓ ароматизация → ↓ E2 → ↓ задержка воды', evidenceLevel: 'A' },
          { substanceId: 'telmisartan', name: 'Телмисартан', type: 'pharma', dose: '40-80 мг/сут', mechanism: 'ARB → ↓ альдостерон → натрийурез', evidenceLevel: 'A' },
          { substanceId: 'potassium', name: 'Калия цитрат', type: 'supplement', dose: '1000-2000 мг/сут', mechanism: 'Na⁺/K⁺-баланс → ↓ задержка воды', evidenceLevel: 'B' },
          { substanceId: 'low_sodium', name: '↓ Na⁺ до <3 г/сут', type: 'lifestyle', dose: '<3 г/сут', mechanism: '↓ осмотическая задержка воды', evidenceLevel: 'A' },
          { substanceId: 'cardio', name: 'LISS-кардио', type: 'lifestyle', dose: '30-45 мин/день', mechanism: 'Потоотделение → ↓ ОЦК → ↓ отёчность лица', evidenceLevel: 'B' },
        ],
        expectations: [
          { timeline: '24-48 ч', effect: 'Анастрозол: начало ↓ E2 → уменьшение одутловатости через 3-5 дней' },
          { timeline: '1-2 нед', effect: 'Контроль E2 + ↓ Na⁺ + кардио: видимое улучшение контуров лица' },
          { timeline: 'Немедленно', effect: 'Одутловатость лица + ↑ АД + головная боль = риск гипертонического криза. Измерить АД.', sideNote: 'Отёк лица, не спадающий после отмены ААС >2 нед → исключить СН, нефротический синдром' },
        ],
      },
    ],
  },
  {
    id: 'sleep_apnea_signs', symptom: 'Храп / остановки дыхания во сне / утренняя головная боль', category: 'cns',
    urgency: 'warning', relatedSymptoms: ['insomnia', 'hypertension', 'fatigue'],
    quickFacts: ['↑ риск на курсе: набор массы тела и шеи', 'GH ↑ риск апноэ через ↑ тканей глотки', 'Утренняя головная боль — классический симптом'],
    generalInfo: 'Апноэ сна (СОАС) на курсе ААС/GH: ↑ масса тела и окружность шеи → механическая обструкция дыхательных путей. GH ↑ мягкие ткани глотки → усугубление. Симптомы: громкий храп, остановки дыхания (со слов партнёра), пробуждения с чувством удушья, утренняя головная боль, дневная сонливость.',
    problems: [
      {
        problem: 'Обструктивное апноэ сна (СОАС) на фоне набора массы', probability: 'medium',
        mechanism: '↑ мышечная масса → ↑ окружность шеи >43 см ♂ → сужение просвета глотки в горизонтальном положении. GH/IGF-1 → ↑ мягкие ткани (язык, нёбо) → усугубление обструкции. Жидкость перераспределяется в верхнюю половину тела ночью (rostral fluid shift).',
        labMarkers: [
          { marker: 'Окружность шеи', expectedChange: '↔', targetRange: '<43 см ♂', when: 'Измерить' },
          { marker: 'Полисомнография', expectedChange: '↔', targetRange: 'ИАГ <5/ч (норма)', when: 'При подозрении' },
          { marker: 'SpO₂ ночью (пульсоксиметр)', expectedChange: '↓', targetRange: 'SpO₂ >90% всю ночь', when: 'При подозрении (скрининг)' },
        ],
        solutions: [
          { substanceId: 'cpap', name: 'CPAP-терапия', type: 'lifestyle', dose: '—', mechanism: 'Постоянное положительное давление → шинирование дыхательных путей', evidenceLevel: 'A' },
          { substanceId: 'weight_loss', name: 'Снижение веса', type: 'lifestyle', dose: '↓ окружность шеи <43 см', mechanism: 'Механическое уменьшение обструкции', evidenceLevel: 'A' },
          { substanceId: 'side_sleeping', name: 'Сон на боку', type: 'lifestyle', dose: '—', mechanism: '↓ гравитационный коллапс мягких тканей глотки', evidenceLevel: 'B' },
          { substanceId: 'reduce_gh', name: 'Снижение дозы GH', type: 'lifestyle', dose: '↓ на 30-50%', mechanism: '↓ гиперплазия мягких тканей', evidenceLevel: 'C' },
        ],
        expectations: [
          { timeline: 'Немедленно', effect: 'Сон на боку: ↓ ИАГ на 20-30% у части пациентов' },
          { timeline: '1-2 нед', effect: 'CPAP: устранение апноэ, ↓ утренняя головная боль, ↑ качество сна', sideNote: 'Требуется подбор давления в sleep-лаборатории' },
          { timeline: 'Постоянно', effect: 'Нелеченное апноэ → ↑ риск АГ, ИБС, инсульта, аритмий', sideNote: 'Апноэ = медицинская проблема. Требует диагностики и лечения, а не БАДов' },
        ],
      },
    ],
  },
  {
    id: 'hot_flashes', symptom: 'Приливы жара / внезапное покраснение лица / жар', category: 'endocrine',
    relatedSymptoms: ['anxiety', 'night_sweats'],
    quickFacts: ['Характерны при ↓ E2 (AI-передоз или ПКТ)', 'Механизм: дисрегуляция терморегуляции гипоталамуса', '"Hot flashes" — классический симптом менопаузы (низкий E2)'],
    generalInfo: 'Приливы жара — результат эстрогенной депривации в гипоталамусе. Характерны при низком E2 (передозировка AI, ПКТ с SERM, постцикловый период). Внезапное ощущение жара, покраснение лица и шеи, потоотделение, длятся 30 сек – 5 мин. Проходят при нормализации E2.',
    problems: [
      {
        problem: 'Гипоэстрогения (↓ E2) и дисфункция центра терморегуляции', probability: 'medium',
        mechanism: 'E2 модулирует центр терморегуляции в гипоталамусе (преоптическая область). При резком ↓ E2 → сужение термонейтральной зоны → ложное ощущение перегрева → вазодилатация (покраснение) + потоотделение (охлаждение). SERM (тамоксифен) блокируют ER в ЦНС, имитируя гипоэстрогению.',
        labMarkers: [
          { marker: 'E2 (чувствительный)', expectedChange: '↓', targetRange: '20-50 пг/мл ♂', when: 'Немедленно' },
        ],
        solutions: [
          { substanceId: 'reduce_ai', name: 'Снизить дозу AI / приостановить SERM', type: 'pharma', dose: '—', mechanism: 'Восстановление E2-сигнализации в ЦНС', evidenceLevel: 'A' },
          { substanceId: 'dhea', name: 'DHEA', type: 'supplement', dose: '25-50 мг/сут', mechanism: 'Субстрат для эндогенного синтеза E2', evidenceLevel: 'C' },
          { substanceId: 'soy_isoflavones', name: 'Изофлавоны сои (генистеин)', type: 'supplement', dose: '50-100 мг/сут', mechanism: 'Фитоэстрогены → слабая ER-активация → ↓ приливы', evidenceLevel: 'B' },
        ],
        expectations: [
          { timeline: '1-3 дня', effect: 'Коррекция AI: ↓ приливы по мере восстановления E2', sideNote: 'E2 восстанавливается 3-7 дней после снижения дозы AI' },
          { timeline: '2-4 нед', effect: 'На ПКТ: приливы обычно проходят после завершения SERM', sideNote: 'Приливы на ПКТ — признак, что SERM работает (↓ E2-сигнал в ЦНС)' },
        ],
      },
    ],
  },
  {
    id: 'appetite_loss', symptom: 'Потеря аппетита / отвращение к пище / невозможность есть', category: 'gastrointestinal',
    urgency: 'warning', relatedSymptoms: ['nausea', 'liver_pain', 'depression'],
    quickFacts: ['Наиболее частая причина: ор. ААС + гепатотоксичность', 'Потеря аппетита к мясу — красный флаг печени', 'Длительная потеря → катаболизм → потеря результатов курса'],
    generalInfo: 'Потеря аппетита на курсе — парадоксальное и опасное состояние. ААС обычно повышают аппетит, поэтому его потеря сигнализирует о проблеме: гепатотоксичность, передозировка AI (↓ E2), депрессия (постцикловая), ЖКТ-проблемы. Длительная потеря аппетита → дефицит калорий → катаболизм мышц.',
    problems: [
      {
        problem: 'Гепатотоксичность-индуцированная анорексия', probability: 'medium',
        mechanism: 'Повреждение гепатоцитов → ↓ синтез белков плазмы → ↑ аммиак → тошнота + анорексия. Нарушение метаболизма желчных кислот → диспепсия → отвращение к жирной пище. Характерный признак: отвращение к мясу/белковой пище (специфично для печёночного генеза).',
        labMarkers: [
          { marker: 'АЛТ, АСТ, ГГТ', expectedChange: '↑', targetRange: '<40, <40, <55', when: 'НЕМЕДЛЕННО' },
          { marker: 'Билирубин', expectedChange: '↔', targetRange: '<21 мкмоль/л', when: 'НЕМЕДЛЕННО' },
          { marker: 'Аммиак', expectedChange: '↑', targetRange: '15-45 мкмоль/л', when: 'При выраженной анорексии' },
        ],
        solutions: [
          { substanceId: 'tudca', name: 'TUDCA', type: 'supplement', dose: '500-1000 мг/сут', mechanism: 'Гепатопротекция → ↓ апоптоз + ↑ желчеотток', evidenceLevel: 'A' },
          { substanceId: 'nac', name: 'NAC', type: 'supplement', dose: '1200-2400 мг/сут', mechanism: 'Детоксикация, восстановление глутатиона', evidenceLevel: 'A' },
          { substanceId: 'stop_orals', name: 'ОТМЕНИТЬ пероральные ААС', type: 'lifestyle', dose: '—', mechanism: 'Устранение гепатотоксического агента', evidenceLevel: 'A' },
          { substanceId: 'liquid_calories', name: 'Жидкие калории (протеин + углеводы)', type: 'lifestyle', dose: 'Гейнер / смузи вместо твёрдой пищи', mechanism: 'Обход анорексии через жидкое питание', evidenceLevel: 'C' },
        ],
        expectations: [
          { timeline: '24-72 ч', effect: 'Отмена ор. ААС + TUDCA: начало улучшения аппетита', sideNote: 'Если аппетит не возвращается через 3 дня — исключить другое заболевание' },
          { timeline: 'Немедленно', effect: 'Потеря аппетита к мясу + тошнота + утомляемость = печёночная недостаточность до исключения. Срочно АЛТ/АСТ!', sideNote: 'Не force-feed при печёночной недостаточности — это опасно' },
        ],
      },
    ],
  },
  {
    id: 'varicocele_like', symptom: 'Расширение вен / тяжесть в мошонке / "червивый мешок"', category: 'cardiovascular',
    relatedSymptoms: ['edema', 'testicular_atrophy'],
    quickFacts: ['Может имитировать варикоцеле из-за ↑ венозного давления', 'Дифференцировать с истинным варикоцеле', '↑ чувствительность яичек — частый симптом на ПКТ'],
    generalInfo: 'Ощущение тяжести в мошонке и расширенных вен (симптом "червивого мешка") может быть как истинным варикоцеле (расширение вен гроздевидного сплетения), так и следствием ↑ внутрибрюшного давления + задержки жидкости. Варикоцеле — частая причина мужского бесплодия (↑ температура яичек → ↓ сперматогенез).',
    problems: [
      {
        problem: 'Венозный застой в мошонке (↑ внутрибрюшное давление + задержка жидкости)', probability: 'medium',
        mechanism: 'ААС-индуцированная задержка жидкости + ↑ внутрибрюшное давление (тяжёлые приседания/становая) → затруднение венозного оттока от яичек → венозный стаз → ощущение тяжести. hCG ↑ кровоток в яичках → временное усиление симптома.',
        labMarkers: [
          { marker: 'УЗИ мошонки с допплером', expectedChange: '↔', targetRange: 'Вены <2 мм без рефлюкса', when: 'При симптомах' },
          { marker: 'Спермограмма', expectedChange: '↔', targetRange: 'Нормозооспермия (ВОЗ 2021)', when: 'Если планируется фертильность' },
        ],
        solutions: [
          { substanceId: 'diosmin', name: 'Диосмин + гесперидин', type: 'supplement', dose: '600-1200 мг/сут', mechanism: 'Флеботоник: ↑ тонус вен → ↓ венозный застой', evidenceLevel: 'A' },
          { substanceId: 'horse_chestnut', name: 'Конский каштан (эсцин)', type: 'supplement', dose: '300-600 мг/сут', mechanism: '↓ проницаемость капилляров, ↑ венозный тонус', evidenceLevel: 'A' },
          { substanceId: 'supportive_underwear', name: 'Поддерживающее бельё', type: 'lifestyle', dose: 'На тренировках и в течение дня', mechanism: 'Механическая поддержка → ↓ венозный стаз', evidenceLevel: 'C' },
          { substanceId: 'reduce_valsalva', name: '↓ приёмы Вальсальвы', type: 'lifestyle', dose: 'Ремень на становой, выдох на усилии', mechanism: '↓ внутрибрюшное давление', evidenceLevel: 'C' },
        ],
        expectations: [
          { timeline: '2-4 нед', effect: 'Диосмин 600 мг: ↓ ощущение тяжести, улучшение венозного оттока' },
          { timeline: 'Немедленно', effect: 'Острая боль + отёк мошонки → исключить перекрут яичка. Это ургентная ситуация!', sideNote: 'Перекрут яичка требует операции в течение 6 часов' },
        ],
      },
    ],
  },
  // ═══ ААС/GH/ИНСУЛИН — СПЕЦИФИЧНЫЕ СИМПТОМЫ ═══
  {
    id: 'tren_cough', symptom: '"Трен-кашель" / приступ кашля после инъекции', category: 'cardiovascular',
    urgency: 'warning', linkedDrugs: ['trenbolone'],
    quickFacts: ['Патогномоничный симптом тренболона', 'Частота: 20-30% инъекций', 'Механизм: эмболия масляного раствора в лёгочные капилляры'],
    generalInfo: '"Трен-кашель" — характерный симптом попадания микрокапли масляного раствора тренболона в кровеносный сосуд → эмболия лёгочных капилляров → рефлекторный кашель. Проявляется через 5-30 сек после инъекции: внезапный, неконтролируемый кашель, металлический привкус во рту, чувство жжения в груди. Длится 30 сек – 5 мин. Опасен при частом повторении (микроэмболизация лёгких).',
    problems: [
      {
        problem: 'Микроэмболия масляного раствора в лёгочную артерию', probability: 'medium',
        mechanism: 'При попадании иглы в кровеносный сосуд масляный раствор образует микроэмболы → окклюзия лёгочных капилляров → рефлекторный кашель через J-рецепторы. Масло метаболизируется лёгочными липазами за минуты.',
        labMarkers: [
          { marker: 'Пульсоксиметрия (SpO₂)', expectedChange: '↔', targetRange: '>95%', when: 'Во время приступа' },
          { marker: 'Аускультация лёгких', expectedChange: '↔', targetRange: 'Чистое дыхание', when: 'После приступа' },
        ],
        solutions: [
          { substanceId: 'aspirate', name: 'Аспирационная проба перед инъекцией', type: 'lifestyle', dose: 'Потянуть поршень на себя на 5 сек', mechanism: 'Если кровь в шприце — игла в сосуде → переколоть', evidenceLevel: 'A' },
          { substanceId: 'z_track', name: 'Z-трак метод инъекции', type: 'lifestyle', dose: 'Сместить кожу перед уколом', mechanism: 'Перекрытие инъекционного канала → ↓ риск утечки в сосуд', evidenceLevel: 'B' },
          { substanceId: 'ventrogluteal', name: 'Инъекция в вентро-ягодичную область', type: 'lifestyle', dose: 'Вместо дорсо-ягодичной', mechanism: 'Меньше крупных сосудов → ↓ риск внутрисосудистой инъекции', evidenceLevel: 'B' },
          { substanceId: 'stay_calm', name: 'Сохранять спокойствие во время приступа', type: 'lifestyle', dose: 'Дышать медленно, не паниковать', mechanism: 'Кашель пройдёт самостоятельно через 1-5 мин (липазы метаболизируют масло)', evidenceLevel: 'C' },
        ],
        expectations: [
          { timeline: '5-30 сек', effect: 'Начало кашля после инъекции — классический трен-кашель', sideNote: 'Не паниковать. Дышать. Пройдёт.' },
          { timeline: '1-5 мин', effect: 'Кашель прекращается самостоятельно', sideNote: 'Если кашель >10 мин + одышка + боль в груди → ОТЁК ЛЁГКИХ → скорую' },
          { timeline: 'Постоянно', effect: 'Аспирационная проба перед КАЖДОЙ инъекцией — профилактика', sideNote: 'Даже с аспирацией трен-кашель возможен. Это не ваша ошибка — это свойство препарата' },
        ],
      },
    ],
  },
  {
    id: 'carpal_tunnel_gh', symptom: 'Онемение / покалывание в пальцах / боль в запястье (GH-индуцированный карпальный туннель)', category: 'musculoskeletal',
    urgency: 'warning', linkedDrugs: ['gh', 'igf1'],
    quickFacts: ['Классический GH-побочный эффект', 'Механизм: отёк мягких тканей → компрессия n. medianus', 'Проходит при снижении дозы GH на 30-50%'],
    generalInfo: 'Карпальный туннельный синдром (КТС) на GH — результат задержки воды и отёка мягких тканей в запястном канале → компрессия срединного нерва. Симптомы: онемение I-III пальцев, боль в запястье, усиливающаяся ночью, слабость хвата, "утренняя скованность" кистей. Первый признак того, что доза GH превышает индивидуальный порог переносимости.',
    problems: [
      {
        problem: 'GH-индуцированный отёк мягких тканей запястного канала', probability: 'high',
        mechanism: 'GH ↑ синтез коллагена и гиалуроновой кислоты → ↑ гидратация соединительной ткани → отёк синовиальных оболочек в запястном канале → компрессия n. medianus. Дозозависимый эффект: чаще при дозах >4 МЕ/сут.',
        labMarkers: [
          { marker: 'IGF-1', expectedChange: '↑', targetRange: 'Возрастная норма (верхняя граница)', when: 'При симптомах КТС' },
          { marker: 'Тест Тинеля / Фалена', expectedChange: '↔', targetRange: 'Отрицательный', when: 'При симптомах' },
          { marker: 'ЭНМГ (при хроническом)', expectedChange: '↔', targetRange: 'Норма', when: 'При стойких симптомах >4 нед' },
        ],
        solutions: [
          { substanceId: 'reduce_gh_dose', name: 'СНИЗИТЬ дозу GH на 30-50%', type: 'lifestyle', dose: 'С 4-6 МЕ до 2-3 МЕ/сут', mechanism: '↓ отёк мягких тканей → декомпрессия нерва', evidenceLevel: 'A' },
          { substanceId: 'wrist_splint', name: 'Ортез на запястье (ночной)', type: 'lifestyle', dose: 'Носить каждую ночь', mechanism: 'Предотвращение сгибания запястья во сне → ↓ компрессия', evidenceLevel: 'A' },
          { substanceId: 'vitamin_b6', name: 'P5P (пиридоксаль-5-фосфат)', type: 'supplement', dose: '100-200 мг/сут', mechanism: 'Нейротрофический эффект, ↓ отёк нерва', evidenceLevel: 'B' },
          { substanceId: 'alpha_lipoic', name: 'R-ALA', type: 'supplement', dose: '600 мг/сут', mechanism: 'Антиоксидант → защита нерва от компрессионной ишемии', evidenceLevel: 'B' },
          { substanceId: 'split_dose', name: 'Разделение дозы GH на 2 инъекции', type: 'lifestyle', dose: '2×/день вместо 1×', mechanism: '↓ пиковая концентрация → ↓ отёк', evidenceLevel: 'C' },
        ],
        expectations: [
          { timeline: '3-7 дней', effect: 'Снижение дозы GH: ↓ отёк, ↓ онемение', sideNote: 'КТС обратим — не требует хирургии при своевременной коррекции' },
          { timeline: '1-2 нед', effect: 'Ортез + P5P: значительное уменьшение ночных симптомов', sideNote: 'Если КТС не проходит после снижения GH — пересмотреть препарат (возможно контаминация?)' },
          { timeline: 'Немедленно', effect: 'КТС + слабость хвата >2 нед → консультация невролога (ЭНМГ)', sideNote: 'Хроническая компрессия без лечения → необратимое повреждение нерва' },
        ],
      },
    ],
  },
  {
    id: 'deca_dick', symptom: '"Дека-дик" / полная ЭД + аноргазмия на нандролоне', category: 'endocrine',
    urgency: 'warning', linkedDrugs: ['nandrolone', 'trenbolone', 'all_19nor'],
    relatedSymptoms: ['erectile_dysfunction', 'libido_loss'],
    quickFacts: ['Патогномоничен для нандролона и тренболона', 'Механизм: ↑ пролактин + ↓ DHT + прогестагенная активность', 'Тамоксифен УСУГУБЛЯЕТ! Использовать каберголин'],
    generalInfo: '"Дека-дик" — полная эректильная дисфункция и аноргазмия при использовании 19-нор-производных (нандролон, тренболон). Отличается от обычной ЭД: не просто трудно достичь эрекции, а ПОЛНОЕ отсутствие эрекции + невозможность достичь оргазма. Причина — комбинация: ↑ пролактин (прогестагенная активность), ↓ DHT (нандролон → DHN — слабый андроген), ↓ нейростероиды.',
    problems: [
      {
        problem: 'Гиперпролактинемия + ↓ DHT + прогестагенная супрессия', probability: 'high',
        mechanism: 'Нандролон и тренболон — прогестины: активируют PR → ↑ пролактин → ↓ дофамин → ↓ либидо + ↓ GnRH. 5α-редуктаза конвертирует нандролон в DHN (слабый андроген) вместо DHT → ↓ андрогеновая сигнализация в ЦНС и кавернозных телах. + ↓ нейростероиды (аллопрегнанолон) → ↓ GABA-A.',
        labMarkers: [
          { marker: 'Пролактин', expectedChange: '↑↑', targetRange: '86-324 мкМЕ/мл', when: 'Немедленно' },
          { marker: 'DHT', expectedChange: '↓↓', targetRange: '0.4-2.5 нмоль/л', when: 'При симптомах' },
          { marker: 'Прогестерон', expectedChange: '↑', targetRange: '<1.2 нмоль/л ♂', when: 'При симптомах' },
          { marker: 'E2', expectedChange: '↔', targetRange: '20-50 пг/мл', when: 'Каждые 4 нед' },
        ],
        solutions: [
          { substanceId: 'cabergoline', name: 'Каберголин', type: 'pharma', dose: '0.5 мг 2×/нед', mechanism: 'D2-агонист → ↓ пролактин → восстановление дофамина и либидо', evidenceLevel: 'A' },
          { substanceId: 'add_test', name: 'Добавить тестостерон (тестостероновая база)', type: 'pharma', dose: '200-300 мг/нед (минимум)', mechanism: 'Обеспечение DHT через 5α-редукцию T, поддержание андрогеновой сигнализации', evidenceLevel: 'A' },
          { substanceId: 'add_masteron', name: 'Добавить мастерон (DHT-производное)', type: 'pharma', dose: '200-400 мг/нед', mechanism: 'Прямой DHT-агонист → ↑ андрогеновая сигнализация + ↓ E2-рецепторы', evidenceLevel: 'B' },
          { substanceId: 'avoid_tamoxifen', name: 'НЕ использовать тамоксифен!', type: 'pharma', dose: '—', mechanism: 'Тамоксифен ↑ PR-экспрессию → УСУГУБЛЯЕТ прогестагенную активность нандролона', evidenceLevel: 'A' },
          { substanceId: 'p5p', name: 'P5P (витамин B6 активный)', type: 'supplement', dose: '100-200 мг/сут', mechanism: 'Кофактор синтеза дофамина → ↓ пролактин', evidenceLevel: 'B' },
          { substanceId: 'stop_19nor', name: 'ОТМЕНИТЬ 19-нор-производное', type: 'lifestyle', dose: '—', mechanism: 'Устранение первопричины', evidenceLevel: 'A' },
        ],
        expectations: [
          { timeline: '24-48 ч', effect: 'Каберголин 0.5 мг: ↓ пролактина, начало восстановления либидо', sideNote: 'Не повышать дозу каберголина >1 мг/нед — риск фиброза клапанов' },
          { timeline: '1-2 нед', effect: 'Добавление тестостерона: восстановление DHT, улучшение эрекции', sideNote: 'Т-база на курсе 19-нор ОБЯЗАТЕЛЬНА. Без неё — гарантированный дека-дик' },
          { timeline: 'Немедленно', effect: 'НЕ ЖДАТЬ. Дека-дик может сохраняться МЕСЯЦАМИ после отмены нандролона (длинный эфир + метаболиты)', sideNote: 'Нандролона деканоат выводится до 18 мес. Дека-дик может длиться весь этот период' },
        ],
      },
    ],
  },
  {
    id: 'tren_mental', symptom: 'Психостимуляция / агрессия / паранойя / обсессии на тренболоне', category: 'psychological',
    urgency: 'warning', linkedDrugs: ['trenbolone'],
    relatedSymptoms: ['anxiety', 'aggression', 'insomnia'],
    quickFacts: ['Тренболон — наиболее психоактивный ААС', 'Механизм: активация NMDA + ↓ GABA + ↑ катехоламины', 'Паранойя и обсессии — уникальный трен-специфичный симптом'],
    generalInfo: 'Тренболон уникален среди ААС по психоактивности. В отличие от тестостерона (эйфория, уверенность), тренболон вызывает: гиперактивность ЦНС, агрессию, паранойяльные мысли, обсессивно-компульсивные тенденции (проверка замков, перепроверка), нарушения сна (поверхностный, с кошмарами). Механизм: активация NMDA-рецепторов (глутамат), ↓ GABA-A (↓ аллопрегнанолон), ↑ катехоламины, ↓ серотонин.',
    problems: [
      {
        problem: 'Тренболон-индуцированная глутаматная гиперактивация + GABA-супрессия', probability: 'high',
        mechanism: 'Тренболон активирует NMDA-рецепторы → ↑ внутриклеточный Ca²⁺ → эксайтотоксичность + гиперактивность ЦНС. Одновременно ↓ нейростероиды → ↓ GABA-A → ↓ тормозные механизмы → психозоподобное состояние. ↑ дофамин → обсессии/компульсии.',
        labMarkers: [
          { marker: 'Кортизол (слюна, утро)', expectedChange: '↑', targetRange: '5-20 нмоль/л', when: 'При психических симптомах' },
          { marker: 'Пролактин', expectedChange: '↔', targetRange: '86-324 мкМЕ/мл', when: 'При симптомах' },
          { marker: 'E2', expectedChange: '↔', targetRange: '20-50 пг/мл', when: 'Каждые 4 нед' },
        ],
        solutions: [
          { substanceId: 'reduce_tren', name: 'СНИЗИТЬ дозу тренболона', type: 'lifestyle', dose: '↓ с 300-500 мг до 100-200 мг/нед', mechanism: 'Меньше глутаматной активации = меньше психиатрических симптомов', evidenceLevel: 'A' },
          { substanceId: 'stop_tren', name: 'ОТМЕНИТЬ тренболон при паранойе/обсессиях', type: 'lifestyle', dose: '—', mechanism: 'Устранение причины. Заменить на менее нейротоксичный ААС (тестостерон, болденон)', evidenceLevel: 'A' },
          { substanceId: 'l_theanine', name: 'L-теанин', type: 'supplement', dose: '400-600 мг 3×/день', mechanism: '↑ GABA, блокирует NMDA (конкурентный антагонист глицинового сайта)', evidenceLevel: 'A' },
          { substanceId: 'nac', name: 'NAC', type: 'supplement', dose: '2400 мг/сут', mechanism: 'Модуляция глутамата (цистин-глутаматный антипортер) → ↓ обсессии', evidenceLevel: 'B' },
          { substanceId: 'magnesium_threonate', name: 'Магния треонат', type: 'supplement', dose: '2000 мг/сут', mechanism: 'Проникает ГЭБ → ↓ пресинаптический глутамат → ↓ гиперактивация', evidenceLevel: 'B' },
          { substanceId: 'taurine', name: 'Таурин', type: 'supplement', dose: '3-5 г/сут', mechanism: 'Агонист глициновых рецепторов → ↑ GABA-ергический тонус', evidenceLevel: 'C' },
        ],
        expectations: [
          { timeline: '30-60 мин', effect: 'L-теанин 400 мг: ↓ тревожность, ↓ психостимуляция (NMDA-блокада)', sideNote: 'Безопасен в высоких дозах — можно до 1200 мг/день' },
          { timeline: '1-3 дня', effect: 'Снижение дозы тренболона: значительное улучшение психического состояния', sideNote: 'Тренболона ацетат выводится быстро (t½=1-2 дн). Энантат — до 2 нед' },
          { timeline: 'Немедленно', effect: 'Параноидальные мысли + агрессия, угрожающая другим = НЕМЕДЛЕННАЯ ОТМЕНА тренболона. Не "перетерпеть" — это опасно.', sideNote: 'Психоз на тренболоне — реальный риск при высоких дозах и предрасположенности' },
        ],
      },
    ],
  },
  {
    id: 'orals_lethargy', symptom: 'Вялость / сонливость / "oral fatigue" на пероральных ААС', category: 'hepatic',
    urgency: 'warning', linkedDrugs: ['all_orals', 'oxymetholone', 'methandienone'],
    relatedSymptoms: ['liver_pain', 'appetite_loss', 'nausea'],
    quickFacts: ['Классический симптом печёночной перегрузки', 'Наиболее выражен на оксиметолоне и метандиеноне', 'Проходит через 3-5 дней после отмены'],
    generalInfo: '"Oral fatigue" — характерная вялость и сонливость на пероральных 17α-алкилированных ААС. Не просто "устал после тренировки", а глубокая, изнуряющая сонливость, часто после приёма таблетки. Причина: печёночная нагрузка → ↓ детоксикация → накопление метаболитов → системная интоксикация + гипогликемия (подавление глюконеогенеза). Красный флаг: если вялость + тошнота → немедленно проверить АЛТ/АСТ.',
    problems: [
      {
        problem: 'Гепатотоксическая астения + гипогликемия на ор. ААС', probability: 'high',
        mechanism: '17α-алкилированные ААС → гепатотоксичность → ↓ глюконеогенез → гипогликемия через 2-3 ч после приёма → сонливость. + ↓ клиренс аммиака и других метаболитов → системная интоксикация → астения. Наиболее выражен при приёме натощак (быстрая абсорбция → высокий first-pass → большая нагрузка на печень).',
        labMarkers: [
          { marker: 'АЛТ, АСТ', expectedChange: '↑', targetRange: '<40 Ед/л', when: 'При вялости на ор. ААС' },
          { marker: 'ГГТ', expectedChange: '↔', targetRange: '<55 Ед/л', when: 'Каждые 2-4 нед' },
          { marker: 'Глюкоза (через 2-3 ч после таблетки)', expectedChange: '↓', targetRange: '4-6 ммоль/л', when: 'Для диф. диагностики гипогликемии' },
        ],
        solutions: [
          { substanceId: 'with_food', name: 'Принимать с едой (углеводы + белок)', type: 'lifestyle', dose: 'Таблетку с приёмом пищи', mechanism: 'Замедление абсорбции → ↓ пиковая нагрузка на печень + профилактика гипогликемии', evidenceLevel: 'B' },
          { substanceId: 'tudca', name: 'TUDCA', type: 'supplement', dose: '500-1000 мг/сут', mechanism: 'Гепатопротекция → ↓ ER-стресс → ↓ астения', evidenceLevel: 'A' },
          { substanceId: 'nac', name: 'NAC', type: 'supplement', dose: '1200-2400 мг/сут', mechanism: 'Восстановление глутатиона → детоксикация', evidenceLevel: 'A' },
          { substanceId: 'milk_thistle', name: 'Расторопша', type: 'supplement', dose: '280 мг/сут', mechanism: 'Стабилизация мембран гепатоцитов', evidenceLevel: 'A' },
          { substanceId: 'split_dose', name: 'Разделение суточной дозы', type: 'lifestyle', dose: '2 приёма вместо 1', mechanism: '↓ пиковая концентрация → ↓ нагрузка на печень за проход', evidenceLevel: 'C' },
          { substanceId: 'injectable', name: 'Переход на инъекционную форму', type: 'lifestyle', dose: '—', mechanism: 'Обход first-pass метаболизма → нулевая гепатотоксичность (для не-алкилированных)', evidenceLevel: 'A' },
        ],
        expectations: [
          { timeline: '1-2 ч', effect: 'Приём с едой: ↓ сонливость после таблетки', sideNote: 'Не принимать натощак 17α-алкилированные. Это не обсуждается.' },
          { timeline: '3-5 дней', effect: 'Отмена ор. ААС: полное исчезновение oral fatigue', sideNote: 'Если вялость осталась после отмены → не печёночная причина. Проверить кортизол, E2' },
          { timeline: 'Немедленно', effect: 'Вялость + тошнота + отвращение к еде = гепатит до исключения. Срочно АЛТ/АСТ.', sideNote: 'Продолжение приёма ор. ААС на фоне симптомов → риск токсического гепатита' },
        ],
      },
    ],
  },
  {
    id: 'insulin_fat_gain', symptom: 'Набор жира несмотря на диету / "инсулиновая жирность"', category: 'endocrine',
    urgency: 'warning', linkedDrugs: ['insulin'],
    relatedSymptoms: ['insulin_resistance_signs', 'hypoglycemia', 'water_retention_face'],
    quickFacts: ['Инсулин — самый анаболический и самый липогенный гормон', 'Механизм: активация LPL → захват жирных кислот в адипоциты', 'Ключевая ошибка: приём жиров в "окно инсулина"'],
    generalInfo: 'Набор жира на инсулине — результат липогенного действия инсулина. Инсулин активирует липопротеинлипазу (LPL) в жировой ткани → захват и эстерификация жирных кислот → рост адипоцитов. Даже при гипокалорийной диете, если калории поступают в "окне инсулина" вместе с жирами — они пойдут в жир. Ключевое правило: приём пищи после инсулина = БЕЛОК + УГЛЕВОДЫ. НИКАКИХ ЖИРОВ в течение 3-4 ч.',
    problems: [
      {
        problem: 'Инсулин-индуцированная активация липогенеза', probability: 'high',
        mechanism: 'Инсулин ↑ LPL в адипоцитах → ↑ захват хиломикронов и ЛПОНП → ↑ эстерификация ЖК → ↑ триглицериды в жировой ткани. + Инсулин ↓ HSL (гормон-чувствительная липаза) → блок липолиза. Если в крови есть жиры (из еды) в момент пика инсулина → 100% пойдут в депо.',
        labMarkers: [
          { marker: 'Инсулин натощак', expectedChange: '↑', targetRange: '2.6-24.9 мкМЕ/мл', when: 'Каждые 2-4 нед' },
          { marker: 'HOMA-IR', expectedChange: '↑', targetRange: '<2.5', when: 'Каждые 4 нед' },
          { marker: 'Глюкоза натощак', expectedChange: '↔', targetRange: '4.0-5.9 ммоль/л', when: 'Ежедневно' },
        ],
        solutions: [
          { substanceId: 'zero_fat_window', name: 'НИКАКИХ ЖИРОВ в инсулиновое окно (3-4 ч)', type: 'lifestyle', dose: 'Только белок + углеводы после инъекции', mechanism: 'Нет субстрата для LPL → нет отложения жира', evidenceLevel: 'A' },
          { substanceId: 'fast_acting', name: 'Использовать только короткий инсулин (Хумалог/Новорапид)', type: 'pharma', dose: '—', mechanism: 'Короткое окно (2-3 ч) → меньше риск липогенеза vs длинный инсулин', evidenceLevel: 'A' },
          { substanceId: 'metformin', name: 'Метформин', type: 'pharma', dose: '500-1000 мг 2×/день', mechanism: '↓ глюконеогенез + ↑ чувствительность → ↓ потребная доза инсулина', evidenceLevel: 'A' },
          { substanceId: 'alpha_lipoic', name: 'R-ALA', type: 'supplement', dose: '300-600 мг с инсулиновым приёмом', mechanism: '↑ GLUT4 → ↑ захват глюкозы в МЫШЦЫ (не в жир)', evidenceLevel: 'B' },
          { substanceId: 'carnitine', name: 'L-карнитин', type: 'supplement', dose: '2-3 г/сут', mechanism: '↑ транспорт ЖК в митохондрии → окисление вместо запасания', evidenceLevel: 'B' },
          { substanceId: 'reduce_dose', name: 'СНИЗИТЬ дозу инсулина', type: 'lifestyle', dose: '↓ с 10-15 МЕ до 5-8 МЕ', mechanism: 'Меньше инсулина = меньше липогенеза', evidenceLevel: 'A' },
        ],
        expectations: [
          { timeline: 'Немедленно', effect: 'Убрать жиры из инсулинового окна → прекращение набора жира', sideNote: '1 г жира в инсулиновом окне = практически 1 г жира в депо (термогенез минимален)' },
          { timeline: '1-2 нед', effect: 'Метформин + ALA: улучшение чувствительности → ↓ доза инсулина → ↓ липогенез', sideNote: 'Метформин + инсулин = риск гипогликемии. Снижать дозу инсулина при добавлении метформина' },
          { timeline: 'Постоянно', effect: 'Инсулин — инструмент для ПРОФИ. Ошибка в 5 МЕ = набор жира за неделю. Не для новичков.', sideNote: 'Инсулин без глюкометра + без подсчёта БЖУ = гарантированный ожирение' },
        ],
      },
    ],
  },
  {
    id: 'cholesterol_crash', symptom: 'Обвал ЛПВП ("хорошего" холестерина) / атерогенный липидный профиль', category: 'cardiovascular',
    urgency: 'warning', linkedDrugs: ['stanozolol', 'oxymetholone', 'all_orals', 'trenbolone'],
    relatedSymptoms: ['hypertension', 'edema'],
    quickFacts: ['Станозолол ↓ ЛПВП на 30-50% за 4-6 нед', 'Оксиметолон ↓ ЛПВП на 25-40%', 'Инъекционный тестостерон ↓ ЛПВП умеренно (10-15%)'],
    generalInfo: 'ААС негативно влияют на липидный профиль: ↓ ЛПВП (обратный транспорт холестерина), ↑ ЛПНП (у некоторых), ↑ триглицериды. Наиболее атерогенны 17α-алкилированные ААС (станозолол, оксиметолон) — ↓ ЛПВП до 70% от исходного. Это увеличивает риск атеросклероза даже при нормальном АД. Эффект обратим через 4-12 нед после отмены.',
    problems: [
      {
        problem: 'ААС-индуцированная дислипидемия (↓ ЛПВП)', probability: 'high',
        mechanism: '17α-алкилированные ААС ингибируют печёночную липазу (HL) и apoA-I синтез → ↓ созревание ЛПВП → ↓ обратный транспорт холестерина. Андрогены ↑ SR-BI рецептор → ↑ клиренс ЛПВП из крови → ↓ ЛПВП. Эстрогены защищают ЛПВП (↑ apoA-I) — ААС с низкой ароматизацией (станозолол) наиболее атерогенны.',
        labMarkers: [
          { marker: 'Липидограмма (ЛПВП, ЛПНП, ТГ)', expectedChange: '↑', targetRange: 'ЛПВП >1.0, ЛПНП <3.0, ТГ <1.7 ммоль/л', when: 'До курса, каждые 4-8 нед' },
          { marker: 'Аполипопротеин A-I', expectedChange: '↓', targetRange: '1.0-1.8 г/л', when: 'При ↓ ЛПВП' },
          { marker: 'Аполипопротеин B', expectedChange: '↔', targetRange: '0.5-1.2 г/л', when: 'При дислипидемии' },
          { marker: 'ЛП(а)', expectedChange: '↔', targetRange: '<30 мг/дл', when: 'При семейной гиперхолестеринемии' },
        ],
        solutions: [
          { substanceId: 'omega3', name: 'Омега-3 (EPA/DHA)', type: 'supplement', dose: '3-4 г/сут', mechanism: '↑ ЛПВП на 5-10%, ↓ ТГ на 20-30%', evidenceLevel: 'A' },
          { substanceId: 'citrus_bergamot', name: 'Бергамот (цитрусовый экстракт)', type: 'supplement', dose: '500-1000 мг/сут', mechanism: '↑ ЛПВП на 20-30% через PPARα, ↓ ЛПНП', evidenceLevel: 'A' },
          { substanceId: 'red_yeast_rice', name: 'Красный дрожжевой рис (монаколин K)', type: 'supplement', dose: '1200 мг/сут', mechanism: 'Природный статин → ↓ ЛПНП на 15-25%', evidenceLevel: 'A' },
          { substanceId: 'niacin', name: 'Ниацин (B3) — НЕ ИНОЗИТОЛ ГЕКСАНИКОТИНАТ', type: 'supplement', dose: '500-1000 мг/сут (медленная титрация)', mechanism: '↑ ЛПВП на 15-35% (наиболее мощный ЛПВП-бустер)', evidenceLevel: 'A' },
          { substanceId: 'coq10', name: 'CoQ10', type: 'supplement', dose: '100-200 мг/сут', mechanism: 'Защита ЛПВП от окисления + необходимо при приёме статинов/красного риса', evidenceLevel: 'A' },
          { substanceId: 'cardio', name: 'Аэробные нагрузки', type: 'lifestyle', dose: '30-45 мин 4-5×/нед', mechanism: '↑ ЛПВП на 5-10% независимо от ААС', evidenceLevel: 'A' },
          { substanceId: 'avoid_winstrol', name: 'Избегать станозолол при дислипидемии', type: 'lifestyle', dose: '—', mechanism: 'Станозолол — наиболее атерогенный ААС', evidenceLevel: 'A' },
        ],
        expectations: [
          { timeline: '2-4 нед', effect: 'Омега-3 + бергамот: ↑ ЛПВП на 5-15%, ↓ ТГ', sideNote: 'Бергамот взаимодействует с CYP3A4 — осторожно с другими лекарствами' },
          { timeline: '4-8 нед', effect: 'Ниацин (титрация с 250 до 1000 мг): ↑ ЛПВП на 15-25%', sideNote: 'Ниацин-флаш (покраснение) — нормально. Не использовать пролонгированный — гепатотоксичен' },
          { timeline: '4-12 нед', effect: 'После отмены ААС: восстановление ЛПВП до исходного уровня', sideNote: 'Чем дольше курс — тем дольше восстановление липидного профиля' },
        ],
      },
    ],
  },
  {
    id: 'thyroid_t3_suppression', symptom: 'Вялость / заторможенность / набор веса после отмены T3', category: 'endocrine',
    urgency: 'warning', linkedDrugs: ['t3', 't4'],
    relatedSymptoms: ['fatigue', 'depression', 'thyroid_dysfunction'],
    quickFacts: ['Rebound-гипотиреоз после T3: пик на 2-4 нед', 'TT3 ↓ + ТТГ ↑ — ожидаемая картина', 'Восстановление оси: 4-8 нед после отмены T3'],
    generalInfo: 'После отмены экзогенного T3 развивается rebound-гипотиреоз. Внешняя ось подавлена (ТТГ ↓), щитовидная железа "спит". После отмены: ТТГ начинает расти, но щитовидная отвечает медленно → гипотиреозное состояние. Симптомы: вялость, заторможенность, набор веса (↓ метаболизм), отёки, запоры, зябкость. Длительность: 2-6 нед.',
    problems: [
      {
        problem: 'Rebound-гипотиреоз после отмены экзогенного T3', probability: 'high',
        mechanism: 'Экзогенный T3 подавляет ТТГ через негативную обратную связь → щитовидная железа ↓ продукция T4/T3 + ↓ экспрессия NIS (натрий-йод симпортер). После отмены: ТТГ начинает расти через 1-2 нед, но щитовидная отвечает медленно → гипотиреозный промежуток 2-6 нед. Дозозависимо: >50 мкг/сут → более тяжёлый rebound.',
        labMarkers: [
          { marker: 'ТТГ', expectedChange: '↑', targetRange: '0.4-4.0 мМЕ/л', when: 'Каждые 2 нед после отмены' },
          { marker: 'TT3', expectedChange: '↓', targetRange: '2.6-5.7 пмоль/л', when: 'Каждые 2 нед' },
          { marker: 'TT4 свободный', expectedChange: '↓', targetRange: '9-22 пмоль/л', when: 'Каждые 2 нед' },
        ],
        solutions: [
          { substanceId: 'taper_t3', name: 'ТИТРАЦИЯ ВНИЗ (taper)', type: 'lifestyle', dose: '↓ на 12.5-25 мкг каждые 4-5 дней', mechanism: 'Постепенное ↓ → постепенное ↑ ТТГ → меньше гипотиреозный провал', evidenceLevel: 'A' },
          { substanceId: 'selenium', name: 'Селен', type: 'supplement', dose: '200 мкг/сут', mechanism: 'Кофактор дейодиназы D1 → конверсия T4→T3', evidenceLevel: 'A' },
          { substanceId: 'zinc', name: 'Цинк', type: 'supplement', dose: '30-50 мг/сут', mechanism: 'Необходим для синтеза ТТГ и связывания T3 с рецептором', evidenceLevel: 'B' },
          { substanceId: 'tyrosine', name: 'L-тирозин', type: 'supplement', dose: '500-1000 мг/сут', mechanism: 'Субстрат для синтеза T4/T3', evidenceLevel: 'C' },
          { substanceId: 'iodine_cautious', name: 'Йод (ОСТОРОЖНО)', type: 'supplement', dose: '150 мкг/сут (не больше!)', mechanism: 'Субстрат для T4. НЕ превышать — риск тиреоидита', evidenceLevel: 'B' },
          { substanceId: 'exercise_moderate', name: 'Умеренные нагрузки', type: 'lifestyle', dose: '3-4×/нед, без перегрузки', mechanism: 'Стимуляция метаболизма через мышечную активность', evidenceLevel: 'B' },
        ],
        expectations: [
          { timeline: '1-2 нед', effect: 'Начало taper: ↓ дозы T3, ТТГ начинает расти', sideNote: 'Не обрывать T3 резко — это усугубляет rebound' },
          { timeline: '2-4 нед', effect: 'Пик гипотиреоза: вялость, набор веса, отёки', sideNote: 'Это НОРМАЛЬНО. Не принимать T3 снова — продлит подавление' },
          { timeline: '4-8 нед', effect: 'Восстановление: ТТГ нормализуется, TT3/TT4 возвращаются к baseline', sideNote: 'Если ТТГ >10 через 8 нед — консультация эндокринолога (субклинический гипотиреоз?)' },
        ],
      },
    ],
  },
  {
    id: 'acromegaly_signs', symptom: 'Рост костей лица / челюсти / кистей / стоп (GH-акромегалия)', category: 'musculoskeletal',
    urgency: 'critical', linkedDrugs: ['gh', 'igf1'],
    quickFacts: ['Необратимое изменение!', 'Первые признаки: увеличение размера обуви/перчаток', 'Рост нижней челюсти (прогнатизм) + диастема (щель между зубами)'],
    generalInfo: 'Акромегалия — НЕОБРАТИМОЕ осложнение длительного приёма высоких доз GH. Характеризуется ростом костей лица (надбровные дуги, нижняя челюсть), кистей и стоп. В отличие от отёка (обратим), рост кости — постоянный. Ранние признаки: кольца/перчатки становятся малы, увеличивается размер обуви, меняется прикус. IGF-1 >400 нг/мл на постоянной основе — зона риска.',
    problems: [
      {
        problem: 'GH-индуцированная акромегалия (необратимый рост костей)', probability: 'medium',
        mechanism: 'GH → ↑ IGF-1 в печени и локально в тканях → IGF-1 стимулирует пролиферацию хондроцитов в суставных хрящах и периосте → рост костей в ширину и длину. Особенно чувствительны: нижняя челюсть (мандибулярный рост), кости кистей (фаланги), стопы. Процесс медленный (месяцы-годы), но НЕОБРАТИМ.',
        labMarkers: [
          { marker: 'IGF-1', expectedChange: '↑↑', targetRange: 'Возрастная норма (не >300 нг/мл длительно)', when: 'Каждые 4-8 нед' },
          { marker: 'Глюкоза натощак', expectedChange: '↔', targetRange: '4.0-5.9', when: 'Каждые 4 нед (GH - диабетоген)' },
          { marker: 'Сравнительные фото / размеры', expectedChange: '↔', targetRange: 'Без изменений', when: 'Каждые 3-6 мес' },
        ],
        solutions: [
          { substanceId: 'reduce_gh', name: 'СНИЗИТЬ дозу GH НЕМЕДЛЕННО', type: 'lifestyle', dose: '↓ до 1-2 МЕ/сут или отменить', mechanism: '↓ IGF-1 → остановка роста костей', evidenceLevel: 'A' },
          { substanceId: 'monitor_igf1', name: 'Держать IGF-1 в пределах возрастной нормы', type: 'lifestyle', dose: 'IGF-1 не выше верхней границы референса', mechanism: 'IGF-1 = прямой медиатор акромегалии. Держать в норме.', evidenceLevel: 'A' },
          { substanceId: 'cycle_gh', name: 'Циклировать GH (5/2 или 8/2)', type: 'lifestyle', dose: '5 дней приём / 2 дня отдых', mechanism: 'Периодическое ↓ IGF-1 → меньше риск акромегалии', evidenceLevel: 'C' },
          { substanceId: 'octreotide', name: 'Октреотид (аналог соматостатина)', type: 'pharma', dose: 'ТОЛЬКО по назначению эндокринолога', mechanism: '↓ секреция GH из гипофиза', evidenceLevel: 'A' },
        ],
        expectations: [
          { timeline: 'Немедленно', effect: 'Первые признаки акромегалии → СНИЗИТЬ дозу GH. Не ждать.', sideNote: 'Рост костей НЕОБРАТИМ. То, что выросло — останется навсегда.' },
          { timeline: '1-3 мес', effect: 'Нормализация IGF-1 → остановка прогрессии', sideNote: 'Уже выросшие кости не уменьшатся. Только хирургическая коррекция.' },
          { timeline: 'Постоянно', effect: 'GH безопасен только при IGF-1 в пределах возрастной нормы. Всё что выше — акромегалия.', sideNote: 'GH ≠ "фонтан молодости". GH в высоких дозах = гарантированная акромегалия через годы.' },
        ],
      },
    ],
  },
  {
    id: 'cholestatic_itch', symptom: 'Кожный зуд без сыпи / "печёночный зуд"', category: 'hepatic',
    urgency: 'critical', linkedDrugs: ['all_orals', 'oxymetholone', 'stanozolol'],
    relatedSymptoms: ['liver_pain', 'jaundice'],
    quickFacts: ['Характерен для холестаза', 'Зуд усиливается ночью, на ладонях и стопах', 'Причина: накопление желчных кислот в коже'],
    generalInfo: 'Кожный зуд без сыпи ("печёночный зуд") — классический симптом холестаза. Причина: накопление желчных кислот (особенно литохолевой) в коже при нарушении их экскреции. Усиливается ночью, часто начинается с ладоней и стоп. На курсе ААС — красный флаг печёночной патологии, требующий немедленного обследования.',
    problems: [
      {
        problem: 'Холестатический зуд (накопление желчных кислот в коже)', probability: 'medium',
        mechanism: 'Блокада BSEP (17α-алкилированные ААС) → ↓ экскреция желчных кислот → ↑ их концентрация в крови → депонирование в коже → активация PAR-2 рецепторов в нервных окончаниях → зуд. + ↑ опиоидный тонус (центральный механизм зуда). ГГТ + ЩФ — первые маркеры.',
        labMarkers: [
          { marker: 'ГГТ', expectedChange: '↑↑', targetRange: '<55 Ед/л', when: 'НЕМЕДЛЕННО' },
          { marker: 'ЩФ', expectedChange: '↑↑', targetRange: '<150 Ед/л', when: 'НЕМЕДЛЕННО' },
          { marker: 'Желчные кислоты сыворотки', expectedChange: '↑', targetRange: '<10 мкмоль/л', when: 'При ↑ ГГТ + зуд' },
          { marker: 'Билирубин общий + прямой', expectedChange: '↔', targetRange: 'Общий <21, прямой <5', when: 'НЕМЕДЛЕННО' },
          { marker: 'УЗИ печени', expectedChange: '↔', targetRange: 'Без обструкции', when: 'НЕМЕДЛЕННО' },
        ],
        solutions: [
          { substanceId: 'stop_orals', name: 'НЕМЕДЛЕННАЯ ОТМЕНА ор. ААС', type: 'lifestyle', dose: '—', mechanism: 'Устранение причины холестаза', evidenceLevel: 'A' },
          { substanceId: 'tudca', name: 'TUDCA', type: 'supplement', dose: '1000-1500 мг/сут', mechanism: '↑ BSEP → ↑ экскреция желчных кислот → ↓ зуд', evidenceLevel: 'A' },
          { substanceId: 'cholestyramine', name: 'Холестирамин (секвестрант ЖК)', type: 'pharma', dose: '4-8 г 2×/день (по назначению врача)', mechanism: 'Связывает желчные кислоты в кишечнике → ↓ энтерогепатическая циркуляция', evidenceLevel: 'A' },
          { substanceId: 'antihistamine', name: 'Антигистаминные (слабо эффективны)', type: 'pharma', dose: 'По инструкции', mechanism: 'Частичное ↓ зуда (не влияют на причину — желчные кислоты)', evidenceLevel: 'C' },
          { substanceId: 'nac', name: 'NAC', type: 'supplement', dose: '2400 мг/сут', mechanism: 'Гепатопротекция', evidenceLevel: 'B' },
        ],
        expectations: [
          { timeline: '24-48 ч', effect: 'TUDCA 1000 мг + отмена ААС: начало ↓ ГГТ, ↓ зуд через 2-3 дня', sideNote: 'Зуд может временно УСИЛИТЬСЯ в первые 24 ч отмены (rebound-эффект)' },
          { timeline: '1-2 нед', effect: 'Нормализация ГГТ, полное исчезновение зуда', sideNote: 'Если зуд сохраняется >2 нед после отмены — исключить первичный билиарный холангит (AMA)' },
          { timeline: 'Немедленно', effect: 'Зуд + тёмная моча + желтушность = тяжёлый холестаз. СРОЧНО к врачу.', sideNote: 'Не чесать — повреждение кожи → инфекция. Облегчение: прохладный душ, ментоловый крем' },
        ],
      },
    ],
  },
  {
    id: 'anadrol_appetite_kill', symptom: 'Полная потеря аппетита на оксиметолоне / невозможность есть', category: 'gastrointestinal',
    urgency: 'warning', linkedDrugs: ['oxymetholone'],
    relatedSymptoms: ['appetite_loss', 'nausea', 'liver_pain'],
    quickFacts: ['Патогномоничный симптом оксиметолона', 'Частота: 60-80% пользователей', 'Механизм: гепатотоксичность + центральная анорексия'],
    generalInfo: 'Оксиметолон (Анадрол) — наиболее токсичный для печени пероральный ААС. Потеря аппетита на нём настолько характерна, что является ожидаемым, а не неожиданным эффектом. Причина: мощная гепатотоксичность (АЛТ часто >100 через 2-3 нед) + центральный анорексигенный эффект (через TNF-α и другие цитокины). Результат: не можешь есть на самом анаболическом препарате → парадокс анадрола.',
    problems: [
      {
        problem: 'Оксиметолон-индуцированная гепатотоксическая анорексия', probability: 'high',
        mechanism: 'Оксиметолон — 17α-алкилированный + обладает прямым митохондриальным токсическим действием на гепатоциты → АЛТ ↑ >100 Ед/л за 2-3 нед → "больная печень" сигнализирует в ЦНС (через блуждающий нерв и цитокины) → анорексия. + Оксиметолон ↑ TNF-α → воспаление → анорексия.',
        labMarkers: [
          { marker: 'АЛТ, АСТ', expectedChange: '↑↑', targetRange: '<40 Ед/л', when: 'Каждые 1-2 нед на оксиметолоне!' },
          { marker: 'ГГТ, ЩФ', expectedChange: '↑', targetRange: '<55, <150', when: 'Каждые 2 нед' },
        ],
        solutions: [
          { substanceId: 'stop_anadrol', name: 'ОТМЕНИТЬ оксиметолон', type: 'lifestyle', dose: '—', mechanism: 'Единственный реальный способ восстановить аппетит', evidenceLevel: 'A' },
          { substanceId: 'tudca', name: 'TUDCA', type: 'supplement', dose: '1000 мг/сут (обязательно!)', mechanism: 'Гепатопротекция', evidenceLevel: 'A' },
          { substanceId: 'nac', name: 'NAC', type: 'supplement', dose: '2400 мг/сут', mechanism: 'Детоксикация', evidenceLevel: 'A' },
          { substanceId: 'lower_dose', name: 'Снизить дозу до 50 мг/сут', type: 'lifestyle', dose: '50 мг вместо 100-150 мг', mechanism: 'Меньше гепатотоксичность', evidenceLevel: 'B' },
          { substanceId: 'switch_to_dbol', name: 'Заменить на метандиенон (менее токсичный пероральный)', type: 'pharma', dose: '20-40 мг/сут', mechanism: 'Дианобол менее гепатотоксичен чем Анадрол', evidenceLevel: 'B' },
          { substanceId: 'liquid_calories', name: 'Жидкие калории', type: 'lifestyle', dose: 'Гейнеры, смузи', mechanism: 'Обход анорексии', evidenceLevel: 'C' },
        ],
        expectations: [
          { timeline: '2-3 дня', effect: 'Отмена оксиметолона: аппетит начинает возвращаться', sideNote: 'Не пытаться "перетерпеть" анорексию на Анадроле — это опасно для печени' },
          { timeline: '1-2 нед', effect: 'TUDCA + NAC: ↓ АЛТ, нормализация аппетита', sideNote: 'Анадрол не для всех. 20-40% пользователей не переносят его из-за анорексии' },
          { timeline: 'Немедленно', effect: 'Анадрол без TUDCA/NAC = гарантированная анорексия через 2-3 нед. Всегда с гепатопротекцией.', sideNote: 'Если АЛТ >120 на Анадроле — отменять, не ждать.' },
        ],
      },
    ],
  },
  {
    id: 'clen_shakes', symptom: 'Тремор / дрожание рук / внутренняя дрожь на кленбутероле', category: 'cns',
    urgency: 'warning', linkedDrugs: ['clenbuterol'],
    quickFacts: ['Классический β2-агонист-эффект', 'Дозозависимый: начинается с 40 мкг', 'Толерантность развивается через 1-2 нед'],
    generalInfo: 'Тремор и внутренняя дрожь на кленбутероле — результат β2-адренергической стимуляции скелетных мышц. Кленбутерол активирует β2-рецепторы → ↑ cAMP → ↑ внутриклеточный Ca²⁺ → спонтанные сокращения мышечных волокон → тремор. Это НЕ опасный симптом, а индикатор того, что препарат работает и доза достаточна. Проходит через 1-2 нед (толерантность/десенситизация β2-рецепторов).',
    problems: [
      {
        problem: 'β2-адренергический тремор (кленбутерол)', probability: 'high',
        mechanism: 'Кленбутерол — селективный β2-агонист. β2-рецепторы экспрессируются не только в бронхах, но и в скелетных мышцах (около 30% мышечных волокон). Активация β2 → ↑ cAMP → активация PKA → фосфорилирование Ca²⁺-каналов → ↑ [Ca²⁺]i → спонтанная сократимость → тремор.',
        labMarkers: [
          { marker: 'K⁺ сыворотки', expectedChange: '↓', targetRange: '3.5-5.1 ммоль/л', when: 'Каждые 2-4 нед (кленбутерол ↓ K⁺)' },
          { marker: 'ЧСС', expectedChange: '↑', targetRange: '<90 уд/мин', when: 'Ежедневно' },
        ],
        solutions: [
          { substanceId: 'lower_dose', name: 'Снизить дозу кленбутерола', type: 'lifestyle', dose: 'Старт с 20 мкг, не >120 мкг/сут', mechanism: 'Меньше β2-стимуляции = меньше тремор', evidenceLevel: 'A' },
          { substanceId: 'titration', name: 'Титрация вверх (постепенная)', type: 'lifestyle', dose: '+20 мкг каждые 3 дня', mechanism: 'Постепенная десенситизация → тремор ↓ через 1-2 нед', evidenceLevel: 'B' },
          { substanceId: 'magnesium', name: 'Магния глицинат', type: 'supplement', dose: '400-600 мг/сут', mechanism: '↓ нервно-мышечную возбудимость', evidenceLevel: 'B' },
          { substanceId: 'taurine', name: 'Таурин', type: 'supplement', dose: '3-5 г/сут', mechanism: 'Стабилизация мембран, осмолит (кленбутерол ↑ потери таурина)', evidenceLevel: 'B' },
          { substanceId: 'potassium', name: 'Калия цитрат', type: 'supplement', dose: '1000-3000 мг/сут', mechanism: 'Восполнение K⁺ (кленбутерол ↓ K⁺ через Na⁺/K⁺-ATPазу)', evidenceLevel: 'A' },
        ],
        expectations: [
          { timeline: '1-2 ч', effect: 'Первый приём 40 мкг: тремор пик через 1-2 ч, спад через 3-4 ч', sideNote: 'Это нормально. Тело привыкнет.' },
          { timeline: '1-2 нед', effect: 'Десенситизация β2-рецепторов: тремор значительно ↓ или исчезает', sideNote: 'Это же снижает жиросжигающий эффект — поэтому кленбутерол циклируют (2/2)' },
          { timeline: 'Немедленно', effect: 'Тремор + ЧСС >120 + боль в груди → ПЕРЕДОЗИРОВКА кленбутерола → скорую', sideNote: 'Кленбутерол — не витаминка. Передоз может быть фатальным (аритмия, инфаркт).' },
        ],
      },
    ],
  },
  {
    id: 'masteron_low_e2', symptom: 'Симптомы низкого E2: сухие суставы / треск / потеря либидо (мастерон/примоболан)', category: 'endocrine',
    urgency: 'warning', linkedDrugs: ['masteron', 'ai'],
    relatedSymptoms: ['joint_pain', 'libido_loss', 'hot_flashes'],
    quickFacts: ['Мастерон — природный AI (↓ ароматаза)', 'Примоболан — DHT-производное', 'Низкий E2 = потеря либидо + сухие суставы + депрессия'],
    generalInfo: 'Мастерон (дростанолон) и примоболан (метенолон) — DHT-производные с природной анти-эстрогенной активностью. При высоких дозах вызывают "crushed estrogen": E2 <15 пг/мл → сухие/хрустящие суставы, полная потеря либидо, депрессия, приливы жара. Часто комбинируют с AI "для сухости" → двойной удар по E2 → тяжёлая гипоэстрогения.',
    problems: [
      {
        problem: 'Гипоэстрогения (мастерон + AI)', probability: 'high',
        mechanism: 'Мастерон конкурентно ингибирует ароматазу (более слабо чем анастрозол, но достаточно для ↓ E2 на 20-40%). В комбинации с AI → синергетическое ↓ E2. Результат: E2 <15 пг/мл → ↓ синтез коллагена II → ↓ синовиальная жидкость → боль в суставах. + ↓ нейростероиды → депрессия + потеря либидо.',
        labMarkers: [
          { marker: 'E2 (чувствительный тест)', expectedChange: '↓↓', targetRange: '20-50 пг/мл ♂', when: 'Немедленно' },
          { marker: 'Тестостерон общий', expectedChange: '↔', targetRange: '12.1-34.7 нмоль/л', when: 'Каждые 4 нед' },
        ],
        solutions: [
          { substanceId: 'reduce_masteron', name: '↓ дозу мастерона / примоболана', type: 'lifestyle', dose: '↓ на 50%', mechanism: '↓ ингибирование ароматазы', evidenceLevel: 'A' },
          { substanceId: 'stop_ai', name: 'ОТМЕНИТЬ AI (мастерон + AI = слишком)', type: 'lifestyle', dose: '—', mechanism: 'Мастерон уже ↓ E2. Добавление AI избыточно.', evidenceLevel: 'A' },
          { substanceId: 'add_test', name: '↑ тестостерон (больше субстрата для ароматизации)', type: 'pharma', dose: '+100-200 мг/нед', mechanism: 'Больше T → больше ароматизации → ↑ E2', evidenceLevel: 'B' },
          { substanceId: 'add_dhea', name: 'DHEA', type: 'supplement', dose: '50-100 мг/сут', mechanism: 'Предшественник для синтеза E2', evidenceLevel: 'C' },
          { substanceId: 'collagen_type2', name: 'Коллаген II (UC-II)', type: 'supplement', dose: '40 мг/сут', mechanism: 'Симптоматическая поддержка суставов', evidenceLevel: 'A' },
        ],
        expectations: [
          { timeline: '3-5 дней', effect: 'Снижение дозы AI/мастерона + ↑ T: E2 начинает расти', sideNote: 'E2 вернётся быстрее при использовании тестостерона энантата (больше субстрата для ароматазы)' },
          { timeline: '1-2 нед', effect: 'Восстановление E2 20-50 пг/мл: ↓ боль в суставах, ↑ либидо', sideNote: 'Целевой E2 = 20-50 пг/мл. Не выше — гинекомастия. Не ниже — суставы.' },
          { timeline: 'Немедленно', effect: 'E2 <10 + тяжёлая депрессия + суицидальные мысли → отменить всё, консультация психиатра', sideNote: 'Крашнутый E2 может вызвать тяжёлую депрессию. Это не слабость — это физиология.' },
        ],
      },
    ],
  },
  {
    id: 'hcg_high_e2', symptom: 'Резкое ↑ E2 / гинекомастия на hCG', category: 'endocrine',
    urgency: 'warning', linkedDrugs: ['hcg'],
    relatedSymptoms: ['gynecomastia', 'edema', 'water_retention_face'],
    quickFacts: ['hCG ↑ тестостерон и E2 через ароматизацию', 'E2 ↑ наступает через 24-72 ч после инъекции', 'Решение: добавить микродозу AI (0.25 мг анастрозола 2×/нед)'],
    generalInfo: 'hCG стимулирует клетки Лейдига → ↑ тестостерон. Однако этот тестостерон ароматизируется в E2 в периферических тканях. При дозах >500 МЕ 2×/нед ↑ E2 может быть значительным → гинекомастия, отёки, эмоциональная лабильность. Парадокс: hCG должен улучшать самочувствие, но ↑ E2 может ухудшить.',
    problems: [
      {
        problem: 'hCG-индуцированная гиперэстрогения', probability: 'high',
        mechanism: 'hCG → активация ЛГ-рецептора на клетках Лейдига → ↑ cAMP → ↑ StAR → ↑ синтез тестостерона из холестерина. Тестостерон диффундирует в кровь и ароматизируется в E2. В отличие от инъекционного T, E2 от hCG менее предсказуем и может расти неравномерно.',
        labMarkers: [
          { marker: 'E2', expectedChange: '↑↑', targetRange: '20-50 пг/мл ♂', when: 'Через 48-72 ч после инъекции hCG' },
          { marker: 'Тестостерон общий', expectedChange: '↑', targetRange: '12.1-34.7 нмоль/л', when: 'Одновременно с E2' },
        ],
        solutions: [
          { substanceId: 'micro_ai', name: 'Микродоза AI (0.25 мг анастрозола 2×/нед)', type: 'pharma', dose: '0.25 мг 2×/нед', mechanism: 'Контроль ароматизации тестостерона, произведённого под действием hCG', evidenceLevel: 'A' },
          { substanceId: 'reduce_hcg', name: 'Снизить дозу hCG', type: 'lifestyle', dose: '250 МЕ 2×/нед вместо 500 МЕ', mechanism: 'Меньше стимуляции Лейдига → меньше T → меньше E2', evidenceLevel: 'B' },
          { substanceId: 'zinc', name: 'Цинк', type: 'supplement', dose: '50 мг/сут', mechanism: 'Слабый ингибитор ароматазы', evidenceLevel: 'C' },
          { substanceId: 'dim', name: 'DIM (дииндолилметан)', type: 'supplement', dose: '100-200 мг/сут', mechanism: 'Модуляция метаболизма E2 (2-OH-E1 путь)', evidenceLevel: 'C' },
        ],
        expectations: [
          { timeline: '24-48 ч', effect: 'Анастрозол 0.25 мг: ↓ E2 на 30-50%', sideNote: 'НЕ использовать большие дозы AI с hCG. Цель — не убить E2, а нормализовать.' },
          { timeline: '1-2 нед', effect: 'Стабилизация E2 при правильном балансе hCG + AI', sideNote: 'Индивидуальный баланс: сдавать E2 через 48 ч после hCG, подбирать AI по результату' },
        ],
      },
    ],
  },
  {
    id: 'igf1_joint_swelling', symptom: 'Боль в суставах / пальцах / отёк мягких тканей на IGF-1', category: 'musculoskeletal',
    urgency: 'warning', linkedDrugs: ['igf1', 'gh'],
    relatedSymptoms: ['carpal_tunnel_gh', 'joint_pain'],
    quickFacts: ['IGF-1 более потогенен для суставов чем GH', 'Механизм: пролиферация синовиальной оболочки', 'Проходит при снижении дозы на 30-50%'],
    generalInfo: 'IGF-1 (особенно LR3 и DES) вызывает более выраженные суставные симптомы, чем GH: боль и отёк суставов, особенно межфаланговых (пальцы) и коленных. Причина: IGF-1 напрямую стимулирует пролиферацию хондроцитов и синовиоцитов → гипертрофия синовиальной оболочки → "суставной дискомфорт" (joint ache). Это НЕ деструктивный артрит, а гипертрофия. Проходит при снижении дозы.',
    problems: [
      {
        problem: 'IGF-1-индуцированная гипертрофия синовиальной оболочки суставов', probability: 'high',
        mechanism: 'IGF-1 активирует IGF-1R на хондроцитах и синовиальных фибробластах → ↑ пролиферация → гипертрофия синовиальной оболочки → ↑ внутрисуставная жидкость → отёк и боль. Наиболее чувствительны межфаланговые суставы кистей. Эффект НЕ деструктивный (не разрушает хрящ), а гипертрофический.',
        labMarkers: [
          { marker: 'IGF-1 (если используется вместе с GH)', expectedChange: '↑', targetRange: '<300 нг/мл', when: 'При симптомах' },
          { marker: 'CRP-hs (исключить воспалительный артрит)', expectedChange: '↔', targetRange: '<3 мг/л', when: 'При боли в суставах' },
          { marker: 'Рентген суставов (при хронической боли)', expectedChange: '↔', targetRange: 'Норма', when: 'При длительной боли' },
        ],
        solutions: [
          { substanceId: 'reduce_igf1', name: '↓ дозу IGF-1 на 50%', type: 'lifestyle', dose: 'С 100 мкг до 50 мкг/сут', mechanism: 'Меньше IGF-1R-активации = меньше гипертрофия', evidenceLevel: 'A' },
          { substanceId: 'cycle_igf1', name: 'Циклировать: 4 нед приём / 4 нед отдых', type: 'lifestyle', dose: '4/4', mechanism: 'Периоды отдыха → регрессия синовиальной гипертрофии', evidenceLevel: 'B' },
          { substanceId: 'omega3', name: 'Омега-3', type: 'supplement', dose: '3-4 г/сут', mechanism: '↓ воспаление в суставах (не влияет на гипертрофию)', evidenceLevel: 'B' },
          { substanceId: 'curcumin', name: 'Куркумин', type: 'supplement', dose: '500-1000 мг/сут', mechanism: 'Симптоматическое ↓ боли', evidenceLevel: 'B' },
        ],
        expectations: [
          { timeline: '1-2 нед', effect: '↓ дозы IGF-1: уменьшение отёка и боли в суставах', sideNote: 'Боль и отёк = IGF-1 работает. Но дискомфорт не должен мешать тренировкам.' },
          { timeline: '4 нед', effect: 'Цикл 4/4: 4 нед IGF-1 → 4 нед отдых → восстановление суставов → новый цикл', sideNote: 'Непрерывный IGF-1 >8 нед → хроническая гипертрофия синовии' },
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // РАСШИРЕНИЕ: hematologic / hematological — кровь и гемостаз
  // ═══════════════════════════════════════════════════════════════════

  {
    id: 'polycythemia_aas',
    symptom: 'Эритроцитоз / повышение гематокрита (густая кровь)',
    category: 'hematologic',
    urgency: 'warning',
    linkedDrugs: ['testosterone', 'equipoise', 'anadrol'],
    relatedSymptoms: ['hypertension', 'nosebleeds', 'vision_changes', 'excessive_sweating'],
    quickFacts: [
      'Гематокрит >54% — риск тромбоза, инфаркта, инсульта',
      'Тестостерон ≥300 мг/нед → гематокрит +5-10% от базового',
      ' Equipoise (EQ) — самый сильный эритропоэтический эффект среди ААС',
      'Донорство крови (450 мл) → гематокрит −3-5%',
    ],
    generalInfo: 'Эритроцитоз — характерное осложнение ААС-курса. Повышенный гематокрит увеличивает вязкость крови, ухудшая микроциркуляцию и повышая риск тромбоэмболии.',
    problems: [
      {
        problem: 'ААС-индуцированный эритроцитоз (Hct >52%)',
        probability: 'high',
        mechanism: 'ААС стимулируют эритропоэтин (EPO) через AR-рецепторы почечных клеток. Орал-testosterone и equipoise особенно активны. Повышенная масса эритроцитов → ↑вязкость → ↓микроциркуляция → риск тромбоза.',
        labMarkers: [
          { marker: 'Гематокрит', expectedChange: '↑↑', targetRange: '<52%', when: 'Каждые 4 нед на курсе' },
          { marker: 'Гемоглобин', expectedChange: '↑↑', targetRange: '<180 г/л', when: 'Каждые 4 нед' },
          { marker: 'Эритроциты', expectedChange: '↑↑', targetRange: '<6.0×10¹²/л', when: 'Каждые 4 нед' },
          { marker: 'Ферритин', expectedChange: '↑', targetRange: '<300 мкг/л', when: 'Контроль' },
          { marker: 'Вязкость крови', expectedChange: '↑', targetRange: '<4.5 мПа·с', when: 'При Hct>54%' },
        ],
        solutions: [
          { substanceId: 'phlebotomy', name: 'Кровопускание / донорство', type: 'lifestyle', dose: '450 мл крови → −3-5% Hct (1-2 раза в месяц)', mechanism: 'Прямое снижение массы эритроцитов и вязкости крови', evidenceLevel: 'A' },
          { substanceId: 'aspirin', name: 'Аспирин 81 мг', type: 'pharma', dose: '81 мг/день', mechanism: 'Ингибирование тромбоксан A2 → ↓агрегация тромбоцитов', evidenceLevel: 'B' },
          { substanceId: 'omega3', name: 'Омега-3 ЭПК+ДГК', type: 'supplement', dose: '2-4 г/день', mechanism: '↓вязкость крови, ↑деформируемость эритроцитов', evidenceLevel: 'B' },
          { substanceId: 'grape_seed', name: 'Экстракт косточек винограда', type: 'supplement', dose: '100-200 мг/день', mechanism: 'Антиоксидант, защита эндотелия, ↓оксидация ЛПНП', evidenceLevel: 'C' },
        ],
        expectations: [
          { timeline: 'Сразу после кровопускания', effect: 'Hct −3-5% (донорство 450 мл), улучшение самочувствия' },
          { timeline: '2-4 нед', effect: 'Аспирин 81 мг: ↓риск тромбоза, целевой показатель тромбоцитарной агрегации' },
          { timeline: '8-12 нед', effect: 'Омега-3 4 г/день: ↓вязкость крови на 15-20%' },
        ],
      },
      {
        problem: 'Аномальная вязкость крови (синдром гиперязкости)',
        probability: 'medium',
        mechanism: 'Hct>54% + ↑фибриноген + ↑фактор VIII → синдром гиперязкости → нарушение микроциркуляции → эндотелиальная дисфункция',
        labMarkers: [
          { marker: 'Вязкость крови', expectedChange: '↑↑', targetRange: '<4.5 мПа·с', when: 'При Hct>54%' },
          { marker: 'Фибриноген', expectedChange: '↑', targetRange: '2-4 г/л', when: 'Контроль' },
          { marker: 'D-димер', expectedChange: '↔', targetRange: '<0.5 мкг FEU/мл', when: 'Контроль' },
        ],
        solutions: [
          { substanceId: 'phlebotomy', name: 'Кровопускание', type: 'lifestyle', dose: '450 мл (1-2 раза в месяц до Hct<50%)', mechanism: 'Прямое ↓вязкости', evidenceLevel: 'A' },
          { substanceId: 'nattokinase', name: 'Наттокиназа', type: 'supplement', dose: '2000 FU/день', mechanism: 'Фибринолитик, ↓фибриноген', evidenceLevel: 'C' },
        ],
        expectations: [
          { timeline: '1-2 нед', effect: '↓фибриноген, улучшение микроциркуляции' },
          { timeline: '4 нед', effect: 'Целевое Hct <50%, D-димер в норме' },
        ],
      },
    ],
  },

  {
    id: 'thrombosis_risk_aas',
    symptom: 'Высокий риск тромбоза / склонность к образованию сгустков',
    category: 'hematologic',
    urgency: 'critical',
    linkedDrugs: ['testosterone', 'anadrol', 'trenbolone'],
    relatedSymptoms: ['polycythemia_aas', 'hypertension', 'edema', 'vision_changes'],
    quickFacts: [
      'На ААС риск ВТЭО (венозной тромбоэмболии) возрастает в 2-3 раза',
      'Сочетание ААС + курение + длительный перелёт = критический риск',
      'D-димер >0.5 + отёк ноги — подозрение на ТГВ (нужно УЗИ)',
    ],
    generalInfo: 'Протромботическое состояние — одно из наиболее опасных осложнений ААС. Комбинация эритроцитоза, повышения фактора VIII, фибриногена и подавления фибринолиза создаёт идеальные условия для тромбообразования.',
    problems: [
      {
        problem: 'ААС-индуцированная протромботическая активность',
        probability: 'high',
        mechanism: 'ААС повышают факторы свёртывания VIII и IX, ↑фибриноген, ↓антитромбин III, угнетают фибринолиз через ↑PAI-1. Высокий Hct усиливает стаз. Эстрогенный компонент добавляет риск (через ↑ангиотензиноген).',
        labMarkers: [
          { marker: 'D-димер', expectedChange: '↑', targetRange: '<0.5 мкг FEU/мл', when: 'Контроль,积极探索' },
          { marker: 'Антитромбин III', expectedChange: '↓', targetRange: '80-120%', when: 'Контроль' },
          { marker: 'Фибриноген', expectedChange: '↑', targetRange: '2-4 г/л', when: 'Контроль' },
          { marker: 'Гематокрит', expectedChange: '↑↑', targetRange: '<52%', when: 'Каждые 4 нед' },
          { marker: 'PAI-1', expectedChange: '↑', targetRange: '<20 Ед/мл', when: 'Спец. анализ' },
        ],
        solutions: [
          { substanceId: 'aspirin', name: 'Аспирин (ВАКЗ)', type: 'pharma', dose: '81-100 мг/день (профилактика)', mechanism: '↓TXA2 → ↓агрегация', evidenceLevel: 'A' },
          { substanceId: 'omega3', name: 'Омега-3 (ЭПК+ДГК)', type: 'supplement', dose: '2-4 г/день', mechanism: '↓вязкость крови, ↓фактор VII', evidenceLevel: 'B' },
          { substanceId: 'nattokinase', name: 'Наттокиназа', type: 'supplement', dose: '2000 FU/день (натощак)', mechanism: 'Прямой фибринолитик (→плазмин →лизис фибрина)', evidenceLevel: 'C' },
          { substanceId: 'serrapeptase', name: 'Серрапептаза', type: 'supplement', dose: '60-120 мг SPU/день', mechanism: ' Протеолиз фибрина, ↓вязкость', evidenceLevel: 'C' },
          { substanceId: 'garlic', name: 'Экстракт чеснока (аллицин)', type: 'supplement', dose: '600-1200 мг/день', mechanism: '↓тромбоксан, ↑NO, ↓фактор VIII', evidenceLevel: 'C' },
        ],
        expectations: [
          { timeline: '2-4 нед', effect: 'Аспирин: ↓агрегация тромбоцитов (целевое ВАТ <200)' },
          { timeline: '4-8 нед', effect: 'Омега-3 и наттокиназа: ↓фибриноген на 10-15%' },
          { timeline: 'Курс', effect: 'Поддержание D-димера <0.5 ф.е./мл, антитромбина III >80%' },
        ],
      },
    ],
  },

  {
    id: 'iron_overload_prolonged',
    symptom: 'Перегрузка железом / высокий ферритин (ферритин >300)',
    category: 'hematologic',
    urgency: 'warning',
    linkedDrugs: ['testosterone', 'equipoise', 'anadrol'],
    relatedSymptoms: ['polycythemia_aas', 'liver_pain', 'fatigue'],
    quickFacts: [
      'Хронический ААС-курс + кровопускания без контроля Fe → гемохроматоз',
      'Ферритин >300 + трансферрин >45% — диагностическое правило',
      'Доноры крови (мужчины) имеют ферритин на 30-50% ниже',
    ],
    generalInfo: 'Перегрузка железом — недооценённый риск у ААС-пользователей. Эритропоэз стимулирует абсорбцию железа, а кровопускания могут нарушать баланс.',
    problems: [
      {
        problem: 'Вторичный гемохроматоз',
        probability: 'medium',
        mechanism: 'ААС-эритропоэз → ↑абсорбция железа (через гепсидин-сигнал) → накопление железа в печени, сердце, поджелудочной. Хроническое воспаление также ↑ферритин.',
        labMarkers: [
          { marker: 'Ферритин', expectedChange: '↑↑', targetRange: '30-300 мкг/л', when: 'Каждые 8 нед' },
          { marker: 'Сывороточное железо', expectedChange: '↑', targetRange: '11-30 мкмоль/л', when: 'Контроль' },
          { marker: 'Коэффициент насыщения трансферрина', expectedChange: '↑', targetRange: '<45%', when: 'Контроль' },
          { marker: 'АЛТ', expectedChange: '↑', targetRange: '<40 Ед/л', when: '↑ при накоплении Fe в печени' },
        ],
        solutions: [
          { substanceId: 'phlebotomy_preventive', name: 'Профилактическое кровопускание', type: 'lifestyle', dose: '450 мл каждые 8-12 нед (при ферритине>200)', mechanism: 'Прямое выведение железа', evidenceLevel: 'A' },
          { substanceId: 'ip6', name: 'IP-6 (инозитол гексафосфат)', type: 'supplement', dose: '500-1000 мг/день натощак', mechanism: 'Хелатор железа, ↓абсорбция', evidenceLevel: 'C' },
        ],
        expectations: [
          { timeline: '4-8 нед', effect: '↓ферритин на 30-50% (кровопускание + IP-6)' },
          { timeline: '12 нед', effect: 'Целевой ферритин 50-150 мкг/л, нормализация АЛТ' },
        ],
      },
    ],
  },

  {
    id: 'leukocytosis_aas',
    symptom: 'Лейкоцитоз на курсе (↑ лейкоциты без инфекции)',
    category: 'hematologic',
    urgency: 'standard',
    linkedDrugs: ['testosterone', 'trenbolone', 'anadrol'],
    relatedSymptoms: ['injection_pain', 'excessive_sweating', 'fatigue'],
    quickFacts: [
      'ААС повышают лейкоциты на 2-5×10⁹/л (без инфекции)',
      'Повышение >15×10⁹/л — искать скрытое воспаление',
      'Стеройдный лейкоцитоз = нейтрофильный IL-6 опосредованный',
    ],
    generalInfo: 'Лейкоцитоз на ААС-курсе — обычное явление. Может быть прямым эффектом ААС (↑IL-6, ↑нейтрофилы) или признаком скрытой инфекции (абсцесс, инъекционная реакция). Важно дифференцировать.',
    problems: [
      {
        problem: 'Реактивный стероидный лейкоцитоз',
        probability: 'high',
        mechanism: 'ААС стимулируют продукцию IL-6 и G-CSF → ↑выход нейтрофилов из костного мозга, ↓апоптоз. Тренболон особенно активен.',
        labMarkers: [
          { marker: 'Лейкоциты', expectedChange: '↑', targetRange: '4-10×10⁹/л', when: 'Контроль' },
          { marker: 'Нейтрофилы', expectedChange: '↑', targetRange: '47-72%', when: 'Лейкоформула' },
          { marker: 'СРБ', expectedChange: '↔', targetRange: '<5 мг/л', when: 'Дифференциальная диагностика' },
        ],
        solutions: [
          { substanceId: 'omega3', name: 'Омега-3 ЭПК+ДГК', type: 'supplement', dose: '2-4 г/день', mechanism: '↓фактора воспаления (IL-6, TNF-α)', evidenceLevel: 'B' },
          { substanceId: 'curcumin', name: 'Куркумин', type: 'supplement', dose: '500-1000 мг/день (с пиперином)', mechanism: '↓NF-κB → ↓провоспалительные цитокины', evidenceLevel: 'B' },
        ],
        expectations: [
          { timeline: '4-8 нед', effect: 'Стеройдный лейкоцитоз проходит, нормализация >4 нед после курса' },
        ],
      },
      {
        problem: 'Скрытая инфекция / инъекционный абсцесс',
        probability: 'medium',
        mechanism: 'Нестерильные инъекции, повреждение сосуда → локальное воспаление. Лейкоциты >15×10⁹ + СРБ↑ + температура → искать источник.',
        labMarkers: [
          { marker: 'Лейкоциты', expectedChange: '↑↑', targetRange: '4-10×10⁹/л', when: 'Контроль' },
          { marker: 'СРБ', expectedChange: '↑↑', targetRange: '<5 мг/л', when: 'Дифференциальная диагностика' },
          { marker: 'Прокальцитонин', expectedChange: '↑↑', targetRange: '<0.5 нг/мл', when: 'При подозрении на сепсис' },
        ],
        solutions: [
          { substanceId: 'doc_consult', name: 'Консультация хирурга', type: 'lifestyle', dose: 'Срочно (при лейкоцитах >15 + temp >38)', mechanism: 'Диагностика + антибиотик', evidenceLevel: 'A' },
        ],
        expectations: [
          { timeline: 'Срочно', effect: 'Физикальное обследование + УЗИ области инъекций' },
        ],
      },
    ],
  },

  {
    id: 'hematoma_easy',
    symptom: 'Лёгкое образование синяков / повышенная кровоточивость',
    category: 'hematologic',
    urgency: 'standard',
    linkedDrugs: ['testosterone', 'aspirin', 'omega3'],
    relatedSymptoms: ['nosebleeds', 'thrombosis_risk_aas'],
    quickFacts: [
      'Сочетание ААС+Аспирин+Омега-3 — повышенный риск кровотечения',
      'Гематомы без травмы — проверить коагулограмму',
      'Снижение тромбоцитов <100×10⁹/л — сигнал',
    ],
    generalInfo: 'Повышенная кровоточивость на курсе может быть следствием комбинации препаратов, снижающих свёртываемость, либо симптомом нарушения тромбоцитарного звена.',
    problems: [
      {
        problem: 'Медикаментозная гипокоагуляция',
        probability: 'high',
        mechanism: 'Сочетание: Аспирин (↓TXA2) + Омега-3 (↓фактор VII) + наттокиназа (фибринолиз) → компрометация гемостаза. У ААС-пользователей часто возникает дисбаланс.',
        labMarkers: [
          { marker: 'Тромбоциты', expectedChange: '↓', targetRange: '150-400×10⁹/л', when: 'Контроль' },
          { marker: 'МНО', expectedChange: '↑', targetRange: '0.8-1.2', when: 'При приёме антикоагулянтов' },
          { marker: 'АЧТВ', expectedChange: '↑', targetRange: '25-35 сек', when: 'Контроль' },
        ],
        solutions: [
          { substanceId: 'adjust_antiplatelet', name: 'Коррекция дозы антиагрегантов', type: 'lifestyle', dose: 'Снизить аспирин до 81 мг или отменить', mechanism: 'Баланс риск/польза', evidenceLevel: 'A' },
          { substanceId: 'vitamin_k2', name: 'Витамин K2 (МК-7)', type: 'supplement', dose: '45-90 мкг/день', mechanism: 'Кофактор факторов свёртывания II, VII, IX, X', evidenceLevel: 'C' },
        ],
        expectations: [
          { timeline: '2-4 нед', effect: 'Нормализация коагулограммы, ↓синяков' },
        ],
      },
    ],
  },

  {
    id: 'platelet_drop',
    symptom: 'Тромбоцитопения (низкие тромбоциты <150)',
    category: 'hematologic',
    urgency: 'warning',
    linkedDrugs: ['testosterone', 'anadrol'],
    relatedSymptoms: ['hematoma_easy', 'nosebleeds'],
    quickFacts: [
      'Тромбоциты <100×10⁹/л — риск спонтанного кровотечения',
      'Орал-test 17α-алкил может угнетать мегакариоциты',
      'ААС + ВИЧ/гепатит — частая причина вторичной тромбоцитопении',
    ],
    generalInfo: 'Снижение тромбоцитов может быть следствием миелосупрессии (17α-алкилы), иммунной деструкции (ИТП), или вторичным (сепсис, печень). Требуется гематологическая оценка.',
    problems: [
      {
        problem: 'ААС-индуцированная миелосупрессия',
        probability: 'low',
        mechanism: '17α-алкилированные оральные ААС угнетают мегакариоцитарный ряд в костном мозге. Высокие дозы длительно → апластический риск.',
        labMarkers: [
          { marker: 'Тромбоциты', expectedChange: '↓↓', targetRange: '150-400×10⁹/л', when: 'Каждые 4 нед' },
          { marker: 'Лейкоциты', expectedChange: '↓', targetRange: '4-10×10⁹/л', when: 'Контроль' },
          { marker: 'Гемоглобин', expectedChange: '↓', targetRange: '>130 г/л', when: 'Контроль' },
        ],
        solutions: [
          { substanceId: 'reduce_aas', name: 'Снизить дозу или сменить орал на инъекцию', type: 'lifestyle', dose: 'Testosterone инж. (no 17α-alkyl)', mechanism: 'Устранить гепатотоксичный агент', evidenceLevel: 'A' },
          { substanceId: 'b12_folate', name: 'B12 + Фолат', type: 'supplement', dose: 'B12 1000 мкг/нед + Фолат 400 мкг/день', mechanism: 'Стимуляция кроветворения', evidenceLevel: 'C' },
        ],
        expectations: [
          { timeline: '4-8 нед', effect: 'Восстановление тромбоцитов после отмены 17α-алкила' },
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // РАСШИРЕНИЕ: renal — почки и мочевыделительная
  // ═══════════════════════════════════════════════════════════════════

  {
    id: 'proteinuria_aas',
    symptom: 'Протеинурия (белок в моче)',
    category: 'renal',
    urgency: 'warning',
    linkedDrugs: ['testosterone', 'trenbolone', 'anadrol', 'insulin'],
    relatedSymptoms: ['foamy_urine', 'edema', 'hypertension'],
    quickFacts: [
      ' Микроальбуминурия 30-300 мг/сут — ранний маркер повреждения',
      'Протеинурия >1 г/сут — нужна нефрологическая оценка',
      'ААС↑мышечную массу → ↑креатинин (норма до 110 мкмоль/л, но "мышечная" — до 130)',
    ],
    generalInfo: 'Протеинурия у ААС-пользователей может быть следствием гломерулярной гипертензии, повышенной мышечной массы или коморбидности (гипертония, диабет). Требуется дифференциальная диагностика.',
    problems: [
      {
        problem: 'ААС-индуцированная гломерулярная гиперфильтрация',
        probability: 'high',
        mechanism: 'ААС повышают мышечную массу → ↑креатинин → ↑С小球ная фильтрация (GFR) → гломерулярная гипертензия → микроальбуминурия. Симпато-адреналовая активация + ↑АД вносят вклад.',
        labMarkers: [
          { marker: 'Микроальбуминурия', expectedChange: '↑', targetRange: '<30 мг/сут', when: 'Каждые 8 нед' },
          { marker: 'Креатинин', expectedChange: '↑', targetRange: '70-110 мкмоль/л', when: 'Контроль' },
          { marker: 'Расчётная СКФ (eGFR)', expectedChange: '↔ или ↑', targetRange: '>60 мл/мин/1.73м²', when: 'Контроль' },
          { marker: 'Мочевина', expectedChange: '↑', targetRange: '2.5-8.3 ммоль/л', when: 'Контроль' },
        ],
        solutions: [
          { substanceId: 'telmisartan', name: 'Телмисартан', type: 'pharma', dose: '40-80 мг/день', mechanism: 'Блокада АТ1- рецепторов, ↓внутригломерулярная гипертензия, антипротеинурический эффект', evidenceLevel: 'A' },
          { substanceId: 'omega3', name: 'Омега-3', type: 'supplement', dose: '2-4 г/день', mechanism: '↓воспаления клубочков, ↓код Libertiesного давления', evidenceLevel: 'B' },
        ],
        expectations: [
          { timeline: '4-8 нед', effect: 'Телмисартан: ↓протеинурии на 30-40%' },
          { timeline: '8-12 нед', effect: 'Нормализация микроальбуминурии <30 мг/сут' },
        ],
      },
      {
        problem: 'Рабдомиолиз-индуцированное повреждение почек',
        probability: 'low',
        mechanism: 'Экстремальные тренировки + ААС → рабдомиолиз → миоглобинемия → острое тубулярное повреждение. Чаще с тяжёлыми тренировками ног.',
        labMarkers: [
          { marker: 'КФК (креатинфосфокиназа)', expectedChange: '↑↑↑', targetRange: '<200 Ед/л (тяж.рабдомиолиз >5000)', when: 'При подозрении' },
          { marker: 'Миоглобин', expectedChange: '↑↑', targetRange: '<70 нг/мл', when: 'При подозрении' },
          { marker: 'Креатинин', expectedChange: '↑↑', targetRange: 'Контроль', when: 'Контроль' },
        ],
        solutions: [
          { substanceId: 'hydration', name: 'Внутривенные жидкости', type: 'lifestyle', dose: 'Срочно (при рабдомиолизе)', mechanism: '↑диурез, выведение миоглобина', evidenceLevel: 'A' },
        ],
        expectations: [
          { timeline: 'Срочно', effect: 'Госпитализация, при КФК >5000 + олигурия' },
        ],
      },
    ],
  },

  {
    id: 'renal_stones_risk',
    symptom: 'Риск почечных камней (мочекаменная болезнь)',
    category: 'renal',
    urgency: 'standard',
    linkedDrugs: ['testosterone', 'anadrol', 'calcium_supplements'],
    relatedSymptoms: ['kidney_pain', 'foamy_urine', 'back_pumps'],
    quickFacts: [
      'ААС повышают фильтрацию Ca, уратов → риск камней',
      'Высокобелковая диета ↑кислотную нагрузку → Rakal',
      'Гипергидратация (3-4 л/день) — простая профилактика',
    ],
    generalInfo: 'ААС-пользователи входят в группу риска мочекаменной болезни из-за повышенной мышечной массы → ↑креатинина, ↓цитрата (ингибитора кристаллизации), ↑кальция, ↑уратов.',
    problems: [
      {
        problem: 'ААС + диета-индуцированный нефролитиаз',
        probability: 'medium',
        mechanism: 'Высокий белок →↑кислотная нагрузка →↓цитрат мочи (естественный ингибитор). ↑Кальций диета + ↑оксалаты шпината → кальций-оксалатные камни.',
        labMarkers: [
          { marker: 'Кальций мочи', expectedChange: '↑', targetRange: '<4.0 мг/кг/сут', when: '24ч сбор' },
          { marker: 'Мочевая кислота мочи', expectedChange: '↑', targetRange: '<750 мг/сут', when: '24ч сбор' },
          { marker: 'Цитрат мочи', expectedChange: '↓', targetRange: '>320 мг/сут', when: '24ч сбор' },
          { marker: 'pH мочи', expectedChange: '↓', targetRange: '6.0-7.0', when: 'Контроль' },
        ],
        solutions: [
          { substanceId: 'potassium_citrate', name: 'Калия цитрат', type: 'supplement', dose: '60 мЭкв/день (10-20 мЭкв 3р)', mechanism: '↑цитрат мочи (ингибитор), подщелачивание', evidenceLevel: 'A' },
          { substanceId: 'magnesium', name: 'Магний цитрат', type: 'supplement', dose: '400-600 мг/день', mechanism: '↑магний мочи (ингибитор оксалат)', evidenceLevel: 'B' },
          { substanceId: 'hydration', name: 'Гидратация', type: 'lifestyle', dose: '3-4 л/день воды', mechanism: '↑диурез, ↓концентрация солей', evidenceLevel: 'A' },
        ],
        expectations: [
          { timeline: '4-8 нед', effect: '↑цитрат мочи, ↓кальций мочи' },
          { timeline: '12 нед', effect: 'pH мочи >6.0, сниженный риск камнеобразования' },
        ],
      },
    ],
  },

  {
    id: 'nocturia_aas',
    symptom: 'Никтурия (частые ночные мочеиспускания)',
    category: 'renal',
    urgency: 'standard',
    linkedDrugs: ['testosterone', 'gh', 'insulin'],
    relatedSymptoms: ['edema', 'sleep_apnea_signs', 'foamy_urine'],
    quickFacts: [
      'Никтурия >2 раз/ночь — патологическая',
      'Часто связана с периферическими отёками (мобилизация ночью)',
      ' GH может ↓почечную концентрационную способность',
    ],
    generalInfo: 'Никтурия — распространённый, но игнорируемый симптом. У ААС-пользователей часто связана с задержкой жидкости, перераспределением отёков ночью или увеличением простаты.',
    problems: [
      {
        problem: 'Перераспределение отёков в ночное время',
        probability: 'high',
        mechanism: 'Днём вертикальное положение → отёки ног. Ночью горизонтальное → мобилизация жидкости → диурез. GH усугубляет через задержку натрия.',
        labMarkers: [
          { marker: 'Натрий мочи', expectedChange: '↑', targetRange: '40-220 ммоль/сут', when: 'Контроль' },
          { marker: 'Сут. диурез', expectedChange: '↑', targetRange: '1-2 л/сут', when: 'Дневник мочеиспускания' },
          { marker: 'Креатинин', expectedChange: '↔', targetRange: 'Контроль', when: 'Контроль' },
        ],
        solutions: [
          { substanceId: 'dandelion', name: 'Одуванчик (экстракт)', type: 'supplement', dose: '500 мг утром (не позднее 16:00)', mechanism: 'Мягкий диуретик, днём ↑диурез', evidenceLevel: 'C' },
          { substanceId: 'reduce_salt_evening', name: 'Ограничение Na после 18:00', type: 'lifestyle', dose: '<500 мг за ужином', mechanism: '↓почечная экскреция Na ночью', evidenceLevel: 'B' },
        ],
        expectations: [
          { timeline: '1-2 нед', effect: '↓никтурии до 0-1 раза/ночь' },
        ],
      },
    ],
  },

  {
    id: 'renal_colic_signs',
    symptom: 'Симптомы почечной колики / острая боль в пояснице',
    category: 'renal',
    urgency: 'critical',
    linkedDrugs: ['testosterone', 'diuretics'],
    relatedSymptoms: ['kidney_pain', 'hematuria'],
    quickFacts: [
      ' Острая односторонняя боль + гематурия → подозрение на камень',
      ' Почечная колика — экстренное состояние',
      'Лихорадка + колика = обструкция + инфекция = экстренно',
    ],
    generalInfo: 'Почечная колика — внезапная острая боль в пояснице, иррадиирующая в пах. Может быть камнем, тромбом, или инфекцией. Требует экстренной диагностики.',
    problems: [
      {
        problem: 'Острый нефролитиаз с обструкцией',
        probability: 'medium',
        mechanism: 'Камень блокирует мочеточник → ↑давление в почечной лоханке → острая боль. У ААС-пользователей риск ↑ из-за особенностей диеты и гидратации.',
        labMarkers: [
          { marker: 'Гематурия', expectedChange: '↑↑', targetRange: '<5 эритр/мкл', when: 'Срочно' },
          { marker: 'Лейкоцитурия', expectedChange: '↔ или ↑', targetRange: '<5 лейк/мкл', when: 'Дифференциальная' },
          { marker: 'УЗИ почек', expectedChange: '↑', targetRange: 'Нет конкрементов', when: 'Срочно' },
        ],
        solutions: [
          { substanceId: 'nsaid', name: 'НПВС (декскетопрофен)', type: 'pharma', dose: '25-50 мг (острая боль)', mechanism: '↓простагландина → ↓спазм мочеточника', evidenceLevel: 'A' },
          { substanceId: 'hydration', name: 'Гидратация', type: 'lifestyle', dose: '2-3 л/день', mechanism: 'Промывание мочеточника', evidenceLevel: 'B' },
        ],
        expectations: [
          { timeline: 'Срочно', effect: 'Консультация нефролога/уролога' },
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // РАСШИРЕНИЕ: hepatic — печень и гепатобилиарная
  // ═══════════════════════════════════════════════════════════════════

  {
    id: 'steatosis_aas',
    symptom: 'Стеатоз печени (жировая инфильтрация)',
    category: 'hepatic',
    urgency: 'warning',
    linkedDrugs: ['testosterone', 'trenbolone', 'insulin', 'gh'],
    relatedSymptoms: ['liver_pain', 'cholestatic_itch', 'orals_lethargy'],
    quickFacts: [
      'Стеатоз — частое осложнение ААС + высокобелковой диеты +工会统',
      ' Стеатоз без лечения → стеатогепатит → фиброз → цирроз',
      'УЗИ: гиперэхогенная печень — ранний признак',
    ],
    generalInfo: 'Неалкогольная жировая болезнь печени (НАЖБП) часто развивается у ААС-пользователей из-за инсулинорезистентности, повышенной нагрузки на печень и диеты.',
    problems: [
      {
        problem: 'ААС+инсулин-индуцированная НАЖБП',
        probability: 'high',
        mechanism: 'Инсулинорезистентность + ↑синтез липидов в печени + ↑∫оксидация→↓β-окисление→ накопление триглицеридов. GH снижает липолиз печени, но повышает IGF-1.',
        labMarkers: [
          { marker: 'АЛТ', expectedChange: '↑', targetRange: '<40 Ед/л', when: 'Каждые 4 нед' },
          { marker: 'ГГТ', expectedChange: '↑↑', targetRange: '<55 Ед/л', when: 'Каждые 4 нед' },
          { marker: 'Липидограмма', expectedChange: '↑', targetRange: 'Контроль ТГ', when: 'Каждые 8 нед' },
          { marker: 'УЗИ печени', expectedChange: '↑', targetRange: 'Нет гиперэхогенности', when: 'Каждые 6 мес' },
        ],
        solutions: [
          { substanceId: 'tudca', name: 'TUDCA', type: 'supplement', dose: '500-1000 мг/день', mechanism: 'Снижение ER-стресса, ↑желчеотток', evidenceLevel: 'A' },
          { substanceId: 'nac', name: 'NAC', type: 'supplement', dose: '1200-1800 мг/день', mechanism: '↑GSH, антиоксидантная защита', evidenceLevel: 'A' },
          { substanceId: 'berberine', name: 'Берберин', type: 'supplement', dose: '500 мг 3р/день', mechanism: 'AMPK-активация, ↓инсулинорезистентность', evidenceLevel: 'B' },
          { substanceId: 'milk_thistle', name: 'Силимарин', type: 'supplement', dose: '280-600 мг/день', mechanism: 'Стабилизация мембран, антиоксидант', evidenceLevel: 'B' },
        ],
        expectations: [
          { timeline: '4-8 нед', effect: '↓АЛТ/ГГТ на 20-40%' },
          { timeline: '12 нед', effect: 'УЗИ: улучшение картины, ↓эхогенности' },
        ],
      },
    ],
  },

  {
    id: 'gallbladder_stasis',
    symptom: 'Застой желчи / дискинезия желчного пузыря',
    category: 'hepatic',
    urgency: 'warning',
    linkedDrugs: ['testosterone', 'trenbolon', 'estrogen_blockers'],
    relatedSymptoms: ['cholestatic_itch', 'nausea', 'bloating', 'liver_pain'],
    quickFacts: [
      'ЖКБ (желчекаменная) в 2 раза чаще на курсе ААС + AI',
      'Горечь во рту после жирной пищи — ранний симптом',
      'TUDCA + расторопша — профилактика и лечение',
    ],
    generalInfo: 'Застой желчи (холестаз) — частое осложнение при ААС. 17α-алкилированные ААС угнетают BSEP-насос, жёсткие диеты приводят к густой желчи.',
    problems: [
      {
        problem: 'ААС-индуцированный внутрипечёночный холестаз',
        probability: 'high',
        mechanism: '17α-алкилы угнетают BSEP (bile salt export pump) → накопление жёлчных кислот в гепатоцитах → токсичность → ↑ГГТ, ↑прямой билирубин.',
        labMarkers: [
          { marker: 'ГГТ', expectedChange: '↑↑↑', targetRange: '<55 Ед/л', when: 'Каждые 4 нед' },
          { marker: 'Прямой билирубин', expectedChange: '↑', targetRange: '<5 мкмоль/л', when: 'Контроль' },
          { marker: 'ЩФ', expectedChange: '↑', targetRange: '<150 Ед/л', when: 'Контроль' },
          { marker: 'Жёлчные кислоты', expectedChange: '↑↑', targetRange: '<10 мкмоль/л', when: 'При зуде' },
        ],
        solutions: [
          { substanceId: 'tudca', name: 'TUDCA', type: 'supplement', dose: '500-1000 мг/день', mechanism: 'Гидрофильная жёлчная кислота, улучшает отток', evidenceLevel: 'A' },
          { substanceId: 'artichoke', name: 'Артишок', type: 'supplement', dose: '600 мг 3р/день', mechanism: '↑цинарин → ↑холерез', evidenceLevel: 'B' },
          { substanceId: 'choleretic', name: 'Желчегонные', type: 'lifestyle', dose: 'Овсяные отруби 30 г/день', mechanism: '↑моторика жёлчного пузыря', evidenceLevel: 'C' },
        ],
        expectations: [
          { timeline: '2-4 нед', effect: '↓ГГТ на 20-40%, улучшение пищеварения' },
          { timeline: '4-8 нед', effect: 'Нормализация прямого билирубина, ↓зуда' },
        ],
      },
    ],
  },

  {
    id: 'fluctuating_transaminases',
    symptom: 'Колебания АЛТ/АСТ (неустойчивые показатели)',
    category: 'hepatic',
    urgency: 'standard',
    linkedDrugs: ['testosterone', 'trenbolone', 'winstrol', 'anadrol'],
    relatedSymptoms: ['liver_pain', 'orals_lethargy', 'fatigue'],
    quickFacts: [
      ' АСТ/АЛТ >2 — подозрение на мышечный, а не печёночный источник',
      ' Тренировки за 24-48 ч до анализа могут ↑АСТ/АЛТ на 20-50%',
      ' ГГТ — более специфичный маркер печёночного повреждения',
    ],
    generalInfo: 'Колебания АЛТ/АСТ — обычное явление у спортсменов. Важно дифференцировать мышечный и печёночный источник.',
    problems: [
      {
        problem: 'Мышечный источник (ложная гиперферментемия)',
        probability: 'high',
        mechanism: 'Скелетные мышцы содержат АСТ (больше) и АЛТ (меньше). Тяжёлые тренировки ↑проницаемость мембран → ↑ферменты в крови.',
        labMarkers: [
          { marker: 'АСТ', expectedChange: '↑↑', targetRange: '<40 Ед/л', when: 'Отдых 48ч до анализа' },
          { marker: 'АЛТ', expectedChange: '↑', targetRange: '<40 Ед/л', when: 'Отдых 48ч до анализа' },
          { marker: 'КФК', expectedChange: '↑↑↑', targetRange: '<200 Ед/л', when: 'Дифференциальный маркер' },
          { marker: 'ГГТ', expectedChange: '↔', targetRange: '<55 Ед/л', when: 'Специфичный печёночный' },
        ],
        solutions: [
          { substanceId: 'rest_before_test', name: 'Отдых 48ч перед анализом', type: 'lifestyle', dose: '48-72 ч без тренировок', mechanism: '↓мембранная проницаемость, ↓мышечный вклад', evidenceLevel: 'A' },
        ],
        expectations: [
          { timeline: '48-72 ч', effect: 'Нормализация АСТ/АЛТ, если мышечный источник' },
        ],
      },
      {
        problem: 'Истинное печёночное повреждениe',
        probability: 'medium',
        mechanism: '17α-алкил ААС → гепатотоксичность → ↑АЛТ/ГГТ. Тренболон не肾上-алкил, но тоже негативно влияет.',
        labMarkers: [
          { marker: 'ГГТ', expectedChange: '↑↑', targetRange: '<55 Ед/л', when: 'Каждые 4 нед' },
          { marker: 'Билирубин', expectedChange: '↑', targetRange: '<21 мкмоль/л', when: 'Контроль' },
          { marker: 'АЛТ', expectedChange: '↑↑', targetRange: '<40 Ед/л', when: 'Отдых 48ч' },
        ],
        solutions: [
          { substanceId: 'tudca', name: 'TUDCA', type: 'supplement', dose: '500-1000 мг/день', mechanism: 'Защита гепатоцитов, холерез', evidenceLevel: 'A' },
          { substanceId: 'nac', name: 'NAC', type: 'supplement', dose: '1200-1800 мг/день', mechanism: 'Глутатион-предшественник', evidenceLevel: 'A' },
          { substanceId: 'silymarin', name: 'Силимарин', type: 'supplement', dose: '280 мг/день', mechanism: 'Стабилизация мембран гепатоцитов', evidenceLevel: 'B' },
        ],
        expectations: [
          { timeline: '2-4 нед', effect: '↓АЛТ/ГГТ при отмене/снижении 17α-алкила' },
          { timeline: '6-8 нед', effect: 'Нормализация ферментов при поддержке' },
        ],
      },
    ],
  },

  {
    id: 'ascites_signs',
    symptom: 'Жидкость в брюшной полости (асцит / гепатомегалия)',
    category: 'hepatic',
    urgency: 'critical',
    linkedDrugs: ['testosterone', 'anadrol'],
    relatedSymptoms: ['edema', 'bloating', 'liver_pain'],
    quickFacts: [
      ' Асцит — признак декомпенсации печени / сердца',
      ' НЕ нормальное явление на ААС-курсе',
      ' Экстренная диагностика',
    ],
    generalInfo: 'Асцит — патологическое скопление жидкости в брюшной полости. У ААС-пользователей может быть проявлением цирроза, декомпенсации сердца илиHBV инфекции.',
    problems: [
      {
        problem: 'Цирроз-асцит / лечение-резистентный',
        probability: 'low',
        mechanism: 'Портальная гипертензия + гипоальбуминемия + ↓инактивация альдостерона → задержка Na + воды.',
        labMarkers: [
          { marker: 'Альбумин', expectedChange: '↓↓', targetRange: '>35 г/л', when: 'Срочно' },
          { marker: 'АЛТ/АСТ', expectedChange: '↑↑', targetRange: '<40 Ед/л', when: 'Срочно' },
          { marker: 'ПТИ/МНО', expectedChange: '↑', targetRange: '70-130%', when: 'Срочно' },
          { marker: 'УЗИ брюшной полости', expectedChange: '↑', targetRange: 'Жидкость', when: 'Срочно' },
        ],
        solutions: [
          { substanceId: 'urgent_care', name: 'Срочная госпитализация', type: 'lifestyle', dose: 'Срочно', mechanism: 'Диагностика и лечение первопричины', evidenceLevel: 'A' },
        ],
        expectations: [
          { timeline: 'Срочно', effect: 'Госпитализация в отделение гастроэнтерологии/реанимацию' },
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // РАСШИРЕНИЕ: dermatologic — кожа и дерматология
  // ═══════════════════════════════════════════════════════════════════

  {
    id: 'steroid_acne_cystic',
    symptom: 'Кистозные угри / конглобатные акне на курсе',
    category: 'dermatologic',
    urgency: 'warning',
    linkedDrugs: ['testosterone', 'trenbolone', 'anadrol', 'winstrol'],
    relatedSymptoms: ['acne', 'hair_loss', 'excessive_sweating'],
    quickFacts: [
      'ААС-акне отличается от обычного: кистозное, на спине/плечах',
      'Высокая доза тестостерона → ↑DHT → ↑себум → Propionibacterium acnes',
      'Изотретиноин (Роаккутан) — золотой стандарт, но hepatotoxic',
    ],
    generalInfo: 'ААС-индуцированное акне — тяжёлая форма, часто кистозная, оставляет рубцы. Основной механизм — ↑себорегуляция через DHT.',
    problems: [
      {
        problem: 'DHT-индуцированная гиперсекреция себума',
        probability: 'high',
        mechanism: '↑Testosterone → ↑DHT (через 5α-редуктазу) в сальных железах → ↑секреция себума + гиперкератинизация фолликула → колонизация P. acnes → воспаление',
        labMarkers: [
          { marker: 'Тестостерон', expectedChange: '↑↑↑', targetRange: '20-35 нмоль/л', when: 'Контроль' },
          { marker: 'DHT', expectedChange: '↑↑', targetRange: '0.4-2.5 нмоль/л', when: 'Спец. анализ' },
        ],
        solutions: [
          { substanceId: 'isotretinoin', name: 'Изотретиноин', type: 'pharma', dose: '0.5-1 мг/кг/день (под контролем АЛТ/АСТ)', mechanism: '↓себум, ↓размер сальных желез, ↑дифференциация', evidenceLevel: 'A' },
          { substanceId: 'finasteride', name: 'Финастерид', type: 'pharma', dose: '1-5 мг/день (топическое)', mechanism: '↓5α-редуктаза → ↓DHT', evidenceLevel: 'B' },
          { substanceId: 'zinc', name: 'Цинк пиколинат', type: 'supplement', dose: '30-50 мг/день', mechanism: '↓5α-редуктаза, ↓воспаление', evidenceLevel: 'B' },
          { substanceId: 'saw_palmetto', name: 'Со пальметто', type: 'supplement', dose: '320 мг/день', mechanism: '↓5α-редуктаза, ↓DHT-синтез', evidenceLevel: 'C' },
        ],
        expectations: [
          { timeline: '4-8 нед', effect: 'Изотретиноин: ↓Sebum на 90%, видимое улучшение акне' },
          { timeline: '8-16 нед', effect: 'Цинк + финастерид: ↓воспаление, ↓кистозование' },
          { timeline: '4-6 мес', effect: 'Изотретиноин: длительная ремиссия' },
        ],
      },
    ],
  },

  {
    id: 'androgenetic_baldness_acute',
    symptom: 'Острое выпадение волос по андрогенетическому типу',
    category: 'dermatologic',
    urgency: 'warning',
    linkedDrugs: ['testosterone', 'trenbolone', 'winstrol', 'masteron'],
    relatedSymptoms: ['hair_loss', 'acne', 'prostate_issues'],
    quickFacts: [
      'DHT-чувствительные фолликулы височно-теменной области → миниатюризация',
      'Острое выпадение на курсе — чаще телогеновый сброс (stress + DHT)',
      'Финастерид/дутастерид — частичная защита, но не полная',
    ],
    generalInfo: 'Андрогенетическая алопеция acceleratedААС — типичная проблема. DHT — ключевой медиатор через AR-рецепторы фолликулов.',
    problems: [
      {
        problem: 'DHT-миниатюризация волосяных фолликулов',
        probability: 'high',
        mechanism: 'DHT→AR в фолликулах → миниатюризация → ↓фаза анагена, ↑фаза телогена → выпадение. Генетическая предрасположенность (AR gene CAG repeat) определяет риск.',
        labMarkers: [
          { marker: 'DHT', expectedChange: '↑↑', targetRange: '0.4-2.5 нмоль/л', when: 'Спец. анализ' },
          { marker: 'Тестостерон', expectedChange: '↑↑', targetRange: 'Баланс', when: 'Контроль' },
        ],
        solutions: [
          { substanceId: 'finasteride', name: 'Финастерид', type: 'pharma', dose: '1 мг/день', mechanism: '↓5α-редуктаза II → ↓DHT на 70%', evidenceLevel: 'A' },
          { substanceId: 'dutasteride', name: 'Дутастерид', type: 'pharma', dose: '0.5 мг/день', mechanism: '↓5α-редуктаза I+II → ↓DHT на 90%', evidenceLevel: 'A' },
          { substanceId: 'minoxidil', name: 'Миноксидил 5%', type: 'pharma', dose: '2р/день на кожу головы', mechanism: '↑кровоток, ↑фаза анагена', evidenceLevel: 'A' },
          { substanceId: 'ketoconazole', name: 'Кетоконазол шампунь 2%', type: 'pharma', dose: '2-3р/нед', mechanism: '↓андрогенный стимул кожи головы', evidenceLevel: 'B' },
          { substanceId: 'saw_palmetto', name: 'Со пальметто', type: 'supplement', dose: '320 мг/день', mechanism: '↓5α-редуктаза', evidenceLevel: 'C' },
          { substanceId: 'biotin', name: 'Биотин', type: 'supplement', dose: '5000-10000 мкг/день', mechanism: 'Кофактер кератин-синтеза', evidenceLevel: 'C' },
        ],
        expectations: [
          { timeline: '3-6 мес', effect: 'Финастерид: остановка выпадения, ↑плотность' },
          { timeline: '6-12 мес', effect: 'Миноксидил: ↑рост новых волос' },
          { timeline: '12-24 мес', effect: 'Полный результат комбинации, медленно при отмене' },
        ],
      },
    ],
  },

  {
    id: 'stretch_marks_rapid',
    symptom: 'Растяжки (стрии) от быстрого роста мышц',
    category: 'dermatologic',
    urgency: 'standard',
    linkedDrugs: ['testosterone', 'gh', 'insulin'],
    relatedSymptoms: ['water_retention_face', 'acromegaly_signs'],
    quickFacts: [
      ' Стрии — разрыв дермы при быстром растяжении',
      'Локализация: плечи, грудь, бёдра, живот',
      'Профилактика: увлажнение кожи, постепенный рост массы',
    ],
    generalInfo: 'Растяжки — естественное следствие быстрого увеличения объема. На курсе ААС + GH ускоряется рост, и кожа не успевает адаптироваться.',
    problems: [
      {
        problem: 'Быстрое растяжение кожи с разрывом дермы',
        probability: 'high',
        mechanism: '↑Объём мышц → растяжение кожи → разрыв коллагеновых/эластиновых волокон → рубцовая ткань (стрии). Cortisol ↑ из тренировочного стресса усугубляет.',
        labMarkers: [
          { marker: 'Кортизол', expectedChange: '↔', targetRange: 'Контроль', when: 'Не специфичный' },
        ],
        solutions: [
          { substanceId: 'vitamin_c', name: 'Витамин C', type: 'supplement', dose: '500-1000 мг/день', mechanism: 'Кофактор синтеза коллагена', evidenceLevel: 'B' },
          { substanceId: 'collagen_peptides', name: 'Коллаген пептиды', type: 'supplement', dose: '10-15 г/день', mechanism: 'Субстрат синтеза коллагена', evidenceLevel: 'C' },
          { substanceId: 'vitamin_e', name: 'Витамин E', type: 'supplement', dose: '200-400 МЕ/день (топически)', mechanism: 'Увлажнение + антиоксидант', evidenceLevel: 'C' },
          { substanceId: 'topic_hydratation', name: 'Увлажнение кожи', type: 'lifestyle', dose: '2р/день (лосьон)', mechanism: '↑эластичность эпидермиса', evidenceLevel: 'C' },
          { substanceId: 'retinoid', name: 'Ретиноиды 0.1% (тропически)', type: 'pharma', dose: 'Каждый 2-й день на стрии', mechanism: '↑коллаген, ↓рубцовая окраска', evidenceLevel: 'A' },
        ],
        expectations: [
          { timeline: '3-6 мес', effect: 'Ретиноиды: осветление стрий, ↑коллаген' },
          { timeline: 'Постоянная профилактика', effect: 'Увлажнение + витамин C: ↓появление новых' },
        ],
      },
    ],
  },

  {
    id: 'hirsutism_women',
    symptom: 'Вирилизация / гирсутизм (у женщин на курсе)',
    category: 'dermatologic',
    urgency: 'critical',
    linkedDrugs: ['testosterone', 'trenbolone', 'winstrol', 'anavar'],
    relatedSymptoms: ['hair_loss', 'voice_changes'],
    quickFacts: [
      ' Женщины: 5-10 мг анавар = риск вирилизации',
      ' Огрубение голоса НЕ обратимо',
      ' Клиторомегалия >2 см — необратимо',
    ],
    generalInfo: 'Вирилизация у женщин — критическое осложнение ААС. Некоторые эффекты необратимы (огрубение голоса, клиторомегалия, облысение). Раннее обнаружение и отмена критичны.',
    problems: [
      {
        problem: 'Андроген-индуцированная вирилизация (женщины)',
        probability: 'high',
        mechanism: ' ↑Testosterone/DHT → AR в волосяных фолликулах (лицо/тело), голосовых связках, клиторе → необратимые эффекты. Широкий диапазон ответа в зависимости от генетики.',
        labMarkers: [
          { marker: 'Тестостерон общий', expectedChange: '↑↑↑', targetRange: '0.5-2.6 нмоль/л (жен.)', when: 'Контроль на курсе' },
          { marker: 'DHT', expectedChange: '↑↑', targetRange: '0.05-0.3 нмоль/л (жен.)', when: 'Спец.' },
          { marker: 'Андростендион', expectedChange: '↑', targetRange: '<10 нмоль/л', when: 'При вирилизации' },
        ],
        solutions: [
          { substanceId: 'stop_aas', name: 'НЕМЕДЛЕННАЯ отмена ААС', type: 'lifestyle', dose: 'Сразу', mechanism: '↓андрогенный стимул', evidenceLevel: 'A' },
          { substanceId: 'spironolactone', name: 'Спиронолактон', type: 'pharma', dose: '50-100 мг/день', mechanism: 'Антиандрогенный эффект', evidenceLevel: 'B' },
        ],
        expectations: [
          { timeline: '1-4 нед после отмены', effect: '↓Тестостерона, ↓острых симптомов' },
          { timeline: '6-12 мес', effect: 'Некоторые симптомы обратимы, но: голос и гипертрофия клитора часто остаются' },
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // РАСШИРЕНИЕ: endocrine — пептиды, гормон роста, SERM/SARM
  // ═══════════════════════════════════════════════════════════════════

  {
    id: 'insulin_resistance_progression',
    symptom: 'Прогрессирующая инсулинорезистентность на курсе',
    category: 'endocrine',
    urgency: 'warning',
    linkedDrugs: ['gh', 'insulin', 'testosterone', 'trenbolone'],
    relatedSymptoms: ['insulin_resistance_signs', 'abdominal_fat_gain', 'hypertension'],
    quickFacts: [
      ' GH + инсулин + ААС = диабетогенная комбинация',
      ' Индекс HOMA-IR >2.5 — инсулинорезистентность',
      ' Берберин 500 мг 3р/день ~ метформин 500 мг 2р/день',
    ],
    generalInfo: 'Инсулинорезистентность развивается при комбинации GH (↑контринсулярные гормоны), инсулина (десенситизация), ААС (нарушение передачи сигнала).',
    problems: [
      {
        problem: 'GH + экзогенный инсулин-индуцированная ИР',
        probability: 'high',
        mechanism: 'GH → ↑печёночный глюконеогенез, ↑липолиз → ↑FFA → ↓сигнал IR/IRS-1. Инсулин (экзогенный) → ↓рецепторная чувствительность. ААС ухудшают через ↑висцеральный жир.',
        labMarkers: [
          { marker: 'Глюкоза натощак', expectedChange: '↑', targetRange: '3.9-5.5 ммоль/л', when: 'Каждые 4 нед' },
          { marker: 'Инсулин натощак', expectedChange: '↑↑', targetRange: '2.6-24.9 мкЕд/мл', when: 'Каждые 4 нед' },
          { marker: 'HOMA-IR', expectedChange: '↑↑', targetRange: '<2.5', when: 'По индексу' },
          { marker: 'Гликированный гемоглобин (HbA1c)', expectedChange: '↑', targetRange: '<5.7%', when: 'Каждые 12 нед' },
          { marker: 'С-пептид', expectedChange: '↑', targetRange: '0.9-7.2 нг/мл', when: 'Контроль' },
        ],
        solutions: [
          { substanceId: 'berberine', name: 'Берберин', type: 'supplement', dose: '500 мг 3р/день (перед едой)', mechanism: 'AMPK-активация, ↓глюконеогенез', evidenceLevel: 'B' },
          { substanceId: 'metformin', name: 'Метформин', type: 'pharma', dose: '500-1000 мг 2р/день', mechanism: '↓Глюконеогенез, ↑сигнал инсулина', evidenceLevel: 'A' },
          { substanceId: 'chromium', name: 'Хром пиколинат', type: 'supplement', dose: '200-500 мкг/день', mechanism: '↑сигнал инсулина', evidenceLevel: 'C' },
          { substanceId: 'alpha_lipoic', name: 'Альфа-липоевая кислота', type: 'supplement', dose: '300-600 мг/день', mechanism: 'AMPK, ↓глюконеогенез', evidenceLevel: 'B' },
          { substanceId: 'cinnamon', name: 'Корица (Cassia)', type: 'supplement', dose: '1-6 г/день', mechanism: '↑сигнал инсулина, ↓глюкоза', evidenceLevel: 'B' },
          { substanceId: 'low_carb_diet', name: 'Низкоуглеводная диета', type: 'lifestyle', dose: '<100 г углеводов/день', mechanism: '↓потребность в инсулине', evidenceLevel: 'A' },
        ],
        expectations: [
          { timeline: '4-8 нед', effect: '↓HOMA-IR на 20-40%, ↓инсулина натощак' },
          { timeline: '8-12 нед', effect: 'Стабилизация HbA1c, ↓висцерального жира' },
        ],
      },
    ],
  },

  {
    id: 'cortisol_suppression',
    symptom: 'Подавление кортизола / надпочечниковая недостаточность',
    category: 'endocrine',
    urgency: 'warning',
    linkedDrugs: ['testosterone', 'trenbolone', 'deca'],
    relatedSymptoms: ['pct_lethargy', 'fatigue', 'depression'],
    quickFacts: [
      ' На ААС-курсе кортизол ↓ до 50-70%',
      ' Резкая отмена ААС → ↑↑кортизола (синдром отмены)',
      'Фаза ПКТ —的了 "cortisol rebound" — критическая стадия',
    ],
    generalInfo: 'Подавление оси HPA (гипоталамо-гипофизарно-надпочечниковой) — ключевой механизм синдрома отмены ААС. ААС ↓кортизол через подавление ACTH, а после отмены — резкий отскок.',
    problems: [
      {
        problem: 'ААС-подавление HPA оси с последующим rebound',
        probability: 'high',
        mechanism: 'ААС ↓ACTH →↓кортизол надпочечников. После отмены — кора надпочечников истощена (застой) → ↓выработка → дополнительно ↑CRH → ↑↑↑кортизол (rebound). Может продолжаться 6-12 мес.',
        labMarkers: [
          { marker: 'Кортизол утренний', expectedChange: '↓', targetRange: '138-690 нмоль/л', when: 'На курсе + ПКТ' },
          { marker: 'АКТГ', expectedChange: '↓', targetRange: '10-60 пг/мл', when: 'При symptomsах отмены' },
          { marker: 'Кортизол вечерний', expectedChange: '↓', targetRange: '<50% утреннего', when: 'Контроль цикла' },
        ],
        solutions: [
          { substanceId: 'ashwagandha', name: 'Ашваганда (KSM-66)', type: 'supplement', dose: '300-600 мг/день', mechanism: '↓восприимчивость к кортизолу, баланс HPA', evidenceLevel: 'B' },
          { substanceId: 'rhodiola', name: 'Родиола розовая', type: 'supplement', dose: '200-400 мг/день', mechanism: 'Адаптоген, ↓усталость', evidenceLevel: 'B' },
          { substanceId: 'phosphatidylserine', name: 'Фосфатидилсерин', type: 'supplement', dose: '400-600 мг/день', mechanism: '↓кортизол после тренировок', evidenceLevel: 'A' },
          { substanceId: 'vitamin_c_high', name: 'Витамин C 1000 мг', type: 'supplement', dose: '1000 мг/день', mechanism: 'Кофактор стероидогенеза в надпочечниках', evidenceLevel: 'B' },
          { substanceId: 'taper_course', name: 'Постепенная отменя ААС (титрование)', type: 'lifestyle', dose: 'Снижение дозы 25% в неделю', mechanism: '↓синдрома отмены', evidenceLevel: 'A' },
        ],
        expectations: [
          { timeline: 'На курсе', effect: 'Кортизол 138-300 нмоль/л (нижняя граница), симптомы не выражены' },
          { timeline: 'ПКТ (1-4 нед)', effect: 'Кортизол ↑↑, вимптомы: усталость, депрессия. Фосфатидилсерин + ашваганда ↓симптомы' },
          { timeline: '6-12 мес после курса', effect: 'Нормализация HPA оси' },
        ],
      },
    ],
  },

  {
    id: 'prolactin_elevation',
    symptom: 'Гиперпролактинемия (высокий пролактин)',
    category: 'endocrine',
    urgency: 'warning',
    linkedDrugs: ['trenbolone', 'deca', 'gh'],
    relatedSymptoms: ['gynecomastia', 'libido_loss', 'depression'],
    quickFacts: [
      ' 19-нор (трен/дека) ↑пролактин через ↓dopamine',
      'Пролактин >25 нг/мл — гинекомастия, ↓либидо, депрессия',
      ' Каберголин 0.25 мг 2р/нед — стандарт лечения',
    ],
    generalInfo: '19-нор-ААС (тренболон, нандролон) ↑пролактин через подавление допаминергического контроля. Высокий пролактин → гинекомастия, ↓либидо, депрессия.',
    problems: [
      {
        problem: '19-нор-индуцированная гиперпролактинемия',
        probability: 'high',
        mechanism: 'Тренболон/нандролон имеют прогестиновой активность → ↑пролактина через ↓D2-рецепторный контроль. Печёночный GH ↑пролактин через ↓соматостатин.',
        labMarkers: [
          { marker: 'Пролактин', expectedChange: '↑↑', targetRange: '4-23 нг/мл (муж.)', when: 'Каждые 4 нед на 19-нор' },
          { marker: 'Прогестерон', expectedChange: '↑', targetRange: '<1.4 нмоль/л (муж.)', when: 'Спец.' },
          { marker: 'Эстрадиол', expectedChange: '↑', targetRange: '<45 пг/мл', when: 'Контроль' },
        ],
        solutions: [
          { substanceId: 'cabergoline', name: 'Каберголин', type: 'pharma', dose: '0.25 мг 2р/нед', mechanism: 'D2-агонист → ↓пролактин', evidenceLevel: 'A' },
          { substanceId: 'vitamin_b6', name: 'Витамин B6 (P-5-P)', type: 'supplement', dose: '200-400 мг/день', mechanism: '↑dopamine → ↓пролактин', evidenceLevel: 'B' },
          { substanceId: 'mucuna_pruriens', name: 'Мукуна жгучая (L-DOPA)', type: 'supplement', dose: '500 мг/день (станд. 15% L-DOPA)', mechanism: '↑dopamine → ↓пролактин', evidenceLevel: 'C' },
        ],
        expectations: [
          { timeline: '1-2 нед', effect: 'Каберголин: ↓пролактина на 50-70%' },
          { timeline: '4-8 нед', effect: 'Нормализация <15 нг/мл, устранение симптомов' },
        ],
      },
    ],
  },

  {
    id: 'serm_side_effects',
    symptom: 'Побочные эффекты SERM (Clomid/Nolva) на ПКТ',
    category: 'endocrine',
    urgency: 'standard',
    linkedDrugs: ['clomid', 'nolvadex'],
    relatedSymptoms: ['pct_lethargy', 'depression', 'vision_changes'],
    quickFacts: [
      ' Clomid: эмоциональные перепады, депрессия, ↓зрения',
      ' Nolvadex:.vsClomid — меньше настроение, риск ВТЭО',
      'Enclomiphene более благоприятный (меньшепобочки)',
    ],
    generalInfo: 'SERM (СЭРМ) — препараты антиэстрогенной терапии, используются в ПКТ. Побочные эффекты часто мешают приверженности.',
    problems: [
      {
        problem: 'Clomid-индуцированные эмоциональные побочки',
        probability: 'high',
        mechanism: 'Кломифен имеет 2 изомера: enclomiphene (анти-E) и zuclomiphene (эстрогенный). Zuclomiphene →↑эстрогенный эффект → эмоциональные перепады, депрессия.',
        labMarkers: [
          { marker: 'Эстрадиол', expectedChange: '↑↑', targetRange: '<45 пг/мл', when: 'Контроль на SERM' },
          { marker: 'Тестостерон', expectedChange: '↑', targetRange: '10-35 нмоль/л', when: 'Ответ на SERM' },
          { marker: 'ЛГ/ФСГ', expectedChange: '↑↑', targetRange: 'Восстановление HPTA', when: 'Через 2-4 нед' },
        ],
        solutions: [
          { substanceId: 'enclomiphene', name: 'Enclomiphene (вместо кломида)', type: 'pharma', dose: '12.5-25 мг/день', mechanism: 'Чистый антиэстроген без эстрогенного изомера', evidenceLevel: 'B' },
          { substanceId: 'reduce_clomid', name: 'Снизить дозу кломида', type: 'lifestyle', dose: '25-50 мг/день (вместо 100)', mechanism: '↓zuclomiphene эффекты', evidenceLevel: 'B' },
          { substanceId: 'ashwagandha', name: 'Ашваганда', type: 'supplement', dose: '300-600 мг/день', mechanism: '↓депрессия/тревожность', evidenceLevel: 'B' },
        ],
        expectations: [
          { timeline: '1-2 нед', effect: 'Улучшение настроения при enclomiphene' },
          { timeline: '4 нед', effect: 'Полная замена кломида на enclomiphene' },
        ],
      },
      {
        problem: 'Tamoxifen-индуцированный риск ВТЭО',
        probability: 'low',
        mechanism: '↓антитромбин III, ↑фактор VIII → ↑риск венозной тромбоэмболии. Чаще при длительном применении + курение + ААС.',
        labMarkers: [
          { marker: 'Антитромбин III', expectedChange: '↓', targetRange: '80-120%', when: 'Контроль' },
          { marker: 'D-димер', expectedChange: '↔', targetRange: '<0.5 мкг/мл', when: 'Контроль' },
        ],
        solutions: [
          { substanceId: 'aspirin', name: 'Аспирин 81 мг', type: 'pharma', dose: '81 мг/день', mechanism: '↓тромбоз', evidenceLevel: 'B' },
          { substanceId: 'limit_duration', name: 'Ограничить длительность Nolvadex', type: 'lifestyle', dose: '4-6 нед ПКТ', mechanism: '↓риск', evidenceLevel: 'B' },
        ],
        expectations: [
          { timeline: '4-6 нед', effect: 'Завершение ПКТ, ↓риска' },
        ],
      },
    ],
  },

  {
    id: 'sarm_testosterone_suppression',
    symptom: 'Подавление тестостерона на SARM-курсе',
    category: 'endocrine',
    urgency: 'warning',
    linkedDrugs: ['rad140', 'lgd4033', 'ostarine'],
    relatedSymptoms: ['libido_loss', 'testicular_atrophy', 'pct_lethargy'],
    quickFacts: [
      ' RAD-140 сильнее всех подавляет HPTA',
      ' LGD-4033: 1 мг/день ↓Т на 50% за 3 нед',
      ' Ostarine (мк-2866): менее подавляющий, но всё же',
      ' Пероральные SARM часто фальсифицированы (проверять)',
    ],
    generalInfo: 'SARM (селективные модуляторы AR) подавляют HPTA в зависимости от дозы и длительности. Многие надеются на "безопасную альтернативу", но в реальности подавление сопоставимо с мягкими ААС.',
    problems: [
      {
        problem: 'SARM-индуцированное подавление HPTA',
        probability: 'high',
        mechanism: 'Андрогенный сигнал в мышцах → AР → ↓GnRH → ↓LH/FSH → ↓тестостерон. Чем выше доза, тем сильнее. RAD-140 ~4-8 нед подавляет полностью.',
        labMarkers: [
          { marker: 'Тестостерон', expectedChange: '↓↓', targetRange: '10-35 нмоль/л', when: 'До и после курса' },
          { marker: 'ЛГ', expectedChange: '↓↓', targetRange: '1.7-8.6 мЕд/мл', when: 'Контроль' },
          { marker: 'ФСГ', expectedChange: '↓', targetRange: '1.5-12.4 мЕд/мл', when: 'Контроль' },
          { marker: 'ГСПГ', expectedChange: '↔ или ↓ (RAD-140)', targetRange: '13-71 нмоль/л', when: 'Контроль' },
        ],
        solutions: [
          { substanceId: 'pct_serms', name: 'ПКТ с SERM (Nolvadex/Enclomiphene)', type: 'pharma', dose: '20 мг Nolva 4 нед или 12.5 мг Enclomiphene', mechanism: '↑GnRH/LH/FSH → ↑эндогенный T', evidenceLevel: 'A' },
          { substanceId: 'test boosters', name: 'Тестобустеры (Tongkat Ali)', type: 'supplement', dose: '200-400 мг/день', mechanism: '↓ГСПГ, ↓T→деградацию, ↑Leydig', evidenceLevel: 'C' },
          { substanceId: 'ashwagandha', name: 'Ашваганда KSM-66', type: 'supplement', dose: '300-600 мг/день', mechanism: '↓кортизола, ↑восстановление HPTA', evidenceLevel: 'B' },
          { substanceId: 'd_aspartic', name: 'D-аспарагиновая кислота', type: 'supplement', dose: '3 г/день (короткий цикл)', mechanism: '↑LH, ↑ тестостерон (умеренный)', evidenceLevel: 'C' },
        ],
        expectations: [
          { timeline: '4 нед ПКТ', effect: 'SERM: восстановление LH/FSH, ↑Т до 70-90%базового' },
          { timeline: '8-12 нед', effect: 'Полное восстановление Т у большинства' },
          { timeline: 'У некоторых при >8 нед SARM', effect: 'Долгое восстановление (3-6 мес)' },
        ],
      },
    ],
  },

  {
    id: 'gh_insulin_resistance',
    symptom: 'GH-индуцированная инсулинорезистентность',
    category: 'endocrine',
    urgency: 'warning',
    linkedDrugs: ['gh'],
    relatedSymptoms: ['insulin_resistance_progression', 'acromegaly_signs', 'abdominal_fat_gain'],
    quickFacts: [
      ' GH 2-4 МЕ/день практически не влияет на глюкозу',
      'GH >6 МЕ/день + углеводы → ↑инсулинорезистентность',
      'Гликированный Hb >6% — перерыв или снижение',
    ],
    generalInfo: 'GH повышает глюконеогенез, lipолиз и ↑FFA — все эти факторы ↓сигнал инсулина. При высоких дозах и/или углеводной диете развивается ИР.',
    problems: [
      {
        problem: 'GH-индуцированная ИР (без инсулина)',
        probability: 'high',
        mechanism: 'GH → ↑печёночный глюконеогенез, ↑липолиз → ↑FFA → ↓ транспорта глюкозы в мышцы, ↓фосфорилирование IRS-1.',
        labMarkers: [
          { marker: 'Глюкоза натощак', expectedChange: '↑', targetRange: '<5.5 ммоль/л', when: 'Каждые 4 нед' },
          { marker: 'Инсулин', expectedChange: '↑', targetRange: '<15 мкЕд/мл', when: 'Каждые 4 нед' },
          { marker: 'HOMA-IR', expectedChange: '↑', targetRange: '<2.5', when: 'Контроль' },
          { marker: 'IGF-1', expectedChange: '↑↑', targetRange: 'возрастная норма', when: 'Контроль GH-эффекта' },
          { marker: 'HbA1c', expectedChange: '↑', targetRange: '<5.7%', when: 'Каждые 12 нед' },
        ],
        solutions: [
          { substanceId: 'berberine', name: 'Берберин', type: 'supplement', dose: '500 мг 3р/день', mechanism: 'AMPK, ↓глюконеогенез', evidenceLevel: 'B' },
          { substanceId: 'metformin', name: 'Метформин', type: 'pharma', dose: '500-1000 мг 2р/день', mechanism: '↓глюконеогенез', evidenceLevel: 'A' },
          { substanceId: 'intermittent_fasting', name: 'Интервальное голодание 16:8', type: 'lifestyle', dose: '16 часов голода + 8 окно', mechanism: '↓инсулина, ↑инсулиночувствительность', evidenceLevel: 'B' },
          { substanceId: 'low_carb_diet', name: 'Низкоуглеводная диета', type: 'lifestyle', dose: '<50 г углеводов/день', mechanism: '↓потребность в инсулине', evidenceLevel: 'A' },
        ],
        expectations: [
          { timeline: '4-8 нед', effect: '↓HOMA-IR, стабилизация глюкозы' },
          { timeline: '12 нед', effect: '↓HbA1c на 0.3-0.5%' },
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // РАСШИРЕНИЕ: cns — ЦНС и неврология
  // ═══════════════════════════════════════════════════════════════════

  {
    id: 'steroid_mood_swings',
    symptom: 'Эмоциональная лабильность / перепады настроения',
    category: 'cns',
    urgency: 'warning',
    linkedDrugs: ['testosterone', 'trenbolone', 'anadrol'],
    relatedSymptoms: ['anxiety', 'aggression', 'depression'],
    quickFacts: [
      ' Тренболон + высокий E2 = максимальная лабильность',
      'Уровни нейромедиаторов: ↓serotonin, ↑dopamine, ↑GABA躁',
      ' Сон <6 ч → +30% к эмоциональной нестабильности',
    ],
    generalInfo: 'Эмоциональная лабильность — типичный побочный эффект ААС, особенно выс. доз. Комбинация с тренировками, диетой и стрессом ухудшает ситуацию.',
    problems: [
      {
        problem: 'ААС-опосредованные изменения нейромедиаторов',
        probability: 'high',
        mechanism: '↑Testosterone → ↑конверсия в estradiol (↑E2 → ↓serotonin/ тревожность) + ↑DHT (↓GABA-ergic тонус). Прогестерон-производные (19-нор) усиливают.',
        labMarkers: [
          { marker: 'Эстрадиол', expectedChange: '↑↑', targetRange: '<45 пг/мл', when: 'Контроль' },
          { marker: 'Пролактин', expectedChange: '↑', targetRange: '<15 нг/мл', when: 'При депрессии' },
          { marker: 'Тестостерон', expectedChange: '↑↑', targetRange: '20-40 нмоль/л', when: 'Для коррекции' },
          { marker: 'Кортизол', expectedChange: '↑', targetRange: '<500 нмоль/л', when: 'Контроль' },
        ],
        solutions: [
          { substanceId: 'l_theanine', name: 'L-теанин', type: 'supplement', dose: '200-400 мг/день', mechanism: '↑GABA, ↓возбуждение', evidenceLevel: 'B' },
          { substanceId: 'ashwagandha', name: 'Ашваганда (KSM-66)', type: 'supplement', dose: '300-600 мг/день', mechanism: '↓кортизол, баланс HPA', evidenceLevel: 'A' },
          { substanceId: 'magnesium_glycinate', name: 'Магний глицинат', type: 'supplement', dose: '400-600 мг/день', mechanism: '↑GABA-ергическая активность', evidenceLevel: 'B' },
          { substanceId: '5htp', name: '5-HTP (5-гидрокситриптофан)', type: 'supplement', dose: '100-200 мг на ночь (с осторожностью)', mechanism: '↑serotonin', evidenceLevel: 'C' },
          { substanceId: 'aromatase_inhibitor', name: 'AI контроль E2', type: 'pharma', dose: 'По результату анализа', mechanism: '↓E2 → ↓тревожность', evidenceLevel: 'A' },
        ],
        expectations: [
          { timeline: '2-4 нед', effect: '↑стабильность настроения, ↓тревожности' },
          { timeline: '4-8 нед', effect: 'Нормализация AI дозы (E2 20-30 пг/мл) — улучшение' },
        ],
      },
    ],
  },

  {
    id: 'peptide_bpc157_effects',
    symptom: 'Нейтропения / лейкопения от пептидов (BPC-157)',
    category: 'cns',
    urgency: 'standard',
    linkedDrugs: ['bpc157', 'tb500'],
    relatedSymptoms: ['fatigue'],
    quickFacts: [
      ' BPC-157 в высоких дозах может ↓нейтрофилы',
      ' Peptides часто производятся с примесями',
      ' Играть чистоту и дозировку',
    ],
    generalInfo: 'Пептиды (BPC-157, TB-500) имеют ограниченные данные безопасности. Существуют сообщения о лейкопении/neutropenia.',
    problems: [
      {
        problem: 'BPC-157-ассоциированная лейкопения',
        probability: 'low',
        mechanism: 'Пептид с системным действием, может взаимодействовать с иммунными сигнальными путями. Случаи нейтропении зарегистрированы, но причинность не установлена.',
        labMarkers: [
          { marker: 'Лейкоциты', expectedChange: '↓', targetRange: '4-10×10⁹/л', when: 'Каждые 4 нед при пептидах' },
          { marker: 'Нейтрофилы', expectedChange: '↓', targetRange: '>1.5×10⁹/л', when: 'Контроль' },
        ],
        solutions: [
          { substanceId: 'pause_peptide', name: 'Перерыв в пептиде', type: 'lifestyle', dose: '4 нед', mechanism: 'Восстановление гемопоэза', evidenceLevel: 'C' },
        ],
        expectations: [
          { timeline: '2-4 нед после отмены', effect: 'Восстановление лейкоцитов' },
        ],
      },
    ],
  },

  {
    id: 'serotonin_syndrome_risk',
    symptom: 'Серотониновый синдром (риска при комбинациях)',
    category: 'cns',
    urgency: 'critical',
    linkedDrugs: ['sarms', 'ssri', '5htp'],
    relatedSymptoms: ['tren_mental', 'anxiety'],
    quickFacts: [
      ' Комбинация: 5-HTP + SSRI + MAOI = серотониновый синдром',
      ' Симптомы: гипертермия, дрожь, гипертонус, спутанность',
      ' Экстренно! При гипертермии >40°C',
    ],
    generalInfo: 'Серотониновый синдром — жизнеугрожающее состояние, возникающее при избытке серотонина в ЦНС. Опасность в комбинации серотонинергических препаратов.',
    problems: [
      {
        problem: 'Избыток серотонина в ЦНС',
        probability: 'low',
        mechanism: '↑serotonin через комбинацию: SSRI (↓обратный захват) + 5-HTP (предшественник) + MAOI (↓деградация) → гипервозбуждение 5-HT рецепторов.',
        labMarkers: [
          { marker: 'Клиническая картина', expectedChange: '↑', targetRange: 'Клиника', when: 'Диагностика' },
          { marker: 'Температура', expectedChange: '↑↑↑', targetRange: '37.8-40+°C', when: 'Контроль' },
        ],
        solutions: [
          { substanceId: 'cyproheptadine', name: 'Ципрогептадин (серотониновый ант-т)', type: 'pharma', dose: '4-8 мг (острое)', mechanism: 'Блокада 5-HT2A', evidenceLevel: 'A' },
          { substanceId: 'stop_serotonergic', name: 'Отмена серотонинергических препаратов', type: 'lifestyle', dose: 'Срочно', mechanism: 'Истощение серотонина', evidenceLevel: 'A' },
        ],
        expectations: [
          { timeline: 'Срочно', effect: 'Госпитализация, ОТД 12-24 ч после исчезновения симптомов', sideNote: 'НЕ амбулаторно' },
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // РАСШИРЕНИЕ: gastrointestinal — ЖКТ и пищеварение
  // ═══════════════════════════════════════════════════════════════════

  {
    id: 'gut_microbiome_dysbiosis',
    symptom: 'Дисбактериоз кишечника на высокобелковой диете',
    category: 'gastrointestinal',
    urgency: 'standard',
    linkedDrugs: ['testosterone', 'gh', 'insulin'],
    relatedSymptoms: ['bloating', 'nausea', 'fatigue'],
    quickFacts: [
      ' >3 г/кг белка/день → ↑протеолитических бактерий',
      ' ↑протеолитики → ammonemia, indole, p-cresol (токсины)',
      ' Пробиотики + клетчатка ↑бифидобактерии и молочнокислые',
    ],
    generalInfo: 'Высокобелковая диета ААС-пользователей изменяет микробный состав кишечника: ↑протеолитические бактерии, ↓сахаролитические.',
    problems: [
      {
        problem: 'Протеолитический дисбактериоз',
        probability: 'high',
        mechanism: '↑Белка диета → ↑протеолитические бактерии (Bacteroides, Clostridium) → ↑аммиак, индол, p-крезол. ↓клетчатка → ↓сахаролитических бактерий (Bifidobacterium, Lactobacillus). ↑Дыхание аммиаком.',
        labMarkers: [
          { marker: 'Калпротектин', expectedChange: '↑', targetRange: '<50 мкг/г', when: 'При симптомах' },
          { marker: 'рН кала', expectedChange: '↑', targetRange: '6.0-7.0', when: 'Спец.' },
        ],
        solutions: [
          { substanceId: 'probiotics', name: 'Пробиотики (Lactobacillus)', type: 'supplement', dose: '10-50 млрд КОЕ/день', mechanism: '↑молочнокислые бактерии', evidenceLevel: 'B' },
          { substanceId: 'prebiotic_fiber', name: 'Пребиотическая клетчатка', type: 'lifestyle', dose: '25-35 г/день (ОВС, псиллум)', mechanism: '↑SCFA, ↑бифидо', evidenceLevel: 'A' },
          { substanceId: 'butyrate', name: 'Масляная кислота (Butyrate)', type: 'supplement', dose: '300-600 мг/день', mechanism: '↑эпителий, ↓воспаление', evidenceLevel: 'B' },
          { substanceId: 'bone_broth', name: 'Костный бульон', type: 'lifestyle', dose: '250-500 мл/день', mechanism: 'Глютамин, ↑эпителиального барьера', evidenceLevel: 'C' },
          { substanceId: 'l_glutamine', name: 'L-глютамин', type: 'supplement', dose: '5-10 г/день', mechanism: 'Топливо энтероцитов', evidenceLevel: 'B' },
        ],
        expectations: [
          { timeline: '2-4 нед', effect: '↓bloating, улучшение стула' },
          { timeline: '6-8 нед', effect: '↑разнообразие микробиома (через кал-биом)' },
        ],
      },
    ],
  },

  {
    id: 'ibs_constipation_cycle',
    symptom: 'Запоры/СРК-Ц на курсе',
    category: 'gastrointestinal',
    urgency: 'standard',
    linkedDrugs: ['testosterone', 'gh'],
    relatedSymptoms: ['bloating', 'gerd', 'nausea'],
    quickFacts: [
      ' Высокая доза тестостерона + высокий белок + ↓клетчатка = запор',
      ' Постоянный приём протеиновых изолятов ↓ перистальтику',
      ' Магний цитрат 400 мг/день — мягкая профилактика',
    ],
    generalInfo: 'Запоры и синдром раздражённого кишечника с преобладанием запоров (СРК-Ц) встречаются у тяжелоатлетов на курсе. Причина: диета, ↓клетчатка, физическая нагрузка.',
    problems: [
      {
        problem: 'Диета+ААС индуцированный СРК-Ц',
        probability: 'high',
        mechanism: 'Высокий белок + ↓овощи/ фрукт+ ↓H2O витамины → ↓объём стула, ↓моторика.Тренинг + стресс (↑симпатик) ↓парасимпатик → ↓перистальтика.',
        labMarkers: [
          { marker: 'Калпротектин', expectedChange: '↔', targetRange: '<50', when: 'Дифференциальный' },
          { marker: 'Гемоглобин', expectedChange: '↔', targetRange: 'Контроль', when: 'Исключить кровотечение' },
        ],
        solutions: [
          { substanceId: 'magnesium_citrate', name: 'Магний цитрат 400 мг', type: 'supplement', dose: '400-600 мг/день', mechanism: '↑H2O в стуле, ↓тонус', evidenceLevel: 'A' },
          { substanceId: 'fiber', name: 'Псиллум', type: 'supplement', dose: '5-10 г/день + H2O', mechanism: '↑объём, моторика', evidenceLevel: 'A' },
          { substanceId: 'probiotics', name: 'Пробиотики', type: 'supplement', dose: '10-20 млрд КОЕ/день', mechanism: '↑моторика, ↓воспаление', evidenceLevel: 'B' },
          { substanceId: 'hydration', name: 'Гидратация', type: 'lifestyle', dose: '3-4 л/день', mechanism: '↑объём стула', evidenceLevel: 'A' },
        ],
        expectations: [
          { timeline: '3-7 дн', effect: 'Магний цитрат + псиллум: нормализация стула' },
          { timeline: '4-8 нед', effect: 'Пробиотики + диета: ↓bloating, регулярная перистальтика' },
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // РАСШИРЕНИЕ: musculoskeletal — опорно-двигательная
  // ═══════════════════════════════════════════════════════════════════

  {
    id: 'tendon_rupture_risk',
    symptom: 'Высокий риск разрыва сухожилий на ААС',
    category: 'musculoskeletal',
    urgency: 'warning',
    linkedDrugs: ['testosterone', 'trenbolone', 'winstrol'],
    relatedSymptoms: ['joint_pain', 'back_pumps'],
    quickFacts: [
      ' ААС ↑мышечную силу быстрее, чем адаптация сухожилий',
      '↓Коллаген synthesis при 17α-алкил + самплинг',
      ' Маркеры: проксимальный бицепс, ахиллово сухожилие, надостное',
    ],
    generalInfo: 'Дисбаланс между быстро растущей мышечной силой и медленно адаптирующимися сухожилиями — главная причина разрывов на ААС. Коллаген-синтез не успевает.',
    problems: [
      {
        problem: 'ААС-индуцированная дисадаптация сухожилий',
        probability: 'medium',
        mechanism: ' ↑Сила (↑мышцы) → ↑нагрузка на сухожилия, но ↓коллаген-синтез (17α-алкил) → риск микроразрывов и полного разрыва.',
        labMarkers: [
          { marker: '无明显 маркеры', expectedChange: '↔', targetRange: 'Клиника', when: 'МРТ при боли' },
          { marker: 'УЗИ сухожилия', expectedChange: '↑', targetRange: 'Контроль', when: 'При хрон. боли' },
        ],
        solutions: [
          { substanceId: 'collagen_peptides', name: 'Коллаген пептиды', type: 'supplement', dose: '10-15 г/день', mechanism: '↑синтез коллагена I типа', evidenceLevel: 'B' },
          { substanceId: 'vitamin_c', name: 'Витамин C', type: 'supplement', dose: '500-1000 мг/день', mechanism: 'Кофактор гидроксилирования пролина/лизина', evidenceLevel: 'B' },
          { substanceId: 'gh_minimal', name: 'GH мини-дose', type: 'pharma', dose: '1-2 МЕ/день', mechanism: '↑Коллаген синтез', evidenceLevel: 'C' },
          { substanceId: 'progressive_load', name: 'Прогрессивная нагрузка (вместо макс.)', type: 'lifestyle', dose: '70-80% 1ПМ', mechanism: '↓риск разрыва', evidenceLevel: 'A' },
        ],
        expectations: [
          { timeline: '4-8 нед', effect: 'Коллаген + витамин C: ↑синтеза коллагена на 30-60%' },
          { timeline: '12 нед', effect: 'Улучшение УЗИ-картины сухожилия' },
        ],
      },
    ],
  },

  {
    id: 'ligament_laxity_gh',
    symptom: 'Гипермобильность связок на GH- курсе',
    category: 'musculoskeletal',
    urgency: 'standard',
    linkedDrugs: ['gh', 'igf1'],
    relatedSymptoms: ['carpal_tunnel_gh', 'joint_pain'],
    quickFacts: [
      ' GH → ↑синовиальная жидкость → "рыхлые" связки',
      ' Симптом: лёгкое "щёлканье" суставов без боли',
      ' Если + боль → уменьшить дозу',
    ],
    generalInfo: 'GH повышает продукцию синовиальной жидкости и может увеличивать растяжимость капсулы сустава. Это вызывает ощущение незащищённости суставов.',
    problems: [
      {
        problem: 'GH-индуцированная мягкость связок',
        probability: 'medium',
        mechanism: 'GH → ↑IGF-1 → ↑синовиоцит пролиферация + ↑протеогликаны → ↑объём синовии, ↓плотность коллагена в капсуле. Сустав "рыхлый".',
        labMarkers: [
          { marker: 'IGF-1', expectedChange: '↑↑', targetRange: 'Возрастная норма', when: 'Контроль' },
        ],
        solutions: [
          { substanceId: 'reduce_gh', name: 'Снизить GH дозу', type: 'lifestyle', dose: '1-2 МЕ/день', mechanism: '↓синовиальная гиперпродукция', evidenceLevel: 'A' },
          { substanceId: 'collagen_peptides', name: 'Коллаген пептиды', type: 'supplement', dose: '10-15 г/день', mechanism: '↑коллаген капсулы', evidenceLevel: 'B' },
          { substanceId: 'strength_training', name: 'Силовая тренировка связок', type: 'lifestyle', dose: 'Изометрия, эксцентрика', mechanism: '↑коллаген synthesis', evidenceLevel: 'A' },
        ],
        expectations: [
          { timeline: '2-4 нед после снижения', effect: 'Симптомы проходят' },
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // РАСШИРЕНИЕ: psychological — психика и когнитивные
  // ═══════════════════════════════════════════════════════════════════

  {
    id: 'pct_depression',
    symptom: 'Пост-цикловая депрессия / "crash"',
    category: 'psychological',
    urgency: 'critical',
    linkedDrugs: ['testosterone', 'deca', 'trenbolone'],
    relatedSymptoms: ['pct_lethargy', 'depression', 'libido_loss'],
    quickFacts: [
      ' "Crash" — ↓↓тестостерона + ↑↑кортизола + ↓серотонин',
      ' Пик: 2-4 нед после отмены (острая фаза)',
      'Длительность: 6-12 нед без поддержки',
      ' Высокий риск рецидива ААС-использования (без поддержки)',
    ],
    generalInfo: 'Пост-цикловый краш — комплексное состояние: ↓тестостерона + ↑↑кортизола + ↓серотонин/дофамин + ↓I GF-1. Характеризуется депрессией, ↓либидо, усталостью, ↓когнитивной функции.',
    problems: [
      {
        problem: 'Гормональный дефицит + надпочечниковая недостаточность',
        probability: 'high',
        mechanism: ' Отмена ААС → ↓↓Т (истощённый HPTA) + ↑↑кортизол (rebound) + ↓серотонин/дофамин (нейроадаптация) + ↓IGF-1 (если был GH).',
        labMarkers: [
          { marker: 'Тестостерон', expectedChange: '↓↓', targetRange: '10-35 нмоль/л', when: '2-4 нед ПКТ' },
          { marker: 'Кортизол', expectedChange: '↑↑', targetRange: '138-690 нмоль/л', when: 'Контроль' },
          { marker: 'Эстрадиол', expectedChange: '↓', targetRange: '11-43 пг/мл', when: 'Падает с T' },
          { marker: 'ЛГ/ФСГ', expectedChange: '↔ или ↑', targetRange: 'Восстановление HPTA', when: 'Через 4-6 нед ПКТ' },
        ],
        solutions: [
          { substanceId: 'serm_pcт', name: 'ПЦИО с SERM (Nolvadex/Enclomiphene)', type: 'pharma', dose: '20 мг Nolva / 12.5 мг Enclom', mechanism: '↑GnRH → ↑LH/FSH → ↑эндогенный T', evidenceLevel: 'A' },
          { substanceId: 'hcg_support', name: 'hCG при необходимости', type: 'pharma', dose: '500-1000 МЕ 2р/нед за 2 нед до ПКТ', mechanism: '↑Лейдига, ↑Т', evidenceLevel: 'B' },
          { substanceId: 'ashwagandha', name: 'Ашваганда KSM-66', type: 'supplement', dose: '300-600 мг 2р/день', mechanism: '↓кортизол, ↓депрессия', evidenceLevel: 'A' },
          { substanceId: 'rhodiola', name: 'Родиола розовая', type: 'supplement', dose: '200-400 мг/день', mechanism: '↑адаптогенность, ↓усталость', evidenceLevel: 'B' },
          { substanceId: 'omega3_high', name: 'Омега-3 4 г/день', type: 'supplement', dose: '4 г/день', mechanism: '↑нейрогенез, ↓депрессия', evidenceLevel: 'A' },
          { substanceId: 'vitamin_d', name: 'Витамин D3 5000 МЕ', type: 'supplement', dose: '5000-10000 МЕ/день', mechanism: '↓депрессия, ↑иммунитет', evidenceLevel: 'B' },
          { substanceId: 'therapy', name: 'Психотерапия (когнитивная)', type: 'lifestyle', dose: '8-12 сессий', mechanism: '↓симптомы, ↑приверженность', evidenceLevel: 'A' },
        ],
        expectations: [
          { timeline: '2-4 нед ПКТ', effect: 'SERM: ↑T на 20-50%, ↓острых симптомов' },
          { timeline: '4-6 нед', effect: ' ashwagandha: ↓кортизол, ↑настроения' },
          { timeline: '8-12 нед', effect: 'Полное восстановление HPTA у большинства' },
        ],
      },
    ],
  },

  {
    id: 'muscle_dysmorphia',
    symptom: 'Дисморфофобия мышц / "обратная анорексия"',
    category: 'psychological',
    urgency: 'warning',
    linkedDrugs: ['testosterone', 'trenbolone', 'gh'],
    relatedSymptoms: ['aggression', 'depression', 'anxiety'],
    quickFacts: [
      ' Расстройство образа тела — "никогда не достаточно большие"',
      ' Риск: 8-15% мужчин-бодибилдеров',
      ' Прогрессирует от курса к курсу',
    ],
    generalInfo: 'Мышечная дисморфия — психическое расстройство, при котором человек不改 воспринимает своё тело как "слишком маленькое", несмотря на значительную мышечную массу.',
    problems: [
      {
        problem: 'Образ тела / одержимость размером',
        probability: 'high',
        mechanism: 'Генетика + культурные стандарты + ↑ААС-дозы. ↓Удовлетворённость телом постоянна. Компульсивное сравнение с другими.',
        labMarkers: [
          { marker: 'MAAS-q', expectedChange: '↑', targetRange: '<14 баллов', when: 'Самотест' },
        ],
        solutions: [
          { substanceId: 'cbt', name: 'Когнитивно-поведенческая терапия', type: 'lifestyle', dose: '12-16 сессий', mechanism: '↓симптомы, ↑самооценка', evidenceLevel: 'A' },
          { substanceId: 'limit_social', name: '↓соцсети (Instagram)', type: 'lifestyle', dose: '<30 мин/день', mechanism: '↓сравнения', evidenceLevel: 'B' },
          { substanceId: 'therapy_group', name: 'Групповая терапия', type: 'lifestyle', dose: 'Еженедельно', mechanism: 'Семья + родственники', evidenceLevel: 'A' },
        ],
        expectations: [
          { timeline: '3-6 мес КПТ', effect: '↓симптомы, ↑самооценка' },
        ],
      },
    ],
  },

  {
    id: 'roid_rage_episodic',
    symptom: 'Эпизодическая "roid rage" (вспышки гнева)',
    category: 'psychological',
    urgency: 'critical',
    linkedDrugs: ['testosterone', 'trenbolone', 'anadrol'],
    relatedSymptoms: ['aggression', 'tren_mental', 'steroid_mood_swings'],
    quickFacts: [
      ' "Roid rage" — не у всех, но у предрасположенных выражен',
      ' Тренболон в ≥200 мг/нед пиково увеличивает агрессию',
      ' Удар/преступление = запрещено + разорение отношений',
    ],
    generalInfo: 'Эпизодическая "roid rage" — внезапные вспышки гнева без существенного повода, выходящие за рамки раздражения. Чаще на тренболоне и высоких доз.',
    problems: [
      {
        problem: 'ААС-опосредованная импульсивная агрессия',
        probability: 'medium',
        mechanism: '↑Testosterone → ↑DHT → ↓serotonin- ergic контроль, дофаминовая гиперчувствительность, ↑GABA躁. Нейроадаптация в миндалине, ↓prefrontal контроль.У лиц с историей агрессии риск ↑↑↑.',
        labMarkers: [
          { marker: 'Клиника', expectedChange: '↑', targetRange: 'Клиническая картина', when: 'Контроль' },
          { marker: 'Тестостерон', expectedChange: '↑↑↑', targetRange: 'Снижение дозы', when: 'Коррекция' },
        ],
        solutions: [
          { substanceId: 'reduce_dose', name: 'Немедленно снизить дозу', type: 'lifestyle', dose: '↓25-50%', mechanism: '↓андрогенный стимул', evidenceLevel: 'A' },
          { substanceId: 'l_theanine', name: 'L-теанин', type: 'supplement', dose: '200-400 мг 2р/день', mechanism: '↑GABA, ↓возбуждение', evidenceLevel: 'B' },
          { substanceId: 'magnesium_glycinate', name: 'Магний глицинат', type: 'supplement', dose: '400-600 мг/день', mechanism: '↑GABA-ергическая активность', evidenceLevel: 'B' },
          { substanceId: 'ashwagandha', name: 'Ашваганда KSM-66', type: 'supplement', dose: '300-600 мг 2р/день', mechanism: '↓кортизол, ↓напряжение', evidenceLevel: 'A' },
          { substanceId: 'therapy', name: 'Психотерапия (thermal control)', type: 'lifestyle', dose: 'Еженедельно', mechanism: '↑control импульсов', evidenceLevel: 'A' },
          { substanceId: 'avoid_alcohol', name: 'Полный отказ от алкоголя', type: 'lifestyle', dose: '0 г/день', mechanism: '↓дисингибиция', evidenceLevel: 'A' },
        ],
        expectations: [
          { timeline: '2-4 нед', effect: ' ↓остроты эпизодов, ↓злости' },
          { timeline: '8-12 нед', effect: 'Стабилизация настроения с фарм + психотерапией' },
        ],
      },
    ],
  },
];

/** Поиск симптома по ID */
export function findSymptomById(id: string): SymptomEntry | undefined {
  return SYMPTOM_DB.find((s) => s.id === id);
}

/** Поиск симптомов по категории */
export function findSymptomsByCategory(cat: SymptomCategory): SymptomEntry[] {
  return SYMPTOM_DB.filter((s) => s.category === cat);
}

/** Поиск симптомов по тексту (название, проблемы, механизмы) */
export function searchSymptoms(query: string): SymptomEntry[] {
  const q = query.toLowerCase();
  return SYMPTOM_DB.filter(
    (s) =>
      s.symptom.toLowerCase().includes(q) ||
      s.generalInfo.toLowerCase().includes(q) ||
      s.problems.some(
        (p) =>
          p.problem.toLowerCase().includes(q) ||
          p.mechanism.toLowerCase().includes(q)
      )
  );
}

/** Поиск симптомов по препарату (linkedDrugs) */
export function findSymptomsByDrug(drugId: string): SymptomEntry[] {
  return SYMPTOM_DB.filter(
    (s) => s.linkedDrugs && s.linkedDrugs.includes(drugId)
  );
}

/** Получить все уникальные препараты, связанные с симптомами */
export function getAllLinkedDrugs(): string[] {
  const set = new Set<string>();
  for (const s of SYMPTOM_DB) {
    if (s.linkedDrugs) for (const d of s.linkedDrugs) set.add(d);
  }
  return Array.from(set).sort();
}

/** Сгруппировать симптомы по препаратам (Drug → Symptom[]) */
export function getDrugSymptomMap(): Record<string, SymptomEntry[]> {
  const map: Record<string, SymptomEntry[]> = {};
  for (const s of SYMPTOM_DB) {
    if (s.linkedDrugs) {
      for (const d of s.linkedDrugs) {
        if (!map[d]) map[d] = [];
        map[d].push(s);
      }
    }
  }
  return map;
}

/** Статистика базы */
export function getSymptomStats(): { totalSymptoms: number; totalProblems: number; totalSolutions: number; criticalCount: number; warningCount: number } {
  let totalProblems = 0;
  let totalSolutions = 0;
  let criticalCount = 0;
  let warningCount = 0;
  for (const s of SYMPTOM_DB) {
    totalProblems += s.problems.length;
    totalSolutions += s.problems.reduce((acc, p) => acc + p.solutions.length, 0);
    if (s.urgency === 'critical') criticalCount++;
    if (s.urgency === 'warning') warningCount++;
  }
  return {
    totalSymptoms: SYMPTOM_DB.length,
    totalProblems,
    totalSolutions,
    criticalCount,
    warningCount,
  };
}
