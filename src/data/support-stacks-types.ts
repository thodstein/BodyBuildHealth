import { SUPPORT_CATALOG_DATA } from './support-catalog-data';

export interface StackSubstance {
  id: string;
  dose: string;
  timing: 'morning' | 'afternoon' | 'evening' | 'night' | 'fasting';
  mechanism: string;
}

export interface SupportStack {
  id: string;
  name: string;
  problem: string;
  system: string;
  description: string;
  synergyPrinciple: string;
  substances: StackSubstance[];
  synergyScore: number;
  timingSummary: string;
  monitoring: string;
  specialInstructions: string;
  contraindications: string;
  warnings: string;
  anatomicalMapping: {
    organSystems: string[];
    targetOrgans: string[];
    organMechanisms: string;
    drugMechanisms: string[];
    mechanismCodes: string[];
    finalEffect: string;
  };
  structuredInteractions: {
    synergies: Array<{ with: string; effect: string; mechanism: string; strength: string }>;
    conflicts: Array<{ with: string; effect: string; mechanism: string; strength: string }>;
    specialInstructions: string;
    cautions: string;
  };
  structuredLabControl: {
    markers: Array<{ marker: string; when: string; targetRange: string }>;
  };
  goalTags?: string[];
  effects?: string[];
}

export const EFFECT_LABELS_ru: Record<string, string> = {
  energy: '⚡ Энергия', focus: '🎯 Фокус', anti_stress: '🧘 Антистресс',
  mood: '😊 Настроение', fat_loss: '🔥 Жиросжигание', mitochondria: '🧬 Митохондрии',
  recovery: '🔄 Восстановление', sleep: '😴 Сон', hormone_balance: '⚖ Гормоны',
  immune_boost: '🛡 Иммунитет', gi_healing: '🫃 ЖКТ', detox: '🧹 Детокс',
  anti_inflammation: '💢 Противовоспаление', cardio_support: '❤️ Кардио',
  liver_support: '🫁 Печень', insulin_sensitivity: '📉 Инсулин',
  muscle_growth: '💪 Рост мышц', gh_igf_axis: '📈 GH/IGF',
  memory: '🧠 Память', thyroid_support: '🦋 Щитовидка',
  bone_support: '🦴 Кости', hydration: '💧 Гидратация', absorption: '📥 Абсорбция',
  antioxidant: '🧪 Антиоксидант', nootropic: '🧠 Ноотроп', vision: '👁 Зрение',
  skin: '✨ Кожа', joint: '🦵 Суставы', liver_detox: '🍃 Детокс печени',
  kidney: 'И Почки', lung: '🫁 Лёгкие', blood: '🩸 Кровь',
  adrenal: '🌀 Надпочечники', male_health: '♂️ Мужское здоровье',
  female_health: '♀️ Женское здоровье', prenatal: '🤰 Пренатальное',
  antiaging: '⏳ Антивозрастное', methylation: '🔄 Метилирование',
  nerve: '🧠 Нервы', tendon: '🦵 Сухожилия', probiotics: '🦠 Микробиом',
  collagen: '🧶 Коллаген', electrolyte: '💧 Электролиты',
  anemia: '🩸 Анемия', coagulation: '🩸 Свёртываемость',
  lymphatic: '♻️ Лимфа', dopamine: '🧠 Дофамин', serotonin: '🧠 Серотонин',
  gaba: '🧠 GABA', appetite: '🍽 Аппетит', pain: '💊 Боль',
  libido: '🔥 Либидо', hair: '💇 Волосы', nails: '💅 Ногти',
  pancreas: '🍬 Поджелудочная', allergy: '🤧 Аллергия',
  antimicrobial: '🦠 Антимикробное', antiviral: '🦠 Противовирусное',
};

export function getStackSubstanceLabel(id: string | StackSubstance): string {
  if (!id) return '—';
  const key = typeof id === 'string' ? id : id.id;
  const catEntry = SUPPORT_CATALOG_DATA[key];
  if (catEntry) return catEntry.nameRu || catEntry.name;
  return key.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
}


