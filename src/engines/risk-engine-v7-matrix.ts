// ============================================================
// Health Engine v7.0 — Risk Matrix (7 systems x 7 mechanisms)
// Genetics, lab trends, nutrition, training, drug contributions, support coverage
// Expanded: All PHARMA_DB substances, ULN-based labFactor, expanded support coverage
// ============================================================

import { zScore, hillEffect, hillTox, nutritionMultipliers, trainingMultipliers, stazhFactors, type ProtocolMode, getModeMultiplier } from './risk-engine-v7-core';
import type { LabPoint, CourseEntry } from '../core/types';
import { PHARMA_DB } from '../core/pharma-database';

// --- 7x7 Risk Systems & Mechanisms ---

export const RISK_SYSTEMS_V7 = [
  'cardio', 'hepatic', 'renal', 'neuro', 'endocrine', 'hematologic', 'reproductive', 'musculoskeletal',
  'metabolic', 'ghigf', 'ins_axis', 'neuro_toxicity', 'blood', 'vessels',
  'immunity', 'thyroid', 'prostate', 'skin'
] as const;

// Core systems (displayed in main risk summary)
export const CORE_SYSTEMS_V7 = [
  'cardio', 'hepatic', 'renal', 'neuro', 'endocrine', 'hematologic', 'reproductive', 'musculoskeletal'
] as const;

// Subsystem parent mapping
export const SUBSYSTEM_PARENT_V7: Record<string, string> = {
  vessels: 'cardio',
  metabolic: 'endocrine',
  ghigf: 'endocrine',
  ins_axis: 'endocrine',
  neuro_toxicity: 'neuro',
  blood: 'hematologic',
};
export type RiskSystemV7 = typeof RISK_SYSTEMS_V7[number];

export const SYSTEM_NAMES_RU: Record<string, string> = {
  cardio: '❤️ Сердечно-сосудистая',
  hepatic: '🫁 Печень',
  renal: '💧 Почки',
  neuro: '🧠 Нервная система',
  endocrine: '⚖️ Эндокринная',
  hematologic: '🩸 Кроветворная',
  reproductive: '💪 Репродуктивная',
  musculoskeletal: '🦴 ОДА/Мышцы',
  metabolic: '⚖️ Метаболизм',
  ghigf: '💪 ГР/ИФР-1',
  ins_axis: '💉 Инсулиновая ось',
  neuro_toxicity: '⚠️ Нейротоксичность',
  blood: '🩸 Кровь',
  vessels: '🫀 Сосуды',
  immunity: '🛡️ Иммунная',
  thyroid: '🦋 Щитовидная',
  prostate: '🔬 Простата',
  skin: '🧴 Кожа',
};

export const MECHANISM_NAMES: Record<string, Record<number, string>> = {
  cardio: { 1: 'Дислипидемия', 2: 'Артериальная гипертензия', 3: 'Гипертрофия ЛЖ', 4: 'Тромбогенный потенциал', 5: 'Окислительный стресс миокарда', 6: 'Фиброз сердечной ткани', 7: 'Аритмогенность' },
  hepatic: { 1: 'Холестаз', 2: 'Цитолиз', 3: 'Окислительный стресс', 4: 'Митохондриальная дисфункция', 5: 'Активация звёздчатых клеток', 6: 'Нагрузка CYP450', 7: 'Прямая химическая токсичность' },
  renal: { 1: 'Гломерулярная гипертензия', 2: 'Тубулоинтерстициальный фиброз', 3: 'Протеинурия', 4: 'Электролитный дисбаланс', 5: 'Ишемия почечной ткани', 6: 'Нефролитиаз', 7: 'Токсичность метаболитов' },
  neuro: { 1: 'Дофаминовый дисбаланс', 2: 'Глутаматная эксайтотоксичность', 3: 'ГАМК-дисрегуляция', 4: 'Нейровоспаление', 5: 'Окислительный стресс нейронов', 6: 'Нарушение проницаемости ГЭБ', 7: 'Серотониновый дисбаланс' },
  endocrine: { 1: 'Подавление оси ГГЯ', 2: 'Ароматизация', 3: 'Пролактиновый всплеск', 4: 'Инсулинорезистентность', 5: 'Дисфункция щитовидной железы', 6: 'Дисбаланс кортизола', 7: 'Десенситизация рецепторов' },
  hematologic: { 1: 'Эритроцитоз', 2: 'Тромбоцитоз', 3: 'Лейкоцитоз', 4: 'Изменение реологии', 5: 'Дефицит железа', 6: 'Активация свёртывания', 7: 'Гемолиз' },
  reproductive: { 1: 'Атрофия тестикул', 2: 'Олигоспермия', 3: 'Морфология сперматозоидов', 4: 'Подвижность сперматозоидов', 5: 'Гиперплазия простаты', 6: 'Риск онкологии простаты', 7: 'Эректильная дисфункция' },
  metabolic: { 1: 'Инсулинорезистентность', 2: 'Дислипидемия', 3: 'Гипергликемия', 4: 'Висцеральное ожирение', 5: 'Подагра', 6: 'Метаболический синдром', 7: 'Липотоксичность', 8: 'Нарушение пуринового обмена' },
  ghigf: { 1: 'ИФР-1 избыток', 2: 'Задержка жидкости', 3: 'Гипертрофия органов', 4: 'Почечная нагрузка', 5: 'Гипергликемия от ГР', 6: 'Акромегалические изменения', 7: 'Неопластический потенциал' },
  ins_axis: { 1: 'Инсулинорезистентность', 2: 'Гипогликемия', 3: 'Дисфункция β-клеток', 4: 'Липотоксичность поджелудочной', 5: 'Глюконеогенез печени', 6: 'Нарушение транспорта глюкозы', 7: 'Адипокиновый дисбаланс', 8: 'Гликемическая лабильность' },
  neuro_toxicity: { 1: 'Химическая нейротоксичность', 2: 'Нарушение аксонального транспорта', 3: 'Миелиновое повреждение', 4: 'Митохондриальная дисфункция нейронов', 5: 'Холинергическая дисфункция', 6: 'Опиоидная зависимость', 7: 'Нейроэндокринная токсичность', 8: 'Вестибулотоксичность' },
  blood: { 1: 'Полицитемия и гипервязкость', 2: 'Гиперкоагуляция', 3: 'Железодефицитная анемия', 4: 'Лейкоцитоз и воспаление', 5: 'Тромбоцитопатия', 6: 'Гемолиз', 7: 'ДВС-синдром и фибринолиз' },
  vessels: { 1: 'Эндотелиальная дисфункция', 2: 'Вазоконстрикция', 3: 'Атеросклероз', 4: 'Пролиферация интимы', 5: 'Васкулит и воспаление', 6: 'Микроангиопатия', 7: 'Аневризма и расслоение' },
  immunity: { 1: 'Иммуносупрессия Т-клеточная', 2: 'Цитокиновый дисбаланс', 3: 'Нарушение NK-клеточной активности', 4: 'Аутоиммунная активация', 5: 'Аллергические реакции', 6: 'Нарушение регенерации тканей', 7: 'Секреторный IgA дефицит' },
  thyroid: { 1: 'Снижение ТБГ', 2: 'Нарушение конверсии Т4→Т3', 3: 'Супрессия ТТГ', 4: 'Аутоиммунный тиреоидит', 5: 'Ятрогенный тиреотоксикоз', 6: 'Зоб и объём щитовидной', 7: 'Влияние на метаболизм' },
  prostate: { 1: 'ДГПЖ (доброкачественная гиперплазия)', 2: 'Простатит', 3: 'Риск рака простаты', 4: 'Нарушение мочеиспускания', 5: 'ДГТ-зависимая стимуляция', 6: 'Пролактиновая стимуляция простаты', 7: 'Эстрогенная стимуляция простаты' },
  skin: { 1: 'Андрогенная алопеция', 2: 'Акне и себорея', 3: 'Гипертрихоз', 4: 'Растяжки (стрии)', 5: 'Кожная пурпура', 6: 'Инъекционные осложнения', 7: 'Желтуха и кожный зуд' },
};

