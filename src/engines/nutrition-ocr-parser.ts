import { FOOD_DB, type FoodItem } from '../core/nutrition-database';

export interface ParsedMeal {
  date: string;
  mealType: string;
  items: Array<{ name: string; qty: string; qtyGrams?: number; kcal: number; p: number; f: number; c: number; micros?: NutritionMicros; foodId?: string; category?: string; confidence?: number }>;
}

export type NutritionMicros = Record<string, number>;

function normalizeOcrArtifacts(text: string): string {
  return text
    .replace(/(\d)\s+(\d)\s+(\d)/g, '$1$2$3')
    .replace(/(\d)[,.](\d)[,.](\d)/g, '$1$2$3')
    .replace(/[\u2010\u2011\u2012\u2013\u2014\u2015]/g, '-')
    .replace(/[“”„‟«»]/g, '"')
    .replace(/[‘’‚‹›]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

const VERTICAL_NUTRIENT_LABELS: Array<[RegExp, string, string]> = [
  [/белки?|протеин|protein|\bp\b/i, 'p', 'г'],
  [/жиры?|fat|\bf\b/i, 'f', 'г'],
  [/углеводы?|угл|carb|carbs/i, 'c', 'г'],
  [/натрий|sodium|\bna\b/i, 'sodium_mg', 'мг'],
  [/калий|potassium|\bk\b/i, 'potassium_mg', 'мг'],
  [/магний|magnesium|\bmg\b/i, 'magnesium_mg', 'мг'],
  [/кальций|calcium|\bca\b/i, 'calcium_mg', 'мг'],
  [/железо|iron|\bfe\b/i, 'iron_mg', 'мг'],
  [/цинк|zinc|\bzn\b/i, 'zinc_mg', 'мг'],
  [/фосфор|phosphorus|\bp\b/i, 'phosphorus_mg', 'мг'],
  [/клетчатка|fiber/i, 'fiber_g', 'г'],
  [/витамин\s*a|vitamin\s*a|\bva\b/i, 'vitamin_a_mcg', 'мкг'],
  [/витамин\s*c|vitamin\s*c|\bvc\b/i, 'vitamin_c_mg', 'мг'],
  [/витамин\s*d|vitamin\s*d|\bvd\b/i, 'vitamin_d_mcg', 'мкг'],
  [/витамин\s*e|vitamin\s*e|\bve\b/i, 'vitamin_e_mg', 'мг'],
  [/витамин\s*k|vitamin\s*k|\bvk\b/i, 'vitamin_k_mcg', 'мкг'],
  [/витамин\s*b12|витамин\s*b12|\bb12\b/i, 'vitamin_b12_mcg', 'мкг'],
];

function parseVerticalNutrientLine(line: string): { key: string; value: number; unit: string } | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length < 2) return null;

  for (const [labelPattern, key, defaultUnit] of VERTICAL_NUTRIENT_LABELS) {
    const labelMatch = trimmed.match(new RegExp(`(${labelPattern.source})\\s*[:\\-]?\\s*(\\d+(?:[.,]\\d+)?)\\s*(мг|mg|мкг|mcg|г|g)?`, 'i'));
    if (labelMatch) {
      const value = numberFrom(labelMatch[2], 0);
      const unit = (labelMatch[3] || defaultUnit).toLowerCase();
      return { key, value, unit };
    }

    const reversedMatch = trimmed.match(new RegExp(`(\\d+(?:[.,]\\d+)?)\\s*(мг|mg|мкг|mcg|г|g)?\\s*[:\\-]?\\s*(${labelPattern.source})`, 'i'));
    if (reversedMatch) {
      const value = numberFrom(reversedMatch[1], 0);
      const unit = (reversedMatch[2] || defaultUnit).toLowerCase();
      return { key, value, unit };
    }
  }

  return null;
}

function convertVerticalValue(value: number, unit: string, key: string): number {
  const lowerUnit = unit.toLowerCase();
  if (lowerUnit === 'мкг' || lowerUnit === 'mcg') {
    if (key.endsWith('_mg')) return value / 1000;
    return value;
  }
  if (lowerUnit === 'г' || lowerUnit === 'g') {
    if (key.endsWith('_mg')) return value * 1000;
    if (key.endsWith('_mcg')) return value * 1000000;
    return value;
  }
  return value;
}

export function parseVerticalNutritionTable(text: string): NutritionMicros & { p?: number; f?: number; c?: number } {
  const lines = text.split(/\r?\n/).map(l => normalizeOcrArtifacts(l)).filter(l => l.trim().length > 1);
  const result: NutritionMicros & { p?: number; f?: number; c?: number } = {};

  for (const line of lines) {
    const parsed = parseVerticalNutrientLine(line);
    if (!parsed) continue;

    const convertedValue = convertVerticalValue(parsed.value, parsed.unit, parsed.key);

    if (parsed.key === 'p' || parsed.key === 'f' || parsed.key === 'c') {
      result[parsed.key] = convertedValue;
    } else {
      result[parsed.key] = convertedValue;
    }
  }

  return result;
}

