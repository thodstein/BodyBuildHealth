import type { PD } from '../../../core/types';
import { SYSTEM_INFO_ALL } from '../../../core/risk-info';

export const SYSTEM_LABELS: Record<string, string> = Object.fromEntries(
  Object.entries(SYSTEM_INFO_ALL).map(([k, v]) => [k, (v as { label: string }).label.split(' ').slice(0, 2).join(' ')])
);

export const INJECTABLE_WITH_ESTERS = new Set(['testosterone','trenbolone','nandrolone','boldenone','primobolan','drostanolone']);

export const CLASS_LABELS: Record<string, string> = {
  testosterone: 'Тестостерон',
  trenbolone: 'Тренболон',
  nandrolone: 'Нандролон',
  boldenone: 'Болденон',
  primobolan: 'Примоболан',
  oral_17aa: 'Оральные 17-α',
  sarm: 'SARMs',
  peptide_ghrh: 'GHRH',
  peptide_ghrp: 'GHRP',
  igf1: 'IGF-1',
  mgf: 'МГФ',
  insulin: 'Инсулин',
  drostanolone: 'Дростанолон',
  dht_inject: 'DHT-инъекционные (DHB)',
  peptide_gnrh: 'GnRH',
  peptide_fat_loss: 'Жиросжигающие',
  peptide_other: 'Прочие',
  dht_derivative: 'DHT производные',
};

export const PD_LABELS: Record<keyof PD, string> = {
  AR_affinity: 'Андрогенность',
  aromatization: 'Ароматизация',
  five_alpha_reduction: '5α-редукция',
  progestogenic: 'Прогестагенность',
  hepatotoxicity: 'Гепатотоксичность',
  lipid_impact: 'Влияние на липиды',
  hct_impact: 'Гематокрит',
  neuro_toxicity: 'Нейротоксичность',
};

export const PD_MECHANISMS: Record<keyof PD, string> = {
  AR_affinity: 'Сродство к андрогенному рецептору — определяет анаболическую/андрогенную силу',
  aromatization: 'Скорость ароматизации в эстрадиол — риск эстрогенных побочных эффектов',
  five_alpha_reduction: 'Восстановление до DHT — влияет на андрогенные эффекты (кожа, простата)',
  progestogenic: 'Прогестагенная активность — может подавлять ГнРГ/ЛГ, влиять на либидо',
  hepatotoxicity: 'Гепатотоксичность — нагрузка на печень, риск повреждения гепатоцитов',
  lipid_impact: 'Влияние на липидный профиль — снижение ЛПВП, повышение ЛПНП',
  hct_impact: 'Влияние на гематокрит — риск полицитемии при длительном приёме',
  neuro_toxicity: 'Нейротоксичность — риск когнитивных/неврологических побочных эффектов',
};

export const PHARMA_MECH_LABELS: Record<string, string> = {
  'AR_AGONISM': 'Агонист AR', 'AR_SELECTIVE_AGONISM': 'Селективный агонист AR',
  'mTOR_UP': 'Активация mTOR', 'PROTEIN_SYNTHESIS': 'Синтез белка',
  'NITROGEN_RETENTION': 'Задержка азота', 'ERYTHROPOIESIS': 'Эритропоэз',
  'IGF1_UPREGULATION': '↑ IGF-1', 'IGF1_UP': '↑ IGF-1',
  '5AR_REDUCTION': '5α-редукция', 'AROMATIZATION': 'Ароматизация',
  'AROMATASE_INHIBITION': 'Ингибитор ароматазы', 'E2_SUPPRESSION': '↓ E2',
  'PR_AGONISM': 'Агонист PR', 'GR_ANTAGONISM': 'Антагонист GR',
  'CORTISOL_SUPPRESSION': '↓ Кортизол', 'DOPAMINE_MODULATION': 'Модуляция дофамина',
  'GABA_MODULATION': 'Модуляция ГАМК', 'CYP3A4_METABOLISM': 'Через CYP3A4',
  'COLLAGEN_SYNTHESIS': 'Синтез коллагена', 'BONE_MINERALIZATION': 'Минерализация костей',
  'PROGESTIN_ACTIVITY': 'Прогестиновая активность',
  'ANTI_CATABOLIC': 'Антикатаболическое', 'GLYCOGEN_SYNTHESIS': 'Синтез гликогена',
  'ANTI_ESTROGENIC': 'Антиэстрогенное', 'SHBG_BINDING': 'Связывание SHBG',
  'GHSR_AGONISM': 'Агонист GHS-R', 'GH_RELEASE': 'Выброс ГР',
  'NEUROPEPTIDE_MOD': 'Модуляция нейропептидов',
  'LIPOLYSIS_ACTIVATION': 'Липолиз', 'HSL_STIMULATION': 'Стимуляция HSL',
  'PEPTIDE_MOD': 'Пептидная модуляция', 'TISSUE_REPAIR': 'Репарация тканей',
  'ER_ANTAGONISM': 'Антагонист ER', 'GNRH_UP': '↑ ГнРГ',
  'GNRH_AGONISM': 'Агонист GnRH', 'LH_UP': '↑ ЛГ',
  'FSH_UP': '↑ ФСГ', 'LH_MIMETIC': 'Миметик ЛГ',
  'TESTOSTERONE_PRODUCTION': 'Продукция тестостерона',
  'TESTOSTERONE_UP': '↑ Тестостерон', 'D2_AGONISM': 'Агонист D2',
  'PROLACTIN_SUPPRESSION': '↓ Пролактин', 'IGF1R_AGONISM': 'Агонист IGF-1R',
  'CELL_PROLIFERATION': 'Пролиферация клеток',
  'SATELLITE_CELL_ACTIVATION': 'Активация сателлитов',
  'GLUCOSE_TRANSPORT': 'Транспорт глюкозы', 'AMINO_ACID_UPTAKE': 'Захват аминокислот',
  'NUTRITIONAL_SUPPORT': 'Нутрицевтическая поддержка',
  'ANTI_INFLAMMATORY': 'Противовоспалительное', 'IMMUNE_SUPPORT': 'Иммунная поддержка',
  'ANABOLIC': 'Анаболическое', 'STRESS_RESPONSE': 'Адаптоген',
  'DETOX_UP': '↑ Детоксикация', 'GSH_UP': 'Синтез глутатиона',
  'ROS_DOWN': '↓ ROS', 'NFkB_DOWN': '↓ NF-κB',
  'MITO_STABILIZE': 'Стабилизация митохондрий',
  'APOPTOSIS_DOWN': '↓ Апоптоз', 'BILE_FLOW_UP': '↑ Желчеотток',
  'SPM_UP': 'Специализированные про-резольвные медиаторы',
  'TG_DOWN': '↓ Триглицериды', 'NEURO_MEMBRANE': 'Структура нейромембран',
  'AT1_BLOCK': 'Блокада AT1', 'ALDOSTERONE_DOWN': '↓ Альдостерон',
  'BP_DOWN': '↓ АД', 'BETA1_BLOCK': 'Блокада β1',
  'NO_UP': '↑ NO', 'HR_DOWN': '↓ ЧСС',
  'HPTA_SUPPORT': 'Поддержка HPTA',
  'AR_AGONISM (3-5x stronger)': 'Агонист AR (×3-5)',
  'AROMATIZATION (20%)': 'Ароматизация (20%)',
};