// --- Genetic Multipliers ---

export interface GeneticProfile {
  COMT?: string;
  MTHFR?: string;
  ESR1?: string;
  AGTR1?: string;
  NOS3?: string;
  SRD5A2?: string;
  CYP3A4?: string;
}

const GENETIC_TABLE: Record<string, Record<string, number>> = {
  COMT: { 'Met/Met': 2.0, 'Val/Met': 1.5, 'Val/Val': 1.0 },
  MTHFR: { 'TT': 1.7, 'CT': 1.3, 'CC': 1.0 },
  ESR1: { 'PvuII+': 1.4, 'PvuII-': 1.0 },
  AGTR1: { 'CC': 1.4, 'AC': 1.2, 'AA': 1.0 },
  NOS3: { 'TT': 1.3, 'GT': 1.15, 'GG': 1.0 },
  SRD5A2: { 'LL': 1.8, 'LV': 1.4, 'VV': 1.0 },
  CYP3A4: { '*22': 1.35, '*1/*22': 1.15, '*1/*1': 1.0 },
};

const GENE_SYSTEM_MAP: Record<string, Record<string, number[]>> = {
  COMT: { neuro: [1, 2] },
  MTHFR: { cardio: [4], neuro: [5] },
  ESR1: { endocrine: [2], reproductive: [7] },
  AGTR1: { cardio: [2, 3], renal: [1] },
  NOS3: { cardio: [5], reproductive: [7] },
  SRD5A2: { reproductive: [5, 6] },
  CYP3A4: { hepatic: [6] },
};

export function getGeneticMultiplier(genetics: GeneticProfile, system: string, mechIdx: number): number {
  let mult = 1.0;
  for (const [gene, systemMap] of Object.entries(GENE_SYSTEM_MAP)) {
    const genotype = genetics[gene as keyof GeneticProfile];
    if (!genotype) continue;
    const mechs = systemMap[system];
    if (!mechs) continue;
    if (mechs.includes(mechIdx)) {
      mult *= GENETIC_TABLE[gene]?.[genotype] ?? 1.0;
    }
  }
  return mult;
}

// --- Drug Thresholds & Contributions (ALL PHARMA_DB substances) ---

export interface DrugThreshold {
  dosePerWeek: number;
  androgenicity: number;
  systems: Record<string, Record<number, number>>;
}

// Mapping rules from PD params to 7x7 mechanisms:
// AR_affinity > endocrine 1, reproductive 1,2,5,6
// aromatization > endocrine 2, reproductive 7, cardio 1(partly)
// hepatotoxicity > hepatic 1,7, hepatic 2(0.5x), hepatic 6(oral AAS)
// lipid_impact (negative = harmful) > cardio 1, metabolic 2
// hct_impact > hematologic 1,4, cardio 3
// neuro_toxicity > neuro 1,2,3
// progestogenic > endocrine 3, reproductive 1(secondary)
// five_alpha_reduction > reproductive 5, reproductive 6(partly)
// Class-specific: peptides(GH/IGF/GHRP) > endocrine 4, ghigf 1,2, metabolic 3
// Insulins > endocrine 4, ins_axis 1,2
// SERMs/AIs > endocrine 2(negative for AIs), reproductive 7
// Dopamine agonists > endocrine 3(negative), neuro 1(negative)

