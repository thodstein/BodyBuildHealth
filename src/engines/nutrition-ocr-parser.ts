import { FOOD_DB, type FoodItem } from '../core/nutrition-database';

export interface ParsedMeal {
  date: string;
  mealType: string;
  items: Array<{ name: string; qty: string; qtyGrams?: number; kcal: number; p: number; f: number; c: number; foodId?: string; category?: string }>;
}

// More resilient regex patterns for messy OCR text
const FATSECRET_ITEM_REGEX = /^\s*(.+?)\s+(\d+(?:[.,]\d+)?)\s*(г|мл|шт|кусок|порция|сервинг|ст\.л\.|ч\.л\.|oz|ml|g|serving|slice|cup|tbsp|tsp)?\s*[,/]?\s*(\d+(?:[.,]\d+)?)\s*(ккал|кал|kcal)/i;
const FATSECRET_TOTAL_REGEX = /итого|всего|total|daily\s+total|сумма|итог/i;
const FATSUCCESS_MACRO_LINE = /(\d+(?:[.,]\d+)?)\s*(ккал|кал|kcal|белки?|жиры?|углевод|угл|жиры|бел|протеин|б|ж|у|carb|protein|fat|calori|cal|energy)/gi;
const MFP_LINE_REGEX = /^(.+?)\s+(\d+(?:[.,]\d+)?)\s*(?:(?:г|мл|шт|oz|serving|srvg|slice|cup|tbsp|шт|кус|порц|ml|g|pcs)[,.]?\s*)?(\d+(?:[.,]\d+)?)\s*(ккал|кал|kcal|cal)/i;
const INLINE_MACRO_REGEX = /(?:белки?|б|протеин|protein|p)\s*[:\-]?\s*(\d+(?:[.,]\d+)?)/i;
const INLINE_FAT_REGEX = /(?:жиры?|ж|fat|f)\s*[:\-]?\s*(\d+(?:[.,]\d+)?)/i;
const INLINE_CARB_REGEX = /(?:углевод|угл|у|carb|c|carbs)\s*[:\-]?\s*(\d+(?:[.,]\d+)?)/i;
const KCAL_FIRST_REGEX = /^\s*(\d+(?:[.,]\d+)?)\s*(ккал|кал|kcal)\s+(.+?)(?:\s+(\d+(?:[.,]\d+)?)\s*(г|мл|шт|g|ml))?$/i;

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
  return text.toLowerCase().replace(/ё/g, 'е').replace(/a/g, 'а').replace(/[^a-zа-я0-9]+/gi, ' ').trim();
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
function findFood(name: string): FoodItem | undefined {
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
      const score = words.reduce((total, word) => total + (foodWords.some(candidate => candidate.includes(word) || word.includes(candidate) || (word.length >= 5 && candidate.length >= 5 && editDistance(word, candidate) <= 1)) ? 1 : 0), 0);
      return { food, score };
    })
    .filter(result => result.score > 0)
    .sort((a, b) => b.score - a.score || a.food.name.length - b.food.name.length)[0]?.food;
}

function numberFrom(text: string | undefined, fallback: number): number {
  const value = Number.parseFloat((text || '').replace(',', '.'));
  return Number.isFinite(value) ? value : fallback;
}

function gramsFromQuantity(qty: string, food?: FoodItem): number {
  const value = numberFrom(qty.match(/[\d]+(?:[.,]\d+)?/)?.[0], 100);
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

function normalizeItem(name: string, qty: string, kcal: number, p: number, f: number, c: number) {
  const food = findFood(name);
  const weight = Math.max(1, gramsFromQuantity(qty, food));
  const multiplier = weight / 100;
  const hasMacros = kcal > 0 || p > 0 || f > 0 || c > 0;
  return {
    name: name || food?.name || 'Блюдо',
    qty,
    qtyGrams: Math.round(weight),
    kcal: hasMacros ? Math.round((kcal || (food?.kcal || 0) * multiplier) / multiplier) : food?.kcal || 0,
    p: hasMacros ? Math.round((p || (food?.protein || 0) * multiplier) / multiplier * 10) / 10 : food?.protein || 0,
    f: hasMacros ? Math.round((f || (food?.fat || 0) * multiplier) / multiplier * 10) / 10 : food?.fat || 0,
    c: hasMacros ? Math.round((c || (food?.carbs || 0) * multiplier) / multiplier * 10) / 10 : food?.carbs || 0,
    foodId: food?.id,
    category: food?.category,
  };
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
  const seen = new Set<string>();
  return [...grouped.values()].map(meal => ({
    ...meal,
    items: meal.items.filter(item => {
      const key = [item.foodId || normalizeFoodText(item.name), item.qtyGrams || item.qty].join('|');
      if (seen.has(key)) return false;
      seen.add(key);
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
      const val = parseFloat(m[1].replace(',', '.'));
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
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 2);
  const meals: ParsedMeal[] = [];
  let currentMeal: ParsedMeal | null = null;

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
      currentMeal.items.push(normalizeItem(foodOnlyMatch[1].trim(), `${foodOnlyMatch[2]} ${foodOnlyMatch[3]}`, 0, 0, 0, 0));
    }
  }

  return dedupeMeals(meals);
}

function parseMacroLabel(text: string): { p: number; f: number; c: number } {
  const p = text.match(INLINE_MACRO_REGEX);
  const f = text.match(INLINE_FAT_REGEX);
  const c = text.match(INLINE_CARB_REGEX);
  return {
    p: p ? parseFloat(p[1].replace(',', '.')) : 0,
    f: f ? parseFloat(f[1].replace(',', '.')) : 0,
    c: c ? parseFloat(c[1].replace(',', '.')) : 0,
  };
}

export function parseFatSecretText(text: string): ParsedMeal[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 1);
  const meals: ParsedMeal[] = [];
  let currentMeal: ParsedMeal | null = null;
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
      currentMeal.items.push(normalizeItem(
        foodOnlyMatch[1].trim(),
        `${foodOnlyMatch[2]} ${foodOnlyMatch[3]}`,
        0, 0, 0, 0,
      ));
    }
  }

  return dedupeMeals(meals);
}

/** Parse OCR/export text through both formats and keep the most complete result. */
export function parseNutritionText(text: string): ParsedMeal[] {
  const screenshotMeals = parseNutritionScreenshot(text);
  const exportMeals = parseFatSecretText(text);
  const merged = [...screenshotMeals, ...exportMeals];
  return dedupeMeals(merged);
}
