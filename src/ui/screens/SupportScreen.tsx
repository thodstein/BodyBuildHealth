import React, { useState, useMemo, useEffect } from 'react';
import { SYNERGY_PAIRS, ORGAN_SYNERGIES, SUPPLEMENT_DESCRIPTIONS, SUPPLEMENT_TARGETS, SUPPORT_RESEARCH, calculateSupport, checkSupportInteractions, findSupportForGoal, searchSupport, getSubstanceInfo, getSupportDatabaseStats, type SupportInput, type SynergyPair, type SupplementTarget, type OrganSynergy } from '../../engines/support.engine';
import { RISK_SYSTEMS, ALL_RISK_SYSTEMS } from '../../core/constants';
import { PHARMA_DB, getPharmaDetail } from '../../core/pharma-database';
import { useDataLink } from '../../core/data-link';
import { SYSTEM_INFO_ALL } from '../../core/risk-info';
import { getRiskColor } from '../../core/utils/risk-colors';
import { SUPPORT_BASE_COVERAGE } from '../../core/constants';
import { INTERACTIONS_DB } from '../../data/interactions';
import { ALL_SUBSTANCES, ALL_INTERACTIONS, type SupportSubstance, type SupportInteraction } from '../../data/support-database';
import { FertilityPCTScreen } from './FertilityPCTScreen';
import { ALL_STACKS, EFFECT_LABELS_ru, findStacksByEffect, getSubstanceLabel as getStackSubLabel, type SupportStack } from '../../data/support-stacks';
import {
  PEPTIDE_DB, PEPTIDE_LIST, PEPTIDE_SYNERGY, PEPTIDE_CONFLICTS, PEPTIDE_GOAL_PROFILES,
  computeDilution, computeEffectiveDose, computePK, computePeptideRisks,
  scorePeptideStack, generatePeptideProtocol, getPeptideSynergiesFor, getPeptideConflictsFor,
  ROUTE_LABELS, SYRINGE_TYPES, type PeptideInfo, type DilutionInput, type DilutionResult,
  type BioavailabilityResult, type PKResult,
} from '../../engines/peptide-calculator.engine';
import {
  interpretLabs, computeRiskByModel, generateMechanismReport,
  computePharmaAdjustedDose, generateTimedPlan,
  RISK_MODEL_LABELS, type RiskModelType, type LabCompositeResult,
} from '../../engines/lab-analysis.engine';
import {
  generateWeeklyPlan, RISK_METHODS, computeBasicRisk, computeOverallRisk,
  type RiskCalcMethod, type WeeklyPlan, type SupplementPlanEntry, type DailySchedule,
} from '../../engines/weekly-plan.engine';
import { generateRecommendations, quickRec, type Recommendation, type RecInput } from '../../engines/recommendation-engine-v2';
import { fuseDecisions, shouldTrainToday, type FusedDecision } from '../../engines/decision-fusion.engine';
import { optimizeStack as newOptimizeStack, deriveSystemCoverage, getSubstanceName, describeStack, type StackResult as OptimizerStackResult, type StackSynergyInfo } from '../../engines/stack-optimizer.engine';
import { generateStack, selectBestStack, type StackResult } from '../../engines/stack-builder.engine';
import { ReportEngine, type ReportInput } from '../../engines/report-engine';
import { checkDrugInteractions } from '../../engines/pharma-interactions.engine';
import type { CourseEntry } from '../../core/types';
import { searchPubMed, type PubMedArticle } from '../../engines/pubmed-search.engine';

type SupportTab = 'main' | 'catalog' | 'synergies' | 'calculator' | 'interactions' | 'stacks' | 'peptides' | 'fertility-pct';
type SupportView = 'main' | 'calc' | 'fertility';
type CalcView = 'main' | 'calculator' | 'peptides' | 'info' | 'stackcalc' | 'mystacks' | 'mixcalc' | 'plan' | 'neuro' | 'hrt';
type InfoView = 'main' | 'catalog' | 'synergies' | 'stacks' | 'interactions' | 'research';

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
  antiaging: { label: 'Антивозрастное', emoji: '⏳' },
  epigenetic: { label: 'Эпигенетика', emoji: '🧬' },
  methylation: { label: 'Метилирование', emoji: '🔄' },
  DNA: { label: 'ДНК', emoji: '🧬' },
  pharma: { label: 'Фармацевтика', emoji: '💊' },
  polyphenol: { label: 'Полифенолы', emoji: '🍃' },
  sleep: { label: 'Сон', emoji: '😴' },
  calming: { label: 'Успокаивающие', emoji: '🧘' },
  anxiolytic: { label: 'Противотревожные', emoji: '🧘' },
  antiinflammatory: { label: 'Противовоспалительные', emoji: '🔥' },
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

const getCategoryInfo = (cat: string): { label: string; emoji: string } =>
  CATEGORY_LABELS[cat] || (TYPE_LABELS_RU[cat] ? { label: TYPE_LABELS_RU[cat], emoji: '📦' } : { label: cat, emoji: '📦' });

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

const WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

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
    mechanism: 'Защита подоцитов через астрагалозиды. ↓ TGF-β1 → ↓ фиброз почек. Ингибирование NF-κB → противовоспалительное действие. ↑ иммунитет через激活 макрофагов и NK-клеток.',
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
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSub, setSelectedSub] = useState<string | null>(null);
  const [synergyFilter, setSynergyFilter] = useState<string>('all');
  const [systemFilter, setSystemFilter] = useState<string>('all');
  const [supportClassFilter, setSupportClassFilter] = useState<string>('all');
  const [supportLevel, setSupportLevel] = useState<'basic' | 'mid' | 'max' | 'boost'>('mid');
  const [supportGoal, setSupportGoal] = useState('muscle_gain');
  const [supportDrugs, setSupportDrugs] = useState<string[]>([]);
  const [autoLevel, setAutoLevel] = useState<'basic' | 'mid' | 'max' | 'boost'>('mid');
  const [expandedMed, setExpandedMed] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [interactionTypeFilter, setInteractionTypeFilter] = useState<string>('all');
  const [interactionSeverityFilter, setInteractionSeverityFilter] = useState<string>('all');
  const [infoSynergySeverity, setInfoSynergySeverity] = useState<string>('all');
  const [activeSystems, setActiveSystems] = useState<Record<string, boolean>>({
    cardio: true, hepatic: true, renal: true, neuro: true, endocrine: true, hematologic: true, reproductive: true, musculoskeletal: true,
  });
  const [synergyPage, setSynergyPage] = useState<number>(1);
  const SYNERGY_PAGE_SIZE = 30;
  const [interactionPage, setInteractionPage] = useState<number>(1);
  const INTERACTION_PAGE_SIZE = 40;
  const [supportResult, setSupportResult] = useState<ReturnType<typeof calculateSupport> | null>(null);

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
  const [pepSchedule, setPepSchedule] = useState(['Mon', 'Wed', 'Fri']);
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
    basic: { label: '🟢 База', desc: 'Бюджетный минимум — 5 добавок для базового покрытия рисков', subs: ['nac', 'omega3', 'vitamin_d3', 'zinc', 'magnesium'], dosages: { nac: { mg: 600, timing: 'утро, натощак' }, omega3: { mg: 2000, timing: 'с едой, завтрак' }, vitamin_d3: { mg: 5000, timing: 'с едой, завтрак (МЕ)' }, zinc: { mg: 15, timing: 'на ночь' }, magnesium: { mg: 200, timing: 'на ночь' } } },
    mid: { label: '🟡 Средний', desc: 'Стандартная поддержка курса — 11 добавок', subs: ['nac', 'omega3', 'tudca', 'magnesium', 'vitamin_d3', 'coq10', 'zinc', 'vitamin_k2', 'vitamin_b12', 'glucosamine', 'collagen'], dosages: { nac: { mg: 1200, timing: 'утро, натощак' }, omega3: { mg: 3000, timing: 'с едой, завтрак' }, tudca: { mg: 500, timing: 'перед едой' }, magnesium: { mg: 400, timing: 'на ночь' }, vitamin_d3: { mg: 5000, timing: 'с едой, завтрак (МЕ)' }, coq10: { mg: 200, timing: 'с едой, завтрак' }, zinc: { mg: 30, timing: 'на ночь, натощак' }, vitamin_k2: { mg: 200, timing: 'с едой, обед (мкг)' }, vitamin_b12: { mg: 1000, timing: 'утро (мкг)' }, glucosamine: { mg: 1500, timing: 'с едой' }, collagen: { mg: 10000, timing: 'с едой, утро (мг)' } } },
    max: { label: '🟠 Усиление', desc: 'Полная поддержка курса — 21 добавка', subs: ['nac', 'omega3', 'tudca', 'magnesium', 'vitamin_d3', 'coq10', 'zinc', 'berberine', 'ashwagandha', 'alpha_lipoic', 'vitamin_k2', 'selenium', 'milk_thistle', 'vitamin_b12', 'folate', 'taurine', 'glucosamine', 'msm', 'collagen', 'vitamin_c', 'bpc157'], dosages: { nac: { mg: 1800, timing: 'утро/вечер, натощак' }, omega3: { mg: 3000, timing: 'с едой, завтрак' }, tudca: { mg: 1000, timing: 'перед едой, 2x/д' }, magnesium: { mg: 600, timing: 'на ночь' }, vitamin_d3: { mg: 5000, timing: 'с едой, завтрак (МЕ)' }, coq10: { mg: 300, timing: 'с едой, завтрак' }, zinc: { mg: 50, timing: 'на ночь' }, berberine: { mg: 500, timing: 'с едой, 2x/д' }, ashwagandha: { mg: 600, timing: 'вечер' }, alpha_lipoic: { mg: 600, timing: 'натощак' }, vitamin_k2: { mg: 200, timing: 'с едой (мкг)' }, selenium: { mg: 200, timing: 'с едой (мкг)' }, milk_thistle: { mg: 600, timing: 'с едой' }, vitamin_b12: { mg: 2000, timing: 'утро (мкг)' }, folate: { mg: 800, timing: 'с едой (мкг)' }, taurine: { mg: 2000, timing: 'натощак' }, glucosamine: { mg: 1500, timing: 'с едой' }, msm: { mg: 2000, timing: 'с едой' }, collagen: { mg: 15000, timing: 'с едой (мг)' }, vitamin_c: { mg: 1000, timing: 'натощак' }, bpc157: { mg: 500, timing: 'натощак (мкг)' } } },
    boost: { label: '🔴 Максимум', desc: 'Максимальная защита и регенерация — 41 добавка', subs: ['nac', 'omega3', 'tudca', 'magnesium', 'vitamin_d3', 'coq10', 'zinc', 'berberine', 'ashwagandha', 'alpha_lipoic', 'telmisartan', 'nebivolol', 'saw_palmetto', 'hcg', 'vitamin_k2', 'selenium', 'milk_thistle', 'probiotics', 'vitamin_b12', 'folate', 'iron', 'copper', 'astragalus', 'taurine', 'melatonin', 'ginseng', 'egcg', 'curcumin', 'phosphatidylcholine', 'l_carnitine', 'glucosamine', 'chondroitin', 'msm', 'collagen', 'hyaluronic', 'boswellia', 'vitamin_c', 'bromelain', 'bpc157', 'tb500'], dosages: { nac: { mg: 2400, timing: 'натощак, 2-3x/д' }, omega3: { mg: 4000, timing: 'с едой, 2x/д' }, tudca: { mg: 1500, timing: 'перед едой, 2-3x/д' }, magnesium: { mg: 800, timing: 'на ночь' }, vitamin_d3: { mg: 10000, timing: 'с едой (МЕ)' }, coq10: { mg: 400, timing: 'с едой' }, zinc: { mg: 50, timing: 'на ночь' }, berberine: { mg: 500, timing: 'с едой, 2x/д' }, ashwagandha: { mg: 900, timing: 'вечер' }, alpha_lipoic: { mg: 900, timing: 'натощак, 2x/д' }, telmisartan: { mg: 40, timing: 'утро' }, nebivolol: { mg: 5, timing: 'утро' }, saw_palmetto: { mg: 640, timing: 'с едой, 2x/д' }, hcg: { mg: 5000, timing: '2x/нед (МЕ)' }, vitamin_k2: { mg: 400, timing: 'с едой (мкг)' }, selenium: { mg: 400, timing: 'с едой (мкг)' }, milk_thistle: { mg: 900, timing: 'с едой, 2x/д' }, probiotics: { mg: 20, timing: 'натощак (млрд КОЕ)' }, vitamin_b12: { mg: 5000, timing: 'утро (мкг)' }, folate: { mg: 1000, timing: 'с едой (мкг)' }, iron: { mg: 18, timing: 'натощак' }, copper: { mg: 2, timing: 'отдельно от цинка (мг)' }, astragalus: { mg: 1500, timing: 'с едой' }, taurine: { mg: 3000, timing: 'натощак, 2x/д' }, melatonin: { mg: 5, timing: 'на ночь' }, ginseng: { mg: 400, timing: 'утро' }, egcg: { mg: 400, timing: 'натощак' }, curcumin: { mg: 1000, timing: 'с пиперином, с едой' }, phosphatidylcholine: { mg: 1200, timing: 'с едой' }, l_carnitine: { mg: 2000, timing: 'натощак' }, glucosamine: { mg: 1500, timing: 'с едой' }, chondroitin: { mg: 1200, timing: 'с едой' }, msm: { mg: 3000, timing: 'с едой' }, collagen: { mg: 20000, timing: 'с едой (мг)' }, hyaluronic: { mg: 200, timing: 'с едой (мг)' }, boswellia: { mg: 500, timing: 'с едой, 2x/д' }, vitamin_c: { mg: 2000, timing: 'натощак, 2x/д' }, bromelain: { mg: 500, timing: 'натощак' }, bpc157: { mg: 500, timing: 'натощак (мкг)' }, tb500: { mg: 500, timing: 'натощак (мкг)' } } },
  };

  useEffect(() => {
    const s = linked.profile?.settings;
    if (!s) return;
    const goalMap: Record<string, string> = { bulk: 'muscle_gain', cut: 'fat_loss', strength: 'strength', endurance: 'endurance', recomp: 'recomp', maintenance: 'maintenance' };
    const goal = s.goal || s.primaryGoal || 'maintenance';
    if (goalMap[goal]) setSupportGoal(goalMap[goal]);
    if (linked.course.length > 0) setSupportDrugs(linked.course.map(c => c.substanceId));
  }, []);

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
    setAutoLevel(level);
    setSupportLevel(level);
  }, [supportDrugs]);

  const calcSupport = () => {
    const s = linked.profile?.settings;
    const input: SupportInput = {
      userId: linked.profile?.id || 'current',
      substances: supportDrugs.length > 0 ? supportDrugs : (linked.course?.map(c => c.substanceId) || []),
      goals: [supportGoal],
      labs: (linked.labs || []).map(l => ({ code: l.code, value: l.value })),
      demographics: { age: s?.age ?? 30, weight: s?.weight ?? 80, sex: (s?.sex ?? 'male') as 'male' | 'female' },
      genetics: s?.genetics,
      nutritionFactor: s?.nutritionFactor ?? 0.8,
      trainingFactor: s?.trainingFactor ?? 0.7,
      drugDoses: Object.fromEntries((linked.course || []).map(c => [c.substanceId, c.doseValue])),
    };
    const supportResult = calculateSupport(input);
    setSupportResult(supportResult);
    const allSubs = [...supportDrugs, ...SUPPORT_LEVELS[supportLevel]?.subs || []].filter(Boolean);
    setDbInteractions(checkSupportInteractions(allSubs));
    const goalRisks = supportGoal === 'muscle_gain' ? ['muscle', 'protein', 'testosterone'] : supportGoal === 'fat_loss' ? ['fat', 'metabolism', 'insulin'] : supportGoal === 'strength' ? ['strength', 'power', 'testosterone'] : supportGoal === 'endurance' ? ['endurance', 'oxygen', 'atp'] : supportGoal === 'recomp' ? ['muscle', 'fat', 'metabolism'] : ['health', 'vitamin', 'mineral'];
    setGoalRecommendations(findSupportForGoal(goalRisks, 20));

    const labData = linked.labs || [];
    const labRes = interpretLabs(labData);
    setLabAnalysis(labRes);
    const mechRep = generateMechanismReport(labRes);
    setMechanismReport(mechRep);
    setTimedPlan(generateTimedPlan(mechRep.mechanisms, supportGoal));

    const modelRisk = computeRiskByModel(riskModel, labRes,
      Object.fromEntries(['cardio','hepatic','renal','neuro','endocrine','hematologic','reproductive','musculoskeletal'].map(s => [s, supportResult?.riskAssessment?.systemBreakdown?.[s]?.raw ?? 15])),
      Object.fromEntries(supportDrugs.map(() => [0, 5]).map((v, i) => [['cardio','hepatic','renal','neuro','endocrine','hematologic','reproductive','musculoskeletal'][i], 5])),
      supportResult?.systemSupport ?? {}
    );
    setModelRiskResult(modelRisk);

    // Auto-generate weekly plan
    const baseWeights: Record<string, number> = {};
    const drugLoads: Record<string, number> = {};
    for (const sys of ['cardio','hepatic','renal','neuro','endocrine','hematologic','reproductive','musculoskeletal']) {
      baseWeights[sys] = supportResult?.riskAssessment?.systemBreakdown?.[sys]?.raw ?? 15;
      drugLoads[sys] = supportDrugs.length * 2;
    }
    const labStress: Record<string, number> = {};
    if (labRes) {
      labStress.cardio = labRes.cardioRisk; labStress.hepatic = labRes.liverStress;
      labStress.renal = labRes.kidneyStress; labStress.endocrine = labRes.hormoneScore;
      labStress.hematologic = labRes.inflammation * 5;
    }
    const plan = generateWeeklyPlan(allSubs, riskCalcMethod, baseWeights, drugLoads, labStress, supportResult?.systemSupport ?? {});
    setWeeklyPlan(plan);
  };

  useEffect(() => { if (supportDrugs.length > 0) calcSupport(); }, [supportDrugs, supportGoal, supportLevel]);

  // Interaction checker state
  const [interactTab, setInteractTab] = useState<'support' | 'pharma'>('support');
  const [interactionIds, setInteractionIds] = useState<string[]>(['', '']);
  const [interactionSearch, setInteractionSearch] = useState('');
  const [interactionSearchIdx, setInteractionSearchIdx] = useState<number>(0);
  const [pharmaInteractIds, setPharmaInteractIds] = useState<string[]>(['', '']);
  const [pharmaInteractSearch, setPharmaInteractSearch] = useState('');
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
  const [pubMedError, setPubMedError] = useState('');
  const [pharmaSearchQ, setPharmaSearchQ] = useState('');
  const [pharmaSearchResults, setPharmaSearchResults] = useState<{ name: string; id: string; cls: string; desc: string }[]>([]);
  const [stackBuilder, setStackBuilder] = useState<string[]>([]);
  const [savedStacks, setSavedStacks] = useState<{ id: string; name: string; date: string; subs: string[]; dosages: Record<string, { mg: number; timing: string }> }[]>(() => { try { return JSON.parse(localStorage.getItem('savedStacks') || '[]'); } catch { return []; } });
  const [stackName, setStackName] = useState('');
  const [researchSource, setResearchSource] = useState<'pubmed' | 'pubchem' | 'scholar' | 'fda' | 'pharma'>('pubmed');
  const [pubchemResults, setPubchemResults] = useState<any[]>([]);
  const [pubchemLoading, setPubchemLoading] = useState(false);
  const [pubchemError, setPubchemError] = useState('');
  const [fdaResults, setFdaResults] = useState<any[]>([]);
  const [fdaLoading, setFdaLoading] = useState(false);
  const [fdaError, setFdaError] = useState('');
  const [mixGoal, setMixGoal] = useState<string>('pump');
  const [mixTiming, setMixTiming] = useState<string>('pre');
  const [mixCompoundTimings, setMixCompoundTimings] = useState<Record<string, number>>({});

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
        results.push({ name: sub.name, id: sub.id, cls: sub.class, desc: (detail?.description || sub.description || SUPPORT_CLASS_LABELS[sub.class] || '').slice(0, 120) });
      }
    }
    for (const sub of ALL_SUBSTANCES) {
      if ((sub.name||'').toLowerCase().includes(ql) || (sub.id||'').toLowerCase().includes(ql) || (sub.categories||[]).some(c => (c||'').toLowerCase().includes(ql))) {
        results.push({ name: sub.name || sub.id, id: sub.id, cls: sub.type || 'supplement', desc: (sub.description || '').slice(0, 120) });
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
    const newStack = { id, name: stackName || level.label + ' ' + new Date().toLocaleDateString('ru'), date: new Date().toISOString(), subs: level.subs, dosages: level.dosages || {} };
    const updated = [...savedStacks, newStack];
    setSavedStacks(updated);
    localStorage.setItem('savedStacks', JSON.stringify(updated));
    setStackName('');
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

  // Support-only synergy pairs
  const supportSynergies = useMemo(() => {
    return SYNERGY_PAIRS.filter(p => {
      const a = PHARMA_DB[p.substanceA];
      const b = PHARMA_DB[p.substanceB];
      const supportClasses = ['support', 'peptide_regenerative', 'peptide_nootropic', 'peptide_immune'];
      // Include: both are support substances, or at least one is a supplement
      const aIsSupport = a ? supportClasses.includes(a.class) : SUPPLEMENT_DESCRIPTIONS[p.substanceA] !== undefined;
      const bIsSupport = b ? supportClasses.includes(b.class) : SUPPLEMENT_DESCRIPTIONS[p.substanceB] !== undefined;
      return aIsSupport || bIsSupport;
    });
  }, []);

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

  const filteredSynergies = useMemo(() => {
    let pairs = supportSynergies;
    if (synergyFilter !== 'all') {
      pairs = pairs.filter(p => p.synergyType === synergyFilter);
    }
    if (systemFilter !== 'all') {
      pairs = pairs.filter(p => p.affectedSystems?.includes(systemFilter));
    }
    return pairs;
  }, [synergyFilter, systemFilter, supportSynergies]);

  const systemLabels: Record<string, string> = Object.fromEntries(ALL_RISK_SYSTEMS.map(k => [k, SYSTEM_INFO_ALL[k]?.label ?? k]));

  const selectedDetail = selectedSub ? supplementList.find(s => s.id === selectedSub) : null;

  // Interaction checker
  const addInteraction = () => setInteractionIds([...interactionIds, '']);
  const removeInteraction = (idx: number) => setInteractionIds(interactionIds.filter((_, i) => i !== idx));
  const updateInteraction = (idx: number, value: string) => {
    const updated = [...interactionIds];
    updated[idx] = value;
    setInteractionIds(updated);
  };
  const validInteractionIds = interactionIds.filter(Boolean);
  
  const supportInteractions = useMemo(() => {
    if (validInteractionIds.length < 2) return null;
    const subs: Record<string, string> = {};
    validInteractionIds.forEach(id => {
      const s = allSupport.find(x => x.id === id);
      if (s) subs[id] = s.name;
    });
    try {
      const norm = (s: string) => s.replace(/_/g,'').toLowerCase();
      return INTERACTIONS_DB.filter(i => {
        if (!i || !i.substanceA || !i.substanceB) return false;
        const a = norm(i.substanceA);
        const b = norm(i.substanceB);
        return validInteractionIds.some(id => {
          const up = norm(id);
          return a === up || a.includes(up) || up.includes(a);
        }) && validInteractionIds.some(id => {
          const up = norm(id);
          return b === up || b.includes(up) || up.includes(b);
        });
      });
    } catch { return []; }
  }, [interactionIds, allSupport]);

  const hasSupportInteractions = supportInteractions && supportInteractions.length > 0;
  const supportSynergiesList = supportInteractions?.filter(i => i.type === 'synergy') ?? [];
  const supportConflicts = supportInteractions?.filter(i => i.type === 'conflict') ?? [];
  const supportCautions = supportInteractions?.filter(i => i.type === 'caution') ?? [];

  // Group ALL_SUBSTANCES by primary category for catalog
  const groupedSubstances = useMemo(() => {
    const normCat = (cat: string): string => {
      const m: Record<string,string> = {
        amino_acid:'amino_acids',aminoacids:'amino_acids',
        vitamin:'vitamins',vitamin_:'vitamins',
        mineral:'minerals',mineral_:'minerals',
        herb:'herbs',herbal:'herbs',
        antioxidant:'antioxidants',antioxid:'antioxidants',
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
    const filtered = searchQuery
      ? ALL_SUBSTANCES.filter(s =>
          (s.name||'').toLowerCase().includes(searchQuery.toLowerCase()) ||
          (s.id||'').toLowerCase().includes(searchQuery.toLowerCase()) ||
          (s.description||'').toLowerCase().includes(searchQuery.toLowerCase()) ||
          (s.categories||[]).some(c => (c||'').toLowerCase().includes(searchQuery.toLowerCase())) ||
          (s.mechanisms||[]).some(m => (m||'').toLowerCase().includes(searchQuery.toLowerCase()))
        )
        : ALL_SUBSTANCES;
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
  }, [searchQuery]);

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

  // Merge ALL_INTERACTIONS + SYNERGY_PAIRS for synergies tab (with null filter + dedup)
  const mergedInteractions = useMemo(() => {
    const seen = new Set<string>();
    const fromDB = ALL_INTERACTIONS
      .filter(i => i && i.interactionId && i.substanceA && i.substanceB && i.substanceA !== i.substanceB)
      .map(i => ({ ...i, source: 'db' as const }));
    for (const item of fromDB) {
      seen.add(item.interactionId);
      seen.add(`${item.substanceA}|${item.substanceB}`);
    }
    const fromEngine = SYNERGY_PAIRS.map((p, idx) => ({
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
    return [...fromDB, ...dedupedEngine];
  }, []);

  const filteredInteractions = useMemo(() => {
    let list = mergedInteractions;
    if (interactionTypeFilter !== 'all') {
      list = list.filter(i => i.type === interactionTypeFilter);
    }
    if (interactionSeverityFilter !== 'all') {
      list = list.filter(i => i.severity === interactionSeverityFilter);
    }
    return list;
  }, [interactionTypeFilter, interactionSeverityFilter, mergedInteractions]);

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

  const catDetailInteractions = (sub: SupportSubstance, interactions: any[]): React.ReactNode => {
    try {
      const subsInteractions = (interactions||[]).filter(i =>
        i&&(i.substanceA === sub.id || i.substanceB === sub.id)
      ).slice(0, 5);
      return subsInteractions.length > 0 ? (
        <div style={{ marginTop:4 }}>
          <div style={{ fontSize:7, color:'var(--text-dim)', marginBottom:1 }}>Взаимодействия:</div>
          {subsInteractions.map(i => {
            if (!i) return null;
            const isA = i.substanceA === sub.id;
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
  };

  const synergiesContent = (filtered: any[], merged: any[], cats: Record<string, boolean>): React.ReactNode => {
    return safeRender('synergies_content', () => {
      const list = filtered || [];
      const synergies = list.filter((i:any) => i?.type === 'synergy');
      const conflicts = list.filter((i:any) => i?.type === 'conflict' || i?.type === 'caution');
      const synTotal = synergies.length;
      const confTotal = conflicts.length;
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
                          {aDesc && <div style={{fontSize:7,color:'var(--text-dim)',lineHeight:1.3,marginBottom:1}}><b style={{color:'#4ade80'}}>{aName}</b>: {aDesc.slice(0,100)}{aDesc.length>100?'...':''}</div>}
                          {aMechs.length > 0 && <div style={{display:'flex',flexWrap:'wrap',gap:1,marginBottom:2}}>{aMechs.map((m,mi)=><span key={mi} style={{fontSize:5,padding:'0px 2px',borderRadius:2,background:'rgba(74,222,128,0.1)',color:'#4ade80'}}>{m}</span>)}</div>}
                          {bDesc && <div style={{fontSize:7,color:'var(--text-dim)',lineHeight:1.3,marginBottom:1}}><b style={{color:'#4ade80'}}>{bName}</b>: {bDesc.slice(0,100)}{bDesc.length>100?'...':''}</div>}
                          {bMechs.length > 0 && <div style={{display:'flex',flexWrap:'wrap',gap:1}}>{bMechs.map((m,mi)=><span key={mi} style={{fontSize:5,padding:'0px 2px',borderRadius:2,background:'rgba(74,222,128,0.1)',color:'#4ade80'}}>{m}</span>)}</div>}
                        </div>
                      );
                    })()}
                    {(interaction?.mechanisms||[]).length > 0 && (
                      <div style={{ display:'flex', flexWrap:'wrap', gap:2, marginTop:2 }}>
                        {(interaction.mechanisms||[]).map((m: any, mi: number) => (
                          <span key={mi} style={{ fontSize:6, padding:'1px 4px', borderRadius:3, background:'rgba(34,197,94,0.1)', color:'#22c55e', border:'1px solid rgba(34,197,94,0.15)', fontWeight:500 }}>{(m||'')}</span>
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
                          {aDesc && <div style={{fontSize:7,color:'var(--text-dim)',lineHeight:1.3,marginBottom:1}}><b style={{color:'#f87171'}}>{aName}</b>: {aDesc.slice(0,100)}{aDesc.length>100?'...':''}</div>}
                          {aMechs.length > 0 && <div style={{display:'flex',flexWrap:'wrap',gap:1,marginBottom:2}}>{aMechs.map((m,mi)=><span key={mi} style={{fontSize:5,padding:'0px 2px',borderRadius:2,background:'rgba(248,113,113,0.1)',color:'#f87171'}}>{m}</span>)}</div>}
                          {bDesc && <div style={{fontSize:7,color:'var(--text-dim)',lineHeight:1.3,marginBottom:1}}><b style={{color:'#f87171'}}>{bName}</b>: {bDesc.slice(0,100)}{bDesc.length>100?'...':''}</div>}
                          {bMechs.length > 0 && <div style={{display:'flex',flexWrap:'wrap',gap:1}}>{bMechs.map((m,mi)=><span key={mi} style={{fontSize:5,padding:'0px 2px',borderRadius:2,background:'rgba(248,113,113,0.1)',color:'#f87171'}}>{m}</span>)}</div>}
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
                          return <span key={mi} style={{ fontSize:6, padding:'1px 4px', borderRadius:3, background:mColor+'18', color:mColor, border:`1px solid ${mColor}22`, fontWeight:500 }}>{(m||'')}</span>;
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
    <div className="screen support-screen">
      {/* ===== MAIN HERO ===== */}
      {tab === 'main' && supportView === 'main' && (
        <div style={{ position:'fixed', inset:0, zIndex:100, display:'flex', flexDirection:'column' }}>
          <img src="/support-hero.jpg" alt="" style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover', objectPosition:'center top' }} />
          <div style={{ position:'absolute', inset:0, background:'linear-gradient(transparent 50%, rgba(0,0,0,0.85))' }} />
          <div style={{ position:'relative', zIndex:2, flex:1, display:'flex', flexDirection:'column', justifyContent:'flex-end', padding:'16px 16px 80px' }}>
            <h1 style={{ fontSize:22, fontWeight:800, color:'#fff', margin:'0 0 2px', textShadow:'0 2px 14px rgba(0,0,0,0.9)' }}>Поддержка</h1>
            <p style={{ fontSize:11, color:'rgba(255,255,255,0.9)', margin:'0 0 16px', lineHeight:1.3, textShadow:'0 1px 8px rgba(0,0,0,0.8)' }}>
              Фармакологическая поддержка, пептиды и предлагаемые препараты поддержки для уменьшения рисков
            </p>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              <div onClick={() => setSupportView('calc')} style={{
                display:'flex', alignItems:'center', gap:12, padding:'12px 14px', borderRadius:14, cursor:'pointer', textAlign:'left', width:'100%',
                background:'rgba(20,22,30,0.35)', border:'1px solid var(--glass-border)', color:'var(--text)', transition:'all 0.2s',
              }}>
                <div style={{ width:40, height:40, borderRadius:12, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, background:'rgba(0,230,138,0.1)', fontSize:20 }}>🧮</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, fontWeight:700, marginBottom:2, color:'var(--accent)' }}>Расчет поддержки</div>
                  <div style={{ fontSize:10, color:'rgba(255,255,255,0.85)', lineHeight:1.3 }}>Калькулятор поддержки, пептидный калькулятор, каталог, синергии и готовые стеки</div>
                </div>
                <span style={{ color:'var(--accent)', fontSize:16, opacity:0.6 }}>→</span>
              </div>
              <div onClick={() => setSupportView('fertility')} style={{
                display:'flex', alignItems:'center', gap:12, padding:'12px 14px', borderRadius:14, cursor:'pointer', textAlign:'left', width:'100%',
                background:'rgba(20,22,30,0.35)', border:'1px solid var(--glass-border)', color:'var(--text)', transition:'all 0.2s',
              }}>
                <div style={{ width:40, height:40, borderRadius:12, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, background:'rgba(139,92,246,0.1)', fontSize:20 }}>🧬</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, fontWeight:700, marginBottom:2, color:'#8b5cf6' }}>ПКТ и Фертильность</div>
                  <div style={{ fontSize:10, color:'rgba(255,255,255,0.85)', lineHeight:1.3 }}>Анализы, план ПКТ и восстановление фертильности</div>
                </div>
                <span style={{ color:'#8b5cf6', fontSize:16, opacity:0.6 }}>→</span>
            </div>
          </div>
        </div>
      </div>
      )}

      {/* ===== SUB-NAVIGATION (calc / fertility menus) ===== */}
      {tab === 'main' && supportView === 'calc' && calcView === 'main' && (
        <div style={{ position:'fixed', inset:0, zIndex:100, display:'flex', flexDirection:'column' }}>
          <img src="/calc-hero.jpg" alt="" style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover', objectPosition:'center top' }} />
          <div style={{ position:'absolute', inset:0, background:'linear-gradient(transparent 50%, rgba(0,0,0,0.85))' }} />
          <div style={{ position:'relative', zIndex:2, flex:1, display:'flex', flexDirection:'column', padding:'16px 16px 80px', overflow:'hidden' }}>
            <button onClick={() => setSupportView('main')} style={{ alignSelf:'flex-start', padding:'4px 8px', borderRadius:6, fontSize:10, cursor:'pointer', marginBottom:8, background:'var(--bg-secondary)', border:'1px solid var(--border)', color:'var(--text-dim)', fontWeight:600 }}>← Назад</button>
            <h2 style={{ fontSize:18, fontWeight:800, color:'#fff', margin:'8px 0 2px', textShadow:'0 2px 10px rgba(0,0,0,0.9)' }}>Расчет поддержки</h2>
            <p style={{ fontSize:10, color:'rgba(255,255,255,0.9)', margin:'0 0 16px', textShadow:'0 1px 6px rgba(0,0,0,0.8)' }}>
              Калькулятор поддержки, пептидный калькулятор и общая информация
            </p>
            {/* PRIMARY: Apple-style large cards */}
            <div style={{ flex:1, overflowY:'auto', scrollbarWidth:'none', msOverflowStyle:'none', paddingRight:4 }}>
              <div style={{ display:'flex', flexDirection:'column', gap:8, paddingBottom:8 }}>
                {[
                  { icon:'🧮', title:'Калькулятор поддержки', desc:'Персонализированный расчёт поддержки по курсу, рискам и целям', color:'#00e68a', action:() => setCalcView('calculator') },
                  { icon:'🧬', title:'Пептидный калькулятор', desc:'Расчёт дозировок, баков, разведения и протоколов пептидов', color:'#a78bfa', action:() => setCalcView('peptides') },
                  { icon:'ℹ️', title:'Общая информация', desc:'Каталог веществ, синергии, готовые стеки и взаимодействия', color:'#60a5fa', action:() => { setCalcView('info'); setInfoView('catalog'); } },
                  { icon:'🔬', title:'Исследования', desc:'Научная база исследований по всем веществам поддержки', color:'#f59e0b', action:() => { setCalcView('info'); setInfoView('research'); } },
                  { icon:'🧮', title:'Генератор стеков', desc:'Автоматический подбор стека по органам, целям и биомаркерам', color:'#ec4899', action:() => setCalcView('stackcalc') },
                  { icon:'📂', title:'Мои стеки', desc:'Сохранённые персональные стеки с оценкой синергий и конфликтов', color:'#22c55e', action:() => setCalcView('mystacks') },
                  { icon:'⚡', title:'Тренировочные миксы', desc:'Пре-/интра-/пост-тренировочные стеки для пампа, силы и восстановления', color:'#f97316', action:() => setCalcView('mixcalc') },
                  { icon:'📅', title:'План поддержки', desc:'Дневной, недельный и месячный план приёма по тайм-слотам', color:'#84cc16', action:() => setCalcView('plan') },
                  { icon:'🧠', title:'Нейротоксичность', desc:'Калькулятор нейротоксичности ААС и протокол нейропротекции', color:'#ec4899', action:() => setCalcView('neuro') },
                  { icon:'⚕️', title:'ГЗТ', desc:'Протоколы гормонозаместительной терапии и мониторинг', color:'#8b5cf6', action:() => setCalcView('hrt') },
                ].map((card, i) => (
                  <div key={i} onClick={card.action} style={{
                    display:'flex', alignItems:'center', gap:12, padding:'12px 14px', borderRadius:14, cursor:'pointer',
                    background:'rgba(20,22,30,0.35)', border:'1px solid var(--glass-border)', color:'var(--text)',
                    transition:'all 0.2s', backdropFilter:'blur(10px)', WebkitBackdropFilter:'blur(10px)',
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
            {/* SECONDARY: compact pills */}
            <div style={{ display:'flex', gap:6, marginTop:10, overflowX:'auto', scrollbarWidth:'none', flexWrap:'wrap', flexShrink:0 }}>
              <button onClick={() => { setCalcView('info'); setInfoView('research'); }} style={{ padding:'6px 12px', borderRadius:16, fontSize:9, fontWeight:700, whiteSpace:'nowrap', cursor:'pointer', flexShrink:0, background:'var(--bg-secondary)', color:'var(--text-dim)', border:'1px solid var(--border)' }}>🔬 Исследования</button>
              <button onClick={() => setCalcView('stackcalc')} style={{ padding:'6px 12px', borderRadius:16, fontSize:9, fontWeight:700, whiteSpace:'nowrap', cursor:'pointer', flexShrink:0, background:'var(--bg-secondary)', color:'var(--text-dim)', border:'1px solid var(--border)' }}>🧮 Генератор</button>
              <button onClick={() => setCalcView('mystacks')} style={{ padding:'6px 12px', borderRadius:16, fontSize:9, fontWeight:700, whiteSpace:'nowrap', cursor:'pointer', flexShrink:0, background:'var(--bg-secondary)', color:'var(--text-dim)', border:'1px solid var(--border)' }}>📂 Мои стеки</button>
              <button onClick={() => setCalcView('mixcalc')} style={{ padding:'6px 12px', borderRadius:16, fontSize:9, fontWeight:700, whiteSpace:'nowrap', cursor:'pointer', flexShrink:0, background:'var(--bg-secondary)', color:'var(--text-dim)', border:'1px solid var(--border)' }}>⚡ Миксы</button>
              <button onClick={() => setCalcView('plan')} style={{ padding:'6px 12px', borderRadius:16, fontSize:9, fontWeight:700, whiteSpace:'nowrap', cursor:'pointer', flexShrink:0, background:'var(--bg-secondary)', color:'var(--text-dim)', border:'1px solid var(--border)' }}>📅 План</button>
              <button onClick={() => setCalcView('neuro')} style={{ padding:'6px 12px', borderRadius:16, fontSize:9, fontWeight:700, whiteSpace:'nowrap', cursor:'pointer', flexShrink:0, background:'var(--bg-secondary)', color:'var(--text-dim)', border:'1px solid var(--border)' }}>🧠 Нейро</button>
              <button onClick={() => setCalcView('hrt')} style={{ padding:'6px 12px', borderRadius:16, fontSize:9, fontWeight:700, whiteSpace:'nowrap', cursor:'pointer', flexShrink:0, background:'var(--bg-secondary)', color:'var(--text-dim)', border:'1px solid var(--border)' }}>⚕️ ГЗТ</button>
            </div>
          </div>
        </div>
      )}

      {tab === 'main' && supportView === 'calc' && calcView === 'info' && (
        <div style={{ padding:'0 0 70px', height:'100vh', display:'flex', flexDirection:'column' }}>
          <div style={{ display:'flex', gap:6, marginBottom:6 }}>
            <button onClick={() => setCalcView('main')} style={{ padding:'4px 8px', borderRadius:6, fontSize:10, cursor:'pointer', background:'var(--bg-secondary)', border:'1px solid var(--border)', color:'var(--text-dim)', fontWeight:600 }}>← Назад</button>
            <button onClick={() => setSupportView('main')} style={{ padding:'4px 8px', borderRadius:6, fontSize:10, cursor:'pointer', background:'var(--bg-secondary)', border:'1px solid var(--border)', color:'var(--text-dim)', fontWeight:600 }}>← На главную Поддержки</button>
          </div>
          {/* Pills */}
          <div style={{ display:'flex', gap:4, marginBottom:8, overflowX:'auto', scrollbarWidth:'none', flexShrink:0 }}>
            {(['catalog','synergies','stacks','interactions','research'] as const).map(t => (
              <button key={t} onClick={() => { setInfoView(t); setSynergyPage(1); }} style={{
                padding:'7px 14px', borderRadius:20, fontSize:10, fontWeight:700, whiteSpace:'nowrap', cursor:'pointer', flexShrink:0,
                background: infoView === t ? 'var(--accent)' : 'var(--bg-secondary)',
                color: infoView === t ? '#000' : 'var(--text-dim)',
                border: `1px solid ${infoView === t ? 'var(--accent)' : 'var(--border)'}`,
              }}>{t === 'catalog' ? '📖 Каталог' : t === 'synergies' ? '🔗 Синергии' : t === 'stacks' ? '📦 Готовые' : t === 'research' ? '🔬 Исследования' : '⚡ Взаимодействия'}</button>
            ))}
          </div>
          {/* Content */}
          <div style={{ flex:1, overflowY:'auto', paddingRight:4 }}>
            <div style={{fontSize:7,color:'rgba(255,255,255,0.2)',textAlign:'center',marginBottom:4}}>
              build:2026-06-15 | subs:{ALL_SUBSTANCES.length} | int:{ALL_INTERACTIONS.length} | stacks:{ALL_STACKS.length} | tab:{calcView}/{infoView}
            </div>
            {renderView(infoView, 'catalog', () =>
              <div>
                <div style={{ display:'flex', gap:6, marginBottom:8, alignItems:'center' }}>
                  <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Поиск по названию, категориям, механизмам" style={{ flex:1, padding:'8px 10px', borderRadius:8, border:'1px solid var(--border-color)', background:'var(--bg-secondary)', color:'var(--text-light)', fontSize:12 }} />
                </div>
                <div style={{ fontSize:9, color:'var(--text-dim)', marginBottom:6 }}>
                  {searchQuery ? `Найдено: ${groupedSubstances.reduce((a, g) => a + g.count, 0)} из ${ALL_SUBSTANCES.length}` : `Всего: ${ALL_SUBSTANCES.length} веществ`}
                </div>
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
                                          <div style={{ fontSize:10, fontWeight:600, color:'var(--text-light)', lineHeight:1.3 }}>{sub?.name||''}</div>
                                          <div style={{ display:'flex', gap:2, flexWrap:'wrap', marginTop:1 }}>
                                            {(sub?.categories||[]).slice(0,3).map(c => <span key={c} style={{ fontSize:8, padding:'1px 4px', borderRadius:3, background:'rgba(255,255,255,0.06)', color:'rgba(255,255,255,0.85)' }}>{c||''}</span>)}
                                            {(sub?.mechanisms||[]).slice(0,4).map(m => <span key={m||''} style={{ fontSize:8, padding:'1px 4px', borderRadius:3, background:'rgba(0,230,138,0.08)', color:'#00e68a' }}>{m||''}</span>)}
                                          </div>
                                        </div>
                                        <span style={{ fontSize:9, color:'var(--text-dim)', transform:selectedSub === sub?.id ? 'rotate(180deg)' : 'none' }}>▼</span>
                                      </div>
                                      {selectedSub === sub?.id && sub && (
                                        <div style={{ padding:'6px 10px 8px 22px', background:'rgba(0,0,0,0.15)', borderBottom:'1px solid var(--border)' }}>
                                          <div style={{ fontSize:10, color:'rgba(255,255,255,0.9)', lineHeight:1.4, marginBottom:4 }}>{sub.description||''}</div>
                                          <div style={{ fontSize:7, color:'var(--accent-green, #00e68a)', marginBottom:3 }}>
                                            {TYPE_LABELS_RU[sub.type] || (sub.type||'')}{(sub.categories||[]).length > 0 ? ' · ' + (sub.categories||[]).slice(0,3).join(', ') : ''}
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
                                                {(sub.organs||[]).map(o => <span key={o||''} style={{ fontSize:8, padding:'2px 6px', borderRadius:4, background:'rgba(59,130,246,0.1)', color:'#60a5fa', border:'1px solid rgba(59,130,246,0.15)' }}>{o||''}</span>)}
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
                                      <div style={{ fontSize:10, fontWeight:600, color:'var(--text-light)', lineHeight:1.3 }}>{sub?.name||''}</div>
                                      <div style={{ display:'flex', gap:2, flexWrap:'wrap', marginTop:1 }}>
                                        {(sub?.categories||[]).slice(0,3).map(c => <span key={c} style={{ fontSize:8, padding:'1px 4px', borderRadius:3, background:'rgba(255,255,255,0.06)', color:'rgba(255,255,255,0.85)' }}>{c||''}</span>)}
                                        {(sub?.mechanisms||[]).slice(0,4).map(m => <span key={m||''} style={{ fontSize:8, padding:'1px 4px', borderRadius:3, background:'rgba(0,230,138,0.08)', color:'#00e68a' }}>{m||''}</span>)}
                                      </div>
                                    </div>
                                    <span style={{ fontSize:9, color:'var(--text-dim)', transform:selectedSub === sub?.id ? 'rotate(180deg)' : 'none' }}>▼</span>
                                  </div>
                                  {selectedSub === sub?.id && sub && (
                                    <div style={{ padding:'6px 10px 8px 14px', background:'rgba(0,0,0,0.15)', borderBottom:'1px solid var(--border)' }}>
                                      <div style={{ fontSize:10, color:'rgba(255,255,255,0.9)', lineHeight:1.4, marginBottom:4 }}>{sub.description||''}</div>
                                      <div style={{ fontSize:7, color:'var(--accent-green, #00e68a)', marginBottom:3 }}>
                                        {TYPE_LABELS_RU[sub.type] || (sub.type||'')}{(sub.categories||[]).length > 0 ? ' · ' + (sub.categories||[]).slice(0,3).join(', ') : ''}
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
                                            {(sub.organs||[]).map(o => <span key={o||''} style={{ fontSize:8, padding:'2px 6px', borderRadius:4, background:'rgba(59,130,246,0.1)', color:'#60a5fa', border:'1px solid rgba(59,130,246,0.15)' }}>{o||''}</span>)}
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
              </div>
            )}
            {renderView(infoView, 'synergies', () =>
              <div>
                <div style={{ display:'flex', gap:4, marginBottom:8, overflowX:'auto', scrollbarWidth:'none', flexWrap:'wrap' }}>
                  {(['all','LOW','MEDIUM','HIGH'] as const).map(s => (
                    <button key={s} onClick={() => { setInfoSynergySeverity(s); setSynergyPage(1); }} style={{
                      padding:'4px 8px', borderRadius:10, fontSize:8, fontWeight:600, whiteSpace:'nowrap', cursor:'pointer', flexShrink:0,
                      background: infoSynergySeverity === s ? (INTERACTION_SEVERITY_LABELS[s]?.color || 'var(--accent)') : 'transparent',
                      color: infoSynergySeverity === s ? '#000' : 'var(--text-dim)',
                      border: `1px solid ${infoSynergySeverity === s ? (INTERACTION_SEVERITY_LABELS[s]?.color || 'var(--accent)') : 'var(--border)'}`,
                    }}>{s === 'all' ? '♾️ Все' : `${INTERACTION_SEVERITY_LABELS[s]?.label||s}`}</button>
                  ))}
                  <div style={{ fontSize:9, color:'var(--text-dim)', display:'flex', alignItems:'center', marginLeft:2, whiteSpace:'nowrap' }}>{filteredInteractions.length} из {mergedInteractions.length}</div>
                </div>
                 <div style={{ maxHeight:'calc(70vh)', overflowY:'auto', paddingRight:4 }}>{synergiesContent(infoSynergySeverity === 'all' ? mergedInteractions : mergedInteractions.filter((i: any) => i.severity === infoSynergySeverity), mergedInteractions, expandedCategories)}</div>
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
                                            {subInfo?.description && <div style={{ opacity:0.7 }}>{subInfo.description.slice(0, 80)}</div>}
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
            {renderView(infoView, 'interactions', () =>
              <div>
                <div style={{ marginBottom:8 }}>
                  <div style={{ display:'flex', gap:4, marginBottom:8 }}>
                    {(['support','pharma'] as const).map(t => (
                      <button key={t} onClick={() => setInteractTab(t)} style={{
                        flex:1, padding:'7px 0', borderRadius:8, fontSize:10, fontWeight:700, cursor:'pointer', transition:'all 0.15s',
                        background: interactTab === t ? 'var(--accent)' : 'var(--bg-secondary)',
                        color: interactTab === t ? '#000' : 'var(--text-dim)',
                        border: 'none',
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
                        <button onClick={addInteraction} style={{ padding:'8px', borderRadius:8, fontSize:10, fontWeight:600, cursor:'pointer', background:'rgba(0,230,138,0.06)', border:'1px dashed rgba(0,230,138,0.3)', color:'#00e68a' }}>+ Добавить препарат</button>
                      </div>
                      {validInteractionIds.length<2 && <div style={{ textAlign:'center', padding:'20px 12px', background:'var(--bg-secondary)', borderRadius:10, border:'1px solid var(--border)' }}><div style={{ fontSize:20, marginBottom:4 }}>⚡</div><div style={{ fontSize:10, color:'var(--text-dim)' }}>Выберите минимум 2 препарата</div></div>}
                      {validInteractionIds.length>=2 && !hasSupportInteractions && <div style={{ textAlign:'center', padding:'10px', borderRadius:8, background:'rgba(0,230,138,0.06)', border:'1px solid rgba(0,230,138,0.2)' }}><span style={{ fontSize:10, color:'#4caf50', fontWeight:600 }}>✓ Конфликтов не обнаружено</span></div>}
                      {hasSupportInteractions && (
                        <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                          {[
                            { list: supportSynergiesList, label:'⊕ Синергия — положительное взаимодействие', color:'#22c55e' },
                            { list: supportConflicts, label:'⊖ Конфликт — отрицательное взаимодействие', color:'#ef4444' },
                            { list: supportCautions, label:'⚡ Осторожность — потенциальный риск', color:'#f59e0b' },
                          ].filter(s => s.list.length>0).map(section => (
                            <div key={section.label} style={{ background:'var(--bg-secondary)', borderRadius:10, padding:'8px 10px', border:'1px solid var(--border)' }}>
                              <div style={{ fontSize:10, fontWeight:700, color:section.color, marginBottom:4 }}>{section.label} ({section.list.length})</div>
                              {section.list.map(i => {
                                const sevColor = i.severity === 'HIGH' ? '#ef4444' : i.severity === 'MEDIUM' ? '#f59e0b' : '#22c55e';
                                const aName = resolveSubName(i.substanceA) || i.substanceA;
                                const bName = resolveSubName(i.substanceB) || i.substanceB;
                                const effDesc = showEffect(i);
                                return (
                                  <div key={i.id} style={{ padding:'5px 0', borderBottom:'1px solid var(--border)' }}>
                                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                                      <span style={{ color:section.color, fontWeight:700, fontSize:9 }}>{aName} + {bName}</span>
                                      <div style={{ display:'flex', gap:3 }}>
                                        <span style={{ fontSize:7, padding:'1px 4px', borderRadius:3, background:section.color+'22', color:section.color, fontWeight:600 }}>{i.type === 'synergy' ? '⊕ Синергия' : i.type === 'conflict' ? '⊖ Конфликт' : '⚡ Осторожно'}</span>
                                        {i.severity && <span style={{ fontSize:7, padding:'1px 4px', borderRadius:3, background:sevColor+'22', color:sevColor }}>{i.severity==='HIGH'?'Высокий':i.severity==='MEDIUM'?'Средний':'Низкий'}</span>}
                                      </div>
                                    </div>
                                    {effDesc && <div style={{ fontSize:9, color:'rgba(255,255,255,0.85)', lineHeight:1.3, marginTop:2 }}>{effDesc}</div>}
                                    {i.mechanisms && i.mechanisms.length > 0 && (
                                      <div style={{ display:'flex', flexWrap:'wrap', gap:2, marginTop:2 }}>
                                        {i.mechanisms.map((m: string, mi: number) => (
                                          <span key={mi} style={{ fontSize:6, padding:'1px 5px', borderRadius:3, background:'rgba(139,92,246,0.12)', color:'#a78bfa', border:'1px solid rgba(139,92,246,0.15)' }}>{m}</span>
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
                    <div>
                      <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:8 }}>
                        {(() => {
                          const PHARMA_CORE_FILTER = new Set(['testosterone','trenbolone','nandrolone','boldenone','primobolan','oral_17aa','sarm','drostanolone','dht_derivative','igf1','mgf','insulin','pct_serm','pct_aromatase','pct_dopamine','pct_gonadotropin']);
                          const pharmaAll = Object.values(PHARMA_DB).filter((s): s is (typeof PHARMA_DB)[string] => !!s?.name && PHARMA_CORE_FILTER.has(s.class));
                          const pharmaFiltered = pharmaInteractSearch ? pharmaAll.filter(s => (s.name||'').toLowerCase().includes(pharmaInteractSearch.toLowerCase())) : pharmaAll;
                          const pharmaValid = pharmaInteractIds.filter(Boolean);
                          return (<>
                            {pharmaInteractIds.map((id, idx) => {
                              const selectedName = id ? (PHARMA_DB[id]?.name || '') : '';
                              return (
                                <div key={idx} style={{ background:'var(--bg-secondary)', borderRadius:10, padding:'8px 10px', border:'1px solid var(--border)' }}>
                                  <div style={{ display:'flex', alignItems:'center', gap:4, marginBottom:4 }}>
                                    <span style={{ fontSize:8, color:'var(--text-dim)', fontWeight:600, background:'rgba(255,255,255,0.04)', padding:'1px 5px', borderRadius:3 }}>#{idx+1}</span>
                                    <span style={{ flex:1, fontSize:9, color:'var(--text-dim)' }}>{id ? selectedName : 'Препарат'}</span>
                                    {id && <button onClick={() => { const next=[...pharmaInteractIds]; next[idx]=''; setPharmaInteractIds(next); setPharmaInteractSearch(''); }} style={{ padding:'2px 6px', borderRadius:4, fontSize:8, cursor:'pointer', background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.2)', color:'#ef4444' }}>✕</button>}
                                  </div>
                                  <div style={{ position:'relative' }}>
                                    {id ? (
                                      <div style={{ padding:'7px 8px', borderRadius:6, background:'rgba(139,92,246,0.06)', border:'1px solid rgba(139,92,246,0.15)', color:'#a78bfa', fontSize:10, fontWeight:600 }}>{selectedName}</div>
                                    ) : (
                                      <>
                                        <input value={pharmaInteractSearch} onChange={e => { setPharmaInteractSearch(e.target.value); }} placeholder="🔍 Введите название..." style={{ width:'100%', padding:'7px 8px', borderRadius:6, background:'rgba(0,0,0,0.2)', border:'1px solid var(--border)', color:'var(--text)', fontSize:10, boxSizing:'border-box' }} />
                                        {pharmaInteractSearch && (
                                          <div style={{ position:'absolute', zIndex:10, background:'var(--bg)', border:'1px solid var(--border)', borderRadius:6, maxHeight:150, overflowY:'auto', marginTop:1, width:'calc(100% - 2px)' }}>
                                            {pharmaFiltered.slice(0,10).map(s => <div key={s.id} onClick={() => { const next=[...pharmaInteractIds]; next[idx]=s.id; setPharmaInteractIds(next); setPharmaInteractSearch(''); }} style={{ padding:'7px 10px', cursor:'pointer', fontSize:10, borderBottom:'1px solid var(--border)' }}><span style={{ fontWeight:600, color:'var(--text)' }}>{s.name}</span><span style={{ marginLeft:4, color:'var(--text-dim)', fontSize:8 }}>{s.class}</span></div>)}
                                          </div>
                                        )}
                                      </>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                            <button onClick={() => setPharmaInteractIds([...pharmaInteractIds, ''])} style={{ padding:'8px', borderRadius:8, fontSize:10, fontWeight:600, cursor:'pointer', background:'rgba(0,230,138,0.06)', border:'1px dashed rgba(0,230,138,0.3)', color:'#00e68a' }}>+ Добавить препарат</button>
                            {pharmaValid.length>=2 && checkDrugInteractions(pharmaValid.map((id,i)=>({id:`${id}-${i}`,substanceId:id,doseValue:300,doseUnit:'mg/wk',frequency:'2x/week',startWeek:0,endWeek:12}))).length===0 && (
                              <div style={{ padding:'10px', borderRadius:8, background:'rgba(0,230,138,0.06)', border:'1px solid rgba(0,230,138,0.2)', textAlign:'center' }}><span style={{ fontSize:10, color:'#4caf50', fontWeight:600 }}>✓ Конфликтов не обнаружено</span></div>
                            )}
                            {pharmaValid.length>=2 && checkDrugInteractions(pharmaValid.map((id,i)=>({id:`${id}-${i}`,substanceId:id,doseValue:300,doseUnit:'mg/wk',frequency:'2x/week',startWeek:0,endWeek:12}))).map((alert,i)=>{
                              const c = alert.type==='critical'?'#ff1744':alert.type==='warning'?'#ff9100':'#2979ff';
                              const icon = alert.type==='critical'?'🚫':alert.type==='warning'?'⚠️':'ℹ️';
                              return <div key={i} style={{ background:'var(--bg-secondary)', borderRadius:10, padding:'10px', marginBottom:4, borderLeft:`3px solid ${c}`, border:'1px solid var(--border)' }}>
                                <div style={{ display:'flex', alignItems:'center', gap:4, marginBottom:3 }}><span style={{ fontSize:12 }}>{icon}</span><span style={{ fontWeight:700, fontSize:9, color:c }}>{alert.type==='critical'?'КРИТИЧЕСКОЕ':alert.type==='warning'?'ПРЕДУПРЕЖДЕНИЕ':'ИНФО'}</span></div>
                                <div style={{ fontSize:10, fontWeight:600, color:'var(--text-light)', marginBottom:2 }}>{alert.drugs.join(' + ')}</div>
                                <div style={{ fontSize:9, color:'var(--text-dim)', lineHeight:1.3 }}><b>Механизм:</b> {alert.mechanism}</div>
                                <div style={{ fontSize:9, color:'var(--text-dim)', lineHeight:1.3 }}><b>Рекомендация:</b> {alert.recommendation}</div>
                              </div>;
                            })}
                          </>);
                        })()}
                      </div>
                    </div>
            )}
                    {/* Hardcoded drug interaction cards */}
                    <div style={{ marginTop:8 }}>
                      <div onClick={() => setExpandedCategories(prev => ({ ...prev, drug_combo_ref: !prev.drug_combo_ref }))} style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 10px', cursor:'pointer', userSelect:'none', background:'var(--bg-secondary)', borderRadius:8 }}>
                        <span style={{ fontSize:13 }}>💊</span>
                        <div style={{ flex:1, fontSize:10, fontWeight:700, color:'var(--text-light)' }}>Фармакологические взаимодействия</div>
                        <span style={{ fontSize:9, color:'var(--text-dim)', marginRight:2 }}>23</span>
                        <span style={{ fontSize:9, color:'var(--text-dim)', transform: expandedCategories.drug_combo_ref !== false ? 'rotate(180deg)' : 'none', transition:'transform 0.2s' }}>▼</span>
                      </div>
                      {expandedCategories.drug_combo_ref !== false && (
                        <div style={{ display:'flex', flexDirection:'column', gap:3, marginTop:4 }}>
                          {([
                            { a:'Тестостерон', b:'Тренболон', effect:'Усиление андрогенного эффекта', risk:'Агрессия, акне, липиды', control:'Липидограмма каждые 4 нед.', type:'warning' },
                            { a:'Тестостерон', b:'Мастерон', effect:'Синергия. Мастерон снижает ароматизацию тестостерона', risk:'Подавление Е2', control:'Контроль Е2', type:'synergy' },
                            { a:'Тестостерон', b:'Болденон', effect:'Медленный набор массы', risk:'Повышение гематокрита', control:'ОАК', type:'caution' },
                            { a:'Тренболон', b:'Болденон', effect:'Оба повышают гематокрит и АД', risk:'Тромбоз', control:'ОАК + АД еженедельно', type:'critical' },
                            { a:'Телмисартан', b:'Небиволол', effect:'Усиление гипотензивного эффекта (БРА + бета-блокатор)', risk:'Брадикардия, гипотония', control:'АД и ЧСС 2x/день. Коррекция дозы при ЧСС <50', type:'caution' },
                            { a:'Телмисартан', b:'Амлодипин', effect:'Синергия. БРА + блокатор кальциевых каналов', risk:'Меньше отёков чем амлодипин отдельно', control:'Контроль АД', type:'synergy' },
                            { a:'Метформин', b:'Берберин', effect:'Оба снижают глюкозу', risk:'Гипогликемия', control:'Глюкометр', type:'warning' },
                            { a:'Инсулин', b:'Метформин', effect:'Метформин снижает потребность в инсулине на 20-30%', risk:'Гипогликемия', control:'Коррекция дозы инсулина', type:'caution' },
                            { a:'Станазолол', b:'Оксандролон', effect:'Оба 17α-алкилированные гепатотоксичные', risk:'Холестаз', control:'АЛТ/АСТ/ГГТ каждые 2 нед. НЕ комбинировать!', type:'critical' },
                            { a:'Оксандролон', b:'Тестостерон', effect:'Синергия. Оксандролон снижает ГСПГ', risk:'Больше свободного тестостерона', control:'Контроль ГСПГ', type:'synergy' },
                            { a:'Тамоксифен', b:'Кломифен', effect:'Оба СЕРМ. Синергия в ПКТ', risk:'Тамоксифен для Е2, кломифен для ЛГ/ФСГ', control:'Гормональная панель', type:'synergy' },
                            { a:'Анастрозол', b:'Тамоксифен', effect:'Анастрозол снижает Е2, тамоксифен блокирует рецепторы', risk:'Синергия при гинекомастии', control:'Контроль Е2', type:'synergy' },
                            { a:'Дексаметазон', b:'Тестостерон', effect:'Глюкокортикоид + андроген', risk:'Гипергликемия, катаболизм', control:'Глюкоза', type:'warning' },
                            { a:'Тестостерон', b:'Примоболан', effect:'Синергия. Нет ароматизации', risk:'Липиды', control:'Липидограмма', type:'synergy' },
                            { a:'Тренболон', b:'Мастерон', effect:'Синергия (сухая масса)', risk:'Липиды, агрессия', control:'Липидограмма, настроение', type:'synergy' },
                            { a:'Болденон', b:'Нандролон', effect:'Оба повышают гематокрит', risk:'Тромбоз', control:'ОАК каждые 2 нед.', type:'critical' },
                            { a:'Анавар', b:'Винстрол', effect:'Оба 17α-алкилированные', risk:'Гепатотоксичность x2', control:'НЕ комбинировать >4 нед. АЛТ/АСТ', type:'critical' },
                            { a:'Кломид', b:'ХГЧ', effect:'Синергия в ПКТ. ХГЧ восстанавливает тестикулы, кломид стимулирует гипофиз', risk:'Эстрогеновый отскок', control:'Е2, ЛГ, ФСГ', type:'synergy' },
                            { a:'Аримидекс', b:'Тамоксифен', effect:'Разные механизмы. Аримидекс снижает ароматизацию, тамоксифен блокирует рецепторы Е2', risk:'Избыточное подавление Е2', control:'Е2 каждые 4 нед.', type:'synergy' },
                            { a:'Метформин', b:'ГР', effect:'ГР повышает глюкозу, метформин компенсирует', risk:'Гипогликемия', control:'Глюкоза натощак', type:'caution' },
                            { a:'L-тироксин', b:'Кленбутерол', effect:'Оба повышают ЧСС и метаболизм', risk:'Тахикардия, тремор', control:'ЧСС, ТТГ', type:'warning' },
                            { a:'Тестостерон', b:'Дека-дураболин', effect:'Дека (нандролон) с тестостероном — классика', risk:'Пролактин, прогестероновая активность', control:'Пролактин каждые 4 нед.', type:'caution' },
                            { a:'Тренболон', b:'ГР', effect:'Синергия. Тренболон повышает IGF-1, ГР добавляет IGF-1 из печени', risk:'Гипогликемия (ГР + инсулин)', control:'Глюкоза', type:'synergy' },
                          ] as const).map((combo, ci) => {
                            const typeColor = combo.type === 'critical' ? '#ff1744' : combo.type === 'warning' ? '#ff9100' : combo.type === 'synergy' ? '#22c55e' : '#f59e0b';
                            const typeLabel = combo.type === 'critical' ? '🚫 КРИТИЧНО' : combo.type === 'warning' ? '⚡ ОСТОРОЖНО' : combo.type === 'synergy' ? '⊕ СИНЕРГИЯ' : 'ℹ УМЕРЕННО';
                            return (
                              <div key={ci} style={{ background:'var(--bg-secondary)', borderRadius:8, padding:'6px 8px', borderLeft:`3px solid ${typeColor}`, border:'1px solid var(--border)' }}>
                                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:2 }}>
                                  <span style={{ fontSize:9, fontWeight:700, color:'var(--text-light)' }}>{combo.a} + {combo.b}</span>
                                  <span style={{ fontSize:7, padding:'1px 5px', borderRadius:3, background:typeColor+'22', color:typeColor, fontWeight:600 }}>{typeLabel}</span>
                                </div>
                                <div style={{ fontSize:8, color:'rgba(255,255,255,0.85)', lineHeight:1.3 }}>{combo.effect}</div>
                                <div style={{ fontSize:7, color:'#f87171', lineHeight:1.2, marginTop:1 }}>⚠ Риск: {combo.risk}</div>
                                <div style={{ fontSize:7, color:'#60a5fa', lineHeight:1.2 }}>📋 Контроль: {combo.control}</div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ===== RESEARCH: Multi-Source ===== */}
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

      {tab === 'main' && supportView === 'fertility' && (
        <div style={{ position:'fixed', inset:0, zIndex:100, display:'flex', flexDirection:'column' }}>
          <img src="/fertility-hero.jpg" alt="" style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover', objectPosition:'center top' }} />
          <div style={{ position:'absolute', inset:0, background:'linear-gradient(transparent 50%, rgba(0,0,0,0.85))' }} />
          <div style={{ position:'relative', zIndex:2, flex:1, display:'flex', flexDirection:'column', justifyContent:'flex-end', padding:'16px 16px 80px' }}>
            <button onClick={() => setSupportView('main')} style={{ alignSelf:'flex-start', padding:'4px 8px', borderRadius:6, fontSize:10, cursor:'pointer', marginBottom:8, background:'var(--bg-secondary)', border:'1px solid var(--border)', color:'var(--text-dim)', fontWeight:600 }}>← Назад</button>
            <h2 style={{ fontSize:18, fontWeight:800, color:'#fff', margin:'8px 0 2px', textShadow:'0 2px 10px rgba(0,0,0,0.9)' }}>ПКТ и Фертильность</h2>
            <p style={{ fontSize:10, color:'rgba(255,255,255,0.9)', margin:'0 0 16px', textShadow:'0 1px 6px rgba(0,0,0,0.8)' }}>
              Анализы, план ПКТ и восстановление фертильности
            </p>
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {[
                { icon:'🩸', title:'Анализы', desc:'Ингибин B, ФСГ, ЛГ, эстрадиол, тестостерон, прогестерон', action:() => setTab('fertility-pct'), color:'#ef4444' },
                { icon:'📋', title:'План ПКТ', desc:'Протокол послекурсовой терапии и таймер', action:() => setTab('fertility-pct'), color:'var(--accent)' },
                { icon:'🌱', title:'План восстановления Фертильности', desc:'Восстановление сперматогенеза и гормонального фона', action:() => setTab('fertility-pct'), color:'#8b5cf6' },
              ].map((card, i) => (
                <div key={i} onClick={card.action} style={{
                  display:'flex', alignItems:'center', gap:12, padding:'12px 14px', borderRadius:14, cursor:'pointer', textAlign:'left', width:'100%',
                  background:'rgba(20,22,30,0.35)', border:'1px solid var(--glass-border)',
                }}>
                  <div style={{ width:40, height:40, borderRadius:12, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, background:card.color+'18', fontSize:20 }}>{card.icon}</div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13, fontWeight:700, marginBottom:2, color:card.color }}>{card.title}</div>
                    <div style={{ fontSize:10, color:'rgba(255,255,255,0.85)', lineHeight:1.3 }}>{card.desc}</div>
                  </div>
                  <span style={{ color:card.color, fontSize:16, opacity:0.6 }}>→</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ===== NON-MAIN CONTENT (with back button) ===== */}
      {tab !== 'main' && tab !== 'fertility-pct' && (
        <>
          <button onClick={() => setTab('main')} style={{ padding:'4px 8px', borderRadius:6, fontSize:10, cursor:'pointer', marginBottom:8, background:'var(--bg-secondary)', border:'1px solid var(--border)', color:'var(--text-dim)', fontWeight:600 }}>← На главную</button>

      {/* ===== CATALOG (ALL_SUBSTANCES — 1881+ записей) ===== */}
      {tab === 'catalog' && (
        <div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 10, alignItems: 'center' }}>
            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Поиск по названию, категориям, механизмам" style={{ flex: 1, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-light)', fontSize: 12 }} />
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 6 }}>
            {searchQuery ? `Найдено: ${groupedSubstances.reduce((a, g) => a + g.count, 0)} из ${ALL_SUBSTANCES.length}` : `Всего: ${ALL_SUBSTANCES.length} веществ`}
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
                              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-light)', lineHeight: 1.3 }}>{sub.name}</div>
                              <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginTop: 2 }}>
                                {(sub.categories||[]).slice(0, 3).map(c => (
                                  <span key={c} style={{ fontSize: 8, padding: '1px 4px', borderRadius: 3, background: 'rgba(255,255,255,0.04)', color: 'var(--text-dim)' }}>{c}</span>
                                ))}
                                {(sub.mechanisms||[]).slice(0, 2).map(m => (
                                  <span key={m} style={{ fontSize: 8, padding: '1px 4px', borderRadius: 3, background: 'rgba(0,230,138,0.06)', color: 'var(--accent-green, #00e68a)' }}>{m.slice(0, 30)}</span>
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
                                {TYPE_LABELS_RU[sub.type] || sub.type}{(sub.categories||[]).length > 0 ? ' · ' + (sub.categories||[]).slice(0, 3).join(', ') : ''}
                              </div>
                              {/* All mechanisms */}
                              {sub.mechanisms && sub.mechanisms.length > 0 && (
                                <div style={{ marginBottom: 4 }}>
                                  <div style={{ fontSize: 8, color: 'var(--text-dim)', marginBottom: 2 }}>Механизмы действия:</div>
                                  <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                                    {sub.mechanisms.map((m, i) => (
                                      <span key={i} style={{ fontSize: 8, padding: '2px 6px', borderRadius: 4, background: 'rgba(0,230,138,0.06)', color: '#00e68a' }}>{m}</span>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {/* Organs */}
                              {sub.organs && sub.organs.length > 0 && (
                                <div style={{ marginBottom: 4 }}>
                                  <div style={{ fontSize: 8, color: 'var(--text-dim)', marginBottom: 2 }}>Органы-мишени:</div>
                                  <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                                    {sub.organs.map(o => (
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
                                          {i.notes && <div style={{ opacity: 0.5 }}>{i.notes.slice(0, 60)}</div>}
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

      {/* ===== SYNERGIES (ALL_INTERACTIONS — 138+ пар) ===== */}
      {tab === 'synergies' && (
        <div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 10, overflowX: 'auto', scrollbarWidth: 'none', flexWrap: 'wrap' }}>
            {(['all', 'synergy', 'conflict', 'caution'] as const).map(t => (
              <button key={t} onClick={() => { setInteractionTypeFilter(t); setInteractionPage(1); setSynergyPage(1); }} style={{
                padding: '5px 12px', borderRadius: 16, fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap', cursor: 'pointer', flexShrink: 0,
                background: interactionTypeFilter === t ? (INTERACTION_TYPE_LABELS[t]?.color || 'var(--accent)') : 'var(--bg-secondary)',
                color: interactionTypeFilter === t ? '#000' : 'var(--text-dim)',
                border: `1px solid ${interactionTypeFilter === t ? (INTERACTION_TYPE_LABELS[t]?.color || 'var(--accent)') : 'var(--border)'}`,
              }}>
                {t === 'all' ? '🧲 Все' : `${INTERACTION_TYPE_LABELS[t]?.emoji || ''} ${INTERACTION_TYPE_LABELS[t]?.label || t}`}
              </button>
            ))}
            <span style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 2px' }} />
            {(['all', 'LOW', 'MEDIUM', 'HIGH'] as const).map(s => (
              <button key={s} onClick={() => { setInteractionSeverityFilter(s); setSynergyPage(1); setInteractionPage(1); }} style={{
                padding: '5px 10px', borderRadius: 12, fontSize: 9, fontWeight: 600, whiteSpace: 'nowrap', cursor: 'pointer', flexShrink: 0,
                background: interactionSeverityFilter === s ? (INTERACTION_SEVERITY_LABELS[s]?.color || 'var(--accent)') : 'transparent',
                color: interactionSeverityFilter === s ? '#000' : 'var(--text-dim)',
                border: `1px solid ${interactionSeverityFilter === s ? (INTERACTION_SEVERITY_LABELS[s]?.color || 'var(--accent)') : 'var(--border)'}`,
              }}>
                {s === 'all' ? 'Любая' : `${INTERACTION_SEVERITY_LABELS[s]?.label || s}`}
              </button>
            ))}
            <div style={{ fontSize: 10, color: 'var(--text-dim)', display: 'flex', alignItems: 'center', marginLeft: 4, whiteSpace: 'nowrap' }}>
              {filteredInteractions.length} из {mergedInteractions.length}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: '65vh', overflowY: 'auto', paddingRight: 2 }}>
            {filteredInteractions.slice(0, interactionPage * INTERACTION_PAGE_SIZE).map((interaction, i) => {
              const typeInfo = INTERACTION_TYPE_LABELS[interaction.type] || { label: interaction.type, emoji: '🔗', color: '#888' };
              const sevInfo = INTERACTION_SEVERITY_LABELS[interaction.severity] || { label: interaction.severity, color: '#888' };
              const aName = resolveSubName(interaction.substanceA);
              const bName = resolveSubName(interaction.substanceB);
              return (
                  <div key={interaction.interactionId} style={{
                    background: 'var(--bg-secondary)', borderRadius: 10, padding: '9px 10px',
                    borderLeft: `3px solid ${typeInfo.color}`,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap', flex: 1, minWidth: 0 }}>
                        <span style={{ fontWeight: 600, fontSize: 11, color: 'var(--text-light)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '35%' }}>{aName}</span>
                        <span style={{ fontSize: 12, color: typeInfo.color, fontWeight: 700 }}>
                          {interaction.type === 'synergy' ? '+' : interaction.type === 'conflict' ? '×' : '?'}
                        </span>
                        <span style={{ fontWeight: 600, fontSize: 11, color: 'var(--text-light)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '35%' }}>{bName}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                        <span style={{ fontSize: 8, padding: '1px 5px', borderRadius: 4, background: typeInfo.color + '22', color: typeInfo.color, fontWeight: 600 }}>{typeInfo.label}</span>
                        <span style={{ fontSize: 8, padding: '1px 5px', borderRadius: 4, background: sevInfo.color + '22', color: sevInfo.color }}>{sevInfo.label}</span>
                      </div>
                    </div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.85)', lineHeight: 1.3, marginBottom: 4 }}>
                      {(() => {
                        const eff = interaction.effect;
                        const displayEff = (/^[A-Z0-9_]+$/.test(eff) && interaction.notes) ? interaction.notes : eff;
                        return <>{interaction.type === 'synergy' ? '⊕ ' : interaction.type === 'conflict' ? '⊖ ' : ''}{displayEff}</>;
                      })()}
                    </div>
                    {interaction.mechanisms && interaction.mechanisms.length > 0 && (
                      <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginBottom: 2 }}>
                        {interaction.mechanisms.map(m => {
                          const ms = (m||'');
                          const mColor = ms.toLowerCase().includes('toxic') || ms.toLowerCase().includes('hepatic') ? '#ef4444' :
                            ms.toLowerCase().includes('kidney') || ms.toLowerCase().includes('renal') ? '#f59e0b' :
                            ms.toLowerCase().includes('synerg') || ms.toLowerCase().includes('enhanc') || ms.toLowerCase().includes('potent') ? '#22c55e' : '#a78bfa';
                          return <span key={m} style={{ fontSize: 8, padding: '1px 5px', borderRadius: 3, background: mColor + '18', color: mColor, border: `1px solid ${mColor}22`, fontWeight: 500 }}>{m}</span>;
                        })}
                      </div>
                    )}
                    {interaction.notes && (
                      <div style={{ fontSize: 9, color: 'var(--text-dim)', fontStyle: 'italic', lineHeight: 1.3 }}>{interaction.notes}</div>
                    )}
                  </div>
              );
            })}
            {filteredInteractions.length > interactionPage * INTERACTION_PAGE_SIZE && <button onClick={() => setInteractionPage(p => p + 1)} style={{ width:'100%', padding:'8px', marginTop:4, borderRadius:8, border:'1px solid var(--border)', background:'var(--bg-secondary)', color:'var(--text-dim)', fontSize:10, cursor:'pointer' }}>Показать ещё ({filteredInteractions.length - interactionPage * INTERACTION_PAGE_SIZE} из {filteredInteractions.length})</button>}
            {filteredInteractions.length === 0 && (
              <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-dim)', fontSize: 12 }}>
                Нет взаимодействий по выбранным фильтрам
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== CALCULATOR ===== */}
      {tab === 'calculator' && (
        <div>
          <div className="card" style={{ marginBottom: 12 }}>
            <h3 style={{ margin: '0 0 4px 0', fontSize: 14, color: 'var(--accent)' }}>🧮 Калькулятор поддержки</h3>
            <p style={{ fontSize: 11, color: 'var(--text-dim)', margin: '0 0 12px 0' }}>
              Расчёт индекса поддержки и снижения рисков на основе всех источников: препараты, анализы, питание, тренировки, генетика
            </p>
          </div>

          {/* Stack Generator Link */}
          <div className="card" style={{ marginBottom: 12 }}>
            <button onClick={() => { setSupportView('calc'); setCalcView('stackcalc'); }} style={{ width:'100%', padding: '12px', borderRadius: 10, border: '1px solid #8b5cf6', background: 'rgba(139,92,246,0.08)', cursor:'pointer', display:'flex', alignItems:'center', gap:10, textAlign:'left' }}>
              <span style={{ fontSize:20 }}>🧮</span>
              <div>
                <div style={{ fontSize:13, fontWeight:700, color:'#8b5cf6' }}>Генератор стеков</div>
                <div style={{ fontSize:10, color:'rgba(255,255,255,0.6)' }}>Автоматический подбор стека по органам и механизмам</div>
              </div>
              <span style={{ marginLeft:'auto', color:'#8b5cf6', fontSize:14 }}>→</span>
            </button>
          </div>

          {/* 4 Level Buttons */}
          <div className="card" style={{ marginBottom: 12 }}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: 13, color: 'var(--text)' }}>Выберите уровень поддержки</h4>
            <p style={{ fontSize: 10, color: 'var(--text-dim)', margin: '0 0 10px 0' }}>
              Препаратов на курсе: <b style={{ color: 'var(--accent)' }}>{linked.course.length}</b> | Авто-уровень: <b style={{ color: '#8b5cf6' }}>{SUPPORT_LEVELS[autoLevel]?.label || autoLevel}</b>
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {(['basic', 'mid', 'max', 'boost'] as const).map(l => {
                const active = supportLevel === l;
                const colors: Record<string, string> = { basic: '#22c55e', mid: '#eab308', max: '#f97316', boost: '#ef4444' };
                return (
                  <button key={l} onClick={() => { setSupportLevel(l); }} style={{
                    padding: '10px 8px', borderRadius: 10, border: `2px solid ${active ? colors[l] : 'var(--border)'}`,
                    background: active ? `${colors[l]}15` : 'var(--bg-secondary)', cursor: 'pointer', textAlign: 'center',
                    transition: 'all 0.2s',
                  }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: active ? colors[l] : 'var(--text-dim)', marginBottom: 2 }}>{SUPPORT_LEVELS[l]?.label}</div>
                    <div style={{ fontSize: 9, color: active ? 'var(--text-light)' : 'var(--text-dim)', lineHeight: 1.3 }}>{SUPPORT_LEVELS[l]?.desc}</div>
                    <div style={{ fontSize: 9, color: 'var(--text-dim)', marginTop: 4 }}>{SUPPORT_LEVELS[l]?.subs?.length} добавок</div>
                  </button>
                );
              })}
            </div>

            {/* Goal selector */}
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 4 }}>Цель</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {[{ v: 'muscle_gain', l: '💪 Масса' }, { v: 'fat_loss', l: '🔥 Сушка' }, { v: 'strength', l: '🏋️ Сила' }, { v: 'endurance', l: '🏃 Выносливость' }, { v: 'recomp', l: '⚖️ Рекомпозиция' }, { v: 'maintenance', l: '🔄 Поддержание' }].map(g => (
                  <button key={g.v} onClick={() => setSupportGoal(g.v)} style={{
                    padding: '5px 10px', borderRadius: 6, fontSize: 11, cursor: 'pointer',
                    background: supportGoal === g.v ? 'rgba(0,230,138,0.15)' : 'var(--bg-secondary)',
                    border: supportGoal === g.v ? '1px solid var(--accent)' : '1px solid var(--border)',
                    color: supportGoal === g.v ? '#00e68a' : 'var(--text-dim)', fontWeight: supportGoal === g.v ? 700 : 400,
                  }}>{g.l}</button>
                ))}
              </div>
            </div>

            <button onClick={calcSupport} style={{
              width: '100%', padding: '14px', borderRadius: 8, border: 'none', cursor: 'pointer', marginTop: 12,
              background: 'linear-gradient(135deg, #00e68a, #00c853)', color: '#000', fontWeight: 700, fontSize: 15,
              boxShadow: '0 2px 8px rgba(0,230,138,0.3)',
            }}>
              🧮 Рассчитать поддержку ({SUPPORT_LEVELS[supportLevel]?.subs?.length || 0} добавок)
            </button>
          </div>

          {/* Dosage table for selected level */}
          {SUPPORT_LEVELS[supportLevel]?.dosages && (
            <div className="card" style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                onClick={() => setExpandedCategories(prev => ({ ...prev, dosageTable: !prev.dosageTable }))}>
                <h4 style={{ margin: 0, fontSize: 12 }}>💊 Рекомендуемые дозировки ({SUPPORT_LEVELS[supportLevel]?.label})</h4>
                <span style={{ fontSize: 12, color: 'var(--accent)' }}>{expandedCategories.dosageTable ? '▾' : '▸'}</span>
              </div>
              {expandedCategories.dosageTable !== false && (
                <div style={{ marginTop: 6 }}>
                  {SUPPORT_LEVELS[supportLevel].subs.map(id => {
                    const pharmaSub = PHARMA_DB[id];
                    const name = pharmaSub?.name || id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                    const dosage = SUPPORT_LEVELS[supportLevel].dosages?.[id];
                    if (!dosage) return null;
                    return (
                      <div key={id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: 10 }}>
                        <span style={{ fontWeight: 500, flex: 1 }}>{name}</span>
                        <span style={{ color: 'var(--accent)', fontWeight: 600, minWidth: 60, textAlign: 'right' }}>{dosage.mg >= 1000 && id !== 'omega3' ? `${(dosage.mg/1000).toFixed(dosage.mg % 1000 === 0 ? 0 : 1)} г` : `${dosage.mg} мг`}</span>
                        <span style={{ color: 'var(--text-dim)', fontSize: 9, marginLeft: 8, minWidth: 90, textAlign: 'right' }}>{dosage.timing}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ===== MANUAL STACK BUILDER ===== */}
          <div className="card" style={{ marginBottom: 12 }}>
            <div onClick={() => setShowManualBuilder(!showManualBuilder)} style={{ cursor:'pointer', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <h4 style={{ margin: 0, fontSize: 12 }}>💊 Ручной подбор стека</h4>
              <span style={{ fontSize:16, color:'var(--accent)', transform: showManualBuilder ? 'rotate(180deg)' : 'none' }}>▾</span>
            </div>
            {showManualBuilder && <>
              {/* Search */}
              <input value={manualSearch} onChange={e => setManualSearch(e.target.value)}
                placeholder="Поиск по названию или ID..."
                style={{ width:'100%', padding:'6px 10px', borderRadius:8, border:'1px solid var(--border-color)', background:'var(--bg-secondary)', color:'var(--text-light)', fontSize:11, marginTop:6, boxSizing:'border-box' }} />
              
              {/* Category filter */}
              <div style={{ display:'flex', flexWrap:'wrap', gap:3, marginTop:6 }}>
                {[
                  { key:'all', label:'🧲 Все' },
                  { key:'vitamin', label:'Витамины' },
                  { key:'mineral', label:'Минералы' },
                  { key:'amino_acid', label:'Аминокислоты' },
                  { key:'antioxidant', label:'Антиоксиданты' },
                  { key:'adaptogen', label:'Адаптогены' },
                  { key:'peptide', label:'Пептиды' },
                  { key:'fatty_acid', label:'Жирные кислоты' },
                  { key:'prebiotic', label:'Пребиотики' },
                  { key:'probiotic', label:'Пробиотики' },
                  { key:'enzyme', label:'Ферменты' },
                ].map(({ key, label }) => (
                  <button key={key} onClick={() => setManualFilter(key)}
                    style={{ padding:'2px 6px', borderRadius:4, fontSize:9, cursor:'pointer', border:'none',
                      background: manualFilter === key ? 'var(--accent)' : 'var(--bg-secondary)',
                      color: manualFilter === key ? '#000' : 'var(--text-dim)', fontWeight: manualFilter === key ? 700 : 400 }}>{label}</button>
                ))}
              </div>

              {/* Substance list */}
              <div style={{ maxHeight:200, overflowY:'auto', marginTop:6, border:'1px solid var(--border-color)', borderRadius:6 }}>
                {ALL_SUBSTANCES
                  .filter(s => {
                    if (manualFilter === 'all') return true;
                    const filterL = manualFilter.toLowerCase();
                    const catMatch = (s.categories||[]).some(c => (c||'').toLowerCase().includes(filterL));
                    const typeMatch = (s.type||'').toLowerCase().includes(filterL);
                    const aliasMatch = filterL === 'vitamin' && s.type === 'vitamin';
                    const aaMatch = filterL === 'amino_acid' && ['amino','aminoacid'].includes((s.type||'').toLowerCase());
                    if (!catMatch && !typeMatch && !aliasMatch && !aaMatch) return false;
                    if (manualSearch && !(s.name||'').toLowerCase().includes(manualSearch.toLowerCase()) && !(s.id||'').toLowerCase().includes(manualSearch.toLowerCase())) return false;
                    return true;
                  })
                  .slice(0, 40)
                  .map(s => {
                    const sel = manualSubs.includes(s.id);
                    return (
                      <div key={s.id} onClick={() => setManualSubs(prev => sel ? prev.filter(id => id !== s.id) : [...prev, s.id])}
                        style={{ display:'flex', alignItems:'center', gap:6, padding:'3px 6px', cursor:'pointer', fontSize:10,
                          background: sel ? 'rgba(0,230,138,0.08)' : 'transparent', borderBottom:'1px solid var(--border-color)',
                          color: sel ? '#00e68a' : 'var(--text-light)' }}>
                        <span style={{ width:14, height:14, borderRadius:3, display:'inline-flex', alignItems:'center', justifyContent:'center',
                          border:`1px solid ${sel ? '#00e68a' : 'var(--border)'}`,
                          background: sel ? '#00e68a' : 'transparent', color:'#000', fontSize:9, fontWeight:700 }}>{sel ? '✓' : ''}</span>
                        <span style={{ fontWeight:500 }}>{s.name}</span>
                        <span style={{ color:'var(--text-dim)', fontSize:8 }}>{s.id}</span>
                        <span style={{ color:'var(--text-dim)', fontSize:8, marginLeft:'auto' }}>{TYPE_LABELS_RU[s.type] || s.type}</span>
                      </div>
                    );
                  })}
                {ALL_SUBSTANCES.filter(s => {
                  if (manualFilter === 'all') return true;
                  const filterL = manualFilter.toLowerCase();
                  const catMatch = (s.categories||[]).some(c => (c||'').toLowerCase().includes(filterL));
                  const typeMatch = (s.type||'').toLowerCase().includes(filterL);
                  const aliasMatch = filterL === 'vitamin' && s.type === 'vitamin';
                  const aaMatch = filterL === 'amino_acid' && ['amino','aminoacid'].includes((s.type||'').toLowerCase());
                  if (!catMatch && !typeMatch && !aliasMatch && !aaMatch) return false;
                  if (manualSearch && !(s.name||'').toLowerCase().includes(manualSearch.toLowerCase()) && !(s.id||'').toLowerCase().includes(manualSearch.toLowerCase())) return false;
                  return true;
                }).length > 40 && <div style={{ fontSize:9, color:'var(--text-dim)', textAlign:'center', padding:6 }}>Показаны 40 из большего числа. Уточните поиск.</div>}
              </div>

              {/* Selected substances with doses */}
              {manualSubs.length > 0 && (
                <div style={{ marginTop:6 }}>
                  <div style={{ fontSize:10, fontWeight:600, marginBottom:4 }}>Выбрано ({manualSubs.length}):</div>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:3 }}>
                    {manualSubs.map(id => {
                      const sub = ALL_SUBSTANCES.find(s => s.id === id);
                      return (
                        <div key={id} style={{ display:'flex', alignItems:'center', gap:4, padding:'3px 6px', borderRadius:6,
                          background:'rgba(0,230,138,0.06)', border:'1px solid rgba(0,230,138,0.2)', fontSize:10 }}>
                          <span>{sub?.name || id}</span>
                          <input type="number" min={0} max={5000} step={50} value={manualDoses[id] || ''}
                            onChange={e => setManualDoses(prev => ({...prev, [id]: parseFloat(e.target.value) || 0 || 0}))}
                            placeholder="мг"
                            style={{ width:50, padding:'2px 4px', borderRadius:4, border:'1px solid var(--border)', background:'var(--bg-secondary)', color:'var(--text-light)', fontSize:9 }} />
                          <span onClick={() => setManualSubs(prev => prev.filter(x => x !== id))}
                            style={{ color:'#ef4444', cursor:'pointer', fontSize:12, fontWeight:700 }}>×</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Presets */}
              <div style={{ marginTop:6 }}>
                <div style={{ fontSize:9, color:'var(--text-dim)', marginBottom:3 }}>Быстрые пресеты:</div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:3 }}>
                  {[
                    { label:'Масса', ids:['AA_NAC','VIT_D3','MIN_MAG_GLYCINATE','MIN_ZINC_PICOLINATE','VIT_Q10','VIT_C','AO_SELENIUM'] },
                    { label:'Сушка', ids:['AA_L_CARNITINE_TARTRATE','AO_EGCG','VIT_B_COMPLEX','VIT_C','AA_NAC','AO_MELATONIN'] },
                    { label:'Печень', ids:['AA_NAC','AO_SILYMARIN','VIT_LIPOIC_R','VIT_CHOLINE'] },
                    { label:'Сердце', ids:['VIT_Q10','MIN_MAG_GLYCINATE','FA_OMEGA3_EPA','AA_L_TAURINE','AO_CURCUMIN','VIT_K2_MK7'] },
                    { label:'Суставы', ids:['MIN_SULFUR_MSM','AA_L_COLLAGEN_AMINO','AO_CURCUMIN','VIT_D3'] },
                    { label:'Мозг', ids:['AA_L_THEANINE','AO_GINKGO_FLAVONES','AD_LIONS_MANE','VIT_B12_METHYL','VIT_D3','FA_OMEGA3_DHA','MIN_MAG_THREONATE'] },
                    { label:'Сон', ids:['AO_MELATONIN','MIN_MAG_GLYCINATE','AA_L_THEANINE','AA_L_GLYCINE','AD_ASHWAGANDHA_KSM','VIT_B6'] },
                    { label:'Иммунитет', ids:['VIT_C','MIN_ZINC_PICOLINATE','VIT_D3','PP_ELDERBERRY_POLYPHENOLS','AO_QUERCETIN','PRE_FOS'] },
                  ].map(p => (
                    <button key={p.label} onClick={() => { setManualSubs(p.ids); setManualResult(null); }}
                      style={{ padding:'3px 8px', borderRadius:4, fontSize:9, cursor:'pointer', border:'none',
                        background:'rgba(139,92,246,0.1)', color:'#8b5cf6', fontWeight:500 }}>{p.label}</button>
                  ))}
                </div>
              </div>

              {/* Build button */}
              <button onClick={() => {
                if (manualSubs.length === 0) return;
                const result = newOptimizeStack(manualSubs);
                setManualResult(result);
              }} style={{
                width:'100%', padding:'10px', borderRadius:6, border:'none', cursor:'pointer', marginTop:8,
                background: 'linear-gradient(135deg, #00e68a, #00c853)', color:'#000', fontWeight:700, fontSize:13,
                boxShadow: '0 2px 8px rgba(0,230,138,0.3)', opacity: manualSubs.length === 0 ? 0.5 : 1,
              }} disabled={manualSubs.length === 0}>
                🧬 Построить стек ({manualSubs.length} веществ)
              </button>

              {/* Results */}
              {manualResult && (
                <div style={{ marginTop:8 }}>
                  {/* System coverage */}
                  <div style={{ fontSize:10, fontWeight:600, marginBottom:4 }}>🛡 Покрытие систем</div>
                  <div style={{ display:'flex', flexDirection:'column', gap:2, marginBottom:6 }}>
                    {Object.entries(manualResult.systemCoverage).map(([sys, cov]) => (
                      <div key={sys} style={{ display:'flex', alignItems:'center', gap:4, fontSize:9 }}>
                        <span style={{ width:70, textTransform:'capitalize' }}>{sys}</span>
                        <div style={{ flex:1, height:6, background:'rgba(255,255,255,0.06)', borderRadius:3, overflow:'hidden' }}>
                          <div style={{ width:`${Math.min(100, cov*100)}%`, height:'100%', borderRadius:3,
                            background: cov > 0.6 ? '#22c55e' : cov > 0.3 ? '#eab308' : '#ef4444' }} />
                        </div>
                        <span style={{ width:30, textAlign:'right', color:'var(--text-dim)' }}>{(cov*100).toFixed(0)}%</span>
                      </div>
                    ))}
                  </div>

                  {/* Per-substance breakdown */}
                  <div style={{ fontSize:10, fontWeight:600, marginBottom:4 }}>📦 Повещественный разбор</div>
                  <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
                    {manualResult.perSubstance.slice(0, 10).map(ps => (
                      <div key={ps.id} style={{ fontSize:9, padding:'3px 6px', background:'rgba(139,92,246,0.04)', borderRadius:4 }}>
                        <div style={{ fontWeight:600 }}>{ps.name}</div>
                        <div style={{ color:'var(--text-dim)', fontSize:8 }}>
                          Системы: {Object.entries(ps.systems).filter(([_,v]) => v > 0).map(([s,v]) => `${s}:${(v*100).toFixed(0)}%`).join(', ') || '—'}
                          <span style={{ marginLeft:6 }}>Категории: {ps.categories.join(', ')}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Synergies */}
                  {manualResult.synergiesInStack.length > 0 && (
                    <div style={{ marginTop:6 }}>
                      <div style={{ fontSize:10, fontWeight:600, color:'#22c55e', marginBottom:3 }}>✅ Синергии ({manualResult.synergiesInStack.length})</div>
                      <div style={{ display:'flex', flexWrap:'wrap', gap:3 }}>
                        {manualResult.synergiesInStack.map((s, i) => (
                          <span key={i} style={{ fontSize:8, padding:'2px 5px', borderRadius:3, background:'rgba(34,197,94,0.08)', color:'#22c55e', border:'1px solid rgba(34,197,94,0.2)' }}>
                            {s.aName} + {s.bName}: {s.mechanism}
                            <span style={{ color:'var(--text-dim)', marginLeft:3 }}>({s.severity})</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Conflicts */}
                  {manualResult.conflictsInStack.length > 0 && (
                    <div style={{ marginTop:6 }}>
                      <div style={{ fontSize:10, fontWeight:600, color:'#ef4444', marginBottom:3 }}>⚠ Конфликты ({manualResult.conflictsInStack.length})</div>
                      <div style={{ display:'flex', flexWrap:'wrap', gap:3 }}>
                        {manualResult.conflictsInStack.map((c, i) => (
                          <span key={i} style={{ fontSize:8, padding:'2px 5px', borderRadius:3, background:'rgba(239,68,68,0.08)', color:'#ef4444', border:'1px solid rgba(239,68,68,0.2)' }}>
                            {c.aName} + {c.bName}: {c.mechanism}
                            <span style={{ color:'var(--text-dim)', marginLeft:3 }}>({c.severity})</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Ranked substances */}
                  <div style={{ marginTop:6 }}>
                    <div style={{ fontSize:10, fontWeight:600, color:'var(--text-dim)', marginBottom:3 }}>📊 Ранжирование (set cover)</div>
                    <div style={{ fontSize:8, color:'var(--text-dim)' }}>
                      {manualResult.rankedSubstances.map((r, i) => (
                        <div key={r.id} style={{ padding:'1px 4px', display:'flex', justifyContent:'space-between' }}>
                          <span>{i+1}. {r.name}</span>
                          <span>+{(r.incrementalCoverage*100).toFixed(0)}% → {(r.totalCoverage*100).toFixed(0)}% [{r.systemsGained.join(', ')}]</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Generate weekly plan from manual stack */}
                  <button onClick={() => {
                    const baseWeights: Record<string, number> = {};
                    const drugLoads: Record<string, number> = {};
                    for (const sys of ['cardio','hepatic','renal','neuro','endocrine','hematologic','reproductive','musculoskeletal']) {
                      baseWeights[sys] = 15;
                      drugLoads[sys] = linked.course.length * 2;
                    }
                    const plan = generateWeeklyPlan(manualSubs, riskCalcMethod, baseWeights, drugLoads, {}, manualResult.systemCoverage);
                    setWeeklyPlan(plan);
                  }} style={{
                    width:'100%', padding:'10px', borderRadius:6, border:'none', cursor:'pointer', marginTop:8,
                    background: 'linear-gradient(135deg, #8b5cf6, #6366f1)', color:'#fff', fontWeight:700, fontSize:13,
                    boxShadow: '0 2px 8px rgba(139,92,246,0.3)',
                  }}>
                    📅 Недельный план для этого стека
                  </button>
                </div>
              )}
            </>}
          </div>

          {supportResult && (
            <>
              <div className="card" style={{ marginBottom: 12, textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 4 }}>Индекс поддержки</div>
                <div style={{ fontSize: 36, fontWeight: 800, color: (supportResult.supportScore ?? 100) > 70 ? '#22c55e' : (supportResult.supportScore ?? 100) > 40 ? '#eab308' : '#ef4444', lineHeight: 1 }}>
                  {Math.round(supportResult.supportScore ?? 0)}%
                </div>
                <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 6, height: 8, marginTop: 8, overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min(100, supportResult.supportScore ?? 0)}%`, height: '100%', background: 'linear-gradient(90deg, #ef4444, #eab308, #22c55e)', borderRadius: 6 }} />
                </div>
              </div>

              <div className="card" style={{ marginBottom: 12 }}>
                <h4 style={{ margin: '0 0 6px 0', fontSize: 12 }}>📊 Риски — до и после поддержки</h4>
                {ALL_RISK_SYSTEMS.slice(0, 8).map(sys => {
                  const before = supportResult?.riskAssessment?.systemBreakdown?.[sys]?.raw ?? 0;
                  const after = supportResult?.riskAssessment?.systemBreakdown?.[sys]?.net ?? 0;
                  const reduction = before > 0 ? Math.round(((before - after) / before) * 100) : 0;
                  return (
                    <div key={sys} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0', borderBottom: '1px solid var(--border-color)', fontSize: 11 }}>
                      <span style={{ fontSize: 13, minWidth: 18 }}>{SYSTEM_INFO_ALL[sys]?.icon || ''}</span>
                      <span style={{ flex: 1, fontWeight: 500 }}>{systemLabels[sys]}</span>
                      <span style={{ fontSize: 10, color: getRiskColor(before), fontWeight: 600, minWidth: 24, textAlign: 'right' }}>{Math.round(before)}%</span>
                      <span style={{ fontSize: 9, color: 'var(--text-dim)' }}>→</span>
                      <span style={{ fontSize: 10, color: getRiskColor(after), fontWeight: 600, minWidth: 24, textAlign: 'right' }}>{Math.round(after)}%</span>
                      {reduction > 0 && <span style={{ fontSize: 9, color: '#22c55e', fontWeight: 600, minWidth: 30, textAlign: 'right' }}>↓{reduction}%</span>}
                    </div>
                  );
                })}
              </div>

              <div className="card" style={{ marginBottom: 12 }}>
                <h4 style={{ margin: '0 0 6px 0', fontSize: 12 }}>🛡 Покрытие систем</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                  {Object.entries(activeSystems).map(([sys, _]) => {
                    const cov = supportResult?.systemSupport?.[sys] ?? 0;
                    const pct = Math.round(cov * 100);
                    return (
                      <div key={sys} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 4px' }}>
                        <span style={{ fontSize: 10, flex: 1 }}>{systemLabels[sys] || sys}</span>
                        <div style={{ width: 35, background: 'rgba(255,255,255,0.08)', borderRadius: 2, height: 5, overflow: 'hidden' }}>
                          <div style={{ width: `${Math.min(100, pct)}%`, height: '100%', background: pct > 60 ? '#22c55e' : pct > 30 ? '#eab308' : '#ef4444', borderRadius: 2 }} />
                        </div>
                        <span style={{ fontSize: 8, color: 'var(--text-dim)', minWidth: 20, textAlign: 'right' }}>{pct}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="card" style={{ marginBottom: 12 }}>
                <h4 style={{ margin: '0 0 6px 0', fontSize: 12 }}>📋 Рекомендованные добавки</h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                  {SUPPORT_LEVELS[supportLevel]?.subs?.slice(0, 15).map(id => (
                    <span key={id} style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: 'rgba(139,92,246,0.1)', color: '#8b5cf6', fontWeight: 500 }}>
                      {id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                    </span>
                  ))}
                </div>
              </div>

              <div className="card" style={{ marginBottom: 12 }}>
                <h4 style={{ margin: '0 0 6px 0', fontSize: 12 }}>💊 Оптимизатор стека</h4>
                <p style={{ fontSize: 10, color: 'var(--text-dim)', margin: '0 0 8px 0' }}>Подбирает защиту органов под ваш курс препаратов</p>
                <OptimizerSection drugs={supportDrugs} />
              </div>

              {/* ===== RISK MODEL SELECTION ===== */}
              <div className="card" style={{ marginBottom: 12 }}>
                <h4 style={{ margin: '0 0 6px 0', fontSize: 12 }}>⚙ Модель расчёта рисков</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                  {(Object.entries(RISK_MODEL_LABELS) as [RiskModelType, string][]).map(([k, v]) => (
                    <button key={k} onClick={() => { setRiskModel(k); if (supportResult) calcSupport(); }} style={{
                      padding: '6px 8px', borderRadius: 6, fontSize: 10, cursor: 'pointer', textAlign: 'left',
                      background: riskModel === k ? 'rgba(0,230,138,0.15)' : 'var(--bg-secondary)',
                      border: riskModel === k ? '1px solid var(--accent)' : '1px solid var(--border)',
                      color: riskModel === k ? '#00e68a' : 'var(--text-dim)', fontWeight: riskModel === k ? 700 : 400,
                    }}>{v}</button>
                  ))}
                </div>
              </div>

              {/* ===== RISK CALCULATION METHOD ===== */}
              <div className="card" style={{ marginBottom: 12 }}>
                <h4 style={{ margin: '0 0 6px 0', fontSize: 12 }}>🧮 Метод расчёта</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                  {RISK_METHODS.map(m => (
                    <button key={m.id} onClick={() => setRiskCalcMethod(m.id)} style={{
                      padding: '8px', borderRadius: 6, fontSize: 11, cursor: 'pointer', textAlign: 'left',
                      background: riskCalcMethod === m.id ? 'rgba(139,92,246,0.15)' : 'var(--bg-secondary)',
                      border: riskCalcMethod === m.id ? '1px solid #8b5cf6' : '1px solid var(--border)',
                      color: riskCalcMethod === m.id ? '#8b5cf6' : 'var(--text-dim)', fontWeight: riskCalcMethod === m.id ? 700 : 400,
                    }}>
                      <span style={{ fontSize: 16 }}>{m.emoji}</span> {m.label}
                      <div style={{ fontSize: 8, color: 'var(--text-dim)', marginTop: 2 }}>{m.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* ===== GENERATE WEEKLY PLAN ===== */}
              <button onClick={calcSupport} style={{
                width: '100%', padding: 14, borderRadius: 8, border: 'none', cursor: 'pointer', marginBottom: 12,
                background: 'linear-gradient(135deg, #8b5cf6, #6366f1)', color: '#fff', fontWeight: 700, fontSize: 15,
                boxShadow: '0 2px 8px rgba(139,92,246,0.3)',
              }}>
                📅 Сгенерировать недельный план
              </button>

              {/* ===== WEEKLY PLAN DISPLAY ===== */}
              {weeklyPlan && (
                <div className="card" style={{ marginBottom: 12 }}>
                  <h4 style={{ margin: '0 0 6px 0', fontSize: 12 }}>
                    📅 Недельный план ({RISK_METHODS.find(m => m.id === weeklyPlan.riskMethod)?.label || weeklyPlan.riskMethod})
                  </h4>
                  <div style={{ display: 'flex', gap: 12, marginBottom: 8, fontSize: 11 }}>
                    <div>
                      <span style={{ color: 'var(--text-dim)' }}>Риск сейчас: </span>
                      <span style={{ fontWeight: 700, color: weeklyPlan.overallRisk.current > 60 ? '#ef4444' : weeklyPlan.overallRisk.current > 30 ? '#f59e0b' : '#22c55e' }}>{weeklyPlan.overallRisk.current}%</span>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-dim)' }}>Прогноз: </span>
                      <span style={{ fontWeight: 700, color: weeklyPlan.overallRisk.projected > 60 ? '#ef4444' : weeklyPlan.overallRisk.projected > 30 ? '#f59e0b' : '#22c55e' }}>{weeklyPlan.overallRisk.projected}%</span>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-dim)' }}>Снижение: </span>
                      <span style={{ fontWeight: 700, color: '#22c55e' }}>↓{weeklyPlan.overallRisk.reduction}%</span>
                    </div>
                  </div>

                  {/* Systems coverage */}
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 10, fontWeight: 600, marginBottom: 3 }}>🛡 Покрытие систем</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {weeklyPlan.coveredSystems.map(cs => (
                        <span key={cs.system} style={{ fontSize: 8, padding: '2px 6px', borderRadius: 4, background: 'rgba(0,230,138,0.08)', border: '1px solid rgba(0,230,138,0.2)', color: '#00e68a' }}>
                          {cs.label}: {cs.coverage}% ({cs.substances.length} преп.)
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Organs coverage */}
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 10, fontWeight: 600, marginBottom: 3 }}>🫀 Покрытие органов</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                      {weeklyPlan.coveredOrgans.slice(0, 10).map(co => (
                        <span key={co.organ} style={{ fontSize: 7, padding: '2px 5px', borderRadius: 3, background: 'rgba(59,130,246,0.08)', color: '#3b82f6' }}>
                          {co.label}: {co.coverage}%
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Mechanisms */}
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 10, fontWeight: 600, marginBottom: 3 }}>🧬 Ключевые механизмы</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                      {weeklyPlan.keyMechanisms.map(km => (
                        <span key={km.name} style={{ fontSize: 8, padding: '2px 5px', borderRadius: 3, background: 'rgba(139,92,246,0.1)', color: '#8b5cf6' }}>
                          {km.label} ({km.substances.length})
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Synergies */}
                  {weeklyPlan.synergyPairs.length > 0 && (
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ fontSize: 10, fontWeight: 600, marginBottom: 3 }}>🔗 Синергии в стеке</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                        {weeklyPlan.synergyPairs.map((pair, i) => (
                          <span key={i} style={{ fontSize: 8, padding: '2px 5px', borderRadius: 3, background: 'rgba(34,197,94,0.1)', color: '#22c55e' }}>
                            {pair.a}+{pair.b} (+{pair.score})
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Daily schedule tabs */}
                  <div style={{ display: 'flex', gap: 3, marginBottom: 8, overflowX: 'auto' }}>
                    {weeklyPlan.schedules.map((day, di) => (
                      <button key={di} onClick={() => {
                        const el = document.getElementById(`ws-day-${di}`);
                        el?.scrollIntoView({ behavior: 'smooth' });
                      }} style={{
                        padding: '4px 8px', borderRadius: 6, fontSize: 9, cursor: 'pointer', whiteSpace: 'nowrap',
                        background: day.riskLevel > 60 ? 'rgba(239,68,68,0.1)' : day.riskLevel > 30 ? 'rgba(245,158,11,0.1)' : 'rgba(34,197,94,0.1)',
                        border: `1px solid ${day.riskLevel > 60 ? 'rgba(239,68,68,0.3)' : day.riskLevel > 30 ? 'rgba(245,158,11,0.3)' : 'rgba(34,197,94,0.3)'}`,
                        color: day.riskLevel > 60 ? '#ef4444' : day.riskLevel > 30 ? '#f59e0b' : '#22c55e',
                      }}>
                        {day.dayLabel} {day.riskLevel}%
                      </button>
                    ))}
                  </div>

                  {/* Daily details */}
                  {weeklyPlan.schedules.map((day, di) => {
                    const timeSlots: { key: string; label: string; color: string; items: SupplementPlanEntry[] }[] = [
                      { key: 'emptyStomach', label: '🌅 Натощак', color: '#f59e0b', items: day.emptyStomach },
                      { key: 'morning', label: '☀️ Утро', color: '#3b82f6', items: day.morning },
                      { key: 'lunch', label: '🍽 Обед', color: '#22c55e', items: day.lunch },
                      { key: 'evening', label: '🌆 Вечер', color: '#8b5cf6', items: day.evening },
                      { key: 'night', label: '🌙 На ночь', color: '#6366f1', items: day.night },
                    ];
                    return (
                      <div key={di} id={`ws-day-${di}`} style={{ marginBottom: 8, background: 'var(--bg-secondary)', borderRadius: 8, padding: 8 }}>
                        <div style={{ fontWeight: 600, fontSize: 11, marginBottom: 4, display: 'flex', justifyContent: 'space-between' }}>
                          <span>{day.dayLabel} — {day.date}</span>
                          <span style={{ color: day.riskLevel > 60 ? '#ef4444' : day.riskLevel > 30 ? '#f59e0b' : '#22c55e', fontSize: 10 }}>Риск: {day.riskLevel}%</span>
                        </div>
                        {timeSlots.map(ts => ts.items.length > 0 && (
                          <div key={ts.key} style={{ marginBottom: 4 }}>
                            <div style={{ fontSize: 9, color: ts.color, fontWeight: 600 }}>{ts.label}</div>
                            {ts.items.map((item, ii) => (
                              <div key={ii} style={{ marginLeft: 8, fontSize: 9, padding: '3px 0', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                <span style={{ fontWeight: 600, color: 'var(--text-light)' }}>{item.name}</span>
                                <span style={{ color: 'var(--text-dim)', marginLeft: 4 }}>{item.doseSuggestion}</span>
                                <div style={{ fontSize: 7, color: 'var(--text-dim)' }}>
                                  {item.mechanismRu} → {item.organLabels.join(', ')} → {item.systemLabels.join(', ')}
                                  {item.synergies.length > 0 && <span style={{ color: '#22c55e', marginLeft: 4 }}>⊕ {item.synergies.map(s => s.partnerName).join(', ')}</span>}
                                </div>
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* ===== LAB ANALYSIS SUMMARY ===== */}
              {labAnalysis && (linked.labs?.length ?? 0) > 0 && (
                <div className="card" style={{ marginBottom: 12 }}>
                  <h4 style={{ margin: '0 0 6px 0', fontSize: 12 }}>🧪 Сводка анализов</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px 8px', fontSize: 10 }}>
                    {labAnalysis.homaIR !== null && (
                      <>
                        <span style={{ color: 'var(--text-dim)' }}>HOMA-IR:</span>
                        <span style={{ fontWeight: 600, color: labAnalysis.homaIR > 2.5 ? '#ef4444' : labAnalysis.homaIR > 1.5 ? '#f59e0b' : '#22c55e' }}>{labAnalysis.homaIR.toFixed(2)} {labAnalysis.homaIR > 2.5 ? '⚠️ Инсулинорезистентность' : labAnalysis.homaIR > 1.5 ? '⚡ Пограничный' : '✅ Норма'}</span>
                      </>
                    )}
                    <span style={{ color: 'var(--text-dim)' }}>Печёночная нагрузка:</span>
                    <span style={{ fontWeight: 600, color: labAnalysis.liverStress > 60 ? '#ef4444' : labAnalysis.liverStress > 30 ? '#f59e0b' : '#22c55e' }}>{labAnalysis.liverStress}%</span>
                    <span style={{ color: 'var(--text-dim)' }}>Кардиориск:</span>
                    <span style={{ fontWeight: 600, color: labAnalysis.cardioRisk > 60 ? '#ef4444' : labAnalysis.cardioRisk > 30 ? '#f59e0b' : '#22c55e' }}>{labAnalysis.cardioRisk}%</span>
                    <span style={{ color: 'var(--text-dim)' }}>Воспаление:</span>
                    <span style={{ fontWeight: 600, color: labAnalysis.inflammation > 6 ? '#ef4444' : labAnalysis.inflammation > 3 ? '#f59e0b' : '#22c55e' }}>{labAnalysis.inflammation.toFixed(1)}</span>
                    <span style={{ color: 'var(--text-dim)' }}>Почечная нагрузка:</span>
                    <span style={{ fontWeight: 600, color: labAnalysis.kidneyStress > 60 ? '#ef4444' : labAnalysis.kidneyStress > 30 ? '#f59e0b' : '#22c55e' }}>{labAnalysis.kidneyStress}%</span>
                    <span style={{ color: 'var(--text-dim)' }}>Гормональный счёт:</span>
                    <span style={{ fontWeight: 600, color: labAnalysis.hormoneScore > 60 ? '#ef4444' : labAnalysis.hormoneScore > 30 ? '#f59e0b' : '#22c55e' }}>{labAnalysis.hormoneScore}%</span>
                  </div>
                  {labAnalysis.interpretations.length > 0 && (
                    <div style={{ marginTop: 6 }}>
                      <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 3 }}>Найдены отклонения ({labAnalysis.interpretations.length}):</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                        {labAnalysis.interpretations.slice(0, 8).map((interp, i) => (
                          <span key={i} style={{ fontSize: 8, padding: '2px 5px', borderRadius: 3,
                            background: interp.status === 'critical_high' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.1)',
                            color: interp.status === 'critical_high' ? '#ef4444' : '#f59e0b',
                          }}>{interp.mechanism.replace(/_/g, ' ')}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ===== MECHANISM REPORT ===== */}
              {mechanismReport && mechanismReport.mechanisms.length > 0 && (
                <div className="card" style={{ marginBottom: 12 }}>
                  <h4 style={{ margin: '0 0 6px 0', fontSize: 12 }}>🧬 Механизмы → Органы → Риски</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {mechanismReport.mechanisms.slice(0, 6).map((m, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10 }}>
                        <span style={{ background: 'rgba(139,92,246,0.1)', color: '#8b5cf6', padding: '1px 5px', borderRadius: 3, fontSize: 9 }}>{m.name.replace(/_/g, ' ')}</span>
                        <span style={{ color: 'var(--text-dim)' }}>→</span>
                        <span style={{ fontSize: 9, color: 'var(--text-light)' }}>{m.organ}</span>
                        <span style={{ color: 'var(--text-dim)' }}>→</span>
                        <span style={{ fontSize: 9, background: 'rgba(0,230,138,0.08)', padding: '1px 4px', borderRadius: 3 }}>{m.system}</span>
                        <div style={{ flex: 1 }} />
                        <span style={{ fontSize: 9, color: m.activation > 80 ? '#ef4444' : '#f59e0b' }}>{m.activation}%</span>
                      </div>
                    ))}
                  </div>
                  {mechanismReport.topRisks.length > 0 && (
                    <div style={{ marginTop: 6 }}>
                      <span style={{ fontSize: 9, color: 'var(--text-dim)' }}>Топ рисков: </span>
                      {mechanismReport.topRisks.map((r, i) => (
                        <span key={i} style={{ fontSize: 8, padding: '2px 4px', borderRadius: 3, marginLeft: 3, background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>{r.system}:{r.risk} {r.percent}%</span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ===== MODEL-BASED RISK (when not standard) ===== */}
              {modelRiskResult && riskModel !== 'standard' && (
                <div className="card" style={{ marginBottom: 12 }}>
                  <h4 style={{ margin: '0 0 6px 0', fontSize: 12 }}>📊 Риски по модели: {RISK_MODEL_LABELS[riskModel].split(' ')[1]}</h4>
                  {Object.entries(modelRiskResult).map(([sys, data]) => (
                    <div key={sys} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '2px 0', borderBottom: '1px solid var(--border-color)', fontSize: 10 }}>
                      <span style={{ flex: 1 }}>{systemLabels[sys] || sys}</span>
                      <span style={{ color: getRiskColor(data.raw), fontWeight: 600 }}>{data.raw}%</span>
                      <span style={{ color: 'var(--text-dim)' }}>→</span>
                      <span style={{ color: getRiskColor(data.net), fontWeight: 600 }}>{data.net}%</span>
                    </div>
                  ))}
                </div>
              )}

              {/* ===== TIMED PLAN ===== */}
              {timedPlan && (
                <div className="card" style={{ marginBottom: 12 }}>
                  <h4 style={{ margin: '0 0 6px 0', fontSize: 12 }}>🕐 План по времени суток</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                    <div style={{ background: 'rgba(245,158,11,0.08)', borderRadius: 6, padding: 6 }}>
                      <div style={{ fontSize: 9, color: '#f59e0b', fontWeight: 600, marginBottom: 3 }}>🌅 Утро (стимуляция)</div>
                      {timedPlan.morning.map((m, i) => <div key={i} style={{ fontSize: 8, color: 'var(--text-light)' }}>• {m.replace(/_/g, ' ')}</div>)}
                    </div>
                    <div style={{ background: 'rgba(59,130,246,0.08)', borderRadius: 6, padding: 6 }}>
                      <div style={{ fontSize: 9, color: '#3b82f6', fontWeight: 600, marginBottom: 3 }}>☀️ День (поддержка)</div>
                      {timedPlan.day.map((m, i) => <div key={i} style={{ fontSize: 8, color: 'var(--text-light)' }}>• {m.replace(/_/g, ' ')}</div>)}
                    </div>
                    <div style={{ background: 'rgba(139,92,246,0.08)', borderRadius: 6, padding: 6 }}>
                      <div style={{ fontSize: 9, color: '#8b5cf6', fontWeight: 600, marginBottom: 3 }}>🌙 Вечер (восстановление)</div>
                      {timedPlan.evening.map((m, i) => <div key={i} style={{ fontSize: 8, color: 'var(--text-light)' }}>• {m.replace(/_/g, ' ')}</div>)}
                    </div>
                  </div>
                </div>
              )}

              <div className="card" style={{ fontSize: 10, color: 'var(--text-dim)', padding: 8 }}>
                <div style={{ marginBottom: 2 }}>
                  <b>Общий риск:</b> до <span style={{ color: getRiskColor(supportResult?.riskBeforeSupport ?? 0), fontWeight: 600 }}>{Math.round(supportResult?.riskBeforeSupport ?? 0)}%</span>
                  {' → '}после <span style={{ color: getRiskColor(supportResult?.riskAfterSupport ?? 0), fontWeight: 600 }}>{Math.round(supportResult?.riskAfterSupport ?? 0)}%</span>
                </div>
                <div>Источники: {linked.course.length} препаратов, {linked.labs.length} анализов, питание, тренировки{linked.profile?.settings?.genetics ? ', генетика' : ''}</div>
                <div style={{ marginTop: 4, color: '#8b5cf6', fontSize: 9 }}>База: {dbStats.totalSubstances} веществ, {dbStats.totalInteractions} взаимодействий, {dbStats.totalRisks} рисков</div>
              </div>

              {dbInteractions && (dbInteractions.synergies.length > 0 || dbInteractions.conflicts.length > 0 || dbInteractions.cautions.length > 0) && (
                <div className="card" style={{ marginBottom: 12 }}>
                  <h4 style={{ margin: '0 0 6px 0', fontSize: 12 }}>⚡ Взаимодействия в вашем стеке</h4>
                  {dbInteractions.conflicts.length > 0 && (
                    <div style={{ marginBottom: 6 }}>
                      <span style={{ fontSize: 10, color: '#ef4444', fontWeight: 600 }}>⚠ Конфликты ({dbInteractions.conflicts.length}):</span>
                      {dbInteractions.conflicts.map((c, i) => (
                        <div key={i} style={{ fontSize: 9, color: '#ef4444', padding: '2px 4px' }}>
                          {c.substanceA} + {c.substanceB}: {c.notes}
                        </div>
                      ))}
                    </div>
                  )}
                  {dbInteractions.cautions.length > 0 && (
                    <div style={{ marginBottom: 6 }}>
                      <span style={{ fontSize: 10, color: '#f59e0b', fontWeight: 600 }}>⚡ Осторожность ({dbInteractions.cautions.length}):</span>
                      {dbInteractions.cautions.map((c, i) => (
                        <div key={i} style={{ fontSize: 9, color: '#f59e0b', padding: '2px 4px' }}>
                          {c.substanceA} + {c.substanceB}: {c.notes}
                        </div>
                      ))}
                    </div>
                  )}
                  {dbInteractions.synergies.length > 0 && (
                    <div>
                      <span style={{ fontSize: 10, color: '#22c55e', fontWeight: 600 }}>✅ Синергии ({dbInteractions.synergies.length}):</span>
                      {dbInteractions.synergies.map((c, i) => (
                        <div key={i} style={{ fontSize: 9, color: '#22c55e', padding: '2px 4px' }}>
                          {c.substanceA} + {c.substanceB}: {c.notes}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {goalRecommendations && goalRecommendations.length > 0 && (
                <div className="card" style={{ marginBottom: 12 }}>
                  <h4 style={{ margin: '0 0 6px 0', fontSize: 12 }}>🎯 Рекомендации для цели ({supportGoal === 'muscle_gain' ? 'масса' : supportGoal === 'fat_loss' ? 'сушка' : supportGoal === 'strength' ? 'сила' : supportGoal === 'endurance' ? 'выносливость' : supportGoal === 'recomp' ? 'рекомпозиция' : 'поддержание'})</h4>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {goalRecommendations.slice(0, 15).map(({ substance, relevanceScore }) => (
                      <div key={substance.id} style={{
                        padding: '4px 10px', borderRadius: 16, fontSize: 9, fontWeight: 600,
                        background: relevanceScore > 2 ? 'rgba(0,230,138,0.1)' : 'rgba(139,92,246,0.1)',
                        border: relevanceScore > 2 ? '1px solid rgba(0,230,138,0.3)' : '1px solid rgba(139,92,246,0.3)',
                        color: relevanceScore > 2 ? '#00e68a' : '#8b5cf6',
                        cursor: 'pointer',
                      }} title={`${substance.name}: ${substance.description}`}>
                        {substance.name}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="card" style={{ marginBottom: 12 }}>
                <h4 style={{ margin: '0 0 6px 0', fontSize: 12 }}>🔍 Поиск по базе ({dbStats.totalSubstances} веществ)</h4>
                <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                  <input
                    value={dbSearchQuery}
                    onChange={e => { setDbSearchQuery(e.target.value); setDbSearchResults(e.target.value.length > 1 ? searchSupport(e.target.value) : []); }}
                    placeholder=""
                    style={{ flex: 1, padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-light)', fontSize: 12 }}
                  />
                </div>
                {dbSearchResults.length > 0 && (
                  <div style={{ maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {dbSearchResults.slice(0, 20).map(sub => (
                      <div key={sub.id} style={{
                        padding: '6px 8px', borderRadius: 6, fontSize: 11, cursor: 'pointer',
                        background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
                      }}>
                        <span style={{ fontWeight: 600 }}>{sub.name}</span>
                        <span style={{ color: 'var(--text-dim)', marginLeft: 6, fontSize: 10 }}>{TYPE_LABELS_RU[sub.type] || sub.type}{(sub.categories||[]).length > 0 ? ' · ' + (sub.categories||[]).slice(0, 2).join(', ') : ''}</span>
                        <div style={{ fontSize: 9, color: 'var(--text-dim)', marginTop: 2 }}>{sub.description}</div>
                      </div>
                    ))}
                  </div>
                )}
                {dbSearchQuery.length > 1 && dbSearchResults.length === 0 && (
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', textAlign: 'center', padding: 8 }}>Ничего не найдено</div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* ===== INTERACTIONS (Apple-style redesign) ===== */}
      {tab === 'interactions' && (
        <div style={{ padding: '0 0 16px' }}>
          {/* Segmented control */}
          <div style={{ display:'flex', marginBottom:14, background:'var(--bg-secondary)', borderRadius:10, padding:2 }}>
            {(['support','pharma'] as const).map(t => (
              <button key={t} onClick={() => setInteractTab(t)} style={{
                flex:1, padding:'8px 0', borderRadius:8, fontSize:12, fontWeight:700,
                cursor:'pointer', transition:'all 0.15s',
                background: interactTab === t ? 'var(--accent)' : 'transparent',
                color: interactTab === t ? '#000' : 'var(--text-dim)',
                border: 'none',
              }}>{t === 'support' ? '💊 Поддержка' : '💉 Фарма'}</button>
            ))}
          </div>

          {interactTab === 'support' ? (
            <div>
              {/* Header */}
              <div style={{ marginBottom:12 }}>
                <div style={{ fontSize:14, fontWeight:700, color:'var(--text-light)', marginBottom:2 }}>⚡ Взаимодействия поддержки</div>
                <div style={{ fontSize:10, color:'var(--text-dim)' }}>Проверка синергий и конфликтов между препаратами поддержки и БАДами</div>
              </div>

              {/* Drug selector cards */}
              <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:12 }}>
                {interactionIds.map((id, idx) => {
                  const selectedName = id ? (allSupport.find(s => s.id === id)?.name || id) : '';
                  return (
                    <div key={idx} style={{ background:'var(--bg-secondary)', borderRadius:12, padding:'10px 12px', border:'1px solid var(--border)' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:6 }}>
                        <span style={{ fontSize:9, color:'var(--text-dim)', fontWeight:600, background:'rgba(255,255,255,0.04)', padding:'2px 6px', borderRadius:4 }}>#{idx + 1}</span>
                        <span style={{ fontSize:10, color:'var(--text-dim)' }}>Выберите препарат</span>
                      </div>
                      <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                        <div style={{ position:'relative', flex:1 }}>
                          <input
                            value={interactionSearchIdx === idx ? interactionSearch : selectedName}
                            placeholder="🔍 Поиск..."
                            onFocus={() => { setInteractionSearchIdx(idx); setInteractionSearch(''); }}
                            onChange={e => { setInteractionSearchIdx(idx); setInteractionSearch(e.target.value); if (!e.target.value) updateInteraction(idx, ''); }}
                            style={{ width:'100%', padding:'9px 10px', borderRadius:8, background:'rgba(0,0,0,0.2)', border:'1px solid var(--border)', color:'var(--text)', fontSize:12, boxSizing:'border-box' }}
                          />
                          {interactionSearch && interactionSearchIdx === idx && (
                            <div style={{ position:'absolute', top:'100%', left:0, right:0, zIndex:10, background:'var(--bg)', border:'1px solid var(--border)', borderRadius:8, maxHeight:160, overflowY:'auto', marginTop:2 }}>
                              {allSupport.filter(s => (s.name||'').toLowerCase().includes(interactionSearch.toLowerCase()) || (s.id||'').toLowerCase().includes(interactionSearch.toLowerCase())).slice(0, 10).map(s => (
                                <div key={s.id} onClick={() => { updateInteraction(idx, s.id); setInteractionSearch(''); }}
                                  style={{ padding:'7px 10px', cursor:'pointer', fontSize:11, borderBottom:'1px solid var(--border)' }}>
                                  <span style={{ fontWeight: id === s.id ? 700 : 400, color: id === s.id ? 'var(--accent)' : 'var(--text)' }}>{s.name}</span>
                                  <span style={{ fontSize:9, color:'var(--text-dim)', marginLeft:6 }}>{s.id}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        {interactionIds.length > 2 && (
                          <button onClick={() => removeInteraction(idx)} style={{ padding:'6px 10px', borderRadius:6, fontSize:10, cursor:'pointer', background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.25)', color:'#ef4444', flexShrink:0 }}>✕</button>
                        )}
                      </div>
                    </div>
                  );
                })}
                <button onClick={addInteraction} style={{
                  padding:'10px', borderRadius:10, fontSize:11, fontWeight:600, cursor:'pointer',
                  background:'rgba(0,230,138,0.06)', border:'1px dashed rgba(0,230,138,0.3)', color:'#00e68a',
                }}>+ Добавить препарат</button>
              </div>

              {/* Empty state */}
              {validInteractionIds.length < 2 && (
                <div style={{ textAlign:'center', padding:'32px 16px', background:'var(--bg-secondary)', borderRadius:12, border:'1px solid var(--border)' }}>
                  <div style={{ fontSize:24, marginBottom:6 }}>⚡</div>
                  <div style={{ fontSize:11, color:'var(--text-dim)' }}>Выберите минимум 2 препарата для проверки</div>
                </div>
              )}

              {/* No conflicts */}
              {validInteractionIds.length >= 2 && !hasSupportInteractions && (
                <div style={{ textAlign:'center', padding:'14px', borderRadius:10, background:'rgba(0,230,138,0.06)', border:'1px solid rgba(0,230,138,0.2)' }}>
                  <span style={{ fontSize:11, color:'#4caf50', fontWeight:600 }}>✓ Критических взаимодействий не обнаружено</span>
                </div>
              )}

              {/* Results */}
              {hasSupportInteractions && (
                <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                  {[
                    { list: supportSynergiesList, label: '⊕ Синергия — положительное взаимодействие', color: '#22c55e' },
                    { list: supportConflicts, label: '⊖ Конфликт — отрицательное взаимодействие', color: '#ef4444' },
                    { list: supportCautions, label: '⚡ Осторожность — потенциальный риск', color: '#f59e0b' },
                  ].filter(s => s.list.length > 0).map(section => (
                    <div key={section.label} style={{ background:'var(--bg-secondary)', borderRadius:12, padding:'10px 12px', border:'1px solid var(--border)' }}>
                      <div style={{ fontSize:11, fontWeight:700, color:section.color, marginBottom:6 }}>{section.label} ({section.list.length})</div>
                      {section.list.map(i => {
                        const sevColor = i.severity === 'HIGH' ? '#ef4444' : i.severity === 'MEDIUM' ? '#f59e0b' : '#22c55e';
                        const aName = resolveSubName(i.substanceA) || i.substanceA;
                        const bName = resolveSubName(i.substanceB) || i.substanceB;
                        const effDesc = showEffect(i);
                        return (
                          <div key={i.id} style={{ padding:'5px 0', borderBottom:'1px solid var(--border)' }}>
                            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                              <span style={{ color:section.color, fontWeight:700, fontSize:10 }}>{aName} + {bName}</span>
                              <div style={{ display:'flex', gap:3 }}>
                                <span style={{ fontSize:8, padding:'1px 5px', borderRadius:3, background:section.color+'22', color:section.color, fontWeight:600 }}>{i.type === 'synergy' ? '⊕' : i.type === 'conflict' ? '⊖' : '⚡'}</span>
                                {i.severity && <span style={{ fontSize:8, padding:'1px 5px', borderRadius:3, background:sevColor+'22', color:sevColor, fontWeight:600 }}>{i.severity==='HIGH'?'Высокий':i.severity==='MEDIUM'?'Средний':'Низкий'}</span>}
                              </div>
                            </div>
                            {effDesc && <div style={{ fontSize:10, color:'rgba(255,255,255,0.85)', lineHeight:1.3, marginTop:2 }}>{effDesc}</div>}
                            {i.mechanisms && i.mechanisms.length > 0 && (
                              <div style={{ display:'flex', flexWrap:'wrap', gap:2, marginTop:2 }}>
                                {i.mechanisms.map((m: string, mi: number) => (
                                  <span key={mi} style={{ fontSize:7, padding:'1px 5px', borderRadius:3, background:'rgba(139,92,246,0.12)', color:'#a78bfa', border:'1px solid rgba(139,92,246,0.15)' }}>{m}</span>
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
            /* ─── PHARMA INTERACTIONS ─── */
            <div>
              <div style={{ marginBottom:12 }}>
                <div style={{ fontSize:14, fontWeight:700, color:'var(--text-light)', marginBottom:2 }}>💉 Взаимодействия фармы</div>
                <div style={{ fontSize:10, color:'var(--text-dim)' }}>Проверка синергий и конфликтов между фармакологическими препаратами</div>
              </div>

              <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:12 }}>
                {(() => {
                  const PHARMA_CORE_FILTER = new Set(['testosterone','trenbolone','nandrolone','boldenone','primobolan','oral_17aa','sarm','drostanolone','dht_derivative','igf1','mgf','insulin','pct_serm','pct_aromatase','pct_dopamine','pct_gonadotropin']);
                  const pharmaAll = Object.values(PHARMA_DB).filter((s): s is (typeof PHARMA_DB)[string] => !!s?.name && PHARMA_CORE_FILTER.has(s.class));
                  const pharmaFiltered = pharmaInteractSearch ? pharmaAll.filter(s => (s.name||'').toLowerCase().includes(pharmaInteractSearch.toLowerCase())) : pharmaAll;
                  const pharmaValid = pharmaInteractIds.filter(Boolean);
                  return (
                    <>
                      {pharmaInteractIds.map((id, idx) => {
                        const selectedName = id ? (PHARMA_DB[id]?.name || '') : '';
                        return (
                          <div key={idx} style={{ background:'var(--bg-secondary)', borderRadius:12, padding:'10px 12px', border:'1px solid var(--border)' }}>
                            <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:6 }}>
                              <span style={{ fontSize:9, color:'var(--text-dim)', fontWeight:600, background:'rgba(255,255,255,0.04)', padding:'2px 6px', borderRadius:4 }}>#{idx + 1}</span>
                              <span style={{ fontSize:10, color:'var(--text-dim)' }}>Выберите препарат</span>
                            </div>
                            <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                              <div style={{ flex:1, position:'relative' }}>
                                <input
                                  value={id ? selectedName : pharmaInteractSearch}
                                  onChange={e => { setPharmaInteractSearch(e.target.value); if (!e.target.value) { const next = [...pharmaInteractIds]; next[idx] = ''; setPharmaInteractIds(next); }}}
                                  placeholder="🔍 Поиск..." style={{ width:'100%', padding:'9px 10px', borderRadius:8, background:'rgba(0,0,0,0.2)', border:'1px solid var(--border)', color:'var(--text)', fontSize:12, boxSizing:'border-box' }} />
                                {!id && pharmaInteractSearch && (
                                  <div style={{ position:'absolute', zIndex:10, background:'var(--bg)', border:'1px solid var(--border)', borderRadius:8, maxHeight:140, overflowY:'auto', marginTop:2, width:'calc(100% - 2px)' }}>
                                    {pharmaFiltered.slice(0, 10).map(s => (
                                      <div key={s.id} onClick={() => { const next = [...pharmaInteractIds]; next[idx] = s.id; setPharmaInteractIds(next); setPharmaInteractSearch(''); }} style={{ padding:'7px 10px', cursor:'pointer', fontSize:11, borderBottom:'1px solid var(--border)' }}>
                                        <span style={{ fontWeight:600 }}>{s.name}</span>
                                        <span style={{ marginLeft:6, color:'var(--text-dim)', fontSize:9 }}>{s.class}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                              {pharmaInteractIds.length > 2 && (
                                <button onClick={() => setPharmaInteractIds(pharmaInteractIds.filter((_, ix) => ix !== idx))} style={{ padding:'6px 10px', borderRadius:6, fontSize:10, cursor:'pointer', background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.25)', color:'#ef4444', flexShrink:0 }}>✕</button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                      <button onClick={() => setPharmaInteractIds([...pharmaInteractIds, ''])} style={{
                        padding:'10px', borderRadius:10, fontSize:11, fontWeight:600, cursor:'pointer',
                        background:'rgba(0,230,138,0.06)', border:'1px dashed rgba(0,230,138,0.3)', color:'#00e68a',
                      }}>+ Добавить препарат</button>
                      {pharmaValid.length >= 2 && checkDrugInteractions(pharmaValid.map((id, i) => ({ id: `${id}-${i}`, substanceId: id, doseValue: 300, doseUnit: 'mg/wk', frequency: '2x/week', startWeek: 0, endWeek: 12 }))).length === 0 && (
                        <div style={{ padding:'14px', borderRadius:10, background:'rgba(0,230,138,0.06)', border:'1px solid rgba(0,230,138,0.2)', textAlign:'center' }}>
                          <span style={{ fontSize:11, color:'#4caf50', fontWeight:600 }}>✓ Критических взаимодействий не обнаружено</span>
                        </div>
                      )}
                      {pharmaValid.length >= 2 && (
                        <div>
                          {checkDrugInteractions(pharmaValid.map((id, i) => ({ id: `${id}-${i}`, substanceId: id, doseValue: 300, doseUnit: 'mg/wk', frequency: '2x/week', startWeek: 0, endWeek: 12 }))).map((alert, i) => {
                            const c = alert.type === 'critical' ? '#ff1744' : alert.type === 'warning' ? '#ff9100' : '#2979ff';
                            const icon = alert.type === 'critical' ? '🚫' : alert.type === 'warning' ? '⚠️' : 'ℹ️';
                            return (
                              <div key={i} style={{ background:'var(--bg-secondary)', borderRadius:12, padding:'12px', marginBottom:6, borderLeft:`3px solid ${c}`, border:'1px solid var(--border)' }}>
                                <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:4 }}>
                                  <span style={{ fontSize:14 }}>{icon}</span>
                                  <span style={{ fontWeight:700, fontSize:10, color:c }}>
                                    {alert.type === 'critical' ? 'КРИТИЧЕСКОЕ' : alert.type === 'warning' ? 'ПРЕДУПРЕЖДЕНИЕ' : 'ИНФО'}
                                  </span>
                                </div>
                                <div style={{ fontSize:11, fontWeight:600, color:'var(--text-light)', marginBottom:4 }}>{alert.drugs.join(' + ')}</div>
                                <div style={{ fontSize:10, color:'var(--text-dim)', lineHeight:1.4, marginBottom:2 }}>
                                  <b>Механизм:</b> {alert.mechanism}
                                </div>
                                <div style={{ fontSize:10, color:'var(--text-dim)', lineHeight:1.4 }}>
                                  <b>Рекомендация:</b> {alert.recommendation}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===== STACKS (ALL_STACKS — 30+ готовых стеков) ===== */}
      {tab === 'stacks' && (
        <div style={{ padding: '0 0 16px' }}>
          <div style={{ marginBottom:10 }}>
            <div style={{ fontSize:15, fontWeight:800, color:'var(--accent)', marginBottom:2 }}>📦 Готовые стеки</div>
            <div style={{ fontSize:10, color:'var(--text-dim)' }}>
              {ALL_STACKS.length} оптимизированных комбинаций добавок с рассчитанной синергией
            </div>
          </div>
          <input value={stackSearch} onChange={e => setStackSearch(e.target.value)} placeholder="🔍 Поиск по эффекту или веществу..." style={{ width:'100%', padding:'9px 10px', borderRadius:10, border:'1px solid var(--border)', background:'var(--bg-secondary)', color:'var(--text)', fontSize:12, boxSizing:'border-box', marginBottom:10 }} />
          <div style={{ display:'flex', flexDirection:'column', gap:6, maxHeight:'62vh', overflowY:'auto', paddingRight:2 }}>
            {(stackSearch ? [{ key:'search', label:`Результаты поиска (${filteredStacks.length})`, stacks:filteredStacks }] : groupedStacks).map(group => (
              <div key={group.key} style={{ background:'var(--bg-secondary)', borderRadius:12, overflow:'hidden', border:'1px solid var(--border)' }}>
                <div onClick={() => setExpandedCategories(prev => ({ ...prev, ['stack_'+group.key]: !(prev['stack_'+group.key] ?? true) }))} style={{ display:'flex', alignItems:'center', gap:6, padding:'9px 12px', cursor:'pointer', userSelect:'none' }}>
                  <span style={{ fontSize:14 }}>📋</span>
                  <div style={{ flex:1, fontSize:11, fontWeight:700, color:'var(--text-light)' }}>{group.label}</div>
                  <span style={{ fontSize:10, color:'var(--text-dim)', fontWeight:600, marginRight:4 }}>{group.stacks.length}</span>
                  <span style={{ fontSize:10, color:'var(--text-dim)', transform: expandedCategories['stack_'+group.key] !== false ? 'rotate(180deg)' : 'none', transition:'transform 0.2s' }}>▼</span>
                </div>
                {expandedCategories['stack_'+group.key] !== false && (
                  <div style={{ borderTop:'1px solid var(--border)' }}>
                    {group.stacks.map(stack => {
                      const synergyColor = stack.synergyScore > 20 ? '#22c55e' : stack.synergyScore > 12 ? '#eab308' : '#f59e0b';
                      return (
                        <div key={stack.id} style={{ padding:'8px 12px 10px', borderBottom:'1px solid var(--border)', cursor:'pointer' }}
                          onClick={() => setExpandedMed(expandedMed === stack.id ? null : stack.id)}>
                          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:4 }}>
                            <div style={{ display:'flex', flexWrap:'wrap', gap:3, flex:1 }}>
                              {stack.effects.map(e => (
                                <span key={e} style={{ fontSize:8, padding:'2px 6px', borderRadius:4, background:'rgba(0,230,138,0.08)', color:'#00e68a', fontWeight:500 }}>
                                  {EFFECT_LABELS_ru[e] || e}
                                </span>
                              ))}
                            </div>
                            <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                              <span style={{ fontSize:13, fontWeight:800, color:synergyColor }}>{stack.synergyScore.toFixed(1)}</span>
                              <span style={{ fontSize:8, color:'var(--text-dim)' }}>syn</span>
                            </div>
                          </div>
                          <div style={{ display:'flex', flexWrap:'wrap', gap:3, marginBottom:expandedMed === stack.id ? 6 : 0 }}>
                            {stack.substances.map(sid => (
                              <span key={sid} style={{ fontSize:9, padding:'2px 7px', borderRadius:8, background:'rgba(139,92,246,0.08)', border:'1px solid rgba(139,92,246,0.15)', color:'#a78bfa', fontWeight:600 }}>
                                {getStackSubLabel(sid)}<button onClick={(e) => { e.stopPropagation(); setStackBuilder(prev => prev.includes(sid) ? prev : [...prev, sid]); }} style={{ padding:'3px 8px', borderRadius:4, fontSize:9, cursor:'pointer', background:'rgba(0,230,138,0.1)', border:'none', color:'#00e68a', fontWeight:700, marginLeft:2, minWidth:22 }} title="Добавить в стек">+</button>
                              </span>
                            ))}
                          </div>
                          <div style={{ fontSize:8, color:'var(--text-dim)' }}>
                            {stack.substances.length} веществ
                          </div>
                          {expandedMed === stack.id && safeRender('stack2_'+stack.id, () =>
                            <div style={{ marginTop:6, padding:'6px 8px', background:'rgba(0,0,0,0.15)', borderRadius:8 }}>
                              {/* Positive effects */}
                              <div style={{ marginBottom:4 }}>
                                <div style={{ fontSize:9, fontWeight:700, color:'#22c55e', marginBottom:3 }}>⊕ Положительные эффекты</div>
                                <div style={{ display:'flex', flexWrap:'wrap', gap:2 }}>
                                  {stack.effects.map(e => (
                                    <span key={e} style={{ fontSize:8, padding:'2px 6px', borderRadius:4, background:'rgba(34,197,94,0.1)', color:'#4ade80', fontWeight:600 }}>
                                      {EFFECT_LABELS_ru[e] || e}
                                    </span>
                                  ))}
                                </div>
                              </div>
                              {/* Substance breakdown */}
                              <div style={{ marginBottom:4 }}>
                                <div style={{ fontSize:9, fontWeight:700, color:'var(--text-light)', marginBottom:2 }}>🧬 Компоненты</div>
                                {stack.substances.map(sid => {
                                  const subInfo = ALL_SUBSTANCES.find(s => s.id === sid);
                                  const cat = subInfo?.categories?.[0];
                                  return (
                                    <div key={sid} style={{ fontSize:8, color:'var(--text-dim)', padding:'2px 0', borderBottom:'1px solid rgba(255,255,255,0.04)', lineHeight:1.4 }}>
                                      <b style={{ color:'#a78bfa' }}>{getStackSubLabel(sid)}</b>
                                      {cat && <span style={{ marginLeft:4, opacity:0.6 }}>· {getCategoryInfo(cat).label}</span>}
                                      {subInfo?.description && <div style={{ opacity:0.7 }}>{subInfo.description.slice(0, 100)}</div>}
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
                                    <div style={{ fontSize:9, fontWeight:700, color:'#ef4444', marginBottom:2 }}>⚠ Возможные конфликты</div>
                                    {pairs.map((p, i) => <div key={i} style={{ fontSize:8, color:'#f87171', padding:'1px 0', lineHeight:1.3 }}>{p}</div>)}
                                  </div>
                                ) : (
                                  <div style={{ fontSize:8, color:'#4ade80', opacity:0.6 }}>✓ Конфликтов между компонентами не обнаружено</div>
                                );
                              })()}
                              {/* Stack mechanisms & synergies */}
                              {(()=>{
                                const d=stackDetailMap.get(stack.id);
                                if(!d)return null;
                                return <>
                                  {d.mechs.length>0&&<div style={{marginTop:4}}><div style={{fontSize:8,fontWeight:600,color:'var(--text-dim)',marginBottom:1}}>⚙️ Механизмы действия:</div><div style={{display:'flex',flexWrap:'wrap',gap:2}}>{d.mechs.map((m,i)=><span key={i} style={{fontSize:7,padding:'1px 5px',borderRadius:3,background:'rgba(139,92,246,0.08)',color:'#a78bfa',border:'1px solid rgba(139,92,246,0.12)'}}>{MECH_TRANSLATIONS_RU[m as string] || m}</span>)}</div></div>}
                                  {d.synergies.length>0&&<div style={{marginTop:4}}><div style={{fontSize:8,fontWeight:600,color:'#22c55e',marginBottom:1}}>⊕ Синергии в стеке ({d.synergies.length}):</div>{d.synergies.map((s,i)=><div key={i} style={{fontSize:8,color:'var(--text-dim)',padding:'1px 0',lineHeight:1.3}}><b style={{color:'#4ade80'}}>{s.aName}+{s.bName}</b>: {s.effect}{s.notes?`: ${s.notes.slice(0,80)}`:''}{s.mechs.length>0&&<span style={{marginLeft:2,opacity:.5}}>[{s.mechs.map((mx: string) => MECH_TRANSLATIONS_RU[mx] || mx).join(', ')}]</span>}</div>)}</div>}
                                </>;
                              })()}
                              <div style={{ fontSize:8, color:'var(--text-dim)', marginTop:3 }}>Оценка синергии: <b style={{ color: synergyColor }}>{(stack.synergyScore||0).toFixed(1)}</b> · {(stack.substances||[]).length} веществ</div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
            {stackSearch && filteredStacks.length === 0 && (
              <div style={{ padding:30, textAlign:'center', color:'var(--text-dim)', fontSize:11 }}>
                Ничего не найдено по запросу "{stackSearch}"
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== PEPTIDES ===== */}
      {tab === 'peptides' && (
        <div>
          <div className="card" style={{ marginBottom: 12 }}>
            <h3 style={{ margin: '0 0 4px 0', fontSize: 14, color: 'var(--accent)' }}>🧬 Пептидный калькулятор</h3>
            <p style={{ fontSize: 11, color: 'var(--text-dim)', margin: 0 }}>Расчёт разведения, дозировки, PK‑модели и рисков для пептидов и факторов роста</p>
          </div>

          {/* Unified peptide + growth factor selector */}
          <div className="card" style={{ marginBottom: 8 }}>
            <div style={{ display:'flex', flexWrap:'wrap', gap:4, maxHeight:160, overflowY:'auto' }}>
              {PEPTIDE_LIST.map(p => {
                const sel = peptideId === p.id;
                return <div key={p.id} onClick={() => { setPeptideId(p.id); const pd = PEPTIDE_DB[p.id]; if (pd) { setPepAmount(pd.amountMg); setPepRoute(pd.routes[0]); setPepResult(null); setGrowthId(null); }}} style={{
                  padding:'6px 10px', borderRadius:8, cursor:'pointer', fontSize:10,
                  background: sel ? 'rgba(0,230,138,0.15)' : 'var(--bg-secondary)',
                  border: sel ? '1.5px solid #00e68a' : '1px solid var(--border)',
                  color: sel ? '#00e68a' : 'var(--text)', fontWeight: sel ? 700 : 400,
                }}>{p.shortName}</div>;
              })}
              {(() => {
                const GROWTH_CLASSES = new Set(['peptide_ghrh','peptide_ghrp','igf1','mgf','insulin','peptide_gnrh','peptide_fat_loss','peptide_other','peptide_regenerative','peptide_immune','peptide_nootropic','pct_gonadotropin']);
                const inPeptideDb = new Set(PEPTIDE_LIST.map(p => PEPTIDE_DB[p.id]?.name.toLowerCase()));
                return Object.values(PHARMA_DB).filter(s => !!s?.name && GROWTH_CLASSES.has(s.class) && s.id !== 'mk677' && !inPeptideDb.has(s.name.toLowerCase())).map(s => {
                  const sel = growthId === s.id;
                  return <div key={s.id} onClick={() => { setGrowthId(s.id); setPepResult(null); }} style={{
                    padding:'6px 10px', borderRadius:8, cursor:'pointer', fontSize:10,
                    background: sel ? 'rgba(139,92,246,0.15)' : 'var(--bg-secondary)',
                    border: sel ? '1.5px solid #8b5cf6' : '1px solid var(--border)',
                    color: sel ? '#8b5cf6' : 'var(--text)', fontWeight: sel ? 700 : 400,
                  }}>{s.name}</div>;
                });
              })()}
            </div>
            {PEPTIDE_DB[peptideId] && PEPTIDE_DB[peptideId].effects && (
              <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginTop:6 }}>
                {PEPTIDE_DB[peptideId].effects.map(e => (
                  <span key={e} style={{ fontSize:9, padding:'2px 6px', borderRadius:4, background:'rgba(0,230,138,0.1)', color:'#00e68a' }}>{e}</span>
                ))}
              </div>
            )}
            {growthId && PHARMA_DB[growthId] && (
              <div style={{ marginTop:6, padding:'8px 10px', background:'rgba(139,92,246,0.06)', borderRadius:8, fontSize:10, color:'var(--text-dim)', lineHeight:1.6 }}>
                <b>{PHARMA_DB[growthId].name}</b> — T½ {(PHARMA_DB[growthId].pk?.halfLifeHours ?? 0).toFixed(0)}ч, био {(PHARMA_DB[growthId].pk?.bioavailability ?? 0) * 100}%
              </div>
            )}
          </div>

          {/* Dilution calculator */}
          <div className="card" style={{ marginBottom: 8 }}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: 12 }}>💧 Разведение</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              <div>
                <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Во флаконе</label>
                <div style={{ display: 'flex', gap: 4 }}>
                  <input type="number" value={pepAmount} onChange={e => setPepAmount(parseFloat(e.target.value) || 0)} style={{ width: '60%', padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-light)', fontSize: 12 }} />
                  <select value={pepAmountUnit || ''} onChange={e => setPepAmountUnit(e.target.value as 'mg' | 'mcg')} style={{ flex: 1, padding: '6px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-light)', fontSize: 11 }}>
                    <option value="mg">мг</option><option value="mcg">мкг</option>
                  </select>
                </div>
              </div>
              <div>
                <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Растворитель (мл)</label>
                <input type="number" step="0.1" value={pepDilution} onChange={e => setPepDilution(parseFloat(e.target.value) || 0)} style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-light)', fontSize: 12, boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Доза</label>
                <div style={{ display: 'flex', gap: 4 }}>
                  <input type="number" value={pepDose} onChange={e => setPepDose(parseFloat(e.target.value) || 0)} style={{ width: '60%', padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-light)', fontSize: 12 }} />
                  <select value={pepDoseUnit || ''} onChange={e => setPepDoseUnit(e.target.value as 'mg' | 'mcg')} style={{ flex: 1, padding: '6px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-light)', fontSize: 11 }}>
                    <option value="mcg">мкг</option><option value="mg">мг</option>
                  </select>
                </div>
              </div>
              <div>
                <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Шприц</label>
                <select value={pepSyringe} onChange={e => setPepSyringe(e.target.value as keyof typeof SYRINGE_TYPES)} style={{ width: '100%', padding: '6px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-light)', fontSize: 11 }}>
                  {Object.entries(SYRINGE_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Способ введения</label>
                <select value={pepRoute} onChange={e => setPepRoute(e.target.value)} style={{ width: '100%', padding: '6px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-light)', fontSize: 11 }}>
                  {Object.entries(ROUTE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Course parameters */}
          <div className="card" style={{ marginBottom: 8 }}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: 12 }}>📅 Параметры курса</h4>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
              {WEEK.map(d => (
                <button key={d} onClick={() => setPepSchedule(pepSchedule.includes(d) ? pepSchedule.filter(x => x !== d) : [...pepSchedule, d].sort((a, b) => WEEK.indexOf(a) - WEEK.indexOf(b)))} style={{
                  padding: '5px 10px', borderRadius: 16, fontSize: 10, cursor: 'pointer',
                  background: pepSchedule.includes(d) ? 'rgba(0,230,138,0.2)' : 'var(--bg-secondary)',
                  border: pepSchedule.includes(d) ? '1px solid var(--accent)' : '1px solid var(--border)',
                  color: pepSchedule.includes(d) ? '#00e68a' : 'var(--text-dim)', fontWeight: pepSchedule.includes(d) ? 700 : 400,
                }}>{d === 'Mon' ? 'Пн' : d === 'Tue' ? 'Вт' : d === 'Wed' ? 'Ср' : d === 'Thu' ? 'Чт' : d === 'Fri' ? 'Пт' : d === 'Sat' ? 'Сб' : 'Вс'}</button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Длительность (дни):</label>
              <input type="number" value={pepTotalDays} onChange={e => setPepTotalDays(parseFloat(e.target.value) || 0)} style={{ width: 60, padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-light)', fontSize: 12 }} />
              <span style={{ fontSize: 9, color: 'var(--text-dim)' }}>Инъекций: {pepSchedule.length}/нед</span>
            </div>
          </div>

          {/* Calculate button */}
          <button onClick={() => {
            const pep = PEPTIDE_DB[peptideId];
            if (!pep) return;
            const bio = pep.bioavailability[pepRoute] || { min: 80, max: 100, avg: 90 };
            const dilInput: DilutionInput = {
              amountValue: pepAmount, amountUnit: pepAmountUnit,
              dilutionVolumeMl: pepDilution, doseValue: pepDose, doseUnit: pepDoseUnit,
              syringeType: pepSyringe as DilutionInput['syringeType'],
            };
            const dilution = computeDilution(dilInput);
            const effective = computeEffectiveDose(dilution.doseMcg, bio);
            const pk = computePK({
              doseMcg: dilution.doseMcg, bioAvg: bio.avg,
              tHalfHours: pep.tHalfHours, scheduleDays: pepSchedule, totalDays: pepTotalDays,
            });
            setPepResult({ dilution, effective, pk });
          }} style={{
            width: '100%', padding: '14px', borderRadius: 8, border: 'none', cursor: 'pointer', marginBottom: 12,
            background: 'linear-gradient(135deg, #8b5cf6, #6366f1)', color: '#fff', fontWeight: 700, fontSize: 15,
            boxShadow: '0 2px 8px rgba(139,92,246,0.3)',
          }}>
            🧬 Рассчитать
          </button>

          {/* Results */}
          {pepResult && (
            <>
              {/* Dilution results */}
              <div className="card" style={{ marginBottom: 8 }}>
                <h4 style={{ margin: '0 0 8px 0', fontSize: 12 }}>📊 Результаты разведения</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px', fontSize: 11 }}>
                  <span style={{ color: 'var(--text-dim)' }}>Концентрация:</span><span style={{ fontWeight: 600 }}>{pepResult.dilution.concentrationMcgPerMl.toFixed(1)} мкг/мл</span>
                  <span style={{ color: 'var(--text-dim)' }}>Объём дозы:</span><span style={{ fontWeight: 600 }}>{pepResult.dilution.doseVolumeMl.toFixed(3)} мл</span>
                  <span style={{ color: 'var(--text-dim)' }}>Деления шприца:</span><span style={{ fontWeight: 600, color: pepResult.dilution.syringeUnits > SYRINGE_TYPES[pepSyringe].maxUnits ? '#ef4444' : 'var(--text-light)' }}>{pepResult.dilution.syringeUnitsDisplay}</span>
                  <span style={{ color: 'var(--text-dim)' }}>Доз во флаконе:</span><span style={{ fontWeight: 600 }}>{pepResult.dilution.dosesPerVial.toFixed(1)}</span>
                </div>
              </div>

              {/* Bioavailability */}
              <div className="card" style={{ marginBottom: 8 }}>
                <h4 style={{ margin: '0 0 6px 0', fontSize: 12 }}>💉 Биодоступность ({ROUTE_LABELS[pepRoute]})</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4, fontSize: 11 }}>
                  <div style={{ textAlign: 'center', background: 'var(--bg-secondary)', borderRadius: 6, padding: 6 }}>
                    <div style={{ color: 'var(--text-dim)', fontSize: 9 }}>Мин</div>
                    <div style={{ fontWeight: 600 }}>{pepResult.effective.effectiveMinMcg.toFixed(0)} мкг</div>
                  </div>
                  <div style={{ textAlign: 'center', background: 'rgba(0,230,138,0.1)', borderRadius: 6, padding: 6 }}>
                    <div style={{ color: 'var(--text-dim)', fontSize: 9 }}>Средняя</div>
                    <div style={{ fontWeight: 700, color: '#00e68a' }}>{pepResult.effective.effectiveAvgMcg.toFixed(0)} мкг</div>
                  </div>
                  <div style={{ textAlign: 'center', background: 'var(--bg-secondary)', borderRadius: 6, padding: 6 }}>
                    <div style={{ color: 'var(--text-dim)', fontSize: 9 }}>Макс</div>
                    <div style={{ fontWeight: 600 }}>{pepResult.effective.effectiveMaxMcg.toFixed(0)} мкг</div>
                  </div>
                </div>
              </div>

              {/* PK Results */}
              <div className="card" style={{ marginBottom: 8 }}>
                <h4 style={{ margin: '0 0 6px 0', fontSize: 12 }}>📈 PK‑модель</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 12px', fontSize: 10, marginBottom: 8 }}>
                  <span style={{ color: 'var(--text-dim)' }}>Макс. концентрация:</span><span style={{ fontWeight: 600 }}>{pepResult.pk.maxConcentration.toFixed(1)}</span>
                  <span style={{ color: 'var(--text-dim)' }}>Средняя концентрация:</span><span style={{ fontWeight: 600 }}>{pepResult.pk.avgConcentration.toFixed(1)}</span>
                  <span style={{ color: 'var(--text-dim)' }}>Steady-state (день):</span><span style={{ fontWeight: 600 }}>~{pepResult.pk.steadyStateDay}</span>
                  <span style={{ color: 'var(--text-dim)' }}>t<sub>1/2</sub> (дни):</span><span style={{ fontWeight: 600 }}>{pepResult.pk.halfLifeDays.toFixed(2)}</span>
                </div>
                <div style={{ maxHeight: 160, overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: 6 }}>
                  <table style={{ width: '100%', fontSize: 9, borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: 'var(--bg-secondary)', position: 'sticky', top: 0 }}>
                        <th style={{ padding: '2px 4px', textAlign: 'left' }}>День</th>
                        <th style={{ padding: '2px 4px' }}>Инъекция</th>
                        <th style={{ padding: '2px 4px', textAlign: 'right' }}>Конц.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pepResult.pk.days.map(d => (
                        <tr key={d.day} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: d.inject ? 'rgba(139,92,246,0.05)' : 'transparent' }}>
                          <td style={{ padding: '2px 4px' }}>{d.day} ({d.weekday === 'Mon' ? 'Пн' : d.weekday === 'Tue' ? 'Вт' : d.weekday === 'Wed' ? 'Ср' : d.weekday === 'Thu' ? 'Чт' : d.weekday === 'Fri' ? 'Пт' : d.weekday === 'Sat' ? 'Сб' : 'Вс'})</td>
                          <td style={{ padding: '2px 4px', textAlign: 'center' }}>{d.inject ? '💉' : ''}</td>
                          <td style={{ padding: '2px 4px', textAlign: 'right', fontFamily: 'monospace', color: d.concentration > pepResult.pk.avgConcentration * 1.5 ? '#22c55e' : 'var(--text-light)' }}>{d.concentration.toFixed(0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Risks */}
              {PEPTIDE_DB[peptideId] && (
                <div className="card" style={{ marginBottom: 8 }}>
                  <h4 style={{ margin: '0 0 6px 0', fontSize: 12 }}>⚠ Риски: {PEPTIDE_DB[peptideId].shortName}</h4>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {computePeptideRisks(PEPTIDE_DB[peptideId]).map((r, i) => (
                      <div key={i} style={{
                        padding: '4px 8px', borderRadius: 6, fontSize: 10,
                        background: r.riskPercent > 25 ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)',
                        border: `1px solid ${r.riskPercent > 25 ? 'rgba(239,68,68,0.3)' : 'rgba(245,158,11,0.3)'}`,
                        color: r.riskPercent > 25 ? '#ef4444' : '#f59e0b',
                      }}>
                        {r.label}: {r.riskPercent}%
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Synergies & Conflicts */}
              <div className="card" style={{ marginBottom: 8 }}>
                <h4 style={{ margin: '0 0 6px 0', fontSize: 12 }}>🔗 Синергии и конфликты</h4>
                {getPeptideSynergiesFor(peptideId).length > 0 && (
                  <div style={{ marginBottom: 4 }}>
                    <span style={{ fontSize: 10, color: '#22c55e', fontWeight: 600 }}>Синергии:</span>
                    {getPeptideSynergiesFor(peptideId).map(s => (
                      <span key={s.partner} style={{ fontSize: 9, marginLeft: 6, color: '#22c55e' }}>{s.partnerName} (+{s.strength})</span>
                    ))}
                  </div>
                )}
                {getPeptideConflictsFor(peptideId).length > 0 && (
                  <div>
                    <span style={{ fontSize: 10, color: '#ef4444', fontWeight: 600 }}>Конфликты:</span>
                    {getPeptideConflictsFor(peptideId).map(c => (
                      <span key={c.partner} style={{ fontSize: 9, marginLeft: 6, color: '#ef4444' }}>{c.partnerName} (severity: {c.severity})</span>
                    ))}
                  </div>
                )}
                {getPeptideSynergiesFor(peptideId).length === 0 && getPeptideConflictsFor(peptideId).length === 0 && (
                  <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>Нет данных</span>
                )}
              </div>
            </>
          )}

          {/* Protocol generator */}
          <div className="card">
            <h4 style={{ margin: '0 0 6px 0', fontSize: 12 }}>🎯 Генератор протокола по цели</h4>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
              {Object.keys(PEPTIDE_GOAL_PROFILES).map(goal => (
                <button key={goal} onClick={() => setPepProtocol(generatePeptideProtocol(goal))} style={{
                  padding: '5px 10px', borderRadius: 6, fontSize: 10, cursor: 'pointer',
                  background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)',
                  color: '#8b5cf6', fontWeight: 500,
                }}>
                  {goal === 'muscle_growth' ? '💪 Рост мышц' : goal === 'fat_loss' ? '🔥 Жиросжигание' : goal === 'recovery' ? '🔄 Восстановление' : goal === 'gi_healing' ? '🫃 ЖКТ' : goal === 'mitochondria' ? '🧬 Митохондрии' : goal === 'focus' ? '🎯 Фокус' : '😴 Сон'}
                </button>
              ))}
            </div>
            {pepProtocol && (
              <div style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 4 }}>{pepProtocol.goal === 'muscle_growth' ? 'Рост мышц' : pepProtocol.goal === 'fat_loss' ? 'Жиросжигание' : pepProtocol.goal === 'recovery' ? 'Восстановление' : pepProtocol.goal}: оценка синергии <span style={{ color: '#8b5cf6' }}>{pepProtocol.synergyScore.toFixed(1)}</span></div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {pepProtocol.peptides.map(p => (
                    <span key={p.id} style={{ fontSize: 10, padding: '3px 8px', borderRadius: 12, background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)', color: '#8b5cf6', fontWeight: 600 }}>
                      {p.shortName}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      </>
      )}

      {/* ===== STACKCALC IN CALC VIEW ===== */}
      {tab === 'main' && supportView === 'calc' && calcView === 'stackcalc' && (
        <div style={{ padding:'0 0 70px' }}>
          <div style={{ display:'flex', gap:6, marginBottom:6 }}>
            <button onClick={() => setCalcView('main')} style={{ padding:'4px 8px', borderRadius:6, fontSize:10, cursor:'pointer', background:'var(--bg-secondary)', border:'1px solid var(--border)', color:'var(--text-dim)', fontWeight:600 }}>← Назад</button>
            <button onClick={() => setSupportView('main')} style={{ padding:'4px 8px', borderRadius:6, fontSize:10, cursor:'pointer', background:'var(--bg-secondary)', border:'1px solid var(--border)', color:'var(--text-dim)', fontWeight:600 }}>← На главную Поддержки</button>
          </div>
          {safeRender('calc_stackcalc', () => {
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
                 if (!sub.name||!sub.mechanisms) continue;
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
                        <div key={si} style={{padding:'3px 6px',borderRadius:6,background:'var(--bg-secondary)',border:'1px solid var(--border)'}}>
                          <div style={{fontSize:8,fontWeight:600,color:'var(--text-light)'}}>{sd.name} <span style={{fontSize:7,color:'var(--text-dim)',fontWeight:400}}>{sd.id}</span></div>
                          {sd.description && <div style={{fontSize:7,color:'var(--text-dim)',lineHeight:1.3}}>{sd.description}</div>}
                          {sd.mechanisms && sd.mechanisms.length > 0 && <div style={{display:'flex',flexWrap:'wrap',gap:2,marginTop:2}}>{sd.mechanisms.slice(0,5).map((m:string,mi:number)=><span key={mi} style={{fontSize:6,padding:'1px 3px',borderRadius:3,background:'rgba(139,92,246,0.08)',color:'#a78bfa'}}>{MECH_TRANSLATIONS_RU[m] || m}</span>)}</div>}
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
      {tab === 'main' && supportView === 'calc' && calcView === 'mystacks' && (
        <div style={{ padding:'0 0 80px' }}>
          <div style={{ display:'flex', gap:6, marginBottom:6 }}>
            <button onClick={() => setCalcView('main')} style={{ padding:'4px 8px', borderRadius:6, fontSize:10, cursor:'pointer', background:'var(--bg-secondary)', border:'1px solid var(--border)', color:'var(--text-dim)', fontWeight:600 }}>← Назад</button>
            <button onClick={() => setSupportView('main')} style={{ padding:'4px 8px', borderRadius:6, fontSize:10, cursor:'pointer', background:'var(--bg-secondary)', border:'1px solid var(--border)', color:'var(--text-dim)', fontWeight:600 }}>← На главную Поддержки</button>
          </div>
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
            savedStacks.map(stack => (
              <div key={stack.id} className="card" style={{ marginBottom:6, padding:10 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
                  <div>
                    <div style={{ fontSize:12, fontWeight:700, color:'var(--accent)' }}>{stack.name}</div>
                    <div style={{ fontSize:8, color:'var(--text-dim)' }}>{new Date(stack.date).toLocaleDateString('ru')} · {stack.subs.length} добавок</div>
                  </div>
                  <button onClick={() => deleteStack(stack.id)} style={{ padding:'3px 6px', borderRadius:6, border:'1px solid rgba(239,68,68,0.3)', background:'rgba(239,68,68,0.08)', color:'#f87171', fontSize:8, cursor:'pointer' }}>Удалить</button>
                </div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:2 }}>
                  {stack.subs.slice(0, 20).map(id => {
                    const sub = ALL_SUBSTANCES.find(s => s.id === id);
                    const pharma = PHARMA_DB[id];
                    const name = sub?.name || pharma?.name || id.replace(/_/g, ' ');
                    const dosage = stack.dosages?.[id];
                    return (
                      <div key={id} style={{ padding:'2px 6px', borderRadius:5, background:'rgba(139,92,246,0.08)', border:'1px solid rgba(139,92,246,0.15)', fontSize:8 }}>
                        <span style={{ fontWeight:500 }}>{name}</span>
                        {dosage && <span style={{ color:'var(--text-dim)', marginLeft:3 }}>{dosage.mg >= 1000 && id !== 'omega3' ? `${(dosage.mg/1000).toFixed(dosage.mg%1000===0?0:1)}г` : `${dosage.mg}мг`}</span>}
                      </div>
                    );
                  })}
                  {stack.subs.length > 20 && <span style={{ fontSize:8, color:'var(--text-dim)' }}>+{stack.subs.length - 20} ещё</span>}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ===== MIX CALCULATOR: Training Mix ===== */}
      {tab === 'main' && supportView === 'calc' && calcView === 'mixcalc' && (
        <div style={{ padding:'0 0 80px', height:'100vh', display:'flex', flexDirection:'column' }}>
          <div style={{ display:'flex', gap:6, marginBottom:6 }}>
            <button onClick={() => setCalcView('main')} style={{ padding:'4px 8px', borderRadius:6, fontSize:10, cursor:'pointer', background:'var(--bg-secondary)', border:'1px solid var(--border)', color:'var(--text-dim)', fontWeight:600 }}>← Назад</button>
            <button onClick={() => setSupportView('main')} style={{ padding:'4px 8px', borderRadius:6, fontSize:10, cursor:'pointer', background:'var(--bg-secondary)', border:'1px solid var(--border)', color:'var(--text-dim)', fontWeight:600 }}>← На главную Поддержки</button>
          </div>
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

      {/* ===== SUPPORT PLAN VIEW ===== */}
      {tab === 'main' && supportView === 'calc' && calcView === 'plan' && (
        <div style={{ padding:'0 0 80px' }}>
          <div style={{ display:'flex', gap:6, marginBottom:6 }}>
            <button onClick={() => setCalcView('main')} style={{ padding:'4px 8px', borderRadius:6, fontSize:10, cursor:'pointer', background:'var(--bg-secondary)', border:'1px solid var(--border)', color:'var(--text-dim)', fontWeight:600 }}>← Назад</button>
            <button onClick={() => setSupportView('main')} style={{ padding:'4px 8px', borderRadius:6, fontSize:10, cursor:'pointer', background:'var(--bg-secondary)', border:'1px solid var(--border)', color:'var(--text-dim)', fontWeight:600 }}>← На главную Поддержки</button>
          </div>
          <h2 style={{ margin:'0 0 2px', fontSize:16, fontWeight:800, color:'var(--accent)' }}>📅 План поддержки</h2>
          <p style={{ fontSize:10, color:'var(--text-dim)', margin:'0 0 12px' }}>Сгенерирован из уровня: {SUPPORT_LEVELS[supportLevel]?.label || supportLevel}</p>
          <div style={{ display:'flex', gap:6, marginBottom:10 }}>
            {(['daily','weekly','monthly'] as const).map(p => (
              <button key={p} onClick={() => { setPlanView(p); setPlanSaved(false); }} style={{
                padding:'8px 18px', borderRadius:20, fontSize:11, fontWeight:700, cursor:'pointer',
                background: planView === p ? 'var(--accent)' : 'var(--bg-secondary)',
                color: planView === p ? '#000' : 'var(--text-dim)',
                border: `1px solid ${planView === p ? 'var(--accent)' : 'var(--border)'}`,
              }}>{p === 'daily' ? '☀️ Дневной' : p === 'weekly' ? '📆 Недельный' : '🗓 Месячный'}</button>
            ))}
          </div>
          {(() => {
            const level = SUPPORT_LEVELS[supportLevel];
            const subs = level?.subs || [];
            const dosages = level?.dosages || {};
            const TIME_SLOTS = [
              { key:'morning', label:'🌅 Утро', timeHint:'натощак или с завтраком' },
              { key:'afternoon', label:'☀️ День', timeHint:'с обедом' },
              { key:'evening', label:'🌙 Вечер', timeHint:'на ночь, перед сном' },
            ];
            const getInfo = (id: string) => {
              const sub = ALL_SUBSTANCES.find(s => s.id === id);
              const d = dosages[id];
              const name = sub?.name || id.replace(/_/g, ' ');
              return { id, name, mg: d?.mg ?? 0, timing: d?.timing || '' };
            };
            const distributeDaily = () => {
              const slots: Record<string, Array<{id:string,name:string,mg:number,timing:string}>> = { morning:[], afternoon:[], evening:[] };
              for (const id of subs) {
                const info = getInfo(id);
                const t = info.timing.toLowerCase();
                if (t.includes('вечер') || t.includes('ночь')) slots.evening.push(info);
                else if (t.includes('день') || t.includes('обед')) slots.afternoon.push(info);
                else slots.morning.push(info);
              }
              return slots;
            };
            const genDailyPlan = distributeDaily();
            if (planView === 'daily') return (
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                {TIME_SLOTS.map(slot => (
                  <div key={slot.key} style={{ background:'var(--bg-secondary)', borderRadius:12, padding:'10px 12px', border:'1px solid var(--border)' }}>
                    <div style={{ fontSize:12, fontWeight:700, color:'var(--accent)', marginBottom:6 }}>{slot.label} <span style={{ fontSize:9, fontWeight:400, color:'var(--text-dim)' }}>— {slot.timeHint}</span></div>
                    {genDailyPlan[slot.key].length > 0 ? (
                      genDailyPlan[slot.key].map((item, idx) => (
                        <div key={idx} style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 0', borderBottom: idx < genDailyPlan[slot.key].length - 1 ? '1px solid var(--border)' : 'none' }}>
                          <div style={{ width:6, height:6, borderRadius:'50%', background:'var(--accent)', flexShrink:0 }} />
                          <div style={{ flex:1 }}>
                            <div style={{ fontSize:11, fontWeight:600, color:'var(--text-light)' }}>{item.name}</div>
                            <div style={{ fontSize:9, color:'var(--text-dim)' }}>{item.mg >= 1000 && item.id !== 'omega3' ? `${(item.mg/1000).toFixed(item.mg%1000===0?0:1)}г` : `${item.mg}мг`} · {item.timing}</div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div style={{ fontSize:9, color:'var(--text-dim)', padding:'4px 0' }}>Нет добавок</div>
                    )}
                  </div>
                ))}
                <button onClick={() => {
                  const plan = { period:'daily', date:new Date().toISOString(), level:supportLevel, plan:genDailyPlan, levelLabel:level?.label };
                  localStorage.setItem('supportPlans', JSON.stringify([...(JSON.parse(localStorage.getItem('supportPlans') || '[]')), plan]));
                  setPlanSaved(true);
                }} style={{ width:'100%', padding:'12px', borderRadius:10, border:'none', cursor:'pointer', marginTop:4, background:'linear-gradient(135deg,#00e68a,#00c853)', color:'#000', fontWeight:800, fontSize:13 }}>💾 Сохранить план</button>
                {planSaved && <div style={{ textAlign:'center', fontSize:10, color:'#22c55e', marginTop:4 }}>✅ План сохранён</div>}
              </div>
            );
            if (planView === 'weekly') return (
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                {[0,1,2,3,4,5,6].map(dayIdx => {
                  const dayNames = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
                  const isRestDay = dayIdx === 6;
                  const daySlots = distributeDaily();
                  return (
                    <div key={dayIdx} style={{ background:'var(--bg-secondary)', borderRadius:12, padding:'8px 12px', border: isRestDay ? '1px solid rgba(139,92,246,0.3)' : '1px solid var(--border)' }}>
                      <div style={{ fontSize:12, fontWeight:700, marginBottom:4, color: isRestDay ? '#8b5cf6' : 'var(--accent)' }}>
                        {dayNames[dayIdx]} {isRestDay ? '🔄 Восстановление' : '🏋️ Тренировка'}
                      </div>
                      {TIME_SLOTS.map(slot => {
                        const items = daySlots[slot.key];
                        if (items.length === 0) return null;
                        return (
                          <div key={slot.key} style={{ marginBottom:3, paddingLeft:8 }}>
                            <div style={{ fontSize:9, color:'var(--text-dim)', marginBottom:1 }}>{slot.label}</div>
                            {items.map((item, idx) => (
                              <div key={idx} style={{ display:'flex', alignItems:'center', gap:6, padding:'2px 0' }}>
                                <div style={{ width:4, height:4, borderRadius:'50%', background:'var(--accent)', flexShrink:0 }} />
                                <span style={{ fontSize:9, color:'var(--text-light)' }}>{item.name}</span>
                                <span style={{ fontSize:8, color:'var(--text-dim)' }}>{item.mg >= 1000 && item.id !== 'omega3' ? `${(item.mg/1000).toFixed(item.mg%1000===0?0:1)}г` : `${item.mg}мг`}</span>
                              </div>
                            ))}
                          </div>
                        );
                      })}
                      {subs.length === 0 && <div style={{ fontSize:9, color:'var(--text-dim)' }}>Нет добавок</div>}
                    </div>
                  );
                })}
                <button onClick={() => {
                  const plan = { period:'weekly', date:new Date().toISOString(), level:supportLevel, plan: distributeDaily(), levelLabel:level?.label };
                  localStorage.setItem('supportPlans', JSON.stringify([...(JSON.parse(localStorage.getItem('supportPlans') || '[]')), plan]));
                  setPlanSaved(true);
                }} style={{ width:'100%', padding:'12px', borderRadius:10, border:'none', cursor:'pointer', marginTop:4, background:'linear-gradient(135deg,#00e68a,#00c853)', color:'#000', fontWeight:800, fontSize:13 }}>💾 Сохранить план</button>
                {planSaved && <div style={{ textAlign:'center', fontSize:10, color:'#22c55e', marginTop:4 }}>✅ План сохранён</div>}
              </div>
            );
            if (planView === 'monthly') {
              const isMaxLevel = supportLevel === 'boost';
              return (
                <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                  {[1,2,3,4].map(weekIdx => {
                    const isDeload = isMaxLevel && weekIdx === 4;
                    return (
                      <div key={weekIdx} style={{ background: isDeload ? 'rgba(139,92,246,0.08)' : 'var(--bg-secondary)', borderRadius:12, padding:'10px 12px', border: isDeload ? '1px solid rgba(139,92,246,0.3)' : '1px solid var(--border)' }}>
                        <div style={{ fontSize:13, fontWeight:700, marginBottom:6, color: isDeload ? '#8b5cf6' : 'var(--accent)' }}>
                          Неделя {weekIdx}{isDeload ? ' 🔄 Делоад' : ''}
                        </div>
                        {isDeload ? (
                          <div style={{ fontSize:10, color:'var(--text-dim)', lineHeight:1.5 }}>
                            <div>📉 Снижение дозировок до 50% базовых</div>
                            <div>🛌 Акцент на восстановление</div>
                            <div>🧘 Минимальная поддержка: только базовые антиоксиданты</div>
                            {['nac','omega3','magnesium','vitamin_d3'].map(id => {
                              const info = getInfo(id);
                              const halfMg = Math.round(info.mg / 2);
                              return (
                                <div key={id} style={{ display:'flex', gap:6, padding:'2px 0', marginLeft:8 }}>
                                  <span style={{ color:'var(--text-light)', fontSize:10 }}>{info.name}</span>
                                  <span style={{ fontSize:9, color:'var(--text-dim)' }}>{halfMg >= 1000 ? `${(halfMg/1000).toFixed(0)}г` : `${halfMg}мг`}</span>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
                            {subs.map(id => {
                              const info = getInfo(id);
                              return (
                                <div key={id} style={{ display:'flex', alignItems:'center', gap:6, padding:'2px 0' }}>
                                  <div style={{ width:5, height:5, borderRadius:'50%', background:'var(--accent)', flexShrink:0 }} />
                                  <span style={{ fontSize:10, fontWeight:500, color:'var(--text-light)', flex:1 }}>{info.name}</span>
                                  <span style={{ fontSize:9, color:'var(--text-dim)' }}>{info.mg >= 1000 && id !== 'omega3' ? `${(info.mg/1000).toFixed(info.mg%1000===0?0:1)}г` : `${info.mg}мг`}</span>
                                </div>
                              );
                            })}
                            {subs.length === 0 && <div style={{ fontSize:9, color:'var(--text-dim)' }}>Нет добавок</div>}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <button onClick={() => {
                    const plan = { period:'monthly', date:new Date().toISOString(), level:supportLevel, subs, dosages, levelLabel:level?.label };
                    localStorage.setItem('supportPlans', JSON.stringify([...(JSON.parse(localStorage.getItem('supportPlans') || '[]')), plan]));
                    setPlanSaved(true);
                  }} style={{ width:'100%', padding:'12px', borderRadius:10, border:'none', cursor:'pointer', marginTop:4, background:'linear-gradient(135deg,#00e68a,#00c853)', color:'#000', fontWeight:800, fontSize:13 }}>💾 Сохранить план</button>
                  {planSaved && <div style={{ textAlign:'center', fontSize:10, color:'#22c55e', marginTop:4 }}>✅ План сохранён</div>}
                </div>
              );
            }
            return null;
          })()}
        </div>
      )}

      {/* ===== SUPPORT CALCULATOR (redirect to info catalog) ===== */}
      {tab === 'main' && supportView === 'calc' && calcView === 'calculator' && (
        <div style={{ padding:'0 0 80px', height:'100vh', display:'flex', flexDirection:'column' }}>
          <div style={{ display:'flex', gap:6, marginBottom:6 }}>
            <button onClick={() => setCalcView('main')} style={{ padding:'4px 8px', borderRadius:6, fontSize:10, cursor:'pointer', background:'var(--bg-secondary)', border:'1px solid var(--border)', color:'var(--text-dim)', fontWeight:600 }}>← Назад</button>
            <button onClick={() => setSupportView('main')} style={{ padding:'4px 8px', borderRadius:6, fontSize:10, cursor:'pointer', background:'var(--bg-secondary)', border:'1px solid var(--border)', color:'var(--text-dim)', fontWeight:600 }}>← На главную Поддержки</button>
          </div>
          <h2 style={{ margin:'0 0 4px', fontSize:16, fontWeight:800, color:'var(--accent)' }}>🧮 Калькулятор поддержки</h2>
          <p style={{ fontSize:10, color:'var(--text-dim)', margin:'0 0 12px' }}>Персонализированный расчёт поддержки по курсу, рискам и целям.</p>
          <div style={{ flex:1, overflowY:'auto', paddingRight:4 }}>
            <div style={{ background:'var(--bg-secondary)', borderRadius:12, padding:14, marginBottom:10, border:'1px solid var(--border)' }}>
              <h4 style={{ margin:'0 0 8px', fontSize:12, color:'var(--text)' }}>⚙️ Параметры расчёта</h4>
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                <div>
                  <div style={{ fontSize:9, color:'var(--text-dim)', marginBottom:4 }}>Уровень поддержки</div>
                  <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
                    {(['basic','mid','max','boost'] as const).map(l => (
                      <button key={l} onClick={() => setSupportLevel(l)} style={{
                        padding:'6px 14px', borderRadius:16, fontSize:10, fontWeight:700, cursor:'pointer',
                        background: supportLevel === l ? 'var(--accent)' : 'var(--bg-secondary)',
                        color: supportLevel === l ? '#000' : 'var(--text-dim)',
                        border: `1px solid ${supportLevel === l ? 'var(--accent)' : 'var(--border)'}`,
                      }}>{l === 'basic' ? 'Базовый' : l === 'mid' ? 'Средний' : l === 'max' ? 'Максимум' : 'Boost'}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize:9, color:'var(--text-dim)', marginBottom:4 }}>Цель цикла</div>
                  <select value={supportGoal} onChange={e => setSupportGoal(e.target.value)} style={{ width:'100%', padding:'8px 10px', borderRadius:8, border:'1px solid var(--border)', background:'rgba(0,0,0,0.2)', color:'var(--text)', fontSize:11 }}>
                    <option value="muscle_gain">💪 Набор массы</option>
                    <option value="fat_loss">🔥 Жиросжигание</option>
                    <option value="recomp">🔄 Рекомпозиция</option>
                    <option value="strength">🏋️ Сила</option>
                    <option value="endurance">🏃 Выносливость</option>
                    <option value="health">❤️ Здоровье</option>
                  </select>
                </div>
                <button onClick={() => {
                  try {
                    const input: SupportInput = { substances: SUPPORT_LEVELS[supportLevel]?.subs || [], goals: [supportGoal], drugDoses: {}, labs: [] };
                    const result = calculateSupport(input);
                    setSupportResult(result);
                  } catch { }
                }} style={{ padding:'10px', borderRadius:8, border:'none', cursor:'pointer', background:'linear-gradient(135deg,#00e68a,#00c853)', color:'#000', fontWeight:800, fontSize:12 }}>📐 Рассчитать</button>
              </div>
            </div>
            {supportResult && (
              <div style={{ background:'var(--bg-secondary)', borderRadius:12, padding:14, border:'1px solid var(--border)' }}>
                <h4 style={{ margin:'0 0 8px', fontSize:12, color:'var(--accent)' }}>📊 Результат</h4>
                <div style={{ fontSize:10, color:'var(--text-dim)' }}>
                  <div>Риск до: {supportResult.riskBeforeSupport}% → После: {supportResult.riskAfterSupport}%</div>
                  <div style={{ marginTop:6 }}>
                    <div style={{ fontWeight:600, color:'var(--text)', marginBottom:4 }}>Системное покрытие:</div>
                    {Object.entries(supportResult.systemSupport || {}).map(([k,v]) => (
                      <div key={k} style={{ display:'flex', justifyContent:'space-between', fontSize:9, marginBottom:2 }}>
                        <span>{k}</span>
                        <span style={{ color:v > 50 ? '#22c55e' : v > 30 ? '#f59e0b' : '#ef4444' }}>{v}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div style={{ background:'var(--bg-secondary)', borderRadius:12, padding:14, marginTop:10, border:'1px solid var(--border)' }}>
              <h4 style={{ margin:'0 0 6px', fontSize:12, color:'#60a5fa' }}>💡 Подсказки</h4>
              <p style={{ fontSize:9, color:'var(--text-dim)', lineHeight:1.5, margin:0 }}>
                Для детального просмотра каталога, синергий, стеков и плана используйте соответствующие разделы в меню.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ===== PEPTIDE CALCULATOR ===== */}
      {tab === 'main' && supportView === 'calc' && calcView === 'peptides' && (
        <div style={{ padding:'0 0 80px', height:'100vh', display:'flex', flexDirection:'column' }}>
          <div style={{ display:'flex', gap:6, marginBottom:6 }}>
            <button onClick={() => setCalcView('main')} style={{ padding:'4px 8px', borderRadius:6, fontSize:10, cursor:'pointer', background:'var(--bg-secondary)', border:'1px solid var(--border)', color:'var(--text-dim)', fontWeight:600 }}>← Назад</button>
            <button onClick={() => setSupportView('main')} style={{ padding:'4px 8px', borderRadius:6, fontSize:10, cursor:'pointer', background:'var(--bg-secondary)', border:'1px solid var(--border)', color:'var(--text-dim)', fontWeight:600 }}>← На главную Поддержки</button>
          </div>
          <h2 style={{ margin:'0 0 4px', fontSize:16, fontWeight:800, color:'#a78bfa' }}>🧬 Пептидный калькулятор</h2>
          <p style={{ fontSize:10, color:'var(--text-dim)', margin:'0 0 12px' }}>Расчёт дозировок, баков, разведения и протоколов пептидов.</p>
          <div style={{ flex:1, overflowY:'auto', paddingRight:4 }}>
            <div style={{ background:'var(--bg-secondary)', borderRadius:12, padding:14, marginBottom:10, border:'1px solid var(--border)' }}>
              <h4 style={{ margin:'0 0 8px', fontSize:12, color:'var(--text)' }}>🧪 Выберите пептид</h4>
              <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginBottom:12 }}>
                {PEPTIDE_LIST.slice(0, 12).map(p => (
                  <span key={p.id} style={{
                    padding:'6px 10px', borderRadius:16, fontSize:9, fontWeight:600, whiteSpace:'nowrap',
                    background:'var(--bg-secondary)', color:'var(--text-dim)', border:'1px solid var(--border)',
                  }}>{p.name}</span>
                ))}
              </div>
            </div>
            <div style={{ background:'var(--bg-secondary)', borderRadius:12, padding:14, border:'1px solid var(--border)' }}>
              <h4 style={{ margin:'0 0 6px', fontSize:12, color:'#60a5fa' }}>💡 Информация</h4>
              <p style={{ fontSize:9, color:'var(--text-dim)', lineHeight:1.5, margin:0 }}>
                Для детального расчёта дозировок, баков, разведения и протоколов пептидов перейдите во вкладку "Пептиды" основного меню или нажмите кнопку "Фарма" в панели навигации. Там доступен полный пептидный калькулятор с PK/PD моделированием.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ===== NEUROTOXICITY CALCULATOR ===== */}
      {tab === 'main' && supportView === 'calc' && calcView === 'neuro' && (() => {
        const neuroColor = neuroScore < 30 ? '#22c55e' : neuroScore < 50 ? '#f59e0b' : neuroScore < 70 ? '#f97316' : '#ef4444';
        const neuroLabel = neuroScore < 30 ? 'Низкий' : neuroScore < 50 ? 'Средний' : neuroScore < 70 ? 'Высокий' : 'Критический';

        return (
        <div style={{ padding:'0 0 80px' }}>
          <button onClick={() => setCalcView('main')} style={{ padding:'4px 8px', borderRadius:6, fontSize:10, cursor:'pointer', marginBottom:6, background:'var(--bg-secondary)', border:'1px solid var(--border)', color:'var(--text-dim)', fontWeight:600 }}>← Назад</button>
          <button onClick={() => setSupportView('main')} style={{ padding:'4px 8px', borderRadius:6, fontSize:10, cursor:'pointer', marginBottom:4, marginLeft:6, background:'var(--bg-secondary)', border:'1px solid var(--border)', color:'var(--text-dim)', fontWeight:600 }}>← На главную Поддержки</button>
          <h2 style={{ margin:'0 0 4px', fontSize:16, fontWeight:800, color:'#ec4899' }}>🧠 Калькулятор нейротоксичности ААС</h2>
          <p style={{ fontSize:10, color:'var(--text-dim)', margin:'0 0 12px', lineHeight:1.4 }}>
            Интерактивный расчёт нейротоксичности на основе соединений курса, дозировок, длительности и возраста.
          </p>

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

          {/* Protection Protocol */}
          <div style={{ background:'var(--bg-secondary)', borderRadius:12, padding:14, marginBottom:10, border:'1px solid var(--border)' }}>
            <h4 style={{ margin:'0 0 10px', fontSize:13, color:'#00e68a' }}>💊 Протокол нейропротекции</h4>
            <p style={{ fontSize:9, color:'var(--text-dim)', margin:'0 0 10px' }}>
              Дозировки рассчитаны пропорционально индексу нейротоксичности ({neuroScore}). При значении &lt;10 используйте минимальные профилактические дозы.
            </p>
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {supportStack.map((s, i) => (
                <div key={i} style={{ padding:'8px 10px', borderRadius:8, background:'rgba(0,230,138,0.04)', border:'1px solid rgba(0,230,138,0.1)' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <span style={{ fontSize:11, fontWeight:600, color:'var(--text-light)' }}>{s.name}</span>
                    <span style={{ fontSize:10, fontWeight:700, color:'#00e68a' }}>{s.dose} {s.unit}/день</span>
                  </div>
                  <div style={{ fontSize:8, color:'var(--text-dim)', marginTop:2 }}>⏰ {s.timing}</div>
                </div>
              ))}
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
        </div>
        );
      })()}

      {/* ===== HRT/TRT CALCULATOR ===== */}
      {tab === 'main' && supportView === 'calc' && calcView === 'hrt' && (
        <div style={{ padding:'0 0 80px' }}>
          <div style={{ display:'flex', gap:6, marginBottom:6 }}>
            <button onClick={() => setCalcView('main')} style={{ padding:'4px 8px', borderRadius:6, fontSize:10, cursor:'pointer', background:'var(--bg-secondary)', border:'1px solid var(--border)', color:'var(--text-dim)', fontWeight:600 }}>← Назад</button>
            <button onClick={() => setSupportView('main')} style={{ padding:'4px 8px', borderRadius:6, fontSize:10, cursor:'pointer', background:'var(--bg-secondary)', border:'1px solid var(--border)', color:'var(--text-dim)', fontWeight:600 }}>← На главную Поддержки</button>
          </div>
          <h2 style={{ margin:'0 0 4px', fontSize:16, fontWeight:800, color:'#8b5cf6' }}>⚕️ Гормонозаместительная терапия</h2>
          <p style={{ fontSize:10, color:'var(--text-dim)', margin:'0 0 10px', lineHeight:1.4 }}>
            Научно обоснованные протоколы ТЗТ/ГЗТ, мониторинг и адъювантная терапия.
          </p>

          <div style={{ background:'var(--bg-secondary)', borderRadius:12, padding:14, marginBottom:10, border:'1px solid var(--border)' }}>
            <h4 style={{ margin:'0 0 8px', fontSize:12, color:'#22c55e' }}>💉 Протоколы ТЗТ (тестостерон-заместительная терапия)</h4>
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {[
                { name:'Тестостерон энантат/ципионат', dose:'100-200 мг/нед', freq:'Инъекция 1 раз/нед', note:'Базовый протокол, стабильный уровень' },
                { name:'Тестостерон ундеканоат (Nebido)', dose:'1000 мг', freq:'Каждые 10-14 недель', note:'Длительное действие, редкие инъекции' },
                { name:'Тестостерон гель', dose:'50-100 мг/день', freq:'Ежедневно на кожу', note:'Физиологичные уровни, меньше колебаний' },
                { name:'ХГЧ (hCG)', dose:'250-500 МЕ', freq:'2-3 раза/нед', note:'Сохранение фертильности, стимуляция Лейдигов' },
              ].map((r, i) => (
                <div key={i} style={{ padding:'8px 10px', borderRadius:8, background:'rgba(0,230,138,0.04)', border:'1px solid rgba(0,230,138,0.1)' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <span style={{ fontSize:11, fontWeight:600, color:'var(--text-light)' }}>{r.name}</span>
                    <span style={{ fontSize:9, fontWeight:700, color:'#00e68a' }}>{r.dose}</span>
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', marginTop:2 }}>
                    <span style={{ fontSize:9, color:'var(--text-dim)' }}>{r.freq}</span>
                    <span style={{ fontSize:9, color:'rgba(0,230,138,0.7)', fontStyle:'italic' }}>{r.note}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background:'var(--bg-secondary)', borderRadius:12, padding:14, marginBottom:10, border:'1px solid var(--border)' }}>
            <h4 style={{ margin:'0 0 8px', fontSize:12, color:'#60a5fa' }}>📊 Параметры мониторинга</h4>
            <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
              {[
                { param:'Общий тестостерон (TT)', target:'500-900 нг/дл', freq:'Каждые 3-6 мес' },
                { param:'Свободный тестостерон (FT)', target:'15-25 пг/мл', freq:'Каждые 3-6 мес' },
                { param:'Эстрадиол E2 (чувствительный)', target:'20-40 пг/мл', freq:'Каждые 3-6 мес' },
                { param:'SHBG (ГСПГ)', target:'20-40 нмоль/л', freq:'Каждые 6 мес' },
                { param:'Гематокрит (Hct)', target:'< 50%', freq:'Каждые 3 мес' },
                { param:'ПСА (простат-специфический антиген)', target:'< 4.0 нг/мл', freq:'Каждые 6-12 мес (мужчины >40)' },
                { param:'Липидный профиль', target:'ЛПНП < 100, ЛПВП > 40', freq:'Каждые 6-12 мес' },
              ].map((m, i) => (
                <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'6px 8px', borderRadius:6, background:'rgba(59,130,246,0.06)', border:'1px solid rgba(59,130,246,0.1)' }}>
                  <div>
                    <div style={{ fontSize:10, fontWeight:600, color:'var(--text-light)' }}>{m.param}</div>
                    <div style={{ fontSize:8, color:'var(--text-dim)' }}>{m.freq}</div>
                  </div>
                  <span style={{ fontSize:9, fontWeight:700, color:'#60a5fa' }}>{m.target}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background:'var(--bg-secondary)', borderRadius:12, padding:14, marginBottom:10, border:'1px solid var(--border)' }}>
            <h4 style={{ margin:'0 0 8px', fontSize:12, color:'#f59e0b' }}>💊 Адъювантная терапия</h4>
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {[
                { name:'Анастрозол', dose:'0.25-0.5 мг 2×/нед', note:'Только при E2 > 50 пг/мл + симптомы' },
                { name:'ХГЧ (hCG)', dose:'250-500 МЕ 2×/нед', note:'При желании сохранить фертильность' },
                { name:'Донаторы NO (цитруллин)', dose:'3-6 г/день', note:'Поддержка эндотелиальной функции' },
              ].map((r, i) => (
                <div key={i} style={{ padding:'6px 8px', borderRadius:6, background:'rgba(245,158,11,0.06)', border:'1px solid rgba(245,158,11,0.1)' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <span style={{ fontSize:10, fontWeight:600, color:'var(--text-light)' }}>{r.name}</span>
                    <span style={{ fontSize:9, fontWeight:700, color:'#f59e0b' }}>{r.dose}</span>
                  </div>
                  <div style={{ fontSize:9, color:'var(--text-dim)', marginTop:1 }}>{r.note}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background:'var(--bg-secondary)', borderRadius:12, padding:14, marginBottom:10, border:'1px solid var(--border)' }}>
            <h4 style={{ margin:'0 0 8px', fontSize:12, color:'#ef4444' }}>⚠ Риски и мифы</h4>
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {[
                { name:'Полицитемия', real:'Реальный риск: Hct > 54% → терапевтическая флеботомия или снижение дозы', myth:false },
                { name:'Апноэ сна', real:'Реальный риск: ухудшение или манифестация обструктивного апноэ сна', myth:false },
                { name:'Рак простаты', real:'Нет доказательств причинно-следственной связи. Риск прогрессии существующего рака.', myth:true },
                { name:'Сердечно-сосудистый риск', real:'Противоречивые данные. Физиологические дозы ТЗТ: нет повышения риска MACE (TRAVERSE trial, 2023)', myth:false },
              ].map((r, i) => (
                <div key={i} style={{ padding:'8px 10px', borderRadius:8, background:'rgba(239,68,68,0.06)', border:`1px solid ${r.myth ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.15)'}` }}>
                  <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                    <span style={{ fontSize:11, fontWeight:600, color:'var(--text-light)' }}>{r.name}</span>
                    {r.myth ? <span style={{ fontSize:8, padding:'2px 6px', borderRadius:4, background:'rgba(34,197,94,0.15)', color:'#22c55e' }}>МИФ</span> : <span style={{ fontSize:8, padding:'2px 6px', borderRadius:4, background:'rgba(239,68,68,0.15)', color:'#ef4444' }}>РЕАЛЬНО</span>}
                  </div>
                  <div style={{ fontSize:9, color:'var(--text-dim)', marginTop:3, lineHeight:1.3 }}>{r.real}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
            <div style={{ background:'var(--bg-secondary)', borderRadius:12, padding:14, border:'1px solid var(--border)' }}>
              <h4 style={{ margin:'0 0 8px', fontSize:12, color:'#22c55e' }}>✅ Кому нужна ГЗТ</h4>
              <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                {['Пост-курсовой гипогонадизм >6 мес','Возрастной гипогонадизм (TT <300)','Первичный гипогонадизм','Симптоматический гипогонадизм с TT <400'].map((s, i) => (
                  <div key={i} style={{ fontSize:9, color:'var(--text-light)', padding:'3px 0', display:'flex', alignItems:'center', gap:4 }}>
                    <span style={{ color:'#22c55e' }}>•</span> {s}
                  </div>
                ))}
              </div>
            </div>
            <div style={{ background:'var(--bg-secondary)', borderRadius:12, padding:14, border:'1px solid var(--border)' }}>
              <h4 style={{ margin:'0 0 8px', fontSize:12, color:'#ef4444' }}>🚫 Противопоказания</h4>
              <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                {['Рак простаты (активный)','Рак молочной железы (мужчины)','Нелеченное апноэ сна','Гематокрит > 54%','Тяжёлая сердечная недостаточность'].map((s, i) => (
                  <div key={i} style={{ fontSize:9, color:'var(--text-light)', padding:'3px 0', display:'flex', alignItems:'center', gap:4 }}>
                    <span style={{ color:'#ef4444' }}>×</span> {s}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== FERTILITY/PCT TAB (with back button) ===== */}
      {tab === 'fertility-pct' && (
        <div>
          <button onClick={() => setTab('main')} style={{ padding:'4px 8px', borderRadius:6, fontSize:10, cursor:'pointer', marginBottom:8, background:'var(--bg-secondary)', border:'1px solid var(--border)', color:'var(--text-dim)', fontWeight:600 }}>← На главную</button>
          <FertilityPCTScreen />
        </div>
      )}

      {/* ===== STACK BUILDER FLOATING BADGE ===== */}
      {stackBuilder.length > 0 && (
        <div style={{ position:'sticky', bottom:0, zIndex:100, display:'flex', alignItems:'center', justifyContent:'center', gap:8, padding:'8px 14px', borderRadius:16, background:'rgba(0,0,0,0.9)', backdropFilter:'blur(12px)', border:'1px solid rgba(0,230,138,0.3)', boxShadow:'0 4px 20px rgba(0,0,0,0.5)' }}>
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