const MICRO_LABELS: Array<[RegExp, string, string]> = [
  [/натри|sodium|\bna\b/i, 'sodium_mg', 'mg'], [/кали|potassium|\bk\b/i, 'potassium_mg', 'mg'],
  [/магни|magnesium|\bmg\b/i, 'magnesium_mg', 'mg'], [/кальци|calcium|\bca\b/i, 'calcium_mg', 'mg'],
  [/желез|iron|\bfe\b/i, 'iron_mg', 'mg'], [/цинк|zinc|\bzn\b/i, 'zinc_mg', 'mg'],
  [/фосфор|phosphorus|\bp\b/i, 'phosphorus_mg', 'mg'], [/витамин\s*a|vitamin\s*a|\bvit\.?\s*a\b/i, 'vitamin_a_mcg', 'mcg'],
  [/витамин\s*c|vitamin\s*c|\bvit\.?\s*c\b/i, 'vitamin_c_mg', 'mg'], [/витамин\s*d|vitamin\s*d|\bvit\.?\s*d\b/i, 'vitamin_d_mcg', 'mcg'],
  [/витамин\s*e|vitamin\s*e|\bvit\.?\s*e\b/i, 'vitamin_e_mg', 'mg'], [/витамин\s*k|vitamin\s*k|\bvit\.?\s*k\b/i, 'vitamin_k_mcg', 'mcg'],
  [/b12|витамин\s*b12|vitamin\s*b12/i, 'vitamin_b12_mcg', 'mcg'], [/клетчат|fiber/i, 'fiber_g', 'g'], [/сахар|sugar/i, 'sugar_g', 'g'],
];

export function parseMicroLine(line: string): NutritionMicros {
  const result: NutritionMicros = {};
  const keys: Record<string, string> = { натрий: 'sodium_mg', sodium: 'sodium_mg', na: 'sodium_mg', калий: 'potassium_mg', potassium: 'potassium_mg', k: 'potassium_mg', магний: 'magnesium_mg', magnesium: 'magnesium_mg', mg: 'magnesium_mg', кальций: 'calcium_mg', calcium: 'calcium_mg', ca: 'calcium_mg', железо: 'iron_mg', iron: 'iron_mg', fe: 'iron_mg', цинк: 'zinc_mg', zinc: 'zinc_mg', zn: 'zinc_mg', фосфор: 'phosphorus_mg', phosphorus: 'phosphorus_mg', p: 'phosphorus_mg' };
  for (const match of line.matchAll(/(натрий|sodium|na|калий|potassium|k|магний|magnesium|mg|кальций|calcium|ca|железо|iron|fe|цинк|zinc|zn|фосфор|phosphorus|p)\s*[:\-]?\s*(\d+(?:[.,]\d+)?)\s*(мг|mg|мкг|mcg|г|g)?/gi)) {
    const value = numberFrom(match[2], 0);
    const unit = (match[3] || 'mg').toLowerCase();
    result[keys[match[1].toLowerCase()]] = Math.round((unit === 'г' || unit === 'g' ? value * 1000 : value) * 100) / 100;
  }
  const vitamins: Array<[RegExp, string, string]> = [
    [/vit(?:amin)?\s*a|витамин\s*a|\bva\b/i, 'vitamin_a_mcg', 'mcg'],
    [/vit(?:amin)?\s*c|витамин\s*c|\bvc\b/i, 'vitamin_c_mg', 'mg'],
    [/vit(?:amin)?\s*d|витамин\s*d|\bvd\b/i, 'vitamin_d_mcg', 'mcg'],
    [/vit(?:amin)?\s*e|витамин\s*e|\bve\b/i, 'vitamin_e_mg', 'mg'],
    [/vit(?:amin)?\s*k|витамин\s*k|\bvk\b/i, 'vitamin_k_mcg', 'mcg'],
    [/vit(?:amin)?\s*b12|витамин\s*b12|\bb12\b/i, 'vitamin_b12_mcg', 'mcg'],
  ];
  for (const [label, key, defaultUnit] of vitamins) {
    const match = line.match(new RegExp(`(?:${label.source})\\s*[:\\-]?\\s*(\\d+(?:[.,]\\d+)?)\\s*(мг|mg|мкг|mcg|г|g)?`, 'i'));
    if (!match) continue;
    const value = numberFrom(match[1], 0);
    const unit = (match[2] || defaultUnit).toLowerCase();
    result[key] = Math.round((unit === 'г' || unit === 'g' ? value * 1000 : value) * 100) / 100;
  }
  for (const [label, key, defaultUnit] of MICRO_LABELS) {
    const match = line.match(new RegExp(`(?:${label.source})\\s*[:\\-]?\\s*(\\d+(?:[.,]\\d+)?)\\s*(мг|mg|мкг|mcg|г|g)?`, 'i'));
    if (!match) continue;
    const value = numberFrom(match[1], 0);
    const unit = (match[2] || defaultUnit).toLowerCase();
    result[key] = Math.round((unit === 'г' || unit === 'g' ? value * 1000 : value) * 100) / 100;
  }
  return result;
}