export const CV_LABELS: Record<string, string> = {
  bloodPressure: 'АД', heartRate: 'ЧСС', vascularTone: 'Тонус', thrombosisRisk: 'Тромбоз', cnsLoad: 'ЦНС',
};
export const CV_VALUE_LABELS: Record<string, Record<string, string>> = {
  bloodPressure: { up: '↑', down: '↓', neutral: '=' },
  heartRate: { up: '↑', down: '↓', neutral: '=' },
  vascularTone: { constrict: 'спазм', dilate: 'расш', neutral: '=' },
  thrombosisRisk: { low: 'низкий', medium: 'средний', high: 'высокий' },
  cnsLoad: { low: 'низкая', medium: 'средняя', high: 'высокая' },
};
export const CV_VALUE_COLORS: Record<string, Record<string, string>> = {
  bloodPressure: { up: '#f44336', down: '#2196f3', neutral: '#9e9e9e' },
  heartRate: { up: '#f44336', down: '#2196f3', neutral: '#9e9e9e' },
  vascularTone: { constrict: '#f44336', dilate: '#2196f3', neutral: '#9e9e9e' },
  thrombosisRisk: { low: '#4caf50', medium: '#ff9800', high: '#f44336' },
  cnsLoad: { low: '#4caf50', medium: '#ff9800', high: '#f44336' },
};

export const SEVERITY_COLORS: Record<string, string> = {
  critical: '#ff1744',
  warning: '#ff9100',
  info: '#2979ff',
};

export const INTERACTION_TYPE_LABELS: Record<string, string> = {
  synergy: 'Синергия',
  conflict: 'Конфликт',
  danger: 'Опасность',
  caution: 'Осторожность',
};

export const pdBarColor = (key: keyof PD, val: number): string => {
  if (key === 'hepatotoxicity') return val >= 2.5 ? '#ff1744' : val >= 1.5 ? '#ff9100' : '#4caf50';
  if (key === 'aromatization') return val >= 0.7 ? '#ff5252' : '#4caf50';
  if (key === 'progestogenic') return val >= 0.3 ? '#ff9100' : '#4caf50';
  if (key === 'neuro_toxicity') return val >= 0.3 ? '#ff1744' : val >= 0.1 ? '#ff9100' : '#4caf50';
  if (key === 'lipid_impact') return val <= -0.5 ? '#ff1744' : '#4caf50';
  if (key === 'hct_impact') return val >= 4 ? '#ff1744' : '#4caf50';
  return '#2979ff';
};

export const formatHalfLife = (hours: number): string => {
  if (hours >= 168) return `${(hours / 168).toFixed(1)} нед`;
  if (hours >= 24) return `${(hours / 24).toFixed(1)} дн`;
  return `${hours.toFixed(1)} ч`;
};

export const PHARMA_CLASSES = [
  'testosterone', 'trenbolone', 'nandrolone', 'boldenone', 'primobolan', 'oral_17aa',
  'sarm', 'peptide_ghrh', 'peptide_ghrp', 'igf1', 'mgf', 'insulin',
  'drostanolone', 'peptide_gnrh',
  'peptide_fat_loss', 'peptide_other', 'dht_derivative'
] as const;

export const PHARMA_CORE_CLASSES = [
  'testosterone', 'trenbolone', 'nandrolone', 'boldenone', 'primobolan', 'oral_17aa',
  'sarm', 'peptide_ghrh', 'peptide_ghrp', 'igf1', 'mgf', 'insulin',
  'drostanolone', 'peptide_gnrh',
  'peptide_fat_loss', 'peptide_other', 'dht_derivative'
] as const;

export type PharmaClass = typeof PHARMA_CLASSES[number];