export const DRUG_THRESHOLDS_V7: Record<string, DrugThreshold> = {
  // === TESTOSTERONE ===
  test_prop: { dosePerWeek: 300, androgenicity: 1.0, systems: {
    cardio: { 2: 0.3, 3: 0.4, 4: 0.3 },
    hepatic: { 7: 0.1 },
    endocrine: { 1: 0.8, 2: 0.6 },
    hematologic: { 1: 0.7, 4: 0.3 },
    reproductive: { 1: 0.7, 2: 0.5, 5: 0.2 },
  }},
  test_enan: { dosePerWeek: 300, androgenicity: 1.0, systems: {
    cardio: { 2: 0.3, 3: 0.4, 4: 0.3 },
    hepatic: { 7: 0.1 },
    endocrine: { 1: 0.8, 2: 0.6 },
    hematologic: { 1: 0.7, 4: 0.3 },
    reproductive: { 1: 0.7, 2: 0.5, 5: 0.2 },
  }},
  test_cyp: { dosePerWeek: 300, androgenicity: 1.0, systems: {
    cardio: { 2: 0.3, 3: 0.4, 4: 0.3 },
    hepatic: { 7: 0.1 },
    endocrine: { 1: 0.8, 2: 0.6 },
    hematologic: { 1: 0.7, 4: 0.3 },
    reproductive: { 1: 0.7, 2: 0.5, 5: 0.2 },
  }},
  test_undec: { dosePerWeek: 300, androgenicity: 1.0, systems: {
    cardio: { 2: 0.3, 3: 0.4, 4: 0.3 },
    hepatic: { 7: 0.1 },
    endocrine: { 1: 0.8, 2: 0.6 },
    hematologic: { 1: 0.7, 4: 0.3 },
    reproductive: { 1: 0.7, 2: 0.5, 5: 0.2 },
  }},

  // === TRENBOLONE ===
  tren_acet: { dosePerWeek: 100, androgenicity: 1.8, systems: {
    cardio: { 2: 0.5, 7: 0.4 },
    hepatic: { 1: 0.6, 7: 0.5 },
    neuro: { 1: 0.7, 3: 0.5, 2: 0.4 },
    endocrine: { 1: 0.9, 3: 0.6 },
    renal: { 1: 0.3 },
    hematologic: { 1: 0.6 },
    reproductive: { 1: 0.8 },
  }},
  tren_enan: { dosePerWeek: 100, androgenicity: 1.8, systems: {
    cardio: { 2: 0.5, 7: 0.4 },
    hepatic: { 1: 0.6, 7: 0.5 },
    neuro: { 1: 0.7, 3: 0.5, 2: 0.4 },
    endocrine: { 1: 0.9, 3: 0.6 },
    renal: { 1: 0.3 },
    hematologic: { 1: 0.6 },
    reproductive: { 1: 0.8 },
  }},
  tren_hex: { dosePerWeek: 100, androgenicity: 1.8, systems: {
    cardio: { 2: 0.5, 7: 0.4 },
    hepatic: { 1: 0.6, 7: 0.5 },
    neuro: { 1: 0.7, 3: 0.5, 2: 0.4 },
    endocrine: { 1: 0.9, 3: 0.6 },
    renal: { 1: 0.3 },
    hematologic: { 1: 0.6 },
    reproductive: { 1: 0.8 },
  }},

  // === NANDROLONE ===
  npp: { dosePerWeek: 150, androgenicity: 0.6, systems: {
    cardio: { 2: 0.2, 3: 0.3 },
    endocrine: { 1: 0.7, 3: 0.4 },
    hematologic: { 1: 0.5 },
    reproductive: { 1: 0.6, 5: 0.3 },
    renal: { 3: 0.3 },
  }},
  deca: { dosePerWeek: 150, androgenicity: 0.6, systems: {
    cardio: { 2: 0.2, 3: 0.3 },
    endocrine: { 1: 0.7, 3: 0.4 },
    hematologic: { 1: 0.5 },
    reproductive: { 1: 0.6, 5: 0.3 },
    renal: { 3: 0.3 },
  }},

  // === BOLDENONE ===
  bold_undec: { dosePerWeek: 200, androgenicity: 0.5, systems: {
    cardio: { 1: 0.35, 2: 0.2, 3: 0.3 },
    endocrine: { 1: 0.5, 2: 0.3 },
    hematologic: { 1: 0.45 },
    reproductive: { 1: 0.4 },
  }},

  // === PRIMOBOLAN ===
  prim_enan: { dosePerWeek: 200, androgenicity: 0.4, systems: {
    endocrine: { 1: 0.5, 7: 0.2 },
    hematologic: { 1: 0.3 },
    reproductive: { 1: 0.4 },
  }},

  // === ORAL 17-AA ===
  methand: { dosePerWeek: 30, androgenicity: 0.6, systems: {
    hepatic: { 1: 0.7, 6: 0.5, 7: 0.8 },
    cardio: { 1: 0.3, 2: 0.3 },
    endocrine: { 1: 0.7, 2: 0.5 },
    hematologic: { 1: 0.5 },
  }},
  oxan: { dosePerWeek: 50, androgenicity: 0.3, systems: {
    hepatic: { 1: 0.5, 7: 0.7 },
    endocrine: { 1: 0.5 },
    hematologic: { 1: 0.3 },
    renal: { 7: 0.2 },
  }},
  stan: { dosePerWeek: 30, androgenicity: 0.3, systems: {
    hepatic: { 1: 0.8, 6: 0.6, 7: 0.8 },
    cardio: { 1: 0.4, 4: 0.3 },
    hematologic: { 1: 0.4, 4: 0.3 },
    endocrine: { 1: 0.5 },
  }},
  trena: { dosePerWeek: 50, androgenicity: 0.5, systems: {
    hepatic: { 1: 0.6, 7: 0.6 },
    endocrine: { 1: 0.5, 2: 0.2 },
    cardio: { 1: 0.3, 2: 0.2 },
    hematologic: { 1: 0.4 },
  }},
  halo: { dosePerWeek: 20, androgenicity: 0.55, systems: {
    hepatic: { 1: 0.7, 7: 0.7 },
    neuro: { 1: 0.5, 3: 0.4 },
    endocrine: { 1: 0.6 },
    cardiovascular: { 2: 0.3 },
    hematologic: { 1: 0.4 },
  }},
  superdrol: { dosePerWeek: 20, androgenicity: 0.7, systems: {
    hepatic: { 1: 0.8, 6: 0.6, 7: 0.9 },
    cardio: { 1: 0.4, 2: 0.3 },
    endocrine: { 1: 0.6 },
    hematologic: { 1: 0.5 },
  }},
  anadrol: { dosePerWeek: 50, androgenicity: 0.4, systems: {
    hepatic: { 1: 0.9, 7: 0.9 },
    cardio: { 2: 0.4 },
    hematologic: { 1: 0.8, 4: 0.3 },
    endocrine: { 1: 0.6 },
  }},

  // === DROSTANOLONE ===
  drostanolone_prop: { dosePerWeek: 200, androgenicity: 0.45, systems: {
    endocrine: { 1: 0.5, 7: 0.2 },
    reproductive: { 5: 0.3, 6: 0.2 },
    hematologic: { 1: 0.3 },
  }},
  drostanolone_enan: { dosePerWeek: 200, androgenicity: 0.45, systems: {
    endocrine: { 1: 0.5, 7: 0.2 },
    reproductive: { 5: 0.3, 6: 0.2 },
    hematologic: { 1: 0.3 },
  }},

  // === MESTEROLONE ===
  mesterolone: { dosePerWeek: 100, androgenicity: 0.55, systems: {
    endocrine: { 1: 0.4, 7: 0.15 },
    reproductive: { 7: 0.2 },
    hepatic: { 7: 0.3 },
  }},

  // === SARMS ===
  ostarine: { dosePerWeek: 15, androgenicity: 0.25, systems: {
    hepatic: { 7: 0.2 },
    endocrine: { 1: 0.3, 7: 0.15 },
    hematologic: { 1: 0.15 },
  }},
  lgd: { dosePerWeek: 10, androgenicity: 0.3, systems: {
    hepatic: { 7: 0.3 },
    endocrine: { 1: 0.4 },
    hematologic: { 1: 0.25 },
  }},
  rad140: { dosePerWeek: 15, androgenicity: 0.3, systems: {
    hepatic: { 7: 0.25 },
    endocrine: { 1: 0.4 },
    hematologic: { 1: 0.2 },
    neuro: { 1: 0.15 },
  }},
  s23: { dosePerWeek: 15, androgenicity: 0.35, systems: {
    hepatic: { 7: 0.2 },
    endocrine: { 1: 0.5, 7: 0.15 },
    hematologic: { 1: 0.3 },
    reproductive: { 1: 0.4 },
  }},

  // === PEPTIDES (GH/IGF/GHRP) ===
  cjc1295: { dosePerWeek: 2, androgenicity: 0, systems: {
    endocrine: { 4: 0.05 },
    ghigf: { 1: 0.15, 2: 0.1 },
  }},
  ghrp6: { dosePerWeek: 5, androgenicity: 0, systems: {
    endocrine: { 4: 0.05 },
    ghigf: { 1: 0.12, 2: 0.08 },
  }},
  ghrp2: { dosePerWeek: 5, androgenicity: 0, systems: {
    endocrine: { 4: 0.05 },
    ghigf: { 1: 0.12, 2: 0.08 },
  }},
  ipamorelin: { dosePerWeek: 5, androgenicity: 0, systems: {
    endocrine: { 4: 0.03 },
    ghigf: { 1: 0.1, 2: 0.06 },
  }},
  sermorelin: { dosePerWeek: 2, androgenicity: 0, systems: {
    endocrine: { 4: 0.03 },
    ghigf: { 1: 0.08 },
  }},
  mk677: { dosePerWeek: 3.5, androgenicity: 0, systems: {
    endocrine: { 4: 0.08 },
    ghigf: { 1: 0.15, 2: 0.1 },
    metabolic: { 2: 0.05 },
  }},
  igf1_lr3: { dosePerWeek: 0.5, androgenicity: 0, systems: {
    ghigf: { 1: 0.3 },
    metabolic: { 3: 0.15 },
    cardio: { 3: 0.1 },
  }},
  igf1_des: { dosePerWeek: 0.5, androgenicity: 0, systems: {
    ghigf: { 1: 0.25 },
    metabolic: { 3: 0.12 },
  }},
  mgf: { dosePerWeek: 1, androgenicity: 0, systems: {
    ghigf: { 1: 0.1 },
  }},
  peg_mgf: { dosePerWeek: 1, androgenicity: 0, systems: {
    ghigf: { 1: 0.1 },
  }},
  hgh_frag: { dosePerWeek: 3, androgenicity: 0, systems: {
    metabolic: { 2: 0.1 },
  }},

  // === INSULIN ===
  ins_short: { dosePerWeek: 50, androgenicity: 0, systems: {
    endocrine: { 4: 0.4 },
    ins_axis: { 1: 0.3, 2: 0.2 },
    metabolic: { 1: 0.15 },
  }},
  ins_long: { dosePerWeek: 50, androgenicity: 0, systems: {
    endocrine: { 4: 0.35 },
    ins_axis: { 1: 0.25, 2: 0.25 },
    metabolic: { 1: 0.12 },
  }},
  ins_aspart: { dosePerWeek: 50, androgenicity: 0, systems: {
    endocrine: { 4: 0.4 },
    ins_axis: { 1: 0.3, 2: 0.2 },
    metabolic: { 1: 0.15 },
  }},
  ins_detemir: { dosePerWeek: 50, androgenicity: 0, systems: {
    endocrine: { 4: 0.3 },
    ins_axis: { 1: 0.2, 2: 0.25 },
    metabolic: { 1: 0.1 },
  }},

  // === PCT SERMs ===
  clomi: { dosePerWeek: 70, androgenicity: 0, systems: {
    endocrine: { 1: -0.3, 3: -0.2 },  // reduces HPTA suppression, reduces prolactin
    reproductive: { 7: -0.15 },
    hepatic: { 7: 0.1 },
  }},
  tamox: { dosePerWeek: 20, androgenicity: 0, systems: {
    endocrine: { 2: -0.3, 1: -0.2 },  // anti-aromatization, anti-HPTA suppression
    reproductive: { 7: -0.2 },
    hepatic: { 7: 0.08 },
    hematologic: { 1: -0.1 },
  }},
  anastro: { dosePerWeek: 1, androgenicity: 0, systems: {
    endocrine: { 2: -0.4 },  // strong anti-aromatization
    reproductive: { 7: 0.1 },
    hepatic: { 7: 0.05 },
    cardio: { 1: 0.1 },  // worsens lipid profile
  }},
  letrozole: { dosePerWeek: 0.5, androgenicity: 0, systems: {
    endocrine: { 2: -0.45 },  // very strong anti-aromatization
    reproductive: { 7: 0.15 },
    cardio: { 1: 0.15 },  // worsens lipid profile more
  }},
  exemestane: { dosePerWeek: 12.5, androgenicity: 0, systems: {
    endocrine: { 2: -0.4 },  // steroidal AI, irreversible
    reproductive: { 7: 0.1 },
    cardio: { 1: 0.1 },  // less lipid impact than letrozole
  }},

  // === DOPAMINE AGONISTS ===
  caberg: { dosePerWeek: 0.5, androgenicity: 0, systems: {
    endocrine: { 3: -0.5 },  // reduces prolactin
    neuro: { 1: -0.2 },
  }},
  bromocriptine: { dosePerWeek: 3.5, androgenicity: 0, systems: {
    endocrine: { 3: -0.4 },
    neuro: { 1: -0.15 },
  }},

  // === HCG ===
  hcg: { dosePerWeek: 1000, androgenicity: 0, systems: {
    reproductive: { 1: -0.3, 2: -0.2 },  // reduces testicular atrophy
    endocrine: { 3: 0.1 },  // slight prolactin increase
  }},

  // === CARDIO PROTECTANTS ===
  telmi: { dosePerWeek: 70, androgenicity: 0, systems: {
    cardio: { 2: -0.3, 3: -0.2 },
    renal: { 1: -0.25 },
  }},
  nebivolol: { dosePerWeek: 7, androgenicity: 0, systems: {
    cardio: { 2: -0.25, 7: -0.1 },
    neuro: { 3: -0.05 },
  }},

  // === LIVER SUPPORT ===
  nac: { dosePerWeek: 1200, androgenicity: 0, systems: {
    hepatic: { 3: -0.3, 7: -0.2 },
    renal: { 7: -0.1 },
  }},
  tudca: { dosePerWeek: 700, androgenicity: 0, systems: {
    hepatic: { 1: -0.3, 2: -0.2, 7: -0.25 },
  }},
  milk_thistle: { dosePerWeek: 2100, androgenicity: 0, systems: {
    hepatic: { 1: -0.2, 2: -0.2, 7: -0.15 },
  }},
  phosphatidylcholine: { dosePerWeek: 1800, androgenicity: 0, systems: {
    hepatic: { 3: -0.15, 5: -0.1 },
  }},
  // === EXTENDED LIVER SUPPORT (Critical Additions) ===
  sam_e: { dosePerWeek: 2800, androgenicity: 0, systems: {
    hepatic: { 3: -0.25, 7: -0.2 },
    neuro: { 5: -0.15, 4: -0.1 },
    hematologic: { 5: -0.1 },
  }},
  alpha_lipoic: { dosePerWeek: 2100, androgenicity: 0, systems: {
    hepatic: { 3: -0.2, 7: -0.15 },
    neuro: { 5: -0.25 },
  }},
  glycyrrhizic_acid: { dosePerWeek: 350, androgenicity: 0, systems: {
    hepatic: { 2: -0.2, 1: -0.15, 7: -0.1 },
    endocrine: { 5: -0.1 },
  }},
  artichoke: { dosePerWeek: 3500, androgenicity: 0, systems: {
    hepatic: { 2: -0.15, 7: -0.1 },
    cardio: { 1: -0.1 },
  }},

  // === OMEGA-3 / LIPID SUPPORT ===
  omega3: { dosePerWeek: 14000, androgenicity: 0, systems: {
    cardio: { 1: -0.25, 5: -0.2 },
    neuro: { 4: -0.15, 5: -0.2 },
    hepatic: { 3: -0.1 },
  }},

  // === MINERALS & VITAMINS ===
  magnesium: { dosePerWeek: 2100, androgenicity: 0, systems: {
    cardio: { 7: -0.15, 2: -0.1 },
    neuro: { 3: -0.1 },
  }},
  zinc_sup: { dosePerWeek: 210, androgenicity: 0, systems: {
    reproductive: { 1: -0.1, 2: -0.1 },
    endocrine: { 1: -0.1 },
  }},
  vitamin_d3: { dosePerWeek: 5.6, androgenicity: 0, systems: {
    endocrine: { 5: -0.15 },
    reproductive: { 5: -0.1 },
    hepatic: { 7: -0.05 },
  }},
  vitamin_k2: { dosePerWeek: 0.7, androgenicity: 0, systems: {
    cardio: { 1: -0.1 },
    hepatic: { 5: -0.05 },
  }},
  vitamin_b6: { dosePerWeek: 21, androgenicity: 0, systems: {
    neuro: { 4: -0.1, 5: -0.1 },
  }},
  vitamin_b12: { dosePerWeek: 2.1, androgenicity: 0, systems: {
    hematologic: { 5: -0.1 },
    hepatic: { 7: -0.05 },
  }},
  folate: { dosePerWeek: 7, androgenicity: 0, systems: {
    cardio: { 4: -0.1 },
    hematologic: { 5: -0.1 },
  }},
  boron: { dosePerWeek: 21, androgenicity: 0, systems: {
    endocrine: { 1: -0.05 },
    reproductive: { 7: -0.05 },
  }},
  selenium_sup: { dosePerWeek: 1.4, androgenicity: 0, systems: {
    hepatic: { 3: -0.1, 7: -0.1 },
  }},
  coq10: { dosePerWeek: 700, androgenicity: 0, systems: {
    cardio: { 5: -0.15, 6: -0.1 },
    neuro: { 5: -0.1 },
  }},

  // === ANTI-INFLAMMATORY / ADAPTOGENS ===
  aspirin: { dosePerWeek: 700, androgenicity: 0, systems: {
    cardio: { 4: -0.2 },
    hematologic: { 6: -0.15 },
  }},
  berberine: { dosePerWeek: 2100, androgenicity: 0, systems: {
    endocrine: { 4: -0.2 },
    cardio: { 1: -0.15 },
    hepatic: { 3: -0.05 },
  }},
  red_yeast_rice: { dosePerWeek: 1200, androgenicity: 0, systems: {
    cardio: { 2: -0.3, 1: -0.15 },
    hepatic: { 7: 0.1 },
  }},
  ezetimibe: { dosePerWeek: 70, androgenicity: 0, systems: {
    cardio: { 2: -0.25, 1: -0.1 },
    hepatic: { 7: 0.05 },
  }},
  niacin: { dosePerWeek: 3500, androgenicity: 0, systems: {
    cardio: { 2: -0.2, 1: -0.15 },
    endocrine: { 4: 0.05 },
  }},
  policosanol: { dosePerWeek: 140, androgenicity: 0, systems: {
    cardio: { 2: -0.15, 1: -0.1 },
  }},
  curcumin_sup: { dosePerWeek: 3500, androgenicity: 0, systems: {
    hepatic: { 3: -0.15, 7: -0.1 },
    neuro: { 4: -0.1, 5: -0.1 },
    cardio: { 5: -0.05 },
  }},
  ashwagandha: { dosePerWeek: 3500, androgenicity: 0, systems: {
    neuro: { 3: -0.2, 7: -0.15 },
    endocrine: { 6: -0.15 },
  }},
  taurine_sup: { dosePerWeek: 2100, androgenicity: 0, systems: {
    cardio: { 2: -0.1, 5: -0.15 },
    hepatic: { 7: -0.1 },
  }},
  ginseng_sup: { dosePerWeek: 3500, androgenicity: 0, systems: {
    neuro: { 1: -0.08, 4: -0.08 },
    endocrine: { 6: -0.05 },
  }},
  saw_palmetto: { dosePerWeek: 3500, androgenicity: 0, systems: {
    reproductive: { 5: -0.1, 6: -0.05 },
    endocrine: { 7: -0.05 },
  }},
  tongkat_ali: { dosePerWeek: 2100, androgenicity: 0, systems: {
    endocrine: { 1: -0.05 },
    neuro: { 1: -0.05 },
  }},
  shilajit: { dosePerWeek: 3500, androgenicity: 0, systems: {
    metabolic: { 2: -0.05 },
    neuro: { 5: -0.05 },
  }},
  fadogia: { dosePerWeek: 2100, androgenicity: 0, systems: {
    reproductive: { 1: -0.1 },
  }},
  probiotics_sup: { dosePerWeek: 7000, androgenicity: 0, systems: {
    hepatic: { 3: -0.1, 7: -0.1 },
  }},
  same: { dosePerWeek: 2800, androgenicity: 0, systems: {
    hepatic: { 1: -0.15, 3: -0.1, 7: -0.15 },
    neuro: { 3: -0.1, 4: -0.1 },
  }},
  glycyrrhizin: { dosePerWeek: 350, androgenicity: 0, systems: {
    hepatic: { 2: -0.2, 3: -0.15, 7: -0.1 },
    cardio: { 3: 0.1 },
  }},
  pentoxifylline: { dosePerWeek: 2800, androgenicity: 0, systems: {
    hematologic: { 1: -0.2, 4: -0.15, 5: -0.1 },
    cardio: { 7: -0.05 },
  }},
  enoxaparin: { dosePerWeek: 280, androgenicity: 0, systems: {
    hematologic: { 4: -0.3, 5: -0.2 },
    cardio: { 7: 0.1 },
  }},
  ketosteril: { dosePerWeek: 4200, androgenicity: 0, systems: {
    renal: { 1: -0.2, 2: -0.15, 3: -0.1, 4: -0.1 },
    hematologic: { 5: -0.05 },
  }},
  sodium_bicarbonate: { dosePerWeek: 21000, androgenicity: 0, systems: {
    renal: { 2: -0.15, 4: -0.1 },
    cardio: { 3: 0.05 },
  }},

  // === REGENERATIVE PEPTIDES ===
  bpc157: { dosePerWeek: 3.5, androgenicity: 0, systems: {
    hepatic: { 3: -0.15, 7: -0.1 },
    neuro: { 4: -0.1 },
  }},
  tb500: { dosePerWeek: 5, androgenicity: 0, systems: {
    neuro: { 4: -0.05 },
  }},
  thymosin_a1: { dosePerWeek: 3.5, androgenicity: 0, systems: {
    hepatic: { 3: -0.05 },
  }},
  ghk_cu: { dosePerWeek: 7, androgenicity: 0, systems: {} },
  dsip: { dosePerWeek: 3.5, androgenicity: 0, systems: {
    neuro: { 3: -0.1, 5: -0.05 },
  }},

  // === NEURO PEPTIDES ===
  semax: { dosePerWeek: 7, androgenicity: 0, systems: {
    neuro: { 1: -0.15, 4: -0.1, 5: -0.1 },
  }},
  selank: { dosePerWeek: 7, androgenicity: 0, systems: {
    neuro: { 3: -0.12, 7: -0.1 },
  }},
  epitalon: { dosePerWeek: 3.5, androgenicity: 0, systems: {
    neuro: { 5: -0.08 },
  }},

  // === OTHER PEPTIDES ===
  gonadorelin: { dosePerWeek: 1.75, androgenicity: 0, systems: {
    endocrine: { 1: -0.2 },
    reproductive: { 1: -0.15 },
  }},
  melanotan2: { dosePerWeek: 3.5, androgenicity: 0, systems: {} },
  aod9604: { dosePerWeek: 7, androgenicity: 0, systems: {
    metabolic: { 2: -0.1 },
  }},
  mots_c: { dosePerWeek: 5, androgenicity: 0, systems: {
    metabolic: { 1: -0.08, 2: -0.08 },
  }},
  ss31: { dosePerWeek: 7, androgenicity: 0, systems: {
    cardio: { 5: -0.1, 6: -0.1 },
  }},
  foxo4_dri: { dosePerWeek: 5, androgenicity: 0, systems: {} }
};