// More resilient regex patterns for messy OCR text
const FATSECRET_ITEM_REGEX = /^\s*(.+?)\s+(\d+(?:[.,]\d+)?(?:\s+\d+)*)\s*(г|мл|шт|кусок|порция|сервинг|ст\.л\.|ч\.л\.|oz|ml|g|serving|slice|cup|tbsp|tsp)?\s*[,/]?\s*(\d+(?:[.,]\d+)?(?:\s+\d+)*)\s*(ккал|кал|kcal)/i;
const FATSECRET_TOTAL_REGEX = /итого|всего|total|daily\s+total|сумма|итог/i;
const FATSUCCESS_MACRO_LINE = /(\d+(?:[.,]\d+)?(?:\s+\d+)*)\s*(ккал|кал|kcal|белки?|жиры?|углевод|угл|жиры|бел|протеин|б|ж|у|carb|protein|fat|calori|cal|energy)/gi;
const MFP_LINE_REGEX = /^(.+?)\s+(\d+(?:[.,]\d+)?)\s*(?:(?:г|мл|шт|oz|serving|srvg|slice|cup|tbsp|шт|кус|порц|ml|g|pcs)[,.]?\s*)?(\d+(?:[.,]\d+)?)\s*(ккал|кал|kcal|cal)/i;
const INLINE_MACRO_REGEX = /(?:белки?|б|протеин|protein|p)\s*[:\-]?\s*(\d+(?:\s+\d+)*(?:[.,]\d+)?)/i;
const INLINE_FAT_REGEX = /(?:жиры?|ж|fat|f)\s*[:\-]?\s*(\d+(?:\s+\d+)*(?:[.,]\d+)?)/i;
const INLINE_CARB_REGEX = /(?:углевод|угл|у|carb|c|carbs)\s*[:\-]?\s*(\d+(?:\s+\d+)*(?:[.,]\d+)?)/i;
const KCAL_FIRST_REGEX = /^\s*(\d+(?:[.,]\d+)?)\s*(ккал|кал|kcal)\s+(.+?)(?:\s+(\d+(?:[.,]\d+)?)\s*(г|мл|шт|g|ml))?$/i;
// FatSecret screenshots can lose the P/F/C captions and leave numeric macro
// columns after calories: "Chicken 200 g 330 kcal 40 10 0".
const UNLABELED_MACRO_ROW_REGEX = /^(.+?)\s+(\d+(?:[.,]\d+)?)\s*(г|мл|шт|g|ml|oz|serving|порц(?:ия|ии)?)\s+(\d+(?:[.,]\d+)?)\s*(?:ккал|кал|kcal|cal)\s+(\d+(?:[.,]\d+)?)\s+(\d+(?:[.,]\d+)?)\s+(\d+(?:[.,]\d+)?)(?:\s|$)/i;

const RUSSIAN_FOOD_NAMES: Record<string, string> = {
  'куриная грудка': 'chicken_breast', 'курица': 'chicken_breast', 'грудка куриная': 'chicken_breast',
  'говядина': 'beef_lean', 'стейк': 'beef_lean', 'говяжий': 'beef_lean',
  'лосось': 'salmon', 'семга': 'salmon', 'рыба': 'salmon',
  'рис': 'rice_white', 'рис белый': 'rice_white', 'рис бурый': 'rice_brown',
  'гречка': 'buckwheat', 'гречневая каша': 'buckwheat',
  'овсянка': 'oats', 'овсяные хлопья': 'oats', 'капуста овсяная': 'oats',
  'яйца': 'egg_whole', 'яйцо': 'egg_whole', 'яичный белок': 'egg_white',
  'творог': 'cottage_cheese_5', 'творог 5%': 'cottage_cheese_5',
  'банан': 'banana', 'яблоко': 'apple', 'брокколи': 'broccoli',
  'макароны': 'pasta_durum', 'паста': 'pasta_durum',
  'картофель': 'potato_boiled', 'картошка': 'potato_boiled',
  'хлеб ржаной': 'bread_rye', 'хлеб': 'bread_rye',
  'кефир': 'kefir', 'молоко': 'milk', 'сыр': 'cheese_hard',
  'орехи': 'nuts_mix', 'грецкие орехи': 'nuts_mix', 'миндаль': 'nuts_mix',
  'авокадо': 'avocado', 'шпинат': 'spinach', 'огурец': 'cucumber',
  'помидор': 'tomato', 'томат': 'tomato', 'перец': 'pepper',
  'масло оливковое': 'olive_oil', 'оливковое масло': 'olive_oil',
  'сельдь': 'fish_oil_food', 'скумбрия': 'fish_oil_food',
  'протеин': 'whey_protein', 'сывороточный протеин': 'whey_protein',
  'казеин': 'casein', 'креатин': 'creatine',
  'индейка': 'turkey_breast', 'свинина': 'pork_tenderloin',
  'тунец': 'tuna_canned', 'тунец консервированный': 'tuna_canned',
  'батат': 'sweet_potato', 'ягоды': 'berries',
  'семена льна': 'seeds', 'чиа': 'seeds',
  'сливочное масло': 'butter', 'масло сливочное': 'butter',
  'йогурт': 'yogurt_greek', 'греческий йогурт': 'yogurt_greek',
  'шаурма': 'shawarma', 'пицца': 'pizza_margherita', 'бургер': 'burger',
};

