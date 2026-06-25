export interface BioStackTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  goal: string;
  substanceIds: string[];
  tags: string[];
}

export const STACK_TEMPLATES: BioStackTemplate[] = [
  {
    id: 'liver_support',
    name: '🫁 Печень',
    description: 'Комплекс для поддержки печени: детокс, регенерация, желчегонное',
    icon: '🫁',
    goal: 'liver_health',
    tags: ['печень', 'детокс', 'гепатопротектор', 'желчегонное'],
    substanceIds: ['NAC', 'milk_thistle', 'TUDCA', 'artichoke', 'SAMe', 'alpha_lipoic'],
  },
  {
    id: 'cardio_support',
    name: '❤️ ССС',
    description: 'Кардиопротекция: липидный профиль, давление, тонус сосудов',
    icon: '❤️',
    goal: 'cardio_health',
    tags: ['сердце', 'сосуды', 'давление', 'липиды'],
    substanceIds: ['omega3', 'coq10', 'magnesium', 'taurine', 'vitamin_k2', 'garlic'],
  },
  {
    id: 'nootropic',
    name: '🧠 Мозг',
    description: 'Когнитивная поддержка: память, фокус, нейропластичность',
    icon: '🧠',
    goal: 'brain',
    tags: ['мозг', 'память', 'фокус', 'нейропротекция', 'когнитив'],
    substanceIds: ['theanine', 'magnesium', 'omega3', 'alpha_gpc', 'citicoline', 'phosphatidylserine', 'lions_mane'],
  },
  {
    id: 'energy_mito',
    name: '⚡ Энергия',
    description: 'Митохондриальная поддержка и энергетический метаболизм',
    icon: '⚡',
    goal: 'energy',
    tags: ['энергия', 'митохондрии', 'b12', 'atp'],
    substanceIds: ['coq10', 'creatine', 'l_carnitine', 'rhodiola', 'pqq', 'vitamin_b_complex'],
  },
  {
    id: 'sleep',
    name: '😴 Сон',
    description: 'Улучшение качества сна, циркадных ритмов и расслабления',
    icon: '😴',
    goal: 'sleep',
    tags: ['сон', 'расслабление', 'мелатонин', 'gaba'],
    substanceIds: ['magnesium', 'theanine', 'glycine', 'gaba', 'melatonin', 'apigenin', 'lemon_balm'],
  },
  {
    id: 'immunity',
    name: '🛡️ Иммунитет',
    description: 'Иммуномодуляция: защита от инфекций, противовоспалительное',
    icon: '🛡️',
    goal: 'immunity',
    tags: ['иммунитет', 'защита', 'противовирусное'],
    substanceIds: ['vitamin_c', 'vitamin_d3', 'zinc', 'quercetin', 'NAC', 'astragalus', 'reishi'],
  },
  {
    id: 'joints',
    name: '🦴 Суставы',
    description: 'Здоровье суставов: регенерация хряща, противовоспалительное',
    icon: '🦴',
    goal: 'joints',
    tags: ['суставы', 'коллаген', 'противовоспалительное', 'хрящ'],
    substanceIds: ['collagen', 'glucosamine', 'msm', 'boswellia', 'curcumin', 'vitamin_d3'],
  },
  {
    id: 'stress_adapt',
    name: '🧘 Стресс',
    description: 'Адаптогены для стрессоустойчивости и кортизола',
    icon: '🧘',
    goal: 'stress',
    tags: ['стресс', 'адаптоген', 'кортизол', 'тревожность'],
    substanceIds: ['ashwagandha', 'rhodiola', 'theanine', 'magnesium', 'phosphatidylserine', 'holy_basil'],
  },
  {
    id: 'aas_base',
    name: '💊 ААС — база',
    description: 'Базовая поддержка на курсе ААС: печень, сердце, липиды',
    icon: '💊',
    goal: 'liver_health',
    tags: ['ААС', 'курс', 'поддержка', 'печень', 'сердце'],
    substanceIds: ['NAC', 'omega3', 'coq10', 'vitamin_d3', 'zinc', 'magnesium', 'milk_thistle'],
  },
  {
    id: 'pct_support',
    name: '🔄 ПКТ',
    description: 'Посткурсовая терапия: восстановление оси ГГЯ, гормонов',
    icon: '🔄',
    goal: 'hormones',
    tags: ['ПКТ', 'восстановление', 'гормоны', 'тестостерон'],
    substanceIds: ['NAC', 'vitamin_e', 'zinc', 'DAA', 'ashwagandha', 'omega3', 'magnesium'],
  },
  {
    id: 'fat_loss',
    name: '🔥 Жиросжигание',
    description: 'Метаболическая поддержка: термогенез, липолиз, AMPK',
    icon: '🔥',
    goal: 'fat_loss',
    tags: ['жиросжигание', 'метаболизм', 'термогенез', 'липолиз'],
    substanceIds: ['l_carnitine', 'green_tea_extract', 'CLA', 'caffeine', 'berberine', 'omega3'],
  },
  {
    id: 'skin_hair',
    name: '💇 Кожа и волосы',
    description: 'Красота: коллаген, антиоксиданты для кожи, волос и ногтей',
    icon: '💇',
    goal: 'skin',
    tags: ['кожа', 'волосы', 'коллаген', 'антиоксидант'],
    substanceIds: ['collagen', 'biotin', 'zinc', 'vitamin_c', 'vitamin_e', 'silicon', 'astaxanthin'],
  },
  {
    id: 'digestion_gut',
    name: '🫃 ЖКТ',
    description: 'Здоровье кишечника: микробиом, слизистая, пищеварение',
    icon: '🫃',
    goal: 'digestion',
    tags: ['жкт', 'кишечник', 'пробиотики', 'пищеварение'],
    substanceIds: ['probiotics', 'prebiotics', 'glutamine', 'zinc_carnosine', 'digestive_enzymes', 'slippery_elm'],
  },
  {
    id: 'detox',
    name: '🧹 Детокс',
    description: 'Системный детокс: печень, почки, антиоксидантная защита',
    icon: '🧹',
    goal: 'detox',
    tags: ['детокс', 'очищение', 'печень', 'почки'],
    substanceIds: ['NAC', 'milk_thistle', 'alpha_lipoic', 'sulforaphane', 'chaga', 'schisandra', 'vitamin_c'],
  },
  {
    id: 'testosterone_natural',
    name: '💪 Тестостерон',
    description: 'Натуральное повышение тестостерона: ось ГГЯ, чувствительность андрогенов',
    icon: '💪',
    goal: 'hormones',
    tags: ['тестостерон', 'гормоны', 'libido', 'андрогены'],
    substanceIds: ['zinc', 'magnesium', 'vitamin_d3', 'ashwagandha', 'DAA', 'boron', 'fadogia', 'maca'],
  },
];

export function getTemplatesByGoal(goal: string): BioStackTemplate[] {
  return STACK_TEMPLATES.filter(t => t.goal === goal);
}

export function getTemplateById(id: string): BioStackTemplate | undefined {
  return STACK_TEMPLATES.find(t => t.id === id);
}

export function searchTemplates(query: string): BioStackTemplate[] {
  const q = query.toLowerCase();
  return STACK_TEMPLATES.filter(t =>
    t.name.toLowerCase().includes(q) ||
    t.description.toLowerCase().includes(q) ||
    t.tags.some(tag => tag.toLowerCase().includes(q))
  );
}