// --- Lab reference ranges ---

export const LAB_REFERENCES: Record<string, { mean: number; sd: number; uln: number; sensitive: boolean; alpha: number }> = {
  ALT: { mean: 25, sd: 10, uln: 40, sensitive: true, alpha: 0.5 },
  AST: { mean: 22, sd: 8, uln: 35, sensitive: true, alpha: 0.5 },
  GGT: { mean: 30, sd: 15, uln: 50, sensitive: false, alpha: 0.2 },
  ALP: { mean: 70, sd: 20, uln: 120, sensitive: false, alpha: 0.2 },
  Bilirubin: { mean: 10, sd: 4, uln: 20, sensitive: false, alpha: 0.2 },
  SBP: { mean: 120, sd: 12, uln: 140, sensitive: false, alpha: 0.2 },
  DBP: { mean: 80, sd: 8, uln: 90, sensitive: false, alpha: 0.2 },
  Hct: { mean: 0.45, sd: 0.04, uln: 0.52, sensitive: true, alpha: 0.5 },
  Hb: { mean: 150, sd: 12, uln: 170, sensitive: false, alpha: 0.2 },
  WBC: { mean: 7.0, sd: 2.0, uln: 11.0, sensitive: false, alpha: 0.2 },
  PLT: { mean: 250, sd: 50, uln: 400, sensitive: false, alpha: 0.2 },
  LDL: { mean: 2.8, sd: 0.8, uln: 3.4, sensitive: false, alpha: 0.2 },
  HDL: { mean: 1.4, sd: 0.3, uln: 2.0, sensitive: false, alpha: 0.2 },
  TG: { mean: 1.2, sd: 0.5, uln: 1.7, sensitive: false, alpha: 0.2 },
  NonHDL: { mean: 3.2, sd: 0.9, uln: 4.0, sensitive: false, alpha: 0.2 },
  Glucose: { mean: 5.0, sd: 0.5, uln: 5.8, sensitive: true, alpha: 0.5 },
  HbA1c: { mean: 5.0, sd: 0.5, uln: 5.7, sensitive: false, alpha: 0.2 },
  eGFR: { mean: 100, sd: 15, uln: 120, sensitive: false, alpha: 0.2 },
  Creatinine: { mean: 80, sd: 15, uln: 106, sensitive: false, alpha: 0.2 },
  Proteinuria: { mean: 0, sd: 10, uln: 30, sensitive: false, alpha: 0.2 },
  Fibrinogen: { mean: 3.0, sd: 0.6, uln: 4.0, sensitive: false, alpha: 0.2 },
  D_dimer: { mean: 0.3, sd: 0.2, uln: 0.5, sensitive: false, alpha: 0.2 },
  CRP: { mean: 1.0, sd: 1.0, uln: 5.0, sensitive: false, alpha: 0.2 },
  IL6: { mean: 2.0, sd: 1.5, uln: 7.0, sensitive: false, alpha: 0.2 },
  TNF: { mean: 3.0, sd: 1.5, uln: 8.0, sensitive: false, alpha: 0.2 },
  Homocysteine: { mean: 10, sd: 3, uln: 15, sensitive: false, alpha: 0.2 },
  Prolactin: { mean: 10, sd: 4, uln: 20, sensitive: false, alpha: 0.2 },
  PSA: { mean: 1.0, sd: 0.5, uln: 4.0, sensitive: false, alpha: 0.2 },
  Na: { mean: 140, sd: 3, uln: 145, sensitive: false, alpha: 0.2 },
  K: { mean: 4.2, sd: 0.4, uln: 5.0, sensitive: false, alpha: 0.2 },
  Mg: { mean: 0.85, sd: 0.08, uln: 1.0, sensitive: false, alpha: 0.2 },
  Testosterone: { mean: 15, sd: 5, uln: 30, sensitive: false, alpha: 0.2 },
  Estradiol: { mean: 30, sd: 15, uln: 80, sensitive: false, alpha: 0.2 },
  LH: { mean: 5, sd: 2, uln: 10, sensitive: false, alpha: 0.2 },
  FSH: { mean: 5, sd: 2, uln: 10, sensitive: false, alpha: 0.2 },
  TSH: { mean: 2.0, sd: 1.0, uln: 4.0, sensitive: false, alpha: 0.2 },
  Cortisol: { mean: 300, sd: 100, uln: 600, sensitive: false, alpha: 0.2 },
  IGF1: { mean: 200, sd: 50, uln: 350, sensitive: false, alpha: 0.2 },
  Insulin: { mean: 8, sd: 4, uln: 25, sensitive: true, alpha: 0.5 },
  HOMA_IR: { mean: 1.5, sd: 0.8, uln: 2.5, sensitive: true, alpha: 0.5 },
  Waist: { mean: 85, sd: 10, uln: 100, sensitive: false, alpha: 0.2 },
  LVmass: { mean: 100, sd: 20, uln: 125, sensitive: false, alpha: 0.2 },
  Weight_acute: { mean: 0, sd: 1, uln: 3, sensitive: false, alpha: 0.2 },
  OxidativeMarkers: { mean: 1.0, sd: 0.5, uln: 2.0, sensitive: false, alpha: 0.2 },
  Ferritin: { mean: 100, sd: 50, uln: 300, sensitive: false, alpha: 0.2 },
  Transferrin: { mean: 2.5, sd: 0.4, uln: 3.5, sensitive: false, alpha: 0.2 },
  LDH: { mean: 200, sd: 40, uln: 250, sensitive: false, alpha: 0.2 },
  Haptoglobin: { mean: 1.0, sd: 0.4, uln: 2.0, sensitive: false, alpha: 0.2 },
  RBC: { mean: 5.0, sd: 0.4, uln: 5.8, sensitive: false, alpha: 0.2 },
};