function matchRussianFood(text: string): string | null {
  const lower = normalizeFoodText(text);
  for (const [ru, id] of Object.entries(RUSSIAN_FOOD_NAMES)) {
    if (lower.includes(normalizeFoodText(ru))) return id;
  }
  return null;
}

function normalizeFoodText(text: string): string {
  const latinToCyrillic: Record<string, string> = {
    'A': 'а', 'a': 'а',
    'B': 'б', 'b': 'б',
    'C': 'с', 'c': 'с',
    'E': 'е', 'e': 'е',
    'H': 'н', 'h': 'н',
    'K': 'к', 'k': 'к',
    'M': 'м', 'm': 'м',
    'N': 'и', 'n': 'и',
    'O': 'о', 'o': 'о',
    'P': 'р', 'p': 'р',
    'T': 'т', 't': 'т',
    'X': 'х', 'x': 'х',
    'y': 'у',
    '0': 'о',
    '1': 'и',
    '3': 'з',
    '6': 'б',
    '8': 'в',
  };
  return text.toLowerCase().split('').map(ch => latinToCyrillic[ch] || ch).join('').replace(/ё/g, 'е').replace(/[^a-zа-я0-9]+/gi, ' ').trim();
}

function editDistance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diagonal = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const above = row[j];
      row[j] = a[i - 1] === b[j - 1]
        ? diagonal
        : Math.min(diagonal + 1, row[j] + 1, row[j - 1] + 1);
      diagonal = above;
    }
  }
  return row[b.length];
}

/** Matches OCR names to the local food database, including partial word matches. */
export function findFood(name: string): FoodItem | undefined {
  const query = normalizeFoodText(name);
  if (!query) return undefined;
  const directId = matchRussianFood(name);
  if (directId) {
    const byId = FOOD_DB.find(food => food.id === directId);
    if (byId) return byId;
  }
  const words = query.split(/\s+/).filter(word => word.length > 2);
  return FOOD_DB
    .map(food => {
      const foodWords = normalizeFoodText(food.name).split(/\s+/);
      const score = words.reduce((total, word) => total + (foodWords.some(candidate => candidate.includes(word) || (candidate.length >= 3 && word.includes(candidate)) || (word.length >= 5 && candidate.length >= 5 && editDistance(word, candidate) <= 1)) ? 1 : 0), 0);
      return { food, score };
    })
    .filter(result => result.score > 0)
    .sort((a, b) => b.score - a.score || a.food.name.length - b.food.name.length)[0]?.food;
}

function numberFrom(text: string | undefined, fallback: number): number {
  const value = Number.parseFloat((text || '').replace(/,/g, '.').replace(/\s+/g, ''));
  return Number.isFinite(value) ? value : fallback;
}

function foodMicrosPer100(food?: FoodItem): NutritionMicros {
  const source = food?.micros || {};
  const map: Record<string, string> = { Ca: 'calcium_mg', Fe: 'iron_mg', Mg: 'magnesium_mg', P: 'phosphorus_mg', K: 'potassium_mg', Na: 'sodium_mg', Zn: 'zinc_mg', Se: 'selenium_mcg', VitA: 'vitamin_a_mcg', VitC: 'vitamin_c_mg', VitD: 'vitamin_d_mcg', VitE: 'vitamin_e_mg', VitK: 'vitamin_k_mcg', VitB12: 'vitamin_b12_mcg' };
  return Object.entries(map).reduce<NutritionMicros>((out, [from, to]) => {
    const value = source[from];
    if (typeof value === 'number' && Number.isFinite(value)) out[to] = value;
    return out;
  }, {});
}

export function fillMissingMicros(name: string, grams: number, existing: NutritionMicros = {}): NutritionMicros {
  const food = findFood(name);
  if (!food || !Number.isFinite(grams) || grams <= 0) return { ...existing };
  const factor = grams / 100;
  return Object.entries(foodMicrosPer100(food)).reduce<NutritionMicros>((out, [key, value]) => {
    if (out[key] === undefined) out[key] = Math.round(value * factor * 100) / 100;
    return out;
  }, { ...existing });
}

export function quantityToGrams(qty: string, food?: FoodItem): number {
  const value = numberFrom(qty, 100);
  const unit = qty.toLowerCase();
  if (/шт|pcs?|piece|яиц/.test(unit)) {
    if (food?.id.includes('egg')) return value * 50;
    if (food?.id.includes('banana')) return value * 120;
    if (food?.id.includes('apple')) return value * 180;
    return value * 100;
  }
  if (/ст\.?\s*л|tbsp/.test(unit)) return value * 15;
  if (/ч\.?\s*л|tsp/.test(unit)) return value * 5;
  return value;
}

