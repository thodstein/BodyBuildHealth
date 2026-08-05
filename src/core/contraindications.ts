const STORAGE_KEY = 'he_contraindications';

export interface ContraindicationsData {
  chronicConditions: string[];
  foodAllergies: string[];
  foodIntolerances: string[];
  excludedFoods: string[];
  allergyNotes: string;
  organWeaknesses: string[];
  geneticPolymorphisms: string[];
  bpRisk: 'low' | 'medium' | 'high';
  lastUpdated: string;
}

const DEFAULTS: ContraindicationsData = {
  chronicConditions: [],
  foodAllergies: [],
  foodIntolerances: [],
  excludedFoods: [],
  allergyNotes: '',
  organWeaknesses: [],
  geneticPolymorphisms: [],
  bpRisk: 'low',
  lastUpdated: '',
};

/**
 * @deprecated Считывание из устаревшего localStorage ключа. Сохранено для backward-compat
 * с модулями, которые ещё не мигрировали на чтение из useProfile().
 * ВСЕ новые модули должны читать из UnifiedSettings напрямую.
 */
export function getContraindications(): ContraindicationsData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {}
  return { ...DEFAULTS };
}

/**
 * @deprecated Сохранение в устаревший localStorage ключ. ВСЕ новые модули должны
 * использовать useProfile().update('health', {...}) или useProfile().update('nutrition', {...}).
 * После миграции ключ удаляется из localStorage автоматически.
 */
export function saveContraindications(data: Partial<ContraindicationsData>) {
  const current = getContraindications();
  const updated = { ...current, ...data, lastUpdated: new Date().toISOString() };
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(updated)); } catch {}
}

/**
 * @deprecated Использовать useProfile() напрямую.
 */
export function mergeProfileToContraindications(profileSettings: any): ContraindicationsData {
  const current = getContraindications();
  const merged: ContraindicationsData = {
    ...current,
    chronicConditions: profileSettings?.chronicConditions || current.chronicConditions,
    foodAllergies: profileSettings?.foodAllergies || current.foodAllergies,
    foodIntolerances: profileSettings?.foodIntolerances || current.foodIntolerances,
    excludedFoods: profileSettings?.excludedFoods || current.excludedFoods,
    allergyNotes: profileSettings?.allergyNotes || current.allergyNotes,
    lastUpdated: new Date().toISOString(),
  };
  return merged;
}

export const CHRONIC_CONDITIONS_LIST = [
  { id: 'hypertension', label: 'Гипертония' },
  { id: 'diabetes', label: 'Диабет / Преддиабет' },
  { id: 'asthma', label: 'Астма' },
  { id: 'thyroid', label: 'Щитовидная железа' },
  { id: 'heart', label: 'Сердечно-сосудистые' },
  { id: 'liver', label: 'Заболевания печени' },
  { id: 'kidney', label: 'Заболевания почек' },
  { id: 'joints', label: 'Заболевания суставов' },
  { id: 'gout', label: 'Подагра' },
  { id: 'gi_issues', label: 'Проблемы с ЖКТ' },
  { id: 'kidney_stones', label: 'Камни в почках' },
  { id: 'oedema', label: 'Отёки' },
];

export const ALLERGEN_LIST = [
  { id: 'lactose', label: 'Лактоза' },
  { id: 'gluten', label: 'Глютен' },
  { id: 'nuts', label: 'Орехи' },
  { id: 'peanuts', label: 'Арахис' },
  { id: 'eggs', label: 'Яйца' },
  { id: 'soy', label: 'Соя' },
  { id: 'fish', label: 'Рыба' },
  { id: 'shellfish', label: 'Морепродукты' },
  { id: 'dairy', label: 'Молочные' },
  { id: 'sesame', label: 'Кунжут' },
  { id: 'celery', label: 'Сельдерей' },
  { id: 'mustard', label: 'Горчица' },
  { id: 'sulfites', label: 'Сульфиты' },
  { id: 'lupin', label: 'Люпин' },
];

export const ORGAN_WEAKNESSES = [
  { id: 'liver', label: 'Печень' },
  { id: 'kidney', label: 'Почки' },
  { id: 'heart', label: 'Сердце' },
  { id: 'stomach', label: 'Желудок' },
  { id: 'intestine', label: 'Кишечник' },
  { id: 'pancreas', label: 'Поджелудочная' },
  { id: 'thyroid', label: 'Щитовидная' },
];

export const GENETIC_POLYMORPHISMS = [
  { id: 'comt', label: 'COMT Val158Met' },
  { id: 'mthfr', label: 'MTHFR C677T' },
  { id: 'esr1', label: 'ESR1 PvuII' },
  { id: 'agtr1', label: 'AGTR1 A1166C' },
  { id: 'nos3', label: 'NOS3 G894T' },
  { id: 'cyp3a4', label: 'CYP3A4' },
];