// --- Matrix Input/Output types ---

export interface MatrixInput {
  labs: LabPoint[];
  course: CourseEntry[];
  genetics: GeneticProfile;
  nutrition: {
    proteinPerKg: number;
    fiberG: number;
    omega3G: number;
    sodiumG: number;
    potassiumG: number;
  };
  training: {
    workoutsPerWeek: number;
    avgWorkoutMinutes: number;
    hasHIIT: boolean;
    volumeTonnes: number;
    lissMinutesPerWeek: number;
  };
  mode: ProtocolMode;
  stazhWeeks: number;
  continuousWeeks: number;
}

export interface MechanismRisk {
  P_raw: number;
  P_net: number;
  geneticMult: number;
  labFactor: number;
  nutritionFactor: number;
  trainingFactor: number;
  modeFactor: number;
  supportFactor: number;
}

export interface SystemRisk {
  raw: number;
  net: number;
  mechanisms: Record<number, MechanismRisk>;
}

export interface MatrixResult {
  systems: Record<string, SystemRisk>;
  overallRaw: number;
  overallNet: number;
  drugContributions: Record<string, Record<string, Record<number, number>>>;
}

// Base risk per (system, mechanism)
const BASE_RISK: Record<string, Record<number, number>> = {
  cardio: { 1: 0.08, 2: 0.10, 3: 0.06, 4: 0.07, 5: 0.05, 6: 0.04, 7: 0.05, 8: 0.04 },
  hepatic: { 1: 0.07, 2: 0.08, 3: 0.06, 4: 0.05, 5: 0.04, 6: 0.06, 7: 0.08, 8: 0.06 },
  renal: { 1: 0.06, 2: 0.04, 3: 0.05, 4: 0.04, 5: 0.03, 6: 0.02, 7: 0.04 },
  neuro: { 1: 0.08, 2: 0.07, 3: 0.06, 4: 0.06, 5: 0.05, 6: 0.04, 7: 0.06, 8: 0.04 },
  endocrine: { 1: 0.10, 2: 0.08, 3: 0.07, 4: 0.06, 5: 0.04, 6: 0.05, 7: 0.05, 8: 0.05 },
  hematologic: { 1: 0.08, 2: 0.06, 3: 0.04, 4: 0.05, 5: 0.03, 6: 0.07, 7: 0.04 },
  reproductive: { 1: 0.10, 2: 0.08, 3: 0.05, 4: 0.04, 5: 0.06, 6: 0.04, 7: 0.07 },
  musculoskeletal: { 1: 0.05, 2: 0.04, 3: 0.04, 4: 0.03, 5: 0.04, 6: 0.03, 7: 0.03 },
  metabolic: { 1: 0.07, 2: 0.08, 3: 0.05, 4: 0.04, 5: 0.03, 6: 0.06 },
  ghigf: { 1: 0.04, 2: 0.05, 3: 0.03, 4: 0.04, 5: 0.05 },
  ins_axis: { 1: 0.06, 2: 0.04 },
  neuro_toxicity: { 1: 0.08, 2: 0.07, 3: 0.06, 4: 0.06, 5: 0.05, 6: 0.04, 7: 0.06 },
  blood: { 1: 0.08, 2: 0.06, 3: 0.05, 4: 0.04, 5: 0.03, 6: 0.03, 7: 0.04 },
  vessels: { 1: 0.06, 2: 0.05, 3: 0.08, 4: 0.04, 5: 0.04, 6: 0.03, 7: 0.03 },
};