function normalizeItem(name: string, qty: string, kcal: number, p: number, f: number, c: number, micros: NutritionMicros = {}) {
  const food = findFood(name);
  const weight = Math.max(1, quantityToGrams(qty, food));
  const multiplier = weight / 100;
  const hasMacros = kcal > 0 || p > 0 || f > 0 || c > 0;
  const confidence = food
    ? (hasMacros ? 0.9 : 0.7)
    : (hasMacros ? 0.5 : 0.3);
  return {
    name: name || food?.name || 'Блюдо',
    qty,
    qtyGrams: Math.round(weight),
    kcal: hasMacros ? Math.round((kcal || (food?.kcal || 0) * multiplier) / multiplier) : food?.kcal || 0,
    p: hasMacros ? Math.round((p || (food?.protein || 0) * multiplier) / multiplier * 10) / 10 : food?.protein || 0,
    f: hasMacros ? Math.round((f || (food?.fat || 0) * multiplier) / multiplier * 10) / 10 : food?.fat || 0,
    c: hasMacros ? Math.round((c || (food?.carbs || 0) * multiplier) / multiplier * 10) / 10 : food?.carbs || 0,
    micros,
    foodId: food?.id,
    category: food?.category,
    confidence: Math.round(confidence * 100) / 100,
  };
}

function attachMicros(meal: ParsedMeal | null, line: string): boolean {
  if (!meal || meal.items.length === 0) return false;
  const micros = parseMicroLine(line);
  if (Object.keys(micros).length === 0) return false;
  const looksLikeMicroRow = /^(?:натри|кали|магни|кальци|желез|цинк|фосфор|витамин|vitamin|vit\b|b12\b|sodium|potassium|magnesium|calcium|iron|zinc|fiber|клетчат|na\b|k\b|mg\b|ca\b|fe\b|zn\b|p\b)/i.test(line.trim()) || Object.keys(micros).length >= 2;
  if (looksLikeMicroRow) {
    const item = meal.items[meal.items.length - 1];
    item.micros = { ...(item.micros || {}), ...micros };
    return true;
  }
  return false;
}

function parseMicroTableHeader(line: string): string[] {
  if (/\d/.test(line)) return [];
  const defaults: Array<[RegExp, string, string]> = [
    [/sodium|натри|\bna\b/i, 'sodium', 'mg'], [/potassium|кали|\bk\b/i, 'potassium', 'mg'],
    [/magnesium|магни|\bmg\b/i, 'magnesium', 'mg'], [/calcium|кальци|\bca\b/i, 'calcium', 'mg'],
    [/iron|желез|\bfe\b/i, 'iron', 'mg'], [/zinc|цинк|\bzn\b/i, 'zinc', 'mg'],
    [/phosphorus|фосфор|\bp\b/i, 'phosphorus', 'mg'], [/vit(?:amin)?\s*a|витамин\s*a/i, 'vitamin_a', 'mcg'],
    [/vit(?:amin)?\s*c|витамин\s*c/i, 'vitamin_c', 'mg'], [/vit(?:amin)?\s*d|витамин\s*d/i, 'vitamin_d', 'mcg'],
    [/vit(?:amin)?\s*e|витамин\s*e/i, 'vitamin_e', 'mg'], [/vit(?:amin)?\s*k|витамин\s*k/i, 'vitamin_k', 'mcg'],
    [/vit(?:amin)?\s*b12|витамин\s*b12|\bb12\b/i, 'vitamin_b12', 'mcg'],
  ];
  return defaults.map(([pattern, base, defaultUnit]) => {
    const match = line.match(new RegExp(`(${pattern.source})\\s*\\(\\s*(мг|mg|мкг|mcg|г|g)\\s*\\)`, 'i'));
    const unit = match ? match[2].toLowerCase() : defaultUnit;
    const suffix = unit === 'г' || unit === 'g' ? '_g' : unit === 'мкг' || unit === 'mcg' ? '_mcg' : '_mg';
    return `${base}${suffix}`;
  });
}

function parseMicroTableValues(line: string, keys: string[]): NutritionMicros {
  if (keys.length === 0 || !/^[\d\s,.;|+\-—–]+(?:\s*(?:mg|мг|mcg|мкг))?$/i.test(line.trim())) return {};
  const cells = line.split(/[\s,;|]+/).filter(Boolean);
  return keys.reduce<NutritionMicros>((out, key, index) => {
    const cell = cells[index];
    if (!cell || /^[—–-]+$/.test(cell)) return out;
    const value = numberFrom(cell, NaN);
    if (Number.isFinite(value)) out[key] = value;
    return out;
  }, {});
}

function parseDelimitedItem(line: string) {
  const parts = line.split(/[;\t|]/).map(part => part.trim()).filter(Boolean);
  if (parts.length < 4) return null;
  const name = parts[0];
  const quantity = parts[1]?.match(/^(\d+(?:[.,]\d+)?)\s*(г|мл|шт|g|ml|pcs?)?$/i);
  const numbers = parts.slice(quantity ? 2 : 1)
    .map(part => Number.parseFloat(part.replace(',', '.')))
    .filter(value => Number.isFinite(value));
  if (!name || !quantity || numbers.length < 3) return null;
  const [kcal, p, f, c = 0] = numbers;
  return normalizeItem(name, `${quantity[1]} ${quantity[2] || 'г'}`, kcal, p, f, c);
}

