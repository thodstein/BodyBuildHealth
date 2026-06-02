import { MarketplaceItem, PurchaseOption } from '../core/types';

export function getBestPrice(options: PurchaseOption[], currency = 'RUB'): PurchaseOption | null {
  const valid = options.filter(o => o.currency === currency);
  return valid.length ? valid.reduce((best, curr) => curr.price < best.price ? curr : best, valid[0]) : null;
}

export function generateAffiliateLink(option: PurchaseOption, partnerId = 'health-engine'): string {
  try {
    const url = new URL(option.url);
    url.searchParams.set('ref', partnerId);
    url.searchParams.set('offer_id', option.offerId || 'default');
    return url.toString();
  } catch {
    return option.url;
  }
}

export const MOCK_MARKETPLACE_DB: MarketplaceItem[] = [
  {
    id: 'telmi',
    name: 'Телмисартан 40 мг',
    category: 'pharma',
    dailyDose: '1×40 мг утро',
    mechanisms: ['cardio_2', 'cardio_3', 'renal_1'],
    synergy: '+Небилет: комплексный АД/ЧСС контроль, органопротекция',
    purchaseOptions: [
      { platform: 'ozon', url: 'https://ozon.ru/tel', price: 520, currency: 'RUB', deliveryDays: 1 },
      { platform: 'apteka', url: 'https://apteka.ru/tel', price: 490, currency: 'RUB', deliveryDays: 2 },
      { platform: 'eapteka', url: 'https://eapteka.ru/tel', price: 530, currency: 'RUB', deliveryDays: 1 }
    ]
  },
  {
    id: 'nebivolol',
    name: 'Небиволол 5 мг',
    category: 'pharma',
    dailyDose: '1×5 мг утро',
    mechanisms: ['cardio_1', 'cardio_4', 'neuro_1'],
    synergy: '+Телмисартан: β-блокада + БРА, АД/ЧСС контроль, NO-медиация',
    purchaseOptions: [
      { platform: 'ozon', url: 'https://ozon.ru/nebivolol', price: 680, currency: 'RUB', deliveryDays: 1 },
      { platform: 'apteka', url: 'https://apteka.ru/nebivolol', price: 650, currency: 'RUB', deliveryDays: 2 },
      { platform: 'eapteka', url: 'https://eapteka.ru/nebivolol', price: 710, currency: 'RUB', deliveryDays: 1 }
    ]
  },
  {
    id: 'nac',
    name: 'NAC 600 мг',
    category: 'supplement',
    dailyDose: '2×600 мг с едой',
    mechanisms: ['hepatic_3', 'hepatic_2', 'hematologic_1'],
    synergy: '+TUDCA: синергетическая гепатопротекция, желчеотток + глутатион',
    purchaseOptions: [
      { platform: 'iherb', url: 'https://iherb.com/nac', price: 1150, currency: 'RUB', deliveryDays: 7 },
      { platform: 'usmall', url: 'https://usmall.ru/nac', price: 1290, currency: 'RUB', deliveryDays: 10 },
      { platform: 'ozon', url: 'https://ozon.ru/nac', price: 1050, currency: 'RUB', deliveryDays: 2 }
    ]
  },
  {
    id: 'tudca',
    name: 'TUDCA 500 мг',
    category: 'supplement',
    dailyDose: '2×500 мг натощак',
    mechanisms: ['hepatic_1', 'hepatic_4', 'hepatic_2'],
    synergy: '+NAC: гепатопротекция по двум путям — желчеотток + антиоксидант',
    purchaseOptions: [
      { platform: 'iherb', url: 'https://iherb.com/tudca', price: 2400, currency: 'RUB', deliveryDays: 7 },
      { platform: 'usmall', url: 'https://usmall.ru/tudca', price: 2650, currency: 'RUB', deliveryDays: 10 },
      { platform: 'ozon', url: 'https://ozon.ru/tudca', price: 2200, currency: 'RUB', deliveryDays: 3 }
    ]
  },
  {
    id: 'silymarin',
    name: 'Силимарин (Расторопша) 150 мг',
    category: 'supplement',
    dailyDose: '3×150 мг до еды',
    mechanisms: ['hepatic_2', 'hepatic_3', 'hepatic_5'],
    synergy: '+NAC/TUDCA: усиление антиоксидантной защиты печени',
    purchaseOptions: [
      { platform: 'iherb', url: 'https://iherb.com/silymarin', price: 750, currency: 'RUB', deliveryDays: 7 },
      { platform: 'ozon', url: 'https://ozon.ru/silymarin', price: 620, currency: 'RUB', deliveryDays: 2 },
      { platform: 'apteka', url: 'https://apteka.ru/silymarin', price: 580, currency: 'RUB', deliveryDays: 1 }
    ]
  },
  {
    id: 'citrulline',
    name: 'L-Цитруллин 6 г',
    category: 'supplement',
    dailyDose: '6 г утром',
    mechanisms: ['renal_1', 'cardio_4', 'hematologic_2'],
    synergy: '+Телмисартан: NO-зависимая вазодилатация, почечная протекция',
    purchaseOptions: [
      { platform: 'iherb', url: 'https://iherb.com/citrulline', price: 1400, currency: 'RUB', deliveryDays: 7 },
      { platform: 'ozon', url: 'https://ozon.ru/citrulline', price: 1250, currency: 'RUB', deliveryDays: 2 },
      { platform: 'usmall', url: 'https://usmall.ru/citrulline', price: 1380, currency: 'RUB', deliveryDays: 10 }
    ]
  },
  {
    id: 'magnesium',
    name: 'Магний бисглицинат 400 мг',
    category: 'supplement',
    dailyDose: '400 мг вечером',
    mechanisms: ['neuro_2', 'neuro_3', 'cardio_4'],
    synergy: '+L-теанин: глубокий сон, снижение стресса, GABA-медиация',
    purchaseOptions: [
      { platform: 'ozon', url: 'https://ozon.ru/mg', price: 980, currency: 'RUB', deliveryDays: 2 },
      { platform: 'iherb', url: 'https://iherb.com/mg', price: 1100, currency: 'RUB', deliveryDays: 6 },
      { platform: 'usmall', url: 'https://usmall.ru/mg', price: 1050, currency: 'RUB', deliveryDays: 10 }
    ]
  },
  {
    id: 'l-theanine',
    name: 'L-Теанин 200 мг',
    category: 'supplement',
    dailyDose: '1×200 мг вечер или перед стрессом',
    mechanisms: ['neuro_1', 'neuro_3', 'neuro_4'],
    synergy: '+Магний: α-волны, GABA-усиление, антистресс без седации',
    purchaseOptions: [
      { platform: 'iherb', url: 'https://iherb.com/theanine', price: 890, currency: 'RUB', deliveryDays: 7 },
      { platform: 'ozon', url: 'https://ozon.ru/theanine', price: 950, currency: 'RUB', deliveryDays: 3 },
      { platform: 'usmall', url: 'https://usmall.ru/theanine', price: 1020, currency: 'RUB', deliveryDays: 10 }
    ]
  },
  {
    id: 'ashwagandha',
    name: 'Ашваганда KSM-66 600 мг',
    category: 'supplement',
    dailyDose: '1×600 мг вечером',
    mechanisms: ['neuro_3', 'neuro_1', 'endocrine_2'],
    synergy: '+Магний: кортизол/стресс, адаптогенная синергия',
    purchaseOptions: [
      { platform: 'iherb', url: 'https://iherb.com/ashwagandha', price: 1350, currency: 'RUB', deliveryDays: 7 },
      { platform: 'ozon', url: 'https://ozon.ru/ashwagandha', price: 1200, currency: 'RUB', deliveryDays: 3 },
      { platform: 'usmall', url: 'https://usmall.ru/ashwagandha', price: 1400, currency: 'RUB', deliveryDays: 10 }
    ]
  },
  {
    id: 'melatonin',
    name: 'Мелатонин 1 мг',
    category: 'supplement',
    dailyDose: '0.5–1 мг за 30 мин до сна',
    mechanisms: ['neuro_4', 'neuro_2', 'neuro_1'],
    synergy: '+Магний: инсомния, циркадное восстановление',
    purchaseOptions: [
      { platform: 'ozon', url: 'https://ozon.ru/melatonin', price: 450, currency: 'RUB', deliveryDays: 1 },
      { platform: 'iherb', url: 'https://iherb.com/melatonin', price: 600, currency: 'RUB', deliveryDays: 7 },
      { platform: 'apteka', url: 'https://apteka.ru/melatonin', price: 390, currency: 'RUB', deliveryDays: 2 }
    ]
  },
  {
    id: 'berberine',
    name: 'Берберин HCl 500 мг',
    category: 'supplement',
    dailyDose: '2×500 мг с едой',
    mechanisms: ['endocrine_1', 'glucose_1', 'endocrine_2'],
    synergy: '+Метформин: AMPK-активация (не комбинировать без врача)',
    purchaseOptions: [
      { platform: 'iherb', url: 'https://iherb.com/berberine', price: 1100, currency: 'RUB', deliveryDays: 7 },
      { platform: 'ozon', url: 'https://ozon.ru/berberine', price: 980, currency: 'RUB', deliveryDays: 3 },
      { platform: 'usmall', url: 'https://usmall.ru/berberine', price: 1150, currency: 'RUB', deliveryDays: 10 }
    ]
  },
  {
    id: 'aspirin',
    name: 'Аспирин 100 мг (кардио)',
    category: 'pharma',
    dailyDose: '1×100 мг после еды',
    mechanisms: ['hematologic_1', 'cardio_4', 'hematologic_3'],
    synergy: '+Омега-3: антиагрегантная синергия, противовоспалительный эффект',
    purchaseOptions: [
      { platform: 'apteka', url: 'https://apteka.ru/aspirin', price: 120, currency: 'RUB', deliveryDays: 1 },
      { platform: 'ozon', url: 'https://ozon.ru/aspirin', price: 150, currency: 'RUB', deliveryDays: 1 },
      { platform: 'eapteka', url: 'https://eapteka.ru/aspirin', price: 130, currency: 'RUB', deliveryDays: 1 }
    ]
  },
  {
    id: 'omega3',
    name: 'Омега-3 EPA/DHA 1000 мг',
    category: 'supplement',
    dailyDose: '2×1000 мг с едой',
    mechanisms: ['hematologic_2', 'cardio_4', 'hepatic_2'],
    synergy: '+Аспирин: тромбоциты/липиды; +Телмисартан: кардиопротекция',
    purchaseOptions: [
      { platform: 'iherb', url: 'https://iherb.com/omega3', price: 1800, currency: 'RUB', deliveryDays: 7 },
      { platform: 'ozon', url: 'https://ozon.ru/omega3', price: 1650, currency: 'RUB', deliveryDays: 3 },
      { platform: 'usmall', url: 'https://usmall.ru/omega3', price: 1750, currency: 'RUB', deliveryDays: 10 }
    ]
  },
  {
    id: 'hcg',
    name: 'ХГЧ 5000 МЕ',
    category: 'pharma',
    dailyDose: 'по протоколу (2500–5000 МЕ 2×/нед)',
    mechanisms: ['reproductive_1', 'endocrine_2', 'reproductive_2'],
    synergy: '+Цинк/Селен: сперматогенез, восстановление HPTA',
    purchaseOptions: [
      { platform: 'apteka', url: 'https://apteka.ru/hcg', price: 850, currency: 'RUB', deliveryDays: 1 },
      { platform: 'eapteka', url: 'https://eapteka.ru/hcg', price: 890, currency: 'RUB', deliveryDays: 2 },
      { platform: 'ozon', url: 'https://ozon.ru/hcg', price: 920, currency: 'RUB', deliveryDays: 1 }
    ]
  },
  {
    id: 'zinc',
    name: 'Цинк Пиколинат 30 мг',
    category: 'vitamin',
    dailyDose: '1×30 мг вечер',
    mechanisms: ['reproductive_2', 'hematologic_2', 'endocrine_2'],
    synergy: '+Селен: фертильность, иммунитет; +ХГЧ: HPTA-восстановление',
    purchaseOptions: [
      { platform: 'iherb', url: 'https://iherb.com/zinc', price: 580, currency: 'RUB', deliveryDays: 7 },
      { platform: 'ozon', url: 'https://ozon.ru/zinc', price: 490, currency: 'RUB', deliveryDays: 2 },
      { platform: 'usmall', url: 'https://usmall.ru/zinc', price: 550, currency: 'RUB', deliveryDays: 10 }
    ]
  },
  {
    id: 'selenium',
    name: 'Селен 200 мкг (L-селенометионин)',
    category: 'vitamin',
    dailyDose: '1×200 мкг с едой',
    mechanisms: ['reproductive_3', 'hematologic_2', 'hepatic_2'],
    synergy: '+Цинк: сперматогенез, антиоксидантная защита; +Омега-3: репродукция',
    purchaseOptions: [
      { platform: 'iherb', url: 'https://iherb.com/selenium', price: 650, currency: 'RUB', deliveryDays: 7 },
      { platform: 'ozon', url: 'https://ozon.ru/selenium', price: 560, currency: 'RUB', deliveryDays: 2 },
      { platform: 'apteka', url: 'https://apteka.ru/selenium', price: 540, currency: 'RUB', deliveryDays: 1 }
    ]
  },
  {
    id: 'metformin',
    name: 'Метформин 500 мг ⚠️',
    category: 'pharma',
    dailyDose: '1×500 мг с едой (только по назначению)',
    mechanisms: ['glucose_1', 'glucose_2', 'endocrine_1'],
    synergy: '+Берберин: AMPK-синергия (⚠️ риск лактоацидоза — не комбинировать!)',
    purchaseOptions: [
      { platform: 'apteka', url: 'https://apteka.ru/metformin', price: 180, currency: 'RUB', deliveryDays: 1 },
      { platform: 'ozon', url: 'https://ozon.ru/metformin', price: 210, currency: 'RUB', deliveryDays: 1 },
      { platform: 'eapteka', url: 'https://eapteka.ru/metformin', price: 195, currency: 'RUB', deliveryDays: 2 }
    ]
  }
];