const MECH_WEIGHTS: Record<string, Record<number, number>> = {
  cardio: { 1: 0.14, 2: 0.16, 3: 0.12, 4: 0.13, 5: 0.11, 6: 0.10, 7: 0.12, 8: 0.12 },
  hepatic: { 1: 0.15, 2: 0.15, 3: 0.12, 4: 0.11, 5: 0.10, 6: 0.11, 7: 0.13, 8: 0.13 },
  renal: { 1: 0.20, 2: 0.17, 3: 0.16, 4: 0.14, 5: 0.13, 6: 0.08, 7: 0.12 },
  neuro: { 1: 0.16, 2: 0.13, 3: 0.11, 4: 0.15, 5: 0.12, 6: 0.09, 7: 0.12, 8: 0.12 },
  endocrine: { 1: 0.18, 2: 0.14, 3: 0.12, 4: 0.12, 5: 0.09, 6: 0.10, 7: 0.12, 8: 0.13 },
  hematologic: { 1: 0.20, 2: 0.14, 3: 0.10, 4: 0.14, 5: 0.08, 6: 0.18, 7: 0.16 },
  reproductive: { 1: 0.20, 2: 0.16, 3: 0.10, 4: 0.08, 5: 0.18, 6: 0.12, 7: 0.16 },
  musculoskeletal: { 1: 0.18, 2: 0.14, 3: 0.14, 4: 0.10, 5: 0.16, 6: 0.12, 7: 0.16 },
  metabolic: { 1: 0.25, 2: 0.20, 3: 0.15, 4: 0.12, 5: 0.08, 6: 0.20 },
  ghigf: { 1: 0.25, 2: 0.25, 3: 0.15, 4: 0.15, 5: 0.20 },
  ins_axis: { 1: 0.55, 2: 0.45 },
  neuro_toxicity: { 1: 0.18, 2: 0.15, 3: 0.13, 4: 0.17, 5: 0.14, 6: 0.10, 7: 0.13 },
  blood: { 1: 0.20, 2: 0.14, 3: 0.16, 4: 0.14, 5: 0.08, 6: 0.10, 7: 0.18 },
  vessels: { 1: 0.18, 2: 0.12, 3: 0.22, 4: 0.12, 5: 0.10, 6: 0.12, 7: 0.14 },
};