function dedupeMeals(meals: ParsedMeal[]): ParsedMeal[] {
  const grouped = new Map<string, ParsedMeal>();
  for (const meal of meals) {
    const key = `${meal.date}|${normalizeFoodText(meal.mealType)}`;
    const existing = grouped.get(key);
    if (existing) existing.items.push(...meal.items);
    else grouped.set(key, { ...meal, items: [...meal.items] });
  }
  return [...grouped.values()].map(meal => ({
    ...meal,
    items: meal.items.filter((item, index, all) => {
      const key = [item.foodId || normalizeFoodText(item.name), item.qtyGrams || item.qty].join('|');
      const duplicate = all.findIndex(candidate => [candidate.foodId || normalizeFoodText(candidate.name), candidate.qtyGrams || candidate.qty].join('|') === key);
      if (duplicate !== index) {
        all[duplicate].micros = { ...(all[duplicate].micros || {}), ...(item.micros || {}) };
        return false;
      }
      return true;
    }),
  })).filter(meal => meal.items.length > 0);
}

function parseMacroValue(text: string, patterns: RegExp[]): { kcal: number; p: number; f: number; c: number } {
  const result = { kcal: 0, p: 0, f: 0, c: 0 };
  for (const pattern of patterns) {
    let m: RegExpExecArray | null;
    pattern.lastIndex = 0;
    while ((m = pattern.exec(text)) !== null) {
      const rawVal = m[1].replace(/\s+/g, '').replace(',', '.');
      const val = parseFloat(rawVal);
      const unit = m[2].toLowerCase();
      if (/ккал|кал|cal/i.test(unit)) result.kcal = val;
      else if (/бел|прот|б|protein/i.test(unit)) result.p = val;
      else if (/жир|ж|fat/i.test(unit)) result.f = val;
      else if (/угл|карб|у|carb/i.test(unit)) result.c = val;
    }
  }
  return result;
}

export function parseNutritionScreenshot(text: string): ParsedMeal[] {
  const lines = text.split(/\r?\n/).map(l => normalizeOcrArtifacts(l)).filter(l => l.trim().length > 2);
  const meals: ParsedMeal[] = [];
  let currentMeal: ParsedMeal | null = null;
  let microTableKeys: string[] = [];

  const dateRegex = /(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})/;
  const mealRegex = /(завтрак|обед|ужин|перекус|бранч|полдник|snack|lunch|dinner|breakfast|перекус\s*\d)/i;
  const totalRegex = /итого|всего|total|daily\s*total|дневная|дневной/i;
  const macroPattern = FATSUCCESS_MACRO_LINE;

  for (const line of lines) {
    if (totalRegex.test(line)) continue;

    const dateMatch = line.match(dateRegex);
    if (dateMatch && !currentMeal) {
      currentMeal = { date: dateMatch[0], mealType: 'Общее', items: [] };
      meals.push(currentMeal);
    }

    const mealMatch = line.match(mealRegex);
    if (mealMatch) {
      currentMeal = { date: currentMeal?.date || new Date().toISOString().slice(0, 10), mealType: mealMatch[0], items: [] };
      meals.push(currentMeal);
    }

    if (!currentMeal) {
      currentMeal = { date: new Date().toISOString().slice(0, 10), mealType: 'Общее', items: [] };
      meals.push(currentMeal);
    }

    const tableHeader = parseMicroTableHeader(line);
    if (tableHeader.length >= 2) { microTableKeys = tableHeader; continue; }
    const tableMicros = parseMicroTableValues(line, microTableKeys);
    if (Object.keys(tableMicros).length > 0 && currentMeal.items.length > 0) {
      const item = currentMeal.items[currentMeal.items.length - 1];
      item.micros = { ...(item.micros || {}), ...tableMicros };
      continue;
    }

    if (attachMicros(currentMeal, line)) continue;

    const unlabeledMacroItem = parseUnlabeledMacroRow(line);
    if (unlabeledMacroItem) {
      currentMeal.items.push(unlabeledMacroItem);
      continue;
    }

    const delimitedItem = parseDelimitedItem(line);
    if (delimitedItem) {
      currentMeal.items.push(delimitedItem);
      continue;
    }

    const fsMatch = line.match(FATSECRET_ITEM_REGEX);
    if (fsMatch) {
      const name = fsMatch[1].trim();
      const qtyStr = fsMatch[2] ? `${fsMatch[2]} ${fsMatch[3] || 'г'}` : '100 г';
       const macros = parseMacroValue(line, [macroPattern]);
       const kcal = numberFrom(fsMatch[4], macros.kcal || 0);
      currentMeal.items.push(normalizeItem(name, qtyStr, kcal, macros.p, macros.f, macros.c));
      continue;
    }

    const mfpMatch = line.match(MFP_LINE_REGEX);
    if (mfpMatch) {
      const name = mfpMatch[1].trim();
       const kcal = numberFrom(mfpMatch[3], 0);
      const qtyStr = mfpMatch[2] ? `${mfpMatch[2]} г` : '100 г';
      const macros = parseMacroValue(line, [macroPattern]);
       currentMeal.items.push(normalizeItem(name, qtyStr, kcal || macros.kcal, macros.p, macros.f, macros.c));
      continue;
    }

    // Fallback: try to parse macros from line directly
    const macros = parseMacroValue(line, [macroPattern]);
    if (macros.kcal > 0 || macros.p > 0 || macros.f > 0 || macros.c > 0) {
      // Try to extract name (text before first number)
      const nameMatch = line.match(/^(.+?)\s*\d/);
      const name = nameMatch ? nameMatch[1].trim() : 'Неизвестно';
      const qtyMatch = line.match(/(\d+(?:[.,]\d+)?)\s*(г|мл|шт|кусок|ложк|порц)/i);
      const qty = qtyMatch ? qtyMatch[0] : '100 г';
      currentMeal.items.push(normalizeItem(name, qty, macros.kcal, macros.p, macros.f, macros.c));
    }

    const foodOnlyMatch = line.match(/^(.+?)\s+(\d+(?:[.,]\d+)?)\s*(г|мл|g|ml)$/i);
    if (foodOnlyMatch && findFood(foodOnlyMatch[1])) {
      const candidateName = foodOnlyMatch[1].trim();
      const looksLikeNutrientLabel = /^(?:белки?|жиры?|углеводы?|натрий|калий|магний|кальций|железо|цинк|фосфор|клетчатка|витамин|sodium|potassium|magnesium|calcium|iron|zinc|fiber|phosphorus|protein|fat|carb)/i.test(candidateName);
      if (!looksLikeNutrientLabel) {
        currentMeal.items.push(normalizeItem(candidateName, `${foodOnlyMatch[2]} ${foodOnlyMatch[3]}`, 0, 0, 0, 0));
      }
    }
  }

  return attachVerticalTableIfEmpty(dedupeMeals(meals), text);
}

