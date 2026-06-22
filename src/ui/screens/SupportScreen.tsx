import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { SYNERGY_PAIRS, ORGAN_SYNERGIES, SUPPLEMENT_DESCRIPTIONS, SUPPLEMENT_TARGETS, SUPPORT_RESEARCH, calculateSupport, checkSupportInteractions, findSupportForGoal, findSupportByGoal, getSupportDatabaseStats, type SupportInput, type SupplementTarget } from '../../engines/support.engine';
import { decodeGarbled, cleanDesc } from '../../utils/text-sanitizer';
import { ALL_RISK_SYSTEMS } from '../../core/constants';
import { PHARMA_DB, getPharmaDetail } from '../../core/pharma-database';
import { useDataLink, notifyDataChange } from '../../core/data-link';
import { updateProfile, getProfile } from '../../core/profile-manager';
import { SYSTEM_INFO_ALL } from '../../core/risk-info';
import { ALL_SUBSTANCES, ALL_INTERACTIONS, type SupportSubstance, type SupportInteraction } from '../../data/support-database';
import { getSubstanceTier, TIER_LABELS } from '../../data/support-database';
import { getBpRiskLevel } from '../../core/bp-hr-data';
import { SUPPORT_CATALOG_DATA, CATALOG_ENRICHMENT, MECHANISM_LABELS, ORGAN_LABELS as CATALOG_ORGAN_LABELS, SYSTEM_LABELS_CATALOG, CATEGORY_LABELS as CATALOG_CATEGORY_LABELS, TIER_LABELS_CATALOG, type SupportCatalogEntry } from '../../data/support-database';

import { CANONICAL_ID_MAP } from '../../data/support-database';
import { SUBSTANCE_ANALOGS, PHASE_MODS, DEFAULT_DOSAGES, getPhaseLevel, type SupportPhase } from '../../data/support-database';
import { FertilityPCTScreen } from './FertilityPCTScreen';
import { ALL_STACKS, EFFECT_LABELS_ru, findStacksByEffect, getStackSubstanceLabel as getStackSubLabel, type SupportStack } from '../../data/support-database';
import {
  PEPTIDE_DB, PEPTIDE_LIST,
  computeDilution, computeEffectiveDose, computePK,
  generatePeptideProtocol,
  ROUTE_LABELS, SYRINGE_TYPES,  type PeptideInfo, type DilutionInput, type DilutionResult,
  type BioavailabilityResult, type PKInput, type PKResult,
} from '../../engines/peptide-calculator.engine';
import {
  interpretLabs, computeRiskByModel, generateMechanismReport,
  computePharmaAdjustedDose, generateTimedPlan,
  RISK_MODEL_LABELS, type RiskModelType, type LabCompositeResult,
} from '../../engines/lab-analysis.engine';
import {
  generateWeeklyPlan,
  type RiskCalcMethod, type WeeklyPlan, type SupplementPlanEntry, type DailySchedule,
} from '../../engines/weekly-plan.engine';
import { generateRecommendations, quickRec, type Recommendation, type RecInput } from '../../engines/recommendation-engine-v2';
import { fuseDecisions, shouldTrainToday, type FusedDecision } from '../../engines/decision-fusion.engine';
import { optimizeStack as newOptimizeStack, getSubstanceName, type StackResult as OptimizerStackResult } from '../../engines/stack-optimizer.engine';
import { generateStack, type StackResult } from '../../engines/stack-builder.engine';
import { ReportEngine } from '../../engines/report-engine';
import { checkDrugInteractions } from '../../engines/pharma-interactions.engine';
import type { CourseEntry } from '../../core/types';
import { searchPubMed, type PubMedArticle } from '../../engines/pubmed-search.engine';
// Force Vite to include SUPPORT_CATALOG_DATA and CANONICAL_ID_MAP (prevents tree-shaking)
// @ts-ignore
(window as any).__SUPPORT_CATALOG__ = SUPPORT_CATALOG_DATA;
// @ts-ignore
(window as any).__CANONICAL_MAP__ = CANONICAL_ID_MAP;

type SupportTab = 'main' | 'catalog' | 'synergies' | 'calculator' | 'interactions' | 'stacks' | 'peptides' | 'fertility-pct';
type SupportView = 'main' | 'calc' | 'fertility';
type CalcView = 'main' | 'calculator' | 'peptides' | 'info' | 'stackcalc' | 'mystacks' | 'mixcalc' | 'plan' | 'reports' | 'neuro' | 'joints' | 'acne';
type InfoView = 'main' | 'catalog' | 'synergies' | 'stacks' | 'interactions' | 'research' | 'favorites' | 'supportstacks';

const INTERACTION_TYPE_LABELS: Record<string, { label: string; emoji: string; color: string }> = {
  synergy: { label: 'Синергия', emoji: '🔗', color: '#22c55e' },
  conflict: { label: 'Конфликт', emoji: '⚠️', color: '#ef4444' },
  caution: { label: 'Предупреждение', emoji: 'ℹ️', color: '#f59e0b' },
};

const EFFECT_LABELS: Record<string, string> = {
  SMOOTH_FOCUS:'Плавная фокусировка — кофеин стимулирует, теанин сглаживает',
  OVERSTIMULATION:'Перевозбуждение — суммарная стимуляция ЦНС',
  HEART_STRAIN:'Нагрузка на сердце — риск тахикардии и гипертензии',
  ANXIETY_SPIKE:'Резкая тревога — выброс норадреналина и адреналина',
  IRON_ABSORB_UP:'Усиление всасывания железа',
  IRON_ABSORB_DOWN:'Снижение всасывания железа',
  MINERAL_COMPETE:'Конкуренция минералов за транспорт',
  COPPER_DEPLETION:'Истощение меди при высоком цинке',
  ABSORB_COMPETE:'Конкуренция за всасывание',
  BONE_SUPPORT:'Поддержка костной ткани — кальций + D3',
  CALCIUM_TARGETING:'Направление кальция в кости (К2)',
  VITD_ACTIVATION:'Активация витамина D магнием',
  IMMUNE_BALANCE:'Баланс иммунного ответа',
  COAGULATION_SHIFT:'Сдвиг свёртываемости крови',
  BLEED_RISK:'Повышенный риск кровотечений',
  ANTIINFLAMMATION_UP:'Усиление противовоспалительного эффекта',
  IMMUNE_MOD:'Иммуномодуляция',
  SLEEP_UP:'Улучшение качества сна',
  CALMING:'Успокаивающий эффект',
  HEART_MOD:'Модуляция сердечного ритма',
  SEROTONIN_SYNDROME:'Риск серотонинового синдрома',
  SEROTONIN_EXCESS:'Избыток серотонина',
  SEROTONIN_CRISIS:'Серотониновый криз',
  DRUG_CLEARANCE_UP:'Ускорение клиренса лекарств',
  ANTICOAG_DOWN:'Снижение антикоагулянтного эффекта',
  LIVER_PROTECT:'Защита печени — глутатион',
  ANTIOX_INTERFERE:'Интерференция с антиоксидантной терапией',
  NO_UP:'Повышение оксида азота',
  ABSORB_MOD:'Изменение всасывания',
  LIPIDS_UP:'Улучшение липидного профиля',
  BUGS_KILLED:'Уничтожение пробиотиков антибиотиками',
  MICROBIOME_UP:'Улучшение микробиома',
  SURVIVAL_UP:'Повышение выживаемости пробиотиков',
  ABSORB_DOWN:'Снижение всасывания',
  SEDATION_UP:'Усиление седации',
  SLEEP_ARCH_DISRUPT:'Нарушение архитектуры сна',
  LIVER_TOX:'Гепатотоксичность — токсические метаболиты',
  CNS_DEPRESSION:'Угнетение ЦНС',
  MOOD_INSTABILITY:'Нестабильность настроения',
  DRUG_EFFECT_DOWN:'Снижение эффекта препарата',
};

const INTERACTION_SEVERITY_LABELS: Record<string, { label: string; color: string }> = {
  LOW: { label: 'Низкая', color: '#84cc16' },
  MEDIUM: { label: 'Средняя', color: '#f59e0b' },
  HIGH: { label: 'Высокая', color: '#ef4444' },
};

const CATEGORY_LABELS: Record<string, { label: string; emoji: string }> = {
  vitamin: { label: 'Витамины', emoji: '🧪' },
  vitamins: { label: 'Витамины', emoji: '🧪' },
  minerals: { label: 'Минералы', emoji: '⚡' },
  mineral: { label: 'Минералы', emoji: '⚡' },
  amino: { label: 'Аминокислоты', emoji: '🧬' },
  aminoacid: { label: 'Аминокислоты', emoji: '🧬' },
  amino_acids: { label: 'Аминокислоты', emoji: '🧬' },
  peptide: { label: 'Пептиды', emoji: '🔬' },
  peptides: { label: 'Пептиды', emoji: '🔬' },
  antioxidant: { label: 'Антиоксиданты', emoji: '🛡' },
  antioxidants: { label: 'Антиоксиданты', emoji: '🛡' },
  immune: { label: 'Иммунитет', emoji: '🛡' },
  hormone: { label: 'Гормоны', emoji: '⚕️' },
  hormones: { label: 'Гормоны', emoji: '⚕️' },
  hormonal: { label: 'Гормоны', emoji: '⚕️' },
  fatty_acid: { label: 'Жирные кислоты', emoji: '💧' },
  fatty_acids: { label: 'Жирные кислоты', emoji: '💧' },
  lipids: { label: 'Липиды', emoji: '💧' },
  nootropic: { label: 'Ноотропы', emoji: '🧠' },
  neuro: { label: 'Нервная система', emoji: '🧠' },
  brain: { label: 'Мозг', emoji: '🧠' },
  cardio: { label: 'Сердечно-сосудистая', emoji: '❤️' },
  heart: { label: 'Сердце', emoji: '❤️' },
  vascular: { label: 'Сосуды', emoji: '🩸' },
  VESSELS: { label: 'Сосуды', emoji: '🩸' },
  GI: { label: 'ЖКТ', emoji: '🫃' },
  liver: { label: 'Печень', emoji: '🍃' },
  kidney: { label: 'Почки', emoji: '🫘' },
  mitochondria: { label: 'Митохондрии', emoji: '🔋' },
  energy: { label: 'Энергия', emoji: '⚡' },
  adaptogen: { label: 'Адаптогены', emoji: '🌿' },
  fungi: { label: 'Грибы', emoji: '🍄' },
  probiotic: { label: 'Пробиотики', emoji: '🦠' },
  prebiotic: { label: 'Пребиотики', emoji: '🦠' },
  postbiotic: { label: 'Постбиотики', emoji: '🦠' },
  skin: { label: 'Кожа', emoji: '✨' },
  bone: { label: 'Кости и суставы', emoji: '🦴' },
  joint: { label: 'Суставы', emoji: '🦴' },
  joints: { label: 'Суставы', emoji: '🦴' },
  blood: { label: 'Кровь', emoji: '💉' },
  detox: { label: 'Детокс', emoji: '🧹' },
  antiaging: { label: 'Антивозраст', emoji: '⏳' },
  epigenetic: { label: 'Эпигенетика', emoji: '🧬' },
  methylation: { label: 'Метилирование', emoji: '🔄' },
  DNA: { label: 'ДНК', emoji: '🧬' },
  pharma: { label: 'Фармацевтика', emoji: '💊' },
  polyphenol: { label: 'Полифенолы', emoji: '🍃' },
  sleep: { label: 'Сон', emoji: '😴' },
  calming: { label: 'Успокаивающие', emoji: '🧘' },
  anxiolytic: { label: 'Противотревожные', emoji: '🧘' },
  antiinflammatory: { label: 'Противовоспалительные', emoji: '🔥' },
  anti_inflammatory: { label: 'Противовоспалительные', emoji: '🔥' },
  antiviral: { label: 'Противовирусные', emoji: '🦠' },
  antimicrobial: { label: 'Антимикробные', emoji: '🦠' },
  antibiotic: { label: 'Антибиотики', emoji: '💊' },
  thyroid: { label: 'Щитовидная железа', emoji: '🦋' },
  hair: { label: 'Волосы', emoji: '💇' },
  lung: { label: 'Лёгкие', emoji: '🫁' },
  LUNGS: { label: 'Лёгкие', emoji: '🫁' },
  electrolyte: { label: 'Электролиты', emoji: '⚡' },
  trace: { label: 'Микроэлементы', emoji: '⚡' },
  eye: { label: 'Зрение', emoji: '👁️' },
  vision: { label: 'Зрение', emoji: '👁️' },
  oral: { label: 'Полость рта', emoji: '🦷' },
  male: { label: 'Мужское здоровье', emoji: '♂️' },
  female: { label: 'Женское здоровье', emoji: '♀️' },
  prostate: { label: 'Простата', emoji: '🫘' },
  pain: { label: 'Обезболивающие', emoji: '💊' },
  analgesic: { label: 'Анальгетики', emoji: '💊' },
  insulin: { label: 'Инсулин', emoji: '💉' },
  glucose: { label: 'Глюкоза', emoji: '🍬' },
  metabolism: { label: 'Метаболизм', emoji: '⚡' },
  METABOLIC: { label: 'Метаболизм', emoji: '⚡' },
  repair: { label: 'Регенерация', emoji: '🔄' },
  regeneration: { label: 'Регенерация', emoji: '🔄' },
  cell: { label: 'Клеточное здоровье', emoji: '🧫' },
  hydration: { label: 'Гидратация', emoji: '💧' },
  collagen: { label: 'Коллаген', emoji: '🧶' },
  stress: { label: 'Стресс', emoji: '😰' },
  mood: { label: 'Настроение', emoji: '😊' },
  testosterone: { label: 'Тестостерон', emoji: '💪' },
  HPG: { label: 'Гипоталамус-гипофиз-гонады', emoji: '🧬' },
  HPT: { label: 'Гипоталамус-гипофиз-тиреоид', emoji: '🦋' },
  HPA: { label: 'Гипоталамус-гипофиз-надпочечники', emoji: '🧬' },
  nerve: { label: 'Нервы', emoji: '🧠' },
  tendon: { label: 'Сухожилия', emoji: '🦵' },
  muscle: { label: 'Мышцы', emoji: '💪' },
  anabolic: { label: 'Анаболики', emoji: '💪' },
  fat_loss: { label: 'Жиросжигание', emoji: '🔥' },
  performance: { label: 'Производительность', emoji: '🏃' },
  recovery: { label: 'Восстановление', emoji: '😴' },
  anti_glycation: { label: 'Антигликация', emoji: '🍬' },
  enzyme: { label: 'Ферменты', emoji: '🧪' },
  enzymes: { label: 'Ферменты', emoji: '🧪' },
  herbs: { label: 'Растения и травы', emoji: '🌿' },
  nootropics: { label: 'Ноотропы', emoji: '🧠' },
  adaptogens: { label: 'Адаптогены', emoji: '🌿' },
  probiotics: { label: 'Пробиотики', emoji: '🦠' },
  mushrooms: { label: 'Грибы', emoji: '🍄' },
  electrolytes: { label: 'Электролиты', emoji: '⚡' },
  other: { label: 'Другое', emoji: '📦' },
};

const MECH_TRANSLATIONS_RU: Record<string, string> = {
  'antioxidant': 'Антиоксидант', 'anti_inflammatory': 'Противовоспалительное', 'hepatoprotective': 'Гепатопротектор',
  'nephroprotective': 'Нефропротектор', 'cardioprotective': 'Кардиопротектор', 'neuroprotective': 'Нейропротектор',
  'immunomodulator': 'Иммуномодулятор', 'adaptogen': 'Адаптоген', 'nootropic': 'Ноотроп',
  'vasodilator': 'Вазодилататор', 'antiplatelet': 'Антиагрегант', 'hypolipidemic': 'Гиполипидемическое',
  'hypoglycemic': 'Гипогликемическое', 'anabolic': 'Анаболическое', 'anticatabolic': 'Антикатаболическое',
  'ergogenic': 'Эргогенное', 'lipotropic': 'Липотропное', 'thermogenic': 'Термогенное',
  'estrogenic': 'Эстрогенное', 'antiestrogenic': 'Антиэстрогенное', 'androgenic': 'Андрогенное',
  'antiandrogenic': 'Антиандрогенное', 'progestogenic': 'Прогестогенное', 'antioxidant_enzymatic': 'Ферментативный антиоксидант',
  'mitochondrial': 'Митохондриальное', 'neurotransmitter': 'Нейротрансмиттер', 'hormone_precursor': 'Предшественник гормонов',
  'collagen_synthesis': 'Синтез коллагена', 'bone_mineralization': 'Минерализация костей',
  'insulin_sensitizer': 'Сенситизатор инсулина', 'cortisol_modulator': 'Модулятор кортизола',
  'sleep_aid': 'Снотворное', 'anxiolytic': 'Анксиолитик', 'antidepressant': 'Антидепрессант',
  'analgesic': 'Анальгетик', 'anti_spasmodic': 'Спазмолитик', 'digestive': 'Пищеварительное',
  'probiotic': 'Пробиотик', 'prebiotic': 'Пребиотик', 'enzyme': 'Фермент',
  'electrolyte': 'Электролит', 'diuretic': 'Диуретик', 'detox': 'Детокс',
  'chelator': 'Хелатор', 'methylation': 'Метилирование', 'energy_production': 'Производство энергии',
  'protein_synthesis': 'Синтез белка', 'glucose_metabolism': 'Метаболизм глюкозы', 'lipid_metabolism': 'Метаболизм липидов',
  'calcium_metabolism': 'Метаболизм кальция', 'thyroid_function': 'Функция щитовидной',
  'adrenal_support': 'Поддержка надпочечников', 'pituitary_support': 'Поддержка гипофиза',
  'cofactor': 'Кофактор', 'coenzyme': 'Коэнзим', 'electron_transport': 'Транспорт электронов',
  'oxygen_transport': 'Транспорт кислорода', 'wound_healing': 'Заживление ран',
  'tissue_repair': 'Регенерация тканей', 'anti_fibrotic': 'Антифибротическое',
};

const ORGAN_MECHANISMS: Record<string, string[]> = {
  cardio: ['cardioprotective', 'vasodilator', 'antiplatelet', 'hypolipidemic', 'electrolyte', 'oxygen_transport', 'anticoagulant'],
  liver: ['hepatoprotective', 'detox', 'antioxidant', 'antioxidant_enzymatic', 'lipid_metabolism', 'glucose_metabolism', 'insulin_sensitizer', 'anti_fibrotic', 'lipotropic'],
  kidney: ['nephroprotective', 'diuretic', 'electrolyte', 'detox', 'chelator', 'anti_fibrotic'],
  lung: ['anti_inflammatory', 'antioxidant', 'vasodilator', 'anti_spasmodic'],
  brain: ['neuroprotective', 'nootropic', 'neurotransmitter', 'antidepressant', 'anxiolytic', 'sleep_aid', 'analgesic', 'anti_spasmodic'],
  bones: ['bone_mineralization', 'collagen_synthesis', 'calcium_metabolism', 'tissue_repair', 'anti_inflammatory'],
  skin: ['collagen_synthesis', 'antioxidant', 'wound_healing', 'tissue_repair', 'anti_inflammatory'],
  thyroid: ['thyroid_function', 'hormone_precursor', 'energy_production', 'metabolic'],
  pancreas: ['hypoglycemic', 'insulin_sensitizer', 'glucose_metabolism', 'anti_inflammatory'],
  blood: ['oxygen_transport', 'antiplatelet', 'hypolipidemic', 'methylation', 'cofactor'],
  immune: ['immunomodulator', 'antioxidant', 'anti_inflammatory', 'probiotic', 'prebiotic'],
  gi: ['digestive', 'probiotic', 'prebiotic', 'enzyme', 'anti_inflammatory', 'hepatoprotective'],
  hormones: ['hormone_precursor', 'estrogenic', 'antiestrogenic', 'androgenic', 'antiandrogenic', 'progestogenic', 'adrenal_support', 'pituitary_support', 'cortisol_modulator'],
  male: ['androgenic', 'antiestrogenic', 'anabolic', 'protein_synthesis', 'hormone_precursor'],
  female: ['estrogenic', 'progestogenic', 'antiandrogenic', 'antiestrogenic', 'bone_mineralization', 'calcium_metabolism'],
  antiaging: ['mitochondrial', 'antioxidant', 'antioxidant_enzymatic', 'collagen_synthesis', 'methylation', 'energy_production'],
  energy: ['energy_production', 'ergogenic', 'thermogenic', 'mitochondrial', 'electron_transport', 'lipid_metabolism', 'glucose_metabolism'],
  recovery: ['tissue_repair', 'wound_healing', 'collagen_synthesis', 'anti_inflammatory', 'protein_synthesis', 'anticatabolic', 'anabolic'],
};

const getCategoryInfo = (cat: string): { label: string; emoji: string } => {
  const safeCat = cat || 'Без категории';
  return CATEGORY_LABELS[safeCat] || (TYPE_LABELS_RU[safeCat] ? { label: TYPE_LABELS_RU[safeCat], emoji: '📦' } : { label: safeCat, emoji: '📦' });
};

const TYPE_LABELS_RU: Record<string, string> = {
  vitamin: 'Витамины', mineral: 'Минералы', minerals: 'Минералы', amino_acid: 'Аминокислоты', amino: 'Аминокислоты',
  herb: 'Растения и травы', hormone: 'Гормоны', peptide: 'Пептиды',
  antioxidant: 'Антиоксиданты', enzyme: 'Ферменты', probiotic: 'Пробиотики',
  fatty_acid: 'Жирные кислоты', nootropic: 'Ноотропы', adaptogen: 'Адаптогены',
  joint: 'Суставы и кости', liver: 'Защита печени', kidney: 'Защита почек',
  heart: 'Сердце и сосуды', immune: 'Иммунитет', energy: 'Энергия',
  sleep: 'Сон', antiaging: 'Антивозраст', male: 'Мужское здоровье',
  female: 'Женское здоровье', sports: 'Спорт', digestion: 'Пищеварение',
  other: 'Другое', supplement: 'Добавки',
  polyphenol: 'Полифенолы', fungi: 'Грибы', metabiotic: 'Метабиотики',
  paraprobiotic: 'Парапробиотики', postbiotic: 'Постбиотики', prebiotic: 'Пребиотики',
  symbiotic: 'Симбиотики', pharma: 'Фарма', complex: 'Комплексы',
  brand: 'Бренды', calcium: 'Кальций', magnesium: 'Магний', zinc: 'Цинк',
  iron: 'Железо', potassium: 'Калий', sodium: 'Натрий', selenium: 'Селен',
  iodine: 'Йод', chromium: 'Хром', manganese: 'Марганец', copper: 'Медь',
  boron: 'Бор', molybdenum: 'Молибден', electrolyte: 'Электролиты',
  protein: 'Белки', carbohydrate: 'Углеводы', fat: 'Жиры',
  DIRECT: 'Направленное', GLOBAL: 'Общее', SYSTEMIC: 'Системное',
  AXIS: 'Гормональные оси', SYSTEM: 'Системы', ORGAN: 'Органы',
  SUBSTANCE: 'Вещества', INTERACTION: 'Взаимодействия', MECHANISM: 'Механизмы',
  RISK: 'Риски', caution: 'Предупреждения', conflict: 'Конфликты', synergy: 'Синергии',
  gut: 'ЖКТ', hepatoprotector: 'Защита печени', metabolic: 'Метаболизм',
  gastrointestinal: 'ЖКТ и пищеварение', cardioprotector: 'Сердце и сосуды',
  anti_aging: 'Антивозраст', stimulant: 'Стимуляторы', immunomodulator: 'Иммунитет',
  neuroprotector: 'Нейропротекторы', antiinflammatory: 'Противовоспалительные',
  anti_inflammatory: 'Противовоспалительные', antimicrobial: 'Антимикробные',
  anxiolytic: 'Противотревожные', antidepressant: 'Антидепрессанты',
  anticoagulant: 'Антикоагулянты', urinary_protector: 'Урологические',
  eye_protector: 'Защита глаз', respiratory: 'Дыхательная система',
  bone: 'Кости и суставы', recovery: 'Восстановление', anabolic: 'Анаболические',
  lipid: 'Липидные', beauty: 'Красота', multivitamin: 'Мультивитамины', marker: 'Маркеры',
  bile_acid: 'Желчные кислоты',
  choleretic: 'Желчегонные', thyroid: 'Щитовидная железа',
  mitochondrial: 'Митохондриальные', hematologic: 'Гематология',
};

// Class base-name grouping for catalog badges
const CLASS_BASE_NAMES: Record<string, { label: string; emoji: string; match: RegExp }> = {
  magnesium: { label: 'Магний', emoji: '⚡', match: /magnesium|магний/i },
  zinc: { label: 'Цинк', emoji: '🛡', match: /zinc|цинк/i },
  vitamin_d: { label: 'Витамин D', emoji: '☀️', match: /vitamin\s*d|витамин\s*d|cholecalciferol|кальциферол/i },
  omega: { label: 'Омега-3/6/9', emoji: '🐟', match: /omega|омега|epa|dha|ala/i },
  creatine: { label: 'Креатин', emoji: '💪', match: /creatine|креатин/i },
  collagen: { label: 'Коллаген', emoji: '🧶', match: /collagen|коллаген/i },
  ashwagandha: { label: 'Ашваганда', emoji: '🌿', match: /ashwagandha|ашваганд/i },
  curcumin: { label: 'Куркумин', emoji: '🟡', match: /curcumin|куркум|turmeric/i },
  coq10: { label: 'Коэнзим Q10', emoji: '🔋', match: /coq10|коэнзим|убихинон|ubiquinone|ubiquinol/i },
  vitamin_c: { label: 'Витамин C', emoji: '🍊', match: /vitamin\s*c|витамин\s*c|ascorb|аскорб/i },
  vitamin_b: { label: 'Витамины B', emoji: '🧪', match: /vitamin\s*b[123569]|b12|b6|b3|b1|b2|b5|b9|b7|thiamine|riboflavin|niacin|pyridoxine|folate|cobalamin|тиамин|рибофлавин|ниацин|пантотен|пиридоксин|фолат|биотин|кобаламин/i },
  iron: { label: 'Железо', emoji: '🩸', match: /iron|желез|ferrous|ferric|ferrum/i },
  calcium: { label: 'Кальций', emoji: '🦴', match: /calcium|кальци/i },
  melatonin: { label: 'Мелатонин', emoji: '😴', match: /melatonin|мелатонин/i },
  berberine: { label: 'Берберин', emoji: '🌿', match: /berberine|берберин/i },
  ginseng: { label: 'Женьшень', emoji: '🌱', match: /ginseng|женьшен/i },
  vitamin_e: { label: 'Витамин E', emoji: '🧴', match: /vitamin\s*e|витамин\s*e|tocopherol|токоферол/i },
  vitamin_a: { label: 'Витамин A', emoji: '👁', match: /vitamin\s*a|витамин\s*a|retinol|ретинол|carotenoid|каротиноид/i },
  vitamin_k: { label: 'Витамин K', emoji: '🩸', match: /vitamin\s*k|витамин\s*k|phylloquinone|menaquinone|филлохинон/i },
  selenium: { label: 'Селен', emoji: '🛡', match: /selenium|селен|selenomethionine/i },
  potassium: { label: 'Калий', emoji: '🍌', match: /potassium|кали/i },
  sodium: { label: 'Натрий', emoji: '🧂', match: /sodium|натри/i },
  iodine: { label: 'Йод', emoji: '🦋', match: /iodine|йод|iodide/i },
  chromium: { label: 'Хром', emoji: '🍬', match: /chromium|хром|picolinate/i },
  probiotics: { label: 'Пробиотики', emoji: '🦠', match: /probiotic|пробиотик|lactobacillus|bifido/i },
  nac: { label: 'NAC', emoji: '🫁', match: /nac|acetylcysteine|ацетилцистеин/i },
  ala: { label: 'Альфа-липоевая к-та', emoji: '⚡', match: /lipoic|липоев/i },
  carnitine: { label: 'L-Карнитин', emoji: '🔥', match: /carnitine|карнитин|alcar/i },
  theanine: { label: 'L-Теанин', emoji: '☕', match: /theanine|теанин/i },
  beta_alanine: { label: 'Бета-аланин', emoji: '💪', match: /beta.alanine|бета.аланин|carnosine|карнозин/i },
  citrulline: { label: 'Цитруллин', emoji: '💉', match: /citrulline|цитруллин/i },
  arginine: { label: 'Аргинин', emoji: '🔴', match: /arginine|аргинин/i },
  taurine: { label: 'Таурин', emoji: '⚡', match: /taurine|таурин/i },
  tyrosine: { label: 'L-Тирозин', emoji: '🧠', match: /tyrosine|тирозин/i },
  gaba: { label: 'GABA', emoji: '😌', match: /gaba|габа/i },
  milk_thistle: { label: 'Расторопша', emoji: '🫁', match: /milk.thistle|расторопш|silymarin|силимарин/i },
  ginger: { label: 'Имбирь', emoji: '🫚', match: /ginger|имбир|zingiber/i },
  garlic: { label: 'Чеснок', emoji: '🧄', match: /garlic|чеснок|allicin|аллицин/i },
  cinnamon: { label: 'Корица', emoji: '🟤', match: /cinnamon|кориц/i },
  saw_palmetto: { label: 'Пальма сереноа', emoji: '🌴', match: /saw.palmetto|пальма|сереноа/i },
  rhodiola: { label: 'Родиола', emoji: '🌹', match: /rhodiola|родиол/i },
  maca: { label: 'Мака', emoji: '🥔', match: /maca|мака/i },
  tribulus: { label: 'Трибулус', emoji: '💪', match: /tribulus|трибулус/i },
  tongkat_ali: { label: 'Тонгкат Али', emoji: '🌳', match: /tongkat|тонкат/i },
  dhea: { label: 'DHEA', emoji: '⚡', match: /dhea|дегидроэпиандростерон/i },
  pregnenolone: { label: 'Прегненолон', emoji: '🧬', match: /pregnenolone|прегненолон/i },
  htp: { label: '5-HTP', emoji: '😊', match: /5.htp|hydroxytryptophan|гидрокситриптофан/i },
  glycine: { label: 'Глицин', emoji: '💤', match: /glycine|глицин/i },
  glutamine: { label: 'Глютамин', emoji: '🔄', match: /glutamine|глютамин/i },
  lysine: { label: 'Лизин', emoji: '🛡', match: /lysine|лизин/i },
  hyaluronic: { label: 'Гиалуроновая к-та', emoji: '💧', match: /hyaluronic|гиалурон/i },
  glucosamine: { label: 'Глюкозамин', emoji: '🦴', match: /glucosamine|глюкозамин/i },
  chondroitin: { label: 'Хондроитин', emoji: '🦴', match: /chondroitin|хондроитин/i },
  msm: { label: 'MSM', emoji: '🔧', match: /msm|метилсульфонилметан/i },
  quercetin: { label: 'Кверцетин', emoji: '🧅', match: /quercetin|кверцетин/i },
  resveratrol: { label: 'Ресвератрол', emoji: '🍇', match: /resveratrol|ресвератрол/i },
  nmn: { label: 'NMN/NR/NAD+', emoji: '⏳', match: /nmn|nicotinamide.mononucleotide|nr|nad/i },
  pqq: { label: 'PQQ', emoji: '🔋', match: /pqq|pyrroloquinoline/i },
  bacopa: { label: 'Бакопа', emoji: '🌿', match: /bacopa|бакопа/i },
  ginkgo: { label: 'Гинкго', emoji: '🍃', match: /ginkgo|гинкго/i },
  lions_mane: { label: 'Ежовик гребенчатый', emoji: '🍄', match: /lion.*mane|ежовик|hericium/i },
  reishi: { label: 'Рейши', emoji: '🍄', match: /reishi|рейши|ganoderma/i },
  cordyceps: { label: 'Кордицепс', emoji: '🍄', match: /cordyceps|кордицепс/i },
  chaga: { label: 'Чага', emoji: '🍄', match: /chaga|чага|inonotus/i },
  tudca: { label: 'TUDCA', emoji: '🫁', match: /tudca|тауроурсодезоксихол/i },
  black_cumin: { label: 'Чёрный тмин', emoji: '⚫', match: /black.cumin|тмин|nigella/i },
  valerian: { label: 'Валериана', emoji: '😴', match: /valerian|валериан/i },
  passionflower: { label: 'Пассифлора', emoji: '🌸', match: /passionflower|пассифлор|passiflora/i },
  chamomile: { label: 'Ромашка', emoji: '🌼', match: /chamomile|ромашк/i },
  peppermint: { label: 'Мята', emoji: '🌿', match: /peppermint|мят/i },
  echinacea: { label: 'Эхинацея', emoji: '🌻', match: /echinacea|эхинаце/i },
  elderberry: { label: 'Бузина', emoji: '🫐', match: /elderberry|бузин|sambucus/i },
  astaxanthin: { label: 'Астаксантин', emoji: '🔴', match: /astaxanthin|астаксантин/i },
  lutein: { label: 'Лютеин', emoji: '👁', match: /lutein|лютеин|zeaxanthin|зеаксантин/i },
  grape_seed: { label: 'Виноградные косточки', emoji: '🍇', match: /grape.seed|виноград.*кост/i },
  green_tea: { label: 'Зелёный чай (EGCG)', emoji: '🍵', match: /green.tea|зелён.*чай|egcg|катехин/i },
  spirulina: { label: 'Спирулина/Хлорелла', emoji: '🌿', match: /spirulina|хлорел|спирулин/i },
  moringa: { label: 'Моринга', emoji: '🌳', match: /moringa|моринг/i },
  papaya_enzyme: { label: 'Папаин/Бромелайн', emoji: '🍍', match: /papain|bromelain|папаин|бромелайн/i },
  bile_salts: { label: 'Желчные соли', emoji: '💧', match: /bile.salt|желчн/i },
  betaine_hcl: { label: 'Бетаин HCl', emoji: '🧪', match: /betaine|бетаин|hcl/i },
};

const SYNERGY_COLORS: Record<string, string> = {
  synergistic: '#22c55e',
  additive: '#84cc16',
  potentiative: '#3b82f6',
  complementary: '#8b5cf6',
  antagonistic: '#ef4444',
};

const SUPPORT_CLASS_LABELS: Record<string, string> = {
  support: '💊 Поддержка',
  peptide_regenerative: '🧬 Регенерация',
  peptide_nootropic: '🧠 Ноотропы',
  peptide_immune: '🛡 Иммунная',
  bady: '🌿 БАДы',
};

const MECH_LABELS: Record<string,string> = { ...MECHANISM_LABELS,
  'NAD_PATHWAY': 'NAD+ метаболизм', 'MITO_REPAIR': 'Митохондриальная защита',
  'OXIDATIVE_STRESS_REDUCTION': 'Антиоксидант', 'COLLAGEN_SUPPORT': 'Синтез коллагена',
  'CALCIUM_HOMEOSTASIS': 'Кальциевый гомеостаз', 'CALCIUM_DISTRIBUTION': 'Распределение Ca²⁺',
  'BONE_MINERALIZATION': 'Минерализация костей', 'MEMBRANE_PROTECTION': 'Защита мембран',
  'SIRT1_ACTIVATION': 'Активация SIRT1', 'IMMUNE_SUPPORT': 'Иммунная поддержка',
  'IMMUNE_MODULATION': 'Иммуномодуляция', 'NEUROTRANSMITTER_SUPPORT': 'Нейротрансмиттеры',
  'HOMOCYSTEINE_REDUCTION': 'Снижение гомоцистеина', 'CARBOXYLASE_SUPPORT': 'Кофактор карбоксилаз',
  'METHYLATION': 'Метилирование', 'CELL_DIVISION': 'Деление клеток',
  'MYELIN_REPAIR': 'Репарация миелина', 'CELL_REPAIR': 'Репарация клеток',
  'ENERGY': 'Энергетический обмен', 'NITRIC_OXIDE_BINDING': 'Связывание NO',
  'LIPOSOMAL_DELIVERY': 'Липосомальная доставка', 'ELECTRON_TRANSPORT_CHAIN': 'Электрон-транспортная цепь',
  'ANTIOXIDANT': 'Антиоксидант', 'GLUTATHIONE_RECYCLING': 'Рециклинг глутатиона',
  'GLUCOSE_REGULATION': 'Регуляция глюкозы', 'INSULIN_SENSITIVITY': 'Чувствительность к инсулину',
  'INSULIN_SIGNALING': 'Инсулиновый сигналинг', 'SEROTONIN_SUPPORT': 'Серотонин',
  'SKIN_REPAIR': 'Репарация кожи', 'ANTI_INFLAMMATION': 'Противовоспалительное',
  'OXYGEN_UTILIZATION': 'Утилизация кислорода', 'METHYL_DONOR': 'Донор метильных групп',
  'FATTY_ACID_TRANSPORT': 'Транспорт жирных кислот', 'ATP_PRODUCTION': 'Продукция АТФ',
  'COA_PATHWAY': 'Кофермент А', 'HORMONE_SYNTHESIS': 'Синтез гормонов',
  'LIPID_METABOLISM': 'Метаболизм липидов', 'FLAVIN_PATHWAY': 'Флавиновый обмен',
  'TPP_PATHWAY': 'Тиаминпирофосфат', 'NERVE_REPAIR': 'Репарация нервов',
  'NERVE_PROTECTION': 'Защита нервов', 'ANTI_GLYCATION': 'Анти-гликирование',
  'RETINOID_SIGNALING': 'Ретиноидный сигналинг', 'CAROTENOID_PATHWAY': 'Каротиноидный обмен',
  'LIPID_BALANCE': 'Баланс липидов', 'NAD_SYNTHESIS': 'Синтез NAD+',
  'MITO_BIOGENESIS': 'Биогенез митохондрий', 'VASCULAR_RELAXATION': 'Вазодилатация',
  'GABA_SUPPORT': 'ГАМК-поддержка', 'CALCIUM_REGULATION': 'Регуляция Ca²⁺',
  'SULFITE_OXIDASE': 'Сульфитоксидаза', 'DETOX': 'Детоксикация',
  'BONE_METABOLISM': 'Костный метаболизм', 'TESTOSTERONE_SUPPORT': 'Поддержка тестостерона',
};
const SUPPORT_MED_DETAIL: Record<string, {
  description: string;
  mechanism: string;
  mechanismKeys: string[];
  systems: { key: string; label: string; mechanisms: string[] }[];
  risks: string[];
  contraindications: string[];
}> = {
  telmisartan: {
    description: 'Телмисартан (Микардис) — АРБ с уникальным PPAR-γ частичным агонизмом. Кардиопротекция, нефропротекция, улучшение липидного обмена на ААС курсах.',
    mechanism: 'Блокада AT1-рецепторов ангиотензина II → ↓ вазоконстрикция, ↓ альдостерон → ↓ АД. Частичный агонист PPAR-γ → ↑ инсулиновая чувствительность, ↑ липидный обмен. Снижает TGF-β1 → нефропротекция.',
    mechanismKeys: ['AT1_BLOCK', 'ALDOSTERONE_DOWN', 'BP_DOWN'],
    systems: [
      { key: 'cardio', label: 'Сердечно-сосудистая', mechanisms: ['Снижение АД', 'Снижение гипертрофии ЛЖ'] },
      { key: 'renal', label: 'Почечная', mechanisms: ['Нефропротекция', 'Снижение протеинурии'] },
    ],
    risks: ['Гипотензия при передозировке', 'Головокружение', 'Гиперкалиемия (редко)'],
    contraindications: ['Беременность', 'Двусторонний стеноз почечных артерий', 'Одновременный приём ИАПФ'],
  },
nebivolol: {
    description: 'Небиволол (Небилет) — кардиоселективный β1-блокатор III поколения с NO-вазодилатацией. Снижает АД и ЧСС, защищает миокард, улучшает эндотелиальную функцию.',
    mechanism: 'Кардиоселективная блокада β1-адренорецепторов → ↓ ЧСС, ↓ сократимость, ↓ АД. Активация eNOS → ↑ NO → вазодилатация. Снижает окислительный стресс в сосудах.',
    mechanismKeys: ['BETA1_BLOCK', 'NO_UP', 'HR_DOWN'],
    systems: [
      { key: 'cardio', label: 'Сердечно-сосудистая', mechanisms: ['Снижение ЧСС и АД', 'NO-вазодилатация', 'Кардиопротекция'] },
    ],
    risks: ['Брадикардия при передозировке', 'Усталость', 'Гипотензия'],
    contraindications: ['AV-блокада II-III степени', 'Кардиогенный шок', 'Бронхиальная астма (с осторожностью)'],
  },
  hcg: {
    description: 'Хорионический гонадотропин (ХГЧ) — аналог ЛГ. Стимулирует клетки Лейдига → эндогенный тестостерон. Предотвращает атрофию яичек на курсе ААС.',
    mechanism: 'Связывается с LH/CG-рецепторами на клетках Лейдига → ↑ цАМФ → стероидогенез → ↑ тестостерон. Стимулирует сперматогенез через поддержание интратестикулярного тестостерона.',
    mechanismKeys: ['LH_MIMETIC', 'TESTOSTERONE_UP', 'HPTA_SUPPORT'],
    systems: [
      { key: 'reproductive', label: 'Репродуктивная', mechanisms: ['Стимуляция Лейдигов', 'Предотвращение атрофии яичек'] },
    ],
    risks: ['Эстрогенные эффекты (гинекомастия)', 'Подавление HPTA при высоких дозах', 'Сенсибилизация яичников к ЛГ'],
    contraindications: ['Рак простаты', 'Рак яичка', 'Преждевременное половое созревание'],
  },
  nac: {
    description: 'N-ацетилцистеин — предшественник глутатиона, главного внутриклеточного антиоксиданта. Гепатопротектор, нейропротектор, муколитик. Основа любой поддержки печени.',
    mechanism: 'Деацетилирование → цистеин → глутатион (GSH). Нейтрализация ROS и электрофильных токсинов. Модуляция NF-κB → противовоспалительное действие. Расщепление дисульфидных связей мукопротеинов → муколитик.',
    mechanismKeys: ['GSH_UP', 'ROS_DOWN', 'DETOX_UP', 'NFkB_DOWN'],
    systems: [
      { key: 'hepatic', label: 'Печёночная', mechanisms: ['Синтез глутатиона', 'Детоксикация'] },
      { key: 'cardio', label: 'Сердечно-сосудистая', mechanisms: ['Антиоксидантная защита'] },
      { key: 'neuro', label: 'Нервная', mechanisms: ['Нейропротекция'] },
    ],
    risks: ['Тошнота, ЖК-дискомфорт', 'Неприятный запах', 'Аллергические реакции (редко)'],
    contraindications: ['Бронхиальная астма (ингаляционно)', 'Тяжёлая печёночная недостаточность'],
  },
  tudca: {
    description: 'TUDCA (таурсооксихолевая кислота) — урсодезоксихолевая кислота с таурином. Мощный гепатопротектор: стабилизирует митохондрии, восстанавливает желчеотток, снижает апоптоз гепатоцитов.',
    mechanism: 'Стабилизация митохондриальных мембран → ↓ апоптоз гепатоцитов. Усиление желчеоттока → растворение холестаза. Активация рецепторов FXR/TGR5 → противовоспалительный эффект.',
    mechanismKeys: ['MITO_STABILIZE', 'BILE_FLOW_UP', 'APOPTOSIS_DOWN'],
    systems: [
      { key: 'hepatic', label: 'Печёночная', mechanisms: ['Стабилизация митохондрий', 'Восстановление желчеоттока', 'Снижение апоптоза'] },
    ],
    risks: ['Диарея при высоких дозах', 'Дискомфорт в правом подреберье'],
    contraindications: ['Желчнокаменная болезнь (с осторожностью)', 'Обструкция жёлчных путей'],
  },
  omega3: {
    description: 'Омега-3 (EPA + DHA) — эссенциальные жирные кислоты. Кардиопротектор, противовоспалительный, нейропротектор. Улучшает липидный профиль, снижает триглицериды.',
    mechanism: 'EPA → резолвины/протектины (SPM) → синтетическое разрешение воспаления; DHA → структурный компонент нейромембран; конкуренция с AA → ↓ PGE2. Активация PPAR-α → ↓ триглицериды.',
    mechanismKeys: ['SPM_UP', 'TG_DOWN', 'NFkB_DOWN', 'NEURO_MEMBRANE'],
    systems: [
      { key: 'cardio', label: 'Сердечно-сосудистая', mechanisms: ['Снижение триглицеридов', 'Антивоспалительное', 'Антиаритмическое'] },
      { key: 'neuro', label: 'Нервная', mechanisms: ['Структура нейромембран', 'Нейропротекция'] },
    ],
    risks: ['Рыбный запах от тела', 'Разжижение крови при высоких дозах', 'ЖК-дискомфорт'],
    contraindications: ['Гемофилия', 'Приём антикоагулянтов без контроля МНО'],
  },
  magnesium: {
    description: 'Магний бисглицинат — хелатная форма магния с высокой биодоступностью. Успокаивает ЦНС, снижает кортизол, расслабляет мышцы, поддерживает сердце.',
    mechanism: 'Блокада NMDA-рецепторов → ↓ возбудимость нейронов. Активация ГАМК-рецепторов → седативный эффект. Кофактор АТФазы → энергетический обмен. Блокада кальциевых каналов → расслабление гладкой мускулатуры.',
    mechanismKeys: ['NMDA_DOWN', 'GABA_UP', 'ATPASE_UP', 'CA_CHANNELS_DOWN'],
    systems: [
      { key: 'neuro', label: 'Нервная', mechanisms: ['Снижение тревожности', 'Улучшение сна'] },
      { key: 'cardio', label: 'Сердечно-сосудистая', mechanisms: ['Снижение АД', 'Антиаритмическое'] },
    ],
    risks: ['Диарея при высоких дозах', 'Сонливость', 'Гипотензия'],
    contraindications: ['AV-блокада', 'Тяжёлая почечная недостаточность'],
  },
  berberine: {
    description: 'Берберин — алкалоид растений. Мощный АМПК-активатор, снижает сахар, улучшает липидный профиль, ингибирует CYP3A4. Природный метформин.',
    mechanism: 'Активация АМПК → ↑ инсулиновая чувствительность, ↑ глюкозный транспорт. Ингибирование CYP3A4 → взаимодействие с фармпрепаратами. Снижение ЛПНП через PCSK9. ↓ липогенез в печени.',
    mechanismKeys: ['AMPK_UP', 'INSULIN_SENSITIVITY_UP', 'CYP3A4_INHIBIT', 'LDL_DOWN'],
    systems: [
      { key: 'endocrine', label: 'Эндокринная', mechanisms: ['Снижение сахара', 'Сенсибилизация к инсулину'] },
      { key: 'hepatic', label: 'Печёночная', mechanisms: ['Активация АМПК'] },
      { key: 'cardio', label: 'Сердечно-сосудистая', mechanisms: ['Снижение ЛПНП'] },
    ],
    risks: ['ЖК-дискомфорт', 'CYP3A4-опосредованные взаимодействия', 'Гипогликемия при комбинации с сахароснижающими'],
    contraindications: ['Беременность', 'Приём макролидов/статинов без контроля', 'Тяжёлые заболевания печени'],
  },
  coq10: {
    description: 'Коэнзим Q10 (убихинон) — ключевой компонент дыхательной цепи митохондрий. Антиоксидант, кардиопротектор, регенерирует витамин E. Критичен на ААС курсах при HEFT-нагрузке.',
    mechanism: 'Электрон-транспортная цепь (комплекс I-III) → АТФ-синтез. Антиоксидант в липидных мембранах. Регенерирует витамин E из токоферил-радикала. Снижает окисление ЛПНП.',
    mechanismKeys: ['ETC_UP', 'ATP_UP', 'ANTIOXIDANT', 'VITE_REGEN'],
    systems: [
      { key: 'cardio', label: 'Сердечно-сосудистая', mechanisms: ['Энергетика миокарда', 'Антиоксидант', 'Снижение окисления ЛПНП'] },
      { key: 'neuro', label: 'Нервная', mechanisms: ['Митохондриальная защита'] },
    ],
    risks: ['Лёгкий ЖК-дискомфорт', 'Бессонница при вечернем приёме'],
    contraindications: ['Приём варфарина (снижает антикоагулянтный эффект)'],
  },
  vitamin_d3: {
    description: 'Витамин D3 (холекальциферол) — стероидный прогормон. Критичен для иммунитета, костного метаболизма и тестостерона. Дефицит есть у 80% населения.',
    mechanism: 'Гидроксилирование в печени (25-OH-D3) → почках (1,25-OH2-D3 = кальцитриол) → связывание с VDR → ↑ >200 генов. ↑ всасывание Ca/P, ↑ иммунитет через кателицидины, ↑ тестостерон через стимуляцию ЛГ.',
    mechanismKeys: ['VDR_UP', 'CALCIUM_UP', 'IMMUNE_MOD', 'AR_UP'],
    systems: [
      { key: 'endocrine', label: 'Эндокринная', mechanisms: ['↑ тестостерон через ЛГ', '↑ всасывание кальция'] },
      { key: 'neuro', label: 'Нервная', mechanisms: ['Иммуномодуляция'] },
    ],
    risks: ['Гиперкальциемия при передозировке', 'Тошнота при высоких дозах', 'Камни в почках (редко)'],
    contraindications: ['Гиперкальциемия', 'Саркоидоз', 'Тяжёлая почечная недостаточность'],
  },
  zinc: {
    description: 'Цинк пиколинат — хелатная форма цинка с максимальной биодоступностью. Кофактор 5α-редуктазы, супероксиддисмутазы, иммунных ферментов. Критичен для тестостерона.',
    mechanism: 'Кофактор 5α-редуктазы → конверсия тестостерон→ДГТ. Кофактор Zn-зависимой SOD → антиоксидантная защита. Кофактор >300 ферментов. ↑ иммунитет через тимулин и Т-клетки.',
    mechanismKeys: ['5AR_UP', 'AR_UP', 'SOD_UP', 'IMMUNE_UP'],
    systems: [
      { key: 'reproductive', label: 'Репродуктивная', mechanisms: ['Поддержка тестостерона', '5α-редуктаза'] },
      { key: 'hematologic', label: 'Гематологическая', mechanisms: ['Zn-зависимый иммунитет', 'SOD-антиоксидант'] },
    ],
    risks: ['Тошнота натощак', 'Взаимодействие с медью (длительный приём)', 'Снижение меди при высоких дозах'],
    contraindications: ['Болезнь Вильсона', 'Одновременный приём антибиотиков тетрациклинового ряда'],
  },
alpha_lipoic: {
    description: 'Альфа-липоевая кислота (ALA) — универсальный водорасстворимый антиоксидант. Регенерирует витамины C, E и глутатион. Нейропротектор, гепатопротектор, митохондриальный кофактор.',
    mechanism: 'Кофактор ПВК-дегидрогеназы (PDH) → энергетический обмен. Прямое scavenging ROS. Регенерация GSH, витаминов C и E. Хелатирование тяжёлых металлов (Fe, Cu).',
    mechanismKeys: ['ROS_SCAVENGE', 'GSH_REGEN', 'PDH_UP', 'MITO_UP'],
    systems: [
      { key: 'neuro', label: 'Нервная', mechanisms: ['Нейропротекция', 'Регенерация GSH', 'Митохондриальная защита'] },
      { key: 'cardio', label: 'Сердечно-сосудистая', mechanisms: ['Антиоксидант', 'Антигликирование'] },
    ],
    risks: ['Гипогликемия при комбинации с сахароснижающими', 'ЖК-дискомфорт', 'Кожная сыпь (редко)'],
    contraindications: ['Тиреотоксикоз (без контроля)', 'Приём химиотерапии (без разрешения)'],
  },
  ashwagandha: {
    description: 'Withania somnifera — адаптоген. Снижает кортизол, модулирует GABA, защищает нейроны, поддерживает тестостерон. Анксиолитик + нейропротектор + эндокринный модулятор.',
    mechanism: 'Модуляция GABA-А рецепторов → анксиолитический эффект. ↓ кортизол через ингибирование HPA-оси. ↑ LH → ↑ тестостерон. ↑ SOD и каталаза → антиоксидантная защита нейронов.',
    mechanismKeys: ['GABA_MOD', 'CORTISOL_DOWN', 'HPA_MOD', 'LH_UP'],
    systems: [
      { key: 'neuro', label: '', mechanisms: ['', '', ''] },
      { key: 'endocrine', label: '', mechanisms: ['', ''] },
      { key: 'reproductive', label: '', mechanisms: [''] },
    ],
    risks: ['', '', ''],
    contraindications: ['', '', ''],
  },
  saw_palmetto: {
    description: 'Serenoa repens — ингибитор 5α-редуктазы и α1-адренорецепторов. Защита простаты, снижение DHT-опосредованных рисков, мочегонное.',
    mechanism: 'Ингибирование 5α-редуктазы → ↓ конверсия тестостерон→ДГТ. Блокада α1-адренорецепторов → расслабление гладкой мускулатуры простаты. Антиандрогенный эффект локальный.',
    mechanismKeys: ['5AR_INHIBIT', 'DHT_DOWN', 'ALPHA1_BLOCK'],
    systems: [
      { key: 'reproductive', label: '', mechanisms: ['', '', ''] },
    ],
    risks: ['', '', ''],
    contraindications: ['', '', ''],
  },
  celery_extract: {
    description: 'Экстракт сельдерея — диуретик, урикостатик, вазодилататор. Мочегонное, снижает мочевую кислоту, улучшает NO-путь. Нефропротектор.',
    mechanism: 'Диуретическое действие через фталиды. Снижение мочевой кислоты (урикодавление). NO-вазодилатация через фталиды. Защита подоцитов почек.',
    mechanismKeys: ['DIURESIS_UP', 'URIC_DOWN', 'NO_UP', 'KIDNEY_PROTECT'],
    systems: [
      { key: 'renal', label: 'Почечная', mechanisms: ['Мочегонное', 'Снижение мочевой кислоты', 'Защита подоцитов'] },
      { key: 'cardio', label: 'Сердечно-сосудистая', mechanisms: ['NO-вазодилатация', 'Снижение АД'] },
    ],
    risks: ['Увеличение диуреза', 'Фотосенсибилизация', 'Взаимодействие с литием'],
    contraindications: ['Тяжёлая почечная недостаточность', 'Приём лития'],
  },
  vitamin_k2: {
    description: 'Витамин K2 (МК-7) — активатор остеокальцина и матриксного Gla-белка. Направляет кальций в кости, предотвращает кальцификацию сосудов.',
    mechanism: 'γ-карбоксилирование остеокальцина → связывание Ca в костях. γ-карбоксилирование MGP (матриксный Gla-белок) → ингибирование кальцификации сосудов. Синергия с витамином D3.',
    mechanismKeys: ['GLA_UP', 'CALCIUM_TARGETING', 'BONE_UP', 'VASCULAR_PROTECT'],
    systems: [
      { key: 'cardio', label: 'Сердечно-сосудистая', mechanisms: ['Предотвращение кальцификации сосудов', 'Защита клапанов'] },
      { key: 'endocrine', label: 'Эндокринная', mechanisms: ['Костный метаболизм'] },
      { key: 'hepatic', label: 'Печёночная', mechanisms: ['Коагуляция'] },
    ],
    risks: ['Взаимодействие с варфарином (антагонизм)', 'Тромбоз при высоких дозах без показаний'],
    contraindications: ['Приём антикоагулянтов (варфарин)', 'Тромбофилия'],
  },
  selenium: {
    description: 'Селен (селексен) — кофактор глутатионпероксидазы (GPx) и дейодиназы тиреоидных гормонов. Антиоксидант, поддержка щитовидной железы, иммуномодулятор.',
    mechanism: 'Кофактор GPx → преобразование H2O2 в H2O. Кофактор 5-дейодиназы → конверсия T4→T3 (активный тиреоидный гормон). ↑ иммунитет через селено-протеины. Антиоксидантная защита мембран.',
    mechanismKeys: ['GPX_UP', 'T3_UP', 'IMMUNE_UP', 'ANTIOXIDANT'],
    systems: [
      { key: 'endocrine', label: 'Эндокринная', mechanisms: ['Конверсия T4→T3', 'Поддержка щитовидной'] },
      { key: 'hematologic', label: 'Гематологическая', mechanisms: ['Иммуномодуляция'] },
      { key: 'neuro', label: 'Нервная', mechanisms: ['Антиоксидантная защита'] },
    ],
    risks: ['Токсичность при дозах >400 мкг/день', 'Запах чеснока изо рта', 'Выпадение волос при передозировке'],
    contraindications: ['Тиреотоксикоз (без контроля)', 'Одновременный приём высоких доз цинка'],
  },
  milk_thistle: {
    description: 'Расторопша (силимарин) — гепатопротектор №1 в фитотерапии. Стабилизирует мембраны гепатоцитов, стимулирует синтез белка, активирует глутатион-S-трансферазу.',
    mechanism: 'Силибинин → стабилизация мембран гепатоцитов → ↓ проникновение токсинов. ↑ синтез белка и регенерация печени. Активация GST (глутатион-S-трансфераза) → детоксикация. Ингибирование NF-κB → противовоспалительное.',
    mechanismKeys: ['MEMBRANE_STABILIZE', 'PROTEIN_SYNTHESIS_UP', 'GST_UP', 'NFkB_DOWN'],
    systems: [
      { key: 'hepatic', label: 'Печёночная', mechanisms: ['Стабилизация мембран', 'Регенерация ткани', 'Активация GST', 'Ингибирование NF-κB'] },
    ],
    risks: ['Диарея при высоких дозах', 'Аллергические реакции (редко)', 'Взаимодействие с CYP3A4'],
    contraindications: ['Желчнокаменная болезнь (с осторожностью)', 'Беременность'],
  },
  probiotics: {
    description: 'Пробиотики (Lactobacillus/Bifidobacterium) — живые микроорганизмы для восстановления микробиома. Улучшают пищеварение, иммунитет, кишечный барьер.',
    mechanism: 'Колонизация кишечника → продукция короткоцепочечных жирных кислот (бутират, пропионат, ацетат). Модуляция иммунной системы через Treg. Укрепление кишечного барьера через tight junctions. Конкуренция с патогенами.',
    mechanismKeys: ['MICROBIOME_UP', 'SCFA_UP', 'IMMUNE_MOD', 'GUT_BARRIER_UP'],
    systems: [
      { key: 'hepatic', label: 'Печёночная', mechanisms: ['Снижение эндотоксемии', 'Улучшение пищеварения'] },
      { key: 'hematologic', label: 'Гематологическая', mechanisms: ['Иммуномодуляция', 'Снижение воспаления'] },
    ],
    risks: ['Вздутие живота в первые дни', 'Риск инфекции у иммунокомпрометированных'],
    contraindications: ['Тяжёлый иммунодефицит', 'Центральный венозный катетер (риск фунгемии)'],
  },
  vitamin_b12: {
    description: 'Витамин B12 (метилкобаламин) — кофактор метионинсинтазы и метилмалонил-КоА мутазы. Критичен для миелинизации нервов, эритропоэза и метилирования ДНК.',
    mechanism: 'Метилкобаламин → кофактор метионинсинтазы → реметилирование гомоцистеина в метионин. Кофактор метилмалонил-КоА мутазы → превращение пропионата в сукцинил-КоА. Поддержка миелинизации.',
    mechanismKeys: ['METHIONINE_UP', 'HCY_DOWN', 'MYELIN_UP', 'ERYTHROPOIESIS_UP'],
    systems: [
      { key: 'hematologic', label: 'Гематологическая', mechanisms: ['Эритропоэз', 'Снижение гомоцистеина'] },
      { key: 'neuro', label: 'Нервная', mechanisms: ['Миелинизация', 'Нейропротекция'] },
    ],
    risks: ['Аллергические реакции (редко)', 'Акне (при высоких дозах)'],
    contraindications: ['Болезнь Лебера', 'Дефицит калия при начале терапии'],
  },
  vitamin_b6: {
    description: 'Витамин B6 (пиридоксаль-5-фосфат, P5P) — кофактор трансаминаз, декарбоксилаз и синтеза нейромедиаторов. Критичен для синтеза серотонина, дофамина и ГАМК.',
    mechanism: 'P5P → трансаминазы, декарбоксилазы; синтез серотонина/дофамина/GABA; гем-синтез через ALA-синтазу; снижение гомоцистеина',
    mechanismKeys: ['AAT_UP', 'SEROTONIN_UP', 'GABA_UP', 'HCY_DOWN', 'HEM_UP'],
    systems: [
      { key: 'neuro', label: 'Нервная', mechanisms: ['Синтез серотонина и дофамина', 'ГАМК-ергическая передача'] },
      { key: 'hematologic', label: 'Гематологическая', mechanisms: ['Гем-синтез', 'Снижение гомоцистеина'] },
      { key: 'hepatic', label: 'Печёночная', mechanisms: ['Трансаминазы'] },
    ],
    risks: ['Периферическая нейропатия при дозах >200 мг/день', 'Сенсибилизация к солнцу'],
    contraindications: ['Болезнь Паркинсона (при приёме леводопы)', 'Длительный приём высоких доз'],
  },
  folate: {
    description: '5-метилтетрагидрофолат — активная форма фолиевой кислоты. Метилирование ДНК, эритропоэз, снижение гомоцистеина. Обходит MTHFR-мутации.',
    mechanism: '5-МТГФ → метильный донор для метионинсинтазы (с B12) → метилирование ДНК; тимидилат-синтаз → синтез ДНК; снижение гомоцистеина',
    mechanismKeys: ['DNA_METHYLATION_UP', 'THYMIDYLATE_UP', 'HCY_DOWN', 'RBC_UP'],
    systems: [
      { key: 'hematologic', label: 'Гематологическая', mechanisms: ['Эритропоэз', 'Синтез ДНК', 'Снижение гомоцистеина'] },
      { key: 'cardio', label: 'Сердечно-сосудистая', mechanisms: ['Снижение гомоцистеина'] },
    ],
    risks: ['Маскировка дефицита B12 при приёме без B12', 'Судороги при эпилепсии (редко)'],
    contraindications: ['Дефицит B12 без одновременного приёма B12', 'Эпилепсия (без контроля)'],
  },
  iron: {
    description: 'Железо (Fe²⁺) — эссенциальный микроэлемент. Компонент гемоглобина, миоглобина, цитохромов. Критичен для транспорта кислорода и энергетического обмена.',
    mechanism: 'Fe²⁺ → гем → гемоглобин/миоглобин. Fe-S-кластеры → комплексы I-III дыхательной цепи. Fe → каталаза/пероксидаза → антиоксидантная защита.',
    mechanismKeys: ['HEM_UP', 'O2_TRANSPORT', 'ETC_UP', 'OXYGEN_UP'],
    systems: [
      { key: 'hematologic', label: 'Гематологическая', mechanisms: ['Синтез гемоглобина', 'Транспорт кислорода'] },
      { key: 'cardio', label: 'Сердечно-сосудистая', mechanisms: ['Энергетика миокарда', 'Цитохромы'] },
    ],
    risks: ['Гемохроматоз при хронической передозировке', 'ЖК-дискомфорт (запор)', 'Окислительный стресс при избытке', 'Взаимодействие с тетрациклинами'],
    contraindications: ['Гемохроматоз', 'Гемосидероз', 'Талассемия', 'Приём леводопы/тетрациклинов'],
  },
  copper: {
    description: 'Медь — кофактор Cu/Zn-SOD, цитохром-c-оксидазы, лизилоксидазы. Критична для антиоксидантной защиты, энергетического обмена и синтеза коллагена/эластина.',
    mechanism: 'Cu/Zn-SOD → антиоксидант; цитохром-c-оксидаза → терминальный комплекс ЭТК; лизилоксидаза → кросслинкинг коллагена/эластина; церулоплазмин → Fe-транспорт',
    mechanismKeys: ['SOD_UP', 'ETC_UP', 'COLLAGEN_UP', 'FE_TRANSPORT'],
    systems: [
      { key: 'hematologic', label: 'Гематологическая', mechanisms: ['Cu/Zn-SOD антиоксидант', 'Железотранспорт через церулоплазмин'] },
      { key: 'neuro', label: 'Нервная', mechanisms: ['Цитохром-c-оксидаза', 'Миелинизация'] },
      { key: 'cardio', label: 'Сердечно-сосудистая', mechanisms: ['Лизилоксидаза → эластин'] },
    ],
    risks: ['Токсичность при высоких дозах', 'Взаимодействие с цинком (антагонизм)', 'Болезнь Вильсона при дисбалансе'],
    contraindications: ['Болезнь Вильсона', 'Одновременный приём высоких доз цинка'],
  },
astragalus: {
    description: 'Астрагал (Astragalus membranaceus) — нефропротектор, иммуномодулятор. Защищает подоциты почек, снижает TGF-β1, модулирует NF-κB. Используется в китайской медицине тысячелетиями.',
    mechanism: 'Защита подоцитов через астрагалозиды. ↓ TGF-β1 → ↓ фиброз почек. Ингибирование NF-κB → противовоспалительное действие. ↑ иммунитет через активацию макрофагов и NK-клеток.',
    mechanismKeys: ['PODOCYTE_PROTECT', 'NFkB_DOWN', 'TGF_B1_DOWN', 'IMMUNE_UP'],
    systems: [
      { key: 'renal', label: 'Почечная', mechanisms: ['Защита подоцитов', 'Снижение фиброза', 'Противовоспалительное'] },
      { key: 'cardio', label: 'Сердечно-сосудистая', mechanisms: ['Кардиопротекция'] },
      { key: 'hematologic', label: 'Гематологическая', mechanisms: ['Иммуномодуляция'] },
    ],
    risks: ['Взаимодействие с иммунодепрессантами', 'Снижение сахара (с осторожностью при диабете)', 'Возможная аллергия'],
    contraindications: ['Аутоиммунные заболевания (без контроля)', 'Приём иммунодепрессантов'],
  },
  taurine: {
    description: 'Таурин — условно-незаменимая аминокислота. Конъюгация жёлчных кислот, осморегуляция, ГАМК-миметик, антиоксидант. Кардиопротектор и нейропротектор.',
    mechanism: 'Конъюгация жёлчных кислот → эмульгация жиров. Осморегуляция клеток. ГАМК-А агонист → седативный эффект. Модуляция Ca²⁺-каналов в кардиомиоцитах → инотропная поддержка.',
    mechanismKeys: ['BILE_ACID_CONJUGATE', 'OSMOLYTE', 'GABA_AGONIST', 'CA_MOD', 'ANTIOXIDANT'],
    systems: [
      { key: 'cardio', label: 'Сердечно-сосудистая', mechanisms: ['Инотропная поддержка', 'Антиаритмическое', 'Снижение АД'] },
      { key: 'hepatic', label: 'Печёночная', mechanisms: ['Конъюгация жёлчных кислот', 'Осморегуляция'] },
      { key: 'neuro', label: 'Нервная', mechanisms: ['ГАМК-миметический эффект', 'Нейропротекция'] },
      { key: 'renal', label: 'Почечная', mechanisms: ['Осморегуляция', 'Антиоксидант'] },
    ],
    risks: ['Сонливость при высоких дозах', 'Диарея при дозах >6 г', 'Снижение АД'],
    contraindications: ['Тяжёлая гипотензия', 'Приём лития (без контроля)'],
  },
  melatonin: {
    description: 'Мелатонин — гормон шишковидной железы. Регулятор циркадных ритмов, антиоксидант, снижает кортизол. Критичен для восстановления на ААС курсах.',
    mechanism: 'MT1/MT2 → циркадная регуляция сна. Проникновение в митохондрии → антиоксидант (прямое scavenging ROS). ↓ кортизол через ингибирование HPA-оси. ↑ BDNF → нейропластичность. Иммуностью модуляция.',
    mechanismKeys: ['CIRCADIAN_UP', 'MITO_ANTIOX', 'CORTISOL_DOWN', 'BDNF_UP', 'SLEEP_UP'],
    systems: [
      { key: 'neuro', label: 'Нервная', mechanisms: ['Регуляция сна', 'Снижение кортизола', '↑ BDNF'] },
      { key: 'endocrine', label: 'Эндокринная', mechanisms: ['Ингибирование HPA-оси', 'Циркадная регуляция'] },
      { key: 'cardio', label: 'Сердечно-сосудистая', mechanisms: ['Снижение АД ночью'] },
    ],
    risks: ['Сонливость утром при высоких дозах', 'Яркие сновидения', 'Головная боль'],
    contraindications: ['Аутоиммунные заболевания', 'Приём иммунодепрессантов'],
  },
  ginseng: {
    description: 'Женьшень (Panax ginseng) — адаптоген, модулятор HPA-оси. Повышает NO-продукцию, BDNF, ЛГ. Антиусталостное, нейропротекторное, иммуномодулирующее действие.',
    mechanism: 'Модуляция HPA-оси → адаптогенный эффект. ↑ NO через eNOS → вазодилатация. ↑ BDNF → нейропластичность. ↑ ЛГ → тестостерон. Иммуномодуляция через макрофаги и NK-клетки.',
    mechanismKeys: ['HPA_MOD', 'NO_UP', 'BDNF_UP', 'LH_UP', 'IMMUNE_MOD'],
    systems: [
      { key: 'endocrine', label: 'Эндокринная', mechanisms: ['↑ ЛГ и тестостерон', 'Модуляция HPA-оси'] },
      { key: 'neuro', label: 'Нервная', mechanisms: ['↑ BDNF', 'Антиусталостное действие'] },
      { key: 'cardio', label: 'Сердечно-сосудистая', mechanisms: ['NO-вазодилатация'] },
      { key: 'hematologic', label: 'Гематологическая', mechanisms: ['Иммуномодуляция'] },
    ],
    risks: ['Бессонница', 'Головная боль', 'Гипогликемия', 'Тахикардия при высоких дозах'],
    contraindications: ['Беременность', 'Неконтролируемая гипертензия', 'Приём антикоагулянтов'],
  },
  egcg: {
    description: 'EGCG (эпигаллокатехин галлат) — главный катехин зелёного чая. Мощный антиоксидант, AMPK-активатор, хелатор железа, ингибитор NF-κB. Кардио- и нейропротектор.',
    mechanism: 'Прямое scavenging ROS и хелатирование железа. Активация AMPK → ↑ липидный обмен, ↓ липогенез. Ингибирование NF-κB → противовоспалительное действие. ↓ окисление ЛПНП.',
    mechanismKeys: ['ROS_SCAVENGE', 'FE_CHELATE', 'AMPK_UP', 'NFkB_DOWN', 'LDL_OX_DOWN'],
    systems: [
      { key: 'cardio', label: 'Сердечно-сосудистая', mechanisms: ['Снижение окисления ЛПНП', 'Антивоспалительное'] },
      { key: 'hepatic', label: 'Печёночная', mechanisms: ['Активация AMPK', 'Жиросжигание'] },
      { key: 'neuro', label: 'Нервная', mechanisms: ['Нейропротекция', 'Антиоксидант'] },
      { key: 'hematologic', label: 'Гематологическая', mechanisms: ['Хелатирование железа'] },
    ],
    risks: ['Гепатотоксичность при высоких дозах (>800 мг)', 'Взаимодействие с фолатом', 'Снижение всасывания железа'],
    contraindications: ['Беременность', 'Железодефицитная анемия', 'Приём фолиевой кислоты одновременно'],
  },
  curcumin: {
    description: 'Куркумин с пиперином — мощный противовоспалительный и антиоксидант. Ингибирует NF-κB, COX-2, AMPK-активатор. Биодоступность ↑2000% с пиперином.',
    mechanism: 'Ингибирование NF-κB → ↓ TNF-α, ↓ IL-6, ↓ COX-2. Активация AMPK → ↓ липогенез. Хелатирование железа. Ингибирование CYP3A4 (через пиперин). ↑ BDNF в гиппокампе.',
    mechanismKeys: ['NFkB_DOWN', 'COX2_DOWN', 'AMPK_UP', 'FE_CHELATE', 'CYP3A4_INHIBIT'],
    systems: [
      { key: 'hepatic', label: 'Печёночная', mechanisms: ['Активация AMPK', 'Противовоспалительное'] },
      { key: 'cardio', label: 'Сердечно-сосудистая', mechanisms: ['Антиоксидант'] },
      { key: 'neuro', label: 'Нервная', mechanisms: ['↑ BDNF', 'Нейропротекция'] },
      { key: 'hematologic', label: 'Гематологическая', mechanisms: ['Хелатирование железа'] },
    ],
    risks: ['CYP3A4-опосредованные взаимодействия (через пиперин)', 'ЖК-дискомфорт', 'Разжижение крови при высоких дозах'],
    contraindications: ['Желчнокаменная болезнь', 'Приём антикоагулянтов', 'Беременность (в терапевтических дозах)', 'Гемохроматоз'],
  },
  phosphatidylcholine: {
    description: 'Фосфатидилхолин — главный фосфолипид клеточных мембран и жёлчи. Гепатопротектор, нейропротектор, источник холина для ацетилхолина.',
    mechanism: 'Предшественник ацетилхолина → нейромедиаторная передача. Компонент жёлчи → эмульгация жиров. Ремонт клеточных мембран → гепатопротекция. Снижение ЛПНП через ↑ VLDL-метаболизм.',
    mechanismKeys: ['MEMBRANE_REPAIR', 'BILE_UP', 'ACH_UP', 'VLDL_UP'],
    systems: [
      { key: 'hepatic', label: 'Печёночная', mechanisms: ['Ремонт мембран гепатоцитов', 'Усиление жёлчеоттока', 'Снижение стеатоза'] },
      { key: 'neuro', label: 'Нервная', mechanisms: ['Предшественник ацетилхолина', 'Нейропротекция'] },
      { key: 'cardio', label: 'Сердечно-сосудистая', mechanisms: ['Снижение ЛПНП'] },
    ],
    risks: ['Диарея при высоких дозах', 'Потливость', 'Запах рыбы изо рта'],
    contraindications: ['Жёлчнокаменная болезнь (с осторожностью)', 'Депрессия (избыток холина)'],
  },
  l_carnitine: {
    description: 'L-карнитин — транспортёр жирных кислот в митохондрии. Кардиопротектор, нейропротектор, поддержка печени. Улучшает энергетику миокарда и скелетных мышц.',
    mechanism: 'Транспорт длинноцепочечных ЖК в митохондрии → β-окисление → АТФ. Ацетил-КоА буфер → энергетический обмен. ↑ вентиляция митохондрий → антиоксидантная защита.',
    mechanismKeys: ['FA_OXIDATION_UP', 'ATP_UP', 'ACETYL_COA_UP', 'MITO_UP'],
    systems: [
      { key: 'cardio', label: '', mechanisms: ['', ''] },
      { key: 'hepatic', label: '', mechanisms: ['', ''] },
      { key: 'neuro', label: '', mechanisms: ['', ''] },
    ],
    risks: ['TMAO при высоких дозах (кишечная флора)', '', ''],
    contraindications: ['', '', ''],
  },
glucosamine: {
    description: 'Глюкозамин — аминосахар, предшественник гликозаминогликанов (GAG). Хондропротектор, снижает MMP-активность, восстанавливает синовиальную жидкость.',
    mechanism: 'Предшественник GAG → rebuilding хряща. ↑ синтез протеогликанов и гиалуроновой кислоты. ↓ MMP (матриксные металлопротеиназы) → снижение деградации хряща.',
    mechanismKeys: ['GAG_UP', 'PROTEOGLYCAN_UP', 'HYALURONAN_UP', 'MMP_DOWN'],
    systems: [
      { key: 'musculoskeletal', label: 'Костно-мышечная', mechanisms: ['Восстановление хряща', '↑ протеогликаны', '↑ гиалуронан'] },
    ],
    risks: ['Диарея при высоких дозах', 'Взаимодействие с варфарином (редко)', 'Аллергия у людей с аллергией на моллюсков'],
    contraindications: ['Приём варфарина', 'Аллергия на моллюсков (для глюкозамина из хитина)'],
  },
chondroitin: {
    description: 'Хондроитинсульфат — гликозаминогликан, компонент хрящевой ткани. Восстанавливает гидратацию хряща, ингибирует эластазу, стимулирует синтез коллагена II.',
    mechanism: 'Гидратация хряща через osmotic pressure. Ингибирование эластазы и других протеаз → ↓ деградация хряща. ↑ синтез коллагена II и протеогликанов.',
    mechanismKeys: ['CARTILAGE_HYDRATION', 'ELASTASE_DOWN', 'COLLAGEN2_UP', 'PROTEOGLYCAN_UP'],
    systems: [
      { key: 'musculoskeletal', label: 'Костно-мышечная', mechanisms: ['Гидратация хряща', 'Ингибирование эластазы', '↑ коллаген II'] },
    ],
    risks: ['Диарея', 'Аллергические реакции (редко)', 'Взаимодействие с антикоагулянтами'],
    contraindications: ['Приём антикоагулянтов', 'Астма (с осторожностью)'],
  },
  msm: {
    description: 'MSM (метилсульфонилметан) — органическая сера. Донор серы для дисульфидных связей коллагена, противовоспалительное через NF-κB, снижает простагландин E2.',
    mechanism: 'Донор серы → дисульфидные связи коллагена и кератина. Ингибирование NF-κB → ↓ воспаление. ↓ PGE2 и COX-2 → обезболивание. Улучшение проницаемости клеточных мембран.',
    mechanismKeys: ['SULFUR_DONOR', 'DISULFIDE_UP', 'NFkB_DOWN', 'PGE2_DOWN'],
    systems: [
      { key: 'musculoskeletal', label: 'Костно-мышечная', mechanisms: ['Ремонт коллагена', 'Противовоспалительное', 'Обезболивание'] },
      { key: 'hematologic', label: 'Гематологическая', mechanisms: ['Антиоксидант'] },
    ],
    risks: ['Диарея при высоких дозах', 'Головная боль', 'Тошнота'],
    contraindications: ['Приём антикоагулянтов', 'Беременность (без контроля)'],
  },
  collagen: {
    description: 'Коллаген (гидролизат) — пептиды коллагена I и III типов. Стимулирует фибробласты, снижает MMP-13, восстанавливает связки, сухожилия и кожу.',
    mechanism: 'Гидролизат коллагена → пептиды → абсорбция → стимуляция фибробластов. ↑ синтез коллагена I и III. ↓ MMP-13 (коллагеназа) → защита хряща. ↑ протеогликаны.',
    mechanismKeys: ['COLLAGEN_PEPTIDES_UP', 'FIBROBLAST_UP', 'MMP13_DOWN', 'PROTEOGLYCAN_UP'],
    systems: [
      { key: 'musculoskeletal', label: 'Костно-мышечная', mechanisms: ['↑ синтез коллагена I/III', '↑ фибробласты', '↓ MMP-13', '↑ протеогликаны'] },
    ],
    risks: ['Изжога при высоких дозах', 'Аллергия (рыбный/говяжий источник)', 'Запоры'],
    contraindications: ['Аллергия на источник коллагена'],
  },
  hyaluronic: {
    description: 'Гиалуроновая кислота — главный компонент синовиальной жидкости и кожи. Удерживает 1000× вес воды. Восстанавливает суставы, увлажняет кожу.',
    mechanism: 'Связывание 1000× вес воды → гидратация суставов и кожи. ↑ синовиальная жидкость → амортизация. Ингибирование MMP → защита хряща. ↑ синтез эндогенной гиалуроновой кислоты.',
    mechanismKeys: ['WATER_BINDING', 'SYNOVIAL_UP', 'MMP_DOWN', 'HYALURONAN_UP'],
    systems: [
      { key: 'musculoskeletal', label: 'Костно-мышечная', mechanisms: ['Гидратация суставов', '↑ синовиальная жидкость', 'Ингибирование MMP'] },
    ],
    risks: ['Болезненность в месте инъекции', 'Отёчность сустава'],
    contraindications: ['Инфекция в суставе (для инъекций)'],
  },
  boswellia: {
    description: 'Босвеллия (Boswellia serrata) — ингибитор 5-липоксигеназы и NF-κB. Мощное противовоспалительное для суставов, нейропротектор, снижает лейкотриены.',
    mechanism: 'Ингибирование 5-LOX → ↓ лейкотриены (LTB4, LTC4). Ингибирование NF-κB → ↓ TNF-α, ↓ IL-1β. ↓ MMP → защита хряща. Противовоспалительное без COX-ингибирования (без ЖК-побочек).',
    mechanismKeys: ['5LOX_DOWN', 'LEUKOTRIENE_DOWN', 'NFkB_DOWN', 'MMP_DOWN'],
    systems: [
      { key: 'musculoskeletal', label: 'Костно-мышечная', mechanisms: ['Ингибирование 5-LOX', 'Снижение лейкотриенов', 'Защита хряща'] },
      { key: 'neuro', label: 'Нервная', mechanisms: ['Нейропротекция'] },
      { key: 'hematologic', label: 'Гематологическая', mechanisms: ['Противовоспалительное'] },
    ],
    risks: ['Диарея при высоких дозах', 'Изжога', 'Кожная сыпь (редко)'],
    contraindications: ['Беременность', 'Приём антикоагулянтов'],
  },
vitamin_c: {
    description: 'Витамин C (аскорбиновая кислота) — водорастворимый антиоксидант №1. Кофактор синтеза коллагена, регенерирует витамин E, поддерживает иммунитет, синтез карнитина.',
    mechanism: 'Кофактор пролил-4-гидроксилазы и лизил-гидроксилазы → синтез коллагена. Прямое scavenging ROS. Регенерация витамина E из α-токоферил-радикала. Кофактор синтеза карнитина. ↑ иммунитет через NK-клетки и фагоцитоз.',
    mechanismKeys: ['COLLAGEN_SYNTHESIS_UP', 'ANTIOXIDANT', 'VITE_REGEN', 'CARNITINE_UP', 'IMMUNE_UP'],
    systems: [
      { key: 'musculoskeletal', label: 'Костно-мышечная', mechanisms: ['Синтез коллагена', 'Антиоксидант', 'Регенерация'] },
      { key: 'hematologic', label: 'Гематологическая', mechanisms: ['Иммунитет', 'Поглощение железа'] },
      { key: 'cardio', label: 'Сердечно-сосудистая', mechanisms: ['Антиоксидант сосудов'] },
      { key: 'neuro', label: 'Нервная', mechanisms: ['Нейропротекция'] },
    ],
    risks: ['Диарея при дозах >2 г', 'Оксалатные камни при предрасположенности', 'Взаимодействие с химиотерапией'],
    contraindications: ['Гемохроматоз', 'Оксалатные камни в анамнезе'],
  },
  bromelain: {
    description: 'Бромелайн — протеолитический фермент из ананаса. Фибринолитик, снижает отёк, модулирует цитокины (IL-1β, TNF-α), ингибирует NF-κB. Противовоспалительное и противоотёчное.',
    mechanism: 'Протеолиз фибрина → фибринолитическое действие. ↓ PGE2 и брадикинин → обезболивание. Ингибирование NF-κB → ↓ TNF-α и IL-1β. Модуляция цитокинов. ↓ отёк через деградацию кининов.',
    mechanismKeys: ['FIBRINOLYSIS_UP', 'PGE2_DOWN', 'NFkB_DOWN', 'CYTOKINE_MOD', 'EDEMA_DOWN'],
    systems: [
      { key: 'musculoskeletal', label: '', mechanisms: ['', '', ''] },
      { key: 'hematologic', label: '', mechanisms: [''] },
      { key: 'cardio', label: '', mechanisms: ['', ''] },
    ],
    risks: ['', '', '', ''],
    contraindications: ['', '', '', ''],
  },
  bpc157: {
    description: 'BPC-157 (Body Protection Compound) — пептид 15 а.к. из желудочного сока. Мощнейший регенератор: связки, сухожилия, хрящи, ЖКТ, нервная ткань. Ускоряет заживление в 2-3 раза.',
    mechanism: 'Активация VEGF → ангиогенез → неоваскуляризация. Активация FGF-2 → пролиферация фибробластов. ↑ коллаген I/III. Модуляция PI3K/AKT → клеточная миграция. Стабилизация NO-пути. Гепатопротекция.',
    mechanismKeys: ['VEGF_UP', 'ANGIOGENESIS_UP', 'FGF_UP', 'COLLAGEN_UP', 'PI3K_AKT_UP', 'GASTRO_PROTECT'],
    systems: [
      { key: 'musculoskeletal', label: 'Костно-мышечная', mechanisms: ['Ангиогенез', 'Фибробласты', 'Коллаген I/III', 'Регенерация сухожилий'] },
      { key: 'neuro', label: 'Нервная', mechanisms: ['Нейропротекция', 'ГАМК-стабилизация'] },
      { key: 'hepatic', label: 'Печёночная', mechanisms: ['Гепатопротекция', 'Антиоксидант'] },
    ],
    risks: ['Стимуляция ангиогенеза при скрытых опухолях (теоретически)', 'Лёгкая тошнота'],
    contraindications: ['Активные злокачественные новообразования', 'Беременность'],
  },
  tb500: {
    description: 'TB-500 (тимозин β4) — пептид 43 а.к. Регулирует актин → мобильность клеток → заживление. Восстанавливает связки, сухожилия, кожу, сердечную мышцу. Синергия с BPC-157.',
    mechanism: 'Связывание с G-актином → полимеризация актиновых филаментов → мобильность клеток. ↑ VEGF → ангиогенез. ↓ TGF-β1 → снижение фиброза. Ингибирование NF-κB → противовоспалительное действие.',
    mechanismKeys: ['ACTIN_POLYMERIZE', 'CELL_MIGRATION_UP', 'VEGF_UP', 'TGF_B1_DOWN', 'NFkB_DOWN'],
    systems: [
      { key: 'musculoskeletal', label: 'Костно-мышечная', mechanisms: ['Полимеризация актина', 'Миграция клеток', 'Ангиогенез', 'Противовоспалительное'] },
      { key: 'cardio', label: 'Сердечно-сосудистая', mechanisms: ['Кардиопротекция'] },
    ],
    risks: ['Потенциальная стимуляция ангиогенеза при опухолях', 'Лёгкая тошнота', 'Головная боль'],
    contraindications: ['Активные злокачественные новообразования', 'Беременность'],
  },
  meloxicam: {
    description: 'Мелоксикам — селективный ингибитор COX-2. Противовоспалительное и обезболивающее с меньшим ЖК-риском чем неселективные НПВС.',
    mechanism: 'Селективное ингибирование COX-2 → ↓ PGE2 (воспаление), сохранение COX-1 (защита слизистой ЖК). Обезболивание через ↓ сенсибилизации ноцицепторов.',
    mechanismKeys: ['COX2_SELECTIVE', 'PGE2_DOWN', 'ANALGESIC', 'ANTIINFLAMMATORY'],
    systems: [
      { key: 'musculoskeletal', label: 'Костно-мышечная', mechanisms: ['Обезболивание', 'Противовоспалительное', 'Снижение отёка'] },
    ],
    risks: ['ЖК-кровотечение (реже чем неселективные)', 'Сердечно-сосудистый риск при длительном приёме', 'Нефротоксичность', 'Головокружение'],
    contraindications: ['Язвенная болезнь (обострение)', 'Тяжёлая почечная недостаточность', 'Беременность (III триместр)', 'Приём антикоагулянтов'],
  },
  diclofenac: {
    description: 'Диклофенак — неселективный НПВС. Ингибирует COX-1/COX-2, снижает PGE2. Обезболивающее и противовоспалительное. Кратковременное использование на курсе.',
    mechanism: 'Ингибирование циклооксигеназы (COX-1 и COX-2) → ↓ синтез простагландинов (PGE2, PGI2). Обезболивание через ↓ сенсибилизации ноцицепторов. Противовоспалительное через ↓ хемотаксиса.',
    mechanismKeys: ['COX1_2_INHIBIT', 'PGE2_DOWN', 'ANALGESIC', 'ANTIINFLAMMATORY', 'PLATELET_DOWN'],
    systems: [
      { key: 'musculoskeletal', label: 'Костно-мышечная', mechanisms: ['Обезболивание', 'Противовоспалительное', 'Снижение отёка'] },
    ],
    risks: ['Гастропатия (язвы, кровотечения)', 'Нефротоксичность при длительном приёме', 'Кардиваскулярный риск', 'Гепатотоксичность (редко)', 'Бронхоспазм при аспириновой астме'],
    contraindications: ['Язвенная болезнь', 'Печёночная недостаточность', 'ClCr<30', 'Аспириновая астма', 'Беременность (III триместр)', 'Кровотечения в анамнезе'],
  },
};

class InfoErrorBoundary extends React.Component<{children?:React.ReactNode;label:string},{hasError:boolean;err:string}> {
  constructor(p:{children?:React.ReactNode;label:string}){super(p);this.state={hasError:false,err:''};}
  static getDerivedStateFromError(e:Error){return{hasError:true,err:String(e)};}
  render(){if(this.state.hasError)return <div style={{padding:16,textAlign:'center',color:'#ef4444',fontSize:10,background:'rgba(239,68,68,0.06)',borderRadius:8,border:'1px solid rgba(239,68,68,0.2)'}}>⚠ {this.props.label}: {this.state.err}</div>;return this.props.children;}
}

export const SupportScreen: React.FC<{ initialTab?: SupportTab }> = ({ initialTab }) => {
  const linked = useDataLink();
  const [tab, setTab] = useState<SupportTab>(initialTab || 'main');
  const [supportView, setSupportView] = useState<SupportView>('main');
  const [calcView, setCalcView] = useState<CalcView>('main');
  const [infoView, setInfoView] = useState<InfoView>('main');
  const [section, setSection] = useState<'home'|'generator'|'protocols'|'info'>('home');
  const [genTab, setGenTab] = useState<'calculator'|'stackgen'|'mystacks'|'plan'|'reports'|'info'>('calculator');
  const [protocolTab, setProtocolTab] = useState<'pct'|'fertility'|'hrt'|'neuro'|'joints'|'acne'|'peptides'>('pct');
  const [infoTab, setInfoTab] = useState<'peptides'|'catalog'|'synergies'|'readystacks'|'interactions'|'research'|'mixcalc'|'neuro'|'joints'|'acne'>('catalog');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSub, setSelectedSub] = useState<string | null>(null);
  const [systemFilter, setSystemFilter] = useState<string>('all');
  const [supportClassFilter, setSupportClassFilter] = useState<string>('all');
  const [supportTierFilter, setSupportTierFilter] = useState<string>('all');
  const [supportLevel, setSupportLevel] = useState<'basic' | 'mid' | 'max' | 'boost'>('mid');
  const [manualLevelSelected, setManualLevelSelected] = useState(false);
  const [boostEnabled, setBoostEnabled] = useState(false);
  const [jointMode, setJointMode] = useState(false);
  const [supportPhase, setSupportPhase] = useState<SupportPhase>('course');
  const [selectedAnalogs, setSelectedAnalogs] = useState<Record<string, string>>({});
  const [enhancedSubs, setEnhancedSubs] = useState<string[]>([]);
  const [supportGoal, setSupportGoal] = useState('muscle_gain');
  const [supportDrugs, setSupportDrugs] = useState<string[]>([]);
  const [autoLevel, setAutoLevel] = useState<'basic' | 'mid' | 'max' | 'boost'>('mid');
  const [expandedMed, setExpandedMed] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  // Protocol substance name -> ID lookup for +Стек buttons
  const PROTOCOL_IDS: Record<string, string> = {
    'nac':'AA_NAC','n-ацетилцистеин':'AA_NAC','n-acetyl-cysteine':'AA_NAC',
    'омега-3':'FA_OMEGA3_BALANCED','omega-3':'FA_OMEGA3_BALANCED','epa/dha':'FA_OMEGA3_BALANCED',
    'magnesium l-threonate':'MIN_MG_THREONATE','магний l-треонат':'MIN_MG_THREONATE','магний':'MIN_MG_CITRATE',
    'таурин':'AA_TAURINE','taurine':'AA_TAURINE',
    'глицин':'AA_GLYCINE','glycine':'AA_GLYCINE',
    'alpha-lipoic acid':'AO_ALA','альфа-липоевая кислота':'AO_ALA','ala':'AO_ALA',
    'coq10':'AO_COQ10_UBIQUINOL','коэнзим q10':'AO_COQ10_UBIQUINOL','убихинол':'AO_COQ10_UBIQUINOL',
    'pregnenolone':'HORMONE_PREGNENOLONE','прегненолон':'HORMONE_PREGNENOLONE',
    'агмантин':'AA_AGMATINE','agmatine':'AA_AGMATINE',
    'альфа-gpc':'AA_ALPHA_GPC','alpha-gpc':'AA_ALPHA_GPC',
    'lion\'s mane':'MUSHROOM_LIONS_MANE','ежовик':'MUSHROOM_LIONS_MANE',
    'dhea':'HORMONE_DHEA',
    'phosphatidylserine':'PHOSPHATIDYLSERINE','фосфатидилсерин':'PHOSPHATIDYLSERINE',
    'ginkgo biloba':'HERB_GINKGO','гинкго':'HERB_GINKGO',
    'бромантан':'PHARMA_BROMANTAN','bromantan':'PHARMA_BROMANTAN',
    'фасорацетам':'PHARMA_FASORACETAM','fasoracetam':'PHARMA_FASORACETAM',
    'гуперзин а':'HERB_HUPERZINE','huperzine':'HERB_HUPERZINE',
    'bacopa monnieri':'HERB_BACOPA','бакопа':'HERB_BACOPA',
    'l-theanine':'AA_THEANINE','теанин':'AA_THEANINE','l-теанин':'AA_THEANINE',
    'citicoline':'AA_CITICOLINE','цитиколин':'AA_CITICOLINE',
    'noopept':'PHARMA_NOOPEPT','ноопепт':'PHARMA_NOOPEPT',
    'семакс':'PEPTIDE_SEMAX','semax':'PEPTIDE_SEMAX',
    'кортексин':'PEPTIDE_CORTEXIN','cortexin':'PEPTIDE_CORTEXIN',
    'церебролизин':'PEPTIDE_CEREBROLYSIN','cerebrolysin':'PEPTIDE_CEREBROLYSIN',
    'коллаген ii типа':'PEPTIDE_COLLAGEN_2','collagen type ii':'PEPTIDE_COLLAGEN_2','коллаген':'PEPTIDE_COLLAGEN_2',
    'витамин c':'VITAMIN_C','vitamin c':'VITAMIN_C',
    'витамин d3':'VITAMIN_D3','vitamin d3':'VITAMIN_D3',
    'k2':'VITAMIN_K2','витамин k2':'VITAMIN_K2',
    'глюкозамин':'GLUCOSAMINE','glucosamine':'GLUCOSAMINE',
    'хондроитин':'CHONDROITIN','chondroitin':'CHONDROITIN',
    'msm':'MSM','метилсульфонилметан':'MSM',
    'гиалуроновая кислота':'HYALURONIC_ACID','hyaluronic acid':'HYALURONIC_ACID',
    'куркумин':'CURCUMIN','curcumin':'CURCUMIN',
    'босвеллия':'BOSWELLIA','boswellia':'BOSWELLIA','akba':'BOSWELLIA',
    'bpc-157':'PEPTIDE_BPC157',
    'tb-500':'PEPTIDE_TB500','тимозин':'PEPTIDE_TB500','thymosin':'PEPTIDE_TB500',
    'секретагоги гр':'PEPTIDE_GHRP_GHRELIN','ипаморелин':'PEPTIDE_IPAMORELIN','cjc-1295':'PEPTIDE_CJC1295',
    'кофеин':'STIM_CAFFEINE','caffeine':'STIM_CAFFEINE',
    'l-цитруллин':'AA_CITRULLINE','цитруллин':'AA_CITRULLINE','l-цитруллин малат':'AA_CITRULLINE',
    'бета-аланин':'AA_BETA_ALANINE','beta-alanine':'AA_BETA_ALANINE',
    'l-аргинин':'AA_ARGININE','аргинин':'AA_ARGININE',
    'l-тирозин':'AA_TYROSINE','тирозин':'AA_TYROSINE','l-tyrosine':'AA_TYROSINE',
    'creatine':'CREATINE','креатин':'CREATINE','креатин моногидрат':'CREATINE',
    'hmb':'HMB','β-гидрокси-β-метилбутират':'HMB',
    'l-глютамин':'AA_GLUTAMINE','глютамин':'AA_GLUTAMINE',
    'zma':'ZMA','цинк+магний':'ZMA',
    'сывороточный протеин':'PROTEIN_WHEY','протеин':'PROTEIN_WHEY',
    'натрий':'ELECTROLYTE_NACL','калий':'ELECTROLYTE_KCL',
    'циклический декстрин':'HBCD','hbcd':'HBCD',
    'eaa':'EAA_COMPLEX','bcaa':'BCAA_COMPLEX',
    'ниацинамид':'VITAMIN_B3','витамин b3':'VITAMIN_B3',
    'медь':'MIN_COPPER','copper':'MIN_COPPER',
    'верошпирон':'PHARMA_SPIRONOLACTONE','спиронолактон':'PHARMA_SPIRONOLACTONE',
    'клендовит гель':'','клензит-с':'','солярий':'',
  };
  const resolveProtoId = (name: string): string => {
    const key = name.toLowerCase().trim();
    if (PROTOCOL_IDS[key]) return PROTOCOL_IDS[key];
    // Try partial match by first word
    const firstWord = key.split(/[\s-(]+/)[0];
    if (firstWord && PROTOCOL_IDS[firstWord]) return PROTOCOL_IDS[firstWord];
    // Fallback to ALL_SUBSTANCES search
    const terms = [key, ...key.split(/[\s-]+/).filter((t:string)=>t.length>2)];
    const found = ALL_SUBSTANCES.find((s:any) => {
      const sn = ((s.name||'')+'').toLowerCase(); const sid = ((s.id||'')+'').toLowerCase();
      return terms.some(t => sid.includes(t) || sid.replace(/_/g,'').includes(t) || sn.includes(t));
    });
    return found?.id || '';
  };
  const goHome = () => { setSection('home'); setTab('main'); setSupportView('main'); setCalcView('main'); setInfoView('catalog'); };
  const goBack = () => {
    if (section === 'protocols') { setSection('home'); setTab('main'); setSupportView('main'); setCalcView('main'); setInfoView('catalog'); return; }
    if (calcView !== 'main') {
      if (section === 'generator') {
        setSection('home'); setTab('main'); setSupportView('main'); setCalcView('main');
      } else if (['mixcalc','💪 Тренировочные миксы','joints','acne','peptides'].includes(calcView)) {
        setCalcView('info'); setInfoView('catalog'); setInfoTab('catalog');
        if (calcView === 'peptides') setSection('home');
      } else if (calcView === 'info') {
        setSection('home'); setTab('main'); setSupportView('main'); setCalcView('main'); setInfoView('catalog');
      } else {
        setCalcView('main');
      }
      return;
    }
    if (supportView === 'calc' || supportView !== 'main') {
      if (section === 'generator') {
        setSection('home'); setTab('main'); setSupportView('main'); setCalcView('main');
      } else {
        setSupportView('main');
      }
      setTab('main'); return;
    }
    if (tab !== 'main') { setTab('main'); return; }
    if (section !== 'home') { setSection('home'); setTab('main'); setSupportView('main'); setCalcView('main'); return; }
  };
  const [interactionTypeFilter, setInteractionTypeFilter] = useState<string>('all');
  const [interactionSeverityFilter, setInteractionSeverityFilter] = useState<string>('all');
  const [infoSynergySeverity, setInfoSynergySeverity] = useState<string>('all');
  const [synergySubTab, setSynergySubTab] = useState<'all' | 'synergies' | 'conflicts' | 'cautions' | 'calculator'>('all');
  const [activeSystems, setActiveSystems] = useState<Record<string, boolean>>({
    cardio: true, hepatic: true, renal: true, neuro: true, endocrine: true, hematologic: true, reproductive: true, musculoskeletal: true,
  });
  const [synergyPage, setSynergyPage] = useState<number>(1);
  const [synergySearch, setSynergySearch] = useState('');
  const [synergyCountFilter, setSynergyCountFilter] = useState<number>(0);
  const [synergyOrganFilter, setSynergyOrganFilter] = useState<string>('');
  const [synergyMechFilter, setSynergyMechFilter] = useState<string>('');
  const SYNERGY_PAGE_SIZE = 30;
  const [interactionPage, setInteractionPage] = useState<number>(1);
  const [showModal, setShowModal] = useState<string | null>(null);
  const [modalAddMode, setModalAddMode] = useState(false);
  const [modalLevel, setModalLevel] = useState<string | null>(null);
  const [modalSearch, setModalSearch] = useState('');
  const [modalSelected, setModalSelected] = useState<string[]>([]);
  const INTERACTION_PAGE_SIZE = 40;
  const [supportResult, setSupportResult] = useState<ReturnType<typeof calculateSupport> | null>(null);
  const [calcResult, setCalcResult] = useState<any>(null);
  const [calcDone, setCalcDone] = useState(false);

  const [dbInteractions, setDbInteractions] = useState<ReturnType<typeof checkSupportInteractions> | null>(null);
  const [dbSearchQuery, setDbSearchQuery] = useState('');
  const [dbSearchResults, setDbSearchResults] = useState<SupportSubstance[]>([]);
  const [dbStats] = useState(getSupportDatabaseStats);
  const [goalRecommendations, setGoalRecommendations] = useState<ReturnType<typeof findSupportForGoal> | null>(null);

  // Peptide calculator state
  const [pepTab, setPepTab] = useState<'peptides' | 'growth'>('peptides');
  const [growthId, setGrowthId] = useState<string | null>(null);
  const [peptideId, setPeptideId] = useState('cjc1295');
  const [pepAmount, setPepAmount] = useState(2);
  const [pepAmountUnit, setPepAmountUnit] = useState<'mg' | 'mcg'>('mg');
  const [pepDilution, setPepDilution] = useState(2);
  const [pepDose, setPepDose] = useState(100);
  const [pepDoseUnit, setPepDoseUnit] = useState<'mg' | 'mcg'>('mcg');
  const [pepSyringe, setPepSyringe] = useState<string>('U100_1ml');
  const [pepRoute, setPepRoute] = useState('sc');
  const [pepSchedule, setPepSchedule] = useState(['Пн', 'Ср', 'Пт']);
  const [pepTotalDays, setPepTotalDays] = useState(30);
  const [pepResult, setPepResult] = useState<{ dilution: DilutionResult; effective: BioavailabilityResult; pk: PKResult } | null>(null);
  const [pepProtocol, setPepProtocol] = useState<ReturnType<typeof generatePeptideProtocol> | null>(null);

  // Enhanced support: risk model selection + lab analysis
  const [riskModel, setRiskModel] = useState<RiskModelType>('standard');
  const [labAnalysis, setLabAnalysis] = useState<LabCompositeResult | null>(null);
  const [mechanismReport, setMechanismReport] = useState<ReturnType<typeof generateMechanismReport> | null>(null);
  const [timedPlan, setTimedPlan] = useState<ReturnType<typeof generateTimedPlan> | null>(null);
  const [modelRiskResult, setModelRiskResult] = useState<Record<string, { raw: number; net: number }> | null>(null);
  const [riskCalcMethod, setRiskCalcMethod] = useState<RiskCalcMethod>('basic');
  const [weeklyPlan, setWeeklyPlan] = useState<WeeklyPlan | null>(null);

  // Manual stack builder state
  const [showManualBuilder, setShowManualBuilder] = useState(false);
  const [manualSubs, setManualSubs] = useState<string[]>([]);
  const [manualDoses, setManualDoses] = useState<Record<string, number>>({});
  const [manualSearch, setManualSearch] = useState('');
  const [manualFilter, setManualFilter] = useState<string>('all');
  const [manualResult, setManualResult] = useState<OptimizerStackResult | null>(null);
  const [calcExpandedSubs, setCalcExpandedSubs] = useState<Record<string, boolean>>({});

  // Support report state
  const [supportReports, setSupportReports] = useState<any[]>(() => {
    try { return JSON.parse(localStorage.getItem('he_support_reports') || '[]'); } catch { return []; }
  });
  const [supportReportCurrent, setSupportReportCurrent] = useState<any>(null);

  // Neurotoxicity calculator state
  const courseCompounds = useMemo(() => (linked.course || []).map(c => {
    const ph = PHARMA_DB[c.substanceId];
    return { substanceId: c.substanceId, name: ph?.name || c.substanceId, cls: ph?.class || 'other', doseWeekly: (c.doseValue * (typeof c.frequency === 'number' ? c.frequency : 1)), startWeek: c.startWeek, endWeek: c.endWeek };
  }), [linked.course]);
  const uniqueCompounds = useMemo(() => {
    const map = new Map<string, { substanceId: string; name: string; cls: string; doseWeekly: number; startWeek: number; endWeek: number }>();
    courseCompounds.forEach(c => {
      const ex = map.get(c.cls);
      map.set(c.cls, ex ? { ...ex, doseWeekly: ex.doseWeekly + c.doseWeekly } : c);
    });
    return Array.from(map.values());
  }, [courseCompounds]);
  const [neuroSelected, setNeuroSelected] = useState<string[]>(() => uniqueCompounds.map(c => c.cls));
  const [neuroDoses, setNeuroDoses] = useState<Record<string, number>>(() => {
    const d: Record<string, number> = {};
    uniqueCompounds.forEach(c => { d[c.cls] = c.doseWeekly; });
    return d;
  });
  const [neuroDuration, setNeuroDuration] = useState<number>(() => {
    if (uniqueCompounds.length === 0) return 8;
    const activeCourses = uniqueCompounds.filter(c => c.endWeek > 0);
    return activeCourses.length > 0 ? Math.max(...activeCourses.map(c => c.endWeek - c.startWeek), 8) : 8;
  });
  const [neuroAge, setNeuroAge] = useState<number>(() => {
    const dob = linked.profile?.settings?.dateOfBirth;
    if (dob) { const age = Math.floor((Date.now() - new Date(dob).getTime()) / 31557600000); return age > 0 ? age : 30; }
    return 30;
  });

  const CLASS_RISK: Record<string, number> = {
    trenbolone: 0.9, nandrolone: 0.8, stanozolol: 0.7, boldenone: 0.5,
    oxandrolone: 0.4, masteron: 0.3, primobolan: 0.2, testosterone: 0.3,
  };
  const neuroScore = useMemo(() => {
    if (neuroSelected.length === 0) return 0;
    let totalRisk = 0;
    neuroSelected.forEach(cls => {
      const riskFactor = CLASS_RISK[cls] ?? 0.2;
      const dose = neuroDoses[cls] || 0;
      let doseMultiplier = 1;
      if (cls === 'testosterone' && dose > 500) doseMultiplier = 1.5;
      else if (cls === 'testosterone' && dose <= 500) doseMultiplier = 0.3;
      totalRisk += riskFactor * (dose / 500) * doseMultiplier * (neuroDuration / 8);
    });
    const ageFactor = Math.max(0.5, Math.min(2, 30 / Math.max(18, neuroAge)));
    const rawScore = totalRisk * ageFactor * 100;
    return Math.min(100, Math.round(rawScore));
  }, [neuroSelected, neuroDoses, neuroDuration, neuroAge]);
  const supportStack = useMemo(() => [
    { name:'NAC (N-ацетилцистеин)', dose: neuroScore * 20, unit:'мг', timing:'Утро + вечер, после еды' },
    { name:'Альфа-липоевая кислота (ALA)', dose: neuroScore * 10, unit:'мг', timing:'Утро, натощак за 30 мин' },
    { name:'Омега-3 (EPA+DHA)', dose: neuroScore * 50, unit:'мг', timing:'Утро + вечер, с едой' },
    { name:'Коэнзим Q10', dose: neuroScore * 5, unit:'мг', timing:'Утро, с жирной пищей' },
    { name:'Магний L-треонат', dose: neuroScore * 15, unit:'мг', timing:'Вечер, за 1ч до сна' },
    { name:'Lion\'s Mane (Ежовик)', dose: neuroScore * 20, unit:'мг', timing:'Утро, натощак' },
    { name:'Прегненолон', dose: Math.round(neuroScore * 0.5 * 10) / 10, unit:'мг', timing:'Утро, сублингвально' },
    { name:'DHEA', dose: Math.round(neuroScore * 0.8 * 10) / 10, unit:'мг', timing:'Утро' },
  ], [neuroScore]);

  const SUPPORT_LEVELS: Record<string, { label: string; desc: string; subs: string[]; dosages: Record<string, { mg: number; timing: string }> }> = {
    basic: { label: '🟢 База', desc: 'Минимум — покрытие всех систем', subs: ['nac', 'tudca', 'vitamin_d3', 'vitamin_k2', 'magnesium', 'folate', 'taurine', 'selenium'], dosages: { nac: { mg: 600, timing: 'утро, натощак' }, tudca: { mg: 500, timing: 'перед едой' }, vitamin_d3: { mg: 5000, timing: 'с едой (МЕ)' }, vitamin_k2: { mg: 200, timing: 'с едой (мкг)' }, magnesium: { mg: 400, timing: 'на ночь (бисглицинат)' }, folate: { mg: 800, timing: 'с едой (мкг, 5-MTHF)' }, taurine: { mg: 1000, timing: 'натощак' }, selenium: { mg: 200, timing: 'с едой (мкг, селен метионин)' } } },
    mid: { label: '🟡 Средний', desc: 'Стандарт — глубокое покрытие + конкретные формы', subs: ['nac', 'tudca', 'magnesium', 'vitamin_d3', 'vitamin_k2', 'coq10', 'folate', 'taurine', 'selenium', 'milk_thistle', 'alpha_lipoic', 'curcumin', 'vitamin_b12', 'vitamin_c', 'hcg'], dosages: { nac: { mg: 1200, timing: 'утро/вечер, натощак' }, tudca: { mg: 1000, timing: 'перед едой, 2x/д' }, magnesium: { mg: 400, timing: 'на ночь (бисглицинат)' }, vitamin_d3: { mg: 5000, timing: 'с едой (МЕ)' }, vitamin_k2: { mg: 200, timing: 'с едой (мкг)' }, coq10: { mg: 200, timing: 'с едой (убихинол)' }, folate: { mg: 800, timing: 'с едой (мкг, 5-MTHF)' }, taurine: { mg: 1500, timing: 'натощак' }, selenium: { mg: 200, timing: 'с едой (мкг, селен метионин)' }, milk_thistle: { mg: 600, timing: 'с едой (силимарин 80%)' }, alpha_lipoic: { mg: 600, timing: 'натощак (R-форма)' }, curcumin: { mg: 1000, timing: 'с пиперином, с едой' }, vitamin_b12: { mg: 1000, timing: 'утро (мкг, метилкобаламин)' }, vitamin_c: { mg: 1000, timing: 'натощак' }, hcg: { mg: 500, timing: '2x/нед, схема 3/1 (МЕ)' } } },
    max: { label: '🟠 Максимум', desc: 'Максимальное покрытие всех рисков', subs: ['nac', 'tudca', 'magnesium', 'vitamin_d3', 'vitamin_k2', 'coq10', 'folate', 'taurine', 'selenium', 'milk_thistle', 'alpha_lipoic', 'curcumin', 'vitamin_b12', 'vitamin_c', 'ashwagandha', 'berberine', 'probiotics', 'glucosamine', 'collagen', 'vitamin_e', 'phosphatidylcholine'], dosages: { nac: { mg: 1800, timing: 'утро/вечер, натощак' }, tudca: { mg: 1500, timing: 'перед едой, 2-3x/д' }, magnesium: { mg: 600, timing: 'на ночь (L-треонат)' }, vitamin_d3: { mg: 5000, timing: 'с едой (МЕ)' }, vitamin_k2: { mg: 400, timing: 'с едой (мкг, MK-7)' }, coq10: { mg: 300, timing: 'с едой (убихинол)' }, folate: { mg: 1000, timing: 'с едой (мкг, 5-MTHF)' }, taurine: { mg: 2000, timing: 'натощак' }, selenium: { mg: 400, timing: 'с едой (мкг, селен метионин)' }, milk_thistle: { mg: 900, timing: 'с едой, 2x/д (силимарин 80%)' }, alpha_lipoic: { mg: 900, timing: 'натощак, 2x/д (R-форма)' }, curcumin: { mg: 1000, timing: 'с пиперином, с едой' }, vitamin_b12: { mg: 2000, timing: 'утро (мкг, метилкобаламин)' }, vitamin_c: { mg: 2000, timing: 'натощак, 2x/д' }, ashwagandha: { mg: 600, timing: 'вечер (KSM-66)' }, berberine: { mg: 500, timing: 'с едой, 2x/д' }, probiotics: { mg: 20, timing: 'натощак (млрд КОЕ)' }, glucosamine: { mg: 1500, timing: 'с едой' }, collagen: { mg: 15000, timing: 'с едой (мг, гидролизат + вит.C)' }, vitamin_e: { mg: 400, timing: 'с едой (МЕ, смесь токоферолов)' }, phosphatidylcholine: { mg: 1200, timing: 'с едой' } } },
    boost: { label: '🔴 Усиление', desc: 'Максимальная защита + рецептурные', subs: ['nac', 'tudca', 'magnesium', 'vitamin_d3', 'vitamin_k2', 'coq10', 'folate', 'taurine', 'selenium', 'milk_thistle', 'alpha_lipoic', 'curcumin', 'vitamin_b12', 'vitamin_c', 'ashwagandha', 'berberine', 'probiotics', 'glucosamine', 'collagen', 'vitamin_e', 'phosphatidylcholine', 'telmisartan', 'nebivolol', 'saw_palmetto', 'hcg', 'iron', 'copper', 'astragalus', 'melatonin', 'ginseng', 'egcg', 'l_carnitine', 'chondroitin', 'msm', 'hyaluronic', 'boswellia', 'bromelain', 'bpc157', 'tb500', 'omega3', 'zinc'], dosages: { nac: { mg: 2400, timing: 'натощак, 2-3x/д' }, tudca: { mg: 1500, timing: 'перед едой, 2-3x/д' }, magnesium: { mg: 800, timing: 'на ночь (L-треонат)' }, vitamin_d3: { mg: 10000, timing: 'с едой (МЕ)' }, vitamin_k2: { mg: 400, timing: 'с едой (мкг, MK-7)' }, coq10: { mg: 400, timing: 'с едой (убихинол)' }, folate: { mg: 1000, timing: 'с едой (мкг, 5-MTHF)' }, taurine: { mg: 3000, timing: 'натощак, 2x/д' }, selenium: { mg: 400, timing: 'с едой (мкг, селен метионин)' }, milk_thistle: { mg: 900, timing: 'с едой, 2x/д (силимарин 80%)' }, alpha_lipoic: { mg: 900, timing: 'натощак, 2x/д (R-форма)' }, curcumin: { mg: 1000, timing: 'с пиперином, с едой' }, vitamin_b12: { mg: 5000, timing: 'утро (мкг, метилкобаламин)' }, vitamin_c: { mg: 2000, timing: 'натощак, 2x/д' }, ashwagandha: { mg: 900, timing: 'вечер (KSM-66)' }, berberine: { mg: 500, timing: 'с едой, 2x/д' }, probiotics: { mg: 20, timing: 'натощак (млрд КОЕ)' }, glucosamine: { mg: 1500, timing: 'с едой' }, collagen: { mg: 20000, timing: 'с едой (мг, гидролизат + вит.C)' }, vitamin_e: { mg: 400, timing: 'с едой (МЕ, смесь токоферолов)' }, phosphatidylcholine: { mg: 1200, timing: 'с едой' }, telmisartan: { mg: 40, timing: 'утро (КАД и ЧСС контроль!)' }, nebivolol: { mg: 5, timing: 'утро (ЧСС контроль!)' }, saw_palmetto: { mg: 640, timing: 'с едой, 2x/д' }, hcg: { mg: 500, timing: '2x/нед, схема 3/1 (МЕ)' }, iron: { mg: 18, timing: 'натощак (контроль ферритина!)' }, copper: { mg: 2, timing: 'отдельно от цинка (мг)' }, astragalus: { mg: 1500, timing: 'с едой' }, melatonin: { mg: 5, timing: 'на ночь' }, ginseng: { mg: 400, timing: 'утро' }, egcg: { mg: 400, timing: 'натощак' }, l_carnitine: { mg: 2000, timing: 'натощак' }, chondroitin: { mg: 1200, timing: 'с едой' }, msm: { mg: 3000, timing: 'с едой' }, hyaluronic: { mg: 200, timing: 'с едой (мг)' }, boswellia: { mg: 500, timing: 'с едой, 2x/д' }, bromelain: { mg: 500, timing: 'натощак' }, bpc157: { mg: 500, timing: 'натощак (мкг)' }, tb500: { mg: 500, timing: 'натощак (мкг)' }, omega3: { mg: 4000, timing: 'с едой, 2x/д (EPA+DHA 60%)' }, zinc: { mg: 50, timing: 'на ночь (пиколинат, контроль СЖК!)' } } },
  };

  const BOOST_SUBS = ['telmisartan','nebivolol','omega3','iron','copper','zinc',
    'bpc157','tb500','chondroitin','msm','hyaluronic','boswellia','bromelain',
    'saw_palmetto','hcg','astragalus','melatonin','ginseng','egcg','l_carnitine'];

  const JOINT_SUBS = ['glucosamine','chondroitin','msm','collagen','hyaluronic','boswellia','bromelain','bpc157','tb500','vitamin_c'];

  const BOOST_DOSAGES: Record<string, { mg: number; timing: string }> = {
    telmisartan: { mg: 40, timing: 'утро (КАД и ЧСС контроль!)' },
    nebivolol: { mg: 5, timing: 'утро (ЧСС контроль!)' },
    omega3: { mg: 4000, timing: 'с едой, 2x/д (EPA+DHA 60%)' },
    iron: { mg: 27, timing: 'натощак (контроль ферритина!)' },
    copper: { mg: 2, timing: 'отдельно от цинка (мг)' },
    zinc: { mg: 50, timing: 'на ночь (пиколинат, контроль СЖК!)' },
    bpc157: { mg: 500, timing: 'натощак (мкг)' },
    tb500: { mg: 10, timing: 'натощак (мкг)' },
    chondroitin: { mg: 1200, timing: 'с едой' },
    msm: { mg: 3000, timing: 'с едой' },
    hyaluronic: { mg: 200, timing: 'с едой (мг)' },
    boswellia: { mg: 500, timing: 'с едой, 2x/д' },
    bromelain: { mg: 500, timing: 'натощак' },
    saw_palmetto: { mg: 640, timing: 'с едой, 2x/д' },
    hcg: { mg: 500, timing: '2x/нед, схема 3/1 (МЕ)' },
    astragalus: { mg: 1500, timing: 'с едой' },
    melatonin: { mg: 5, timing: 'на ночь' },
    ginseng: { mg: 400, timing: 'утро' },
    egcg: { mg: 400, timing: 'натощак' },
    l_carnitine: { mg: 2000, timing: 'натощак' },
  };

  useEffect(() => {
    const s = linked.profile?.settings;
    if (!s) return;
    const goalMap: Record<string, string> = { bulk: 'muscle_gain', cut: 'fat_loss', strength: 'strength', endurance: 'endurance', recomp: 'recomp', maintenance: 'maintenance' };
    const goal = s.goal || s.primaryGoal || 'maintenance';
    if (goalMap[goal]) setSupportGoal(goalMap[goal]);
  }, []);

  // Sync supportDrugs with linked.course
  useEffect(() => {
    if (linked.course && linked.course.length > 0) {
      setSupportDrugs(linked.course.map(c => c.substanceId));
    }
  }, [linked.course]);

  useEffect(() => {
    const HIGH_RISK = ['trenbolone_acetate', 'trenbolone_enanthate', 'methandienone', 'stanozolol', 'oxandrolone'];
    const ORAL_17AA = ['methandienone', 'stanozolol', 'oxandrolone', 'halodrol'];
    let hasHighRisk = false, hasOral = false, count = supportDrugs.length;
    for (const id of supportDrugs) {
      if (HIGH_RISK.includes(id)) hasHighRisk = true;
      if (ORAL_17AA.includes(id)) hasOral = true;
    }
    let level: 'basic' | 'mid' | 'max' | 'boost' = 'basic';
    if (hasHighRisk || (hasOral && count >= 2)) level = 'boost';
    else if (hasOral || count >= 3) level = 'max';
    else if (count >= 1) level = 'mid';
    // 1c: Risk-based level adjustment
    const riskNet = linked.risk?.overallNet ?? 0;
    if (riskNet > 50) level = 'boost';
    else if (riskNet > 30 && level !== 'boost') level = 'max';
    // 1c: Lab abnormality count
    const abnormalCount = (linked.labAnalysis?.interpretations || []).filter(
      i => i.status === 'high' || i.status === 'critical_high'
    ).length;
    if (abnormalCount > 2) level = 'boost';
    setAutoLevel(level);
    if (!manualLevelSelected) setSupportLevel(level);
  }, [supportDrugs, linked.risk, linked.labAnalysis, manualLevelSelected]);

  // Compute effective level considering phase, analogs, and enhancers
  const effectiveLevel = useMemo(() => {
    const phaseResult = getPhaseLevel(supportLevel, supportPhase, SUPPORT_LEVELS);
    const subs = [...phaseResult.subs];
    const dosages = { ...phaseResult.dosages };
    // Replace substances with selected analogs — use form/mg/timing from SUBSTANCE_ANALOGS if available
    for (const [originalId, analogId] of Object.entries(selectedAnalogs)) {
      const idx = subs.indexOf(originalId);
      if (idx >= 0 && analogId !== originalId) {
        subs[idx] = analogId;
        // Find analog entry to get its dosage info
        const analogEntry = (SUBSTANCE_ANALOGS[originalId] || []).find(a => a.id === analogId);
        const analogDosage = (analogEntry?.mg ? { mg: analogEntry.mg, timing: analogEntry.timing || 'с едой' } : null) || SUPPORT_LEVELS[supportLevel]?.dosages?.[analogId] || DEFAULT_DOSAGES[analogId] || { mg: 500, timing: 'с едой' };
        delete dosages[originalId];
        dosages[analogId] = analogDosage;
      }
    }
    // Manual mode: replace default subs entirely with enhancedSubs
    if (enhancedSubs.length > 0 && enhancedSubs.some(id => !subs.includes(id))) {
      // If enhancedSubs has items not in default subs → manual mode, replace everything
      subs.length = 0;
      for (const enhId of enhancedSubs) {
        if (!subs.includes(enhId)) {
          subs.push(enhId);
          dosages[enhId] = DEFAULT_DOSAGES[enhId] || { mg: 500, timing: 'с едой' };
        }
      }
    } else {
      // Add enhancers on top of default
      for (const enhId of enhancedSubs) {
        if (!subs.includes(enhId)) {
          subs.push(enhId);
          dosages[enhId] = DEFAULT_DOSAGES[enhId] || { mg: 500, timing: 'с едой' };
        }
      }
    }
    // Boost mode: add boost substances to the current stack
    if (boostEnabled) {
      for (const bs of BOOST_SUBS) {
        if (!subs.includes(bs)) {
          subs.push(bs);
          dosages[bs] = BOOST_DOSAGES[bs] || DEFAULT_DOSAGES[bs] || { mg: 500, timing: 'с едой' };
        }
      }
    }
    // Normal mode: exclude joints (they have separate calculator)
    // Joint mode: only include joints
    let finalSubs = subs;
    let finalDosages = dosages;
    if (jointMode) {
      finalSubs = subs.filter(s => JOINT_SUBS.includes(s));
      finalDosages = {};
      for (const s of finalSubs) {
        finalDosages[s] = dosages[s] || DEFAULT_DOSAGES[s] || { mg: 500, timing: 'с едой' };
      }
    } else {
      finalSubs = subs.filter(s => !JOINT_SUBS.includes(s));
      finalDosages = {};
      for (const s of finalSubs) {
        finalDosages[s] = dosages[s] || DEFAULT_DOSAGES[s] || { mg: 500, timing: 'с едой' };
      }
    }
    // Auto-add hCG if AAS are in the course
    const hasAAS = (linked.course || []).some((c: any) => {
      const ph = PHARMA_DB[c.substanceId];
      return ph?.class && ['testosterone','trenbolone','nandrolone','boldenone','primobolan','drostanolone','stanozolol','oxandrolone','methandienone'].includes(ph.class);
    });
    if (hasAAS && !finalSubs.includes('hcg')) {
      finalSubs = [...finalSubs, 'hcg'];
      finalDosages = { ...finalDosages, hcg: DEFAULT_DOSAGES['hcg'] || BOOST_DOSAGES['hcg'] || { mg: 500, timing: '2x/нед, схема 3/1 (МЕ)' } };
    }
    return { ...phaseResult, subs: finalSubs, dosages: finalDosages };
  }, [supportLevel, supportPhase, selectedAnalogs, enhancedSubs, boostEnabled, jointMode, linked.course]);

  const calcSupport = (overrideLevel?: 'basic' | 'mid' | 'max' | 'boost', overrideSubs?: string[]) => {
    const s = linked.profile?.settings;
    const level = overrideLevel || supportLevel;
    const input: SupportInput = {
      userId: linked.profile?.id || 'current',
      substances: effectiveLevel?.subs || SUPPORT_LEVELS[level]?.subs || [],
      goals: [supportGoal],
      labs: (linked.labs || []).map(l => ({ code: l.code, value: l.value })),
      demographics: { age: s?.age ?? 30, weight: s?.weight ?? 80, sex: (s?.sex ?? 'male') as 'male' | 'female' },
      genetics: s?.genetics,
      nutritionFactor: s?.nutritionFactor ?? 0.8,
      trainingFactor: s?.trainingFactor ?? 0.7,
      drugDoses: Object.fromEntries((linked.course || []).map(c => [c.substanceId, c.doseValue])),
    };
    const calcResultData = calculateSupport(input);
    // Apply BP/HR adjustment to cardio risk
    try {
      const bpRisk = getBpRiskLevel();
      if (bpRisk === 'high' && calcResultData?.riskAssessment?.systemBreakdown?.cardio) {
        calcResultData.riskAssessment.systemBreakdown.cardio.raw = Math.min(100, calcResultData.riskAssessment.systemBreakdown.cardio.raw * 1.3);
        calcResultData.riskAssessment.systemBreakdown.cardio.net = Math.min(100, calcResultData.riskAssessment.systemBreakdown.cardio.net * 1.3);
      } else if (bpRisk === 'medium' && calcResultData?.riskAssessment?.systemBreakdown?.cardio) {
        calcResultData.riskAssessment.systemBreakdown.cardio.raw = Math.min(100, calcResultData.riskAssessment.systemBreakdown.cardio.raw * 1.15);
        calcResultData.riskAssessment.systemBreakdown.cardio.net = Math.min(100, calcResultData.riskAssessment.systemBreakdown.cardio.net * 1.15);
      }
    } catch {}
    setSupportResult(calcResultData);
    setCalcResult(calcResultData);
    setCalcDone(true);
    const allSubs = [...supportDrugs, ...(effectiveLevel?.subs || SUPPORT_LEVELS[level]?.subs || [])].filter(Boolean);
    setDbInteractions(checkSupportInteractions(allSubs));
    setGoalRecommendations(findSupportByGoal(supportGoal, 20));

    const labData = linked.labs || [];
    const labRes = interpretLabs(labData);
    setLabAnalysis(labRes);
    const mechRep = generateMechanismReport(labRes);
    setMechanismReport(mechRep);
    setTimedPlan(generateTimedPlan(mechRep.mechanisms, supportGoal));

    const modelRisk = computeRiskByModel(riskModel, labRes,
      Object.fromEntries(['cardio','hepatic','renal','neuro','endocrine','hematologic','reproductive','musculoskeletal'].map(s => [s, calcResultData?.riskAssessment?.systemBreakdown?.[s]?.raw ?? 15])),
      Object.fromEntries(supportDrugs.map(() => [0, 5]).map((v, i) => [['cardio','hepatic','renal','neuro','endocrine','hematologic','reproductive','musculoskeletal'][i], 5])),
      calcResultData?.systemSupport ?? {}
    );
    setModelRiskResult(modelRisk);

    // Auto-generate weekly plan
    const baseWeights: Record<string, number> = {};
    const drugLoads: Record<string, number> = {};
    for (const sys of ['cardio','hepatic','renal','neuro','endocrine','hematologic','reproductive','musculoskeletal']) {
      baseWeights[sys] = calcResultData?.riskAssessment?.systemBreakdown?.[sys]?.raw ?? 15;
      drugLoads[sys] = supportDrugs.length * 2;
    }
    const labStress: Record<string, number> = {};
    if (labRes) {
      labStress.cardio = labRes.cardioRisk; labStress.hepatic = labRes.liverStress;
      labStress.renal = labRes.kidneyStress; labStress.endocrine = labRes.hormoneScore;
      labStress.hematologic = labRes.inflammation * 5;
    }
    const plan = generateWeeklyPlan(allSubs, riskCalcMethod, baseWeights, drugLoads, labStress, calcResultData?.systemSupport ?? {});
    setWeeklyPlan(plan);

    // Save support results back to profile for integration
    try {
      const supps = (effectiveLevel?.subs || SUPPORT_LEVELS[level]?.subs || []).map(id => {
        const dos = (effectiveLevel?.dosages || SUPPORT_LEVELS[level]?.dosages || {})[id] || DEFAULT_DOSAGES[id] || { mg: 500, timing: 'с едой' };
        const subInfo = ALL_SUBSTANCES.find(s => s.id === id);
        const doseUnit = dos.mg >= 5000 ? 'g' : 'mg';
        return { id, name: subInfo?.name || id, doseMg: dos.mg, doseUnit: doseUnit as 'mg' | 'g' | 'mcg' | 'IU', notes: dos.timing };
      });
      updateProfile({ settings: { ...(getProfile().settings || {}), currentSupplements: supps } });
      notifyDataChange();
      // Sync support risk data for RiskScreen
      localStorage.setItem('he_support_risk', JSON.stringify({
        riskBeforeSupport: calcResultData.riskBeforeSupport,
        riskAfterSupport: calcResultData.riskAfterSupport,
        systemSupport: calcResultData.systemSupport,
        subs: effectiveLevel?.subs || SUPPORT_LEVELS[level]?.subs || [],
        timestamp: Date.now(),
      }));
    } catch (e2) { /* ignore profile save errors */ }
  };

  // Removed auto-calc useEffect. User clicks "Рассчитать поддержку" manually.
  const [calcRequested, setCalcRequested] = useState(false);

  // Interaction checker state
  const [interactTab, setInteractTab] = useState<'support' | 'pharma'>('support');
  const [interactionIds, setInteractionIds] = useState<string[]>(['', '']);
  const [interactionSearch, setInteractionSearch] = useState('');
  const [interactionSearchIdx, setInteractionSearchIdx] = useState<number>(0);
  const [pharmaInteractIds, setPharmaInteractIds] = useState<string[]>(['', '']);
  const [pharmaInteractSearch, setPharmaInteractSearch] = useState('');
  // Auto-seed pharma interaction selectors from course
  useEffect(() => {
    const courseIds = (linked.course || []).map(c => c.substanceId).filter(Boolean);
    if (courseIds.length > 0 && pharmaInteractIds.every(id => !id)) {
      setPharmaInteractIds(courseIds.slice(0, Math.min(4, courseIds.length)));
    }
  }, [(linked.course || []).length]);
  const [stackCalcSize, setStackCalcSize] = useState<string>('5-7');
  const [stackCalcOrgans, setStackCalcOrgans] = useState<string[]>([]);
  const [stackCalcMech, setStackCalcMech] = useState<string[]>([]);
  const [generatedStack, setGeneratedStack] = useState<any>(null);
  const [generatedStacks, setGeneratedStacks] = useState<any[]>([]);
  const [pubMedQuery, setPubMedQuery] = useState('');
  const [pubMedResults, setPubMedResults] = useState<PubMedArticle[]>([]);
  const [pubMedLoading, setPubMedLoading] = useState(false);
  const [planView, setPlanView] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [planSaved, setPlanSaved] = useState(false);
  const [planSubTab, setPlanSubTab] = useState<'active' | 'archive'>('active');
  const [archivedPlans, setArchivedPlans] = useState<any[]>(() => {
    try { return JSON.parse(localStorage.getItem('supportPlanArchive') || '[]'); } catch { return []; }
  });
  const [expandedArchiveId, setExpandedArchiveId] = useState<string | null>(null);
  const [cartItems, setCartItems] = useState<any[]>(() => {
    try { return JSON.parse(localStorage.getItem('supportCart') || '[]'); } catch { return []; }
  });
  const [pubMedError, setPubMedError] = useState('');
  const [pharmaSearchQ, setPharmaSearchQ] = useState('');
  const [pharmaSearchResults, setPharmaSearchResults] = useState<{ name: string; id: string; cls: string; desc: string }[]>([]);
  const [stackBuilder, setStackBuilder] = useState<string[]>([]);
  const [savedStacks, setSavedStacks] = useState<{ id: string; name: string; date: string; subs: string[]; dosages: Record<string, { mg: number; timing: string }>; notes?: string }[]>(() => { try { return JSON.parse(localStorage.getItem('savedStacks') || '[]'); } catch { return []; } });
  const [stackName, setStackName] = useState('');
  const [stackNotes, setStackNotes] = useState('');
  const [editingStackNotes, setEditingStackNotes] = useState<string | null>(null);
  const [editNotesText, setEditNotesText] = useState('');
  const [expandedStack, setExpandedStack] = useState<string | null>(null);
  const [favRefresh, setFavRefresh] = useState(0);
  const [showSavedPicker, setShowSavedPicker] = useState(false);
  const [researchSource, setResearchSource] = useState<'pubmed' | 'pubchem' | 'scholar' | 'fda' | 'pharma'>('pubmed');
  const [pubchemResults, setPubchemResults] = useState<any[]>([]);
  const [pubchemLoading, setPubchemLoading] = useState(false);
  const [pubchemError, setPubchemError] = useState('');
  const [fdaResults, setFdaResults] = useState<any[]>([]);
  const [fdaLoading, setFdaLoading] = useState(false);
  const [fdaError, setFdaError] = useState('');
  const [mixGoal, setMixGoal] = useState<string>('pump');
  const [mixTiming, setMixTiming] = useState<string>('pre');
  const [mixInsulin, setMixInsulin] = useState<number>(0);
  const [mixInsulinTiming, setMixInsulinTiming] = useState<'pre'|'post'>('post');
  const [mixMGF, setMixMGF] = useState<number>(0);
  const [mixMGFTiming, setMixMGFTiming] = useState<'pre'|'post'>('pre');
  const [mixIGF, setMixIGF] = useState<number>(0);
  const [mixIGFTiming, setMixIGFTiming] = useState<'pre'|'post'>('pre');
  const [mixGH, setMixGH] = useState<number>(0);
  const [mixGHTiming, setMixGHTiming] = useState<'pre'|'post'>('pre');
  const [mixCompoundTimings, setMixCompoundTimings] = useState<Record<string, number>>({});

  // Joints calculator state (lifted from IIFE to component level for hook stability)
  const [jointPain, setJointPain] = useState(0);
  const [injuryHistory, setInjuryHistory] = useState(0);
  const [trainLoad, setTrainLoad] = useState(3);
  const jointScore = Math.min(100, Math.round((jointPain * 10) + (injuryHistory * 5) + (trainLoad * 3)));
  const jointColor = jointScore < 20 ? '#22c55e' : jointScore < 40 ? '#f59e0b' : jointScore < 60 ? '#f97316' : '#ef4444';
  const jointLabel = jointScore < 20 ? 'Норма' : jointScore < 40 ? 'Умеренный риск' : jointScore < 60 ? 'Высокий риск' : 'Критический';
  const CATALOG_IDS = useMemo(() => new Set(Object.keys(SUPPORT_CATALOG_DATA).map(k => k.toLowerCase())), []);

  // Neurotoxicity tab state (lifted from IIFE to component level)
  const [neuroTab, setNeuroTab] = useState<'calc' | 'mechanisms' | 'support'>('calc');

  // Catalog sub-tab
  const [catalogSubTab, setCatalogSubTab] = useState<'type' | 'organ' | 'tier' | 'complexes'>('type');
  const isComplexId = (id: string) => {
    const low = id.toLowerCase();
    return low.includes('complex') || low.includes('_blend') || low.includes('_mix') || low.endsWith('_combo');
  };

  const handlePubMedSearch = async () => {
    if (!pubMedQuery.trim()) return;
    setPubMedLoading(true);
    setPubMedError('');
    try {
      const result = await searchPubMed(pubMedQuery, 20);
      setPubMedResults(result.articles);
    } catch (e: any) {
      setPubMedError(e.message || 'Ошибка поиска');
      setPubMedResults([]);
    } finally {
      setPubMedLoading(false);
    }
  };

  const doPharmaSearch = (q: string) => {
    setPharmaSearchQ(q);
    if (!q.trim()) { setPharmaSearchResults([]); return; }
    const ql = q.toLowerCase();
    const results: { name: string; id: string; cls: string; desc: string }[] = [];
    for (const [id, sub] of Object.entries(PHARMA_DB)) {
      if ((sub.name||'').toLowerCase().includes(ql) || id.toLowerCase().includes(ql) || (sub.class||'').toLowerCase().includes(ql)) {
        const detail = getPharmaDetail(id);
        results.push({ name: sub.name, id: sub.id, cls: sub.class, desc: (detail?.description || sub.description || SUPPORT_CLASS_LABELS[sub.class] || '') });
      }
    }
    for (const sub of ALL_SUBSTANCES) {
      if ((sub.name||'').toLowerCase().includes(ql) || (sub.id||'').toLowerCase().includes(ql) || (sub.categories||[]).some(c => (c||'').toLowerCase().includes(ql))) {
        results.push({ name: sub.name || sub.id, id: sub.id, cls: sub.type || 'supplement', desc: (sub.description || '') });
      }
    }
    setPharmaSearchResults(results.slice(0, 30));
  };

  const handlePubchemSearch = async () => {
    if (!pubMedQuery.trim()) return;
    setPubchemLoading(true);
    setPubchemError('');
    try {
      const res = await fetch(`https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(pubMedQuery)}/JSON`);
      if (!res.ok) throw new Error('PubChem: соединение не найдено');
      const data = await res.json();
      const pc = data?.PC_Compounds?.[0];
      if (!pc) throw new Error('PubChem: нет данных');
      const props: Record<string, any> = {};
      (pc.props || []).forEach((p: any) => {
        if (p.urn?.label) props[p.urn.label] = p.value;
      });
      setPubchemResults([{
        name: props['IUPAC Name']?.sval || props['Title']?.sval || pubMedQuery,
        mw: props['Molecular Weight']?.fval || props['Molecular Formula']?.sval || '—',
        iupac: props['IUPAC Name']?.sval || '—',
        formula: props['Molecular Formula']?.sval || '—',
        description: props['Title']?.sval || '',
      }]);
    } catch (e: any) {
      setPubchemError(e.message || 'Ошибка поиска PubChem');
      setPubchemResults([]);
    } finally {
      setPubchemLoading(false);
    }
  };

  const handleFDASearch = async () => {
    if (!pubMedQuery.trim()) return;
    setFdaLoading(true);
    setFdaError('');
    try {
      const res = await fetch(`https://api.fda.gov/drug/label.json?search=${encodeURIComponent(pubMedQuery)}&limit=5`);
      if (!res.ok) throw new Error('OpenFDA: препарат не найден');
      const data = await res.json();
      const items = (data.results || []).map((r: any) => ({
        brandName: r.openfda?.brand_name?.[0] || '—',
        genericName: r.openfda?.generic_name?.[0] || '—',
        indications: r.indications_and_usage?.[0]?.slice(0, 300) || '—',
        manufacturer: r.openfda?.manufacturer_name?.[0] || '—',
      }));
      setFdaResults(items);
    } catch (e: any) {
      setFdaError(e.message || 'Ошибка поиска FDA');
      setFdaResults([]);
    } finally {
      setFdaLoading(false);
    }
  };

  const saveCurrentStack = () => {
    const level = SUPPORT_LEVELS[supportLevel];
    if (!level) return;
    const id = 'stack_' + Date.now();
    const newStack = { id, name: stackName || level.label + ' ' + new Date().toLocaleDateString('ru'), date: new Date().toISOString(), subs: level.subs, dosages: level.dosages || {}, notes: stackNotes || '' };
    const updated = [...savedStacks, newStack];
    setSavedStacks(updated);
    localStorage.setItem('savedStacks', JSON.stringify(updated));
    setStackName('');
    setStackNotes('');
  };

  const saveBuilderStack = () => {
    if (stackBuilder.length === 0) return;
    const id = 'build_' + Date.now();
    const label = stackBuilder.slice(0, 3).map(sid => resolveSubName(sid)).join(', ') + (stackBuilder.length > 3 ? ` +${stackBuilder.length - 3}` : '');
    const newStack = { id, name: `Стек: ${label}`, date: new Date().toISOString(), subs: stackBuilder, dosages: {} };
    const updated = [...savedStacks, newStack];
    setSavedStacks(updated);
    localStorage.setItem('savedStacks', JSON.stringify(updated));
    setStackBuilder([]);
  };

  const deleteStack = (id: string) => {
    const updated = savedStacks.filter(s => s.id !== id);
    setSavedStacks(updated);
    localStorage.setItem('savedStacks', JSON.stringify(updated));
  };

  const availableMechs = useMemo(() => {
    if (stackCalcOrgans.length === 0) {
      return [];
    }
    const mechSet = new Set<string>();
    for (const key of stackCalcOrgans) {
      const mechs = ORGAN_MECHANISMS[key];
      if (mechs) { mechs.forEach(m => mechSet.add(m)); }
    }
    return [...mechSet].sort();
  }, [stackCalcOrgans]);

  // Combine SUPPLEMENT_DESCRIPTIONS with support substances from PHARMA_DB
  const supplementList = useMemo(() => {
    const supplements = Object.entries(SUPPLEMENT_DESCRIPTIONS).map(([id, desc]) => ({
      id,
      name: id.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
      description: desc,
      targets: SUPPLEMENT_TARGETS[id] as SupplementTarget | undefined,
      research: SUPPORT_RESEARCH[id],
      isSupportSubstance: false,
    }));
    
    const supportClasses = ['support', 'peptide_regenerative', 'peptide_nootropic', 'peptide_immune'] as const;
    const supportSubstances = Object.values(PHARMA_DB).filter(s => 
      supportClasses.includes(s.class as typeof supportClasses[number])
    );
    
    const supportSupplements = supportSubstances.map(s => ({
      id: s.id,
      name: s.name,
      description: s.description || SUPPORT_CLASS_LABELS[s.class] || s.class,
      targets: undefined,

      isSupportSubstance: true,
      pharmaClass: s.class,
    }));
    
    return [...supplements, ...supportSupplements];
  }, []);

  // All support substances for interaction checker
  const allSupport = useMemo(() => supplementList, [supplementList]);
  // Catalog-filtered substances for interaction selectors (289 curated entries)
  const catalogSupport = useMemo(() => allSupport.filter(s => CATALOG_IDS.has((s.id||'').toLowerCase())), [allSupport, CATALOG_IDS]);

  // Support-only synergy pairs
  const supportSynergies = useMemo(() => {
    return SYNERGY_PAIRS.filter(p => {
      const a = PHARMA_DB[p.substanceA];
      const b = PHARMA_DB[p.substanceB];
      const supportClasses = ['support', 'peptide_regenerative', 'peptide_nootropic', 'peptide_immune'];
      // Include: both are support substances, or at least one is a supplement
      const aIsSupport = a ? supportClasses.includes(a.class) : SUPPLEMENT_DESCRIPTIONS[p.substanceA] !== undefined;
      const bIsSupport = b ? supportClasses.includes(b.class) : SUPPLEMENT_DESCRIPTIONS[p.substanceB] !== undefined;
      return (aIsSupport || bIsSupport) && CATALOG_IDS.has(p.substanceA.toLowerCase()) && CATALOG_IDS.has(p.substanceB.toLowerCase());
    });
  }, [CATALOG_IDS]);

  const filteredSupplements = useMemo(() => {
    let list = supplementList;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(s => (s.name||'').toLowerCase().includes(q) || (s.id||'').toLowerCase().includes(q) || (s.description||'').toLowerCase().includes(q));
    }
    if (systemFilter !== 'all') {
      list = list.filter(s => s.targets?.systems?.includes(systemFilter));
    }
    if (supportClassFilter !== 'all') {
      list = list.filter(s => {
        if (s.isSupportSubstance) {
          const substance = Object.values(PHARMA_DB).find(sub => sub.id === s.id);
          return substance?.class === supportClassFilter;
        } else {
          return true;
        }
      });
    }
    return list;
  }, [supplementList, searchQuery, systemFilter, supportClassFilter]);

  const systemLabels: Record<string, string> = Object.fromEntries(ALL_RISK_SYSTEMS.map(k => [k, SYSTEM_INFO_ALL[k]?.label ?? k]));

  const selectedDetail = selectedSub ? supplementList.find(s => s.id === selectedSub) : null;

  // Interaction checker
  const addInteraction = () => { if (interactionIds.length < 10) setInteractionIds([...interactionIds, '']); };
  const maxInteractionsReached = interactionIds.length >= 10;
  const removeInteraction = (idx: number) => setInteractionIds(interactionIds.filter((_, i) => i !== idx));
  const updateInteraction = (idx: number, value: string) => {
    const updated = [...interactionIds];
    updated[idx] = value;
    setInteractionIds(updated);
  };
  const validInteractionIds = interactionIds.filter(Boolean);
  
  // Group ALL_SUBSTANCES by primary category for catalog
  const catalogSubstances = useMemo(() => {
    return Object.values(SUPPORT_CATALOG_DATA).map(entry => ({
      id: entry.id,
      name: entry.nameRu || entry.name || entry.id,
      categories: entry.category || [],
      mechanisms: entry.mechanisms || [],
      organs: entry.organs || [],
      description: entry.description || '',
      type: (entry.category||[])[0] || 'supplement',
      deficiency: '',
    })) as SupportSubstance[];
  }, []);

  const groupedSubstances = useMemo(() => {
    const normCat = (cat: string): string => {
      // Organ-based categories → map to 'other' for type view (they belong in organ view)
      const organCats = ['gut','gastrointestinal','cardioprotector','hepatoprotector','neuroprotector',
        'immunomodulator','immune','joint','bone','respiratory','eye_protector','renal','skin','beauty',
        'urinary_protector','anticoagulant','thyroid','bile_acid','choleretic','lipid','anabolic',
        'hematologic','antimicrobial','recovery','marker','nsaid','electrolyte','multivitamin'];
      if (organCats.includes(cat) || organCats.some(oc => cat.includes(oc))) return 'other';
      const m: Record<string,string> = {
        amino_acid:'amino_acids',aminoacids:'amino_acids',
        vitamin:'vitamins',vitamin_:'vitamins',
        mineral:'minerals',mineral_:'minerals',
        herb:'herbs',herbal:'herbs',
        peptide:'peptides',peptid:'peptides',
        nootropic:'nootropics',nootrop:'nootropics',
        adaptogen:'adaptogens',adaptog:'adaptogens',
        hormone:'hormones',hormon:'hormones',
        enzyme:'enzymes',
        probiotic:'probiotics',prebiot:'probiotics',
        fatty_acid:'fatty_acids',lipids:'fatty_acids',
        mushroom:'mushrooms',fungus:'mushrooms',fungi:'mushrooms',
        electrolyte:'electrolytes',
      };
      const c = (cat||'').toLowerCase().replace(/[^a-z0-9_]/g,'');
      if (m[c]) return m[c];
      for (const [k,v] of Object.entries(m)) if (c.includes(k)||k.includes(c)) return v;
      return cat;
    };
    const groups: Record<string, SupportSubstance[]> = {};
    // Use 289 curated catalog entries directly
    let filtered = catalogSubstances;
    // Apply tier filter
    if (catalogSubTab === 'complexes') {
      filtered = filtered.filter(s => isComplexId(s.id));
    } else {
      filtered = filtered.filter(s => !isComplexId(s.id));
    }
    if (supportTierFilter !== 'all') {
      filtered = filtered.filter(s => getSubstanceTier(s.id) === supportTierFilter);
    }
    // Apply search query
    if (searchQuery) {
      const sq = searchQuery.toLowerCase();
      filtered = filtered.filter(s =>
        (s.name||'').toLowerCase().includes(sq) ||
        (s.id||'').toLowerCase().includes(sq) ||
        (s.description||'').toLowerCase().includes(sq) ||
        (s.categories||[]).some(c => (c||'').toLowerCase().includes(sq)) ||
        (s.mechanisms||[]).some(m => (m||'').toLowerCase().includes(sq))
      );
    }
    for (const sub of filtered) {
      const primaryCat = normCat((sub.categories||[])[0] || 'other');
      if (!groups[primaryCat]) groups[primaryCat] = [];
      groups[primaryCat].push(sub);
    }
    // Compute class-based sub-groups for badges
    const getSubstanceClass = (sub: SupportSubstance): string | null => {
      const searchStr = ((sub.name||'') + ' ' + (sub.id||'')).toLowerCase();
      for (const [key, info] of Object.entries(CLASS_BASE_NAMES)) {
        if (info.match.test(searchStr)) return key;
      }
      return null;
    };
    return Object.entries(groups)
      .map(([cat, items]) => {
        const classMap: Record<string, SupportSubstance[]> = {};
        for (const sub of items) {
          const cls = getSubstanceClass(sub);
          if (cls) {
            if (!classMap[cls]) classMap[cls] = [];
            classMap[cls].push(sub);
          }
        }
        const classBadges = Object.entries(classMap)
          .map(([clsKey, clsItems]) => ({ clsKey, label: CLASS_BASE_NAMES[clsKey]?.label || clsKey, emoji: CLASS_BASE_NAMES[clsKey]?.emoji || '📦', count: clsItems.length }))
          .sort((a, b) => b.count - a.count);
        const classItems = Object.fromEntries(
          Object.entries(classMap).filter(([, clsItems]) => clsItems.length >= 3)
        );
        return { cat, items, count: items.length, classBadges, classItems };
      })
      .sort((a, b) => b.count - a.count);
  }, [searchQuery, supportTierFilter, catalogSubstances]);

  // Organ-based grouping for catalog sub-tab
  // Phase 5.12: Comprehensive 16-category organ mapping
  const ORGAN_CATEGORY_MAP: Record<string, { key: string; label: string; emoji: string }> = {
    HEART: { key: 'heart_vessels', label: 'Сердце и сосуды', emoji: '❤️' },
    VESSELS: { key: 'heart_vessels', label: 'Сердце и сосуды', emoji: '❤️' },
    LIVER: { key: 'liver', label: 'Печень', emoji: '🫁' },
    BILE_DUCTS: { key: 'liver', label: 'Печень', emoji: '🫁' },
    GALLBLADDER: { key: 'liver', label: 'Печень', emoji: '🫁' },
    gallbladder: { key: 'liver', label: 'Печень', emoji: '🫁' },
    KIDNEYS: { key: 'kidneys', label: 'Почки', emoji: '🫘' },
    kidney: { key: 'kidneys', label: 'Почки', emoji: '🫘' },
    BLADDER: { key: 'kidneys', label: 'Почки', emoji: '🫘' },
    URINARY: { key: 'kidneys', label: 'Почки', emoji: '🫘' },
    BRAIN: { key: 'brain_nerves', label: 'Мозг и нервная система', emoji: '🧠' },
    NERVES: { key: 'brain_nerves', label: 'Мозг и нервная система', emoji: '🧠' },
    NERVOUS_SYSTEM: { key: 'brain_nerves', label: 'Мозг и нервная система', emoji: '🧠' },
    HYPOTHALAMUS: { key: 'brain_nerves', label: 'Мозг и нервная система', emoji: '🧠' },
    BONES: { key: 'joints_bones', label: 'Суставы и кости', emoji: '🦴' },
    bone: { key: 'joints_bones', label: 'Суставы и кости', emoji: '🦴' },
    JOINTS: { key: 'joints_bones', label: 'Суставы и кости', emoji: '🦴' },
    joint: { key: 'joints_bones', label: 'Суставы и кости', emoji: '🦴' },
    LIGAMENTS: { key: 'joints_bones', label: 'Суставы и кости', emoji: '🦴' },
    TENDONS: { key: 'joints_bones', label: 'Суставы и кости', emoji: '🦴' },
    SPINE: { key: 'joints_bones', label: 'Суставы и кости', emoji: '🦴' },
    BONE_MARROW: { key: 'joints_bones', label: 'Суставы и кости', emoji: '🦴' },
    TEETH: { key: 'joints_bones', label: 'Суставы и кости', emoji: '🦴' },
    IMMUNE_SYSTEM: { key: 'immune', label: 'Иммунная система', emoji: '🛡️' },
    immune: { key: 'immune', label: 'Иммунная система', emoji: '🛡️' },
    LYMPH: { key: 'immune', label: 'Иммунная система', emoji: '🛡️' },
    LYMPHATIC: { key: 'immune', label: 'Иммунная система', emoji: '🛡️' },
    GI: { key: 'gi', label: 'ЖКТ и пищеварение', emoji: '🫃' },
    STOMACH: { key: 'gi', label: 'ЖКТ и пищеварение', emoji: '🫃' },
    intestine: { key: 'gi', label: 'ЖКТ и пищеварение', emoji: '🫃' },
    MICROBIOME: { key: 'gi', label: 'ЖКТ и пищеварение', emoji: '🫃' },
    ESOPHAGUS: { key: 'gi', label: 'ЖКТ и пищеварение', emoji: '🫃' },
    MOUTH: { key: 'gi', label: 'ЖКТ и пищеварение', emoji: '🫃' },
    THYROID: { key: 'endocrine', label: 'Эндокринная система', emoji: '🦋' },
    PANCREAS: { key: 'endocrine', label: 'Эндокринная система', emoji: '🦋' },
    ADRENALS: { key: 'endocrine', label: 'Эндокринная система', emoji: '🦋' },
    adrenal: { key: 'endocrine', label: 'Эндокринная система', emoji: '🦋' },
    PITUITARY: { key: 'endocrine', label: 'Эндокринная система', emoji: '🦋' },
    PARATHYROID: { key: 'endocrine', label: 'Эндокринная система', emoji: '🦋' },
    HORMONES: { key: 'endocrine', label: 'Эндокринная система', emoji: '🦋' },
    GONADS: { key: 'endocrine', label: 'Эндокринная система', emoji: '🦋' },
    OVARIES: { key: 'endocrine', label: 'Эндокринная система', emoji: '🦋' },
    UTERUS: { key: 'endocrine', label: 'Эндокринная система', emoji: '🦋' },
    PLACENTA: { key: 'endocrine', label: 'Эндокринная система', emoji: '🦋' },
    SKIN: { key: 'skin_hair', label: 'Кожа и волосы', emoji: '✨' },
    HAIR: { key: 'skin_hair', label: 'Кожа и волосы', emoji: '✨' },
    SCALP: { key: 'skin_hair', label: 'Кожа и волосы', emoji: '✨' },
    NAILS: { key: 'skin_hair', label: 'Кожа и волосы', emoji: '✨' },
    EYES: { key: 'eyes', label: 'Глаза', emoji: '👁️' },
    eye: { key: 'eyes', label: 'Глаза', emoji: '👁️' },
    PROSTATE: { key: 'reproductive', label: 'Репродуктивная система', emoji: '🧬' },
    TESTES: { key: 'reproductive', label: 'Репродуктивная система', emoji: '🧬' },
    REPRODUCTIVE: { key: 'reproductive', label: 'Репродуктивная система', emoji: '🧬' },
    female: { key: 'reproductive', label: 'Репродуктивная система', emoji: '🧬' },
    male: { key: 'reproductive', label: 'Репродуктивная система', emoji: '🧬' },
    BLOOD: { key: 'blood', label: 'Кровь и кроветворение', emoji: '🩸' },
    PLATELETS: { key: 'blood', label: 'Кровь и кроветворение', emoji: '🩸' },
    LUNGS: { key: 'lungs', label: 'Лёгкие и дыхание', emoji: '🫁' },
    lung: { key: 'lungs', label: 'Лёгкие и дыхание', emoji: '🫁' },
    THROAT: { key: 'lungs', label: 'Лёгкие и дыхание', emoji: '🫁' },
    NOSE: { key: 'lungs', label: 'Лёгкие и дыхание', emoji: '🫁' },
    MUSCLES: { key: 'muscles', label: 'Мышцы и восстановление', emoji: '💪' },
    muscle: { key: 'muscles', label: 'Мышцы и восстановление', emoji: '💪' },
    MITOCHONDRIA: { key: 'mitochondria', label: 'Митохондрии и энергия', emoji: '⚡' },
    CELLS: { key: 'mitochondria', label: 'Митохондрии и энергия', emoji: '⚡' },
    METABOLISM: { key: 'mitochondria', label: 'Митохондрии и энергия', emoji: '⚡' },
    FAT_TISSUE: { key: 'mitochondria', label: 'Митохондрии и энергия', emoji: '⚡' },
    FAT: { key: 'mitochondria', label: 'Митохондрии и энергия', emoji: '⚡' },
    FETUS: { key: 'other', label: 'Прочее', emoji: '📦' },
    INFANT: { key: 'other', label: 'Прочее', emoji: '📦' },
    TISSUES: { key: 'other', label: 'Прочее', emoji: '📦' },
    ORGANS: { key: 'other', label: 'Прочее', emoji: '📦' },
    MUCOSA: { key: 'skin_hair', label: 'Кожа и слизистые', emoji: '🧴' },
    THYMUS: { key: 'immune', label: 'Иммунная система', emoji: '🛡️' },
    INTESTINES: { key: 'gi', label: 'ЖКТ и пищеварение', emoji: '🫃' },
    GUT: { key: 'gi', label: 'ЖКТ и пищеварение', emoji: '🫃' },
    BLOOD_VESSELS: { key: 'heart_vessels', label: 'Сердце и сосуды', emoji: '❤️' },
    VASCULAR: { key: 'heart_vessels', label: 'Сердце и сосуды', emoji: '❤️' },
    WHOLE_BODY: { key: 'other', label: 'Общее', emoji: '🔬' },
    BONE: { key: 'joints_bones', label: 'Суставы и кости', emoji: '🦴' },
    URINARY_TRACT: { key: 'kidneys', label: 'Почки и мочевыводящие', emoji: '🫘' },
    liver: { key: 'liver', label: 'Печень', emoji: '🫁' },
    brain: { key: 'brain_nerves', label: 'Мозг и нервная система', emoji: '🧠' },
    heart: { key: 'heart_vessels', label: 'Сердце и сосуды', emoji: '❤️' },
    vessels: { key: 'heart_vessels', label: 'Сердце и сосуды', emoji: '❤️' },
    skin: { key: 'skin_hair', label: 'Кожа и волосы', emoji: '✨' },
    cells: { key: 'mitochondria', label: 'Митохондрии и энергия', emoji: '⚡' },
    mitochondria: { key: 'mitochondria', label: 'Митохондрии и энергия', emoji: '⚡' },
    stomach: { key: 'gi', label: 'ЖКТ и пищеварение', emoji: '🫃' },
    pancreas: { key: 'endocrine', label: 'Эндокринная система', emoji: '🦋' },
    blood: { key: 'blood', label: 'Кровь и кроветворение', emoji: '🩸' },
    pituitary: { key: 'endocrine', label: 'Эндокринная система', emoji: '🦋' },
    testes: { key: 'reproductive', label: 'Репродуктивная система', emoji: '🧬' },
  };
  const OrganGroupedSubstances = useMemo(() => {
    const groups: Record<string, { key: string; label: string; emoji: string; items: SupportSubstance[]; count: number }> = {};
    const usedKeys = new Set<string>();
    const filtered = searchQuery
      ? catalogSubstances.filter(s =>
          (s.name||'').toLowerCase().includes(searchQuery.toLowerCase()) ||
          (s.id||'').toLowerCase().includes(searchQuery.toLowerCase())
        )
      : catalogSubstances;
    for (const sub of filtered) {
      const organs = sub.organs || [];
      usedKeys.clear();
      if (organs.length === 0) {
        const key = 'other';
        if (!groups[key]) groups[key] = { key, label:'Прочее', emoji:'📦', items:[], count:0 };
        groups[key].items.push(sub);
        groups[key].count++;
        continue;
      }
      for (const org of organs) {
        const normOrg = (org||'').trim();
        const mapping = ORGAN_CATEGORY_MAP[normOrg];
        if (mapping) {
          if (usedKeys.has(mapping.key)) continue;
          usedKeys.add(mapping.key);
          if (!groups[mapping.key]) groups[mapping.key] = { key: mapping.key, label: mapping.label, emoji: mapping.emoji, items: [], count: 0 };
          groups[mapping.key].items.push(sub);
          groups[mapping.key].count++;
        } else {
          const formattedName = normOrg.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
          const key = `org_${normOrg.toLowerCase()}`;
          if (usedKeys.has(key)) continue;
          usedKeys.add(key);
          if (!groups[key]) groups[key] = { key, label: formattedName || normOrg || 'Прочее', emoji: '🫀', items: [], count: 0 };
          groups[key].items.push(sub);
          groups[key].count++;
        }
      }
    }
    return Object.values(groups).sort((a, b) => b.count - a.count);
  }, [searchQuery]);

  // Phase 5.12: Auto-classify all substances into 4 tiers
  const classifyTier = (sub: SupportSubstance): 'core' | 'base' | 'boost' | 'max' => {
    const type = (sub.type || '').toLowerCase();
    const cats = (sub.categories || []).map(c => c.toLowerCase());
    const mechs = (sub.mechanisms || []).map(m => m.toLowerCase());
    const id = (sub.id || '').toLowerCase();
    const name = (sub.name || '').toLowerCase();
    const searchStr = type + ' ' + cats.join(' ') + ' ' + mechs.join(' ') + ' ' + id + ' ' + name;

    // MAX: peptides, injection-only, experimental
    if (cats.some(c => c === 'peptide' || c === 'peptides')) return 'max';
    if (type === 'peptide') return 'max';
    if (mechs.some(m => m.includes('peptide') || m.includes('injection'))) return 'max';
    if (['semax', 'selank', 'cerebrolysin', 'cortexin', 'epithalon', 'thymalin', 'bpc_157_inj', 'tb_500'].some(s => searchStr.includes(s))) return 'max';

    // CORE: essential vitamins/minerals that everyone needs always
    const corePatterns = ['vitamin_d3', 'vitamin_d', 'cholecalciferol', 'vitamin_k2', 'mk7', 'menaquinone',
      'vitamin_c', 'ascorbic', 'ascorbate', 'b_complex', 'methylcobalamin', 'cyanocobalamin', 'methylfolate',
      'magnesium', 'zinc', 'zinc_picolinate', 'zinc_bisglycinate', 'selenium', 'selenomethionine',
      'omega_3', 'omega3', 'epa', 'dha', 'fish_oil', 'coq10', 'coenzyme_q10', 'ubiquinone', 'ubiquinol',
      'iodine', 'potassium_citrate', 'vitamin_b1', 'thiamine', 'vitamin_b2', 'riboflavin',
      'vitamin_b6', 'pyridoxine', 'vitamin_b9', 'folate', 'folic_acid', 'vitamin_b12',
      'iron_bisglycinate', 'iron_fumarate', 'calcium_citrate', 'calcium_carbonate',
      'chromium_picolinate', 'manganese', 'copper_bisglycinate', 'molybdenum'];
    if (corePatterns.some(cp => searchStr.includes(cp))) return 'core';

    // Essential vitamins → CORE
    if (type === 'vitamin') {
      const baseVitamins = ['vitamin_e', 'tocopherol', 'vitamin_a', 'retinol', 'beta_carotene'];
      if (baseVitamins.some(bv => searchStr.includes(bv))) return 'base';
      return 'core';
    }
    // Essential minerals → CORE
    if (type === 'mineral') {
      const boostMinerals = ['boron', 'silicon', 'silica', 'vanadium', 'strontium', 'lithium'];
      if (boostMinerals.some(bm => searchStr.includes(bm))) return 'boost';
      return 'core';
    }
    // Electrolytes → BASE
    if (cats.some(c => c === 'electrolyte' || c === 'electrolytes')) return 'base';

    // BOOST: nootropics, advanced cognition, adaptogens, high-dosage liver support
    if (cats.some(c => c === 'nootropic' || c === 'nootropics')) return 'boost';
    if (mechs.some(m => m.includes('nootropic') || m.includes('cognitive'))) return 'boost';
    if (cats.some(c => c === 'adaptogen' || c === 'adaptogens')) return 'boost';
    if (mechs.some(m => m.includes('adaptogen'))) return 'boost';
    if (searchStr.includes('tudca') || searchStr.includes('udca')) return 'boost';

    // BASE: hepatoprotectors, antioxidants, probiotics, joint support, sports basics
    if (mechs.some(m => m.includes('hepatoprotective') || m.includes('liver_protect'))) return 'base';
    if (cats.some(c => c === 'hepatoprotective' || c === 'hepatoprotector' || c === 'detox')) return 'base';
    if (cats.some(c => c === 'antioxidant' || c === 'antioxidants') && type !== 'vitamin' && type !== 'mineral') return 'base';

    const basePatterns = ['nac', 'n_acetyl_cysteine', 'alpha_lipoic_acid', 'r_ala', 'r_lipoic',
      'curcumin', 'turmeric', 'probiotic', 'lactobacillus', 'bifidobacterium', 'saccharomyces',
      'collagen', 'gelatin', 'glucosamine', 'chondroitin', 'msm', 'methylsulfonylmethane',
      'vitamin_e', 'tocopherol', 'creatine', 'beta_alanine', 'l_carnitine', 'acetyl_l_carnitine',
      'hmb', 'beta_hydroxy', 'betaine', 'glutamine', 'milk_thistle', 'silymarin',
      'berberine', 'quercetin', 'resveratrol', 'pterostilbene', 'astaxanthin',
      'pycnogenol', 'grape_seed', 'green_tea', 'egcg', 'sulforaphane', 'dihydroquercetin',
      'digestive_enzymes', 'pancreatin', 'bromelain', 'papain',
      'tyrosine', 'n_acetyl_tyrosine', 'theanine', 'l_theanine',
      'taurine', 'glycine', 'citrulline', 'arginine', 'ornithine'];
    if (basePatterns.some(bp => searchStr.includes(bp))) return 'base';

    // BOOST default for remaining specialized substances
    if (mechs.some(m => m.includes('hormone') || m.includes('testosterone') || m.includes('estrogen'))) return 'boost';
    if (cats.some(c => c === 'hormone' || c === 'hormones' || c === 'peptide_hormone')) return 'max';

    // Default: assign by type
    if (type === 'amino_acid' || type === 'amino_acids') return 'base';
    if (type === 'enzyme' || type === 'enzymes') return 'base';
    if (type === 'fatty_acid' || type === 'fatty_acids') return 'base';
    return 'boost';
  };

  const SUPPORT_TIER_GROUPS = useMemo(() => {
    const tiers: Record<string, { key: string; label: string; emoji: string; color: string; substances: string[] }> = {
      core: { key: 'core', label: 'Ядро (CORE)', emoji: '🟢', color: '#22c55e', substances: [] },
      base: { key: 'base', label: 'База (BASE)', emoji: '🟡', color: '#f59e0b', substances: [] },
      boost: { key: 'boost', label: 'Усиление (BOOST)', emoji: '🟠', color: '#f97316', substances: [] },
      max: { key: 'max', label: 'Максимум (MAX)', emoji: '🔴', color: '#ef4444', substances: [] },
    };
    for (const sub of catalogSubstances) {
      const tier = classifyTier(sub);
      tiers[tier].substances.push(sub.id);
    }
    return [tiers.core, tiers.base, tiers.boost, tiers.max];
  }, []);

  // Pre-build conflict lookup map for O(1) pair checking in stacks (avoid iterating ALL_INTERACTIONS in render)
  const conflictLookup = useMemo(() => {
    const map = new Map<string, { effect: string; severity: string; type: string; mechanisms: string[] }>();
    for (const i of ALL_INTERACTIONS) {
      if (!i || !i.substanceA || !i.substanceB) continue;
      const val = { effect: i.effect||'', severity: i.severity||'', type: i.type||'', mechanisms: i.mechanisms||[] };
      map.set(`${i.substanceA}||${i.substanceB}`, val);
      map.set(`${i.substanceB}||${i.substanceA}`, val);
    }
    return map;
  }, []);

  // Pre-compute mechanisms & synergies for every stack
  const stackDetailMap = useMemo(() => {
    const map = new Map<string, { mechs: string[]; synergies: Array<{a:string;b:string;aName:string;bName:string;effect:string;mechs:string[];notes:string}> }>();
    for (const stack of ALL_STACKS) {
      const allMechs = new Set<string>();
      const synergies: any[] = [];
      for (let a = 0; a < stack.substances.length; a++) {
        const sa = stack.substances[a];
        const subA = ALL_SUBSTANCES.find(s => s.id === sa);
        if (subA?.mechanisms) subA.mechanisms.forEach(m => allMechs.add(m));
        for (let b = a + 1; b < stack.substances.length; b++) {
          const sb = stack.substances[b];
          const key = `${sa}||${sb}`;
          const intx = conflictLookup.get(key);
          if (intx && intx.type === 'synergy') {
            const aName = getStackSubLabel(sa);
            const bName = getStackSubLabel(sb);
            // Get detailed interaction from ALL_INTERACTIONS for mechanisms/notes
            const full = ALL_INTERACTIONS.find(i => 
              (i.substanceA === sa && i.substanceB === sb) || (i.substanceA === sb && i.substanceB === sa)
            );
            synergies.push({ a:sa, b:sb, aName, bName, effect:intx.effect, mechs:full?.mechanisms||[], notes:full?.notes||'' });
          }
        }
      }
      map.set(stack.id, { mechs: [...allMechs].slice(0, 30), synergies: synergies.slice(0, 10) });
    }
    return map;
  }, [conflictLookup]);

  // Merge ALL_INTERACTIONS + SYNERGY_PAIRS for synergies tab (with null filter + dedup + catalog filter)
  // Pre-compute the set of ALL substance IDs from interactions + catalog + ALL_SUBSTANCES
  const allSubstanceIds = useMemo(() => {
    const s = new Set<string>();
    CATALOG_IDS.forEach(id => s.add(id));
    ALL_SUBSTANCES.forEach((sub: any) => s.add((sub.id||'').toLowerCase()));
    ALL_INTERACTIONS.forEach((i: any) => {
      ['A','B','C','D','E','F'].forEach(f => {
        const sid = i[`substance${f}`];
        if (sid) s.add(sid.toLowerCase());
      });
    });
    return s;
  }, []);

  const catalogOk = useCallback((id: string) => {
    const lower = id.toLowerCase();
    if (allSubstanceIds.has(lower)) return true;
    if (PHARMA_DB && PHARMA_DB[lower]) return true;
    return false;
  }, [allSubstanceIds]);

  const mergedInteractions = useMemo(() => {
    const seen = new Set<string>();
    const pairKey = (a: string, b: string) => [a.toLowerCase(), b.toLowerCase()].sort().join('||');
    const fromDB = ALL_INTERACTIONS
      .filter(i => i && i.interactionId && i.substanceA && i.substanceB && i.substanceA !== i.substanceB && catalogOk(i.substanceA) && catalogOk(i.substanceB))
      .filter(i => {
        const pk = pairKey(i.substanceA, i.substanceB);
        if (seen.has(pk)) return false;
        seen.add(pk);
        return true;
      })
      .map(i => ({ ...i, source: 'db' as const }));
    seen.clear();
    for (const item of fromDB) {
      seen.add(item.interactionId);
      seen.add(`${item.substanceA}|${item.substanceB}`);
    }
    const fromEngine = SYNERGY_PAIRS
      .filter(p => catalogOk(p.substanceA) && catalogOk(p.substanceB))
      .map((p, idx) => ({
      interactionId: `synergy_pair_${idx}`,
      substanceA: p.substanceA,
      substanceB: p.substanceB,
      type: 'synergy' as const,
      effect: p.mechanism || `Синергия: ${p.synergyType}`,
      mechanisms: p.affectedSystems || [],
      severity: (p.strength > 0.7 ? 'HIGH' : p.strength > 0.4 ? 'MEDIUM' : 'LOW') as 'LOW' | 'MEDIUM' | 'HIGH',
      notes: p.clinicalNote || '',
      source: 'engine' as const,
    }));
    const dedupedEngine = fromEngine.filter(e => !seen.has(`${e.substanceA}|${e.substanceB}`) && !seen.has(e.interactionId));
    // Pharma synergy pairs (AAS + peptides + insulin)
    const PHARMA_CLASSES = new Set(['testosterone','trenbolone','nandrolone','boldenone','primobolan','oral_17aa','sarm','drostanolone','dht_derivative','igf1','mgf','insulin']);
    const pharmaFromEngine = SYNERGY_PAIRS
      .filter(p => {
        const a = PHARMA_DB[p.substanceA];
        const b = PHARMA_DB[p.substanceB];
        return a && b && PHARMA_CLASSES.has(a.class) && PHARMA_CLASSES.has(b.class) && !catalogOk(p.substanceA) && !catalogOk(p.substanceB);
      })
      .filter(p => !seen.has(`${p.substanceA}|${p.substanceB}`))
      .map((p, idx) => ({
      interactionId: `pharma_synergy_${idx}`,
      substanceA: p.substanceA,
      substanceB: p.substanceB,
      type: 'synergy' as const,
      effect: p.mechanism || `Синергия: ${p.synergyType}`,
      mechanisms: p.affectedSystems || [],
      severity: (p.strength > 0.7 ? 'HIGH' : p.strength > 0.4 ? 'MEDIUM' : 'LOW') as 'LOW' | 'MEDIUM' | 'HIGH',
      notes: p.clinicalNote || '',
      source: 'pharma' as const,
    }));
    return [...fromDB, ...dedupedEngine, ...pharmaFromEngine];
  }, [CATALOG_IDS]);

  // Interaction calculator memo (uses mergedInteractions)
  const supportInteractions = useMemo(() => {
    if (validInteractionIds.length < 2) return null;
    const subs: Record<string, string> = {};
    validInteractionIds.forEach(id => {
      const s = allSupport.find(x => x.id === id);
      if (s) subs[id] = s.name;
    });
    try {
      const norm = (s: string) => s.replace(/_/g,'').toLowerCase();
      const matchId = (interactKey: string, subId: string, subName: string): boolean => {
        const a = norm(interactKey);
        const b = norm(subId);
        const c = norm(subName);
        return a === b || a.includes(b) || b.includes(a) || a === c || a.includes(c) || c.includes(a);
      };
      return mergedInteractions.filter((i: any) => {
        if (!i || !i.substanceA || !i.substanceB) return false;
        const matched: string[] = [];
        validInteractionIds.forEach(id => {
          const s = allSupport.find(x => x.id === id);
          if (matchId(i.substanceA, id, s?.name || '')) matched.push('a');
          if (matchId(i.substanceB, id, s?.name || '')) matched.push('b');
        });
        return matched.includes('a') && matched.includes('b');
      });
    } catch { return []; }
  }, [interactionIds, allSupport, mergedInteractions]);

  const hasSupportInteractions = supportInteractions && supportInteractions.length > 0;
  const supportSynergiesList = supportInteractions?.filter(i => i.type === 'synergy') ?? [];
  const supportConflicts = supportInteractions?.filter(i => i.type === 'conflict') ?? [];
  const supportCautions = supportInteractions?.filter(i => i.type === 'caution') ?? [];

  // Grouped stacks by size
  const groupedStacks = useMemo(() => {
    const getSizeGroup = (count: number): string => {
      if (count <= 3) return '3';
      if (count <= 5) return '4-5';
      if (count <= 7) return '6-7';
      if (count <= 9) return '8-9';
      return '10+';
    };
    const groups: Record<string, SupportStack[]> = {};
    for (const s of ALL_STACKS) {
      const g = getSizeGroup(s.substances.length);
      if (!groups[g]) groups[g] = [];
      groups[g].push(s);
    }
    const order = ['3', '4-5', '6-7', '8-9', '10+'];
    const labels: Record<string, string> = {
      '3': 'Мини-стеки (3 вещества)', '4-5': 'Базовые стеки (4-5 веществ)',
      '6-7': 'Расширенные стеки (6-7 веществ)', '8-9': 'Продвинутые стеки (8-9 веществ)',
      '10+': 'Максимальные стеки (10+ веществ)',
    };
    return order.filter(g => groups[g]).map(g => ({ key: g, label: labels[g] || g, stacks: groups[g] }));
  }, []);

  // Filtered stacks by search
  const [stackSearch, setStackSearch] = useState('');
  const filteredStacks = useMemo(() => {
    if (!stackSearch) return ALL_STACKS;
    const q = stackSearch.toLowerCase();
    return ALL_STACKS.filter(s =>
      (s.effects||[]).some(e => ((EFFECT_LABELS_ru[e] || e)||'').toLowerCase().includes(q)) ||
      (s.substances||[]).some(sid => (getStackSubLabel(sid)||'').toLowerCase().includes(q))
    );
  }, [stackSearch]);

  // Stack sub-tab state
  const [stackSubTab, setStackSubTab] = useState<string>('readystacks');

  // Replacement calculator state
  const [replaceSearch, setReplaceSearch] = useState('');
  const [replaceSelectedSub, setReplaceSelectedSub] = useState<string | null>(null);
  const [replaceResults, setReplaceResults] = useState<Array<{id:string;score:number;reason:string;pros:string[];cons:string[]}>>([]);

  // Search calculator state
  const [searchOrgan, setSearchOrgan] = useState('');
  const [searchMech, setSearchMech] = useState('');
  const [searchEffect, setSearchEffect] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{id:string;name:string;type:'substance'|'stack'|'complex';score:number;reason:string;pros:string[];cons:string[];substanceCount?:number}>>([]);

  // Helper: find substance by ID
  const findSubstance = (id: string): any => ALL_SUBSTANCES.find(s => s.id === id);

  // Helper: get substance name
  const getSubstanceName = (id: string): string => {
    const sub = findSubstance(id);
    return sub?.name || PHARMA_DB[id]?.name || id.replace(/_/g, ' ');
  };

  // Replacement logic: find substances with similar mechanisms/organs/categories
  const findReplacements = (id: string) => {
    const source = findSubstance(id);
    if (!source) return [];
    const results: Array<{id:string;score:number;reason:string;pros:string[];cons:string[]}> = [];
    const sourceMechs = new Set((source.mechanisms||[]).map((m:string) => m.toLowerCase()));
    const sourceOrgs = new Set((source.organs||[]).map((o:string) => o.toLowerCase()));
    const sourceCats = new Set((source.categories||[]).map((c:string) => c.toLowerCase()));
    for (const sub of ALL_SUBSTANCES) {
      if (sub.id === id || !sub.mechanisms || sub.mechanisms.length === 0) continue;
      const targetMechs = new Set(sub.mechanisms.map((m:string) => m.toLowerCase()));
      const targetOrgs = new Set((sub.organs||[]).map((o:string) => o.toLowerCase()));
      const targetCats = new Set((sub.categories||[]).map((c:string) => c.toLowerCase()));
      // Calculate overlap scores
      let mechOverlap = 0, orgOverlap = 0, catOverlap = 0;
      for (const m of targetMechs) if (sourceMechs.has(m)) mechOverlap++;
      for (const o of targetOrgs) if (sourceOrgs.has(o)) orgOverlap++;
      for (const c of targetCats) if (sourceCats.has(c)) catOverlap++;
      const totalScore = (sourceMechs.size > 0 ? (mechOverlap / Math.max(1, sourceMechs.size)) * 50 : 0) +
        (sourceOrgs.size > 0 ? (orgOverlap / Math.max(1, sourceOrgs.size)) * 30 : 0) +
        (sourceCats.size > 0 ? (catOverlap / Math.max(1, sourceCats.size)) * 20 : 0);
      if (totalScore > 20) {
        const reasonParts: string[] = [];
        const pros: string[] = [];
        const cons: string[] = [];
        if (mechOverlap > 0) reasonParts.push(`совпадает ${mechOverlap} механизм(ов)`);
        if (orgOverlap > 0) reasonParts.push(`действует на те же органы (${orgOverlap})`);
        if (catOverlap > 0) pros.push(`из категории ${sub.categories?.[0] || '—'}`);
        if ((sub.mechanisms||[]).length > (source.mechanisms||[]).length) pros.push('больше механизмов');
        if ((sub.mechanisms||[]).length < (source.mechanisms||[]).length) cons.push('меньше механизмов');
        if (!sub.organs || sub.organs.length === 0) cons.push('нет данных по органам');
        results.push({ id: sub.id, score: Math.round(totalScore), reason: reasonParts.join('; ') || 'частичное совпадение', pros, cons });
      }
    }
    return results.sort((a,b) => b.score - a.score);
  };

  // Search logic: find substances/stacks/complexes by organ+mechanism+effect
  const doSearch = (organ: string, mech: string, effect: string) => {
    const results: Array<{id:string;name:string;type:'substance'|'stack'|'complex';score:number;reason:string;pros:string[];cons:string[];substanceCount?:number}> = [];
    const eq = effect.toLowerCase().trim();
    // Search ALL_SUBSTANCES
    for (const sub of ALL_SUBSTANCES) {
      let score = 0;
      const reasons: string[] = [];
      // Check organ match
      if (organ) {
        const subOrgs = (sub.organs||[]).map((o:string) => { const m = ORGAN_CATEGORY_MAP[o.toUpperCase().trim()]; return m?.key || o.toLowerCase(); });
        if (subOrgs.includes(organ)) { score += 40; reasons.push('совпадает орган'); }
      }
      // Check mechanism match
      if (mech) {
        if ((sub.mechanisms||[]).includes(mech)) { score += 40; reasons.push('совпадает механизм'); }
      }
      // Check effect/description match
      if (eq) {
        const searchText = ((sub.name||'') + ' ' + (sub.description||'') + ' ' + (sub.categories||[]).join(' ')).toLowerCase();
        if (searchText.includes(eq)) { score += 20; reasons.push('совпадает описание/категория'); }
      }
      if (score > 0) {
        const pros: string[] = [];
        const cons: string[] = [];
        if (sub.mechanisms && sub.mechanisms.length > 0) pros.push(`${sub.mechanisms.length} механизмов`);
        if (sub.organs && sub.organs.length > 0) pros.push(`действует на ${sub.organs.length} органов`);
        if (!sub.organs || sub.organs.length === 0) cons.push('нет данных по органам');
        results.push({ id: sub.id, name: sub.name || sub.id, type: 'substance', score: Math.min(100, score), reason: reasons.join('; ') || 'соответствует критериям', pros, cons });
      }
    }
    // Search ALL_STACKS
    for (const stack of ALL_STACKS) {
      let score = 0;
      const reasons: string[] = [];
      if (eq) {
        const searchText = ((stack.name||'') + ' ' + (stack.description||'') + ' ' + (stack.effects||[]).join(' ')).toLowerCase();
        if (searchText.includes(eq)) { score += 20; reasons.push('совпадает с запросом'); }
      }
      if (score > 0 || (!organ && !mech && eq)) {
        const subNames = (stack.substances||[]).map(sid => getSubstanceName(sid)).join(', ');
        if (!organ && !mech && !eq) continue;
        if (!score) score = 30;
        results.push({ id: stack.id, name: stack.name || stack.id, type: 'stack', score: Math.min(100, score), reason: reasons.concat([`${stack.substances.length} веществ`]).join('; ') || `стек из ${stack.substances.length} веществ`, pros: [`синергия ${stack.synergyScore}%`, ...(stack.effects||[]).slice(0,3)], cons: [], substanceCount: stack.substances.length });
      }
    }
    return results.sort((a,b) => b.score - a.score);
  };

  // Resolve substance name from ID (used in interactions) — Map for O(1)
  const substanceNameMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of ALL_SUBSTANCES) m.set(s.id, s.name);
    return m;
  }, []);
  const resolveSubName = (id: string): string => {
    const fromMap = substanceNameMap.get(id);
    if (fromMap) return fromMap;
    const pharma = PHARMA_DB[id];
    if (pharma) return pharma.name;
    return id;
  };

  // Resolve interaction effect to readable text
  const showEffect = (interaction: any): string => {
    const eff = interaction?.effect;
    if (!eff) return '';
    if (/^[A-Z0-9_]+$/.test(eff)) {
      if (interaction?.notes) return interaction.notes;
      if (EFFECT_LABELS[eff]) return EFFECT_LABELS[eff];
    }
    return eff || '';
  };

  const safeRender = (label: string, fn: () => React.ReactNode): React.ReactNode => {
    try { return fn(); }
    catch (e) { return <div style={{ padding:12, margin:4, borderRadius:6, background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.2)', textAlign:'center', color:'#f87171', fontSize:9 }}>⚠ {label}: {String(e)}</div>; }
  };

  const renderView = (current: string, target: string, contentFn: () => React.ReactNode): React.ReactNode => {
    if (current !== target) return null;
    return safeRender(target, contentFn);
  };

  const matchesCatId = (interactionId: string, catId: string): boolean => {
    const a = interactionId.toLowerCase();
    const b = catId.toLowerCase();
    if (a === b) return true;
    if (a.startsWith(b) || b.startsWith(a)) return true;
    return false;
  };

  const catDetailInteractions = (sub: SupportSubstance, interactions: any[]): React.ReactNode => {
    try {
      const subId = sub.id;
      const subsInteractions = (interactions||[]).filter(i =>
        i && i.substanceA && i.substanceB && (matchesCatId(i.substanceA, subId) || matchesCatId(i.substanceB, subId))
      ).slice(0, 5);
      return subsInteractions.length > 0 ? (
        <div style={{ marginTop:4 }}>
          <div style={{ fontSize:7, color:'var(--text-dim)', marginBottom:1 }}>Взаимодействия:</div>
          {subsInteractions.map(i => {
            if (!i) return null;
            const isA = matchesCatId(i.substanceA, subId);
            const partner = isA ? i.substanceB : i.substanceA;
            const pName = resolveSubName(partner);
            const tColor = i.type === 'synergy' ? '#22c55e' : i.type === 'conflict' ? '#ef4444' : '#f59e0b';
            return (
              <div key={i.interactionId} style={{ fontSize:7, color:'var(--text-dim)', padding:'1px 0', lineHeight:1.3 }}>
                <span style={{ color:tColor, fontWeight:600 }}>{i.type === 'synergy' ? '⊕' : i.type === 'conflict' ? '⊖' : '⚡'}</span>
                {' '}{pName||''} — {i.type === 'synergy' ? 'синергия' : i.type === 'conflict' ? 'конфликт' : 'осторожно'}
                {i.notes && <span style={{ opacity:0.6 }}>: {(i.notes||'').slice(0,40)}</span>}
              </div>
            );
          })}
        </div>
      ) : null;
    } catch (e) { return null; }
  }
// Helper to render SUPPORT_CATALOG_DATA for a substance
const renderCatalogDetail = (subId: string): React.ReactNode => {
  const canonicalId = CANONICAL_ID_MAP[subId] || CANONICAL_ID_MAP[subId.toLowerCase()] || subId.toLowerCase();
  const entry = SUPPORT_CATALOG_DATA[canonicalId] || SUPPORT_CATALOG_DATA[subId];
  if (!entry) return null;
  return (
    <div style={{ marginTop: 4 }}>
      {entry.tier && (
        <div style={{ marginBottom: 3 }}>
          <span style={{ fontSize: 8, padding: '1px 6px', borderRadius: 3, fontWeight: 700, color: TIER_LABELS_CATALOG[entry.tier]?.color || 'var(--text-dim)', background: (TIER_LABELS_CATALOG[entry.tier]?.color || 'var(--text-dim)') + '18', border: '1px solid ' + (TIER_LABELS_CATALOG[entry.tier]?.color || 'var(--text-dim)') + '40' }}>
            {TIER_LABELS_CATALOG[entry.tier]?.emoji || ''} {TIER_LABELS_CATALOG[entry.tier]?.label || entry.tier}
          </span>
          {entry.bestForCourse && <span style={{ fontSize: 7, padding: '1px 4px', borderRadius: 3, marginLeft: 4, background: 'rgba(0,230,138,0.1)', color: '#00e68a', border: '1px solid rgba(0,230,138,0.2)' }}>✓ На курсе</span>}
        </div>
      )}
      {entry.dosage && (
        <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.9)', marginBottom: 3 }}>
          💊 Дозировка: <span style={{ fontWeight: 600 }}>{entry.dosage.mg}{entry.dosage.mg >= 1000 ? ' г' : entry.dosage.mg < 1 ? ' мкг' : ' мг'}</span> · {entry.dosage.timing}{entry.dosage.form ? ' · ' + entry.dosage.form : ''}
        </div>
      )}
      {entry.monitoring && entry.monitoring.length > 0 && (
        <div style={{ marginTop: 2 }}>
          <div style={{ fontSize: 7, color: '#f59e0b', fontWeight: 600, marginBottom: 1 }}>📊 Мониторинг:</div>
          {entry.monitoring.map((m, i) => (
            <div key={i} style={{ fontSize: 8, color: 'rgba(255,255,255,0.65)', lineHeight: 1.3 }}>
              {m.what}{m.when ? ' · ' + m.when : ''}{m.targetRange ? ' · ' + m.targetRange : ''}
            </div>
          ))}
        </div>
      )}
      {entry.contraindications && entry.contraindications.length > 0 && (
        <div style={{ marginTop: 2 }}>
          <div style={{ fontSize: 7, color: '#ef4444', fontWeight: 600, marginBottom: 1 }}>🚫 Противопоказания:</div>
          <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.65)', lineHeight: 1.3 }}>{entry.contraindications.join(', ')}</div>
        </div>
      )}
      {entry.sideEffects && entry.sideEffects.length > 0 && (
        <div style={{ marginTop: 2 }}>
          <div style={{ fontSize: 7, color: '#f59e0b', fontWeight: 600, marginBottom: 1 }}>⚠ Побочные:</div>
          <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.65)', lineHeight: 1.3 }}>{entry.sideEffects.join(', ')}</div>
        </div>
      )}
      {entry.organs && entry.organs.length > 0 && (
        <div style={{ marginTop: 2 }}>
          <div style={{ fontSize: 7, color: '#60a5fa', fontWeight: 600, marginBottom: 1 }}>🎯 Органы-мишени:</div>
          <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            {entry.organs.map((o, i) => (
              <span key={i} style={{ fontSize: 7, padding: '1px 4px', borderRadius: 3, background: 'rgba(59,130,246,0.08)', color: '#60a5fa' }}>{CATALOG_ORGAN_LABELS[o] || o}</span>
            ))}
          </div>
        </div>
      )}
      {entry.systems && entry.systems.length > 0 && (
        <div style={{ marginTop: 2 }}>
          <div style={{ fontSize: 7, color: '#a78bfa', fontWeight: 600, marginBottom: 1 }}>⚡ Системы:</div>
          <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            {entry.systems.map((s, i) => (
              <span key={i} style={{ fontSize: 7, padding: '1px 4px', borderRadius: 3, background: 'rgba(167,139,250,0.08)', color: '#a78bfa' }}>{SYSTEM_LABELS_CATALOG[s] || s}</span>
            ))}
          </div>
        </div>
      )}

      {/* Enrichment data */}
      {(() => {
        const enrich = CATALOG_ENRICHMENT[canonicalId] || CATALOG_ENRICHMENT[subId];
        if (!enrich) return null;
        return (
          <div style={{ marginTop: 6, padding: '6px 8px', borderRadius: 8, background: 'rgba(0,230,138,0.04)', border: '1px solid rgba(0,230,138,0.1)' }}>
            <div style={{ fontSize: 8, fontWeight: 700, color: '#00e68a', marginBottom: 3 }}>📋 Дополнительная информация</div>
            {enrich.maxUsageWeeks && (
              <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.8)', marginBottom: 2 }}>
                📆 Макс. длительность: <span style={{ fontWeight: 600 }}>{enrich.maxUsageWeeks} нед{enrich.maxUsageWeeks >= 52 ? ` (~${Math.round(enrich.maxUsageWeeks/52)} г)` : enrich.maxUsageWeeks >= 12 ? ` (~${Math.round(enrich.maxUsageWeeks/4)} мес)` : ''}</span>
              </div>
            )}
            {enrich.labMarkers && enrich.labMarkers.length > 0 && (
              <div style={{ marginBottom: 2 }}>
                <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.7)' }}>🩸 Маркеры контроля: </span>
                <span style={{ fontSize: 8, fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>{enrich.labMarkers.join(' · ')}</span>
              </div>
            )}
            {enrich.restrictions && enrich.restrictions.length > 0 && (
              <div>
                <span style={{ fontSize: 8, color: 'rgba(239,68,68,0.8)' }}>⚠ Ограничения: </span>
                <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.8)' }}>{enrich.restrictions.join(' · ')}</span>
              </div>
            )}
          </div>
        );
      })()}

      {/* ===== BOTTOM TAB BAR ===== */}
      <div style={{ position:'fixed', bottom:0, left:0, right:0, zIndex:200, display:'flex', background:'var(--bg-primary)', borderTop:'1px solid var(--border)', padding:'6px 0 calc(env(safe-area-inset-bottom, 0px) + 6px)' }}>
        {[
          { id:'home', label:'Главная', icon:'🏠' },
          { id:'generator', label:'Генератор', icon:'🧩' },
          { id:'info', label:'Инфо', icon:'📚' },
          { id:'hormonal', label:'Гормоны', icon:'⚕️' },
        ].map(item => (
          <button key={item.id} onClick={() => {
            setSection(item.id as any);
            setCalcView('main');
            if (item.id === 'home') { setTab('main'); setSupportView('main'); }
            if (item.id === 'generator') { setTab('calculator'); setSupportView('calc'); }
            if (item.id === 'info') { setTab('main'); setSupportView('calc'); setCalcView('info'); setInfoView('catalog'); }
            if (item.id === 'hormonal') { setTab('fertility-pct'); setSupportView('calc'); }
          }} style={{
            flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:2,
            padding:'4px 0', background:'transparent', border:'none', cursor:'pointer',
            color: section === item.id ? 'var(--accent)' : 'var(--text-dim)',
            fontSize:9, fontWeight: section === item.id ? 700 : 400,
            transition:'color 0.15s',
          }}>
            <span style={{ fontSize:18 }}>{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </div>

    </div>
  );
};
;

  const synergiesContent = (filtered: any[], merged: any[], cats: Record<string, boolean>, tab?: string): React.ReactNode => {
    return safeRender('synergies_content', () => {
      const list = filtered || [];
      const currentTab = tab || 'all';
      const synergies = currentTab === 'synergies' || currentTab === 'all' ? list.filter((i:any) => i?.type === 'synergy') : [];
      const conflicts = currentTab === 'conflicts' || currentTab === 'all' ? list.filter((i:any) => i?.type === 'conflict') : [];
      const cautions = currentTab === 'cautions' || currentTab === 'all' ? list.filter((i:any) => i?.type === 'caution') : [];
      const synTotal = synergies.length;
      const confTotal = conflicts.length;
      const cautTotal = cautions.length;
      const maxItems = synergyPage * SYNERGY_PAGE_SIZE;
      const synPage = synergies.slice(0, maxItems);
      const confPage = conflicts.slice(0, maxItems);
      const safeItem = (fn:()=>React.ReactNode, key:string|number):React.ReactNode => {
          {/* Organ-based synergies */}
          <div style={{ marginBottom: 12 }}>
            <h4 style={{ margin: '0 0 6px', fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>🧬 Синергии по системам</h4>
            <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.85)', margin: '0 0 8px', lineHeight: 1.4 }}>
              Научно обоснованные комбинации добавок, организованные по системам организма
            </p>
            {ORGAN_SYNERGIES.map(og => (
              <div key={og.id} style={{ marginBottom: 8, background: 'rgba(255,255,255,0.06)', borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
                <div style={{ padding: '8px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                  onClick={() => setExpandedCategories(prev => ({ ...prev, ['organ_'+og.id]: !(prev['organ_'+og.id] ?? false) }))}>
                  <span style={{ fontSize: 13 }}>{og.organLabel.split(' ')[0]}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.9)', flex: 1 }}>{og.organLabel.substring(og.organLabel.indexOf(' ')+1)}</span>
                  <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.85)', background: 'rgba(255,255,255,0.08)', padding: '1px 6px', borderRadius: 8 }}>{og.pairs.length}</span>
                  <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.85)', transform: expandedCategories['organ_'+og.id] !== false ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▼</span>
                </div>
                {expandedCategories['organ_'+og.id] !== false && og.pairs.map((p, pi) => (
                  <div key={pi} style={{ padding: '6px 10px', borderTop: '1px solid rgba(255,255,255,0.06)', background: pi % 2 === 0 ? 'rgba(0,0,0,0.1)' : 'transparent' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 600, fontSize: 10, color: 'rgba(255,255,255,0.9)' }}>{p.nameA}</span>
                        <span style={{ fontSize: 10, color: p.type === 'synergy' ? '#22c55e' : p.type === 'conflict' ? '#ef4444' : '#f59e0b', fontWeight: 700 }}>
                          {p.type === 'synergy' ? '+' : p.type === 'conflict' ? '×' : '⚠'}
                        </span>
                        <span style={{ fontWeight: 600, fontSize: 10, color: 'rgba(255,255,255,0.9)' }}>{p.nameB}</span>
                      </div>
                      <span style={{ fontSize: 7, padding: '1px 5px', borderRadius: 3, fontWeight: 600,
                        background: p.severity === 'HIGH' ? (p.type === 'conflict' ? '#ef444422' : '#22c55e22') : p.severity === 'MEDIUM' ? '#f59e0b22' : '#60a5fa22',
                        color: p.severity === 'HIGH' ? (p.type === 'conflict' ? '#ef4444' : '#22c55e') : p.severity === 'MEDIUM' ? '#f59e0b' : '#60a5fa' }}>
                        {p.severity}
                      </span>
                    </div>
                    <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.85)', lineHeight: 1.3, marginBottom: 2 }}>
                      {p.type === 'synergy' ? '⊕' : p.type === 'conflict' ? '⊖' : '⚠'} {p.effect}
                    </div>
                    <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.65)', lineHeight: 1.3, fontStyle: 'italic' }}>{p.mechanism}</div>
                  </div>
                ))}
              </div>
            ))}
          </div>

        try{return fn();}catch(e){return <div key={key} style={{padding:4,color:'#f87171',fontSize:7}}>⚠ Item {key}: {String(e)}</div>;}
      };
      return (<>
        <div style={{ marginBottom:10 }}>
          <div onClick={() => setExpandedCategories(prev => ({ ...prev, syn_synergies: !(prev?.syn_synergies ?? true) }))} style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 8px', cursor:'pointer', userSelect:'none', background:'var(--bg-secondary)', borderRadius:8, marginBottom:4 }}>
            <span style={{ fontSize:13 }}>⊕</span>
            <div style={{ flex:1, fontSize:10, fontWeight:700, color:'#22c55e' }}>Синергии ({synTotal})</div>
            <span style={{ fontSize:9, color:'var(--text-dim)', transform:cats?.syn_synergies !== false ? 'rotate(180deg)' : 'none', transition:'transform 0.2s' }}>▼</span>
          </div>
          {cats?.syn_synergies !== false && (
            <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
              {synPage.map((interaction: any, i: number) => safeItem(() => {
                const sevInfo = INTERACTION_SEVERITY_LABELS[interaction?.severity] || { label:interaction?.severity, color:'#888' };
                const aName = resolveSubName(interaction?.substanceA);
                const bName = resolveSubName(interaction?.substanceB);
                return (
                  <div key={interaction?.interactionId||i} style={{ background:'var(--bg-secondary)', borderRadius:8, padding:'7px 8px', borderLeft:'3px solid #22c55e' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:2 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:4, flexWrap:'wrap', flex:1, minWidth:0 }}>
                        <span style={{ fontWeight:600, fontSize:10, color:'var(--text-light)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', maxWidth:'35%' }}>{aName}</span>
                        <button onClick={(e) => { e.stopPropagation(); setStackBuilder(prev => prev.includes(interaction?.substanceA) ? prev : [...prev, interaction?.substanceA]); }} style={{ padding:'3px 8px', borderRadius:4, fontSize:9, cursor:'pointer', background:'rgba(0,230,138,0.08)', border:'1px solid rgba(0,230,138,0.2)', color:'#00e68a', fontWeight:700, minWidth:22 }} title="Добавить в стек">+</button>
                        <span style={{ fontSize:10, color:'#22c55e', fontWeight:700 }}>+</span>
                        <span style={{ fontWeight:600, fontSize:10, color:'var(--text-light)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', maxWidth:'35%' }}>{bName}</span>
                        <button onClick={(e) => { e.stopPropagation(); setStackBuilder(prev => prev.includes(interaction?.substanceB) ? prev : [...prev, interaction?.substanceB]); }} style={{ padding:'3px 8px', borderRadius:4, fontSize:9, cursor:'pointer', background:'rgba(0,230,138,0.08)', border:'1px solid rgba(0,230,138,0.2)', color:'#00e68a', fontWeight:700, minWidth:22 }} title="Добавить в стек">+</button>
                      </div>
                      <span style={{ fontSize:7, padding:'1px 4px', borderRadius:3, background:sevInfo.color+'22', color:sevInfo.color, flexShrink:0 }}>{sevInfo.label}</span>
                    </div>
                    <div style={{ fontSize:9, color:'rgba(255,255,255,0.85)', lineHeight:1.3 }}>⊕ {showEffect(interaction)}</div>
                    {(() => {
                      const subAInfo = ALL_SUBSTANCES.find(s => s.id === interaction?.substanceA);
                      const subBInfo = ALL_SUBSTANCES.find(s => s.id === interaction?.substanceB);
                      const aDesc = subAInfo?.description || '';
                      const bDesc = subBInfo?.description || '';
                      const aMechs = (subAInfo?.mechanisms || []).slice(0, 3);
                      const bMechs = (subBInfo?.mechanisms || []).slice(0, 3);
                      if (!aDesc && !bDesc && aMechs.length === 0 && bMechs.length === 0) return null;
                      return (
                        <div style={{ marginTop:3, padding:'4px 6px', background:'rgba(34,197,94,0.04)', borderRadius:4, border:'1px solid rgba(34,197,94,0.08)' }}>
                          {aDesc && <div style={{fontSize:7,color:'var(--text-dim)',lineHeight:1.3,marginBottom:1}}><b style={{color:'#4ade80'}}>{aName}</b>: {aDesc}</div>}
                          {aMechs.length > 0 && <div style={{display:'flex',flexWrap:'wrap',gap:1,marginBottom:2}}>{aMechs.map((m,mi)=><span key={mi} style={{fontSize:5,padding:'0px 2px',borderRadius:2,background:'rgba(74,222,128,0.1)',color:'#4ade80'}}>{MECH_LABELS[m] || MECH_TRANSLATIONS_RU[m] || m}</span>)}</div>}
                          {bDesc && <div style={{fontSize:7,color:'var(--text-dim)',lineHeight:1.3,marginBottom:1}}><b style={{color:'#4ade80'}}>{bName}</b>: {bDesc}</div>}
                          {bMechs.length > 0 && <div style={{display:'flex',flexWrap:'wrap',gap:1}}>{bMechs.map((m,mi)=><span key={mi} style={{fontSize:5,padding:'0px 2px',borderRadius:2,background:'rgba(74,222,128,0.1)',color:'#4ade80'}}>{MECH_LABELS[m] || MECH_TRANSLATIONS_RU[m] || m}</span>)}</div>}
                        </div>
                      );
                    })()}
                    {(interaction?.mechanisms||[]).length > 0 && (
                      <div style={{ display:'flex', flexWrap:'wrap', gap:2, marginTop:2 }}>
                        {(interaction.mechanisms||[]).map((m: any, mi: number) => (
                          <span key={mi} style={{ fontSize:6, padding:'1px 4px', borderRadius:3, background:'rgba(34,197,94,0.1)', color:'#22c55e', border:'1px solid rgba(34,197,94,0.15)', fontWeight:500 }}>{MECH_LABELS[m] || MECH_TRANSLATIONS_RU[m] || (m||'')}</span>
                        ))}
                      </div>
                    )}
                    {interaction?.notes && !(/^[A-Z0-9_]+$/.test(interaction?.effect||'')) && <div style={{ fontSize:8, color:'var(--text-dim)', fontStyle:'italic', lineHeight:1.2, marginTop:2 }}>{interaction.notes}</div>}
                  </div>
                );
              }, i))}
              {synTotal === 0 && <div style={{ padding:12, textAlign:'center', color:'var(--text-dim)', fontSize:10 }}>Нет синергий</div>}
              {synPage.length < synTotal && <button onClick={() => setSynergyPage(p => p + 1)} style={{ width:'100%', padding:'8px', marginTop:4, borderRadius:8, border:'1px solid var(--border)', background:'var(--bg-secondary)', color:'var(--text-dim)', fontSize:10, cursor:'pointer' }}>Показать ещё ({synTotal - synPage.length} из {synTotal})</button>}
            </div>
          )}
        </div>
        <div>
          <div onClick={() => setExpandedCategories(prev => ({ ...prev, syn_conflicts: !(prev?.syn_conflicts ?? true) }))} style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 8px', cursor:'pointer', userSelect:'none', background:'var(--bg-secondary)', borderRadius:8, marginBottom:4 }}>
            <span style={{ fontSize:13 }}>⊖</span>
            <div style={{ flex:1, fontSize:10, fontWeight:700, color:'#ef4444' }}>Конфликты и осторожность ({confTotal})</div>
            <span style={{ fontSize:9, color:'var(--text-dim)', transform:cats?.syn_conflicts !== false ? 'rotate(180deg)' : 'none', transition:'transform 0.2s' }}>▼</span>
          </div>
          {cats?.syn_conflicts !== false && (
            <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
              {confPage.map((interaction: any, i: number) => safeItem(() => {
                const typeInfo = INTERACTION_TYPE_LABELS[interaction?.type] || { label:interaction?.type, emoji:'🔗', color:'#888' };
                const sevInfo = INTERACTION_SEVERITY_LABELS[interaction?.severity] || { label:interaction?.severity, color:'#888' };
                const aName = resolveSubName(interaction?.substanceA);
                const bName = resolveSubName(interaction?.substanceB);
                return (
                  <div key={interaction?.interactionId||i} style={{ background:'var(--bg-secondary)', borderRadius:8, padding:'7px 8px', borderLeft:`3px solid ${typeInfo.color}` }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:2 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:4, flexWrap:'wrap', flex:1, minWidth:0 }}>
                        <span style={{ fontWeight:600, fontSize:10, color:'var(--text-light)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', maxWidth:'35%' }}>{aName}</span>
                        <span style={{ fontSize:10, color:typeInfo.color, fontWeight:700 }}>{interaction?.type === 'conflict' ? '×' : '?'}</span>
                        <span style={{ fontWeight:600, fontSize:10, color:'var(--text-light)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', maxWidth:'35%' }}>{bName}</span>
                      </div>
                      <div style={{ display:'flex', gap:3, flexShrink:0 }}>
                        <span style={{ fontSize:7, padding:'1px 4px', borderRadius:3, background:typeInfo.color+'22', color:typeInfo.color, fontWeight:600 }}>{typeInfo.label}</span>
                        <span style={{ fontSize:7, padding:'1px 4px', borderRadius:3, background:sevInfo.color+'22', color:sevInfo.color }}>{sevInfo.label}</span>
                      </div>
                    </div>
                    <div style={{ fontSize:9, color:'rgba(255,255,255,0.85)', lineHeight:1.3 }}>⊖ {showEffect(interaction)}</div>
                    {(() => {
                      const subAInfo = ALL_SUBSTANCES.find(s => s.id === interaction?.substanceA) || (PHARMA_DB[interaction?.substanceA] ? { id: interaction?.substanceA, name: PHARMA_DB[interaction?.substanceA]?.name, description: PHARMA_DB[interaction?.substanceA]?.description || '', mechanisms: PHARMA_DB[interaction?.substanceA]?.mechanisms || [] } : null);
                      const subBInfo = ALL_SUBSTANCES.find(s => s.id === interaction?.substanceB) || (PHARMA_DB[interaction?.substanceB] ? { id: interaction?.substanceB, name: PHARMA_DB[interaction?.substanceB]?.name, description: PHARMA_DB[interaction?.substanceB]?.description || '', mechanisms: PHARMA_DB[interaction?.substanceB]?.mechanisms || [] } : null);
                      const aDesc = subAInfo?.description || '';
                      const bDesc = subBInfo?.description || '';
                      const aMechs = ((subAInfo?.mechanisms || []) as string[]).slice(0, 3);
                      const bMechs = ((subBInfo?.mechanisms || []) as string[]).slice(0, 3);
                      if (!aDesc && !bDesc && aMechs.length === 0 && bMechs.length === 0) return null;
                      return (
                        <div style={{ marginTop:3, padding:'4px 6px', background:'rgba(239,68,68,0.04)', borderRadius:4, border:'1px solid rgba(239,68,68,0.08)' }}>
                          {aDesc && <div style={{fontSize:7,color:'var(--text-dim)',lineHeight:1.3,marginBottom:1}}><b style={{color:'#f87171'}}>{aName}</b>: {aDesc}</div>}
                          {aMechs.length > 0 && <div style={{display:'flex',flexWrap:'wrap',gap:1,marginBottom:2}}>{aMechs.map((m,mi)=><span key={mi} style={{fontSize:5,padding:'0px 2px',borderRadius:2,background:'rgba(248,113,113,0.1)',color:'#f87171'}}>{MECH_LABELS[m] || MECH_TRANSLATIONS_RU[m] || m}</span>)}</div>}
                          {bDesc && <div style={{fontSize:7,color:'var(--text-dim)',lineHeight:1.3,marginBottom:1}}><b style={{color:'#f87171'}}>{bName}</b>: {bDesc}</div>}
                          {bMechs.length > 0 && <div style={{display:'flex',flexWrap:'wrap',gap:1}}>{bMechs.map((m,mi)=><span key={mi} style={{fontSize:5,padding:'0px 2px',borderRadius:2,background:'rgba(248,113,113,0.1)',color:'#f87171'}}>{MECH_LABELS[m] || MECH_TRANSLATIONS_RU[m] || m}</span>)}</div>}
                        </div>
                      );
                    })()}
                    {(interaction?.mechanisms||[]).length > 0 && (
                      <div style={{ display:'flex', flexWrap:'wrap', gap:2, marginTop:2 }}>
                        {(interaction.mechanisms||[]).map((m: any, mi: number) => {
                          const ms = (m||'');
                          const mColor = ms.toLowerCase().includes('toxic') || ms.toLowerCase().includes('hepatic') ? '#ef4444' :
                            ms.toLowerCase().includes('kidney') || ms.toLowerCase().includes('renal') ? '#f59e0b' :
                            ms.toLowerCase().includes('synerg') || ms.toLowerCase().includes('enhanc') || ms.toLowerCase().includes('potent') ? '#22c55e' : '#8b5cf6';
                          return <span key={mi} style={{ fontSize:6, padding:'1px 4px', borderRadius:3, background:mColor+'18', color:mColor, border:`1px solid ${mColor}22`, fontWeight:500 }}>{MECH_LABELS[m] || MECH_TRANSLATIONS_RU[m] || (m||'')}</span>;
                        })}
                      </div>
                    )}
                    {interaction?.notes && !(/^[A-Z0-9_]+$/.test(interaction?.effect||'')) && <div style={{ fontSize:8, color:'var(--text-dim)', fontStyle:'italic', lineHeight:1.2, marginTop:2 }}>{interaction?.notes}</div>}
                  </div>
                );
              }, i))}
              {confTotal === 0 && <div style={{ padding:12, textAlign:'center', color:'var(--text-dim)', fontSize:10 }}>Нет конфликтов</div>}
              {confPage.length < confTotal && <button onClick={() => setSynergyPage(p => p + 1)} style={{ width:'100%', padding:'8px', marginTop:4, borderRadius:8, border:'1px solid var(--border)', background:'var(--bg-secondary)', color:'var(--text-dim)', fontSize:10, cursor:'pointer' }}>Показать ещё ({confTotal - confPage.length} из {confTotal})</button>}
            </div>
          )}
        </div>
      </>);
    });
  };

  return (
    <div className="screen support-screen" style={{ paddingTop: section === 'info' || calcView === 'info' || ['mixcalc','💪 Тренировочные миксы','joints','acne','peptides'].includes(calcView) || section === 'generator' || section === 'protocols' ? '88px' : section !== 'home' ? '50px' : '10px', paddingBottom: '0px', overflowY: 'auto' }}>

      {/* ===== GENERATOR SUB-TAB PILLS (with back/home) ===== */}
      {section === 'generator' && (
        <div style={{ position:'fixed', top:0, left:0, right:0, zIndex:150, background:'var(--bg-primary)', borderBottom:'1px solid var(--border)' }}>
          <div style={{ display:'flex', gap:6, padding:'4px 12px', borderBottom:'1px solid var(--border)', alignItems:'center', overflowX:'auto' }}>
            <button onClick={goBack} style={{ padding:'3px 10px', borderRadius:6, fontSize:10, cursor:'pointer', background:'var(--bg-secondary)', border:'1px solid var(--border)', color:'var(--text-dim)', fontWeight:600, whiteSpace:'nowrap' }}>← Назад</button>
            <button onClick={goHome} style={{ padding:'3px 10px', borderRadius:6, fontSize:10, cursor:'pointer', background:'var(--bg-secondary)', border:'1px solid var(--border)', color:'var(--text-dim)', fontWeight:600, whiteSpace:'nowrap' }}>← На главную</button>
          </div>
          <div style={{ display:'flex', gap:4, padding:'6px 12px 8px', overflowX:'auto', scrollbarWidth:'none' }}>
            {[['calculator','Калькулятор'],['info','О подборе'],['stackgen','Генератор стеков'],['mystacks','Мои стеки'],['plan','План'],['reports','Отчёты']].map(([id,label]) => (
              <button key={id} onClick={() => { setGenTab(id as any); 
              const a: Record<string,()=>void> = {
                calculator: ()=>{ setTab('calculator'); setSupportView('calc'); },
                info: ()=>{},
                stackgen: ()=>{ setTab('main'); setSupportView('calc'); setCalcView('stackcalc'); },
                mystacks: ()=>{ setTab('main'); setSupportView('calc'); setCalcView('mystacks'); },
                plan: ()=>{ setTab('main'); setSupportView('calc'); setCalcView('plan'); },
                reports: ()=>{ setTab('main'); setSupportView('calc'); setCalcView('reports'); },
              };
              a[id]?.();
            }} style={{
              padding:'6px 14px', borderRadius:22, fontSize:11, fontWeight:700, whiteSpace:'nowrap', cursor:'pointer', flexShrink:0,
              background: genTab === id ? 'var(--accent)' : 'var(--bg-secondary)',
              color: genTab === id ? '#000' : 'var(--text-dim)',
              border: '1px solid ' + (genTab === id ? 'var(--accent)' : 'var(--border)'),
            }}>{label}</button>
          ))}
          </div>
        </div>
      )}

      {/* ===== PROTOCOLS HEADER (back/home only) ===== */}
      {section === 'protocols' && (
        <div style={{ position:'fixed', top:0, left:0, right:0, zIndex:150, background:'var(--bg-primary)', borderBottom:'1px solid var(--border)' }}>
          <div style={{ display:'flex', gap:6, padding:'4px 12px', borderBottom:'1px solid var(--border)', alignItems:'center', overflowX:'auto' }}>
            <button onClick={goBack} style={{ padding:'3px 10px', borderRadius:6, fontSize:10, cursor:'pointer', background:'var(--bg-secondary)', border:'1px solid var(--border)', color:'var(--text-dim)', fontWeight:600, whiteSpace:'nowrap' }}>← Назад</button>
            <button onClick={goHome} style={{ padding:'3px 10px', borderRadius:6, fontSize:10, cursor:'pointer', background:'var(--bg-secondary)', border:'1px solid var(--border)', color:'var(--text-dim)', fontWeight:600, whiteSpace:'nowrap' }}>← На главную</button>
          </div>
        </div>
      )}

      {/* ===== INFO HEADER (back/home + pills) ===== */}
      {(section === 'info' || calcView === 'info' || ['mixcalc','💪 Тренировочные миксы','joints','acne','peptides'].includes(calcView)) && (
        <div style={{ position:'fixed', top:0, left:0, right:0, zIndex:150, background:'var(--bg-primary)', borderBottom:'1px solid var(--border)' }}>
          <div style={{ display:'flex', gap:6, padding:'4px 12px', borderBottom:'1px solid var(--border)', alignItems:'center', overflowX:'auto' }}>
            <button onClick={goBack} style={{ padding:'3px 10px', borderRadius:6, fontSize:10, cursor:'pointer', background:'var(--bg-secondary)', border:'1px solid var(--border)', color:'var(--text-dim)', fontWeight:600, whiteSpace:'nowrap' }}>← Назад</button>
            <button onClick={goHome} style={{ padding:'3px 10px', borderRadius:6, fontSize:10, cursor:'pointer', background:'var(--bg-secondary)', border:'1px solid var(--border)', color:'var(--text-dim)', fontWeight:600, whiteSpace:'nowrap' }}>← На главную</button>
          </div>
          <div style={{ display:'flex', gap:4, padding:'6px 12px 8px', overflowX:'auto', scrollbarWidth:'none' }}>
            {[['peptides','Пептиды'],['catalog','Каталог'],['synergies','Взаимодействие препаратов'],['favorites','Избранное'],['supportstacks','Стеки поддержки'],['research','Исследования']].map(([id,label]) => (
              <button key={id} onClick={() => { setInfoTab(id as any);
                const a: Record<string,()=>void> = {
                  peptides: ()=>{ setSection('info'); setTab('main'); setSupportView('calc'); setCalcView('peptides'); setInfoTab('peptides'); },
                  catalog: ()=>{ setTab('main'); setSupportView('calc'); setCalcView('info'); setInfoView('catalog'); setSection('home'); },
                  synergies: ()=>{ setTab('main'); setSupportView('calc'); setCalcView('info'); setInfoView('synergies'); setSection('home'); },
                  readystacks: ()=>{ setTab('main'); setSupportView('calc'); setCalcView('info'); setInfoView('stacks'); setSection('home'); },
                  interactions: ()=>{ setTab('main'); setSupportView('calc'); setCalcView('info'); setInfoView('interactions'); setSection('home'); },
                  research: ()=>{ setTab('main'); setSupportView('calc'); setCalcView('info'); setInfoView('research'); setSection('home'); },

                  mixcalc: ()=>{ setSection('home'); setTab('main'); setSupportView('calc'); setCalcView('mixcalc'); },
                  neuro: ()=>{ setSection('home'); setTab('main'); setSupportView('calc'); setCalcView('neuro'); },
                  joints: ()=>{ setSection('home'); setTab('main'); setSupportView('calc'); setCalcView('joints'); },
                  acne: ()=>{ setSection('home'); setTab('main'); setSupportView('calc'); setCalcView('acne'); },
                };
                a[id]?.();
              }} style={{
                padding:'5px 12px', borderRadius:16, fontSize:10, fontWeight:700, whiteSpace:'nowrap', cursor:'pointer', flexShrink:0,
                background: infoTab === id ? 'var(--accent)' : 'var(--bg-secondary)',
                color: infoTab === id ? '#000' : 'var(--text-dim)',
                border: '1px solid ' + (infoTab === id ? 'var(--accent)' : 'var(--border)'),
              }}>{label}</button>
            ))}
          </div>
        </div>
      )}

      {/* ===== MAIN HERO ===== */}
      {(section === 'home' && tab === 'main' && supportView === 'main') && (
        <div style={{ position:'fixed', inset:0, zIndex:100, display:'flex', flexDirection:'column' }}>
          <img src="/support-hero.jpg" alt="" style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover', objectPosition:'center top' }} />
          <div style={{ position:'absolute', inset:0, background:'linear-gradient(transparent 50%, rgba(0,0,0,0.85))' }} />
          <div style={{ position:'relative', zIndex:2, flex:1, display:'flex', flexDirection:'column', justifyContent:'flex-end', padding:'16px 16px 80px' }}>
            <h1 style={{ fontSize:22, fontWeight:800, color:'#fff', margin:'0 0 2px', textShadow:'0 2px 14px rgba(0,0,0,0.9)' }}>Поддержка</h1>
            <p style={{ fontSize:11, color:'rgba(255,255,255,0.9)', margin:'0 0 16px', lineHeight:1.3, textShadow:'0 1px 8px rgba(0,0,0,0.8)' }}>
              Фармакологическая поддержка, пептиды и предлагаемые препараты поддержки для уменьшения рисков
            </p>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              <div onClick={() => { setSection('generator'); setTab('calculator'); setSupportView('calc'); setCalcView('main'); }} style={{
                display:'flex', alignItems:'center', gap:12, padding:'14px 16px', borderRadius:16, cursor:'pointer', textAlign:'left', width:'100%',
                background:'rgba(24,24,27,0.15)', border:'1px solid rgba(255,255,255,0.04)', color:'var(--text)', transition:'all 0.2s',
              }}>
                <div style={{ width:48, height:48, borderRadius:14, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, background:'rgba(0,230,138,0.15)', fontSize:24 }}>🧮</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:15, fontWeight:800, marginBottom:4, color:'var(--accent)' }}>Калькулятор поддержки</div>
                  <div style={{ fontSize:10, color:'rgba(255,255,255,0.85)', lineHeight:1.3 }}>Расчёт рисков, генератор стеков, протоколы нейропротекции, миксы, план приёма</div>
                </div>
                <span style={{ color:'var(--accent)', fontSize:18, opacity:0.6 }}>→</span>
              </div>
               <div style={{
                display:'flex', flexDirection:'column', gap:8, padding:'14px 16px', borderRadius:16,
                background:'rgba(24,24,27,0.15)', border:'1px solid rgba(255,255,255,0.04)',
              }}>
                {/* Banner warning */}
                <div style={{ padding:'8px 10px', borderRadius:8, background:'rgba(239,68,68,0.06)', border:'1px solid rgba(239,68,68,0.15)', display:'flex', alignItems:'center', gap:6 }}>
                  <span style={{ fontSize:12, flexShrink:0 }}>⚠️</span>
                  <span style={{ fontSize:8, color:'rgba(255,255,255,0.6)', lineHeight:1.3 }}>Информация ознакомительная. Схемы назначаются специалистом.</span>
                </div>
                {/* Title */}
                <div style={{ fontSize:13, fontWeight:700, color:'#8b5cf6' }}>📋 Примерные протоколы поддержки</div>
                {/* 7 unified sub-tabs */}
                <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
                  {[
                    { id:'pct', label:'ПКТ', color:'#8b5cf6' },
                    { id:'fertility', label:'Фертильность', color:'#ec4899' },
                    { id:'hrt', label:'ГЗТ', color:'#f59e0b' },
                    { id:'neuro', label:'Нейро', color:'#06b6d4' },
                    { id:'joints', label:'Суставы', color:'#22c55e' },
                    { id:'acne', label:'Акне', color:'#ef4444' },
                  ].map(t => (
                    <button key={t.id} onClick={() => { setSection('protocols'); setProtocolTab(t.id as any); }} style={{
                      padding:'5px 10px', borderRadius:12, fontSize:9, fontWeight:600, cursor:'pointer', border:'none',
                      background:t.color+'18', color:t.color,
                    }}>{t.label}</button>
                  ))}
                </div>
              </div>
              <div onClick={() => { setSection('home'); setTab('main'); setSupportView('calc'); setCalcView('info'); setInfoView('catalog'); }} style={{
                display:'flex', alignItems:'center', gap:12, padding:'14px 16px', borderRadius:16, cursor:'pointer', textAlign:'left', width:'100%',
                background:'rgba(24,24,27,0.15)', border:'1px solid rgba(255,255,255,0.04)', color:'var(--text)', transition:'all 0.2s',
              }}>
                <div style={{ width:48, height:48, borderRadius:14, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, background:'rgba(96,165,250,0.15)', fontSize:24 }}>📚</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:15, fontWeight:800, marginBottom:4, color:'#60a5fa' }}>Общая информация</div>
                  <div style={{ fontSize:10, color:'rgba(255,255,255,0.85)', lineHeight:1.3 }}>Каталог, синергии, взаимодействия, исследования, калькуляторы</div>
                </div>
                <span style={{ color:'#60a5fa', fontSize:18, opacity:0.6 }}>→</span>
              </div>
            </div>
        </div>
      </div>
      )}

      {/* ===== SUB-NAVIGATION (calc / fertility menus) ===== */}
      {section === 'home' && tab === 'main' && supportView === 'calc' && calcView === 'main' && (
        <div style={{ position:'fixed', inset:0, zIndex:100, display:'flex', flexDirection:'column' }}>
          <img src="/calc-hero.jpg" alt="" style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover', objectPosition:'center top' }} />
          <div style={{ position:'absolute', inset:0, background:'linear-gradient(transparent 50%, rgba(0,0,0,0.85))' }} />
          <div style={{ position:'relative', zIndex:2, flex:1, display:'flex', flexDirection:'column', padding:'10px 12px 16px', overflow:'hidden' }}>
            <button onClick={goBack} style={{ alignSelf:'flex-start', padding:'4px 8px', borderRadius:6, fontSize:10, cursor:'pointer', marginBottom:8, background:'var(--bg-secondary)', border:'1px solid var(--border)', color:'var(--text-dim)', fontWeight:600 }}>← Назад</button>
            <h2 style={{ fontSize:18, fontWeight:800, color:'#fff', margin:'8px 0 2px', textShadow:'0 2px 10px rgba(0,0,0,0.9)' }}>Расчет поддержки</h2>
            <p style={{ fontSize:10, color:'rgba(255,255,255,0.9)', margin:'0 0 16px', textShadow:'0 1px 6px rgba(0,0,0,0.8)' }}>
              Калькулятор поддержки, пептидный калькулятор и общая информация
            </p>
            {/* PRIMARY: Apple-style large cards */}
            <div style={{ flex:1, overflowY:'auto', scrollbarWidth:'none', msOverflowStyle:'none', paddingRight:4 }}>
              <div style={{ display:'flex', flexDirection:'column', gap:8, paddingBottom:8 }}>
                {[
                  { icon:'🧮', title:'Калькулятор поддержки', desc:'Персонализированный расчёт поддержки по курсу, рискам и целям', color:'#00e68a', action:() => { setSection('generator'); setTab('calculator'); setSupportView('calc'); setCalcView('main'); } },
                  { icon:'🧬', title:'Пептидный калькулятор', desc:'Расчёт дозировок, баков, разведения и протоколов пептидов', color:'#a78bfa', action:() => { setSection('info'); setTab('main'); setSupportView('calc'); setCalcView('peptides'); } },
                  { icon:'ℹ️', title:'Общая информация', desc:'Каталог веществ, синергии, готовые стеки и взаимодействия', color:'#60a5fa', action:() => { setCalcView('info'); setInfoView('catalog'); } },
                  { icon:'🔬', title:'Исследования', desc:'Научная база исследований по всем веществам поддержки', color:'#f59e0b', action:() => { setCalcView('info'); setInfoView('research'); } },
                  { icon:'🧮', title:'Генератор стеков', desc:'Автоматический подбор стека по органам, целям и биомаркерам', color:'#ec4899', action:() => { setSection('generator'); setTab('main'); setSupportView('calc'); setCalcView('stackcalc'); } },
                  { icon:'📂', title:'Мои стеки', desc:'Сохранённые персональные стеки с оценкой синергий и конфликтов', color:'#22c55e', action:() => { setSection('generator'); setTab('main'); setSupportView('calc'); setCalcView('mystacks'); } },
                  { icon:'⚡', title:'Тренировочные миксы', desc:'Пре-/интра-/пост-тренировочные стеки для пампа, силы и восстановления', color:'#f97316', action:() => setCalcView('mixcalc') },
                  { icon:'📅', title:'План поддержки', desc:'Дневной, недельный и месячный план приёма по тайм-слотам', color:'#84cc16', action:() => { setSection('generator'); setTab('main'); setSupportView('calc'); setCalcView('plan'); } },
                  { icon:'🧠', title:'Нейротоксичность', desc:'Детальные механизмы нейротоксичности ААС и протокол нейропротекции', color:'#ec4899', action:() => setCalcView('neuro') },
                  { icon:'🦴', title:'Суставы и связки', desc:'Калькулятор поддержки суставов, анализы и протоколы', color:'#f59e0b', action:() => setCalcView('joints') },
                  { icon:'🔴', title:'Акне', desc:'Анти-прыщ протокол: ниацинамид, ретиноиды, солярий, гигиена', color:'#ef4444', action:() => setCalcView('acne') },
                ].map((card, i) => (
                  <div key={i} onClick={card.action} style={{
                    display:'flex', alignItems:'center', gap:12, padding:'12px 14px', borderRadius:14, cursor:'pointer',
                    background:'rgba(24,24,27,0.12)', border:'1px solid rgba(255,255,255,0.04)', color:'var(--text)',
                    transition:'all 0.2s',
                  }}>
                    <div style={{ width:44, height:44, borderRadius:12, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, background:`${card.color}18`, fontSize:20 }}>{card.icon}</div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:13, fontWeight:700, marginBottom:2, color:card.color }}>{card.title}</div>
                      <div style={{ fontSize:10, color:'rgba(255,255,255,0.85)', lineHeight:1.3 }}>{card.desc}</div>
                    </div>
                    <span style={{ color:card.color, fontSize:16, opacity:0.6 }}>→</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {section === 'home' && tab === 'main' && supportView === 'calc' && calcView === 'info' && (
        <div style={{ padding:'0 0 70px', display:'flex', flexDirection:'column' }}>
          {/* Content */}
          <div style={{ flex:1, overflowY:'auto', paddingRight:4 }}>
            <div style={{fontSize:7,color:'rgba(255,255,255,0.2)',textAlign:'center',marginBottom:4}}>
              build:2026-06-15 | subs:{ALL_SUBSTANCES.length} | int:{ALL_INTERACTIONS.length} | stacks:{ALL_STACKS.length} | tab:{calcView}/{infoView}
            </div>
            {renderView(infoView, 'catalog', () =>
              <div>
                {/* Sub-tabs: По типам / По органам / По уровням */}
                <div style={{ display:'flex', gap:4, marginBottom:8, overflowX:'auto', scrollbarWidth:'none' }}>
                  {(['type','organ','tier','complexes'] as const).map(t => (
                    <button key={t} onClick={() => setCatalogSubTab(t)} style={{
                      padding:'6px 12px', borderRadius:16, fontSize:9, fontWeight:700, whiteSpace:'nowrap', cursor:'pointer',
                      background: catalogSubTab === t ? 'var(--accent)' : 'var(--bg-secondary)',
                      color: catalogSubTab === t ? '#000' : 'var(--text-dim)',
                      border: `1px solid ${catalogSubTab === t ? 'var(--accent)' : 'var(--border)'}`,
                    }}>{t === 'type' ? '📋 По типам' : t === 'organ' ? '🫀 По органам' : t === 'tier' ? '⚡ По уровням' : '🧩 Комплексы'}</button>
                  ))}
                </div>
                <div style={{ display:'flex', gap:6, marginBottom:8, alignItems:'center' }}>
                  <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Поиск по названию, категориям, механизмам" style={{ flex:1, padding:'8px 10px', borderRadius:8, border:'1px solid var(--border-color)', background:'var(--bg-secondary)', color:'var(--text-light)', fontSize:12 }} />
                </div>
                {/* Tier filter buttons */}
                <div style={{ display:'flex', gap:4, marginBottom:8, flexWrap:'wrap' }}>
                  {(['all','core','standard','advanced','specialty'] as const).map(tier => {
                    const isSel = supportTierFilter === tier;
                    const info = tier === 'all' ? { label:'Все', emoji:'🔍', color:'var(--text-dim)' } : TIER_LABELS_CATALOG[tier];
                    const count = tier === 'all' ? catalogSubstances.length : catalogSubstances.filter(s => getSubstanceTier(s.id) === tier).length;
                    return (
                      <button key={tier} onClick={() => setSupportTierFilter(tier)} style={{
                        padding:'4px 10px', borderRadius:12, fontSize:9, fontWeight:700, cursor:'pointer',
                        background: isSel ? (info?.color || 'var(--accent)') : 'var(--bg-secondary)',
                        color: isSel ? '#000' : 'var(--text-dim)',
                        border: `1px solid ${isSel ? (info?.color || 'var(--accent)') : 'var(--border)'}`,
                      }}>{info?.emoji || ''} {info?.label || tier} ({count})</button>
                    );
                  })}
                </div>
                <div style={{ fontSize:9, color:'var(--text-dim)', marginBottom:6 }}>
            {searchQuery ? `Найдено: ${groupedSubstances.reduce((a, g) => a + g.count, 0)} из ${catalogSubstances.length}` : `Всего: ${catalogSubstances.length} препаратов`}
                </div>
                {catalogSubTab === 'organ' && (
                  /* По органам */
                  <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                    {(OrganGroupedSubstances||[]).map(group => {
                      const isExpanded = expandedCategories[group.key] ?? (group.count <= 5);
                      return (
                        <div key={group.key} style={{ background:'var(--bg-secondary)', borderRadius:10, overflow:'hidden', border:'1px solid var(--border)' }}>
                          <div onClick={() => setExpandedCategories(prev => ({ ...prev, [group.key]: !isExpanded }))} style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 10px', cursor:'pointer', userSelect:'none' }}>
                            <span style={{ fontSize:14 }}>{group.emoji}</span>
                            <div style={{ flex:1, fontSize:11, fontWeight:700, color:'var(--text-light)' }}>{group.label}</div>
                            <span style={{ fontSize:9, color:'var(--text-dim)', fontWeight:600 }}>{group.count}</span>
                            <span style={{ fontSize:9, color:'var(--text-dim)', transform:isExpanded ? 'rotate(180deg)' : 'none', transition:'transform 0.2s' }}>▼</span>
                          </div>
                          {isExpanded && (group.items||[]).map(sub => {
                            const isSelected = selectedSub === sub?.id;
                            return (
                              <div key={sub?.id||'x'}>
                                <div onClick={() => setSelectedSub(isSelected ? null : (sub?.id||null))} style={{ display:'flex', alignItems:'flex-start', gap:4, padding:'6px 10px 6px 18px', cursor:'pointer', borderBottom:'1px solid var(--border)' }}>
                                  <div style={{ flex:1 }}>
                                    <div style={{ fontSize:10, fontWeight:600, color:'var(--text-light)', lineHeight:1.3 }}>{sub?.name||(sub?.id||'').replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase())}</div>
                                    <div style={{ display:'flex', gap:2, flexWrap:'wrap', marginTop:1 }}>
                                      {(sub?.categories||[]).slice(0,3).map(c => <span key={c} style={{ fontSize:8, padding:'1px 4px', borderRadius:3, background:'rgba(255,255,255,0.06)', color:'rgba(255,255,255,0.85)' }}>{c||''}</span>)}
                                          {(sub?.mechanisms||[]).slice(0,4).map(m => <span key={m||''} style={{ fontSize:8, padding:'1px 4px', borderRadius:3, background:'rgba(0,230,138,0.08)', color:'#00e68a' }}>{MECH_LABELS[m] || MECH_TRANSLATIONS_RU[m] || m||''}</span>)}
                                    </div>
                                  </div>
                                  <button onClick={e => { e.stopPropagation(); if (sub?.id && !enhancedSubs.includes(sub.id)) setEnhancedSubs(prev => [...prev, sub.id]); }} style={{ padding:'2px 8px', borderRadius:6, fontSize:9, fontWeight:700, cursor:'pointer', background:'rgba(0,230,138,0.1)', border:'1px solid rgba(0,230,138,0.3)', color:'#00e68a', whiteSpace:'nowrap', flexShrink:0 }}>{enhancedSubs.includes(sub?.id||'') ? '✓' : '+ Мой стек'}</button>
                                  <button onClick={e => { e.stopPropagation(); try { let f:string[]=JSON.parse(localStorage.getItem('he_support_favorites')||'[]');const idx=f.indexOf(sub?.id||'');if(idx>=0)f.splice(idx,1);else f.push(sub?.id||'');localStorage.setItem('he_support_favorites',JSON.stringify(f));setFavRefresh(p=>p+1);}catch{} }} style={{ padding:'2px 6px', borderRadius:6, fontSize:10, cursor:'pointer', background:'transparent', border:'none', color:(()=>{try{return JSON.parse(localStorage.getItem('he_support_favorites')||'[]').includes(sub?.id||'')?'#fbbf24':'var(--text-dim)';}catch{return 'var(--text-dim)';}})() }}>★</button>
                                  <span style={{ fontSize:9, color:'var(--text-dim)', transform:isSelected ? 'rotate(180deg)' : 'none' }}>▼</span>
                                </div>
                                {isSelected && sub && (
                                  <div style={{ padding:'6px 10px 8px 18px', background:'rgba(0,0,0,0.15)', borderBottom:'1px solid var(--border)' }}>
                                    <div style={{ fontSize:10, color:'rgba(255,255,255,0.9)', lineHeight:1.4, marginBottom:4 }}>{sub.description||''}</div>
                                    <div style={{ fontSize:7, color:'var(--accent-green, #00e68a)', marginBottom:3 }}>
                                      {TYPE_LABELS_RU[sub.type] || sub.type || 'Без категории'}{(sub.categories||[]).length > 0 ? ' · ' + (sub.categories||[]).slice(0,3).join(', ') : ''}
                                    </div>
                                    {(sub.mechanisms||[]).length > 0 && (
                                      <div style={{ marginBottom:3 }}>
                                        <div style={{ fontSize:8, color:'rgba(255,255,255,0.85)', marginBottom:1 }}>Механизмы действия:</div>
                                        <div style={{ display:'flex', gap:2, flexWrap:'wrap' }}>
                                          {(sub.mechanisms||[]).map((m,i) => <span key={i} style={{ fontSize:8, padding:'2px 6px', borderRadius:4, background:'rgba(0,230,138,0.08)', color:'#00e68a', border:'1px solid rgba(0,230,138,0.15)' }}>{MECH_LABELS[m] || MECH_TRANSLATIONS_RU[m] || m||''}</span>)}
                                        </div>
                                      </div>
                                    )}
                                    {(sub.organs||[]).length > 0 && (
                                      <div style={{ marginBottom:3 }}>
                                        <div style={{ fontSize:8, color:'rgba(255,255,255,0.85)', marginBottom:1 }}>Органы-мишени:</div>
                                        <div style={{ display:'flex', gap:2, flexWrap:'wrap' }}>
                                           {[...new Set(sub.organs||[])].map(o => <span key={o||''} style={{ fontSize:8, padding:'2px 6px', borderRadius:4, background:'rgba(59,130,246,0.1)', color:'#60a5fa', border:'1px solid rgba(59,130,246,0.15)' }}>{o||''}</span>)}
                                         </div>
                                       </div>
                                     )}
                                     {SUPPLEMENT_DESCRIPTIONS[sub.id] && (
                                      <div style={{ marginTop:4, padding:'4px 6px', background:'rgba(0,230,138,0.05)', borderRadius:4, border:'1px solid rgba(0,230,138,0.1)' }}>
                                        <div style={{ fontSize:8, color:'#00e68a', fontWeight:600, marginBottom:1 }}>📋 Подробнее:</div>
                                        <div style={{ fontSize:9, color:'rgba(255,255,255,0.9)', lineHeight:1.4 }}>{SUPPLEMENT_DESCRIPTIONS[sub.id]}</div>
                                      </div>
                                    )}
                                    {catDetailInteractions(sub, ALL_INTERACTIONS)}
                                     {renderCatalogDetail(sub.id || (sub as any)?.id)}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                )}
                {catalogSubTab === 'tier' && (
                  /* По уровням */
                  <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                    {SUPPORT_TIER_GROUPS.map((tg, tgi) => {
                      const isExpanded = expandedCategories[tg.key] ?? true;
                      return (
                        <div key={tg.key} style={{ background:'var(--bg-secondary)', borderRadius:10, overflow:'hidden', border:'1px solid var(--border)' }}>
                          <div onClick={() => setExpandedCategories(prev => ({ ...prev, [tg.key]: !isExpanded }))} style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 10px', cursor:'pointer', userSelect:'none' }}>
                            <span style={{ fontSize:14 }}>{tg.emoji}</span>
                            <div style={{ flex:1, fontSize:11, fontWeight:700, color:tg.color }}>{tg.label}</div>
                            <span style={{ fontSize:9, color:'var(--text-dim)', fontWeight:600 }}>{tg.substances.length}</span>
                            <span style={{ fontSize:9, color:'var(--text-dim)', transform:isExpanded ? 'rotate(180deg)' : 'none', transition:'transform 0.2s' }}>▼</span>
                          </div>
                          {isExpanded && (
                            <div style={{ borderTop:'1px solid var(--border)' }}>
                              {tg.substances.map(id => {
                                const sub = catalogSubstances.find(s => s.id === id);
                                if (!sub) return null;
                                const isSelected = selectedSub === id;
                                return (
                                  <div key={id}>
                                    <div onClick={() => setSelectedSub(isSelected ? null : id)} style={{ display:'flex', alignItems:'center', gap:4, padding:'6px 10px 6px 18px', cursor:'pointer', borderBottom:'1px solid var(--border)' }}>
                                      <div style={{ flex:1 }}>
                                        <div style={{ fontSize:10, fontWeight:600, color:'var(--text-light)' }}>{sub.name||(sub.id||'').replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase())}</div>
                                        <div style={{ fontSize:8, color:'var(--text-dim)' }}>{(sub.categories||[]).slice(0,2).join(', ')}</div>
                                      </div>
                                      <button onClick={e => { e.stopPropagation(); if (!enhancedSubs.includes(id)) setEnhancedSubs(prev => [...prev, id]); }} style={{ padding:'2px 8px', borderRadius:6, fontSize:9, fontWeight:700, cursor:'pointer', background:'rgba(0,230,138,0.1)', border:'1px solid rgba(0,230,138,0.3)', color:'#00e68a', whiteSpace:'nowrap', flexShrink:0 }}>{enhancedSubs.includes(id) ? '✓' : '+ Мой стек'}</button>
                                      <button onClick={e => { e.stopPropagation(); try { let f:string[]=JSON.parse(localStorage.getItem('he_support_favorites')||'[]');const idx=f.indexOf(id);if(idx>=0)f.splice(idx,1);else f.push(id);localStorage.setItem('he_support_favorites',JSON.stringify(f));setFavRefresh(p=>p+1);}catch{} }} style={{ padding:'2px 6px', borderRadius:6, fontSize:10, cursor:'pointer', background:'transparent', border:'none', color:(()=>{try{return JSON.parse(localStorage.getItem('he_support_favorites')||'[]').includes(id)?'#fbbf24':'var(--text-dim)';}catch{return 'var(--text-dim)';}})() }}>★</button>
                                      <span style={{ fontSize:9, color:'var(--text-dim)', transform:isSelected ? 'rotate(180deg)' : 'none' }}>▼</span>
                                    </div>
                                    {isSelected && (
                                      <div style={{ padding:'6px 10px 8px 18px', background:'rgba(0,0,0,0.15)', borderBottom:'1px solid var(--border)' }}>
                                        <div style={{ fontSize:10, color:'rgba(255,255,255,0.9)', lineHeight:1.4, marginBottom:4 }}>{sub.description}</div>
                                        {(sub.mechanisms||[]).length > 0 && (
                                          <div style={{ marginBottom:3 }}>
                                            <div style={{ display:'flex', gap:2, flexWrap:'wrap' }}>
                                              {(sub.mechanisms||[]).map((m,i) => <span key={i} style={{ fontSize:8, padding:'2px 6px', borderRadius:4, background:'rgba(0,230,138,0.08)', color:'#00e68a', border:'1px solid rgba(0,230,138,0.15)' }}>{MECH_LABELS[m] || MECH_TRANSLATIONS_RU[m] || m||''}</span>)}
                                            </div>
                                          </div>
                                        )}
                                        {catDetailInteractions(sub, ALL_INTERACTIONS)}
                                     {renderCatalogDetail(sub.id || (sub as any)?.id)}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
                {catalogSubTab === 'complexes' && (
                  /* Комплексы */
                  <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                    {(() => {
                      const complexItems = catalogSubstances.filter(s => isComplexId(s.id));
                      return complexItems.length > 0 ? (
                        complexItems.map(sub => {
                          const isSelected = selectedSub === sub?.id;
                          return (
                            <div key={sub?.id||'x'} style={{ background:'var(--bg-secondary)', borderRadius:10, overflow:'hidden', border:'1px solid var(--border)' }}>
                              <div onClick={() => setSelectedSub(isSelected ? null : (sub?.id||null))} style={{ display:'flex', alignItems:'flex-start', gap:4, padding:'8px 10px', cursor:'pointer' }}>
                                <div style={{ flex:1 }}>
                                  <div style={{ fontSize:10, fontWeight:700, color:'#8b5cf6', lineHeight:1.3 }}>🧩 {sub?.name||(sub?.id||'').replace(/_/g,' ')}</div>
                                  <div style={{ display:'flex', gap:2, flexWrap:'wrap', marginTop:2 }}>
                                    {(sub?.categories||[]).slice(0,3).map(c => <span key={c} style={{ fontSize:8, padding:'1px 4px', borderRadius:3, background:'rgba(139,92,246,0.08)', color:'#a78bfa' }}>{c||''}</span>)}
                                  </div>
                                </div>
                                <span style={{ fontSize:9, color:'var(--text-dim)', fontWeight:600 }}>{complexItems.length}</span>
                              </div>
                              {isSelected && sub && (
                                <div style={{ padding:'6px 10px 8px', background:'rgba(0,0,0,0.15)' }}>
                                  {catDetailInteractions(sub, ALL_INTERACTIONS)}
                                  {renderCatalogDetail(sub.id || (sub as any)?.id)}
                                </div>
                              )}
                            </div>
                          );
                        })
                      ) : <div style={{ padding:20, textAlign:'center', color:'var(--text-dim)', fontSize:10 }}>Комплексы не найдены</div>;
                    })()}
                  </div>
                )}
                {(catalogSubTab === 'type' || !catalogSubTab) && (
                /* По типам (default) */
                <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                  {(groupedSubstances||[]).map(group => {
                    const catInfo = getCategoryInfo(group.cat);
                    const isExpanded = expandedCategories[group.cat] ?? (group.count <= 5);
                    return (
                      <div key={group.cat} style={{ background:'var(--bg-secondary)', borderRadius:10, overflow:'hidden', border:'1px solid var(--border)' }}>
                        <div onClick={() => setExpandedCategories(prev => ({ ...prev, [group.cat]: !isExpanded }))} style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 10px', cursor:'pointer', userSelect:'none' }}>
                          <span style={{ fontSize:14 }}>{catInfo.emoji}</span>
                          <div style={{ flex:1, fontSize:11, fontWeight:700, color:'var(--text-light)' }}>{catInfo.label}</div>
                          <span style={{ fontSize:9, color:'var(--text-dim)', fontWeight:600, marginRight:2 }}>{group.count}</span>
                          {(group.classBadges||[]).slice(0,4).map(b => (
                            <span key={b.clsKey} style={{ fontSize:7, padding:'0px 4px', borderRadius:3, background:'rgba(0,230,138,0.08)', color:'#00e68a', fontWeight:600, marginRight:2 }}>{b.emoji}{b.count}</span>
                          ))}
                          <span style={{ fontSize:9, color:'var(--text-dim)', transform:isExpanded ? 'rotate(180deg)' : 'none', transition:'transform 0.2s' }}>▼</span>
                        </div>
                        {isExpanded && (
                          <div style={{ borderTop:'1px solid var(--border)' }}>
                            {/* Class sub-groups (3+ matching substances) */}
                            {Object.entries(group.classItems || {}).map(([clsKey, clsSubs]) => {
                              const clsInfo = CLASS_BASE_NAMES[clsKey];
                              const clsExpKey = `cls_${group.cat}_${clsKey}`;
                              const clsExpanded = expandedCategories[clsExpKey] ?? true;
                              return (
                                <div key={clsKey}>
                                  <div onClick={() => setExpandedCategories(prev => ({ ...prev, [clsExpKey]: !clsExpanded }))} style={{ display:'flex', alignItems:'center', gap:4, padding:'6px 10px 6px 18px', cursor:'pointer', userSelect:'none', background:'rgba(0,230,138,0.03)', borderBottom:'1px solid rgba(0,230,138,0.1)' }}>
                                    <span style={{ fontSize:11 }}>{clsInfo?.emoji || '📦'}</span>
                                    <div style={{ flex:1, fontSize:9, fontWeight:700, color:'#00e68a' }}>{clsInfo?.label || clsKey} ({clsSubs.length} форм{clsSubs.length === 1 ? 'а' : clsSubs.length < 5 ? 'ы' : ''})</div>
                                    <span style={{ fontSize:8, color:'var(--text-dim)', transform:clsExpanded ? 'rotate(180deg)' : 'none', transition:'transform 0.2s' }}>▼</span>
                                  </div>
                                  {clsExpanded && clsSubs.map(sub => (
                                    <div key={sub?.id||'x'}>
                                      <div onClick={() => setSelectedSub(selectedSub === sub?.id ? null : (sub?.id||null))} style={{ display:'flex', alignItems:'flex-start', gap:4, padding:'6px 10px 6px 22px', cursor:'pointer', borderBottom:'1px solid var(--border)' }}>
                                        <div style={{ flex:1 }}>
                                          <div style={{ fontSize:10, fontWeight:600, color:'var(--text-light)', lineHeight:1.3 }}>{sub?.name||(sub?.id||'').replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase())}</div>
                                          <div style={{ display:'flex', gap:2, flexWrap:'wrap', marginTop:1 }}>
                                            {(sub?.categories||[]).slice(0,3).map(c => <span key={c} style={{ fontSize:8, padding:'1px 4px', borderRadius:3, background:'rgba(255,255,255,0.06)', color:'rgba(255,255,255,0.85)' }}>{c||''}</span>)}
                                      {(sub?.mechanisms||[]).slice(0,4).map(m => <span key={m||''} style={{ fontSize:8, padding:'1px 4px', borderRadius:3, background:'rgba(0,230,138,0.08)', color:'#00e68a' }}>{MECH_LABELS[m] || MECH_TRANSLATIONS_RU[m] || m||''}</span>)}
                                          </div>
                                        </div>
                                        <button onClick={e => { e.stopPropagation(); if (sub?.id && !enhancedSubs.includes(sub.id)) setEnhancedSubs(prev => [...prev, sub.id]); }} style={{ padding:'2px 8px', borderRadius:6, fontSize:9, fontWeight:700, cursor:'pointer', background:'rgba(0,230,138,0.1)', border:'1px solid rgba(0,230,138,0.3)', color:'#00e68a', whiteSpace:'nowrap', flexShrink:0 }}>{enhancedSubs.includes(sub?.id||'') ? '✓' : '+ Мой стек'}</button>
                                        <button onClick={e => { e.stopPropagation(); try { let f:string[]=JSON.parse(localStorage.getItem('he_support_favorites')||'[]');const idx=f.indexOf(sub?.id||'');if(idx>=0)f.splice(idx,1);else f.push(sub?.id||'');localStorage.setItem('he_support_favorites',JSON.stringify(f));setFavRefresh(p=>p+1);}catch{} }} style={{ padding:'2px 6px', borderRadius:6, fontSize:10, cursor:'pointer', background:'transparent', border:'none', color:(()=>{try{return JSON.parse(localStorage.getItem('he_support_favorites')||'[]').includes(sub?.id||'')?'#fbbf24':'var(--text-dim)';}catch{return 'var(--text-dim)';}})() }}>★</button>
                                        <span style={{ fontSize:9, color:'var(--text-dim)', transform:selectedSub === sub?.id ? 'rotate(180deg)' : 'none' }}>▼</span>
                                      </div>
                                      {selectedSub === sub?.id && sub && (
                                        <div style={{ padding:'6px 10px 8px 22px', background:'rgba(0,0,0,0.15)', borderBottom:'1px solid var(--border)' }}>
                                          <div style={{ fontSize:10, color:'rgba(255,255,255,0.9)', lineHeight:1.4, marginBottom:4 }}>{sub.description||''}</div>
                                          <div style={{ fontSize:7, color:'var(--accent-green, #00e68a)', marginBottom:3 }}>
                                            {TYPE_LABELS_RU[sub.type] || sub.type || 'Без категории'}{(sub.categories||[]).length > 0 ? ' · ' + (sub.categories||[]).slice(0,3).join(', ') : ''}
                                          </div>
                                          {(sub.mechanisms||[]).length > 0 && (
                                            <div style={{ marginBottom:3 }}>
                                              <div style={{ fontSize:8, color:'rgba(255,255,255,0.85)', marginBottom:1 }}>Механизмы действия:</div>
                                              <div style={{ display:'flex', gap:2, flexWrap:'wrap' }}>
                                                {(sub.mechanisms||[]).map((m,i) => (
                                                  <span key={i} style={{ fontSize:8, padding:'2px 6px', borderRadius:4, background:'rgba(0,230,138,0.08)', color:'#00e68a', border:'1px solid rgba(0,230,138,0.15)' }}>{MECH_LABELS[m] || MECH_TRANSLATIONS_RU[m] || (m||'')}</span>
                                                ))}
                                              </div>
                                            </div>
                                          )}
                                          {(sub.organs||[]).length > 0 && (
                                            <div style={{ marginBottom:3 }}>
                                              <div style={{ fontSize:8, color:'rgba(255,255,255,0.85)', marginBottom:1 }}>Органы-мишени:</div>
                                              <div style={{ display:'flex', gap:2, flexWrap:'wrap' }}>
                                                 {[...new Set(sub.organs||[])].map(o => <span key={o||''} style={{ fontSize:8, padding:'2px 6px', borderRadius:4, background:'rgba(59,130,246,0.1)', color:'#60a5fa', border:'1px solid rgba(59,130,246,0.15)' }}>{o||''}</span>)}
                                               </div>
                                             </div>
                                           )}
                                           {sub.deficiency && sub.deficiency !== 'NONE' && (
                                             <div style={{ fontSize:9, color:'#f59e0b', marginTop:2 }}>⚠ Дефицит: {sub.deficiency}</div>
                                          )}
                                          {SUPPLEMENT_DESCRIPTIONS[sub.id] && (
                                            <div style={{ marginTop:4, padding:'4px 6px', background:'rgba(0,230,138,0.05)', borderRadius:4, border:'1px solid rgba(0,230,138,0.1)' }}>
                                              <div style={{ fontSize:8, color:'#00e68a', fontWeight:600, marginBottom:1 }}>📋 Подробнее:</div>
                                              <div style={{ fontSize:9, color:'rgba(255,255,255,0.9)', lineHeight:1.4 }}>{SUPPLEMENT_DESCRIPTIONS[sub.id]}</div>
                                            </div>
                                          )}
                                          {(sub as any).forms && (sub as any).forms.length > 0 && (
                                            <div style={{ marginTop:4, padding:'4px 6px', background:'rgba(59,130,246,0.05)', borderRadius:4, border:'1px solid rgba(59,130,246,0.1)' }}>
                                              <div style={{ fontSize:8, color:'#60a5fa', fontWeight:600, marginBottom:2 }}>💊 Формы выпуска:</div>
                                              {((sub as any).forms as any[]).map((f, fi) => (
                                                <div key={fi} style={{ display:'flex', alignItems:'center', gap:4, marginBottom:2 }}>
                                                  <span style={{ fontSize:9, fontWeight: f.best ? 700 : 400, color: f.best ? '#00e68a' : 'rgba(255,255,255,0.85)' }}>{f.best ? '★' : '○'} {f.name}</span>
                                                  <span style={{ fontSize:8, color:'rgba(255,255,255,0.6)' }}>{f.dose}</span>
                                                  {f.best && <span style={{ fontSize:7, padding:'0px 4px', borderRadius:3, background:'rgba(0,230,138,0.1)', color:'#00e68a', border:'1px solid rgba(0,230,138,0.2)' }}>Рекоменд.</span>}
                                                </div>
                                              ))}
                                            </div>
                                          )}
                                          {catDetailInteractions(sub, mergedInteractions)}
                                       {renderCatalogDetail(sub.id || (sub as any)?.id)}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              );
                            })}
                            {/* Remaining items (not in any class sub-group) */}
                            {(() => {
                              const classSubsSet = new Set<string>();
                              for (const clsSubs of Object.values(group.classItems || {})) {
                                for (const s of clsSubs as SupportSubstance[]) { if (s?.id) classSubsSet.add(s.id); }
                              }
                              const remaining = (group.items||[]).filter(sub => sub?.id && !classSubsSet.has(sub.id));
                              if (remaining.length === 0) return null;
                              return remaining.map(sub => (
                                <div key={sub?.id||'x'}>
                                  <div onClick={() => setSelectedSub(selectedSub === sub?.id ? null : (sub?.id||null))} style={{ display:'flex', alignItems:'flex-start', gap:4, padding:'6px 10px 6px 14px', cursor:'pointer', borderBottom:'1px solid var(--border)' }}>
                                    <div style={{ flex:1 }}>
                                      <div style={{ fontSize:10, fontWeight:600, color:'var(--text-light)', lineHeight:1.3 }}>{sub?.name||(sub?.id||'').replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase())}</div>
                                      <div style={{ display:'flex', gap:2, flexWrap:'wrap', marginTop:1 }}>
                                        {(sub?.categories||[]).slice(0,3).map(c => <span key={c} style={{ fontSize:8, padding:'1px 4px', borderRadius:3, background:'rgba(255,255,255,0.06)', color:'rgba(255,255,255,0.85)' }}>{c||''}</span>)}
                                            {(sub?.mechanisms||[]).slice(0,4).map(m => <span key={m||''} style={{ fontSize:8, padding:'1px 4px', borderRadius:3, background:'rgba(0,230,138,0.08)', color:'#00e68a' }}>{MECH_LABELS[m] || MECH_TRANSLATIONS_RU[m] || m||''}</span>)}
                                      </div>
                                    </div>
                                    <button onClick={e => { e.stopPropagation(); if (sub?.id && !enhancedSubs.includes(sub.id)) setEnhancedSubs(prev => [...prev, sub.id]); }} style={{ padding:'2px 8px', borderRadius:6, fontSize:9, fontWeight:700, cursor:'pointer', background:'rgba(0,230,138,0.1)', border:'1px solid rgba(0,230,138,0.3)', color:'#00e68a', whiteSpace:'nowrap', flexShrink:0 }}>{enhancedSubs.includes(sub?.id||'') ? '✓' : '+ Мой стек'}</button>
                                    <button onClick={e => { e.stopPropagation(); try { let f:string[]=JSON.parse(localStorage.getItem('he_support_favorites')||'[]');const idx=f.indexOf(sub?.id||'');if(idx>=0)f.splice(idx,1);else f.push(sub?.id||'');localStorage.setItem('he_support_favorites',JSON.stringify(f));setFavRefresh(p=>p+1);}catch{} }} style={{ padding:'2px 6px', borderRadius:6, fontSize:10, cursor:'pointer', background:'transparent', border:'none', color:(()=>{try{return JSON.parse(localStorage.getItem('he_support_favorites')||'[]').includes(sub?.id||'')?'#fbbf24':'var(--text-dim)';}catch{return 'var(--text-dim)';}})() }}>★</button>
                                    <span style={{ fontSize:9, color:'var(--text-dim)', transform:selectedSub === sub?.id ? 'rotate(180deg)' : 'none' }}>▼</span>
                                  </div>
                                  {selectedSub === sub?.id && sub && (
                                    <div style={{ padding:'6px 10px 8px 14px', background:'rgba(0,0,0,0.15)', borderBottom:'1px solid var(--border)' }}>
                                      <div style={{ fontSize:10, color:'rgba(255,255,255,0.9)', lineHeight:1.4, marginBottom:4 }}>{sub.description||''}</div>
                                      <div style={{ fontSize:7, color:'var(--accent-green, #00e68a)', marginBottom:3 }}>
                                        {TYPE_LABELS_RU[sub.type] || sub.type || 'Без категории'}{(sub.categories||[]).length > 0 ? ' · ' + (sub.categories||[]).slice(0,3).join(', ') : ''}
                                      </div>
                                      {(sub.mechanisms||[]).length > 0 && (
                                        <div style={{ marginBottom:3 }}>
                                          <div style={{ fontSize:8, color:'rgba(255,255,255,0.85)', marginBottom:1 }}>Механизмы действия:</div>
                                          <div style={{ display:'flex', gap:2, flexWrap:'wrap' }}>
                                            {(sub.mechanisms||[]).map((m,i) => (
                                              <span key={i} style={{ fontSize:8, padding:'2px 6px', borderRadius:4, background:'rgba(0,230,138,0.08)', color:'#00e68a', border:'1px solid rgba(0,230,138,0.15)' }}>{(m||'')}</span>
                                            ))}
                                          </div>
                                        </div>
                                      )}
{(sub.organs||[]).length > 0 && (
                                         <div style={{ marginBottom:3 }}>
                                           <div style={{ fontSize:8, color:'rgba(255,255,255,0.85)', marginBottom:1 }}>Органы-мишени:</div>
                                           <div style={{ display:'flex', gap:2, flexWrap:'wrap' }}>
                                             {[...new Set(sub.organs||[])].map(o => <span key={o||''} style={{ fontSize:8, padding:'2px 6px', borderRadius:4, background:'rgba(59,130,246,0.1)', color:'#60a5fa', border:'1px solid rgba(59,130,246,0.15)' }}>{o||''}</span>)}
                                           </div>
                                         </div>
                                       )}
                                       {sub.deficiency && sub.deficiency !== 'NONE' && (
                                         <div style={{ fontSize:9, color:'#f59e0b', marginTop:2 }}>⚠ Дефицит: {sub.deficiency}</div>
                                       )}
                                       {SUPPLEMENT_DESCRIPTIONS[sub.id] && (
                                        <div style={{ marginTop:4, padding:'4px 6px', background:'rgba(0,230,138,0.05)', borderRadius:4, border:'1px solid rgba(0,230,138,0.1)' }}>
                                          <div style={{ fontSize:8, color:'#00e68a', fontWeight:600, marginBottom:1 }}>📋 Подробнее:</div>
                                          <div style={{ fontSize:9, color:'rgba(255,255,255,0.9)', lineHeight:1.4 }}>{SUPPLEMENT_DESCRIPTIONS[sub.id]}</div>
                                        </div>
                                      )}
                                      {(sub as any).forms && (sub as any).forms.length > 0 && (
                                        <div style={{ marginTop:4, padding:'4px 6px', background:'rgba(59,130,246,0.05)', borderRadius:4, border:'1px solid rgba(59,130,246,0.1)' }}>
                                          <div style={{ fontSize:8, color:'#60a5fa', fontWeight:600, marginBottom:2 }}>💊 Формы выпуска:</div>
                                          {((sub as any).forms as any[]).map((f, fi) => (
                                            <div key={fi} style={{ display:'flex', alignItems:'center', gap:4, marginBottom:2 }}>
                                              <span style={{ fontSize:9, fontWeight: f.best ? 700 : 400, color: f.best ? '#00e68a' : 'rgba(255,255,255,0.85)' }}>{f.best ? '★' : '○'} {f.name}</span>
                                              <span style={{ fontSize:8, color:'rgba(255,255,255,0.6)' }}>{f.dose}</span>
                                              {f.best && <span style={{ fontSize:7, padding:'0px 4px', borderRadius:3, background:'rgba(0,230,138,0.1)', color:'#00e68a', border:'1px solid rgba(0,230,138,0.2)' }}>Рекоменд.</span>}
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                      {catDetailInteractions(sub, mergedInteractions)}
                                       {renderCatalogDetail(sub.id || (sub as any)?.id)}
                                    </div>
                                  )}
                                </div>
                              ));
                            })()}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {(groupedSubstances||[]).length === 0 && <div style={{ padding:20, textAlign:'center', color:'var(--text-dim)', fontSize:11 }}>Ничего не найдено</div>}
                </div>
                )}
              </div>
            )}
            {renderView(infoView, 'synergies', () =>
              <div>
                {/* Type sub-tabs */}
                <div style={{ display:'flex', gap:4, marginBottom:6, overflowX:'auto', scrollbarWidth:'none', flexWrap:'wrap' }}>
                  {(['all','synergies','conflicts','cautions','calculator'] as const).map(st => (
                    <button key={st} onClick={() => { setSynergySubTab(st); setSynergyPage(1); }} style={{
                      padding:'6px 12px', borderRadius:16, fontSize:9, fontWeight:700, whiteSpace:'nowrap', cursor:'pointer', flexShrink:0,
                      background: synergySubTab === st ? 'var(--accent)' : 'var(--bg-secondary)',
                      color: synergySubTab === st ? '#000' : 'var(--text-dim)',
                      border: `1px solid ${synergySubTab === st ? 'var(--accent)' : 'var(--border)'}`,
                    }}>{st === 'all' ? '♾️ Все' : st === 'synergies' ? '🤝 Синергии' : st === 'conflicts' ? '🔴 Конфликты' : st === 'cautions' ? '🟡 Осторожности' : '🧮 Калькулятор'}</button>
                  ))}
                </div>

                {synergySubTab === 'calculator' ? (
                  /* ─── КАЛЬКУЛЯТОР ВЗАИМОДЕЙСТВИЙ ─── */
                  <div>
                    <div style={{ display:'flex', gap:4, marginBottom:8 }}>
                      {(['support','pharma'] as const).map(t => (
                        <button key={t} onClick={() => setInteractTab(t)} style={{
                          flex:1, padding:'7px 0', borderRadius:8, fontSize:10, fontWeight:700, cursor:'pointer', transition:'all 0.15s',
                          background: interactTab === t ? 'var(--accent)' : 'var(--bg-secondary)',
                          color: interactTab === t ? '#000' : 'var(--text-dim)', border: 'none',
                        }}>{t === 'support' ? '💊 Поддержка' : '💉 Фарма'}</button>
                      ))}
                    </div>
                    {interactTab === 'support' ? (
                      <div>
                        <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:8 }}>
                          {interactionIds.map((id, idx) => {
                            const selectedName = id ? (allSupport.find(s => s.id === id)?.name || id) : '';
                            return (
                              <div key={idx} style={{ background:'var(--bg-secondary)', borderRadius:10, padding:'8px 10px', border:'1px solid var(--border)' }}>
                                <div style={{ display:'flex', alignItems:'center', gap:4, marginBottom:4 }}>
                                  <span style={{ fontSize:8, color:'var(--text-dim)', fontWeight:600, background:'rgba(255,255,255,0.04)', padding:'1px 5px', borderRadius:3 }}>#{idx+1}</span>
                                  <span style={{ flex:1, fontSize:9, color:'var(--text-dim)' }}>{id ? selectedName : 'Препарат'}</span>
                                  {id && <button onClick={() => { updateInteraction(idx, ''); setInteractionSearch(''); }} style={{ padding:'2px 6px', borderRadius:4, fontSize:8, cursor:'pointer', background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.2)', color:'#ef4444' }}>✕</button>}
                                </div>
                                <div style={{ position:'relative' }}>
                                  {id ? (
                                    <div style={{ padding:'7px 8px', borderRadius:6, background:'rgba(0,230,138,0.06)', border:'1px solid rgba(0,230,138,0.15)', color:'#00e68a', fontSize:10, fontWeight:600 }}>{selectedName}</div>
                                  ) : (
                                    <>
                                      <input value={interactionSearchIdx===idx ? interactionSearch : ''} placeholder="🔍 Введите название..." onFocus={() => { setInteractionSearchIdx(idx); setInteractionSearch(''); }} onChange={e => { setInteractionSearchIdx(idx); setInteractionSearch(e.target.value); }} style={{ width:'100%', padding:'7px 8px', borderRadius:6, background:'rgba(0,0,0,0.2)', border:'1px solid var(--border)', color:'var(--text)', fontSize:10, boxSizing:'border-box' }} />
                                      {interactionSearch && interactionSearchIdx===idx && (
                                        <div style={{ position:'absolute', top:'100%', left:0, right:0, zIndex:10, background:'var(--bg)', border:'1px solid var(--border)', borderRadius:6, maxHeight:150, overflowY:'auto', marginTop:1 }}>
                                          {allSupport.filter(s => (s.name||'').toLowerCase().includes(interactionSearch.toLowerCase())).slice(0,10).map(s => (
                                            <div key={s.id} onClick={() => { updateInteraction(idx, s.id); setInteractionSearch(''); setInteractionSearchIdx(-1); }} style={{ padding:'7px 10px', cursor:'pointer', fontSize:10, borderBottom:'1px solid var(--border)' }}>
                                              <span style={{ fontWeight:600, color:'var(--text)' }}>{s.name}</span>
                                              <span style={{ fontSize:8, color:'var(--text-dim)', marginLeft:4 }}>{s.id}</span>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                          <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:4 }}>
                            <button onClick={addInteraction} disabled={maxInteractionsReached} style={{ flex:1, padding:'8px', borderRadius:8, fontSize:10, fontWeight:600, cursor: maxInteractionsReached ? 'not-allowed' : 'pointer', background:'rgba(0,230,138,0.06)', border:'1px dashed rgba(0,230,138,0.3)', color: maxInteractionsReached ? '#666' : '#00e68a', opacity: maxInteractionsReached ? 0.5 : 1 }}>+ ДОБАВИТЬ ПРЕПАРАТ</button>
                            <span style={{ fontSize:9, color:'var(--text-dim)' }}>{interactionIds.length}/10</span>
                          </div>
                        </div>
                        {validInteractionIds.length<2 && <div style={{ textAlign:'center', padding:'20px 12px', background:'var(--bg-secondary)', borderRadius:10, border:'1px solid var(--border)' }}><div style={{ fontSize:20, marginBottom:4 }}>⚡</div><div style={{ fontSize:10, color:'var(--text-dim)' }}>Выберите минимум 2 препарата</div></div>}
                        {validInteractionIds.length>=2 && !hasSupportInteractions && <div style={{ textAlign:'center', padding:'10px', borderRadius:8, background:'rgba(0,230,138,0.06)', border:'1px solid rgba(0,230,138,0.2)' }}><span style={{ fontSize:10, color:'#4caf50', fontWeight:600 }}>✓ Конфликтов не обнаружено</span></div>}
                        {hasSupportInteractions && (
                          <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                            {[
                              { list: supportSynergiesList, label:'⊕ Синергия', color:'#22c55e' },
                              { list: supportConflicts, label:'⊖ Конфликт', color:'#ef4444' },
                              { list: supportCautions, label:'⚡ Осторожность', color:'#f59e0b' },
                            ].filter(s => s.list.length>0).map(section => (
                              <div key={section.label} style={{ background:'var(--bg-secondary)', borderRadius:10, padding:'8px 10px', border:'1px solid var(--border)' }}>
                                <div style={{ fontSize:10, fontWeight:700, color:section.color, marginBottom:4 }}>{section.label} ({section.list.length})</div>
                                {section.list.map(i => {
                                  const sevColor = i.severity === 'HIGH' ? '#ef4444' : i.severity === 'MEDIUM' ? '#f59e0b' : '#22c55e';
                                  const aName = resolveSubName(i.substanceA) || i.substanceA;
                                  const bName = resolveSubName(i.substanceB) || i.substanceB;
                                  return (
                                     <div key={i.interactionId} style={{ padding:'5px 0', borderBottom:'1px solid var(--border)' }}>
                                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                                        <span style={{ color:section.color, fontWeight:700, fontSize:9 }}>{aName} + {bName}</span>
                                        <div style={{ display:'flex', gap:3 }}>
                                          <span style={{ fontSize:7, padding:'1px 4px', borderRadius:3, background:section.color+'22', color:section.color, fontWeight:600 }}>{i.type === 'synergy' ? '⊕ Синергия' : i.type === 'conflict' ? '⊖ Конфликт' : '⚡ Осторожно'}</span>
                                          {i.severity && <span style={{ fontSize:7, padding:'1px 4px', borderRadius:3, background:sevColor+'22', color:sevColor }}>{i.severity==='HIGH'?'Высокий':i.severity==='MEDIUM'?'Средний':'Низкий'}</span>}
                                        </div>
                                      </div>
                                      <div style={{ fontSize:9, color:'rgba(255,255,255,0.85)', lineHeight:1.3, marginTop:2 }}>{showEffect(i)}</div>
                                      {i.mechanisms && i.mechanisms.length > 0 && (
                                        <div style={{ display:'flex', flexWrap:'wrap', gap:2, marginTop:2 }}>
                                          {i.mechanisms.map((m: string, mi: number) => (
                                            <span key={mi} style={{ fontSize:6, padding:'1px 5px', borderRadius:3, background:'rgba(139,92,246,0.12)', color:'#a78bfa', border:'1px solid rgba(139,92,246,0.15)' }}>{MECH_LABELS[m] || MECH_TRANSLATIONS_RU[m] || m}</span>
                                          ))}
                                        </div>
                                      )}
                                      {i.notes && <div style={{ fontSize:8, color:'var(--text-dim)', fontStyle:'italic', lineHeight:1.2, marginTop:1 }}>{i.notes}</div>}
                                    </div>
                                  );
                                })}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      /* ─── ФАРМА-ВЗАИМОДЕЙСТВИЯ ─── */
                      <div>
                        <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:8 }}>
                          {pharmaInteractIds.map((id, idx) => {
                            const pharmaEntry = id ? PHARMA_DB[id] : null;
                            const selectedName = pharmaEntry?.name || '';
                            return (
                              <div key={idx} style={{ background:'var(--bg-secondary)', borderRadius:10, padding:'8px 10px', border:'1px solid var(--border)' }}>
                                <div style={{ display:'flex', alignItems:'center', gap:4, marginBottom:4 }}>
                                  <span style={{ fontSize:8, color:'var(--text-dim)', fontWeight:600, background:'rgba(255,255,255,0.04)', padding:'1px 5px', borderRadius:3 }}>#{idx+1}</span>
                                  <span style={{ flex:1, fontSize:9, color:'var(--text-dim)' }}>{id ? selectedName : 'Препарат'}</span>
                                  {id && <button onClick={() => { const next = [...pharmaInteractIds]; next[idx] = ''; setPharmaInteractIds(next); }} style={{ padding:'2px 6px', borderRadius:4, fontSize:8, cursor:'pointer', background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.2)', color:'#ef4444' }}>✕</button>}
                                </div>
                                <div style={{ position:'relative' }}>
                                  {id ? (
                                    <div style={{ padding:'7px 8px', borderRadius:6, background:'rgba(59,130,246,0.06)', border:'1px solid rgba(59,130,246,0.15)', color:'#60a5fa', fontSize:10, fontWeight:600 }}>{selectedName} ({id})</div>
                                  ) : (
                                    <>
                                      <input value={pharmaInteractSearch} placeholder="🔍 Введите название препарата..." onChange={e => setPharmaInteractSearch(e.target.value)} style={{ width:'100%', padding:'7px 8px', borderRadius:6, background:'rgba(0,0,0,0.2)', border:'1px solid var(--border)', color:'var(--text)', fontSize:10, boxSizing:'border-box' }} />
                                      {pharmaInteractSearch && (
                                        <div style={{ position:'absolute', top:'100%', left:0, right:0, zIndex:10, background:'var(--bg)', border:'1px solid var(--border)', borderRadius:6, maxHeight:150, overflowY:'auto', marginTop:1 }}>
                                          {Object.entries(PHARMA_DB)
                                            .filter(([key, val]) => (val.name||'').toLowerCase().includes(pharmaInteractSearch.toLowerCase()) || key.toLowerCase().includes(pharmaInteractSearch.toLowerCase()))
                                            .slice(0, 10).map(([key, val]) => (
                                            <div key={key} onClick={() => { const next = [...pharmaInteractIds]; next[idx] = key; setPharmaInteractIds(next); setPharmaInteractSearch(''); }} style={{ padding:'7px 10px', cursor:'pointer', fontSize:10, borderBottom:'1px solid var(--border)' }}>
                                              <span style={{ fontWeight:600, color:'var(--text)' }}>{val.name}</span>
                                              <span style={{ fontSize:8, color:'var(--text-dim)', marginLeft:4 }}>{key}</span>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                          <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:4 }}>
                            <button onClick={() => setPharmaInteractIds(prev => prev.length < 10 ? [...prev, ''] : prev)} disabled={pharmaInteractIds.length >= 10} style={{ flex:1, padding:'8px', borderRadius:8, fontSize:10, fontWeight:600, cursor: pharmaInteractIds.length >= 10 ? 'not-allowed' : 'pointer', background:'rgba(59,130,246,0.06)', border:'1px dashed rgba(59,130,246,0.3)', color: pharmaInteractIds.length >= 10 ? '#666' : '#60a5fa', opacity: pharmaInteractIds.length >= 10 ? 0.5 : 1 }}>+ ДОБАВИТЬ ПРЕПАРАТ</button>
                            <span style={{ fontSize:9, color:'var(--text-dim)' }}>{pharmaInteractIds.length}/10</span>
                          </div>
                        </div>
                        {(() => {
                          const validIds = pharmaInteractIds.filter(Boolean);
                          if (validIds.length < 2) {
                            return <div style={{ textAlign:'center', padding:'20px 12px', background:'var(--bg-secondary)', borderRadius:10, border:'1px solid var(--border)' }}><div style={{ fontSize:20, marginBottom:4 }}>💉</div><div style={{ fontSize:10, color:'var(--text-dim)' }}>Выберите минимум 2 препарата</div></div>;
                          }
                          try {
                            // Search mergedInteractions for pharma-related pairs
                            const pharmaInteractions = mergedInteractions.filter((i: any) => {
                              const aInPharma = validIds.some(id => 
                                id.toLowerCase() === (i.substanceA||'').toLowerCase() || 
                                id.toLowerCase() === (i.substanceB||'').toLowerCase()
                              );
                              const bInPharma = validIds.some(id => 
                                id.toLowerCase() === (i.substanceB||'').toLowerCase() || 
                                id.toLowerCase() === (i.substanceA||'').toLowerCase()
                              );
                              return aInPharma && bInPharma && aInPharma !== bInPharma;
                            });
                            // Also check hardcoded pharma interactions
                            const course = validIds.map((sid, i) => ({
                              id: `pharma_int_${i}`,
                              substanceId: sid,
                              doseValue: 100,
                              doseUnit: 'мг/нед',
                              frequency: '1x/day',
                              startWeek: 0,
                              endWeek: 12,
                            }));
                            const alerts = checkDrugInteractions(course);
                            const totalFound = pharmaInteractions.length + alerts.length;
                            if (totalFound === 0) {
                              return <div style={{ textAlign:'center', padding:'10px', borderRadius:8, background:'rgba(0,230,138,0.06)', border:'1px solid rgba(0,230,138,0.2)' }}><span style={{ fontSize:10, color:'#4caf50', fontWeight:600 }}>✓ Конфликтов не обнаружено</span></div>;
                            }
                            return (
                              <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                                {/* Merged interactions results */}
                                {pharmaInteractions.map((i: any) => {
                                  const typeInfo = INTERACTION_TYPE_LABELS[i.type] || { label:i.type, emoji:'🔗', color:'#888' };
                                  const sevInfo = INTERACTION_SEVERITY_LABELS[i.severity] || { label:i.severity, color:'#888' };
                                  const aName = resolveSubName(i.substanceA) || i.substanceA;
                                  const bName = resolveSubName(i.substanceB) || i.substanceB;
                                  return (
                                    <div key={i.interactionId} style={{ background:'var(--bg-secondary)', borderRadius:10, padding:'8px 10px', border:`1px solid ${typeInfo.color}33` }}>
                                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:2 }}>
                                        <div style={{ display:'flex', alignItems:'center', gap:4, flexWrap:'wrap', flex:1 }}>
                                          <span style={{ fontWeight:600, fontSize:10, color:'var(--text-light)' }}>{aName}</span>
                                          <span style={{ fontSize:10, color:typeInfo.color, fontWeight:700 }}>{i.type === 'synergy' ? '+' : '×'}</span>
                                          <span style={{ fontWeight:600, fontSize:10, color:'var(--text-light)' }}>{bName}</span>
                                        </div>
                                        <div style={{ display:'flex', gap:3 }}>
                                          <span style={{ fontSize:7, padding:'1px 4px', borderRadius:3, background:typeInfo.color+'22', color:typeInfo.color, fontWeight:600 }}>{typeInfo.label}</span>
                                          <span style={{ fontSize:7, padding:'1px 4px', borderRadius:3, background:sevInfo.color+'22', color:sevInfo.color }}>{sevInfo.label}</span>
                                        </div>
                                      </div>
                                      <div style={{ fontSize:9, color:'rgba(255,255,255,0.85)', lineHeight:1.3, marginTop:1 }}>{showEffect(i)}</div>
                                      {i.mechanisms && i.mechanisms.length > 0 && (
                                        <div style={{ display:'flex', flexWrap:'wrap', gap:2, marginTop:2 }}>
                                          {i.mechanisms.map((m: string, mi: number) => (
                                            <span key={mi} style={{ fontSize:6, padding:'1px 5px', borderRadius:3, background:'rgba(139,92,246,0.12)', color:'#a78bfa', border:'1px solid rgba(139,92,246,0.15)' }}>{MECH_LABELS[m] || MECH_TRANSLATIONS_RU[m] || m}</span>
                                          ))}
                                        </div>
                                      )}
                                      {i.notes && <div style={{ fontSize:8, color:'var(--text-dim)', fontStyle:'italic', lineHeight:1.2, marginTop:1 }}>{i.notes}</div>}
                                    </div>
                                  );
                                })}
                                {/* Hardcoded pharma alerts */}
                                {alerts.map((alert, ai) => {
                                  const color = alert.type === 'critical' ? '#ef4444' : alert.type === 'warning' ? '#f59e0b' : '#60a5fa';
                                  return (
                                    <div key={`alert_${ai}`} style={{ background:'var(--bg-secondary)', borderRadius:10, padding:'8px 10px', border:`1px solid ${color}33` }}>
                                      <div style={{ display:'flex', alignItems:'center', gap:4, marginBottom:2 }}>
                                        <span style={{ fontSize:10, fontWeight:700, color }}>{alert.type === 'critical' ? '🔴' : alert.type === 'warning' ? '🟡' : '🔵'}</span>
                                        <span style={{ fontSize:9, padding:'1px 5px', borderRadius:3, background:color+'22', color, fontWeight:600 }}>
                                          {alert.type === 'critical' ? 'Критично' : alert.type === 'warning' ? 'Предупреждение' : 'Инфо'}
                                        </span>
                                        <span style={{ fontSize:8, color:'var(--text-dim)' }}>{(alert.drugs||[]).map(d => resolveSubName(d)).join(', ')}</span>
                                      </div>
                                      <div style={{ fontSize:9, color:'rgba(255,255,255,0.9)', lineHeight:1.3, marginTop:1 }}>{alert.mechanism}</div>
                                      <div style={{ fontSize:8, color:'#f59e0b', lineHeight:1.3, marginTop:2, background:'rgba(245,158,11,0.06)', padding:'3px 6px', borderRadius:4 }}>💊 {alert.recommendation}</div>
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          } catch (e) {
                            return <div style={{ textAlign:'center', padding:'10px', borderRadius:8, background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.2)' }}><span style={{ fontSize:9, color:'#ef4444' }}>Ошибка: {String(e)}</span></div>;
                          }
                        })()}
                      </div>
                    )}
                  </div>
                ) : (
                  /* ─── СИНЕРГИИ/КОНФЛИКТЫ/ОСТОРОЖНОСТИ ─── */
                  <>
                    {/* Search bar BELOW sub-tabs */}
                    <div style={{ marginBottom:6 }}>
                      <input value={synergySearch} onChange={e => setSynergySearch(e.target.value)} placeholder="🔍 Поиск по веществу/эффекту..." style={{ width:'100%', padding:'7px 10px', borderRadius:8, border:'1px solid var(--border)', background:'var(--bg-secondary)', color:'var(--text)', fontSize:10, boxSizing:'border-box' }} />
                    </div>
                    {/* Count filter */}
                    <div style={{ display:'flex', gap:4, marginBottom:6, overflowX:'auto', scrollbarWidth:'none', flexWrap:'wrap' }}>
                      {[{v:0,l:'Все'},{v:2,l:'2 в-ва'},{v:3,l:'3+ в-ва'},{v:5,l:'5+ в-в'}].map(opt => (
                        <button key={opt.v} onClick={() => setSynergyCountFilter(opt.v)} style={{
                          padding:'3px 8px', borderRadius:8, fontSize:8, fontWeight:600, whiteSpace:'nowrap', cursor:'pointer',
                          background: synergyCountFilter === opt.v ? 'var(--accent)' : 'transparent',
                          color: synergyCountFilter === opt.v ? '#000' : 'var(--text-dim)',
                          border: `1px solid ${synergyCountFilter === opt.v ? 'var(--accent)' : 'var(--border)'}`,
                        }}>{opt.l}</button>
                      ))}
                    </div>
                    {/* Severity filter */}
                    <div style={{ display:'flex', gap:4, marginBottom:8, overflowX:'auto', scrollbarWidth:'none', flexWrap:'wrap' }}>
                      {(['all','LOW','MEDIUM','HIGH'] as const).map(s => (
                        <button key={s} onClick={() => { setInfoSynergySeverity(s); setSynergyPage(1); }} style={{
                          padding:'4px 8px', borderRadius:10, fontSize:8, fontWeight:600, whiteSpace:'nowrap', cursor:'pointer', flexShrink:0,
                          background: infoSynergySeverity === s ? (INTERACTION_SEVERITY_LABELS[s]?.color || 'var(--accent)') : 'transparent',
                          color: infoSynergySeverity === s ? '#000' : 'var(--text-dim)',
                          border: `1px solid ${infoSynergySeverity === s ? (INTERACTION_SEVERITY_LABELS[s]?.color || 'var(--accent)') : 'var(--border)'}`,
                        }}>{s === 'all' ? '♾️ Все' : `${INTERACTION_SEVERITY_LABELS[s]?.label||s}`}</button>
                      ))}
                    </div>
                    {/* Organ filter */}
                    <div style={{ display:'flex', gap:4, marginBottom:6, overflowX:'auto', scrollbarWidth:'none', flexWrap:'wrap' }}>
                      {[['','♾️ Все'],['heart_vessels','❤️ Сердце'],['liver','🫁 Печень'],['kidneys','🫘 Почки'],['brain_nerves','🧠 Нервы'],['joints_bones','🦴 Суставы'],['immune','🛡️ Иммунитет'],['gi','🫃 ЖКТ'],['endocrine','🦋 Эндокринная'],['skin_hair','✨ Кожа'],['eyes','👁️ Глаза'],['reproductive','🧬 Репродуктивная'],['blood','🩸 Кровь'],['lungs','🫁 Лёгкие'],['muscles','💪 Мышцы'],['mitochondria','⚡ Энергия']].map(([key, label]) => (
                        <button key={key} onClick={() => setSynergyOrganFilter(key)} style={{
                          padding:'3px 8px', borderRadius:8, fontSize:7, fontWeight:600, whiteSpace:'nowrap', cursor:'pointer',
                          background: synergyOrganFilter === key ? 'var(--accent)' : 'transparent',
                          color: synergyOrganFilter === key ? '#000' : 'var(--text-dim)',
                          border: `1px solid ${synergyOrganFilter === key ? 'var(--accent)' : 'var(--border)'}`,
                        }}>{label}</button>
                      ))}
                    </div>
                    {/* Mechanism filter */}
                    <div style={{ display:'flex', gap:4, marginBottom:6, overflowX:'auto', scrollbarWidth:'none', flexWrap:'wrap' }}>
                      {(() => {
                        const allMechs = new Set<string>();
                        mergedInteractions.forEach((i: any) => (i.mechanisms||[]).forEach((m: string) => allMechs.add(m)));
                        const topMechs = [...allMechs].filter(m => {
                          let count = 0;
                          mergedInteractions.forEach((i: any) => { if ((i.mechanisms||[]).includes(m)) count++; });
                          return count > 15 && m.length < 30;
                        }).sort().slice(0, 20);
                        return [['','Все'], ...topMechs.map(m => [m, MECH_LABELS[m] || MECH_TRANSLATIONS_RU[m] || m])].map(([val, label]) => (
                          <button key={val as string} onClick={() => setSynergyMechFilter(val as string)} style={{
                            padding:'3px 8px', borderRadius:8, fontSize:7, fontWeight:600, whiteSpace:'nowrap', cursor:'pointer',
                            background: synergyMechFilter === val ? 'var(--accent)' : 'transparent',
                            color: synergyMechFilter === val ? '#000' : 'var(--text-dim)',
                            border: `1px solid ${synergyMechFilter === val ? 'var(--accent)' : 'var(--border)'}`,
                          }}>{label as string}</button>
                        ));
                      })()}
                    </div>
                     <div style={{ maxHeight:'calc(70vh)', overflowY:'auto', paddingRight:4 }}>{synergiesContent(
                        (() => {
                          let list = infoSynergySeverity === 'all' ? mergedInteractions : mergedInteractions.filter((i: any) => i.severity === infoSynergySeverity);
                         if (synergySubTab !== 'all') {
                           const typeMap: Record<string, string> = { synergies: 'synergy', conflicts: 'conflict', cautions: 'caution' };
                           list = list.filter((i: any) => i.type === typeMap[synergySubTab]);
                         }
                            if (synergyCountFilter > 0) {
                              list = list.filter((i: any) => {
                                let count = 0;
                                if (i.substanceA) count++;
                                if (i.substanceB) count++;
                                return count >= synergyCountFilter;
                              });
                            }
                           if (synergyOrganFilter) {
                             list = list.filter((i: any) => {
                               const checkOrg = (subId: string) => {
                                 const sub = ALL_SUBSTANCES.find(s => s.id === subId);
                                 if (!sub || !sub.organs) return false;
                                 return sub.organs.some(o => {
                                   const norm = (o||'').trim().toUpperCase();
                                   const mapping = ORGAN_CATEGORY_MAP[norm];
                                   return mapping?.key === synergyOrganFilter;
                                 });
                               };
                               return checkOrg(i.substanceA) || checkOrg(i.substanceB);
                             });
                           }
                           if (synergyMechFilter) {
                             list = list.filter((i: any) => (i.mechanisms||[]).includes(synergyMechFilter));
                           }
                           if (synergySearch) {
                             const sq = synergySearch.toLowerCase();
                             list = list.filter((i: any) => (i.effect||'').toLowerCase().includes(sq) || (i.substanceA||'').toLowerCase().includes(sq) || (i.substanceB||'').toLowerCase().includes(sq) || (i.notes||'').toLowerCase().includes(sq));
                          }
                          return list;
                       })(), mergedInteractions, expandedCategories, synergySubTab)}</div>
                  </>
                )}
              </div>
            )}
            {renderView(infoView, 'stacks', () =>
              <div>
                <input value={stackSearch} onChange={e => setStackSearch(e.target.value)} placeholder="🔍 Поиск по эффекту или веществу..." style={{ width:'100%', padding:'8px 10px', borderRadius:8, border:'1px solid var(--border)', background:'var(--bg-secondary)', color:'var(--text)', fontSize:11, boxSizing:'border-box', marginBottom:8 }} />
                <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                  {(stackSearch ? [{ key:'search', label:`Результаты (${filteredStacks.length})`, stacks:filteredStacks }] : groupedStacks).map(group => (
                    <div key={group.key} style={{ background:'var(--bg-secondary)', borderRadius:10, overflow:'hidden', border:'1px solid var(--border)' }}>
                      <div onClick={() => setExpandedCategories(prev => ({ ...prev, ['stack_'+group.key]: !(prev['stack_'+group.key] ?? true) }))} style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 10px', cursor:'pointer', userSelect:'none' }}>
                        <span style={{ fontSize:13 }}>📋</span>
                        <div style={{ flex:1, fontSize:10, fontWeight:700, color:'var(--text-light)' }}>{group.label}</div>
                        <span style={{ fontSize:9, color:'var(--text-dim)', fontWeight:600, marginRight:2 }}>{group.stacks.length}</span>
                        <span style={{ fontSize:9, color:'var(--text-dim)', transform:expandedCategories['stack_'+group.key] !== false ? 'rotate(180deg)' : 'none', transition:'transform 0.2s' }}>▼</span>
                      </div>
                      {expandedCategories['stack_'+group.key] !== false && (
                        <div style={{ borderTop:'1px solid var(--border)' }}>
                          {group.stacks.map(stack => {
                            const synergyColor = stack.synergyScore > 20 ? '#22c55e' : stack.synergyScore > 12 ? '#eab308' : '#f59e0b';
                            return (
                              <div key={stack.id} style={{ padding:'6px 10px 8px', borderBottom:'1px solid var(--border)', cursor:'pointer' }}
                                onClick={() => setExpandedMed(expandedMed === stack.id ? null : stack.id)}>
                                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:3 }}>
                                  <div style={{ display:'flex', flexWrap:'wrap', gap:2, flex:1 }}>
                                    {stack.effects.map(e => <span key={e} style={{ fontSize:7, padding:'1px 5px', borderRadius:3, background:'rgba(0,230,138,0.08)', color:'#00e68a', fontWeight:500 }}>{EFFECT_LABELS_ru[e]||e}</span>)}
                                  </div>
                                  <span style={{ fontSize:11, fontWeight:800, color:synergyColor, marginLeft:4 }}>{(stack.synergyScore||0).toFixed(1)}</span>
                                </div>
                                <div style={{ display:'flex', flexWrap:'wrap', gap:2, marginBottom:expandedMed === stack.id ? 4 : 0 }}>
                                  {stack.substances.map(sid => <span key={sid} style={{ fontSize:8, padding:'1px 6px', borderRadius:6, background:'rgba(139,92,246,0.08)', border:'1px solid rgba(139,92,246,0.12)', color:'#a78bfa', fontWeight:600 }}>{getStackSubLabel(sid)}<button onClick={(e) => { e.stopPropagation(); setStackBuilder(prev => prev.includes(sid) ? prev : [...prev, sid]); }} style={{ padding:'3px 8px', borderRadius:4, fontSize:9, cursor:'pointer', background:'rgba(0,230,138,0.1)', border:'none', color:'#00e68a', fontWeight:700, marginLeft:2, minWidth:22 }} title="Добавить в стек">+</button></span>)}
                                </div>
                                <div style={{ fontSize:7, color:'var(--text-dim)' }}>{stack.substances.length} веществ</div>
                                {expandedMed === stack.id && safeRender('stack_'+stack.id, () =>
                                  <div style={{ marginTop:4, padding:'6px 8px', background:'rgba(0,0,0,0.15)', borderRadius:8 }}>
                                    {/* Positive effects */}
                                    <div style={{ marginBottom:4 }}>
                                      <div style={{ fontSize:8, fontWeight:700, color:'#22c55e', marginBottom:3 }}>⊕ Положительные эффекты</div>
                                      <div style={{ display:'flex', flexWrap:'wrap', gap:2 }}>
                                        {stack.effects.map(e => (
                                          <span key={e} style={{ fontSize:7, padding:'2px 6px', borderRadius:4, background:'rgba(34,197,94,0.1)', color:'#4ade80', fontWeight:600 }}>
                                            {EFFECT_LABELS_ru[e] || e}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                    {/* Substance breakdown */}
                                    <div style={{ marginBottom:4 }}>
                                      <div style={{ fontSize:8, fontWeight:700, color:'var(--text-light)', marginBottom:2 }}>🧬 Компоненты</div>
                                      {stack.substances.map(sid => {
                                        const subInfo = ALL_SUBSTANCES.find(s => s.id === sid);
                                        const cat = subInfo?.categories?.[0];
                                        return (
                                          <div key={sid} style={{ fontSize:7, color:'var(--text-dim)', padding:'2px 0', borderBottom:'1px solid rgba(255,255,255,0.04)', lineHeight:1.4 }}>
                                            <b style={{ color:'#a78bfa' }}>{getStackSubLabel(sid)}</b>
                                            {cat && <span style={{ marginLeft:4, opacity:0.6 }}>· {getCategoryInfo(cat).label}</span>}
                                            {subInfo?.description && <div style={{ opacity:0.7 }}>{subInfo.description}</div>}
                                          </div>
                                        );
                                      })}
                                    </div>
                                    {/* Potential conflicts warning */}
                                    {(() => {
                                      const pairs: string[] = [];
                                      for (let a = 0; a < (stack.substances||[]).length; a++) {
                                        for (let b = a + 1; b < (stack.substances||[]).length; b++) {
                                          const key = `${stack.substances[a]||''}||${stack.substances[b]||''}`;
                                          const found = conflictLookup.get(key);
                                          if (found && found.type !== 'synergy') pairs.push(`${getStackSubLabel(stack.substances[a])} + ${getStackSubLabel(stack.substances[b])}: ${found.effect} (${found.severity})`);
                                        }
                                      }
                                      return pairs.length > 0 ? (
                                        <div>
                                          <div style={{ fontSize:8, fontWeight:700, color:'#ef4444', marginBottom:2 }}>⚠ Возможные конфликты</div>
                                          {pairs.map((p, i) => <div key={i} style={{ fontSize:7, color:'#f87171', padding:'1px 0', lineHeight:1.3 }}>{p}</div>)}
                                        </div>
                                      ) : (
                                        <div style={{ fontSize:7, color:'#4ade80', opacity:0.6 }}>✓ Конфликтов между компонентами не обнаружено</div>
                                      );
                                    })()}
                                    {/* Stack mechanisms & synergies */}
                                    {(()=>{
                                      const d=stackDetailMap.get(stack.id);
                                      if(!d)return null;
                                      return <>
                                        {d.mechs.length>0&&<div style={{marginTop:3}}><div style={{fontSize:7,fontWeight:600,color:'var(--text-dim)',marginBottom:1}}>⚙️ Механизмы действия:</div><div style={{display:'flex',flexWrap:'wrap',gap:2}}>{d.mechs.map((m,i)=><span key={i} style={{fontSize:6,padding:'1px 4px',borderRadius:3,background:'rgba(139,92,246,0.08)',color:'#a78bfa',border:'1px solid rgba(139,92,246,0.12)'}}>{MECH_TRANSLATIONS_RU[m as string] || m}</span>)}</div></div>}
                                        {d.synergies.length>0&&<div style={{marginTop:3}}><div style={{fontSize:7,fontWeight:600,color:'#22c55e',marginBottom:1}}>⊕ Синергии в стеке ({d.synergies.length}):</div>{d.synergies.map((s,i)=><div key={i} style={{fontSize:7,color:'var(--text-dim)',padding:'1px 0',lineHeight:1.2}}><b style={{color:'#4ade80'}}>{s.aName}+{s.bName}</b>: {s.effect}{s.notes?`: ${s.notes.slice(0,60)}`:''}{s.mechs.length>0&&<span style={{marginLeft:2,opacity:.5}}>[{s.mechs.map((mx: string) => MECH_TRANSLATIONS_RU[mx] || mx).join(', ')}]</span>}</div>)}</div>}
                                      </>;
                                    })()}
                                    <div style={{ fontSize:7, color:'var(--text-dim)', marginTop:3 }}>Оценка синергии: <b style={{ color: synergyColor }}>{(stack.synergyScore||0).toFixed(1)}</b> · {(stack.substances||[]).length} веществ</div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                  {stackSearch && filteredStacks.length === 0 && <div style={{ padding:20, textAlign:'center', color:'var(--text-dim)', fontSize:11 }}>Ничего не найдено</div>}
                </div>
              </div>
            )}
            {renderView(infoView, 'favorites', () => {
              let favIds: string[] = [];
              try { favIds = JSON.parse(localStorage.getItem('he_support_favorites') || '[]'); } catch {}
              const [favSearch, setFavSearch] = useState('');
              const favSubstances = favIds.map(id => ALL_SUBSTANCES.find(s => s.id === id)).filter(Boolean);
              const filtered = favSearch ? favSubstances.filter(s => (s?.name||'').toLowerCase().includes(favSearch.toLowerCase())) : favSubstances;
              return (
              <div>
                <div style={{ display:'flex', gap:4, marginBottom:8, overflowX:'auto', scrollbarWidth:'none', flexWrap:'wrap' }}>
                  {[['mystacks','📂 Мои стеки'],['plan','📋 План'],['reports','📊 Отчеты']].map(([id,label]) => (
                    <button key={id} onClick={() => setCalcView(id as CalcView)} style={{
                      padding:'7px 14px', borderRadius:20, fontSize:10, fontWeight:700, whiteSpace:'nowrap', cursor:'pointer', flexShrink:0,
                      background: calcView === id ? 'var(--accent)' : 'var(--bg-secondary)',
                      color: calcView === id ? '#000' : 'var(--text-dim)',
                      border: '1px solid ' + (calcView === id ? 'var(--accent)' : 'var(--border)'),
                    }}>{label}</button>
                  ))}
                </div>
                <input value={favSearch} onChange={e => setFavSearch(e.target.value)}
                  placeholder="🔍 Поиск в избранном..."
                  style={{ width:'100%', padding:'8px 12px', borderRadius:8, border:'1px solid var(--border)', background:'var(--bg-secondary)', color:'var(--text)', fontSize:11, boxSizing:'border-box', marginBottom:8 }} />
                {filtered.length === 0 ? (
                  <div style={{ padding:24, textAlign:'center' }}>
                    <div style={{ fontSize:24, marginBottom:6 }}>⭐</div>
                    <div style={{ fontSize:11, color:'var(--text-dim)' }}>Нет избранных препаратов.</div>
                    <div style={{ fontSize:9, color:'var(--text-dim)', marginTop:2 }}>Добавьте из каталога ➕</div>
                  </div>
                ) : (
                  filtered.map((s: any) => (
                    <div key={s.id} style={{ display:'flex', alignItems:'center', gap:4, padding:'8px 10px', background:'var(--bg-secondary)', borderRadius:8, border:'1px solid var(--border)', marginBottom:4 }}>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:10, fontWeight:600, color:'var(--text-light)' }}>{s.name||s.id}</div>
                        <div style={{ display:'flex', gap:2, flexWrap:'wrap', marginTop:2 }}>
                          {(s.categories||[]).slice(0,3).map((c: string) => <span key={c} style={{ fontSize:8, padding:'1px 4px', borderRadius:3, background:'rgba(255,255,255,0.06)', color:'rgba(255,255,255,0.85)' }}>{c}</span>)}
                        </div>
                      </div>
                      <button onClick={() => {
                        try {
                          let f: string[] = JSON.parse(localStorage.getItem('he_support_favorites') || '[]');
                          const idx = f.indexOf(s.id);
                          if (idx >= 0) f.splice(idx, 1);
                          localStorage.setItem('he_support_favorites', JSON.stringify(f));
                          setFavRefresh(prev => prev + 1);
                        } catch {}
                      }} style={{ padding:'3px 8px', borderRadius:6, fontSize:9, cursor:'pointer', background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', color:'#ef4444', fontWeight:600, whiteSpace:'nowrap', flexShrink:0 }}>★ Убрать</button>
                    </div>
                  ))
                )}
              </div>
              );
            })}
            {renderView(infoView, 'supportstacks', () =>
              <div>
                {/* Sub-tabs: Все стеки / Замена / Поиск */}
                <div style={{ display:'flex', gap:4, marginBottom:8, overflowX:'auto', scrollbarWidth:'none', flexWrap:'wrap' }}>
                  {[['readystacks','📦 Все стеки'],['replace','🔄 Замена'],['search','🔍 Поиск']].map(([id,label]) => (
                    <button key={id} onClick={() => {
                      setStackSubTab(id);
                    }} style={{
                      padding:'7px 14px', borderRadius:20, fontSize:10, fontWeight:700, whiteSpace:'nowrap', cursor:'pointer', flexShrink:0,
                      background: stackSubTab === id ? 'var(--accent)' : 'var(--bg-secondary)',
                      color: stackSubTab === id ? '#000' : 'var(--text-dim)',
                      border: '1px solid ' + (stackSubTab === id ? 'var(--accent)' : 'var(--border)'),
                    }}>{label}</button>
                  ))}
                </div>

                {/* All Stacks view */}
                {stackSubTab === 'readystacks' && (
                <div style={{ padding:'0 4px' }}>
                  <input value={stackSearch} onChange={e => setStackSearch(e.target.value)}
                    placeholder="🔍 Поиск стеков..."
                    style={{ width:'100%', padding:'8px 12px', borderRadius:8, border:'1px solid var(--border)', background:'var(--bg-secondary)', color:'var(--text)', fontSize:11, boxSizing:'border-box', marginBottom:8 }} />
                  {(stackSearch ? filteredStacks : ALL_STACKS).length === 0 ? (
                    <div style={{ padding:20, textAlign:'center', color:'var(--text-dim)', fontSize:10 }}>Ничего не найдено</div>
                  ) : (
                    (stackSearch ? [{key:'search',label:'Результаты поиска',stacks:filteredStacks}] : groupedStacks).map(group => (
                      <div key={group.key} style={{ marginBottom:8 }}>
                        <div style={{ fontSize:10, fontWeight:700, color:'var(--text-dim)', marginBottom:4, padding:'0 2px' }}>{group.label}</div>
                        {group.stacks.map(stack => {
                          const isExpanded = expandedStack === stack.id;
                          const detail = stackDetailMap.get(stack.id);
                          return (
                            <div key={stack.id} style={{ marginBottom:4, background:'var(--bg-secondary)', borderRadius:8, border:'1px solid var(--border)', overflow:'hidden' }}>
                              <div onClick={() => setExpandedStack(isExpanded ? null : stack.id)} style={{ padding:'8px 10px', cursor:'pointer' }}>
                                <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                                  <div style={{ flex:1, fontSize:11, fontWeight:700, color:'var(--accent)' }}>{stack.name || stack.id}</div>
                                  <span style={{ fontSize:9, color:'var(--text-dim)', background:'rgba(255,255,255,0.05)', padding:'2px 6px', borderRadius:4 }}>{stack.substances.length} в-в</span>
                                  <span style={{ fontSize:9, color:'#00e68a', fontWeight:600 }}>{stack.synergyScore}%</span>
                                  <span style={{ fontSize:10, color:'var(--text-dim)', transform:isExpanded ? 'rotate(180deg)' : 'none' }}>▼</span>
                                </div>
                                <div style={{ display:'flex', gap:2, flexWrap:'wrap', marginTop:4 }}>
                                  {(stack.effects||[]).map(e => (
                                    <span key={e} style={{ fontSize:8, padding:'1px 5px', borderRadius:3, background:'rgba(0,230,138,0.08)', color:'#00e68a' }}>{EFFECT_LABELS_ru[e] || e}</span>
                                  ))}
                                </div>
                              </div>
                              {isExpanded && (
                                <div style={{ padding:'0 10px 10px', borderTop:'1px solid var(--border)' }}>
                                  {stack.description && <div style={{ fontSize:9, color:'rgba(255,255,255,0.7)', lineHeight:1.4, marginTop:6, marginBottom:6 }}>{stack.description}</div>}
                                  <div style={{ fontSize:8, color:'var(--text-dim)', marginBottom:4 }}>Состав:</div>
                                  {stack.substances.map(sid => {
                                    const sub = ALL_SUBSTANCES.find(x => x.id === sid);
                                    return (
                                      <div key={sid} style={{ display:'flex', alignItems:'center', gap:4, padding:'3px 6px', fontSize:9, borderBottom:'1px solid rgba(255,255,255,0.03)' }}>
                                        <span style={{ color:'var(--text-light)', flex:1 }}>{getStackSubLabel(sid)}</span>
                                        {sub?.description && <span style={{ color:'rgba(255,255,255,0.4)', fontSize:7.5 }}>{sub.description.slice ? sub.description.slice(0,80) : sub.description}</span>}
                                      </div>
                                    );
                                  })}
                                  {detail && detail.synergies.length > 0 && (
                                    <div style={{ marginTop:6 }}>
                                      <div style={{ fontSize:8, color:'#22c55e', marginBottom:3 }}>⊕ Синергии ({detail.synergies.length}):</div>
                                      {detail.synergies.slice(0,5).map((s,i) => (
                                        <div key={i} style={{ fontSize:8, color:'rgba(255,255,255,0.6)', lineHeight:1.4 }}>• {s.aName} + {s.bName} — {s.effect}</div>
                                      ))}
                                    </div>
                                  )}
                                  {(() => {
                                    const conflicts: Array<{a:string;b:string;effect:string}> = [];
                                    for (let a = 0; a < stack.substances.length; a++) {
                                      for (let b = a + 1; b < stack.substances.length; b++) {
                                        const key = `${stack.substances[a]}||${stack.substances[b]}`;
                                        const rev = `${stack.substances[b]}||${stack.substances[a]}`;
                                        const intx = conflictLookup.get(key) || conflictLookup.get(rev);
                                        if (intx && intx.type === 'conflict') {
                                          conflicts.push({ a: stack.substances[a], b: stack.substances[b], effect: intx.effect });
                                        }
                                      }
                                    }
                                    if (conflicts.length > 0) return (
                                      <div style={{ marginTop:6 }}>
                                        <div style={{ fontSize:8, color:'#ef4444', marginBottom:3 }}>⊖ Конфликты ({conflicts.length}):</div>
                                        {conflicts.slice(0,3).map((c,i) => (
                                          <div key={i} style={{ fontSize:8, color:'#f87171', lineHeight:1.4 }}>• {getStackSubLabel(c.a)} + {getStackSubLabel(c.b)} — {c.effect}</div>
                                        ))}
                                      </div>
                                    );
                                    return null;
                                  })()}
                                  <button onClick={e => { e.stopPropagation();
                                    SUPPORT_LEVELS[supportLevel] = { ...SUPPORT_LEVELS[supportLevel], subs: [...(SUPPORT_LEVELS[supportLevel]?.subs || []), ...stack.substances.filter(sid => !(SUPPORT_LEVELS[supportLevel]?.subs||[]).includes(sid))] };
                                    alert(`✅ Добавлено в план`);
                                  }} style={{ width:'100%', padding:'6px', borderRadius:6, border:'none', cursor:'pointer', background:'rgba(0,230,138,0.1)', color:'#00e68a', fontWeight:700, fontSize:10, marginTop:6 }}>+ В план</button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ))
                  )}
                </div>
                )}

                {/* REPLACEMENT CALCULATOR */}
                {stackSubTab === 'replace' && (
                  <div style={{ padding:'0 4px' }}>
                    <div style={{ fontSize:12, fontWeight:700, color:'#a78bfa', marginBottom:6 }}>🔄 Калькулятор замены препарата</div>
                    <div style={{ position:'relative', marginBottom:8 }}>
                      <input value={replaceSearch} onChange={e => setReplaceSearch(e.target.value)}
                        placeholder="🔍 Введите название препарата для замены..."
                        style={{ width:'100%', padding:'8px 12px', borderRadius:8, border:'1px solid var(--border)', background:'var(--bg-secondary)', color:'var(--text)', fontSize:11, boxSizing:'border-box' }} />
                      {replaceSearch && replaceResults.length === 0 && (
                        <div style={{ position:'absolute', top:'100%', left:0, right:0, zIndex:10, background:'var(--bg)', border:'1px solid var(--border)', borderRadius:6, maxHeight:150, overflowY:'auto', marginTop:1 }}>
                          {ALL_SUBSTANCES.filter(s => (s.name||'').toLowerCase().includes(replaceSearch.toLowerCase()) || (s.id||'').toLowerCase().includes(replaceSearch.toLowerCase())).slice(0,8).map(s => (
                            <div key={s.id} onClick={() => { setReplaceSelectedSub(s.id); setReplaceSearch(s.name); setReplaceResults(findReplacements(s.id)); }} style={{ padding:'7px 10px', cursor:'pointer', fontSize:10, borderBottom:'1px solid var(--border)' }}>
                              <span style={{ fontWeight:600, color:'var(--text)' }}>{s.name}</span>
                              <span style={{ fontSize:8, color:'var(--text-dim)', marginLeft:4 }}>{s.id}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    {replaceSelectedSub && (
                      <div style={{ marginBottom:8, padding:'8px 10px', borderRadius:8, background:'rgba(167,139,250,0.06)', border:'1px solid rgba(167,139,250,0.15)' }}>
                        <div style={{ fontSize:10, fontWeight:700, color:'#a78bfa' }}>{getSubstanceName(replaceSelectedSub)}</div>
                        <div style={{ fontSize:9, color:'rgba(255,255,255,0.7)' }}>Механизмы: {(findSubstance(replaceSelectedSub)?.mechanisms||[]).map((m:string)=>MECH_LABELS[m]||MECH_TRANSLATIONS_RU[m]||m).join(', ') || '—'}</div>
                        <div style={{ fontSize:9, color:'rgba(255,255,255,0.7)' }}>Органы: {(findSubstance(replaceSelectedSub)?.organs||[]).join(', ') || '—'}</div>
                      </div>
                    )}
                    {replaceResults.length > 0 && (
                      <div style={{ fontSize:9, color:'var(--text-dim)', marginBottom:4 }}>Найдено замен: {replaceResults.length}</div>
                    )}
                    {replaceResults.filter(r => r.id !== replaceSelectedSub).slice(0,20).map(r => (
                      <div key={r.id} style={{ marginBottom:4, padding:'8px 10px', borderRadius:8, background:'var(--bg-secondary)', border:'1px solid var(--border)' }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:2 }}>
                          <span style={{ fontWeight:700, fontSize:10, color:'#00e68a' }}>{getSubstanceName(r.id)}</span>
                          <span style={{ fontSize:9, padding:'2px 6px', borderRadius:4, background:r.score >= 70 ? 'rgba(34,197,94,0.15)' : r.score >= 40 ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)', color:r.score >= 70 ? '#22c55e' : r.score >= 40 ? '#f59e0b' : '#ef4444', fontWeight:700 }}>{r.score}%</span>
                        </div>
                        <div style={{ fontSize:8, color:'rgba(255,255,255,0.6)', marginBottom:2 }}>{r.reason}</div>
                        <div style={{ fontSize:8, color:'rgba(255,255,255,0.5)' }}>
                          {r.pros.length > 0 && <span style={{ color:'#22c55e' }}>+ {r.pros.join(', ')}</span>}
                          {r.cons.length > 0 && <span style={{ color:'#ef4444', marginLeft:6 }}>− {r.cons.join(', ')}</span>}
                        </div>
                        <button onClick={() => {
                          if (!enhancedSubs.includes(r.id)) setEnhancedSubs(prev => [...prev, r.id]);
                        }} style={{ marginTop:4, padding:'3px 8px', borderRadius:6, border:'none', cursor:'pointer', background:'rgba(0,230,138,0.1)', color:'#00e68a', fontSize:8, fontWeight:600 }}>+ Добавить в стек</button>
                      </div>
                    ))}
                    {replaceSelectedSub && replaceResults.length === 0 && (
                      <div style={{ padding:16, textAlign:'center', color:'var(--text-dim)', fontSize:10 }}>Замен не найдено. Попробуйте другой препарат.</div>
                    )}
                  </div>
                )}

                {/* SEARCH CALCULATOR */}
                {stackSubTab === 'search' && (
                  <div style={{ padding:'0 4px' }}>
                    <div style={{ fontSize:12, fontWeight:700, color:'#3b82f6', marginBottom:6 }}>🔍 Поиск препарата/стека/комплекса</div>
                    <div style={{ marginBottom:6 }}>
                      <label style={{ fontSize:8, color:'var(--text-dim)', marginBottom:2, display:'block' }}>Орган-мишень</label>
                      <select value={searchOrgan} onChange={e => setSearchOrgan(e.target.value)} style={{ width:'100%', padding:'6px 8px', borderRadius:6, border:'1px solid var(--border)', background:'var(--bg-secondary)', color:'var(--text)', fontSize:10 }}>
                        <option value="">Любой</option>
                        {[...new Set(Object.values(ORGAN_CATEGORY_MAP).map(v => v.key))].map(k => (
                          <option key={k} value={k}>{ORGAN_CATEGORY_MAP[Object.entries(ORGAN_CATEGORY_MAP).find(([,v]) => v.key === k)?.[0] || '']?.label || k}</option>
                        ))}
                      </select>
                    </div>
                    <div style={{ marginBottom:6 }}>
                      <label style={{ fontSize:8, color:'var(--text-dim)', marginBottom:2, display:'block' }}>Механизм действия</label>
                      <select value={searchMech} onChange={e => setSearchMech(e.target.value)} style={{ width:'100%', padding:'6px 8px', borderRadius:6, border:'1px solid var(--border)', background:'var(--bg-secondary)', color:'var(--text)', fontSize:10 }}>
                        <option value="">Любой</option>
                        {[...new Set(ALL_SUBSTANCES.flatMap(s => s.mechanisms||[]))].filter(Boolean).sort().slice(0,30).map(m => (
                          <option key={m} value={m}>{MECH_LABELS[m] || MECH_TRANSLATIONS_RU[m] || m}</option>
                        ))}
                      </select>
                    </div>
                    <div style={{ marginBottom:8 }}>
                      <label style={{ fontSize:8, color:'var(--text-dim)', marginBottom:2, display:'block' }}>Эффект/проблема</label>
                      <input value={searchEffect} onChange={e => setSearchEffect(e.target.value)} placeholder="Например: защита печени, антиоксидант, энергия..." style={{ width:'100%', padding:'6px 8px', borderRadius:6, border:'1px solid var(--border)', background:'var(--bg-secondary)', color:'var(--text)', fontSize:10, boxSizing:'border-box' }} />
                    </div>
                    <button onClick={() => setSearchResults(doSearch(searchOrgan, searchMech, searchEffect))} disabled={!searchOrgan && !searchMech && !searchEffect.trim()} style={{ width:'100%', padding:'8px', borderRadius:8, border:'none', cursor:'pointer', background:'linear-gradient(135deg,#3b82f6,#2563eb)', color:'#fff', fontWeight:700, fontSize:10, marginBottom:8, opacity:(!searchOrgan && !searchMech && !searchEffect.trim()) ? 0.5 : 1 }}>🔍 НАЙТИ</button>
                    {searchResults.length > 0 && (
                      <div>
                        <div style={{ fontSize:9, color:'var(--text-dim)', marginBottom:4 }}>Найдено: {searchResults.length}</div>
                        {searchResults.slice(0,30).map(r => (
                          <div key={r.id} style={{ marginBottom:4, padding:'8px 10px', borderRadius:8, background: r.type === 'stack' ? 'rgba(0,230,138,0.04)' : r.type === 'complex' ? 'rgba(139,92,246,0.04)' : 'var(--bg-secondary)', border:'1px solid var(--border)' }}>
                            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:2 }}>
                              <div>
                                <span style={{ fontSize:8, padding:'1px 5px', borderRadius:3, background: r.type === 'stack' ? 'rgba(0,230,138,0.1)' : r.type === 'complex' ? 'rgba(139,92,246,0.1)' : 'rgba(59,130,246,0.1)', color: r.type === 'stack' ? '#00e68a' : r.type === 'complex' ? '#a78bfa' : '#60a5fa', fontWeight:600, marginRight:4 }}>{r.type === 'stack' ? 'СТЕК' : r.type === 'complex' ? 'КОМПЛЕКС' : 'ПРЕПАРАТ'}</span>
                                <span style={{ fontWeight:700, fontSize:10, color:'var(--text-light)' }}>{r.name}</span>
                              </div>
                              <span style={{ fontSize:9, padding:'2px 6px', borderRadius:4, background: r.score >= 70 ? 'rgba(34,197,94,0.1)' : 'rgba(245,158,11,0.1)', color: r.score >= 70 ? '#22c55e' : '#f59e0b', fontWeight:700 }}>{r.score}%</span>
                            </div>
                            <div style={{ fontSize:8, color:'rgba(255,255,255,0.6)', lineHeight:1.3 }}>{r.reason}</div>
                            {r.type === 'stack' && r.substanceCount && <div style={{ fontSize:8, color:'var(--text-dim)', marginTop:2 }}>{r.substanceCount} веществ</div>}
                            {r.pros && r.pros.length > 0 && <div style={{ fontSize:8, color:'#22c55e', marginTop:2 }}>+ {r.pros.join(', ')}</div>}
                            {r.cons && r.cons.length > 0 && <div style={{ fontSize:8, color:'#ef4444' }}>− {r.cons.join(', ')}</div>}
                            {r.type === 'substance' && <button onClick={() => { if (!enhancedSubs.includes(r.id)) setEnhancedSubs(prev => [...prev, r.id]); }} style={{ marginTop:4, padding:'3px 8px', borderRadius:6, border:'none', cursor:'pointer', background:'rgba(0,230,138,0.1)', color:'#00e68a', fontSize:8, fontWeight:600 }}>+ Добавить в стек</button>}
                          </div>
                        ))}
                      </div>
                    )}
                    {searchResults.length === 0 && (searchOrgan || searchMech || searchEffect.trim()) && (
                      <div style={{ padding:16, textAlign:'center', color:'var(--text-dim)', fontSize:10 }}>Ничего не найдено. Попробуйте изменить параметры поиска.</div>
                    )}
                  </div>
                )}
              </div>
            )}

            {renderView(infoView, 'research', () => (
                <div>
                  <div style={{fontSize:13,fontWeight:700,color:'var(--accent)',marginBottom:4}}>🔬 Поиск исследований</div>
                  <div style={{fontSize:9,color:'var(--text-dim)',marginBottom:8}}>PubMed, PubChem, Google Scholar, OpenFDA и каталог препаратов</div>

                  {/* Source Pills */}
                  <div style={{display:'flex',gap:4,marginBottom:10,overflowX:'auto',scrollbarWidth:'none',flexShrink:0}}>
                    {([
                      {key:'pubmed',label:'📚 PubMed',color:'#3b82f6'},
                      {key:'pubchem',label:'🧪 PubChem',color:'#8b5cf6'},
                      {key:'scholar',label:'🎓 Scholar',color:'#f59e0b'},
                      {key:'fda',label:'💊 OpenFDA',color:'#ef4444'},
                      {key:'pharma',label:'📋 Каталог',color:'#00e68a'},
                    ] as const).map(s => (
                      <button key={s.key} onClick={() => {setResearchSource(s.key);if(s.key==='pubchem')handlePubchemSearch();if(s.key==='fda')handleFDASearch();}} style={{
                        padding:'7px 14px',borderRadius:20,fontSize:10,fontWeight:700,whiteSpace:'nowrap',cursor:'pointer',flexShrink:0,
                        background: researchSource===s.key ? s.color : 'var(--bg-secondary)',
                        color: researchSource===s.key ? '#fff' : 'var(--text-dim)',
                        border: `1px solid ${researchSource===s.key ? s.color : 'var(--border)'}`,
                      }}>{s.label}</button>
                    ))}
                  </div>

                  {/* Shared search input */}
                  <div style={{display:'flex',gap:6,marginBottom:10}}>
                    <input value={pubMedQuery} onChange={e=>setPubMedQuery(e.target.value)}
                      onKeyDown={e=>{if(e.key==='Enter'){if(researchSource==='pubmed')handlePubMedSearch();if(researchSource==='pubchem')handlePubchemSearch();if(researchSource==='fda')handleFDASearch();}}}
                      placeholder={researchSource==='pubmed'?'creatine muscle, NAC liver...':researchSource==='pubchem'?'caffeine, creatine, NAC...':researchSource==='fda'?'aspirin, metformin...':'Поиск по названию, классу...'}
                      style={{flex:1,padding:'8px 12px',borderRadius:8,border:'1px solid var(--border)',background:'var(--bg-secondary)',color:'var(--text)',fontSize:11,boxSizing:'border-box'}} />
                    <button onClick={()=>{if(researchSource==='pubmed')handlePubMedSearch();if(researchSource==='pubchem')handlePubchemSearch();if(researchSource==='fda')handleFDASearch();}}
                      disabled={(researchSource==='pubmed'&&pubMedLoading)||(researchSource==='pubchem'&&pubchemLoading)||(researchSource==='fda'&&fdaLoading)}
                      style={{padding:'8px 14px',borderRadius:8,border:'none',cursor:'pointer',background:`linear-gradient(135deg,${researchSource==='pubmed'?'#3b82f6,#2563eb':researchSource==='pubchem'?'#8b5cf6,#7c3aed':researchSource==='fda'?'#ef4444,#dc2626':researchSource==='pharma'?'#00e68a,#00c853':'#3b82f6,#2563eb'})`,color:'#fff',fontWeight:700,fontSize:11,opacity:(researchSource==='pubmed'&&pubMedLoading)||(researchSource==='pubchem'&&pubchemLoading)||(researchSource==='fda'&&fdaLoading)?0.6:1}}>
                      {((researchSource==='pubmed'&&pubMedLoading)||(researchSource==='pubchem'&&pubchemLoading)||(researchSource==='fda'&&fdaLoading))?'⏳':researchSource==='scholar'?'🔗':'🔍'}
                    </button>
                  </div>

                  {/* === PUBMED === */}
                  {researchSource === 'pubmed' && (
                    <div className="card" style={{marginBottom:12}}>
                      <h4 style={{margin:'0 0 6px',fontSize:12}}>📚 PubMed — научные статьи</h4>
                      <div style={{display:'flex',gap:4,marginBottom:6}}>
                        <button onClick={()=>{setPubMedQuery('creatine supplementation strength performance');handlePubMedSearch();}} style={{padding:'3px 8px',borderRadius:4,fontSize:8,cursor:'pointer',border:'1px solid var(--border)',background:'var(--bg-secondary)',color:'var(--text-light)'}}>Креатин</button>
                        <button onClick={()=>{setPubMedQuery('whey protein muscle hypertrophy');handlePubMedSearch();}} style={{padding:'3px 8px',borderRadius:4,fontSize:8,cursor:'pointer',border:'1px solid var(--border)',background:'var(--bg-secondary)',color:'var(--text-light)'}}>Протеин</button>
                        <button onClick={()=>{setPubMedQuery('beta-alanine carnosine performance');handlePubMedSearch();}} style={{padding:'3px 8px',borderRadius:4,fontSize:8,cursor:'pointer',border:'1px solid var(--border)',background:'var(--bg-secondary)',color:'var(--text-light)'}}>Бета-аланин</button>
                      </div>
                      {pubMedError&&<div style={{padding:8,background:'rgba(239,68,68,0.06)',borderRadius:6,border:'1px solid rgba(239,68,68,0.2)',color:'#f87171',fontSize:10,marginBottom:8}}>⚠ {pubMedError}</div>}
                      {pubMedResults.length>0&&<div style={{fontSize:9,color:'var(--text-dim)',marginBottom:6}}>Найдено: {pubMedResults.length} публикаций</div>}
                      <div style={{display:'flex',flexDirection:'column',gap:6,maxHeight:400,overflowY:'auto'}}>
                        {pubMedResults.map(a=>(
                          <a key={a.pmid} href={a.url} target="_blank" rel="noopener noreferrer" style={{display:'block',padding:'8px 10px',borderRadius:8,background:'var(--bg-secondary)',border:'1px solid var(--border)',textDecoration:'none',color:'inherit'}}>
                            <div style={{fontSize:11,fontWeight:600,color:'var(--text-light)',lineHeight:1.3,marginBottom:2}}>{a.title}</div>
                            {a.authors.length > 0 && <div style={{fontSize:9,color:'var(--text-dim)'}}>{a.authors.slice(0, 3).join(', ')}{a.authors.length > 3 ? ' et al.' : ''}</div>}
                            <div style={{fontSize:9,color:'var(--text-dim)'}}>{a.journal}{a.pubDate ? ` · ${a.pubDate}` : ''}</div>
                            {a.abstract&&<div style={{fontSize:9,color:'rgba(255,255,255,0.5)',lineHeight:1.3,marginTop:2,display:'-webkit-box',WebkitLineClamp:3,WebkitBoxOrient:'vertical',overflow:'hidden'}}>{a.abstract}</div>}
                          </a>
                        ))}
                        {pubMedResults.length===0&&!pubMedLoading&&!pubMedError&&<div style={{padding:16,textAlign:'center',color:'var(--text-dim)',fontSize:10}}>Введите запрос для поиска публикаций</div>}
                      </div>
                    </div>
                  )}

                  {/* === PUBCHEM === */}
                  {researchSource === 'pubchem' && (
                    <div className="card" style={{marginBottom:12}}>
                      <h4 style={{margin:'0 0 6px',fontSize:12}}>🧪 PubChem — химическая информация</h4>
                      <div style={{display:'flex',gap:4,marginBottom:6,flexWrap:'wrap'}}>
                        {[{label:'Кофеин',q:'caffeine'},{label:'Креатин',q:'creatine'},{label:'L-цитруллин',q:'L-citrulline'},{label:'Таурин',q:'taurine'},{label:'L-тирозин',q:'L-tyrosine'},{label:'Бета-аланин',q:'beta-alanine'}].map(p=>(
                          <button key={p.q} onClick={()=>{setPubMedQuery(p.q);handlePubchemSearch();}} style={{padding:'3px 8px',borderRadius:4,fontSize:8,cursor:'pointer',border:'1px solid var(--border)',background:'var(--bg-secondary)',color:'var(--text-light)'}}>{p.label}</button>
                        ))}
                      </div>
                      {pubchemError&&<div style={{padding:8,background:'rgba(239,68,68,0.06)',borderRadius:6,border:'1px solid rgba(239,68,68,0.2)',color:'#f87171',fontSize:10,marginBottom:8}}>⚠ {pubchemError}</div>}
                      {pubchemLoading&&<div style={{padding:12,textAlign:'center',color:'var(--text-dim)',fontSize:10}}>⏳ Поиск в PubChem...</div>}
                      {pubchemResults.map((r,i)=>(
                        <div key={i} style={{padding:'10px 12px',borderRadius:10,background:'var(--bg-secondary)',border:'1px solid var(--border)',marginBottom:8}}>
                          <div style={{fontSize:12,fontWeight:700,color:'#8b5cf6',marginBottom:4}}>{r.name}</div>
                          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:4,fontSize:9,color:'var(--text-dim)'}}>
                            <div><b>Формула:</b> {r.formula}</div>
                            <div><b>Мол. масса:</b> {typeof r.mw === 'number' ? r.mw.toFixed(2) + ' г/моль' : r.mw}</div>
                            <div style={{gridColumn:'1/-1'}}><b>IUPAC:</b> {r.iupac}</div>
                          </div>
                        </div>
                      ))}
                      {pubchemResults.length===0&&!pubchemLoading&&!pubchemError&&<div style={{padding:12,textAlign:'center',color:'var(--text-dim)',fontSize:10}}>Введите название соединения (на английском) и нажмите 🔍</div>}
                    </div>
                  )}

                  {/* === GOOGLE SCHOLAR === */}
                  {researchSource === 'scholar' && (
                    <div className="card" style={{marginBottom:12}}>
                      <h4 style={{margin:'0 0 6px',fontSize:12}}>🎓 Google Scholar — научные публикации</h4>
                      <div style={{display:'flex',gap:4,marginBottom:6,flexWrap:'wrap'}}>
                        {[
                          {label:'Тестостерон и гипертрофия',q:'тестостерон мышечная гипертрофия'},
                          {label:'NAC гепатопротекция',q:'NAC гепатопротекция печень'},
                          {label:'Омега-3 кардио',q:'омега-3 сердечно-сосудистая система'},
                          {label:'Креатин сила',q:'креатин силовые показатели'},
                          {label:'Метформин anti-aging',q:'metformin anti-aging longevity'},
                          {label:'Витамин D спортсмены',q:'витамин D спортсмены дефицит'},
                        ].map(p=>(
                          <button key={p.q} onClick={()=>{setPubMedQuery(p.q);}} style={{padding:'3px 8px',borderRadius:4,fontSize:8,cursor:'pointer',border:'1px solid var(--border)',background:'var(--bg-secondary)',color:'var(--text-light)'}}>{p.label}</button>
                        ))}
                      </div>
                      <div style={{fontSize:10,color:'var(--text-dim)',marginBottom:8}}>Поиск откроется в новой вкладке Google Scholar</div>
                      <a href={`https://scholar.google.com/scholar?q=${encodeURIComponent(pubMedQuery)}`} target="_blank" rel="noopener noreferrer"
                        style={{display:'inline-block',padding:'10px 20px',borderRadius:10,border:'none',cursor:'pointer',background:'linear-gradient(135deg,#f59e0b,#d97706)',color:'#000',fontWeight:700,fontSize:12,textDecoration:'none',textAlign:'center'}}>
                        🎓 Искать в Google Scholar: {pubMedQuery || '(введите запрос)'}
                      </a>
                    </div>
                  )}

                  {/* === OPENFDA === */}
                  {researchSource === 'fda' && (
                    <div className="card" style={{marginBottom:12}}>
                      <h4 style={{margin:'0 0 6px',fontSize:12}}>💊 OpenFDA — официальные инструкции препаратов</h4>
                      <div style={{display:'flex',gap:4,marginBottom:6,flexWrap:'wrap'}}>
                        {[{label:'Аспирин',q:'aspirin'},{label:'Метформин',q:'metformin'},{label:'Тестостерон',q:'testosterone'},{label:'Тамоксифен',q:'tamoxifen'},{label:'Кломифен',q:'clomiphene'}].map(p=>(
                          <button key={p.q} onClick={()=>{setPubMedQuery(p.q);handleFDASearch();}} style={{padding:'3px 8px',borderRadius:4,fontSize:8,cursor:'pointer',border:'1px solid var(--border)',background:'var(--bg-secondary)',color:'var(--text-light)'}}>{p.label}</button>
                        ))}
                      </div>
                      {fdaError&&<div style={{padding:8,background:'rgba(239,68,68,0.06)',borderRadius:6,border:'1px solid rgba(239,68,68,0.2)',color:'#f87171',fontSize:10,marginBottom:8}}>⚠ {fdaError}</div>}
                      {fdaLoading&&<div style={{padding:12,textAlign:'center',color:'var(--text-dim)',fontSize:10}}>⏳ Поиск в OpenFDA...</div>}
                      <div style={{display:'flex',flexDirection:'column',gap:6,maxHeight:400,overflowY:'auto'}}>
                        {fdaResults.map((r,i)=>(
                          <div key={i} style={{padding:'8px 10px',borderRadius:8,background:'var(--bg-secondary)',border:'1px solid var(--border)'}}>
                            <div style={{fontSize:11,fontWeight:700,color:'#ef4444',marginBottom:2}}>{r.brandName}</div>
                            <div style={{fontSize:9,color:'var(--text-dim)',marginBottom:2}}>{r.genericName}</div>
                            <div style={{fontSize:9,color:'rgba(255,255,255,0.5)',lineHeight:1.3,display:'-webkit-box',WebkitLineClamp:4,WebkitBoxOrient:'vertical',overflow:'hidden'}}>{r.indications}</div>
                            {r.manufacturer !== '—' && <div style={{fontSize:8,color:'var(--text-dim)',marginTop:2}}>Производитель: {r.manufacturer}</div>}
                          </div>
                        ))}
                        {fdaResults.length===0&&!fdaLoading&&!fdaError&&<div style={{padding:12,textAlign:'center',color:'var(--text-dim)',fontSize:10}}>Введите название препарата (на английском) и нажмите 🔍</div>}
                      </div>
                    </div>
                  )}

                  {/* === PHARMA CATALOG SEARCH === */}
                  {researchSource === 'pharma' && (
                    <div className="card" style={{marginBottom:12}}>
                      <h4 style={{margin:'0 0 6px',fontSize:12}}>💊 Поиск препаратов и добавок</h4>
                      <div style={{display:'flex',gap:6,marginBottom:8}}>
                        <input value={pharmaSearchQ} onChange={e=>doPharmaSearch(e.target.value)}
                          placeholder="Поиск по названию, классу или категории..."
                          style={{flex:1,padding:'8px 12px',borderRadius:8,border:'1px solid var(--border)',background:'var(--bg-secondary)',color:'var(--text)',fontSize:11,boxSizing:'border-box'}} />
                      </div>
                      <div style={{display:'flex',flexDirection:'column',gap:4,maxHeight:300,overflowY:'auto'}}>
                        {pharmaSearchResults.map(r=>(
                          <div key={r.id} style={{padding:'6px 10px',borderRadius:6,background:r.cls==='supplement'?'rgba(0,230,138,0.04)':'rgba(139,92,246,0.04)',border:`1px solid ${r.cls==='supplement'?'rgba(0,230,138,0.15)':'rgba(139,92,246,0.15)'}`,cursor:'pointer',fontSize:10}} onClick={()=>{
                            if(PHARMA_DB[r.id]) { setTab('catalog' as any); }
                          }}>
                            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                              <span style={{fontWeight:600,color:r.cls==='supplement'?'#00e68a':'#a78bfa'}}>{r.name}</span>
                              <span style={{fontSize:8,padding:'1px 5px',borderRadius:4,background:r.cls==='supplement'?'rgba(0,230,138,0.1)':'rgba(139,92,246,0.1)',color:r.cls==='supplement'?'#00e68a':'#a78bfa'}}>{r.cls}</span>
                            </div>
                            {r.desc&&<div style={{fontSize:8,color:'var(--text-dim)',marginTop:2,lineHeight:1.3}}>{r.desc}</div>}
                          </div>
                        ))}
                        {pharmaSearchResults.length===0&&pharmaSearchQ.length>2&&<div style={{padding:12,textAlign:'center',color:'var(--text-dim)',fontSize:10}}>Ничего не найдено</div>}
                        {pharmaSearchQ.length<=2&&<div style={{padding:12,textAlign:'center',color:'var(--text-dim)',fontSize:10}}>Введите минимум 3 символа</div>}
                      </div>
                    </div>
                  )}

                  {/* Quick Research Links — expanded Russian presets */}
                  <div className="card" style={{marginBottom:12}}>
                    <h4 style={{margin:'0 0 6px',fontSize:12}}>📚 Быстрый поиск по темам</h4>
                    <div style={{display:'flex',flexWrap:'wrap',gap:4}}>
                      {[
                        {label:'Тестостерон и мышечная масса',q:'testosterone muscle mass hypertrophy'},
                        {label:'NAC и печень',q:'NAC liver hepatoprotection'},
                        {label:'Омега-3 и сердце',q:'omega-3 cardiovascular protection'},
                        {label:'Тренболон токсичность',q:'trenbolone cardiotoxicity hepatotoxicity'},
                        {label:'Креатин эффективность',q:'creatine supplementation strength performance'},
                        {label:'Витамин D и тестостерон',q:'vitamin D testosterone men'},
                        {label:'Ашваганда кортизол',q:'ashwagandha cortisol stress'},
                        {label:'BPC-157 заживление',q:'BPC-157 tendon healing angiogenesis'},
                        {label:'Селен и щитовидная',q:'selenium thyroid function'},
                        {label:'Коэнзим Q10 сердце',q:'coenzyme Q10 heart failure cardioprotection'},
                        {label:'Сон и мелатонин',q:'melatonin sleep quality circadian'},
                        {label:'Куркумин воспаление',q:'curcumin inflammation NF-kB'},
                        {label:'Бета-аланин выносливость',q:'beta-alanine carnosine endurance performance'},
                        {label:'Цитруллин и NO',q:'citrulline malate nitric oxide blood flow'},
                        {label:'Магний и сон',q:'magnesium glycinate sleep quality anxiety'},
                        {label:'Цинк и иммунитет',q:'zinc supplementation immune function testosterone'},
                        {label:'L-карнитин жиросжигание',q:'L-carnitine fat oxidation exercise performance'},
                        {label:'HMB и катаболизм',q:'HMB beta-hydroxy beta-methylbutyrate muscle protein breakdown'},
                        {label:'Глютамин и кишечник',q:'glutamine intestinal permeability gut health'},
                        {label:'Коллаген и суставы',q:'collagen peptides joint pain osteoarthritis'},
                      ].map(preset=>(
                        <button key={preset.q} onClick={()=>{setPubMedQuery(preset.q);handlePubMedSearch();}} style={{padding:'5px 10px',borderRadius:6,fontSize:9,cursor:'pointer',border:'1px solid var(--border)',background:'var(--bg-secondary)',color:'var(--text-light)'}}>{preset.label}</button>
                      ))}
                    </div>
                  </div>
                </div>
              ))}



          </div>
        </div>
      )}

      {/* ===== INFO: КАК РАБОТАЕТ ПОДБОР ПОДДЕРЖКИ ===== */}
      {genTab === 'info' && section === 'generator' && (
        <div style={{ padding:'0 12px 80px', maxWidth:600, margin:'0 auto' }}>
          <h2 style={{ fontSize:16, fontWeight:800, color:'#fff', margin:'0 0 16px', display:'flex', alignItems:'center', gap:6 }}>
            <span>📖</span> Как работает подбор поддержки
          </h2>

          <div style={{ display:'flex', flexDirection:'column', gap:10, fontSize:10, color:'rgba(255,255,255,0.85)', lineHeight:1.6 }}>

            <div style={{ borderRadius:12, padding:14, background:'rgba(24,24,27,0.15)', border:'1px solid rgba(255,255,255,0.04)' }}>
              <h3 style={{ margin:'0 0 6px', fontSize:12, fontWeight:700, color:'#00e68a' }}>1. Оценка рисков от курса</h3>
              <p style={{ margin:0 }}>
                Первый шаг — анализ всех активных соединений вашего курса. Каждое вещество в базе PHARMA_DB содержит PK/PD-профиль с показателями гепатотоксичности, андрогенности, ароматизации, кардиотоксичности и т.д. Система суммирует риски по 8 системам организма:
              </p>
              <ul style={{ paddingLeft:16, margin:'4px 0' }}>
                <li><b>❤️ Сердце:</b> кардиотоксичность соединений + влияние на липидный профиль + АД</li>
                <li><b>🧪 Печень:</b> 17-алкилированные оральные стероиды — основной фактор. Внутривенная нагрузка метаболитами</li>
                <li><b>🫘 Почки:</b> нагрузка на нефроны, влияние на РААС, гипертензия</li>
                <li><b>🧠 Нейро:</b> нейротоксичность (особенно тренболон, нандролон), дофаминовая регуляция</li>
                <li><b>🔄 Эндокринная:</b> подавление ГГЯ-оси, влияние на кортизол, Т3/Т4</li>
                <li><b>🩸 Кровь:</b> гематокрит, эритроцитоз, тромбоцитарный фактор</li>
                <li><b>⚧ Репродуктивная:</b> супрессия ЛГ/ФСГ, снижение ингибина B, атрофия Лейдига-клеток</li>
                <li><b>🦴 Опорно-двиг.:</b> влияние на коллаген, сухожилия, суставы, костную плотность</li>
              </ul>
            </div>

            <div style={{ borderRadius:12, padding:14, background:'rgba(24,24,27,0.15)', border:'1px solid rgba(255,255,255,0.04)' }}>
              <h3 style={{ margin:'0 0 6px', fontSize:12, fontWeight:700, color:'#00e68a' }}>2. Анализ лабораторных данных</h3>
              <p style={{ margin:0 }}>
                Если у вас есть загруженные анализы крови, система автоматически сверяет ваши показатели с референсными значениями:
              </p>
              <ul style={{ paddingLeft:16, margin:'4px 0' }}>
                <li>Печень: АСТ, АЛТ, ГГТ, общий билирубин</li>
                <li>Сердце: ЛПНП, ЛПВП, триглицериды, гомоцистеин</li>
                <li>Почки: креатинин, мочевина, СКФ, цистатин C</li>
                <li>Кровь: гематокрит, гемоглобин, эритроциты</li>
                <li>Гормоны: ТТГ, Т3, кортизол, ЛГ, ФСГ, тестостерон</li>
              </ul>
              <p style={{ margin:'4px 0 0' }}>Каждое отклонение увеличивает риск соответствующей системы.</p>
            </div>

            <div style={{ borderRadius:12, padding:14, background:'rgba(24,24,27,0.15)', border:'1px solid rgba(255,255,255,0.04)' }}>
              <h3 style={{ margin:'0 0 6px', fontSize:12, fontWeight:700, color:'#00e68a' }}>3. Выбор уровня поддержки</h3>
              <p style={{ margin:0 }}>
                На основе суммарного риска выбирается уровень поддержки:
              </p>
              <ul style={{ paddingLeft:16, margin:'4px 0' }}>
                <li><b>🟢 Базовый (lvl 1, 0–20%):</b> минимальная профилактика. Omega-3, Витамин D3+K2, Магний, Цинк, CoQ10</li>
                <li><b>🟡 Средний (lvl 2, 20–45%):</b> расширенная поддержка. Добавляются: NAC, TUDCA, пальметто, ашваганда, В-комплекс</li>
                <li><b>🟠 Повышенный (lvl 3, 45–70%):</b> усиленная поддержка. Полный набор: берберин, астаксантин, АЛК, ALCAR</li>
                <li><b>🔴 Интенсивный (lvl 4, 70%+):</b> максимальная поддержка. Все доступные механизмы, нейропротекция, гепатопротекция</li>
              </ul>
              <p style={{ margin:'4px 0 0' }}>Вы также можете вручную указать желаемый уровень — он будет использован как целевой при генерации стека.</p>
            </div>

            <div style={{ borderRadius:12, padding:14, background:'rgba(24,24,27,0.15)', border:'1px solid rgba(255,255,255,0.04)' }}>
              <h3 style={{ margin:'0 0 6px', fontSize:12, fontWeight:700, color:'#00e68a' }}>4. Подбор веществ по механизмам</h3>
              <p style={{ margin:0 }}>
                Каждое вещество в базе ALL_SUBSTANCES имеет один или несколько механизмов действия (из 553+ возможных). Для каждой системы подбираются вещества, которые:
              </p>
              <ol style={{ paddingLeft:16, margin:'4px 0' }} type="a">
                <li><b>Покрывают проблемные механизмы</b> — например, при высоком гематокрите добавляются вещества с механизмами крови (Ω-3, наттокиназа)</li>
                <li><b>Синергируют друг с другом</b> — комбинации с подтверждённой эффективностью (D3+K2, Mg+B6, C+железо)</li>
                <li><b>Не конфликтуют</b> — система проверяет все пары на наличие известных взаимодействий</li>
              </ol>
              <p style={{ margin:'4px 0 0' }}>Подбор учитывает до 6 механизмов на вещество и до 5 синергий на пару.</p>
            </div>

            <div style={{ borderRadius:12, padding:14, background:'rgba(24,24,27,0.15)', border:'1px solid rgba(255,255,255,0.04)' }}>
              <h3 style={{ margin:'0 0 6px', fontSize:12, fontWeight:700, color:'#00e68a' }}>5. Дозирование и режим приёма</h3>
              <p style={{ margin:0 }}>
                Для каждого вещества определена стандартная дозировка (мг/день) и рекомендуемое время приёма:
              </p>
              <ul style={{ paddingLeft:16, margin:'4px 0' }}>
                <li><b>Утром</b> — энергия, жирорастворимые витамины, дофаминергические</li>
                <li><b>С едой</b> — жирорастворимые (D3, K2, CoQ10, куркумин), гепатопротекторы</li>
                <li><b>На ночь</b> — магний, ZMA, адаптогены, сонные</li>
                <li><b>До тренировки</b> — NO-бустеры, креатин, бета-аланин</li>
                <li><b>После тренировки</b> — протеин, ALCAR, HMB</li>
              </ul>
              <p style={{ margin:'4px 0 0' }}>Длительность курса поддержки обычно совпадает с курсом ААС + 2–4 недели после для восстановления.</p>
            </div>

            <div style={{ borderRadius:12, padding:14, background:'rgba(24,24,27,0.15)', border:'1px solid rgba(255,255,255,0.04)' }}>
              <h3 style={{ margin:'0 0 6px', fontSize:12, fontWeight:700, color:'#00e68a' }}>6. Генерация стека</h3>
              <p style={{ margin:0 }}>
                Алгоритм генератора стеков работает в 4 этапа:
              </p>
              <ol style={{ paddingLeft:16, margin:'4px 0' }}>
                <li><b>Фильтрация:</b> отбираются вещества, соответствующие вашей цели (печень, сердце, нейро, общая поддержка)</li>
                <li><b>Ранжирование:</b> каждое вещество получает оценку по 3 критериям: покрытие механизмов (40%), уровень доказательности (35%), безопасность (25%)</li>
                <li><b>Оптимизация:</b> из топ-50 выбирается оптимальная комбинация 5–10 веществ с максимальным покрытием и минимальными конфликтами</li>
                <li><b>Валидация:</b> проверка всех пар на синергии и конфликты из базы ALL_INTERACTIONS (206 записей)</li>
              </ol>
            </div>

            <div style={{ borderRadius:12, padding:14, background:'rgba(24,24,27,0.15)', border:'1px solid rgba(255,255,255,0.04)' }}>
              <h3 style={{ margin:'0 0 6px', fontSize:12, fontWeight:700, color:'#00e68a' }}>7. Проверка взаимодействий</h3>
              <p style={{ margin:0 }}>
                Финальная проверка на взаимодействия между всеми веществами курса и поддержки. База ALL_INTERACTIONS содержит 206 записей:
              </p>
              <ul style={{ paddingLeft:16, margin:'4px 0' }}>
                <li><b>🟢 Синергии (положительные):</b> пары, усиливающие действие друг друга. Например, D3+K2 → кальциевый транспорт, Mg+B6 → GABA</li>
                <li><b>🔴 Конфликты (отрицательные):</b> пары, снижающие эффективность. Например, кальций+железо → конкуренция за всасывание</li>
                <li><b>🟡 Осторожность:</b> пары, требующие временного разнесения или контроля. Например, цинк+медь → антагонизм при высоких дозах</li>
              </ul>
              <p style={{ margin:'4px 0 0' }}>Взаимодействия проверяются как внутри класса (Поддержка—Поддержка), так и между классами (Фарма—Поддержка).</p>
            </div>

            <div style={{ borderRadius:12, padding:14, background:'rgba(24,24,27,0.15)', border:'1px solid rgba(255,255,255,0.04)' }}>
              <h3 style={{ margin:'0 0 6px', fontSize:12, fontWeight:700, color:'#00e68a' }}>8. Формирование недельного плана</h3>
              <p style={{ margin:0 }}>
                Готовый стек раскладывается в недельный план с указанием:
              </p>
              <ul style={{ paddingLeft:16, margin:'4px 0' }}>
                <li>Конкретной дозировки (мг/мкг/МЕ)</li>
                <li>Времени приёма (утро/день/вечер/ночь, до/после еды, до/после тренировки)</li>
                <li>Дней недели (ежедневно/через день/2 раза в неделю)</li>
                <li>Продолжительности приёма (недели цикла)</li>
              </ul>
              <p style={{ margin:'4px 0 0' }}>План можно сохранить в избранное, экспортировать или добавить всё в корзину магазина.</p>
            </div>

            <div style={{ borderRadius:12, padding:14, background:'rgba(24,24,27,0.15)', border:'1px solid rgba(255,255,255,0.04)' }}>
              <h3 style={{ margin:'0 0 6px', fontSize:12, fontWeight:700, color:'#f59e0b' }}>⚠️ Важные замечания</h3>
              <div style={{ margin:0 }}>
                <p style={{ margin:'0 0 4px' }}><b>Информация носит ознакомительный характер.</b> Подбор поддержки должен производиться врачом или профильным специалистом с учётом индивидуальных особенностей: возраста, веса, генетических полиморфизмов (MTHFR, COMT, CYP), сопутствующих заболеваний и принимаемых лекарств.</p>
                <p style={{ margin:'0 0 4px' }}><b>Без лабораторных данных</b> система использует среднестатистические риски по курсу. Для точного подбора необходимы свежие анализы (не старше 3 месяцев).</p>
                <p style={{ margin:0 }}><b>Противопоказания:</b> некоторые вещества несовместимы с определёнными заболеваниями или лекарствами. Если вы принимаете варфарин, антидепрессанты, антипсихотики, антигипертензивные — проконсультируйтесь со специалистом.</p>
              </div>
            </div>

          </div>
        </div>
      )}

      {section === 'protocols' && (
        <div style={{ padding:'0 12px 12px' }}>
          {/* Warning Card */}
          <div style={{ margin:'12px 0 10px', padding:'22px 18px', borderRadius:16,
            background:'linear-gradient(135deg, rgba(239,68,68,0.10) 0%, rgba(245,158,11,0.06) 100%)',
            border:'2px solid rgba(239,68,68,0.30)',
            boxShadow:'0 6px 28px rgba(239,68,68,0.15)',
          }}>
            <div style={{ fontSize:15, fontWeight:800, color:'#ef4444', marginBottom:12, display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ fontSize:22 }}>⚠️</span> ВАЖНАЯ ИНФОРМАЦИЯ
            </div>
            <div style={{ fontSize:14, lineHeight:1.7, color:'rgba(255,255,255,0.92)', fontWeight:500 }}>
              Информация в данном блоке является ознакомительной, выбор конкретной схемы восстановления и лечения, интерпретация анализов и динамики восстановления должен производиться исключительно специалистом под конкретный случай конкретного человека. Настоятельно рекомендуем обратиться к специалисту для решения данных вопросов.
            </div>
          </div>

          {/* Unified protocol sub-tab pills (7 protocols) */}
          <div style={{ display:'flex', gap:4, padding:'4px 0 8px', overflowX:'auto', scrollbarWidth:'none' }}>
            {[['pct','ПКТ','#8b5cf6'],['fertility','Фертильность','#ec4899'],['hrt','ГЗТ','#f59e0b'],['neuro','Нейро','#06b6d4'],['joints','Суставы','#22c55e'],['acne','Акне','#ef4444'],['peptides','Пептиды','#a78bfa']].map(([id,label,color]) => (
              <button key={id} onClick={() => setProtocolTab(id as any)} style={{
                padding:'7px 16px', borderRadius:22, fontSize:12, fontWeight:700, whiteSpace:'nowrap', cursor:'pointer', flexShrink:0,
                background: protocolTab === id ? color : 'var(--bg-secondary)',
                color: protocolTab === id ? '#000' : 'var(--text-dim)',
                border: '1px solid ' + (protocolTab === id ? color : 'var(--border)'),
              }}>{label}</button>
            ))}
          </div>

          {/* Content: PCT / Fertility / HRT → FertilityPCTScreen */}
          {(['pct','fertility','hrt'] as string[]).includes(protocolTab) && (
            <FertilityPCTScreen initialTab={protocolTab === 'pct' ? 'pct-plan' : protocolTab === 'hrt' ? 'hrt' : undefined} restrictToMode={protocolTab as 'pct' | 'fertility' | 'hrt'} />
          )}

          {/* Content: Neuro → inline neurotoxicity */}
          {protocolTab === 'neuro' && (
            <div style={{ paddingBottom: 70 }}>
              <div style={{ marginBottom:12 }}>
                <div style={{ fontSize:11, fontWeight:700, color:'#ec4899', marginBottom:6 }}>🧠 Нейротоксичность — калькулятор</div>
                <div style={{ display:'flex', gap:4, marginBottom:8, overflowX:'auto', scrollbarWidth:'none' }}>
                  {[['calc','🧮 Калькулятор'],['mechanisms','⚙️ Механизмы'],['support','📋 Протокол']].map(([id,label]) => (
                    <button key={id} onClick={() => setNeuroTab(id as any)} style={{
                      padding:'5px 10px', borderRadius:14, fontSize:9, fontWeight:700, whiteSpace:'nowrap', cursor:'pointer', flexShrink:0,
                      background: neuroTab === id ? '#ec4899' : 'var(--bg-secondary)',
                      color: neuroTab === id ? '#000' : 'var(--text-dim)',
                      border: '1px solid ' + (neuroTab === id ? '#ec4899' : 'var(--border)'),
                    }}>{label}</button>
                  ))}
                </div>
                {neuroTab === 'calc' && (
                  <div style={{ background:'var(--bg-secondary)', borderRadius:12, padding:12, marginBottom:8, border:'1px solid var(--border)' }}>
                    {/* Compound selection */}
                    {uniqueCompounds.length > 0 && <div style={{ marginBottom:8 }}>
                      <div style={{ fontSize:10, fontWeight:700, color:'var(--text-light)', marginBottom:4 }}>Выберите соединения из курса:</div>
                      {uniqueCompounds.map(c => (
                        <label key={c.cls} style={{ display:'flex', alignItems:'center', gap:6, padding:'4px 0', fontSize:10, cursor:'pointer' }}>
                          <input type="checkbox" checked={neuroSelected.includes(c.cls)} onChange={() => setNeuroSelected(prev => prev.includes(c.cls) ? prev.filter(x => x !== c.cls) : [...prev, c.cls])} />
                          <span style={{ color:'var(--accent)', fontWeight:600 }}>{c.name}</span>
                          <span style={{ color:'var(--text-dim)', marginLeft:'auto' }}>{c.doseWeekly} мг/нед</span>
                        </label>
                      ))}
                    </div>}
                    {uniqueCompounds.length === 0 && <div style={{ fontSize:10, color:'var(--text-dim)', marginBottom:8, padding:8, background:'rgba(245,158,11,0.08)', borderRadius:6, border:'1px solid rgba(245,158,11,0.2)' }}>⚠ Нет активных соединений. Добавьте препараты в курсе.</div>}
                    {/* Duration / Age inputs */}
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, marginBottom:8 }}>
                      <div><div style={{ fontSize:9, color:'var(--text-dim)', marginBottom:2 }}>Длительность курса (нед)</div><input type="number" value={neuroDuration} onChange={e => setNeuroDuration(Math.max(1, Number(e.target.value)))} style={{ width:'100%', padding:'6px 8px', borderRadius:6, border:'1px solid var(--border)', background:'var(--bg)', color:'var(--text)', fontSize:11 }} /></div>
                      <div><div style={{ fontSize:9, color:'var(--text-dim)', marginBottom:2 }}>Возраст</div><input type="number" value={neuroAge} onChange={e => setNeuroAge(Math.max(18, Number(e.target.value)))} style={{ width:'100%', padding:'6px 8px', borderRadius:6, border:'1px solid var(--border)', background:'var(--bg)', color:'var(--text)', fontSize:11 }} /></div>
                    </div>
                    {/* Score */}
                    <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 10px', borderRadius:8, background:'rgba(236,72,153,0.06)', border:'1px solid rgba(236,72,153,0.15)', marginBottom:8 }}>
                      <span style={{ fontSize:20 }}>🧠</span>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:9, color:'var(--text-dim)' }}>Нейротоксичность</div>
                        <div style={{ fontSize:16, fontWeight:800, color: neuroScore > 70 ? '#ef4444' : neuroScore > 40 ? '#f59e0b' : '#22c55e' }}>{neuroScore}%</div>
                      </div>
                      <div style={{ fontSize:10, color:'var(--text-dim)' }}>{neuroScore > 70 ? '🔴 Высокий риск' : neuroScore > 40 ? '🟡 Средний риск' : '🟢 Низкий риск'}</div>
                    </div>
                    {/* Dose inputs per compound */}
                    {neuroSelected.length > 0 && <div style={{ marginBottom:8 }}>
                      <div style={{ fontSize:9, fontWeight:700, color:'var(--text-light)', marginBottom:4 }}>Дозы (мг/нед):</div>
                      <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                        {neuroSelected.map(cls => <div key={cls} style={{ display:'flex', alignItems:'center', gap:6, fontSize:10 }}><span style={{ width:80, color:'var(--text-dim)' }}>{cls}</span><input type="number" value={neuroDoses[cls] || 0} onChange={e => setNeuroDoses(prev => ({...prev, [cls]: Number(e.target.value)}))} style={{ flex:1, padding:'4px 6px', borderRadius:4, border:'1px solid var(--border)', background:'var(--bg)', color:'var(--text)', fontSize:10 }} /></div>)}
                      </div>
                    </div>}
                  </div>
                )}
                {neuroTab === 'mechanisms' && (
                  <div style={{ background:'var(--bg-secondary)', borderRadius:12, padding:12, marginBottom:8, border:'1px solid var(--border)' }}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#ec4899', marginBottom:6 }}>⚙️ Механизмы нейротоксичности ААС</div>
                    <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                      {[
                        { title:'Гематоэнцефалический барьер (ГЭБ)', desc:'Андрогены повышают проницаемость ГЭБ через下调 клаудинов-5 — нейтрофилы и цитокины проникают в паренхиму' },
                        { title:'Андрогеновые рецепторы (AR)', desc:'AR экспрессируются в гиппокампе, префронтальной коре, миндалине — активация → апоптоз нейронов через каспазу-3' },
                        { title:'Эстрогеновые рецепторы (ER)', desc:'Ароматизация тестостерона в E2 → активация ERβ — нейропротективный эффект. При подавлении ароматазы — утрата защиты' },
                        { title:'Нейровоспаление', desc:'Активация микроглии через TLR4 → IL-6, TNF-α → нейрональное повреждение. 17-α алкилированные оралы — наиболее нейротоксичны' },
                        { title:'Глутаматная эксайтотоксичность', desc:'ААС повышают глутамат в синаптической щели через抑制 EAAT2 → NMDA-рецепторы → Ca2+ influx → митохондриальная дисфункция' },
                        { title:'Митопатический стресс', desc:'Андрогены ингибируют комплекс I-IV дыхательной цепи → ↑ ROS → повреждение митохондриальной ДНК нейронов' },
                      ].map(m => (
                        <div key={m.title} style={{ padding:'8px 10px', borderRadius:8, background:'rgba(236,72,153,0.04)', border:'1px solid rgba(236,72,153,0.08)' }}>
                          <div style={{ fontSize:10, fontWeight:700, color:'#f472b6', marginBottom:2 }}>{m.title}</div>
                          <div style={{ fontSize:9, color:'var(--text-dim)', lineHeight:1.4 }}>{m.desc}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {neuroTab === 'support' && (
                  <div style={{ background:'var(--bg-secondary)', borderRadius:12, padding:12, marginBottom:8, border:'1px solid var(--border)' }}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#22c55e', marginBottom:6 }}>📋 Протокол нейропротекции</div>
                    <div style={{ display:'flex', flexDirection:'column', gap:4, marginBottom:8 }}>
                      {supportStack.map((item, i) => (
                        <div key={i} style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 8px', borderRadius:6, background:'rgba(34,197,94,0.04)', border:'1px solid rgba(34,197,94,0.08)' }}>
                          <span style={{ fontSize:9, color:'var(--accent)', fontWeight:700, minWidth:120 }}>{item.name}</span>
                          <span style={{ fontSize:9, color:'#f59e0b', fontWeight:600 }}>{item.dose} {item.unit}</span>
                          <span style={{ fontSize:8, color:'var(--text-dim)', marginLeft:'auto' }}>{item.timing}</span>
                        </div>
                      ))}
                    </div>
                    <div style={{ fontSize:9, color:'var(--text-dim)', lineHeight:1.4, padding:'6px 8px', borderRadius:6, background:'rgba(239,68,68,0.04)', border:'1px solid rgba(239,68,68,0.1)' }}>
                      ⚠ Дозы зависят от степени нейротоксичности. Титровать под контролем самочувствия и анализов (пролактин, кортизол, ГГТ, АЛТ/АСТ).
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Content: Joints → inline joints */}
          {protocolTab === 'joints' && (
            <div style={{ paddingBottom: 70 }}>
              <div style={{ background:'var(--bg-secondary)', borderRadius:12, padding:12, marginBottom:8, border:'1px solid var(--border)' }}>
                <div style={{ fontSize:11, fontWeight:700, color:'#22c55e', marginBottom:8 }}>🦴 Калькулятор поддержки суставов</div>
                <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:8 }}>
                  <div><div style={{ fontSize:9, color:'var(--text-dim)', marginBottom:2 }}>Боль в суставах (0-10)</div><input type="range" min="0" max="10" value={jointPain} onChange={e => setJointPain(Number(e.target.value))} style={{ width:'100%' }} /><div style={{ fontSize:8, color:'var(--text-dim)', textAlign:'right' }}>{jointPain}/10</div></div>
                  <div><div style={{ fontSize:9, color:'var(--text-dim)', marginBottom:2 }}>История травм (0-5)</div><input type="range" min="0" max="5" value={injuryHistory} onChange={e => setInjuryHistory(Number(e.target.value))} style={{ width:'100%' }} /><div style={{ fontSize:8, color:'var(--text-dim)', textAlign:'right' }}>{injuryHistory}/5</div></div>
                  <div><div style={{ fontSize:9, color:'var(--text-dim)', marginBottom:2 }}>Тренировочная нагрузка (0-5)</div><input type="range" min="0" max="5" value={trainLoad} onChange={e => setTrainLoad(Number(e.target.value))} style={{ width:'100%' }} /><div style={{ fontSize:8, color:'var(--text-dim)', textAlign:'right' }}>{trainLoad}/5</div></div>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 10px', borderRadius:8, background:'rgba(34,197,94,0.06)', border:'1px solid rgba(34,197,94,0.15)' }}>
                  <span style={{ fontSize:20 }}>🦴</span>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:9, color:'var(--text-dim)' }}>Риск проблем с суставами</div>
                    <div style={{ fontSize:16, fontWeight:800, color: jointScore > 70 ? '#ef4444' : jointScore > 40 ? '#f59e0b' : '#22c55e' }}>{jointScore}%</div>
                  </div>
                  <div style={{ fontSize:10, color:'var(--text-dim)' }}>{jointScore > 70 ? '🔴 Высокий' : jointScore > 40 ? '🟡 Средний' : '🟢 Низкий'}</div>
                </div>
                <div style={{ fontSize:9, color:'var(--text-dim)', marginTop:8, lineHeight:1.4, padding:'6px 8px', background:'rgba(245,158,11,0.06)', borderRadius:6, border:'1px solid rgba(245,158,11,0.12)' }}>
                  📋 Протокол: Глюкозамин 1500мг + Хондроитин 1200мг + MSM 3000мг + Коллаген II типа 10г + Босвеллия 500мг + BPC-157 500мкг/д. Курс 8-12 недель.
                </div>
              </div>
            </div>
          )}

          {/* Content: Acne → inline acne */}
          {protocolTab === 'acne' && (
            <div style={{ paddingBottom: 70 }}>
              <div style={{ background:'var(--bg-secondary)', borderRadius:12, padding:12, marginBottom:8, border:'1px solid var(--border)' }}>
                <div style={{ fontSize:11, fontWeight:700, color:'#ef4444', marginBottom:8 }}>🔴 Протокол акне на курсе</div>
                <div style={{ display:'flex', flexDirection:'column', gap:4, marginBottom:8 }}>
                  {['Ниацинамид 500мг 2р/д','Медь 2мг (отдельно от цинка)','Цинк 50мг (пиколинат, на ночь)','Солярий 2р/нед по 5 мин','Клендовит гель локально','Клензит-С (адапален+клиндамицин)','Верошпирон 50мг (только при гормональном акне)'].map((item, i) => (
                    <div key={i} style={{ display:'flex', alignItems:'center', gap:6, padding:'5px 8px', borderRadius:6, background:'rgba(239,68,68,0.04)', border:'1px solid rgba(239,68,68,0.08)' }}>
                      <span style={{ fontSize:10 }}>💊</span>
                      <span style={{ fontSize:9, color:'var(--text-light)' }}>{item}</span>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize:9, color:'var(--text-dim)', lineHeight:1.5 }}>• При Верошпироне — исключить добавки калия<br/>• Солярий ≤ 2 раза/нед по 5 мин<br/>• Клендовит+Клензит-С только локально<br/>• При сильном акне — дерматолог, системные ретиноиды</div>
              </div>
            </div>
          )}

          {/* Content: Peptides → inline peptide calculator */}
          {protocolTab === 'peptides' && (
            <div style={{ paddingBottom: 70 }}>
              <div style={{ background:'var(--bg-secondary)', borderRadius:12, padding:12, marginBottom:8, border:'1px solid var(--border)' }}>
                <div style={{ fontSize:11, fontWeight:700, color:'#a78bfa', marginBottom:6 }}>🧬 Пептидный калькулятор</div>
                <div style={{ display:'flex', gap:4, marginBottom:8, overflowX:'auto', scrollbarWidth:'none' }}>
                  {[['peptides','Пептиды'],['growth','Гормон роста']].map(([id,label]) => (
                    <button key={id} onClick={() => setPepTab(id as any)} style={{
                      padding:'5px 10px', borderRadius:14, fontSize:9, fontWeight:700, whiteSpace:'nowrap', cursor:'pointer', flexShrink:0,
                      background: pepTab === id ? '#a78bfa' : 'var(--bg-secondary)',
                      color: pepTab === id ? '#000' : 'var(--text-dim)',
                      border: '1px solid ' + (pepTab === id ? '#a78bfa' : 'var(--border)'),
                    }}>{label}</button>
                  ))}
                </div>
                {pepTab === 'peptides' && (
                  <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:8 }}>
                    <div><div style={{ fontSize:9, color:'var(--text-dim)', marginBottom:2 }}>Препарат</div><select value={peptideId} onChange={e => setPeptideId(e.target.value)} style={{ width:'100%', padding:'6px 8px', borderRadius:6, border:'1px solid var(--border)', background:'var(--bg)', color:'var(--text)', fontSize:11 }}><option value="cjc1295">CJC-1295 DAC</option><option value="ipamorelin">Ipamorelin</option><option value="ghrp2">GHRP-2</option><option value="ghrp6">GHRP-6</option><option value="hexarelin">Hexarelin</option><option value="tesamorelin">Tesamorelin</option><option value="sermorelin">Sermorelin</option></select></div>
                    <div><div style={{ fontSize:9, color:'var(--text-dim)', marginBottom:2 }}>Количество в флаконе</div><div style={{ display:'flex', gap:4 }}><input type="number" value={pepAmount} onChange={e => setPepAmount(Number(e.target.value))} style={{ flex:1, padding:'6px 8px', borderRadius:6, border:'1px solid var(--border)', background:'var(--bg)', color:'var(--text)', fontSize:11 }} /><select value={pepAmountUnit} onChange={e => setPepAmountUnit(e.target.value as any)} style={{ width:60, padding:'6px 8px', borderRadius:6, border:'1px solid var(--border)', background:'var(--bg)', color:'var(--text)', fontSize:11 }}><option value="mg">мг</option><option value="mcg">мкг</option></select></div></div>
                    <div><div style={{ fontSize:9, color:'var(--text-dim)', marginBottom:2 }}>Объём разведения (мл)</div><input type="number" step="0.1" min="0.1" max="10" value={pepDilution} onChange={e => setPepDilution(Number(e.target.value))} style={{ width:'100%', padding:'6px 8px', borderRadius:6, border:'1px solid var(--border)', background:'var(--bg)', color:'var(--text)', fontSize:11 }} /></div>
                    <div><div style={{ fontSize:9, color:'var(--text-dim)', marginBottom:2 }}>Разовая доза</div><div style={{ display:'flex', gap:4 }}><input type="number" value={pepDose} onChange={e => setPepDose(Number(e.target.value))} style={{ flex:1, padding:'6px 8px', borderRadius:6, border:'1px solid var(--border)', background:'var(--bg)', color:'var(--text)', fontSize:11 }} /><select value={pepDoseUnit} onChange={e => setPepDoseUnit(e.target.value as any)} style={{ width:60, padding:'6px 8px', borderRadius:6, border:'1px solid var(--border)', background:'var(--bg)', color:'var(--text)', fontSize:11 }}><option value="mcg">мкг</option><option value="mg">мг</option></select></div></div>
                    <div><div style={{ fontSize:9, color:'var(--text-dim)', marginBottom:2 }}>Шприц</div><select value={pepSyringe} onChange={e => setPepSyringe(e.target.value)} style={{ width:'100%', padding:'6px 8px', borderRadius:6, border:'1px solid var(--border)', background:'var(--bg)', color:'var(--text)', fontSize:11 }}><option value="U100_1ml">U100 1мл</option><option value="U100_05ml">U100 0.5мл</option><option value="U100_03ml">U100 0.3мл</option><option value="U40_1ml">U40 1мл</option></select></div>
                    <div><div style={{ fontSize:9, color:'var(--text-dim)', marginBottom:2 }}>Путь введения</div><select value={pepRoute} onChange={e => setPepRoute(e.target.value)} style={{ width:'100%', padding:'6px 8px', borderRadius:6, border:'1px solid var(--border)', background:'var(--bg)', color:'var(--text)', fontSize:11 }}><option value="sc">Подкожно (SC)</option><option value="im">Внутримышечно (IM)</option></select></div>
                    <div><div style={{ fontSize:9, color:'var(--text-dim)', marginBottom:2 }}>Длительность (дни)</div><input type="number" min="1" max="365" value={pepTotalDays} onChange={e => setPepTotalDays(Number(e.target.value))} style={{ width:'100%', padding:'6px 8px', borderRadius:6, border:'1px solid var(--border)', background:'var(--bg)', color:'var(--text)', fontSize:11 }} /></div>
                    <div>
                      <div style={{ fontSize:9, color:'var(--text-dim)', marginBottom:4 }}>📅 График дозирования</div>
                      <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                        {['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map(day => {
                          const active = pepSchedule.includes(day);
                          return (<button key={day} onClick={() => setPepSchedule(active ? pepSchedule.filter(d => d !== day) : [...pepSchedule, day])} style={{ padding:'6px 10px', borderRadius:8, fontSize:9, fontWeight:600, cursor:'pointer', background: active ? 'var(--accent)' : 'var(--bg-secondary)', color: active ? '#000' : 'var(--text-dim)', border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}` }}>{day}</button>);
                        })}
                      </div>
                    </div>
                    <button onClick={() => {
                      const pepInfo = PEPTIDE_DB[peptideId];
                      const dilInput: DilutionInput = { amountValue: pepAmount, amountUnit: pepAmountUnit as 'mg' | 'mcg', dilutionVolumeMl: pepDilution, doseValue: pepDose, doseUnit: pepDoseUnit as 'mg' | 'mcg', syringeType: pepSyringe as any };
                      const dilResult = computeDilution(dilInput);
                      const doseMcg = pepDoseUnit === 'mg' ? pepDose * 1000 : pepDose;
                      const bio = pepInfo?.bioavailability?.[pepRoute] || pepInfo?.bioavailability?.sc || { min: 50, max: 80, avg: 65 };
                      const bioResult = computeEffectiveDose(doseMcg, bio);
                      const pkInput: PKInput = { doseMcg, bioAvg: bio.avg, tHalfHours: pepInfo?.tHalfHours || 24, scheduleDays: pepSchedule, totalDays: pepTotalDays };
                      const pkResult = computePK(pkInput);
                      setPepResult({ dilution: dilResult, effective: bioResult, pk: pkResult });
                      const proto = generatePeptideProtocol('muscle_gain');
                      setPepProtocol(proto);
                    }} style={{ padding:'8px', borderRadius:8, border:'none', cursor:'pointer', background:'linear-gradient(135deg,#a78bfa,#7c3aed)', color:'#fff', fontWeight:700, fontSize:11 }}>🧮 РАССЧИТАТЬ</button>
                  </div>
                )}
                {pepTab === 'growth' && (
                  <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:8 }}>
                    <div><div style={{ fontSize:9, color:'var(--text-dim)', marginBottom:2 }}>Препарат ГР</div><select value={growthId || 'jintropin'} onChange={e => setGrowthId(e.target.value)} style={{ width:'100%', padding:'6px 8px', borderRadius:6, border:'1px solid var(--border)', background:'var(--bg)', color:'var(--text)', fontSize:11 }}><option value="jintropin">Джинтропин</option><option value="ansomon">Ансомон</option><option value="hygetropin">Хайгетропин</option><option value="somatin">Соматин</option><option value="neotropin">Неотропин</option></select></div>
                    <div style={{ fontSize:9, color:'var(--text-dim)', padding:'6px 8px', background:'rgba(167,139,250,0.06)', borderRadius:6, border:'1px solid rgba(167,139,250,0.12)' }}>🔄 Данный модуль в разработке. Полный PK/PD калькулятор будет в версии 10.0.</div>
                  </div>
                )}
                {/* Results */}
                {pepResult && (
                  <div style={{ marginTop:8, display:'flex', flexDirection:'column', gap:6 }}>
                    <div style={{ padding:'8px 10px', borderRadius:8, background:'rgba(167,139,250,0.06)', border:'1px solid rgba(167,139,250,0.15)' }}>
                      <div style={{ fontSize:10, fontWeight:700, color:'#c4b5fd', marginBottom:4 }}>💉 Разведение</div>
                      <div style={{ fontSize:9, color:'var(--text-dim)', lineHeight:1.5 }}>Доза: {pepResult.dilution.doseMcg} мкг | Концентрация: {pepResult.dilution.concentrationMcgPerMl} мкг/мл | Объём дозы: {pepResult.dilution.doseVolumeMl.toFixed(2)} мл | Единиц в шприце: {pepResult.dilution.syringeUnitsDisplay} | Доз на флакон: {pepResult.dilution.dosesPerVial.toFixed(1)}</div>
                    </div>
                    <div style={{ padding:'8px 10px', borderRadius:8, background:'rgba(251,191,36,0.06)', border:'1px solid rgba(251,191,36,0.15)' }}>
                      <div style={{ fontSize:10, fontWeight:700, color:'#fcd34d', marginBottom:4 }}>📊 Биодоступность</div>
                      <div style={{ fontSize:9, color:'var(--text-dim)', lineHeight:1.5 }}>Эффективная доза: мин {pepResult.effective.effectiveMinMcg} мкг / средняя {pepResult.effective.effectiveAvgMcg} мкг / макс {pepResult.effective.effectiveMaxMcg} мкг</div>
                    </div>
                    {pepResult.pk && <div style={{ padding:'8px 10px', borderRadius:8, background:'rgba(52,211,153,0.06)', border:'1px solid rgba(52,211,153,0.15)' }}>
                      <div style={{ fontSize:10, fontWeight:700, color:'#34d399', marginBottom:4 }}>📈 Фармакокинетика</div>
                      <div style={{ fontSize:9, color:'var(--text-dim)', lineHeight:1.5 }}>Cmax: {pepResult.pk.maxConcentration.toFixed(1)} | T½: {pepResult.pk.halfLifeDays.toFixed(1)} дн | Cavg: {pepResult.pk.avgConcentration.toFixed(1)} | Равновес: день {pepResult.pk.steadyStateDay}</div>
                    </div>}
                    {pepProtocol && <div style={{ padding:'8px 10px', borderRadius:8, background:'rgba(34,197,94,0.06)', border:'1px solid rgba(34,197,94,0.15)' }}>
                      <div style={{ fontSize:10, fontWeight:700, color:'#4ade80', marginBottom:4 }}>📋 Протокол</div>
                      <div style={{ fontSize:9, color:'var(--text-dim)', lineHeight:1.5 }}>Цель: {pepProtocol.goal} | Синергия: {pepProtocol.synergyScore.toFixed(1)} | Компонентов: {pepProtocol.peptides.length}</div>
                    </div>}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===== NON-MAIN CONTENT ===== */}
      {tab !== 'main' && tab !== 'fertility-pct' && (
        <div style={{ paddingBottom: 16 }}>

      {/* ===== CATALOG ===== */}
      {(section === 'home' || section === 'info') && tab === 'catalog' && (
        <div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 10, alignItems: 'center' }}>
            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Поиск по названию, категориям, механизмам" style={{ flex: 1, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-light)', fontSize: 12 }} />
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 6 }}>
            {searchQuery ? `Найдено: ${groupedSubstances.reduce((a, g) => a + g.count, 0)} из ${catalogSubstances.length}` : `Всего: ${catalogSubstances.length} препаратов`}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: '68vh', overflowY: 'auto', paddingRight: 2 }}>
            {groupedSubstances.map(group => {
              const catInfo = getCategoryInfo(group.cat);
              const isExpanded = expandedCategories[group.cat] ?? (group.count <= 5);
              return (
                <div key={group.cat} style={{ background: 'var(--bg-secondary)', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)' }}>
                  <div onClick={() => setExpandedCategories(prev => ({ ...prev, [group.cat]: !isExpanded }))} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', cursor: 'pointer', userSelect: 'none' }}>
                    <span style={{ fontSize: 16 }}>{catInfo.emoji}</span>
                    <div style={{ flex: 1, fontSize: 12, fontWeight: 700, color: 'var(--text-light)' }}>{catInfo.label}</div>
                    <span style={{ fontSize: 10, color: 'var(--text-dim)', fontWeight: 600, marginRight: 4 }}>{group.count}</span>
                    {(group.classBadges||[]).slice(0,4).map(b => (
                      <span key={b.clsKey} style={{ fontSize:7, padding:'0px 4px', borderRadius:3, background:'rgba(0,230,138,0.08)', color:'#00e68a', fontWeight:600, marginRight:2 }}>{b.emoji}{b.count}</span>
                    ))}
                    <span style={{ fontSize: 10, color: 'var(--text-dim)', transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▼</span>
                  </div>
                  {isExpanded && (
                    <div style={{ borderTop: '1px solid var(--border)' }}>
                      {group.items.map(sub => (
                        <div key={sub.id}>
                          <div onClick={() => setSelectedSub(selectedSub === sub.id ? null : sub.id)} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, padding: '7px 12px 7px 16px', cursor: 'pointer', borderBottom: '1px solid var(--border)' }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-light)', lineHeight: 1.3 }}>{sub.name||(sub.id||'').replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase())}{' '}<span style={{fontSize:8,padding:'0 3px',borderRadius:3,fontWeight:700,color:TIER_LABELS[getSubstanceTier(sub.id)]?.color||'var(--text-dim)',background:(TIER_LABELS[getSubstanceTier(sub.id)]?.color||'var(--text-dim)')+'18'}}>{TIER_LABELS[getSubstanceTier(sub.id)]?.label||'Стд'}</span></div>
                              <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginTop: 2 }}>
                                {(sub.categories||[]).slice(0, 3).map(c => (
                                  <span key={c} style={{ fontSize: 8, padding: '1px 4px', borderRadius: 3, background: 'rgba(255,255,255,0.04)', color: 'var(--text-dim)' }}>{c}</span>
                                ))}
                                {(sub.mechanisms||[]).slice(0, 2).map(m => (
                                  <span key={m} style={{ fontSize: 8, padding: '1px 4px', borderRadius: 3, background: 'rgba(0,230,138,0.06)', color: 'var(--accent-green, #00e68a)' }}>{MECH_LABELS[m] || MECH_TRANSLATIONS_RU[m] || m.slice(0, 30)}</span>
                                ))}
                              </div>
                            </div>
                            <span style={{ fontSize: 10, color: 'var(--text-dim)', transform: selectedSub === sub.id ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>▼</span>
                          </div>
                          {selectedSub === sub.id && (
                            <div style={{ padding: '8px 12px 10px 16px', background: 'rgba(0,0,0,0.15)', borderBottom: '1px solid var(--border)' }}>
                              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.85)', lineHeight: 1.4, marginBottom: 6 }}>{sub.description}</div>
                              {/* Type badge */}
                              <div style={{ fontSize: 8, color: 'var(--accent-green, #00e68a)', marginBottom: 4 }}>
                                {TYPE_LABELS_RU[sub.type] || sub.type || 'Без категории'}{(sub.categories||[]).length > 0 ? ' · ' + (sub.categories||[]).slice(0, 3).join(', ') : ''}
                              </div>
                              {/* All mechanisms */}
                              {sub.mechanisms && sub.mechanisms.length > 0 && (
                                <div style={{ marginBottom: 4 }}>
                                  <div style={{ fontSize: 8, color: 'var(--text-dim)', marginBottom: 2 }}>Механизмы действия:</div>
                                  <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                                    {sub.mechanisms.map((m, i) => (
                                      <span key={i} style={{ fontSize: 8, padding: '2px 6px', borderRadius: 4, background: 'rgba(0,230,138,0.06)', color: '#00e68a' }}>{MECH_LABELS[m] || MECH_TRANSLATIONS_RU[m] || m}</span>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {/* Organs */}
                              {sub.organs && sub.organs.length > 0 && (
                                <div style={{ marginBottom: 4 }}>
                                  <div style={{ fontSize: 8, color: 'var(--text-dim)', marginBottom: 2 }}>Органы-мишени:</div>
                                  <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                                    {[...new Set(sub.organs||[])].map(o => (
                                      <span key={o} style={{ fontSize: 8, padding: '2px 6px', borderRadius: 4, background: 'rgba(59,130,246,0.08)', color: '#60a5fa' }}>{o}</span>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {sub.deficiency && sub.deficiency !== 'NONE' && (
                                <div style={{ fontSize: 9, color: '#f59e0b', marginTop: 2, marginBottom: 4 }}>
                                  Дефицит: {sub.deficiency}
                                </div>
                              )}
                              {/* Cross-referenced interactions with this substance */}
                              {(() => {
                                const subsInteractions = mergedInteractions.filter(i =>
                                  i.substanceA === sub.id || i.substanceB === sub.id
                                ).slice(0, 6);
                                return subsInteractions.length > 0 ? (
                                  <div style={{ marginTop: 4 }}>
                                    <div style={{ fontSize: 8, color: 'var(--text-dim)', marginBottom: 2 }}>Взаимодействия:</div>
                                    {subsInteractions.map(i => {
                                      const isA = i.substanceA === sub.id;
                                      const partner = isA ? i.substanceB : i.substanceA;
                                      const pName = resolveSubName(partner);
                                      const tColor = i.type === 'synergy' ? '#22c55e' : i.type === 'conflict' ? '#ef4444' : '#f59e0b';
                                      return (
                                        <div key={i.interactionId} style={{ fontSize: 8, color: 'var(--text-dim)', padding: '1px 0', lineHeight: 1.3 }}>
                                          <span style={{ color: tColor, fontWeight: 600 }}>
                                            {i.type === 'synergy' ? '⊕' : i.type === 'conflict' ? '⊖' : '⚡'}
                                          </span>
                                          {' '}{pName} — {i.type === 'synergy' ? 'синергия' : i.type === 'conflict' ? 'конфликт' : 'осторожно'}
                                          {i.severity && <span style={{ opacity: 0.6 }}> · {i.severity}</span>}
                                          {i.notes && <div style={{ opacity: 0.5 }}>{i.notes}</div>}
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : null;
                              })()}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            {groupedSubstances.length === 0 && (
              <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-dim)', fontSize: 12 }}>
                Ничего не найдено по запросу "{searchQuery}"
              </div>
            )}
          </div>
        </div>
      )}
        </div>
      )}


      {/* ===== STACKCALC IN CALC VIEW ===== */}
      {section === 'generator' && tab === 'main' && supportView === 'calc' && calcView === 'stackcalc' && (
        <div style={{ padding:'0 0 70px' }}>
          {safeRender('calc_stackcalc', () => {
            const MECH_ROLE_LABELS: Record<string, string> = {
              antioxidant: 'Антиоксидант', anti_inflammatory: 'Противовоспал.', liver_protection: 'Гепатопротектор',
              hepatoprotective: 'Гепатопротектор', kidney_protection: 'Нефропротектор', nephroprotective: 'Нефропротектор',
              neuroprotective: 'Нейропротектор', brain_support: 'Поддержка мозга', cognitive: 'Когнитивный',
              cardio_protection: 'Кардиопротектор', cardioprotective: 'Кардиопротектор', hypotensive: 'Снижает АД',
              lipid_lowering: 'Снижает липиды', endocrine_support: 'Поддержка гормонов', hormonal: 'Гормональный',
              immune_support: 'Иммуномодулятор', immunomodulator: 'Иммуномодулятор', anti_catabolic: 'Антикатаболик',
              anabolic: 'Анаболик', energy: 'Энергия', mitochondrial: 'Митохондрии', adaptogen: 'Адаптоген',
              stress_reduction: 'Стресс-протектор', nootropic: 'Ноотроп', detoxification: 'Детокс',
              anti_estrogenic: 'Антиэстроген', anti_aging: 'Антивозрастной', gastrointestinal: 'Поддержка ЖКТ',
              digestive: 'Пищеварение', probiotic: 'Пробиотик', bone_health: 'Кости', joint_health: 'Суставы',
              skin_health: 'Кожа', hair_health: 'Волосы', blood_sugar: 'Сахар крови', insulin_sensitizer: 'Инсулин.сенс.',
              thyroid_support: 'Щитовидка', eye_health: 'Зрение', respiratory: 'Дыхание', anti_coagulant: 'Антикоагулянт',
              circulation: 'Циркуляция', libido: 'Либидо', testosterone: 'Тестостерон', fertility: 'Фертильность',
              general: 'Общая поддержка', metabolic: 'Метаболизм', sleep: 'Сон', mood: 'Настроение',
              anti_estrogen: 'Антиэстроген', aromatase_inhibitor: 'Ингиб. ароматазы', dopamine: 'Дофамин',
              gaba: 'ГАМК', serotonin: 'Серотонин', glucocorticoid: 'Глюкокортикоид', anticoagulant: 'Антикоагулянт',
              antiplatelet: 'Антиагрегант', vasodilator: 'Вазодилататор', nitric_oxide: 'Оксид азота',
              hpta_support: 'HPTA', liver_detox: 'Детокс печени', bile: 'Желчегонное', pancreatic: 'Поджелудочная',
              gut_health: 'Кишечник', microbiome: 'Микробиом', prebiotic: 'Пребиотик', antimicrobial: 'Антимикробн.',
              antifungal: 'Противогрибк.', antiviral: 'Противовирусн.', anticancer: 'Противораков.',
              chemoprotective: 'Химопротектор', radioprotective: 'Радиопротектор', anti_allergic: 'Антиаллерген',
              antihistamine: 'Антигистамин', expectorant: 'Отхаркивающее', mucolytic: 'Муколитик',
              bronchodilator: 'Бронходилататор', anti_asthmatic: 'Против астмы', anti_arthritic: 'Против артрита',
              analgesic: 'Анальгетик', anti_spasmodic: 'Спазмолитик', muscle_relaxant: 'Миорелаксант',
              wound_healing: 'Заживление', anti_scar: 'Против рубцов', collagen: 'Коллаген',
              anti_cellulite: 'Против целлюлита', lymphatic: 'Лимфа', diuretic: 'Диуретик',
              anti_edema: 'Против отёков', vein_tonic: 'Венотоник', anti_varicose: 'Против варикоза',
              anti_hemorrhoidal: 'Против геморроя', anti_ulcer: 'Против язвы', anti_reflux: 'Против рефлюкса',
              anti_emetic: 'Противорвотн.', anti_nausea: 'Против тошноты', appetite: 'Аппетит',
              anti_obesity: 'Против ожирения', thermogenic: 'Термогеник', fat_burner: 'Жиросжигатель',
              lipolytic: 'Липолитик', anti_lipid: 'Антилипидный', hypoglycemic: 'Гипогликемический',
              anti_diabetic: 'Противодиабетический', anti_glycation: 'Антигликация', anti_cataract: 'Против катаракты',
              anti_glaucoma: 'Против глаукомы', retinal: 'Сетчатка', macular: 'Макула',
              hearing: 'Слух', anti_tinnitus: 'Против шума', anti_vertigo: 'Против головокружения',
              anti_migraine: 'Против мигрени', anti_convulsant: 'Противосудорожн.',
              anti_parkinson: 'Против Паркинсона', anti_alzheimer: 'Против Альцгеймера',
              anti_depressant: 'Антидепрессант', anti_anxiety: 'Против тревоги', anti_psychotic: 'Антипсихотик',
              sedative: 'Седативное', hypnotic: 'Снотворное', stimulant: 'Стимулятор',
              anti_fatigue: 'Против усталости', performance: 'Производительность', endurance: 'Выносливость',
              recovery: 'Восстановление', muscle_building: 'Мышечный рост', strength: 'Сила',
              anti_osteoporotic: 'Против остеопороза', chondroprotective: 'Хондропротектор',
              anti_gout: 'Против подагры', uricosuric: 'Урикозурик', anti_rheumatic: 'Против ревматизма',
              detox: 'Детокс', heavy_metal: 'Тяжёлые металлы', chelation: 'Хелатор',
              anti_radiation: 'Против радиации', anti_mutation: 'Против мутаций', dna_repair: 'ДНК-репарация',
              telomere: 'Теломеры', stem_cell: 'Стволовые клетки', growth_factor: 'Фактор роста',
              anti_apoptotic: 'Антиапоптоз', autophagy: 'Аутофагия', sirtuin: 'Сиртуин', nad: 'NAD+',
              ampk: 'AMPK', mtor: 'mTOR', longevity: 'Долголетие', rejuvenation: 'Омоложение',
              anti_cancer: 'Противораковый', anti_tumor: 'Противоопухолевый', anti_angiogenic: 'Антиангиогенез',
              pro_apoptotic: 'Проапоптоз', anti_metastatic: 'Антиметастатический', anti_mutagenic: 'Антимутагенный',
            };
            const organList = [
              {key:'cardio',label:'❤️ Сердце/Сосуды',organs:['heart','vessels','cardiovascular']},
              {key:'liver',label:'🫁 Печень',organs:['liver','hepatobiliary']},
              {key:'kidney',label:'🫘 Почки',organs:['kidney','renal','urinary']},
              {key:'lung',label:'🫁 Лёгкие',organs:['lung','respiratory']},
              {key:'brain',label:'🧠 Мозг',organs:['brain','cns','neurons','cognitive']},
              {key:'bones',label:'🦴 Кости/Суставы',organs:['bone','joint','skeletal']},
              {key:'skin',label:'✨ Кожа/Волосы',organs:['skin','hair','nails','dermal']},
              {key:'thyroid',label:'🦋 Щитовидка',organs:['thyroid','endocrine']},
              {key:'pancreas',label:'🍬 Поджелудочная',organs:['pancreas','insulin','glucose']},
              {key:'blood',label:'🩸 Кровь',organs:['blood','hematologic','marrow']},
              {key:'immune',label:'🛡 Иммунитет',organs:['immune','lymphatic','thymus']},
              {key:'gi',label:'🫃 ЖКТ',organs:['gi','stomach','intestine','colon','microbiome']},
              {key:'hormones',label:'⚖ Гормоны',organs:['endocrine','adrenal','pituitary','gonads']},
              {key:'male',label:'♂️ Мужское',organs:['prostate','testes','male_reproductive']},
              {key:'female',label:'♀️ Женское',organs:['ovary','uterus','female_reproductive']},
              {key:'antiaging',label:'⏳ Антивозраст',organs:['cells','mitochondria','telomere']},
              {key:'energy',label:'⚡ Энергия',organs:['mitochondria','muscle','metabolic']},
              {key:'recovery',label:'🔄 Восстановление',organs:['muscle','tendon','soft_tissue']},
            ];
            const toggleOrgan = (key:string) => setStackCalcOrgans(prev=>prev.includes(key)?prev.filter(k=>k!==key):[...prev,key]);
            const selectAll = () => setStackCalcOrgans(organList.map(o=>o.key));
            const clearAll = () => { setStackCalcOrgans([]); setStackCalcMech([]); };
            const selectedOrgans = organList.filter(o=>stackCalcOrgans.includes(o.key)).flatMap(o=>o.organs);
            const toggleMech = (m:string) => setStackCalcMech(prev=>prev.includes(m)?prev.filter(x=>x!==m):[...prev,m]);
const [lo,hi]=stackCalcSize.split('-').map(Number);
              const generate = () => {
                const candidates:Array<{sub:typeof ALL_SUBSTANCES[0];score:number;organHits:number;mechHits:number}> = [];
                for (const sub of ALL_SUBSTANCES) {
                  if (!sub.name||!sub.mechanisms||!sub.mechanisms.length) continue;
                  if (sub.mechanisms.length === 1 && (sub.mechanisms[0] === 'general' || sub.mechanisms[0] === 'antioxidant')) continue;
                  let score = 0; let organHits = 0; let mechHits = 0;
                 const subOrgans = ((sub.organs||[]) as string[]).map((o:any)=>(o||'').toLowerCase());
                 if (selectedOrgans.length>0) {
                   for (const o of selectedOrgans) {
                     if (subOrgans.some(so=>so.includes(o.toLowerCase())||o.toLowerCase().includes(so))) { score+=2; organHits++; }
                   }
                 } else { organHits = 1; score += 1; }
                 if (stackCalcMech.length>0) {
                   for (const m of stackCalcMech) {
                     if ((sub.mechanisms||[]).some(sm=>(sm||'').toLowerCase().includes(m.toLowerCase()))) { score+=1; mechHits++; }
                   }
                 } else { mechHits = 1; score += 1; }
                 if (score>0) candidates.push({sub,score,organHits,mechHits});
               }
               candidates.sort((a,b)=>(b.score-a.score) || (Math.random()-0.5));
               const allCandidates = candidates.slice(0, Math.min(50, candidates.length));
               const findSynergies = (subs: string[]) => {
                 const synergies:any[] = []; const conflicts:any[] = [];
                 for (let a=0;a<subs.length;a++) { for (let b=a+1;b<subs.length;b++) {
                   const key = `${subs[a]}||${subs[b]}`;
                   const found = conflictLookup.get(key);
                   if (found&&found.type==='synergy') synergies.push({a:subs[a],b:subs[b],effect:found.effect,severity:found.severity,mechanisms:found.mechanisms||[]});
                   else if (found&&found.type!=='synergy') conflicts.push({a:subs[a],b:subs[b],effect:found.effect,severity:found.severity});
                 }}
                 return {synergies,conflicts};
               };
               const buildStack = (startIdx: number, size: number, tag: string, tagDesc: string) => {
                 const subset = allCandidates.slice(startIdx, startIdx + size);
                 const subs = subset.map(s=>s.sub.id);
                 const {synergies,conflicts} = findSynergies(subs);
                 const allMechs = new Set<string>();
                 subset.forEach(s=>((s.sub.mechanisms||[]) as string[]).forEach((m:any)=>allMechs.add(m)));
                 const totalScore = Math.min(100, Math.round(size*3 + synergies.length*5 - conflicts.length*3));
                 const organNames = stackCalcOrgans.length > 0 ? organList.filter(o=>stackCalcOrgans.includes(o.key)).map(o=>o.label.replace(/^[^\s]+\s/,'')).join(', ') : 'общая поддержка';
                 return { tag, tagDesc, substances: subs, descriptions: subset.map(s=>s.sub.name||s.sub.id), scores: subset.map(s=>s.score), organHits: subset.map(s=>s.organHits), mechHits: subset.map(s=>s.mechHits), synergies, conflicts, mechs: [...allMechs], totalScore, stackDesc: `${tagDesc} для ${organNames}: ${subs.length} веществ, ${synergies.length} синергий, ${conflicts.length} конфликтов. Оценка: ${totalScore}/100`, subDetails: subset.map(s => ({ id: s.sub.id, name: s.sub.name || s.sub.id, mechanisms: (s.sub.mechanisms || []) as string[], description: s.sub.description || '' })) };
               };
               const stacks: any[] = [];
               const [lo2,hi2] = [2, Math.min(hi, Math.max(lo, allCandidates.length))];
               stacks.push(buildStack(0, Math.min(hi2, allCandidates.length), '🎯 Оптимальный', 'Стек с максимальным покрытием'));
               if (allCandidates.length > 5) stacks.push(buildStack(0, Math.min(lo2 + 2, allCandidates.length), '⚡ Минимальный', 'Минимальный набор'));
               if (allCandidates.length > 10) { const midStart = Math.floor(allCandidates.length * 0.2); stacks.push(buildStack(midStart, Math.min(hi2, allCandidates.length - midStart), '🔄 Альтернативный', 'Другие механизмы')); }
               if (allCandidates.length > 3) {
                 const synergyOnly = allCandidates.filter(c => { const subId = c.sub.id; return allCandidates.some(other => other.sub.id !== subId && (conflictLookup.get(`${subId}||${other.sub.id}`)?.type === 'synergy' || conflictLookup.get(`${other.sub.id}||${subId}`)?.type === 'synergy')); });
                 if (synergyOnly.length >= 3) {
                   const synSubs = synergyOnly.slice(0, Math.min(hi, synergyOnly.length));
                   const synIds = synSubs.map(s=>s.sub.id);
                   const {synergies: synS, conflicts: synC} = findSynergies(synIds);
                   const synMechs = new Set<string>(); synSubs.forEach(s=>((s.sub.mechanisms||[]) as string[]).forEach((m:any)=>synMechs.add(m)));
                   stacks.push({ tag: '⊕ Синергетический', tagDesc: 'Максимальное количество синергий', substances: synIds, descriptions: synSubs.map(s=>s.sub.name||s.sub.id), scores: synSubs.map(s=>s.score), organHits: synSubs.map(s=>s.organHits), mechHits: synSubs.map(s=>s.mechHits), synergies: synS, conflicts: synC, mechs: [...synMechs], totalScore: Math.min(100, Math.round(synIds.length*3 + synS.length*8 - synC.length*3)), stackDesc: `Стек с ${synS.length} синергиями — максимальный усилительный эффект`, subDetails: synSubs.map(s => ({ id: s.sub.id, name: s.sub.name || s.sub.id, mechanisms: (s.sub.mechanisms || []) as string[], description: s.sub.description || '' })) });
                 }
               }
               setGeneratedStacks(stacks);
               if (stacks.length > 0) setGeneratedStack(stacks[0]);
             };
            return <div>
              <div style={{fontSize:13,fontWeight:700,color:'var(--accent)',marginBottom:4}}>🧮 Генератор стеков</div>
              <div style={{fontSize:9,color:'var(--text-dim)',marginBottom:6}}>Выберите органы, механизмы и размер — стек генерируется из базы веществ поддержки с учётом синергий и конфликтов</div>
              <div style={{marginBottom:6}}>
                <div style={{display:'flex',alignItems:'center',gap:4,marginBottom:3}}>
                  <span style={{fontSize:9,fontWeight:600,color:'var(--text-light)'}}>Органы:</span>
                  <button onClick={selectAll} style={{fontSize:7,padding:'2px 6px',borderRadius:4,cursor:'pointer',background:'rgba(0,230,138,0.1)',border:'1px solid rgba(0,230,138,0.2)',color:'#00e68a'}}>Все</button>
                  {stackCalcOrgans.length>0&&<button onClick={clearAll} style={{fontSize:7,padding:'2px 6px',borderRadius:4,cursor:'pointer',background:'rgba(239,68,68,0.08)',border:'1px solid rgba(239,68,68,0.15)',color:'#f87171'}}>✕</button>}
                  <span style={{fontSize:8,color:'var(--text-dim)',marginLeft:4}}>{stackCalcOrgans.length}/{organList.length}</span>
                </div>
                <div style={{display:'flex',flexWrap:'wrap',gap:3}}>
                  {organList.map(o=><button key={o.key} onClick={()=>toggleOrgan(o.key)} style={{padding:'2px 5px',borderRadius:6,fontSize:7,cursor:'pointer',whiteSpace:'nowrap',background:stackCalcOrgans.includes(o.key)?'var(--accent)':'var(--bg-secondary)',color:stackCalcOrgans.includes(o.key)?'#000':'var(--text-dim)',border:`1px solid ${stackCalcOrgans.includes(o.key)?'var(--accent)':'var(--border)'}`}}>{o.label}</button>)}
                </div>
              </div>
              {stackCalcOrgans.length > 0 && availableMechs.length>0&&<div style={{marginBottom:6}}>
                <div style={{fontSize:9,fontWeight:600,color:'var(--text-light)',marginBottom:3}}>Механизмы ({availableMechs.length}):</div>
                <div style={{display:'flex',flexWrap:'wrap',gap:3}}>
                  {availableMechs.slice(0,40).map(m=><button key={m} onClick={()=>toggleMech(m)} style={{padding:'1px 4px',borderRadius:6,fontSize:6,cursor:'pointer',whiteSpace:'nowrap',background:stackCalcMech.includes(m)?'#8b5cf6':'var(--bg-secondary)',color:stackCalcMech.includes(m)?'#fff':'var(--text-dim)',border:`1px solid ${stackCalcMech.includes(m)?'#8b5cf6':'var(--border)'}`}}>{MECH_TRANSLATIONS_RU[m] || m}</button>)}
                </div>
              </div>}
              {stackCalcOrgans.length === 0 && (
                <div style={{marginBottom:6,padding:8,borderRadius:8,background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.06)',textAlign:'center',fontSize:9,color:'var(--text-dim)'}}>
                  Выберите орган для отображения механизмов
                </div>
              )}
              <div style={{display:'flex',gap:6,alignItems:'center',marginBottom:4}}>
                <span style={{fontSize:9,fontWeight:600,color:'var(--text-light)'}}>Размер:</span>
                {['2-4','5-7','8-10','11-15','15-20','20-25','30-35'].map(s=><button key={s} onClick={()=>setStackCalcSize(s)} style={{padding:'2px 5px',borderRadius:6,fontSize:7,cursor:'pointer',background:stackCalcSize===s?'var(--accent)':'var(--bg-secondary)',color:stackCalcSize===s?'#000':'var(--text-dim)',border:`1px solid ${stackCalcSize===s?'var(--accent)':'var(--border)'}`}}>{s}</button>)}
              </div>
              <button onClick={generate} style={{width:'100%',padding:'10px',borderRadius:12,fontWeight:800,fontSize:14,cursor:'pointer',background:'var(--accent)',border:'none',color:'#000',marginBottom:6}}>⚡ Сгенерировать</button>
              {generatedStacks.length > 0 && (
                <div style={{marginBottom:6}}>
                  <div style={{display:'flex',gap:4,overflowX:'auto',marginBottom:4}}>
                    {generatedStacks.map((st:any,si:number)=>(
                      <button key={si} onClick={()=>setGeneratedStack(st)} style={{padding:'3px 8px',borderRadius:8,fontSize:8,fontWeight:600,cursor:'pointer',whiteSpace:'nowrap',background:generatedStack===st?'var(--accent)':'var(--bg-secondary)',color:generatedStack===st?'#000':'var(--text-dim)',border:`1px solid ${generatedStack===st?'var(--accent)':'var(--border)'}`}}>
                        {st.tag} · {st.substances.length} шт
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {generatedStack&&<div style={{background:'rgba(0,230,138,0.04)',borderRadius:10,padding:8,border:'1px solid rgba(0,230,138,0.12)'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:3}}>
                  <div style={{fontSize:11,fontWeight:700,color:'var(--accent)'}}>{generatedStack.tag || 'Стек'} · {generatedStack.substances.length} веществ</div>
                  <div style={{fontSize:10,fontWeight:700,padding:'2px 8px',borderRadius:6,background:generatedStack.totalScore>=70?'rgba(34,197,94,0.12)':generatedStack.totalScore>=40?'rgba(234,179,8,0.12)':'rgba(239,68,68,0.12)',color:generatedStack.totalScore>=70?'#4ade80':generatedStack.totalScore>=40?'#facc15':'#f87171'}}>{generatedStack.totalScore}/100</div>
                </div>
                {generatedStack.stackDesc && <div style={{fontSize:8,color:'var(--text-dim)',marginBottom:4,lineHeight:1.4}}>{generatedStack.stackDesc}</div>}
                <div style={{display:'flex',flexWrap:'wrap',gap:3,marginBottom:4}}>
                  {generatedStack.descriptions.map((n:string,i:number)=><span key={i} style={{fontSize:8,padding:'2px 8px',borderRadius:6,background:'rgba(139,92,246,0.1)',color:'#a78bfa',border:'1px solid rgba(139,92,246,0.15)'}}>{n}<span style={{marginLeft:3,opacity:0.5,fontSize:7}}>+{generatedStack.scores[i]}</span></span>)}
                </div>
                {generatedStack.subDetails && generatedStack.subDetails.length > 0 && (
                  <details style={{marginBottom:4}}>
                    <summary style={{fontSize:8,fontWeight:600,color:'var(--text-light)',cursor:'pointer',marginBottom:3}}>📋 Детали веществ ({generatedStack.subDetails.length})</summary>
                    <div style={{display:'flex',flexDirection:'column',gap:3}}>
                      {generatedStack.subDetails.map((sd:any,si:number)=>(
                        <div key={si} style={{padding:'4px 8px',borderRadius:6,background:'var(--bg-secondary)',border:'1px solid var(--border)'}}>
                          <div style={{fontSize:9,fontWeight:600,color:'var(--text-light)',marginBottom:2}}>{sd.name}</div>
                          <div style={{display:'flex',flexWrap:'wrap',gap:2,marginBottom:2}}>
                            {sd.mechanisms && sd.mechanisms.length > 0 && sd.mechanisms.slice(0,3).map((m:string,mi:number)=>{
                              const role = MECH_ROLE_LABELS[m.toLowerCase().replace(/\s+/g,'_')] || MECH_ROLE_LABELS[m] || '';
                              return <span key={mi} style={{fontSize:7,padding:'1px 5px',borderRadius:4,background:role?'rgba(0,230,138,0.1)':'rgba(139,92,246,0.08)',color:role?'#00e68a':'#a78bfa',fontWeight:role?600:400}}>{role || MECH_TRANSLATIONS_RU[m] || m}</span>;
                            })}
                          </div>
                          {sd.description && <div style={{fontSize:7,color:'var(--text-dim)',lineHeight:1.3}}>{sd.description}</div>}
                        </div>
                      ))}
                    </div>
                  </details>
                )}
                {generatedStack.mechs.length>0&&<div style={{marginBottom:3}}><div style={{fontSize:7,fontWeight:600,color:'var(--text-dim)',marginBottom:2}}>⚙️ Механизмы:</div><div style={{display:'flex',flexWrap:'wrap',gap:2}}>{generatedStack.mechs.map((m:string,i:number)=><span key={i} style={{fontSize:6,padding:'1px 4px',borderRadius:3,background:'rgba(139,92,246,0.08)',color:'#a78bfa'}}>{MECH_TRANSLATIONS_RU[m] || m}</span>)}</div></div>}
                {generatedStack.synergies.length>0&&<details style={{marginBottom:3}}><summary style={{fontSize:7,fontWeight:600,color:'#22c55e',cursor:'pointer'}}>⊕ Синергии ({generatedStack.synergies.length})</summary>{generatedStack.synergies.map((s:any,i:number)=><div key={i} style={{fontSize:7,color:'var(--text-dim)',padding:'2px 0'}}><b style={{color:'#4ade80'}}>{getStackSubLabel(s.a)} + {getStackSubLabel(s.b)}</b>: {s.effect} [{s.severity}]{s.mechanisms&&s.mechanisms.length>0&&<span style={{fontSize:6,color:'#a78bfa',marginLeft:4}}>→ {s.mechanisms.map((mx: string) => MECH_TRANSLATIONS_RU[mx] || mx).join(', ')}</span>}</div>)}</details>}
                {generatedStack.conflicts.length>0&&<details><summary style={{fontSize:7,fontWeight:600,color:'#ef4444',cursor:'pointer'}}>⚠ Конфликты ({generatedStack.conflicts.length})</summary>{generatedStack.conflicts.map((c:any,i:number)=><div key={i} style={{fontSize:7,color:'#f87171',padding:'2px 0'}}><b>{getStackSubLabel(c.a)} + {getStackSubLabel(c.b)}</b>: {c.effect} [{c.severity}]</div>)}</details>}
              </div>}
              {!generatedStack&&stackCalcOrgans.length===0&&<div style={{padding:20,textAlign:'center',color:'var(--text-dim)',fontSize:10,background:'var(--bg-secondary)',borderRadius:10,border:'1px solid var(--border)'}}>Выберите органы/системы и нажмите «Сгенерировать»</div>}
            </div>;
          })}
        </div>
      )}

      {/* ===== MYSTACKS IN CALC VIEW ===== */}
      {section === 'generator' && tab === 'main' && supportView === 'calc' && calcView === 'mystacks' && (
        <div style={{ padding:'0 0 80px' }}>
          <h2 style={{ margin:'0 0 6px', fontSize:16, fontWeight:800, color:'var(--accent)' }}>📂 Мои стеки</h2>
          <p style={{ fontSize:10, color:'var(--text-dim)', margin:'0 0 12px' }}>Сохранённые стеки поддержки из калькулятора. Выберите уровень, рассчитайте и сохраните.</p>
          <div className="card" style={{ marginBottom:10, padding:10 }}>
            <h4 style={{ margin:'0 0 6px', fontSize:12, color:'var(--text)' }}>💾 Сохранить текущий стек</h4>
            <div style={{ display:'flex', gap:6 }}>
              <input value={stackName} onChange={e=>setStackName(e.target.value)} placeholder="Название стека..."
                style={{ flex:1, padding:'6px 10px', borderRadius:8, border:'1px solid var(--border)', background:'var(--bg-secondary)', color:'var(--text)', fontSize:10 }} />
              <button onClick={saveCurrentStack} style={{ padding:'6px 12px', borderRadius:8, border:'none', cursor:'pointer', background:'linear-gradient(135deg, #00e68a, #00c853)', color:'#000', fontWeight:700, fontSize:10 }}>
                Сохранить ({SUPPORT_LEVELS[supportLevel]?.subs?.length || 0} шт)
              </button>
            </div>
          </div>
          {savedStacks.length === 0 ? (
            <div className="card" style={{ textAlign:'center', padding:24 }}>
              <div style={{ fontSize:28, marginBottom:6 }}>📂</div>
              <div style={{ fontSize:12, color:'var(--text-dim)' }}>Нет сохранённых стеков</div>
              <div style={{ fontSize:9, color:'var(--text-dim)', marginTop:4 }}>Рассчитайте стек в калькуляторе и нажмите «Сохранить»</div>
            </div>
          ) : (
            savedStacks.map(stack => {
              const isExpanded = expandedStack === stack.id;
              return (
                <div key={stack.id} style={{ marginBottom:8, background:'var(--bg-secondary)', borderRadius:10, border:'1px solid var(--border)', overflow:'hidden' }}>
                  <div onClick={() => setExpandedStack(isExpanded ? null : stack.id)} style={{ padding:'10px 12px', cursor:'pointer', display:'flex', justifyContent:'space-between', alignItems:'flex-start', borderBottom: isExpanded ? '1px solid var(--border)' : 'none' }}>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:12, fontWeight:700, color:'var(--accent)' }}>{stack.name}</div>
                      <div style={{ fontSize:8, color:'var(--text-dim)', marginTop:1 }}>{new Date(stack.date).toLocaleDateString('ru')} · {stack.subs.length} добавок</div>
                      {(stack as any).description && <div style={{ fontSize:8, color:'var(--text-dim)', marginTop:2, lineHeight:1.3 }}>{(stack as any).description}</div>}
                    </div>
                    <span style={{ fontSize:12, color:'var(--text-dim)', flexShrink:0 }}>{isExpanded ? '▲' : '▼'}</span>
                  </div>
                  {isExpanded && (
                    <div style={{ padding:'0 12px 10px' }}>
                      {/* Notes editing */}
                      {editingStackNotes === stack.id ? (
                        <div style={{ marginBottom:6, display:'flex', gap:3 }}>
                          <input value={editNotesText} onChange={e => setEditNotesText(e.target.value)} placeholder="Заметка к стеку..."
                            style={{ flex:1, padding:'3px 6px', borderRadius:4, border:'1px solid var(--border)', background:'var(--bg-primary)', color:'var(--text)', fontSize:8 }} />
                          <button onClick={() => {
                            const updated = savedStacks.map(s => s.id === stack.id ? { ...s, notes: editNotesText } : s);
                            setSavedStacks(updated);
                            localStorage.setItem('savedStacks', JSON.stringify(updated));
                            setEditingStackNotes(null);
                          }} style={{ padding:'3px 6px', borderRadius:4, border:'none', cursor:'pointer', background:'var(--accent)', color:'#000', fontWeight:700, fontSize:8 }}>OK</button>
                        </div>
                      ) : (
                        stack.notes && <div style={{ fontSize:8, color:'var(--text-dim)', marginBottom:6, padding:'3px 6px', borderRadius:4, background:'rgba(255,255,255,0.03)', border:'1px solid var(--border)' }}>📝 {stack.notes}</div>
                      )}

                      {/* Full substance list with descriptions */}
                      <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
                        {stack.subs.map(id => {
                          const sub = ALL_SUBSTANCES.find(s => s.id === id);
                          const pharma = PHARMA_DB[id];
                          const name = sub?.name || pharma?.name || id.replace(/_/g, ' ');
                          const dosage = stack.dosages?.[id];
                          const description = sub?.description || pharma?.description || '';
                          return (
                            <div key={id} style={{ padding:'5px 8px', borderRadius:6, background:'rgba(139,92,246,0.05)', border:'1px solid rgba(139,92,246,0.1)' }}>
                              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                                <span style={{ fontSize:10, fontWeight:600, color:'var(--text-light)' }}>{name}</span>
                                {dosage && <span style={{ fontSize:9, color:'#00e68a' }}>{dosage.mg >= 1000 && id !== 'omega3' ? `${(dosage.mg/1000).toFixed(dosage.mg%1000===0?0:1)}г` : `${dosage.mg}мг`}</span>}
                              </div>
                              {description && <div style={{ fontSize:8, color:'var(--text-dim)', marginTop:2, lineHeight:1.3 }}>{description}</div>}
                              {sub?.mechanisms && sub.mechanisms.length > 0 && (
                                <div style={{ display:'flex', flexWrap:'wrap', gap:2, marginTop:2 }}>
                                  {sub.mechanisms.slice(0,3).map((m: string) => (
                                    <span key={m} style={{ fontSize:7, padding:'1px 4px', borderRadius:3, background:'rgba(139,92,246,0.1)', color:'#8b5cf6' }}>{m}</span>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Action buttons */}
                      <div style={{ display:'flex', gap:4, marginTop:8 }}>
                        <button onClick={() => { setEditingStackNotes(editingStackNotes === stack.id ? null : stack.id); setEditNotesText(stack.notes || ''); }} style={{ padding:'4px 8px', borderRadius:6, fontSize:8, cursor:'pointer', background:'rgba(139,92,246,0.1)', border:'1px solid rgba(139,92,246,0.3)', color:'#a78bfa', fontWeight:600 }}>✏️ Редактировать</button>
                        <button onClick={() => {
                          const items = stack.subs.map((id: string) => {
                            const sub = ALL_SUBSTANCES.find(s => s.id === id);
                            const d = stack.dosages?.[id];
                            return { id, name: sub?.name || id, dose: d?.mg || 0, timing: d?.timing || '' };
                          });
                          const existing = JSON.parse(localStorage.getItem('supportCart') || '[]');
                          localStorage.setItem('supportCart', JSON.stringify([...existing, ...items]));
                          setCartItems([...cartItems, ...items]);
                          alert('✅ Добавлено в корзину');
                        }} style={{ padding:'4px 8px', borderRadius:6, fontSize:8, cursor:'pointer', background:'rgba(255,152,0,0.1)', border:'1px solid rgba(255,152,0,0.3)', color:'#ff9800', fontWeight:600 }}>🛒 В корзину</button>
                        <button onClick={() => deleteStack(stack.id)} style={{ padding:'4px 8px', borderRadius:6, fontSize:8, cursor:'pointer', background:'rgba(239,68,68,0.05)', border:'1px solid rgba(239,68,68,0.2)', color:'#ef4444', fontWeight:600, marginLeft:'auto' }}>✕ Удалить</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ===== MIX CALCULATOR: Training Mix ===== */}
      {section === 'home' && tab === 'main' && supportView === 'calc' && calcView === 'mixcalc' && (
        <div style={{ padding:'0 0 80px', display:'flex', flexDirection:'column' }}>
          <div style={{ flex:1, overflowY:'auto', paddingRight:4 }}>
            <h2 style={{ margin:'0 0 2px', fontSize:16, fontWeight:800, color:'var(--accent)' }}>⚡ Миксы для тренировки</h2>
            <p style={{ fontSize:10, color:'var(--text-dim)', margin:'0 0 12px' }}>Калькулятор пре-/интра-/пост-тренировочных стеков</p>

            {/* --- Parameters --- */}
            <div className="card" style={{ marginBottom:10, padding:10 }}>
              <h4 style={{ margin:'0 0 8px', fontSize:11, color:'var(--text)' }}>🎯 Параметры</h4>
              <div style={{ display:'flex', gap:6, marginBottom:8, flexWrap:'wrap' }}>
                <div style={{ flex:'1 1 45%', minWidth:100 }}>
                  <div style={{ fontSize:8, color:'var(--text-dim)', marginBottom:3 }}>Цель</div>
                  <select value={mixGoal} onChange={e=>setMixGoal(e.target.value)} style={{ width:'100%', padding:'6px 8px', borderRadius:6, border:'1px solid var(--border)', background:'var(--bg-secondary)', color:'var(--text)', fontSize:10 }}>
                    <option value="pump">💪 Памп</option>
                    <option value="endurance">🏃 Выносливость</option>
                    <option value="strength">🏋️ Сила</option>
                    <option value="recovery">🔄 Восстановление</option>
                    <option value="focus">🧠 Фокус</option>
                  </select>
                </div>
                <div style={{ flex:'1 1 45%', minWidth:100 }}>
                  <div style={{ fontSize:8, color:'var(--text-dim)', marginBottom:3 }}>Время приёма</div>
                  <select value={mixTiming} onChange={e=>setMixTiming(e.target.value)} style={{ width:'100%', padding:'6px 8px', borderRadius:6, border:'1px solid var(--border)', background:'var(--bg-secondary)', color:'var(--text)', fontSize:10 }}>
                    <option value="pre">⚡ Пре-тренировка</option>
                    <option value="intra">💧 Интра-тренировка</option>
                    <option value="post">🍗 Пост-тренировка</option>
                  </select>
                </div>
              </div>
              <div style={{ marginBottom:8 }}>
                <div style={{ fontSize:8, color:'var(--text-dim)', marginBottom:3 }}>Вес тела (кг)</div>
                <input type="number" value={linked.profile?.settings?.weight ?? 80} readOnly
                  style={{ width:'100%', padding:'6px 8px', borderRadius:6, border:'1px solid var(--border)', background:'var(--bg-secondary)', color:'var(--text)', fontSize:10, boxSizing:'border-box' }} />
              </div>
              {(() => {
                const hasCourse = (linked.course || []).length > 0;
                const isOnCycle = hasCourse;
                const bw = linked.profile?.settings?.weight ?? 80;
                const multiplier = isOnCycle ? 1.25 : 1.0;
                const isPre = mixTiming === 'pre';
                const isIntra = mixTiming === 'intra';
                const isPost = mixTiming === 'post';

                const preStack = [
                  { name:'Кофеин (безводный)', dose: `${(Math.min(6, 3 + (mixGoal==='focus'?3:0) + (mixGoal==='endurance'?1:0)) * bw * multiplier / 1000).toFixed(2)} г`, note:'За 30-45 мин до. Стимуляция ЦНС, липолиз' },
                  { name:'L-Цитруллин малат', dose: `${(8 * multiplier).toFixed(1)} г`, note:'За 45-60 мин до. Оксид азота, памп' },
                  { name:'Бета-аланин', dose:'3.2 г', note:'За 30 мин до. Буфер молочной кислоты' },
                  { name:'L-Аргинин (опционально)', dose:`${(5 * multiplier).toFixed(1)} г`, note:'За 30 мин до. Усиливает памп' },
                  { name:'L-Тирозин', dose:`${(2 * multiplier).toFixed(1)} г`, note:'За 30 мин до. Фокус, дофамин' },
                  { name:'Таурин', dose:`${(2 * multiplier).toFixed(1)} г`, note:'За 30 мин до. Осморегуляция, антиоксидант' },
                ];

                const durationHrs = mixGoal === 'endurance' ? 2 : 1.5;
                const intraStack = [
                  { name:'Натрий (Na⁺)', dose: `${Math.round(750 * durationHrs)} мг`, note:'Каждые 15-20 мин с водой. Гидратация' },
                  { name:'Калий (K⁺)', dose: `${Math.round(300 * durationHrs)} мг`, note:'Каждые 15-20 мин. Предотвращение судорог' },
                  { name:'Магний (Mg²⁺)', dose: `${Math.round(150 * durationHrs)} мг`, note:'Каждые 30 мин. Судороги, расслабление' },
                  { name:'Циклический декстрин (HBCD)', dose: `${Math.round(45 * durationHrs)} г`, note:'Каждые 15-20 мин. Быстрый углевод, низкий GI' },
                  { name:'EAA (BCAA 2:1:1)', dose: `${(10 * multiplier).toFixed(1)} г`, note:'Каждые 30 мин. Анти-катаболизм' },
                  { name:'L-Глютамин', dose:`${(5 * multiplier).toFixed(1)} г`, note:'Каждые 30 мин. Кишечник, иммунитет' },
                ];

                const postStack = [
                  { name:'Сывороточный протеин (изолят)', dose: `${(0.4 * bw).toFixed(0)} г`, note:'Сразу после. Быстрое усвоение' },
                  { name:'Креатин моногидрат', dose:'5 г', note:'Сразу после. Восполнение фосфокреатина' },
                  { name:'HMB (β-гидрокси-β-метилбутират)', dose: isOnCycle ? '3 г' : '— (натуральный тренинг)', note:'Сразу после. Анти-катаболизм' },
                  { name:'L-Глютамин', dose:`${(5 * multiplier).toFixed(0)} г`, note:'Сразу после. Иммунитет, гликоген' },
                  { name:'Цинк + Магний (ZMA)', dose:'30 мг Zn + 450 мг Mg', note:'За 30-60 мин до сна. Тестостерон, сон' },
                  { name:'Витамин C', dose:'500 мг', note:'Сразу после. Кортизол, антиоксидант' },
                ];

                const activeStack = isPre ? preStack : isIntra ? intraStack : postStack;
                const stackTitle = isPre ? '⚡ Пре-тренировочный стек' : isIntra ? '💧 Интра-тренировочный стек' : '🍗 Пост-тренировочный стек';
                const timingLabel = isPre ? 'За 30-60 мин до тренировки' : isIntra ? 'Во время тренировки (каждые 15-20 мин)' : 'Сразу после тренировки';

                const glycemicCompounds = ['HGH','insulin','metformin','berberine','semaglutide','tirzepatide'];
                const userGlycemic = (linked.course || []).filter(c => glycemicCompounds.some(g => (c.substanceId||'').toLowerCase().includes(g.toLowerCase())));
                const hasGlycemic = userGlycemic.length > 0;

                return (<>
                  {isOnCycle && (
                    <div style={{ padding:'6px 8px', borderRadius:6, background:'rgba(139,92,246,0.08)', border:'1px solid rgba(139,92,246,0.2)', fontSize:9, color:'#a78bfa', marginBottom:8 }}>
                      🔬 На курсе: дозы повышены ×{multiplier}. Активные вещества: {(linked.course||[]).map(c=>c.substanceId).join(', ')}
                    </div>
                  )}

                  {/* Stack Card */}
                  <div className="card" style={{ marginBottom:10, padding:12, background:'linear-gradient(135deg, rgba(0,230,138,0.04), rgba(139,92,246,0.04))', border:'1px solid var(--glass-border)' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                      <span style={{ fontSize:18 }}>{isPre ? '⚡' : isIntra ? '💧' : '🍗'}</span>
                      <div>
                        <div style={{ fontSize:12, fontWeight:700, color:'var(--accent)' }}>{stackTitle}</div>
                        <div style={{ fontSize:8, color:'var(--text-dim)' }}>{timingLabel}</div>
                      </div>
                      {isOnCycle && <span style={{ marginLeft:'auto', fontSize:8, padding:'2px 6px', borderRadius:4, background:'rgba(139,92,246,0.15)', color:'#a78bfa' }}>×{multiplier}</span>}
                    </div>

                    <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                      {activeStack.map((item,i)=>(
                        <div key={i} style={{ display:'flex', alignItems:'center', gap:8 }}>
                          <div style={{ width:6, height:6, borderRadius:'50%', background:'var(--accent)', flexShrink:0 }} />
                          <div style={{ flex:1, fontSize:10 }}>
                            <span style={{ color:'var(--text-light)' }}>{item.name}</span>
                            <span style={{ color:'var(--text-dim)', fontSize:8, marginLeft:4 }}>— {item.note}</span>
                          </div>
                          <span style={{ fontSize:10, fontWeight:600, color:'#00e68a', whiteSpace:'nowrap' }}>{item.dose}</span>
                          <button onClick={() => { const id = resolveProtoId(item.name); if (id && !enhancedSubs.includes(id)) setEnhancedSubs(prev => [...prev, id]); }} style={{ padding:'2px 8px', borderRadius:6, fontSize:8, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap', background:'rgba(0,230,138,0.08)', border:'1px solid rgba(0,230,138,0.2)', color:'rgba(0,230,138,0.7)' }}>+ Стек</button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Glycemic interactions note */}
                  {hasGlycemic && isIntra && (
                    <div className="card" style={{ padding:10, marginBottom:8, background:'rgba(239,68,68,0.04)', border:'1px solid rgba(239,68,68,0.15)' }}>
                      <div style={{ fontSize:10, fontWeight:700, color:'#f87171', marginBottom:4 }}>⚠ Внимание: гликемические взаимодействия</div>
                      <div style={{ fontSize:9, color:'var(--text-dim)', lineHeight:1.4 }}>
                        У вас на курсе: <b>{userGlycemic.map(c=>c.substanceId).join(', ')}</b>. Эти вещества влияют на уровень глюкозы в крови.
                        Контролируйте глюкометром уровень сахара каждые 30 мин. При гипогликемии — увеличьте дозу HBCD на 15-20 г.
                        Рассмотрите замену HBCD на мальтодекстрин с более высоким GI для быстрого подъёма глюкозы.
                      </div>
                    </div>
                  )}

                  {/* All stacks overview */}
                  <div className="card" style={{ padding:10, marginBottom:8 }}>
                    <h4 style={{ margin:'0 0 6px', fontSize:11, color:'var(--text)' }}>📋 Все три стека (обзор)</h4>
                    <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                      {[
                        { label:'⚡ Пре', items:preStack.slice(0,4).map(i=>`${i.name.split('(')[0].trim()}: ${i.dose}`).join(' · ') },
                        { label:'💧 Интра', items:intraStack.slice(0,4).map(i=>`${i.name.split('(')[0].trim()}: ${i.dose}`).join(' · ') },
                        { label:'🍗 Пост', items:postStack.slice(0,4).map(i=>`${i.name.split('(')[0].trim()}: ${i.dose}`).join(' · ') },
                      ].map((grp, gi) => (
                        <div key={gi} style={{ padding:'8px 10px', borderRadius:8, background:'var(--bg-secondary)', border:'1px solid var(--border)' }}>
                          <div style={{ fontSize:10, fontWeight:700, color:'var(--accent)', marginBottom:3 }}>{grp.label}-тренировочный</div>
                          <div style={{ fontSize:8, color:'var(--text-dim)', lineHeight:1.4 }}>{grp.items}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Peptide/GH/Insulin inputs */}
                  <div className="card" style={{ padding:12, marginBottom:8, border:'1px solid rgba(236,72,153,0.2)' }}>
                    <h4 style={{ margin:'0 0 8px', fontSize:11, color:'#ec4899' }}>💉 Пептиды/Гормоны к тренировке</h4>
                    <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                      {[
                        { key:'insulin', label:'Инсулин', val:mixInsulin, set:setMixInsulin, timing:mixInsulinTiming, setTiming:setMixInsulinTiming, defaultUnit:'ЕД', note:'Только под глюкометром! +30г быстрых углеводов' },
                        { key:'mgf', label:'MGF (PEG-MGF)', val:mixMGF, set:setMixMGF, timing:mixMGFTiming, setTiming:setMixMGFTiming, defaultUnit:'мкг', note:'Локально в целевую мышцу за 15 мин до тренировки' },
                        { key:'igf', label:'IGF-1 (LR3/DES)', val:mixIGF, set:setMixIGF, timing:mixIGFTiming, setTiming:setMixIGFTiming, defaultUnit:'мкг', note:'Системно/локально. DES — немедленно, LR3 — за 20 мин' },
                        { key:'gh', label:'ГР (HGH/rHGH)', val:mixGH, set:setMixGH, timing:mixGHTiming, setTiming:setMixGHTiming, defaultUnit:'МЕ', note:'За 30-60 мин до для жиросжигания. Пост — для восстановления' },
                      ].map((p) => (
                        <div key={p.key} style={{ padding:'8px 10px', borderRadius:8, background:'rgba(236,72,153,0.04)', border:'1px solid rgba(236,72,153,0.1)' }}>
                          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
                            <span style={{ fontSize:10, fontWeight:700, color:'var(--text-light)' }}>{p.label}</span>
                            <div style={{ display:'flex', gap:4, alignItems:'center' }}>
                              <span style={{ fontSize:8, color:'var(--text-dim)' }}>{p.defaultUnit}</span>
                              <input type="number" min="0" max="100" step="0.5" value={p.val} onChange={e => p.set(Math.max(0, Number(e.target.value) || 0))} placeholder="0" style={{ width:60, padding:'4px 6px', borderRadius:4, border:'1px solid var(--border)', background:'var(--bg-primary)', color:'var(--text)', fontSize:10, textAlign:'center' }} />
                            </div>
                          </div>
                          <div style={{ display:'flex', gap:4 }}>
                            <button onClick={() => p.setTiming('pre')} style={{ padding:'2px 8px', borderRadius:4, fontSize:8, fontWeight:600, cursor:'pointer', border:'none', background:p.timing==='pre'?'#ec4899':'var(--bg-secondary)', color:p.timing==='pre'?'#000':'var(--text-dim)' }}>До тренировки</button>
                            <button onClick={() => p.setTiming('post')} style={{ padding:'2px 8px', borderRadius:4, fontSize:8, fontWeight:600, cursor:'pointer', border:'none', background:p.timing==='post'?'#ec4899':'var(--bg-secondary)', color:p.timing==='post'?'#000':'var(--text-dim)' }}>После тренировки</button>
                          </div>
                          {p.val > 0 && <div style={{ fontSize:7, color:'#ec4899', marginTop:2, opacity:0.7 }}>{p.note}</div>}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Notes */}
                  <div className="card" style={{ padding:10 }}>
                    <h4 style={{ margin:'0 0 4px', fontSize:10, color:'var(--text-dim)' }}>📝 Рекомендации</h4>
                    <div style={{ fontSize:8, color:'var(--text-dim)', lineHeight:1.4 }}>
                      • Все дозы рассчитаны на вес <b>{bw} кг</b>{isOnCycle ? ' (на курсе ×1.25)' : ' (натуральный тренинг ×1.0)'}.<br/>
                      • Пейте воду: 500 мл за 2 ч до + 200-300 мл каждые 15-20 мин во время тренировки.<br/>
                      • Общий объём жидкости интра-тренировки: ~{(durationHrs * 0.9).toFixed(1)} л для {bw} кг.<br/>
                      • Избегайте жиров и клетчатки за 2 ч до тренировки — замедляют всасывание.<br/>
                      • Пост-тренировочный приём — в течение 30 мин после завершения (анаболическое окно).<br/>
                      • При использовании инсулина/метформина: обязательно глюкометр + быстрые углеводы под рукой.
                    </div>
                  </div>
                </>);
              })()}
            </div>
          </div>
        </div>
      )}

      {/* ===== SUPPORT PLAN VIEW (Active + Archive) ===== */}
      {section === 'generator' && tab === 'main' && supportView === 'calc' && calcView === 'plan' && (
        <div style={{ padding:'0 0 80px' }}>
          <div style={{ display:'flex', gap:6, marginBottom:8 }}>
            <button onClick={() => setPlanSubTab('active')} style={{ padding:'6px 16px', borderRadius:20, fontSize:11, fontWeight:700, cursor:'pointer', background: planSubTab === 'active' ? 'var(--accent)' : 'var(--bg-secondary)', color: planSubTab === 'active' ? '#000' : 'var(--text-dim)', border: `1px solid ${planSubTab === 'active' ? 'var(--accent)' : 'var(--border)'}` }}>✅ Действующий план</button>
            <button onClick={() => setPlanSubTab('archive')} style={{ padding:'6px 16px', borderRadius:20, fontSize:11, fontWeight:700, cursor:'pointer', background: planSubTab === 'archive' ? 'var(--accent)' : 'var(--bg-secondary)', color: planSubTab === 'archive' ? '#000' : 'var(--text-dim)', border: `1px solid ${planSubTab === 'archive' ? 'var(--accent)' : 'var(--border)'}` }}>📦 Архив ({archivedPlans.length})</button>
          </div>

          {planSubTab === 'active' && (() => {
            const level = SUPPORT_LEVELS[supportLevel];
            const subs = level?.subs || [];
            const dosages = level?.dosages || {};
            const getInfo = (id: string) => {
              const sub = ALL_SUBSTANCES.find(s => s.id === id);
              const d = dosages[id];
              return { id, name: sub?.name || id.replace(/_/g, ' '), mg: d?.mg ?? 0, timing: d?.timing || '', desc: sub?.description || '' };
            };
            return (
              <>
                <h2 style={{ margin:'0 0 2px', fontSize:16, fontWeight:800, color:'var(--accent)' }}>📅 Действующий план поддержки</h2>
                <p style={{ fontSize:10, color:'var(--text-dim)', margin:'0 0 10px' }}>Уровень: {level?.label || supportLevel}</p>

                {/* Action buttons */}
                <div style={{ display:'flex', gap:4, marginBottom:10, flexWrap:'wrap' }}>
                  <button onClick={() => {
                    const name = prompt('Название препарата:');
                    if (!name) return;
                    const dose = prompt('Дозировка (мг):', '500');
                    if (!dose) return;
                    const timing = prompt('Время приёма (утро/день/вечер):', 'с едой');
                    const id = 'manual_' + Date.now();
                    const newSub = { id, type: 'vitamin' as const, name, description: 'Добавлен вручную', mechanisms: [], categories: [] as string[] };
                    (ALL_SUBSTANCES as any).push(newSub);
                    const newDosages = { ...dosages, [id]: { mg: parseInt(dose), timing: timing || 'с едой' } };
                    const newLevel = { ...level, subs: [...subs, id], dosages: newDosages };
                    SUPPORT_LEVELS[supportLevel] = newLevel;
                    window.location.reload();
                  }} style={{ padding:'6px 12px', borderRadius:8, fontSize:10, cursor:'pointer', background:'rgba(96,165,250,0.15)', border:'1px solid rgba(96,165,250,0.3)', color:'#60a5fa', fontWeight:600 }}>➕ Добавить препарат</button>
                  <button onClick={() => {
                    const saved = localStorage.getItem('savedStacks');
                    if (!saved || JSON.parse(saved).length === 0) { alert('Нет сохранённых стеков'); return; }
                    const stacks = JSON.parse(saved);
                    const names = stacks.map((s: any,i: number) => `${i+1}. ${s.name || 'Стек '+(i+1)}`).join('\n');
                    const idx = parseInt(prompt(`Выберите стек:\n${names}`) || '-1') - 1;
                    if (idx < 0 || idx >= stacks.length) return;
                    const stack = stacks[idx];
                    const stackSubs = (stack.substanceIds || stack.subs || []).filter((id: string) => !subs.includes(id));
                    if (stackSubs.length === 0) { alert('Все препараты уже в плане'); return; }
                    const newDosages = { ...dosages };
                    stackSubs.forEach((id: string) => {
                      const d = stack.dosages?.[id] || stack.doses?.[id];
                      if (d) newDosages[id] = typeof d === 'number' ? { mg: d, timing: 'с едой' } : d;
                    });
                    const newLevel = { ...level, subs: [...subs, ...stackSubs], dosages: newDosages };
                    SUPPORT_LEVELS[supportLevel] = newLevel;
                    window.location.reload();
                  }} style={{ padding:'6px 12px', borderRadius:8, fontSize:10, cursor:'pointer', background:'rgba(139,92,246,0.15)', border:'1px solid rgba(139,92,246,0.3)', color:'#8b5cf6', fontWeight:600 }}>📦 Из моих стеков</button>
                  <button onClick={() => {
                    const items = subs.map((id: string) => {
                      const info = getInfo(id);
                      return { id, name: info.name, dose: info.mg, timing: info.timing };
                    });
                    const existing = JSON.parse(localStorage.getItem('supportCart') || '[]');
                    localStorage.setItem('supportCart', JSON.stringify([...existing, ...items]));
                    setCartItems([...cartItems, ...items]);
                    alert('✅ Добавлено в корзину');
                  }} style={{ padding:'6px 12px', borderRadius:8, fontSize:10, cursor:'pointer', background:'rgba(255,152,0,0.15)', border:'1px solid rgba(255,152,0,0.3)', color:'#ff9800', fontWeight:600 }}>🛒 В корзину</button>
                </div>

                {/* Timing table */}
                {subs.length > 0 && (
                  <>
                    <div style={{ marginBottom:8, padding:'8px 10px', borderRadius:8, background:'rgba(0,230,138,0.04)', border:'1px solid rgba(0,230,138,0.12)' }}>
                      <div style={{ fontSize:10, fontWeight:700, color:'#00e68a', marginBottom:6 }}>📋 Таблица приёма</div>
                      <table style={{ width:'100%', fontSize:8, borderCollapse:'collapse' }}>
                        <thead><tr style={{ background:'rgba(0,0,0,0.1)' }}>
                          <th style={{ padding:'3px 5px', textAlign:'left' }}>Время</th>
                          <th style={{ padding:'3px 5px', textAlign:'left' }}>Препарат</th>
                          <th style={{ padding:'3px 5px', textAlign:'left' }}>Доза</th>
                          <th style={{ padding:'3px 5px', textAlign:'left' }}>Описание</th>
                        </tr></thead>
                        <tbody>
                          {subs.map((id: string) => {
                            const sub = ALL_SUBSTANCES.find(s => s.id === id);
                            const d = dosages[id];
                            if (!sub || !d) return null;
                            return (
                              <tr key={id} style={{ borderBottom:'1px solid var(--border)' }}>
                                <td style={{ padding:'3px 5px', color:'var(--text-dim)' }}>{d.timing}</td>
                                <td style={{ padding:'3px 5px', fontWeight:600, color:'var(--text-light)' }}>{sub.name || id.replace(/_/g, ' ')}</td>
                                <td style={{ padding:'3px 5px', color:'#00e68a' }}>{d.mg >= 1000 && id !== 'omega3' ? `${(d.mg/1000).toFixed(d.mg%1000===0?0:1)}г` : `${d.mg}мг`}</td>
                                <td style={{ padding:'3px 5px', color:'var(--text-dim)', fontSize:7.5 }}>{sub.description?.slice(0,50) || ''}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Mechanisms table */}
                    <div style={{ marginBottom:10, fontSize:8, color:'var(--text-dim)' }}>
                      <div style={{ fontWeight:700, color:'#8b5cf6', marginBottom:4, fontSize:9 }}>🧬 Механизмы, препараты и синергии</div>
                      <table style={{ width:'100%', fontSize:7.5, borderCollapse:'collapse' }}>
                        <thead><tr style={{ background:'rgba(139,92,246,0.08)' }}>
                          <th style={{ padding:'3px 4px', textAlign:'left', color:'#8b5cf6', fontWeight:600 }}>Препарат</th>
                          <th style={{ padding:'3px 4px', textAlign:'left', color:'#8b5cf6', fontWeight:600 }}>Механизм</th>
                          <th style={{ padding:'3px 4px', textAlign:'left', color:'#8b5cf6', fontWeight:600 }}>Синергии</th>
                        </tr></thead>
                        <tbody>
                          {subs.map((id: string) => {
                            const sub = ALL_SUBSTANCES.find((s: any) => s.id === id);
                            if (!sub) return null;
                            const mechanisms = (sub.mechanisms || []).slice(0, 3);
                            const syns = ALL_INTERACTIONS.filter((int: any) => 
                              (int.substanceA === id || int.substanceB === id) && int.type === 'synergy'
                            ).slice(0, 2);
                            const conflicts = ALL_INTERACTIONS.filter((int: any) => 
                              (int.substanceA === id || int.substanceB === id) && int.type === 'conflict'
                            ).slice(0, 1);
                            return (
                              <tr key={id} style={{ borderBottom:'1px solid var(--border)' }}>
                                <td style={{ padding:'3px 4px', fontWeight:600, color:'var(--text-light)' }}>{sub.name || id.replace(/_/g, ' ')}</td>
                                <td style={{ padding:'3px 4px', color:'var(--text-dim)' }}>
                                  {mechanisms.length > 0 ? mechanisms.map((m: string) => (
                                    <div key={m} style={{ lineHeight:1.3, marginBottom:1 }}>• {m.length > 50 ? m.slice(0,50)+'…' : m}</div>
                                  )) : <span style={{ color:'rgba(255,255,255,0.3)' }}>—</span>}
                                </td>
                                <td style={{ padding:'3px 4px' }}>
                                  {syns.map((s: any, j: number) => {
                                    const partner = ALL_SUBSTANCES.find((x: any) => x.id === (s.substanceA === id ? s.substanceB : s.substanceA));
                                    return (
                                      <div key={j} style={{ color:'#22c55e', lineHeight:1.3 }}>⊕ {partner?.name || '?'} — {s.effect?.slice(0,35)}</div>
                                    );
                                  })}
                                  {conflicts.length > 0 && conflicts.map((c: any, j: number) => {
                                    const partner = ALL_SUBSTANCES.find((x: any) => x.id === (c.substanceA === id ? c.substanceB : c.substanceA));
                                    return (
                                      <div key={`c${j}`} style={{ color:'#ef4444', lineHeight:1.3 }}>⊖ {partner?.name || '?'} — {c.effect?.slice(0,35)}</div>
                                    );
                                  })}
                                  {syns.length === 0 && conflicts.length === 0 && <span style={{ color:'rgba(255,255,255,0.3)' }}>—</span>}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
                {subs.length === 0 && <p style={{ fontSize:10, color:'var(--text-dim)' }}>Нет препаратов в плане. Сначала выполните расчёт в калькуляторе поддержки.</p>}

                {/* Save plan button — moves old plan to archive */}
                <button onClick={() => {
                  const existing = localStorage.getItem('supportPlans');
                  if (existing) {
                    const oldPlan = JSON.parse(existing);
                    const archive = JSON.parse(localStorage.getItem('supportPlanArchive') || '[]');
                    archive.push({ ...oldPlan, archivedAt: new Date().toISOString(), label: level?.label || supportLevel });
                    localStorage.setItem('supportPlanArchive', JSON.stringify(archive));
                    setArchivedPlans([...archivedPlans, { ...oldPlan, archivedAt: new Date().toISOString(), label: level?.label || supportLevel }]);
                  }
                  const plan = { period:'daily', date:new Date().toISOString(), level:supportLevel, subs, dosages, levelLabel:level?.label };
                  localStorage.setItem('supportPlans', JSON.stringify(plan));
                  setPlanSaved(true);
                }} style={{ width:'100%', padding:'10px', borderRadius:10, border:'none', cursor:'pointer', background:'linear-gradient(135deg,#00e68a,#00c853)', color:'#000', fontWeight:800, fontSize:12 }}>💾 Сохранить план (старый → архив)</button>
                <div style={{ display:'flex', gap:6, marginTop:6 }}>
                  <button onClick={() => {
                    const level = SUPPORT_LEVELS[supportLevel];
                    if (!level) return;
                    const id = 'stack_' + Date.now();
                    const newStack = { id, name: 'План: ' + (level?.label || supportLevel) + ' ' + new Date().toLocaleDateString('ru'), date: new Date().toISOString(), subs, dosages: dosages || {}, notes: '' };
                    const updated = [...savedStacks, newStack];
                    setSavedStacks(updated);
                    localStorage.setItem('savedStacks', JSON.stringify(updated));
                    setPlanSaved(true);
                  }} style={{ flex:1, padding:'8px', borderRadius:10, border:'1px solid rgba(139,92,246,0.3)', cursor:'pointer', background:'rgba(139,92,246,0.08)', color:'#8b5cf6', fontWeight:700, fontSize:11 }}>📂 В Мои стеки</button>
                  <button onClick={() => {
                    const planText = 'План поддержки (' + (level?.label || supportLevel) + '):\n' + subs.map((s: string) => {
                      const sub = ALL_SUBSTANCES.find((x: any) => x.id === s);
                      const dose = (dosages || {})[s];
                      return '• ' + (sub?.name || s) + (dose ? ' — ' + dose.mg + ' мг' : '');
                    }).join('\n');
                    navigator.clipboard?.writeText(planText);
                  }} style={{ padding:'8px 12px', borderRadius:10, border:'1px solid rgba(255,255,255,0.1)', cursor:'pointer', background:'rgba(255,255,255,0.04)', color:'rgba(255,255,255,0.9)', fontWeight:600, fontSize:11 }}>📋</button>
                </div>
                {planSaved && <div style={{ textAlign:'center', fontSize:10, color:'#22c55e', marginTop:4 }}>✅ План сохранён</div>}

                {/* 💾 СОХРАНИТЬ ПЛАН в he_saved_support_plans */}
                <button onClick={() => {
                  try {
                    const planData = { level:supportLevel, subs, dosages, levelLabel:SUPPORT_LEVELS[supportLevel]?.label };
                    const existing = JSON.parse(localStorage.getItem('he_saved_support_plans') || '[]');
                    existing.push({ id: Date.now(), date: new Date().toISOString(), plan: planData });
                    localStorage.setItem('he_saved_support_plans', JSON.stringify(existing));
                    alert('План сохранён!');
                    setPlanSaved(true);
                  } catch {}
                }} style={{ width:'100%', padding:'10px', borderRadius:10, border:'none', cursor:'pointer', background:'linear-gradient(135deg,#00e68a,#00c853)', color:'#000', fontWeight:800, fontSize:12, marginTop:6 }}>💾 СОХРАНИТЬ ПЛАН</button>

                {/* Мои планы */}
                <div style={{ marginTop:8 }}>
                  <h3 style={{ margin:'0 0 6px', fontSize:13, fontWeight:700, color:'var(--accent)' }}>📋 Мои планы</h3>
                  {(() => {
                    let savedPlans: any[] = [];
                    try { savedPlans = JSON.parse(localStorage.getItem('he_saved_support_plans') || '[]'); } catch {}
                    if (savedPlans.length === 0) return <p style={{ fontSize:10, color:'var(--text-dim)' }}>Нет сохранённых планов.</p>;
                    return [...savedPlans].reverse().map((sp, i) => {
                      const p = sp.plan || {};
                      const pSubs = p.subs || [];
                      return (
                        <div key={sp.id || i} style={{ padding:'8px 10px', marginBottom:4, background:'var(--bg-secondary)', borderRadius:8, border:'1px solid var(--border)' }}>
                          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                            <div>
                              <div style={{ fontSize:10, fontWeight:600, color:'var(--text-light)' }}>{p.levelLabel || p.level || 'План'} · {pSubs.length} препаратов</div>
                              <div style={{ fontSize:8, color:'var(--text-dim)' }}>{new Date(sp.date).toLocaleDateString('ru-RU')}</div>
                            </div>
                            <button onClick={() => {
                              try {
                                let savedPlans: any[] = JSON.parse(localStorage.getItem('he_saved_support_plans') || '[]');
                                const updated = savedPlans.filter((x:any) => x.id !== sp.id);
                                localStorage.setItem('he_saved_support_plans', JSON.stringify(updated));
                                window.location.reload();
                              } catch {}
                            }} style={{ padding:'3px 8px', borderRadius:4, fontSize:8, cursor:'pointer', background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', color:'#ef4444' }}>🗑</button>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </>
            );
          })()}

          {/* ===== ARCHIVE VIEW ===== */}
          {planSubTab === 'archive' && (
            <div>
              <h3 style={{ margin:'0 0 8px', fontSize:14, fontWeight:700, color:'var(--accent)' }}>📦 Архив планов</h3>
              {archivedPlans.length === 0 ? (
                <p style={{ fontSize:10, color:'var(--text-dim)' }}>Архив пуст. При сохранении нового плана старый автоматически перемещается в архив.</p>
              ) : (
                [...archivedPlans].reverse().map((plan, idx) => {
                  const planId = `arch_${idx}_${plan.archivedAt || plan.date}`;
                  const isExpanded = expandedArchiveId === planId;
                  const planSubs = plan.subs || [];
                  const planDosages = plan.dosages || {};
                  return (
                    <div key={planId} style={{ marginBottom:8, background:'var(--bg-secondary)', borderRadius:10, border:'1px solid var(--border)', overflow:'hidden' }}>
                      <div onClick={() => setExpandedArchiveId(isExpanded ? null : planId)} style={{ padding:'10px 12px', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'space-between', borderBottom: isExpanded ? '1px solid var(--border)' : 'none' }}>
                        <div>
                          <div style={{ fontSize:11, fontWeight:600, color:'var(--text-light)' }}>{plan.label || plan.level || 'План'} {plan.levelLabel ? `(${plan.levelLabel})` : ''}</div>
                          <div style={{ fontSize:9, color:'var(--text-dim)', marginTop:2 }}>{new Date(plan.archivedAt || plan.date).toLocaleDateString('ru-RU')} · {planSubs.length} препаратов</div>
                        </div>
                        <span style={{ fontSize:12, color:'var(--text-dim)' }}>{isExpanded ? '▲' : '▼'}</span>
                      </div>
                      {isExpanded && (
                        <div style={{ padding:'8px 12px' }}>
                          {planSubs.length > 0 && (
                            <table style={{ width:'100%', fontSize:8, borderCollapse:'collapse' }}>
                              <thead><tr style={{ background:'rgba(0,0,0,0.1)' }}>
                                <th style={{ padding:'3px 5px', textAlign:'left' }}>Препарат</th>
                                <th style={{ padding:'3px 5px', textAlign:'left' }}>Доза</th>
                                <th style={{ padding:'3px 5px', textAlign:'left' }}>Время</th>
                              </tr></thead>
                              <tbody>
                                {planSubs.map((id: string) => {
                                  const sub = ALL_SUBSTANCES.find((s: any) => s.id === id);
                                  const d = planDosages[id];
                                  return (
                                    <tr key={id} style={{ borderBottom:'1px solid var(--border)' }}>
                                      <td style={{ padding:'3px 5px', fontWeight:600, color:'var(--text-light)' }}>{sub?.name || id.replace(/_/g, ' ')}</td>
                                      <td style={{ padding:'3px 5px', color:'#00e68a' }}>{d?.mg ? `${d.mg}мг` : '—'}</td>
                                      <td style={{ padding:'3px 5px', color:'var(--text-dim)' }}>{d?.timing || '—'}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          )}
                          {planSubs.length === 0 && <div style={{ fontSize:9, color:'var(--text-dim)' }}>Нет данных о препаратах</div>}
                          <div style={{ display:'flex', gap:4, marginTop:8 }}>
                            <button onClick={() => {
                              const archive = JSON.parse(localStorage.getItem('supportPlanArchive') || '[]');
                              const key = [...archivedPlans].reverse()[idx];
                              const realIdx = archivedPlans.indexOf(key);
                              if (realIdx >= 0) {
                                archive.splice(realIdx, 1);
                                localStorage.setItem('supportPlanArchive', JSON.stringify(archive));
                                setArchivedPlans(archive);
                              }
                            }} style={{ padding:'4px 10px', borderRadius:6, fontSize:9, cursor:'pointer', background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', color:'#ef4444' }}>🗑 Удалить</button>
                            <button onClick={() => {
                              const items = planSubs.map((id: string) => {
                                const sub = ALL_SUBSTANCES.find((s: any) => s.id === id);
                                const d = planDosages[id];
                                return { id, name: sub?.name || id, dose: d?.mg || 0, timing: d?.timing || '' };
                              });
                              const existing = JSON.parse(localStorage.getItem('supportCart') || '[]');
                              localStorage.setItem('supportCart', JSON.stringify([...existing, ...items]));
                              setCartItems([...cartItems, ...items]);
                              alert('✅ Добавлено в корзину');
                            }} style={{ padding:'4px 10px', borderRadius:6, fontSize:9, cursor:'pointer', background:'rgba(255,152,0,0.1)', border:'1px solid rgba(255,152,0,0.3)', color:'#ff9800' }}>🛒 В корзину</button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      )}

      {/* ===== SUPPORT REPORTS ===== */}
      {section === 'generator' && tab === 'main' && supportView === 'calc' && calcView === 'reports' && (() => {
        return (
          <div style={{ paddingBottom:80 }}>
            <h3 style={{ fontSize:14, fontWeight:800, color:'#fff', margin:'0 0 6px' }}>📊 Отчёты поддержки</h3>
            <p style={{ fontSize:9, color:'var(--text-dim)', margin:'0 0 10px', lineHeight:1.3 }}>
              Полный отчёт по рискам, поддержке, взаимодействиям и курсу. Сохраняется в архив.
            </p>

            {/* Generate Button */}
            <button onClick={() => {
              const profile = linked.profile;
              const course = linked.course || [];
              const weightKg = profile?.settings?.weight ?? 80;
              const age = profile?.settings?.age ?? 30;
              const sex = profile?.settings?.sex ?? 'male';
              const r = supportResult;
              const mr = mechanismReport;
              const tp = timedPlan;
              const weekly = weeklyPlan;
              const dbInt = dbInteractions;

              // Risk assessment per system — use calcResult for consistency with calculator
              const systemLabels: Record<string,{name:string,emoji:string}> = {
                cardio:{name:'Сердце',emoji:'❤️'}, hepatic:{name:'Печень',emoji:'🧪'}, renal:{name:'Почки',emoji:'🫘'},
                neuro:{name:'Нейро',emoji:'🧠'}, endocrine:{name:'Эндокринная',emoji:'🔄'}, hematologic:{name:'Кровь',emoji:'🩸'},
                reproductive:{name:'Репродуктивная',emoji:'🧬'}, musculoskeletal:{name:'КМС',emoji:'💪'},
              };
              const sysBreakdown = calcResult?.riskAssessment?.systemBreakdown || {};
              const risks = Object.keys(sysBreakdown).length > 0 ? Object.entries(sysBreakdown).map(([k,v]) => { const sys = v as { raw: number; net: number }; return { system:systemLabels[k]?.name||k, emoji:systemLabels[k]?.emoji||'⚕️', raw:sys.raw, net:sys.net }; }) : [];
              const overallRaw = risks.length ? Math.round(Math.max(...risks.map(r=>r.raw))) : 0;
              const overallNet = risks.length ? Math.round(Math.max(...risks.map(r=>r.net))) : 0;

              // Course compounds
              const compounds = course.map(c => {
                const ph = PHARMA_DB[c.substanceId];
                return { id:c.substanceId, name:ph?.name||c.substanceId, cls:ph?.class||'other', dose:c.doseValue, freq:c.frequency, start:c.startWeek, end:c.endWeek };
              });

              // Support plan from effectiveLevel (with phase adjustments)
              const levelSubIds = effectiveLevel?.subs || SUPPORT_LEVELS[supportLevel]?.subs || [];
              const planItems = levelSubIds.map((id:string) => {
                const sub = ALL_SUBSTANCES.find((s:any) => s.id === id);
                const dos = DEFAULT_DOSAGES[id] || { mg:500, timing:'с едой' };
                return { id, name:sub?.name||id, dose:dos.mg+'мг', timing:dos.timing, categories:sub?.categories||[], mechanisms:sub?.mechanisms||[] };
              });

              // Interactions
              const allInteractions = [
                ...(dbInt?.synergies||[]).map((i:any) => ({ ...i, type:'synergy' })),
                ...(dbInt?.conflicts||[]).map((i:any) => ({ ...i, type:'conflict' })),
                ...(dbInt?.cautions||[]).map((i:any) => ({ ...i, type:'caution' })),
              ];
              const synergyCount = dbInt?.synergies?.length || 0;
              const conflictCount = dbInt?.conflicts?.length || 0;

              // Recommendations
              const recs: string[] = [];
              if (overallNet >= 70) recs.push('🔴 Высокий риск — необходима поддержка всех систем');
              else if (overallNet >= 50) recs.push('🟡 Средний риск — усиленная поддержка');
              else recs.push('🟢 Низкий риск — базовая поддержка');
              if (compounds.some((c:any)=>c.cls==='aas'||c.cls==='aan'||c.cls==='sarm'||c.cls==='prohormone')) recs.push('💊 Анаболические соединения — контроль липидов, печени, ГГЯ');
              if (compounds.some((c:any)=>c.cls==='other')) recs.push('📋 Дополнительные соединения — проверка взаимодействий');
              if (conflictCount > 0) recs.push('⚡ Обнаружены конфликты — проверьте взаимодействия');
              if (planItems.length === 0) recs.push('🧩 Поддержка не выбрана — выберите уровень в Калькуляторе');

              // Overall grade
              const penalty = (overallNet > 70 ? 2 : overallNet > 50 ? 1 : 0) + (conflictCount > 0 ? 1 : 0) + (compounds.length > 3 ? 1 : 0);
              const gradeScore = Math.max(0, 10 - penalty);
              const grade = gradeScore >= 8 ? 'A' : gradeScore >= 6 ? 'B' : gradeScore >= 4 ? 'C' : 'D';

              const report = {
                date: new Date().toISOString(),
                profile: { age, weight: weightKg, sex },
                compounds,
                risks, overallRaw, overallNet,
                plan: { level: SUPPORT_LEVELS[supportLevel]?.label || 'Не выбран', items: planItems },
                interactions: { count:allInteractions.length, synergyCount, conflictCount, list:allInteractions },
                mechanismReport: mr ? { systems:Object.keys(mr).length } : null,
                timedPlan: tp ? true : false,
                weeklyPlan: weekly ? true : false,
                overallGrade: grade,
                recommendations: recs,
              };

              // Save to archive
              const prev = JSON.parse(localStorage.getItem('he_support_reports') || '[]');
              const updated = [report, ...prev].slice(0, 30);
              localStorage.setItem('he_support_reports', JSON.stringify(updated));
              setSupportReports(updated);
              setSupportReportCurrent(report);

              // Push to Profile
              try {
                const profileReports = JSON.parse(localStorage.getItem('he_profile_support_reports') || '[]');
                profileReports.unshift({ date: report.date, grade, overallNet, compoundsCount: report.compounds.length, supportCount: report.plan.items.length });
                localStorage.setItem('he_profile_support_reports', JSON.stringify(profileReports.slice(0, 30)));
              } catch(e) {}
            }} style={{
              padding:'10px 20px', borderRadius:10, fontSize:12, fontWeight:700, cursor:'pointer', width:'100%', marginBottom:12,
              background: 'var(--accent)', border:'none', color:'#000',
            }}>
              🚀 Сгенерировать отчёт
            </button>

            {/* Current Report */}
            {supportReportCurrent && (
              <div style={{ background:'var(--bg-secondary)', borderRadius:12, padding:14, marginBottom:10, border:'1px solid var(--border)' }}>
                <div style={{ fontSize:11, fontWeight:700, color:'var(--accent)', marginBottom:8, display:'flex', alignItems:'center', gap:6 }}>
                  📄 Текущий отчёт
                  <span style={{ fontSize:8, color:'var(--text-dim)', fontWeight:400 }}>{new Date(supportReportCurrent.date).toLocaleString('ru-RU')}</span>
                </div>

                {/* Grade */}
                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8, padding:'8px 10px', borderRadius:8, background:'rgba(0,230,138,0.06)' }}>
                  <div style={{ fontSize:24, fontWeight:800, color:supportReportCurrent.overallGrade === 'A' ? '#00e68a' : supportReportCurrent.overallGrade === 'B' ? '#22c55e' : supportReportCurrent.overallGrade === 'C' ? '#f59e0b' : '#ef4444' }}>{supportReportCurrent.overallGrade}</div>
                  <div style={{ flex:1, fontSize:9, color:'var(--text-dim)' }}>
                    Общая оценка поддержки · Риск: {supportReportCurrent.overallNet}/100 · {supportReportCurrent.compounds.length} соединений · {supportReportCurrent.plan.items.length} препаратов поддержки
                  </div>
                </div>

                {/* Profile */}
                <div style={{ display:'flex', gap:6, marginBottom:8, flexWrap:'wrap' }}>
                  <div style={{ padding:'3px 8px', borderRadius:6, background:'rgba(255,255,255,0.04)', fontSize:8, color:'var(--text-dim)' }}>👤 {supportReportCurrent.profile.age} лет</div>
                  <div style={{ padding:'3px 8px', borderRadius:6, background:'rgba(255,255,255,0.04)', fontSize:8, color:'var(--text-dim)' }}>⚖️ {supportReportCurrent.profile.weight} кг</div>
                  <div style={{ padding:'3px 8px', borderRadius:6, background:'rgba(255,255,255,0.04)', fontSize:8, color:'var(--text-dim)' }}>⚧ {supportReportCurrent.profile.sex === 'male' ? 'Муж' : 'Жен'}</div>
                </div>

                {/* Compounds */}
                {supportReportCurrent.compounds.length > 0 && (
                  <div style={{ marginBottom:8 }}>
                    <div style={{ fontSize:9, fontWeight:700, color:'var(--text)', marginBottom:4 }}>💊 Соединения на курсе</div>
                    <div style={{ display:'flex', gap:3, flexWrap:'wrap' }}>
                      {supportReportCurrent.compounds.map((c:any,i:number) => (
                        <span key={i} style={{ padding:'2px 6px', borderRadius:4, fontSize:7, background:'rgba(167,139,250,0.08)', color:'#a78bfa', border:'1px solid rgba(167,139,250,0.15)' }}>{c.name}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Risks */}
                {supportReportCurrent.risks.length > 0 && (
                  <div style={{ marginBottom:8 }}>
                    <div style={{ fontSize:9, fontWeight:700, color:'var(--text)', marginBottom:4 }}>📊 Риски по системам</div>
                    <div style={{ display:'flex', gap:4, overflowX:'auto', paddingBottom:2 }}>
                      {supportReportCurrent.risks.map((r:any,i:number) => (
                        <div key={i} style={{ flexShrink:0, padding:'4px 8px', borderRadius:6, background:'rgba(239,68,68,0.04)', border:'1px solid rgba(239,68,68,0.12)', minWidth:50, textAlign:'center' }}>
                          <div style={{ fontSize:10 }}>{r.emoji}</div>
                          <div style={{ fontSize:7, color:'var(--text-dim)' }}>{r.system}</div>
                          <div style={{ fontSize:11, fontWeight:700, color:r.net >= 70 ? '#ef4444' : r.net >= 50 ? '#f59e0b' : '#22c55e' }}>{r.net}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Support Plan — detailed table */}
                {supportReportCurrent.plan.items.length > 0 && (
                  <div style={{ marginBottom:8 }}>
                    <div style={{ fontSize:9, fontWeight:700, color:'var(--text)', marginBottom:4 }}>🧩 План поддержки · {supportReportCurrent.plan.level}</div>
                    <div style={{ overflowX:'auto' }}>
                      <table style={{ width:'100%', borderCollapse:'collapse', fontSize:7 }}>
                        <thead>
                          <tr style={{ color:'var(--text-dim)', borderBottom:'1px solid var(--border)' }}>
                            <th style={{ padding:'3px 4px', textAlign:'left', fontWeight:600 }}>Препарат</th>
                            <th style={{ padding:'3px 4px', textAlign:'left', fontWeight:600 }}>Цель</th>
                            <th style={{ padding:'3px 4px', textAlign:'left', fontWeight:600 }}>Доза</th>
                            <th style={{ padding:'3px 4px', textAlign:'left', fontWeight:600 }}>Приём</th>
                            <th style={{ padding:'3px 4px', textAlign:'left', fontWeight:600 }}>Механизм</th>
                          </tr>
                        </thead>
                        <tbody>
                          {supportReportCurrent.plan.items.map((s:any,i:number) => (
                            <tr key={i} style={{ borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
                              <td style={{ padding:'4px 4px', color:'#00e68a', fontWeight:600, whiteSpace:'nowrap' }}>{s.name}</td>
                              <td style={{ padding:'4px 4px', color:'var(--accent)', whiteSpace:'nowrap', fontSize:8 }}>
                                {(s.categories || []).slice(0, 2).map((c:string) => CATALOG_CATEGORY_LABELS[c] || c).join(', ')}
                              </td>
                              <td style={{ padding:'4px 4px', color:'var(--text-light)', whiteSpace:'nowrap' }}>{s.dose}</td>
                              <td style={{ padding:'4px 4px', color:'var(--text-dim)', whiteSpace:'nowrap' }}>{s.timing}</td>
                              <td style={{ padding:'4px 4px', color:'var(--text-dim)' }}>
                                {(s.mechanisms || []).slice(0, 3).join(', ')}
                                {(s.mechanisms || []).length > 3 && <span style={{ color:'var(--text-dim)', fontSize:6 }}> +{(s.mechanisms||[]).length-3}</span>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Interactions */}
                {supportReportCurrent.interactions.count > 0 && (
                  <div style={{ marginBottom:8 }}>
                    <div style={{ fontSize:9, fontWeight:700, color:'var(--text)', marginBottom:4 }}>⚡ Взаимодействия</div>
                    <div style={{ display:'flex', gap:6, fontSize:8, color:'var(--text-dim)' }}>
                      <span>Всего: {supportReportCurrent.interactions.count}</span>
                      <span style={{ color:'#22c55e' }}>⊕ Синергии: {supportReportCurrent.interactions.synergyCount}</span>
                      <span style={{ color:'#ef4444' }}>⊖ Конфликты: {supportReportCurrent.interactions.conflictCount}</span>
                    </div>
                  </div>
                )}

                {/* Recommendations */}
                {supportReportCurrent.recommendations.length > 0 && (
                  <div style={{ background:'rgba(255,152,0,0.04)', borderRadius:8, padding:'6px 8px', border:'1px solid rgba(255,152,0,0.1)' }}>
                    <div style={{ fontSize:9, fontWeight:700, color:'#f59e0b', marginBottom:4 }}>💡 Рекомендации</div>
                    {supportReportCurrent.recommendations.map((r:string,i:number) => (
                      <div key={i} style={{ fontSize:8, color:'var(--text-dim)', lineHeight:1.4, marginBottom:1 }}>• {r}</div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Archive */}
            <div style={{ fontSize:11, fontWeight:700, color:'var(--text)', marginBottom:6 }}>📦 Архив отчётов ({supportReports.length})</div>
            {supportReports.length === 0 && (
              <div style={{ padding:'14px', borderRadius:10, background:'var(--bg-secondary)', border:'1px solid var(--border)', fontSize:9, color:'var(--text-dim)', textAlign:'center' }}>
                Пока нет отчётов. Нажмите «Сгенерировать отчёт» для создания первого отчёта.
              </div>
            )}
            {supportReports.map((rep:any, idx:number) => (
              <div key={idx} onClick={() => setSupportReportCurrent(rep)} style={{
                padding:'8px 10px', borderRadius:8, marginBottom:4, cursor:'pointer',
                background: supportReportCurrent === rep ? 'rgba(0,230,138,0.06)' : 'var(--bg-secondary)',
                border: '1px solid ' + (supportReportCurrent === rep ? 'rgba(0,230,138,0.2)' : 'var(--border)'),
                display:'flex', alignItems:'center', gap:8,
              }}>
                <div style={{ fontSize:16, fontWeight:800, color:rep.overallGrade === 'A' ? '#00e68a' : rep.overallGrade === 'B' ? '#22c55e' : rep.overallGrade === 'C' ? '#f59e0b' : '#ef4444', width:24, textAlign:'center' }}>{rep.overallGrade}</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:9, fontWeight:600, color:'var(--text)' }}>{rep.compounds.length} соединений · {rep.plan.items.length} в поддержке</div>
                  <div style={{ fontSize:8, color:'var(--text-dim)' }}>{new Date(rep.date).toLocaleString('ru-RU')} · Риск {rep.overallNet}/100</div>
                </div>
                <span style={{ fontSize:8, color:'var(--accent)' }}>→</span>
              </div>
            ))}
          </div>
        );
      })()}

      {/* ===== SUPPORT CALCULATOR — FULL DATA-INTEGRATED OVERHAUL ===== */}
      {section === 'generator' && ((tab === 'main' && supportView === 'calc' && calcView === 'calculator') || tab === 'calculator') && (() => {
        try {
        if (!linked || !linked.profile) {
          return <div style={{ padding:40, textAlign:'center', color:'var(--text-dim)' }}>Загрузка данных...</div>;
        }
        const weightKg = linked.profile?.settings?.weight ?? 80;
        const age = linked.profile?.settings?.age ?? 30;
        const sex = linked.profile?.settings?.sex ?? 'male';
        const course = linked.course || [];
        const labs = linked.labs || [];
        const riskData = linked.risk || null;
        const labAnalysis = linked.labAnalysis || null;
        const planSavedLocal = planSaved;

        const SYSTEM_LABELS_RU: Record<string, { name: string; emoji: string; rec: string }> = {
          cardio: { name: 'Сердце', emoji: '❤️', rec: 'Тельмисартан, Небиволол, CoQ10, Omega-3, L-карнитин' },
          hepatic: { name: 'Печень', emoji: '🧪', rec: 'NAC, TUDCA, Силимарин, Альфа-липоевая, Фосфатидилхолин' },
          renal: { name: 'Почки', emoji: '🫘', rec: 'Астрагал, Кордицепс, Omega-3, гидратация' },
          neuro: { name: 'Нейро', emoji: '🧠', rec: 'Mg L-треонат, Lion\'s Mane, Theanine, Omega-3, B-комплекс' },
          endocrine: { name: 'Эндокринная', emoji: '🔄', rec: 'DIM, Цинк, Ашваганда, Витекс, Бор' },
          hematologic: { name: 'Кровь', emoji: '🩸', rec: 'Omega-3, Наттокиназа, Ипидофлавин, гидратация, Кардио' },
          reproductive: { name: 'Репродуктивная', emoji: '⚧', rec: 'HCG, Кломифен, Цинк, D-Aspartic Acid, Сабаль пальметто' },
          musculoskeletal: { name: 'Опорно-двиг.', emoji: '🦴', rec: 'Глюкозамин, Коллаген, MSM, Босвеллия, Витамин D3+K2' },
        };

        const calcWeeklyDose = (c: CourseEntry): number => {
          const freq = typeof c.frequency === 'number' ? c.frequency : parseFloat(String(c.frequency)) || 0;
          const val = c.doseValue || 0;
          return val * (freq > 0 ? freq : 1);
        };

        const getPharmaClass = (substanceId: string): string => {
          const ph = PHARMA_DB[substanceId] as any;
          return ph?.class || 'other';
        };

        const getPharmaName = (substanceId: string): string => {
          const ph = PHARMA_DB[substanceId] as any;
          return ph?.name || substanceId;
        };

        const getAndrogenicity = (substanceId: string): number => {
          const mapping: Record<string, number> = {
            test_prop: 1.0, test_enan: 1.0, test_cyp: 1.0, test_undec: 1.0,
            tren_acet: 1.5, tren_enan: 1.5, tren_hex: 1.5, trena: 1.5,
            npp: 0.8, deca: 0.8,
            bold_undec: 0.7, prim_enan: 0.6,
            oxan: 0.6, stan: 1.0, methand: 1.1, halo: 1.8,
            ostarine: 0.05, lgd: 0.1, rad140: 0.15, s23: 0.2,
          };
          return mapping[substanceId] ?? 0.5;
        };

        const getHepatotoxicity = (substanceId: string): number => {
          const ph = PHARMA_DB[substanceId] as any;
          return ph?.pd?.hepatotoxicity ?? 0;
        };

        const getAromatization = (substanceId: string): number => {
          const ph = PHARMA_DB[substanceId] as any;
          return ph?.pd?.aromatization ?? 0;
        };

        const is19Nor = (substanceId: string): boolean => {
          const cls = getPharmaClass(substanceId);
          return cls === 'trenbolone' || cls === 'nandrolone';
        };

        const is17aaOral = (substanceId: string): boolean => {
          const cls = getPharmaClass(substanceId);
          return cls === 'oral_17aa';
        };

        const uniqCourse = (() => {
          const seen = new Map<string, { substanceId: string; name: string; cls: string; totalDose: number; hep: number; arom: number; andro: number; is19: boolean; is17aa: boolean }>();
          course.forEach(c => {
            const id = c.substanceId;
            const weekly = calcWeeklyDose(c);
            if (seen.has(id)) {
              const ex = seen.get(id)!;
              ex.totalDose += weekly;
            } else {
              seen.set(id, {
                substanceId: id, name: getPharmaName(id), cls: getPharmaClass(id),
                totalDose: weekly, hep: getHepatotoxicity(id), arom: getAromatization(id),
                andro: getAndrogenicity(id), is19: is19Nor(id), is17aa: is17aaOral(id),
              });
            }
          });
          return Array.from(seen.values());
        })();

        const count17aa = uniqCourse.filter(c => c.is17aa).length;
        const hasTren = uniqCourse.some(c => c.cls === 'trenbolone');
        const hasNandrolone = uniqCourse.some(c => c.cls === 'nandrolone');
        const countAromatizing = uniqCourse.filter(c => c.arom > 0).length;
        const avgToxicity = uniqCourse.length > 0 ? uniqCourse.reduce((s, c) => s + c.hep, 0) / uniqCourse.length : 0;
        const totalAndrogenicity = uniqCourse.reduce((s, c) => s + c.andro * (c.totalDose / 300), 0);

        const toxicityLabel =
          avgToxicity >= 2.5 ? 'Критический' : avgToxicity >= 1.5 ? 'Высокий' : avgToxicity >= 0.5 ? 'Средний' : 'Низкий';
        const toxicityColor =
          avgToxicity >= 2.5 ? '#ef4444' : avgToxicity >= 1.5 ? '#f97316' : avgToxicity >= 0.5 ? '#f59e0b' : '#22c55e';
        const androLabel = totalAndrogenicity > 3 ? 'высокий риск андрогенных побочек' : totalAndrogenicity > 1.5 ? 'средний риск' : 'низкий риск';

        const getLabStatus = (code: string): { value: number; refHigh: number; status: 'high' | 'critical' | 'normal' } | null => {
          const refs: Record<string, number> = {
            ALT: 40, AST: 35, GGT: 55, CREATININE: 110, LDL: 3.0, TRIGLYCERIDES: 1.7,
            GLUCOSE: 5.6, CRP: 5, HEMOGLOBIN: 175, HEMATOCRIT: 50,
            ESTRADIOL: 50, PROLACTIN: 15, SHBG: 55, TOTAL_TESTOSTERONE: 35,
          };
          for (const l of labs) {
            if (l.code === code) {
              const refHigh = refs[code] || 100;
              return { value: l.value, refHigh, status: l.value > refHigh * 1.3 ? 'critical' : l.value > refHigh ? 'high' : 'normal' };
            }
          }
          return null;
        };

        const LAB_REC_MAP: Record<string, { rec: string; dose: string }> = {
          ALT: { rec: 'NAC 1200-2400 мг, TUDCA 500-1500 мг, Силимарин 600-900 мг', dose: 'NAC 20-30 мг/кг, TUDCA 10-15 мг/кг' },
          AST: { rec: 'дополнительно NAC 600-1200 мг', dose: 'NAC 20-30 мг/кг' },
          GGT: { rec: 'TUDCA 1000-1500 мг, Силимарин 900 мг, Альфа-липоевая 600 мг', dose: 'TUDCA 10-15 мг/кг' },
          CREATININE: { rec: 'Астрагал 1500-3000 мг, Кордицепс 1000-2000 мг', dose: 'Астрагал 20-40 мг/кг' },
          LDL: { rec: 'Omega-3 3-5г, Бергамот 1000 мг, Берберин 500 мг', dose: 'Omega-3 30-50 мг/кг' },
          TRIGLYCERIDES: { rec: 'Omega-3 3-5г, Берберин 500-1000 мг', dose: 'Omega-3 30-50 мг/кг' },
          GLUCOSE: { rec: 'Берберин 500 мг 2x/д, Альфа-липоевая 600 мг', dose: 'Берберин по назначению' },
          CRP: { rec: 'Omega-3 3-5г, Куркумин 1000 мг, Босвеллия 600 мг', dose: 'Omega-3 30-50 мг/кг, Куркумин 15 мг/кг' },
          HEMOGLOBIN: { rec: 'Omega-3 2-3г, Наттокиназа 100 мг, гидратация', dose: 'Omega-3 30-50 мг/кг' },
          HEMATOCRIT: { rec: 'Ипидофлавин 50 мг, Наттокиназа 100 мг, гидратация 3+ л/д', dose: 'Гидратация 40 мл/кг' },
          ESTRADIOL: { rec: 'Анастрозол (коррекция), Цинк 50 мг, DIM 200 мг', dose: 'Цинк 0.3-0.6 мг/кг' },
          PROLACTIN: { rec: 'Каберголин/Бромокриптин, Витамин B6 200-300 мг', dose: 'B6 2-4 мг/кг' },
          SHBG: { rec: 'Бор 10 мг, Магний 400-600 мг', dose: 'Бор 0.1-0.15 мг/кг, Mg 5-8 мг/кг' },
        };

        const abnormalLabs = (
          labAnalysis?.interpretations?.filter(i => i.status === 'high' || i.status === 'critical_high') ||
          Object.keys(LAB_REC_MAP).map(code => getLabStatus(code)).filter(Boolean).filter(s => s!.status !== 'normal')
        );

        const weightBasedDose = (baseMg: number, perKg: number, weight: number): number => {
          const calc = Math.round(perKg * weight);
          return Math.max(baseMg * 0.5, Math.min(baseMg * 3, calc));
        };

        const getWeightDosing = (id: string, baseMg: number): string => {
          const perKg: Record<string, number> = {
            nac: 25, tudca: 12, omega3: 40, coq10: 4, magnesium: 6.5,
            zinc: 0.4, berberine: 6, astragalus: 25, taurine: 25,
            alpha_lipoic: 8, milk_thistle: 10, curcumin: 12, ashwagandha: 8,
          };
          if (!perKg[id]) return '';
          const calcMg = weightBasedDose(baseMg, perKg[id], weightKg);
          if (Math.abs(calcMg - baseMg) / baseMg < 0.1) return '';
          return `(${weightKg} кг × ${perKg[id]} мг/кг = ${calcMg} мг)`;
        };

        // Auto schedule builder
        const buildDailySchedule = (level: string, overrideLevel?: { subs: string[]; dosages: Record<string, { mg: number; timing: string }> }) => {
          const levelData = overrideLevel || SUPPORT_LEVELS[level];
          if (!levelData) return [];
          const subs = levelData.subs || [];
          const dosages = levelData.dosages || {};
          const slots: { time: string; label: string; items: { id: string; name: string; dose: string; with: string; note: string }[] }[] = [
            { time: '07:00', label: 'Натощак', items: [] },
            { time: '08:00', label: 'Завтрак', items: [] },
            { time: '12:00', label: 'Обед', items: [] },
            { time: '16:00', label: 'Перекус', items: [] },
            { time: '19:00', label: 'Ужин', items: [] },
            { time: '21:00', label: 'На ночь', items: [] },
          ];

          const timingMap: Record<string, { slot: number; with: string; note: string }> = {
            nac: { slot: 0, with: 'Вода', note: 'За 30 мин до еды' },
            omega3: { slot: 1, with: 'С жирной пищей', note: 'Для усвоения EPA/DHA' },
            vitamin_d3: { slot: 1, with: 'С жирной пищей', note: 'Жирорастворимый' },
            vitamin_k2: { slot: 1, with: 'С жирной пищей', note: 'С D3 для синергии' },
            coq10: { slot: 1, with: 'С жирной пищей', note: 'Для биодоступности' },
            magnesium: { slot: 5, with: 'Вода', note: 'Перед сном' },
            zinc: { slot: 5, with: 'На пустой желудок', note: 'Не с кальцием/железом' },
            tudca: { slot: 0, with: 'Вода', note: 'За 30 мин до еды, 1-2x/д' },
            ashwagandha: { slot: 5, with: 'Вода', note: 'Снижает кортизол' },
            alpha_lipoic: { slot: 0, with: 'Вода', note: 'За 30 мин до еды' },
            berberine: { slot: 2, with: 'С едой', note: 'Контроль глюкозы' },
            milk_thistle: { slot: 2, with: 'С едой', note: 'Гепатопротекция' },
            selenium: { slot: 1, with: 'С едой', note: 'Антиоксидант' },
            vitamin_b12: { slot: 1, with: 'С водой', note: 'Утром для энергии' },
            folate: { slot: 1, with: 'С едой', note: 'Метилирование' },
            taurine: { slot: 0, with: 'Вода', note: 'Кардиопротекция' },
            glucosamine: { slot: 2, with: 'С едой', note: 'Суставы' },
            collagen: { slot: 2, with: 'С едой', note: 'Соединительная ткань' },
            vitamin_c: { slot: 0, with: 'Вода', note: 'Синтез коллагена' },
            melatonin: { slot: 5, with: 'Вода', note: 'За 30 мин до сна' },
          };

          subs.forEach(id => {
            const dosing = dosages[id];
            if (!dosing) return;
            const subInfo = ALL_SUBSTANCES.find(s => s.id === id);
            const t = timingMap[id] || { slot: 2, with: 'С едой', note: dosing.timing || '' };
            const wbDose = getWeightDosing(id, dosing.mg);
            const doseStr = dosing.mg >= 5000 ? `${dosing.mg / 1000} г` : `${dosing.mg} мг`;
            slots[t.slot].items.push({
              id, name: subInfo?.name || id,
              dose: wbDose ? `${doseStr} ${wbDose}` : doseStr,
              with: t.with, note: t.note,
            });
          });
          return slots.filter(s => s.items.length > 0);
        };

        const dailySchedule = buildDailySchedule(supportLevel, effectiveLevel?.subs ? { subs: effectiveLevel.subs, dosages: effectiveLevel.dosages } : undefined);

        const SYSTEM_ORDER = ['cardio', 'hepatic', 'renal', 'neuro', 'endocrine', 'hematologic', 'reproductive', 'musculoskeletal'];
        const riskColorFn = (v: number) => v > 60 ? '#ef4444' : v > 30 ? '#f59e0b' : '#22c55e';

        const calcRiskReduction = (_sysKey: string, currentNet: number): number => {
          const levelCov = { basic: 15, mid: 30, max: 45, boost: 60 }[supportLevel] || 30;
          return Math.round(currentNet * (levelCov / 100));
        };

        const execCalculate = () => {
          try {
            calcSupport(supportLevel);
          } catch { }
        };

        const savePlan = () => {
          const plan = {
            date: new Date().toISOString(),
            level: supportLevel,
            levelLabel: SUPPORT_LEVELS[supportLevel]?.label,
            goal: supportGoal,
            schedule: dailySchedule,
            riskBefore: calcResult?.riskBeforeSupport ?? 0,
            riskAfter: calcResult?.riskAfterSupport ?? 0,
            systemSupport: calcResult?.systemSupport ?? {},
            courseSummary: uniqCourse.map(c => ({ name: c.name, dose: c.totalDose, cls: c.cls })),
            weightKg, age, sex,
          };
          const key = `supportPlan_${new Date().toISOString().slice(0, 10)}`;
          localStorage.setItem(key, JSON.stringify(plan));
          try { notifyDataChange(); } catch {}
          setPlanSaved(true);
          setTimeout(() => setPlanSaved(false), 3000);
        };

        const copyPlan = () => {
          const schedule = dailySchedule || [];
          let text = '🧮 ПЛАН ПОДДЕРЖКИ — BodyBuildHealth\n';
          text += '═══════════════════════════════\n\n';
          text += `📊 Анализ курса:\n`;
          text += `- Активных в-в: ${uniqCourse.length}\n`;
          text += `- Уровень токсичности: ${toxicityLabel}\n`;
          text += `- 17α-алкил. оральных: ${count17aa} шт\n`;
          text += `- Тренболон: ${hasTren ? 'ДА' : 'НЕТ'} | Нандролон: ${hasNandrolone ? 'ДА' : 'НЕТ'}\n`;
          text += `- Ароматизирующихся: ${countAromatizing} шт\n`;
          text += `- Андрогенный индекс: ${totalAndrogenicity.toFixed(2)} — ${androLabel}\n\n`;
          text += `📅 ДНЕВНОЕ РАСПИСАНИЕ (${SUPPORT_LEVELS[supportLevel]?.label}):\n`;
          schedule.forEach(s => {
            text += `\n${s.time} (${s.label}):\n`;
            s.items.forEach((i: any) => {
              text += `  • ${i.name} — ${i.dose} | ${i.with} | ${i.note}\n`;
            });
          });
          text += `\n═══════════════════════════════\n`;
          if (calcDone && calcResult) {
            text += `\n📉 Риски: ${Math.round(calcResult.riskBeforeSupport)}% → ${Math.round(calcResult.riskAfterSupport)}%\n`;
          }
          text += `\nСгенерировано: ${new Date().toLocaleDateString('ru-RU')}\n`;
          text += `body-build-health.vercel.app\n`;
          navigator.clipboard.writeText(text).catch(() => {
            alert('Не удалось скопировать. Проверьте права буфера обмена.');
          });
        };

        const exportForDoctor = () => {
          const schedule = dailySchedule || [];
          let text = '👨‍⚕️ ОТЧЕТ ДЛЯ ВРАЧА — BodyBuildHealth\n';
          text += '═══════════════════════════════════\n';
          text += `Дата: ${new Date().toLocaleDateString('ru-RU')}\n`;
          text += `Пациент: ${age} лет, ${weightKg} кг, ${sex === 'male' ? 'м' : 'ж'}\n\n`;
          text += `🚑 АНАЛИЗ КУРСА:\n`;
          uniqCourse.forEach(c => {
            text += `- ${c.name}: ~${c.totalDose} мг/нед (класс: ${c.cls})\n`;
          });
          text += `\n⚠ Токсичность: ${toxicityLabel} | Андрогенный индекс: ${totalAndrogenicity.toFixed(2)}\n`;
          text += `\n💊 НАЗНАЧЕННАЯ ПОДДЕРЖКА:\n`;
          schedule.forEach(s => {
            text += `\n${s.time} (${s.label}):\n`;
            s.items.forEach((i: any) => { text += `  • ${i.name}: ${i.dose} — ${i.note}\n`; });
          });
          if (calcDone && calcResult) {
            text += `\n📊 РИСКИ:\n`;
            text += `Общий: ${Math.round(calcResult.riskBeforeSupport)}% → ${Math.round(calcResult.riskAfterSupport)}%\n`;
            Object.entries(calcResult.systemSupport || {}).forEach(([k, v]) => {
              const sysInfo = SYSTEM_LABELS_RU[k] || { name: k };
              text += `  ${sysInfo.name}: покрытие ${v}%\n`;
            });
          }
          text += `\n═══════════════════════════════════\n`;
          navigator.clipboard.writeText(text).catch(() => {});
        };

        const buildShareText = () => {
          const schedule = dailySchedule || [];
          let text = '🧮 ПЛАН ПОДДЕРЖКИ — BodyBuildHealth\n';
          text += '═══════════════════════════════\n\n';
          text += `📅 Дата: ${new Date().toLocaleDateString('ru-RU')}\n`;
          text += `🎯 Уровень: ${SUPPORT_LEVELS[supportLevel]?.label || supportLevel}\n`;
          text += `📊 Токсичность курса: ${toxicityLabel}\n\n`;
          if (calcDone && calcResult) {
            text += `📉 Риски: ${Math.round(calcResult.riskBeforeSupport)}% → ${Math.round(calcResult.riskAfterSupport)}% (снижение ${Math.round(calcResult.riskBeforeSupport - calcResult.riskAfterSupport)}%)\n`;
          }
          text += `\n💊 Поддержка (${schedule.length} приёмов):\n`;
          schedule.forEach(s => {
            s.items.forEach((i: any) => {
              text += `  • ${i.name} — ${i.dose} | ${i.with}\n`;
            });
          });
          const synCount = supportResult?.metadata?.effectiveMechanisms?.length ?? mergedInteractions.filter((i:any)=>i.type==='synergy').length;
          if (synCount > 0) text += `\n✅ Синергий: ${synCount}\n`;
          text += `\n═══════════════════════════════\n`;
          text += `body-build-health.vercel.app\n`;
          return text;
        };

        return (
        <div style={{ padding:'0 0 80px', height:'100vh', display:'flex', flexDirection:'column' }}>
          <h2 style={{ margin:'0 0 2px', fontSize:16, fontWeight:800, color:'var(--accent)' }}>🧮 Калькулятор поддержки</h2>
          <p style={{ fontSize:10, color:'var(--text-dim)', margin:'0 0 10px' }}>Анализ курса + анализов + рисков → персонализированный план</p>

            <div style={{ flex:1, overflowY:'auto', paddingRight:4, display:'flex', flexDirection:'column', gap:8 }}>

            {/* ==================== 2a: АНАЛИЗ КУРСА ==================== */}
            <div style={{ background:'var(--bg-secondary)', borderRadius:12, padding:12, border:'1px solid var(--border)' }}>
              <div onClick={() => setExpandedCategories(p => ({ ...p, calc_course: !(p.calc_course ?? true) }))} style={{ display:'flex', alignItems:'center', gap:6, cursor:'pointer', marginBottom: (expandedCategories.calc_course ?? true) ? 8 : 0 }}>
                <span style={{ fontSize:13 }}>📊</span>
                <span style={{ flex:1, fontSize:12, fontWeight:700, color:'var(--accent)' }}>Анализ курса</span>
                <span style={{ fontSize:9, color:'var(--text-dim)', transform: (expandedCategories.calc_course ?? true) ? 'rotate(180deg)' : 'none', transition:'transform 0.2s' }}>▼</span>
              </div>
              {(expandedCategories.calc_course ?? true) && (<>
              {uniqCourse.length === 0 ? (
                <p style={{ fontSize:9, color:'var(--text-dim)', margin:0 }}>Нет активного курса. Добавьте препараты в Профиль → Курс.</p>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:4, fontSize:9, color:'var(--text-light)', lineHeight:1.6 }}>
                  <div>Препараты: <b style={{ color:'var(--accent)' }}>{uniqCourse.length}</b> активных веществ</div>
                  {uniqCourse.map(c => (
                    <div key={c.substanceId} style={{ display:'flex', gap:6, paddingLeft:6 }}>
                      <span style={{ color:'var(--text-dim)' }}>• {c.name}</span>
                      <span style={{ color:'var(--text-dim)', fontSize:8 }}>~{c.totalDose}мг/нед</span>
                    </div>
                  ))}
                  <div style={{ marginTop:4, paddingTop:6, borderTop:'1px solid var(--border)' }}>
                    <div>Уровень токсичности: <b style={{ color: toxicityColor }}>{toxicityLabel}</b></div>
                    {count17aa > 0 && (
                      <div>17α-алкилированные оральные: <b style={{ color:'#ef4444' }}>{count17aa} шт</b> → требуется усиленная защита печени</div>
                    )}
                    {(hasTren || hasNandrolone) && (
                      <div>Тренболон/Нандролон: <b style={{ color:'#f97316' }}>{[hasTren ? 'Тренболон' : '', hasNandrolone ? 'Нандролон' : ''].filter(Boolean).join(' + ')}</b> → требуется нейропротекция + контроль пролактина</div>
                    )}
                    {countAromatizing > 0 && (
                      <div>Ароматизирующиеся: <b style={{ color:'#f59e0b' }}>{countAromatizing} шт</b> → требуется контроль Е2</div>
                    )}
                    <div>Андрогенный индекс: <b style={{ color: totalAndrogenicity > 3 ? '#ef4444' : totalAndrogenicity > 1.5 ? '#f59e0b' : '#22c55e' }}>{totalAndrogenicity.toFixed(2)}</b> → {androLabel}</div>
                  </div>
                </div>
              )}
            </>)}
            </div>

            {/* ==================== 2b: АНАЛИЗ АНАЛИЗОВ ==================== */}
            <div style={{ background:'var(--bg-secondary)', borderRadius:12, padding:12, border:'1px solid var(--border)' }}>
              <div onClick={() => setExpandedCategories(p => ({ ...p, calc_labs: !(p.calc_labs ?? true) }))} style={{ display:'flex', alignItems:'center', gap:6, cursor:'pointer', marginBottom: (expandedCategories.calc_labs ?? true) ? 8 : 0 }}>
                <span style={{ fontSize:13 }}>🧪</span>
                <span style={{ flex:1, fontSize:12, fontWeight:700, color:'#60a5fa' }}>Анализы — требуется поддержка</span>
                <span style={{ fontSize:9, color:'var(--text-dim)', transform: (expandedCategories.calc_labs ?? true) ? 'rotate(180deg)' : 'none', transition:'transform 0.2s' }}>▼</span>
              </div>
              {(expandedCategories.calc_labs ?? true) && (<>
              {labs.length === 0 ? (
                <p style={{ fontSize:9, color:'var(--text-dim)', margin:0 }}>Нет анализов. <span style={{ color:'#60a5fa', cursor:'pointer', textDecoration:'underline' }} onClick={goHome}>Добавьте анализы</span> для персональных рекомендаций.</p>
              ) : (() => {
                const allLabResults = Object.keys(LAB_REC_MAP).map(code => getLabStatus(code)).filter(Boolean).filter(s => s!.status !== 'normal');
                if (allLabResults.length === 0) return <p style={{ fontSize:9, color:'#22c55e', margin:0 }}>Все показатели в норме ✅</p>;
                return (
                  <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
                    {allLabResults.map(s => {
                      const rec = LAB_REC_MAP[s!.status === 'critical' ? 'LDL' : 'LDL'] || {};
                      const code = Object.keys(LAB_REC_MAP).find(k => getLabStatus(k)?.value === s!.value) || '';
                      const recData = LAB_REC_MAP[code];
                      if (!recData) return null;
                      return (
                        <div key={code} style={{ padding:'4px 8px', borderRadius:6, background: s!.status === 'critical' ? 'rgba(239,68,68,0.06)' : 'rgba(245,158,11,0.04)', border: `1px solid ${s!.status === 'critical' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.1)'}`, fontSize:9 }}>
                          <span style={{ fontWeight:700, color: s!.status === 'critical' ? '#ef4444' : '#f59e0b' }}>{code} {s!.value}</span>
                          <span style={{ color: s!.status === 'critical' ? '#ef4444' : '#f59e0b' }}> {s!.status === 'critical' ? 'КРИТ' : ''} выше нормы</span>
                          <span style={{ color:'var(--text-dim)', fontSize:8 }}> → {recData.rec}</span>
                          <div style={{ color:'var(--text-dim)', fontSize:7, marginTop:1 }}>💡 Расчёт: {recData.dose} при весе {weightKg} кг</div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </>)}
            </div>

            {/* ==================== 2c: РИСКИ ПО СИСТЕМАМ ==================== */}
            <div style={{ background:'var(--bg-secondary)', borderRadius:12, padding:12, border:'1px solid var(--border)' }}>
              <div onClick={() => setExpandedCategories(p => ({ ...p, calc_risks: !(p.calc_risks ?? true) }))} style={{ display:'flex', alignItems:'center', gap:6, cursor:'pointer', marginBottom: (expandedCategories.calc_risks ?? true) ? 8 : 0 }}>
                <span style={{ fontSize:13 }}>📈</span>
                <span style={{ flex:1, fontSize:12, fontWeight:700, color:'#f59e0b' }}>Риски по системам</span>
                <span style={{ fontSize:9, color:'var(--text-dim)', transform: (expandedCategories.calc_risks ?? true) ? 'rotate(180deg)' : 'none', transition:'transform 0.2s' }}>▼</span>
              </div>
              {(expandedCategories.calc_risks ?? true) && (() => {
                const riskAssessment = calcResult?.riskAssessment;
                const sysBreakdown = riskAssessment?.systemBreakdown;
                if (!calcDone || !calcResult || !sysBreakdown || Object.keys(sysBreakdown).length === 0) {
                  return <p style={{ fontSize:9, color:'var(--text-dim)', margin:0 }}>Нет данных о рисках. Нажмите «Рассчитать» ниже.</p>;
                }
                return (
                  <div>
                    {calcDone && calcResult && (
                      <div style={{ display:'flex', justifyContent:'space-around', fontSize:13, fontWeight:800, color:'var(--text-light)', marginBottom:8, padding:'10px 12px', borderRadius:8, background:'rgba(0,0,0,0.08)', border:'1px solid var(--border)' }}>
                        <div style={{ textAlign:'center' }}>
                          <div style={{ fontSize:9, fontWeight:600, color:'var(--text-dim)', marginBottom:2 }}>Без поддержки</div>
                          <span style={{ fontSize:28, fontWeight:800, color:'#ef4444' }}>{Math.round(calcResult.riskBeforeSupport)}</span><span style={{ fontSize:14, color:'#ef4444' }}>%</span>
                        </div>
                        <div style={{ display:'flex', alignItems:'center', color:'var(--text-dim)', fontSize:16 }}>/</div>
                        <div style={{ textAlign:'center' }}>
                          <div style={{ fontSize:9, fontWeight:600, color:'var(--text-dim)', marginBottom:2 }}>С поддержкой</div>
                          <span style={{ fontSize:28, fontWeight:800, color:'#22c55e' }}>{Math.round(calcResult.riskAfterSupport)}</span><span style={{ fontSize:14, color:'#22c55e' }}>%</span>
                        </div>
                      </div>
                    )}
                    <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                      {SYSTEM_ORDER.filter(k => sysBreakdown[k]).map(sysKey => {
                        const sysData = sysBreakdown[sysKey];
                        const sysInfo = SYSTEM_LABELS_RU[sysKey] || { name: sysKey, emoji: '📌', rec: '' };
                        const rawRisk = sysData.raw ?? 0;
                        const netRisk = sysData.net ?? 0;
                        const color = riskColorFn(netRisk);
                        return (
                          <div key={sysKey}>
                            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:2 }}>
                              <span style={{ fontSize:9, fontWeight:600, color:'var(--text-light)' }}>{sysInfo.emoji} {sysInfo.name}</span>
                              <span style={{ fontSize:9, fontWeight:700, color }}>{Math.round(netRisk)}%</span>
                            </div>
                            <div style={{ height:6, borderRadius:3, background:'var(--bg-secondary)', overflow:'hidden', border:'1px solid var(--border)' }}>
                              <div style={{ height:'100%', width:`${Math.min(100, netRisk)}%`, borderRadius:3, background: color, transition:'width 0.4s' }} />
                            </div>
                            {netRisk > 25 && (
                              <div style={{ fontSize:7, color:'var(--text-dim)', marginTop:1, paddingLeft:18 }}>
                                → требуется {sysInfo.rec}
                              </div>
                            )}
                            {calcDone && calcResult && rawRisk !== netRisk && (
                              <div style={{ fontSize:7, color:'#22c55e', marginTop:1, paddingLeft:18 }}>
                                После поддержки: ~{Math.round(netRisk)}% (-{Math.round(rawRisk - netRisk)}%)
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* ==================== PHASE SELECTOR ==================== */}
            <div style={{ background:'var(--bg-secondary)', borderRadius:12, padding:12, border:'1px solid var(--border)' }}>
              <div onClick={() => setExpandedCategories(p => ({ ...p, calc_phase: !(p.calc_phase ?? true) }))} style={{ display:'flex', alignItems:'center', gap:6, cursor:'pointer', marginBottom: (expandedCategories.calc_phase ?? true) ? 8 : 0 }}>
                <span style={{ fontSize:13 }}>🔄</span>
                <span style={{ flex:1, fontSize:12, fontWeight:700, color:'var(--text)' }}>Фаза курса</span>
                <span style={{ fontSize:9, color:'var(--text-dim)', transform: (expandedCategories.calc_phase ?? true) ? 'rotate(180deg)' : 'none', transition:'transform 0.2s' }}>▼</span>
              </div>
              {(expandedCategories.calc_phase ?? true) && (<>
              <p style={{ fontSize:9, color:'var(--text-dim)', margin:'0 0 8px' }}>{PHASE_MODS[supportPhase]?.desc}</p>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:4 }}>
                {([
                  { v: 'course' as SupportPhase, l: '💉 Курс', d: 'На курсе' },
                  { v: 'bridge' as SupportPhase, l: '🌉 Мост', d: 'Мост' },
                  { v: 'pct' as SupportPhase, l: '🔄 ПКТ', d: 'Восстановление' },
                  { v: 'fertility' as SupportPhase, l: '⚧ Фертильность', d: 'Сперматогенез' },
                ]).map(p => (
                  <button key={p.v} onClick={() => setSupportPhase(p.v)} style={{
                    padding:'6px 2px', borderRadius:8, fontSize:9, cursor:'pointer', textAlign:'center',
                    background: supportPhase === p.v ? 'rgba(0,230,138,0.15)' : 'var(--bg-secondary)',
                    border: supportPhase === p.v ? '1px solid var(--accent)' : '1px solid var(--border)',
                    color: supportPhase === p.v ? '#00e68a' : 'var(--text-dim)', fontWeight: supportPhase === p.v ? 700 : 400,
                  }}>
                    <div style={{ fontSize:13 }}>{p.l}</div>
                    <div style={{ fontSize:7 }}>{p.d}</div>
                  </button>
                ))}
              </div>
              {supportPhase !== 'course' && (
                <div style={{ marginTop:4, fontSize:8, color:'#f59e0b' }}>
                  ⚡ +{PHASE_MODS[supportPhase]?.addSubs?.length || 0} / -{PHASE_MODS[supportPhase]?.removeSubs?.length || 0} веществ
                </div>
              )}
            </>)}
            </div>

            {/* ==================== GOAL SELECTOR (under phase card) ==================== */}
            <div style={{ background:'var(--bg-secondary)', borderRadius:12, padding:12, border:'1px solid var(--border)' }}>
              <div style={{ fontSize:9, color:'var(--text-dim)', marginBottom:6 }}>🎯 Цель</div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                {[{ v:'muscle_gain', l:'💪 Масса' },{ v:'fat_loss', l:'🔥 Сушка' },{ v:'strength', l:'🏋️ Сила' },
                  { v:'endurance', l:'🏃 Выносливость' },{ v:'recomp', l:'⚖️ Рекомп' },{ v:'maintenance', l:'🔄 Поддержание' }
                ].map(g => (
                  <button key={g.v} onClick={() => setSupportGoal(g.v)} style={{
                    padding:'5px 8px', borderRadius:6, fontSize:10, cursor:'pointer',
                    background: supportGoal === g.v ? 'rgba(0,230,138,0.15)' : 'var(--bg-secondary)',
                    border: supportGoal === g.v ? '1px solid var(--accent)' : '1px solid var(--border)',
                    color: supportGoal === g.v ? '#00e68a' : 'var(--text-dim)',
                    fontWeight: supportGoal === g.v ? 700 : 400,
                  }}>{g.l}</button>
                ))}
              </div>
            </div>

            {/* ==================== ADD 1: REAL CALCULATESUPPORT INTEGRATION ==================== */}
            <div style={{ background:'var(--bg-secondary)', borderRadius:12, padding:16, border:'2px solid rgba(0,230,138,0.25)', position:'relative' }}>
              <div style={{ position:'absolute', top:0, left:0, right:0, bottom:0, background:'linear-gradient(135deg, rgba(0,230,138,0.02), rgba(0,198,83,0.02))', pointerEvents:'none' }} />
              <div onClick={() => setExpandedCategories(p => ({ ...p, calc_intel: !(p.calc_intel ?? true) }))} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: (expandedCategories.calc_intel ?? true) ? 8 : 0, cursor:'pointer' }}>
                <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                  <span style={{ fontSize:16 }}>🧮</span>
                  <h4 style={{ margin:0, fontSize:13, color:'#00e68a' }}>Расчёт поддержки</h4>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                  <span style={{ fontSize:9, fontWeight:400, color:'var(--text-dim)', background:'rgba(0,230,138,0.08)', padding:'2px 8px', borderRadius:10 }}>v2.0</span>
                  <span style={{ fontSize:9, color:'var(--text-dim)', transform: (expandedCategories.calc_intel ?? true) ? 'rotate(180deg)' : 'none', transition:'transform 0.2s' }}>▼</span>
                </div>
              </div>
              {(expandedCategories.calc_intel ?? true) && (<>
               <p style={{ fontSize:9, color:'var(--text-dim)', margin:'0 0 10px', lineHeight:1.5 }}>
                Анализ: <b style={{ color:'var(--accent)' }}>{uniqCourse.length}</b> препаратов · <b style={{ color:'#60a5fa' }}>{labs.length}</b> анализов · <b style={{ color:'#f59e0b' }}>{Object.keys(riskData?.systemBreakdown || {}).length}</b> систем рисков · <b style={{ color:'#a78bfa' }}>{weightKg}</b>кг {age}лет {sex === 'male' ? '♂' : '♀'}
              </p>
              <div style={{ display:'flex', gap:6, marginBottom:6 }}>
                <button onClick={() => setShowModal('intel')} style={{
                  flex:1, padding:'12px', borderRadius:10, border:'none', cursor:'pointer',
                  background:'linear-gradient(135deg,#00e68a,#00c853)', color:'#000', fontWeight:700, fontSize:12,
                }}>
                  🧠 Интеллектуальный расчет
                </button>
                <button onClick={() => setShowModal('manual')} style={{
                  flex:1, padding:'12px', borderRadius:10, border:'1px solid var(--accent)', cursor:'pointer',
                  background:'transparent', color:'var(--accent)', fontWeight:700, fontSize:12,
                }}>
                  📋 Ручной выбор
                </button>
              </div>
              <button onClick={() => calcSupport()} style={{
                width:'100%', padding:'14px', borderRadius:12, border:'2px solid var(--accent)', cursor:'pointer',
                background:'linear-gradient(135deg, rgba(0,230,138,0.12), rgba(0,198,83,0.05))', color:'#00e68a', fontWeight:800, fontSize:13, marginBottom:6, letterSpacing:0.5,
              }}>
                🧮 Рассчитать поддержку
              </button>
              
              <button onClick={() => { setJointMode(!jointMode); if (!jointMode) setBoostEnabled(false); calcSupport(); }}
                style={{width:'100%',padding:10,borderRadius:8,marginTop:6,
                border: (jointMode ? '1px solid #8b5cf6' : '1px solid var(--border)'),
                background:jointMode?'rgba(139,92,246,0.1)':'var(--bg-secondary)',
                color:jointMode?'#8b5cf6':'var(--text-dim)',fontWeight:700,cursor:'pointer'}}>
                🦴 {jointMode ? '✅ Режим суставов включён' : 'Рассчитать суставы и связки'}
              </button>
              <button onClick={() => setShowModal('boost')}
                style={{width:'100%',padding:10,borderRadius:8,marginTop:4,
                border: (boostEnabled ? '1px solid #ef4444' : '1px solid var(--border)'),
                background:boostEnabled?'rgba(239,68,68,0.1)':'var(--bg-secondary)',
                color:boostEnabled?'#ef4444':'var(--text-dim)',fontWeight:700,cursor:'pointer'}}>
                🔴 {boostEnabled ? '✅ Усиление стека включено' : 'Усилить стек (+20 препаратов)'}
              </button>
{calcDone && calcResult && (
                <div style={{ marginTop:10, padding:'12px', borderRadius:10, background:'rgba(0,230,138,0.03)', border:'1px solid rgba(0,230,138,0.1)' }}>
                  <div style={{ fontSize:11, fontWeight:700, color:'var(--text-light)', marginBottom:10, display:'flex', alignItems:'center', gap:6 }}>
                    📊 Результат расчёта
                    {calcResult.supportScore > 50 ? <span style={{ fontSize:9, padding:'1px 6px', borderRadius:4, background:'rgba(34,197,94,0.12)', color:'#22c55e' }}>Оптимально</span> : calcResult.supportScore > 25 ? <span style={{ fontSize:9, padding:'1px 6px', borderRadius:4, background:'rgba(245,158,11,0.12)', color:'#f59e0b' }}>Средне</span> : <span style={{ fontSize:9, padding:'1px 6px', borderRadius:4, background:'rgba(239,68,68,0.12)', color:'#ef4444' }}>Недостаточно</span>}
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8, padding:'8px 10px', borderRadius:8, background:'rgba(0,0,0,0.08)', border:'1px solid var(--border)' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                      <span style={{ fontSize:9, color:'var(--text-dim)' }}>Без</span>
                      <span style={{ fontSize:13, fontWeight:800, color:'#ef4444' }}>{Math.round(calcResult.riskBeforeSupport)}%</span>
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                      <span style={{ fontSize:10, color:'var(--accent)', fontWeight:700 }}>/</span>
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                      <span style={{ fontSize:9, color:'var(--text-dim)' }}>С</span>
                      <span style={{ fontSize:13, fontWeight:800, color:'#22c55e' }}>{Math.round(calcResult.riskAfterSupport)}%</span>
                    </div>
                    <div style={{ padding:'2px 8px', borderRadius:6, background:'rgba(34,197,94,0.1)' }}>
                      <span style={{ fontSize:10, fontWeight:700, color:'#22c55e' }}>{Math.round(calcResult.riskBeforeSupport)}/{Math.round(calcResult.riskAfterSupport)}</span>
                    </div>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8, padding:'6px 10px', borderRadius:6, background:'rgba(139,92,246,0.05)', border:'1px solid rgba(139,92,246,0.1)' }}>
                    <span style={{ fontSize:9, color:'var(--text-dim)', minWidth:90 }}>Оценка поддержки</span>
                    <div style={{ flex:1, height:6, borderRadius:3, background:'var(--bg-secondary)', overflow:'hidden', border:'1px solid var(--border)' }}>
                      <div style={{ height:'100%', width:`${Math.min(100, calcResult.supportScore)}%`, borderRadius:3, background: calcResult.supportScore > 50 ? 'linear-gradient(90deg,#22c55e,#4ade80)' : calcResult.supportScore > 25 ? 'linear-gradient(90deg,#eab308,#f59e0b)' : 'linear-gradient(90deg,#ef4444,#f97316)', transition:'width 0.6s' }} />
                    </div>
                    <span style={{ fontSize:12, fontWeight:800, color:'#8b5cf6', minWidth:40, textAlign:'right' }}>{Math.round(calcResult.supportScore)}/100</span>
                  </div>
                  {calcResult.systemSupport && Object.keys(calcResult.systemSupport).length > 0 && (
                    <div style={{ marginBottom:8 }}>
                      <div style={{ fontSize:9, fontWeight:600, color:'var(--text-dim)', marginBottom:4 }}>📈 Покрытие по системам:</div>
                      <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
                        {SYSTEM_ORDER.filter(k => (calcResult.systemSupport || {})[k] !== undefined).map(sysKey => {
                          const cov = (calcResult.systemSupport || {})[sysKey] || 0;
                          const sysInfo = SYSTEM_LABELS_RU[sysKey] || { name: sysKey, emoji: '📌' };
                          const barColor = cov > 60 ? '#22c55e' : cov > 30 ? '#f59e0b' : '#ef4444';
                          return (
                            <div key={sysKey} style={{ display:'flex', alignItems:'center', gap:5 }}>
                              <span style={{ fontSize:9, color:'var(--text-light)', minWidth:85 }}>{sysInfo.emoji} {sysInfo.name}</span>
                              <div style={{ flex:1, height:4, borderRadius:2, background:'var(--bg-secondary)', overflow:'hidden' }}>
                                <div style={{ height:'100%', width:`${Math.min(100, cov)}%`, borderRadius:2, background: barColor, transition:'width 0.5s' }} />
                              </div>
                              <span style={{ fontSize:9, fontWeight:600, color: barColor, minWidth:28, textAlign:'right' }}>{Math.round(cov)}%</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {/* Recommendations based on low coverage */}
                  {calcResult && (calcResult.systemSupport || {}).cardio !== undefined && (
                    <div style={{ marginTop:6, padding:'8px 10px', borderRadius:8, background:'rgba(0,0,0,0.12)', border:'1px solid var(--border)' }}>
                      <div style={{ fontSize:9, fontWeight:700, color:'#f59e0b', marginBottom:4 }}>💡 Рекомендации по покрытию:</div>
                      {((calcResult.systemSupport || {}).cardio || 0) < 30 && (
                        <div style={{ fontSize:8, color:'var(--text-light)', marginBottom:2 }}>💊 <b>Давление/ЧСС:</b> небилетол 5 мг или тельмисартан 40 мг</div>
                      )}
                      {((calcResult.systemSupport || {}).hepatic || 0) < 30 && (
                        <div style={{ fontSize:8, color:'var(--text-light)', marginBottom:2 }}>🫁 <b>Печень:</b> NAC 1200 мг + TUDCA 500 мг (до еды)</div>
                      )}
                      {((calcResult.systemSupport || {}).renal || 0) < 30 && (
                        <div style={{ fontSize:8, color:'var(--text-light)', marginBottom:2 }}>🫘 <b>Почки:</b> астрагал 1000 мг + таурин 2000 мг</div>
                      )}
                      {((calcResult.systemSupport || {}).neuro || 0) < 30 && (
                        <div style={{ fontSize:8, color:'var(--text-light)', marginBottom:2 }}>🧠 <b>Нервная:</b> магний 400 мг + ашваганда 600 мг</div>
                      )}
                      {((calcResult.systemSupport || {}).endocrine || 0) < 30 && (
                        <div style={{ fontSize:8, color:'var(--text-light)', marginBottom:2 }}>⚗️ <b>Эндокринная:</b> витамин D3 5000 МЕ + цинк 30 мг</div>
                      )}
                      {((calcResult.systemSupport || {}).reproductive || 0) < 30 && (
                        <div style={{ fontSize:8, color:'var(--text-light)', marginBottom:2 }}>⚧ <b>Репродуктивная:</b> ХГЧ 500 МЕ 2x/нед (схема 3/1) + сабаль 640 мг</div>
                      )}
                      {((calcResult.systemSupport || {}).hematologic || 0) < 30 && (
                        <div style={{ fontSize:8, color:'var(--text-light)', marginBottom:2 }}>🩸 <b>Кроветворение:</b> фолат 800 мкг + B12 1000 мкг + железо (по анализам)</div>
                      )}
                      {((calcResult.systemSupport || {}).musculoskeletal || 0) < 30 && (
                        <div style={{ fontSize:8, color:'var(--text-light)', marginBottom:2 }}>🦴 <b>Опорно-двигательная:</b> коллаген 10 г + витамин C 1000 мг + глюкозамин 1500 мг</div>
                      )}
                    </div>
                  )}
                  <div style={{ padding:'6px 10px', borderRadius:6, background:'rgba(139,92,246,0.06)', border:'1px solid rgba(139,92,246,0.12)', fontSize:10 }}>
                    <span style={{ color:'#8b5cf6', fontWeight:600 }}>⚡ Рекомендованный уровень:</span>{' '}
                    <b style={{ color:'#8b5cf6' }}>{SUPPORT_LEVELS[autoLevel as string]?.label || autoLevel}</b>
                    <span style={{ color:'var(--text-dim)', fontSize:9 }}> — {SUPPORT_LEVELS[autoLevel as string]?.desc || 'Автоматически определённый уровень поддержки'}</span>
                  </div>
                  {/* Explanation of risk calculation */}
                  <details style={{ marginTop:6 }}>
                    <summary style={{ fontSize:8, fontWeight:600, color:'var(--text-dim)', cursor:'pointer' }}>📖 Как считаются риски и оценка поддержки</summary>
                    <div style={{ fontSize:7, color:'var(--text-dim)', lineHeight:1.5, marginTop:4, padding:'6px 8px', borderRadius:6, background:'rgba(0,0,0,0.06)' }}>
                      <b>Риск без поддержки:</b> {Math.round(calcResult.riskBeforeSupport)}% = максимальный риск по всем системам.<br/>
                      <b>Снижение риска:</b> каждый препарат покрывает системы с {calcResult.supportScore.toFixed(0)}% эффективностью. Защита = покрытие / 100 от базового риска.<br/>
                      <b>Риск с поддержкой:</b> {Math.round(calcResult.riskAfterSupport)}% = базовый риск × (1 - защита).<br/>
                      <b>Оценка поддержки:</b> {Math.round(calcResult.supportScore)}/100 — взвешенное среднее покрытия всех систем (вес систем: сердечно-сосуд. 15, печень 15, почки 10, нейро 10, эндокринная 12, кровь 8, репродуктивная 10, опорно-двиг. 10).<br/>
                      <b>Факторы:</b> питание ×{((linked.profile?.settings?.nutritionFactor ?? 0.8) * 100).toFixed(0)}%, тренировки ×{((linked.profile?.settings?.trainingFactor ?? 0.7) * 100).toFixed(0)}% дополнительно снижают риск.
                    </div>
                  </details>
                </div>
              )}
              </>)}
            </div>

            {/* ===== PLAN REVIEW CARD ===== */}
            {calcDone && effectiveLevel?.subs && effectiveLevel.subs.length > 0 && (
              <div style={{ background:'var(--bg-secondary)', borderRadius:12, padding:12, border:'1px solid var(--border)' }}>
                <div onClick={() => setExpandedCategories(p => ({ ...p, calc_plan: !(p.calc_plan ?? true) }))} style={{ display:'flex', alignItems:'center', gap:6, cursor:'pointer', marginBottom: (expandedCategories.calc_plan ?? true) ? 8 : 0 }}>
                  <span style={{ fontSize:12, fontWeight:700, color:'var(--text-light)', flex:1 }}>📋 План поддержки ({effectiveLevel.subs.length} препаратов)</span>
                  <span style={{ fontSize:9, color:'var(--text-dim)', transform: (expandedCategories.calc_plan ?? true) ? 'rotate(180deg)' : 'none', transition:'transform 0.2s' }}>▼</span>
                </div>
                {(expandedCategories.calc_plan ?? true) && (<>
                  <div style={{ display:'flex', flexDirection:'column', gap:3, maxHeight:'40vh', overflowY:'auto', marginBottom:8 }}>
                    {effectiveLevel.subs.map((id: string) => {
                      const sub = allSupport.find((s: any) => s.id === id);
                      const d = effectiveLevel.dosages?.[id];
                      return sub ? (
                        <div key={id} style={{ padding:'5px 8px', borderRadius:6, background:'rgba(255,255,255,0.02)', border:'1px solid var(--border)', fontSize:9, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                          <span style={{ fontWeight:600, color:'var(--text-light)' }}>{sub.name}</span>
                          {d && <span style={{ color:'#00e68a', fontSize:8 }}>{d.mg}мг — {d.timing}</span>}
                        </div>
                      ) : null;
                    })}
                  </div>
                  <div style={{ display:'flex', gap:6 }}>
                    <button style={{ flex:1, padding:'8px', borderRadius:8, border:'none', cursor:'pointer', background:'var(--accent)', color:'#000', fontWeight:700, fontSize:10 }} onClick={() => setPlanSaved(true)}>✅ Утвердить план</button>
                    <button onClick={() => { setShowModal('manual'); setModalAddMode(true); setPlanSaved(false); }} style={{ flex:1, padding:'8px', borderRadius:8, border:'1px solid var(--border)', cursor:'pointer', background:'transparent', color:'var(--text-dim)', fontWeight:600, fontSize:10 }}>✏️ Внести изменения</button>
                  </div>
                  {/* Timing table when approved */}
                  {planSaved && (
                    <div style={{ marginTop:8, padding:'8px 10px', borderRadius:8, background:'rgba(0,230,138,0.04)', border:'1px solid rgba(0,230,138,0.12)' }}>
                      <div style={{ fontSize:10, fontWeight:700, color:'#00e68a', marginBottom:6 }}>✅ План утверждён</div>
                      <table style={{ width:'100%', fontSize:8, borderCollapse:'collapse' }}>
                        <thead><tr style={{ background:'rgba(0,0,0,0.1)' }}>
                          <th style={{ padding:'3px 5px', textAlign:'left' }}>Время</th>
                          <th style={{ padding:'3px 5px', textAlign:'left' }}>Препарат</th>
                          <th style={{ padding:'3px 5px', textAlign:'left' }}>Доза</th>
                          <th style={{ padding:'3px 5px', textAlign:'left' }}>Примечание</th>
                        </tr></thead>
                        <tbody>
                          {effectiveLevel.subs.map((id: string) => {
                            const sub = allSupport.find((s: any) => s.id === id);
                            const d = effectiveLevel.dosages?.[id];
                            if (!sub || !d) return null;
                            return (
                              <tr key={id} style={{ borderBottom:'1px solid var(--border)' }}>
                                <td style={{ padding:'3px 5px', color:'var(--text-dim)' }}>{d.timing}</td>
                                <td style={{ padding:'3px 5px', fontWeight:600, color:'var(--text-light)' }}>{sub.name}</td>
                                <td style={{ padding:'3px 5px', color:'#00e68a' }}>{d.mg} мг</td>
                                <td style={{ padding:'3px 5px', color:'var(--text-dim)' }}>{sub.description?.slice(0,30) || ''}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      {/* Synergies info */}
                      <div style={{ marginTop:8, fontSize:8, color:'var(--text-dim)' }}>
                        <div style={{ fontWeight:600, color:'var(--text-light)', marginBottom:3 }}>⚡ Синергии в стеке:</div>
                        {effectiveLevel.subs.slice(0, 6).map((id: string, i: number) => {
                          const sub = allSupport.find((s: any) => s.id === id);
                          if (!sub) return null;
                          const syn = ALL_INTERACTIONS.filter((int: any) => 
                            (int.substanceA === id || int.substanceB === id) && int.type === 'synergy'
                          ).slice(0, 2);
                          return syn.length > 0 ? syn.map((s: any, j: number) => (
                            <div key={`${i}-${j}`} style={{ padding:'2px 0' }}>
                              ⊕ {sub.name} + {allSupport.find((x: any) => x.id === (s.substanceA === id ? s.substanceB : s.substanceA))?.name || ''}: {s.effect}
                            </div>
                          )) : null;
                        })}
                      </div>
                      {/* Second table: mechanisms, synergies, interactions per substance */}
                      <div style={{ marginTop:10, fontSize:8, color:'var(--text-dim)' }}>
                        <div style={{ fontWeight:700, color:'#8b5cf6', marginBottom:4, fontSize:9 }}>🧬 Механизмы, препараты и синергии</div>
                        <table style={{ width:'100%', fontSize:7.5, borderCollapse:'collapse' }}>
                          <thead><tr style={{ background:'rgba(139,92,246,0.08)' }}>
                            <th style={{ padding:'3px 4px', textAlign:'left', color:'#8b5cf6', fontWeight:600 }}>Препарат</th>
                            <th style={{ padding:'3px 4px', textAlign:'left', color:'#8b5cf6', fontWeight:600 }}>Механизм</th>
                            <th style={{ padding:'3px 4px', textAlign:'left', color:'#8b5cf6', fontWeight:600 }}>Синергии</th>
                          </tr></thead>
                          <tbody>
                            {effectiveLevel.subs.map((id: string) => {
                              const sub = allSupport.find((s: any) => s.id === id);
                              const subDb = ALL_SUBSTANCES.find((s: any) => s.id === id);
                              if (!sub) return null;
                              const mechanisms = (subDb?.mechanisms || []).slice(0, 3);
                              const syns = ALL_INTERACTIONS.filter((int: any) => 
                                (int.substanceA === id || int.substanceB === id) && int.type === 'synergy'
                              ).slice(0, 2);
                              const conflicts = ALL_INTERACTIONS.filter((int: any) => 
                                (int.substanceA === id || int.substanceB === id) && int.type === 'conflict'
                              ).slice(0, 1);
                              return (
                                <tr key={id} style={{ borderBottom:'1px solid var(--border)' }}>
                                  <td style={{ padding:'3px 4px', fontWeight:600, color:'var(--text-light)' }}>{sub.name}</td>
                                  <td style={{ padding:'3px 4px', color:'var(--text-dim)' }}>
                              {mechanisms.length > 0 ? mechanisms.map((m: string) => (
                                <div key={m} style={{ lineHeight:1.3, marginBottom:1 }}>• {MECH_LABELS[m] || m.replace(/_/g, ' ')}</div>
                              )) : <span style={{ color:'rgba(255,255,255,0.3)' }}>—</span>}
                            </td>
                            <td style={{ padding:'3px 4px' }}>
                              {syns.map((s: any, j: number) => {
                                const partner = ALL_SUBSTANCES.find((x: any) => x.id === (s.substanceA === id ? s.substanceB : s.substanceA));
                                return (
                                  <div key={j} style={{ color:'#22c55e', lineHeight:1.3 }}>⊕ {partner?.name || '?'} — {s.effect?.slice(0,35)}</div>
                                );
                              })}
                              {conflicts.length > 0 && conflicts.map((c: any, j: number) => {
                                const partner = ALL_SUBSTANCES.find((x: any) => x.id === (c.substanceA === id ? c.substanceB : c.substanceA));
                                return (
                                  <div key={`c${j}`} style={{ color:'#ef4444', lineHeight:1.3 }}>⊖ {partner?.name || '?'} — {c.effect?.slice(0,35)}</div>
                                );
                              })}
                              {syns.length === 0 && conflicts.length === 0 && <span style={{ color:'rgba(255,255,255,0.3)' }}>—</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            </>)}
          </div>
      )}
      
            {/* ==================== ADD 5: INTEGRATION NOTICE ==================== */}
            <div style={{ padding:'10px 12px', borderRadius:10, background:'rgba(96,165,250,0.05)', border:'1px solid rgba(96,165,250,0.12)', display:'flex', alignItems:'flex-start', gap:8 }}>
              <span style={{ fontSize:14, flexShrink:0 }}>🔄</span>
              <div>
                <div style={{ fontSize:9, fontWeight:600, color:'#60a5fa', marginBottom:2 }}>Автоматическая синхронизация</div>
                <div style={{ fontSize:8, color:'var(--text-dim)', lineHeight:1.4 }}>
                  Данные обновляются автоматически из вашего профиля, курса и анализов. Измените параметры в Профиле или Анализах для пересчёта.
                </div>
              </div>
            </div>





            {/* ==================== PHASE 4: SAVE & SHARE ==================== */}
            <div style={{ background:'var(--bg-secondary)', borderRadius:12, padding:12, border:'1px solid var(--border)' }}>
              <h4 style={{ margin:'0 0 8px', fontSize:12, color:'var(--text)' }}>💾 Сохранить и поделиться</h4>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6 }}>
                <button onClick={savePlan} style={{
                  padding:'10px', borderRadius:8, border:'1px solid var(--accent)', background:'rgba(0,230,138,0.08)',
                  cursor:'pointer', fontSize:10, fontWeight:700, color:'var(--accent)',
                }}>💾 Сохранить план</button>
                <button onClick={copyPlan} style={{
                  padding:'10px', borderRadius:8, border:'1px solid #60a5fa', background:'rgba(96,165,250,0.08)',
                  cursor:'pointer', fontSize:10, fontWeight:700, color:'#60a5fa',
                }}>📋 Копировать</button>
                <button onClick={async () => {
                  const text = buildShareText();
                  try {
                    await navigator.clipboard.writeText(text);
                    alert('✅ Текст плана скопирован в буфер обмена');
                  } catch {
                    try {
                      if (navigator.share) {
                        await navigator.share({ title: 'План поддержки', text });
                      } else {
                        prompt('📋 Скопируйте текст вручную:', text);
                      }
                    } catch { prompt('📋 Скопируйте текст вручную:', text); }
                  }
                }} style={{
                  padding:'10px', borderRadius:8, border:'1px solid #34d399', background:'rgba(52,211,153,0.08)',
                  cursor:'pointer', fontSize:10, fontWeight:700, color:'#34d399',
                }}>📤 Поделиться</button>
                <button onClick={() => alert('Напоминания через Telegram Mini App будут доступны в следующем обновлении.')} style={{
                  padding:'10px', borderRadius:8, border:'1px solid #a78bfa', background:'rgba(167,139,250,0.08)',
                  cursor:'pointer', fontSize:10, fontWeight:700, color:'#a78bfa',
                }}>📅 Напомнить</button>
                <button onClick={exportForDoctor} style={{
                  padding:'10px', borderRadius:8, border:'1px solid #f59e0b', background:'rgba(245,158,11,0.08)',
                  cursor:'pointer', fontSize:10, fontWeight:700, color:'#f59e0b',
                }}>👨‍⚕️ Экспорт врачу</button>
              </div>
              {planSavedLocal && (
                <div style={{ textAlign:'center', fontSize:10, color:'#22c55e', marginTop:6, padding:'4px', borderRadius:6, background:'rgba(34,197,94,0.06)' }}>✅ План сохранён в localStorage</div>
              )}
            </div>



          </div>
        </div>
        );
        } catch(e) { return <div style={{ padding:40, textAlign:'center', color:'#ef4444', background:'var(--bg-secondary)', borderRadius:12, margin:20 }}>⚠️ Ошибка калькулятора: {String(e)}<br/><button onClick={goBack} style={{ marginTop:12, padding:'6px 16px', borderRadius:8, cursor:'pointer', background:'var(--accent)', border:'none', color:'#000', fontWeight:600 }}>← Назад</button></div>; }
      })()}

      {/* ===== PEPTIDE CALCULATOR ===== */}
      {section === 'info' && tab === 'main' && supportView === 'calc' && calcView === 'peptides' && (
        <div style={{ padding:'0 0 80px', height:'100vh', display:'flex', flexDirection:'column' }}>
          <div style={{ display:'flex', gap:6, marginBottom:6 }}>
            <button onClick={goBack} style={{ padding:'4px 8px', borderRadius:6, fontSize:10, cursor:'pointer', background:'var(--bg-secondary)', border:'1px solid var(--border)', color:'var(--text-dim)', fontWeight:600 }}>← Назад</button>
            <button onClick={goHome} style={{ padding:'4px 8px', borderRadius:6, fontSize:10, cursor:'pointer', background:'var(--bg-secondary)', border:'1px solid var(--border)', color:'var(--text-dim)', fontWeight:600 }}>← На главную Поддержки</button>
          </div>
          <h2 style={{ margin:'0 0 4px', fontSize:16, fontWeight:800, color:'#a78bfa' }}>🧬 Пептидный калькулятор</h2>
          <p style={{ fontSize:10, color:'var(--text-dim)', margin:'0 0 12px' }}>Расчёт дозировок, баков, разведения и протоколов пептидов.</p>
          <div style={{ flex:1, overflowY:'auto', paddingRight:4 }}>
            {/* Peptide Selection */}
            <div style={{ background:'var(--bg-secondary)', borderRadius:12, padding:14, marginBottom:10, border:'1px solid var(--border)' }}>
              <h4 style={{ margin:'0 0 8px', fontSize:12, color:'var(--text)' }}>🧪 Выберите пептид</h4>
              <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginBottom:12 }}>
                {PEPTIDE_LIST.map(p => (
                  <button key={p.id} onClick={() => { setPeptideId(p.id); setPepAmount(2); setPepDose(100); }} style={{
                    padding:'6px 10px', borderRadius:16, fontSize:9, fontWeight:600, whiteSpace:'nowrap', cursor:'pointer',
                    background: peptideId === p.id ? 'var(--accent)' : 'var(--bg-secondary)',
                    color: peptideId === p.id ? '#000' : 'var(--text-dim)',
                    border: `1px solid ${peptideId === p.id ? 'var(--accent)' : 'var(--border)'}`,
                  }}>{p.name}</button>
                ))}
              </div>
              {peptideId && (() => {
                const sel = PEPTIDE_LIST.find(p => p.id === peptideId);
                if (!sel) return null;
                const routesStr = (sel.routes||[]).map(r => ROUTE_LABELS[r]||r).join(', ') || '—';
                const riskColor = sel.riskLevel === 'high' ? '#ef4444' : sel.riskLevel === 'medium' ? '#f59e0b' : '#22c55e';
                const riskLabel = sel.riskLevel === 'high' ? 'Высокий' : sel.riskLevel === 'medium' ? 'Средний' : sel.riskLevel === 'low' ? 'Низкий' : '—';
                return (
                  <div style={{ padding:'8px 10px', borderRadius:8, background:'rgba(167,139,250,0.06)', border:'1px solid rgba(167,139,250,0.15)' }}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#a78bfa', marginBottom:2 }}>{sel.name || sel.shortName || '—'}</div>
                    <div style={{ fontSize:9, color:'var(--text-dim)', lineHeight:1.4, marginBottom:3 }}>
                      <b>Эффекты:</b> {(sel.effects || []).join(', ') || '—'}
                    </div>
                    <div style={{ fontSize:8, color:'#a78bfa', marginBottom:2 }}>
                      <b>T½:</b> {sel.tHalfHours || '—'} ч · <b>Класс:</b> {sel.className || '—'} · <b>Пути:</b> {routesStr}
                    </div>
                    {(sel.mechanisms||[]).length > 0 && (
                      <div style={{ fontSize:8, color:'rgba(255,255,255,0.9)', marginBottom:2, lineHeight:1.3 }}>
                        <b>Механизмы:</b> {(sel.mechanisms||[]).join(', ') || '—'}
                      </div>
                    )}
                    <div style={{ fontSize:8, marginTop:2, display:'flex', gap:8, flexWrap:'wrap' }}>
                      <span style={{ color: 'var(--text-dim)' }}><b>Во флаконе:</b> {sel.amountMg || '—'} мг</span>
                      <span style={{ color: riskColor, fontWeight:600 }}><b>Риск:</b> {riskLabel}</span>
                      {(sel.riskNotes||[]).length > 0 && (
                        <span style={{ color:'#f59e0b', fontSize:7, maxWidth:180, lineHeight:1.2, display:'inline-block' }}>
                          ⚠ {(sel.riskNotes||[]).slice(0,3).join('; ') || '—'}
                        </span>
                      )}
                    </div>
                    {sel.bioavailability && Object.keys(sel.bioavailability).length > 0 && (
                      <div style={{ fontSize:7, color:'var(--text-dim)', marginTop:2 }}>
                        <b>Биодоступность:</b> {Object.entries(sel.bioavailability).map(([k,v]) => `${ROUTE_LABELS[k]||k}: ${v.avg}%`).join(', ') || '—'}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Dilution Calculator */}
            <div style={{ background:'var(--bg-secondary)', borderRadius:12, padding:14, marginBottom:10, border:'1px solid var(--border)' }}>
              <h4 style={{ margin:'0 0 8px', fontSize:12, color:'#60a5fa' }}>💧 Калькулятор разведения</h4>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                <div>
                  <div style={{ fontSize:9, color:'var(--text-dim)', marginBottom:4 }}>Кол-во пептида (мг)</div>
                  <input type="number" value={pepAmount} onChange={e => setPepAmount(Math.max(0.1, Number(e.target.value) || 1))} style={{ width:'100%', padding:'6px 8px', borderRadius:6, border:'1px solid var(--border)', background:'rgba(0,0,0,0.2)', color:'var(--text)', fontSize:11, boxSizing:'border-box' }} />
                </div>
                <div>
                  <div style={{ fontSize:9, color:'var(--text-dim)', marginBottom:4 }}>Объём бака (мл)</div>
                  <input type="number" value={pepDilution} onChange={e => setPepDilution(Math.max(0.1, Number(e.target.value) || 1))} style={{ width:'100%', padding:'6px 8px', borderRadius:6, border:'1px solid var(--border)', background:'rgba(0,0,0,0.2)', color:'var(--text)', fontSize:11, boxSizing:'border-box' }} />
                </div>
                <div>
                  <div style={{ fontSize:9, color:'var(--text-dim)', marginBottom:4 }}>Дозировка (мкг)</div>
                  <input type="number" value={pepDose} onChange={e => setPepDose(Math.max(1, Number(e.target.value) || 100))} style={{ width:'100%', padding:'6px 8px', borderRadius:6, border:'1px solid var(--border)', background:'rgba(0,0,0,0.2)', color:'var(--text)', fontSize:11, boxSizing:'border-box' }} />
                </div>
                <div>
                  <div style={{ fontSize:9, color:'var(--text-dim)', marginBottom:4 }}>Шприц</div>
                  <select value={pepSyringe} onChange={e => setPepSyringe(e.target.value as keyof typeof SYRINGE_TYPES)} style={{ width:'100%', padding:'6px 8px', borderRadius:6, border:'1px solid var(--border)', background:'rgba(0,0,0,0.2)', color:'var(--text)', fontSize:10, boxSizing:'border-box' }}>
                    {Object.entries(SYRINGE_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
              </div>
              {(() => {
                const conc = pepAmount / pepDilution; // mg/mL
                const doseMg = pepDose / 1000; // mcg -> mg
                const doseMl = doseMg / conc;
                const syringeInfo = SYRINGE_TYPES[pepSyringe];
                const units = syringeInfo ? doseMl * syringeInfo.unitsPerMl : doseMl * 100;
                return (
                  <div style={{ marginTop:10, padding:'10px 12px', borderRadius:8, background:'rgba(96,165,250,0.06)', border:'1px solid rgba(96,165,250,0.15)' }}>
                    <div style={{ fontSize:9, color:'var(--text-dim)', marginBottom:4 }}>📐 Результат разведения</div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:4, fontSize:9 }}>
                      <div>Концентрация: <b style={{ color:'#60a5fa' }}>{conc.toFixed(2)} мг/мл</b></div>
                      <div>Объем дозы: <b style={{ color:'#60a5fa' }}>{doseMl.toFixed(3)} мл</b></div>
                      <div>Единиц (IU): <b style={{ color:'#60a5fa' }}>{units.toFixed(0)} IU</b></div>
                      <div>Доз на флакон: <b style={{ color:'#60a5fa' }}>{pepDilution > 0 && doseMl > 0 ? Math.floor(pepDilution / doseMl) : 0}</b></div>
                    </div>
                    <div style={{ fontSize:8, color:'var(--text-dim)', marginTop:2 }}>Наберите {units.toFixed(0)} IU ({doseMl.toFixed(3)} мл) для дозы {pepDose} мкг</div>
                  </div>
                );
              })()}
            </div>

            {/* PK Display */}
            {peptideId && (() => {
              const sel = PEPTIDE_LIST.find(p => p.id === peptideId);
              if (!sel) return null;
              const tHalf = sel.tHalfHours || 4;
              const peakTime = tHalf * 0.33;
              const steadyState = tHalf * 5;
              const clearanceTime = tHalf * 6;
              return (
                <div style={{ background:'var(--bg-secondary)', borderRadius:12, padding:14, marginBottom:10, border:'1px solid var(--border)' }}>
                  <h4 style={{ margin:'0 0 8px', fontSize:12, color:'#a78bfa' }}>📈 Фармакокинетика (PK)</h4>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
                    <div style={{ padding:'8px 10px', borderRadius:8, background:'rgba(167,139,250,0.06)', border:'1px solid rgba(167,139,250,0.1)' }}>
                      <div style={{ fontSize:8, color:'var(--text-dim)' }}>Период полувыведения (T½)</div>
                      <div style={{ fontSize:16, fontWeight:800, color:'#a78bfa' }}>{tHalf.toFixed(1)} ч</div>
                    </div>
                    <div style={{ padding:'8px 10px', borderRadius:8, background:'rgba(167,139,250,0.06)', border:'1px solid rgba(167,139,250,0.1)' }}>
                      <div style={{ fontSize:8, color:'var(--text-dim)' }}>Пик концентрации (Cmax)</div>
                      <div style={{ fontSize:16, fontWeight:800, color:'#a78bfa' }}>{peakTime.toFixed(1)} ч</div>
                    </div>
                    <div style={{ padding:'8px 10px', borderRadius:8, background:'rgba(167,139,250,0.06)', border:'1px solid rgba(167,139,250,0.1)' }}>
                      <div style={{ fontSize:8, color:'var(--text-dim)' }}>Стабильное состояние (5×T½)</div>
                      <div style={{ fontSize:16, fontWeight:800, color:'#a78bfa' }}>{steadyState.toFixed(1)} ч</div>
                    </div>
                    <div style={{ padding:'8px 10px', borderRadius:8, background:'rgba(167,139,250,0.06)', border:'1px solid rgba(167,139,250,0.1)' }}>
                      <div style={{ fontSize:8, color:'var(--text-dim)' }}>Полный клиренс (6×T½)</div>
                      <div style={{ fontSize:16, fontWeight:800, color:'#a78bfa' }}>{clearanceTime.toFixed(1)} ч</div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Dosing Schedule */}
            <div style={{ background:'var(--bg-secondary)', borderRadius:12, padding:14, marginBottom:10, border:'1px solid var(--border)' }}>
              <h4 style={{ margin:'0 0 8px', fontSize:12, color:'#f59e0b' }}>📅 График дозирования</h4>
              <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginBottom:8 }}>
                {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(day => {
                  const active = pepSchedule.includes(day);
                  return (
                    <button key={day} onClick={() => setPepSchedule(active ? pepSchedule.filter(d => d !== day) : [...pepSchedule, day])} style={{
                      padding:'6px 10px', borderRadius:8, fontSize:9, fontWeight:600, cursor:'pointer',
                      background: active ? 'var(--accent)' : 'var(--bg-secondary)',
                      color: active ? '#000' : 'var(--text-dim)',
                      border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                    }}>{day}</button>
                  );
                })}
              </div>
              <div>
                <div style={{ fontSize:9, color:'var(--text-dim)', marginBottom:4 }}>Длительность (дней)</div>
                <input type="number" value={pepTotalDays} onChange={e => setPepTotalDays(Math.max(1, Number(e.target.value) || 30))} style={{ width:'100%', padding:'6px 8px', borderRadius:6, border:'1px solid var(--border)', background:'rgba(0,0,0,0.2)', color:'var(--text)', fontSize:11, boxSizing:'border-box' }} />
              </div>
              <div style={{ marginTop:8, padding:'10px 12px', borderRadius:8, background:'rgba(245,158,11,0.06)', border:'1px solid rgba(245,158,11,0.15)' }}>
                <div style={{ fontSize:9, color:'var(--text-dim)', marginBottom:4 }}>📊 Итого</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:4, fontSize:9 }}>
                  <div>Доз в неделю: <b style={{ color:'#f59e0b' }}>{pepSchedule.length}</b></div>
                  <div>Всего доз: <b style={{ color:'#f59e0b' }}>{Math.round(pepTotalDays / 7 * pepSchedule.length)}</b></div>
                  <div>Недельный расход: <b style={{ color:'#f59e0b' }}>{(pepSchedule.length * pepDose / 1000).toFixed(1)} мг</b></div>
                  <div>Общий расход: <b style={{ color:'#f59e0b' }}>{(pepTotalDays / 7 * pepSchedule.length * pepDose / 1000).toFixed(1)} мг</b></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== NEUROTOXICITY CALCULATOR ===== */}
      {section === 'home' && tab === 'main' && supportView === 'calc' && calcView === 'neuro' && (() => {
        const course = linked?.course || [];
        const neuroColor = neuroScore < 30 ? '#22c55e' : neuroScore < 50 ? '#f59e0b' : neuroScore < 70 ? '#f97316' : '#ef4444';
        const neuroLabel = neuroScore < 30 ? 'Низкий' : neuroScore < 50 ? 'Средний' : neuroScore < 70 ? 'Высокий' : 'Критический';

        return safeRender('neuro', () => (
        <div style={{ padding:'0 0 80px' }}>
          <h2 style={{ margin:'0 0 4px', fontSize:16, fontWeight:800, color:'#ec4899' }}>🧠 Нейротоксичность ААС</h2>
          <p style={{ fontSize:10, color:'var(--text-dim)', margin:'0 0 12px', lineHeight:1.4 }}>
            Механизмы нейротоксичности, калькулятор риска и многоуровневый протокол нейропротекции.
          </p>

          {/* Tabs */}
          <div style={{ display:'flex', gap:4, marginBottom:12, overflowX:'auto', scrollbarWidth:'none' }}>
            {[
              { id:'calc', label:'🧮 Калькулятор' },
              { id:'mechanisms', label:'🔬 Механизмы' },
              { id:'support', label:'💊 Протокол' },
            ].map(t => (
              <button key={t.id} onClick={() => setNeuroTab(t.id as any)} style={{
                padding:'8px 14px', borderRadius:20, fontSize:10, fontWeight:700, whiteSpace:'nowrap', cursor:'pointer',
                background: neuroTab === t.id ? 'var(--accent)' : 'var(--bg-secondary)',
                color: neuroTab === t.id ? '#000' : 'var(--text-dim)',
                border: `1px solid ${neuroTab === t.id ? 'var(--accent)' : 'var(--border)'}`,
              }}>{t.label}</button>
            ))}
          </div>

          {neuroTab === 'calc' && (<>
          {/* Compound Selection */}
          <div style={{ background:'var(--bg-secondary)', borderRadius:12, padding:14, marginBottom:10, border:'1px solid var(--border)' }}>
            <h4 style={{ margin:'0 0 8px', fontSize:12, color:'var(--text)' }}>💊 Соединения курса</h4>
            {uniqueCompounds.length === 0 ? (
              <p style={{ fontSize:10, color:'var(--text-dim)', textAlign:'center', padding:'16px 0' }}>Нет активного курса. Добавьте соединения на вкладке Фарма.</p>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                {uniqueCompounds.map((c, i) => {
                  const isSelected = neuroSelected.includes(c.cls);
                  const ph = PHARMA_DB[c.substanceId];
                  const neuroToxPd = ph?.pd?.neuro_toxicity ?? 0;
                  return (
                  <div key={i} style={{ padding:'8px 10px', borderRadius:8, background:isSelected ? 'rgba(236,72,153,0.08)' : 'rgba(255,255,255,0.03)', border:`1px solid ${isSelected ? 'rgba(236,72,153,0.25)' : 'var(--border)'}` }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <label style={{ display:'flex', alignItems:'center', gap:6, flex:1, cursor:'pointer', userSelect:'none' }}>
                        <input type="checkbox" checked={isSelected} onChange={() => setNeuroSelected(prev => prev.includes(c.cls) ? prev.filter(x => x !== c.cls) : [...prev, c.cls])} style={{ accentColor:'#ec4899' }} />
                        <span style={{ fontSize:11, fontWeight:600, color:'var(--text-light)' }}>{c.name}</span>
                        <span style={{ fontSize:8, color:'var(--text-dim)', background:'rgba(255,255,255,0.06)', padding:'1px 5px', borderRadius:3 }}>PD:{neuroToxPd}</span>
                      </label>
                      {isSelected && (
                        <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                          <input type="number" value={neuroDoses[c.cls] || ''} onChange={e => setNeuroDoses(prev => ({ ...prev, [c.cls]: Number(e.target.value) || 0 }))} style={{ width:60, padding:'4px 6px', borderRadius:4, border:'1px solid var(--border)', background:'rgba(0,0,0,0.2)', color:'var(--text)', fontSize:10, textAlign:'center' }} />
                          <span style={{ fontSize:9, color:'var(--text-dim)' }}>мг/нед</span>
                        </div>
                      )}
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Duration & Age */}
          <div style={{ display:'flex', gap:8, marginBottom:10 }}>
            <div style={{ flex:1, background:'var(--bg-secondary)', borderRadius:12, padding:12, border:'1px solid var(--border)' }}>
              <div style={{ fontSize:9, color:'var(--text-dim)', marginBottom:4 }}>⏱ Длительность курса (недель)</div>
              <input type="number" value={neuroDuration} onChange={e => setNeuroDuration(Math.max(1, Math.min(52, Number(e.target.value) || 1)))} style={{ width:'100%', padding:'8px 10px', borderRadius:8, border:'1px solid var(--border)', background:'rgba(0,0,0,0.2)', color:'var(--text)', fontSize:14, fontWeight:700, textAlign:'center', boxSizing:'border-box' }} />
            </div>
            <div style={{ flex:1, background:'var(--bg-secondary)', borderRadius:12, padding:12, border:'1px solid var(--border)' }}>
              <div style={{ fontSize:9, color:'var(--text-dim)', marginBottom:4 }}>🎂 Возраст</div>
              <input type="number" value={neuroAge} onChange={e => setNeuroAge(Math.max(18, Math.min(80, Number(e.target.value) || 18)))} style={{ width:'100%', padding:'8px 10px', borderRadius:8, border:'1px solid var(--border)', background:'rgba(0,0,0,0.2)', color:'var(--text)', fontSize:14, fontWeight:700, textAlign:'center', boxSizing:'border-box' }} />
            </div>
          </div>

          {/* Score */}
          <div style={{ background:neuroColor+'18', borderRadius:12, padding:16, marginBottom:10, border:`2px solid ${neuroColor}44`, textAlign:'center' }}>
            <div style={{ fontSize:10, color:'var(--text-dim)', marginBottom:4 }}>Общий индекс нейротоксичности</div>
            <div style={{ fontSize:42, fontWeight:800, color:neuroColor, lineHeight:1 }}>{neuroScore}</div>
            <div style={{ fontSize:14, fontWeight:700, color:neuroColor, marginTop:4 }}>{neuroLabel}</div>
            <div style={{ marginTop:8, height:6, borderRadius:3, background:'rgba(255,255,255,0.1)', overflow:'hidden' }}>
              <div style={{ width:`${neuroScore}%`, height:'100%', borderRadius:3, background:`linear-gradient(90deg, #22c55e, #f59e0b ${50}%, #f97316 ${70}%, #ef4444)`, transition:'width 0.5s' }} />
            </div>
          </div>

          {/* Symptoms reference */}
          <div style={{ background:'var(--bg-secondary)', borderRadius:12, padding:14, marginBottom:10, border:'1px solid var(--border)' }}>
            <h4 style={{ margin:'0 0 8px', fontSize:12, color:'#ef4444' }}>🩺 Симптомы нейротоксичности</h4>
            <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
              {['Депрессия','Тревожность','Агрессия/раздражительность','Нарушение сна','Когнитивное снижение','Потеря памяти','Ангедония','Импульсивность','Спутанность сознания','Эмоциональная нестабильность'].map((s, i) => (
                <span key={i} style={{ fontSize:9, padding:'4px 8px', borderRadius:12, background:'rgba(239,68,68,0.08)', color:'#fca5a5', border:'1px solid rgba(239,68,68,0.15)' }}>⚠ {s}</span>
              ))}
            </div>
          </div>

          {/* Monitoring */}
          <div style={{ background:'var(--bg-secondary)', borderRadius:12, padding:14, border:'1px solid var(--border)' }}>
            <h4 style={{ margin:'0 0 8px', fontSize:12, color:'#60a5fa' }}>📊 Мониторинг</h4>
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {[
                { label:'BDNF (нейротрофический фактор мозга)', desc:'Маркер нейропластичности, снижен при ААС-нейротоксичности', target:'> 20 нг/мл' },
                { label:'Нейропсихологическая оценка', desc:'Тесты памяти, внимания, исполнительных функций', target:'Каждые 3-6 мес' },
                { label:'Кортизол (утренний)', desc:'Гиперкортизолемия усугубляет нейротоксичность', target:'10-20 мкг/дл' },
                { label:'Пролактин', desc:'Гиперпролактинемия ассоциирована с депрессией', target:'< 15 нг/мл' },
              ].map((m, i) => (
                <div key={i} style={{ padding:'6px 8px', borderRadius:6, background:'rgba(59,130,246,0.06)', border:'1px solid rgba(59,130,246,0.1)' }}>
                  <div style={{ fontSize:10, fontWeight:600, color:'var(--text-light)' }}>{m.label}</div>
                  <div style={{ display:'flex', justifyContent:'space-between', marginTop:2 }}>
                    <span style={{ fontSize:9, color:'var(--text-dim)' }}>{m.desc}</span>
                    <span style={{ fontSize:9, fontWeight:600, color:'#60a5fa' }}>{m.target}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          </>)}

          {neuroTab === 'mechanisms' && (
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {/* NEW: 3 detailed mechanism cards */}
              <div style={{ background:'var(--bg-secondary)', borderRadius:12, padding:14, border:'1px solid var(--border)' }}>
                <h4 style={{ margin:'0 0 10px', fontSize:13, color:'#ec4899' }}>🧠 Фундаментальные механизмы нейротоксичности ААС</h4>
                <div style={{ padding:'10px 12px', borderRadius:8, marginBottom:8, background:'rgba(236,72,153,0.06)', border:'1px solid rgba(236,72,153,0.15)' }}>
                  <div style={{ fontSize:11, fontWeight:700, color:'#f472b6', marginBottom:4 }}>🔬 Гематоэнцефалический барьер (ГЭБ)</div>
                  <div style={{ fontSize:9, color:'var(--text-dim)', lineHeight:1.5 }}>ГЭБ — тонко настроенный фильтр между кровью и мозгом. Пропускает молекулы по двум правилам: небольшой размер и низкая полярность. Стероиды, эстрогены, кортикоиды соответствуют ОБОИМ правилам → свободно проникают в мозг. При нормальных концентрациях гормонов это полезно (развитие мозга). При супрафизиологических дозах ААС — нейротоксический каскад.</div>
                </div>
                <div style={{ padding:'10px 12px', borderRadius:8, marginBottom:8, background:'rgba(236,72,153,0.06)', border:'1px solid rgba(236,72,153,0.15)' }}>
                  <div style={{ fontSize:11, fontWeight:700, color:'#f472b6', marginBottom:4 }}>🎯 Андрогенные и эстрогенные рецепторы мозга</div>
                  <div style={{ fontSize:9, color:'var(--text-dim)', lineHeight:1.5 }}>Мозг насыщен андрогенными (AR) и эстрогенными (ER) рецепторами. Тестостерон → эстрадиол (через ароматазу в мозге) → ER-опосредованная нейропротекция (в норме). При гипер-дозах: AR-гиперстимуляция → окислительный стресс нейронов. Без контроля Е2 — ER-дисфункция → потеря нейропротекции.</div>
                </div>
                <div style={{ padding:'10px 12px', borderRadius:8, marginBottom:8, background:'rgba(236,72,153,0.06)', border:'1px solid rgba(236,72,153,0.15)' }}>
                  <div style={{ fontSize:11, fontWeight:700, color:'#f472b6', marginBottom:4 }}>⚡ Негормональные механизмы</div>
                  <div style={{ fontSize:9, color:'var(--text-dim)', lineHeight:1.5 }}>ААС действуют не только через рецепторы: ГАМК-рецепторы (тормозная система) — подавление → тревога/судороги. NMDA-рецепторы (память/обучение) — эксайтотоксичность. Митохондриальная дисфункция → энергодефицит нейронов. Ионные каналы (Ca²+) → кальциевый шторм. Факторы роста (BDNF, NGF) — подавление → нейродегенерация.</div>
                </div>
              </div>

              {/* Detailed mechanism cards */}
              <div style={{ background:'var(--bg-secondary)', borderRadius:12, padding:14, border:'1px solid var(--border)' }}>
                <h4 style={{ margin:'0 0 10px', fontSize:13, color:'#ec4899' }}>🔬 Детальные механизмы нейротоксичности ААС</h4>
                {[
                  { title:'ГАМК-ергическая дисфункция', desc:'ААС повышают ГАМК-ергический тормозной тон в гипоталамусе через нейростероиды (аллопрегнанолон) → подавление пульсирующей секреции ГнРГ. Дисрегуляция GABA-A рецепторов вызывает тревожность, депрессию и когнитивные нарушения при отмене.' },
                  { title:'Окислительный стресс', desc:'Истощение глутатиона в нейронах гиппокампа, перекисное окисление липидов мембран. Супероксид-дисмутаза и каталаза снижены при применении нандролона и станозолола. Митохондриальная дисфункция → снижение АТФ → апоптоз.' },
                  { title:'Нейровоспаление', desc:'Активация микроглии через TLR4-рецепторы → выброс TNF-α, IL-1β, IL-6. Хроническое воспаление в гиппокампе и префронтальной коре коррелирует с тяжестью депрессивных симптомов. NF-κB сигнальный путь активирован.' },
                  { title:'BDNF подавление', desc:'Нандролон и станозолол снижают BDNF (brain-derived neurotrophic factor) в гиппокампе и префронтальной коре на 30-50%. Нарушение CREB-BDNF-TrkB сигнального каскада → атрофия дендритных шипиков → потеря синаптической пластичности.' },
                  { title:'Нарушение гематоэнцефалического барьера', desc:'Тренболон накапливается в гиппокампе, повышая проницаемость ГЭБ. Нарушение плотных контактов (окклюдин, клаудин-5) → проникновение периферических провоспалительных цитокинов в ЦНС.' },
                  { title:'Апоптоз нейронов', desc:'Каспаза-3 активация в CA1 и CA3 зонах гиппокампа. Фрагментация ДНК, конденсация хроматина. Bax/Bcl-2 соотношение сдвинуто в сторону проапоптотического пути. Активация PARP-1.' },
                  { title:'KNDy-нейроны', desc:'Подавление кисспептин/нейрокинин B/динорфин (KNDy) нейронов дугообразного ядра. Нарушение пульсирующей секреции ГнРГ → утрата цирхорального ритма ЛГ. Критично для репродуктивной оси и полового поведения.' },
                  { title:'Дофаминовая система', desc:'Изменение экспрессии D2-рецепторов в стриатуме и прилежащем ядре → ангедония, агрессия, импульсивность. Нарушение мезокортикального дофаминового пути → снижение когнитивного контроля и мотивации.' },
                ].map((m, i) => (
                  <div key={i} style={{ padding:'10px 12px', borderRadius:8, marginBottom:6, background:'rgba(236,72,153,0.04)', border:'1px solid rgba(236,72,153,0.12)' }}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#f472b6', marginBottom:4 }}>{m.title}</div>
                    <div style={{ fontSize:9, color:'var(--text-dim)', lineHeight:1.5 }}>{m.desc}</div>
                  </div>
                ))}
              </div>

              {/* AAS Risk Classification Table */}
              <div style={{ background:'var(--bg-secondary)', borderRadius:12, padding:14, border:'1px solid var(--border)' }}>
                <h4 style={{ margin:'0 0 10px', fontSize:13, color:'#f97316' }}>⚠️ Классификация нейротоксичности ААС</h4>
                <p style={{ fontSize:9, color:'var(--text-dim)', margin:'0 0 10px', lineHeight:1.4 }}>Относительный риск (1-10) на основе проницаемости ГЭБ, окислительного стресса, глутаматной токсичности и подавления нейротрофических факторов.</p>
                {[
                  { name:'Тренболон', score:10, color:'#ef4444', desc:'ГЭБ проницаемость + окислительный стресс + глутаматная токсичность' },
                  { name:'Нандролон', score:8, color:'#ef4444', desc:'Снижение BDNF, нейровоспаление' },
                  { name:'Станозолол', score:7, color:'#f97316', desc:'ГАМК-дисфункция, BDNF подавление' },
                  { name:'Метандиенон', score:6, color:'#f97316', desc:'Эстрогеновая активность, гепатотоксичность' },
                  { name:'Болденон', score:5, color:'#f59e0b', desc:'Гематокрит + эритроцитоз → гипоксия мозга' },
                  { name:'Тестостерон (>500 мг)', score:4, color:'#f59e0b', desc:'Дозозависимая AR-гиперстимуляция' },
                  { name:'Оксандролон', score:3, color:'#22c55e', desc:'Низкая андрогенность, ГЭБ ограничен' },
                  { name:'Мастерон', score:3, color:'#22c55e', desc:'DHT-нейростероидные эффекты' },
                  { name:'Примоболан', score:2, color:'#22c55e', desc:'Минимальная нейротоксичность' },
                ].map((drug, di) => (
                  <div key={di} style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 8px', borderRadius:6, marginBottom:4, background:'rgba(255,255,255,0.02)', border:'1px solid var(--border)' }}>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:10, fontWeight:600, color:'var(--text-light)' }}>{drug.name}</div>
                      <div style={{ fontSize:8, color:'var(--text-dim)', marginTop:1 }}>{drug.desc}</div>
                    </div>
                    <div style={{ width:80, textAlign:'center' }}>
                      <span style={{ fontSize:16, fontWeight:800, color:drug.color }}>{drug.score}</span>
                      <span style={{ fontSize:10, fontWeight:600, color:'var(--text-dim)' }}>/10</span>
                    </div>
                    <div style={{ width:80, height:4, borderRadius:2, background:'rgba(255,255,255,0.06)', overflow:'hidden' }}>
                      <div style={{ width:`${drug.score * 10}%`, height:'100%', borderRadius:2, background:drug.color }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {neuroTab === 'support' && (
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              <div style={{ background:'var(--bg-secondary)', borderRadius:12, padding:14, border:'1px solid var(--border)' }}>
                <h4 style={{ margin:'0 0 4px', fontSize:13, color:'#22c55e' }}>💊 Многоуровневая нейропротекция</h4>
                <p style={{ fontSize:9, color:'var(--text-dim)', margin:'0 0 12px', lineHeight:1.4 }}>
                  Протокол построен по принципу эскалации. Начинайте с ядра, добавляйте уровни по мере повышения риска.
                </p>
                {[
                  { tier:'ЯДРО', label:'Обязательно всем на курсе', color:'#22c55e', items:[
                    { name:'NAC', dose:'1200-2400 мг/день', note:'Предшественник глутатиона, мощный антиоксидант, защищает нейроны от окислительного стресса' },
                    { name:'Omega-3 (EPA+DHA)', dose:'3-5 г/день', note:'Нейропротекция через резолвины, антивоспалительное, поддержка мембран нейронов' },
                    { name:'Magnesium L-Threonate', dose:'1000-2000 мг/день', note:'Единственная форма магния, эффективно преодолевающая ГЭБ, NMDA-модуляция, защита от эксайтотоксичности' },
                    { name:'Таурин', dose:'2-3 г/день', note:'ГАМК-агонист, осморегуляция нейронов, защита от эксайтотоксичности' },
                    { name:'Глицин', dose:'3 г/день', note:'Тормозной нейромедиатор, улучшение качества сна, модуляция NMDA-рецепторов' },
                  ]},
                  { tier:'БАЗА', label:'При дозах >500 мг/нед', color:'#f59e0b', items:[
                    { name:'Alpha-Lipoic Acid (ALA)', dose:'600 мг/день', note:'Митохондриальный антиоксидант, хелатор металлов, регенерирует глутатион и витамины C/E' },
                    { name:'CoQ10 (убихинол)', dose:'200-400 мг/день', note:'Защита митохондрий нейронов, электрон-транспортная цепь, снижение перекисного окисления' },
                    { name:'Pregnenolone', dose:'10-30 мг/день', note:'Нейростероид-предшественник. Восполняет подавленный синтез нейростероидов при ААС. Улучшает когницию и настроение.' },
                    { name:'Агмантин', dose:'1-2 г/день', note:'Модулятор NMDA-рецепторов, NO-донатор, нейропротекция через полиаминовый путь' },
                    { name:'Альфа-GPC', dose:'300-600 мг/день', note:'Высокобиодоступный источник холина, синтез ацетилхолина, когнитивная поддержка' },
                  ]},
                  { tier:'УСИЛЕНИЕ', label:'При тренболоне/нандролоне', color:'#f97316', items:[
                    { name:'Lion\'s Mane (ежовик)', dose:'1-3 г/день', note:'Стимулирует NGF (фактор роста нервов), нейрогенез в гиппокампе, миелинизацию' },
                    { name:'DHEA', dose:'25-50 мг/день', note:'Нейростероид, восстанавливает GABA-A модуляцию, снижает депрессивные симптомы' },
                    { name:'Phosphatidylserine', dose:'300-600 мг/день', note:'Фосфолипид мембран нейронов, поддерживает текучесть мембран, снижает кортизол' },
                    { name:'Ginkgo Biloba', dose:'120-240 мг/день', note:'Церебральный кровоток, антиоксидант, ингибитор PAF' },
                    { name:'Бромантан', dose:'50-100 мг/день', note:'Актопротектор с нейропротективным действием, повышение физической и умственной работоспособности' },
                    { name:'Фасорацетам', dose:'100-200 мг/день', note:'AMPA-модулятор, нейропротекция через глутаматную регуляцию, улучшение памяти' },
                    { name:'Гуперзин А', dose:'50-100 мкг/день', note:'Ингибитор ацетилхолинэстеразы, повышение уровня ацетилхолина, когнитивная поддержка' },
                  ]},
                  { tier:'МАКСИМУМ', label:'При нейросимптомах', color:'#ef4444', items:[
                    { name:'Bacopa Monnieri', dose:'300-600 мг/день', note:'Улучшение памяти и когниции, дендритное ветвление, антиоксидант' },
                    { name:'L-Theanine', dose:'200-400 мг/день', note:'ГАМК-модуляция без седации, повышение альфа-волн мозга, снижение тревожности' },
                    { name:'Citicoline', dose:'500-1000 мг/день', note:'Источник цитидина и холина, синтез ацетилхолина, стабилизация мембран нейронов' },
                    { name:'Noopept', dose:'10-30 мг/день', note:'Повышение BDNF и NGF, улучшение памяти и когнитивных функций' },
                    { name:'Семакс', dose:'1-3 мг/день', note:'Нейропептид, повышение BDNF, нейрогенез, ноотропное и нейропротективное действие' },
                    { name:'Кортексин', dose:'10 мг/день', note:'Полипептидный комплекс коры головного мозга, нейропротекция, нейрорепарация' },
                    { name:'Церебролизин (инъекционно)', dose:'5-10 мл/день', note:'Мультимодальная нейропротекция: нейрогенез, нейропластичность, нейротрофический каскад. Под мед. контролем.' },
                  ]},
                ].map((tier, ti) => (
                  <div key={ti} style={{ padding:'10px 12px', borderRadius:10, marginBottom:8, background:`${tier.color}0a`, border:`1px solid ${tier.color}22` }}>
                    <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:6 }}>
                      <span style={{ fontSize:9, fontWeight:800, padding:'2px 8px', borderRadius:6, background:`${tier.color}22`, color:tier.color }}>{tier.tier}</span>
                      <span style={{ fontSize:10, fontWeight:600, color:'var(--text-light)' }}>{tier.label}</span>
                    </div>
                    {tier.items.map((item, ii) => (
                      <div key={ii} style={{ padding:'6px 8px', borderRadius:6, marginBottom:4, background:'rgba(255,255,255,0.03)', border:'1px solid var(--border)' }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                          <span style={{ fontSize:10, fontWeight:600, color:'var(--text-light)' }}>{item.name}</span>
                          <div style={{ display:'flex', gap:4, alignItems:'center' }}>
                            <span style={{ fontSize:9, fontWeight:700, color:tier.color }}>{item.dose}</span>
                              <button onClick={() => { const id = resolveProtoId(item.name); if (id && !enhancedSubs.includes(id)) setEnhancedSubs(prev => [...prev, id]); }} style={{
                                padding:'2px 8px', borderRadius:6, fontSize:8, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap',
                                background: (() => { const id = resolveProtoId(item.name); return id && enhancedSubs.includes(id) ? 'rgba(0,230,138,0.15)' : 'rgba(0,230,138,0.08)'; })(),
                                border: (() => { const id = resolveProtoId(item.name); return `1px solid ${id && enhancedSubs.includes(id) ? 'rgba(0,230,138,0.4)' : 'rgba(0,230,138,0.2)'}`; })(),
                                color: (() => { const id = resolveProtoId(item.name); return id && enhancedSubs.includes(id) ? '#00e68a' : 'rgba(0,230,138,0.7)'; })(),
                              }}>{((): string => { const id = resolveProtoId(item.name); return id && enhancedSubs.includes(id) ? '✓' : '+ Стек'; })()}</button>
                          </div>
                        </div>
                        <div style={{ fontSize:8, color:'var(--text-dim)', marginTop:2, lineHeight:1.3 }}>{item.note}</div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        ));
      })()}

      {/* ===== JOINTS/LIGAMENTS CALCULATOR ===== */}
      {section === 'home' && tab === 'main' && supportView === 'calc' && calcView === 'joints' && (() => {
        return safeRender('joints', () => (
        <div style={{ padding:'0 0 80px' }}>
          <h2 style={{ margin:'0 0 4px', fontSize:16, fontWeight:800, color:'#f59e0b' }}>🦴 Калькулятор суставов и связок</h2>
          <p style={{ fontSize:10, color:'var(--text-dim)', margin:'0 0 12px', lineHeight:1.4 }}>
            Оценка риска суставной патологии и многоуровневая поддержка хрящевой и соединительной ткани.
          </p>

          {/* Risk Inputs */}
          <div style={{ background:'var(--bg-secondary)', borderRadius:12, padding:14, marginBottom:10, border:'1px solid var(--border)' }}>
            <h4 style={{ margin:'0 0 10px', fontSize:12, color:'var(--text)' }}>📊 Параметры оценки</h4>
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              <div>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                  <span style={{ fontSize:10, color:'var(--text-dim)' }}>🦵 Боль в суставах</span>
                  <span style={{ fontSize:10, fontWeight:700, color:jointColor }}>{jointPain}/10</span>
                </div>
                <input type="range" min="0" max="10" value={jointPain} onChange={e => setJointPain(Number(e.target.value))} style={{ width:'100%', accentColor:jointColor }} />
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:8, color:'var(--text-dim)' }}>
                  <span>Нет боли</span><span>Умеренная</span><span>Сильная</span>
                </div>
              </div>
              <div>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                  <span style={{ fontSize:10, color:'var(--text-dim)' }}>🏥 Травмы в анамнезе</span>
                  <span style={{ fontSize:10, fontWeight:700, color:jointColor }}>{injuryHistory}/5</span>
                </div>
                <input type="range" min="0" max="5" value={injuryHistory} onChange={e => setInjuryHistory(Number(e.target.value))} style={{ width:'100%', accentColor:jointColor }} />
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:8, color:'var(--text-dim)' }}>
                  <span>Нет</span><span>Растяжения</span><span>Разрывы/операции</span>
                </div>
              </div>
              <div>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                  <span style={{ fontSize:10, color:'var(--text-dim)' }}>🏋️ Тренировочная нагрузка</span>
                  <span style={{ fontSize:10, fontWeight:700, color:jointColor }}>{trainLoad}/5</span>
                </div>
                <input type="range" min="0" max="5" value={trainLoad} onChange={e => setTrainLoad(Number(e.target.value))} style={{ width:'100%', accentColor:jointColor }} />
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:8, color:'var(--text-dim)' }}>
                  <span>Лёгкая</span><span>Умеренная</span><span>Тяжёлые веса</span>
                </div>
              </div>
            </div>
          </div>

          {/* Score */}
          <div style={{ background:jointColor+'18', borderRadius:12, padding:16, marginBottom:10, border:`2px solid ${jointColor}44`, textAlign:'center' }}>
            <div style={{ fontSize:10, color:'var(--text-dim)', marginBottom:4 }}>Индекс риска суставов</div>
            <div style={{ fontSize:42, fontWeight:800, color:jointColor, lineHeight:1 }}>{jointScore}</div>
            <div style={{ fontSize:14, fontWeight:700, color:jointColor, marginTop:4 }}>{jointLabel}</div>
            <div style={{ marginTop:8, height:6, borderRadius:3, background:'rgba(255,255,255,0.1)', overflow:'hidden' }}>
              <div style={{ width:`${jointScore}%`, height:'100%', borderRadius:3, background:`linear-gradient(90deg, #22c55e, #f59e0b ${40}%, #f97316 ${60}%, #ef4444)`, transition:'width 0.5s' }} />
            </div>
          </div>

          {/* Required Analyses */}
          <div style={{ background:'var(--bg-secondary)', borderRadius:12, padding:14, marginBottom:10, border:'1px solid var(--border)' }}>
            <h4 style={{ margin:'0 0 8px', fontSize:12, color:'#60a5fa' }}>🧪 Рекомендуемые анализы</h4>
            <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
              {[
                { name:'Ревматоидный фактор (RF)', range:'< 14 МЕ/мл' },
                { name:'С-реактивный белок (CRP)', range:'< 3 мг/л' },
                { name:'Мочевая кислота', range:'200-420 мкмоль/л' },
                { name:'25-OH Витамин D', range:'50-80 нг/мл' },
                { name:'Кальций общий', range:'2.15-2.55 ммоль/л' },
                { name:'Антитела к коллагену II типа', range:'< 20 ЕД/мл' },
              ].map((a, i) => (
                <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'6px 8px', borderRadius:6, background:'rgba(59,130,246,0.04)', border:'1px solid rgba(59,130,246,0.08)' }}>
                  <span style={{ fontSize:10, color:'var(--text-light)' }}>{a.name}</span>
                  <span style={{ fontSize:9, fontWeight:600, color:'#60a5fa' }}>{a.range}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Imaging Examinations */}
          <div style={{ background:'var(--bg-secondary)', borderRadius:12, padding:14, marginBottom:10, border:'1px solid var(--border)' }}>
            <h4 style={{ margin:'0 0 8px', fontSize:12, color:'#a855f7' }}>🔬 Инструментальные исследования</h4>
            <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
              {[
                { name:'УЗИ суставов (B-режим)', purpose:'Оценка выпота, синовита, эрозий', when:'При боли/отёке ≥2 нед' },
                { name:'МРТ сустава (T1/T2/PD-FS)', purpose:'Визуализация хряща, менисков, связок', when:'При подозрении на повреждение мениска/связок, хроническая боль >4 нед' },
                { name:'Рентгенография (2 проекции)', purpose:'Оценка суставной щели, остеофитов, переломов', when:'При подозрении на перелом/остеоартрит' },
                { name:'КТ сустава', purpose:'Точная оценка костной архитектуры, переломов', when:'При сложных переломах/планировании операции' },
                { name:'УЗИ связок/сухожилий', purpose:'Оценка целостности, тендинопатии', when:'При локальной боли/хрусте в сухожилии' },
                { name:'Тепловизионное исследование', purpose:'Зоны асимметричной температурной активности', when:'Скрининг воспалительной активности' },
              ].map((e, i) => (
                <div key={i} style={{ padding:'6px 8px', borderRadius:6, background:'rgba(168,85,247,0.04)', border:'1px solid rgba(168,85,247,0.08)' }}>
                  <div style={{ fontSize:10, fontWeight:600, color:'#a855f7' }}>{e.name}</div>
                  <div style={{ fontSize:8, color:'var(--text-dim)', marginTop:1 }}>{e.purpose}</div>
                  <div style={{ fontSize:7, color:'#a855f7', marginTop:1, opacity:0.7 }}>Показание: {e.when}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Tiered Support */}
          <div style={{ background:'var(--bg-secondary)', borderRadius:12, padding:14, border:'1px solid var(--border)' }}>
            <h4 style={{ margin:'0 0 4px', fontSize:13, color:'#22c55e' }}>💊 Многоуровневая поддержка суставов</h4>
            <p style={{ fontSize:9, color:'var(--text-dim)', margin:'0 0 12px', lineHeight:1.4 }}>
              Эскалационный протокол: начните с ядра, добавляйте уровни пропорционально риску.
            </p>
            {[
              { tier:'ЯДРО', label:'Обязательный минимум', color:'#22c55e', items:[
                { name:'Коллаген II типа (UC-II)', dose:'40 мг/день', note:'Нативный неденатурированный коллаген, оральная толерантность, иммуномодуляция через Treg-клетки' },
                { name:'Витамин C', dose:'500-1000 мг/день', note:'Кофактор синтеза коллагена, гидроксилирование пролина и лизина' },
                { name:'Витамин D3 + K2', dose:'5000 МЕ + 100 мкг/день', note:'Кальциевый обмен, минерализация костной ткани, остеокальцин' },
              ]},
              { tier:'БАЗА', label:'При умеренном риске', color:'#f59e0b', items:[
                { name:'Глюкозамин сульфат', dose:'1500 мг/день', note:'Субстрат гликозаминогликанов, стимуляция синтеза протеогликанов хондроцитами' },
                { name:'Хондроитин сульфат', dose:'800-1200 мг/день', note:'Ингибирование MMP-3/MMP-13, удержание воды в матриксе хряща' },
                { name:'MSM (метилсульфонилметан)', dose:'2000-3000 мг/день', note:'Органическая сера, дисульфидные мостики коллагена, противовоспалительное' },
                { name:'Omega-3 (EPA+DHA)', dose:'3-5 г/день', note:'Резолвины и протектины, разрешение воспаления в синовиальной жидкости' },
              ]},
              { tier:'УСИЛЕНИЕ', label:'При высоком риске', color:'#f97316', items:[
                { name:'Гиалуроновая кислота', dose:'200-300 мг/день', note:'Компонент синовиальной жидкости, вязкоэластичность, смазка суставных поверхностей' },
                { name:'Куркумин (с пиперином)', dose:'500-1000 мг/день', note:'Ингибирование COX-2 и NF-kB, снижение IL-1beta и TNF-alpha в хондроцитах' },
                { name:'Босвеллия (AKBA)', dose:'300-500 мг/день', note:'Ингибирование 5-липоксигеназы, снижение лейкотриенов, антикатаболический эффект' },
              ]},
              { tier:'МАКСИМУМ', label:'При критическом риске', color:'#ef4444', items:[
                { name:'BPC-157 (пентадекапептид)', dose:'250-500 мкг/день', note:'Ускорение заживления сухожилий и связок, ангиогенез через VEGF, модуляция коллагена I/III типов' },
                { name:'TB-500 (тимозин beta-4)', dose:'2.5-5 мг/нед', note:'Полимеризация актина, миграция клеток, противовоспалительное, заживление связок и сухожилий' },
                { name:'Секретагоги ГР (ипаморелин/CJC-1295)', dose:'100-300 мкг/день', note:'Пульсирующая секреция ГР, IGF-1 опосредованная регенерация хряща и связок' },
              ]},
            ].map((tier, ti) => (
              <div key={ti} style={{ padding:'10px 12px', borderRadius:10, marginBottom:8, background:`${tier.color}0a`, border:`1px solid ${tier.color}22` }}>
                <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:6 }}>
                  <span style={{ fontSize:9, fontWeight:800, padding:'2px 8px', borderRadius:6, background:`${tier.color}22`, color:tier.color }}>{tier.tier}</span>
                  <span style={{ fontSize:10, fontWeight:600, color:'var(--text-light)' }}>{tier.label}</span>
                </div>
                {tier.items.map((item, ii) => (
                  <div key={ii} style={{ padding:'6px 8px', borderRadius:6, marginBottom:4, background:'rgba(255,255,255,0.03)', border:'1px solid var(--border)' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <span style={{ fontSize:10, fontWeight:600, color:'var(--text-light)' }}>{item.name}</span>
                      <div style={{ display:'flex', gap:4, alignItems:'center' }}>
                        <span style={{ fontSize:9, fontWeight:700, color:tier.color }}>{item.dose}</span>
                        <button onClick={() => { const id = resolveProtoId(item.name); if (id && !enhancedSubs.includes(id)) setEnhancedSubs(prev => [...prev, id]); }} style={{
                          padding:'2px 8px', borderRadius:6, fontSize:8, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap',
                          background:'rgba(0,230,138,0.08)', border:'1px solid rgba(0,230,138,0.2)', color:'rgba(0,230,138,0.7)',
                        }}>+ Стек</button>
                      </div>
                    </div>
                    <div style={{ fontSize:8, color:'var(--text-dim)', marginTop:2, lineHeight:1.3 }}>{item.note}</div>
                  </div>
                ))}
              </div>
            ))}
          </div>

            {/* Elbow Recovery Protocol */}
            <details style={{ marginTop:10 }}>
              <summary style={{ fontSize:11, fontWeight:700, color:'#f59e0b', cursor:'pointer', padding:'6px 0' }}>🔄 Протокол восстановления локтя (6 недель)</summary>
              <div style={{ padding:'6px 0' }}>
                <div style={{ fontSize:9, color:'var(--text-dim)', marginBottom:6, lineHeight:1.4 }}>
                  <b>Подготовка:</b> УЗИ/МРТ локтя → полный отдых 2 недели → стерильные шприцы/инсулинки
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                  {[
                    { name:'BPC-157', w1:'400 мкг (2×200 у локтя)', w3:'250 мкг (1 инъекция)', time:'Утро+вечер локально' },
                    { name:'TB-500', w1:'10 мг (4×2,5 мг)', w3:'5 мг (2×2,5 мг)', time:'Пн/Вт/Чт/Пт в живот' },
                    { name:'GHK-Cu', w1:'2 мг (2×1 мг)', w3:'1 мг', time:'Пн/Чт в живот' },
                    { name:'Босвеллия 65% AKBA', w1:'600 мг (3×200)', w3:'400 мг', time:'С едой' },
                    { name:'MSM', w1:'4 г (2×2 г)', w3:'2 г', time:'В воде утром/вечер' },
                    { name:'Куркумин 95%+пиперин', w1:'1500 мг (3×500)', w3:'1000 мг', time:'Вечер с едой' },
                    { name:'Коллаген I+II+III + вит.C', w1:'20 г + 1,5 г C', w3:'15 г + 1 г C', time:'Утро порошок' },
                    { name:'A4 Хавинсон (хрящ)', w1:'1-2 капс/день', w3:'1-2 капс/день', time:'Утро' },
                    { name:'A19 Хавинсон (сосуды)', w1:'1-2 капс/день', w3:'1-2 капс/день', time:'Вечер' },
                    { name:'LigamenTIDE PLUS', w1:'2 капс', w3:'1 капс', time:'Утро' },
                  ].map((r, i) => (
                    <div key={i} style={{ padding:'6px 8px', borderRadius:6, background:'rgba(245,158,11,0.04)', border:'1px solid rgba(245,158,11,0.12)', fontSize:10 }}>
                      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:2 }}>
                        <span style={{ fontWeight:700, color:'#f59e0b' }}>{r.name}</span>
                        <span style={{ fontSize:8, color:'var(--text-dim)' }}>{r.time}</span>
                      </div>
                      <div style={{ display:'flex', gap:8, fontSize:8, color:'var(--text-dim)' }}>
                        <span>Нед 1-2: <b style={{ color:'var(--text-light)' }}>{r.w1}</b></span>
                        <span>Нед 3-6: <b style={{ color:'var(--text-light)' }}>{r.w3}</b></span>
                      </div>
                    </div>
                  ))}
                  <div style={{ padding:'6px 8px', borderRadius:6, background:'rgba(59,130,246,0.04)', border:'1px solid rgba(59,130,246,0.12)' }}>
                    <div style={{ fontSize:9, fontWeight:700, color:'#3b82f6', marginBottom:4 }}>Дополнительно:</div>
                    <div style={{ fontSize:8, color:'var(--text-dim)', lineHeight:1.4 }}>
                      Нед 1: Мелоксикам 7,5 мг/день (5-7 дней)<br/>
                      Весь курс: Артра/Терафлекс 1 таб×2, Неовитин 1-2 мл/день<br/>
                      Вольтарен гель 2-3 раза/день локально<br/>
                      УЗТ/лазер 10 сеансов + вибромассаж 15 мин/день<br/>
                      <br/>
                      <b style={{ color:'var(--text-light)' }}>Контроль:</b> УЗИ на 14-й и 28-й день. Перерыв после курса — 6 недель.<br/>
                      <b style={{ color:'var(--text-light)' }}>Ожидание:</b> щелчок уходит за 7-10 дней, полное восстановление — 3-4 недели.
                    </div>
                  </div>
                </div>
              </div>
            </details>
           </div>

        ));
      })()}

      {/* ===== ACNE TAB ===== */}
      {section === 'home' && tab === 'main' && supportView === 'calc' && calcView === 'acne' && (
        <div style={{ padding:'0 0 80px' }}>
          <h2 style={{ margin:'0 0 4px', fontSize:16, fontWeight:800, color:'#ef4444' }}>🔴 Анти-прыщ протокол</h2>
          <p style={{ fontSize:10, color:'var(--text-dim)', margin:'0 0 12px' }}>Протокол борьбы с акне на курсе ААС: системная и локальная терапия.</p>
          <div style={{ background:'var(--bg-secondary)', borderRadius:12, padding:14, marginBottom:10, border:'1px solid var(--border)' }}>
            <h4 style={{ margin:'0 0 10px', fontSize:12 }}>⚙️ Ежедневный протокол</h4>
            {[{n:'Ниацинамид',d:'500-1000 мг',t:'На ночь',note:'Витамин B3. Регулирует себум, антивоспалительное.'},{n:'Медь',d:'1 мг',t:'На ночь',note:'Кофактор лизил-оксидазы. Сшивка коллагена.'},{n:'Солярий',d:'2 раза/нед × 5 мин',t:'День',note:'UV-B подсушивает акне. Не более 5 минут.'},{n:'Клендовит гель',d:'Тонкий слой',t:'Утро локально',note:'Клиндамицин+адапален. Только на зону акне.'},{n:'Клензит-С',d:'Тонкий слой',t:'На ночь локально',note:'Антибактериальный+комедонолитический.'},{n:'Верошпирон',d:'50 мг',t:'Утро',note:'Спиронолактон. Антиандроген. Контроль калия!'}].map((r,i)=>(<div key={i} style={{padding:'8px 10px',borderRadius:8,background:'rgba(239,68,68,0.04)',border:'1px solid rgba(239,68,68,0.12)',fontSize:10,marginBottom:6}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:2}}><span style={{fontWeight:700,color:'var(--text-light)'}}>{r.n}</span><div style={{display:'flex',gap:8,alignItems:'center'}}><span style={{fontSize:9,fontWeight:700,color:'#ef4444'}}>{r.d}</span><span style={{fontSize:8,color:'var(--text-dim)',padding:'1px 6px',borderRadius:4,background:'rgba(255,255,255,0.04)'}}>{r.t}</span>{r.n !== 'Солярий' && r.n !== 'Клендовит гель' && r.n !== 'Клензит-С' && <button onClick={()=>{const id=resolveProtoId(r.n);if(id&&!enhancedSubs.includes(id))setEnhancedSubs(prev=>[...prev,id]);}} style={{padding:'2px 6px',borderRadius:5,fontSize:7,fontWeight:700,cursor:'pointer',whiteSpace:'nowrap',background:'rgba(0,230,138,0.08)',border:'1px solid rgba(0,230,138,0.2)',color:'rgba(0,230,138,0.7)'}}>+Стек</button>}</div></div><div style={{fontSize:8,color:'var(--text-dim)',lineHeight:1.3}}>{r.note}</div></div>))}
          </div>
          <div style={{ background:'var(--bg-secondary)', borderRadius:12, padding:14, marginBottom:10, border:'1px solid var(--border)' }}>
            <h4 style={{ margin:'0 0 6px', fontSize:11 }}>🧼 Гигиена и уход</h4>
            <p style={{ fontSize:10, color:'var(--text-light)', lineHeight:1.6, margin:'0 0 6px' }}>Минимум <b style={{color:'#ef4444'}}>1 раз в день</b> тщательное мытьё с очищением пор от себума. На курсе ААС выработка кожного сала резко возрастает → поры забиваются → закупорка → благоприятная среда для бактерий → акне.</p>
            <p style={{ fontSize:10, color:'var(--text-light)', lineHeight:1.6, margin:'0 0 6px' }}><b style={{color:'#ef4444'}}>Клензит-С</b> содержит антибактериальный компонент + адапален для открытия комедонов.</p>
            <p style={{ fontSize:10, color:'var(--text-light)', lineHeight:1.6 }}><b style={{color:'#f59e0b'}}>Верошпирон:</b> калий-сберегающий диуретик+антиандроген. Блокирует AR в коже. <b style={{color:'#ef4444'}}>СЛЕДИ ЗА КАЛИЕМ!</b></p>
          </div>
          {/* Analyses & Examinations */}
          <div style={{ background:'var(--bg-secondary)', borderRadius:12, padding:14, marginBottom:10, border:'1px solid var(--border)' }}>
            <h4 style={{ margin:'0 0 8px', fontSize:12, color:'#ec4899' }}>🧪 Необходимые анализы и исследования</h4>
            <div style={{ display:'flex', flexDirection:'column', gap:4, marginBottom:10 }}>
              <div style={{ fontSize:10, fontWeight:700, color:'#ec4899', marginBottom:2 }}>Анализы крови</div>
              {[
                { name:'Тестостерон общий/свободный', purpose:'Оценка гиперандрогении' },
                { name:'Дигидротестостерон (DHT)', purpose:'Прямой маркер андрогенной стимуляции сальных желёз' },
                { name:'Эстрадиол (E2)', purpose:'Гиперэстрогения усугубляет акне' },
                { name:'ЛГ/ФСГ', purpose:'Оценка оси HPA, ПКТ/посткурсовая эстроген-андрогенная перестройка' },
                { name:'Пролактин', purpose:'Повышение ПРЛ через трен/19-нор метаболиты усугубляет акне' },
                { name:'DHEA-S', purpose:'Надпочечниковые андрогены как дополнительный фактор' },
                { name:'Кортизол', purpose:'Хронический стресс ухудшает состояние кожи' },
                { name:'SHBG', purpose:'Низкий SHBG = больше свободного тестостерона' },
                { name:'Калий (K+)', purpose:'При Верошпироне — риск гиперкалиемии' },
                { name:'Глюкоза/Инсулин/HOMA-IR', purpose:'Инсулинорезистентность усиливает андрогенное стимулирование сальных желёз' },
              ].map((a, i) => (
                <div key={i} style={{ padding:'5px 8px', borderRadius:6, background:'rgba(236,72,153,0.04)', border:'1px solid rgba(236,72,153,0.08)', fontSize:9 }}>
                  <span style={{ fontWeight:600, color:'var(--text-light)' }}>{a.name}</span>
                  <span style={{ color:'var(--text-dim)', marginLeft:4 }}>— {a.purpose}</span>
                </div>
              ))}
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
              <div style={{ fontSize:10, fontWeight:700, color:'#a855f7', marginBottom:2 }}>Инструментальные исследования</div>
              {[
                { name:'УЗИ кожи (20-50 МГц)', purpose:'Оценка толщины эпидермиса, сальных желёз, воспалительных инфильтратов' },
                { name:'Себуметрия', purpose:'Измерение продукции себума на разных участках' },
                { name:'Дерматоскопия', purpose:'Дифференциация типов акне, оценка эффективности терапии' },
                { name:'Микробиологическое исследование', purpose:'Посев на Cutibacterium acnes + чувствительность к антибиотикам' },
              ].map((e, i) => (
                <div key={i} style={{ padding:'5px 8px', borderRadius:6, background:'rgba(168,85,247,0.04)', border:'1px solid rgba(168,85,247,0.08)', fontSize:9 }}>
                  <span style={{ fontWeight:600, color:'var(--text-light)' }}>{e.name}</span>
                  <span style={{ color:'var(--text-dim)', marginLeft:4 }}>— {e.purpose}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background:'var(--bg-secondary)', borderRadius:12, padding:14, border:'1px solid var(--border)' }}>
            <h4 style={{ margin:'0 0 6px', fontSize:11, color:'#f59e0b' }}>⚠️ Важно</h4>
            <div style={{ fontSize:9, color:'var(--text-dim)', lineHeight:1.5 }}>• При Верошпироне — исключить добавки калия<br/>• Солярий ≤ 2 раза/нед по 5 мин<br/>• Клендовит+Клензит-С только локально<br/>• При сильном акне — дерматолог, системные ретиноиды</div>
          </div>
        </div>
      )}



      {/* ===== MODAL OVERLAY ===== */}
      {showModal && (
        <div style={{ position:'fixed', inset:0, zIndex:300, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', padding:12 }}>
          <div style={{ background:'var(--bg-primary)', borderRadius:16, maxWidth:400, width:'100%', maxHeight:'85vh', overflowY:'auto', padding:16 }}>
            {/* Intel modal: level selection */}
            {showModal === 'intel' && !modalLevel && (
              <>
              <h3 style={{ margin:'0 0 10px', fontSize:14, fontWeight:800 }}>🧠 Выберите уровень поддержки</h3>
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                {[
                  { v:'basic', l:'База', c:'#22c55e', d:() => `${SUPPORT_LEVELS.basic?.subs?.length || 0} препаратов, обязательный минимум` },
                  { v:'mid', l:'Средний', c:'#eab308', d:() => `${SUPPORT_LEVELS.mid?.subs?.length || 0} препарата, расширенная защита` },
                  { v:'max', l:'Максимум', c:'#f97316', d:() => `${SUPPORT_LEVELS.max?.subs?.length || 0} препаратов, полное покрытие` },
                  { v:'boost', l:'Усиление', c:'#ef4444', d:() => `${SUPPORT_LEVELS.boost?.subs?.length || 0} препаратов, максимальная поддержка` },
                ].map(btn => (
                  <button key={btn.v} onClick={() => { setModalLevel(btn.v); }} style={{
                    padding:'12px 14px', borderRadius:10, cursor:'pointer', textAlign:'left',
                    background: btn.c + '12', border: '1px solid ' + btn.c + '33',
                    color:'var(--text-light)', fontWeight:700, fontSize:12,
                  }}>
                    <span style={{ color:btn.c, fontWeight:800 }}>{btn.l}</span>
                    <span style={{ color:'var(--text-dim)', fontWeight:400, marginLeft:6 }}>— {btn.d()}</span>
                  </button>
                ))}
              </div>
              <button onClick={() => { setShowModal(null); setModalLevel(null); }} style={{ width:'100%', marginTop:10, padding:'8px', borderRadius:8, border:'1px solid var(--border)', background:'transparent', color:'var(--text-dim)', cursor:'pointer', fontSize:10 }}>Отмена</button>
              </>
            )}
            {/* Intel modal: level selected, show substances */}
            {showModal === 'intel' && modalLevel && (
              <>
              <h3 style={{ margin:'0 0 10px', fontSize:14, fontWeight:800 }}>🧠 Рекомендуемые препараты</h3>
              <p style={{ fontSize:9, color:'var(--text-dim)', marginBottom:8 }}>Уровень: <b style={{ color:'#00e68a' }}>{modalLevel}</b> — <b style={{ color:'var(--text-light)' }}>{(SUPPORT_LEVELS[modalLevel]?.subs || []).length}</b> препаратов</p>
              <div style={{ display:'flex', flexDirection:'column', gap:4, maxHeight:'50vh', overflowY:'auto', marginBottom:8 }}>
                {(SUPPORT_LEVELS[modalLevel]?.subs || []).map((id: string) => {
                  const sub = allSupport.find(s => s.id === id);
                  if (!sub) return null;
                  return (
                    <div key={id} style={{ padding:'6px 8px', borderRadius:6, background:'rgba(255,255,255,0.03)', border:'1px solid var(--border)', fontSize:10 }}>
                      <div style={{ fontWeight:600, color:'var(--text-light)' }}>{sub.name}</div>
                      {sub.description && <div style={{ fontSize:8, color:'var(--text-dim)', marginTop:1 }}>{cleanDesc(sub)}</div>}
                      {(sub as any).mechanisms && (sub as any).mechanisms.length > 0 && (
                        <div style={{ display:'flex', flexWrap:'wrap', gap:2, marginTop:2 }}>
                          {(sub as any).mechanisms.slice(0,3).map((m: string, mi: number) => (
                            <span key={mi} style={{ fontSize:7, padding:'1px 4px', borderRadius:3, background:'rgba(139,92,246,0.08)', color:'#a78bfa' }}>{(MECH_TRANSLATIONS_RU as Record<string,string>)[m] || m.replace(/_/g, ' ')}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <button onClick={() => { setSupportLevel(modalLevel as any); calcSupport(modalLevel as any); setShowModal(null); setModalLevel(null); }} style={{
                width:'100%', padding:'10px', borderRadius:8, border:'none', cursor:'pointer',
                background:'linear-gradient(135deg,#00e68a,#00c853)', color:'#000', fontWeight:700, fontSize:12, marginBottom:6,
              }}>✅ Применить уровень</button>
              <button onClick={() => setModalLevel(null)} style={{ width:'100%', padding:'8px', borderRadius:8, border:'1px solid var(--border)', background:'transparent', color:'var(--text-dim)', cursor:'pointer', fontSize:10 }}>← Назад</button>
              </>
            )}
            {/* Manual modal: catalog with search */}
            {showModal === 'manual' && (
              <>
              <h3 style={{ margin:'0 0 10px', fontSize:14, fontWeight:800 }}>📋 Выбор препаратов</h3>
              <div style={{ display:'flex', gap:6, marginBottom:8 }}>
                <input value={modalSearch} onChange={e => setModalSearch(e.target.value)} placeholder="🔍 Поиск..." style={{
                  flex:1, padding:'8px 10px', borderRadius:8, border:'1px solid var(--border)', background:'var(--bg-secondary)', color:'var(--text)', fontSize:11, boxSizing:'border-box',
                }} />
                <button onClick={() => setShowSavedPicker(true)} style={{ padding:'8px 10px', borderRadius:8, border:'1px dashed var(--accent)', background:'transparent', color:'var(--accent)', fontSize:10, fontWeight:600, cursor:'pointer', whiteSpace:'nowrap' }}>💾 Из сохранённых ({savedStacks.length})</button>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:3, maxHeight:'45vh', overflowY:'auto', marginBottom:8 }}>
                {catalogSupport.filter(s => !modalSearch || (s.name||'').toLowerCase().includes(modalSearch.toLowerCase()) || (s.id||'').toLowerCase().includes(modalSearch.toLowerCase())).map(s => {
                  const sel = modalSelected.includes(s.id);
                  return (
                    <div key={s.id} onClick={() => setModalSelected(prev => sel ? prev.filter(x => x !== s.id) : [...prev, s.id])} style={{
                      padding:'8px 10px', borderRadius:8, cursor:'pointer',
                      background: sel ? 'rgba(0,230,138,0.08)' : 'rgba(255,255,255,0.02)', border: sel ? '1px solid rgba(0,230,138,0.3)' : '1px solid transparent',
                    }}>
                      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                        <span style={{ fontSize:10, minWidth:14, color: sel ? '#00e68a' : 'var(--text-dim)' }}>{sel ? '✓' : '○'}</span>
                        <div style={{ fontSize:11, fontWeight:600, color:'var(--text-light)' }}>{s.name}</div>
                      </div>
                      {s.description && <div style={{ fontSize:8, color:'var(--text-dim)', lineHeight:1.4, marginLeft:20, marginTop:2 }}>{decodeGarbled(s.description)}</div>}
                      {(s as any).mechanisms && (s as any).mechanisms.length > 0 && (
                        <div style={{ display:'flex', flexWrap:'wrap', gap:2, marginLeft:20, marginTop:2 }}>
                          {(s as any).mechanisms.slice(0,3).map((m: string) => (
                            <span key={m} style={{ fontSize:7, padding:'1px 4px', borderRadius:3, background:'rgba(139,92,246,0.08)', color:'#a78bfa' }}>{(MECH_TRANSLATIONS_RU as Record<string,string>)[m] || m.replace(/_/g, ' ')}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div style={{ display:'flex', gap:6 }}>
                <button onClick={() => { setShowModal(null); setModalSelected([]); }} style={{ flex:1, padding:'8px', borderRadius:8, border:'1px solid var(--border)', background:'transparent', color:'var(--text-dim)', cursor:'pointer', fontSize:10 }}>Отмена</button>
                <button onClick={() => {
                  if (modalSelected.length > 0) {
                    if (modalAddMode) {
                      setEnhancedSubs(prev => [...new Set([...prev, ...modalSelected])]);
                    } else {
                      setEnhancedSubs(modalSelected);
                    }
                    setModalSelected([]);
                    setShowModal(null);
                    setModalAddMode(false);
                  }
                }} style={{ flex:1, padding:'8px', borderRadius:8, border:'none', cursor:'pointer', background:'var(--accent)', color:'#000', fontWeight:700, fontSize:10 }}>{modalAddMode ? '➕ Добавить к плану' : '✅ Применить'} ({modalSelected.length})</button>
              </div>
              </>
            )}
            {/* Saved stack picker */}
            {showSavedPicker && (
              <>
              <div style={{ position:'fixed', inset:0, zIndex:350, background:'rgba(0,0,0,0.8)', display:'flex', alignItems:'center', justifyContent:'center', padding:12 }}>
                <div style={{ background:'var(--bg-primary)', borderRadius:16, maxWidth:400, width:'100%', maxHeight:'80vh', overflowY:'auto', padding:16 }}>
                  <h3 style={{ margin:'0 0 10px', fontSize:14, fontWeight:800, color:'var(--accent)' }}>💾 Выберите сохранённый стек</h3>
                  {savedStacks.length === 0 ? (
                    <p style={{ fontSize:10, color:'var(--text-dim)', textAlign:'center', padding:20 }}>Нет сохранённых стеков. Сначала сохраните стек в Мои стеки.</p>
                  ) : (
                    <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                      {savedStacks.map(stack => {
                        const totalItems = stack.subs?.length || 0;
                        return (
                          <div key={stack.id} style={{ padding:'10px 12px', borderRadius:10, background:'rgba(255,255,255,0.02)', border:'1px solid var(--border)' }}>
                            <div style={{ cursor:'pointer' }}
                              onClick={() => {
                                const ids = stack.subs || [];
                                setEnhancedSubs(ids);
                                setModalSelected([]);
                                setShowModal(null);
                                setShowSavedPicker(false);
                              }}
                            >
                              <div style={{ fontSize:12, fontWeight:700, color:'var(--text-light)' }}>{stack.name}</div>
                              <div style={{ fontSize:9, color:'var(--text-dim)', marginTop:2 }}>{new Date(stack.date).toLocaleDateString('ru-RU')} · {totalItems} препаратов</div>
                              <div style={{ display:'flex', flexWrap:'wrap', gap:2, marginTop:4 }}>
                                {(stack.subs || []).slice(0,8).map((id: string) => {
                                  const sub = ALL_SUBSTANCES.find(s => s.id === id);
                                  return <span key={id} style={{ fontSize:8, padding:'1px 5px', borderRadius:4, background:'rgba(139,92,246,0.08)', color:'#a78bfa' }}>{sub?.name || id}</span>;
                                })}
                                {totalItems > 8 && <span style={{ fontSize:8, color:'var(--text-dim)' }}>+{totalItems-8}</span>}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <button onClick={() => setShowSavedPicker(false)} style={{ width:'100%', marginTop:10, padding:'8px', borderRadius:8, border:'1px solid var(--border)', background:'transparent', color:'var(--text-dim)', cursor:'pointer', fontSize:10 }}>← Назад</button>
                </div>
              </div>
              </>
            )}
            {/* Boost modal */}
            {showModal === 'boost' && (
              <>
              <h3 style={{ margin:'0 0 10px', fontSize:14, fontWeight:800, color:'#ef4444' }}>🔴 Усиление стека</h3>
              <p style={{ fontSize:9, color:'var(--text-dim)', marginBottom:8 }}>Бустер-препараты для максимального покрытия рисков. +20 веществ к текущему стеку.</p>
              <div style={{ display:'flex', flexDirection:'column', gap:4, maxHeight:'40vh', overflowY:'auto', marginBottom:8 }}>
                {(BOOST_SUBS || []).map((id: string) => {
                  const sub = allSupport.find(s => s.id === id);
                  if (!sub) return null;
                  return (
                    <div key={id} style={{ padding:'6px 8px', borderRadius:6, background:'rgba(239,68,68,0.04)', border:'1px solid rgba(239,68,68,0.1)', fontSize:10 }}>
                      <div style={{ fontWeight:600, color:'var(--text-light)' }}>{sub.name}</div>
                      {sub.description && <div style={{ fontSize:8, color:'var(--text-dim)' }}>{sub.description?.slice(0,80)}</div>}
                    </div>
                  );
                })}
              </div>
              <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:8 }}>
                <button style={{ flex:1, padding:'6px', borderRadius:6, border:'1px dashed var(--accent)', cursor:'pointer', background:'transparent', color:'var(--accent)', fontSize:9, fontWeight:600, minWidth:0 }} onClick={() => { setShowModal('manual'); setModalAddMode(false); }}>🔄 Заменить на аналог</button>
                <button style={{ flex:1, padding:'6px', borderRadius:6, border:'1px dashed var(--accent)', cursor:'pointer', background:'transparent', color:'var(--accent)', fontSize:9, fontWeight:600, minWidth:0 }} onClick={() => setShowSavedPicker(true)}>💾 Из сохранённых</button>
                <button style={{ flex:1, padding:'6px', borderRadius:6, border:'1px dashed var(--accent)', cursor:'pointer', background:'transparent', color:'var(--accent)', fontSize:9, fontWeight:600, minWidth:0 }} onClick={() => { setShowModal('manual'); setModalAddMode(false); }}>📋 Из каталога</button>
              </div>
              <div style={{ display:'flex', gap:6 }}>
                <button onClick={() => { setShowModal(null); }} style={{ flex:1, padding:'8px', borderRadius:8, border:'1px solid var(--border)', background:'transparent', color:'var(--text-dim)', cursor:'pointer', fontSize:10 }}>Отмена</button>
                <button onClick={() => { setBoostEnabled(true); calcSupport(); setShowModal(null); }} style={{ flex:1, padding:'8px', borderRadius:8, border:'none', cursor:'pointer', background:'linear-gradient(135deg,#ef4444,#dc2626)', color:'#000', fontWeight:700, fontSize:10 }}>✅ Усилить стек</button>
              </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ===== STACK BUILDER FLOATING BADGE ===== */}
      {stackBuilder.length > 0 && (
        <div style={{ position:'sticky', bottom:0, zIndex:100, display:'flex', alignItems:'center', justifyContent:'center', gap:8, padding:'8px 14px', borderRadius:16, background:'rgba(0,0,0,0.6)', border:'1px solid rgba(0,230,138,0.3)', boxShadow:'0 4px 20px rgba(0,0,0,0.5)' }}>
          <span style={{ fontSize:10, fontWeight:700, color:'#00e68a' }}>🧮 Стек: {stackBuilder.length} веществ</span>
          <button onClick={() => setStackBuilder([])} style={{ padding:'4px 10px', borderRadius:8, fontSize:9, cursor:'pointer', background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.2)', color:'#f87171', fontWeight:600 }}>Очистить</button>
          <button onClick={saveBuilderStack} style={{ padding:'4px 10px', borderRadius:8, fontSize:9, cursor:'pointer', background:'linear-gradient(135deg,#00e68a,#00c853)', border:'none', color:'#000', fontWeight:700 }}>Сохранить</button>
        </div>
      )}
    </div>
  );
};

const RecsTab: React.FC<{ profile: any; labs: any; readiness: any; course: any }> = ({ profile, labs, readiness, course }) => {
  const [recs, setRecs] = React.useState<Recommendation[]>([]);
  const [fusion, setFusion] = React.useState<FusedDecision | null>(null);
  const run = () => {
    const input: RecInput = {
      performance: { recentPR: false, strengthTrend: 5, plateauWeeks: 0, velocityLoss: 10 },
      technique: { score: 80, errors: [], romStability: 90 },
      fatigue: { acute: 8000, chronic: 7000, acwr: 1.14, monotony: 0.5, strain: 12000, cnsLoad: 5 },
      recovery: { sleepScore: 70, hrvScore: 70, subjectiveReadiness: 70, hydrationScore: 70, nutritionScore: 70 },
      body: { weightTrend: 0, bfTrend: 0, ffmi: 22 },
      training: { frequency: 4, avgIntensity: 7, volumeTrend: 5, phase: 'strength', weeksInCycle: 4 },
      risk: { overall: 30, jointFlags: [], systemicFlags: [] },
      goals: { type: 'strength', progress: 80, weeksRemaining: 8 },
      equipment: ['barbell', 'dumbbell'] as any,
      injuries: [],
      weakPoints: [],
    };
    const result = generateRecommendations(input);
    setRecs(result.recommendations.slice(0, 10));
    const fusionInput: any = { priScore: 70, riskLevel: 'moderate', riskFlags: [], techniqueScore: 80, techniqueErrors: [], fatigueScore: 30, recoveryScore: 70, acwr: 1.14, monotony: 0.5, volumeCapacity: 80, intensityCapacity: 70, trainingAge: 24, goal: 'strength', upcomingCompetition: false, injuryHistory: [], recentPR: false };
    setFusion(fuseDecisions(fusionInput));
  };
  const st = shouldTrainToday(70, 'moderate', 30, 70);
  return (<div>
    <button onClick={run} style={{ width:'100%', padding:12, borderRadius:8, border:'none', cursor:'pointer', marginBottom:10, background:'linear-gradient(135deg,#8b5cf6,#6366f1)', color:'#fff', fontWeight:700, fontSize:14 }}>💡 Сгенерировать рекомендации</button>
    <div className="card" style={{ marginBottom:8 }}><div style={{ fontSize:11, fontWeight:700, color:st.train?'#22c55e':'#ef4444' }}>{st.train ? '✅ Тренировка' : '🔴 Отдых'}</div><div style={{ fontSize:9, color:'var(--text-dim)' }}>{st.reason}</div></div>
    {fusion && <div className="card" style={{ marginBottom:8 }}><h4 style={{ margin:'0 0 4px', fontSize:12 }}>🎯 Fusion Decision</h4><div style={{ fontSize:9 }}>{fusion.overallRecommendation}</div></div>}
    {recs.map((r,i) => <div key={i} className="card" style={{ marginBottom:4, padding:8 }}>
      <div style={{ fontWeight:600, fontSize:11, color: r.severity === 'critical' ? '#ef4444' : r.severity === 'high' ? '#f59e0b' : r.severity === 'medium' ? '#f97316' : '#22c55e' }}>{r.title}</div>
      <div style={{ fontSize:9, color:'var(--text-light)' }}>{r.message}</div>
      {r.actionItems?.map((a:any,ai:number)=><div key={ai} style={{ fontSize:8, color:'var(--text-dim)', marginLeft:6 }}>• {a}</div>)}
    </div>)}
  </div>);
};

const OptimizerSection: React.FC<{ drugs: string[] }> = ({ drugs }) => {
  const [optResult, setOptResult] = React.useState<OptimizerStackResult | null>(null);
  const run = () => {
    const available = drugs.length > 0 ? drugs : ['AA_NAC'];
    const result = newOptimizeStack(available);
    setOptResult(result);
  };
  React.useEffect(() => { if (drugs.length > 0) run(); }, [drugs]);
  return (<div>
    {optResult && <div style={{ maxHeight:250,overflowY:'auto' }}>
      {optResult.rankedSubstances.length > 0 && (
        <div>
          <div style={{ fontSize:9,fontWeight:600,color:'var(--text-dim)',marginBottom:4 }}>📊 Ранжированные вещества ({optResult.rankedSubstances.length})</div>
          {optResult.rankedSubstances.slice(0,15).map((r,i) => (
            <div key={i} style={{ fontSize:8,padding:'2px 6px',display:'flex',justifyContent:'space-between' }}>
              <span>{r.name}</span>
              <span style={{ color:'var(--text-dim)' }}>+{r.incrementalCoverage.toFixed(2)} ({r.systemsGained.join(', ')})</span>
            </div>
          ))}
        </div>
      )}
      {optResult.synergiesInStack.length > 0 && (
        <div style={{ marginTop:4 }}>
          <div style={{ fontSize:9,fontWeight:600,color:'#22c55e' }}>✅ Синергии ({optResult.synergiesInStack.length})</div>
          {optResult.synergiesInStack.slice(0,5).map((s,i) => (
            <div key={i} style={{ fontSize:8,padding:'1px 6px',color:'#22c55e' }}>{s.aName}+{s.bName}: {s.mechanism}</div>
          ))}
        </div>
      )}
      {optResult.conflictsInStack.length > 0 && (
        <div style={{ marginTop:4 }}>
          <div style={{ fontSize:9,fontWeight:600,color:'#ef4444' }}>⚠ Конфликты ({optResult.conflictsInStack.length})</div>
          {optResult.conflictsInStack.slice(0,5).map((c,i) => (
            <div key={i} style={{ fontSize:8,padding:'1px 6px',color:'#ef4444' }}>{c.aName}+{c.bName}: {c.mechanism}</div>
          ))}
        </div>
      )}
      <div style={{ fontSize:8,color:'var(--text-dim)',marginTop:4 }}>
        Покрытие: {Object.entries(optResult.systemCoverage).map(([s,v]) => `${s}:${(v*100).toFixed(0)}%`).join(', ')}
      </div>
    </div>}
  </div>);
};

const ReportSummaryCard: React.FC<{ supportResult: any }> = ({ supportResult }) => {
  if (!supportResult) return null;
  const report = ReportEngine.generateReport({
    total_risk: Math.round(supportResult?.riskBeforeSupport || 0),
    risk_after_support: Math.round(supportResult?.riskAfterSupport || 0),
    risks: [], systems: Object.entries(supportResult?.systemSupport || {}).map(([k,v])=>({name:k,value:v})),
    organs: [], mechanisms: [], interactions: [], recommendations: [],
  });
  return (<div className="card" style={{ padding:10, marginTop:8 }}>
    <h4 style={{ margin:'0 0 4px',fontSize:12 }}>📋 Сводка</h4>
    <div style={{ fontSize:10 }}>Риск: {report.summary.total_risk}% → {report.summary.risk_after_support}% ({report.summary.risk_level})</div>
    <div style={{ fontSize:9,color:'var(--text-dim)',marginTop:2 }}>Топ систем: {(report.summary as any).top_systems?.map((s:any)=>s.name).join(', ')}</div>
      </div>);
};

const StackBuilderSection: React.FC = () => {
  const [sbGoal, setSbGoal] = React.useState('muscle_growth');
  const [sbResult, setSbResult] = React.useState<StackResult | null>(null);
  const goals = ['muscle_growth','fat_loss','recovery','focus','sleep','mitochondria','gi_healing','immune_boost'];
  return (<div className="card" style={{ marginTop:8, padding:10 }}>
    <h4 style={{ margin:'0 0 6px',fontSize:12 }}>🏗 Построитель стека</h4>
    <div style={{ display:'flex',flexWrap:'wrap',gap:3,marginBottom:6 }}>
      {goals.map(g => <button key={g} onClick={()=>{setSbGoal(g);setSbResult(generateStack([g]));}} style={{ padding:'4px 8px',borderRadius:4,fontSize:9,cursor:'pointer',background:sbGoal===g?'var(--accent)':'var(--bg-secondary)',color:sbGoal===g?'#000':'var(--text-dim)',border:'none' }}>{g.replace(/_/g,' ')}</button>)}
    </div>
    {sbResult && <div>
      <div style={{ fontSize:9,color:'var(--text-dim)',marginBottom:4 }}>Score: {sbResult.score?.toFixed(1)} | Substances: {sbResult.substances.length}</div>
      <div style={{ display:'flex',flexWrap:'wrap',gap:3 }}>
        {sbResult.substances.map((s:any,i:number) => <span key={i} style={{ fontSize:8,padding:'2px 6px',borderRadius:3,background:'rgba(139,92,246,0.1)',color:'#8b5cf6' }}>{s.name || s.id}</span>)}
      </div>
    </div>}
  </div>);
};