// Lab-to-mechanism mapping
const LAB_MECH_MAP: Record<string, Record<number, string[]>> = {
  cardio: { 1: ['LDL','HDL','TG','NonHDL'], 2: ['SBP','DBP'], 3: ['Hct','LVmass'], 4: ['Fibrinogen','D_dimer'], 5: ['Homocysteine','CRP'], 6: ['CRP','Endothelin1'], 7: ['K','Na','Mg'], 8: ['Troponin','BNP'] },
  hepatic: { 1: ['GGT','ALP','Bilirubin'], 2: ['ALT','AST'], 3: ['GGT','ALT'], 4: ['ALT','AST','LDH'], 5: ['GGT','ALT'], 6: ['ALT','AST'], 7: ['ALT','AST','GGT'], 8: ['LDL','HDL','TG'] },
  renal: { 1: ['SBP','DBP','Hct'], 2: ['Creatinine','eGFR'], 3: ['Proteinuria','Creatinine'], 4: ['K','Na'], 5: ['Creatinine','eGFR'], 6: ['Na','K'], 7: ['Creatinine','ALT'] },
  neuro: { 1: ['Prolactin','Cortisol'], 2: ['Homocysteine','Glucose'], 3: ['Cortisol','GABA'], 4: ['CRP','IL6','TNF'], 5: ['Homocysteine','OxidativeMarkers'], 6: ['CRP','S100b'], 7: ['Cortisol','Estradiol'], 8: ['B12','Folate'] },
  endocrine: { 1: ['LH','FSH','Testosterone'], 2: ['Estradiol','Testosterone'], 3: ['Prolactin'], 4: ['Glucose','HbA1c','Insulin','HOMA_IR'], 5: ['TSH'], 6: ['Cortisol'], 7: ['Testosterone','Estradiol'], 8: ['IGF1','GH'] },
  hematologic: { 1: ['Hct','Hb','RBC'], 2: ['PLT'], 3: ['WBC'], 4: ['Hct','Fibrinogen'], 5: ['Ferritin','Transferrin','Hb'], 6: ['Fibrinogen','D_dimer'], 7: ['Hct','LDH','Haptoglobin'] },
  reproductive: { 1: ['LH','FSH','Testosterone'], 2: ['LH','FSH'], 3: ['Testosterone'], 4: ['Estradiol','Prolactin'], 5: ['PSA','Testosterone'], 6: ['PSA'], 7: ['Testosterone','Estradiol'] },
  musculoskeletal: { 1: ['CK','Calcium'], 2: ['CK','Calcium'], 3: ['ALP_bone','Calcium','Phosphorus'], 4: ['Calcium','VitD','ALP_bone'], 5: ['CK','CRP'], 6: ['CRP','ESR'], 7: ['CK'] },
  metabolic: { 1: ['Glucose','Insulin','HOMA_IR'], 2: ['LDL','HDL','TG'], 3: ['Glucose','HbA1c'], 4: ['Waist','Glucose','Insulin'], 5: ['UricAcid','Creatinine'], 6: ['Glucose','HbA1c','LDL','HDL','Waist'] },
  ghigf: { 1: ['IGF1','GH'], 2: ['Na','Weight'], 3: ['IGF1','EchoOrgans'], 4: ['Creatinine','eGFR'], 5: ['Glucose','HbA1c'] },
  ins_axis: { 1: ['Glucose','Insulin','HOMA_IR'], 2: ['Glucose','HbA1c'] },
  neuro_toxicity: { 1: ['Prolactin','Cortisol'], 2: ['Homocysteine'], 3: ['Cortisol'], 4: ['CRP','IL6'], 5: ['Homocysteine'], 6: ['CRP','S100b'], 7: ['Cortisol','Estradiol'] },
  blood: { 1: ['Hct','Hb'], 2: ['Hct','Hb','Viscosity'], 3: ['Fibrinogen','D_dimer','INR'], 4: ['Hct','Fibrinogen'], 5: ['Ferritin','Transferrin'], 6: ['LDH','Haptoglobin'], 7: ['D_dimer','Fibrinogen','INR','APTT'] },
  vessels: { 1: ['Endothelin1','NO'], 2: ['SBP','DBP'], 3: ['LDL','HDL','TG'], 4: ['CRP','CalciumIndex'], 5: ['CRP','ESR','Fibrinogen'], 6: ['HbA1c','Microalbumin'], 7: ['SBP','EchoAorta'] },
};

// Support substance risk reduction per (system, mechanism) — EXPANDED
const SUPPORT_REDUCTIONS: Record<string, Record<string, Record<number, number>>> = {
  NAC: { hepatic: { 3: 0.3, 7: 0.2 }, renal: { 7: 0.1 }, neuro: { 5: 0.1 } },
  omega3: { cardio: { 1: 0.25, 5: 0.2 }, neuro: { 4: 0.15, 5: 0.2 } },
  telmisartan: { cardio: { 2: 0.3, 3: 0.2 }, renal: { 1: 0.25 } },
  aspirin: { cardio: { 4: 0.2 }, hematologic: { 6: 0.15 } },
  vitaminD: { endocrine: { 5: 0.15 }, reproductive: { 5: 0.1 } },
  zinc_sup: { reproductive: { 1: 0.1, 2: 0.1 }, endocrine: { 1: 0.1 } },
  magnesium: { cardio: { 7: 0.15, 2: 0.1 }, neuro: { 3: 0.1 } },
  taurine_sup: { cardio: { 2: 0.1, 5: 0.15 }, hepatic: { 7: 0.1 } },
  milk_thistle: { hepatic: { 1: 0.2, 2: 0.2, 7: 0.15 } },
  berberine: { endocrine: { 4: 0.2 }, cardio: { 1: 0.15 } },
  TUDCA: { hepatic: { 1: 0.3, 2: 0.2, 7: 0.25 } },
  coq10: { cardio: { 5: 0.15, 6: 0.1 }, neuro: { 5: 0.1 } },
  alpha_lipoic: { hepatic: { 3: 0.2, 7: 0.15 }, neuro: { 5: 0.25 } },
  vitamin_b6: { neuro: { 4: 0.1, 5: 0.1 } },
  vitamin_b12: { hematologic: { 5: 0.1 }, hepatic: { 7: 0.05 } },
  folate: { cardio: { 4: 0.1 }, hematologic: { 5: 0.1 } },
  vitamin_k2: { cardio: { 1: 0.1 }, hepatic: { 5: 0.05 } },
  selenium_sup: { hepatic: { 3: 0.1, 7: 0.1 } },
  curcumin_sup: { hepatic: { 3: 0.15, 7: 0.1 }, neuro: { 4: 0.1, 5: 0.1 }, cardio: { 5: 0.05 } },
  ashwagandha: { neuro: { 3: 0.2, 7: 0.15 }, endocrine: { 6: 0.15 } },
  phosphatidylcholine: { hepatic: { 3: 0.15, 5: 0.1 } },
  probiotics_sup: { hepatic: { 3: 0.1, 7: 0.1 } },
  saw_palmetto: { reproductive: { 5: 0.1, 6: 0.05 }, endocrine: { 7: 0.05 } },
  tongkat_ali: { endocrine: { 1: 0.05 }, neuro: { 1: 0.05 } },
  ginseng_sup: { neuro: { 1: 0.08, 4: 0.08 }, endocrine: { 6: 0.05 } },
  nebivolol: { cardio: { 2: 0.25, 7: 0.1 }, neuro: { 3: 0.05 } },
  caberg: { endocrine: { 3: 0.5 }, neuro: { 1: 0.2 } },
  bromocriptine: { endocrine: { 3: 0.4 }, neuro: { 1: 0.15 } },
  clomi: { endocrine: { 1: 0.3, 3: 0.2 }, reproductive: { 7: 0.15 } },
  tamox: { endocrine: { 2: 0.3, 1: 0.2 }, reproductive: { 7: 0.2 } },
  anastro: { endocrine: { 2: 0.4 }, reproductive: { 7: 0.1 } },
  letrozole: { endocrine: { 2: 0.45 }, reproductive: { 7: 0.15 } },
  hcg: { reproductive: { 1: 0.3, 2: 0.2 }, endocrine: { 3: 0.1 } },
  bpc157: { hepatic: { 3: 0.15, 7: 0.1 }, neuro: { 4: 0.1 } },
  semax: { neuro: { 1: 0.15, 4: 0.1, 5: 0.1 } },
  selank: { neuro: { 3: 0.12, 7: 0.1 } },
};