function parseMacroLabel(text: string): { p: number; f: number; c: number } {
  const p = text.match(INLINE_MACRO_REGEX);
  const f = text.match(INLINE_FAT_REGEX);
  const c = text.match(INLINE_CARB_REGEX);
  return {
    p: p ? parseFloat(p[1].replace(/\s+/g, '').replace(',', '.')) : 0,
    f: f ? parseFloat(f[1].replace(/\s+/g, '').replace(',', '.')) : 0,
    c: c ? parseFloat(c[1].replace(/\s+/g, '').replace(',', '.')) : 0,
  };
}

function parseUnlabeledMacroRow(line: string): ParsedMeal['items'][number] | null {
  const match = line.match(UNLABELED_MACRO_ROW_REGEX);
  if (!match) return null;
  const [, name, qty, unit, kcal, p, f, c] = match;
  return normalizeItem(name.trim(), `${numberFrom(qty, 100)} ${unit}`, numberFrom(kcal, 0), numberFrom(p, 0), numberFrom(f, 0), numberFrom(c, 0));
}

export function parseFatSecretText(text: string): ParsedMeal[] {
  const lines = text.split(/\r?\n/).map(l => normalizeOcrArtifacts(l)).filter(l => l.trim().length > 1);
  const meals: ParsedMeal[] = [];
  let currentMeal: ParsedMeal | null = null;
  let microTableKeys: string[] = [];
  let currentDate = new Date().toISOString().slice(0, 10);

  for (const line of lines) {
    const totalCheck = /итого|всего|total|дневной|сумма|итог|daily\s*total/i.test(line);
    if (totalCheck) continue;

    const dateMatch = line.match(/(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})/);
    if (dateMatch) currentDate = dateMatch[0];

    const mealMatch = line.match(/(завтрак|обед|ужин|перекус|бранч|полдник|snack|breakfast|lunch|dinner)/i);
    if (mealMatch) {
      currentMeal = { date: currentDate, mealType: mealMatch[1], items: [] };
      meals.push(currentMeal);
    }

    if (!currentMeal) {
      currentMeal = { date: currentDate, mealType: 'Приём пищи', items: [] };
      meals.push(currentMeal);
    }

    const tableHeader = parseMicroTableHeader(line);
    if (tableHeader.length >= 2) { microTableKeys = tableHeader; continue; }
    const tableMicros = parseMicroTableValues(line, microTableKeys);
    if (Object.keys(tableMicros).length > 0 && currentMeal.items.length > 0) {
      const item = currentMeal.items[currentMeal.items.length - 1];
      item.micros = { ...(item.micros || {}), ...tableMicros };
      continue;
    }

    if (attachMicros(currentMeal, line)) continue;

    const unlabeledMacroItem = parseUnlabeledMacroRow(line);
    if (unlabeledMacroItem) {
      currentMeal.items.push(unlabeledMacroItem);
      continue;
    }

    const delimitedItem = parseDelimitedItem(line);
    if (delimitedItem) {
      currentMeal.items.push(delimitedItem);
      continue;
    }

    // Try: kcal first format — "150 kcal Chicken breast 200g"
    const kcalFirst = line.match(KCAL_FIRST_REGEX);
    if (kcalFirst) {
       const kcal = numberFrom(kcalFirst[1], 0);
       const name = kcalFirst[3]?.trim() || 'Блюдо';
       const macros = parseMacroLabel(line);
       const qty = kcalFirst[4] ? `${kcalFirst[4]} ${kcalFirst[5] || 'г'}` : '100 г';
       currentMeal.items.push(normalizeItem(name, qty, kcal, macros.p, macros.f, macros.c));
      continue;
    }

    // Try: "Name 200g 300kcal P:20 F:10 C:30" or "Name 200 г 300 ккал Б:20 Ж:10 У:30"
    const weightKcalMatch = line.match(/(.+?)\s+(\d+(?:[.,]\d+)?)\s*(г|ml|g|мл|шт|oz)?\s+(\d+)\s*(ккал|kcal|кал)/i);
    if (weightKcalMatch) {
      const name = weightKcalMatch[1].trim();
      const weight = parseFloat(weightKcalMatch[2]?.replace(',', '.') || '100');
       const kcal = numberFrom(weightKcalMatch[4], 0);
      const macros = parseMacroLabel(line);
      const mult = weight > 0 ? weight / 100 : 1;
      currentMeal.items.push(normalizeItem(name || 'Блюдо', weight > 0 ? `${weight} ${weightKcalMatch[3] || 'г'}` : '100 г', kcal, macros.p, macros.f, macros.c));
      continue;
    }

    // Try FatSecret export format: "Chicken Breast, 200 g, 330 kcal"
    const fsMatch = line.match(FATSECRET_ITEM_REGEX);
    if (fsMatch) {
      const name = fsMatch[1].trim();
       const weight = numberFrom(fsMatch[2], 100);
       const kcal = numberFrom(fsMatch[4], 0);
      const macros = parseMacroLabel(line);
      const mult = weight > 0 ? weight / 100 : 1;
       currentMeal.items.push(normalizeItem(name, weight > 0 ? `${weight} ${fsMatch[3] || 'г'}` : '100 г', kcal, macros.p, macros.f, macros.c));
      continue;
    }

    // Fallback: line with kcal only
      const kcalMatch = line.match(/(\d+(?:[.,]\d+)?)\s*(ккал|kcal|кал)/i);
    if (kcalMatch) {
      const namePart = line.replace(kcalMatch[0], '').replace(/^[\s\-–—•·*,:;]+/, '').replace(/[\s\-–—•·*,:;]+$/, '').trim() || 'Блюдо';
      const qtyMatch = line.match(/(\d+(?:[.,]\d+)?)\s*(г|ml|g|мл|шт|порц|кусок|oz|slice|serving)/i);
      const macros = parseMacroLabel(line);
      const mult = qtyMatch ? parseFloat(qtyMatch[1].replace(',', '.')) / 100 : 1;
      currentMeal.items.push(normalizeItem(namePart, qtyMatch ? qtyMatch[0] : '100 г', numberFrom(kcalMatch[1], 0), macros.p, macros.f, macros.c));
      continue;
    }

    const foodOnlyMatch = line.match(/^(.+?)\s+(\d+(?:[.,]\d+)?)\s*(г|мл|g|ml)$/i);
    if (foodOnlyMatch && findFood(foodOnlyMatch[1])) {
      const candidateName = foodOnlyMatch[1].trim();
      const looksLikeNutrientLabel = /^(?:белки?|жиры?|углеводы?|натрий|калий|магний|кальций|железо|цинк|фосфор|клетчатка|витамин|sodium|potassium|magnesium|calcium|iron|zinc|fiber|phosphorus|protein|fat|carb)/i.test(candidateName);
      if (!looksLikeNutrientLabel) {
        currentMeal.items.push(normalizeItem(
          candidateName,
          `${foodOnlyMatch[2]} ${foodOnlyMatch[3]}`,
          0, 0, 0, 0,
        ));
      }
    }
  }

  return attachVerticalTableIfEmpty(dedupeMeals(meals), text);
}

function attachVerticalTableIfEmpty(meals: ParsedMeal[], text: string): ParsedMeal[] {
  const hasItems = meals.some(meal => meal.items.length > 0);
  if (hasItems) return meals;

  const vertical = parseVerticalNutritionTable(text);
  const keys = Object.keys(vertical);
  if (keys.length === 0) return meals;

  const date = meals[0]?.date || new Date().toISOString().slice(0, 10);
  const mealType = meals[0]?.mealType || 'Общее';
  const item: any = { name: 'Блюдо', qty: '100 г', kcal: 0, p: 0, f: 0, c: 0, micros: {} };

  for (const [key, value] of Object.entries(vertical)) {
    if (key === 'p') item.p = value;
    else if (key === 'f') item.f = value;
    else if (key === 'c') item.c = value;
    else item.micros[key] = value;
  }

  return [{ date, mealType, items: [item] }];
}

/** Parse OCR/export text through both formats and keep the most complete result. */
export function parseNutritionText(text: string): ParsedMeal[] {
  const screenshotMeals = parseNutritionScreenshot(text);
  const exportMeals = parseFatSecretText(text);
  const merged = [...screenshotMeals, ...exportMeals];
  return dedupeMeals(merged);
}