// --- ULN-based Lab Factor (spec section 13.6) ---

function computeLabFactorForMech(labs: LabPoint[], system: string, mechIdx: number): number {
  const labNames = LAB_MECH_MAP[system]?.[mechIdx];
  if (!labNames || !labNames.length) return 1.0;

  let factor = 1.0;
  for (const labName of labNames) {
    const ref = LAB_REFERENCES[labName];
    if (!ref) continue;
    const points = labs.filter(l => l.code === labName || l.name === labName);
    if (!points.length) continue;
    const value = points[points.length - 1].value;

    // ULN-based formula: labFactor = (value/ULN)^beta * (1 + alpha * growth_rate/month / 0.1)
    const ratio = value / Math.max(0.01, ref.uln);
    const beta = ref.sensitive ? 1.5 : 1.0;
    const alpha = ref.alpha;

    // Compute growth rate from multiple lab points if available
    let growthRate = 0;
    if (points.length >= 2) {
      const sorted = [...points].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      if (sorted.length >= 2) {
        const last = sorted[sorted.length - 1].value;
        const prev = sorted[sorted.length - 2].value;
        const timeDiff = Math.max(1, (new Date(sorted[sorted.length - 1].date).getTime() - new Date(sorted[sorted.length - 2].date).getTime()) / (30.44 * 24 * 3600 * 1000));
        growthRate = (last - prev) / Math.max(0.01, ref.sd) / timeDiff;
      }
    }

    let labFactor = Math.pow(ratio, beta);
    if (growthRate > 0) {
      labFactor *= (1 + alpha * growthRate / 0.1);
    } else {
      labFactor = Math.max(0.7, labFactor);
    }

    factor *= labFactor;
  }
  return Math.max(0.5, Math.min(3.0, factor));
}

function computeDrugContributions(course: CourseEntry[]): Record<string, Record<string, Record<number, number>>> {
  const result: Record<string, Record<string, Record<number, number>>> = {};
  for (const entry of course) {
    const drug = DRUG_THRESHOLDS_V7[entry.substanceId];
    if (!drug) continue;
    const doseRatio = (entry.doseValue ?? 0) / Math.max(1, drug.dosePerWeek);
    const substanceContrib: Record<string, Record<number, number>> = {};
    for (const [sys, mechs] of Object.entries(drug.systems)) {
      const mechContrib: Record<number, number> = {};
      for (const [mechStr, weight] of Object.entries(mechs)) {
        mechContrib[Number(mechStr)] = doseRatio * weight * drug.androgenicity;
      }
      substanceContrib[sys] = mechContrib;
    }
    result[entry.substanceId] = substanceContrib;
  }
  return result;
}

function computeSupportFactor(supportIds: string[], system: string, mechIdx: number): number {
  let factor = 1.0;
  for (const id of supportIds) {
    const reductions = SUPPORT_REDUCTIONS[id];
    if (!reductions) continue;
    const sysReductions = reductions[system];
    if (!sysReductions) continue;
    const reduction = sysReductions[mechIdx];
    if (reduction) {
      factor *= (1 - Math.abs(reduction));
    }
  }
  return Math.max(0.1, factor);
}

function computeNutritionFactor(nutrition: MatrixInput['nutrition'], system: string, mechIdx: number): number {
  let factor = 1.0;
  if (nutrition.proteinPerKg > 2.2) {
    if (system === 'renal') factor *= 1.2;
  }
  if (nutrition.fiberG < 20) {
    if (system === 'cardio' && mechIdx === 1) factor *= 1.15;
  }
  if (nutrition.omega3G >= 2) {
    if (system === 'cardio') factor *= 0.75;
    if (system === 'neuro' && (mechIdx === 4 || mechIdx === 5)) factor *= 0.8;
  }
  if (nutrition.sodiumG > 5) {
    if (system === 'cardio' && mechIdx === 2) factor *= 1.1;
    if (system === 'renal') factor *= 1.05;
  }
  if (nutrition.potassiumG < 2) {
    if (system === 'cardio' && (mechIdx === 7 || mechIdx === 2)) factor *= 1.15;
  }
  return Math.max(0.5, Math.min(1.5, factor));
}

function computeTrainingFactor(training: MatrixInput['training'], system: string, mechIdx: number): number {
  let factor = 1.0;
  if (training.hasHIIT) {
    if (system === 'cardio' && mechIdx === 3) factor *= 1.3;
    if (system === 'cardio' && mechIdx === 5) factor *= 1.2;
  }
  if (training.volumeTonnes > 15000) {
    factor *= 1.1;
  }
  if (training.lissMinutesPerWeek > 150) {
    if (system === 'cardio') factor *= 0.9;
  }
  return Math.max(0.8, Math.min(1.4, factor));
}

// --- Main Matrix Computation ---

export function computeV7Matrix(input: MatrixInput, supportIds: string[] = []): MatrixResult {
  const systems: Record<string, SystemRisk> = {};
  const drugContribs = computeDrugContributions(input.course);

  const stazhLife = input.stazhWeeks / 52;
  const stazhCont = input.continuousWeeks / 12;
  const stazhLifeFactor = 1 + 0.02 * stazhLife;
  const stazhContFactor = 1 + 0.03 * stazhCont;

  for (const sys of RISK_SYSTEMS_V7) {
    const systemRisk: SystemRisk = { raw: 0, net: 0, mechanisms: {} };
    const baseRisks = BASE_RISK[sys] ?? {};
    const weights = MECH_WEIGHTS[sys] ?? {};

    for (let mechIdx = 1; mechIdx <= 9; mechIdx++) {
      const base = baseRisks[mechIdx] ?? 0.02;

      const geneticMult = getGeneticMultiplier(input.genetics, sys, mechIdx);
      const labF = computeLabFactorForMech(input.labs, sys, mechIdx);

      let drugContrib = 0;
      for (const [substanceId, contribs] of Object.entries(drugContribs)) {
        const sysContribs = contribs[sys];
        if (sysContribs && sysContribs[mechIdx]) {
          drugContrib += sysContribs[mechIdx];
        }
      }

      const modeF = getModeMultiplier(input.mode, sys, mechIdx);
      const nutF = computeNutritionFactor(input.nutrition, sys, mechIdx);
      const trainF = computeTrainingFactor(input.training, sys, mechIdx);
      const stazhF = stazhLifeFactor * stazhContFactor;

      const P_raw = Math.min(1, base * geneticMult * labF * modeF * nutF * trainF * stazhF * (1 + drugContrib));
      const supportF = computeSupportFactor(supportIds, sys, mechIdx);
      const P_net = Math.min(1, P_raw * supportF);

      systemRisk.mechanisms[mechIdx] = {
        P_raw, P_net, geneticMult, labFactor: labF, nutritionFactor: nutF,
        trainingFactor: trainF, modeFactor: modeF, supportFactor: supportF,
      };
    }

    let raw = 0, net = 0;
    for (const [mechStr, mechData] of Object.entries(systemRisk.mechanisms)) {
      const w = weights[Number(mechStr)] ?? 1/7;
      raw += w * mechData.P_raw;
      net += w * mechData.P_net;
    }
    systemRisk.raw = Math.min(100, raw * 100);
    systemRisk.net = Math.min(100, net * 100);
    systems[sys] = systemRisk;
  }

  const allRaw = Object.values(systems).map(s => s.raw);
  const allNet = Object.values(systems).map(s => s.net);
  const geomMean = (arr: number[]): number => {
    if (!arr.length) return 0;
    return Math.min(100, Math.exp(arr.reduce((a, v) => a + Math.log(Math.max(0.01, v)), 0) / arr.length));
  };
  const overallRaw = geomMean(allRaw);
  const overallNet = geomMean(allNet);

  return { systems, overallRaw, overallNet, drugContributions: drugContribs };
}